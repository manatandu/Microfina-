"""Règles métier de la tranche verticale, transposées de web/src/donnees/api.ts (même logique, même messages).
Chaque fonction s'exécute dans la transaction de la requête (ATOMIC_REQUESTS) : tout ou rien.
Les montants sont des entiers en unités mineures (ARCHITECTURE P4) ; les coupures arrivent en unités."""
import json
import secrets
import re
import uuid

from psycopg.types.json import Jsonb
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password

from .bd import ErreurMetier, executer, lignes, une, valeur

# Seuils, valeurs des maquettes
SEUIL_ESPECES_USD = 10000    # examen renforcé : loi 22/068, art. 23 ; Instr. BCC 15, art. 61 ; Instr. BCC 15 bis, art. 1
SORTIES = ("retrait", "retrait_parts", "ed_decaissement", "transfert_sortie", "versement_banque", "deblocage_credit")      # opérations qui font sortir des billets de la caisse
# Type entreprise (p. 50) : la liste de Microfina++ n'est pas montrée. À confirmer ; en attendant, les agents économiques du PCCI § 10.2 (hors ménages)
TYPES_ENTREPRISE = ["Banques commerciales et autres intermédiaires financiers", "Organes faîtiers et autres institutions de microfinance",
                    "Autres COOPEC et IMF", "Institutions financières non bancaires", "Administration centrale", "Administrations provinciales ou locales",
                    "Entreprises publiques", "Entreprises privées", "Institutions sans but lucratif"]
# Type de groupe : liste S14f (registre S39-2) ; en démonstration, « les groupements, les associations ou les ONG » (manuel p. 47).
# Agent économique (PCCI § 10.2) : associations et ONG sont des institutions sans but lucratif ; groupement ou autre libellé : à confirmer.
TYPES_GROUPE = {"Groupement solidaire": None, "Association": "Institutions sans but lucratif", "ONG": "Institutions sans but lucratif"}
# Pièces d'identité admises : Instr. BCC 15, art. 14
PIECES = ["Passeport", "Carte d'identité nationale", "Permis de conduire", "Carte d'étudiant", "Carte de l'armée ou de la police", "Carte d'électeur",
          "Lettre certifiée du chef de village ou de quartier", "Liste des bénéficiaires de programmes sociaux", "Carte de réfugié"]          # seul type montré par le manuel (p. 49) ; la liste viendra du paramétrage S16
IMAGE_MAX = 400_000                # caractères de l'image encodée, environ 300 Ko
IMAGE_OK = re.compile(r"^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$")
LIBELLES_ROLES = {"caissier": "caissier", "chef_agence": "chef d'agence", "agent_credit": "agent de crédit", "comptable": "comptable", "administrateur": "administrateur sécurité"}


# ---------- Session et utilisateur ----------

def charger_utilisateur(uid: int | None) -> dict | None:
    if not uid:
        return None
    u = une("select id, login, nom, institution_id, agence_id from utilisateur where id = %s and actif", (uid,))
    if not u:
        return None
    u["roles"] = [r["code"] for r in lignes(
        """select p.code from utilisateur_profil up join profil p on p.id = up.profil_id
           where up.utilisateur_id = %s and p.code is not null and not p.supprime order by p.code""", (uid,))]
    return u


def vue_utilisateur(u: dict) -> dict:
    from .droits import droits_utilisateur
    return {"id": u["id"], "login": u["login"], "nom": u["nom"], "roles": u["roles"], "droits": sorted(droits_utilisateur(u["id"]))}


def exiger(u: dict | None, role: str | None = None) -> dict:
    if not u:
        raise ErreurMetier("Session fermée. Reconnectez-vous.", 401)
    if role and role not in u["roles"] and not u.get("droit_route"):     # droit de la tâche déjà vérifié par la route (registre S04-3)
        raise ErreurMetier(f"Réservé au profil « {LIBELLES_ROLES[role]} ».", 403)
    return u


# Registre S07-4 : une connexion compte tant que la session vit (SESSION_COOKIE_AGE, réglée à une journée de travail) ; après, elle tombe d'elle-même
CONNECTE = f"jeton_session is not null and connecte_le > now() - interval '{int(settings.SESSION_COOKIE_AGE)} seconds'"


_FAUX_HASH: list[str] = []


def verifier_mot_de_passe(login: str, mot_de_passe) -> bool:
    """Registre S01-2 : mot de passe comparé à l'empreinte du compte (S05-3). Même durée et même réponse pour un identifiant inconnu,
    un compte sans mot de passe et un mauvais mot de passe : rien ne dit quels identifiants existent."""
    if not _FAUX_HASH:
        _FAUX_HASH.append(make_password("inconnu"))
    h = valeur("select mot_de_passe_hash from utilisateur where login = %s and actif", (login,))
    ok = check_password(mot_de_passe if isinstance(mot_de_passe, str) else "", h or _FAUX_HASH[0])
    return bool(ok and h and isinstance(mot_de_passe, str) and mot_de_passe)


def ouvrir_session(login: str, mot_de_passe: str | None, machine: str = "") -> dict:
    login = login.strip()
    if not settings.SANS_MOT_DE_PASSE and not verifier_mot_de_passe(login, mot_de_passe):
        raise ErreurMetier("Nom d'utilisateur ou mot de passe incorrect.")
    u = une(f"""select id, controle_connecte, machine, case when {CONNECTE} then jeton_session end as jeton_session
                 from utilisateur where login = %s and actif""", (login,))
    if not u:
        raise ErreurMetier("Identifiant inconnu.")
    # Registre S07-3 : « Control utilisateur connecté » (S05) : pas de seconde connexion tant que la première n'est pas fermée
    if u["controle_connecte"] and u["jeton_session"]:
        raise ErreurMetier(f"Déjà connecté ({u['machine'] or 'machine inconnue'}). Demander la déconnexion (Administration > Utilisateur > Déconnecter utilisateurs).")
    jeton = u["jeton_session"] or secrets.token_urlsafe(24)
    executer("update utilisateur set jeton_session = %s, machine = %s, connecte_le = now() where id = %s", (jeton, machine[:100], u["id"]))
    return {**charger_utilisateur(u["id"]), "jeton": jeton}


def utilisateur_de_session(uid, jeton) -> dict | None:
    """La session vaut tant que son jeton est celui de l'utilisateur et que la connexion n'a pas expiré (registre S07-2, S07-4).
    Une seule requête pour le jeton, l'utilisateur et ses profils : cette lecture ouvre chaque appel de l'API (mesure du 21/11/2026)."""
    if not uid or not jeton:
        return None
    return une(f"""select u.id, u.login, u.nom, u.institution_id, u.agence_id,
                          coalesce((select array_agg(p.code order by p.code) from utilisateur_profil up join profil p on p.id = up.profil_id
                                    where up.utilisateur_id = u.id and p.code is not null and not p.supprime), '{{}}') as roles
                   from utilisateur u where u.id = %s and u.actif and u.jeton_session = %s and {CONNECTE}""", (uid, jeton))


def fermer_session(uid, jeton) -> None:
    if uid and jeton:
        executer("update utilisateur set jeton_session = null where id = %s and jeton_session = %s", (uid, jeton))


def utilisateurs(public: bool = False) -> list[dict]:
    """public : la page de connexion, sans session. Site en ligne : la liste des identifiants n'y est pas publique (registre S01-2).
    Le référentiel, lu après connexion, garde la liste (noms des utilisateurs dans les rapports).
    Trois requêtes pour toute la liste (utilisateurs, profils, droits), au lieu de trois par utilisateur (mesure du 21/11/2026)."""
    if public and not settings.SANS_MOT_DE_PASSE:
        return []
    roles, droits = {}, {}
    for r in lignes("""select up.utilisateur_id, p.code from utilisateur_profil up join profil p on p.id = up.profil_id
                       where p.code is not null and not p.supprime order by p.code"""):
        roles.setdefault(r["utilisateur_id"], []).append(r["code"])
    for r in lignes("""select up.utilisateur_id, pd.droit_code from utilisateur_profil up join profil p on p.id = up.profil_id
                       join profil_droit pd on pd.profil_id = p.id where not p.supprime"""):
        droits.setdefault(r["utilisateur_id"], set()).add(r["droit_code"])
    return [{"id": r["id"], "login": r["login"], "nom": r["nom"], "roles": roles.get(r["id"], []), "droits": sorted(droits.get(r["id"], ()))}
            for r in lignes("select id, login, nom from utilisateur where actif order by id")]


def nom_utilisateur(uid: int | None) -> str:
    return valeur("select nom from utilisateur where id = %s", (uid,)) or "" if uid else ""


# ---------- Référentiel ----------

def institution_de(u: dict) -> dict:
    return une("select * from institution where id = %s", (u["institution_id"],))


def devises_tenues() -> list[str]:
    """Devises qui ont des monnaies (S35) : celles que comptent les guichets (registre S79-5)"""
    return [r["devise"].strip() for r in lignes("select distinct devise from coupure order by devise")]


def cours_ligne(devise: str, jour: date | None = None) -> dict | None:
    return une("select id, cours from cours_change where devise = %s and jour <= coalesce(%s, current_date) order by jour desc limit 1", (devise, jour))


def cours(devise: str, jour: date | None = None) -> float:
    """CDF pour une unité de la devise, au dernier cours saisi à cette date (PCCI § 7.1 : cours du jour de la transaction)"""
    if devise.strip() == "CDF":
        return 1.0
    c = cours_ligne(devise.strip(), jour)
    if c is None:
        raise ErreurMetier(f"Aucun cours du {devise.strip()} saisi (Préférences > Devise, page Cours).")
    return float(c["cours"])


def cours_usd(jour: date | None = None) -> float:
    return cours("USD", jour)


def centiemes(v) -> int:
    """Valeur d'une coupure, en unités (500, 0.5), vers les centièmes"""
    return int((Decimal(str(v)) * 100).to_integral_value())


def unites(c: int) -> str:
    """Centièmes vers la clé d'un comptage : « 500 », « 0.5 »"""
    return str(c // 100) if c % 100 == 0 else str((Decimal(c) / 100).normalize())


MSG_PART = ("Part sociale non paramétrée : Paramétrage > Frais et opérations > Paramétrage frais Adhésion, "
            "un frais au compte 1030, 1031 ou 1032 (registre S16-11).")


def profil_institution(u: dict) -> str:
    return valeur("select profil from institution where id = %s", (u["institution_id"],)) or "coopec"


def est_coopec(u: dict) -> bool:
    """COOPEC et structures faîtières (loi 002/2002) : membres, parts sociales (PCCI 103) ; une IMF (loi 11/020, art. 11) a des clients et un capital social (PCCI 100)"""
    return profil_institution(u) in ("coopec", "faitiere")


def exiger_parts_sociales(u: dict):
    if not est_coopec(u):
        raise ErreurMetier("Pas de parts sociales dans une institution de microfinance : son capital est souscrit par ses associés ou actionnaires "
                           "(loi 11/020, art. 14 et 15 ; PCCI, compte 100). Les parts sociales sont propres aux COOPEC (loi 002/2002 ; PCCI, compte 103).")


def controler_collecte_epargne(u: dict, famille: str):
    """Loi 11/020, art. 12 : l'entreprise de micro-crédit ne collecte pas l'épargne du public ; seul le dépôt de garantie exigé au déblocage (art. 5, point 13)"""
    if profil_institution(u) == "entreprise_microcredit" and famille != "BLOQUE":
        raise ErreurMetier("Une entreprise de micro-crédit ne collecte pas l'épargne du public (loi 11/020, art. 12) : "
                           "seul le dépôt de garantie, famille BLOQUE, est permis (art. 5, point 13).")


def valeur_part(institution_id: int) -> int:
    """Valeur nominale de la part, celle des statuts (loi 002/2002, art. 20) : la ligne de part des frais d'adhésion (registre S16-11, capture p. 89)"""
    v = valeur("""select p.valeur from parametrage_frais_adhesion p join frais f on f.id = p.frais_id
                  where f.institution_id = %s and p.supprime_le is null and f.supprime_le is null and p.compte like '103%%' and p.valeur > 0 order by p.id limit 1""", (institution_id,))
    if not v:
        raise ErreurMetier(MSG_PART)
    return int(v)


def valeur_part_ou_rien(institution_id: int) -> int | None:
    try:
        return valeur_part(institution_id)
    except ErreurMetier:
        return None


def contexte(u: dict) -> dict:
    i = institution_de(u)
    a = une("select id, code, nom from agence where id = %s", (u["agence_id"],))
    # Toutes les listes de référence en une requête, au lieu d'une par liste : le référentiel est lu par chaque écran (mesure du 21/11/2026)
    listes: dict[str, list[dict]] = {}
    for r in lignes("select liste, libelle, id from liste_reference where institution_id = %s and actif order by code, id", (u["institution_id"],)):
        listes.setdefault(r["liste"], []).append(r)
    libelles_liste = lambda _u, liste: [r["libelle"] for r in listes.get(liste, [])]
    return {
        "institution": {"nom": i["nom"], "profil": i["profil"], "delegationAdmission": i.get("delegation_admission") or "", "membresAuxiliaires": i.get("membres_auxiliaires") or "",
                        # en-tête des états financiers (PCCI 14.1) et de la liasse : sigle, n° d'agrément, NRC, adresse
                        "sigle": i.get("sigle") or "", "numeroAgrement": i.get("numero_agrement") or "", "nrc": i.get("nrc") or "", "rue": i.get("rue") or "",
                        "quartier": i.get("quartier") or "", "commune": i.get("commune") or "", "ville": i.get("ville") or ""},   # coopec, faitiere, societe_microfinance, entreprise_microcredit (S32)
        "agence": a,
        "guichets": lignes("select id, code, nom from guichet where agence_id = %s and actif order by code", (u["agence_id"],)),
        "produits": lignes("select code, libelle, devise from produit_epargne where institution_id = %s and actif and not supprime order by code", (u["institution_id"],)),
        "zones": [z["nom"] for z in lignes("select nom from zone where institution_id = %s and actif order by nom", (u["institution_id"],))],
        "typesClient": libelles_liste(u, "type_client"),   # S14g (registre S37-2)
        # S37 : listes lues par la fiche du client (registre S37-2)
        "listesFiche": {k: libelles_liste(u, liste) for k, (liste, _) in LISTES_FICHE.items()} | {"filiation": libelles_liste(u, "filiation"), "formeJuridique": libelles_liste(u, "forme_juridique"), "formeJuridiqueGroupe": libelles_liste(u, "forme_juridique_groupe"),
                        "categorieGroupe": libelles_liste(u, "categorie_groupe")},
        "typesActivite": lignes("""select t.libelle, s.libelle as secteur from liste_reference t join liste_reference s on s.id = t.parent_id
                                   where t.institution_id = %s and t.liste = 'type_activite' and t.actif order by t.code""", (u["institution_id"],)),
        "gestionnaires": lignes("""select id, trim(nom || ' ' || prenom) as nom from agent_agence where institution_id = %s and role = 'gestionnaire' and actif
                                   order by nom, prenom""", (u["institution_id"],)),
        "typesEntreprise": TYPES_ENTREPRISE,
        "typesGroupe": libelles_liste(u, "type_groupe"),
        "pieces": PIECES,
        "professions": libelles_liste(u, "profession"),   # S14b (registre S14b-2)
        # S33 : sensibilisateurs et commerciaux proposés au prospect et à la fiche client (registre S33-4)
        **{cle: lignes("""select id, trim(nom || ' ' || prenom) as nom from agent_agence where institution_id = %s and role = %s and actif order by nom, prenom""",
                       (u["institution_id"], role)) for cle, role in (("sensibilisateurs", "sensibilisateur"), ("commerciaux", "commercial"))},
        "localites": localites(),
        "arbreLieux": __import__("noyau.adresse", fromlist=["arbre"]).arbre(),   # adresse unique : province, ville ou territoire, commune, quartier (registre T41)
        "motifsDepart": [r["libelle"] for r in sorted(listes.get("motif_depart", []), key=lambda r: r["id"])],
        "cours": {r["devise"].strip(): float(cours(r["devise"])) for r in lignes("select distinct devise from cours_change")},
        # S35 : devises et monnaies, lues par les guichets (registre S79-5)
        "devises": lignes("select code, libelle, unite from devise order by code"),
        "monnaies": {d: [{"valeur": float(unites(r["valeur"])), "libelle": r["libelle"]}
                         for r in lignes("""select c.valeur, coalesce(t.libelle, '') as libelle from coupure c left join type_monnaie t on t.id = c.type_id
                                            where c.devise = %s order by c.valeur desc""", (d,))] for d in devises_tenues()},
        "valeurPart": valeur_part_ou_rien(u["institution_id"]),
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
    # Registre T14, S12-2, S12-5 : des journées peuvent attendre leur comptabilisation, au plus « Journée Maxi ouvert » à la fois (Information société)
    ouvertes = lignes("select date_comptable from journee_comptable where agence_id = %s and statut <> 'fermee' order by date_comptable", (u["agence_id"],))
    maxi = valeur("select journee_max from institution where id = %s", (u["institution_id"],)) or 1
    if len(ouvertes) >= maxi:
        raise ErreurMetier(f"Journée Maxi ouvert atteinte ({maxi}) : comptabiliser d'abord la journée du {fr(ouvertes[0]['date_comptable'].isoformat())} "
                           "(Comptabilité > Comptabilisation).")
    e = une("select * from exercice where institution_id = %s and annee = %s", (u["institution_id"], int(str(jour)[:4])))
    if not e or not e["ouvert"] or e["valide"]:
        # Registre S11-2 et S12-1 : une journée ne s'ouvre que dans un exercice ouvert et non validé (S11)
        raise ErreurMetier(f"L'exercice {str(jour)[:4]} n'est pas ouvert (Administration > Exercice).")
    derniere = journee_courante(u)
    if derniere and jour <= derniere["date"]:
        raise ErreurMetier(f"La date doit suivre la dernière journée ({fr(derniere['date'])}).")
    # Registre S34-4 : pas de journée un jour férié saisi, ni un jour que l'agence n'a pas coché (loi 22/069, art. 186) ; aucun jour coché : pas de contrôle
    ferie = une("select description from jour_ferie where institution_id = %s and date_ferie = %s", (u["institution_id"], jour))
    if ferie:
        raise ErreurMetier(f"Le {fr(str(jour))} est férié : {ferie['description']} (Agence > Jours fériés).")
    jt = valeur("select jours_travail from agence where id = %s", (u["agence_id"],)) or []
    rang = date.fromisoformat(str(jour)).isoweekday() % 7
    if any(jt) and not jt[rang]:
        nom = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][rang]
        raise ErreurMetier(f"Le {fr(str(jour))} est un {nom} : pas une journée de travail de l'agence (Agence > Journée de travail).")
    jid = valeur("insert into journee_comptable (agence_id, date_comptable, statut, ouverte_par) values (%s, %s, 'ouverte', %s) returning id",
                 (u["agence_id"], jour, u["id"]))
    # S65 : les DAT échus à cette date sont reconduits ou versés au compte émetteur (manuel p. 75 ; décision du porteur, 19/11/2026)
    from .depots_terme import traiter_echeances
    traiter_echeances(u, {"id": jid, "date": str(jour)})
    # S69 : les plans d'épargne arrivés à leur fin sont clos, le versé et l'intérêt acquis vont au compte épargne (registre S69-7)
    from .plans_epargne import traiter_fins
    traiter_fins(u, {"id": jid, "date": str(jour)})
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
    """S111 : comptabilisation de la journée (manuel p. 130, « Journée non comptabilisée »). Registre T14 : dans l'ordre des dates."""
    exiger(u, "chef_agence")
    j = une("select * from journee_comptable where id = %s and agence_id = %s", (jid, u["agence_id"]))
    if not j or j["statut"] == "fermee":
        raise ErreurMetier("Journée introuvable ou déjà comptabilisée.")
    avant = une("""select date_comptable from journee_comptable where agence_id = %s and statut <> 'fermee' and date_comptable < %s
                   order by date_comptable limit 1""", (u["agence_id"], j["date_comptable"]))
    if avant:
        raise ErreurMetier(f"Comptabiliser d'abord la journée du {fr(avant['date_comptable'].isoformat())} : les journées se comptabilisent dans l'ordre des dates.")
    bloquants = [c for c in controles_journee(jid) if c["etat"] == "ko"]
    if bloquants:
        raise ErreurMetier("Fermeture impossible : " + " ; ".join(c["titre"].lower() for c in bloquants) + ".")
    from .comptabilisation import passer
    passer(u, j)                       # écritures laissées en attente par la Banque, avec leur N° de pièce (registre S111-4)
    executer("update journee_comptable set statut = 'fermee', fermee_par = %s, fermee_le = now() where id = %s", (u["id"], jid))
    return vue_journee(une("select * from journee_comptable where id = %s", (jid,)))


# ---------- Coupures et billetages ----------

def json_lu(v):
    """Django rend le jsonb sous forme de texte : on le décode ici, un seul endroit."""
    return json.loads(v) if isinstance(v, str) else v


def total_comptage(c: dict) -> int:
    c = json_lu(c)
    return sum(centiemes(v) * int(n or 0) for v, n in (c or {}).items())


def total_lignes(bid: int) -> int:
    return int(valeur("select coalesce(sum(valeur * nombre), 0) from billetage_ligne where billetage_id = %s", (bid,)))


def comptage_billetage(bid: int) -> dict:
    return {unites(r["valeur"]): r["nombre"] for r in lignes("select valeur, nombre from billetage_ligne where billetage_id = %s and nombre > 0", (bid,))}


def nettoyer(c: dict) -> dict:
    return {unites(centiemes(v)): int(n) for v, n in (c or {}).items() if int(n or 0) > 0}


def vue_session(s: dict | None) -> dict | None:
    if not s:
        return None
    statut = "fermee" if s["statut"] == "ouverte" and s.get("fermee_le") else s["statut"]   # Fermeture du guichet (S09, p. 19)
    return {"id": s["id"], "guichetId": s["guichet_id"], "journeeId": s["journee_id"], "caissierId": s["caissier_id"], "statut": statut}


def solde_comptable_caisse(sid: int, devise: str) -> int:
    """Registre S80-2 : troisième case de la validation, le solde du compte comptable du guichet (S08) à la journée."""
    gid = valeur("select guichet_id from session_caisse where id = %s", (sid,))
    if gid is None:
        raise ErreurMetier("Caisse introuvable.")
    return solde_contrat(f"guichet:{gid}", devise, "D")


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
    base = {centiemes(k): v for k, v in (comptage_billetage(veille["id"]) if veille else {}).items()}
    for r in lignes("""select o.type, c.valeur, c.nombre from operation o join operation_coupure c on c.operation_id = o.id
                       where o.session_caisse_id = %s and o.statut = 'validee' and o.devise = %s""", (session_id, devise)):
        signe = -1 if r["type"] in SORTIES else 1
        base[r["valeur"]] = base.get(r["valeur"], 0) + signe * r["nombre"]
    return {unites(k): v for k, v in base.items() if v}


def vue_billetage(b: dict) -> dict:
    return {"id": b["id"], "sessionId": b["session_caisse_id"], "moment": b["moment"], "devise": b["devise"].strip(),
            "compte": comptage_billetage(b["id"]), "theorique": json_lu(b["theorique"]) or {}, "justification": b["justification"],
            "bonCaisse": b["bon_caisse"], "saisiPar": b["saisi_par"], "validePar": b["valide_par"]}


def billetages(session_id: int) -> list[dict]:
    return [vue_billetage(b) for b in lignes("select * from billetage where session_caisse_id = %s order by id", (session_id,))]


def controler_coupures(c: dict, devise: str):
    for v in c:
        if not une("select 1 from coupure where devise = %s and valeur = %s", (devise, centiemes(v))):
            raise ErreurMetier("Coupure inconnue.")


def saisir_billetage(u: dict, session_id: int, devise: str, compte: dict, bon_caisse: int = 0) -> dict:
    """S79 : Caisse > Billetage > Enregistrer de billetage (manuel p. 90 et 91) : « Arrêtée de » la caisse, coupures, Bon de Caisse."""
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
        executer("insert into billetage_ligne (billetage_id, devise, valeur, nombre) values (%s, %s, %s, %s)", (bid, devise, centiemes(v), n))
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
    if b["moment"] == "arret":
        ecriture_ecart(u, b)
    executer("update billetage set valide_par = %s, valide_le = now() where id = %s", (u["id"], bid))
    if b["moment"] == "arret":
        n = valeur("select count(distinct devise) from billetage where session_caisse_id = %s and moment = 'arret' and valide_par is not null", (b["session_caisse_id"],))
        if n >= len(devises_tenues()):
            executer("update session_caisse set statut = 'arretee', arretee_le = now() where id = %s", (b["session_caisse_id"],))
    return vue_billetage(une("select * from billetage where id = %s", (bid,)))


def ecriture_ecart(u: dict, b: dict):
    """Registre S80-5 : à la validation, l'écart entre le solde réel (billetage + Bon de Caisse) et le compte du guichet passe en écriture.
    Excédent : crédit du compte surplus du guichet (PCCI 7790 Excédents de caisse) ; manquant : débit du compte manquant (PCCI 671 Déficits
    de caisse non récupérés) ; l'autre côté est le compte du guichet. Mêmes règles que web/src/donnees/api.ts (caisses.validerBilletage)."""
    devise = b["devise"].strip()
    reel = total_lignes(b["id"]) + int(b["bon_caisse"] or 0)
    ecart = reel - solde_comptable_caisse(b["session_caisse_id"], devise)
    if ecart == 0:
        return
    s = une("select * from session_caisse where id = %s", (b["session_caisse_id"],))
    g = une("select nom, compte_surplus, compte_manquant from guichet where id = %s", (s["guichet_id"],))
    j = une("select date_comptable from journee_comptable where id = %s", (s["journee_id"],))
    surplus, m = ecart > 0, abs(ecart)
    eid = poster(u, journal="CA", journee_id=s["journee_id"], libelle=f"{'Excédent' if surplus else 'Manquant'} de caisse {g['nom']}",
                 piece=nouvelle_piece(u, "CA", j["date_comptable"]), evenement="ecart_caisse", cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=[
                     {"compte": "570", "contrat": f"guichet:{s['guichet_id']}", "sens": "D" if surplus else "C", "devise": devise, "montant": m},
                     {"compte": (g["compte_surplus"] or "7790") if surplus else (g["compte_manquant"] or "671"), "sens": "C" if surplus else "D", "devise": devise, "montant": m}])
    executer("update billetage set ecriture_ecart_id = %s where id = %s", (eid, b["id"]))


def billetages_a_valider(u: dict) -> list[dict]:
    j = journee_courante(u)
    if not j:
        return []
    return [vue_billetage(b) for b in lignes("""select b.* from billetage b join session_caisse s on s.id = b.session_caisse_id
                                               where s.journee_id = %s and b.valide_par is null order by b.id""", (j["id"],))]


# ---------- Tiers ----------

def vue_representant(r: dict) -> dict:
    """Représentant identifié comme un client (loi 22/068, art. 33 ; Instr. BCC 15, art. 13 et 16 ; confrontation du 21/11/2026, E1)"""
    return {"nom": r["nom"], "postnom": r["postnom"] or "", "prenom": r["prenom"] or "", "pieceType": r["piece_type"], "pieceNumero": r["piece_numero"],
            "pieceExpire": iso(r["piece_validite"]), "photo": bool(r["photo"]), "specimen": bool(r["signature"]),
            "naissance": iso(r.get("date_naissance")), "lieuNaissance": r.get("lieu_naissance") or "", "pieceDelivreeLe": iso(r.get("piece_delivree_le")),
            "pieceLieu": r.get("piece_lieu") or "", "pieceAutorite": r.get("piece_autorite") or "", "piecePays": r.get("piece_pays") or "",
            "qualite": r.get("qualite") or "", "personneExposee": bool(r.get("personne_exposee")), "adresse": r.get("adresse") or "",
            **{k: r.get(c) or "" for k, c in ADRESSE_REP.items()}}


# Adresse unique (registre T41) : clés de l'écran et colonnes de la table representant
ADRESSE_REP = {"pays": "pays", "province": "province", "ville": "ville", "commune": "commune", "quartier": "quartier", "rue": "rue", "numeroRue": "numero_rue"}
# Nature du contrôle exercé par le bénéficiaire effectif (loi 22/068, art. 34 bis, 1° à 3°)
NATURES_EFFECTIF = ("Participation de contrôle", "Contrôle par d'autres moyens", "Dirigeant principal")


def vue_tiers(t: dict) -> dict:
    effectifs = lignes("select autre_id, nature, part from lien_tiers where tiers_id = %s and role = 'beneficiaire_effectif' order by id", (t["id"],))
    sp = une("select photo, signature from specimen where tiers_id = %s order by id desc limit 1", (t["id"],))
    reps = lignes("select * from representant where tiers_id = %s and retire_le is null order by id", (t["id"],))   # E8 : les retirés restent en base
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
            "lieuNaissance": t["lieu_naissance"] or "", "pieceDelivreeLe": iso(t["piece_delivree_le"]), "pieceLieu": t["piece_lieu"] or "", "pieceAutorite": t["piece_autorite"] or "", "piecePays": t.get("piece_pays") or "",
            "liees": [r["autre_id"] for r in lignes("select autre_id from lien_tiers where tiers_id = %s and role = 'personne_liee' order by id", (t["id"],))],
            "beneficiairesEffectifs": [r["autre_id"] for r in effectifs],
            "controleEffectifs": [{"nature": r["nature"] or "", "part": str(r["part"]).replace(".", ",") if r["part"] is not None else ""} for r in effectifs],
            "objetRelation": t.get("objet_relation") or "", "origineFonds": t.get("origine_fonds") or "",   # A8
            "habilitationReference": t.get("habilitation_reference") or "",   # A7
            "refusMotif": t.get("refus_motif") or "", "refuseLe": iso(t.get("refuse_le")),   # A5
            "exclusionReference": t.get("exclusion_reference") or "", "exclusionLe": iso(t.get("exclusion_le")),   # P1
            "decesLe": iso(t.get("deces_le")), "decesReference": t.get("deces_reference") or "",   # A16
            "intitule": t["intitule"] or "", "dateVisa": iso(t["date_visa"]), "admissionLe": iso(t.get("admission_le")), "admissionReference": t.get("admission_reference") or "", "emancipationReference": t.get("emancipation_reference") or "", "representantLegal": t.get("representant_legal") or "", "auxiliaire": bool(t.get("auxiliaire")), "creeLe": t["cree_le"].date().isoformat(), "motifDepart": t["motif_depart"] or "", "resilieLe": iso(t["resilie_le"]),
            "sensibilisateurId": t["sensibilisateur_id"], "commercialId": t["commercial_id"],
            "profession": t["profession"] or "", "pays": t["pays"] or "", "ville": t["ville"] or "", "quartier": t["quartier"] or "", "rue": t["rue"] or "",
            "province": t["province"] or "", "numeroRue": t["numero_rue"] or "",   # adresse unique (registre T41)
            "email": t["email"] or "", "bp": t["bp"] or "", "telephoneFixe": t["telephone_fixe"] or "",
            "type": t["type"], "formeJuridique": t["forme"] or "", "registre": t["rccm"] or "", "centreActivite": t["centre_activite"] or "", "activite": t["activite"] or "",
            "dirigeant": dirigeant, "signataires": signataires, "membres": membres, "nbHommes": t["nb_hommes"] or 0, "nbFemmes": t["nb_femmes"] or 0,
            "photo": bool(sp and sp["photo"]), "specimen": bool(sp and sp["signature"]) or any(x["specimen"] for x in signataires),
            "creePar": t["cree_par"], "visePar": t["vise_par"],
            # S37 : fiche du client (registre S37-1 à S37-3)
            "civilite": t["civilite"] or "", "nationalite": t["nationalite"] or "", "situationMatrimoniale": t["situation_matrimoniale"] or "",
            "pere": t["pere"] or "", "mere": t["mere"] or "", "commune": t["commune"] or "", "secteurActivite": t["secteur_activite"] or "",
            "typeActivite": t["type_activite"] or "", "categorie": categorie_groupe(t["nb_hommes"], t["nb_femmes"]) if t["type"] == "groupe" else (t["categorie"] or ""), "sousTypeClient": t["sous_type_client"] or "",
            "gestionnaireId": t["gestionnaire_agent_id"],
            "beneficiaires": [{"nom": b["nom"], "postnom": b["postnom"] or "", "prenom": b["prenom"] or "", "sexe": b["sexe"] or "",
                               "naissance": iso(b["date_naissance"]), "filiation": b["filiation"] or "", "telephone": b["telephone"] or ""}
                              for b in lignes("select * from tiers_beneficiaire where tiers_id = %s order by id", (t["id"],))]}


def iso(d) -> str:
    return d.isoformat() if d else ""


SQL_TIERS = """select t.*, coalesce(p.nom, m.raison_sociale) as nom, p.postnom, p.prenom, p.sexe, p.date_naissance, p.lieu_naissance, p.piece_type, p.piece_numero,
                      p.piece_delivree_le, p.piece_lieu, p.piece_autorite, p.piece_validite, p.piece_pays, p.habilitation_reference, p.profession, coalesce(p.pays, m.pays) as pays, coalesce(p.ville, m.ville) as ville,
                      coalesce(p.quartier, m.quartier) as quartier, coalesce(p.rue, m.rue) as rue,
                      coalesce(p.province, m.province) as province, coalesce(p.numero_rue, m.numero_rue) as numero_rue, coalesce(p.email, m.email) as email, coalesce(p.bp, m.bp) as bp,
                      coalesce(p.telephone_fixe, m.telephone_fixe) as telephone_fixe,
                      p.civilite, p.nationalite, p.situation_matrimoniale, p.pere, p.mere, coalesce(p.commune, m.commune) as commune, coalesce(p.adresse, m.adresse_siege) as adresse, p.telephone,
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


def controler_univocite(u: dict, type_: str, numero: str, sauf: int | None = None):
    """A9 : l'identification représente la personne « de manière univoque » (Instr. BCC 15, art. 23 ; ordonnance-loi 23/010 portant Code du numérique,
    art. 171) : une pièce d'identité ne sert qu'à une fiche de client en cours. Les fiches résiliées ou refusées ne comptent pas."""
    r = une("""select t.numero from tiers t join tiers_personne p on p.tiers_id = t.id
               where t.institution_id = %s and p.piece_type = %s and upper(btrim(p.piece_numero)) = upper(%s) and t.statut not in ('resilie', 'refuse')
                 and (%s::bigint is null or t.id <> %s) order by t.id limit 1""", (u["institution_id"], type_, numero.strip(), sauf, sauf))
    if r:
        raise ErreurMetier(f"Cette pièce d'identité est déjà celle du client n° {r['numero']} : une personne n'a qu'une fiche (Instr. BCC 15, art. 23).")


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
    effectifs = d.get("beneficiairesEffectifs") or []
    if (not isinstance(effectifs, list) or any(not isinstance(x, int) or isinstance(x, bool) for x in effectifs) or len(set(effectifs)) != len(effectifs)
            or set(effectifs) & set(liees)
            or valeur("select count(*) from tiers where institution_id = %s and type = 'physique' and id = any(%s)", (u["institution_id"], effectifs)) != len(effectifs)):
        raise ErreurMetier("Bénéficiaire effectif : personne physique inconnue ou en double (Instr. BCC 15, art. 18).")
    controles = controler_effectifs(d, effectifs)
    return {"produit": produit, "zone": zone, "depot": depot, "liees": liees, "effectifs": effectifs, "controles": controles, "texte": texte}


def controler_effectifs(d: dict, effectifs: list) -> list[tuple]:
    """Nature du contrôle de chaque bénéficiaire effectif (loi 22/068, art. 34 bis, 1° à 3°) ; une participation de contrôle dépasse 25 % du capital
    ou des droits de vote (art. 39, al. 2, 1° et 8°). Confrontation du 21/11/2026, E1."""
    from decimal import Decimal, InvalidOperation
    controles = d.get("controleEffectifs") or []
    if not isinstance(controles, list):
        raise ErreurMetier("Bénéficiaires effectifs : nature du contrôle invalide.")
    sortie = []
    for i, autre in enumerate(effectifs):
        c = controles[i] if i < len(controles) and isinstance(controles[i], dict) else {}
        nature = str(c.get("nature") or "").strip()
        brut = str(c.get("part") or "").strip().replace(",", ".").rstrip("%").strip()
        if nature not in NATURES_EFFECTIF:
            raise ErreurMetier(f"Bénéficiaire effectif {i + 1} : nature du contrôle à choisir (loi 22/068, art. 34 bis).")
        part = None
        if brut:
            try:
                part = Decimal(brut)
            except InvalidOperation:
                part = Decimal(-1)
            if not Decimal(0) < part <= Decimal(100) or part != part.quantize(Decimal("0.01")):
                raise ErreurMetier(f"Bénéficiaire effectif {i + 1} : part invalide (pourcentage de 0,01 à 100).")
        if nature == NATURES_EFFECTIF[0] and (part is None or part <= 25):
            raise ErreurMetier(f"Bénéficiaire effectif {i + 1} : une participation de contrôle dépasse 25 % du capital ou des droits de vote (loi 22/068, art. 39, al. 2).")
        sortie.append((autre, nature, part))
    return sortie


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


def apercu_numero_client(u: dict) -> str:
    """Prochain numéro de la règle S15, sans avancer le compteur (code proposé d'un groupe solidaire, registre S44-2)"""
    r = une("select regle from numerotation_client where institution_id = %s", (u["institution_id"],))
    regle = json_lu(r["regle"]) if r else None
    ag = une("select a.code, i.sigle from agence a join institution i on i.id = a.institution_id where a.id = %s", (u["agence_id"],))
    dernier = valeur("""select coalesce((select dernier from compteur_client where agence_id = %s),
                                        (select case when is_called then last_value else last_value - 1 end from numero_tiers))""", (u["agence_id"],))
    n = max(dernier + 1, regle["compteur"] if regle else 1)
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


def controler_relation(texte, morale: bool):
    """A8 : objet et nature de la relation d'affaires, avant d'entrer en relation (loi 22/068, art. 34, al. 3 et art. 47) ; provenance des fonds
    d'une personne morale (Instr. BCC 15, art. 17 b). Exigés à l'enrôlement ; les clients d'avant le 21/11/2026 les reçoivent à leur mise à jour."""
    manque = [n for k, n in (("objetRelation", "objet et nature de la relation"), ("origineFonds", "origine des fonds")) if not texte(k) and (k == "objetRelation" or morale)]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + " (loi 22/068, art. 47 ; Instr. BCC 15, art. 17).")


def ecrire_relation(tid: int, texte):
    executer("update tiers set objet_relation = coalesce(%s, objet_relation), origine_fonds = coalesce(%s, origine_fonds) where id = %s",
             (texte("objetRelation") or None, texte("origineFonds") or None, tid))


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
    for autre, nature, part in b["controles"]:
        executer("insert into lien_tiers (tiers_id, autre_id, role, nature, part) values (%s, %s, 'beneficiaire_effectif', %s, %s)", (tid, autre, nature, part))
    return tid


# ---------- S37 : fiche du client physique (registre S37-1 à S37-3) ----------
# Listes que lit la fiche (S37-2) : clé du formulaire -> (liste de S14, nom affiché)
# Civilité, catégorie et sous type ne sont plus demandés (plan d'allègement, points 2.2, 2.4 et 2.6)
LISTES_FICHE = {"situationMatrimoniale": ("situation_matrimoniale", "Situation matrimoniale"),
                "secteurActivite": ("secteur_activite", "Secteur d'activité"), "typeActivite": ("type_activite", "Type d'activité")}
# Mentions de la pièce et de l'identité (Instr. BCC 15, art. 12 et 13)
OBLIGATOIRES_IDENTITE = [("prénom", "prenom"), ("date de naissance", "naissance"), ("lieu de naissance", "lieuNaissance"), ("adresse", "adresse"),
                         ("délivrée le", "pieceDelivreeLe"), ("lieu de délivrance", "pieceLieu"), ("autorité de délivrance", "pieceAutorite"),
                         ("valide jusqu'au", "pieceExpire")]


def libelles_liste(u: dict, liste: str) -> list[str]:
    return [r["libelle"] for r in lignes("select libelle from liste_reference where institution_id = %s and liste = %s and actif order by code, id",
                                         (u["institution_id"], liste))]


def controler_lieu(texte, quoi: str = "Pays, ville, commune ou quartier"):
    """L'adresse (Localisation, S20) : facultative, mais cohérente (registre T41, noyau/adresse.py)"""
    from .adresse import controler
    controler(texte, requis=bool(texte("province")), quoi=quoi)       # une adresse commencée par la province va jusqu'au quartier


def categorie_groupe(hommes, femmes) -> str:
    """Catégorie du groupe, calculée d'après les nombres d'hommes et de femmes déjà saisis (plan d'allègement, point 2.5)"""
    h, f = int(hommes or 0), int(femmes or 0)
    return "Groupe de femmes" if f and not h else "Groupe d'hommes" if h and not f else "Groupe mixte" if h and f else ""


def controler_fiche_physique(u: dict, d: dict, texte, j: dict | None, identite: bool = True, categorie: str = "categorie") -> dict:
    """Onglets Renseignements généraux et Autres renseignements (registre S37-1, S37-2) ; bénéficiaires (S37-3). Mêmes règles que api.ts.
    identite=False : entreprise et groupe, sans mentions d'une personne physique."""
    jour = date.today().isoformat()
    if identite:
        manque = [n for n, k in OBLIGATOIRES_IDENTITE if not texte(k)]
        if manque:
            raise ErreurMetier("À remplir : " + ", ".join(manque) + " (Instr. BCC 15, art. 12 et 13).")
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", texte("pieceExpire")) or (j and texte("pieceExpire") < j["date"]):
            raise ErreurMetier("Pièce expirée : une pièce en cours de validité (Instr. BCC 15, art. 12).")
    for k, n in (("naissance", "Date de naissance"), ("pieceDelivreeLe", "Délivrée le")):
        if texte(k) and (not re.match(r"^\d{4}-\d{2}-\d{2}$", texte(k)) or texte(k) > jour):
            raise ErreurMetier(f"{n} : date invalide.")
    for k, (liste, nom) in LISTES_FICHE.items():
        liste = categorie if k == "categorie" else liste   # groupe : Catégorie de groupe, S14j (registre S39-1)
        if texte(k) and texte(k) not in libelles_liste(u, liste):
            raise ErreurMetier(f"{nom} : valeur inconnue (Paramétrage > Info de base > Client > Général).")
    if texte("typeActivite") and not une("""select 1 from liste_reference t join liste_reference s on s.id = t.parent_id
                                           where t.institution_id = %s and t.liste = 'type_activite' and t.libelle = %s and s.libelle = %s""",
                                        (u["institution_id"], texte("typeActivite"), texte("secteurActivite"))):
        raise ErreurMetier("Type d'activité : il n'appartient pas au secteur d'activité choisi.")
    # A7 : une activité professionnelle déclarée (secteur d'activité) demande la pièce qui habilite à l'exercer (loi 22/068, art. 33, al. 4 ;
    # Instr. BCC 15, art. 13, al. 2) : registre de commerce, patente, autorisation d'exercer
    if identite and texte("secteurActivite") and not texte("habilitationReference"):
        raise ErreurMetier("À remplir : pièce d'habilitation professionnelle (référence), pour une activité déclarée (loi 22/068, art. 33, al. 4 ; "
                           "Instr. BCC 15, art. 13, al. 2).")
    if texte("nationalite") and texte("nationalite") not in [p["pays"] for p in localites()]:
        raise ErreurMetier("Nationalité : pays inconnu (Paramétrage > Localisation).")
    if texte("piecePays") and texte("piecePays") not in [p["pays"] for p in localites()]:
        raise ErreurMetier("Pays de délivrance : pays inconnu (Paramétrage > Localisation).")
    controler_lieu(texte)
    if texte("email") and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", texte("email")):
        raise ErreurMetier("Email invalide.")
    g = d.get("gestionnaireId")
    if g is not None and (not isinstance(g, int) or isinstance(g, bool) or not une(
            "select 1 from agent_agence where id = %s and institution_id = %s and role = 'gestionnaire' and actif", (g, u["institution_id"]))):
        raise ErreurMetier("Gestionnaire inconnu.")
    benef = d.get("beneficiaires") or []
    if not isinstance(benef, list):
        raise ErreurMetier("Bénéficiaires invalides.")
    filiations = libelles_liste(u, "filiation")
    for i, b in enumerate(benef, start=1):
        t = texte_de(b if isinstance(b, dict) else {})
        if not t("nom"):
            raise ErreurMetier(f"Bénéficiaire {i} : à remplir : nom.")
        if t("sexe") not in ("", "F", "M"):
            raise ErreurMetier(f"Bénéficiaire {i} : sexe inconnu.")
        if t("naissance") and (not re.match(r"^\d{4}-\d{2}-\d{2}$", t("naissance")) or t("naissance") > jour):
            raise ErreurMetier(f"Bénéficiaire {i} : date de naissance invalide.")
        if t("filiation") and t("filiation") not in filiations:
            raise ErreurMetier(f"Bénéficiaire {i} : filiation inconnue.")
    return {"gestionnaire": g, "beneficiaires": [texte_de(b) for b in benef], "agents": agents_prospect(u, d)}


def ecrire_fiche_physique(tid: int, texte, f: dict):
    # un prospect choisi garde ce qu'il avait quand la fiche laisse le champ vide (registre S37-6)
    executer("""update tiers_personne set civilite = coalesce(%s, civilite), nationalite = coalesce(%s, nationalite),
                                          situation_matrimoniale = coalesce(%s, situation_matrimoniale), pere = coalesce(%s, pere), mere = coalesce(%s, mere),
                                          profession = coalesce(%s, profession), pays = coalesce(%s, pays), ville = coalesce(%s, ville),
                                          commune = coalesce(%s, commune), quartier = coalesce(%s, quartier), rue = coalesce(%s, rue), email = coalesce(%s, email),
                                          bp = coalesce(%s, bp), telephone_fixe = coalesce(%s, telephone_fixe), province = coalesce(%s, province),
                                          numero_rue = coalesce(%s, numero_rue), habilitation_reference = coalesce(%s, habilitation_reference) where tiers_id = %s""",
             (*[texte(k) or None for k in ("civilite", "nationalite", "situationMatrimoniale", "pere", "mere", "profession", "pays", "ville", "commune",
                                           "quartier", "rue", "email", "bp", "telephoneFixe", "province", "numeroRue", "habilitationReference")], tid))
    executer("""update tiers set secteur_activite = %s, type_activite = %s, categorie = %s, sous_type_client = (case type when 'physique' then 'Personne physique' when 'morale' then 'Entreprise' else 'Groupe' end), gestionnaire_agent_id = %s,
                                 sensibilisateur_id = %s, commercial_id = %s where id = %s""",
             (*[texte(k) or None for k in ("secteurActivite", "typeActivite", "categorie")], f["gestionnaire"], *f["agents"], tid))
    executer("delete from tiers_beneficiaire where tiers_id = %s", (tid,))
    for t in f["beneficiaires"]:
        executer("""insert into tiers_beneficiaire (tiers_id, nom, postnom, prenom, sexe, date_naissance, filiation, telephone) values (%s, %s, %s, %s, %s, %s, %s, %s)""",
                 (tid, t("nom"), t("postnom") or None, t("prenom") or None, t("sexe") or None, t("naissance") or None, t("filiation") or None, t("telephone") or None))


def creer_tiers(u: dict, d: dict) -> dict:
    """S37. Mêmes contrôles que controlerEnrolement (web/src/donnees/api.ts)."""
    exiger(u)
    d = {**d, "typeClient": d.get("typeClient") or "Client"}   # le type client n'a qu'une valeur : posé d'office (plan d'allègement, point 2.3)
    b = controler_base(u, d, [("date demande", "dateDemande"), ("type client", "typeClient"), ("type de compte à créer", "produitCode"),
                              ("nom", "nom"), ("type de pièce", "pieceType"), ("numéro de pièce", "pieceNumero")], libelles_liste(u, "type_client") or ["Client"], False)
    texte = b["texte"]
    if texte("sexe") not in ("", "F", "M"):
        raise ErreurMetier("Sexe inconnu.")
    controler_piece(texte("pieceType"), texte("pieceExpire"), journee_courante(u))
    controler_univocite(u, texte("pieceType"), texte("pieceNumero"), d.get("prospectId") if isinstance(d.get("prospectId"), int) else None)   # A9
    controler_relation(texte, False)                                 # A8
    fiche = controler_fiche_physique(u, d, texte, journee_courante(u))
    images = d.get("images") or {}
    controler_image(images.get("photo"), "Photo"); controler_image(images.get("signature"), "Signature")
    controler_image(images.get("copiePiece"), "Copie de la pièce d'identité"); controler_image(images.get("justificatifAdresse"), "Justificatif d'adresse")
    controler_image(images.get("copieHabilitation"), "Pièce d'habilitation professionnelle")   # A7
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
                                          piece_delivree_le = %s, piece_lieu = %s, piece_autorite = %s, piece_validite = %s, adresse = %s, telephone = %s,
                                          piece_pays = coalesce(%s, piece_pays)
                where tiers_id = %s""",
             (texte("nom"), texte("postnom") or None, texte("prenom") or None, texte("sexe") or None, texte("naissance") or None, texte("lieuNaissance") or None,
              texte("pieceType"), texte("pieceNumero"), texte("pieceDelivreeLe") or None, texte("pieceLieu") or None, texte("pieceAutorite") or None,
              texte("pieceExpire") or None, texte("adresse") or None, texte("telephone") or None, texte("piecePays") or None, tid))
    ecrire_fiche_physique(tid, texte, fiche)
    if any(images.get(k) for k in ("photo", "signature", "copiePiece", "justificatifAdresse", "copieHabilitation")):
        executer("""insert into specimen (tiers_id, photo, signature, copie_piece, justificatif_adresse, copie_habilitation, depose_le)
                    values (%s, %s, %s, %s, %s, %s, current_date)""",
                 (tid, images.get("photo"), images.get("signature"), images.get("copiePiece"), images.get("justificatifAdresse"), images.get("copieHabilitation")))
    ecrire_relation(tid, texte)                                      # A8
    from .gel import rapprocher
    rapprocher(u, [tid])                                             # A13 : rapprochement avec les listes de gel en vigueur
    return lire_tiers(tid)


# Mentions d'un représentant, comme pour le client (loi 22/068, art. 33 ; Instr. BCC 15, art. 12, 13 et 16 ; confrontation du 21/11/2026, E1)
OBLIGATOIRES_REPRESENTANT = [("nom", "nom"), ("prénom", "prenom"), ("date de naissance", "naissance"), ("lieu de naissance", "lieuNaissance"),
                             ("type de pièce", "pieceType"), ("numéro de pièce", "pieceNumero"), ("délivrée le", "pieceDelivreeLe"),
                             ("lieu de délivrance", "pieceLieu"), ("autorité de délivrance", "pieceAutorite"), ("valide jusqu'au", "pieceExpire")]


def controler_representant(r, qui: str, j: dict | None, qualite: bool = False) -> dict:
    """qualite : dirigeant et signataires d'une entreprise, dont on vérifie qu'ils sont habilités à agir pour elle (loi 22/068, art. 31, al. 3 ;
    Instr. BCC 15, art. 11 et 16)"""
    if not isinstance(r, dict):
        raise ErreurMetier(f"{qui} invalide.")
    t = texte_de(r)
    manque = [n for n, k in OBLIGATOIRES_REPRESENTANT + ([("qualité ou pouvoir", "qualite")] if qualite else []) if not t(k)]
    if manque:
        raise ErreurMetier(f"{qui} : à remplir : " + ", ".join(manque) + " (loi 22/068, art. 31 et 33 ; Instr. BCC 15, art. 13 et 16).")
    controler_piece(t("pieceType"), t("pieceExpire"), j, f"{qui} : ")
    jour = date.today().isoformat()
    for k, n in (("naissance", "date de naissance"), ("pieceDelivreeLe", "délivrée le"), ("pieceExpire", "valide jusqu'au")):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", t(k)) or k != "pieceExpire" and t(k) > jour:
            raise ErreurMetier(f"{qui} : {n} : date invalide.")
    if t("piecePays") and t("piecePays") not in [p["pays"] for p in localites()]:
        raise ErreurMetier(f"{qui} : pays de délivrance inconnu (Paramétrage > Localisation).")
    if "personneExposee" in r and not isinstance(r["personneExposee"], bool):
        raise ErreurMetier(f"{qui} : personne exposée invalide.")
    from . import adresse
    adresse.controler(t, requis=True, quoi=f"{qui} : adresse")
    controler_image(r.get("photo"), f"{qui} : photo"); controler_image(r.get("signature"), f"{qui} : signature")
    return r


def cle_representant(r) -> tuple[str, str]:
    t = texte_de(r if isinstance(r, dict) else {})
    return (t("pieceType"), t("pieceNumero"))


def controler_representants(liste, qui: str, j: dict | None, anciens: set | None = None, qualite: bool = False):
    """Signataires, membres : une ligne « existant » (déjà enregistrée, gardée telle quelle à la mise à jour S46) doit exister ; une nouvelle est contrôlée"""
    if not isinstance(liste, list):
        raise ErreurMetier(f"{qui}s invalides.")
    for i, r in enumerate(liste, start=1):
        if isinstance(r, dict) and r.get("existant"):
            if anciens is None or cle_representant(r) not in anciens:
                raise ErreurMetier(f"{qui} {i} : inconnu.")
        else:
            controler_representant(r, f"{qui} {i}", j, qualite)


def anciens_representants(tid: int, role: str) -> set:
    return {(r["piece_type"], r["piece_numero"]) for r in lignes("select piece_type, piece_numero from representant where tiers_id = %s and role = %s and retire_le is null",
                                                                 (tid, role))}


def retirer_representant(u: dict, rid: int):
    """E8 : un représentant retiré reste en base, avec ses images, sa date de retrait et son auteur (loi 22/068, art. 48 : dix ans ; Instr. BCC 15, art. 29)"""
    executer("update representant set retire_le = now(), retire_par = %s where id = %s and retire_le is null", (u["id"], rid))


def remplacer_representants(u: dict, tid: int, role: str, liste: list):
    """Mise à jour (S46) : les lignes gardées restent avec leurs images, les retirées sont marquées retirées (E8), les nouvelles s'ajoutent"""
    garde = {cle_representant(r) for r in liste if r.get("existant")}
    for r in lignes("select id, piece_type, piece_numero from representant where tiers_id = %s and role = %s and retire_le is null", (tid, role)):
        if (r["piece_type"], r["piece_numero"]) not in garde:
            retirer_representant(u, r["id"])
    inserer_representants(tid, [(role, r) for r in liste if not r.get("existant")])


def remplacer_dirigeant(u: dict, tid: int, dirigeant: dict):
    """Mise à jour du dirigeant (S46) : même pièce, la fiche est mise à jour et garde ses images si aucune nouvelle n'est chargée ;
    autre pièce, l'ancien est marqué retiré (E8) et le nouveau s'ajoute"""
    actuel = une("select * from representant where tiers_id = %s and role = 'dirigeant' and retire_le is null order by id desc limit 1", (tid,))
    if actuel and (actuel["piece_type"], actuel["piece_numero"]) == cle_representant(dirigeant):
        r = {**dirigeant, "photo": dirigeant.get("photo") or actuel["photo"], "signature": dirigeant.get("signature") or actuel["signature"]}
        retirer_representant(u, actuel["id"])
        inserer_representants(tid, [("dirigeant", r)])
        return
    if actuel:
        retirer_representant(u, actuel["id"])
    inserer_representants(tid, [("dirigeant", dirigeant)])


def controler_entreprise(u: dict, d: dict, tid: int | None = None):
    """S38, et S46 pour la mise à jour (tid) : mêmes contrôles que controlerEntreprise (web/src/donnees/api.ts)"""
    b = controler_base(u, d, [("date demande", "dateDemande"), ("type entreprise", "typeClient"), ("zone", "zone"), ("type de compte à créer", "produitCode"),
                              ("dénomination", "nom"), ("forme juridique", "formeJuridique"), ("n° du registre", "registre"), ("adresse du siège", "adresse")],
                       TYPES_ENTREPRISE, True)
    texte = b["texte"]
    j = journee_courante(u)
    if texte("formeJuridique") not in libelles_liste(u, "forme_juridique"):
        raise ErreurMetier("Forme juridique : valeur inconnue (Paramétrage > Info de base > Client > Général).")
    fiche = controler_fiche_physique(u, d, texte, j, identite=False)   # listes, lieu, email, agents (registre S38-1)
    dirigeant = d.get("dirigeant")
    if dirigeant is not None:
        controler_representant(dirigeant, "Dirigeant", j, qualite=True)
    signataires = d.get("signataires") or []
    controler_representants(signataires, "Signataire", j, anciens_representants(tid, "signataire") if tid else None, qualite=True)
    if dirigeant is None:
        # Loi 22/068, art. 34, al. 4 : « obtenir et vérifier les noms des personnes exerçant des fonctions de direction au sein des personnes
        # morales ». Faute d'autre bénéficiaire effectif, le dirigeant est tenu pour tel (art. 34 bis, 3°). Confrontation du 21/11/2026, E1.
        raise ErreurMetier("Dirigeant : à remplir. Le dirigeant d'une personne morale est identifié à l'entrée en relation (loi 22/068, art. 34).")
    return b, texte, fiche, dirigeant, signataires


def creer_entreprise(u: dict, d: dict) -> dict:
    """S38 : Client > Enrôlement > Entreprise (manuel p. 49 et 50). Mêmes contrôles que controlerEntreprise (web/src/donnees/api.ts)."""
    exiger(u)
    b, texte, fiche, dirigeant, signataires = controler_entreprise(u, d)
    controler_relation(texte, True)                                  # A8 : provenance des fonds (Instr. BCC 15, art. 17 b)
    tid = inserer_tiers(u, d, b, "morale", texte("typeClient"))
    executer("""insert into tiers_morale (tiers_id, raison_sociale, forme, rccm, adresse_siege, centre_activite, activite)
                values (%s, %s, %s, %s, %s, %s, %s)""",
             (tid, texte("nom"), texte("formeJuridique"), texte("registre"), texte("adresse"), texte("centreActivite") or None, texte("typeActivite") or None))
    ecrire_fiche_morale(tid, texte, fiche)
    inserer_representants(tid, ([("dirigeant", dirigeant)] if dirigeant is not None else []) + [("signataire", r) for r in signataires])
    ecrire_relation(tid, texte)                                      # A8
    from .gel import rapprocher
    rapprocher(u, [tid])                                             # A13 : rapprochement avec les listes de gel en vigueur
    return lire_tiers(tid)


def ecrire_fiche_morale(tid: int, texte, f: dict):
    """Autres renseignements de l'entreprise, comme ceux du client physique (registre S38-1)"""
    executer("""update tiers_morale set pays = %s, ville = %s, commune = %s, quartier = %s, rue = %s, email = %s, bp = %s, telephone_fixe = %s, province = %s,
                                        numero_rue = %s where tiers_id = %s""",
             (*[texte(k) or None for k in ("pays", "ville", "commune", "quartier", "rue", "email", "bp", "telephoneFixe", "province", "numeroRue")], tid))
    executer("""update tiers set secteur_activite = %s, type_activite = %s, categorie = %s, sous_type_client = (case type when 'physique' then 'Personne physique' when 'morale' then 'Entreprise' else 'Groupe' end), gestionnaire_agent_id = %s,
                                 sensibilisateur_id = %s, commercial_id = %s where id = %s""",
             (*[texte(k) or None for k in ("secteurActivite", "typeActivite", "categorie")], f["gestionnaire"], *f["agents"], tid))


def inserer_representants(tid: int, liste: list[tuple[str, dict]]):
    from . import adresse
    for role, r in liste:
        t = texte_de(r)
        executer("""insert into representant (tiers_id, role, nom, postnom, prenom, piece_type, piece_numero, piece_validite, photo, signature,
                                              date_naissance, lieu_naissance, piece_delivree_le, piece_lieu, piece_autorite, piece_pays, qualite, personne_exposee,
                                              pays, province, ville, commune, quartier, rue, numero_rue, adresse)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                 (tid, role, t("nom"), t("postnom") or None, t("prenom") or None, t("pieceType"), t("pieceNumero"), t("pieceExpire") or None,
                  r.get("photo") or None, r.get("signature") or None, t("naissance") or None, t("lieuNaissance") or None, t("pieceDelivreeLe") or None,
                  t("pieceLieu") or None, t("pieceAutorite") or None, t("piecePays") or None, t("qualite") or None, r.get("personneExposee") is True,
                  *[t(k) or None for k in ADRESSE_REP], adresse.composer(t) or None))


def controler_groupe(u: dict, d: dict, tid: int | None = None):
    """S39, et S46 pour la mise à jour (tid) : mêmes contrôles que controlerGroupe (web/src/donnees/api.ts)"""
    # Une seule « Forme juridique » ; le type de groupe, qui donne l'agent économique, s'en déduit (plan d'allègement, point 2.5 ; registre S39-2)
    if (d.get("typeClient") or "").strip() not in libelles_liste(u, "type_groupe"):
        forme = (d.get("formeJuridique") or "").strip()
        if not forme:
            raise ErreurMetier("À remplir : forme juridique.")
        d["typeClient"] = "Groupement solidaire" if forme.startswith("Groupement") else "Association"
    b = controler_base(u, d, [("date demande", "dateDemande"), ("type de groupe", "typeClient"), ("type de compte à créer", "produitCode"),
                              ("dénomination", "nom"), ("adresse", "adresse")], libelles_liste(u, "type_groupe"), False)
    texte = b["texte"]
    if texte("formeJuridique") and texte("formeJuridique") not in libelles_liste(u, "forme_juridique_groupe"):      # registre S39-5
        raise ErreurMetier("Forme juridique : valeur inconnue (Paramétrage > Info de base > Client > Général > Forme juridique du groupe).")
    fiche = controler_fiche_physique(u, d, texte, None, identite=False, categorie="categorie_groupe")   # registre S39-1
    nombres = [d.get("nbHommes", 0), d.get("nbFemmes", 0)]
    if any(not isinstance(n, int) or isinstance(n, bool) or n < 0 for n in nombres):
        raise ErreurMetier("Nombre d'hommes ou de femmes invalide.")
    j = journee_courante(u)
    membres = d.get("membres") or []
    controler_representants(membres, "Membre", j, anciens_representants(tid, "membre") if tid else None)
    return b, texte, fiche, nombres, membres


def creer_groupe(u: dict, d: dict) -> dict:
    """S39 : Client > Enrôlement > Groupe (manuel p. 47 et 51). Mêmes contrôles que controlerGroupe (web/src/donnees/api.ts)."""
    exiger(u)
    b, texte, fiche, nombres, membres = controler_groupe(u, d)
    controler_relation(texte, False)                                 # A8
    images = d.get("images") or {}
    controler_image(images.get("photo"), "Photo"); controler_image(images.get("signature"), "Signature")
    controler_image(images.get("copiePiece"), "Copie de la pièce d'identité"); controler_image(images.get("justificatifAdresse"), "Justificatif d'adresse")
    tid = inserer_tiers(u, d, b, "groupe", (TYPES_GROUPE.get(texte("typeClient")) or "menages"))
    executer("""insert into tiers_morale (tiers_id, raison_sociale, forme, rccm, adresse_siege, activite, nb_hommes, nb_femmes)
                values (%s, %s, %s, %s, %s, %s, %s, %s)""",
             (tid, texte("nom"), texte("formeJuridique") or None, texte("registre") or None, texte("adresse"), texte("typeActivite") or None, *nombres))
    ecrire_fiche_morale(tid, texte, fiche)
    inserer_representants(tid, [("membre", r) for r in membres])
    if any(images.get(k) for k in ("photo", "signature", "copiePiece", "justificatifAdresse")):
        executer("insert into specimen (tiers_id, photo, signature, copie_piece, justificatif_adresse, depose_le) values (%s, %s, %s, %s, %s, current_date)",
                 (tid, images.get("photo"), images.get("signature"), images.get("copiePiece"), images.get("justificatifAdresse")))
    ecrire_relation(tid, texte)                                      # A8
    from .gel import rapprocher
    rapprocher(u, [tid])                                             # A13 : rapprochement avec les listes de gel en vigueur
    return lire_tiers(tid)


def tiers_a_viser(u: dict) -> list[dict]:
    return [vue_tiers(t) for t in lignes(SQL_TIERS + " where t.institution_id = %s and t.statut = 'a_viser' order by t.id", (u["institution_id"],))]


MAJORITE = 18     # Code de la famille, art. 219


def age_au(naissance: date, jour: date) -> int:
    """Âge en années accomplies au jour donné"""
    return jour.year - naissance.year - ((jour.month, jour.day) < (naissance.month, naissance.day))


def refuser_tiers(u: dict, tid: int, d: dict | None = None) -> dict:
    """A5 : refus de la demande d'ouverture, motivé et gardé (loi 22/069, titre III, chap. Ier). Quatre yeux, comme le visa."""
    exiger(u, "chef_agence")
    d = d or {}
    t = une("select * from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] != "a_viser":
        raise ErreurMetier("Seule une demande en attente de visa se refuse.")
    if t["cree_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : le refus vient d'une autre personne que celle qui a enrôlé.")
    motif = str(d.get("motif") or "").strip()
    if not motif:
        raise ErreurMetier("À remplir : motif du refus (loi 22/069, titre III, chap. Ier : un refus se motive).")
    j = journee_courante(u)
    executer("update tiers set statut = 'refuse', refus_motif = %s, refuse_le = %s, refuse_par = %s where id = %s",
             (motif, j["date"] if j else date.today().isoformat(), u["id"], tid))
    return lire_tiers(tid)


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
    from .conformite import exiger_autorisation_ppe
    exiger_autorisation_ppe(tid)                                     # écart E02 : Instr. BCC 15, art. 64
    from .gel import exiger_correspondances_examinees
    exiger_correspondances_examinees(tid)                            # A13 : listes de gel (loi 22/068, art. 158 bis)
    # Écart E03 (décision du porteur, 15/11/2026) : pas de visa d'une personne physique sans copie de sa pièce d'identité (Instr. BCC 15, art. 12 et 29)
    if t["type"] == "physique":
        sp = une("select copie_piece, justificatif_adresse, copie_habilitation from specimen where tiers_id = %s order by id desc limit 1", (tid,)) or {}
        manque = [n for k, n in (("copie_piece", "copie de la pièce d'identité"), ("justificatif_adresse", "justificatif d'adresse")) if not sp.get(k)]
        # A7 : activité déclarée, copie de la pièce d'habilitation (loi 22/068, art. 33, al. 4 ; Instr. BCC 15, art. 13, al. 2 et 29)
        if t.get("secteur_activite") and not sp.get("copie_habilitation"):
            manque.append("copie de la pièce d'habilitation professionnelle")
        if manque:   # art. 12 al. 2 et 3 : pièce et preuve de l'adresse ; art. 10 : avant d'entrer en relation ; art. 29 : copies gardées
            raise ErreurMetier(f"Manquant : {', '.join(manque)}. À déposer avant le visa (Client > Photos et signatures ; Instr. BCC 15, art. 10, 12 et 29).")
    # E1 : personne morale, copie des statuts et du registre (loi 22/068, art. 34, al. 1 : « Il en est pris photocopie » ; Instr. BCC 15, art. 17 a et 29).
    # Mêmes emplacements que la copie de la pièce et le justificatif d'adresse d'une personne physique (registre T43).
    if t["type"] == "morale":
        sp = une("select copie_piece, justificatif_adresse from specimen where tiers_id = %s order by id desc limit 1", (tid,)) or {}
        manque = [n for k, n in (("copie_piece", "copie des statuts"), ("justificatif_adresse", "copie du registre (acte de constitution)")) if not sp.get(k)]
        if manque:
            raise ErreurMetier(f"Manquant : {', '.join(manque)}. À déposer avant le visa (Client > Photos et signatures ; loi 22/068, art. 34 ; Instr. BCC 15, art. 17 et 29).")
    # Écart E20 : membre auxiliaire, si les statuts le prévoient (loi 002/2002, art. 23)
    auxiliaire = d.get("auxiliaire") is True
    if auxiliaire and not (est_coopec(u) and valeur("select coalesce(membres_auxiliaires, '') <> '' from institution where id = %s", (u["institution_id"],))):
        raise ErreurMetier("Membre auxiliaire : seulement dans une COOPEC dont les statuts le prévoient (loi 002/2002, art. 23 ; article à noter dans Paramétrage > Info société).")
    # Écart E18 : mineur (Code de la famille, art. 219, 221, 289, 292 ; loi 002/2002, art. 22 ; Instr. BCC 15, art. 12)
    eman, rep = texte("emancipationReference") or None, texte("representantLegal") or None
    nais = valeur("select date_naissance from tiers_personne where tiers_id = %s", (tid,)) if t["type"] == "physique" else None
    if nais and age_au(nais, date.fromisoformat(date_visa)) < MAJORITE:
        if est_coopec(u) and not eman and not auxiliaire:
            raise ErreurMetier(f"Mineur (moins de {MAJORITE} ans le {date.fromisoformat(date_visa).strftime('%d/%m/%Y')}) : il n'est pas capable de contracter et ne peut être admis "
                               "comme membre (loi 002/2002, art. 22 ; Code de la famille, art. 219). Émancipé : référence de la décision du Tribunal pour enfants (art. 289 et 292) ; "
                               "ou membre auxiliaire, si les statuts le prévoient (loi 002/2002, art. 23).")
        if not eman and not rep:
            raise ErreurMetier("Mineur : nom, qualité (père, mère ou tuteur) et pièce du représentant légal, ou référence de l'émancipation "
                               "(Code de la famille, art. 219, 221 et 289 ; Instr. BCC 15, art. 12).")
    else:
        eman = rep = None
    # Écart E05 : COOPEC, admission par le Conseil d'Administration (loi 002/2002, art. 22, 6°), ou par sa délégation (Info société)
    adm_le, adm_ref = texte("admissionLe") or None, texte("admissionReference") or None
    if est_coopec(u):
        delegation = valeur("select delegation_admission from institution where id = %s", (u["institution_id"],))
        if delegation and not (adm_le or adm_ref):
            adm_le, adm_ref = date_visa, f"Par délégation : {delegation}"
        if not adm_le or not adm_ref:
            raise ErreurMetier("Admission du membre : date et référence de la décision du Conseil d'Administration (loi 002/2002, art. 22, 6°), "
                               "ou délégation notée dans Paramétrage > Info société.")
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", adm_le) or adm_le > jour:
            raise ErreurMetier("Date de la décision d'admission invalide.")
    executer("""update tiers set statut = 'actif', vise_par = %s, vise_le = now(), date_visa = %s, intitule = %s, premier_depot = %s,
                admission_le = %s, admission_reference = %s, emancipation_reference = %s, representant_legal = %s, auxiliaire = %s where id = %s""",
             (u["id"], date_visa, intitule, depot, adm_le, adm_ref, eman, rep, auxiliaire, tid))
    return lire_tiers(tid)


def controler_statut_actif(statut: str, suite: str = ""):
    if statut == "resilie":
        raise ErreurMetier("Client résilié : plus d'opération ; apurement de ses comptes à faire (loi 002/2002, art. 27).")
    if statut == "modifie_a_revalider":
        raise ErreurMetier("Client modifié : à valider (Client > Visa > Valider client modifié) avant toute opération.")
    if statut != "actif":
        raise ErreurMetier(f"Client pas encore visé{suite}.")


def modifier_tiers(u: dict, tid: int, d: dict) -> dict:
    """S46 : Modification d'un client (manuel p. 56). Physique : Info de base, Info Généraux, Autre Info, Personnes Liées, Bénéficiaires ;
    entreprise et groupe : les onglets de leur enrôlement (registre S46-2). Le client passe « modifié à revalider » (S42, registre S46-1).
    Contrôles identiques à l'enrôlement, mentions de l'identité comprises (Instr. BCC 15, art. 10, 12 à 14, 60 ; registre S46-3)."""
    exiger(u)
    t = une("select * from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] not in ("actif", "modifie_a_revalider"):
        raise ErreurMetier("Client pas encore visé : le modifier depuis l'enrôlement.")
    d = {**(d if isinstance(d, dict) else {}), "produitCode": valeur("select code from produit_epargne where id = %s", (t["produit_id"],)) if t["produit_id"] else "EAV-CDF",
         "premierDepot": t["premier_depot"] or 0}
    if tid in (d.get("liees") or []):
        raise ErreurMetier("Un client ne peut pas être sa propre personne liée.")
    avant = lire_tiers(tid)
    if t["type"] == "morale":
        b, texte, fiche, dirigeant, signataires = controler_entreprise(u, d, tid)
        executer("""update tiers set date_demande = %s, type_client = %s, agent_economique = %s, zone_id = %s, residence = %s, prelever_agios = %s,
                                     calculer_interet = %s, personne_exposee = %s, statut = 'modifie_a_revalider' where id = %s""",
                 (texte("dateDemande"), texte("typeClient"), texte("typeClient"), b["zone"], "resident" if d.get("resident", True) else "non_resident",
                  bool(d.get("preleverAgios", True)), bool(d.get("calculerInteret")), bool(d.get("personneExposee")), tid))
        executer("""update tiers_morale set raison_sociale = %s, forme = %s, rccm = %s, adresse_siege = %s, centre_activite = %s, activite = %s where tiers_id = %s""",
                 (texte("nom"), texte("formeJuridique"), texte("registre"), texte("adresse"), texte("centreActivite") or None, texte("typeActivite") or None, tid))
        ecrire_fiche_morale(tid, texte, fiche)
        remplacer_dirigeant(u, tid, dirigeant)
        remplacer_representants(u, tid, "signataire", signataires)
        return terminer_modification(u, tid, b, avant, effectifs=True)
    if t["type"] == "groupe":
        b, texte, fiche, nombres, membres = controler_groupe(u, d, tid)
        executer("""update tiers set date_demande = %s, type_client = %s, agent_economique = %s, zone_id = %s, residence = %s, prelever_agios = %s,
                                     calculer_interet = %s, personne_exposee = %s, statut = 'modifie_a_revalider' where id = %s""",
                 (texte("dateDemande"), texte("typeClient"), (TYPES_GROUPE.get(texte("typeClient")) or "menages"), b["zone"], "resident" if d.get("resident", True) else "non_resident",
                  bool(d.get("preleverAgios", True)), bool(d.get("calculerInteret")), bool(d.get("personneExposee")), tid))
        executer("""update tiers_morale set raison_sociale = %s, forme = %s, rccm = %s, adresse_siege = %s, activite = %s, nb_hommes = %s, nb_femmes = %s where tiers_id = %s""",
                 (texte("nom"), texte("formeJuridique") or None, texte("registre") or None, texte("adresse"), texte("typeActivite") or None, *nombres, tid))
        ecrire_fiche_morale(tid, texte, fiche)
        remplacer_representants(u, tid, "membre", membres)
        return terminer_modification(u, tid, b, avant)
    d = {**d, "typeClient": d.get("typeClient") or "Client"}   # plan d'allègement, point 2.3
    b = controler_base(u, d,
                       [("date demande", "dateDemande"), ("type client", "typeClient"), ("nom", "nom"), ("type de pièce", "pieceType"),
                        ("numéro de pièce", "pieceNumero")], libelles_liste(u, "type_client") or ["Client"], False)
    texte = b["texte"]
    if texte("sexe") not in ("", "F", "M"):
        raise ErreurMetier("Sexe inconnu.")
    controler_piece(texte("pieceType"), texte("pieceExpire"), journee_courante(u))
    controler_univocite(u, texte("pieceType"), texte("pieceNumero"), tid)   # A9
    fiche = controler_fiche_physique(u, d, texte, journee_courante(u))   # mentions de l'identité obligatoires (registre S46-3)
    executer("""update tiers set date_demande = %s, type_client = %s, zone_id = %s, residence = %s, prelever_agios = %s, calculer_interet = %s,
                                 personne_exposee = %s, statut = 'modifie_a_revalider' where id = %s""",
             (texte("dateDemande"), texte("typeClient"), b["zone"], "resident" if d.get("resident", True) else "non_resident",
              bool(d.get("preleverAgios", True)), bool(d.get("calculerInteret")), bool(d.get("personneExposee")), tid))
    executer("""update tiers_personne set nom = %s, postnom = %s, prenom = %s, sexe = %s, date_naissance = %s, lieu_naissance = %s, piece_type = %s,
                    piece_numero = %s, piece_delivree_le = %s, piece_lieu = %s, piece_autorite = %s, piece_validite = %s, adresse = %s, telephone = %s,
                                          piece_pays = coalesce(%s, piece_pays)
                where tiers_id = %s""",
             (texte("nom"), texte("postnom") or None, texte("prenom") or None, texte("sexe") or None, texte("naissance") or None, texte("lieuNaissance") or None,
              texte("pieceType"), texte("pieceNumero"), texte("pieceDelivreeLe") or None, texte("pieceLieu") or None, texte("pieceAutorite") or None,
              texte("pieceExpire") or None, texte("adresse") or None, texte("telephone") or None, texte("piecePays") or None, tid))
    ecrire_fiche_physique(tid, texte, fiche)
    return terminer_modification(u, tid, b, avant)


def terminer_modification(u: dict, tid: int, b: dict, avant: dict, effectifs: bool = False) -> dict:
    """Personnes liées (et bénéficiaires effectifs d'une entreprise), puis état avant et après gardé pour S43"""
    executer("delete from lien_tiers where tiers_id = %s and role = 'personne_liee'", (tid,))
    for autre in b["liees"]:
        executer("insert into lien_tiers (tiers_id, autre_id, role) values (%s, %s, 'personne_liee')", (tid, autre))
    if effectifs:
        executer("delete from lien_tiers where tiers_id = %s and role = 'beneficiaire_effectif'", (tid,))
        for autre, nature, part in b["controles"]:
            executer("insert into lien_tiers (tiers_id, autre_id, role, nature, part) values (%s, %s, 'beneficiaire_effectif', %s, %s)", (tid, autre, nature, part))
    apres = lire_tiers(tid)
    executer("insert into tiers_modification (tiers_id, avant, apres, modifie_par) values (%s, %s, %s, %s)", (tid, Jsonb(avant), Jsonb(apres), u["id"]))
    ecrire_relation(tid, b["texte"])                                 # A8
    from .gel import rapprocher
    rapprocher(u, [tid])                                             # A13 : rapprochement avec les listes de gel en vigueur
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
    from .conformite import exiger_autorisation_ppe
    exiger_autorisation_ppe(tid)                                     # écart E02 : Instr. BCC 15, art. 64
    from .gel import exiger_correspondances_examinees
    exiger_correspondances_examinees(tid)                            # A13 : listes de gel (loi 22/068, art. 158 bis)
    executer("update tiers_modification set valide_par = %s, valide_le = now() where tiers_id = %s and valide_par is null", (u["id"], tid))
    executer("update tiers set statut = 'actif' where id = %s", (tid,))
    return lire_tiers(tid)


def images_tiers(u: dict, tid: int) -> dict:
    """Photo et signature déposées (cadre « Photo / Signature » de S43, p. 54)"""
    exiger(u)
    sp = une("""select s.photo, s.signature, s.copie_piece, s.justificatif_adresse, s.copie_habilitation from specimen s join tiers t on t.id = s.tiers_id
                where s.tiers_id = %s and t.institution_id = %s order by s.id desc limit 1""", (tid, u["institution_id"]))
    image = lambda v: v if isinstance(v, str) and IMAGE_OK.match(v) else None
    return {"photo": image(sp and sp["photo"]), "signature": image(sp and sp["signature"]),
            "copiePiece": image(sp and sp["copie_piece"]), "justificatifAdresse": image(sp and sp["justificatif_adresse"]),   # écart E03
            "copieHabilitation": image(sp and sp["copie_habilitation"])}   # A7


def changer_specimen(u: dict, tid: int, d: dict) -> dict:
    """S49 : Modification ou Ajout (Photo/Signature) (manuel p. 58), bouton « Valider les Modifications ».
    Nouveau dépôt ; ce qui n'est pas changé reprend le dépôt précédent."""
    exiger(u)
    t = une("select statut from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] in ("prospect", "resilie"):
        raise ErreurMetier("Client prospect ou résilié : pas de photo ni de signature à mettre à jour.")
    d = d or {}
    photo, signature, piece, adresse = d.get("photo"), d.get("signature"), d.get("copiePiece"), d.get("justificatifAdresse")
    habilitation = d.get("copieHabilitation")   # A7
    if not (photo or signature or piece or adresse or habilitation):
        raise ErreurMetier("Aucune image choisie.")
    controler_image(photo, "Photo"); controler_image(signature, "Signature")
    controler_image(piece, "Copie de la pièce d'identité"); controler_image(adresse, "Justificatif d'adresse")      # écart E03 : Instr. BCC 15, art. 12 et 29
    controler_image(habilitation, "Pièce d'habilitation professionnelle")
    avant = une("select photo, signature, copie_piece, justificatif_adresse, copie_habilitation from specimen where tiers_id = %s order by id desc limit 1", (tid,)) or {}
    executer("""insert into specimen (tiers_id, photo, signature, copie_piece, justificatif_adresse, copie_habilitation, depose_le, depose_par)
                values (%s, %s, %s, %s, %s, %s, current_date, %s)""",
             (tid, photo or avant.get("photo"), signature or avant.get("signature"), piece or avant.get("copie_piece"),
              adresse or avant.get("justificatif_adresse"), habilitation or avant.get("copie_habilitation"), u["id"]))
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
    Annulations : les écritures d'annulation (contre-passations, PCCI § 3.3) passées par l'utilisateur dans la période. Transactions = Opérations - Annulations
    (capture p. 22). Plan d'allègement, point 0.20 ; registre S13-2."""
    exiger(u)
    if not du or not au:
        raise ErreurMetier("À remplir : DU et AU.")
    ops = {x["saisi_par"]: x["n"] for x in lignes("""select o.saisi_par, count(*) as n from operation o join journee_comptable j on j.id = o.journee_id
                  where o.agence_id = %s and j.date_comptable between %s and %s group by o.saisi_par""", (u["agence_id"], du, au))}
    ann = {x["saisi_par"]: x["n"] for x in lignes("""select a.saisi_par, count(*) as n from ecriture a join journee_comptable j on j.id = a.journee_id
                  where j.agence_id = %s and a.contre_passe_id is not null and j.date_comptable between %s and %s group by a.saisi_par""", (u["agence_id"], du, au))}
    sortie = [{"utilisateur": nom_utilisateur(k), "operations": ops.get(k, 0), "annulations": ann.get(k, 0), "transactions": ops.get(k, 0) - ann.get(k, 0)}
              for k in set(ops) | set(ann)]
    return sorted(sortie, key=lambda x: x["utilisateur"].lower())


def modifications_tiers(u: dict, tid: int) -> list[dict]:
    """« Informations initiales et actuelles » (S43, p. 54) : chaque modification (S46) avec l'état avant et après"""
    exiger(u)
    return [{"avant": json_lu(r["avant"]), "apres": json_lu(r["apres"]), "modifiePar": r["modifie_par"], "modifieLe": r["modifie_le"].isoformat(),
             "validePar": r["valide_par"]}
            for r in lignes("""select m.* from tiers_modification m join tiers t on t.id = m.tiers_id where m.tiers_id = %s and t.institution_id = %s
                               order by m.id""", (tid, u["institution_id"]))]


def compte_du_produit(p) -> str:
    """Compte du PCCI d'un compte de dépôt : le compte lié du produit (S28), sinon celui de sa famille, 334 Epargnes obligatoires pour BLOQUE et
    330 Epargnes pour les autres (registre S27-2, S28-2)"""
    return p.get("compte_lie") or ("334" if p["famille"] == "BLOQUE" else "330")


def localites() -> list[dict]:
    """Pays > Ville > Quartier, lus dans Localisation (S20) : la ville (ou le territoire) à travers sa province, le quartier (ou le groupement)
    à travers sa commune (secteur ou chefferie). Lieux actifs seulement (registre S20-4)."""
    rows = lignes("select id, parent_id, niveau, nom from localite where actif order by nom")
    enfants = lambda pids, niveau: [r for r in rows if r["parent_id"] in pids and r["niveau"] == niveau]
    ids = lambda l: {r["id"] for r in l}
    # communes : la ville, puis ses communes (secteurs ou chefferies) et leurs quartiers (demande du porteur du 13/11/2026 pour Information société)
    def villes(p):
        """Une ville et un territoire du même nom (ville et territoire de Buta, registre S20-8) font une seule entrée : la fiche garde le nom"""
        par_nom = {}
        for v in enfants(ids(enfants({p["id"]}, "province")), "ville"):
            par_nom.setdefault(v["nom"], set()).add(v["id"])
        return [{"ville": nom, "quartiers": sorted(q["nom"] for q in enfants(ids(enfants(vids, "commune")), "quartier")),
                 "communes": [{"commune": c["nom"], "quartiers": sorted(q["nom"] for q in enfants({c["id"]}, "quartier"))} for c in enfants(vids, "commune")]}
                for nom, vids in par_nom.items()]
    return [{"pays": p["nom"], "villes": villes(p)} for p in rows if p["niveau"] == "pays" and p["parent_id"] is None]


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
    controler_lieu(texte, "Pays, ville ou quartier")          # adresse unique (registre T41)
    if texte("email") and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", texte("email")):
        raise ErreurMetier("Email invalide.")
    return texte


VALEURS_PROSPECT = """nom = %s, prenom = %s, date_naissance = %s, lieu_naissance = %s, sexe = %s, profession = %s, pays = %s, ville = %s, quartier = %s,
                      rue = %s, email = %s, bp = %s, telephone_fixe = %s, telephone = %s, province = %s, commune = %s, numero_rue = %s"""


def params_prospect(texte) -> tuple:
    return (texte("nom"), texte("prenom"), texte("naissance"), texte("lieuNaissance"), texte("sexe"), texte("profession") or None, texte("pays"),
            texte("ville"), texte("quartier"), texte("rue") or None, texte("email") or None, texte("bp") or None, texte("telephoneFixe") or None,
            texte("telephone") or None, texte("province") or None, texte("commune") or None, texte("numeroRue") or None)


def agents_prospect(u: dict, d: dict) -> tuple:
    """Sensibilisateur et Commercial du prospect : ceux de S33, ou aucun (INCONNU) ; registre S33-4"""
    r = []
    for k, role, nom in (("sensibilisateurId", "sensibilisateur", "Sensibilisateur"), ("commercialId", "commercial", "Commercial")):
        x = d.get(k)
        if x is None:
            r.append(None)
            continue
        if not isinstance(x, int) or isinstance(x, bool) or not une("select 1 from agent_agence where id = %s and institution_id = %s and role = %s and actif",
                                                                      (x, u["institution_id"], role)):
            raise ErreurMetier(f"{nom} inconnu.")
        r.append(x)
    return tuple(r)


def creer_prospect(u: dict, d: dict) -> dict:
    """S45 : Client > Nouveau prospect (manuel p. 55), bouton Enregistrer"""
    exiger(u)
    texte = controler_prospect(u, d)
    agents = agents_prospect(u, d)
    numero = numero_client(u)
    tid = valeur("""insert into tiers (institution_id, agence_id, numero, type, statut, cree_par) values (%s, %s, %s, 'physique', 'prospect', %s) returning id""",
                 (u["institution_id"], u["agence_id"], numero, u["id"]))
    executer("insert into tiers_personne (tiers_id, nom) values (%s, '')", (tid,))
    executer(f"update tiers_personne set {VALEURS_PROSPECT} where tiers_id = %s", (*params_prospect(texte), tid))
    executer("update tiers set sensibilisateur_id = %s, commercial_id = %s where id = %s", (*agents, tid))
    return lire_tiers(tid)


def modifier_prospect(u: dict, tid: int, d: dict) -> dict:
    """S45, bouton Modifier"""
    exiger(u)
    t = une("select statut from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t or t["statut"] != "prospect":
        raise ErreurMetier("Prospect introuvable.")
    texte = controler_prospect(u, d)
    agents = agents_prospect(u, d)
    executer(f"update tiers_personne set {VALEURS_PROSPECT} where tiers_id = %s", (*params_prospect(texte), tid))
    executer("update tiers set sensibilisateur_id = %s, commercial_id = %s where id = %s", (*agents, tid))
    return lire_tiers(tid)


def engagements_credit(tid: int) -> str | None:
    """Loi 002/2002, art. 24 : un membre emprunteur ou endosseur d'un prêt ne peut pas se retirer (COOPEC seulement)"""
    if valeur("select 1 from credit where tiers_id = %s and statut in ('mis_en_place', 'vise', 'debloque')", (tid,)):
        raise ErreurMetier("Client emprunteur : il ne peut pas se retirer tant que son prêt court (loi 002/2002, art. 24).")
    if valeur("""select 1 from garantie g join credit c on c.id = g.credit_id
                 where g.caution_id = %s and g.liberee_le is null and c.statut in ('mis_en_place', 'vise', 'debloque')""", (tid,)):
        raise ErreurMetier("Client endosseur d'un prêt en cours : il ne peut pas se retirer (loi 002/2002, art. 24).")
    return None


def controler_apurement(tid: int, coopec: bool = True):
    """Registre S48-1 : pas de résiliation tant qu'un compte a un solde ; apurement par Dépôt / Retrait (S74). Loi 002/2002, art. 27.
    Les parts restent : un membre en garde au moins une (art. 22) ; elles sont remboursées après la résiliation par Part sociale (S77).
    Mêmes règles que controlerApurement (web/src/donnees/api.ts)."""
    comptes = [c["numero"] for c in lignes("select id, numero, devise from compte_depot where tiers_id = %s order by numero", (tid,))
               if solde_contrat(f"depot:{c['id']}", c["devise"].strip(), "C") != 0]
    if comptes:
        raise ErreurMetier(f"Apurement à faire avant la résiliation{' (loi 002/2002, art. 27)' if coopec else ''} : compte{'s' if len(comptes) > 1 else ''} à solder : "
                           + ", ".join(comptes) + ". Solder par Caisse > Dépôt / Retrait.")


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
    if est_coopec(u):
        engagements_credit(tid)
    controler_apurement(tid, est_coopec(u))
    j = journee_courante(u)
    jour = j["date"] if j and j["statut"] == "ouverte" else date.today().isoformat()
    # P1 : une exclusion porte la référence et la date de la décision du Conseil d'administration (loi 002/2002, art. 25)
    excl = d.get("exclusion") if isinstance(d, dict) and isinstance(d.get("exclusion"), dict) else None
    excl_ref = excl_le = None
    if excl is not None:
        excl_ref, excl_le = str(excl.get("reference") or "").strip(), str(excl.get("date") or "").strip()
        if not excl_ref or not re.match(r"^\d{4}-\d{2}-\d{2}$", excl_le) or excl_le > str(jour):
            raise ErreurMetier("Exclusion : référence et date de la décision du Conseil d'administration (loi 002/2002, art. 25).")
    executer("update tiers set statut = 'resilie', motif_depart = %s, resilie_le = %s, resilie_par = %s, exclusion_reference = %s, exclusion_le = %s where id = %s",
             (motif, jour, u["id"], excl_ref, excl_le, tid))
    return lire_tiers(tid)


def solde_contrat(contrat: str, devise: str, sens_normal: str) -> int:
    return int(valeur(f"""select coalesce(sum(case l.sens when %s then l.montant_devise else -l.montant_devise end), 0)
                          from ligne_ecriture l where l.contrat_ref = %s and l.devise = %s""", (sens_normal, contrat, devise)))


def soldes_masques(u: dict) -> bool:
    """Registre S10-1 : au guichet, le caissier dont la case « Voir solde client » n'est pas cochée (S10, p. 20) ne voit pas les soldes des clients.
    Vaut pour qui tient une caisse ouverte ce jour ; les autres écrans (visa, consultation) ne sont pas touchés."""
    sess = session_du_caissier(u)
    if not sess or sess["statut"] != "ouverte":
        return False
    return not valeur("select voir_solde from affectation_guichet where utilisateur_id = %s and fin is null order by id desc limit 1", (u["id"],))


def masquer_soldes(comptes: list[dict]) -> list[dict]:
    return [{**c, "solde": None, "bloque": None, "disponible": None, "motifBlocage": None, "masque": True} for c in comptes]


def montant_bloque(compte_id: int, solde: int) -> int:
    """Montant bloqué d'un compte (S71) : tout le solde quand le compte entier est bloqué (montant vide), sinon la somme des montants bloqués en cours"""
    if valeur("select 1 from blocage where compte_id = %s and montant is null and (fin is null or fin > now())", (compte_id,)):
        return max(solde, 0)
    return int(valeur("select coalesce(sum(montant), 0) from blocage where compte_id = %s and (fin is null or fin > now())", (compte_id,)))


def sorties_en_attente(compte_id: int, sauf_operation: int | None = None) -> int:
    """Sorties saisies sur le compte et pas encore passées au grand livre : prélèvement par banque (S53), DAT saisi (S65), opérations de la comptabilité
    (S116, S117). Elles réduisent le disponible partout, guichet compris : une somme engagée ne se dépense pas deux fois (registre T21)."""
    banque = valeur("""select coalesce(sum(montant), 0) from operation_banque where compte_depot_id = %s and type = 'prelevement_client'
                       and statut in ('saisie', 'visee', 'validee')""", (compte_id,))
    dat = valeur("select coalesce(sum(montant), 0) from depot_terme where compte_emetteur_id = %s and statut = 'saisie'", (compte_id,))
    compta = valeur("""select coalesce(sum(montant), 0) from operation_comptable
                       where compte_depot_id = %s and (%s::bigint is null or id <> %s)
                         and (type in ('prelevement', 'compte_a_compte', 'tontine_dav', 'domiciliation') or (type = 'deplacee' and sens = 'RETRAIT'))
                         and (statut in ('saisie', 'visee', 'validee') or (type = 'deplacee' and statut = 'payee' and reflet_ecriture_id is null))""",
                    (compte_id, sauf_operation, sauf_operation))
    auto = valeur("""select coalesce(sum((l->>'montant')::bigint), 0) from operation_comptable o, jsonb_array_elements(o.lignes) l
                     where o.type = 'prelevement_auto' and o.statut in ('saisie', 'visee', 'validee') and (l->>'compteDepotId')::bigint = %s
                       and (%s::bigint is null or o.id <> %s)""", (compte_id, sauf_operation, sauf_operation))
    return int(banque) + int(dat) + int(compta) + int(auto)


def comptes_du_tiers(tid: int) -> list[dict]:
    res = []
    for c in lignes("""select c.*, p.libelle, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id
                       where c.tiers_id = %s and c.statut = 'ouvert' order by c.id""", (tid,)):
        bl = une("""select string_agg(motif, ' ; ') as motif from blocage where compte_id = %s and (fin is null or fin > now())""", (c["id"],))
        solde = solde_contrat(f"depot:{c['id']}", c["devise"], "C")
        bloque = montant_bloque(c["id"], solde)
        res.append({"id": c["id"], "tiersId": tid, "numero": c["numero"], "intitule": c["libelle"], "pcci": compte_du_produit(c),
                    "devise": c["devise"].strip(), "bloque": bloque, "motifBlocage": bl["motif"], "solde": solde,
                    "disponible": solde - bloque - sorties_en_attente(c["id"])})
    return res


def compte_parts(t: dict) -> str:
    """PCCI, compte 103, selon la nature juridique du membre (registre S16-13) : 1030 personnes physiques ; 1031 groupements solidaires
    (type de groupe « Groupement solidaire », sans personnalité juridique, loi 11/020, art. 1er, 7° et 19°) ; 1032 personnes morales (entreprise, banque, État, église, association, ONG).
    La valeur de la part vient de la ligne des frais d'adhésion (S16-11)."""
    if t["type"] == "physique":
        return "1030"
    if t["type"] == "groupe" and t["type_client"] == "Groupement solidaire":
        return "1031"
    return "1032"


def date_adhesion(tid: int) -> str:
    """S43 : Date d'adhésion = date comptable de l'adhésion encaissée en caisse (S73), registre S43-2. Vide tant qu'elle n'est pas encaissée."""
    return iso(valeur("""select j.date_comptable from operation o join journee_comptable j on j.id = o.journee_id
                         where o.tiers_id = %s and o.type = 'adhesion' and o.statut = 'validee' order by o.id limit 1""", (tid,)))


def parts_du_tiers(tid: int) -> float:
    i = valeur("select institution_id from tiers where id = %s", (tid,))
    return solde_contrat(f"parts:{tid}", "CDF", "C") / valeur_part(i)


# ---------- Grand livre ----------

def id_compte(numero: str, institution_id: int | None = None) -> int:
    """Compte du PCCI, sinon compte divisionnaire ouvert par l'institution (S102, PCCI § 9)"""
    i = valeur("select id from compte where numero = %s and (institution_id is null or institution_id = %s) order by institution_id nulls first limit 1",
               (numero, institution_id))
    if i is None:
        raise ErreurMetier(f"Compte {numero} absent du plan de comptes.")
    return i


def schema_valide(u: dict, evenement: str) -> int:
    s = valeur("""select id from schema_comptable where institution_id = %s and type_evenement = %s and valide_par is not null
                  and date_effet <= current_date order by version desc limit 1""", (u["institution_id"], evenement))
    if s is None:
        raise ErreurMetier(f"Schéma comptable « {evenement} » non validé.")
    return s


def poster(u: dict, *, journal: str, journee_id: int, libelle: str, piece: str, evenement: str, cle: str, valide_par: int, lignes_ecr: list[dict],
           contre_passe: int | None = None) -> int:
    """Écrit au grand livre. L'équilibre, la période et l'irréversibilité sont aussi garantis par PostgreSQL (replica/schema.sql)."""
    j = une("select * from journee_comptable where id = %s", (journee_id,))
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Journée fermée : aucune écriture possible.")
    from .gel import controler_lignes
    controler_lignes(lignes_ecr, u)    # écart E10 : rien ne sort des comptes d'un client gelé
    jid = valeur("select id from journal where institution_id = %s and code = %s and actif and not supprime", (u["institution_id"], journal))
    if jid is None:
        raise ErreurMetier(f"Le journal {journal} n'est pas actif (Comptabilité > Journal).")      # registre S30-2
    pid = valeur("insert into piece (institution_id, numero, type, date_piece) values (%s, %s, 'bordereau', %s) returning id", (u["institution_id"], piece, j["date_comptable"]))
    numero = f"{journal}-{j['date_comptable'].year}-{valeur('select nextval(%s)', ('numero_ecriture',)):06d}"
    eid = valeur("""insert into ecriture (institution_id, numero, journal_id, journee_id, date_valeur, libelle, piece_id, evenement_id, schema_id, saisi_par, valide_par,
                                          contre_passe_id, type)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], numero, jid, journee_id, j["date_comptable"], libelle, pid, cle, schema_valide(u, evenement), u["id"], valide_par, contre_passe,
                  "contre_passation" if contre_passe else "normale"))     # PCCI § 3.3 : correction par inscription en négatif, liée à l'écriture d'origine
    # Contre-valeur au cours du jour de la devise de la ligne (PCCI § 7.1), arrondie au centime, ligne par ligne.
    # Arrondir chaque ligne peut laisser un centime entre les débits et les crédits en CDF : cet écart d'arrondi est porté au compte 474
    # « Compte d'ajustement », par une ligne sans montant en devise (PCCI § 7.1 : « en cours de période, les différences sont logées dans
    # les sous-comptes d'ajustements devises en gain ou en perte » ; décision du porteur, 21/11/2026, registre T37).
    # Au-delà d'un centime par ligne en devise, ce n'est plus un arrondi : la base refuse l'écriture déséquilibrée.
    import math
    cdfs = [l["montant"] if l["devise"] == "CDF" else int(math.floor(l["montant"] * cours(l["devise"], j["date_comptable"]) + 0.5)) for l in lignes_ecr]
    ecart = sum(c if l["sens"] == "D" else -c for l, c in zip(lignes_ecr, cdfs))
    etrangeres = [l for l in lignes_ecr if l["devise"] != "CDF"]
    ecritures = list(zip(lignes_ecr, cdfs))
    if ecart and etrangeres and abs(ecart) <= len(etrangeres):
        ecritures.append(({"compte": "474", "sens": "C" if ecart > 0 else "D", "devise": etrangeres[0]["devise"], "montant": 0}, abs(ecart)))
    for rang, (l, cdf) in enumerate(ecritures, start=1):
        cours_id = None if l["devise"] == "CDF" else cours_ligne(l["devise"], j["date_comptable"])["id"]
        # « budget » : la ligne budgétaire saisie avec la ligne (S109, S116, S107), lue par le suivi budgétaire (S125)
        executer("""insert into ligne_ecriture (ecriture_id, rang, compte_id, contrat_ref, sens, devise, montant_devise, montant_cdf, cours_id, budget_ligne_id)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                 (eid, rang, id_compte(l["compte"], u["institution_id"]), l.get("contrat"), l["sens"], l["devise"], l["montant"], cdf, cours_id, l.get("budget")))
    return eid


ELEMENTS_PIECE = ["INSTITUTION", "AGENCE", "JOURNAL", "COMPTEUR"]


def composer_piece(regle: dict | None, valeurs: dict) -> str:
    """S29 (p. 41) : l'exercice en tête, puis les éléments dans l'ordre de leur Position, séparés par un tiret ; compteur sur six chiffres.
    Sans règle : Exercice, Agence, Journal, compteur (registre S29-2). L'Institution ne figure que si sa case est cochée."""
    if regle:
        presents = [e for e in ELEMENTS_PIECE if e != "INSTITUTION" or regle["institution"]]
        ordre = sorted(presents, key=lambda e: regle["positions"][e])
    else:
        ordre = ["AGENCE", "JOURNAL", "COMPTEUR"]
    morceaux = [str(valeurs["EXERCICE"])] + [f"{valeurs['COMPTEUR']:06d}" if e == "COMPTEUR" else valeurs.get(e, "") for e in ordre]
    return "-".join(m for m in morceaux if m)


def nouvelle_piece(u: dict, journal: str, journee_date) -> str:
    """Numéro de la pièce suivante du journal dans l'exercice de la journée : le compteur de Compléter journal détail (S11c) avance dans la même
    transaction que l'écriture, donc sans trou ni doublon (PCCI § 3.3 et 3.4 ; registre S11-7, S29-1)"""
    i = u["institution_id"]
    if not valeur("select 1 from journal where institution_id = %s and code = %s and actif and not supprime", (i, journal)):
        raise ErreurMetier(f"Le journal {journal} n'est pas actif (Comptabilité > Journal).")      # avant le compteur : pas de trou (S30-2)
    n = valeur("""update journal_detail d set compteur = compteur + 1 from journal j
                  where j.id = d.journal_id and d.institution_id = %s and d.annee = %s and j.code = %s returning d.compteur""", (i, journee_date.year, journal))
    if n is None:
        raise ErreurMetier(f"Le journal {journal} n'est pas ouvert sur l'exercice {journee_date.year} (Administration > Exercice, Compléter journal détail).")
    r = une("select regle from numerotation_piece where institution_id = %s", (i,))
    ag = une("select a.code, i.sigle from agence a join institution i on i.id = a.institution_id where a.id = %s", (u["agence_id"],))
    return composer_piece(json_lu(r["regle"]) if r else None,
                          {"EXERCICE": journee_date.year, "INSTITUTION": (ag["sigle"] or "") if ag else "", "AGENCE": ag["code"] if ag else "", "JOURNAL": journal, "COMPTEUR": n})


# ---------- Guichet ----------

def en_usd(m: int, devise: str) -> float:
    return m / 100 if devise.strip() == "USD" else m / 100 * cours(devise) / cours_usd()


def especes_du_jour_usd(tid: int, journee_id: int, sens: str) -> float:
    """Espèces du jour du client, dans un sens ; les opérations déjà passées par un examen renforcé n'entrent plus dans le cumul (écart E01, registre E01-1)"""
    total = 0.0
    for o in lignes("""select o.type, o.montant, o.devise from operation o join session_caisse s on s.id = o.session_caisse_id
                       where o.tiers_id = %s and o.statut = 'validee' and s.journee_id = %s
                       and not exists (select 1 from examen_renforce x where x.operation_id = o.id)""", (tid, journee_id)):
        if (o["type"] in SORTIES) == (sens == "retrait"):
            total += en_usd(o["montant"], o["devise"].strip())
    return total


MSG_ESPECES_HORS_CLIENTELE = ("Espèces refusées : une opération de 10 000 USD ou plus ne se règle pas en espèces (loi 22/068, art. 23). "
                              "La dérogation de l'Instr. BCC 15 bis ne vaut que pour les dépôts, les crédits et les moyens de paiement de la clientèle "
                              "(art. 4 et 5). Régler par la banque.")


def controler_especes_hors_clientele(montants: list[tuple[int, str]]) -> None:
    """Loi 22/068, art. 23, al. 1 : « toute opération portant sur une somme […] globalement égale ou supérieure à 10.000 Dollars américains ne peut
    être acquittée en espèces ». L'Instr. BCC 15 bis déroge pour les opérations de banque avec la clientèle (art. 4 : dépôts, crédits, moyens de
    paiement), qui passent par l'examen renforcé. Hors clientèle (encaissement ou décaissement divers, règlement d'un fournisseur), rien ne déroge :
    les espèces sont refusées au seuil. Confrontation du 21/11/2026, E4."""
    if sum(en_usd(m, d) for m, d in montants) >= SEUIL_ESPECES_USD:
        raise ErreurMetier(MSG_ESPECES_HORS_CLIENTELE)


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
    statut = {"validee": "validee", "refusee": "refusee", "visee": "visee"}.get(o["statut"], "visa_requis")
    compte_id = int(o["contrat_ref"].split(":")[1]) if (o["contrat_ref"] or "").startswith("depot:") else None
    return {"id": o["id"], "cle": str(o["cle_idempotence"]), "type": o["type"], "statut": statut, "sessionId": o["session_caisse_id"], "tiersId": o["tiers_id"],
            "compteId": compte_id, "montant": o["montant"], "devise": o["devise"].strip(), "parts": o["parts"],
            "coupures": {unites(r["valeur"]): r["nombre"] for r in lignes("select valeur, nombre from operation_coupure where operation_id = %s", (o["id"],))},
            "remisPar": o["remis_par"] or "", "motif": o.get("motif") or "", "saisiPar": o["saisi_par"], "visePar": o["vise_par"], "ecritureId": o["ecriture_id"],
            "heure": o["cree_le"].astimezone().strftime("%H:%M")}


def enregistrer_coupures(oid: int, devise: str, coupures: dict):
    executer("delete from operation_coupure where operation_id = %s", (oid,))
    for v, n in coupures.items():
        executer("insert into operation_coupure (operation_id, devise, valeur, nombre) values (%s, %s, %s, %s)", (oid, devise, centiemes(v), n))


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
    c = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s" + (" for update of c" if verrou else ""), (compte_id,))
    if not c:
        raise ErreurMetier("Compte introuvable.")
    if c["statut"] == "clos":
        raise ErreurMetier("Ce compte est clôturé : plus aucune opération (Épargne > Clôturer un Compte).")      # registre S70-6
    t = une("select statut from tiers where id = %s", (c["tiers_id"],))
    controler_statut_actif(t["statut"])
    c["devise"] = c["devise"].strip()
    c["pcci"] = compte_du_produit(c)
    return c


def plafonds_guichet(guichet_id: int, devise: str) -> tuple[int, int]:
    """Maximum autorisé en caisse et retrait plafonné du guichet pour la devise (S08, registre S08-3). 0 : aucun plafond (registre S08-10)."""
    r = une("select maximum, retrait from guichet_plafond where guichet_id = %s and devise = %s", (guichet_id, devise))
    return (r["maximum"] or 0, r["retrait"] or 0) if r else (0, 0)


def avec_avertissement(v: dict, s: dict, devise: str) -> dict:
    """Registre S08-4 : après une entrée d'espèces, avertir le caissier si l'encaisse dépasse le maximum autorisé du guichet.
    L'opération n'est jamais refusée pour cette raison ; l'excédent se transfère à la caisse principale (S81)."""
    maximum = plafonds_guichet(s["guichetId"], devise)[0]
    encaisse = total_comptage(theorique(s["id"], devise))
    if maximum and encaisse > maximum:
        v["avertissement"] = (f"Encaisse de la caisse au-dessus du maximum autorisé ({montant_lisible(maximum, devise)}) : "
                              "transférer l'excédent à la caisse principale (Caisse > Transfert).")
        from .incidents import noter                                   # B17 : dépassement de limite noté (Instr. BCC 008, art. 43 et 49)
        g = une("select g.code, a.institution_id from guichet g join agence a on a.id = g.agence_id where g.id = %s", (s["guichetId"],))
        if g:
            noter({"institution_id": g["institution_id"], "id": s.get("caissierId")},
                  f"Encaisse du guichet {g['code']} au-dessus du maximum autorisé ({montant_lisible(maximum, devise)})", encaisse, devise)
    return v


def montant_lisible(m: int, devise: str) -> str:
    entiers, cts = divmod(abs(m), 100)
    return f"{entiers:,}".replace(",", " ") + (f",{cts:02d}" if cts else "") + f" {devise}"


def options_produit(c: dict) -> dict:
    return une("select libelle, solde_minimum, retrait_max_jour, operer_compte, depot_cheque from produit_epargne where id = %s", (c["produit_id"],))


def controler_operer(c: dict) -> dict:
    """Registre S74-5 : « Opérer sur compte = Non » ferme le guichet à ce compte (S27, p. 40)"""
    o = options_produit(c)
    if o["operer_compte"] is False:
        raise ErreurMetier(f"Pas d'opération au guichet sur un compte « {o['libelle']} » : Opérer sur compte = Non (Paramétrage > Produit épargne).")
    return o


def controler_retrait_produit(c: dict, o: dict, m: int, dispo: int, journee_id: int) -> None:
    """Registre S74-5 : le solde minimum du produit reste sur le compte ; le total des retraits du jour ne dépasse pas le maximum par jour (S27, p. 40)"""
    mini = int(o["solde_minimum"] or 0)
    if m > dispo - mini:
        raise ErreurMetier("Dépasse le solde disponible" + (f", solde minimum du produit compris ({montant_lisible(mini, c['devise'])})." if mini else "."))
    maxi = int(o["retrait_max_jour"] or 0)
    if maxi:
        deja = int(valeur("""select coalesce(sum(montant), 0) from operation where contrat_ref = %s and type = 'retrait' and statut = 'validee'
                              and journee_id = %s""", (f"depot:{c['id']}", journee_id)))
        if deja + m > maxi:
            raise ErreurMetier(f"Retrait maximum par jour du produit : {montant_lisible(maxi, c['devise'])} ; déjà retiré ce jour : {montant_lisible(deja, c['devise'])}.")


def depot(u: dict, p: dict) -> dict:
    """S74 : Caisse > Opération > Dépôt / Retrait, onglet Dépôt en espèce (manuel p. 86) : Montant*, Mandataire, Motif. Sans frais (Instr. BCC 37)."""
    prec = operation_par_cle(p["cle"])
    if prec and prec["statut"] == "validee":
        return vue_operation(prec)
    c = compte_actif(p["compteId"])
    controler_collecte_epargne(u, c["famille"])
    controler_operer(c)                               # registre S74-5
    s = session_ouverte(u, c["devise"])
    m, coupures = int(p["montant"]), nettoyer(p["coupures"])
    if m <= 0:
        raise ErreurMetier("Montant nul.")
    controler_montant_coupures(coupures, m, c["devise"])
    from . import conformite
    examen = conformite.autorisation(u, c["tiers_id"], s["journeeId"], "depot", m, c["devise"])   # écart E01 : examen renforcé
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=f"Dépôt espèces {c['numero']}", piece=nouvelle_piece(u, "CA", j["date_comptable"]),
                 evenement="depot", cle=p["cle"], valide_par=u["id"], lignes_ecr=[
                     {"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "D", "devise": c["devise"], "montant": m},
                     {"compte": c["pcci"], "contrat": f"depot:{c['id']}", "sens": "C", "devise": c["devise"], "montant": m}])
    oid = creer_operation(u, s, cle=p["cle"], type_="depot", statut="validee", tiers_id=c["tiers_id"], contrat=f"depot:{c['id']}", montant=m,
                          devise=c["devise"], coupures=coupures, remis_par=(p.get("mandataire") or "").strip() or titulaire(c["tiers_id"]), ecriture_id=eid,
                          motif=(p.get("motif") or "").strip() or None)
    conformite.lier(examen, oid)
    return avec_avertissement(vue_operation(une("select * from operation where id = %s", (oid,))), s, c["devise"])


def retrait(u: dict, p: dict) -> dict:
    """S74 : Caisse > Opération > Dépôt / Retrait, onglet Retrait en espèce (manuel p. 86). Sans frais (Instr. BCC 37).
    Au-delà du retrait plafonné du guichet, le retrait attend le visa « Retrait plafond » (S113) avant d'être payé (registre S08-5) :
    la première saisie le met en attente, sans écriture ; après le visa, le même retrait refait au guichet est payé."""
    prec = operation_par_cle(p["cle"])
    if prec and prec["statut"] in ("validee", "saisie"):
        return vue_operation(prec)
    c = compte_actif(p["compteId"], verrou=True)   # deux retraits sur le même compte ne passent pas en même temps
    from .gel import controler_gel
    controler_gel(c["tiers_id"], u)                 # écart E10
    from .procurations import mandataire_du_retrait
    mandataire, procuration = mandataire_du_retrait(u, c["tiers_id"], p)   # E2 : le mandataire choisi parmi les procurations en cours
    remis = mandataire or titulaire(c["tiers_id"])
    s = session_ouverte(u, c["devise"])
    m, coupures = int(p["montant"]), nettoyer(p["coupures"])
    if m <= 0:
        raise ErreurMetier("Montant nul.")
    dispo = next(x for x in comptes_du_tiers(c["tiers_id"]) if x["id"] == c["id"])["disponible"]
    controler_retrait_produit(c, controler_operer(c), m, dispo, s["journeeId"])      # registre S74-5
    controler_montant_coupures(coupures, m, c["devise"])
    th = theorique(s["id"], c["devise"])
    if any(n > th.get(v_, 0) for v_, n in coupures.items()):
        raise ErreurMetier("Pas assez de coupures en caisse.")
    from . import conformite
    examen = conformite.autorisation(u, c["tiers_id"], s["journeeId"], "retrait", m, c["devise"])   # écart E01 : examen renforcé
    plafond = plafonds_guichet(s["guichetId"], c["devise"])[1]
    vise = None
    if plafond and m > plafond:
        attente = lambda st: une("""select * from operation where type = 'retrait' and contrat_ref = %s and montant = %s and journee_id = %s and statut = %s
                                    order by id limit 1 for update""", (f"depot:{c['id']}", m, s["journeeId"], st))
        vise = attente("visee")
        if not vise:
            if attente("saisie"):
                raise ErreurMetier("Retrait déjà en attente du visa « Retrait plafond » (Visa > Retrait plafond).")
            oid = creer_operation(u, s, cle=p["cle"], type_="retrait", statut="saisie", tiers_id=c["tiers_id"], contrat=f"depot:{c['id']}",
                                  montant=m, devise=c["devise"], coupures=coupures, remis_par=remis, motif=(p.get("motif") or "").strip() or None)
            executer("update operation set procuration_id = %s where id = %s", (procuration, oid))
            return vue_operation(une("select * from operation where id = %s", (oid,)))
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=f"Retrait espèces {c['numero']}", piece=nouvelle_piece(u, "CA", j["date_comptable"]),
                 evenement="retrait", cle=p["cle"], valide_par=u["id"], lignes_ecr=[
                     {"compte": c["pcci"], "contrat": f"depot:{c['id']}", "sens": "D", "devise": c["devise"], "montant": m},
                     {"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "C", "devise": c["devise"], "montant": m}])
    if vise:   # paiement du retrait visé : l'opération en attente devient le retrait payé, par ce caissier, dans sa caisse
        executer("update operation set statut = 'validee', ecriture_id = %s, session_caisse_id = %s, valide_par = %s, remis_par = %s, procuration_id = %s where id = %s",
                 (eid, s["id"], u["id"], remis, procuration, vise["id"]))
        enregistrer_coupures(vise["id"], c["devise"], coupures)
        conformite.lier(examen, vise["id"])
        return vue_operation(une("select * from operation where id = %s", (vise["id"],)))
    oid = creer_operation(u, s, cle=p["cle"], type_="retrait", statut="validee", tiers_id=c["tiers_id"], contrat=f"depot:{c['id']}",
                          montant=m, devise=c["devise"], coupures=coupures, remis_par=remis, ecriture_id=eid, motif=(p.get("motif") or "").strip() or None)
    executer("update operation set procuration_id = %s where id = %s", (procuration, oid))
    conformite.lier(examen, oid)
    return vue_operation(une("select * from operation where id = %s", (oid,)))


STATUTS_CREDIT = {"mis_en_place": "Mis en place, en visa", "vise": "Visé, à débloquer", "refuse": "Refusé", "debloque": "En cours", "solde": "Soldé",
                  "passe_en_perte": "Passé en perte"}


def credits_du_tiers(u: dict, tid: int) -> list[dict]:
    """S43, onglet Crédits : les prêts du membre (numéro, produit, montant, devise, déblocage, état), au lieu d'une liste toujours vide
    (plan d'allègement, point 0.16 ; registre S43-4)"""
    exiger(u)
    return [{"numero": c["numero"], "produit": c["produit"], "montant": c["montant"], "devise": c["devise"].strip(), "debloqueLe": c["debloque_le"].isoformat() if c["debloque_le"] else "",
             "etat": STATUTS_CREDIT.get(c["statut"], c["statut"])}
            for c in lignes("""select c.numero, p.nom as produit, c.montant, c.devise, c.debloque_le, c.statut from credit c join produit_credit p on p.id = c.produit_id
                               where c.tiers_id = %s and c.institution_id = %s order by c.id""", (tid, u["institution_id"]))]


def compte_adhesion(u: dict, tid: int) -> dict:
    """Le compte d'épargne que l'adhésion ouvrira : produit choisi à l'enrôlement et numéro selon la règle de S17, sans rien ouvrir
    (plan d'allègement, point 0.6 ; registre S73-6)"""
    exiger(u)
    t = une("select * from tiers where id = %s and institution_id = %s", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    produit = une("select * from produit_epargne where id = %s", (t["produit_id"],)) if t["produit_id"] else \
        une("select * from produit_epargne where institution_id = %s and famille = 'EPARGNE' and devise = 'CDF' and actif and not supprime order by version desc limit 1", (u["institution_id"],))
    if not produit:
        return {"numero": "", "produit": "", "devise": ""}
    return {"numero": numero_compte(u, t, produit), "produit": produit["libelle"], "devise": produit["devise"].strip()}


def preparer_adhesion(u: dict, p: dict) -> dict:
    """Contrôles communs de l'adhésion, au guichet (S73) et par banque (S56) : client actif, pas déjà membre avec un compte, compte épargne en CDF,
    au moins une part payée en entier, frais d'adhésion sur des comptes du plan. Loi 002/2002, art. 21 et 22."""
    from .frais import frais_lies
    tid = int(p["tiersId"])
    t = une("select * from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    controler_statut_actif(t["statut"], " : l'adhésion attend le visa")
    from .liste_rouge import controler_ouverture
    controler_ouverture(tid)                                         # P4 : Instr. BCC 13, art. 7
    if profil_institution(u) == "entreprise_microcredit":
        raise ErreurMetier("Une entreprise de micro-crédit ne collecte pas l'épargne du public (loi 11/020, art. 12) : pas d'adhésion avec compte épargne.")
    if une("select 1 from compte_depot where tiers_id = %s", (tid,)):
        raise ErreurMetier("Ce membre a déjà adhéré.")
    produit = une("select * from produit_epargne where id = %s", (t["produit_id"],)) if t["produit_id"] else \
        une("select * from produit_epargne where institution_id = %s and famille = 'EPARGNE' and devise = 'CDF' and actif and not supprime order by version desc limit 1", (u["institution_id"],))
    nb = p.get("parts")
    if not est_coopec(u):
        if nb not in (None, 0):
            exiger_parts_sociales(u)
        nb = 0
    elif not isinstance(nb, int) or isinstance(nb, bool) or nb < 1:
        raise ErreurMetier("Au moins une part sociale, payée en entier (loi 002/2002, art. 21 et 22).")
    m_depot = p.get("depot", 0)
    if not isinstance(m_depot, int) or isinstance(m_depot, bool) or m_depot < 0:
        raise ErreurMetier("Premier dépôt invalide.")
    frais = [f for f in frais_lies(u, tid) if f["montant"] and not f["part"]]   # la ligne de part se paie par nombre de parts (registre S16-11)
    for f in frais:
        if not f["compte"] or not valeur("select 1 from compte where numero = %s", (f["compte"],)):
            raise ErreurMetier(f"Frais « {f['libelle']} » : compte absent du plan comptable, à paramétrer (Paramétrage > Frais et opérations).")
    m_parts = nb * valeur_part(u["institution_id"]) if nb else 0
    return {"tid": tid, "t": t, "produit": produit, "nb": nb, "m_depot": m_depot, "frais": frais, "m_parts": m_parts,
            "total": m_parts + m_depot + sum(f["montant"] for f in frais)}


def adhesion(u: dict, p: dict) -> dict:
    """S73 : Caisse > Opération > Adhésion (manuel p. 85 et 89) : compte épargne du type choisi à l'enrôlement, premier dépôt,
    Liste des Frais (frais d'adhésion S16/S41 et parts sociales), billetage. Loi 002/2002, art. 21 et 22 ; PCCI, comptes 103 et 330.
    Registre S73-1 : frais et parts en CDF ; le premier dépôt dans la devise du compte choisi ; un billetage par devise (T12)."""
    prec = operation_par_cle(p["cle"])
    if prec and prec["statut"] == "validee":
        return vue_operation(prec)
    s = session_ouverte(u, "CDF")
    a = preparer_adhesion(u, p)
    tid, t, produit, nb, m_depot, frais, m_parts, total = (a[k] for k in ("tid", "t", "produit", "nb", "m_depot", "frais", "m_parts", "total"))
    dev = produit["devise"].strip()
    m_cdf = total if dev == "CDF" else total - m_depot         # ce qui se paie en CDF : tout, ou frais et parts seulement
    coupures = nettoyer(p["coupures"])
    if m_cdf or dev == "CDF":
        controler_montant_coupures(coupures, m_cdf, "CDF")
    coupures_depot = nettoyer(p.get("coupuresDepot") or {}) if dev != "CDF" else {}
    if dev != "CDF" and m_depot:
        controler_montant_coupures(coupures_depot, m_depot, dev)
    from . import conformite
    examen = conformite.autorisation(u, tid, s["journeeId"], "adhesion", m_cdf, "CDF") if m_cdf else None   # écart E01 : examen renforcé
    examen_depot = conformite.autorisation(u, tid, s["journeeId"], "depot", m_depot, dev) if dev != "CDF" and m_depot else None
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    c = valeur("""insert into compte_depot (institution_id, agence_id, tiers_id, produit_id, numero, devise, statut, ouvert_le)
                  values (%s, %s, %s, %s, %s, %s, 'ouvert', %s) returning id""",
               (u["institution_id"], t["agence_id"], tid, produit["id"], numero_compte(u, t, produit), dev, j["date_comptable"]))
    l = [{"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "D", "devise": "CDF", "montant": m_cdf}] if m_cdf else []
    if m_parts:                       # COOPEC seulement (loi 002/2002) ; une IMF n'a pas de parts sociales (loi 11/020, art. 14 et 15)
        l.append({"compte": compte_parts(t), "contrat": f"parts:{tid}", "sens": "C", "devise": "CDF", "montant": m_parts})
    for f in frais:
        l.append({"compte": f["compte"], "contrat": f"frais:{f['fraisId']}", "sens": "C", "devise": "CDF", "montant": f["montant"]})
    if m_depot > 0:
        if dev != "CDF":
            l.append({"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "D", "devise": dev, "montant": m_depot})
        l.append({"compte": compte_du_produit(produit), "contrat": f"depot:{c}", "sens": "C", "devise": dev, "montant": m_depot})
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=f"Adhésion {t['numero']}", piece=nouvelle_piece(u, "CA", j["date_comptable"]),
                 evenement="adhesion", cle=p["cle"], valide_par=u["id"], lignes_ecr=l)
    if nb:
        executer("insert into mouvement_parts (tiers_id, sens, nombre, valeur_unitaire, devise, ecriture_id) values (%s, 'achat', %s, %s, 'CDF', %s)", (tid, nb, valeur_part(u["institution_id"]), eid))
    oid = None
    if m_cdf or dev == "CDF":
        oid = creer_operation(u, s, cle=p["cle"], type_="adhesion", statut="validee", tiers_id=tid, contrat=f"depot:{c}", montant=m_cdf,
                              devise="CDF", coupures=coupures, remis_par=titulaire(tid), parts=nb or None, ecriture_id=eid)
        conformite.lier(examen, oid)
    if dev != "CDF" and m_depot:      # le premier dépôt en devise : son propre mouvement de caisse, pour le stock de coupures de la devise
        od = creer_operation(u, s, cle=str(uuid.uuid5(uuid.UUID(p["cle"]), "depot")), type_="depot", statut="validee", tiers_id=tid, contrat=f"depot:{c}",
                             montant=m_depot, devise=dev, coupures=coupures_depot, remis_par=titulaire(tid), ecriture_id=eid)
        conformite.lier(examen_depot, od)
        oid = oid or od
    return avec_avertissement(vue_operation(une("select * from operation where id = %s", (oid,))), s, "CDF" if m_cdf or dev == "CDF" else dev)   # registre S08-4


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
    exiger_parts_sociales(u)
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
    montant = nb * valeur_part(u["institution_id"])
    coupures = nettoyer(p.get("coupures") or {})
    controler_montant_coupures(coupures, montant, "CDF")
    if sens == "retrait":
        th = theorique(s["id"], "CDF")
        if any(n > th.get(v_, 0) for v_, n in coupures.items()):
            raise ErreurMetier("Pas assez de coupures en caisse.")
    from . import conformite
    examen = conformite.autorisation(u, tid, s["journeeId"], "retrait_parts" if sens == "retrait" else "achat_parts", montant, "CDF")   # écart E01
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    caisse = {"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "D" if sens == "achat" else "C", "devise": "CDF", "montant": montant}
    parts = {"compte": compte_parts(t), "contrat": f"parts:{tid}", "sens": "C" if sens == "achat" else "D", "devise": "CDF", "montant": montant}
    type_ = "achat_parts" if sens == "achat" else "retrait_parts"
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=f"{'Achat' if sens == 'achat' else 'Retrait'} de parts sociales {t['numero']}",
                 piece=nouvelle_piece(u, "CA", j["date_comptable"]), evenement=type_, cle=p["cle"], valide_par=u["id"], lignes_ecr=[caisse, parts])
    executer("insert into mouvement_parts (tiers_id, sens, nombre, valeur_unitaire, devise, ecriture_id) values (%s, %s, %s, %s, 'CDF', %s)",
             (tid, sens, nb, valeur_part(u["institution_id"]), eid))
    oid = creer_operation(u, s, cle=p["cle"], type_=type_, statut="validee", tiers_id=tid, contrat=f"parts:{tid}", montant=montant, devise="CDF",
                          coupures=coupures, remis_par=titulaire(tid), parts=nb, ecriture_id=eid)
    conformite.lier(examen, oid)
    return avec_avertissement(vue_operation(une("select * from operation where id = %s", (oid,))), s, "CDF")   # registre S08-4


# ---------- Visas des opérations ----------

def operations_en_attente(u: dict) -> list[dict]:
    return [vue_operation(o) for o in lignes("select * from operation where institution_id = %s and statut = 'saisie' order by id", (u["institution_id"],))]


def retraits_plafond(u: dict) -> list[dict]:
    """S113 : Visa > Retrait plafond, grille « Viser Retrait plafonné » (manuel p. 131) : Date operation, Libelle de l'operation, montant, Membre, Compte
    (registre S08-5)."""
    exiger(u)
    return [{"id": r["id"], "date": r["date_comptable"].isoformat(), "libelle": f"Retrait espèces {r['compte']}", "montant": r["montant"],
             "devise": r["devise"].strip(), "membre": titulaire(r["tiers_id"]), "numeroMembre": r["numero"], "compte": r["compte"], "saisiPar": r["saisi_par"]}
            for r in lignes("""select o.*, j.date_comptable, c.numero as compte, t.numero from operation o join journee_comptable j on j.id = o.journee_id
                               join compte_depot c on 'depot:' || c.id = o.contrat_ref join tiers t on t.id = o.tiers_id
                               where o.institution_id = %s and o.type = 'retrait' and o.statut = 'saisie' order by o.id""", (u["institution_id"],))]


def lire_operation(oid: int) -> dict | None:
    o = une("select * from operation where id = %s", (oid,))
    return vue_operation(o) if o else None


def operations_du_jour(jid: int) -> list[dict]:
    return [vue_operation(o) for o in lignes("select * from operation where journee_id = %s order by id", (jid,))]


def viser_operation(u: dict, oid: int) -> dict:
    exiger(u, "chef_agence")
    o = une("select * from operation where id = %s for update", (oid,))
    if not o or o["statut"] != "saisie":
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
    t = une("select numero from tiers where id = %s", (o["tiers_id"],)) if o["tiers_id"] else None   # aucun client pour un ED divers (S78)
    j = une("select date_comptable from journee_comptable where id = %s", (o["journee_id"],))
    compte = une("select numero from compte_depot where id = %s", (int(o["contrat_ref"].split(":")[1]),)) if (o["contrat_ref"] or "").startswith("depot:") else None
    return {"o": vue_operation(o), "piece": e["piece"] if e else "", "lignes": lignes_ecriture(e["id"]) if e else [], "titulaire": titulaire(o["tiers_id"]) if t else "",
            "numeroMembre": t["numero"] if t else "", "compte": compte["numero"] if compte else "", "date": j["date_comptable"].isoformat(),
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
