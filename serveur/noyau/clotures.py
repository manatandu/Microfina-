"""S70 : Épargne > Clôturer un Compte (manuel Microfina++, p. 80 : « l'onglet ne marche pas » ; écran complété, registre S70-1 à S70-6).
Mêmes règles que web/src/donnees/api.ts (clotures).

- À la demande du client : gratuite (Instr. BCC 37, annexe, « Clôture de compte ») ; le solde doit être nul, comme pour la résiliation (S48-1),
  et rien ne doit encore dépendre du compte (blocage, DAT, plan d'épargne, chèque en attente, opération de banque en cours).
- Compte inactif depuis dix ans (loi 22/069, titre III, chap. Ier) : la lettre avec accusé de réception notée (E11), le compte est clôturé,
  son solde passe aux avoirs en cours de prescription (PCCI, compte 36, ligne 369), puis il est versé à la BCC, qui le détient cinq ans."""
import uuid
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import compte_du_produit, exiger, journee_courante, nouvelle_piece, poster, solde_contrat, titulaire

COMPTE_PRESCRIPTION = "369"     # PCCI, compte 36 : avoirs en cours de prescription (369 Autres sommes dues à la clientèle)


def texte(d, k):
    v = (d or {}).get(k)
    return v.strip() if isinstance(v, str) else ""


def compte_ouvert(u, cid) -> dict:
    c = une("""select c.*, trim(c.devise) as dv, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id
               where c.id = %s and c.institution_id = %s for update of c""", (cid, u["institution_id"])) if isinstance(cid, int) and not isinstance(cid, bool) else None
    if not c:
        raise ErreurMetier("À remplir : N° compte.")
    if c["statut"] != "ouvert":
        raise ErreurMetier("Ce compte n'est pas ouvert.")
    return c


def attaches(c: dict) -> list[str]:
    """Ce qui dépend encore du compte et empêche sa clôture (registre S70-2)"""
    raisons = []
    if valeur("select 1 from blocage where compte_id = %s and (fin is null or fin > now())", (c["id"],)):
        raisons.append("un blocage en cours")
    if valeur("select 1 from depot_terme where (compte_emetteur_id = %s or compte_dat_id = %s) and statut in ('saisie', 'valide')", (c["id"], c["id"])):
        raisons.append("un DAT en cours")
    if valeur("select 1 from plan_epargne where (compte_epargne_id = %s or compte_plan_id = %s) and statut = 'en_cours'", (c["id"], c["id"])):
        raisons.append("un plan d'épargne en cours")
    if valeur("select 1 from cheque_client where compte_depot_id = %s and statut = 'depose'", (c["id"],)):
        raisons.append("un chèque en attente d'encaissement")
    if valeur("select 1 from operation_banque where compte_depot_id = %s and statut in ('saisie', 'visee', 'validee')", (c["id"],)):
        raisons.append("une opération de banque en cours")
    return raisons


def journee(u) -> dict:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return j


def cloturer(u, d) -> dict:
    """Clôture à la demande du client : gratuite, solde nul, rien d'attaché (registre S70-1, S70-2)"""
    exiger(u)
    c = compte_ouvert(u, (d or {}).get("compteId"))
    j = journee(u)
    solde = solde_contrat(f"depot:{c['id']}", c["dv"], "C")
    if solde != 0:
        raise ErreurMetier("Le compte a encore un solde : le retirer d'abord au guichet (Caisse > Guichet, onglet Retrait), puis clôturer. La clôture est gratuite (Instr. BCC 37, annexe).")
    raisons = attaches(c)
    if raisons:
        raise ErreurMetier("Clôture impossible : " + ", ".join(raisons) + ".")
    executer("update compte_depot set statut = 'clos', clos_le = %s where id = %s", (j["date"], c["id"]))
    executer("""insert into cloture_compte (institution_id, compte_id, motif, observation, date_cloture, solde, devise, cloture_par)
                values (%s, %s, 'demande', %s, %s, 0, %s, %s)""", (u["institution_id"], c["id"], texte(d, "observation") or None, j["date"], c["dv"], u["id"]))
    return vue(une("select * from cloture_compte where compte_id = %s", (c["id"],)))


def cloturer_inactif(u, d) -> dict:
    """Compte inactif depuis dix ans, lettre envoyée (loi 22/069, titre III, chap. Ier) : clôture, solde aux avoirs en cours de prescription (369) (registre S70-3)"""
    from .inactifs import comptes as inactifs
    exiger(u)
    c = compte_ouvert(u, (d or {}).get("compteId"))
    x = next((v for v in inactifs(u, "a_cloturer") if v["compteId"] == c["id"]), None)
    if not x:
        raise ErreurMetier("Ce compte n'a pas atteint dix ans sans opération ni réclamation (loi 22/069, titre III, chap. Ier).")
    if not x["lettreEnvoyeeLe"]:
        raise ErreurMetier("La lettre avec accusé de réception n'a pas été notée : elle est exigée six mois avant la clôture (loi 22/069, titre III, chap. Ier ; Épargne > Comptes inactifs).")
    j = journee(u)
    solde = solde_contrat(f"depot:{c['id']}", c["dv"], "C")
    raisons = attaches(c)
    if raisons:
        raise ErreurMetier("Clôture impossible : " + ", ".join(raisons) + ".")
    eid = None
    if solde > 0:
        eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Clôture compte inactif {c['numero']}", piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])),
                     evenement="cloture_inactif", cle=str(uuid.uuid5(uuid.NAMESPACE_URL, f"cloture-inactif:{c['id']}")), valide_par=u["id"],
                     lignes_ecr=[{"compte": compte_du_produit(c), "contrat": f"depot:{c['id']}", "sens": "D", "devise": c["dv"], "montant": solde},
                                 {"compte": COMPTE_PRESCRIPTION, "contrat": f"prescription:{c['id']}", "sens": "C", "devise": c["dv"], "montant": solde}])
    executer("update compte_depot set statut = 'clos', clos_le = %s where id = %s", (j["date"], c["id"]))
    executer("""insert into cloture_compte (institution_id, compte_id, motif, observation, date_cloture, solde, devise, ecriture_id, cloture_par)
                values (%s, %s, 'inactivite', %s, %s, %s, %s, %s, %s)""",
             (u["institution_id"], c["id"], f"Lettre du {x['lettreEnvoyeeLe']}, accusé {x['referenceLettre']}", j["date"], max(solde, 0), c["dv"], eid, u["id"]))
    return vue(une("select * from cloture_compte where compte_id = %s", (c["id"],)))


def vue(x: dict) -> dict:
    c = une("select numero, tiers_id from compte_depot where id = %s", (x["compte_id"],))
    return {"id": x["id"], "compteId": x["compte_id"], "compte": c["numero"], "membre": valeur("select numero from tiers where id = %s", (c["tiers_id"],)),
            "client": titulaire(c["tiers_id"]), "motif": x["motif"], "observation": x["observation"] or "", "dateCloture": x["date_cloture"].isoformat(),
            "solde": x["solde"], "devise": x["devise"].strip(), "verseeBccLe": x["versee_bcc_le"].isoformat() if x["versee_bcc_le"] else "",
            "referenceBcc": x["reference_bcc"] or ""}


def avoirs(u) -> list[dict]:
    """Avoirs en cours de prescription : soldes des comptes inactifs clôturés, versés ou à verser à la BCC (registre S70-4)"""
    exiger(u)
    return [vue(x) for x in lignes("select * from cloture_compte where institution_id = %s and motif = 'inactivite' and solde > 0 order by date_cloture, id",
                                   (u["institution_id"],))]


def verser_bcc(u, d) -> dict:
    """Versement à la BCC (loi 22/069, titre III, chap. Ier) : débit 369, crédit du compte bancaire choisi ; un versement par devise (registre S70-5)"""
    exiger(u)
    ids = (d or {}).get("ids")
    if not isinstance(ids, list) or not ids or not all(isinstance(v, int) and not isinstance(v, bool) for v in ids):
        raise ErreurMetier("Cochez les avoirs à verser.")
    ref = texte(d, "reference")
    if not ref:
        raise ErreurMetier("À remplir : Référence du versement.")
    cb = une("select * from compte_bancaire where id = %s and institution_id = %s and supprime_le is null", ((d or {}).get("compteBancaireId"), u["institution_id"])) \
        if isinstance((d or {}).get("compteBancaireId"), int) else None
    if not cb:
        raise ErreurMetier("À remplir : Compte bancaire.")
    lignes_ = lignes("""select * from cloture_compte where id = any(%s) and institution_id = %s and motif = 'inactivite' and solde > 0 and versee_bcc_le is null
                        order by id for update""", (ids, u["institution_id"]))
    if len(lignes_) != len(set(ids)):
        raise ErreurMetier("Un avoir coché est déjà versé ou n'est pas à verser.")
    dev = cb["devise"].strip()
    if any(x["devise"].strip() != dev for x in lignes_):
        raise ErreurMetier(f"Le compte bancaire est en {dev} : ne cocher que des avoirs en {dev}.")
    j = journee(u)
    total = sum(x["solde"] for x in lignes_)
    compte_banque = valeur("select numero from compte where id = %s", (cb["compte_id"],))
    l = [{"compte": COMPTE_PRESCRIPTION, "contrat": f"prescription:{x['compte_id']}", "sens": "D", "devise": dev, "montant": x["solde"]} for x in lignes_]
    l.append({"compte": compte_banque, "sens": "C", "devise": dev, "montant": total})
    eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Versement à la BCC des avoirs en cours de prescription, réf. {ref}",
                 piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])), evenement="versement_bcc", cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=l)
    executer("""update cloture_compte set versee_bcc_le = %s, reference_bcc = %s, compte_bancaire_id = %s, ecriture_versement_id = %s, verse_par = %s
                where id = any(%s)""", (j["date"], ref, cb["id"], eid, u["id"], [x["id"] for x in lignes_]))
    return {"total": total, "devise": dev, "avoirs": avoirs(u)}
