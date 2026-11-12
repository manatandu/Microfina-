"""Règles métier de la tranche verticale, transposées de web/src/donnees/api.ts (même logique, même messages).
Chaque fonction s'exécute dans la transaction de la requête (ATOMIC_REQUESTS) : tout ou rien.
Les montants sont des entiers en unités mineures (ARCHITECTURE P4) ; les coupures arrivent en unités."""
import json
import re
import uuid

from psycopg.types.json import Jsonb
from datetime import date

from django.conf import settings

from .bd import ErreurMetier, executer, lignes, une, valeur

# Seuils, valeurs des maquettes
SEUIL_ESPECES_USD = 10000    # examen renforcé : loi 22/068, art. 23 ; Instr. BCC 15, art. 61 ; Instr. BCC 15 bis, art. 1
DEVISES = ("CDF", "USD")
SORTIES = ("retrait", "retrait_parts")      # opérations qui font sortir des billets de la caisse
TYPES_CLIENT = ["Client"]
# Type entreprise (p. 50) : la liste de Microfina++ n'est pas montrée. À confirmer ; en attendant, les agents économiques du PCCI § 10.2 (hors ménages)
TYPES_ENTREPRISE = ["Banques commerciales et autres intermédiaires financiers", "Organes faîtiers et autres institutions de microfinance",
                    "Autres COOPEC et IMF", "Institutions financières non bancaires", "Administration centrale", "Administrations provinciales ou locales",
                    "Entreprises publiques", "Entreprises privées", "Institutions sans but lucratif"]
# Type de groupe : « les groupements, les associations ou les ONG » (manuel p. 47). Agent économique (PCCI § 10.2) : associations et ONG
# sont des institutions sans but lucratif ; pour un groupement, à confirmer.
TYPES_GROUPE = {"Groupement": None, "Association": "Institutions sans but lucratif", "ONG": "Institutions sans but lucratif"}
# Pièces d'identité admises : Instr. BCC 15, art. 14
PIECES = ["Passeport", "Carte d'identité nationale", "Permis de conduire", "Carte d'étudiant", "Carte de l'armée ou de la police", "Carte d'électeur",
          "Lettre certifiée du chef de village ou de quartier", "Liste des bénéficiaires de programmes sociaux", "Carte de réfugié"]          # seul type montré par le manuel (p. 49) ; la liste viendra du paramétrage S16
IMAGE_MAX = 400_000                # caractères de l'image encodée, environ 300 Ko
IMAGE_OK = re.compile(r"^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$")
LIBELLES_ROLES = {"caissier": "caissier", "chef_agence": "chef d'agence", "agent_credit": "agent de crédit", "comptable": "comptable"}
MSG_RENFORCE = ("Examen renforcé requis (10 000 USD ou plus en espèces dans la journée). "
                "Le circuit de conformité n'est pas encore construit : opération bloquée.")


# ---------- Session et utilisateur ----------

def charger_utilisateur(uid: int | None) -> dict | None:
    if not uid:
        return None
    u = une("select id, login, nom, institution_id, agence_id from utilisateur where id = %s and actif", (uid,))
    if not u:
        return None
    u["roles"] = [r["nom"] for r in lignes(
        "select p.nom from utilisateur_profil up join profil p on p.id = up.profil_id where up.utilisateur_id = %s order by p.nom", (uid,))]
    return u


def vue_utilisateur(u: dict) -> dict:
    return {"id": u["id"], "login": u["login"], "nom": u["nom"], "roles": u["roles"]}


def exiger(u: dict | None, role: str | None = None) -> dict:
    if not u:
        raise ErreurMetier("Session fermée. Reconnectez-vous.", 401)
    if role and role not in u["roles"]:
        raise ErreurMetier(f"Réservé au profil « {LIBELLES_ROLES[role]} ».", 403)
    return u


def ouvrir_session(login: str, mot_de_passe: str | None) -> dict:
    u = une("select id from utilisateur where login = %s and actif", (login.strip(),))
    if not u:
        raise ErreurMetier("Identifiant inconnu.")
    if not settings.SANS_MOT_DE_PASSE:
        raise ErreurMetier("Vérification du mot de passe pas encore branchée.")   # à faire avec la décision du porteur
    return charger_utilisateur(u["id"])


def utilisateurs() -> list[dict]:
    return [vue_utilisateur(charger_utilisateur(r["id"])) for r in lignes("select id from utilisateur where actif order by id")]


def nom_utilisateur(uid: int | None) -> str:
    return valeur("select nom from utilisateur where id = %s", (uid,)) or "" if uid else ""


# ---------- Référentiel ----------

def institution_de(u: dict) -> dict:
    return une("select * from institution where id = %s", (u["institution_id"],))


def cours_usd(jour: date | None = None) -> float:
    c = valeur("select cours from cours_change where devise = 'USD' and jour <= coalesce(%s, current_date) order by jour desc limit 1", (jour,))
    if c is None:
        raise ErreurMetier("Aucun cours du dollar saisi.")
    return float(c)


def valeur_part() -> int:
    v = valeur("select valeur from parametre_reglementaire where cle = 'valeur_part' and date_effet <= current_date order by date_effet desc limit 1")
    if v is None:
        raise ErreurMetier("Valeur de la part non paramétrée (statuts).")
    return int(json_lu(v))


def contexte(u: dict) -> dict:
    i = institution_de(u)
    a = une("select id, code, nom from agence where id = %s", (u["agence_id"],))
    return {
        "institution": {"nom": i["nom"], "profil": "coopec" if i["profil"] == "coopec" else "imf"},
        "agence": a,
        "guichets": lignes("select id, code, nom from guichet where agence_id = %s and actif order by code", (u["agence_id"],)),
        "produits": lignes("select code, libelle, devise from produit_epargne where institution_id = %s order by code", (u["institution_id"],)),
        "zones": [z["nom"] for z in lignes("select nom from zone where institution_id = %s order by nom", (u["institution_id"],))],
        "typesClient": TYPES_CLIENT,
        "typesEntreprise": TYPES_ENTREPRISE,
        "typesGroupe": list(TYPES_GROUPE),
        "pieces": PIECES,
        "professions": [r["libelle"] for r in lignes("select libelle from profession where institution_id = %s order by libelle", (u["institution_id"],))],
        "localites": localites(),
        "motifsDepart": [r["libelle"] for r in lignes("select libelle from liste_reference where institution_id = %s and liste = 'motif_depart' and actif order by id", (u["institution_id"],))],
        "cours": {"USD": cours_usd()},
        "valeurPart": valeur_part(),
        "utilisateurs": utilisateurs(),
    }


# ---------- Journées ----------

def vue_journee(j: dict | None) -> dict | None:
    if not j:
        return None
    return {"id": j["id"], "date": j["date_comptable"].isoformat(), "statut": j["statut"], "ouvertePar": j["ouverte_par"], "fermeePar": j["fermee_par"],
            "ouverteLe": j["ouverte_le"].astimezone().isoformat(timespec="seconds") if j.get("ouverte_le") else None,
            "fermeeLe": j["fermee_le"].astimezone().isoformat(timespec="seconds") if j.get("fermee_le") else None}


def journees(u: dict) -> list[dict]:
    """S12 (manuel p. 21) : liste des journées de l'agence, la plus récente d'abord"""
    exiger(u)
    return [vue_journee(j) for j in lignes("select * from journee_comptable where agence_id = %s order by date_comptable desc", (u["agence_id"],))]


def journee_courante(u: dict) -> dict | None:
    return vue_journee(une("select * from journee_comptable where agence_id = %s order by date_comptable desc limit 1", (u["agence_id"],)))


def ouvrir_journee(u: dict, jour: str) -> dict:
    exiger(u, "chef_agence")
    # Registre S12-4 : pas de journée suivante tant qu'un guichet d'une journée précédente est ouvert ; le message nomme les guichets
    restes = lignes("""select g.nom, j.date_comptable from session_caisse s join guichet g on g.id = s.guichet_id
                       join journee_comptable j on j.id = s.journee_id
                       where j.agence_id = %s and s.statut = 'ouverte' and s.fermee_le is null order by g.code""", (u["agence_id"],))
    if restes:
        raise ErreurMetier("Guichet encore ouvert : " + ", ".join(f"{r['nom']} ({fr(r['date_comptable'].isoformat())})" for r in restes)
                           + ". Le fermer d'abord (Administration > Guichet > Ouverture/Fermeture).")
    if une("select 1 from journee_comptable where agence_id = %s and statut <> 'fermee'", (u["agence_id"],)):
        raise ErreurMetier("Une journée est déjà ouverte dans cette agence.")
    e = une("select * from exercice where institution_id = %s and annee = %s", (u["institution_id"], int(str(jour)[:4])))
    if not e or not e["ouvert"] or e["valide"]:
        # Registre S11-2 et S12-1 : une journée ne s'ouvre que dans un exercice ouvert et non validé (S11)
        raise ErreurMetier(f"L'exercice {str(jour)[:4]} n'est pas ouvert (Administration > Exercice).")
    derniere = journee_courante(u)
    if derniere and jour <= derniere["date"]:
        raise ErreurMetier(f"La date doit suivre la dernière journée ({fr(derniere['date'])}).")
    jid = valeur("insert into journee_comptable (agence_id, date_comptable, statut, ouverte_par) values (%s, %s, 'ouverte', %s) returning id",
                 (u["agence_id"], jour, u["id"]))
    return vue_journee(une("select * from journee_comptable where id = %s", (jid,)))


def controles_journee(jid: int) -> list[dict]:
    ses = lignes("select s.*, g.nom as guichet from session_caisse s join guichet g on g.id = s.guichet_id where s.journee_id = %s", (jid,))
    ouvertes = [s for s in ses if s["statut"] != "arretee"]
    arrets = lignes("select b.* from billetage b join session_caisse s on s.id = b.session_caisse_id where s.journee_id = %s and b.moment = 'arret'", (jid,))
    non_valides = [b for b in arrets if not b["valide_par"]]
    ecarts = [b for b in arrets if total_lignes(b["id"]) != total_comptage(b["theorique"])]
    attente = valeur("select count(*) from operation o join session_caisse s on s.id = o.session_caisse_id where s.journee_id = %s and o.statut in ('saisie', 'visee')", (jid,))
    nb_ecr = valeur("select count(*) from ecriture where journee_id = %s", (jid,))
    deseq = valeur("""select count(*) from (select e.id from ecriture e join ligne_ecriture l on l.ecriture_id = e.id where e.journee_id = %s
                      group by e.id having sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) <> 0) x""", (jid,))
    pl = lambda n, s="s": s if n > 1 else ""
    return [
        {"titre": "Caisses arrêtées", "etat": "ko" if ouvertes else "ok", "source": "ARCHITECTURE § 6",
         "detail": f"Encore ouvertes : {', '.join(s['guichet'] for s in ouvertes)}." if ouvertes else (f"{len(ses)} caisse{pl(len(ses))} arrêtée{pl(len(ses))}." if ses else "Aucune caisse ouverte aujourd'hui.")},
        {"titre": "Billetages d'arrêt validés", "etat": "ko" if non_valides else "ok", "source": "ARCHITECTURE § 6",
         "detail": f"{len(non_valides)} billetage{pl(len(non_valides))} à valider par le chef d'agence." if non_valides else "Tous validés."},
        {"titre": "Caisses sans écart", "etat": "ko" if ecarts else "ok", "source": "ARCHITECTURE § 6 ; compte d'écart à confirmer",
         "detail": "Écart constaté et justifié, mais son écriture n'est pas encore définie (compte à confirmer). Recompter ou attendre la règle." if ecarts else "Le compté égale le théorique partout."},
        {"titre": "Opérations en attente de visa", "etat": "ko" if attente else "ok", "source": "ARCHITECTURE P7",
         "detail": f"{attente} opération{pl(attente)} à viser ou refuser." if attente else "Aucune."},
        {"titre": "Écritures équilibrées", "etat": "ko" if deseq else "ok", "source": "PCCI § 3.2",
         "detail": f"{nb_ecr} écriture{pl(nb_ecr)} du jour, toutes équilibrées en CDF et par devise."},
        {"titre": "Traitements de fin de journée", "etat": "info", "source": "Instr. BCC 003, art. 6 ; ARCHITECTURE § 6",
         "detail": "Intérêts, retards et reclassements : rien à calculer tant que l'épargne rémunérée et le crédit ne sont pas construits."},
    ]


def fermer_journee(u: dict, jid: int) -> dict:
    exiger(u, "chef_agence")
    bloquants = [c for c in controles_journee(jid) if c["etat"] == "ko"]
    if bloquants:
        raise ErreurMetier("Fermeture impossible : " + " ; ".join(c["titre"].lower() for c in bloquants) + ".")
    executer("update journee_comptable set statut = 'fermee', fermee_par = %s, fermee_le = now() where id = %s", (u["id"], jid))
    return vue_journee(une("select * from journee_comptable where id = %s", (jid,)))


# ---------- Coupures et billetages ----------

def json_lu(v):
    """Django rend le jsonb sous forme de texte : on le décode ici, un seul endroit."""
    return json.loads(v) if isinstance(v, str) else v


def total_comptage(c: dict) -> int:
    c = json_lu(c)
    return sum(int(v) * 100 * int(n or 0) for v, n in (c or {}).items())


def total_lignes(bid: int) -> int:
    return int(valeur("select coalesce(sum(valeur * nombre), 0) from billetage_ligne where billetage_id = %s", (bid,)))


def comptage_billetage(bid: int) -> dict:
    return {str(r["valeur"] // 100): r["nombre"] for r in lignes("select valeur, nombre from billetage_ligne where billetage_id = %s and nombre > 0", (bid,))}


def nettoyer(c: dict) -> dict:
    return {str(int(v)): int(n) for v, n in (c or {}).items() if int(n or 0) > 0}


def vue_session(s: dict | None) -> dict | None:
    if not s:
        return None
    statut = "fermee" if s["statut"] == "ouverte" and s.get("fermee_le") else s["statut"]   # Fermeture du guichet (S09, p. 19)
    return {"id": s["id"], "guichetId": s["guichet_id"], "journeeId": s["journee_id"], "caissierId": s["caissier_id"], "statut": statut}


def sessions_journee(jid: int) -> list[dict]:
    return [vue_session(s) for s in lignes("select * from session_caisse where journee_id = %s order by id", (jid,))]


def session_du_caissier(u: dict) -> dict | None:
    j = journee_courante(u)
    if not j:
        return None
    return vue_session(une("select * from session_caisse where journee_id = %s and caissier_id = %s order by id desc limit 1", (j["id"], u["id"])))


def ouvrir_caisse(u: dict, guichet_id: int, journee_id: int | None = None) -> dict:
    exiger(u, "caissier")
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("La journée n'est pas ouverte. Le chef d'agence l'ouvre d'abord.")
    if journee_id is not None and journee_id != j["id"]:
        raise ErreurMetier("Seule la dernière journée ouverte reçoit des opérations.")   # registre T14
    deja = une("select * from session_caisse where journee_id = %s and guichet_id = %s for update", (j["id"], guichet_id))
    if deja:
        # Registre S09-6 : réouverture le même jour, tant que le billetage n'est pas validé
        if deja["statut"] == "ouverte" and not deja["fermee_le"]:
            raise ErreurMetier("Ce guichet est déjà ouvert aujourd'hui.")
        if deja["statut"] == "arretee" or une("select 1 from billetage where session_caisse_id = %s and valide_par is not null", (deja["id"],)):
            raise ErreurMetier("Le billetage de ce guichet est validé : il ne se rouvre plus aujourd'hui.")
        if deja["caissier_id"] != u["id"]:
            raise ErreurMetier("Ce guichet a été tenu aujourd'hui par un autre utilisateur.")
        executer("update session_caisse set fermee_le = null, fermee_par = null where id = %s", (deja["id"],))
        return vue_session(une("select * from session_caisse where id = %s", (deja["id"],)))
    if une("select 1 from session_caisse where journee_id = %s and caissier_id = %s and statut = 'ouverte' and fermee_le is null", (j["id"], u["id"])):
        raise ErreurMetier("Vous tenez déjà une caisse ouverte.")
    if not une("select 1 from affectation_guichet where utilisateur_id = %s and guichet_id = %s and fin is null", (u["id"], guichet_id)):
        raise ErreurMetier("Ce guichet ne vous est pas affecté (Administration > Guichet > Affectation).")   # registre S09-4
    sid = valeur("insert into session_caisse (guichet_id, journee_id, caissier_id, statut) values (%s, %s, %s, 'ouverte') returning id", (guichet_id, j["id"], u["id"]))
    return vue_session(une("select * from session_caisse where id = %s", (sid,)))


def theorique(session_id: int, devise: str) -> dict:
    """Coupures que la caisse devrait contenir (« Solde Caisse », S79) : fonds du dernier arrêté validé de ce guichet,
    plus les entrées, moins les sorties de la journée."""
    s = une("select * from session_caisse where id = %s", (session_id,))
    veille = une("""select b.id from billetage b join session_caisse s on s.id = b.session_caisse_id
                    where s.guichet_id = %s and b.moment = 'arret' and b.devise = %s and b.valide_par is not null and s.id <> %s
                    order by b.valide_le desc nulls last, b.id desc limit 1""", (s["guichet_id"], devise, session_id))
    base = {int(k): v for k, v in (comptage_billetage(veille["id"]) if veille else {}).items()}
    for r in lignes("""select o.type, c.valeur, c.nombre from operation o join operation_coupure c on c.operation_id = o.id
                       where o.session_caisse_id = %s and o.statut = 'validee' and o.devise = %s""", (session_id, devise)):
        signe = -1 if r["type"] in SORTIES else 1
        base[r["valeur"] // 100] = base.get(r["valeur"] // 100, 0) + signe * r["nombre"]
    return {str(k): v for k, v in base.items() if v}


def vue_billetage(b: dict) -> dict:
    return {"id": b["id"], "sessionId": b["session_caisse_id"], "moment": b["moment"], "devise": b["devise"].strip(),
            "compte": comptage_billetage(b["id"]), "theorique": json_lu(b["theorique"]) or {}, "justification": b["justification"],
            "bonCaisse": b["bon_caisse"], "saisiPar": b["saisi_par"], "validePar": b["valide_par"]}


def billetages(session_id: int) -> list[dict]:
    return [vue_billetage(b) for b in lignes("select * from billetage where session_caisse_id = %s order by id", (session_id,))]


def controler_coupures(c: dict, devise: str):
    for v in c:
        if not une("select 1 from coupure where devise = %s and valeur = %s", (devise, int(v) * 100)):
            raise ErreurMetier("Coupure inconnue.")


def saisir_billetage(u: dict, session_id: int, devise: str, compte: dict, bon_caisse: int = 0) -> dict:
    """S79 : Caisse > Billetage > Enregistrer de billetage (manuel p. 90 et 91) : « Arretée de » la caisse, coupures, Bon de Caisse."""
    exiger(u, "caissier")
    s = une("select * from session_caisse where id = %s for update", (session_id,))
    if not s or s["caissier_id"] != u["id"]:
        raise ErreurMetier("Cette caisse n'est pas la vôtre.")
    if s["statut"] == "arretee":
        raise ErreurMetier("Caisse déjà arrêtée.")
    if une("select 1 from operation where session_caisse_id = %s and statut in ('saisie', 'visee')", (session_id,)):
        raise ErreurMetier("Une opération attend un visa : la faire viser ou refuser avant l'arrêté.")
    compte = nettoyer(compte)
    controler_coupures(compte, devise)
    bon = int(bon_caisse or 0)
    if bon < 0:
        raise ErreurMetier("Bon de Caisse invalide.")
    th = theorique(session_id, devise)
    deja = une("select * from billetage where session_caisse_id = %s and moment = 'arret' and devise = %s", (session_id, devise))
    if deja and deja["valide_par"]:
        raise ErreurMetier("Billetage déjà validé.")
    if deja:
        bid = deja["id"]
        executer("update billetage set theorique = %s, bon_caisse = %s, saisi_par = %s where id = %s", (Jsonb(th), bon, u["id"], bid))
        executer("delete from billetage_ligne where billetage_id = %s", (bid,))
    else:
        bid = valeur("""insert into billetage (session_caisse_id, moment, devise, saisi_par, theorique, bon_caisse)
                        values (%s, 'arret', %s, %s, %s, %s) returning id""", (session_id, devise, u["id"], Jsonb(th), bon))
    for v, n in compte.items():
        executer("insert into billetage_ligne (billetage_id, devise, valeur, nombre) values (%s, %s, %s, %s)", (bid, devise, int(v) * 100, n))
    return vue_billetage(une("select * from billetage where id = %s", (bid,)))


def valider_billetage(u: dict, bid: int) -> dict:
    exiger(u, "chef_agence")
    b = une("select * from billetage where id = %s for update", (bid,))
    if not b:
        raise ErreurMetier("Billetage introuvable.")
    if b["valide_par"]:
        raise ErreurMetier("Ce billetage est déjà validé.")
    if b["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : le valideur n'est pas celui qui a compté.")
    executer("update billetage set valide_par = %s, valide_le = now() where id = %s", (u["id"], bid))
    if b["moment"] == "arret":
        n = valeur("select count(distinct devise) from billetage where session_caisse_id = %s and moment = 'arret' and valide_par is not null", (b["session_caisse_id"],))
        if n == len(DEVISES):
            executer("update session_caisse set statut = 'arretee', arretee_le = now() where id = %s", (b["session_caisse_id"],))
    return vue_billetage(une("select * from billetage where id = %s", (bid,)))


def billetages_a_valider(u: dict) -> list[dict]:
    j = journee_courante(u)
    if not j:
        return []
    return [vue_billetage(b) for b in lignes("""select b.* from billetage b join session_caisse s on s.id = b.session_caisse_id
                                               where s.journee_id = %s and b.valide_par is null order by b.id""", (j["id"],))]


# ---------- Tiers ----------

def vue_representant(r: dict) -> dict:
    return {"nom": r["nom"], "postnom": r["postnom"] or "", "prenom": r["prenom"] or "", "pieceType": r["piece_type"], "pieceNumero": r["piece_numero"],
            "pieceExpire": iso(r["piece_validite"]), "photo": bool(r["photo"]), "specimen": bool(r["signature"])}


def vue_tiers(t: dict) -> dict:
    sp = une("select photo, signature from specimen where tiers_id = %s order by id desc limit 1", (t["id"],))
    reps = lignes("select * from representant where tiers_id = %s order by id", (t["id"],))
    signataires = [vue_representant(r) for r in reps if r["role"] == "signataire"]
    dirigeant = next((vue_representant(r) for r in reps if r["role"] == "dirigeant"), None)
    membres = [vue_representant(r) for r in reps if r["role"] == "membre"]
    return {"id": t["id"], "numero": t["numero"], "statut": t["statut"], "nom": t["nom"], "postnom": t["postnom"] or "", "prenom": t["prenom"] or "",
            "sexe": t["sexe"] or "", "naissance": t["date_naissance"].isoformat() if t["date_naissance"] else "",
            "pieceType": t["piece_type"] or "", "pieceNumero": t["piece_numero"] or "",
            "pieceExpire": t["piece_validite"].isoformat() if t["piece_validite"] else "",
            "adresse": t["adresse"] or "", "telephone": t["telephone"] or "", "personneExposee": t["personne_exposee"],
            "dateDemande": iso(t["date_demande"]), "numeroManuel": t["numero_manuel"] or "", "matricule": t["matricule"] or "", "typeClient": t["type_client"] or "",
            "zone": t["zone_nom"] or "", "produitCode": t["produit_code"] or "", "premierDepot": t["premier_depot"] or 0, "resident": t["residence"] != "non_resident",
            "preleverAgios": t["prelever_agios"], "calculerInteret": t["calculer_interet"],
            "lieuNaissance": t["lieu_naissance"] or "", "pieceDelivreeLe": iso(t["piece_delivree_le"]), "pieceLieu": t["piece_lieu"] or "", "pieceAutorite": t["piece_autorite"] or "",
            "liees": [r["autre_id"] for r in lignes("select autre_id from lien_tiers where tiers_id = %s and role = 'personne_liee' order by id", (t["id"],))],
            "intitule": t["intitule"] or "", "dateVisa": iso(t["date_visa"]), "creeLe": t["cree_le"].date().isoformat(), "motifDepart": t["motif_depart"] or "", "resilieLe": iso(t["resilie_le"]),
            "profession": t["profession"] or "", "pays": t["pays"] or "", "ville": t["ville"] or "", "quartier": t["quartier"] or "", "rue": t["rue"] or "",
            "email": t["email"] or "", "bp": t["bp"] or "", "telephoneFixe": t["telephone_fixe"] or "",
            "type": t["type"], "formeJuridique": t["forme"] or "", "registre": t["rccm"] or "", "centreActivite": t["centre_activite"] or "", "activite": t["activite"] or "",
            "dirigeant": dirigeant, "signataires": signataires, "membres": membres, "nbHommes": t["nb_hommes"] or 0, "nbFemmes": t["nb_femmes"] or 0,
            "photo": bool(sp and sp["photo"]), "specimen": bool(sp and sp["signature"]) or any(x["specimen"] for x in signataires),
            "creePar": t["cree_par"], "visePar": t["vise_par"]}


def iso(d) -> str:
    return d.isoformat() if d else ""


SQL_TIERS = """select t.*, coalesce(p.nom, m.raison_sociale) as nom, p.postnom, p.prenom, p.sexe, p.date_naissance, p.lieu_naissance, p.piece_type, p.piece_numero,
                      p.piece_delivree_le, p.piece_lieu, p.piece_autorite, p.piece_validite, p.profession, p.pays, p.ville, p.quartier, p.rue, p.email, p.bp, p.telephone_fixe, coalesce(p.adresse, m.adresse_siege) as adresse, p.telephone,
                      m.forme, m.rccm, m.centre_activite, m.activite, m.nb_hommes, m.nb_femmes, z.nom as zone_nom, pe.code as produit_code
               from tiers t left join tiers_personne p on p.tiers_id = t.id left join tiers_morale m on m.tiers_id = t.id
               left join zone z on z.id = t.zone_id left join produit_epargne pe on pe.id = t.produit_id"""


def lire_tiers(tid: int) -> dict | None:
    t = une(SQL_TIERS + " where t.id = %s", (tid,))
    return vue_tiers(t) if t else None


def rechercher_tiers(u: dict, q: str) -> list[dict]:
    q = (q or "").strip().lower()
    if not q:
        return []
    motif = f"%{q}%"
    return [vue_tiers(t) for t in lignes(SQL_TIERS + """ where t.institution_id = %s and (
                lower(concat_ws(' ', t.numero, p.nom, p.postnom, p.prenom, m.raison_sociale)) like %s
                or exists (select 1 from compte_depot c where c.tiers_id = t.id and c.numero like %s))
            order by t.id limit 20""", (u["institution_id"], motif, motif))]


def texte_de(d: dict):
    return lambda k: (d.get(k) or "").strip() if isinstance(d.get(k) or "", str) else ""


def controler_image(v, quoi: str):
    if v and (not isinstance(v, str) or len(v) > IMAGE_MAX or not IMAGE_OK.match(v)):
        raise ErreurMetier(quoi + " : image PNG ou JPEG de 300 Ko au plus.")


def controler_piece(type_: str, expire: str, j: dict | None, qui: str = ""):
    if type_ not in PIECES:
        raise ErreurMetier(f"{qui}Type de pièce non admis (Instr. BCC 15, art. 14).")
    if expire and j and expire < j["date"]:
        raise ErreurMetier(f"{qui}Pièce expirée.")


def controler_base(u: dict, d: dict, obligatoires: list[tuple[str, str]], types: list[str], zone_requise: bool) -> dict:
    """Contrôles communs aux enrôlements (onglet Informations de base, Personnes Liées). Mêmes règles que web/src/donnees/api.ts."""
    texte = texte_de(d)
    manque = [n for n, k in obligatoires if not texte(k)]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if texte("typeClient") not in types:
        raise ErreurMetier("Type inconnu.")
    produit = valeur("select id from produit_epargne where institution_id = %s and code = %s", (u["institution_id"], texte("produitCode")))
    if not produit:
        raise ErreurMetier("Type de compte inconnu.")
    zone = valeur("select id from zone where institution_id = %s and nom = %s", (u["institution_id"], texte("zone"))) if texte("zone") else None
    if texte("zone") and not zone or zone_requise and not zone:
        raise ErreurMetier("Zone inconnue.")
    depot = d.get("premierDepot", 0)
    if not isinstance(depot, int) or isinstance(depot, bool) or depot < 0:
        raise ErreurMetier("Premier dépôt invalide.")
    liees = d.get("liees") or []
    if (not isinstance(liees, list) or len(set(liees)) != len(liees) or any(not isinstance(x, int) for x in liees)
            or valeur("select count(*) from tiers where institution_id = %s and id = any(%s)", (u["institution_id"], liees)) != len(liees)):
        raise ErreurMetier("Personne liée inconnue ou en double.")
    return {"produit": produit, "zone": zone, "depot": depot, "liees": liees, "texte": texte}


def compteur_client(agence_id: int, depart: int = 1) -> int:
    """Prochain compteur de l'agence (registre S15-7) ; jamais sous la valeur de départ de la règle (S15-3).
    Une agence sans compteur part de la séquence historique numero_tiers."""
    executer("""insert into compteur_client (agence_id, dernier)
                select %s, case when is_called then last_value else last_value - 1 end from numero_tiers on conflict (agence_id) do nothing""", (agence_id,))
    return valeur("update compteur_client set dernier = greatest(dernier + 1, %s) where agence_id = %s returning dernier", (depart, agence_id))


def composer_numero(regle: dict | None, valeurs: dict) -> str:
    """S15 : les éléments dans l'Ordre des éléments, séparés par un tiret (registre S15-10) ; compteur sur six chiffres (S15-4).
    Sans règle enregistrée : code agence, tiret, compteur (S15-9). Un élément vide est sauté."""
    ordre = regle["ordre"] if regle else ["AGENCE", "COMPTEUR"]
    morceaux = []
    for e in ordre:
        if e == "COMPTEUR":
            v = f"{valeurs['COMPTEUR']:06d}"
        elif e in ("PREFIXE", "SUFFIXE"):
            v = regle[e.lower()]["valeur"]
        else:
            v = valeurs.get(e, "")
        if v:
            morceaux.append(v)
    return "-".join(morceaux)


def numero_client(u: dict) -> str:
    """Numéro d'un nouveau client selon la règle de S15 (registre S15-9 : elle vaut pour les clients créés après son enregistrement)"""
    r = une("select regle from numerotation_client where institution_id = %s", (u["institution_id"],))
    regle = json_lu(r["regle"]) if r else None
    ag = une("select a.code, i.sigle from agence a join institution i on i.id = a.institution_id where a.id = %s", (u["agence_id"],))
    n = compteur_client(u["agence_id"], regle["compteur"] if regle else 1)
    # Categorie (S15-8) : la catégorie du client, pas encore saisie à l'enrôlement (registre S37-2) ; l'élément est sauté
    return composer_numero(regle, {"INSTITUTION": ag["sigle"] or "", "AGENCE": ag["code"], "CATEGORIE": "", "COMPTEUR": n})


def composer_numero_compte(regle: dict | None, numero_client: str, code_agence: str, numero_produit: int | None) -> str:
    """S17 (p. 26) : [Préfixe]-N° Client-[Suffixe]. Préfixe : code de l'agence (registre S17-4) ; Suffixe : numéro du produit d'épargne
    sur « Position » chiffres (S17-2, S17-3). Sans règle : N° Client et suffixe sur deux chiffres, la numérotation en place (S17-6)."""
    r = regle or {"prefixe": False, "suffixe": True, "position": 2}
    morceaux = [code_agence] if r["prefixe"] else []
    morceaux.append(numero_client)
    if r["suffixe"]:
        morceaux.append(str(numero_produit or 0).zfill(r["position"]))
    return "-".join(morceaux)


def numero_compte(u: dict, t: dict, produit: dict) -> str:
    """Numéro d'un nouveau compte selon la règle de S17 ; les comptes déjà ouverts gardent leur numéro (S17-6)"""
    regle = une("select prefixe, suffixe, position from numerotation_compte where institution_id = %s", (u["institution_id"],))
    ag = une("select code from agence where id = %s", (t["agence_id"],))
    return composer_numero_compte(regle, t["numero"], ag["code"], produit.get("numero"))


def inserer_tiers(u: dict, d: dict, b: dict, type_: str, agent: str) -> int:
    texte = b["texte"]
    numero = numero_client(u)
    tid = valeur("""insert into tiers (institution_id, agence_id, numero, numero_manuel, type, statut, residence, agent_economique, zone_id, personne_exposee, cree_par,
                                       date_demande, matricule, type_client, produit_id, premier_depot, prelever_agios, calculer_interet)
                    values (%s, %s, %s, %s, %s, 'a_viser', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], u["agence_id"], numero, texte("numeroManuel") or None, type_, "resident" if d.get("resident", True) else "non_resident", agent,
                  b["zone"], bool(d.get("personneExposee")), u["id"], texte("dateDemande"), texte("matricule") or None, texte("typeClient"), b["produit"], b["depot"],
                  bool(d.get("preleverAgios", True)), bool(d.get("calculerInteret"))))
    for autre in b["liees"]:
        executer("insert into lien_tiers (tiers_id, autre_id, role) values (%s, %s, 'personne_liee')", (tid, autre))
    return tid


def creer_tiers(u: dict, d: dict) -> dict:
    """S37. Mêmes contrôles que controlerEnrolement (web/src/donnees/api.ts)."""
    exiger(u)
    b = controler_base(u, d, [("date demande", "dateDemande"), ("type client", "typeClient"), ("type de compte à créer", "produitCode"),
                              ("nom", "nom"), ("type de pièce", "pieceType"), ("numéro de pièce", "pieceNumero")], TYPES_CLIENT, False)
    texte = b["texte"]
    if texte("sexe") not in ("", "F", "M"):
        raise ErreurMetier("Sexe inconnu.")
    controler_piece(texte("pieceType"), texte("pieceExpire"), journee_courante(u))
    images = d.get("images") or {}
    controler_image(images.get("photo"), "Photo"); controler_image(images.get("signature"), "Signature")
    prospect = d.get("prospectId")
    if prospect is not None:
        # « Choisir prospect » (p. 49) : le prospect (S45) devient le client ; il garde son numéro et ses coordonnées
        if not isinstance(prospect, int) or isinstance(prospect, bool) or not une(
                "select 1 from tiers where id = %s and institution_id = %s and statut = 'prospect' for update", (prospect, u["institution_id"])):
            raise ErreurMetier("Prospect introuvable.")
        if prospect in b["liees"]:
            raise ErreurMetier("Un client ne peut pas être sa propre personne liée.")
        tid = prospect
        executer("""update tiers set numero_manuel = %s, statut = 'a_viser', residence = %s, agent_economique = 'menages', zone_id = %s, personne_exposee = %s,
                                     cree_par = %s, date_demande = %s, matricule = %s, type_client = %s, produit_id = %s, premier_depot = %s, prelever_agios = %s,
                                     calculer_interet = %s where id = %s""",
                 (texte("numeroManuel") or None, "resident" if d.get("resident", True) else "non_resident", b["zone"], bool(d.get("personneExposee")), u["id"],
                  texte("dateDemande"), texte("matricule") or None, texte("typeClient"), b["produit"], b["depot"], bool(d.get("preleverAgios", True)),
                  bool(d.get("calculerInteret")), tid))
        for autre in b["liees"]:
            executer("insert into lien_tiers (tiers_id, autre_id, role) values (%s, %s, 'personne_liee')", (tid, autre))
    else:
        tid = inserer_tiers(u, d, b, "physique", "menages")
        executer("insert into tiers_personne (tiers_id, nom) values (%s, '')", (tid,))
    executer("""update tiers_personne set nom = %s, postnom = %s, prenom = %s, sexe = %s, date_naissance = %s, lieu_naissance = %s, piece_type = %s, piece_numero = %s,
                                          piece_delivree_le = %s, piece_lieu = %s, piece_autorite = %s, piece_validite = %s, adresse = %s, telephone = %s
                where tiers_id = %s""",
             (texte("nom"), texte("postnom") or None, texte("prenom") or None, texte("sexe") or None, texte("naissance") or None, texte("lieuNaissance") or None,
              texte("pieceType"), texte("pieceNumero"), texte("pieceDelivreeLe") or None, texte("pieceLieu") or None, texte("pieceAutorite") or None,
              texte("pieceExpire") or None, texte("adresse") or None, texte("telephone") or None, tid))
    if images.get("photo") or images.get("signature"):
        executer("insert into specimen (tiers_id, photo, signature, depose_le) values (%s, %s, %s, current_date)", (tid, images.get("photo"), images.get("signature")))
    return lire_tiers(tid)


def controler_representant(r, qui: str, j: dict | None) -> dict:
    if not isinstance(r, dict):
        raise ErreurMetier(f"{qui} invalide.")
    t = texte_de(r)
    manque = [n for n, k in (("nom", "nom"), ("type de pièce", "pieceType"), ("numéro de pièce", "pieceNumero")) if not t(k)]
    if manque:
        raise ErreurMetier(f"{qui} : à remplir : " + ", ".join(manque) + ".")
    controler_piece(t("pieceType"), t("pieceExpire"), j, f"{qui} : ")
    controler_image(r.get("photo"), f"{qui} : photo"); controler_image(r.get("signature"), f"{qui} : signature")
    return r


def creer_entreprise(u: dict, d: dict) -> dict:
    """S38 : Client > Enrôlement > Entreprise (manuel p. 49 et 50). Mêmes contrôles que controlerEntreprise (web/src/donnees/api.ts)."""
    exiger(u)
    b = controler_base(u, d, [("date demande", "dateDemande"), ("type entreprise", "typeClient"), ("zone", "zone"), ("type de compte à créer", "produitCode"),
                              ("dénomination", "nom"), ("forme juridique", "formeJuridique"), ("n° du registre", "registre"), ("adresse du siège", "adresse")],
                       TYPES_ENTREPRISE, True)
    texte = b["texte"]
    j = journee_courante(u)
    dirigeant = d.get("dirigeant")
    if dirigeant is not None:
        controler_representant(dirigeant, "Dirigeant", j)
    signataires = d.get("signataires") or []
    if not isinstance(signataires, list):
        raise ErreurMetier("Signataires invalides.")
    for i, r in enumerate(signataires, start=1):
        controler_representant(r, f"Signataire {i}", j)
    tid = inserer_tiers(u, d, b, "morale", texte("typeClient"))
    executer("""insert into tiers_morale (tiers_id, raison_sociale, forme, rccm, adresse_siege, centre_activite, activite)
                values (%s, %s, %s, %s, %s, %s, %s)""",
             (tid, texte("nom"), texte("formeJuridique"), texte("registre"), texte("adresse"), texte("centreActivite") or None, texte("activite") or None))
    inserer_representants(tid, ([("dirigeant", dirigeant)] if dirigeant is not None else []) + [("signataire", r) for r in signataires])
    return lire_tiers(tid)


def inserer_representants(tid: int, liste: list[tuple[str, dict]]):
    for role, r in liste:
        t = texte_de(r)
        executer("""insert into representant (tiers_id, role, nom, postnom, prenom, piece_type, piece_numero, piece_validite, photo, signature)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                 (tid, role, t("nom"), t("postnom") or None, t("prenom") or None, t("pieceType"), t("pieceNumero"), t("pieceExpire") or None,
                  r.get("photo") or None, r.get("signature") or None))


def creer_groupe(u: dict, d: dict) -> dict:
    """S39 : Client > Enrôlement > Groupe (manuel p. 47 et 51). Mêmes contrôles que controlerGroupe (web/src/donnees/api.ts)."""
    exiger(u)
    b = controler_base(u, d, [("date demande", "dateDemande"), ("type de groupe", "typeClient"), ("type de compte à créer", "produitCode"),
                              ("dénomination", "nom"), ("adresse", "adresse")], list(TYPES_GROUPE), False)
    texte = b["texte"]
    nombres = [d.get("nbHommes", 0), d.get("nbFemmes", 0)]
    if any(not isinstance(n, int) or isinstance(n, bool) or n < 0 for n in nombres):
        raise ErreurMetier("Nombre d'hommes ou de femmes invalide.")
    j = journee_courante(u)
    membres = d.get("membres") or []
    if not isinstance(membres, list):
        raise ErreurMetier("Membres invalides.")
    for i, r in enumerate(membres, start=1):
        controler_representant(r, f"Membre {i}", j)
    images = d.get("images") or {}
    controler_image(images.get("photo"), "Photo"); controler_image(images.get("signature"), "Signature")
    tid = inserer_tiers(u, d, b, "groupe", TYPES_GROUPE[texte("typeClient")])
    executer("""insert into tiers_morale (tiers_id, raison_sociale, forme, rccm, adresse_siege, activite, nb_hommes, nb_femmes)
                values (%s, %s, %s, %s, %s, %s, %s, %s)""",
             (tid, texte("nom"), texte("formeJuridique") or None, texte("registre") or None, texte("adresse"), texte("activite") or None, *nombres))
    inserer_representants(tid, [("membre", r) for r in membres])
    if images.get("photo") or images.get("signature"):
        executer("insert into specimen (tiers_id, photo, signature, depose_le) values (%s, %s, %s, current_date)", (tid, images.get("photo"), images.get("signature")))
    return lire_tiers(tid)


def tiers_a_viser(u: dict) -> list[dict]:
    return [vue_tiers(t) for t in lignes(SQL_TIERS + " where t.institution_id = %s and t.statut = 'a_viser' order by t.id", (u["institution_id"],))]


def viser_tiers(u: dict, tid: int, d: dict | None = None) -> dict:
    """S40 : Client > Visa > Viser un client (manuel p. 52). Admission du membre : loi 002/2002, art. 22, 6°."""
    exiger(u, "chef_agence")
    d = d or {}
    t = une("select * from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] != "a_viser":
        raise ErreurMetier("Ce client n'est pas en attente de visa.")
    if t["cree_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : le visa vient d'une autre personne que celle qui a enrôlé.")
    j = journee_courante(u)
    jour = j["date"] if j and j["statut"] == "ouverte" else date.today().isoformat()
    texte = texte_de(d)
    date_visa = texte("dateVisa") or jour
    if t["date_demande"] and date_visa < t["date_demande"].isoformat():
        raise ErreurMetier("La date de visa précède la date de demande.")
    if date_visa > jour:
        raise ErreurMetier("La date de visa ne peut pas dépasser la journée en cours.")
    intitule = texte("intitule") if "intitule" in d else (t["intitule"] or titulaire(tid))
    if not intitule:
        raise ErreurMetier("À remplir : intitulé.")
    depot = d.get("premierDepot", t["premier_depot"] or 0)
    if not isinstance(depot, int) or isinstance(depot, bool) or depot < 0:
        raise ErreurMetier("Premier dépôt invalide.")
    executer("""update tiers set statut = 'actif', vise_par = %s, vise_le = now(), date_visa = %s, intitule = %s, premier_depot = %s where id = %s""",
             (u["id"], date_visa, intitule, depot, tid))
    return lire_tiers(tid)


def controler_statut_actif(statut: str, suite: str = ""):
    if statut == "resilie":
        raise ErreurMetier("Client résilié : plus d'opération ; apurement de ses comptes à faire (loi 002/2002, art. 27).")
    if statut == "modifie_a_revalider":
        raise ErreurMetier("Client modifié : à valider (Client > Visa > Valider client modifié) avant toute opération.")
    if statut != "actif":
        raise ErreurMetier(f"Client pas encore visé{suite}.")


def modifier_tiers(u: dict, tid: int, d: dict) -> dict:
    """S46 : Modification d'un client physique (manuel p. 56) : Info de base, Info Généraux, Autre Info, Personnes Liées.
    Le client passe « modifié à revalider » (S42). Contrôles identiques à l'enrôlement (Instr. BCC 15, art. 12 à 14, 60)."""
    exiger(u)
    t = une("select * from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["type"] != "physique":
        raise ErreurMetier("Seule la modification d'un client physique est décrite par le manuel (p. 56).")
    if t["statut"] not in ("actif", "modifie_a_revalider"):
        raise ErreurMetier("Client pas encore visé : le modifier depuis l'enrôlement.")
    b = controler_base(u, {**d, "produitCode": valeur("select code from produit_epargne where id = %s", (t["produit_id"],)) if t["produit_id"] else "EAV-CDF",
                           "premierDepot": t["premier_depot"] or 0},
                       [("date demande", "dateDemande"), ("type client", "typeClient"), ("nom", "nom"), ("type de pièce", "pieceType"),
                        ("numéro de pièce", "pieceNumero")], TYPES_CLIENT, False)
    texte = b["texte"]
    if texte("sexe") not in ("", "F", "M"):
        raise ErreurMetier("Sexe inconnu.")
    if tid in b["liees"]:
        raise ErreurMetier("Un client ne peut pas être sa propre personne liée.")
    controler_piece(texte("pieceType"), texte("pieceExpire"), journee_courante(u))
    avant = lire_tiers(tid)
    executer("""update tiers set date_demande = %s, type_client = %s, zone_id = %s, residence = %s, prelever_agios = %s, calculer_interet = %s,
                                 personne_exposee = %s, statut = 'modifie_a_revalider' where id = %s""",
             (texte("dateDemande"), texte("typeClient"), b["zone"], "resident" if d.get("resident", True) else "non_resident",
              bool(d.get("preleverAgios", True)), bool(d.get("calculerInteret")), bool(d.get("personneExposee")), tid))
    executer("""update tiers_personne set nom = %s, postnom = %s, prenom = %s, sexe = %s, date_naissance = %s, lieu_naissance = %s, piece_type = %s,
                    piece_numero = %s, piece_delivree_le = %s, piece_lieu = %s, piece_autorite = %s, piece_validite = %s, adresse = %s, telephone = %s
                where tiers_id = %s""",
             (texte("nom"), texte("postnom") or None, texte("prenom") or None, texte("sexe") or None, texte("naissance") or None, texte("lieuNaissance") or None,
              texte("pieceType"), texte("pieceNumero"), texte("pieceDelivreeLe") or None, texte("pieceLieu") or None, texte("pieceAutorite") or None,
              texte("pieceExpire") or None, texte("adresse") or None, texte("telephone") or None, tid))
    executer("delete from lien_tiers where tiers_id = %s and role = 'personne_liee'", (tid,))
    for autre in b["liees"]:
        executer("insert into lien_tiers (tiers_id, autre_id, role) values (%s, %s, 'personne_liee')", (tid, autre))
    apres = lire_tiers(tid)
    executer("insert into tiers_modification (tiers_id, avant, apres, modifie_par) values (%s, %s, %s, %s)", (tid, Jsonb(avant), Jsonb(apres), u["id"]))
    return apres


def tiers_a_revalider(u: dict) -> list[dict]:
    exiger(u)
    return [vue_tiers(t) for t in lignes(SQL_TIERS + " where t.institution_id = %s and t.statut = 'modifie_a_revalider' order by t.id", (u["institution_id"],))]


def activer_tiers(u: dict, tid: int) -> dict:
    """S42 : Client > Visa > Valider client modifié (manuel p. 54), bouton « activer client ». Quatre yeux : ARCHITECTURE P7."""
    exiger(u, "chef_agence")                 # profil habilité : à confirmer
    t = une("select * from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] != "modifie_a_revalider":
        raise ErreurMetier("Ce client n'attend pas de validation.")
    if valeur("select 1 from tiers_modification where tiers_id = %s and valide_par is null and modifie_par = %s", (tid, u["id"])):
        raise ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a modifié.")
    executer("update tiers_modification set valide_par = %s, valide_le = now() where tiers_id = %s and valide_par is null", (u["id"], tid))
    executer("update tiers set statut = 'actif' where id = %s", (tid,))
    return lire_tiers(tid)


def images_tiers(u: dict, tid: int) -> dict:
    """Photo et signature déposées (cadre « Photo / Signature » de S43, p. 54)"""
    exiger(u)
    sp = une("""select s.photo, s.signature from specimen s join tiers t on t.id = s.tiers_id
                where s.tiers_id = %s and t.institution_id = %s order by s.id desc limit 1""", (tid, u["institution_id"]))
    image = lambda v: v if isinstance(v, str) and IMAGE_OK.match(v) else None
    return {"photo": image(sp and sp["photo"]), "signature": image(sp and sp["signature"])}


def changer_specimen(u: dict, tid: int, d: dict) -> dict:
    """S49 : Modification ou Ajout (Photo/Signature) (manuel p. 58), bouton « Valider les Modifications ».
    Nouveau dépôt ; ce qui n'est pas changé reprend le dépôt précédent."""
    exiger(u)
    t = une("select statut from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] in ("prospect", "resilie"):
        raise ErreurMetier("Client prospect ou résilié : pas de photo ni de signature à mettre à jour.")
    photo, signature = (d or {}).get("photo"), (d or {}).get("signature")
    if not photo and not signature:
        raise ErreurMetier("Aucune photo ni signature choisie.")
    controler_image(photo, "Photo"); controler_image(signature, "Signature")
    avant = une("select photo, signature from specimen where tiers_id = %s order by id desc limit 1", (tid,)) or {}
    executer("insert into specimen (tiers_id, photo, signature, depose_le, depose_par) values (%s, %s, %s, current_date, %s)",
             (tid, photo or avant.get("photo"), signature or avant.get("signature"), u["id"]))
    return lire_tiers(tid)


def consentements(u: dict, tid: int) -> list[dict]:
    exiger(u)
    return [{"id": r["id"], "code": r["code"], "dateDebut": iso(r["date_debut"]), "dateFin": iso(r["date_fin"]), "commentaire": r["commentaire"] or ""}
            for r in lignes("""select c.* from consentement c join tiers t on t.id = c.tiers_id where c.tiers_id = %s and t.institution_id = %s
                               order by c.date_debut desc, c.id desc""", (tid, u["institution_id"]))]


def creer_consentement(u: dict, tid: int, d: dict) -> list[dict]:
    """S50 : Consentement (manuel p. 58), bouton Enregistrer. Instr. BCC 5, art. 13 : consentement écrit de l'emprunteur."""
    exiger(u)
    t = une("select statut from tiers where id = %s and institution_id = %s", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] in ("prospect", "resilie"):
        raise ErreurMetier("Client prospect ou résilié : pas de consentement à enregistrer.")
    texte = texte_de(d or {})
    manque = [n for n, k in (("code", "code"), ("date début", "dateDebut")) if not texte(k)]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    for k in ("dateDebut", "dateFin"):
        if texte(k) and not re.match(r"^\d{4}-\d{2}-\d{2}$", texte(k)):
            raise ErreurMetier("Date invalide.")
    if texte("dateFin") and texte("dateFin") < texte("dateDebut"):
        raise ErreurMetier("La date de fin précède la date de début.")
    executer("insert into consentement (tiers_id, code, date_debut, date_fin, commentaire, saisi_par) values (%s, %s, %s, %s, %s, %s)",
             (tid, texte("code"), texte("dateDebut"), texte("dateFin") or None, texte("commentaire") or None, u["id"]))
    return consentements(u, tid)


def rapport_clients(u: dict) -> list[dict]:
    """S51 : tous les clients et prospects de l'institution, filtrés à l'écran (Client > Rapport, manuel p. 58 et 59)"""
    exiger(u)
    return [vue_tiers(t) for t in lignes(SQL_TIERS + " where t.institution_id = %s order by t.numero", (u["institution_id"],))]


def rapport_modifications(u: dict) -> list[dict]:
    """S51, « Rapport des clients modifiés » (p. 59) : chaque modification (S46) avec le client, l'auteur et le valideur"""
    exiger(u)
    return [{"tiersId": r["tiers_id"], "numero": r["numero"], "avant": json_lu(r["avant"]), "apres": json_lu(r["apres"]), "modifiePar": r["modifie_par"],
             "modifieLe": r["modifie_le"].isoformat(), "validePar": r["valide_par"]}
            for r in lignes("""select m.*, t.numero from tiers_modification m join tiers t on t.id = m.tiers_id where t.institution_id = %s
                               order by m.modifie_le desc""", (u["institution_id"],))]


def rapport_transactions(u: dict, du: str, au: str) -> list[dict]:
    """S13, « Rapport des transactions » (manuel p. 22) : par utilisateur, opérations de la période (date des journées de l'agence).
    Pas encore d'annulation d'opération dans le logiciel : Nbres Annulations vaut 0 (à confirmer). Transactions = Opérations - Annulations (capture p. 22)."""
    exiger(u)
    if not du or not au:
        raise ErreurMetier("À remplir : DU et AU.")
    r = lignes("""select o.saisi_par, count(*) as n from operation o join journee_comptable j on j.id = o.journee_id
                  where o.agence_id = %s and j.date_comptable between %s and %s group by o.saisi_par""", (u["agence_id"], du, au))
    sortie = [{"utilisateur": nom_utilisateur(x["saisi_par"]), "operations": x["n"], "annulations": 0, "transactions": x["n"]} for x in r]
    return sorted(sortie, key=lambda x: x["utilisateur"].lower())


def modifications_tiers(u: dict, tid: int) -> list[dict]:
    """« Informations initiales et actuelles » (S43, p. 54) : chaque modification (S46) avec l'état avant et après"""
    exiger(u)
    return [{"avant": json_lu(r["avant"]), "apres": json_lu(r["apres"]), "modifiePar": r["modifie_par"], "modifieLe": r["modifie_le"].isoformat(),
             "validePar": r["valide_par"]}
            for r in lignes("""select m.* from tiers_modification m join tiers t on t.id = m.tiers_id where m.tiers_id = %s and t.institution_id = %s
                               order by m.id""", (tid, u["institution_id"]))]


def localites() -> list[dict]:
    """Pays > Ville > Quartier (table localite ; paramétrage Localisation, p. 30, pas encore construit)"""
    rows = lignes("select id, parent_id, niveau, nom from localite order by nom")
    enfants = lambda pid, niveau: [r for r in rows if r["parent_id"] == pid and r["niveau"] == niveau]
    return [{"pays": p["nom"], "villes": [{"ville": v["nom"], "quartiers": [q["nom"] for q in enfants(v["id"], "quartier")]} for v in enfants(p["id"], "ville")]}
            for p in rows if p["niveau"] == "pays" and p["parent_id"] is None]


def prospects(u: dict) -> list[dict]:
    exiger(u)
    return [vue_tiers(t) for t in lignes(SQL_TIERS + " where t.institution_id = %s and t.statut = 'prospect' order by t.id desc", (u["institution_id"],))]


def controler_prospect(u: dict, d: dict):
    """Champs obligatoires de la capture p. 55 : Nom, Prénoms, Date naissance, à, Sexe, Pays, Ville, Quartier"""
    texte = texte_de(d)
    manque = [n for n, k in (("nom", "nom"), ("prénoms", "prenom"), ("date de naissance", "naissance"), ("lieu de naissance", "lieuNaissance"),
                             ("sexe", "sexe"), ("pays", "pays"), ("ville", "ville"), ("quartier", "quartier")) if not texte(k)]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if texte("sexe") not in ("F", "M"):
        raise ErreurMetier("Sexe inconnu.")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", texte("naissance")) or texte("naissance") > date.today().isoformat():
        raise ErreurMetier("Date de naissance invalide.")
    lieux = {(p["pays"], v["ville"], q) for p in localites() for v in p["villes"] for q in v["quartiers"]}
    if (texte("pays"), texte("ville"), texte("quartier")) not in lieux:
        raise ErreurMetier("Pays, ville ou quartier inconnu.")
    if texte("profession") and not valeur("select 1 from profession where institution_id = %s and libelle = %s", (u["institution_id"], texte("profession"))):
        raise ErreurMetier("Profession inconnue.")
    if texte("email") and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", texte("email")):
        raise ErreurMetier("Email invalide.")
    return texte


VALEURS_PROSPECT = """nom = %s, prenom = %s, date_naissance = %s, lieu_naissance = %s, sexe = %s, profession = %s, pays = %s, ville = %s, quartier = %s,
                      rue = %s, email = %s, bp = %s, telephone_fixe = %s, telephone = %s"""


def params_prospect(texte) -> tuple:
    return (texte("nom"), texte("prenom"), texte("naissance"), texte("lieuNaissance"), texte("sexe"), texte("profession") or None, texte("pays"),
            texte("ville"), texte("quartier"), texte("rue") or None, texte("email") or None, texte("bp") or None, texte("telephoneFixe") or None,
            texte("telephone") or None)


def creer_prospect(u: dict, d: dict) -> dict:
    """S45 : Client > Nouveau prospect (manuel p. 55), bouton Enregistrer"""
    exiger(u)
    texte = controler_prospect(u, d)
    numero = numero_client(u)
    tid = valeur("""insert into tiers (institution_id, agence_id, numero, type, statut, cree_par) values (%s, %s, %s, 'physique', 'prospect', %s) returning id""",
                 (u["institution_id"], u["agence_id"], numero, u["id"]))
    executer("insert into tiers_personne (tiers_id, nom) values (%s, '')", (tid,))
    executer(f"update tiers_personne set {VALEURS_PROSPECT} where tiers_id = %s", (*params_prospect(texte), tid))
    return lire_tiers(tid)


def modifier_prospect(u: dict, tid: int, d: dict) -> dict:
    """S45, bouton Modifier"""
    exiger(u)
    t = une("select statut from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t or t["statut"] != "prospect":
        raise ErreurMetier("Prospect introuvable.")
    texte = controler_prospect(u, d)
    executer(f"update tiers_personne set {VALEURS_PROSPECT} where tiers_id = %s", (*params_prospect(texte), tid))
    return lire_tiers(tid)


def engagements_credit(tid: int) -> str | None:
    """Loi 002/2002, art. 24 : un membre emprunteur ou endosseur d'un prêt ne peut pas se retirer"""
    if valeur("select 1 from credit where tiers_id = %s and statut in ('mis_en_place', 'vise', 'debloque')", (tid,)):
        raise ErreurMetier("Client emprunteur : il ne peut pas se retirer tant que son prêt court (loi 002/2002, art. 24).")
    if valeur("""select 1 from garantie g join credit c on c.id = g.credit_id
                 where g.caution_id = %s and g.liberee_le is null and c.statut in ('mis_en_place', 'vise', 'debloque')""", (tid,)):
        raise ErreurMetier("Client endosseur d'un prêt en cours : il ne peut pas se retirer (loi 002/2002, art. 24).")
    return None


def resilier_tiers(u: dict, tid: int, d: dict) -> dict:
    """S48 : Client > Résilier un client (manuel p. 57), bouton Résilier. Loi 002/2002, art. 24 ; apurement ensuite (art. 27).
    Aucun frais de fermeture de compte : clôture gratuite (Instr. BCC 37, annexe)."""
    exiger(u, "chef_agence")                 # profil habilité : à confirmer
    t = une("select * from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] == "resilie":
        raise ErreurMetier("Ce client est déjà résilié.")
    if t["statut"] != "actif":
        raise ErreurMetier("Seul un client actif se résilie.")
    motif = texte_de(d or {})("motif")
    if not motif:
        raise ErreurMetier("À remplir : motif.")
    if not valeur("select 1 from liste_reference where institution_id = %s and liste = 'motif_depart' and libelle = %s and actif", (u["institution_id"], motif)):
        raise ErreurMetier("Motif inconnu.")
    engagements_credit(tid)
    j = journee_courante(u)
    jour = j["date"] if j and j["statut"] == "ouverte" else date.today().isoformat()
    executer("update tiers set statut = 'resilie', motif_depart = %s, resilie_le = %s, resilie_par = %s where id = %s", (motif, jour, u["id"], tid))
    return lire_tiers(tid)


def solde_contrat(contrat: str, devise: str, sens_normal: str) -> int:
    return int(valeur(f"""select coalesce(sum(case l.sens when %s then l.montant_devise else -l.montant_devise end), 0)
                          from ligne_ecriture l where l.contrat_ref = %s and l.devise = %s""", (sens_normal, contrat, devise)))


def comptes_du_tiers(tid: int) -> list[dict]:
    res = []
    for c in lignes("""select c.*, p.libelle, p.famille from compte_depot c join produit_epargne p on p.id = c.produit_id
                       where c.tiers_id = %s and c.statut = 'ouvert' order by c.id""", (tid,)):
        bl = une("""select coalesce(sum(montant), 0) as montant, string_agg(motif, ' ; ') as motif from blocage
                    where compte_id = %s and (fin is null or fin > now())""", (c["id"],))
        solde = solde_contrat(f"depot:{c['id']}", c["devise"], "C")
        bloque = int(bl["montant"])
        res.append({"id": c["id"], "tiersId": tid, "numero": c["numero"], "intitule": c["libelle"], "pcci": "334" if c["famille"] == "obligatoire" else "330",
                    "devise": c["devise"].strip(), "bloque": bloque, "motifBlocage": bl["motif"], "solde": solde, "disponible": solde - bloque})
    return res


def compte_parts(t: dict) -> str:
    """PCCI, compte 103 : 1030 personnes physiques, 1031 groupements solidaires, 1032 personnes morales.
    Groupe de type « Groupement » en 1031 ; association et ONG en 1032 (à confirmer)."""
    if t["type"] == "physique":
        return "1030"
    if t["type"] == "groupe" and t["type_client"] == "Groupement":
        return "1031"
    return "1032"


def parts_du_tiers(tid: int) -> float:
    return solde_contrat(f"parts:{tid}", "CDF", "C") / valeur_part()


# ---------- Grand livre ----------

def id_compte(numero: str) -> int:
    i = valeur("select id from compte where numero = %s and institution_id is null", (numero,))
    if i is None:
        raise ErreurMetier(f"Compte {numero} absent du plan de comptes.")
    return i


def schema_valide(u: dict, evenement: str) -> int:
    s = valeur("""select id from schema_comptable where institution_id = %s and type_evenement = %s and valide_par is not null
                  and date_effet <= current_date order by version desc limit 1""", (u["institution_id"], evenement))
    if s is None:
        raise ErreurMetier(f"Schéma comptable « {evenement} » non validé.")
    return s


def poster(u: dict, *, journal: str, journee_id: int, libelle: str, piece: str, evenement: str, cle: str, valide_par: int, lignes_ecr: list[dict]) -> int:
    """Écrit au grand livre. L'équilibre, la période et l'irréversibilité sont aussi garantis par PostgreSQL (replica/schema.sql)."""
    j = une("select * from journee_comptable where id = %s", (journee_id,))
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Journée fermée : aucune écriture possible.")
    jid = valeur("select id from journal where institution_id = %s and code = %s", (u["institution_id"], journal))
    pid = valeur("insert into piece (institution_id, numero, type, date_piece) values (%s, %s, 'bordereau', %s) returning id", (u["institution_id"], piece, j["date_comptable"]))
    numero = f"{journal}-{j['date_comptable'].year}-{valeur('select nextval(%s)', ('numero_ecriture',)):06d}"
    eid = valeur("""insert into ecriture (institution_id, numero, journal_id, journee_id, date_valeur, libelle, piece_id, evenement_id, schema_id, saisi_par, valide_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], numero, jid, journee_id, j["date_comptable"], libelle, pid, cle, schema_valide(u, evenement), u["id"], valide_par))
    cours = cours_usd(j["date_comptable"])
    cours_id = valeur("select id from cours_change where devise = 'USD' and jour <= %s order by jour desc limit 1", (j["date_comptable"],))
    for rang, l in enumerate(lignes_ecr, start=1):
        cdf = l["montant"] if l["devise"] == "CDF" else round(l["montant"] * cours)   # règle d'arrondi à confirmer
        executer("""insert into ligne_ecriture (ecriture_id, rang, compte_id, contrat_ref, sens, devise, montant_devise, montant_cdf, cours_id)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                 (eid, rang, id_compte(l["compte"]), l.get("contrat"), l["sens"], l["devise"], l["montant"], cdf, cours_id if l["devise"] != "CDF" else None))
    return eid


def nouvelle_piece(journee_date) -> str:
    return f"BR-{journee_date.year}-{valeur('select nextval(%s)', ('numero_piece',)):06d}"


# ---------- Guichet ----------

def en_usd(m: int, devise: str) -> float:
    return m / 100 if devise == "USD" else m / 100 / cours_usd()


def especes_du_jour_usd(tid: int, journee_id: int, sens: str) -> float:
    total = 0.0
    for o in lignes("""select o.type, o.montant, o.devise from operation o join session_caisse s on s.id = o.session_caisse_id
                       where o.tiers_id = %s and o.statut = 'validee' and s.journee_id = %s""", (tid, journee_id)):
        if (o["type"] in SORTIES) == (sens == "retrait"):
            total += en_usd(o["montant"], o["devise"].strip())
    return total


def session_ouverte(u: dict, devise: str) -> dict:
    exiger(u, "caissier")
    s = session_du_caissier(u)
    if not s or s["statut"] != "ouverte":
        raise ErreurMetier("Aucune caisse ouverte à votre nom.")
    une("select id from session_caisse where id = %s for update", (s["id"],))   # verrou : le stock de coupures ne bouge pas pendant l'opération
    return s


def operation_par_cle(cle: str) -> dict | None:
    return une("select * from operation where cle_idempotence = %s", (str(uuid.UUID(cle)),))


def vue_operation(o: dict) -> dict:
    statut = "validee" if o["statut"] == "validee" else "refusee" if o["statut"] == "refusee" else "visa_requis"
    compte_id = int(o["contrat_ref"].split(":")[1]) if (o["contrat_ref"] or "").startswith("depot:") else None
    return {"id": o["id"], "cle": str(o["cle_idempotence"]), "type": o["type"], "statut": statut, "sessionId": o["session_caisse_id"], "tiersId": o["tiers_id"],
            "compteId": compte_id, "montant": o["montant"], "devise": o["devise"].strip(), "parts": o["parts"],
            "coupures": {str(r["valeur"] // 100): r["nombre"] for r in lignes("select valeur, nombre from operation_coupure where operation_id = %s", (o["id"],))},
            "remisPar": o["remis_par"] or "", "motif": o.get("motif") or "", "saisiPar": o["saisi_par"], "visePar": o["vise_par"], "ecritureId": o["ecriture_id"],
            "heure": o["cree_le"].astimezone().strftime("%H:%M")}


def enregistrer_coupures(oid: int, devise: str, coupures: dict):
    executer("delete from operation_coupure where operation_id = %s", (oid,))
    for v, n in coupures.items():
        executer("insert into operation_coupure (operation_id, devise, valeur, nombre) values (%s, %s, %s, %s)", (oid, devise, int(v) * 100, n))


def creer_operation(u, s, *, cle, type_, statut, tiers_id, contrat, montant, devise, coupures, remis_par, parts=None, ecriture_id=None, motif=None) -> int:
    j = une("select agence_id from journee_comptable where id = %s", (s["journeeId"],))
    oid = valeur("""insert into operation (institution_id, agence_id, journee_id, session_caisse_id, type, tiers_id, contrat_ref, montant, devise, statut,
                    cle_idempotence, saisi_par, valide_par, ecriture_id, remis_par, parts, motif)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], j["agence_id"], s["journeeId"], s["id"], type_, tiers_id, contrat, montant, devise, statut,
                  cle, u["id"], u["id"] if statut == "validee" else None, ecriture_id, remis_par, parts, motif))
    enregistrer_coupures(oid, devise, coupures)
    return oid


def titulaire(tid: int) -> str:
    t = une("""select coalesce(p.nom, m.raison_sociale) as nom, p.postnom, p.prenom from tiers t left join tiers_personne p on p.tiers_id = t.id
               left join tiers_morale m on m.tiers_id = t.id where t.id = %s""", (tid,))
    return " ".join(x for x in (t["nom"], t["postnom"], t["prenom"]) if x)


def controler_montant_coupures(coupures: dict, montant: int, devise: str):
    controler_coupures(coupures, devise)
    if total_comptage(coupures) != montant:
        raise ErreurMetier("Le billetage ne fait pas le montant.")


def compte_actif(compte_id: int, verrou: bool = False) -> dict:
    c = une("select c.*, p.famille from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s" + (" for update of c" if verrou else ""), (compte_id,))
    if not c:
        raise ErreurMetier("Compte introuvable.")
    t = une("select statut from tiers where id = %s", (c["tiers_id"],))
    controler_statut_actif(t["statut"])
    c["devise"] = c["devise"].strip()
    c["pcci"] = "334" if c["famille"] == "obligatoire" else "330"
    return c


def depot(u: dict, p: dict) -> dict:
    """S74 : Caisse > Opération > Dépôt / Retrait, onglet Dépôt en espèce (manuel p. 86) : Montant*, Mandataire, Motif. Sans frais (Instr. BCC 37)."""
    prec = operation_par_cle(p["cle"])
    if prec and prec["statut"] == "validee":
        return vue_operation(prec)
    c = compte_actif(p["compteId"])
    s = session_ouverte(u, c["devise"])
    m, coupures = int(p["montant"]), nettoyer(p["coupures"])
    if m <= 0:
        raise ErreurMetier("Montant nul.")
    controler_montant_coupures(coupures, m, c["devise"])
    if en_usd(m, c["devise"]) + especes_du_jour_usd(c["tiers_id"], s["journeeId"], "depot") >= SEUIL_ESPECES_USD:
        raise ErreurMetier(MSG_RENFORCE)
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=f"Dépôt espèces {c['numero']}", piece=nouvelle_piece(j["date_comptable"]),
                 evenement="depot", cle=p["cle"], valide_par=u["id"], lignes_ecr=[
                     {"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "D", "devise": c["devise"], "montant": m},
                     {"compte": c["pcci"], "contrat": f"depot:{c['id']}", "sens": "C", "devise": c["devise"], "montant": m}])
    oid = creer_operation(u, s, cle=p["cle"], type_="depot", statut="validee", tiers_id=c["tiers_id"], contrat=f"depot:{c['id']}", montant=m,
                          devise=c["devise"], coupures=coupures, remis_par=(p.get("mandataire") or "").strip() or titulaire(c["tiers_id"]), ecriture_id=eid,
                          motif=(p.get("motif") or "").strip() or None)
    return vue_operation(une("select * from operation where id = %s", (oid,)))


def retrait(u: dict, p: dict) -> dict:
    """S74 : Caisse > Opération > Dépôt / Retrait, onglet Retrait en espèce (manuel p. 86). Sans frais (Instr. BCC 37)."""
    prec = operation_par_cle(p["cle"])
    if prec and prec["statut"] == "validee":
        return vue_operation(prec)
    c = compte_actif(p["compteId"], verrou=True)   # deux retraits sur le même compte ne passent pas en même temps
    s = session_ouverte(u, c["devise"])
    m, coupures = int(p["montant"]), nettoyer(p["coupures"])
    if m <= 0:
        raise ErreurMetier("Montant nul.")
    dispo = next(x for x in comptes_du_tiers(c["tiers_id"]) if x["id"] == c["id"])["disponible"]
    if m > dispo:
        raise ErreurMetier("Dépasse le solde disponible.")
    controler_montant_coupures(coupures, m, c["devise"])
    th = theorique(s["id"], c["devise"])
    if any(n > th.get(v_, 0) for v_, n in coupures.items()):
        raise ErreurMetier("Pas assez de coupures en caisse.")
    if en_usd(m, c["devise"]) + especes_du_jour_usd(c["tiers_id"], s["journeeId"], "retrait") >= SEUIL_ESPECES_USD:
        raise ErreurMetier(MSG_RENFORCE)
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=f"Retrait espèces {c['numero']}", piece=nouvelle_piece(j["date_comptable"]),
                 evenement="retrait", cle=p["cle"], valide_par=u["id"], lignes_ecr=[
                     {"compte": c["pcci"], "contrat": f"depot:{c['id']}", "sens": "D", "devise": c["devise"], "montant": m},
                     {"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "C", "devise": c["devise"], "montant": m}])
    oid = creer_operation(u, s, cle=p["cle"], type_="retrait", statut="validee", tiers_id=c["tiers_id"], contrat=f"depot:{c['id']}",
                          montant=m, devise=c["devise"], coupures=coupures, remis_par=(p.get("mandataire") or "").strip() or titulaire(c["tiers_id"]),
                          ecriture_id=eid, motif=(p.get("motif") or "").strip() or None)
    return vue_operation(une("select * from operation where id = %s", (oid,)))


def adhesion(u: dict, p: dict) -> dict:
    """S73 : Caisse > Opération > Adhésion (manuel p. 85 et 89) : compte épargne du type choisi à l'enrôlement, premier dépôt,
    Liste des Frais (frais d'adhésion S16/S41 et parts sociales), billetage. Loi 002/2002, art. 21 et 22 ; PCCI, comptes 103 et 330."""
    from .frais import frais_lies
    prec = operation_par_cle(p["cle"])
    if prec and prec["statut"] == "validee":
        return vue_operation(prec)
    s = session_ouverte(u, "CDF")
    tid = int(p["tiersId"])
    t = une("select * from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    controler_statut_actif(t["statut"], " : l'adhésion attend le visa")
    if une("select 1 from compte_depot where tiers_id = %s", (tid,)):
        raise ErreurMetier("Ce membre a déjà adhéré.")
    produit = une("select * from produit_epargne where id = %s", (t["produit_id"],)) if t["produit_id"] else \
        une("select * from produit_epargne where institution_id = %s and famille = 'a_vue' and devise = 'CDF' and actif order by version desc limit 1", (u["institution_id"],))
    if produit["devise"].strip() != "CDF":
        raise ErreurMetier("Compte à créer en USD : l'adhésion en deux devises (frais et parts en CDF) est à confirmer avec le porteur.")
    nb = p.get("parts")
    if not isinstance(nb, int) or isinstance(nb, bool) or nb < 1:
        raise ErreurMetier("Au moins une part sociale, payée en entier (loi 002/2002, art. 21 et 22).")
    m_depot = p.get("depot", 0)
    if not isinstance(m_depot, int) or isinstance(m_depot, bool) or m_depot < 0:
        raise ErreurMetier("Premier dépôt invalide.")
    frais = [f for f in frais_lies(u, tid) if f["montant"]]
    for f in frais:
        if not f["compte"] or not valeur("select 1 from compte where numero = %s", (f["compte"],)):
            raise ErreurMetier(f"Frais « {f['libelle']} » : compte absent du plan comptable, à paramétrer (Paramétrage > Frais et opérations).")
    m_parts = nb * valeur_part()
    total = m_parts + m_depot + sum(f["montant"] for f in frais)
    coupures = nettoyer(p["coupures"])
    controler_montant_coupures(coupures, total, "CDF")
    if en_usd(total, "CDF") + especes_du_jour_usd(tid, s["journeeId"], "depot") >= SEUIL_ESPECES_USD:
        raise ErreurMetier(MSG_RENFORCE)
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    c = valeur("""insert into compte_depot (institution_id, agence_id, tiers_id, produit_id, numero, devise, statut, ouvert_le)
                  values (%s, %s, %s, %s, %s, 'CDF', 'ouvert', %s) returning id""",
               (u["institution_id"], t["agence_id"], tid, produit["id"], numero_compte(u, t, produit), j["date_comptable"]))
    l = [{"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "D", "devise": "CDF", "montant": total},
         {"compte": compte_parts(t), "contrat": f"parts:{tid}", "sens": "C", "devise": "CDF", "montant": m_parts}]
    if m_depot > 0:
        l.append({"compte": "330", "contrat": f"depot:{c}", "sens": "C", "devise": "CDF", "montant": m_depot})
    for f in frais:
        l.append({"compte": f["compte"], "contrat": f"frais:{f['fraisId']}", "sens": "C", "devise": "CDF", "montant": f["montant"]})
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=f"Adhésion {t['numero']}", piece=nouvelle_piece(j["date_comptable"]),
                 evenement="adhesion", cle=p["cle"], valide_par=u["id"], lignes_ecr=l)
    executer("insert into mouvement_parts (tiers_id, sens, nombre, valeur_unitaire, devise, ecriture_id) values (%s, 'achat', %s, %s, 'CDF', %s)", (tid, nb, valeur_part(), eid))
    oid = creer_operation(u, s, cle=p["cle"], type_="adhesion", statut="validee", tiers_id=tid, contrat=f"depot:{c}", montant=total,
                          devise="CDF", coupures=coupures, remis_par=titulaire(tid), parts=nb, ecriture_id=eid)
    return vue_operation(une("select * from operation where id = %s", (oid,)))


def operation_parts(u: dict, p: dict) -> dict:
    """S77 : Caisse > Opération > Part sociale (Achat/Retrait) (manuel p. 88 et 89), en espèces avec billetage.
    Loi 002/2002 : parts intégralement libérées (art. 21), au moins une part pour rester membre (art. 22) ; tout retirer au départ (art. 27).
    PCCI, compte 103 : crédité à l'achat, débité au retrait ou à la démission d'un membre."""
    try:
        uuid.UUID(str(p.get("cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = operation_par_cle(p["cle"])
    if prec and prec["statut"] == "validee":
        return vue_operation(prec)
    sens = p.get("sens")
    if sens not in ("achat", "retrait"):
        raise ErreurMetier("Choisir l'achat ou le retrait de parts.")
    s = session_ouverte(u, "CDF")
    tid = p.get("tiersId")
    t = une("select * from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"])) if isinstance(tid, int) else None
    if not t:
        raise ErreurMetier("Client introuvable.")
    nb = p.get("nombre")
    if not isinstance(nb, int) or isinstance(nb, bool) or nb < 1:
        raise ErreurMetier("Nombre de parts : un nombre entier, au moins une (loi 002/2002, art. 21 : parts intégralement libérées).")
    detenues = round(parts_du_tiers(tid))
    if sens == "achat":
        controler_statut_actif(t["statut"])
    else:
        if t["statut"] != "resilie":               # résilié : toutes les parts peuvent être remboursées (apurement, art. 27)
            controler_statut_actif(t["statut"])
        if nb > detenues:
            raise ErreurMetier(f"Le membre ne détient que {detenues} part(s).")
        if t["statut"] != "resilie" and detenues - nb < 1:
            raise ErreurMetier("Le membre garde au moins une part (loi 002/2002, art. 22) ; pour tout retirer, le résilier d'abord.")
    montant = nb * valeur_part()
    coupures = nettoyer(p.get("coupures") or {})
    controler_montant_coupures(coupures, montant, "CDF")
    if sens == "retrait":
        th = theorique(s["id"], "CDF")
        if any(n > th.get(v_, 0) for v_, n in coupures.items()):
            raise ErreurMetier("Pas assez de coupures en caisse.")
    if en_usd(montant, "CDF") + especes_du_jour_usd(tid, s["journeeId"], "retrait" if sens == "retrait" else "depot") >= SEUIL_ESPECES_USD:
        raise ErreurMetier(MSG_RENFORCE)
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    caisse = {"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "D" if sens == "achat" else "C", "devise": "CDF", "montant": montant}
    parts = {"compte": compte_parts(t), "contrat": f"parts:{tid}", "sens": "C" if sens == "achat" else "D", "devise": "CDF", "montant": montant}
    type_ = "achat_parts" if sens == "achat" else "retrait_parts"
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=f"{'Achat' if sens == 'achat' else 'Retrait'} de parts sociales {t['numero']}",
                 piece=nouvelle_piece(j["date_comptable"]), evenement=type_, cle=p["cle"], valide_par=u["id"], lignes_ecr=[caisse, parts])
    executer("insert into mouvement_parts (tiers_id, sens, nombre, valeur_unitaire, devise, ecriture_id) values (%s, %s, %s, %s, 'CDF', %s)",
             (tid, sens, nb, valeur_part(), eid))
    oid = creer_operation(u, s, cle=p["cle"], type_=type_, statut="validee", tiers_id=tid, contrat=f"parts:{tid}", montant=montant, devise="CDF",
                          coupures=coupures, remis_par=titulaire(tid), parts=nb, ecriture_id=eid)
    return vue_operation(une("select * from operation where id = %s", (oid,)))


# ---------- Visas des opérations ----------

def operations_en_attente(u: dict) -> list[dict]:
    return [vue_operation(o) for o in lignes("select * from operation where institution_id = %s and statut in ('saisie', 'visee') order by id", (u["institution_id"],))]


def lire_operation(oid: int) -> dict | None:
    o = une("select * from operation where id = %s", (oid,))
    return vue_operation(o) if o else None


def operations_du_jour(jid: int) -> list[dict]:
    return [vue_operation(o) for o in lignes("select * from operation where journee_id = %s order by id", (jid,))]


def viser_operation(u: dict, oid: int) -> dict:
    exiger(u, "chef_agence")
    o = une("select * from operation where id = %s for update", (oid,))
    if not o or o["statut"] not in ("saisie", "visee"):
        raise ErreurMetier("Rien à viser.")
    if o["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : pas de visa sur sa propre saisie.")
    executer("update operation set statut = 'visee', vise_par = %s where id = %s", (u["id"], oid))
    return lire_operation(oid)


def refuser_operation(u: dict, oid: int):
    exiger(u, "chef_agence")
    if not executer("update operation set statut = 'refusee', vise_par = %s where id = %s and statut in ('saisie', 'visee')", (u["id"], oid)):
        raise ErreurMetier("Rien à refuser.")


def recu(oid: int) -> dict:
    o = une("select * from operation where id = %s", (oid,))
    if not o:
        raise ErreurMetier("Opération introuvable.")
    e = une("select e.*, p.numero as piece from ecriture e join piece p on p.id = e.piece_id where e.id = %s", (o["ecriture_id"],)) if o["ecriture_id"] else None
    t = une("select numero from tiers where id = %s", (o["tiers_id"],))
    j = une("select date_comptable from journee_comptable where id = %s", (o["journee_id"],))
    compte = une("select numero from compte_depot where id = %s", (int(o["contrat_ref"].split(":")[1]),)) if (o["contrat_ref"] or "").startswith("depot:") else None
    return {"o": vue_operation(o), "piece": e["piece"] if e else "", "lignes": lignes_ecriture(e["id"]) if e else [], "titulaire": titulaire(o["tiers_id"]),
            "numeroMembre": t["numero"], "compte": compte["numero"] if compte else "", "date": j["date_comptable"].isoformat(),
            "caissier": nom_utilisateur(o["saisi_par"]), "viseur": nom_utilisateur(o["vise_par"])}


# ---------- États ----------

def lignes_ecriture(eid: int) -> list[dict]:
    return [{"compte": r["numero"], "contrat": r["contrat_ref"], "sens": r["sens"], "devise": r["devise"].strip(), "montant": r["montant_devise"], "montantCdf": r["montant_cdf"]}
            for r in lignes("select l.*, c.numero from ligne_ecriture l join compte c on c.id = l.compte_id where l.ecriture_id = %s order by l.rang", (eid,))]


def balance(u: dict) -> list[dict]:
    return [{"compte": r["numero"], "libelle": r["libelle"], "devise": r["devise"].strip(), "debit": int(r["debit"]), "credit": int(r["credit"]),
             "debitCdf": int(r["debit_cdf"]), "creditCdf": int(r["credit_cdf"])}
            for r in lignes("""select c.numero, c.libelle, l.devise,
                    sum(case when l.sens = 'D' then l.montant_devise else 0 end) as debit, sum(case when l.sens = 'C' then l.montant_devise else 0 end) as credit,
                    sum(case when l.sens = 'D' then l.montant_cdf else 0 end) as debit_cdf, sum(case when l.sens = 'C' then l.montant_cdf else 0 end) as credit_cdf
                    from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
                    where e.institution_id = %s group by c.numero, c.libelle, l.devise order by c.numero, l.devise""", (u["institution_id"],))]


def journal(u: dict, journee_id: int | None) -> list[dict]:
    res = []
    for e in lignes("""select e.*, j.code, p.numero as piece from ecriture e join journal j on j.id = e.journal_id join piece p on p.id = e.piece_id
                       where e.institution_id = %s and (%s::bigint is null or e.journee_id = %s) order by e.id""", (u["institution_id"], journee_id, journee_id)):
        res.append({"id": e["id"], "numero": e["numero"], "journal": e["code"], "journeeId": e["journee_id"], "libelle": e["libelle"], "piece": e["piece"],
                    "saisiPar": e["saisi_par"], "validePar": e["valide_par"], "lignes": lignes_ecriture(e["id"])})
    return res


def fr(iso: str) -> str:
    a, m, j = iso.split("-")
    return f"{j}/{m}/{a}"
