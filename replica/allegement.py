"""Produit la page « Allègement Exofina » : l'avancement du plan de la phase 2 (docs/architecture/PLAN-ALLEGEMENT.md).
    python replica/allegement.py <fichier de sortie>
L'état de chaque point est tenu dans replica/allegement.csv (statut : à faire, partiel, fait ; reste : ce qui manque).
Le texte de chaque point est lu dans le plan, pour que la page dise toujours la même chose que lui."""
import csv
import html
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent
PLAN = RACINE.parent / "docs" / "architecture" / "PLAN-ALLEGEMENT.md"
ETAT = {"fait": ("fait", "Fait"), "partiel": ("partiel", "Partiel"), "à faire": ("afaire", "À faire")}
e = html.escape

points = list(csv.DictReader(open(RACINE / "allegement.csv", encoding="utf-8")))
texte = PLAN.read_text(encoding="utf-8")
lots, corps = {}, {}
for m in re.finditer(r"^## Lot (\d+)\. (.+)$", texte, re.M):
    lots[m.group(1)] = m.group(2).strip()
for bloc in re.split(r"\n(?=## |\*\*\d+\.\d+ )", texte):
    m = re.match(r"\*\*(\d+\.\d+) .*?\*\*(.*)", bloc, re.S)
    if m:
        corps[m.group(1)] = m.group(2).strip()
questions = [l[2:] for l in texte.split("## Questions au porteur", 1)[1].split("\n## ", 1)[0].splitlines() if l.startswith("- ")]


def enligne(s):
    """Le peu de mise en forme du plan : gras, code, listes"""
    s = e(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
    out, liste = [], False
    for l in s.splitlines():
        l = l.strip()
        if not l:
            continue
        if re.match(r"^(- |\d+\. )", l):
            if not liste:
                out.append("<ul>"); liste = True
            out.append(f"<li>{re.sub(r'^(- |\d+\. )', '', l)}</li>")
        else:
            if liste:
                out.append("</ul>"); liste = False
            out.append(f"<p>{l}</p>")
    if liste:
        out.append("</ul>")
    return "".join(out)


tous = Counter(p["statut"] for p in points)
attente = sum(1 for p in points if p["question"] == "oui" and p["statut"] != "fait")


def reste(p):
    return f'<p class="n"><strong>Reste :</strong> {e(p["reste"])}</p>' if p["reste"] else ""


def section(lot, nom):
    l = [p for p in points if p["lot"] == lot]
    c = Counter(p["statut"] for p in l)
    lignes = "".join(
        f'<tr><td class="num">{e(p["id"])}</td><td class="f"><details><summary>{e(p["titre"])}'
        f'{" <span class=q>question au porteur</span>" if p["question"] == "oui" and p["statut"] != "fait" else ""}</summary>'
        f'<div class="d">{enligne(corps.get(p["id"], ""))}</div></details>'
        f'{reste(p)}</td>'
        f'<td class="et">{e(p["ecrans"])}</td><td><span class="e {ETAT[p["statut"]][0]}">{ETAT[p["statut"]][1]}</span></td></tr>' for p in l)
    return (f'<section><h2>Lot {lot}. {e(nom)} <span class="c">{len(l)} points · {c["fait"]} faits · {c["partiel"]} partiels · {c["à faire"]} à faire</span></h2>'
            f'<div class="t"><table><thead><tr><th>N°</th><th>Point</th><th>Écrans</th><th>État</th></tr></thead><tbody>{lignes}</tbody></table></div></section>')


STYLE = (RACINE / "travaux.css").read_text(encoding="utf-8") + """
td.num{white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--encre2)}
details summary{cursor:pointer;font-weight:600;list-style-position:outside}
details .d{margin-top:.4rem;font-weight:400;font-size:.92em;line-height:1.5}
details .d p{margin:.3rem 0} details .d ul{margin:.3rem 0 .3rem 1.2rem;padding:0}
span.q{display:inline-block;margin-left:.4rem;padding:0 .45rem;border-radius:.6rem;font-size:.78em;font-weight:600;border:1px solid currentColor;opacity:.8}
ol.qs{line-height:1.6;padding-left:1.2rem}
"""
page = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Allègement Exofina</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600;700&display=swap" rel="stylesheet">
<style>{STYLE}</style></head><body><main>
<header><h1>Allègement d'Exofina, lot par lot</h1><p class="intro">Phase 2 : alléger le logiciel, fusionner ce qui se répète, mettre chaque chose à sa place (demande du porteur, 22/11/2026).
Chaque point du plan, dans l'ordre de travail. Un clic sur un point montre ce qui change et le texte qui oblige à garder quelque chose.
« Fait » : appliqué, essayé et poussé. « Partiel » : commencé, ce qui manque est écrit sous le point. Rien ne commence avant l'accord du porteur.
Source : <code>docs/architecture/PLAN-ALLEGEMENT.md</code> et <code>replica/allegement.csv</code>, état au {date.today():%d/%m/%Y}.</p></header>
<dl class="bilan"><div><dt>Points</dt><dd>{len(points)}</dd></div><div><dt>Faits</dt><dd>{tous['fait']}</dd></div>
<div><dt>Partiels</dt><dd>{tous['partiel']}</dd></div><div><dt>À faire</dt><dd>{tous['à faire']}</dd></div><div><dt>Questions en attente</dt><dd>{attente}</dd></div></dl>
{"".join(section(k, v) for k, v in lots.items())}
<section><h2>Questions au porteur <span class="c">{len(questions)} questions, posées au début du lot concerné</span></h2>
<ol class="qs">{"".join(f"<li>{e(q)}</li>" for q in questions)}</ol></section>
</main></body></html>"""
Path(sys.argv[1]).write_text(page, encoding="utf-8")
print(f"{len(points)} points : {tous['fait']} faits, {tous['partiel']} partiels, {tous['à faire']} à faire ; {attente} attendent une réponse du porteur")
