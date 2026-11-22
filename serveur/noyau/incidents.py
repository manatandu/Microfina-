"""SC06 : Client > Conformité > Incidents et dépassements (confrontation du 21/11/2026, B17). Écran imposé par les textes, absent de Microfina++.
- Instr. BCC 008, art. 43 : les incidents (incidents opérationnels, dépassements de limites, déficits de trésorerie) sont conservés dans une base de données.
- Instr. BCC 008, art. 49 : les limites sont surveillées de manière automatisée ; un dépassement donne une alerte aux responsables ; son traitement est tracé.
- Instr. BCC 007, art. 39 : l'organe exécutif informe l'organe délibérant des dépassements de limites et des incidents opérationnels significatifs.
Le logiciel note lui-même les dépassements qu'il constate (plafond par emprunteur, apparentés, maximum autorisé en caisse) ; les autres incidents se déclarent.
Mêmes règles que web/src/donnees/api.ts (incidents)."""
import psycopg

from .bd import ErreurMetier, executer, lignes, une
from .services import exiger, journee_courante, nom_utilisateur

TYPES = {"depassement_limite": "Dépassement de limite", "incident_operationnel": "Incident opérationnel", "deficit_tresorerie": "Déficit de trésorerie"}


def noter(u: dict, description: str, montant: int | None = None, devise: str | None = None) -> None:
    """Dépassement de limite constaté par le logiciel. Connexion à part : la ligne reste quand l'opération est refusée. Un même dépassement encore
    ouvert ne se note pas deux fois."""
    from .securite import _connexion
    try:
        with _connexion() as c:
            if c.execute("select 1 from incident where institution_id = %s and type = 'depassement_limite' and description = %s and regularise_le is null",
                         (u["institution_id"], description)).fetchone():
                return
            c.execute("""insert into incident (institution_id, type, origine, description, montant, devise, utilisateur_id)
                         values (%s, 'depassement_limite', 'automatique', %s, %s, %s, %s)""", (u["institution_id"], description, montant, devise, u.get("id")))
    except psycopg.Error:
        pass


def vue(x: dict) -> dict:
    return {"id": x["id"], "type": x["type"], "typeLibelle": TYPES[x["type"]], "origine": x["origine"], "le": x["le"].date().isoformat(), "description": x["description"],
            "montant": x["montant"], "devise": (x["devise"] or "").strip(), "traitement": x["traitement"] or "",
            "regulariseLe": x["regularise_le"].isoformat() if x["regularise_le"] else "", "traitePar": nom_utilisateur(x["traite_par"]) if x["traite_par"] else ""}


def lister(u) -> dict:
    exiger(u)
    return {"types": [{"code": k, "libelle": v} for k, v in TYPES.items()],
            "incidents": [vue(x) for x in lignes("select * from incident where institution_id = %s order by (regularise_le is not null), le desc, id desc", (u["institution_id"],))]}


def declarer(u, d) -> dict:
    """Déclarer un incident constaté hors du logiciel"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    description = d.get("description").strip() if isinstance(d.get("description"), str) else ""
    if d.get("type") not in TYPES:
        raise ErreurMetier("À remplir : Type.")
    if not description:
        raise ErreurMetier("À remplir : Description.")
    m = d.get("montant")
    if m is not None and (not isinstance(m, int) or isinstance(m, bool) or m < 0):
        raise ErreurMetier("Montant : un montant positif.")
    executer("insert into incident (institution_id, type, origine, description, montant, devise, utilisateur_id) values (%s, %s, 'manuelle', %s, %s, %s, %s)",
             (u["institution_id"], d["type"], description, m, "CDF" if m is not None else None, u["id"]))
    return lister(u)


def traiter(u, iid: int, d) -> dict:
    """Traitement d'un incident, tracé : mesure de régularisation, et date quand il est régularisé (Instr. BCC 008, art. 49, al. 3)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    x = une("select * from incident where id = %s and institution_id = %s for update", (iid, u["institution_id"])) if isinstance(iid, int) else None
    if not x:
        raise ErreurMetier("Choisir l'incident dans la liste.")
    if x["regularise_le"]:
        raise ErreurMetier("Incident déjà régularisé.")
    traitement = d.get("traitement").strip() if isinstance(d.get("traitement"), str) else ""
    if not traitement:
        raise ErreurMetier("À remplir : Traitement.")
    j = journee_courante(u)
    executer("update incident set traitement = %s, traite_par = %s, regularise_le = %s where id = %s",
             (traitement, u["id"], (j["date"] if j else None) if d.get("regularise") is True else None, iid))
    return lister(u)


def ouverts(institution_id: int) -> int:
    from .bd import valeur
    return int(valeur("select count(*) from incident where institution_id = %s and regularise_le is null", (institution_id,)))
