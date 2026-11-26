"""Audit du 21/11/2026, point bloquant B13 (constat F23 ; registre T226) : durée des grandes lectures sur la base du jeu d'essai (jeu.py).
Chaque lecture est faite par un vrai appel HTTP, avec le profil qui la tient ; le script rend la durée vue du poste, le temps en base et le nombre
de requêtes SQL (en-tête Server-Timing du serveur), et le poids de la réponse.

    BASE=http://127.0.0.1:8010 PG_BASE=likelemba_charge python outils/charge/lectures.py"""
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8010")
EX = "exercice=2026"
LECTURES = [
    ("plumbala", "Balance de l'exercice", f"/api/comptabilite/balance?du=2026-01-01&au=2026-11-04&{EX}&type=8"),
    ("plumbala", "Balance avec auxiliaires", f"/api/comptabilite/balance?du=2026-01-01&au=2026-11-04&{EX}&type=8&analytique=true"),
    ("plumbala", "Grand livre, un jour", f"/api/comptabilite/grand-livre?du=2026-11-03&au=2026-11-03&{EX}&type=global"),
    ("plumbala", "Grand livre, un mois, caisses", f"/api/comptabilite/grand-livre?du=2026-10-01&au=2026-10-31&{EX}&type=global&compte=57"),
    ("plumbala", "Grand livre, l'exercice entier", f"/api/comptabilite/grand-livre?du=2026-01-01&au=2026-11-04&{EX}&type=global"),
    ("plumbala", "Journaux comptables, un mois", f"/api/comptabilite/journaux-comptables?{EX}&mois=10"),
    ("plumbala", "Indicateurs financiers", f"/api/comptabilite/indicateurs-financiers?{EX}&mois=10"),
    ("plumbala", "Bilan", "/api/comptabilite/etats-financiers/bilan?du=2026-01-01&au=2026-11-04&exercice=2026"),
    ("jpmukendi", "Recherche d'un membre par nom", "/api/tiers?q=kabongo"),
    ("jpmukendi", "Recherche d'un membre par numéro", "/api/tiers?q=0412-100005"),
    ("jpmukendi", "Rapport des clients", "/api/rapports/clients"),
    ("jpmukendi", "Registre des membres", "/api/clients/registre-membres"),
    ("jpmukendi", "Centrale des incidents, à déclarer", "/api/conformite/cip?du=2026-01-01&au=2026-11-05&statut=a_declarer"),
    ("jpmukendi", "Rapport des transactions, un mois", "/api/rapports/transactions?du=2026-10-01&au=2026-10-31"),
    ("jpmukendi", "Journées", "/api/journees"),
    ("jpmukendi", "Comptes inactifs", "/api/epargne/inactifs"),
    ("jpmukendi", "Rapport épargne, comptes ouverts", "/api/epargne/rapports/comptes?du=2026-01-01&au=2026-11-05"),
    ("jpmukendi", "Rapport épargne, indicateurs", "/api/epargne/rapports/indicateurs?date=2026-11-04"),
    ("jpmukendi", "Rapport épargne, soldes sans détail", "/api/epargne/rapports/comptes?du=2026-01-01&au=2026-11-05&operations=false"),
    ("jpmukendi", "Rapport épargne, mouvements d'un mois", "/api/epargne/rapports/comptes?du=2026-10-01&au=2026-10-31"),
    ("jpmukendi", "Rapport épargne, inactivité", "/api/epargne/rapports/inactivite?date=2026-11-04&tous=true"),
    ("jpmukendi", "Rapport épargne, virements", "/api/epargne/rapports/virements?du=2026-01-01&au=2026-11-05"),
    ("jpmukendi", "Membres à viser", "/api/tiers/a-viser"),
    ("plumbala", "Grand livre, un jour, dépôts", f"/api/comptabilite/grand-livre?du=2026-11-03&au=2026-11-03&{EX}&type=global&compte=33"),
    ("engalula", "Journal de caisse, un jour", "/api/caisse/journal?guichetId=2&du=2026-11-05&au=2026-11-05"),
    ("engalula", "Relevé d'un compte, l'exercice", "/api/epargne/releve?compteId=100&du=2026-01-01&au=2026-11-05"),
]


def poste(login):
    o = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    o.open(urllib.request.Request(BASE + "/api/session", method="POST", data=json.dumps({"login": login}).encode(),
                                  headers={"Content-Type": "application/json", "X-Likelemba": "1"}), timeout=60).read()
    return o


if __name__ == "__main__":
    postes, lent, fuites = {}, 0, 0
    # Les utilisateurs de l'essai sont rattachés à la première agence (code 0412) : aucun numéro de membre d'une autre agence ne doit leur revenir (T213)
    AUTRE_AGENCE = re.compile(rb"041[3-9]-1\d{5}")
    print(f"{'lecture':42} {'poste':>9} {'base':>8} {'requêtes':>9} {'poids':>9}")
    for login, nom, chemin in LECTURES:
        o = postes.get(login) or postes.setdefault(login, poste(login))
        t = time.perf_counter()
        try:
            with o.open(urllib.request.Request(BASE + chemin), timeout=180) as r:
                corps, code, st = r.read(), r.status, r.headers.get("Server-Timing", "")
        except urllib.error.HTTPError as e:
            corps, code, st = e.read(), e.code, e.headers.get("Server-Timing", "")
        ms = (time.perf_counter() - t) * 1000
        bd, n = re.search(r"bd;dur=(\d+)", st), re.search(r'desc="(\d+) sql"', st)
        note = "" if code == 200 else f"  [{code}] {json.loads(corps).get('message', '')[:110] if corps[:1] == b'{' else ''}"
        lent += ms > 3000
        fuite = len(set(AUTRE_AGENCE.findall(corps)))
        fuites += bool(fuite)
        print(f"{nom:42} {ms:7.0f}ms {(bd.group(1) if bd else '?'):>6}ms {(n.group(1) if n else '?'):>9} {len(corps) / 1024:7.0f}Ko{note}"
              + (f"  FUITE : {fuite} membres d'autres agences" if fuite else ""))
    print(f"lectures de plus de 3 secondes : {lent} ; lectures qui montrent une autre agence : {fuites}")
    sys.exit(1 if lent or fuites else 0)
