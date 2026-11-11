#!/usr/bin/env python3
"""Écrit src/ecrans/registre.json : les 140 écrans de replica/recon.md, leur chemin dans les menus de Microfina++
(pour reproduire la barre de menus), leur module et leur priorité.

    python3 scripts/registre.py
"""
import csv
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
MODULES = {
    "Administration": "administration", "Paramétrage": "parametrage", "Clients": "clients", "Banque": "banque",
    "Épargne": "epargne", "Caisse": "caisse", "Crédit": "credit", "Comptabilité": "comptabilite",
    "Budget et Autres": "budget", "Paie": "paie", "Immobilisations": "immobilisations",
}
ORDRE = {"must": 0, "should": 1, "could": 2, "skip": 3}


def main():
    recon = (RACINE / "replica/recon.md").read_text(encoding="utf-8")
    module, ecrans = None, []
    for ligne in recon.splitlines():
        m = re.match(r"### (.+?) \(p\.", ligne)
        if m:
            module = MODULES[m.group(1)]
            continue
        m = re.match(r"\| (S\d+[a-z]?) \| ([^|]+) \| ([^|]*) \| ([^|]*) \|", ligne)
        if m and module:
            ecrans.append({"id": m.group(1), "nom": m.group(2).strip(), "acces": m.group(3).strip(),
                           "but": m.group(4).strip(), "module": module})
    prio = {}
    for r in csv.DictReader((RACINE / "replica/features.csv").open(encoding="utf-8")):
        for s in re.findall(r"S\d+", r["original"] + " " + r["notes"] + " " + r["feature"]):
            if s not in prio or ORDRE[r["priority"]] < ORDRE[prio[s]]:
                prio[s] = r["priority"]
    for e in ecrans:
        e["priorite"] = prio.get(re.match(r"S\d+", e["id"]).group(0), "should")   # S11b, S11c : écrans de la fonction S11
        e["chemin"] = f"/{e['module']}/{e['id'].lower()}"
    assert len(ecrans) == 142, len(ecrans)   # 140 écrans de la recon, plus S11b et S11c (manuel p. 21)
    sortie = Path(__file__).resolve().parents[1] / "src/ecrans/registre.json"
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(ecrans, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(ecrans), "écrans")


if __name__ == "__main__":
    main()
