# Construit tous les SVG du logo Dwacfina « Partie double ». Usage : python construction.py <dossier> (fontTools, police Inter Display Bold).
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
OUT = sys.argv[1]
f = TTFont("/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
R, N, BL, NO = "#C91B2C", "#182232", "#FFFFFF", "#000000"
def r2(v): return f"{v:.2f}".rstrip("0").rstrip(".")

# ---- symbole : D de 176 sur 176 (40 à 216), arc légèrement débordant (rx 90) pour compenser la forme ronde ----
def d_maitre(dx=0, dy=0, k=1.0, inverse=False):
    t = 1 if inverse else 0          # inversé : vides élargis d'une unité (blanc sur fond sombre paraît plus gras)
    P = lambda x, y: f"{r2(dx + k * x)} {r2(dy + k * y)}"
    return (f"M{P(40,40)} H{r2(dx+k*128)} A{r2(k*90)} {r2(k*88)} 0 0 1 {P(128,216)} H{r2(dx+k*40)} Z "
            f"M{P(76-t,89-t)} H{r2(dx+k*(174+t))} V{r2(dy+k*(115+t))} H{r2(dx+k*(76-t))} Z "
            f"M{P(76-t,141-t)} H{r2(dx+k*(174+t))} V{r2(dy+k*(167+t))} H{r2(dx+k*(76-t))} Z")
# ---- coupe petites tailles (16 à 24 px) : grille de 16 unités = 1 px à 16 px ; barres et vide de 2 px ----
def d_petit():
    return ("M16 16 H128 A112 112 0 0 1 128 240 H16 Z "
            "M64 80 H176 V112 H64 Z M64 144 H176 V176 H64 Z")
def svg(w, h, body, titre="Dwacfina"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {r2(w)} {r2(h)}" role="img" aria-labelledby="t"><title id="t">{titre}</title>{body}</svg>\n'
def chemin(d, c): return f'<path fill="{c}" fill-rule="evenodd" d="{d}"/>'
def ecrire(n, s): open(f"{OUT}/{n}", "w").write(s)

# ---- mot « dwacfina » : hampe de d et f calée sur la hauteur du D ----
def bornes(txt, size, track):
    s = size / upm; x = 0; xs = []
    for ch in txt:
        g = cmap[ord(ch)]; bp = BoundsPen(gs); gs[g].draw(bp); xs.append((x, bp.bounds)); x += gs[g].width * s + track
    return xs, s
asc = BoundsPen(gs); gs[cmap[ord("d")]].draw(asc); ASC = asc.bounds[3]   # sommet de la hampe du d, en unités
xb = BoundsPen(gs); gs[cmap[ord("x")]].draw(xb); XH = xb.bounds[3]     # hauteur des lettres basses
def mot(x0, base, hauteur, c, track_em=-0.012, sur="asc"):
    size = hauteur * upm / (ASC if sur == "asc" else XH); s = size / upm; tr = track_em * size; x = x0; d = []
    for ch in "dwacfina":
        g = cmap[ord(ch)]; pen = SVGPathPen(gs); gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, base)))
        d.append(pen.getCommands()); x += gs[g].width * s + tr
    # largeur à l'encre : de la gauche du d à la droite du a
    bp = BoundsPen(gs); gs[cmap[ord("d")]].draw(bp); gauche = bp.bounds[0] * s
    bp2 = BoundsPen(gs); gs[cmap[ord("a")]].draw(bp2); droite = x - tr - gs[cmap[ord("a")]].width * s + bp2.bounds[2] * s
    return f'<path fill="{c}" d="{" ".join(d)}"/>', gauche, droite

# ---- logo en ligne : D de hauteur 176, mot de même hauteur (hampe = haut du D, ligne de base = bas du D) ----
ESP = 52   # espace entre symbole et mot : deux fois l'épaisseur d'une barre du signe égal (26)
def en_ligne(cs, cm, inverse=False):
    # les lettres basses ont exactement la hauteur du signe égal (de 89 à 167)
    p, g, dr = mot(40 + 178 + ESP, 167, 78, cm, sur="xh")
    return svg(dr + 40, 256, chemin(d_maitre(inverse=inverse), cs) + p)
def en_pile(cs, cm, inverse=False):
    hm = 96; p, g, dr = mot(0, 0, hm, cm); w = dr - g; W = max(w, 256) + 80
    sym = chemin(d_maitre(dx=(W - 256) / 2, inverse=inverse), cs)
    p, g, dr = mot((W - w) / 2 - g, 216 + 64 + hm, hm, cm)
    return svg(W, 216 + 64 + hm + 40, sym + p)
def mot_seul(c):
    _, g, _ = mot(0, 0, 176, c); p, g2, dr = mot(32 - g, 32 + 176, 176, c)   # encre à 32 de chaque bord ; pas de jambage
    return svg(dr + 32, 176 + 64, p)

variantes = {"couleur": (R, N, False), "blanc": (BL, BL, True), "noir": (NO, NO, False), "nuit": (N, N, False), "rouge-blanc": (R, BL, True)}
for nom, (cs, cm, inv) in variantes.items():
    ecrire(f"dwacfina-symbole-{nom}.svg", svg(256, 256, chemin(d_maitre(inverse=inv), cs)))
    ecrire(f"dwacfina-en-ligne-{nom}.svg", en_ligne(cs, cm, inv))
    ecrire(f"dwacfina-en-pile-{nom}.svg", en_pile(cs, cm, inv))
for nom, c in (("nuit", N), ("blanc", BL), ("noir", NO)):
    ecrire(f"dwacfina-mot-{nom}.svg", mot_seul(c))
for nom, c in (("rouge", R), ("noir", NO), ("blanc", BL)):
    ecrire(f"dwacfina-symbole-petit-{nom}.svg", svg(256, 256, chemin(d_petit(), c)))
# icônes : tuile nuit, D blanc ; tuile rouge, D blanc (coupe maîtresse réduite à 62 %)
def tuile(fond, c, petit=False):
    k = 0.62; dx = 128 - 128 * k + 3; dy = 128 - 128 * k
    d = d_petit() if petit else d_maitre(dx=dx, dy=dy, k=k, inverse=True)
    if petit:  # coupe petite, réduite dans la tuile
        k = 0.7; dx = dy = 128 - 128 * k
        d = (f"M{r2(dx+k*16)} {r2(dy+k*16)} H{r2(dx+k*128)} A{r2(k*112)} {r2(k*112)} 0 0 1 {r2(dx+k*128)} {r2(dy+k*240)} H{r2(dx+k*16)} Z "
             f"M{r2(dx+k*64)} {r2(dy+k*80)} H{r2(dx+k*176)} V{r2(dy+k*112)} H{r2(dx+k*64)} Z M{r2(dx+k*64)} {r2(dy+k*144)} H{r2(dx+k*176)} V{r2(dy+k*176)} H{r2(dx+k*64)} Z")
    return svg(256, 256, f'<rect width="256" height="256" rx="56" fill="{fond}"/>' + chemin(d, c))
ecrire("dwacfina-icone-nuit.svg", tuile(N, BL)); ecrire("dwacfina-icone-rouge.svg", tuile(R, BL))
ecrire("dwacfina-icone-petit-nuit.svg", tuile(N, BL, True))
print("ok")
