"""Audit du 21/11/2026, point bloquant B13, suite (registre T226) : un portefeuille de crédits sur la base du jeu d'essai (jeu.py, puis essai.py).

Chaque crédit passe par le logiciel lui-même, de la demande au déblocage en caisse, avec les personnes que l'Instr. BCC 008, art. 66, sépare :
l'agent de crédit saisit, le responsable crédit vérifie, le chef d'agence décide et vise, le caissier débloque. Les agences travaillent en même
temps. Une part des crédits est ensuite mise en retard (dates d'échéance reculées en base), puis les lectures du crédit sont mesurées.
Tout est inventé : aucun nom, aucun numéro ne vient d'une institution réelle.

    BASE=http://127.0.0.1:8010 PG_BASE=likelemba_charge python outils/charge/credits.py [crédits par agence]

Le script sort avec le code 1 si une lecture dépasse 3 secondes."""
import http.cookiejar
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "likelemba.settings")
import django  # noqa: E402

django.setup()
from django.db import connection, transaction  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8010")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 500
JOUR = "2026-11-05"
PRET = 100000000                      # 1 000 000 CDF, en centimes
PRODUIT = {"typeProduit": "CNO", "numero": "L900", "nom": "Crédit commerce (essai en charge)", "devise": "CDF", "modeCalcul": "Dégressif", "typeInteret": "Fixe",
           "tauxInteret": "2,5", "tauxDiffere": 2, "montantMin": 100000, "montantMax": 5000000, "dureeMin": 3, "dureeMax": 12, "differeMin": 0, "differeMax": 2,
           "interetMin": 1, "interetMax": 4, "clientPhysique": True, "periodicite": "M", "modeDiffere": "Réparti", "paiementInteret": "Normal",
           "interetAnticipation": False, "ageMax": 65, "epargneNature": "Taux", "epargneValeur": 10, "categorie": "Prêt commercial", "penaliteRetard": 3,
           "penaliteAnticipation": 50, "frais": [{"typeFrais": "Frais de dossier", "nature": "Taux", "valeur": 1, "compte": "71520000"}]}
LIMITE_MS = 3000
ARRETS = ("saisie", "verifiee", "decidee", "visee")


def sql(requete, params=(), lire=True):
    with connection.cursor() as c:
        c.execute(requete, params)
        return c.fetchall() if lire else c.rowcount


class Poste:
    """Un poste de travail : sa session et ses appels"""

    def __init__(self, login):
        self.login = login
        self.o = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        code, r, _ = self.appel("POST", "/api/session", {"login": login})
        assert code == 200, (login, r)

    def appel(self, methode, chemin, corps=None):
        req = urllib.request.Request(BASE + chemin, method=methode, data=None if corps is None else json.dumps(corps).encode(),
                                     headers={"Content-Type": "application/json", "X-Likelemba": "1"})
        t = time.perf_counter()
        try:
            with self.o.open(req, timeout=300) as rep:
                code, texte = rep.status, rep.read()
        except urllib.error.HTTPError as e:
            code, texte = e.code, e.read()
        ms = (time.perf_counter() - t) * 1000
        try:
            r = json.loads(texte) if texte else None
        except ValueError:
            r = texte[:200]
        return code, r, ms

    def ok(self, methode, chemin, corps=None):
        code, r, _ = self.appel(methode, chemin, corps)
        if code != 200:
            raise RuntimeError(f"{self.login} {methode} {chemin} : {code} {r if not isinstance(r, dict) else r.get('message', r)}")
        return r


def agences():
    """Agences de l'essai, avec les identifiants des quatre postes et le guichet du caissier"""
    r = []
    for (aid, code) in sql("select id, code from agence where not supprime order by code"):
        k = int(code) - 411
        logins = {"chef": "jpmukendi", "agent": "bkasongo", "resp": "stshibanda", "caisse": "engalula", "compta": "plumbala"} if k == 1 else \
            {"chef": f"chef{k}", "agent": f"agent{k}", "resp": f"resp{k}", "caisse": f"caisse{k}a", "compta": f"compta{k}"}
        r.append({"id": aid, "code": code, "k": k, **logins})
    return r


def preparer(ags):
    """Un responsable crédit par agence (second agent de crédit : la vérification revient à une autre personne que la saisie)"""
    with transaction.atomic():
        sql("set local session_replication_role = replica", lire=False)
        for a in ags:
            if a["k"] == 1:
                continue
            sql("""insert into utilisateur (institution_id, agence_id, login, nom, mot_de_passe_hash)
                   select 1, %s, %s, %s, '!' where not exists (select 1 from utilisateur where login = %s)""", (a["id"], a["resp"], f"Responsable crédit Agence {a['k']}", a["resp"]), lire=False)
            sql("""insert into utilisateur_profil (utilisateur_id, profil_id) select u.id, p.id from utilisateur u, profil p
                   where u.login = %s and p.code = 'agent_credit' and p.institution_id = 1
                     and not exists (select 1 from utilisateur_profil x where x.utilisateur_id = u.id)""", (a["resp"],), lire=False)


def produit_et_fonds(chef: Poste) -> tuple[int, int]:
    pid = sql("select id from produit_credit where numero = %s", (PRODUIT["numero"],))
    if not pid:
        chef.ok("POST", "/api/produits-credit", PRODUIT)
        pid = sql("select id from produit_credit where numero = %s", (PRODUIT["numero"],))
    chef.ok("POST", "/api/credit/fonds-propres", {"dateArrete": "2026-10-31", "montant": 100000000000000})
    objet = sql("select id from credit_objet where libelle = 'Prêt commercial' order by id limit 1")[0][0]
    return pid[0][0], objet


def emprunteurs(agence_id: int, n: int) -> list[tuple[int, int, str]]:
    """Membres actifs de l'agence sans crédit, dont le compte en CDF couvre l'épargne obligatoire (10 % du prêt), avec une marge"""
    return sql("""select t.id, k.id, p.sexe from tiers t join tiers_personne p on p.tiers_id = t.id
                  join compte_depot k on k.tiers_id = t.id and k.devise = 'CDF' and k.statut = 'ouvert'
                  join (select contrat_ref, sum(case when sens = 'C' then montant_devise else -montant_devise end) as solde
                        from ligne_ecriture where contrat_ref like 'depot:%%' group by 1) b on b.contrat_ref = 'depot:' || k.id
                  where t.agence_id = %s and t.statut = 'actif' and t.type = 'physique' and b.solde >= %s
                    and not exists (select 1 from demande_credit d where d.tiers_id = t.id)
                  order by t.id limit %s""", (agence_id, PRET // 5, n))


def billets(stock: dict, montant: int) -> dict:
    cp, reste = {}, montant // 100
    for v in sorted(stock, key=int, reverse=True):
        x = min(stock[v], reste // int(v))
        if x:
            cp[v], reste = x, reste - x * int(v)
    if reste:
        raise RuntimeError("pas assez de coupures en caisse")
    return cp


def approvisionner(caisse: Poste, session: int, agence_id: int, besoin: int):
    """La caisse reçoit de quoi débloquer : des dépôts de 10 000 000 CDF, chacun d'un membre différent, loin du seuil d'examen renforcé
    (10 000 USD en espèces dans la journée : loi 22/068, art. 23 ; Instr. BCC 15, art. 61)"""
    depot = 1000000000
    stock = caisse.ok("GET", f"/api/caisses/{session}/theorique?devise=CDF")
    manque = besoin - sum(int(v) * 100 * n for v, n in stock.items())
    if manque <= 0:
        return
    deposants = sql("""select k.id from tiers t join compte_depot k on k.tiers_id = t.id and k.devise = 'CDF' and k.statut = 'ouvert'
                       where t.agence_id = %s and t.statut = 'actif' and not exists (select 1 from operation o where o.tiers_id = t.id and o.cree_le::date >= current_date - 1)
                       order by t.id desc limit %s""", (agence_id, 2 * (manque // depot) + 10))
    for (compte,) in deposants:
        if manque <= 0:
            break
        code, _, _ = caisse.appel("POST", "/api/guichet/depots", {"cle": str(uuid.uuid4()), "compteId": compte, "montant": depot, "coupures": {"20000": depot // 2000000},
                                                                 "mandataire": ""})
        manque -= depot if code == 200 else 0        # un dépôt refusé (seuil du jour atteint pour ce membre) se saute


def portefeuille_agence(a, pid, objet, lieu, resultat):
    postes = {r: Poste(a[r]) for r in ("chef", "agent", "resp", "caisse")}
    session = sql("""select s.id from session_caisse s join utilisateur u on u.id = s.caissier_id join journee_comptable j on j.id = s.journee_id
                     where u.login = %s and s.statut = 'ouverte' and j.date_comptable = %s""", (a["caisse"], JOUR))
    if not session:
        resultat[a["code"]] = (0, ["caisse fermée : lancer essai.py d'abord"]); return
    session = session[0][0]
    membres = emprunteurs(a["id"], N + len(ARRETS))
    try:
        approvisionner(postes["caisse"], session, a["id"], len(membres) * PRET)
    except Exception as x:
        resultat[a["code"]] = (0, [f"approvisionnement de la caisse : {x}"[:300]]); return
    faits, erreurs = 0, []
    for n, (tid, compte, sexe) in enumerate(membres, 1):
        arret = ARRETS[n - 1 - N] if n > N else ""        # les dernières demandes restent en file : saisie, vérifiée, décidée, visée
        h = sexe == "M"       # l'effectif de la demande reprend le sexe de la fiche
        e = {"nbHommes": int(h), "nbFemmes": int(not h), "montantHommes": PRET if h else 0, "montantFemmes": 0 if h else PRET, "nbGroupes": 0}
        try:
            d = postes["agent"].ok("POST", "/api/credit/dossiers", {"produitId": pid, "tiersId": tid, "duree": 12, **lieu, **e, "ressaisie": e, "consentementLe": "2026-11-01",
                                                                   "consentementRef": f"CR-{a['code']}-{n}", "objetId": objet, "compteEpargneId": compte})["id"]
            if arret == "saisie":
                continue
            postes["resp"].ok("POST", f"/api/credit/dossiers/{d}/controle", {"avis": "accepte", "montant": PRET, "consultationCrLe": JOUR, "consultationCrRef": f"CR-{a['code']}-{n}"})
            if arret == "verifiee":
                continue
            postes["chef"].ok("POST", f"/api/credit/dossiers/{d}/approbation", {"montantApprouve": PRET, "referencePv": f"PV-{a['code']}-{n}",
                                                                              "membres": [{"nom": x, "avis": "accepte"} for x in ("Mbala", "Ilunga", "Kabeya")]})
            cid = sql("select id from credit where demande_id = %s", (d,))[0][0]
            if arret == "decidee":
                continue
            postes["chef"].ok("POST", f"/api/credit/visas/{cid}/service_financier", {"avis": "accepte"})
            if arret == "visee":
                continue
            net = postes["caisse"].ok("GET", f"/api/credit/deblocage/{cid}")["retenues"]["net"]
            stock = postes["caisse"].ok("GET", f"/api/caisses/{session}/theorique?devise=CDF")
            postes["caisse"].ok("POST", f"/api/guichet/deblocage/{cid}", {"cle": str(uuid.uuid4()), "coupures": billets(stock, net)})
            faits += 1
        except Exception as x:                                   # un refus du logiciel se note et l'essai continue
            if len(erreurs) < 5:
                erreurs.append(str(x)[:300])
    resultat[a["code"]] = (faits, erreurs)


def retards():
    """Un crédit sur trois en retard : ses échéances reculent de un à sept mois, pour couvrir les classes de l'Instr. BCC 003"""
    with transaction.atomic():
        return sql("""update echeance e set date_due = (e.date_due - make_interval(months => (1 + (e.credit_id %% 7))::int))::date
                      from credit c join produit_credit p on p.id = c.produit_id
                      where c.id = e.credit_id and p.numero = %s and c.id %% 3 = 0 and e.date_due > %s::date""", (PRODUIT["numero"], JOUR), lire=False)


# Chaque lecture par un profil qui en a le droit au départ (noyau/droits.py)
LECTURES = [("Portefeuille de crédits", "chef", f"/api/credit/portefeuille?mode=periode&du=2026-01-01&au={JOUR}"),
            ("État des crédits", "chef", f"/api/credit/etat?mode=periode&du=2026-01-01&au={JOUR}"),
            ("Crédits en retard", "agent", "/api/credit/litigieux/retards"),
            ("Balance âgée (génération)", "agent", "POST /api/credit/balance-agee"),
            ("Provisions", "agent", f"/api/credit/provisions?date={JOUR}"),
            ("Rapport des garanties", "agent", f"/api/credit/garanties-rapport?type=caution&du=2026-01-01&au={JOUR}"),
            ("Centrale des risques", "chef", f"/api/conformite/centrale-risques?du=2026-01-01&au={JOUR}"),
            ("Demandes décidées", "agent", "/api/credit/dossiers?statut=mise_en_place"),
            ("Crédits visés", "chef", f"/api/credit/visas-historique?niveau=service_financier&avis=accepte&du=2026-01-01&au={JOUR}"),
            ("Indicateurs financiers", "compta", f"/api/comptabilite/indicateurs-financiers?exercice=2026&date={JOUR}"),
            *[(f"Rapport crédit : {nom}", "agent", f"/api/credit/rapports/{nom}?du=2026-01-01&au={JOUR}&date={JOUR}") for nom in
              ("journal", "base", "multicritere", "synthese", "taux", "previsionnel", "indicateurs")]]


def lectures(a, autres: list[str]):
    """Mesure chaque lecture, et vérifie qu'un utilisateur d'agence ne reçoit aucun membre d'une autre agence (registre T213)"""
    import re
    ailleurs = re.compile("(?:" + "|".join(autres) + r")-\d{6}") if autres else None
    postes, lent, fuites = {}, False, 0
    print("Lectures du crédit (agence " + a["code"] + ")", flush=True)
    for nom, role, chemin in LECTURES:
        if role not in postes:
            postes[role] = Poste(a[role])
        code, r, ms = postes[role].appel("POST", chemin[5:], {"date": JOUR}) if chemin.startswith("POST ") else postes[role].appel("GET", chemin)
        corps = json.dumps(r, ensure_ascii=False) if r is not None else ""
        fuite = len(set(ailleurs.findall(corps))) if ailleurs and code == 200 else 0
        note = ("" if code == 200 else f"  [{code} : {r.get('message', '') if isinstance(r, dict) else r}]") + (f"  FUITE : {fuite} membres d'autres agences" if fuite else "")
        print(f"  {nom:38s} {ms:8.0f} ms {len(corps) // 1024:7d} Ko{note}", flush=True)
        lent, fuites = lent or (code == 200 and ms > LIMITE_MS), fuites + bool(fuite)
    print(f"lectures qui montrent une autre agence : {fuites}", flush=True)
    return lent or bool(fuites)


def balayage(a, autres: list[str]):
    """Toutes les lectures du serveur qui se demandent sans identifiant, par quatre profils de la première agence : aucune ne doit rendre un numéro
    de membre, de compte ou de crédit d'une autre agence (registre T213). Une lecture qui exige des critères est essayée avec une période"""
    import re
    source = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "noyau", "api.py"), encoding="utf-8").read()
    chemins = sorted(set(re.findall(r'@api\.get\("(/[^"{}]*)"', source)))
    ailleurs = re.compile("(?:" + "|".join(autres) + r")[-/](?:L\d+/)?\d{5,6}")
    periode = f"du=2026-01-01&au={JOUR}&date={JOUR}&mode=periode&exercice=2026"
    postes = {r: Poste(a[r]) for r in ("chef", "agent", "compta", "caisse")}
    fuites, lentes, essais = {}, {}, 0
    for chemin in chemins:
        for role, p in postes.items():
            for url in (f"/api{chemin}", f"/api{chemin}?{periode}"):
                code, r, ms = p.appel("GET", url)
                essais += 1
                if code != 200:
                    continue
                n = len(set(ailleurs.findall(json.dumps(r, ensure_ascii=False))))
                if n:
                    fuites.setdefault(chemin, {})[role] = n
                if ms > LIMITE_MS:
                    lentes[chemin] = max(ms, lentes.get(chemin, 0))
    print(f"Balayage : {len(chemins)} lectures, {essais} appels", flush=True)
    for chemin, par in sorted(fuites.items()):
        print(f"  FUITE {chemin} : " + ", ".join(f"{r} {n}" for r, n in par.items()), flush=True)
    for chemin, ms in sorted(lentes.items()):
        print(f"  LENTE {chemin} : {ms:.0f} ms", flush=True)
    print(f"lectures qui montrent une autre agence : {len(fuites)} ; lectures de plus de 3 secondes : {len(lentes)}", flush=True)
    return bool(fuites or lentes)


def main():
    ags = agences()
    preparer(ags)
    chef1 = Poste(ags[0]["chef"])
    pid, objet = produit_et_fonds(chef1)
    ctx = Poste(ags[0]["agent"]).ok("GET", "/api/credit/dossiers/contexte")
    pr = next(x for x in ctx["provinces"] if x["nom"] == "Kinshasa")["id"]
    lieu = {"provinceId": pr, "villeId": next(x for x in ctx["villes"] if x["provinceId"] == pr)["id"]}
    avant = sql("select count(*) from credit")[0][0]
    if N > 0:
        t0, resultat = time.time(), {}
        fils = [threading.Thread(target=portefeuille_agence, args=(a, pid, objet, lieu, resultat)) for a in ags]
        [f.start() for f in fils]; [f.join() for f in fils]
        duree = time.time() - t0
        for code, (faits, erreurs) in sorted(resultat.items()):
            print(f"Agence {code} : {faits} crédits débloqués" + "".join(f"\n    refus : {e}" for e in erreurs), flush=True)
        total = sum(f for f, _ in resultat.values())
        print(f"{total} crédits en {duree:.0f} s ({total / max(duree, 1):.1f} par seconde) ; {retards()} échéances reculées", flush=True)
    n, ech = sql("select count(*) from credit")[0][0], sql("select count(*) from echeance")[0][0]
    desequilibre = sql("select count(*) from (select ecriture_id from ligne_ecriture group by 1 having sum(case when sens = 'D' then montant_cdf else -montant_cdf end) <> 0) x")[0][0]
    print(f"Base : {n} crédits ({n - avant} nouveaux), {ech} échéances ; écritures déséquilibrées : {desequilibre}", flush=True)
    autres = [a["code"] for a in ags[1:]]
    mauvais = lectures(ags[0], autres)
    mauvais = balayage(ags[0], autres) or mauvais
    sys.exit(1 if mauvais or desequilibre else 0)


if __name__ == "__main__":
    main()
