#!/usr/bin/env python3
"""Écrit tokens.css à partir de tokens.json (clair) et tokens-sombre.json.

    python3 replica/design/generer.py

Les couleurs ne s'écrivent jamais à la main dans un composant : on change le
JSON, on relance ce script, puis le contrôle de contraste.
"""

import json
from pathlib import Path

ICI = Path(__file__).parent


def bloc(couleurs, retrait="  "):
    return "\n".join(f"{retrait}--{nom}: {val};" for nom, val in couleurs.items())


def main():
    clair = json.loads((ICI / "tokens.json").read_text(encoding="utf-8"))
    sombre = json.loads((ICI / "tokens-sombre.json").read_text(encoding="utf-8"))
    assert clair["color"].keys() == sombre["color"].keys(), "les deux thèmes doivent avoir les mêmes noms"

    lignes = ["/* Généré par generer.py depuis tokens.json et tokens-sombre.json. Ne pas modifier à la main. */", ""]
    lignes.append(":root {")
    lignes.append(bloc(clair["color"]))
    for nom, val in clair["font"].items():
        lignes.append(f"  --police-{nom}: {val};")
    for nom, t in clair["type"].items():
        lignes.append(f"  --taille-{nom}: {t['size']}px;")
        lignes.append(f"  --interligne-{nom}: {t['line']}px;")
        lignes.append(f"  --graisse-{nom}: {t['weight']};")
    for i, v in enumerate(clair["space"]):
        lignes.append(f"  --espace-{i}: {v}px;")
    for nom, v in clair["radius"].items():
        lignes.append(f"  --rayon-{nom}: {v}px;")
    for nom, v in clair["shadow"].items():
        lignes.append(f"  --ombre-{nom}: {v};")
    for nom, v in clair["motion"].items():
        if not nom.startswith("_"):
            lignes.append(f"  --mouvement-{nom}: {v};")
    lignes.append("  color-scheme: light;")
    lignes.append("}")
    lignes.append("")
    lignes.append("@media (prefers-color-scheme: dark) {")
    lignes.append("  :root:not([data-theme=\"light\"]) {")
    lignes.append(bloc(sombre["color"], "    "))
    lignes.append("    color-scheme: dark;")
    lignes.append("  }")
    lignes.append("}")
    lignes.append(":root[data-theme=\"dark\"] {")
    lignes.append(bloc(sombre["color"]))
    lignes.append("  color-scheme: dark;")
    lignes.append("}")
    lignes.append("")
    lignes.append("@media (prefers-reduced-motion: reduce) {")
    lignes.append("  :root { --mouvement-deroulant: 0ms; }")
    lignes.append("}")
    (ICI / "tokens.css").write_text("\n".join(lignes) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
