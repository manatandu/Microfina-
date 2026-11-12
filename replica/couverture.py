"""Croise les 146 travaux (features.csv) avec l'atlas des écrans (atlas.csv) : pour chaque travail, ses écrans, ce que le manuel montre,
l'étape de construction et ce qui est complété par nous. Écrit couverture.csv et l'annexe de docs/architecture/COMPLEMENTS.md.
    python replica/couverture.py
Refuse de tourner si un travail n'a pas de place dans l'architecture ou si un écran de l'atlas n'appartient à aucun travail."""
import csv
import re
from collections import Counter
from pathlib import Path

RACINE = Path(__file__).resolve().parent
DOC = RACINE.parent / "docs" / "architecture" / "COMPLEMENTS.md"
travaux = list(csv.DictReader(open(RACINE / "features.csv", encoding="utf-8")))
atlas = {x["id"]: x for x in csv.DictReader(open(RACINE / "atlas.csv", encoding="utf-8"))}
ORDRE = list(atlas)
DECISIONS = list(csv.DictReader(open(RACINE / "decisions.csv", encoding="utf-8")))
# Écrans construits : ceux que l'application affiche (web/src/ecrans/construits.tsx) ; l'atlas est remis à jour à chaque passage
CONSTRUITS = set(re.findall(r"^\s+(S\d+[a-z]?):", (RACINE.parent / "web" / "src" / "ecrans" / "construits.tsx").read_text(encoding="utf-8"), re.M))
# S01 Connexion et S02 Page des modules sont des routes de l'application (web/src/App.tsx), hors du registre des écrans
CONSTRUITS |= {"S01", "S02"}
for k, x in atlas.items():
    x["construit"] = "oui" if k in CONSTRUITS else "non"


def ecrans_de_decision(d):
    """Écrans touchés par une décision : le préfixe de son numéro (S08-1 -> S08) et les écrans nommés dans sa colonne écran (« S37 à S39, S46 »)."""
    ids = {d["id"].split("-")[0]}
    for a_, b_ in re.findall(r"\bS(\d+) à S(\d+)\b", d["ecran"]):
        ids |= {f"S{n}" for n in range(int(a_), int(b_) + 1)}
    return ids | set(re.findall(r"\bS\d+[a-z]?\b", d["ecran"]))


def reste_de(ids, regles):
    """Décisions du registre encore « à appliquer » pour ces écrans (ou ces règles transverses, pour un travail sans écran)"""
    vises = set(ids) | set(regles.split())
    return [d for d in DECISIONS if d["application"] == "à appliquer" and not d["id"].startswith("T") and ecrans_de_decision(d) & vises] + \
           [d for d in DECISIONS if d["application"] == "à appliquer" and d["id"] in regles.split()]

# Écrans retrouvés dans le manuel le 12/11/2026, rattachés à un travail existant (la liste reste à 146)
RATTACHES = {"Secteurs d'activité": [f"S14{c}" for c in "abcdefghijklmn"],
             "Factures fournisseurs bons de commande règlements": ["S141"],
             "Contrôle trésorerie et rapport des annulations": ["S142", "S143"]}
# Travaux sans écran propre : règle transverse du § 5 (T..), ou hors périmètre
SANS_ECRAN = {
    "Multilingue français et anglais": ("A", "Plus tard", "Menu des langues montré p. 14. Français seul pour l'instant (décision du porteur)", ""),
    "Aide en ligne": ("D", "Plus tard", "Icône montrée p. 14, contenu non montré : à écrire par nous, écran par écran", ""),
    "Export des grilles vers Excel": ("A", "0 Reprises, puis chaque liste et chaque rapport", "", "T04"),
    "Grilles paginées avec filtres par colonne": ("A", "0 Reprises, puis chaque liste et chaque rapport", "", "T04"),
    "Boîtes de confirmation oui ou non": ("A", "Fait à chaque écran", "", "T06"),
    "Modifier et supprimer depuis une grille": ("A", "0 Reprises, puis chaque liste", "", "T01 T02"),
    "Référentiel comptable des SFD de l'UEMOA": ("A", "Non repris", "Remplacé par le PCCI", ""),
    "GRH": ("A", "Non repris", "Hors périmètre (manuel p. 166 à 268)", ""),
    "Stocks": ("A", "Non repris", "Hors périmètre (manuel p. 289 à 305)", ""),
}
RANG = {"D": 0, "C": 1, "B": 2, "A": 3}
NIVEAU = {"A": "Montré en entier", "B": "Montré en partie", "C": "Texte seul", "D": "Nom seul"}


def ecrans(t):
    debut = t["notes"].split("|")[0]
    ids = []
    for a, b in re.findall(r"\bS(\d+) à S(\d+)\b", debut):
        ids += [f"S{n}" for n in range(int(a), int(b) + 1)]
    ids += re.findall(r"\bS\d+[a-z]?\b", debut) + RATTACHES.get(t["feature"], [])
    return sorted(set(ids), key=ORDRE.index)


lignes, vus = [], set()
for n, t in enumerate(travaux, 1):
    ids = ecrans(t)
    if ids:
        a = [atlas[i] for i in ids]
        niveau = min((x["niveau"] for x in a), key=RANG.get)
        etape = a[0]["lot"] if t["clone"] != "skip" else "Non repris"
        manque = " ; ".join(f"{x['id']} : {x['manque_dans_le_manuel']}" for x in a if x["manque_dans_le_manuel"])
        par = " ; ".join(dict.fromkeys(x["complement_par"] for x in a if x["complement_par"]))
        gabarit = ", ".join(dict.fromkeys(x["gabarit"] for x in a))
        regles = ""
    else:
        assert t["feature"] in SANS_ECRAN, f"Travail sans place dans l'architecture : {t['feature']}"
        niveau, etape, manque, regles = SANS_ECRAN[t["feature"]]
        par, gabarit = "", ""
    vus.update(ids)
    reste = reste_de(ids, regles)
    # État calculé : Fait = tous ses écrans construits (ou sa règle appliquée) et plus aucune décision à appliquer.
    # La validation du registre par le porteur, en fin de lot, vient ensuite.
    if t["clone"] in ("partial", "yes"):
        complet = all(atlas[i]["construit"] == "oui" for i in ids) and not reste
        t["clone"] = "yes" if complet else "partial"
    lignes.append({"n": n, "travail": t["feature"], "module": t["area"], "priorite": t["priority"], "etat": t["clone"], "ecrans": " ".join(ids),
                   "niveau": niveau, "gabarit": gabarit, "etape": etape, "complete_par_nous": manque, "origine": par, "regles": regles,
                   "ecrans_a_construire": " ".join(i for i in ids if atlas[i]["construit"] != "oui"),
                   "reste": " ; ".join(f"{d['id']} {d['question']}" for d in reste)})
assert len(lignes) == 146, len(lignes)
assert not set(atlas) - vus, f"Écrans de l'atlas sans travail : {sorted(set(atlas) - vus)}"

# features.csv suit l'état calculé ; atlas.csv suit les écrans construits
with open(RACINE / "features.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(travaux[0]), lineterminator="\n")
    w.writeheader()
    w.writerows(travaux)
with open(RACINE / "atlas.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(next(iter(atlas.values()))), lineterminator="\n")
    w.writeheader()
    w.writerows(atlas.values())
with open(RACINE / "couverture.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(lignes[0]))
    w.writeheader()
    w.writerows(lignes)

# Annexe du document d'architecture, entre deux repères
MODULES = [("administration", "Administration"), ("paramétrage", "Paramétrage"), ("clients", "Client"), ("banque", "Banque"), ("épargne", "Épargne"), ("caisse", "Caisse"),
           ("crédit", "Crédit"), ("comptabilité", "Comptabilité"), ("budget", "Budget"), ("autres", "Autres"), ("paie", "Paie"), ("immobilisations", "Immobilisations"),
           ("général", "Général"), ("modules", "Modules")]
c = Counter(l["niveau"] for l in lignes if l["etat"] != "skip")
bloc = ["<!-- annexe:debut (écrit par replica/couverture.py, ne pas modifier à la main) -->", "",
        f"146 travaux, dont {sum(1 for l in lignes if l['etat'] == 'skip')} non repris. Sur les {sum(c.values())} à construire : "
        f"{c['A']} sont montrés en entier par le manuel, {c['B']} en partie, {c['C']} par le texte seul, {c['D']} par leur nom seul.", ""]
for code, nom in MODULES:
    l = [x for x in lignes if x["module"] == code]
    bloc += [f"### {nom} ({len(l)})", "", "| N° | Travail | Écrans | Manuel | Étape | Complété par nous |", "|---|---|---|---|---|---|"]
    for x in l:
        reste = x["complete_par_nous"] or ("Règle " + x["regles"] if x["regles"] else "Rien : à recopier")
        bloc.append(f"| {x['n']} | {x['travail']} | {x['ecrans'] or 'tous'} | {NIVEAU[x['niveau']]} | {x['etape']} | {reste} |")
    bloc.append("")
bloc.append("<!-- annexe:fin -->")
texte = DOC.read_text(encoding="utf-8")
debut, fin = "<!-- annexe:debut", "<!-- annexe:fin -->"
assert debut in texte and fin in texte, "Repères d'annexe absents de COMPLEMENTS.md"
DOC.write_text(texte[:texte.index(debut)] + "\n".join(bloc) + texte[texte.index(fin) + len(fin):], encoding="utf-8")
print(f"146 travaux couverts, {len(atlas)} écrans ; à construire : {dict(c)} ; état : {dict(Counter(l['etat'] for l in lignes))}")
