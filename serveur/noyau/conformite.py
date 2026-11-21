"""Écart E01 (docs/reglementaire/ECARTS-2026-11-15.md) : examen renforcé des opérations en espèces de 10 000 USD ou plus.
Loi 22/068, art. 23 ; loi 25/048, art. 92 bis (déclaration systématique à la CENAREF) ; Instr. BCC 15, art. 61 (origine et destination des fonds,
objet de l'opération, acteurs économiques) et 62 (rapport écrit confidentiel) ; Instr. BCC 15 bis, art. 5 à 7 (l'institution autorise elle-même
après ses diligences, puis informe la CENAREF par un rapport confidentiel). Mêmes règles que web/src/donnees/api.ts (conformite)."""
import uuid

import json

from django.conf import settings

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import SEUIL_ESPECES_USD, en_usd, especes_du_jour_usd, exiger, journee_courante, nom_utilisateur, titulaire

TYPES = {"depot": "Dépôt en espèces", "retrait": "Retrait en espèces", "adhesion": "Adhésion", "achat_parts": "Achat de parts", "retrait_parts": "Retrait de parts",
         "deblocage_credit": "Déblocage de crédit", "remboursement_credit": "Remboursement de crédit"}
SORTIES = ("retrait", "retrait_parts", "deblocage_credit")
MSG = ("Examen renforcé requis : 10 000 USD ou plus en espèces dans la journée pour ce client (loi 22/068, art. 23 ; Instr. BCC 15, art. 61). "
       "L'opération attend l'autorisation de la conformité.")


def autorisation(u: dict, tid: int, journee_id: int, type_: str, montant: int, devise: str) -> int | None:
    """Appelé par chaque opération en espèces : None sous le seuil ; sinon l'examen autorisé qui couvre l'opération, ou un refus motivé"""
    sens = "retrait" if type_ in SORTIES else "depot"
    if en_usd(montant, devise) + especes_du_jour_usd(tid, journee_id, sens) < SEUIL_ESPECES_USD:
        return None
    e = une("""select * from examen_renforce where tiers_id = %s and journee_id = %s and type_operation = %s and montant = %s and devise = %s
               and operation_id is null order by id desc limit 1 for update""", (tid, journee_id, type_, montant, devise))
    if e and e["statut"] == "autorise":
        return e["id"]
    if e and e["statut"] == "a_examiner":
        raise ErreurMetier(f"L'examen renforcé n° {e['numero']} attend la conformité (Client > Conformité > Examen renforcé).")
    if e and e["statut"] == "refuse":
        raise ErreurMetier(f"Opération refusée par la conformité (examen renforcé n° {e['numero']}).")
    raise ErreurMetier(MSG)


def lier(examen_id: int | None, operation_id: int) -> None:
    if examen_id:
        executer("update examen_renforce set operation_id = %s where id = %s", (operation_id, examen_id))


def vue(x: dict) -> dict:
    return {"id": x["id"], "numero": x["numero"], "tiersId": x["tiers_id"], "client": titulaire(x["tiers_id"]),
            "membre": valeur("select numero from tiers where id = %s", (x["tiers_id"],)), "type": x["type_operation"], "typeLibelle": TYPES[x["type_operation"]],
            "compte": valeur("select numero from compte_depot where id = %s", (x["compte_id"],)) if x["compte_id"] else "",
            "montant": x["montant"], "devise": x["devise"].strip(), "montantUsd": float(x["montant_usd"]), "cumulUsd": float(x["cumul_usd"]),
            "date": valeur("select date_comptable::text from journee_comptable where id = %s", (x["journee_id"],)),
            "motifDemande": x["motif_demande"] or "", "demandePar": nom_utilisateur(x["demande_par"]), "statut": x["statut"],
            "origineFonds": x["origine_fonds"] or "", "destinationFonds": x["destination_fonds"] or "", "objet": x["objet"] or "", "acteurs": x["acteurs"] or "",
            "observations": x["observations"] or "", "examinePar": nom_utilisateur(x["examine_par"]) if x["examine_par"] else "",
            "examineLe": x["examine_le"].isoformat()[:10] if x["examine_le"] else "", "operationFaite": x["operation_id"] is not None,
            "declareLe": x["declare_le"].isoformat() if x["declare_le"] else "", "referenceDeclaration": x["reference_declaration"] or ""}


def demander(u: dict, d: dict) -> dict:
    """Le caissier transmet l'opération à la conformité : elle attend l'examen"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    try:
        cle = str(uuid.UUID(str(d.get("cle"))))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = une("select * from examen_renforce where cle_idempotence = %s", (cle,))
    if prec:
        return vue(prec)
    type_ = d.get("type")
    if type_ not in TYPES:
        raise ErreurMetier("Type d'opération inconnu.")
    tid = d.get("tiersId")
    t = une("select * from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])) if isinstance(tid, int) else None
    if not t:
        raise ErreurMetier("Client introuvable.")
    m, devise = d.get("montant"), str(d.get("devise") or "").strip()
    if not isinstance(m, int) or isinstance(m, bool) or m <= 0 or not valeur("select 1 from devise where code = %s", (devise,)):
        raise ErreurMetier("Montant ou devise invalide.")
    cid = d.get("compteId")
    if cid is not None and not valeur("select 1 from compte_depot where id = %s and tiers_id = %s", (cid, t["id"])):
        raise ErreurMetier("Compte introuvable.")
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    sens = "retrait" if type_ in SORTIES else "depot"
    usd = en_usd(m, devise)
    cumul = usd + especes_du_jour_usd(t["id"], j["id"], sens)
    if cumul < SEUIL_ESPECES_USD:
        raise ErreurMetier("Sous le seuil de 10 000 USD : pas d'examen renforcé, l'opération se fait directement.")
    if valeur("""select 1 from examen_renforce where tiers_id = %s and journee_id = %s and type_operation = %s and montant = %s and devise = %s
                 and operation_id is null and statut = 'a_examiner'""", (t["id"], j["id"], type_, m, devise)):
        raise ErreurMetier("Cette opération attend déjà l'examen de la conformité.")
    n = int(valeur("select coalesce(max(numero), 0) + 1 from examen_renforce where institution_id = %s", (u["institution_id"],)))
    eid = valeur("""insert into examen_renforce (institution_id, numero, cle_idempotence, tiers_id, journee_id, type_operation, compte_id, montant, devise,
                    montant_usd, cumul_usd, motif_demande, demande_par) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], n, cle, t["id"], j["id"], type_, cid, m, devise, round(usd, 2), round(cumul, 2),
                  str(d.get("motif") or "").strip() or None, u["id"]))
    return vue(une("select * from examen_renforce where id = %s", (eid,)))


def lister(u: dict, statut: str = "") -> list[dict]:
    exiger(u)
    if statut and statut not in ("a_examiner", "autorise", "refuse", "a_declarer"):
        raise ErreurMetier("Statut inconnu.")
    # À déclarer : l'opération autorisée (rapport à la CENAREF : Instr. BCC 15 bis, art. 7) et l'opération refusée, qui est une tentative
    # (loi 22/068, art. 92 : « il en va de même pour les tentatives d'opérations suspectes » ; confrontation du 21/11/2026, E6)
    filtre = {"": "true", "a_declarer": "statut in ('autorise', 'refuse') and declare_le is null"}.get(statut, "statut = %(s)s")
    return [vue(x) for x in lignes(f"select * from examen_renforce where institution_id = %(i)s and {filtre} order by numero desc",
                                   {"i": u["institution_id"], "s": statut})]


def examiner(u: dict, eid: int, d: dict) -> dict:
    """Instr. BCC 15, art. 61 : vérification de l'origine et de la destination des fonds, objet de l'opération, acteurs économiques.
    Une autre personne que celle qui a demandé (Instr. BCC 008, art. 66)."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    x = une("select * from examen_renforce where id = %s and institution_id = %s for update", (eid, u["institution_id"]))
    if not x or x["statut"] != "a_examiner":
        raise ErreurMetier("Cet examen n'est plus en attente.")
    if x["demande_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : l'examen vient d'une autre personne que celle qui l'a demandé.")
    decision = d.get("decision")
    if decision not in ("autorise", "refuse"):
        raise ErreurMetier("Décision : autoriser ou refuser.")
    t = lambda k: str(d.get(k) or "").strip()
    manque = [n for k, n in (("origineFonds", "Origine des fonds"), ("destinationFonds", "Destination des fonds"), ("objet", "Objet de l'opération")) if not t(k)]
    if manque:
        raise ErreurMetier("À remplir (Instr. BCC 15, art. 61) : " + ", ".join(manque) + ".")
    if decision == "refuse" and not t("observations"):
        raise ErreurMetier("À remplir : observations (motif du refus).")
    executer("""update examen_renforce set statut = %s, origine_fonds = %s, destination_fonds = %s, objet = %s, acteurs = %s, observations = %s,
                examine_par = %s, examine_le = now() where id = %s""",
             (decision, t("origineFonds"), t("destinationFonds"), t("objet"), t("acteurs") or None, t("observations") or None, u["id"], eid))
    return vue(une("select * from examen_renforce where id = %s", (eid,)))


def declarer(u: dict, eid: int, d: dict) -> dict:
    """Loi 25/048, art. 92 bis ; Instr. BCC 15 bis, art. 7 : le rapport confidentiel est transmis à la CENAREF ; on note la date et la référence"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    x = une("select * from examen_renforce where id = %s and institution_id = %s for update", (eid, u["institution_id"]))
    if not x or x["statut"] == "a_examiner":
        raise ErreurMetier("Examiner d'abord l'opération.")
    if x["declare_le"]:
        raise ErreurMetier("Déclaration déjà notée.")
    date, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    j = journee_courante(u)
    import re
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        raise ErreurMetier("À remplir : date de la déclaration.")
    if j and date > j["date"]:
        raise ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.")
    if not ref:
        raise ErreurMetier("À remplir : référence de la déclaration (accusé de la CENAREF).")
    executer("update examen_renforce set declare_le = %s, reference_declaration = %s, declare_par = %s where id = %s", (date, ref, u["id"], eid))
    return vue(une("select * from examen_renforce where id = %s", (eid,)))


def rapport(u: dict, eid: int) -> dict:
    """Instr. BCC 15, art. 62 : rapport écrit, strictement confidentiel, gardé 10 ans (art. 48)"""
    from .releves import client, entete
    exiger(u)
    x = une("select * from examen_renforce where id = %s and institution_id = %s", (eid, u["institution_id"]))
    if not x:
        raise ErreurMetier("Examen introuvable.")
    return {"entete": entete(u["institution_id"]), "client": client(x["tiers_id"]), "examen": vue(x)}


# ---------- Écart E02 : personnes politiquement exposées (Instr. BCC 15, art. 41, 60, 64, 65 ; Instr. BCC 52, art. 26) ----------
MOIS_FIN_PPE = 36      # Instr. BCC 15, art. 64, dernier alinéa


# P6 : catégories et qualités de la personne politiquement exposée (Instr. BCC 15, art. 5), une seule copie lue aussi par le navigateur
QUALITES_PPE = json.loads((settings.RACINE_DEPOT / "replica" / "ppe-qualites.json").read_text(encoding="utf-8"))


def ppe_qualites(u: dict) -> dict:
    from .services import exiger
    exiger(u)
    return QUALITES_PPE


def _ppe_personne(tid: int) -> bool:
    """Exposée : case cochée sur la fiche, et pas de fonction terminée depuis plus de 36 mois"""
    if not valeur("select personne_exposee from tiers where id = %s", (tid,)):
        return False
    fin = valeur("select fin_fonction from dossier_ppe where tiers_id = %s", (tid,))
    return not (fin and valeur("select %s::date + interval '36 months' < current_date", (fin,)))


def ppe_active(tid: int) -> bool:
    """Le client lui-même, ou un de ses bénéficiaires effectifs : « déterminer si le client ou un bénéficiaire effectif du client est une
    personne politiquement exposée » (loi 22/068, art. 53 ; confrontation du 21/11/2026, E3)"""
    # E3 : le dirigeant, tenu pour bénéficiaire effectif faute d'autre (art. 34 bis, 3°), coché « personne exposée » sur sa fiche
    return _ppe_personne(tid) or any(_ppe_personne(r["autre_id"]) for r in lignes(
        "select autre_id from lien_tiers where tiers_id = %s and role = 'beneficiaire_effectif'", (tid,))) or bool(valeur(
        "select 1 from representant where tiers_id = %s and role = 'dirigeant' and personne_exposee and retire_le is null", (tid,)))


def exiger_autorisation_ppe(tid: int) -> None:
    """Appelé par le visa (S40) et la validation d'un client modifié (S42) : la conformité autorise d'abord (art. 64)"""
    if ppe_active(tid) and not valeur("select 1 from dossier_ppe where tiers_id = %s and autorise_par is not null", (tid,)):
        raise ErreurMetier("Personne politiquement exposée, le client ou un de ses bénéficiaires effectifs (loi 22/068, art. 53) : "
                           "l'autorisation de la conformité vient avant le visa (Instr. BCC 15, art. 64). "
                           "Client > Conformité > Examen renforcé, onglet Personnes exposées.")


def vue_ppe(t: dict) -> dict:
    d = une("select * from dossier_ppe where tiers_id = %s", (t["id"],)) or {}
    return {"tiersId": t["id"], "membre": t["numero"], "client": titulaire(t["id"]), "statutClient": t["statut"], "exposee": ppe_active(t["id"]),
            "categorie": d.get("categorie") or "", "qualite": d.get("qualite") or "",   # P6
            "fonction": d.get("fonction") or "", "finFonction": d["fin_fonction"].isoformat() if d.get("fin_fonction") else "",
            "originePatrimoine": d.get("origine_patrimoine") or "", "saisiPar": nom_utilisateur(d["saisi_par"]) if d.get("saisi_par") else "",
            "autorisePar": nom_utilisateur(d["autorise_par"]) if d.get("autorise_par") else "",
            "autoriseLe": d["autorise_le"].isoformat()[:10] if d.get("autorise_le") else "",
            "informeLe": d["informe_le"].isoformat() if d.get("informe_le") else "", "referenceCenaref": d.get("reference_cenaref") or ""}


def ppe_lister(u: dict) -> list[dict]:
    exiger(u)
    return [vue_ppe(t) for t in lignes("""select id, numero, statut from tiers t where institution_id = %s and (personne_exposee or exists (
                                              select 1 from lien_tiers l join tiers b on b.id = l.autre_id
                                              where l.tiers_id = t.id and l.role = 'beneficiaire_effectif' and b.personne_exposee)
                                          or exists (select 1 from representant r where r.tiers_id = t.id and r.role = 'dirigeant' and r.personne_exposee
                                                     and r.retire_le is null)) order by numero""", (u["institution_id"],))]


def ppe_enregistrer(u: dict, tid: int, d: dict) -> dict:
    """Fonction, fin de fonction, origine du patrimoine et des fonds (art. 41, 64) ; « autoriser » donne l'accord de la conformité, par une autre
    personne que celle qui a saisi le dossier (Instr. BCC 008, art. 66)"""
    import re
    exiger(u)
    d = d if isinstance(d, dict) else {}
    t = une("select id, numero, statut, personne_exposee from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t or not (t["personne_exposee"] or ppe_active(tid)):
        raise ErreurMetier("Ni ce client ni un de ses bénéficiaires effectifs n'est inscrit comme personne politiquement exposée (case de la fiche).")
    x = une("select * from dossier_ppe where tiers_id = %s for update", (tid,))
    if d.get("autoriser"):
        if not x:
            raise ErreurMetier("Saisir d'abord le dossier : fonction et origine du patrimoine.")
        if x["autorise_par"]:
            raise ErreurMetier("Autorisation déjà donnée.")
        if x["saisi_par"] == u["id"]:
            raise ErreurMetier("Quatre yeux : l'autorisation vient d'une autre personne que celle qui a saisi le dossier.")
        executer("update dossier_ppe set autorise_par = %s, autorise_le = now() where tiers_id = %s", (u["id"], tid))
        return vue_ppe(t)
    f, o, fin = str(d.get("fonction") or "").strip(), str(d.get("originePatrimoine") or "").strip(), str(d.get("finFonction") or "").strip()
    manque = [n for v, n in ((f, "Fonction exercée"), (o, "Origine du patrimoine et des fonds")) if not v]
    if manque:
        raise ErreurMetier("À remplir (Instr. BCC 15, art. 41 et 64) : " + ", ".join(manque) + ".")
    # P6 : catégorie et qualité de la liste de l'Instr. BCC 15, art. 5 (replica/ppe-qualites.json)
    cat, qual = str(d.get("categorie") or "").strip(), str(d.get("qualite") or "").strip()
    if cat not in QUALITES_PPE["qualites"] or qual not in QUALITES_PPE["qualites"][cat]:
        raise ErreurMetier("À remplir : catégorie et qualité de la personne exposée, dans la liste de l'Instr. BCC 15, art. 5.")
    if fin and not re.match(r"^\d{4}-\d{2}-\d{2}$", fin):
        raise ErreurMetier("Fin de la fonction : date invalide.")
    if x and x["autorise_par"]:
        raise ErreurMetier("Dossier autorisé : il ne se modifie plus.")
    if x:
        executer("""update dossier_ppe set fonction = %s, fin_fonction = %s, origine_patrimoine = %s, categorie = %s, qualite = %s, saisi_par = %s, saisi_le = now()
                    where tiers_id = %s""", (f, fin or None, o, cat, qual, u["id"], tid))
    else:
        executer("insert into dossier_ppe (tiers_id, fonction, fin_fonction, origine_patrimoine, categorie, qualite, saisi_par) values (%s, %s, %s, %s, %s, %s, %s)",
                 (tid, f, fin or None, o, cat, qual, u["id"]))
    return vue_ppe(t)


def ppe_informer(u: dict, tid: int, d: dict) -> dict:
    """Art. 65 : toute information sur la PPE est communiquée à la CENAREF, même sans soupçon ; on note la date et la référence"""
    import re
    exiger(u)
    d = d if isinstance(d, dict) else {}
    t = une("select id, numero, statut from tiers where id = %s and institution_id = %s", (tid, u["institution_id"]))
    x = une("select * from dossier_ppe where tiers_id = %s for update", (tid,)) if t else None
    if not x:
        raise ErreurMetier("Saisir d'abord le dossier.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_) or not ref:
        raise ErreurMetier("À remplir : date et référence de l'information à la CENAREF.")
    executer("update dossier_ppe set informe_le = %s, reference_cenaref = %s where tiers_id = %s", (date_, ref, tid))
    return vue_ppe(t)


# Écart E08 : profil de risque du client. Instr. BCC 15, art. 28 (profilage évalué chaque semestre), art. 27 et 51 (données d'identification revues),
# art. 6 et 32 (niveaux), art. 41 al. 3 (personne politiquement exposée : vigilance renforcée). Mêmes règles que web/src/donnees/api.ts (profils).
NIVEAUX = {"faible": "Faible", "moyen": "Moyen", "eleve": "Élevé"}
MOIS_REVUE = 6      # art. 28 : « semestriellement »


def _jour(u: dict) -> str:
    j = journee_courante(u)
    return j["date"] if j else valeur("select current_date::text")


def vue_profil(t: dict, jour: str) -> dict:
    p = une("select * from profil_risque where tiers_id = %s order by evalue_le desc, id desc limit 1", (t["id"],)) or {}
    prochaine = valeur("select (%s::date + interval '6 months')::date::text", (p["evalue_le"],)) if p else ""
    return {"tiersId": t["id"], "membre": t["numero"], "client": titulaire(t["id"]), "exposee": ppe_active(t["id"]),
            "niveau": p.get("niveau") or "", "niveauLibelle": NIVEAUX.get(p.get("niveau") or "", ""), "motif": p.get("motif") or "",
            "evalueLe": p["evalue_le"].isoformat() if p else "", "evaluePar": nom_utilisateur(p["evalue_par"]) if p else "",
            "prochaineRevue": prochaine, "echue": not p or prochaine <= jour}


def profils_lister(u: dict, filtre: str = "echues") -> list[dict]:
    """Clients en relation (visés) ; « échues » : jamais évalués, ou dernière évaluation de six mois ou plus"""
    exiger(u)
    jour = _jour(u)
    vues = [vue_profil(t, jour) for t in lignes("select id, numero from tiers where institution_id = %s and statut in ('actif', 'modifie_a_revalider') order by numero",
                                                (u["institution_id"],))]
    return [v for v in vues if v["echue"]] if filtre == "echues" else vues


def profil_evaluer(u: dict, tid: int, d: dict) -> dict:
    exiger(u)
    d = d if isinstance(d, dict) else {}
    t = une("select id, numero, statut from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t or t["statut"] not in ("actif", "modifie_a_revalider"):
        raise ErreurMetier("Client introuvable ou pas encore visé.")
    niveau, motif = str(d.get("niveau") or ""), str(d.get("motif") or "").strip()
    manque = [n for v, n in ((niveau in NIVEAUX, "Niveau de risque"), (motif, "Motif")) if not v]
    if manque:
        raise ErreurMetier("À remplir (Instr. BCC 15, art. 28) : " + ", ".join(manque) + ".")
    if d.get("donneesRevues") is not True:
        raise ErreurMetier("Revoir d'abord les données d'identification du client (Instr. BCC 15, art. 27 et 51).")
    if ppe_active(tid) and niveau != "eleve":
        raise ErreurMetier("Personne politiquement exposée : niveau Élevé, la vigilance est renforcée (Instr. BCC 15, art. 41).")
    jour = _jour(u)
    executer("insert into profil_risque (tiers_id, niveau, motif, donnees_revues, evalue_le, evalue_par) values (%s, %s, %s, true, %s, %s)",
             (tid, niveau, motif, jour, u["id"]))
    return vue_profil(t, jour)
