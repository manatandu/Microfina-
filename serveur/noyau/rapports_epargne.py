"""S72 : Épargne > Rapport (manuel Microfina++, p. 82 à 84, six captures). Mêmes règles que web/src/donnees/api.ts (rapportsEpargne). Registre S72-1 à S72-8.
Virements compte à compte, garanties, recherche multicritère (données ; filtres à l'écran comme S51), indicateurs crédit épargne, comptes inactifs et dormants."""
from datetime import date

from .bd import ErreurMetier, lignes, une, valeur
from .remboursements import etat
from .services import cours, exiger, journee_courante, titulaire

ANS_DORMANT = 10     # loi 22/069, titre III, chap. Ier : dix ans sans opération ni réclamation (registre S72-6)


def _date(v: str, nom: str) -> date:
    try:
        return date.fromisoformat(v)
    except (TypeError, ValueError):
        raise ErreurMetier(f"À remplir : {nom}.")


def _jour(u) -> date:
    j = journee_courante(u)
    return date.fromisoformat(j["date"]) if j else date.today()


SQL_LIGNES = """select l.*, e.libelle, jc.date_comptable as jour, p.numero as piece, cast(substring(l.contrat_ref from 7) as bigint) as compte_id
                from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                left join piece p on p.id = e.piece_id where e.institution_id = %s and l.contrat_ref like 'depot:%%'"""


def virements(u, du: str, au: str) -> list[dict]:
    """7.1 Virements compte à compte par période (capture p. 82) : les écritures qui mouvementent au moins deux comptes de clients, une ligne par compte (registre S72-1)"""
    exiger(u)
    d1, d2 = _date(du, "Du"), _date(au, "Au")
    sortie = []
    for l in lignes(SQL_LIGNES + """ and jc.date_comptable between %s and %s
                    and (select jl.type from journal jl where jl.id = e.journal_id) <> 'a_nouveaux'          -- reprise des soldes : pas un virement (registre E09-4)
                    and (select count(distinct x.contrat_ref) from ligne_ecriture x where x.ecriture_id = l.ecriture_id and x.contrat_ref like 'depot:%%') >= 2
                    order by jc.date_comptable, l.ecriture_id, l.rang""", (u["institution_id"], d1, d2)):
        c = une("select numero, tiers_id from compte_depot where id = %s", (l["compte_id"],))
        sortie.append({"date": l["jour"].isoformat(), "piece": l["piece"] or "", "membre": valeur("select numero from tiers where id = %s", (c["tiers_id"],)),
                       "compte": c["numero"], "libelle": l["libelle"], "devise": l["devise"].strip(),
                       "debit": l["montant_devise"] if l["sens"] == "D" else 0, "credit": l["montant_devise"] if l["sens"] == "C" else 0})
    return sortie


def garanties_a(credit_id: int, d: date) -> list[dict]:
    """Garanties S94 posées au plus tard le jour d, et ce qui en reste à ce jour (dates comptables : ajout et libérations)"""
    return [{**g, "reste": g["montant"] - int(valeur("select coalesce(sum(montant), 0) from garantie_liberation where garantie_id = %s and date_op <= %s", (g["id"], d)))}
            for g in lignes("select * from garantie where credit_id = %s and ajoute_le <= %s", (credit_id, d))]


def garanties(u, du: str, au: str, produit_id: int | None = None, agent_id: int | None = None) -> list[dict]:
    """7.2 Rapport des garanties (capture p. 82) : crédits débloqués dans la période (ou à la date) (registre S72-2).
    Épargne de garantie : épargne obligatoire retenue au déblocage (S75) et dépôts de garantie ajoutés (S94) ; garantie encours : ce qui reste bloqué
    pour le crédit à la date de fin (épargne obligatoire, dépôts de garantie, cautions) ; garantie libérée : le reste de ce qui a été posé."""
    exiger(u)
    d1, d2 = _date(du, "Date de début"), _date(au, "Date de fin")
    sortie = []
    for c in lignes("""select * from credit where institution_id = %s and debloque_le between %s and %s and (%s::bigint is null or produit_id = %s)
                       and (%s::bigint is null or agent_id = %s) order by debloque_le, id""", (u["institution_id"], d1, d2, produit_id, produit_id, agent_id, agent_id)):
        g = garanties_a(c["id"], d2)
        oblig = c["epargne_obligatoire"] if etat(c, d2)["capitalRestant"] > 0 else 0   # bloquée jusqu'au remboursement (S75-8, S76-9)
        pose = c["epargne_obligatoire"] + sum(x["montant"] for x in g)
        encours = oblig + sum(x["reste"] for x in g)
        sortie.append({"membre": valeur("select numero from tiers where id = %s", (c["tiers_id"],)), "credit": c["numero"], "client": titulaire(c["tiers_id"]),
                       "devise": c["devise"].strip(), "montantPret": c["montant"], "produitId": c["produit_id"],
                       "epargneGarantie": c["epargne_obligatoire"] + sum(x["montant"] for x in g if x["type"] == "depot_garantie"),
                       "garantieEncours": encours, "garantieLiberee": max(0, pose - encours)})
    return sortie


def comptes(u, du: str, au: str) -> list[dict]:
    """7.3 Recherche multicritère (capture p. 83) : chaque compte de dépôt, son solde à la fin de la période et ses mouvements de la période ;
    l'écran applique les éléments de la recherche aux titulaires, comme le rapport client S51 (registre S72-3)"""
    exiger(u)
    d1, d2 = _date(du, "Date début"), _date(au, "Date Fin")
    sortie = []
    for c in lignes("""select c.*, p.libelle as produit, p.code as produit_code from compte_depot c join produit_epargne p on p.id = c.produit_id
                       where c.institution_id = %s and coalesce(c.ouvert_le, date '1900-01-01') <= %s order by c.numero""", (u["institution_id"], d2)):
        ref = f"depot:{c['id']}"
        m = lignes("""select l.sens, l.montant_devise, jc.date_comptable as jour, e.libelle, p.numero as piece from ligne_ecriture l join ecriture e on e.id = l.ecriture_id
                      join journee_comptable jc on jc.id = e.journee_id left join piece p on p.id = e.piece_id
                      where l.contrat_ref = %s and jc.date_comptable <= %s order by jc.date_comptable, l.ecriture_id, l.rang""", (ref, d2))
        solde = sum(x["montant_devise"] if x["sens"] == "C" else -x["montant_devise"] for x in m)
        dans = [x for x in m if x["jour"] >= d1]
        sortie.append({"compteId": c["id"], "compte": c["numero"], "tiersId": c["tiers_id"], "produitId": c["produit_id"], "produit": c["produit"],
                       "devise": c["devise"].strip(), "ouvertLe": c["ouvert_le"].isoformat() if c["ouvert_le"] else "", "statut": c["statut"], "solde": solde,
                       "credits": sum(x["montant_devise"] for x in dans if x["sens"] == "C"), "debits": sum(x["montant_devise"] for x in dans if x["sens"] == "D"),
                       "operations": [{"date": x["jour"].isoformat(), "piece": x["piece"] or "", "libelle": x["libelle"],
                                       "debit": x["montant_devise"] if x["sens"] == "D" else 0, "credit": x["montant_devise"] if x["sens"] == "C" else 0} for x in dans]})
    return sortie


def _derniere(cid: int, tiers_id: int, ouvert, jusqua: date):
    """Dernière opération (registre E11-2) : dernier mouvement hors reprise des soldes, dernière plainte, ou ouverture ; au plus la date du rapport"""
    v = [valeur("""select max(jc.date_comptable) from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                   join journal jl on jl.id = e.journal_id where l.contrat_ref = %s and jl.type <> 'a_nouveaux' and jc.date_comptable <= %s
                     and not exists (select 1 from calcul_periodique cp where cp.ecriture_id = e.id)""", (f"depot:{cid}", jusqua)),   # opérations du titulaire seulement (loi 22/069, titre III, chap. Ier)
         valeur("select max(recue_le) from plainte where tiers_id = %s and recue_le <= %s", (tiers_id, jusqua)), ouvert]
    v = [x if isinstance(x, date) else None for x in v]
    return max([x for x in v if x], default=None)


def inactivite(u, date_: str, jours: int | None, tous: bool) -> list[dict]:
    """7.5 et 7.6 Listes des comptes inactifs et dormants (captures p. 83 et 84) : comptes ouverts sans opération depuis au moins le nombre de jours
    (inactifs) ou dix ans (dormants, loi 22/069) à la date ; « Afficher les comptes » ajoute les comptes à solde nul (registre S72-5, S72-6)"""
    exiger(u)
    d = _date(date_, "Date") if date_ else _jour(u)
    seuil = jours
    if seuil is None:
        try:
            seuil = (d - d.replace(year=d.year - ANS_DORMANT)).days
        except ValueError:
            seuil = (d - date(d.year - ANS_DORMANT, 2, 28)).days
    if seuil < 0:
        raise ErreurMetier("Nombres de jours : zéro ou plus.")
    sortie = []
    for c in lignes("select c.*, t.numero as membre from compte_depot c join tiers t on t.id = c.tiers_id where c.institution_id = %s and c.statut = 'ouvert' order by c.numero",
                    (u["institution_id"],)):
        der = _derniere(c["id"], c["tiers_id"], c["ouvert_le"], d)
        if not der:
            continue
        nb = (d - der).days
        solde = int(valeur("""select coalesce(sum(case l.sens when 'C' then l.montant_devise else -l.montant_devise end), 0) from ligne_ecriture l
                              join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id where l.contrat_ref = %s and jc.date_comptable <= %s""",
                           (f"depot:{c['id']}", d)))
        if nb >= seuil and (tous or solde != 0):
            sortie.append({"membre": c["membre"], "compte": c["numero"], "client": titulaire(c["tiers_id"]), "devise": c["devise"].strip(),
                           "dateCreation": c["ouvert_le"].isoformat() if c["ouvert_le"] else "", "derniere": der.isoformat(), "jours": nb, "solde": solde})
    return sortie


def indicateurs(u, date_: str, auxiliaires: bool) -> dict:
    """7.4 Indicateurs crédit épargne (capture p. 83) : comptes épargne par sexe, regroupement par sexe, adhésions et départs de l'année, nantissements et cautions,
    parts sociales par sexe, crédits en cours ; « Ajouter clients auxiliaires » compte aussi les membres auxiliaires (registre S72-4)"""
    exiger(u)
    d = _date(date_, "Indicateurs au") if date_ else _jour(u)
    i = u["institution_id"]
    sexe_sql = "case when t.type = 'physique' then coalesce(p.sexe, '') else 'morale' end"
    aux = "" if auxiliaires else " and not coalesce(t.auxiliaire, false)"
    base = f"""from tiers t left join tiers_personne p on p.tiers_id = t.id where t.institution_id = {int(i)} and t.statut in ('actif', 'resilie'){aux}
               and coalesce(t.admission_le, t.date_visa) <= %s and (t.resilie_le is null or t.resilie_le > %s)"""
    lib = {"M": "Masculin", "F": "Féminin", "morale": "Morale", "": "Non renseigné"}
    par_produit = {}
    for r in lignes(f"""select pe.libelle as produit, {sexe_sql} as sexe, count(*) as n from compte_depot c join produit_epargne pe on pe.id = c.produit_id
                        join tiers t on t.id = c.tiers_id left join tiers_personne p on p.tiers_id = t.id
                        where c.institution_id = %s and coalesce(c.ouvert_le, date '1900-01-01') <= %s and (c.clos_le is null or c.clos_le > %s){aux}
                        group by 1, 2 order by 1""", (i, d, d)):
        x = par_produit.setdefault(r["produit"], {"produit": r["produit"], "masculin": 0, "feminin": 0, "morale": 0, "total": 0})
        x[{"M": "masculin", "F": "feminin"}.get(r["sexe"], "morale")] += r["n"]; x["total"] += r["n"]
    par_sexe = [{"sexe": lib.get(r["sexe"], r["sexe"]), "total": r["n"]} for r in lignes(f"select {sexe_sql} as sexe, count(*) as n {base} group by 1 order by 1", (d, d))]
    annee = d.year
    adhesions = valeur(f"select count(*) from tiers t where t.institution_id = %s and extract(year from coalesce(t.admission_le, t.date_visa)) = %s{aux}", (i, annee))
    departs = valeur(f"select count(*) from tiers t where t.institution_id = %s and extract(year from t.resilie_le) = %s{aux}", (i, annee))
    parts = [{"sexe": lib.get(r["sexe"], r["sexe"]), "parts": int(r["m"])} for r in lignes(
        f"""select {sexe_sql} as sexe, coalesce(sum(case l.sens when 'C' then l.montant_devise else -l.montant_devise end), 0) as m
            from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
            join tiers t on l.contrat_ref = 'parts:' || t.id left join tiers_personne p on p.tiers_id = t.id
            where t.institution_id = %s and jc.date_comptable <= %s{aux} group by 1 order by 1""", (i, d))]
    # Nantissements / Cautions, à la date, en CDF au cours du jour (registre S72-4) : « E. garantie » = épargne obligatoire des crédits en cours (S75)
    # et dépôts de garantie (S94) non libérés ; « Caution » = cautions (S94) non libérées. Dates comptables : déblocage, ajout, libérations.
    garantie_epargne = caution = 0
    credits = []
    for r in lignes("""select c.*, pc.nom as produit from credit c join produit_credit pc on pc.id = c.produit_id
                       where c.institution_id = %s and c.debloque_le <= %s and c.statut in ('debloque', 'solde', 'passe_en_perte') order by pc.nom, c.id""", (i, d)):
        reste = etat(r, d)["capitalRestant"]
        if reste <= 0 or (r["radie_le"] and r["radie_le"] <= d):
            continue
        k = next((x for x in credits if x["produit"] == r["produit"] and x["devise"] == r["devise"].strip()), None)
        if not k:
            k = {"produit": r["produit"], "devise": r["devise"].strip(), "prets": 0, "encours": 0}; credits.append(k)
        k["prets"] += 1; k["encours"] += reste
        dv = r["devise"].strip()
        g = garanties_a(r["id"], d)
        garantie_epargne += round((r["epargne_obligatoire"] + sum(x["reste"] for x in g if x["type"] == "depot_garantie")) * cours(dv, d))
        caution += round(sum(x["reste"] for x in g if x["type"] == "caution") * cours(dv, d))
    return {"date": d.isoformat(), "annee": annee, "comptesParSexe": list(par_produit.values()), "regroupementParSexe": par_sexe, "adhesions": adhesions, "departs": departs,
            "garantieEpargne": garantie_epargne, "caution": caution,
            "partsSociales": parts, "creditsEncours": credits}
