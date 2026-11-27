"""Le manuel n'oublie rien : chaque écran construit du registre a une capture demandée (fichier qui commence par son id) ou est nommé
dans un titre de section ; liste aussi les captures demandées en double et les titres d'écran sans capture.
Usage : python3 exhaustif.py <racine du dépôt>"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

R = Path(sys.argv[1])
chap = R / "docs" / "manuel" / "chapitres"
reg = json.loads((R / "web" / "src" / "ecrans" / "registre.json").read_text(encoding="utf-8"))
atlas = {x["id"]: x["construit"] for x in csv.DictReader(open(R / "replica" / "atlas.csv", encoding="utf-8"))}
plat = lambda t: unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
textes = {f.name: f.read_text(encoding="utf-8") for f in sorted(chap.glob("[0-9][0-9]-*.md"))}
titres = plat("\n".join(l for t in textes.values() for l in t.splitlines() if l.startswith("#")))
tout = plat("\n".join(textes.values()))
captures = []
for f in sorted(chap.glob("[0-9][0-9]-captures.json")):
    try:
        captures += [x["fichier"] for x in json.loads(f.read_text(encoding="utf-8"))]
    except Exception as e:
        print("JSON illisible :", f.name, e)
ids_cap = {re.split(r"[-.]", c)[0].upper() for c in captures}
manque = []
for x in reg:
    if atlas.get(x["id"], "oui") != "oui":
        continue
    if x["id"].upper() in ids_cap or plat(x["nom"]) in titres:
        continue
    if plat(x["nom"]) in tout:
        manque.append(f"{x['id']} {x['nom']} : cité dans le texte, sans section ni capture")
    else:
        manque.append(f"{x['id']} {x['nom']} : absent")
doubles = sorted({c for c in captures if captures.count(c) > 1})
print(f"{len(textes)} chapitres, {len(captures)} captures demandées")
print("Écrans à reprendre :", len(manque))
for m in manque:
    print("  ", m)
if doubles:
    print("Captures en double :", ", ".join(doubles))
images = set(re.findall(r"\(captures/([^)\s]+)\)", "\n".join(textes.values())))
print("Images citées sans demande de capture :", sorted(images - set(captures))[:30])
