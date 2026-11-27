"""S111 : Comptabilité > Comptabilisation (manuel Microfina++, p. 130, capture « Comptabilisation d'écriture comptable » ; reprise p. 155).
Mêmes règles que web/src/donnees/api.ts (comptabilisation). Registre S111-1 à S111-5, T13, T14.

« Cliquer sur [Comptabiliser] pour effectuer l'opération. » Capture : case Recherche avancée, liste Journée non comptabilisée, bouton Comptabiliser,
grille Date opération, N°Pièce, N° Compte, Débit, Crédit, Référence écriture, Intitulé ; confirmation.
La comptabilisation passe d'abord les écritures que la Banque laisse en attente, avec leur N° de pièce (registre S111-4) :
- opérations de banque validées (S52, S53, S56) : encaissement et décaissement divers, virement banque vers banque, virement et prélèvement d'un client,
  adhésion par banque (le compte épargne s'ouvre alors) ; banque vers caisse : débit du compte 591 de virements internes, le caissier du guichet reçoit
  les fonds avec son billetage depuis « Fonds à recevoir » (plan d'allègement, point 7.5), pour que son stock de coupures reste juste ;
- chèques clients encaissés (S59) : débit de la banque, crédit du compte du client ;
- emprunts bancaires (S61) : mise en place (banque, 533) et remboursements (533, 6020 ou 6021, 60701 ou 60702 ; emprunt subordonné : 6306 et 6316).
Puis la journée est fermée : ses écritures deviennent définitives (T13 ; PCCI § 3.4)."""
import uuid

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import (compte_du_produit, compte_parts, controles_journee, exiger, fermer_journee, lignes_ecriture, nouvelle_piece, numero_compte, poster,
                       preparer_adhesion, valeur_part)

VIREMENTS_INTERNES = "591"


def journee(u, jid: int) -> dict:
    j = une("select * from journee_comptable where id = %s and agence_id = %s", (jid, u["agence_id"]))
    if not j or j["statut"] == "fermee":
        raise ErreurMetier("Journée introuvable ou déjà comptabilisée.")
    return j


def banque(cid: int) -> dict:
    return une("""select cb.id, c.numero as compte, coalesce(j.code, 'OD') as journal from compte_bancaire cb join compte c on c.id = cb.compte_id
                  left join journal j on j.id = cb.journal_id and j.actif and not j.supprime where cb.id = %s""", (cid,))


def depot(cid: int) -> dict:
    return une("select cd.id, p.famille, p.compte_lie from compte_depot cd join produit_epargne p on p.id = cd.produit_id where cd.id = %s", (cid,))


def L(compte, sens, devise, montant, contrat=None) -> dict:
    return {"compte": compte, "sens": sens, "devise": devise, "montant": montant, **({"contrat": contrat} if contrat else {})}


def en_attente(u, j: dict) -> list[dict]:
    """Ce que la Banque laisse à comptabiliser au plus tard à la date de la journée : {source, id, libelle, journal, lignes, date}"""
    d, i, a = j["date_comptable"], u["institution_id"], u["agence_id"]
    out = []
    for o in lignes("""select * from operation_banque where institution_id = %s and agence_id = %s and statut = 'validee' and date_validation <= %s
                       order by date_validation, id""", (i, a, d)):
        b, dv, m = banque(o["compte_bancaire_id"]), o["devise"].strip(), o["montant"]
        t = o["type"]
        if t == "encaissement":
            l = [L(b["compte"], "D", dv, m), L(o["compte"], "C", dv, m)]
        elif t == "decaissement":
            l = [L(o["compte"], "D", dv, m), L(b["compte"], "C", dv, m)]
        elif t == "banque_caisse":
            l = [L(VIREMENTS_INTERNES, "D", dv, m), L(b["compte"], "C", dv, m)]
        elif t == "banque_banque":
            l = [L(banque(o["compte_bancaire_dest_id"])["compte"], "D", dv, m), L(b["compte"], "C", dv, m)]
        elif t in ("virement_client", "prelevement_client"):
            k = depot(o["compte_depot_id"])
            cl = L(compte_du_produit(k), "C" if t == "virement_client" else "D", dv, m, f"depot:{k['id']}")
            l = [L(b["compte"], "D", dv, m), cl] if t == "virement_client" else [cl, L(b["compte"], "C", dv, m)]
        else:                                                         # adhesion_banque : lignes écrites à la comptabilisation (le compte s'ouvre alors)
            l = [L(b["compte"], "D", dv, m), L("", "C", dv, m)]
        out.append({"source": "operation_banque", "id": o["id"], "type": t, "libelle": o["libelle"], "journal": b["journal"], "lignes": l,
                    "date": o["date_validation"], "o": o})
    for c in lignes("""select * from cheque_client where institution_id = %s and agence_id = %s and statut = 'encaisse' and ecriture_id is null
                       and date_encaissement <= %s order by date_encaissement, id""", (i, a, d)):
        b, dv, k = banque(c["compte_bancaire_id"]), c["devise"].strip(), depot(c["compte_depot_id"])
        out.append({"source": "cheque_client", "id": c["id"], "type": "cheque", "libelle": f"Encaissement du chèque {c['numero_cheque']}", "journal": b["journal"],
                    "lignes": [L(b["compte"], "D", dv, c["montant"]), L(compte_du_produit(k), "C", dv, c["montant"], f"depot:{k['id']}")],
                    "date": c["date_encaissement"]})
    for e in lignes("""select * from emprunt where institution_id = %s and agence_id = %s and statut = 'saisie' and date_emprunt <= %s order by date_emprunt, id""", (i, a, d)):
        b, dv = banque(e["compte_bancaire_id"]), e["devise"].strip()
        out.append({"source": "emprunt", "id": e["id"], "type": "emprunt", "libelle": f"Mise en place de l'emprunt n° {e['numero']}", "journal": b["journal"],
                    "lignes": [L(b["compte"], "D", dv, e["montant"]), L(e["compte_emprunt"], "C", dv, e["montant"])], "date": e["date_emprunt"]})
    from .emprunts import compte_commission, compte_interet
    for r in lignes("""select r.*, e.numero, e.compte_bancaire_id, e.devise, e.compte_emprunt, e.duree_mois, e.statut as statut_emprunt, e.date_emprunt
                       from remboursement_emprunt r join emprunt e on e.id = r.emprunt_id
                       where e.institution_id = %s and e.agence_id = %s and r.statut = 'saisie' and r.date_operation <= %s order by r.date_operation, r.id""", (i, a, d)):
        if r["statut_emprunt"] == "saisie" and r["date_emprunt"] > d:   # l'emprunt lui-même n'est pas encore comptabilisable
            continue
        b, dv = banque(r["compte_bancaire_id"]), r["devise"].strip()
        l = [L(c_, "D", dv, m) for c_, m in ((r["compte_emprunt"], r["amortissement"]), (compte_interet(r["duree_mois"], r["compte_emprunt"]), r["interet"]),
                                                (compte_commission(r["compte_emprunt"], b["compte"]), r["commission"])) if m]
        l.append(L(b["compte"], "C", dv, r["amortissement"] + r["interet"] + r["commission"]))
        out.append({"source": "remboursement_emprunt", "id": r["id"], "type": "remboursement_emprunt", "libelle": f"Remboursement de l'emprunt n° {r['numero']}",
                    "journal": b["journal"], "lignes": l, "date": r["date_operation"]})
    from . import factures_fournisseurs, operations_compta
    # S109, S116, S117 : opérations validées (S114) et reflets des opérations déplacées ; S107 : factures et règlements validés
    return out + operations_compta.en_attente(u, j) + factures_fournisseurs.en_attente(u, j)


def a_comptabiliser(u, jid: int) -> dict:
    """La grille de la capture : les écritures de la journée (brouillard) et celles que la comptabilisation va passer (sans pièce encore)"""
    exiger(u)
    j = journee(u, jid)
    out = []
    for e in lignes("""select e.id, e.numero, e.libelle, e.date_valeur, p.numero as piece from ecriture e join piece p on p.id = e.piece_id
                       where e.journee_id = %s order by e.id""", (jid,)):
        for l in lignes_ecriture(e["id"]):
            out.append({"date": e["date_valeur"].isoformat(), "piece": e["piece"], "compte": l["compte"], "debit": l["montant"] if l["sens"] == "D" else 0,
                        "credit": l["montant"] if l["sens"] == "C" else 0, "devise": l["devise"], "reference": e["numero"], "intitule": e["libelle"]})
    for x in en_attente(u, j):
        for l in x["lignes"]:
            out.append({"date": x["date"].isoformat(), "piece": "", "compte": l["compte"], "debit": l["montant"] if l["sens"] == "D" else 0,
                        "credit": l["montant"] if l["sens"] == "C" else 0, "devise": l["devise"], "reference": "", "intitule": x["libelle"]})
    return {"journee": {"id": j["id"], "date": j["date_comptable"].isoformat()}, "controles": controles_journee(jid), "lignes": out}


def passer(u, j: dict) -> int:
    """Passe les écritures en attente dans la journée, avec leur N° de pièce ; rend leur nombre"""
    n = 0
    for x in en_attente(u, j):
        cle, piece = str(uuid.uuid4()), nouvelle_piece(u, x["journal"], j["date_comptable"])
        lg, apres = x["lignes"], None
        if x["type"] == "adhesion_banque":
            o = x["o"]
            a = preparer_adhesion(u, {"tiersId": o["tiers_id"], "parts": o["parts"], "depot": o["premier_depot"], "compteOuvert": o["compte_depot_id"]})
            t, produit = a["t"], a["produit"]
            cid = o["compte_depot_id"] or valeur("""insert into compte_depot (institution_id, agence_id, tiers_id, produit_id, numero, devise, statut, ouvert_le)
                            values (%s, %s, %s, %s, %s, 'CDF', 'ouvert', %s) returning id""",
                         (u["institution_id"], t["agence_id"], a["tid"], produit["id"], numero_compte(u, t, produit), j["date_comptable"]))   # opération validée avant le 27/11/2026
            lg = [x["lignes"][0]]
            if a["m_parts"]:
                lg.append(L(compte_parts(t), "C", "CDF", a["m_parts"], f"parts:{a['tid']}"))
            lg += [L(f["compte"], "C", "CDF", f["montant"], f"frais:{f['fraisId']}") for f in a["frais"]]
            if a["m_depot"]:
                lg.append(L(compte_du_produit(produit), "C", "CDF", a["m_depot"], f"depot:{cid}"))
            if sum(l["montant"] for l in lg[1:]) != o["montant"]:
                raise ErreurMetier(f"Adhésion par banque de {t['numero']} : les frais ou la valeur de la part ont changé depuis la saisie ; refuser l'opération et la ressaisir.")
            apres = (a["tid"], a["nb"])
        eid = poster(u, journal=x["journal"], journee_id=j["id"], libelle=x["libelle"], piece=piece, evenement=x.get("evenement", "comptabilisation_banque"), cle=cle,
                     valide_par=u["id"], lignes_ecr=lg)
        if apres and apres[1]:
            executer("insert into mouvement_parts (tiers_id, sens, nombre, valeur_unitaire, devise, ecriture_id) values (%s, 'achat', %s, %s, 'CDF', %s)",
                     (apres[0], apres[1], valeur_part(u["institution_id"]), eid))
        if x["source"] in ("operation_comptable", "reflet"):
            from . import operations_compta
            operations_compta.marquer(x, piece, eid)
        elif x["source"] in ("facture", "reglement"):
            from . import factures_fournisseurs
            factures_fournisseurs.marquer(x, piece, eid)
        elif x["source"] == "operation_banque":
            executer("update operation_banque set statut = 'comptabilisee', piece = %s where id = %s", (piece, x["id"]))
        elif x["source"] == "cheque_client":
            executer("update cheque_client set ecriture_id = %s where id = %s", (eid, x["id"]))
        elif x["source"] == "emprunt":
            executer("update emprunt set statut = 'comptabilisee', piece = %s where id = %s", (piece, x["id"]))
        else:
            executer("update remboursement_emprunt set statut = 'comptabilisee', piece = %s where id = %s", (piece, x["id"]))
        n += 1
    return n


def comptabiliser(u, jid: int) -> dict:
    """Bouton Comptabiliser : contrôles (S111-2), écritures en attente (S111-4), puis la journée est fermée (services.fermer_journee)"""
    exiger(u)
    journee(u, jid)
    return fermer_journee({**u, "droit_route": True}, jid)
