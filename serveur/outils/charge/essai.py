"""Audit du 21/11/2026, point bloquant B13 (constats F22 et F23 ; registre T226) : essai simultané, sur la base du jeu d'essai (jeu.py).

Le serveur tourne à part, comme en production (gunicorn, deux processus, huit fils). Le script ouvre la journée et les caisses de chaque agence,
puis fait travailler tous les caissiers en même temps par de vraies requêtes HTTP :
  1. charge : chaque caissier enchaîne des dépôts et des retraits sur les comptes de son agence ;
  2. concurrence : huit retraits partent au même instant sur un même compte qui n'en couvre que deux ;
  3. doublon : la même opération (même clé) est envoyée quatre fois au même instant.
À la fin il relit la base : écritures équilibrées, aucun solde négatif, autant d'opérations que de réponses acceptées.

    BASE=http://127.0.0.1:8010 PG_BASE=likelemba_charge python outils/charge/essai.py [opérations par caissier]"""
import http.cookiejar
import json
import os
import random
import statistics
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
from django.db import connection  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8010")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 150
JOUR = "2026-11-05"


def sql(requete, params=()):
    with connection.cursor() as c:
        c.execute(requete, params)
        return c.fetchall()


class Poste:
    """Un poste de travail : sa session, ses appels, leurs durées"""

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
            with self.o.open(req, timeout=120) as rep:
                code, texte = rep.status, rep.read()
        except urllib.error.HTTPError as e:
            code, texte = e.code, e.read()
        ms = (time.perf_counter() - t) * 1000
        try:
            return code, json.loads(texte) if texte else None, ms
        except ValueError:
            return code, {"message": texte[:200].decode("utf-8", "replace")}, ms


def preparer():
    """La journée de chaque agence et la caisse de chaque caissier"""
    caissiers = []
    for aid, code in sql("select id, code from agence where not supprime order by id"):
        chef = sql("""select u.login from utilisateur u join utilisateur_profil up on up.utilisateur_id = u.id join profil p on p.id = up.profil_id
                      where u.agence_id = %s and p.code = 'chef_agence' order by u.id limit 1""", (aid,))[0][0]
        if not sql("select 1 from journee_comptable where agence_id = %s and date_comptable = %s and statut = 'ouverte'", (aid, JOUR)):      # déjà ouverte : essai relancé
            c, r, _ = Poste(chef).appel("POST", "/api/journees", {"date": JOUR})
            assert c == 200, (chef, r)
        for login, gid in sql("""select u.login, a.guichet_id from affectation_guichet a join utilisateur u on u.id = a.utilisateur_id join guichet g on g.id = a.guichet_id
                                 where g.agence_id = %s and a.fin is null order by a.guichet_id""", (aid,)):
            p = Poste(login)
            if not sql("""select 1 from session_caisse s join journee_comptable j on j.id = s.journee_id
                          where s.guichet_id = %s and j.date_comptable = %s and s.statut = 'ouverte'""", (gid, JOUR)):
                c, r, _ = p.appel("POST", "/api/caisses", {"guichetId": gid})
                assert c == 200, (login, r)
            caissiers.append((p, aid))
    return caissiers


def charge(caissiers):
    """Tous les caissiers en même temps : trois dépôts de 10 000 CDF pour un retrait de 10 000 CDF, sur des comptes de leur agence pris au hasard"""
    resultats, verrou = [], threading.Lock()

    def travailler(poste, aid, graine):
        alea = random.Random(graine)
        comptes = [r[0] for r in sql("select id from compte_depot where agence_id = %s and devise = 'CDF' and statut = 'ouvert' and numero like '%%-1%%' order by id limit 4000", (aid,))]
        for i in range(N):
            retrait = i % 4 == 3
            corps = {"cle": str(uuid.uuid4()), "compteId": alea.choice(comptes), "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}
            code, r, ms = poste.appel("POST", "/api/guichet/retraits" if retrait else "/api/guichet/depots", corps)
            with verrou:
                resultats.append((code, ms, "" if code == 200 else str((r or {}).get("message", ""))[:90]))

    fils = [threading.Thread(target=travailler, args=(p, aid, k)) for k, (p, aid) in enumerate(caissiers)]
    t0 = time.perf_counter()
    for f in fils:
        f.start()
    for f in fils:
        f.join()
    duree = time.perf_counter() - t0
    ok = sorted(ms for code, ms, _ in resultats if code == 200)
    refus = {}
    for code, _, m in resultats:
        if code != 200:
            refus[(code, m)] = refus.get((code, m), 0) + 1
    return {"postes": len(caissiers), "operations": len(resultats), "acceptees": len(ok), "duree_s": round(duree, 1), "par_seconde": round(len(ok) / duree, 1),
            "mediane_ms": round(statistics.median(ok)) if ok else None, "p95_ms": round(ok[int(len(ok) * 0.95) - 1]) if ok else None, "max_ms": round(ok[-1]) if ok else None,
            "refus": {f"{c} {m}": n for (c, m), n in sorted(refus.items(), key=lambda x: -x[1])[:6]}}


def simultanes(postes, corps_de):
    """Les appels partent au même instant (barrière), un par fil"""
    barriere, sorties = threading.Barrier(len(postes)), []

    def partir(p, i):
        barriere.wait()
        sorties.append(p.appel("POST", *corps_de(i)))

    fils = [threading.Thread(target=partir, args=(p, i)) for i, p in enumerate(postes)]
    for f in fils:
        f.start()
    for f in fils:
        f.join()
    return sorties


def concurrence(caissiers):
    """Huit retraits au même instant sur un compte qui n'en couvre que deux : deux passent, six sont refusés, le solde ne passe jamais sous zéro"""
    aid = caissiers[-1][1]
    logins = [p.login for p, a in caissiers if a == aid]
    cid, solde = sql("""select c.id, sum(case l.sens when 'C' then l.montant_devise else -l.montant_devise end) from compte_depot c
                        join ligne_ecriture l on l.contrat_ref = 'depot:' || c.id where c.agence_id = %s and c.devise = 'CDF' group by c.id
                        having sum(case l.sens when 'C' then l.montant_devise else -l.montant_devise end) >= 2000000 order by c.id desc limit 1""", (aid,))[0]
    montant = (int(solde) * 2 // 5) // 1000000 * 1000000                    # deux retraits passent, pas trois ; en billets de 10 000 CDF
    postes = [Poste(logins[i % len(logins)]) for i in range(8)]
    sorties = simultanes(postes, lambda i: ("/api/guichet/retraits", {"cle": str(uuid.uuid4()), "compteId": cid, "montant": montant,
                                                                       "coupures": {"10000": montant // 1000000}, "mandataire": ""}))
    acceptes = sum(1 for c, _, _ in sorties if c == 200)
    apres = int(sql("select sum(case sens when 'C' then montant_devise else -montant_devise end) from ligne_ecriture where contrat_ref = %s", (f"depot:{cid}",))[0][0])
    return {"solde_avant": int(solde), "retrait": montant, "envoyes": 8, "acceptes": acceptes, "solde_apres": apres,
            "juste": acceptes == int(solde) // montant and apres == int(solde) - acceptes * montant and apres >= 0,
            "refus": sorted({str((r or {}).get("message", ""))[:80] for c, r, _ in sorties if c != 200})}


def doublon(caissiers):
    """La même opération envoyée quatre fois au même instant (clé unique) : une seule écriture"""
    p0, aid = caissiers[0]
    cid = sql("select id from compte_depot where agence_id = %s and devise = 'CDF' and statut = 'ouvert' order by id desc limit 1", (aid,))[0][0]
    cle = str(uuid.uuid4())
    sorties = simultanes([Poste(p0.login) for _ in range(4)], lambda i: ("/api/guichet/depots", {"cle": cle, "compteId": cid, "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}))
    n = sql("select count(*) from operation where cle_idempotence = %s", (cle,))[0][0]
    # le poste (http.ts) renvoie une fois l'opération refusée en 409 : elle rend alors le résultat de celle qui est passée
    rejoues = [Poste(p0.login).appel("POST", "/api/guichet/depots", {"cle": cle, "compteId": cid, "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""})[0]
               for c, _, _ in sorties if c == 409]
    n2 = sql("select count(*) from operation where cle_idempotence = %s", (cle,))[0][0]
    return {"envoyes": 4, "reponses": sorted(c for c, _, _ in sorties), "renvois": rejoues, "operations_en_base": n2,
            "juste": n == 1 and n2 == 1 and all(c in (200, 409) for c, _, _ in sorties) and all(c == 200 for c in rejoues)}


def verifier(avant):
    deseq = sql("""select count(*) from (select l.ecriture_id from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable j on j.id = e.journee_id
                   where j.date_comptable = %s group by l.ecriture_id having sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) <> 0) x""", (JOUR,))[0][0]
    negatifs = sql("""select count(*) from (select contrat_ref from ligne_ecriture where contrat_ref like 'depot:%%' group by contrat_ref
                      having sum(case sens when 'C' then montant_devise else -montant_devise end) < 0) x""")[0][0]
    ops = sql("select count(*) from operation o join journee_comptable j on j.id = o.journee_id where j.date_comptable = %s", (JOUR,))[0][0]
    return {"ecritures_desequilibrees": deseq, "soldes_negatifs": negatifs, "operations_du_jour": ops - avant}


if __name__ == "__main__":
    avant = sql("select count(*) from operation o join journee_comptable j on j.id = o.journee_id where j.date_comptable = %s", (JOUR,))[0][0]
    caissiers = preparer()
    resultat = {"charge": charge(caissiers), "concurrence": concurrence(caissiers), "doublon": doublon(caissiers)}
    resultat["base"] = verifier(avant)
    print(json.dumps(resultat, ensure_ascii=False, indent=1))
