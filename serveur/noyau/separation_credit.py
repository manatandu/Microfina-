"""Séparation des tâches incompatibles sur un crédit. Instr. BCC 008, art. 66 : « Le Conseil d'Administration doit veiller à la séparation des tâches
incompatibles, notamment la manipulation des valeurs, l'enregistrement, l'autorisation des opérations, leur vérification ainsi que l'inspection. »
Une même personne ne tient qu'une de ces tâches sur un même crédit (plan d'allègement, point 0.4 ; registre CR-28).
Mêmes règles que web/src/donnees/api.ts (separerCredit)."""
from .bd import ErreurMetier, lignes, une

TACHES = {"enregistrement": "l'enregistrement (saisie de la demande ou mise en place)",
          "verification": "la vérification (contrôle de la demande ou visa du responsable crédit)",
          "autorisation": "l'autorisation (approbation, visa de la commission de crédit ou du service financier)",
          "manipulation": "le déblocage"}


def acteurs(demande_id: int | None, credit_id: int | None = None) -> dict[str, set[int]]:
    """Qui a tenu quelle tâche sur ce crédit, de la demande au déblocage"""
    t: dict[str, set] = {k: set() for k in TACHES}
    d = une("select saisi_par, controle_par, approuve_par from demande_credit where id = %s", (demande_id,)) if demande_id else None
    if d:
        t["enregistrement"].add(d["saisi_par"]); t["verification"].add(d["controle_par"]); t["autorisation"].add(d["approuve_par"])
    if credit_id:
        c = une("select mis_en_place_par, frais_encaisses_par from credit where id = %s", (credit_id,))
        t["enregistrement"].add(c["mis_en_place_par"]); t["manipulation"].add(c["frais_encaisses_par"])
        for v in lignes("select niveau, par from visa_credit where credit_id = %s", (credit_id,)):
            t["verification" if v["niveau"] == "responsable_credit" else "autorisation"].add(v["par"])
    return {k: {x for x in v if x} for k, v in t.items()}


def separer(u, tache: str, demande_id: int | None, credit_id: int | None = None):
    for k, ids in acteurs(demande_id, credit_id).items():
        if k != tache and u["id"] in ids:
            raise ErreurMetier(f"Séparation des tâches (Instr. BCC 008, art. 66) : vous avez déjà fait {TACHES[k]} de ce crédit ; "
                               f"{TACHES[tache]} revient à un autre utilisateur.")
