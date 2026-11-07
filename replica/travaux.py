"""Produit la page « Travaux de Likelemba » à partir de replica/features.csv.
    python replica/travaux.py <fichier de sortie>
La page est publiée en artefact après chaque fonction construite."""
import csv
import html
import sys
from collections import Counter
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent
MODULES = [("clients", "Client"), ("banque", "Banque"), ("épargne", "Épargne"), ("caisse", "Caisse"), ("crédit", "Crédit"), ("comptabilité", "Comptabilité"),
           ("budget", "Budget"), ("autres", "Autres"), ("paramétrage", "Paramétrage"), ("administration", "Administration"), ("paie", "Paie"),
           ("immobilisations", "Immobilisations"), ("général", "Général"), ("modules", "Modules")]
PRIORITE = {"must": "Indispensable", "should": "Utile", "could": "Plus tard", "skip": "Non repris"}
ETAT = {"yes": ("fait", "Fait"), "partial": ("partiel", "Partiel"), "no": ("afaire", "À faire"), "skip": ("nonrepris", "Non repris")}
VALIDES = {"clients": "validé par le porteur le 07/11/2026"}

lignes = list(csv.DictReader(open(RACINE / "features.csv", encoding="utf-8")))
compte = Counter(l["clone"] for l in lignes)
ind = Counter(l["clone"] for l in lignes if l["priority"] == "must")
e = html.escape

def section(code, nom):
    l = [x for x in lignes if x["area"] == code]
    c = Counter(x["clone"] for x in l)
    val = f" · <strong>{VALIDES[code]}</strong>" if code in VALIDES else ""
    corps = "".join(
        f'<tr><td class="f">{e(x["feature"])}<p class="n">{e(x["notes"])}</p></td><td>{PRIORITE.get(x["priority"], x["priority"])}</td>'
        f'<td><span class="e {ETAT[x["clone"]][0]}">{ETAT[x["clone"]][1]}</span></td></tr>' for x in l)
    return (f'<section><h2>{nom} <span class="c">{len(l)} fonctions · {c["yes"]} faites · {c["partial"]} partielles · {c["no"]} à faire{val}</span></h2>'
            f'<div class="t"><table><thead><tr><th>Fonction</th><th>Priorité</th><th>État</th></tr></thead><tbody>{corps}</tbody></table></div></section>')

STYLE = (RACINE / "travaux.css").read_text(encoding="utf-8")
page = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Travaux Likelemba</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600;700&display=swap" rel="stylesheet">
<style>{STYLE}</style></head><body><main>
<header><h1>Travaux de Likelemba, par module</h1><p class="intro">Toutes les fonctions relevées dans le manuel de Microfina++, rangées par module dans l'ordre de ses menus.
Phase 1 : reproduire exactement Microfina++ ; « partiel » veut dire construit, avec des points à confirmer. Source : <code>replica/features.csv</code>, état au {date.today():%d/%m/%Y}.</p></header>
<dl class="bilan"><div><dt>Fonctions</dt><dd>{len(lignes)}</dd></div><div><dt>Indispensables</dt><dd>{sum(ind.values())}</dd></div><div><dt>Faites</dt><dd>{compte['yes']}</dd></div>
<div><dt>Partielles</dt><dd>{compte['partial']}</dd></div><div><dt>À faire</dt><dd>{compte['no']}</dd></div><div><dt>Non reprises</dt><dd>{compte['skip']}</dd></div></dl>
{"".join(section(c, n) for c, n in MODULES)}
<p class="src">Indispensables : {ind['yes']} faites, {ind['partial']} partielles, {ind['no']} à faire. Le plan par étapes est dans <code>docs/plan-des-travaux.md</code> ; le journal dans <code>replica/build-log.md</code>.</p>
</main></body></html>"""
Path(sys.argv[1]).write_text(page, encoding="utf-8")
print(f"{len(lignes)} fonctions : {compte['yes']} faites, {compte['partial']} partielles, {compte['no']} à faire, {compte['skip']} non reprises")
