"""Met le registre des décisions (decisions.csv) en page lisible : docs/architecture/DECISIONS.md.
    python replica/decisions.py
Le registre se modifie dans decisions.csv ; cette page est réécrite à chaque fois."""
import csv
from collections import Counter
from pathlib import Path

RACINE = Path(__file__).resolve().parent
L = list(csv.DictReader(open(RACINE / "decisions.csv", encoding="utf-8")))
ORIGINE = {"M": "manuel", "G": "règle générale du manuel", "A": "écran voisin", "D": "donnée exigée ailleurs", "R": "texte réglementaire", "P": "choix du porteur"}
c, a = Counter(x["solidite"] for x in L), Counter(x["application"] for x in L)
t = ["# Likelemba : registre des décisions", "",
     "Les réponses retenues aux questions laissées « à confirmer », et les règles qui valent pour tout le logiciel. "
     "Méthode : [`COMPLEMENTS.md`](COMPLEMENTS.md) § 3. Cette page est écrite par `replica/decisions.py` à partir de `replica/decisions.csv`.", "",
     f"**{len(L)} décisions.** Solidité : {c['forte']} fortes (le manuel ou un texte répond), {c['moyenne']} moyennes (déduites d'un écran voisin ou d'une donnée), "
     f"{c['faible']} faibles (notre choix, faute de mieux). Dans le code : {a['en place']} déjà en place, {a['à appliquer']} à appliquer.", "",
     "Le porteur valide en fin de lot. Les décisions **faibles** sont celles à regarder en premier : elles sont listées à la fin.", ""]
ecrans = list(dict.fromkeys(x["ecran"] if not x["id"].startswith("T") else "Règles pour tout le logiciel" for x in L))
for e in ecrans:
    l = [x for x in L if (x["ecran"] == e) or (e == "Règles pour tout le logiciel" and x["id"].startswith("T"))]
    t += [f"## {e}", "", "| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |", "|---|---|---|---|---|---|"]
    for x in l:
        q = f"{x['question']} ({x['ecran']})" if x["id"].startswith("T") else x["question"]
        t.append(f"| {x['id']} | {q} | {x['choix']} | {ORIGINE[x['origine']].capitalize()} : {x['reference']} | {x['solidite']} | {x['application']} |")
    t.append("")
t += ["## Les décisions faibles, à regarder en premier", "", "| N° | Écran | Question | Réponse retenue |", "|---|---|---|---|"]
t += [f"| {x['id']} | {x['ecran']} | {x['question']} | {x['choix']} |" for x in L if x["solidite"] == "faible"]
(RACINE.parent / "docs" / "architecture" / "DECISIONS.md").write_text("\n".join(t) + "\n", encoding="utf-8")
print(f"{len(L)} décisions : {dict(c)} ; {dict(a)}")
