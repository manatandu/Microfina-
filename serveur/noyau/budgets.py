"""S124 : Budget > Nouveau budget (manuel Microfina++, p. 142 : « Définir nouveau budget » ou « Reconduire ancien budget », OK).
S125 : Consultation budget, Suivi budgétaire, Consommation par centre de coût (p. 143, trois captures).
Le « Budget » est le plan budgétaire de S19 (Année, Code, Libellé) ; ses lignes sont les lignes de plan (N°, Libellé, Centre de coût, Bailleur) ; le type de
budget dit quels comptes se budgètent (Param Compte) ; la période donne les dates (JJ/MM) dans l'année du plan. Une valeur par plan, type, période, ligne
et compte. Réalisé : écritures définitives (T13) du compte sur la période, en CDF ; une écriture saisie avec sa ligne budgétaire (S109, S116, S107) va à
cette ligne ; sans ligne, elle va à la seule ligne qui budgète ce compte, sinon elle reste « non affectée ».
Mêmes règles que web/src/donnees/api.ts (budgets). Registre S124-1 à S124-5, S125-1 à S125-9."""
from collections import defaultdict
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger


def entier(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return int(v) if isinstance(v, int) and not isinstance(v, bool) or (isinstance(v, str) and v.strip().isdigit()) else None


def plan(u, pid, nom="Budget") -> dict:
    p = une("select id, code, libelle, annee from budget_plan where id = %s and institution_id = %s and actif", (pid, u["institution_id"])) if pid else None
    if not p:
        raise ErreurMetier(f"À remplir : {nom}.")
    return p


def type_budget(u, tid) -> dict:
    t = une("select id, code, libelle, param_compte from budget_type where id = %s and institution_id = %s and actif", (tid, u["institution_id"])) if tid else None
    if not t:
        raise ErreurMetier("À remplir : Type budget.")
    return t


def periode(u, pid) -> dict:
    p = une("select id, code, libelle, debut, fin from budget_periode where id = %s and institution_id = %s and actif", (pid, u["institution_id"])) if pid else None
    if not p:
        raise ErreurMetier("À remplir : Période.")
    return p


def dates(p: dict, annee: int) -> tuple[date, date]:
    """Dates d'une période (JJ/MM) dans l'année du plan ; le 29/02 d'une année non bissextile devient le 28"""
    def d(t):
        j, m = int(t[:2]), int(t[3:])
        try:
            return date(annee, m, j)
        except ValueError:
            return date(annee, m, 28)
    return d(p["debut"]), d(p["fin"])


def permis(param: str, compte: str) -> bool:
    """Param Compte (S19, p. 28) : « 6*,712* » ; vide : tous les comptes"""
    motifs = [x.strip() for x in (param or "").split(",") if x.strip()]
    return not motifs or any(compte.startswith(x[:-1]) if x.endswith("*") else compte == x for x in motifs)


def comptes_du_type(u, tid: int) -> list[dict]:
    exiger(u)
    t = type_budget(u, tid)
    return [c for c in lignes("""select numero, libelle from compte where (institution_id is null or institution_id = %s) and saisissable and ouvert
                                 order by numero""", (u["institution_id"],)) if permis(t["param_compte"], c["numero"])]


def contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"plans": lignes("select id, code, libelle, annee from budget_plan where institution_id = %s and actif order by annee desc, code", (i,)),
            "types": lignes("""select id, code, libelle, param_compte as "paramCompte" from budget_type where institution_id = %s and actif order by code""", (i,)),
            "periodes": lignes("select id, code, libelle, debut, fin from budget_periode where institution_id = %s and actif order by debut, fin, code", (i,)),
            "lignes": lignes("""select l.id, l.numero, l.libelle, l.plan_id as "planId", l.centre_id as "centreId", c.libelle as centre, coalesce(b.nom, '') as financement
                                from budget_ligne l join budget_centre c on c.id = l.centre_id left join bailleur b on b.id = l.bailleur_id
                                where l.institution_id = %s and l.actif order by l.numero""", (i,)),
            "centres": lignes("select id, code, libelle from budget_centre where institution_id = %s and actif order by code", (i,)),
            "exercices": [r["annee"] for r in lignes("select annee from exercice where institution_id = %s order by annee desc", (i,))],
            "exerciceCourant": valeur("select annee from exercice where institution_id = %s and actif", (i,))}      # exercice en cours (S11-1)


REQUETE = """select v.id, v.plan_id as "planId", v.type_id as "typeId", v.periode_id as "periodeId", v.ligne_id as "ligneId", v.compte, v.valeur,
                    l.numero, l.libelle as ligne, l.centre_id as "centreId", ce.libelle as centre, coalesce(b.nom, '') as financement, l.bailleur_id as "bailleurId",
                    t.libelle as type, pe.libelle as periode, pe.debut, pe.fin,
                    (select co.libelle from compte co where co.numero = v.compte and (co.institution_id is null or co.institution_id = v.institution_id)
                     order by co.institution_id nulls last limit 1) as intitule
             from budget_valeur v join budget_ligne l on l.id = v.ligne_id join budget_centre ce on ce.id = l.centre_id left join bailleur b on b.id = l.bailleur_id
             join budget_type t on t.id = v.type_id join budget_periode pe on pe.id = v.periode_id
             where v.institution_id = %s and v.actif and v.plan_id = %s"""


def valeurs(u, p: dict) -> dict:
    """Détails (plan, type et période) ou Afficher tout (le plan entier)"""
    exiger(u)
    pl = plan(u, entier(p, "planId"))
    if str(p.get("tout")) in ("1", "true", "True"):
        rows = lignes(REQUETE + " order by t.code, pe.debut, l.numero, v.compte", (u["institution_id"], pl["id"]))
    elif str(p.get("global")) in ("1", "true", "True"):
        pe = periode(u, entier(p, "periodeId"))
        rows = lignes(REQUETE + " and v.periode_id = %s order by t.code, l.numero, v.compte", (u["institution_id"], pl["id"], pe["id"]))
    else:
        t, pe = type_budget(u, entier(p, "typeId")), periode(u, entier(p, "periodeId"))
        rows = lignes(REQUETE + " and v.type_id = %s and v.periode_id = %s order by l.numero, v.compte", (u["institution_id"], pl["id"], t["id"], pe["id"]))
    return {"budget": pl, "lignes": rows, "total": sum(r["valeur"] for r in rows)}


def ajouter(u, d) -> dict:
    """Bouton Ajouter : une valeur pour une ligne budgétaire et un compte ; le compte suit le Param Compte du type de budget"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    pl, t, pe = plan(u, entier(d, "planId")), type_budget(u, entier(d, "typeId")), periode(u, entier(d, "periodeId"))
    lg = une("select id, plan_id from budget_ligne where id = %s and institution_id = %s and actif", (entier(d, "ligneId"), u["institution_id"]))
    if not lg:
        raise ErreurMetier("À remplir : Ligne budgétaire.")
    if lg["plan_id"] != pl["id"]:
        raise ErreurMetier("Ligne budgétaire : une ligne de ce budget (Info de base > Budget > Ligne de plan budgétaire).")
    compte = str(d.get("compte") or "").strip()
    c = une("select saisissable, ouvert from compte where numero = %s and (institution_id is null or institution_id = %s)", (compte, u["institution_id"])) if compte else None
    if not c:
        raise ErreurMetier("À remplir : Compte.")
    if not permis(t["param_compte"], compte):
        raise ErreurMetier(f"Compte : {compte} n'est pas un compte du type de budget « {t['libelle']} » ({t['param_compte']}).")
    v = entier(d, "valeur")
    if v is None or v <= 0:
        raise ErreurMetier("À remplir : Valeur.")
    if une("select 1 from budget_valeur where actif and plan_id = %s and type_id = %s and periode_id = %s and ligne_id = %s and compte = %s",
           (pl["id"], t["id"], pe["id"], lg["id"], compte)):
        raise ErreurMetier("Cette ligne budgétaire a déjà une valeur pour ce compte : la choisir dans la liste puis Modifier.")
    executer("""insert into budget_valeur (institution_id, plan_id, type_id, periode_id, ligne_id, compte, valeur, saisi_par) values (%s, %s, %s, %s, %s, %s, %s, %s)""",
             (u["institution_id"], pl["id"], t["id"], pe["id"], lg["id"], compte, v, u["id"]))
    return valeurs(u, {"planId": pl["id"], "typeId": t["id"], "periodeId": pe["id"]})


def modifier(u, vid: int, d) -> dict:
    """Bouton Modifier : la valeur de la ligne choisie"""
    exiger(u)
    x = une("select * from budget_valeur where id = %s and institution_id = %s and actif for update", (vid, u["institution_id"]))
    if not x:
        raise ErreurMetier("Ligne introuvable.")
    v = entier(d, "valeur")
    if v is None or v <= 0:
        raise ErreurMetier("À remplir : Valeur.")
    executer("update budget_valeur set valeur = %s, saisi_par = %s, saisi_le = now() where id = %s", (v, u["id"], vid))
    return valeurs(u, {"planId": x["plan_id"], "typeId": x["type_id"], "periodeId": x["periode_id"]})


def supprimer(u, d) -> dict:
    """Bouton Supprimer : « pour supprimer le budget » (p. 143) : les valeurs du budget, du type et de la période choisis"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    pl, t, pe = plan(u, entier(d, "planId")), type_budget(u, entier(d, "typeId")), periode(u, entier(d, "periodeId"))
    n = executer("update budget_valeur set actif = false where actif and plan_id = %s and type_id = %s and periode_id = %s", (pl["id"], t["id"], pe["id"]))
    if not n:
        raise ErreurMetier("Rien à supprimer : ce budget n'a aucune valeur pour ce type et cette période.")
    return valeurs(u, {"planId": pl["id"], "typeId": t["id"], "periodeId": pe["id"]})


def reconduire(u, d) -> dict:
    """« Reconduire ancien budget » : les lignes et les valeurs de l'ancien budget sont recopiées dans le nouveau, qui n'en a pas encore"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    ancien, nouveau = plan(u, entier(d, "ancienPlanId"), "Ancien budget"), plan(u, entier(d, "nouveauPlanId"), "Nouveau budget")
    if ancien["id"] == nouveau["id"]:
        raise ErreurMetier("Nouveau budget : un autre budget que l'ancien.")
    if une("select 1 from budget_valeur where plan_id = %s and actif limit 1", (nouveau["id"],)):
        raise ErreurMetier("Nouveau budget : ce budget a déjà des valeurs.")
    src = lignes("select * from budget_valeur where plan_id = %s and actif order by id", (ancien["id"],))
    if not src:
        raise ErreurMetier("Ancien budget : aucune valeur à reconduire.")
    corr = {}
    for lg in lignes("select * from budget_ligne where plan_id = %s and actif order by id", (ancien["id"],)):
        e = une("select id from budget_ligne where plan_id = %s and numero = %s and actif", (nouveau["id"], lg["numero"]))
        corr[lg["id"]] = e["id"] if e else une("""insert into budget_ligne (institution_id, numero, libelle, plan_id, centre_id, bailleur_id)
                                                  values (%s, %s, %s, %s, %s, %s) returning id""",
                                               (u["institution_id"], lg["numero"], lg["libelle"], nouveau["id"], lg["centre_id"], lg["bailleur_id"]))["id"]
    for v in src:
        executer("""insert into budget_valeur (institution_id, plan_id, type_id, periode_id, ligne_id, compte, valeur, saisi_par) values (%s, %s, %s, %s, %s, %s, %s, %s)""",
                 (u["institution_id"], nouveau["id"], v["type_id"], v["periode_id"], corr[v["ligne_id"]], v["compte"], v["valeur"], u["id"]))
    return valeurs(u, {"planId": nouveau["id"], "tout": "1"})


# ---------- Réalisé ----------
def realise(u, annee: int, du: date, au: date) -> list[dict]:
    """Mouvements définitifs de la période, par compte et ligne budgétaire : débit moins crédit, en CDF"""
    return lignes("""select c.numero as compte, l.budget_ligne_id as ligne, sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end)::bigint as s
                     from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id join compte c on c.id = l.compte_id
                     where e.institution_id = %s and jc.statut = 'fermee' and e.type <> 'vidage' and e.date_valeur between %s and %s
                     group by 1, 2""", (u["institution_id"], du, au))


def sens(compte: str, s: int) -> int:
    """Un produit (classe 7) se réalise au crédit ; le reste au débit"""
    return -s if compte.startswith("7") else s


def affecter(rows: list[dict], mouvements: list[dict]) -> tuple[dict, list[dict]]:
    """Réalisé de chaque valeur du budget et mouvements restés sans ligne. Le compte budgété peut être un compte de regroupement : le préfixe le plus
    long l'emporte."""
    fait: dict = defaultdict(int)
    reste: dict = defaultdict(int)
    for m in mouvements:
        cands = [r for r in rows if m["compte"].startswith(r["compte"])]
        if not cands:
            continue
        lg = max(len(r["compte"]) for r in cands)
        cands = [r for r in cands if len(r["compte"]) == lg]
        cible = next((r for r in cands if r["ligneId"] == m["ligne"]), None) if m["ligne"] else (cands[0] if len(cands) == 1 else None)
        if cible:
            fait[cible["id"]] += sens(m["compte"], int(m["s"]))
        else:
            reste[cands[0]["compte"]] += sens(m["compte"], int(m["s"]))
    return fait, [{"compte": k, "realise": v} for k, v in sorted(reste.items()) if v]


def suivi(u, p: dict) -> dict:
    """Suivi budgétaire : prévu, réalisé, écart et taux par ligne et compte ; boutons Financement (par bailleur) et Résultat analytique (par centre de coût)"""
    exiger(u)
    pl, pe = plan(u, entier(p, "planId")), periode(u, entier(p, "periodeId"))
    tid, cid = entier(p, "typeId"), entier(p, "centreId")
    du, au = dates(pe, pl["annee"])
    if p.get("dateFin"):
        try:
            fin = date.fromisoformat(p["dateFin"])
        except (TypeError, ValueError):
            raise ErreurMetier("Date fin : une date.")
        if not du <= fin <= au:
            raise ErreurMetier("Date fin : dans la période choisie.")
        au = fin
    rows = [r for r in lignes(REQUETE + " and v.periode_id = %s order by t.code, l.numero, v.compte", (u["institution_id"], pl["id"], pe["id"]))
            if (not tid or r["typeId"] == tid) and (not cid or r["centreId"] == cid)]
    fait, reste = affecter(rows, realise(u, pl["annee"], du, au))
    out = []
    for r in rows:
        f = fait.get(r["id"], 0)
        out.append({"type": r["type"], "numero": r["numero"], "ligne": r["ligne"], "centre": r["centre"], "financement": r["financement"], "compte": r["compte"],
                    "intitule": r["intitule"] or "", "prevu": r["valeur"], "realise": f, "ecart": r["valeur"] - f,
                    "taux": round(f * 10000 / r["valeur"]) / 100 if r["valeur"] else None})
    mode = p.get("mode") or "detail"
    if mode in ("financement", "analytique"):
        cle = "financement" if mode == "financement" else "centre"
        g: dict = defaultdict(lambda: {"prevu": 0, "realise": 0, "charges": 0, "produits": 0})
        for x in out:
            y = g[x[cle] or "Sans bailleur"]
            y["prevu"] += x["prevu"]
            y["realise"] += x["realise"]
            y["produits" if x["compte"].startswith("7") else "charges"] += x["realise"]
        groupes = [{"libelle": k, **v, "ecart": v["prevu"] - v["realise"], "resultat": v["produits"] - v["charges"]} for k, v in sorted(g.items())]
    else:
        groupes = []
    return {"budget": pl, "periode": pe["libelle"], "du": du.isoformat(), "au": au.isoformat(), "mode": mode, "lignes": out, "groupes": groupes, "nonAffectes": reste,
            "prevu": sum(x["prevu"] for x in out), "realise": sum(x["realise"] for x in out)}


def consommation(u, p: dict) -> dict:
    """Consommation par centre de coût : Exercice, Période, Ligne budgétaire, Centre de coût, Date fin ; prévu, consommé et disponible par centre et ligne"""
    exiger(u)
    ex = entier(p, "exercice")
    if not ex:
        raise ErreurMetier("À remplir : Exercice.")
    pe = periode(u, entier(p, "periodeId"))
    lid, cid = entier(p, "ligneId"), entier(p, "centreId")
    du, au = dates(pe, ex)
    if p.get("dateFin"):
        try:
            fin = date.fromisoformat(p["dateFin"])
        except (TypeError, ValueError):
            raise ErreurMetier("Date fin : une date.")
        if not du <= fin <= au:
            raise ErreurMetier("Date fin : dans la période choisie.")
        au = fin
    rows = []
    for pl in lignes("select id from budget_plan where institution_id = %s and actif and annee = %s", (u["institution_id"], ex)):
        rows += lignes(REQUETE + " and v.periode_id = %s order by ce.libelle, l.numero, v.compte", (u["institution_id"], pl["id"], pe["id"]))
    rows = [r for r in rows if (not lid or r["ligneId"] == lid) and (not cid or r["centreId"] == cid)]
    fait, _ = affecter(rows, realise(u, ex, du, au))
    g: dict = {}
    for r in rows:
        x = g.setdefault((r["centre"], r["numero"], r["ligne"]), {"centre": r["centre"], "numero": r["numero"], "ligne": r["ligne"], "prevu": 0, "consomme": 0})
        x["prevu"] += r["valeur"]
        x["consomme"] += fait.get(r["id"], 0)
    out = [{**x, "disponible": x["prevu"] - x["consomme"], "taux": round(x["consomme"] * 10000 / x["prevu"]) / 100 if x["prevu"] else None} for _, x in sorted(g.items())]
    return {"exercice": ex, "periode": pe["libelle"], "du": du.isoformat(), "au": au.isoformat(), "lignes": out,
            "prevu": sum(x["prevu"] for x in out), "consomme": sum(x["consomme"] for x in out)}
