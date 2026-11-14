"""S52 : Banque > Opération (manuel Microfina++, p. 60 et 61) : Encaissement / Décaissement, V. Banque vers caisse, V. Banque vers Banque.
L'opération est saisie ici ; elle est visée puis validée en S57 et comptabilisée en S111 (COMPLEMENTS § 6). Le numéro de pièce est donné à la
comptabilisation (registre S52-2). Mêmes règles que web/src/donnees/api.ts (banqueOperations)."""
import re
import uuid

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import compte_du_produit, controler_statut_actif, exiger, journee_courante, nom_utilisateur, numero_compte, preparer_adhesion, solde_contrat

TYPES = {"encaissement": "Encaissement divers", "decaissement": "Décaissement divers", "banque_caisse": "Virement banque vers caisse",
         "banque_banque": "Virement banque vers banque", "virement_client": "Virement", "prelevement_client": "Prélèvement", "adhesion_banque": "Adhésion par banque"}


def solde_banque(compte_id: int, devise: str) -> int:
    """Solde du compte du plan (560x, comptes NOSTRI) lié au compte bancaire, sens normal débit"""
    return int(valeur("""select coalesce(sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end), 0)
                         from ligne_ecriture l where l.compte_id = %s and l.devise = %s""", (compte_id, devise)))


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    j = journee_courante(u)
    comptes = lignes("""select cb.id, cb.banque_id as "banqueId", b.code as "banqueCode", b.nom as banque, cb.numero, trim(cb.devise) as devise, c.numero as compte, cb.compte_id
                        from compte_bancaire cb join banque b on b.id = cb.banque_id join compte c on c.id = cb.compte_id
                        where cb.institution_id = %s order by b.code, cb.numero""", (i,))
    guichets = lignes("select id, code, nom from guichet where agence_id = %s and actif order by code", (u["agence_id"],))
    return {
        "date": j["date"] if j and j["statut"] == "ouverte" else "",
        "banques": lignes("select id, code, nom as libelle from banque where institution_id = %s order by code", (i,)),
        "comptes": [{k: v for k, v in c.items() if k != "compte_id"} | {"solde": solde_banque(c["compte_id"], c["devise"])} for c in comptes],
        "guichets": [{**g, "soldes": {d: solde_contrat(f"guichet:{g['id']}", d, "D") for d in ("CDF", "USD")}} for g in guichets],
        "typesBudget": lignes("select id, code, libelle from budget_type where institution_id = %s and actif order by code", (i,)),
        "lignesBudget": lignes("select id, numero, libelle, bailleur_id as \"bailleurId\" from budget_ligne where institution_id = %s and actif order by numero", (i,)),
    }


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def entier(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def compte_bancaire(u, cid, quoi: str) -> dict:
    c = une("select id, trim(devise) as devise from compte_bancaire where id = %s and institution_id = %s", (cid, u["institution_id"])) if cid else None
    if not c:
        raise ErreurMetier(f"{quoi} : compte bancaire inconnu.")
    return c


CLIENT = ("virement_client", "prelevement_client")


def apercu_adhesion(u, tid: int, parts: int = 1, depot: int = 0) -> dict:
    """S56 : ce que l'écran montre avant d'enregistrer : N° du compte épargne qui sera ouvert, parts, frais, total. Aucune écriture."""
    exiger(u)
    a = preparer_adhesion(u, {"tiersId": tid, "parts": parts, "depot": depot})
    return {"numeroCompte": numero_compte(u, a["t"], a["produit"]), "devise": "CDF", "valeurPart": a["m_parts"] // a["nb"],
            "frais": [{"fraisId": f["fraisId"], "libelle": f["libelle"], "compte": f["compte"], "montant": f["montant"]} for f in a["frais"]], "total": a["total"]}


def enregistrer_adhesion(u, d) -> dict:
    """Bouton Enregistrer de « Adhésion à la Banque » (p. 64) : saisie en attente du visa (S57) ; le compte épargne s'ouvre à la validation (registre S56-1).
    Mêmes contrôles que l'adhésion au guichet (S73), le paiement se fait sur un compte bancaire de l'institution en CDF."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    try:
        cle = str(uuid.UUID(texte(d, "cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = une("select * from operation_banque where cle_idempotence = %s", (cle,))
    if prec:
        return vue(prec)
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    date_op = texte(d, "date")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_op):
        raise ErreurMetier("À remplir : date opération.")
    if date_op > j["date"]:
        raise ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.")
    a = preparer_adhesion(u, {"tiersId": d.get("tiersId"), "parts": d.get("parts"), "depot": d.get("depot", 0)})
    banque = compte_bancaire(u, entier(d, "compteBancaireId"), "Compte Banque")
    if banque["devise"] != "CDF":                         # registre S56-3 : frais et parts en CDF
        raise ErreurMetier("Le compte bancaire doit être en CDF : frais et parts de l'adhésion sont en CDF.")
    if une("select 1 from operation_banque where tiers_id = %s and type = 'adhesion_banque' and statut in ('saisie', 'visee', 'validee', 'comptabilisee')", (a["tid"],)):
        raise ErreurMetier("Une adhésion par banque est déjà en cours pour ce membre.")      # registre S56-2
    oid = valeur("""insert into operation_banque (institution_id, agence_id, type, date_operation, compte_bancaire_id, libelle, montant, devise, cle_idempotence,
                                                  saisi_par, tiers_id, parts, premier_depot)
                    values (%s, %s, 'adhesion_banque', %s, %s, %s, %s, 'CDF', %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], u["agence_id"], date_op, banque["id"], TYPES["adhesion_banque"], a["total"], cle, u["id"], a["tid"], a["nb"], a["m_depot"]))
    return vue(une("select * from operation_banque where id = %s", (oid,)))


def enregistrer(u, d, client: bool = False) -> dict:
    """Bouton Enregistrer : S52 (trois onglets) ou S53 (client = True, virement et prélèvement) ; l'opération est saisie, en attente du visa (S57).
    Chaque écran a sa route, donc son droit (registre S04-3)."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    try:
        cle = str(uuid.UUID(texte(d, "cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = une("select * from operation_banque where cle_idempotence = %s", (cle,))
    if prec:
        return vue(prec)                                     # même clé : la même opération (double clic, reprise réseau)
    i = u["institution_id"]
    type_ = texte(d, "type")
    if type_ not in TYPES or type_ == "adhesion_banque" or (type_ in CLIENT) != client:
        raise ErreurMetier("Type d'opération inconnu.")
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    date_op = texte(d, "date")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_op):
        raise ErreurMetier("À remplir : date opération.")
    if date_op > j["date"]:
        raise ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.")
    montant = entier(d, "montant")
    if not montant or montant <= 0:
        raise ErreurMetier("Montant : un montant supérieur à zéro.")
    origine = compte_bancaire(u, entier(d, "compteBancaireId"), "Compte Banque" if type_ != "banque_banque" else "Compte Banque d'origine")
    compte = libelle = cheque = None
    guichet = dest = type_budget = ligne_budget = compte_client = None
    if type_ in ("encaissement", "decaissement"):
        compte = texte(d, "compte")
        if not compte:
            raise ErreurMetier("À remplir : compte.")
        c = une("select saisissable, ouvert from compte where numero = %s and (institution_id is null or institution_id = %s)", (compte, i))
        if not c:
            raise ErreurMetier(f"Compte : {compte} n'est pas un compte du plan (une classe ne reçoit pas d'écriture).")      # T16
        if not (c["saisissable"] and c["ouvert"]):
            raise ErreurMetier(f"Compte : {compte} est fermé ou non saisissable, il ne reçoit pas d'écriture.")              # S102-10
        if compte.startswith(("56", "57")):                 # registre S52-4 : banque et caisse ont leurs onglets de virement
            raise ErreurMetier("Compte : un compte de banque (56) ou de caisse (57) passe par les onglets de virement.")
        libelle = texte(d, "libelle") or TYPES[type_]
        cheque = (texte(d, "cheque") or None) if type_ == "decaissement" else None
        type_budget, ligne_budget = entier(d, "typeBudgetId"), entier(d, "ligneBudgetId")
        if type_budget and not une("select 1 from budget_type where id = %s and institution_id = %s and actif", (type_budget, i)):
            raise ErreurMetier("Type budget inconnu.")
        if ligne_budget and not une("select 1 from budget_ligne where id = %s and institution_id = %s and actif", (ligne_budget, i)):
            raise ErreurMetier("Ligne budgétaire inconnue.")
    elif type_ in ("virement_client", "prelevement_client"):       # S53 (p. 61)
        c = une("""select c.id, c.statut, trim(c.devise) as devise, t.statut as statut_client from compte_depot c join tiers t on t.id = c.tiers_id
                   where c.id = %s and t.institution_id = %s for update of c""", (entier(d, "compteDepotId"), i)) if entier(d, "compteDepotId") else None
        if not c:
            raise ErreurMetier("À remplir : N° Compte du client.")
        controler_statut_actif(c["statut_client"])
        if c["statut"] != "ouvert":
            raise ErreurMetier("Compte du client fermé.")
        if c["devise"] != origine["devise"]:                 # registre S53-3
            raise ErreurMetier("Le compte du client et le compte bancaire n'ont pas la même devise.")
        libelle = texte(d, "libelle")
        if not libelle:
            raise ErreurMetier("À remplir : libellé opération.")
        if type_ == "prelevement_client":                   # registre S53-2 : comme un retrait (S74), sur le disponible
            bloque = int(valeur("select coalesce(sum(montant), 0) from blocage where compte_id = %s and (fin is null or fin > now())", (c["id"],)))
            attente = int(valeur("""select coalesce(sum(montant), 0) from operation_banque where compte_depot_id = %s and type = 'prelevement_client'
                                     and statut in ('saisie', 'visee', 'validee')""", (c["id"],)))
            if montant > solde_contrat(f"depot:{c['id']}", c["devise"], "C") - bloque - attente:
                raise ErreurMetier("Solde disponible insuffisant sur le compte du client.")
        compte_client = c["id"]
    elif type_ == "banque_caisse":
        guichet = entier(d, "guichetId")
        if not guichet or not une("select 1 from guichet where id = %s and agence_id = %s and actif", (guichet, u["agence_id"])):
            raise ErreurMetier("À remplir : caisse.")
        cheque = texte(d, "cheque") or None
        libelle = TYPES[type_]
    else:
        dest = compte_bancaire(u, entier(d, "compteBancaireDestId"), "Compte Banque destination")
        if dest["id"] == origine["id"]:
            raise ErreurMetier("Compte Banque destination : un autre compte que celui d'origine.")
        if dest["devise"] != origine["devise"]:             # registre S52-6
            raise ErreurMetier("Virement entre deux devises : à confirmer avec le porteur (cours du jour, S35).")
        dest = dest["id"]
        libelle = TYPES[type_]
    oid = valeur("""insert into operation_banque (institution_id, agence_id, type, date_operation, compte_bancaire_id, compte_bancaire_dest_id, guichet_id, compte,
                                                  libelle, montant, devise, cheque, budget_type_id, budget_ligne_id, cle_idempotence, saisi_par, compte_depot_id)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (i, u["agence_id"], type_, date_op, origine["id"], dest, guichet, compte, libelle, montant, origine["devise"], cheque,
                  type_budget, ligne_budget, cle, u["id"], compte_client))
    return vue(une("select * from operation_banque where id = %s", (oid,)))


def vue(o: dict) -> dict:
    return {"id": o["id"], "type": o["type"], "date": o["date_operation"].isoformat(), "compteBancaireId": o["compte_bancaire_id"],
            "compteBancaireDestId": o["compte_bancaire_dest_id"], "guichetId": o["guichet_id"], "compte": o["compte"] or "", "libelle": o["libelle"] or "",
            "montant": o["montant"], "devise": o["devise"].strip(), "cheque": o["cheque"] or "", "statut": o["statut"], "piece": o["piece"] or "",
            "compteDepotId": o.get("compte_depot_id"), "tiersId": o.get("tiers_id"), "parts": o.get("parts"), "premierDepot": o.get("premier_depot")}


# ---------- S57 : Visa puis Validation (manuel p. 65 à 67) ----------
# Quatre listes, vues deux fois : au visa (opérations saisies) puis à la validation (opérations visées). La liste « Virement / Prélèvement » a ses propres colonnes.
LISTES_VISA = {"enc_dec": ("encaissement", "decaissement", "adhesion_banque"), "banque_caisse": ("banque_caisse",),
               "banque_banque": ("banque_banque",), "virement": ("virement_client", "prelevement_client")}
ETAPES = {"visa": "saisie", "validation": "visee"}


def lister_visas(u, etape: str, liste: str) -> list[dict]:
    """Lignes en attente de l'étape (visa : saisies ; validation : visées), pour une des quatre listes"""
    exiger(u)
    if etape not in ETAPES or liste not in LISTES_VISA:
        raise ErreurMetier("Liste inconnue.")
    res = []
    for o in lignes("""select o.*, b.code as banque_code, b.nom as banque_nom, cb.numero as banque_numero, c.numero as banque_compte,
                              bd.code as dest_code, bd.nom as dest_nom, cbd.numero as dest_numero, cd.numero as depot_numero
                       from operation_banque o join compte_bancaire cb on cb.id = o.compte_bancaire_id join banque b on b.id = cb.banque_id join compte c on c.id = cb.compte_id
                       left join compte_bancaire cbd on cbd.id = o.compte_bancaire_dest_id left join banque bd on bd.id = cbd.banque_id
                       left join compte_depot cd on cd.id = o.compte_depot_id
                       where o.institution_id = %s and o.statut = %s and o.type = any(%s) order by o.date_operation, o.id""",
                      (u["institution_id"], ETAPES[etape], list(LISTES_VISA[liste]))):
        ligne = vue(o) | {"operation": TYPES[o["type"]], "banque": f"{o['banque_code']} => {o['banque_nom']}", "compteBanque": f"{o['banque_numero']} => {o['banque_compte']}",
                          "banqueDest": f"{o['dest_code']} => {o['dest_nom']}" if o["dest_code"] else "", "compteBanqueDest": o["dest_numero"] or "",
                          "saisiPar": nom_utilisateur(o["saisi_par"]), "visePar": nom_utilisateur(o["vise_par"])}
        if o["compte_depot_id"]:
            c = une("select p.famille, p.compte_lie from compte_depot cd join produit_epargne p on p.id = cd.produit_id where cd.id = %s", (o["compte_depot_id"],))
            ligne |= {"compteEpargne": o["depot_numero"], "numeroComptable": compte_du_produit(c)}
            ligne |= {"debit": o["montant"] if o["type"] == "prelevement_client" else 0, "credit": o["montant"] if o["type"] == "virement_client" else 0}
        else:
            ligne["numeroComptable"] = o["compte"] or ""
        res.append(ligne)
    return res


def faire_suivre(u, oid: int, etape: str, d=None) -> dict:
    """Visa (saisie vers visée) ou validation (visée vers validée). Quatre yeux : le visa et la validation viennent d'une autre personne que celle qui a saisi ;
    la validation, d'une autre que celle qui a visé (registre S57-1). La comptabilisation (S111) vient ensuite."""
    exiger(u)
    o = une("select * from operation_banque where id = %s and institution_id = %s for update", (oid, u["institution_id"]))
    attendu = ETAPES.get(etape)
    if not o or o["statut"] != attendu:
        raise ErreurMetier("Rien à viser." if etape == "visa" else "Rien à valider.")
    if o["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : " + ("pas de visa sur sa propre saisie." if etape == "visa" else "pas de validation sur sa propre saisie."))
    if etape == "validation":
        if o["vise_par"] == u["id"]:
            raise ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a visé.")
        j = journee_courante(u)
        jour = j["date"] if j and j["statut"] == "ouverte" else ""
        if not jour:
            raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
        date_val = texte(d or {}, "date") or jour
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_val):
            raise ErreurMetier("À remplir : date opération.")
        if date_val < o["date_operation"].isoformat():
            raise ErreurMetier("La date de validation précède la date de l'opération.")
        if date_val > jour:
            raise ErreurMetier("La date de validation ne peut pas dépasser la journée ouverte.")
        executer("update operation_banque set statut = 'validee', valide_par = %s, valide_le = now(), date_validation = %s where id = %s", (u["id"], date_val, oid))
    else:
        executer("update operation_banque set statut = 'visee', vise_par = %s, vise_le = now() where id = %s", (u["id"], oid))
    return vue(une("select * from operation_banque where id = %s", (oid,)))
