# Construit les SVG du logo Exofina. Usage : python construction.py <dossier> (fontTools ; police/Poppins-ExtraBold.ttf, la plus proche du mot DWAC).
# Symbole : un « e » taillé dans une pièce, fente et bouche ouverte vers l'extérieur (exo). Mot : « exo » en rouge, « fina » en Bleu Nuit sur papier clair, en blanc sur fond sombre.
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
ICI = os.path.dirname(os.path.abspath(__file__)); OUT = sys.argv[1]
f = TTFont(os.path.join(ICI, "police", "Poppins-ExtraBold.ttf")); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
R, N, BL, NO = "#C91B2C", "#182232", "#FFFFFF", "#000000"
def r2(v): return f"{v:.2f}".rstrip("0").rstrip(".")

# ---- symbole : un « e » taillé dans une pièce. Disque de 176 (x et y de 40 à 216), fente horizontale à mi-hauteur, bouche ouverte en bas à droite
# (de l'horizontale à OUV degrés) : la pièce qui s'ouvre vers l'extérieur. Inspiré de DWAC sans le reprendre : rouge, rond, coupes droites. ----
H = 176; LARG = 176; RAY = 88; FENTE = 11; OUV = 38
def symbole(dx=40, dy=40, k=1.0, fente=FENTE, ouv=OUV):
    cx, cy, r = dx + k * RAY, dy + k * RAY, k * RAY; f2 = k * fente / 2
    l = math.sqrt(r * r - f2 * f2); a = math.radians(ouv)
    haut = f"M{r2(cx - l)} {r2(cy - f2)} A{r2(r)} {r2(r)} 0 0 1 {r2(cx + l)} {r2(cy - f2)} Z"
    # bas : de la fente au point de la bouche, puis l'arc jusqu'à la fente à gauche ; la coupe de la bouche part du centre
    ex, ey = cx + r * math.cos(a), cy + r * math.sin(a)
    bas = f"M{r2(cx - l)} {r2(cy + f2)} H{r2(cx + f2 / math.tan(a))} L{r2(ex)} {r2(ey)} A{r2(r)} {r2(r)} 0 0 1 {r2(cx - l)} {r2(cy + f2)} Z"
    return haut + " " + bas
def svg(w, h, body, titre="Exofina"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {r2(w)} {r2(h)}" role="img" aria-labelledby="t"><title id="t">{titre}</title>{body}</svg>\n'
def chemin(d, c): return f'<path fill="{c}" d="{d}"/>'
def ecrire(n, s): open(f"{OUT}/{n}", "w").write(s)

def borne(ch):
    b = BoundsPen(gs); gs[cmap[ord(ch)]].draw(b); return b.bounds
ASC = borne("f")[3]; XH = borne("x")[3]
TRACK = -0.03                                            # approche serrée, mot d'un seul tenant (comme le nom Sage)
def mot(x0, base, hauteur, c_exo, c_fina, texte="Exofina", coupe=3, sur="asc"):
    ref = max(ASC, borne("E")[3]) if sur == "asc" else borne("E")[3]
    size = hauteur * upm / ref; s = size / upm; tr = TRACK * size; x = x0; parts = ([], []); gauche = None
    for i, ch in enumerate(texte):
        g = cmap[ord(ch)]; pen = SVGPathPen(gs); gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, base)))
        if gauche is None: gauche = x + borne(ch)[0] * s
        parts[0 if i < coupe else 1].append(pen.getCommands()); dernier = (x, ch); x += gs[g].width * s + tr
    droite = dernier[0] + borne(dernier[1])[2] * s
    de, df = " ".join(parts[0]), " ".join(parts[1])
    return f'<path fill="{c_exo}" d="{de}"/><path fill="{c_fina}" d="{df}"/>', de, df, gauche, droite

HM = 0.70 * H                    # hauteur du mot (sommet du f) ; ligne de base = bas de la pièce
ESP = 0.22 * H
def ligne(ce, cf, texte="Exofina", sur="asc"):
    _, _, _, g, _ = mot(0, 0, HM, ce, cf, texte=texte, sur=sur)
    return mot(40 + LARG + ESP - g, 216, HM, ce, cf, texte=texte, sur=sur)
def en_ligne(cs, ce, cf, texte="Exofina", sur="asc"):
    p, _, _, _, dr = ligne(ce, cf, texte, sur)
    return svg(dr + 40, 256, chemin(symbole(), cs) + p)
def en_pile(cs, ce, cf):
    hm = 0.5 * H; _, _, _, g, dr = mot(0, 0, hm, ce, cf); w = dr - g; W = max(w, LARG) + 80
    p, _, _, _, _ = mot((W - w) / 2 - g, 216 + 0.3 * H + hm, hm, ce, cf)
    return svg(W, 216 + 0.3 * H + hm + 52, chemin(symbole(dx=(W - LARG) / 2), cs) + p)
def mot_seul(ce, cf):
    _, _, _, g, _ = mot(0, 0, 120, ce, cf); p, _, _, _, dr = mot(32 - g, 152, 120, ce, cf)
    return svg(dr + 32, 184, p)

variantes = {"clair": (R, R, N), "sombre": (R, R, BL), "blanc": (BL, BL, BL), "noir": (NO, NO, NO), "nuit": (N, N, N)}
for nom, (cs, ce, cf) in variantes.items():
    ecrire(f"exofina-en-ligne-{nom}.svg", en_ligne(cs, ce, cf))
    ecrire(f"exofina-en-pile-{nom}.svg", en_pile(cs, ce, cf))
    ecrire(f"exofina-mot-{nom}.svg", mot_seul(ce, cf))
for nom, c in (("rouge", R), ("blanc", BL), ("nuit", N), ("noir", NO)):
    ecrire(f"exofina-symbole-{nom}.svg", svg(LARG + 80, 256, chemin(symbole(), c)))
def tuile(fond, c):
    k = 0.62; w = LARG * k; return svg(256, 256, f'<rect width="256" height="256" rx="56" fill="{fond}"/>' + chemin(symbole(dx=(256 - w) / 2, dy=(256 - H * k) / 2, k=k), c))
ecrire("exofina-icone-nuit.svg", tuile(N, BL)); ecrire("exofina-icone-rouge.svg", tuile(R, BL)); ecrire("exofina-icone-blanche.svg", tuile(BL, R))
ecrire("favicon.svg", svg(LARG + 16, H + 16, chemin(symbole(dx=8, dy=8), R)))
# Logo de l'application : le mot seul, « Exofina » (E majuscule), comme le nom Sage ; la pièce sert aux icônes et à la page des modules
_, _, _, g0, _ = mot(0, 0, 120, R, N); _, de, df, g, dr = mot(-g0, 120, 120, R, N)
desc = max(-borne(ch)[1] for ch in "Exofina") * 120 / max(ASC, borne("E")[3])
open(f"{OUT}/exofina-traces.ts", "w").write(
    "/** Tracés du logo Exofina, sortis de docs/design/logo-exofina/construction.py. Ne pas retoucher à la main.\n"
    " * Mot « Exofina » : « Exo » rouge, « fina » de la couleur du texte (Bleu Nuit sur clair, blanc sur sombre). Pièce en « e » pour les icônes. */\n"
    f'export const LOGO_CADRE = "0 0 {r2(dr)} {r2(120 + desc)}";\n'
    f'export const LOGO_EXO = "{de}";\nexport const LOGO_FINA = "{df}";\n'
    f'export const LOGO_SYMBOLE = "{symbole()}";\n'
    f'export const SYMBOLE_CADRE = "40 40 {r2(LARG)} 176";\n')
print("ok", r2(LARG))
