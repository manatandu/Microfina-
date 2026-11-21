"""Opérations saisies en comptabilité (manuel Microfina++) : S109 Saisie d'écriture comptable (p. 128 et 129), S116 Autres opérations (p. 133 à 135,
160 et 161), S117 Virements mensuels (p. 135 et 136), S113 Visa et S114 Validation (p. 130 à 133), S82 validation en caisse (p. 93 et 94).
Chaînes (COMPLEMENTS § 6) : écriture, virement, prélèvement, compte à compte : saisie, visée (S113), validée (S114), comptabilisée (S111) ;
opération diverse ou déplacée : saisie (S116), visée (S113), payée en caisse (S82).
Mêmes règles que web/src/donnees/api.ts (operationsCompta). Registre S109, S113, S114, S116, S117, S82."""
import calendar
import re
import uuid
from datetime import date

from psycopg.types.json import Jsonb

from .banques import compte_du_plan
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import (compte_du_produit, json_lu, controler_montant_coupures, controler_statut_actif, creer_operation, exiger, journee_courante, montant_bloque,
                       nettoyer, nom_utilisateur, nouvelle_piece, poster, session_ouverte, solde_contrat, sorties_en_attente, theorique, titulaire)

LIAISON = "451"       # PCCI, compte 451 Comptes de liaison inter agences : réciprocité entre l'agence qui paie et celle du client
TYPES = {"ecriture": "Écriture comptable", "virement": "Virement", "prelevement": "Prélèvement", "compte_a_compte": "Compte DAV vers un Autre Compte",
         "tontine_dav": "Compte Tontine vers un Compte DAV", "diverse": "Opération diverse", "deplacee": "Opération déplacée",
         "domiciliation": "Virement de salaire", "prelevement_auto": "Prélèvement automatique", "salaire_personnel": "Salaire du personnel"}
REMUNERATIONS_DUES = "421"     # PCCI 421 « Rémunérations dues et non payées » : la charge (650) y est constatée avant le virement (registre S117-7)
LISTES = {"virement": ("virement", "prelevement", "domiciliation", "prelevement_auto", "salaire_personnel"), "ecriture": ("ecriture",),
          "compte_a_compte": ("compte_a_compte", "tontine_dav"), "diverse": ("diverse",), "deplacee": ("deplacee",)}
ETAPES = {"visa": "saisie", "validation": "visee"}
CAISSE = ("diverse", "deplacee")          # après le visa, elles se paient en caisse (S82) : pas de liste de validation en comptabilité
# Comptes tenus par la gestion (registre S109-4) : crédits (30 à 32, 39) et leurs provisions (38), dépôts (33 à 35), caisse (57), virements internes (59),
# parts sociales (103), liaison inter agences (451). Les comptes de banque (56) liés à un compte bancaire s'y ajoutent.
GESTION = ("30", "31", "32", "33", "34", "35", "38", "39", "57", "59", "103", "451")


def lg(o) -> list:
    """Lignes de l'opération (jsonb rendu en texte par Django : décodé ici)"""
    return json_lu((o or {}).get("lignes")) or []


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def entier(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def cle_de(d) -> str:
    try:
        return str(uuid.UUID(texte(d, "cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")


def jour_ouvert(u) -> str:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return j["date"]


def date_operation(u, d) -> str:
    """Date de l'opération : au plus la journée ouverte (comme S52)"""
    jour = jour_ouvert(u)
    x = texte(d, "date") or jour
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", x):
        raise ErreurMetier("À remplir : Date opération.")
    if x > jour:
        raise ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.")
    return x


def tenu_par_la_gestion(u, numero: str) -> bool:
    return numero.startswith(GESTION) or bool(valeur("""select 1 from compte_bancaire cb join compte c on c.id = cb.compte_id
                                                        where cb.institution_id = %s and cb.supprime_le is null and c.numero = %s""", (u["institution_id"], numero)))


def compte_libre(u, numero: str, quoi: str) -> str:
    """Compte du plan, ouvert et saisissable (T16, S102-10), hors comptes tenus par la gestion (registre S109-4)"""
    if not numero:
        raise ErreurMetier(f"À remplir : {quoi}.")
    compte_du_plan(u, numero, quoi)
    if tenu_par_la_gestion(u, numero):
        raise ErreurMetier(f"{quoi} : {numero} est tenu par la gestion (caisse, banque, épargne, crédit, parts, liaison) ; il se mouvemente par son écran.")
    return numero


def budget(u, d) -> tuple:
    i, tb, lb = u["institution_id"], entier(d, "typeBudgetId"), entier(d, "ligneBudgetId")
    if tb and not une("select 1 from budget_type where id = %s and institution_id = %s and actif", (tb, i)):
        raise ErreurMetier("Type budget inconnu.")
    if lb and not une("select 1 from budget_ligne where id = %s and institution_id = %s and actif", (lb, i)):
        raise ErreurMetier("Ligne budgétaire inconnue.")
    return tb, lb


def compte_client(u, cid, quoi: str, verrou: bool = False) -> dict:
    """Compte de dépôt ouvert d'un client actif de l'institution"""
    c = une("""select c.id, c.numero, c.statut, c.tiers_id, trim(c.devise) as devise, c.agence_id, t.statut as statut_client, t.numero as numero_client,
                      p.famille, p.compte_lie, p.libelle as produit
               from compte_depot c join tiers t on t.id = c.tiers_id join produit_epargne p on p.id = c.produit_id
               where c.id = %s and t.institution_id = %s""" + (" for update of c" if verrou else ""), (cid, u["institution_id"])) if cid else None
    if not c:
        raise ErreurMetier(f"À remplir : {quoi}.")
    controler_statut_actif(c["statut_client"])
    if c["statut"] != "ouvert":
        raise ErreurMetier(f"{quoi} : compte fermé.")
    return c


def disponible(c: dict, sauf: int | None = None) -> int:
    """Disponible du compte : solde, moins les blocages (S71), moins les sorties déjà saisies (registre T21) ; « sauf » : l'opération qu'on est en train de payer"""
    solde = solde_contrat(f"depot:{c['id']}", c["devise"], "C")
    return solde - montant_bloque(c["id"], solde) - sorties_en_attente(c["id"], sauf)


def comptes_du_client(u, tid: int) -> list[dict]:
    """Comptes ouverts d'un client : N° Compte, N° Comptable, Produit, Solde (cadres « Compte Client » et « Compte Emetteur », p. 134)"""
    exiger(u)
    out = []
    for c in lignes("""select c.id, c.numero, trim(c.devise) as devise, p.famille, p.compte_lie, p.libelle as produit
                       from compte_depot c join tiers t on t.id = c.tiers_id join produit_epargne p on p.id = c.produit_id
                       where c.tiers_id = %s and t.institution_id = %s and c.statut = 'ouvert' order by c.numero""", (tid, u["institution_id"])):
        out.append({"id": c["id"], "numero": c["numero"], "devise": c["devise"], "famille": c["famille"], "produit": c["produit"],
                    "numeroComptable": compte_du_produit(c), "solde": disponible(c)})
    return out


def compte_par_numero(u, numero: str) -> dict:
    """S117 : un compte de dépôt ouvert retrouvé par son numéro (liste de salaires importée d'un fichier)"""
    exiger(u)
    k = une("""select c.id from compte_depot c join tiers t on t.id = c.tiers_id where c.numero = %s and t.institution_id = %s""", ((numero or "").strip(), u["institution_id"]))
    if not k:
        raise ErreurMetier(f"Compte {numero} introuvable.")
    c = compte_client(u, k["id"], f"Compte {numero}")
    return {"id": c["id"], "numero": c["numero"], "devise": c["devise"], "client": c["numero_client"], "intitule": titulaire(c["tiers_id"]), "produit": c["produit"]}


def lire(u) -> dict:
    """Ce que les écrans proposent : journaux et périodes (Choix du journal, p. 129), agences, budget, date de la journée"""
    exiger(u)
    i = u["institution_id"]
    j = journee_courante(u)
    ouverte = j["date"] if j and j["statut"] == "ouverte" else ""
    annees = [r["annee"] for r in lignes("select annee from exercice where institution_id = %s and ouvert and not valide order by annee", (i,))]
    fin = (ouverte or date.today().isoformat())[:7]
    return {
        "date": ouverte,
        "journaux": lignes("""select id, code, libelle, type from journal where institution_id = %s and actif and not supprime and type <> 'a_nouveaux'
                              order by code""", (i,)),
        "periodes": [f"{m:02d}/{a}" for a in annees for m in range(1, 13) if f"{a}-{m:02d}" <= fin],
        "agence": une("select id, code, nom from agence where id = %s", (u["agence_id"],)),
        "agences": lignes("select id, code, nom from agence where institution_id = %s and not supprime order by code", (i,)),
        "typesBudget": lignes("select id, code, libelle from budget_type where institution_id = %s and actif order by code", (i,)),
        "lignesBudget": lignes("""select l.id, l.numero, l.libelle, coalesce(b.nom, '') as bailleur from budget_ligne l left join bailleur b on b.id = l.bailleur_id
                                  where l.institution_id = %s and l.actif order by l.numero""", (i,)),
        "auxiliaires": lignes("""select id, intitule, compte, type_tiers as "typeTiers" from tiers_comptable where institution_id = %s and actif order by intitule""", (i,)),
        # comptes qui reçoivent une saisie : ouverts, saisissables, hors comptes tenus par la gestion (Intitulé affiché à la saisie du compte)
        "comptes": [c for c in lignes("""select numero, libelle from compte where (institution_id is null or institution_id = %s) and saisissable and ouvert
                                         order by numero""", (i,)) if not tenu_par_la_gestion(u, c["numero"])],
    }


# ---------- S109 : Saisie d'écriture comptable (p. 128 et 129) ----------
def journal_periode(u, d) -> tuple:
    """Choix du journal : un journal actif, ouvert sur l'exercice de la période, exercice ouvert et non validé (registre S11-2, S11-3)"""
    i = u["institution_id"]
    j = une("select id, code, libelle from journal where id = %s and institution_id = %s and actif and not supprime and type <> 'a_nouveaux'", (entier(d, "journalId"), i))
    if not j:
        raise ErreurMetier("À remplir : Journal.")
    p = texte(d, "periode")
    m = re.match(r"^(\d{2})/(\d{4})$", p)
    if not m or not 1 <= int(m.group(1)) <= 12:
        raise ErreurMetier("À remplir : Période.")
    mois, annee = int(m.group(1)), int(m.group(2))
    if not une("select 1 from exercice where institution_id = %s and annee = %s and ouvert and not valide", (i, annee)):
        raise ErreurMetier(f"Période : l'exercice {annee} n'est pas ouvert (Administration > Exercice).")
    if not une("select 1 from journal_detail where institution_id = %s and annee = %s and journal_id = %s and actif and ouvert", (i, annee, j["id"])):
        raise ErreurMetier(f"Le journal {j['code']} n'est pas ouvert sur l'exercice {annee} (Administration > Exercice, Compléter journal détail).")
    if f"{annee}-{mois:02d}" > jour_ouvert(u)[:7]:
        raise ErreurMetier("Période : pas après la journée ouverte.")
    return j, annee, mois


def vue_ecriture(o: dict | None, j: dict, periode: str) -> dict:
    l = lg(o)
    debit, credit = sum(x["montant"] for x in l if x["sens"] == "D"), sum(x["montant"] for x in l if x["sens"] == "C")
    return {"id": (o or {}).get("id"), "transaction": f"{o['id']:06d}" if o else "", "journalId": j["id"], "journal": j["libelle"], "periode": periode,
            "jour": o["date_operation"].day if o else None, "reference": (o or {}).get("reference") or "", "libelle": (o or {}).get("libelle") or "",
            "statut": (o or {}).get("statut") or "", "lignes": l, "debit": debit, "credit": credit}


def brouillon(u, jid: int, periode: str, verrou: bool = False) -> dict | None:
    """La transaction en cours de l'utilisateur dans ce journal et cette période : la dernière qui n'est pas équilibrée (registre S109-2)"""
    return une("""select * from operation_comptable where institution_id = %s and type = 'ecriture' and statut = 'brouillon' and saisi_par = %s
                  and journal_id = %s and periode = %s order by id desc limit 1""" + (" for update" if verrou else ""), (u["institution_id"], u["id"], jid, periode))


def ecriture_ouvrir(u, d) -> dict:
    """Bouton OK de « Choix du journal » : la transaction à compléter, sinon une transaction vide"""
    exiger(u)
    j, _, _ = journal_periode(u, d)
    return vue_ecriture(brouillon(u, j["id"], texte(d, "periode")), j, texte(d, "periode"))


def ranger(o: dict, l: list) -> str:
    """Équilibrée (au moins deux lignes, débit égal au crédit) : l'écriture part au visa ; sinon elle reste à compléter"""
    debit, credit = sum(x["montant"] for x in l if x["sens"] == "D"), sum(x["montant"] for x in l if x["sens"] == "C")
    statut = "saisie" if len(l) >= 2 and debit == credit and debit > 0 else "brouillon"
    executer("update operation_comptable set lignes = %s, montant = %s, statut = %s where id = %s", (Jsonb(l), debit, statut, o["id"]))
    return statut


def ecriture_ajouter(u, d) -> dict:
    """Bouton Ajouter : une ligne de plus dans la transaction. Jour, Réf. Pièce et Libellé sont ceux de la première ligne (registre S109-3)."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    j, annee, mois = journal_periode(u, d)
    periode = texte(d, "periode")
    oid = entier(d, "id")
    o = une("select * from operation_comptable where id = %s and institution_id = %s and type = 'ecriture' and saisi_par = %s for update", (oid, u["institution_id"], u["id"])) \
        if oid else brouillon(u, j["id"], periode, True)
    if o and o["statut"] not in ("brouillon", "saisie"):
        raise ErreurMetier("Cette écriture est déjà visée : elle ne se modifie plus (PCCI § 3.4).")
    if o and (o["journal_id"] != j["id"] or o["periode"] != periode):
        raise ErreurMetier("Cette écriture appartient à un autre journal ou à une autre période.")
    libelle = texte(d, "libelle")
    if not libelle:
        raise ErreurMetier("À remplir : Libellé.")
    compte = compte_libre(u, texte(d, "compte"), "Compte")
    debit, credit = entier(d, "debit") or 0, entier(d, "credit") or 0
    if debit < 0 or credit < 0 or (debit > 0) == (credit > 0):
        raise ErreurMetier("Débit ou Crédit : un seul des deux, supérieur à zéro.")
    aux = entier(d, "auxiliaireId")
    if aux and not une("select 1 from tiers_comptable where id = %s and institution_id = %s and actif", (aux, u["institution_id"])):
        raise ErreurMetier("Compte auxiliaire inconnu (Comptabilité > Plan des tiers).")
    tb, lb = budget(u, d)
    if not o:
        jour = entier(d, "jour")
        if not jour or not 1 <= jour <= calendar.monthrange(annee, mois)[1]:
            raise ErreurMetier("À remplir : Jour.")
        jd = date(annee, mois, jour)
        if jd.isoformat() > jour_ouvert(u):
            raise ErreurMetier("Jour : pas après la journée ouverte.")
        oid = valeur("""insert into operation_comptable (institution_id, agence_id, type, statut, date_operation, journal_id, periode, reference, libelle, saisi_par)
                        values (%s, %s, 'ecriture', 'brouillon', %s, %s, %s, %s, %s, %s) returning id""",
                     (u["institution_id"], u["agence_id"], jd, j["id"], periode, texte(d, "reference"), libelle, u["id"]))
        o = une("select * from operation_comptable where id = %s", (oid,))
    l = list(lg(o))
    l.append({"rang": max([x["rang"] for x in l], default=0) + 1, "compte": compte, "intitule": valeur("select libelle from compte where numero = %s and (institution_id is null or institution_id = %s) order by institution_id nulls last limit 1", (compte, u["institution_id"])) or "",
              "libelle": libelle, "sens": "D" if debit else "C", "montant": debit or credit, "auxiliaireId": aux, "typeBudgetId": tb, "ligneBudgetId": lb})
    ranger(o, l)
    return vue_ecriture(une("select * from operation_comptable where id = %s", (o["id"],)), j, periode)


def ecriture_supprimer(u, oid: int, rang: int) -> dict:
    """Bouton Supprimer : retire la ligne choisie, tant que l'écriture n'est pas visée (PCCI § 3.3 et 3.4 : ensuite, correction par écriture inverse)"""
    exiger(u)
    o = une("select * from operation_comptable where id = %s and institution_id = %s and type = 'ecriture' and saisi_par = %s for update", (oid, u["institution_id"], u["id"]))
    if not o:
        raise ErreurMetier("Écriture introuvable.")
    if o["statut"] not in ("brouillon", "saisie"):
        raise ErreurMetier("Cette écriture est déjà visée : elle ne se supprime plus ; elle se corrige par une écriture inverse (PCCI § 3.3 et 3.4).")
    l = [x for x in lg(o) if x["rang"] != rang]
    if len(l) == len(lg(o)):
        raise ErreurMetier("Sélectionner la ligne à supprimer.")
    j = une("select id, code, libelle from journal where id = %s", (o["journal_id"],))
    if not l:
        executer("delete from operation_comptable where id = %s", (oid,))
        return vue_ecriture(None, j, o["periode"])
    ranger(o, l)
    return vue_ecriture(une("select * from operation_comptable where id = %s", (oid,)), j, o["periode"])


# ---------- S116 : Autres opérations (p. 133 à 135 ; 160 et 161) ----------
def lignes_compta(u, d, multiligne: bool) -> list[dict]:
    """Cadre « Comptabilite » : Compte, Libelle, Montant ; plusieurs lignes quand la case multiligne est cochée"""
    brut = d.get("lignes") if isinstance(d.get("lignes"), list) else []
    if not brut:
        raise ErreurMetier("À remplir : Compte, Libelle et Montant.")
    if len(brut) > 1 and not multiligne:
        raise ErreurMetier("Plusieurs lignes : cocher la case multiligne.")
    out = []
    for x in brut:
        compte = compte_libre(u, texte(x, "compte"), "Compte")
        libelle, m = texte(x, "libelle"), entier(x, "montant")
        if not libelle:
            raise ErreurMetier("À remplir : Libelle.")
        if not m or m <= 0:
            raise ErreurMetier("Montant : un montant supérieur à zéro.")
        out.append({"compte": compte, "libelle": libelle, "montant": m})
    return out


def deja(cle: str) -> dict | None:
    o = une("select * from operation_comptable where cle_idempotence = %s", (cle,))
    return vue(o) if o else None


def inserer(u, cle, type_, date_op, libelle, montant, devise, **k) -> dict:
    cols = {"institution_id": u["institution_id"], "agence_id": u["agence_id"], "type": type_, "statut": "saisie", "date_operation": date_op, "libelle": libelle,
            "montant": montant, "devise": devise, "saisi_par": u["id"], "cle_idempotence": cle, **k}
    oid = valeur(f"insert into operation_comptable ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))}) returning id", tuple(cols.values()))
    return vue(une("select * from operation_comptable where id = %s", (oid,)))


def enregistrer_virement(u, d) -> dict:
    """Onglet Virement/Prélèvement (p. 134 ; texte p. 161) : le compte du client contre un compte du plan. Virement : le compte du client est crédité ;
    prélèvement : il est débité, dans la limite du disponible (registre S116-2)."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    if (prec := deja(cle)):
        return prec
    type_ = texte(d, "type")
    if type_ not in ("virement", "prelevement"):
        raise ErreurMetier("À remplir : Type opération.")
    date_op = date_operation(u, d)
    c = compte_client(u, entier(d, "compteDepotId"), "N° Compte", True)
    l = lignes_compta(u, d, bool(d.get("multiligne")))
    total = sum(x["montant"] for x in l)
    if type_ == "prelevement" and total > disponible(c):
        raise ErreurMetier("Solde disponible insuffisant sur le compte du client.")
    return inserer(u, cle, type_, date_op, l[0]["libelle"], total, c["devise"], compte_depot_id=c["id"], lignes=Jsonb(l))


def enregistrer_compte_a_compte(u, d) -> dict:
    """Onglets « Compte DAV vers un Autre Compte » et « Compte Tontine vers un Compte DAV » (p. 134 ; texte p. 160) : Emetteur, Recepteur, Montant.
    Même devise ; dans la limite du disponible de l'émetteur ; sans frais (Instr. BCC 37, annexe, point 2 ; registre S116-3)."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    if (prec := deja(cle)):
        return prec
    tontine = texte(d, "onglet") == "tontine"
    date_op = jour_ouvert(u)
    e = compte_client(u, entier(d, "emetteurId"), "N° Compte de l'émetteur", True)
    r = compte_client(u, entier(d, "recepteurId"), "N° Compte du récepteur")
    if e["id"] == r["id"]:
        raise ErreurMetier("Récepteur : un autre compte que celui de l'émetteur.")
    if tontine and (e["famille"] != "TONTINE" or r["famille"] != "EPARGNE"):
        raise ErreurMetier("Compte Tontine vers un Compte DAV : l'émetteur est un compte tontine, le récepteur un compte d'épargne à vue.")
    if not tontine and e["famille"] != "EPARGNE":
        raise ErreurMetier("Compte DAV vers un Autre Compte : l'émetteur est un compte d'épargne à vue.")
    if e["devise"] != r["devise"]:
        raise ErreurMetier("Les deux comptes n'ont pas la même devise (pas d'opération de change : PCCI, évaluation des opérations en devises).")
    m = entier(d, "montant")
    if not m or m <= 0:
        raise ErreurMetier("Montant : un montant supérieur à zéro.")
    if m > disponible(e):
        raise ErreurMetier("Solde disponible insuffisant sur le compte de l'émetteur.")
    libelle = f"Virement du compte {e['numero']} au compte {r['numero']}"
    return inserer(u, cle, "tontine_dav" if tontine else "compte_a_compte", date_op, libelle, m, e["devise"], compte_depot_id=e["id"], compte_depot_dest_id=r["id"])


def enregistrer_diverse(u, d) -> dict:
    """Onglet Opération diverse (p. 134 et 135 ; texte p. 161) : encaissement ou décaissement divers initié en comptabilité, visé (S113) puis payé en caisse (S82)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    if (prec := deja(cle)):
        return prec
    sens = texte(d, "sens")
    if sens not in ("ENCAISSEMENT", "DECAISSEMENT"):
        raise ErreurMetier("À remplir : Type opération.")
    date_op = date_operation(u, d)
    l = lignes_compta(u, d, bool(d.get("multiligne")))
    tb, lb = budget(u, d)
    devise = texte(d, "devise") or "CDF"
    if not une("select 1 from coupure where devise = %s limit 1", (devise,)):
        raise ErreurMetier(f"Devise {devise} : le guichet ne la tient pas.")
    return inserer(u, cle, "diverse", date_op, l[0]["libelle"], sum(x["montant"] for x in l), devise, sens=sens, lignes=Jsonb(l), budget_type_id=tb, budget_ligne_id=lb)


def enregistrer_deplacee(u, d) -> dict:
    """Onglet Opérations déplacées (p. 135 ; texte p. 94) : dépôt ou retrait d'un client d'une autre agence, initié en comptabilité, visé (S113) puis payé en
    caisse (S82). Le compte appartient à un client de l'agence choisie ; un retrait reste dans le disponible (registre S116-5)."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    if (prec := deja(cle)):
        return prec
    sens = texte(d, "sens")
    if sens not in ("DEPOT", "RETRAIT"):
        raise ErreurMetier("À remplir : Type operation.")
    ag = une("select id, code, nom from agence where id = %s and institution_id = %s and not supprime", (entier(d, "agenceId"), u["institution_id"]))
    if not ag:
        raise ErreurMetier("À remplir : Agence.")
    if ag["id"] == u["agence_id"]:
        raise ErreurMetier("Agence : celle du client, autre que la vôtre ; un client de votre agence passe au guichet (Caisse > Opération).")
    nom, numero = texte(d, "nom"), texte(d, "numeroCompte")
    if not nom:
        raise ErreurMetier("À remplir : Nom et Prenoms.")
    if not numero:
        raise ErreurMetier("À remplir : N° Compte.")
    k = une("""select c.id from compte_depot c join tiers t on t.id = c.tiers_id where c.numero = %s and t.institution_id = %s and t.agence_id = %s""",
            (numero, u["institution_id"], ag["id"]))
    if not k:
        raise ErreurMetier(f"N° Compte : aucun compte {numero} chez un client de l'agence {ag['nom']}.")
    c = compte_client(u, k["id"], "N° Compte", True)
    m = entier(d, "montant")
    if not m or m <= 0:
        raise ErreurMetier("Montant : un montant supérieur à zéro.")
    if sens == "RETRAIT" and m > disponible(c):
        raise ErreurMetier("Solde disponible insuffisant sur le compte du client.")
    libelle = f"{'Dépôt' if sens == 'DEPOT' else 'Retrait'} déplacé, compte {c['numero']} ({ag['nom']})"
    return inserer(u, cle, "deplacee", jour_ouvert(u), libelle, m, c["devise"], sens=sens, compte_depot_id=c["id"], agence_client_id=ag["id"],
                   numero_client=texte(d, "numeroClient") or c["numero_client"], nom_client=nom, reference=texte(d, "reference"))


# ---------- S117 : Virements mensuels (p. 135 et 136) ----------
def enregistrer_mensuel(u, d) -> dict:
    """Domiciliation salaire (capture « Virement de salaire », p. 136) : le compte de l'institution qui paie est débité du total, chaque compte de la liste
    est crédité de son salaire. Prélèvement automatique : l'inverse, même écran (registre S117-1 à S117-4). Aucune commission : Instr. BCC 37."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    if (prec := deja(cle)):
        return prec
    mode = texte(d, "mode")
    type_ = "prelevement_auto" if mode == "prelevement" else "salaire_personnel" if mode == "personnel" else "domiciliation"
    if type_ == "salaire_personnel":
        return salaire_personnel(u, d, cle)
    inst = compte_client(u, entier(d, "compteInstitutionId"), "Compte interne de l'institution", True)
    brut = d.get("lignes") if isinstance(d.get("lignes"), list) else []
    if not brut:
        raise ErreurMetier("Liste des Client : au moins un compte.")
    l, vus = [], set()
    for x in brut:
        c = compte_client(u, entier(x, "compteDepotId"), "Compte du client", type_ == "prelevement_auto")
        m = entier(x, "montant")
        if not m or m <= 0:
            raise ErreurMetier(f"Compte {c['numero']} : un montant supérieur à zéro.")
        if entier(x, "commission"):
            raise ErreurMetier("Commission : aucune ; la domiciliation de salaire et le virement de compte à compte sont gratuits (Instr. BCC 37, annexe, points 1 et 2).")
        if c["id"] == inst["id"] or c["id"] in vus:
            raise ErreurMetier(f"Compte {c['numero']} : déjà dans la liste.")
        if c["devise"] != inst["devise"]:
            raise ErreurMetier(f"Compte {c['numero']} : pas dans la devise du compte de l'institution.")
        if type_ == "prelevement_auto" and m > disponible(c):
            raise ErreurMetier(f"Compte {c['numero']} : solde disponible insuffisant.")
        vus.add(c["id"])
        l.append({"compteDepotId": c["id"], "numero": c["numero"], "client": c["numero_client"], "intitule": titulaire(c["tiers_id"]), "montant": m})
    total = sum(x["montant"] for x in l)
    if type_ == "domiciliation":
        attendu = entier(d, "total")
        if attendu != total:
            raise ErreurMetier("Salaire total à verser : il ne fait pas la somme des salaires de la liste.")
        if total > disponible(inst):
            raise ErreurMetier("Solde disponible insuffisant sur le compte de l'institution.")
    nom = titulaire(inst["tiers_id"])
    libelle = (f"Virement de salaire {nom}" if type_ == "domiciliation" else f"Prélèvement automatique {nom}") + f" ({len(l)} comptes)"
    return inserer(u, cle, type_, jour_ouvert(u), libelle, total, inst["devise"], compte_depot_id=inst["id"], lignes=Jsonb(l))


def salaire_personnel(u, d: dict, cle) -> dict:
    """Onglet Salaire du personnel (p. 136, « l'onglet ne marche pas » : même écran que la domiciliation) : le compte 421 de l'institution est débité du
    total, chaque compte de la liste crédité du salaire de l'employé. Registre S117-7."""
    dv = texte(d, "devise") or "CDF"
    brut = d.get("lignes") if isinstance(d.get("lignes"), list) else []
    if not brut:
        raise ErreurMetier("Liste des Client : au moins un compte.")
    l, vus = [], set()
    for x in brut:
        c = compte_client(u, entier(x, "compteDepotId"), "Compte du client", False)
        m = entier(x, "montant")
        if not m or m <= 0:
            raise ErreurMetier(f"Compte {c['numero']} : un montant supérieur à zéro.")
        if entier(x, "commission"):
            raise ErreurMetier("Commission : aucune ; la domiciliation de salaire et le virement de compte à compte sont gratuits (Instr. BCC 37, annexe, points 1 et 2).")
        if c["id"] in vus:
            raise ErreurMetier(f"Compte {c['numero']} : déjà dans la liste.")
        if c["devise"] != dv:
            raise ErreurMetier(f"Compte {c['numero']} : pas dans la devise du virement.")
        vus.add(c["id"])
        l.append({"compteDepotId": c["id"], "numero": c["numero"], "client": c["numero_client"], "intitule": titulaire(c["tiers_id"]), "montant": m})
    total = sum(x["montant"] for x in l)
    if entier(d, "total") != total:
        raise ErreurMetier("Salaire total à verser : il ne fait pas la somme des salaires de la liste.")
    return inserer(u, cle, "salaire_personnel", jour_ouvert(u), f"Salaire du personnel ({len(l)} comptes)", total, dv, lignes=Jsonb(l))


# ---------- Vues et listes ----------
def depot_numero(cid) -> dict:
    return une("""select c.id, c.numero, c.tiers_id, t.numero as client, p.famille, p.compte_lie from compte_depot c join tiers t on t.id = c.tiers_id
                  join produit_epargne p on p.id = c.produit_id where c.id = %s""", (cid,)) if cid else None


def vue(o: dict) -> dict:
    e, r = depot_numero(o["compte_depot_id"]), depot_numero(o["compte_depot_dest_id"])
    t = o["type"]
    v = {"id": o["id"], "transaction": f"{o['id']:06d}", "type": t, "operation": TYPES[t], "statut": o["statut"], "date": o["date_operation"].isoformat(), "libelle": o["libelle"],
         "montant": o["montant"], "devise": o["devise"].strip(), "sens": o["sens"] or "", "piece": o["piece"] or "", "reference": o["reference"] or "",
         "lignes": lg(o), "saisiPar": nom_utilisateur(o["saisi_par"]), "visePar": nom_utilisateur(o["vise_par"]),
         "dateVisa": o["vise_le"].date().isoformat() if o["vise_le"] else "", "dateValidation": o["date_validation"].isoformat() if o["date_validation"] else "",
         "compteEpargne": e["numero"] if e else "", "numeroComptable": compte_du_produit(e) if e else "",
         "clientEmetteur": f"{e['client']} {titulaire(e['tiers_id'])}" if e else "", "compteEmetteur": e["numero"] if e else "",
         "clientRecepteur": f"{r['client']} {titulaire(r['tiers_id'])}" if r else "", "compteRecepteur": r["numero"] if r else "",
         "numeroClient": o["numero_client"] or "", "nomClient": o["nom_client"] or "",
         "agenceClient": valeur("select nom from agence where id = %s", (o["agence_client_id"],)) or "" if o["agence_client_id"] else ""}
    # colonnes Debit et Crédit des listes : le sens du compte du client (virement : crédit ; prélèvement : débit), ou de l'opération diverse
    debit = t in ("prelevement", "domiciliation") or o["sens"] in ("DECAISSEMENT", "RETRAIT")
    credit = t in ("virement", "prelevement_auto", "salaire_personnel") or o["sens"] in ("ENCAISSEMENT", "DEPOT")
    v |= {"debit": o["montant"] if debit else 0, "credit": o["montant"] if credit else 0}
    return v


def lister(u, etape: str, liste: str) -> list[dict]:
    """Lignes en attente : visa (saisies) ou validation (visées), pour une liste de S113 ou S114"""
    exiger(u)
    if etape not in ETAPES or liste not in LISTES or (etape == "validation" and liste in CAISSE):
        raise ErreurMetier("Liste inconnue.")
    return [vue(o) for o in lignes("""select * from operation_comptable where institution_id = %s and agence_id = %s and statut = %s and type = any(%s)
                                      order by date_operation, id""", (u["institution_id"], u["agence_id"], ETAPES[etape], list(LISTES[liste])))]


def saisies(u, type_: str) -> list[dict]:
    """Grille sous l'onglet de saisie (p. 135) : les opérations du type, de la saisie au paiement, les plus récentes d'abord"""
    exiger(u)
    if type_ not in TYPES:
        raise ErreurMetier("Liste inconnue.")
    return [vue(o) for o in lignes("""select * from operation_comptable where institution_id = %s and agence_id = %s and type = %s and statut <> 'brouillon'
                                      order by date_operation desc, id desc limit 200""", (u["institution_id"], u["agence_id"], type_))]


def faire_suivre(u, oid: int, etape: str, d=None) -> dict:
    """Visa (saisie vers visée) ou validation (visée vers validée). Quatre yeux : le visa vient d'une autre personne que celle qui a saisi ; la validation,
    d'une autre que celle qui a saisi et que celle qui a visé (Instr. BCC 008, art. 66 ; registre S57-1). La comptabilisation (S111) vient ensuite."""
    exiger(u)
    o = une("select * from operation_comptable where id = %s and institution_id = %s and agence_id = %s for update", (oid, u["institution_id"], u["agence_id"]))
    if not o or o["statut"] != ETAPES.get(etape) or (etape == "validation" and o["type"] in CAISSE):
        raise ErreurMetier("Rien à viser." if etape == "visa" else "Rien à valider.")
    if o["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : " + ("pas de visa sur sa propre saisie." if etape == "visa" else "pas de validation sur sa propre saisie."))
    if etape == "visa":
        executer("update operation_comptable set statut = 'visee', vise_par = %s, vise_le = now() where id = %s", (u["id"], oid))
    else:
        if o["vise_par"] == u["id"]:
            raise ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a visé.")
        jour = jour_ouvert(u)
        date_val = texte(d or {}, "date") or jour
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_val):
            raise ErreurMetier("À remplir : date opération.")
        if date_val < o["date_operation"].isoformat():
            raise ErreurMetier("La date de validation précède la date de l'opération.")
        if date_val > jour:
            raise ErreurMetier("La date de validation ne peut pas dépasser la journée ouverte.")
        executer("update operation_comptable set statut = 'validee', valide_par = %s, valide_le = now(), date_validation = %s where id = %s", (u["id"], date_val, oid))
    return vue(une("select * from operation_comptable where id = %s", (oid,)))


# ---------- S111 : ce que la comptabilisation passe ----------
def L(compte, sens, devise, montant, contrat=None, budget=None) -> dict:
    return {"compte": compte, "sens": sens, "devise": devise, "montant": montant, **({"contrat": contrat} if contrat else {}), **({"budget": budget} if budget else {})}


def ligne_depot(cid: int, sens: str, devise: str, montant: int) -> dict:
    k = depot_numero(cid)
    return L(compte_du_produit(k), sens, devise, montant, f"depot:{k['id']}")


def lignes_ecriture(o: dict) -> list[dict]:
    """Lignes au grand livre d'une opération validée"""
    t, dv, m = o["type"], o["devise"].strip(), o["montant"]
    if t == "ecriture":
        return [L(x["compte"], x["sens"], dv, x["montant"], f"tc:{x['auxiliaireId']}" if x.get("auxiliaireId") else None, x.get("ligneBudgetId")) for x in lg(o)]
    if t == "virement":
        return [L(x["compte"], "D", dv, x["montant"]) for x in lg(o)] + [ligne_depot(o["compte_depot_id"], "C", dv, m)]
    if t == "prelevement":
        return [ligne_depot(o["compte_depot_id"], "D", dv, m)] + [L(x["compte"], "C", dv, x["montant"]) for x in lg(o)]
    if t in ("compte_a_compte", "tontine_dav"):
        return [ligne_depot(o["compte_depot_id"], "D", dv, m), ligne_depot(o["compte_depot_dest_id"], "C", dv, m)]
    if t == "domiciliation":
        return [ligne_depot(o["compte_depot_id"], "D", dv, m)] + [ligne_depot(x["compteDepotId"], "C", dv, x["montant"]) for x in lg(o)]
    if t == "prelevement_auto":
        return [ligne_depot(x["compteDepotId"], "D", dv, x["montant"]) for x in lg(o)] + [ligne_depot(o["compte_depot_id"], "C", dv, m)]
    if t == "salaire_personnel":
        return [L(REMUNERATIONS_DUES, "D", dv, m)] + [ligne_depot(x["compteDepotId"], "C", dv, x["montant"]) for x in lg(o)]
    raise ErreurMetier("Cette opération se paie en caisse.")


def en_attente(u, j: dict) -> list[dict]:
    """Opérations validées (S114) à passer au plus tard à la date de la journée, et reflets des opérations déplacées payées dans une autre agence"""
    d, i, a = j["date_comptable"], u["institution_id"], u["agence_id"]
    out = []
    for o in lignes("""select o.*, jn.code as journal from operation_comptable o left join journal jn on jn.id = o.journal_id
                       where o.institution_id = %s and o.agence_id = %s and o.statut = 'validee' and o.date_validation <= %s order by o.date_validation, o.id""", (i, a, d)):
        out.append({"source": "operation_comptable", "id": o["id"], "type": o["type"], "libelle": o["libelle"], "journal": o["journal"] or "OD",
                    "lignes": lignes_ecriture(o), "date": o["date_validation"], "evenement": "ecriture_manuelle" if o["type"] == "ecriture" else "operation_comptable"})
    for o in lignes("""select * from operation_comptable where institution_id = %s and agence_client_id = %s and type = 'deplacee' and statut = 'payee'
                       and reflet_ecriture_id is null and date_validation <= %s order by date_validation, id""", (i, a, d)):
        out.append({"source": "reflet", "id": o["id"], "type": "reflet", "libelle": o["libelle"], "journal": "OD", "lignes": lignes_reflet(o),
                    "date": o["date_validation"], "evenement": "operation_comptable"})
    return out


def marquer(x: dict, piece: str, eid: int):
    if x["source"] == "reflet":
        executer("update operation_comptable set reflet_ecriture_id = %s where id = %s", (eid, x["id"]))
    else:
        executer("update operation_comptable set statut = 'comptabilisee', piece = %s, ecriture_id = %s where id = %s", (piece, eid, x["id"]))


# ---------- S82 : validation en caisse des opérations diverses et déplacées (p. 93 et 94) ----------
def a_payer(u, type_: str) -> list[dict]:
    """Grilles « Opération diverse » et « Validation Opération déplacée » : les opérations visées de l'agence, en attente du caissier"""
    exiger(u)
    if type_ not in CAISSE:
        raise ErreurMetier("Liste inconnue.")
    return [vue(o) for o in lignes("""select * from operation_comptable where institution_id = %s and agence_id = %s and type = %s and statut = 'visee'
                                      order by date_operation, id""", (u["institution_id"], u["agence_id"], type_))]


def lignes_reflet(o: dict) -> list[dict]:
    """Reflet dans l'agence du client (PCCI, compte 45 : mouvement de montant égal et de signe contraire)"""
    dv, m, dep = o["devise"].strip(), o["montant"], o["sens"] == "DEPOT"
    liaison = L(LIAISON, "D" if dep else "C", dv, m, f"liaison:{o['agence_id']}")
    client = ligne_depot(o["compte_depot_id"], "C" if dep else "D", dv, m)
    return [liaison, client] if dep else [client, liaison]


def passer_reflet(u, o: dict):
    """Le reflet passe tout de suite si l'agence du client a une journée ouverte ; sinon à sa prochaine comptabilisation (PCCI, compte 45 : le mouvement et son
    reflet ne passent pas nécessairement dans la même journée comptable)"""
    j = une("select * from journee_comptable where agence_id = %s and statut = 'ouverte' order by date_comptable desc limit 1", (o["agence_client_id"],))
    if not j:
        return
    ua = {**u, "agence_id": o["agence_client_id"]}
    eid = poster(ua, journal="OD", journee_id=j["id"], libelle=o["libelle"], piece=nouvelle_piece(ua, "OD", j["date_comptable"]), evenement="operation_comptable",
                 cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=lignes_reflet(o))
    executer("update operation_comptable set reflet_ecriture_id = %s where id = %s", (eid, o["id"]))


def payer(u, oid: int, d) -> dict:
    """Bouton Valider de la caisse, après « Voulez-vous valider cette operation diverse? » : l'opération passe au guichet avec son billetage, comme un
    encaissement ou un décaissement divers (S78). Le caissier n'est ni celui qui a saisi ni celui qui a visé (registre S82-2 à S82-5)."""
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    o = une("select * from operation_comptable where id = %s and institution_id = %s and agence_id = %s for update", (oid, u["institution_id"], u["agence_id"]))
    if o and o["statut"] == "payee" and str(o["cle_idempotence"]) != cle and valeur("select 1 from operation where id = %s and cle_idempotence = %s", (o["operation_id"], cle)):
        return vue(o)                                        # même clé : la même validation (double clic, reprise réseau)
    if not o or o["type"] not in CAISSE or o["statut"] != "visee":
        raise ErreurMetier("Rien à valider.")
    if u["id"] in (o["saisi_par"], o["vise_par"]):
        raise ErreurMetier("Quatre yeux : la validation en caisse vient d'une autre personne que celles qui ont saisi et visé.")
    dv, m = o["devise"].strip(), o["montant"]
    s = session_ouverte(u, dv)
    entree = o["sens"] in ("ENCAISSEMENT", "DEPOT")
    coupures = nettoyer(d.get("coupures") if isinstance(d.get("coupures"), dict) else {})
    controler_montant_coupures(coupures, m, dv)
    if not entree:
        th = theorique(s["id"], dv)
        if any(n > th.get(v, 0) for v, n in coupures.items()):
            raise ErreurMetier(f"Pas assez de coupures en caisse ({dv}).")
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    caisse = L("570", "D" if entree else "C", dv, m, f"guichet:{s['guichetId']}")
    if o["type"] == "diverse":
        autres = [L(x["compte"], "C" if entree else "D", dv, x["montant"], None, o["budget_ligne_id"]) for x in lg(o)]
        tiers_id, contrat = None, None
    else:
        c = compte_client(u, o["compte_depot_id"], "N° Compte", True)
        if not entree and m > disponible(c, o["id"]):
            raise ErreurMetier("Solde disponible insuffisant sur le compte du client.")
        autres = [L(LIAISON, "C" if entree else "D", dv, m, f"liaison:{o['agence_client_id']}")]
        tiers_id, contrat = c["tiers_id"], f"liaison:{o['agence_client_id']}"
    piece = nouvelle_piece(u, "CA", j["date_comptable"])
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=o["libelle"], piece=piece, evenement="ed_encaissement" if entree else "ed_decaissement",
                 cle=cle, valide_par=u["id"], lignes_ecr=[caisse, *autres] if entree else [*autres, caisse])
    op = creer_operation(u, s, cle=cle, type_="ed_encaissement" if entree else "ed_decaissement", statut="validee", tiers_id=tiers_id, contrat=contrat,
                         montant=m, devise=dv, coupures=coupures, remis_par=o["nom_client"], ecriture_id=eid, motif=o["libelle"])
    executer("""update operation_comptable set statut = 'payee', valide_par = %s, valide_le = now(), date_validation = %s, piece = %s, ecriture_id = %s,
                operation_id = %s where id = %s""", (u["id"], j["date_comptable"], piece, eid, op, oid))
    o = une("select * from operation_comptable where id = %s", (oid,))
    if o["type"] == "deplacee":
        passer_reflet(u, o)
    return vue(une("select * from operation_comptable where id = %s", (oid,)))
