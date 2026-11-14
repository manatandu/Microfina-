"""S23 : Paramétrage > Produit > Crédit > Produit crédit : création/modification (manuel Microfina++, p. 37 et 38).
Information de base suit la capture p. 38, sauf le mode de calcul des intérêts (Instr. BCC 38, art. 11 : méthode dégressive ; registre S23-1).
Garanties financières, Assurance, Frais, Autres informations : complétées d'après le manuel p. 86 et 114 et les Instr. BCC 38 et 40 (registre S23-*).
Mêmes règles que web/src/donnees/api.ts (produitsCredit)."""
import re
from decimal import Decimal, InvalidOperation

from .bd import ErreurMetier, executer, lignes, une, valeur
from .credit import CATALOGUE as CATALOGUE_CREDIT
from .moteur import compte_existe
from .services import exiger

FIXES = {c["page"]: c["fixe"] for c in CATALOGUE_CREDIT if "fixe" in c}
TYPES_PRODUIT = [(r["code"], r["nom"]) for r in FIXES["types_produit"]]          # S21, Type produit Credit
PERIODICITES = [(r["code"], r["libelle"]) for r in FIXES["periodicites"]]        # S21, Périodicité
MODES_CALCUL = ["Dégressif"]                      # Instr. BCC 38, art. 11 (la capture montre « Linéaire »)
TYPES_INTERET = ["Fixe"]                          # capture p. 38
MODES_DIFFERE = ["Réparti"]                       # capture p. 38
PAIEMENTS_INTERET = ["Normal"]                    # capture p. 38
NATURES = ["Montant", "Taux"]                     # comme les frais (S16-2)
CATEGORIES = ["Prêt à la consommation", "Prêt commercial", "Crédit de trésorerie", "Prêt d'investissement"]      # Instr. BCC 38, art. 6
TYPES_FRAIS = ["Frais de dossier", "Frais d'hypothèque", "Frais de mise en place", "Frais d'inscription des gages",
               "Frais de supervision/suivi/gestion du crédit"]                    # Instr. BCC 40, art. 8 (assurance et épargne : leurs pages)

CHAMPS = {   # clé -> (colonne, libellé, sorte) ; sorte : texte, nombre, entier, oui (booléen)
    "numero": ("numero", "Num Produit", "texte"), "nom": ("nom", "Nom du produit", "texte"), "typeProduit": ("type_produit", "Type Produit", "texte"),
    "cyclique": ("cyclique", "Cyclique", "oui"), "devise": ("devise", "Devise", "texte"), "modeCalcul": ("mode_calcul", "Mode calcul int", "texte"),
    "typeInteret": ("type_interet", "Type", "texte"), "tauxInteret": ("taux_interet", "Taux int. (%)", "nombre"),
    "tauxDiffere": ("taux_differe", "Taux diff. (%)", "nombre"),
    "montantMin": ("montant_min", "Montant minimum", "nombre"), "montantMax": ("montant_max", "Montant maximum", "nombre"),
    "dureeMin": ("duree_min", "Durée minimum", "entier"), "dureeMax": ("duree_max", "Durée maximum", "entier"),
    "differeMin": ("differe_min", "Différé minimum", "entier"), "differeMax": ("differe_max", "Différé maximum", "entier"),
    "interetMin": ("interet_min", "Intérêt minimum", "nombre"), "interetMax": ("interet_max", "Intérêt maximum", "nombre"),
    "clientPhysique": ("client_physique", "Physique", "oui"), "clientGroupe": ("client_groupe", "Groupe", "oui"),
    "clientEntreprise": ("client_entreprise", "Personne morale", "oui"), "maxParMembre": ("max_par_membre", "Appliquer montant max. prêt par mbre du groupe", "oui"),
    "periodicite": ("periodicite", "Périodicité", "texte"), "modeDiffere": ("mode_differe", "Mode différé", "texte"),
    "paiementInteret": ("paiement_interet", "Paiement intérêt", "texte"), "interetAnticipation": ("interet_anticipation", "Percevoir int. par anticipation", "oui"),
    "ageMax": ("age_max", "Age max", "entier"),
    "epargneNature": ("epargne_nature", "Nature de l'épargne obligatoire", "texte"), "epargneValeur": ("epargne_valeur", "Épargne obligatoire", "nombre"),
    "solidariteNature": ("solidarite_nature", "Nature du fonds de solidarité", "texte"), "solidariteValeur": ("solidarite_valeur", "Fonds de solidarité", "nombre"),
    "typeAssuranceId": ("type_assurance_id", "Type assurance", "id"), "assuranceNature": ("assurance_nature", "Nature de l'assurance", "texte"),
    "assuranceValeur": ("assurance_valeur", "Assurance", "nombre"),
    "categorie": ("categorie", "Catégorie de prêt", "texte"), "tauxRegle": ("taux_regle", "Taux réglementé ou bonifié", "oui"),
    "penaliteRetard": ("penalite_retard", "Pénalité de retard (%)", "nombre"),
    "penaliteAnticipation": ("penalite_anticipation", "Pénalité de remboursement anticipé (% des intérêts restant dus)", "nombre"),
    "ordreId": ("ordre_id", "Ordre de remboursement", "id"), "modeleId": ("modele_id", "Modèle", "id"),
}
OBLIGATOIRES = ["typeProduit", "numero", "nom", "devise", "modeCalcul", "typeInteret", "tauxInteret", "tauxDiffere", "montantMin", "dureeMin", "differeMin",
                "montantMax", "dureeMax", "differeMax", "periodicite", "modeDiffere", "paiementInteret", "interetAnticipation", "ageMax", "categorie"]
NULS_PERMIS = {"interetMin", "interetMax", "epargneNature", "solidariteNature", "typeAssuranceId", "assuranceNature", "ordreId"}


def nombre(x):
    if isinstance(x, bool) or x is None or x == "":
        return None
    try:
        n = Decimal(str(x).strip().replace(" ", "").replace(",", "."))
    except InvalidOperation:
        raise ErreurMetier(f"« {x} » n'est pas un nombre.")
    if not n.is_finite():
        raise ErreurMetier(f"« {x} » n'est pas un nombre.")
    return n


def options(u) -> dict:
    i = u["institution_id"]
    return {"typesProduit": [{"code": c, "libelle": n} for c, n in TYPES_PRODUIT], "periodicites": [{"code": c, "libelle": l} for c, l in PERIODICITES],
            "devises": [r["code"] for r in lignes("select code from devise order by code desc")], "modesCalcul": MODES_CALCUL, "typesInteret": TYPES_INTERET,
            "modesDiffere": MODES_DIFFERE, "paiementsInteret": PAIEMENTS_INTERET, "natures": NATURES, "categories": CATEGORIES, "typesFrais": TYPES_FRAIS,
            "typesAssurance": lignes("select id, libelle from credit_type_assurance where institution_id = %s and actif order by id", (i,)),
            "ordres": [{"id": o["id"], "libelle": f"{o['code']} ==> {o['libelle']}"} for o in
                       lignes("select id, code, libelle from credit_ordre where institution_id = %s and actif order by id", (i,))],
            "modeles": lignes("select id, libelle from credit_modele where institution_id = %s and actif order by id", (i,))}


def vue(r) -> dict:
    v = {}
    for k, (col, _, sorte) in CHAMPS.items():
        x = r[col]
        v[k] = float(x) if isinstance(x, Decimal) else x
    v["id"] = r["id"]
    v["frais"] = [{"typeFrais": f["type_frais"], "nature": f["nature"], "valeur": float(f["valeur"]), "compte": f["compte"]}
                  for f in lignes("select * from produit_credit_frais where produit_id = %s order by id", (r["id"],))]
    return v


def types_client(r) -> str:
    return ", ".join(n for k, n in (("client_physique", "Physique"), ("client_groupe", "Groupe"), ("client_entreprise", "Personne morale")) if r[k])


def lire(u) -> dict:
    """La page et la liste des produits crédits (Fig. 2, p. 38 : Numero, Produit, Type de client, Taux interet, Taux différé)"""
    exiger(u)
    rows = lignes("select * from produit_credit where institution_id = %s order by numero", (u["institution_id"],))
    return {"options": options(u), "produits": [{"id": r["id"], "numero": r["numero"], "nom": r["nom"], "typeClient": types_client(r),
                                                  "tauxInteret": float(r["taux_interet"]), "tauxDiffere": float(r["taux_differe"]), "actif": r["actif"]} for r in rows]}


def lire_produit(u, pid: int) -> dict:
    exiger(u)
    r = une("select * from produit_credit where id = %s and institution_id = %s", (pid, u["institution_id"]))
    if not r:
        raise ErreurMetier("Produit introuvable.")
    return vue(r)


def valider(u, d) -> tuple[dict, list]:
    v, manque = {}, []
    for k, (col, lib, sorte) in CHAMPS.items():
        x = d.get(k)
        if sorte == "texte":
            x = x.strip() if isinstance(x, str) else ""
            x = x or None
        elif sorte == "oui":
            x = x if isinstance(x, bool) else None
        elif sorte == "id":
            x = x if isinstance(x, int) and not isinstance(x, bool) and x > 0 else None
        else:
            x = nombre(x)
            if x is not None and x < 0:
                raise ErreurMetier(f"{lib} : nombre positif ou nul.")
            if sorte == "entier" and x is not None:
                if x != int(x):
                    raise ErreurMetier(f"{lib} : nombre entier.")
                x = int(x)
        if x is None and k in OBLIGATOIRES:
            manque.append(lib)
        v[k] = x
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    for k in ("cyclique", "clientPhysique", "clientGroupe", "clientEntreprise", "maxParMembre", "tauxRegle"):
        v[k] = bool(v[k])
    for k in ("epargneValeur", "solidariteValeur", "assuranceValeur", "penaliteRetard", "penaliteAnticipation"):
        v[k] = v[k] if v[k] is not None else Decimal(0)
    # Listes fermées
    for k, liste in (("typeProduit", [c for c, _ in TYPES_PRODUIT]), ("periodicite", [c for c, _ in PERIODICITES]), ("modeCalcul", MODES_CALCUL),
                     ("typeInteret", TYPES_INTERET), ("modeDiffere", MODES_DIFFERE), ("paiementInteret", PAIEMENTS_INTERET), ("categorie", CATEGORIES),
                     ("epargneNature", NATURES), ("solidariteNature", NATURES), ("assuranceNature", NATURES)):
        if v[k] is not None and v[k] not in liste:
            raise ErreurMetier(f"{CHAMPS[k][1]} inconnu." + (" L'Instr. BCC 38, art. 11, impose la méthode dégressive." if k == "modeCalcul" else ""))
    if not valeur("select 1 from devise where code = %s", (v["devise"],)):
        raise ErreurMetier("Devise inconnue.")
    if not (v["clientPhysique"] or v["clientGroupe"] or v["clientEntreprise"]):
        raise ErreurMetier("Types de client : cocher au moins un type.")           # registre S23-3
    if v["dureeMin"] < 1:
        raise ErreurMetier("Durée minimum : au moins 1 mois.")
    for a, b, nom in (("montantMin", "montantMax", "Montant"), ("dureeMin", "dureeMax", "Durée"), ("differeMin", "differeMax", "Différé"),
                      ("interetMin", "interetMax", "Intérêt")):
        if v[a] is not None and v[b] is not None and v[b] < v[a]:
            raise ErreurMetier(f"{nom} : le maximum est inférieur au minimum.")     # registre S23-3
    if v["differeMax"] >= v["dureeMax"]:
        raise ErreurMetier("Le différé maximum doit être inférieur à la durée maximum.")
    if (v["interetMin"] is not None and v["tauxInteret"] < v["interetMin"]) or (v["interetMax"] is not None and v["tauxInteret"] > v["interetMax"]):
        raise ErreurMetier("Taux int. (%) hors des bornes Intérêt minimum et maximum.")
    if v["ageMax"] < 18 or v["ageMax"] > 120:
        raise ErreurMetier("Age max : entre 18 et 120 ans.")
    for nat, val, nom in (("epargneNature", "epargneValeur", "Épargne obligatoire"), ("solidariteNature", "solidariteValeur", "Fonds de solidarité"),
                          ("assuranceNature", "assuranceValeur", "Assurance")):
        if v[val] > 0 and v[nat] is None:
            raise ErreurMetier(f"{nom} : choisir Montant ou Taux.")
        if v[nat] == "Taux" and v[val] > 100:
            raise ErreurMetier(f"{nom} : un taux ne dépasse pas 100 %.")
        if v[val] == 0:
            v[nat] = None
    for k in ("tauxInteret", "tauxDiffere", "penaliteRetard"):
        if v[k] > 100:
            raise ErreurMetier(f"{CHAMPS[k][1]} : un taux ne dépasse pas 100 %.")
    if v["penaliteAnticipation"] > 50:
        raise ErreurMetier("Pénalité de remboursement anticipé : au plus 50 % des intérêts restant dus (Instr. BCC 38, art. 14).")
    i = u["institution_id"]
    if v["typeAssuranceId"] is not None and not une("select 1 from credit_type_assurance where id = %s and institution_id = %s and actif", (v["typeAssuranceId"], i)):
        raise ErreurMetier("Type assurance inconnu.")
    if v["assuranceValeur"] > 0 and v["typeAssuranceId"] is None:
        raise ErreurMetier("Assurance : choisir le type d'assurance.")
    if v["ordreId"] is not None and not une("select 1 from credit_ordre where id = %s and institution_id = %s and actif", (v["ordreId"], i)):
        raise ErreurMetier("Ordre de remboursement inconnu.")
    if v["modeleId"] is not None and not une("select 1 from credit_modele where id = %s and institution_id = %s and actif", (v["modeleId"], i)):
        raise ErreurMetier("Modèle inconnu.")
    # Frais (Instr. BCC 40, art. 8) : un type une fois, nature, valeur, compte du plan (T16)
    frais, vus = [], set()
    for f in d.get("frais") or []:
        if not isinstance(f, dict):
            raise ErreurMetier("Frais : ligne illisible.")
        t, nat, val, cpt = (f.get("typeFrais") or "").strip(), (f.get("nature") or "").strip(), nombre(f.get("valeur")), (f.get("compte") or "").strip()
        manque = [n for n, x in (("type de frais", t), ("nature", nat), ("valeur", val), ("compte", cpt)) if x in ("", None)]
        if manque:
            raise ErreurMetier("Frais : à remplir : " + ", ".join(manque) + ".")
        if t not in TYPES_FRAIS:
            raise ErreurMetier("Frais : type inconnu.")
        if t in vus:
            raise ErreurMetier(f"Frais : {t} figure deux fois.")
        if nat not in NATURES:
            raise ErreurMetier("Frais : nature inconnue.")
        if val <= 0 or (nat == "Taux" and val > 100):
            raise ErreurMetier(f"Frais : {t} : valeur positive, et un taux ne dépasse pas 100 %.")
        if not re.fullmatch(r"\d+", cpt) or not compte_existe(u, cpt):
            raise ErreurMetier(f"Frais : le compte {cpt} n'existe pas au plan de comptes.")
        vus.add(t)
        frais.append((t, nat, val, cpt))
    return v, frais


def enregistrer(u, d, pid: int | None = None) -> dict:
    """Enregistrer (nouveau produit, bouton +) ou modifier le produit choisi dans la liste. Tous les contrôles avant d'écrire."""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    if pid is not None and not une("select 1 from produit_credit where id = %s and institution_id = %s for update", (pid, i)):
        raise ErreurMetier("Produit introuvable.")
    v, frais = valider(u, d)
    if une("select 1 from produit_credit where institution_id = %s and lower(numero) = lower(%s) and id is distinct from %s", (i, v["numero"], pid)):
        raise ErreurMetier("Ce Num Produit existe déjà.")
    cols = [c for c, _, _ in CHAMPS.values()]
    vals = [v[k] for k in CHAMPS]
    if pid is None:
        pid = valeur(f"insert into produit_credit (institution_id, {', '.join(cols)}) values (%s, {', '.join(['%s'] * len(cols))}) returning id", (i, *vals))
    else:
        executer(f"update produit_credit set {', '.join(f'{c} = %s' for c in cols)} where id = %s", (*vals, pid))
        executer("delete from produit_credit_frais where produit_id = %s", (pid,))
    for t, nat, val, cpt in frais:
        executer("insert into produit_credit_frais (produit_id, type_frais, nature, valeur, compte) values (%s, %s, %s, %s, %s)", (pid, t, nat, val, cpt))
    return {**lire(u), "produit": lire_produit(u, pid)}


def activer(u, d) -> dict:
    """S25 : Activer ou Désactiver les produits cochés (capture p. 39). Un produit désactivé n'est plus proposé aux nouvelles demandes ;
    les crédits déjà accordés suivent leur cours (registre S25-1)."""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    ids, actif = d.get("ids"), d.get("actif")
    if not isinstance(actif, bool):
        raise ErreurMetier("Activer ou Désactiver ?")
    if not isinstance(ids, list) or not ids or not all(isinstance(x, int) and not isinstance(x, bool) for x in ids):
        raise ErreurMetier("Cocher au moins un produit.")
    trouves = lignes("select id from produit_credit where institution_id = %s and id = any(%s) for update", (u["institution_id"], ids))
    if len(trouves) != len(set(ids)):
        raise ErreurMetier("Produit introuvable.")
    executer("update produit_credit set actif = %s where institution_id = %s and id = any(%s)", (actif, u["institution_id"], ids))
    return lire(u)
