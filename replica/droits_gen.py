"""Génère web/src/donnees/droits.gen.ts depuis serveur/noyau/droits.py et web/src/donnees/http.ts (registre S04-3) :
pour chaque méthode d'écriture de la façade (objet.méthode), les écrans de sa route ; et les droits des profils de départ.
Les deux côtés appliquent ainsi la même table. Relancer après tout ajout de route : python3 replica/droits_gen.py"""
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE / "serveur"))
src = (RACINE / "serveur" / "noyau" / "droits.py").read_text(encoding="utf-8")
routes = [(re.compile(m), json.loads(e.replace("'", '"'))) for m, e in re.findall(r'\(r"([^"]+)", (\[[^\]]*\])\)', src)]
depart = json.loads(re.search(r"DROITS_DEPART = (\{.*\})\n", src).group(1))

http = (RACINE / "web" / "src" / "donnees" / "http.ts").read_text(encoding="utf-8")
table, objet = {}, None
lignes = http.splitlines()
for i, ligne in enumerate(lignes):
    if ligne.rstrip().endswith("=>") and i + 1 < len(lignes):
        ligne = ligne.rstrip() + " " + lignes[i + 1].strip()
    m = re.match(r"^    (\w+): \{", ligne)
    if m:
        objet = m.group(1)
        continue
    m = re.match(r"^      (\w+): \(.*?\) => (?:post|appel\(\"DELETE\",)\s*\(?(.+)$", ligne)
    if objet and m:
        meth, reste = m.groups()
        urls = re.findall(r'["`](/[^"`]*)["`]', reste)
        ecrans = set()
        for url in urls:
            chemin = re.sub(r"\$\{[^}]*\}", "12", url).split("?")[0]
            if chemin.startswith("/listes/"):
                ecrans |= {"S14", "S18"}
                continue
            for motif, e in routes:
                if motif.fullmatch(chemin):
                    ecrans |= set(e)
                    break
        if ecrans:
            table[f"{objet}.{meth}"] = sorted(ecrans)

sortie = RACINE / "web" / "src" / "donnees" / "droits.gen.ts"
sortie.write_text("// Généré par replica/droits_gen.py depuis serveur/noyau/droits.py et http.ts : ne pas modifier à la main (registre S04-3).\n"
                  f"export const DROITS_METHODES: Record<string, string[]> = {json.dumps(table, ensure_ascii=False, indent=0, sort_keys=True)};\n"
                  f"export const DROITS_DEPART: Record<string, string[]> = {json.dumps(depart, ensure_ascii=False)};\n", encoding="utf-8")
print(len(table), "méthodes d'écriture reliées à un écran")
