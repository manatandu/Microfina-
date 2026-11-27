"""Assemble le manuel d'utilisation d'Exofina : chapitres Markdown du dépôt + captures -> Word (page de garde, sommaire, pied de page) -> PDF.
Usage : python3 assembler.py <dossier des chapitres> <dossier de travail>"""
import re
import subprocess
import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

CHAP, M = Path(sys.argv[1]), Path(sys.argv[2])
NUIT, ROUGE, GRIS = RGBColor(0x18, 0x22, 0x32), RGBColor(0xC9, 0x1B, 0x2C), RGBColor(0x5B, 0x63, 0x70)
VERSION, DATE = "Version 1.0", "Novembre 2026"

# 1. Un seul Markdown, dans l'ordre des fichiers ; images à la largeur de la page, absentes signalées
md, manquantes = [], []
for f in sorted(CHAP.glob("[0-9][0-9]-*.md")):
    t = f.read_text(encoding="utf-8")
    def image(m):
        alt, src = m.group(1), m.group(2)
        if not (M / src).exists():
            manquantes.append(src)
            return f"*[{alt} : capture à venir]*"
        return f"![{alt}]({src}){{width=100%}}"
    t = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]*\})?", image, t)
    # Une liste qui suit directement une ligne de texte demande une ligne vide pour que Word en fasse une liste
    out, avant = [], ""
    for ligne in t.split("\n"):
        est_liste = re.match(r"^\s*(\d+\.|[-*])\s+", ligne) is not None
        prec_liste = re.match(r"^\s*(\d+\.|[-*])\s+", avant) is not None or avant.startswith("   ")
        if est_liste and avant.strip() and not prec_liste and not avant.lstrip().startswith("|"):
            out.append("")
        out.append(ligne); avant = ligne
    t = "\n".join(out)
    md.append(t.strip() + "\n")
(M / "manuel.md").write_text("\n\n".join(md), encoding="utf-8")
subprocess.run(["pandoc", str(M / "manuel.md"), "-o", str(M / "corps.docx"), "--reference-doc", str(M / "reference.docx"),
                "--toc", "--toc-depth=2", "--resource-path", str(M), "-M", "toc-title=Sommaire", "-M", "lang=fr-FR", "-f", "markdown+pipe_tables"],
               check=True)

# 2. Page de garde, en-tête et pied de page
d = Document(str(M / "corps.docx"))
corps = d.element.body
premier = corps[0]


def avant(p):
    premier.addprevious(p._p)
    return p


def paragraphe(texte="", taille=11, gras=False, couleur=NUIT, centre=True, espace=6):
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if centre else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(espace)
    if texte:
        r = p.add_run(texte)
        r.font.size, r.font.bold, r.font.color.rgb, r.font.name = Pt(taille), gras, couleur, "Arial"
    return avant(p)


def image(chemin, largeur):
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(chemin), width=Cm(largeur))
    return avant(p)


paragraphe(espace=60)
image(M / "logos" / "exofina.png", 9)
paragraphe(espace=30)
paragraphe("Manuel d'utilisation", 30, True, NUIT, espace=8)
paragraphe("Logiciel de gestion des COOPEC et des institutions de microfinance", 13, False, GRIS, espace=70)
paragraphe("Entreprise pilote", 11, True, ROUGE, espace=10)
image(M / "logos" / "dwac.png", 6)
paragraphe(espace=60)
paragraphe(f"{VERSION}  ·  {DATE}", 10, False, GRIS, espace=2)
paragraphe("https://exofina.web.app", 10, False, GRIS, espace=2)
fin = paragraphe()
fin.runs[0].add_break(WD_BREAK.PAGE) if fin.runs else fin.add_run().add_break(WD_BREAK.PAGE)


def champ(p, code):
    r = p.add_run()
    for t, v in (("begin", None), ("instr", code), ("separate", None), ("end", None)):
        if t == "instr":
            e = OxmlElement("w:instrText"); e.set(qn("xml:space"), "preserve"); e.text = v
        else:
            e = OxmlElement("w:fldChar"); e.set(qn("w:fldCharType"), t)
        r._r.append(e)
        if t == "separate":
            r2 = OxmlElement("w:t"); r2.text = "1"; r._r.append(r2)


# Tableaux : un filet fin autour de chaque case, ligne de titres en gras sur fond clair
for t in d.tables:
    tblPr = t._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for cote in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{cote}"); e.set(qn("w:val"), "single"); e.set(qn("w:sz"), "4"); e.set(qn("w:color"), "B8BEC8"); b.append(e)
    tblPr.append(b)
    for c in t.rows[0].cells:
        sh = OxmlElement("w:shd"); sh.set(qn("w:val"), "clear"); sh.set(qn("w:fill"), "EEF1F5"); c._tc.get_or_add_tcPr().append(sh)
        for p in c.paragraphs:
            for r in p.runs:
                r.font.bold = True
for s in d.sections:
    s.different_first_page_header_footer = True
    h = s.header.paragraphs[0]; h.text = ""
    r = h.add_run("Exofina · Manuel d'utilisation"); r.font.size, r.font.color.rgb = Pt(8), GRIS
    h.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    f = s.footer.paragraphs[0]; f.text = ""; f.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = f.add_run("Page "); r.font.size = Pt(8)
    champ(f, "PAGE")
# Word met le sommaire à jour à l'ouverture
reg = d.settings.element
u = OxmlElement("w:updateFields"); u.set(qn("w:val"), "true"); reg.append(u)
d.save(str(M / "manuel-brut.docx"))
print("captures manquantes :", len(manquantes))
for x in manquantes[:40]:
    print("  ", x)
