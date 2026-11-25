"""Contrôles et travaux comptables (manuel Microfina++) : S110 Rapprochement bancaire (p. 129 ; procédure p. 154 et 155) et S112 Historique (p. 130),
S119 Lettrage (p. 138 et 160), S118 Contrôle (trésorerie, rapport des annulations, état des revenus, p. 136 et 137, 162 et 163), S143 Autres > Trésorerie,
S142 Annulation de règlement de crédit (p. 158).
Instr. BCC 008, art. 10 et 11 : fiabilité et exhaustivité de l'enregistrement, piste d'audit, justification des soldes comptables.
PCCI § 3.3 : toute correction se fait par inscription en négatif ; l'écriture d'annulation est liée à l'écriture d'origine.
Mêmes règles que web/src/donnees/api.ts (controlesCompta). Registre S110, S112, S118, S119, S142, S143."""
import uuid
from collections import defaultdict
from datetime import date

from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante, json_lu, nom_utilisateur, nouvelle_piece, poster, titulaire


def d_(v, nom: str) -> date:
    try:
        return date.fromisoformat(v)
    except (TypeError, ValueError):
        raise ErreurMetier(f"À remplir : {nom}.")


def entier(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    if isinstance(v, str) and v.lstrip("-").isdigit():
        return int(v)
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def jour_ouvert(u) -> dict:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return j


# ---------- S110 : Rapprochement bancaire ; S112 : Historique ----------
def compte_bancaire(u, cid) -> dict:
    c = une("""select cb.id, cb.numero, trim(cb.devise) as devise, cb.compte_id, c.numero as compte, b.nom as banque, b.code as banque_code
               from compte_bancaire cb join compte c on c.id = cb.compte_id join banque b on b.id = cb.banque_id
               where cb.id = %s and cb.institution_id = %s and cb.supprime_le is null""", (cid, u["institution_id"])) if cid else None
    if not c:
        raise ErreurMetier("À remplir : Banque et Compte.")
    return c


def rappro_contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    j = journee_courante(u)
    return {"date": j["date"] if j else "",
            "banques": lignes("select id, code, nom as libelle from banque where institution_id = %s and supprime_le is null order by code", (i,)),
            "comptes": lignes("""select cb.id, cb.banque_id as "banqueId", cb.numero, trim(cb.devise) as devise, c.numero as compte from compte_bancaire cb
                                 join compte c on c.id = cb.compte_id where cb.institution_id = %s and cb.supprime_le is null order by cb.numero""", (i,))}


def journal_banque(u, p: dict) -> dict:
    """Bouton Rechercher : « apparaît le journal banque » (p. 154) : les lignes du compte de la banque jusqu'à la date de fin qui ne sont pas encore pointées,
    celles des périodes précédentes comprises (suspens). Solde début : solde du relevé du dernier rapprochement enregistré."""
    exiger(u)
    cb = compte_bancaire(u, entier(p, "compteBancaireId"))
    du, au = d_(p.get("du"), "Date Début"), d_(p.get("au"), "Date Fin")
    if du > au:
        raise ErreurMetier("Date Début : avant la date fin.")
    rows = lignes("""select l.ecriture_id, l.rang, pc.numero as piece, e.date_valeur, e.libelle, l.sens, l.montant_devise
                     from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join piece pc on pc.id = e.piece_id
                     where l.compte_id = %s and l.devise = %s and e.date_valeur <= %s
                       and not exists (select 1 from rapprochement_ligne r where r.ecriture_id = l.ecriture_id and r.rang = l.rang)
                     order by e.date_valeur, e.id, l.rang""", (cb["compte_id"], cb["devise"], au))
    dernier = une("select solde_releve, fin from rapprochement where compte_bancaire_id = %s order by fin desc, id desc limit 1", (cb["id"],))
    comptable = int(valeur("""select coalesce(sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end), 0) from ligne_ecriture l
                              join ecriture e on e.id = l.ecriture_id where l.compte_id = %s and l.devise = %s and e.date_valeur <= %s""", (cb["compte_id"], cb["devise"], au)))
    return {"devise": cb["devise"], "soldeDebut": dernier["solde_releve"] if dernier else 0, "soldeComptable": comptable,
            "lignes": [{"id": f"{r['ecriture_id']}:{r['rang']}", "piece": r["piece"], "date": r["date_valeur"].isoformat(), "libelle": r["libelle"],
                        "debit": r["montant_devise"] if r["sens"] == "D" else 0, "credit": r["montant_devise"] if r["sens"] == "C" else 0} for r in rows]}


def etat_rapprochement(u, p: dict) -> dict:
    """Etat du rapprochement (bouton Exporter) : du solde comptable au solde du relevé. Ce que nous avons encaissé et que la banque n'a pas encore porté se
    retranche ; ce que nous avons payé et qu'elle n'a pas encore débité s'ajoute. L'écart est ce qui reste inexpliqué (registre S110-3)."""
    j = journal_banque(u, p)
    solde_fin = entier(p, "soldeFin")
    if solde_fin is None:
        raise ErreurMetier("À remplir : Solde Fin.")
    pointees = set(p.get("lignes") or []) if isinstance(p.get("lignes"), list) else set()
    connues = {x["id"] for x in j["lignes"]}
    if not pointees <= connues:
        raise ErreurMetier("Une opération cochée n'est plus dans le journal de la banque : relancer Rechercher.")
    suspens = [x for x in j["lignes"] if x["id"] not in pointees]
    sd, sc = sum(x["debit"] for x in suspens), sum(x["credit"] for x in suspens)
    theorique = j["soldeComptable"] - sd + sc
    cb = compte_bancaire(u, entier(p, "compteBancaireId"))
    return {"banque": cb["banque"], "compte": cb["numero"], "devise": j["devise"], "du": p["du"], "au": p["au"], "soldeDebut": j["soldeDebut"], "soldeComptable": j["soldeComptable"],
            "suspens": suspens, "suspensDebit": sd, "suspensCredit": sc, "soldeTheorique": theorique, "soldeFin": solde_fin, "ecart": solde_fin - theorique,
            "pointees": sorted(pointees)}


def enregistrer_rapprochement(u, p: dict) -> dict:
    """Le rapprochement entre à l'historique (S112) ; ses lignes pointées ne reviennent plus"""
    exiger(u)
    e = etat_rapprochement(u, p)
    cb = compte_bancaire(u, entier(p, "compteBancaireId"))
    if une("select 1 from rapprochement where compte_bancaire_id = %s and fin >= %s", (cb["id"], e["du"])):
        raise ErreurMetier("Période : un rapprochement de ce compte couvre déjà cette date de début.")
    rid = valeur("""insert into rapprochement (institution_id, agence_id, compte_bancaire_id, debut, fin, solde_debut, solde_releve, solde_comptable, suspens_debit,
                                               suspens_credit, ecart, prepare_par, date_operation)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, coalesce(%s::date, jour_agence())) returning id""",
                 (u["institution_id"], u["agence_id"], cb["id"], e["du"], e["au"], e["soldeDebut"], e["soldeFin"], e["soldeComptable"], e["suspensDebit"], e["suspensCredit"],
                  e["ecart"], u["id"], (journee_courante(u) or {}).get("date")))
    for x in e["pointees"]:
        eid, rang = x.split(":")
        executer("insert into rapprochement_ligne (rapprochement_id, ecriture_id, rang) values (%s, %s, %s)", (rid, int(eid), int(rang)))
    return {**e, "id": rid}


def historique(u, p: dict) -> list[dict]:
    """S112 : rapprochements enregistrés, par période ou par date (journée comptable de l'enregistrement) ; filtres : période rapprochée, banque, compte"""
    exiger(u)
    du = d_(p.get("du"), "Date Début")
    au = du if p.get("mode") == "date" else d_(p.get("au"), "Date Fin")
    if du > au:
        raise ErreurMetier("Date Début : avant la date fin.")
    pdu = d_(p["periodeDu"], "Date deb. période rapprochement") if p.get("periodeDu") else None
    pau = d_(p["periodeAu"], "Date fin période rapprochement") if p.get("periodeAu") else None
    banque, compte = entier(p, "banqueId"), entier(p, "compteBancaireId")
    return [{"id": r["id"], "date": r["date_operation"].isoformat(), "banque": r["banque"], "compte": r["numero"], "devise": r["devise"].strip(), "du": r["debut"].isoformat(),
             "au": r["fin"].isoformat(), "soldeDebut": r["solde_debut"], "soldeReleve": r["solde_releve"], "soldeComptable": r["solde_comptable"], "ecart": r["ecart"],
             "preparePar": nom_utilisateur(r["prepare_par"]), "lignes": r["n"]}
            for r in lignes("""select r.*, cb.numero, cb.devise, b.nom as banque, (select count(*) from rapprochement_ligne x where x.rapprochement_id = r.id) as n
                               from rapprochement r join compte_bancaire cb on cb.id = r.compte_bancaire_id join banque b on b.id = cb.banque_id
                               where r.institution_id = %s and r.date_operation between %s and %s and (%s::date is null or r.debut >= %s) and (%s::date is null or r.fin <= %s)
                                 and (%s::bigint is null or b.id = %s) and (%s::bigint is null or cb.id = %s) order by r.date_operation, r.id""",
                            (u["institution_id"], du, au, pdu, pdu, pau, pau, banque, banque, compte, compte))]


# ---------- S119 : Lettrage des écritures comptables ----------
def code_lettrage(n: int) -> str:
    """A, B, …, Z, AA, AB, … : le n-ième code du compte"""
    s = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def compte_lettrable(u, numero: str) -> dict:
    c = une("select id, numero, libelle from compte where numero = %s and (institution_id is null or institution_id = %s) order by institution_id nulls first limit 1",
            ((numero or "").strip(), u["institution_id"]))
    if not c:
        raise ErreurMetier("À remplir : Compte.")
    return c


def lettrage_lignes(u, p: dict) -> dict:
    """Bouton Afficher : les lignes définitives du compte (journées comptabilisées, T13), non lettrées, lettrées ou toutes"""
    exiger(u)
    c = compte_lettrable(u, p.get("compte"))
    du = d_(p.get("du"), "Date début")
    au = d_(p["au"], "Date fin") if p.get("au") else date(9999, 12, 31)
    etat = p.get("etat") or "non"
    rows = lignes("""select l.ecriture_id, l.rang, e.date_valeur, pc.numero as piece, e.libelle, l.sens, l.montant_cdf, lt.code
                     from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id join piece pc on pc.id = e.piece_id
                     left join lettrage_ligne ll on ll.ecriture_id = l.ecriture_id and ll.rang = l.rang left join lettrage lt on lt.id = ll.lettrage_id
                     where e.institution_id = %s and l.compte_id = %s and jc.statut = 'fermee' and e.date_valeur between %s and %s
                     order by e.date_valeur, e.id, l.rang""", (u["institution_id"], c["id"], du, au))
    out = [{"id": f"{r['ecriture_id']}:{r['rang']}", "date": r["date_valeur"].isoformat(), "piece": r["piece"], "libelle": r["libelle"],
            "debit": r["montant_cdf"] if r["sens"] == "D" else 0, "credit": r["montant_cdf"] if r["sens"] == "C" else 0, "lettre": r["code"] or ""} for r in rows]
    return {"compte": c["numero"], "intitule": c["libelle"], "lignes": [x for x in out if etat == "toutes" or (etat == "lettrees") == bool(x["lettre"])]}


def lettrer(u, p: dict) -> dict:
    """Bouton Lettrer : les lignes cochées reçoivent le même code quand leur débit égale leur crédit (registre S119-2)"""
    exiger(u)
    c = compte_lettrable(u, p.get("compte"))
    ids = p.get("lignes") if isinstance(p.get("lignes"), list) else []
    if len(ids) < 2:
        raise ErreurMetier("Cocher au moins deux écritures à lettrer.")
    td = tc = 0
    cles = []
    for x in ids:
        try:
            eid, rang = (int(v) for v in str(x).split(":"))
        except ValueError:
            raise ErreurMetier("Écriture inconnue.")
        r = une("""select l.sens, l.montant_cdf, jc.statut, (select 1 from lettrage_ligne ll where ll.ecriture_id = l.ecriture_id and ll.rang = l.rang) as deja
                   from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                   where l.ecriture_id = %s and l.rang = %s and l.compte_id = %s and e.institution_id = %s""", (eid, rang, c["id"], u["institution_id"]))
        if not r or r["statut"] != "fermee":
            raise ErreurMetier("Écriture inconnue pour ce compte.")
        if r["deja"]:
            raise ErreurMetier("Une écriture cochée est déjà lettrée.")
        if r["sens"] == "D":
            td += r["montant_cdf"]
        else:
            tc += r["montant_cdf"]
        cles.append((eid, rang))
    if td != tc or td == 0:
        raise ErreurMetier("Solde sélection : le total débit doit égaler le total crédit pour lettrer.")
    n = int(valeur("select count(*) from lettrage where institution_id = %s and compte_id = %s", (u["institution_id"], c["id"]))) + 1
    lid = valeur("insert into lettrage (institution_id, compte_id, code, montant, lettre_par) values (%s, %s, %s, %s, %s) returning id",
                 (u["institution_id"], c["id"], code_lettrage(n), td, u["id"]))
    for eid, rang in cles:
        executer("insert into lettrage_ligne (lettrage_id, ecriture_id, rang) values (%s, %s, %s)", (lid, eid, rang))
    return {"code": code_lettrage(n), "montant": td}


# ---------- S118 : Contrôle > Trésorerie (aussi Autres > Trésorerie, S143) ----------
def tresorerie(u, p: dict) -> dict:
    """Bouton Afficher : « Solde des caisses au … » et « Solde des banques au … » : soldes au grand livre à la date, brouillard compris (texte p. 162 :
    « pour la journée comptable »)"""
    exiger(u)
    d = d_(p.get("date"), "Date")
    caisses = []
    for g in lignes("""select g.id, g.code, g.nom, coalesce(nullif(g.compte_guichet, ''), '570') as compte from guichet g
                       where g.agence_id = %s order by g.code""", (u["agence_id"],)):
        for r in lignes("""select trim(l.devise) as devise, sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end) as solde
                           from ligne_ecriture l join ecriture e on e.id = l.ecriture_id where l.contrat_ref = %s and e.date_valeur <= %s group by 1 order by 1""",
                        (f"guichet:{g['id']}", d)):
            caisses.append({"compte": g["compte"], "designation": g["nom"], "devise": r["devise"], "solde": int(r["solde"])})
    banques = []
    for cb in lignes("""select cb.id, cb.numero, trim(cb.devise) as devise, cb.compte_id, c.numero as compte, b.nom as banque from compte_bancaire cb
                        join compte c on c.id = cb.compte_id join banque b on b.id = cb.banque_id where cb.institution_id = %s and cb.supprime_le is null
                        order by b.code, cb.numero""", (u["institution_id"],)):
        solde = int(valeur("""select coalesce(sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end), 0) from ligne_ecriture l
                              join ecriture e on e.id = l.ecriture_id where l.compte_id = %s and l.devise = %s and e.date_valeur <= %s""", (cb["compte_id"], cb["devise"], d)))
        banques.append({"compte": cb["compte"], "designation": f"{cb['banque']} {cb['numero']}", "devise": cb["devise"], "solde": solde})
    tot = lambda l: {dv: sum(x["solde"] for x in l if x["devise"] == dv) for dv in sorted({x["devise"] for x in l})}
    return {"date": d.isoformat(), "caisses": caisses, "banques": banques, "totalCaisses": tot(caisses), "totalBanques": tot(banques)}


# ---------- S118 : Rapport des annulations ----------
TYPES_ANNULATION = {"remboursement_credit": "Remboursement de crédit"}


def annulations_contexte(u) -> dict:
    exiger(u)
    return {"guichets": lignes("select id, nom from guichet where agence_id = %s order by code", (u["agence_id"],)),
            "types": [{"code": k, "libelle": v} for k, v in TYPES_ANNULATION.items()],
            "utilisateurs": lignes("select id, nom from utilisateur where institution_id = %s order by nom", (u["institution_id"],))}


def annulations(u, p: dict) -> list[dict]:
    """Les écritures d'annulation de la période (PCCI § 3.3) : pièce d'origine, pièce d'annulation, client, montant"""
    exiger(u)
    du, au = d_(p.get("du"), "Du"), d_(p.get("au"), "Au")
    if du > au:
        raise ErreurMetier("Du : avant Au.")
    util, type_, guichet = entier(p, "utilisateurId"), p.get("type") or None, entier(p, "guichetId")
    out = []
    for r in lignes("""select a.id, a.date_valeur, pa.numero as nouvelle, po.numero as ancienne, a.libelle, a.saisi_par, so.type_evenement as type, o.id as origine,
                              (select sum(l.montant_cdf) from ligne_ecriture l where l.ecriture_id = a.id and l.sens = 'D') as montant
                       from ecriture a join ecriture o on o.id = a.contre_passe_id join piece pa on pa.id = a.piece_id join piece po on po.id = o.piece_id
                       join journee_comptable jc on jc.id = a.journee_id left join schema_comptable so on so.id = o.schema_id
                       where a.institution_id = %s and jc.agence_id = %s and a.date_valeur between %s and %s and (%s::bigint is null or a.saisi_par = %s)
                         and (%s::text is null or so.type_evenement = %s) order by a.date_valeur, a.id""",
                    (u["institution_id"], u["agence_id"], du, au, util, util, type_, type_)):
        if guichet and not valeur("select 1 from ligne_ecriture where ecriture_id = %s and contrat_ref = %s", (r["origine"], f"guichet:{guichet}")):
            continue
        ra = une("select c.tiers_id, t.numero from remboursement_annule x join credit c on c.id = x.credit_id join tiers t on t.id = c.tiers_id where x.ecriture_annulation = %s", (r["id"],))
        out.append({"ancienne": r["ancienne"], "nouvelle": r["nouvelle"], "numeroClient": ra["numero"] if ra else "", "nom": titulaire(ra["tiers_id"]) if ra else "",
                    "montant": int(r["montant"] or 0), "date": r["date_valeur"].isoformat(), "type": TYPES_ANNULATION.get(r["type"], r["type"] or ""), "libelle": r["libelle"],
                    "utilisateur": nom_utilisateur(r["saisi_par"])})
    return out


# ---------- S118 : Etat des revenus ----------
def revenus(u, p: dict) -> dict:
    """Bouton Afficher : par jour (Détaillé) ou pour la période (Synthèse) : dépenses (classe 6), recettes (classe 7), résultat ; montants en CDF"""
    exiger(u)
    du, au = d_(p.get("du"), "Du"), d_(p.get("au"), "Au")
    if du > au:
        raise ErreurMetier("Du : avant Au.")
    rows = lignes("""select e.date_valeur, a.code as agence,
                            sum(case when left(c.numero, 1) = '6' then (case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) else 0 end) as depenses,
                            sum(case when left(c.numero, 1) = '7' then (case l.sens when 'C' then l.montant_cdf else -l.montant_cdf end) else 0 end) as recettes
                     from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id join journee_comptable jc on jc.id = e.journee_id
                     join agence a on a.id = jc.agence_id
                     where e.institution_id = %s and e.date_valeur between %s and %s and left(c.numero, 1) in ('6', '7') and e.type <> 'vidage'
                     group by 1, 2 order by 1, 2""", (u["institution_id"], du, au))
    det = [{"date": r["date_valeur"].isoformat(), "agence": r["agence"], "depenses": int(r["depenses"]), "recettes": int(r["recettes"]), "resultat": int(r["recettes"] - r["depenses"])}
           for r in rows]
    if p.get("resultat") == "synthese":
        g = defaultdict(lambda: [0, 0])
        for x in det:
            g[x["agence"]][0] += x["depenses"]
            g[x["agence"]][1] += x["recettes"]
        det = [{"date": "", "agence": k, "depenses": v[0], "recettes": v[1], "resultat": v[1] - v[0]} for k, v in sorted(g.items())]
    return {"lignes": det, "depenses": sum(x["depenses"] for x in det), "recettes": sum(x["recettes"] for x in det), "resultat": sum(x["resultat"] for x in det)}


# ---------- S142 : Annulation de règlement d'un crédit effectué par prélèvement sur compte ----------
def reglements_annulables(u) -> list[dict]:
    """Recherche du « N° de pièce » : les remboursements par prélèvement sur compte ou par banque (plan d'allègement, point 6.9), le dernier de chaque crédit en cours"""
    exiger(u)
    out = []
    for r in lignes("""select r.*, pc.numero as piece, c.numero as credit, c.tiers_id, c.statut, c.devise from remboursement r join credit c on c.id = r.credit_id
                       join ecriture e on e.id = r.ecriture_id join piece pc on pc.id = e.piece_id
                       where c.institution_id = %s and r.mode in ('epargne', 'banque') and c.statut = 'debloque'
                         and r.id = (select x.id from remboursement x where x.credit_id = c.id order by x.date_reglement desc, x.id desc limit 1)
                       order by r.date_reglement desc, r.id desc""", (u["institution_id"],)):
        out.append(vue_reglement(r))
    return out


def vue_reglement(r: dict) -> dict:
    rep = json_lu(r["repartition"])
    k = une("""select cd.numero from ligne_ecriture l join compte_depot cd on l.contrat_ref = 'depot:' || cd.id where l.ecriture_id = %s and l.sens = 'D' limit 1""", (r["ecriture_id"],))
    t = une("select numero from tiers where id = %s", (r["tiers_id"],))
    if r["mode"] == "banque":                          # le compte bancaire de l'institution qui a reçu le remboursement
        k = une("select cb.numero from compte_bancaire cb where cb.id = %s", (r["compte_bancaire_id"],))
    return {"id": r["id"], "piece": r["piece"], "date": r["date_reglement"].isoformat(), "credit": r["credit"], "client": f"{t['numero']} {titulaire(r['tiers_id'])}",
            "mode": "Banque" if r["mode"] == "banque" else "Prélèvement sur compte", "compteClient": k["numero"] if k else "", "devise": r["devise"].strip(), "capital": rep.get("capital", 0), "interet": rep.get("interet", 0), "epargne": rep.get("epargne", 0),
            "solidarite": rep.get("solidarite", 0), "penalite": rep.get("penalite", 0) + rep.get("anticipation", 0), "montant": r["montant"]}


def annuler_reglement(u, rid: int) -> dict:
    """Bouton Valider : écriture inverse dans la journée ouverte, liée à l'écriture d'origine (PCCI § 3.3) ; le règlement quitte les remboursements du crédit et
    se garde parmi les règlements annulés. Seulement le dernier règlement d'un crédit en cours ; par une autre personne que celle
    qui l'a saisi (Instr. BCC 008, art. 66). Après un remboursement anticipé, les échéances d'avant le règlement reviennent. Registre S142-1 à S142-5."""
    exiger(u)
    r = une("""select r.*, pc.numero as piece, c.numero as credit, c.tiers_id, c.statut, c.devise, e.libelle from remboursement r join credit c on c.id = r.credit_id
               join ecriture e on e.id = r.ecriture_id join piece pc on pc.id = e.piece_id where r.id = %s and c.institution_id = %s for update of r""", (rid, u["institution_id"]))
    if not r or r["mode"] not in ("epargne", "banque"):            # prélèvement sur compte ou banque (plan d'allègement, point 6.9)
        raise ErreurMetier("À remplir : N° de pièce d'un remboursement par prélèvement sur compte ou par banque.")
    if r["statut"] != "debloque":
        raise ErreurMetier("Crédit soldé : ce règlement ne s'annule plus.")
    if valeur("select id from remboursement where credit_id = %s order by date_reglement desc, id desc limit 1", (r["credit_id"],)) != r["id"]:
        raise ErreurMetier("Seul le dernier règlement du crédit s'annule.")
    rep, avant = json_lu(r["repartition"]), json_lu(r["echeances_avant"])
    if rep.get("capitalAnticipe") and avant is None:
        raise ErreurMetier("Remboursement anticipé : l'échéancier d'avant ce règlement n'a pas été gardé, il ne s'annule pas.")
    if r["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : l'annulation vient d'une autre personne que celle qui a saisi le règlement.")
    j = jour_ouvert(u)
    jd = date.fromisoformat(j["date"])
    orig = lignes("""select c.numero as compte, l.contrat_ref, l.sens, trim(l.devise) as devise, l.montant_devise from ligne_ecriture l join compte c on c.id = l.compte_id
                     where l.ecriture_id = %s order by l.rang""", (r["ecriture_id"],))
    inverse = [{"compte": x["compte"], "sens": "C" if x["sens"] == "D" else "D", "devise": x["devise"], "montant": x["montant_devise"],
                **({"contrat": x["contrat_ref"]} if x["contrat_ref"] else {})} for x in orig]
    eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Annulation : {r['libelle']}", piece=nouvelle_piece(u, "OD", jd), evenement="annulation", cle=str(uuid.uuid4()),
                 valide_par=u["id"], lignes_ecr=inverse, contre_passe=r["ecriture_id"])
    hb = sum(x["montant_devise"] for x in orig if x["compte"].startswith("0630") and x["sens"] == "C")       # intérêts sortis du hors bilan au règlement : ils y reviennent (CR-19)
    if hb:
        executer("update credit set interets_hors_bilan = interets_hors_bilan + %s where id = %s", (hb, r["credit_id"]))
    for e in avant or []:                                         # remboursement anticipé : les échéances d'avant le règlement reviennent
        executer("update echeance set capital = %s, interet = %s where credit_id = %s and rang = %s", (e["capital"], e["interet"], r["credit_id"], e["rang"]))
    executer("""insert into remboursement_annule (id, credit_id, ecriture_id, ecriture_annulation, date_reglement, montant, repartition, echeances_avant, mandataire, mode,
                                                  saisi_par, annule_par, annule_le) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
             (r["id"], r["credit_id"], r["ecriture_id"], eid, r["date_reglement"], r["montant"], Jsonb(rep), Jsonb(avant) if avant is not None else None, r["mandataire"],
              r["mode"], r["saisi_par"], u["id"], jd))
    executer("delete from remboursement where id = %s", (r["id"],))
    return {**vue_reglement(r), "pieceAnnulation": valeur("select pc.numero from ecriture e join piece pc on pc.id = e.piece_id where e.id = %s", (eid,))}
