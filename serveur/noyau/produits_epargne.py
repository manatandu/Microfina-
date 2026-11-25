"""S27 : Paramétrage > Produit > Epargne > Gestion des produits épargnes (manuel Microfina++, p. 40). Champs, options Oui/Non et boutons de la
capture ; Devise ajoutée (registre S27-1). Montants en unités mineures, comme les opérations. Mêmes règles que web/src/donnees/api.ts (produitsEpargne)."""
from decimal import Decimal, InvalidOperation

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import controler_collecte_epargne, exiger

FAMILLES = ["EPARGNE", "BLOQUE", "TONTINE"]            # capture p. 40 (grille Famille)
# clé -> (colonne, libellé, sorte) ; sorte : texte, entier, montant, oui (case), ouiNon (boutons Oui/Non)
CHAMPS = {
    "numero": ("numero", "N° Produit", "entier"), "code": ("code", "Code produit", "texte"), "famille": ("famille", "Famille produit", "texte"),
    "libelle": ("libelle", "Libellé produit", "texte"), "devise": ("devise", "Devise", "texte"),
    "soldeMinimum": ("solde_minimum", "Solde minimum", "montant"), "retraitMaxJour": ("retrait_max_jour", "Max retrait/jour", "montant"),
    "nbMaxComptes": ("nb_max_comptes", "Max compte à créer", "entier"),
    "afficherAdhesion": ("afficher_adhesion", "Afficher à l'adhésion", "oui"), "actif": ("actif", "Actif", "oui"),
    "virementPrelevement": ("virement_prelevement", "Virement prélèvement", "oui"),
    "operer": ("operer_compte", "Opérer sur compte", "ouiNon"), "depotCheque": ("depot_cheque", "Dépôt de chèque", "ouiNon"),
    "caution": ("caution", "Caution", "ouiNon"), "nantissement": ("nantissement", "Nantissement", "ouiNon"),
    "tenueCompte": ("tenue_compte", "Tenu de compte", "ouiNon"), "calculerInteret": ("calcul_interet", "Calculer interêt", "ouiNon"),
    "soldeNegatif": ("solde_negatif", "Solde négatif", "ouiNon"), "repartitionGroupe": ("repartition_groupe", "Repartition groupe obligatoire", "ouiNon"),
    # Registre S27-5 (décision du porteur, 19/11/2026) : le taux du produit, affiché au plan d'épargne (S69, capture p. 79)
    "tauxInteret": ("taux_interet", "Taux intérêt", "taux"),
    "tauxNegociable": ("taux_negociable", "Taux négociable", "oui"),   # registre T142 : politique de l'institution, produit par produit (plan d'allègement, point 5.2)
}
OBLIGATOIRES = ["numero", "code", "famille", "libelle", "devise", "soldeMinimum", "nbMaxComptes", "operer", "depotCheque", "caution", "nantissement",
                "calculerInteret", "soldeNegatif", "repartitionGroupe"]


def lire_taux(t) -> str:
    return "" if t is None else format(t.normalize(), "f").replace(".", ",")


def vue(r) -> dict:
    return {"id": r["id"], **{k: (lire_taux(r[col]) if sorte == "taux" else r[col]) for k, (col, _, sorte) in CHAMPS.items()},
            "nature": r["categorie_compte"] or "", "compteLie": r["compte_lie"] or ""}   # nature et compte, portés par la fiche (plan d'allègement, point 2.17)


def lire(u) -> dict:
    exiger(u)
    rows = lignes("select * from produit_epargne where institution_id = %s and not supprime order by code", (u["institution_id"],))
    return {"familles": FAMILLES, "devises": [r["code"] for r in lignes("select code from devise order by code desc")], "produits": [vue(r) for r in rows]}


def valider(d) -> dict:
    v, manque = {}, []
    for k, (col, lib, sorte) in CHAMPS.items():
        x = d.get(k)
        if sorte == "texte":
            x = x.strip() if isinstance(x, str) and x.strip() else None
        elif sorte in ("oui", "ouiNon"):
            x = x if isinstance(x, bool) else (False if sorte == "oui" else None)
        elif sorte == "taux":
            s = str(x).strip().replace(",", ".") if x not in (None, "") else ""
            try:
                x = Decimal(s) if s else None
            except InvalidOperation:
                raise ErreurMetier(f"{lib} : un pourcentage, par exemple 4,5.")
            if x is not None and not (0 <= x <= 100):
                raise ErreurMetier(f"{lib} : entre 0 et 100 %.")
        else:
            if x in (None, ""):
                x = None
            elif not isinstance(x, int) or isinstance(x, bool) or x < 0:
                raise ErreurMetier(f"{lib} : nombre entier positif ou nul.")
        if x is None and k in OBLIGATOIRES:
            manque.append(lib)
        v[k] = x
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if v["famille"] not in FAMILLES:
        raise ErreurMetier("Famille produit inconnue.")
    if not valeur("select 1 from devise where code = %s", (v["devise"],)):
        raise ErreurMetier("Devise inconnue.")
    if not 1 <= v["numero"] <= 99:
        raise ErreurMetier("N° Produit : de 1 à 99 (il sert de suffixe au numéro de compte, S17).")
    if v["nbMaxComptes"] < 1:
        raise ErreurMetier("Max compte à créer : au moins 1.")
    return v


def enregistrer(u, d, pid: int | None = None) -> dict:
    """Enregistrer (nouveau produit) ou Modifier (produit choisi dans la grille), après confirmation (manuel p. 10 à 12)"""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    actuel = None
    if pid is not None:
        actuel = une("select * from produit_epargne where id = %s and institution_id = %s and not supprime for update", (pid, i))
        if not actuel:
            raise ErreurMetier("Produit introuvable.")
    v = valider(d)
    controler_collecte_epargne(u, v["famille"])        # loi 11/020, art. 12 : entreprise de micro-crédit
    if une("select 1 from produit_epargne where institution_id = %s and not supprime and lower(code) = lower(%s) and id is distinct from %s", (i, v["code"], pid)):
        raise ErreurMetier("Ce Code produit existe déjà.")
    if une("select 1 from produit_epargne where institution_id = %s and not supprime and numero = %s and id is distinct from %s", (i, v["numero"], pid)):
        raise ErreurMetier("Ce N° Produit existe déjà.")
    if actuel and valeur("select 1 from compte_depot where produit_id = %s limit 1", (pid,)):       # registre S27-3
        for k in ("devise", "famille", "numero"):
            if v[k] != actuel[CHAMPS[k][0]]:
                raise ErreurMetier(f"Des comptes sont ouverts sur ce produit : {CHAMPS[k][1]} ne se change plus.")
    # Registre S27-4 et S74-6 : le solde négatif n'est possible que sur un compte courant (catégorie posée en S28)
    nature = d.get("nature") if isinstance(d.get("nature"), str) and d.get("nature") else None   # nature du produit, portée par sa fiche (plan d'allègement, point 2.17)
    if v["soldeNegatif"] is True and (nature or (actuel or {}).get("categorie_compte")) != "Courant":
        raise ErreurMetier("Solde négatif = Oui : seulement pour un compte courant (catégorie Courant, PCCI 331). Une épargne, un dépôt à terme ou une épargne bloquée ne devient pas débiteur ; un découvert est un crédit (PCCI, compte 33 ; Instr. BCC 003, art. 7).")
    cols = [c for c, _, _ in CHAMPS.values()]
    vals = [v[k] for k in CHAMPS]
    nouveau = pid is None
    if pid is None:
        pid = valeur(f"insert into produit_epargne (institution_id, {', '.join(cols)}) values (%s, {', '.join(['%s'] * len(cols))}) returning id", (i, *vals))
    else:
        executer(f"update produit_epargne set {', '.join(f'{c} = %s' for c in cols)} where id = %s", (*vals, pid))
    if nature:   # la nature donne le compte du PCCI d'office (330, 331, 340, 334), modifiable vers un sous-compte : mêmes contrôles qu'en S28
        from .parametrage_epargne import ONGLETS, enregistrer as ranger
        types = [r["id"] for r in lignes("select id from liste_reference where institution_id = %s and liste = 'type_client' and actif", (i,))]
        ranger(u, {"onglet": nature, "produitId": pid, "compteLie": (d.get("compteLie") or "").strip() or ONGLETS.get(nature, ""), "typesClient": types})
    if nouveau:   # registre T169 : à la création du produit, un compte par catégorie de membre sous le compte du PCCI qui le range
        from .services import compte_du_produit
        p = une("select id, code, libelle, famille, compte_lie from produit_epargne where id = %s", (pid,))
        x = compte_du_produit(p)
        if valeur("select 1 from compte where numero = %s and institution_id is null", (x,)):
            for k in (0, 1, 2):
                valeur("select compte_produit(%s, %s, %s, %s, %s)", (i, x, f"epargne:{pid}", f"{p['libelle']} {p['code']}", k))
    return lire(u)


def supprimer(u, pid: int) -> dict:
    """Supprimer (p. 12) : logique (T02). Un produit qui a des comptes ne se supprime pas : décocher Actif (registre S27-3)"""
    exiger(u, "chef_agence")
    if not une("select 1 from produit_epargne where id = %s and institution_id = %s and not supprime for update", (pid, u["institution_id"])):
        raise ErreurMetier("Produit introuvable.")
    if valeur("select 1 from compte_depot where produit_id = %s limit 1", (pid,)) or valeur("select 1 from tiers where produit_id = %s limit 1", (pid,)):
        raise ErreurMetier("Des comptes sont ouverts sur ce produit : décocher Actif pour ne plus le proposer.")
    executer("update produit_epargne set supprime = true where id = %s", (pid,))
    return lire(u)
