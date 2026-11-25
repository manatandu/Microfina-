"""Traduction anglaise des messages du serveur (registre T118). Tout texte que le serveur envoie aux écrans (messages, libellés d'états) a sa traduction
dans web/src/langues/en.json, ou figure dans web/src/langues/identiques.json. Même recherche que le moteur de web/src/lib/langue.ts : mot pour mot, sans
la marque de champ, en capitales, par gabarit, phrase par phrase. Les textes des écrans sont contrôlés par web/src/langues/couverture.test.ts."""
import ast
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
NOYAU = RACINE / "serveur" / "noyau"
SQL = re.compile(r"^\s*(select|insert|update|delete|with|alter|create|drop)\b", re.I)


def affichable(s: str) -> bool:
    t = s.strip()
    if len(t) < 2 or not re.search(r"[A-Za-zÀ-ÿ]", t):
        return False
    if SQL.match(t) or re.search(r"\b(from|where|join)\b.*=", t, re.I):
        return False
    if re.fullmatch(r"[a-z0-9_\-./:#?=&%{}$ ,()*<>|\[\]\\+^\"'!;@]+", t) or re.match(r"^(https?:|/|data:)", t):
        return False
    return bool(re.search(r"[ '’]", t) or re.match(r"^[A-ZÀ-Ý][a-zà-ÿ]", t) or re.search(r"[À-ÿ]", t))


def relever() -> dict:
    """Constantes et f-strings de serveur/noyau, hors docstrings : texte -> (gabarit ?, fichier)"""
    out = {}
    for f in sorted(NOYAU.glob("*.py")) + sorted((NOYAU / "management" / "commands").glob("*.py")):
        arbre = ast.parse(f.read_text(encoding="utf-8"))
        docs, dans_f = set(), set()
        for n in ast.walk(arbre):
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Module)) and n.body and isinstance(n.body[0], ast.Expr) \
                    and isinstance(getattr(n.body[0], "value", None), ast.Constant):
                docs.add(id(n.body[0].value))
        for n in ast.walk(arbre):
            if isinstance(n, ast.JoinedStr):
                i, t = 0, ""
                for v in n.values:
                    if isinstance(v, ast.Constant):
                        t += str(v.value)
                        dans_f.add(id(v))
                    else:
                        t += "{%d}" % i
                        i += 1
                t = re.sub(r"\s+", " ", t).strip()
                if affichable(t):
                    out.setdefault(t, (True, f.name))
        for n in ast.walk(arbre):
            if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docs and id(n) not in dans_f:
                t = re.sub(r"\s+", " ", n.value).strip()
                if affichable(t):
                    out.setdefault(t, (False, f.name))
    return out


class Dictionnaire:
    def __init__(self, d: dict):
        self.exact = d["exact"]
        self.cles_gabarits = {fr for fr, _ in d["gabarits"]}
        self.gabarits = []
        for fr, _ in d["gabarits"]:
            morceaux = re.split(r"\{\d+\}", fr)
            ancre = max(morceaux, key=len)
            if len(ancre.strip()) >= 3:
                self.gabarits.append((ancre, re.compile("^" + "([\\s\\S]*?)".join(re.escape(m) for m in morceaux) + "$")))

    def connu(self, t: str, profondeur: int = 0) -> bool:
        if t in self.exact:
            return True
        m = re.match(r"^(.*?)(\s*:)?(\s*\*)?$", t)
        if m and (m.group(2) or m.group(3)) and m.group(1) and (m.group(1) in self.exact or f"{m.group(1)} :" in self.exact):
            return True
        if profondeur < 3 and any(a in t and r.match(t) for a, r in self.gabarits):
            return True
        if re.search(r"\((?:registre|Registre)[^()]*\)", t):
            sans = re.sub(r"\s*\((?:registre|Registre)[^()]*\)", "", t).strip()
            if sans != t and self.connu(sans, profondeur):
                return True
        if re.search(r"[A-ZÀ-Ý]{2}", t) and t == t.upper():
            bas = t.lower()
            if self.connu(bas[:1].upper() + bas[1:], profondeur + 1) or self.connu(bas, profondeur + 1):
                return True
        if profondeur == 0:
            phrases = re.split(r"(?<=[.;!?])\s+", t)
            if len(phrases) > 1 and any(self.connu(p, 1) for p in phrases):
                return True
        return False


def test_messages_du_serveur_traduits():
    langues = RACINE / "web" / "src" / "langues"
    dico = Dictionnaire(json.loads((langues / "en.json").read_text(encoding="utf-8")))
    gardes = set(json.loads((langues / "identiques.json").read_text(encoding="utf-8")))
    textes = relever()
    assert len(textes) > 500, "relevé trop court : le motif ne correspond plus au code"
    manquants = [f"serveur/{f}\t{t}" for t, (gabarit, f) in sorted(textes.items()) if t not in gardes
                 and not ((t in dico.cles_gabarits or t in dico.exact) if gabarit else dico.connu(t))]
    assert not manquants, ("Textes sans traduction : les ajouter à web/src/langues/en.json (ou à identiques.json s'ils restent tels quels)\n"
                           + "\n".join(manquants))
