"""Écart E07 (docs/reglementaire/ECARTS-2026-11-15.md) : gestion des plaintes, Instr. BCC 39 ; loi 11/020, art. 61.
Art. 3 et 4 : reçues dans tous les points d'exploitation ; art. 7 : numéro de référence unique remis au client ; art. 10 : canaux ; art. 5 : suite
dans 45 jours calendaires au plus ; art. 15 : plainte fondée, réparation ; art. 17 : dossier gardé dix ans ; art. 19 : rapport trimestriel.
Mêmes règles que web/src/donnees/api.ts (plaintes)."""
import re
import uuid
from datetime import date, timedelta

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante, nom_utilisateur, titulaire

CANAUX = {"personne": "En personne", "lettre": "Lettre", "fax": "Fax", "courriel": "Courrier électronique", "formulaire": "Formulaire en ligne",
          "telephone": "Téléphone", "autre": "Autre canal"}
PROVENANCES = {"siege": "Siège", "agence": "Agence", "guichet": "Guichet", "autre": "Autre"}
NATURES = {"depot": "Dépôt", "retrait": "Retrait", "credit": "Crédit", "gestion_compte": "Gestion de compte", "frais": "Frais et commissions",
           "accueil": "Accueil et service", "autre": "Autre"}
DELAI_JOURS = 45                     # art. 5 : jours calendaires


def vue(x: dict, jour: str) -> dict:
    ech = (x["recue_le"] + timedelta(days=DELAI_JOURS)).isoformat()
    return {"id": x["id"], "reference": x["reference"], "recueLe": x["recue_le"].isoformat(), "echeance": ech,
            "enRetard": x["statut"] == "recue" and jour > ech, "tiersId": x["tiers_id"],
            "membre": valeur("select numero from tiers where id = %s", (x["tiers_id"],)) if x["tiers_id"] else "",
            "plaignant": x["plaignant"], "contact": x["contact"] or "", "canal": x["canal"], "canalLibelle": CANAUX[x["canal"]],
            "provenance": x["provenance"], "provenanceLibelle": PROVENANCES[x["provenance"]], "nature": x["nature"], "natureLibelle": NATURES[x["nature"]],
            "objet": x["objet"], "agence": valeur("select nom from agence where id = %s", (x["agence_id"],)),
            "enregistreePar": nom_utilisateur(x["enregistree_par"]), "statut": x["statut"], "fondee": x["fondee"], "reponse": x["reponse"] or "",
            "reparation": x["reparation"] or "", "repondueLe": x["repondue_le"].isoformat() if x["repondue_le"] else "",
            "repondueePar": nom_utilisateur(x["repondue_par"]) if x["repondue_par"] else ""}


def _jour(u) -> str:
    j = journee_courante(u)
    return j["date"] if j else date.today().isoformat()


def enregistrer(u: dict, d: dict) -> dict:
    exiger(u)
    d = d if isinstance(d, dict) else {}
    try:
        cle = str(uuid.UUID(str(d.get("cle"))))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = une("select * from plainte where cle_idempotence = %s", (cle,))
    if prec:
        return vue(prec, _jour(u))
    t = lambda k: str(d.get(k) or "").strip()
    jour = _jour(u)
    recue = t("recueLe") or jour
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", recue) or recue > jour:
        raise ErreurMetier("Date de réception invalide : au plus la journée en cours.")
    tid = d.get("tiersId")
    if tid is not None and not (isinstance(tid, int) and une("select 1 from tiers where id = %s and institution_id = %s", (tid, u["institution_id"]))):
        raise ErreurMetier("Client introuvable.")
    plaignant = titulaire(tid) if tid else t("plaignant")
    manque = [n for v, n in ((plaignant, "Plaignant"), (t("objet"), "Objet de la plainte")) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if t("canal") not in CANAUX or t("provenance") not in PROVENANCES or t("nature") not in NATURES:
        raise ErreurMetier("Choisir le canal, la provenance et la nature de l'opération (Instr. BCC 39, art. 10 et 19).")
    n = int(valeur("select count(*) + 1 from plainte where institution_id = %s and extract(year from recue_le) = %s", (u["institution_id"], int(recue[:4]))))
    ref = f"PL-{recue[:4]}-{n:06d}"                          # art. 7 : référence unique, transmise au client
    pid = valeur("""insert into plainte (institution_id, agence_id, reference, cle_idempotence, recue_le, tiers_id, plaignant, contact, canal, provenance, nature,
                    objet, enregistree_par) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], u["agence_id"], ref, cle, recue, tid, plaignant, t("contact") or None, t("canal"), t("provenance"), t("nature"),
                  t("objet"), u["id"]))
    return vue(une("select * from plainte where id = %s", (pid,)), jour)


def lister(u: dict, statut: str = "", du: str = "", au: str = "") -> list[dict]:
    exiger(u)
    if statut not in ("", "recue", "repondue"):
        raise ErreurMetier("Statut inconnu.")
    jour = _jour(u)
    return [vue(x, jour) for x in lignes("""select * from plainte where institution_id = %(i)s and (%(s)s = '' or statut = %(s)s)
                                            and recue_le >= coalesce(nullif(%(du)s, '')::date, recue_le) and recue_le <= coalesce(nullif(%(au)s, '')::date, recue_le) order by recue_le desc, id desc""",
                                         {"i": u["institution_id"], "s": statut, "du": du, "au": au})]


def repondre(u: dict, pid: int, d: dict) -> dict:
    """Art. 5 et 15 : la suite, et la réparation quand la plainte est fondée. Réponse réservée au chef d'agence : le droit de l'écran ne suffit pas"""
    exiger(u)
    if "chef_agence" not in u["roles"]:
        raise ErreurMetier("Réservé au profil « chef d'agence » : la réponse engage l'institution.", 403)
    d = d if isinstance(d, dict) else {}
    x = une("select * from plainte where id = %s and institution_id = %s for update", (pid, u["institution_id"]))
    if not x or x["statut"] != "recue":
        raise ErreurMetier("Cette plainte n'attend plus de réponse.")
    t = lambda k: str(d.get(k) or "").strip()
    fondee = d.get("fondee")
    if not isinstance(fondee, bool):
        raise ErreurMetier("Dire si la plainte est fondée.")
    if not t("reponse"):
        raise ErreurMetier("À remplir : réponse au plaignant.")
    if fondee and not t("reparation"):
        raise ErreurMetier("Plainte fondée : décrire la réparation (Instr. BCC 39, art. 15).")
    jour = _jour(u)
    le = t("repondueLe") or jour
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", le) or le > jour or le < x["recue_le"].isoformat():
        raise ErreurMetier("Date de réponse invalide.")
    executer("""update plainte set statut = 'repondue', fondee = %s, reponse = %s, reparation = %s, repondue_le = %s, repondue_par = %s where id = %s""",
             (fondee, t("reponse"), t("reparation") or None, le, u["id"], pid))
    return vue(une("select * from plainte where id = %s", (pid,)), jour)


def rapport(u: dict, du: str, au: str) -> dict:
    """Art. 19 : rapport trimestriel à la BCC (nombre et dates, provenance, canaux, nature des transactions, suites)"""
    exiger(u)
    for v, nom in ((du, "Du"), (au, "Au")):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v or ""):
            raise ErreurMetier(f"À remplir : {nom}.")
    l = lister(u, "", du, au)
    compte = lambda k, libelles: [{"cle": c, "libelle": n, "nombre": sum(1 for x in l if x[k] == c)} for c, n in libelles.items()]
    suites = {"fondee": sum(1 for x in l if x["fondee"] is True), "nonFondee": sum(1 for x in l if x["fondee"] is False),
              "enCours": sum(1 for x in l if x["statut"] == "recue"), "horsDelai": sum(1 for x in l if x["statut"] == "repondue" and x["repondueLe"] > x["echeance"])}
    return {"du": du, "au": au, "total": len(l), "provenances": compte("provenance", PROVENANCES), "canaux": compte("canal", CANAUX),
            "natures": compte("nature", NATURES), "suites": suites, "plaintes": l}
