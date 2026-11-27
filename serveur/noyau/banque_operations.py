"""S52 : Banque > Opération (manuel Microfina++, p. 60 et 61) : Encaissement / Décaissement, V. Banque vers caisse, V. Banque vers Banque.
L'opération est saisie ici ; elle est visée puis validée en S57 et comptabilisée en S111 (COMPLEMENTS § 6). Le numéro de pièce est donné à la
comptabilisation (registre S52-2). Mêmes règles que web/src/donnees/api.ts (banqueOperations)."""
import re
import uuid

from . import chequiers
from psycopg.types.json import Jsonb

from .services import json_lu
from .cloison import agence, clause
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import compte_du_produit, compte_institution, controler_statut_actif, est_coopec, exiger, journee_courante, nom_utilisateur, numero_compte, preparer_adhesion, solde_contrat

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
                        where cb.institution_id = %s and cb.supprime_le is null and b.supprime_le is null order by b.code, cb.numero""", (i,))
    guichets = lignes("select id, code, nom from guichet where agence_id = %s and actif order by code", (u["agence_id"],))
    return {
        "date": j["date"] if j and j["statut"] == "ouverte" else "",
        "banques": lignes("select id, code, nom as libelle from banque where institution_id = %s and supprime_le is null order by code", (i,)),
        "comptes": [{k: v for k, v in c.items() if k != "compte_id"} | {"solde": solde_banque(c["compte_id"], c["devise"])} for c in comptes],
        "guichets": [{**g, "soldes": {d: solde_contrat(f"guichet:{g['id']}", d, "D") for d in ("CDF", "USD")}} for g in guichets],
        "typesBudget": lignes("select id, code, libelle from budget_type where institution_id = %s and actif order by code", (i,)),
        "lignesBudget": lignes("select id, numero, libelle, bailleur_id as \"bailleurId\" from budget_ligne where institution_id = %s and actif order by numero", (i,)),
        "cheques": chequiers.disponibles(i),                  # S60 : liste « N° de chèque » (registre S60-1)
    }


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def entier(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def compte_bancaire(u, cid, quoi: str) -> dict:
    c = une("select id, trim(devise) as devise from compte_bancaire where id = %s and institution_id = %s and supprime_le is null", (cid, u["institution_id"])) if cid else None
    if not c:
        raise ErreurMetier(f"{quoi} : compte bancaire inconnu.")
    return c


CLIENT = ("virement_client", "prelevement_client")


def apercu_adhesion(u, tid: int, parts: int | None = None, depot: int = 0) -> dict:
    """S56 : ce que l'écran montre avant d'enregistrer : N° du compte épargne qui sera ouvert, parts, frais, total. Aucune écriture."""
    exiger(u)
    if parts is None:
        parts = 1 if est_coopec(u) else 0          # IMF : pas de parts sociales (loi 11/020, art. 14 et 15)
    a = preparer_adhesion(u, {"tiersId": tid, "parts": parts, "depot": depot})
    if a["produit"]["devise"].strip() != "CDF":
        raise ErreurMetier("Compte à créer en devise : l'adhésion par banque se fait en CDF ; passer par l'adhésion au guichet.")
    return {"numeroCompte": numero_compte(u, a["t"], a["produit"]), "devise": "CDF", "valeurPart": a["m_parts"] // a["nb"] if a["nb"] else 0,
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
    if a["produit"]["devise"].strip() != "CDF":          # registre S56-3 : compte bancaire en CDF ; un compte en devise s'ouvre par l'adhésion au guichet (S73-1)
        raise ErreurMetier("Compte à créer en devise : l'adhésion par banque se fait en CDF ; passer par l'adhésion au guichet.")
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
    guichet = dest = type_budget = ligne_budget = compte_client = ordre = None
    if type_ in ("encaissement", "decaissement"):
        compte = texte(d, "compte")
        if not compte:
            raise ErreurMetier("À remplir : compte.")
        compte_institution(u, compte, "Compte")   # lot 10 : un compte de l'institution (registre T172)
        c = une("select saisissable, ouvert, bloque from compte where numero = %s and institution_id = %s", (compte, i))
        if c and c["bloque"]:   # registre T171 : un compte bloqué ne reçoit que les écritures du logiciel
            raise ErreurMetier(f"Compte : {compte} est bloqué, il ne reçoit que les écritures du logiciel.")
        if not c:
            raise ErreurMetier(f"Compte : {compte} n'est pas un compte du plan (une classe ne reçoit pas d'écriture).")      # T16
        if not (c["saisissable"] and c["ouvert"]):
            raise ErreurMetier(f"Compte : {compte} est fermé ou non saisissable, il ne reçoit pas d'écriture.")              # S102-10
        if compte.startswith(("56", "57")):                 # registre S52-4 : banque et caisse ont leurs onglets de virement
            raise ErreurMetier("Compte : un compte de banque (56) ou de caisse (57) passe par les onglets de virement.")
        libelle = texte(d, "libelle") or TYPES[type_]
        cheque = (texte(d, "cheque") or None) if type_ == "decaissement" else None
        if type_ == "encaissement" and texte(d, "cheque"):
            raise ErreurMetier("N° de chèque : seulement pour un décaissement.")
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
            from .services import montant_bloque, sorties_en_attente
            bloque = montant_bloque(c["id"], solde_contrat(f"depot:{c['id']}", c["devise"], "C"))
            if montant > solde_contrat(f"depot:{c['id']}", c["devise"], "C") - bloque - sorties_en_attente(c["id"]):
                raise ErreurMetier("Solde disponible insuffisant sur le compte du client.")
            from .virements import ordre_du_client
            ordre = ordre_du_client(d)
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
            raise ErreurMetier("Virement entre deux devises : les deux comptes doivent être dans la même devise.")
        dest = dest["id"]
        libelle = TYPES[type_]
    # A12 : virement reçu par la banque sur le compte du client, donneur d'ordre ; prélèvement vers la banque, bénéficiaire (loi 22/068, art. 57 et 61)
    from . import virements
    donneur, beneficiaire = virements.controler(d, type_ == "virement_client", type_ == "prelevement_client")
    oid = valeur("""insert into operation_banque (institution_id, agence_id, type, date_operation, compte_bancaire_id, compte_bancaire_dest_id, guichet_id, compte,
                                                  libelle, montant, devise, cheque, budget_type_id, budget_ligne_id, cle_idempotence, saisi_par, compte_depot_id,
                                                  donneur_ordre, beneficiaire, ordre_client)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (i, u["agence_id"], type_, date_op, origine["id"], dest, guichet, compte, libelle, montant, origine["devise"], cheque,
                  type_budget, ligne_budget, cle, u["id"], compte_client, Jsonb(donneur) if donneur else None, Jsonb(beneficiaire) if beneficiaire else None, ordre))
    if cheque:                                                # registre S60-2 : un chèque d'un chéquier du compte, une seule fois
        chequiers.utiliser(origine["id"], cheque, oid)
    return vue(une("select * from operation_banque where id = %s", (oid,)))


def vue(o: dict) -> dict:
    return {"id": o["id"], "type": o["type"], "date": o["date_operation"].isoformat(), "compteBancaireId": o["compte_bancaire_id"],
            "compteBancaireDestId": o["compte_bancaire_dest_id"], "guichetId": o["guichet_id"], "compte": o["compte"] or "", "libelle": o["libelle"] or "",
            "montant": o["montant"], "devise": o["devise"].strip(), "cheque": o["cheque"] or "", "statut": o["statut"], "piece": o["piece"] or "",
            "compteDepotId": o.get("compte_depot_id"), "tiersId": o.get("tiers_id"), "parts": o.get("parts"), "premierDepot": o.get("premier_depot"),
            "donneurOrdre": json_lu(o.get("donneur_ordre")) or None, "beneficiaire": json_lu(o.get("beneficiaire")) or None}   # A12


# ---------- S57 : Visa puis Validation (manuel p. 65 à 67) ----------
# Quatre listes, vues deux fois : au visa (opérations saisies) puis à la validation (opérations visées). La liste « Virement / Prélèvement » a ses propres colonnes.
LISTES_VISA = {"enc_dec": ("encaissement", "decaissement", "adhesion_banque"), "banque_caisse": ("banque_caisse",),
               "banque_banque": ("banque_banque",), "virement": ("virement_client", "prelevement_client")}
ETAPES = {"visa": "saisie", "validation": "visee"}


SELECT_LIGNES = """select o.*, b.code as banque_code, b.nom as banque_nom, cb.numero as banque_numero, c.numero as banque_compte,
                          bd.code as dest_code, bd.nom as dest_nom, cbd.numero as dest_numero, cd.numero as depot_numero, a.nom as agence_nom
                   from operation_banque o join compte_bancaire cb on cb.id = o.compte_bancaire_id join banque b on b.id = cb.banque_id join compte c on c.id = cb.compte_id
                   left join compte_bancaire cbd on cbd.id = o.compte_bancaire_dest_id left join banque bd on bd.id = cbd.banque_id
                   left join compte_depot cd on cd.id = o.compte_depot_id join agence a on a.id = o.agence_id"""


def ligne_liste(o: dict) -> dict:
    """Une ligne des listes de S57 et du rapport S62 : les mêmes colonnes (COMPLEMENTS § 4.5)"""
    ligne = vue(o) | {"operation": TYPES[o["type"]], "banque": f"{o['banque_code']} => {o['banque_nom']}", "compteBanque": f"{o['banque_numero']} => {o['banque_compte']}",
                      "banqueDest": f"{o['dest_code']} => {o['dest_nom']}" if o["dest_code"] else "", "compteBanqueDest": o["dest_numero"] or "",
                      "saisiPar": nom_utilisateur(o["saisi_par"]), "visePar": nom_utilisateur(o["vise_par"]), "agence": o["agence_nom"]}
    if o["compte_depot_id"]:
        c = une("select p.famille, p.compte_lie from compte_depot cd join produit_epargne p on p.id = cd.produit_id where cd.id = %s", (o["compte_depot_id"],))
        ligne |= {"compteEpargne": o["depot_numero"], "numeroComptable": compte_du_produit(c)}
        ligne |= {"debit": o["montant"] if o["type"] == "prelevement_client" else 0, "credit": o["montant"] if o["type"] == "virement_client" else 0}
    else:
        ligne["numeroComptable"] = o["compte"] or ""
    return ligne


def lister_visas(u, etape: str, liste: str) -> list[dict]:
    """Lignes en attente de l'étape (visa : saisies ; validation : visées), pour une des quatre listes"""
    exiger(u)
    if etape not in ETAPES or liste not in LISTES_VISA:
        raise ErreurMetier("Liste inconnue.")
    return [ligne_liste(o) for o in lignes(SELECT_LIGNES + """ where o.institution_id = %s and o.statut = %s and o.type = any(%s) order by o.date_operation, o.id""",
                                           (u["institution_id"], ETAPES[etape], list(LISTES_VISA[liste])))]


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
        if o["type"] == "adhesion_banque":                 # le compte épargne s'ouvre à la validation ; l'écriture suit à la comptabilisation (registre S56-1)
            a = preparer_adhesion(u, {"tiersId": o["tiers_id"], "parts": o["parts"], "depot": o["premier_depot"]})
            cid = valeur("""insert into compte_depot (institution_id, agence_id, tiers_id, produit_id, numero, devise, statut, ouvert_le)
                            values (%s, %s, %s, %s, %s, 'CDF', 'ouvert', %s) returning id""",
                         (u["institution_id"], a["t"]["agence_id"], a["tid"], a["produit"]["id"], numero_compte(u, a["t"], a["produit"]), date_val))
            executer("update operation_banque set compte_depot_id = %s where id = %s", (cid, oid))
    else:
        executer("update operation_banque set statut = 'visee', vise_par = %s, vise_le = now() where id = %s", (u["id"], oid))
    return vue(une("select * from operation_banque where id = %s", (oid,)))


# ---------- S62 : Banque > Rapport, « Édition du journal des opérations de banque » (manuel p. 71) ----------
def rapport_contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"exercices": [r["annee"] for r in lignes("select annee from exercice where institution_id = %s order by annee", (i,))],
            "enCours": valeur("select annee from exercice where institution_id = %s and actif order by annee desc limit 1", (i,)),
            "agences": lignes("select id, nom from agence where institution_id = %s order by code", (i,))}


def releve(u, du: str, au: str, compte_bancaire_id: int) -> dict:
    """S62 refait en « Relevé d'un compte bancaire » lu au grand livre (plan d'allègement, point 0.13 ; registre S62-4) : tous les mouvements du compte
    comptable du compte bancaire, quel que soit l'écran d'origine (déblocages par chèque, remboursements reçus, chèques encaissés, emprunts…), dans sa
    devise, avec le solde au début et à la fin ; puis les opérations de banque saisies mais pas encore comptabilisées. Instr. BCC 008, art. 10 et 11."""
    exiger(u)
    for d in (du, au):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", d or ""):
            raise ErreurMetier("À remplir : période.")
    if du > au:
        raise ErreurMetier("La date de début dépasse la date de fin.")
    cb = une("""select cb.id, cb.compte_id, cb.numero, cb.devise, c.numero as compte, c.libelle as intitule, b.nom as banque from compte_bancaire cb
                join compte c on c.id = cb.compte_id join banque b on b.id = cb.banque_id where cb.id = %s and cb.institution_id = %s""",
             (compte_bancaire_id, u["institution_id"])) if isinstance(compte_bancaire_id, int) and not isinstance(compte_bancaire_id, bool) else None
    if not cb:
        raise ErreurMetier("À remplir : N° Compte.")
    dev = cb["devise"].strip()
    ouverture, lignes_, td, tc = 0, [], 0, 0
    ag, pa = clause(u, "(select jc.agence_id from journee_comptable jc where jc.id = e.journee_id)")   # les journées de son agence (registre T213)
    for m in lignes(f"""select e.date_valeur, j.code as journal, p.numero as piece, e.libelle, l.sens, l.montant_devise
                       from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journal j on j.id = e.journal_id join piece p on p.id = e.piece_id
                       where l.compte_id = %s and e.institution_id = %s and e.date_valeur <= %s and l.devise = %s{ag} order by e.date_valeur, e.id, l.rang""",
                    (cb["compte_id"], u["institution_id"], au, dev, *pa)):
        signe = m["montant_devise"] if m["sens"] == "D" else -m["montant_devise"]
        if m["date_valeur"].isoformat() < du:
            ouverture += signe
            continue
        td += m["montant_devise"] if m["sens"] == "D" else 0
        tc += m["montant_devise"] if m["sens"] == "C" else 0
        lignes_.append({"date": m["date_valeur"].isoformat(), "journal": m["journal"], "piece": m["piece"], "libelle": m["libelle"],
                        "debit": m["montant_devise"] if m["sens"] == "D" else 0, "credit": m["montant_devise"] if m["sens"] == "C" else 0})
    solde = ouverture
    for l in lignes_:
        solde += l["debit"] - l["credit"]
        l["solde"] = solde
    ag, pa = clause(u, "o.agence_id")
    attente = [ligne_liste(o) for o in lignes(SELECT_LIGNES + f""" where o.institution_id = %s and o.statut in ('saisie', 'visee', 'validee')
                                                  and (o.compte_bancaire_id = %s or o.compte_bancaire_dest_id = %s){ag} order by o.date_operation, o.id""",
                                              (u["institution_id"], cb["id"], cb["id"], *pa))]
    return {"compte": cb["compte"], "intitule": cb["intitule"], "numeroBancaire": cb["numero"], "banque": cb["banque"], "devise": dev, "du": du, "au": au,
            "ouverture": ouverture, "lignes": lignes_, "totalDebit": td, "totalCredit": tc, "cloture": solde, "enAttente": attente}


def rapport(u, du: str, au: str, banque_id: int, compte_bancaire_id: int | None = None, agence_id: int | None = None) -> list[dict]:
    """Opérations de banque de la période (date de l'opération), de la banque choisie (compte d'origine ou de destination), hors refusées
    (registre S62-1). Critères Rechercher par / Option / Valeur appliqués à l'écran."""
    exiger(u)
    for d in (du, au):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", d or ""):
            raise ErreurMetier("À remplir : période.")
    if du > au:
        raise ErreurMetier("La date de début dépasse la date de fin.")
    if not une("select 1 from banque where id = %s and institution_id = %s and supprime_le is null", (banque_id, u["institution_id"])):
        raise ErreurMetier("À remplir : banque.")
    if agence(u) is not None:
        agence_id = agence(u)                                      # les opérations de son agence seulement (registre T213)
    return [ligne_liste(o) for o in lignes(SELECT_LIGNES + """ where o.institution_id = %s and o.statut <> 'refusee' and o.date_operation between %s and %s
                                                and (cb.banque_id = %s or cbd.banque_id = %s)
                                                and (%s::bigint is null or o.compte_bancaire_id = %s or o.compte_bancaire_dest_id = %s)
                                                and (%s::bigint is null or o.agence_id = %s)
                                              order by o.date_operation, o.id""",
                                           (u["institution_id"], du, au, banque_id, banque_id, compte_bancaire_id, compte_bancaire_id, compte_bancaire_id, agence_id, agence_id))]
