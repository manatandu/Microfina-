#!/usr/bin/env python3
"""Contraste des paires de jetons (WCAG 2.2) : texte 4,5:1 (AA), contrôles et focus 3:1 (« ui »).
Lit tokens.json et tokens-sombre.json (couleurs en hexadécimal ou en oklch()), écrit contraste.txt.

    python3 replica/design/contraste.py
"""
import json
import math
import re
from pathlib import Path

ICI = Path(__file__).parent


def oklch_vers_rgb(l, c, h):
    a, b = c * math.cos(math.radians(h)), c * math.sin(math.radians(h))
    l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
    g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
    bb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_
    return [min(1, max(0, x)) for x in (r, g, bb)]   # linéaire


def lineaire(couleur: str):
    couleur = couleur.strip()
    m = re.fullmatch(r"oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)", couleur)
    if m:
        l = float(m.group(1)) / (100 if m.group(2) else 1)
        return oklch_vers_rgb(l, float(m.group(3)), float(m.group(4)))
    x = couleur.lstrip("#")
    return [((v / 255) / 12.92 if v / 255 <= 0.04045 else ((v / 255 + 0.055) / 1.055) ** 2.4) for v in (int(x[i:i + 2], 16) for i in (0, 2, 4))]


def luminance(couleur):
    r, g, b = lineaire(couleur)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def rapport(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def main():
    sortie, echecs = [], 0
    for titre, fichier in (("Thème clair", "tokens.json"), ("Thème sombre", "tokens-sombre.json")):
        t = json.loads((ICI / fichier).read_text(encoding="utf-8"))
        sortie.append(titre)
        for p in t["pairs"]:
            avant, fond, *genre = p
            if avant not in t["color"] or fond not in t["color"]:
                continue
            r = rapport(t["color"][avant], t["color"][fond])
            ui = bool(genre)
            ok = r >= (3 if ui else 4.5)
            echecs += not ok
            note = ("PASS" if ok else "ÉCHEC") if ui else ("AAA" if r >= 7 else "AA" if ok else "ÉCHEC")
            sortie.append(f"  {note:5} {r:6.2f}:1  {avant:24} on {fond:24}{' ui' if ui else ''}")
        sortie.append("")
    sortie.append(f"{echecs} échec(s)")
    (ICI / "contraste.txt").write_text("\n".join(sortie) + "\n", encoding="utf-8")
    print(f"{echecs} échec(s)")


if __name__ == "__main__":
    main()
