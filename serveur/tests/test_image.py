"""L'image du serveur (serveur/Dockerfile) doit contenir chaque fichier du dépôt que le code lit hors de serveur/ (audit du 21/11/2026 :
référentiels et modèles des états financiers manquaient, les écrans répondaient 500 en ligne)."""
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]


def test_fichiers_lus_par_le_serveur_copies_dans_l_image():
    lus = set()
    for f in (RACINE / "serveur").rglob("*.py"):
        if ".venv" in f.parts or "tests" in f.parts:
            continue
        lus |= set(re.findall(r'RACINE_DEPOT\s*/\s*"replica"\s*/\s*"([^"]+)"', f.read_text(encoding="utf-8")))
    assert lus, "aucune lecture trouvée : le motif du test ne correspond plus au code"
    docker = (RACINE / "serveur" / "Dockerfile").read_text(encoding="utf-8")
    copies = set(re.findall(r"replica/([\w.\-]+)", " ".join(l for l in docker.splitlines() if l.startswith("COPY"))))
    assert lus <= copies, f"fichiers lus par le serveur mais absents de l'image : {sorted(lus - copies)}"
    assert all((RACINE / "replica" / n).exists() for n in copies)
