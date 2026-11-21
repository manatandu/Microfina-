"""Écart E09 (docs/reglementaire/ECARTS-2026-11-15.md) : opérations atypiques. Instr. BCC 15, art. 30 et 31 (surveillance constante de tous les comptes,
adaptée au niveau de risque), art. 34 (critères écrits), art. 36 (couvrir tous les comptes ; critères fixés par l'institution ; rapports écrits ;
déclaration rapide, à la CENAREF en cas de soupçon). Mêmes règles que web/src/donnees/api.ts (atypiques)."""
import re
from collections import defaultdict

from .bd import ErreurMetier, executer, lignes, une
from .conformite import _jour
from .services import en_usd, exiger, nom_utilisateur, titulaire

CRITERES = (("montantUsd", "critere_montant_usd"), ("montantEleveUsd", "critere_montant_eleve_usd"), ("nombreJour", "critere_nombre_jour"), ("reveilMois", "critere_reveil_mois"),
            ("fractionnementUsd", "critere_fractionnement_usd"))   # P7 : fractionnement (confrontation du 21/11/2026)


def _nombre(v) -> float | None:
    return None if v is None else float(v)


def criteres(u: dict) -> dict:
    exiger(u)
    i = une("select " + ", ".join(c for _, c in CRITERES) + " from institution where id = %s", (u["institution_id"],))
    return {k: _nombre(i[c]) for k, c in CRITERES}


def fixer_criteres(u: dict, d: dict) -> dict:
    exiger(u)
    d = d if isinstance(d, dict) else {}
    vals = {}
    for k, c in CRITERES:
        v = d.get(k)
        if v in (None, ""):
            vals[c] = None
            continue
        try:
            n = float(v)
        except (TypeError, ValueError):
            raise ErreurMetier("Critère : nombre invalide.")
        entier = k in ("nombreJour", "reveilMois")
        if n <= 0 or (entier and n != int(n)) or (k == "nombreJour" and n < 2):
            raise ErreurMetier("Critère : nombre invalide (montant positif ; au moins 2 mouvements ; mois entier positif).")
        vals[c] = int(n) if entier else round(n, 2)
    executer("update institution set " + ", ".join(f"{c} = %s" for c in vals) + " where id = %s", (*vals.values(), u["institution_id"]))
    return criteres(u)


def _usd(v: float) -> str:
    return f"{v:,.2f}".replace(",", " ").replace(".", ",") + " USD"


def _ajouter_mois(d, n: int):
    """Comme Postgres : le jour est ramené au dernier du mois s'il n'existe pas"""
    import calendar
    t = d.month - 1 + n
    an, mois = d.year + t // 12, t % 12 + 1
    return d.replace(year=an, month=mois, day=min(d.day, calendar.monthrange(an, mois)[1]))


def alertes(u: dict, du: str, au: str, statut: str = "a_analyser") -> list[dict]:
    """Chaque mouvement d'un compte de dépôt entre du et au, confronté aux critères ; une alerte par mouvement, avec tous ses critères"""
    exiger(u)
    for x in (du, au):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", x or ""):
            raise ErreurMetier("À remplir : période.")
    c = criteres(u)
    if all(v is None for v in c.values()):
        return []
    # P7 : tous les comptes et opérations des clients (Instr. BCC 15, art. 36) : comptes de dépôt, crédits (déblocage et remboursements) et parts sociales.
    # Les écritures des opérations diverses (provisions, intérêts courus) sont des écritures de l'institution, pas des opérations du client.
    mvts = lignes("""select l.ecriture_id, l.rang, l.sens, l.montant_devise as montant, trim(l.devise) as devise, j.date_comptable as date, e.libelle,
                            coalesce(p.numero, '') as piece, l.contrat_ref as compte_id, coalesce(cd.numero, 'Crédit ' || cr.numero, 'Parts sociales') as compte,
                            t.id as tiers_id, t.numero as membre
                     from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable j on j.id = e.journee_id
                     join journal jl on jl.id = e.journal_id and jl.type <> 'a_nouveaux'      -- la reprise des soldes n'est pas une opération (registre E09-4)
                     left join piece p on p.id = e.piece_id
                     left join compte_depot cd on l.contrat_ref = 'depot:' || cd.id
                     left join credit cr on l.contrat_ref = 'credit:' || cr.id and jl.type <> 'operations_diverses'
                     left join tiers tp on l.contrat_ref = 'parts:' || tp.id and jl.type <> 'operations_diverses'
                     join tiers t on t.id = coalesce(cd.tiers_id, cr.tiers_id, tp.id)
                     where e.institution_id = %s and j.date_comptable <= %s
                     order by l.contrat_ref, j.date_comptable, e.id, l.rang""", (u["institution_id"], au))
    eleves = {r["tiers_id"] for r in lignes("""select distinct on (tiers_id) tiers_id, niveau from profil_risque order by tiers_id, evalue_le desc, id desc""") if r["niveau"] == "eleve"}
    par_jour = defaultdict(int)
    fractions = defaultdict(lambda: [0.0, 0, True])    # (client, jour, sens) -> total USD, nombre, toutes sous le seuil
    for m in mvts:
        par_jour[(m["compte_id"], m["date"])] += 1
        if c["fractionnementUsd"] is not None:
            f = fractions[(m["tiers_id"], m["date"], m["sens"])]
            u_ = en_usd(m["montant"], m["devise"])
            f[0] += u_; f[1] += 1; f[2] = f[2] and u_ < c["fractionnementUsd"]
    analyses = {(a["ecriture_id"], a["rang"]): a for a in lignes("select * from analyse_atypique where institution_id = %s", (u["institution_id"],))}
    sortie, precedent = [], {}
    for m in mvts:
        avant = precedent.get(m["compte_id"])
        precedent[m["compte_id"]] = m["date"]
        if m["date"].isoformat() < du:
            continue
        usd, motifs = en_usd(m["montant"], m["devise"]), []
        if c["montantUsd"] is not None and usd >= c["montantUsd"]:
            motifs.append(f"Montant de {_usd(c['montantUsd'])} ou plus")
        if c["montantEleveUsd"] is not None and m["tiers_id"] in eleves and usd >= c["montantEleveUsd"]:
            motifs.append(f"Client à risque élevé : {_usd(c['montantEleveUsd'])} ou plus")
        if c["nombreJour"] is not None and par_jour[(m["compte_id"], m["date"])] >= c["nombreJour"]:
            motifs.append(f"{int(c['nombreJour'])} mouvements ou plus sur le compte dans la journée")
        if c["reveilMois"] is not None and avant and _ajouter_mois(avant, int(c["reveilMois"])) <= m["date"]:
            motifs.append(f"Compte sans mouvement depuis {int(c['reveilMois'])} mois ou plus")
        if c["fractionnementUsd"] is not None:
            tot, nb, sous = fractions[(m["tiers_id"], m["date"], m["sens"])]
            if nb >= 2 and sous and tot >= c["fractionnementUsd"]:
                motifs.append(f"Fractionnement : {nb} opérations du client dans la journée, chacune sous {_usd(c['fractionnementUsd'])}, {_usd(tot)} au total")
        if not motifs:
            continue
        a = analyses.get((m["ecriture_id"], m["rang"]))
        v = {"cle": f"{m['ecriture_id']}:{m['rang']}", "date": m["date"].isoformat(), "piece": m["piece"], "libelle": m["libelle"], "membre": m["membre"],
             "client": titulaire(m["tiers_id"]), "compte": m["compte"], "devise": m["devise"], "sens": m["sens"], "montant": m["montant"], "montantUsd": round(usd, 2),
             "criteres": a["criteres"].split("\n") if a else motifs, "statut": a["conclusion"] if a else "a_analyser", "analyse": a["justification"] if a else "",
             "analysePar": nom_utilisateur(a["analyse_par"]) if a else "", "analyseLe": a["analyse_le"].isoformat() if a else "",
             "declareLe": a["declare_le"].isoformat() if a and a["declare_le"] else "", "reference": (a["reference_cenaref"] or "") if a else ""}
        if statut == "" or v["statut"] == statut or (statut == "analysee" and v["statut"] != "a_analyser"):
            sortie.append(v)
    return sortie


def _alerte(u: dict, cle: str, jour: str) -> dict:
    m = re.match(r"^(\d+):(\d+)$", str(cle or ""))
    if not m:
        raise ErreurMetier("Alerte introuvable.")
    x = next((a for a in alertes(u, "1900-01-01", jour, "") if a["cle"] == cle), None)
    if not x:
        raise ErreurMetier("Alerte introuvable : le mouvement ne répond plus à aucun critère.")
    return x


def analyser(u: dict, d: dict) -> dict:
    """Art. 35 et 36 : justification économique, légitimité apparente ; la conclusion se garde avec les critères"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    jour = _jour(u)
    conclusion, analyse = str(d.get("conclusion") or ""), str(d.get("analyse") or "").strip()
    manque = [n for v, n in ((conclusion in ("justifiee", "atypique"), "Conclusion"), (analyse, "Analyse")) if not v]
    if manque:
        raise ErreurMetier("À remplir (Instr. BCC 15, art. 35 et 36) : " + ", ".join(manque) + ".")
    x = _alerte(u, d.get("cle"), jour)
    if x["statut"] != "a_analyser":
        raise ErreurMetier("Alerte déjà analysée.")
    e, r = (int(v) for v in x["cle"].split(":"))
    executer("""insert into analyse_atypique (institution_id, ecriture_id, rang, criteres, conclusion, justification, analyse_par, analyse_le)
                values (%s, %s, %s, %s, %s, %s, %s, %s)""", (u["institution_id"], e, r, "\n".join(x["criteres"]), conclusion, analyse, u["id"], jour))
    return _alerte(u, x["cle"], jour)


def declarer(u: dict, d: dict) -> dict:
    """Art. 36, 4e tiret : déclaration de soupçon à la CENAREF ; on note la date et la référence"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    jour = _jour(u)
    x = _alerte(u, d.get("cle"), jour)
    if x["statut"] != "atypique":
        raise ErreurMetier("Seule une opération conclue atypique se déclare.")
    if x["declareLe"]:
        raise ErreurMetier("Déclaration déjà notée.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_) or not ref:
        raise ErreurMetier("À remplir : date et référence de la déclaration à la CENAREF.")
    if date_ > jour:
        raise ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.")
    e, r = (int(v) for v in x["cle"].split(":"))
    executer("update analyse_atypique set declare_le = %s, reference_cenaref = %s where ecriture_id = %s and rang = %s", (date_, ref, e, r))
    return _alerte(u, x["cle"], jour)


def rapport(u: dict, du: str, au: str) -> dict:
    """Art. 36, 3e tiret : rapport écrit des opérations considérées atypiques après analyse, avec leurs critères"""
    from .releves import entete
    return {"entete": entete(u["institution_id"]), "du": du, "au": au, "operations": alertes(u, du, au, "atypique")}
