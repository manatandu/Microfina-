"""S08, S09 et S10 : Administration > Guichet (manuel Microfina++, p. 18 à 20, 95 et 96). Mêmes règles que web/src/donnees/api.ts (guichets)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante, ouvrir_caisse

TYPES_GUICHET = ["PRINCIPALE", "SECONDAIRE"]   # valeurs lues sur la capture p. 19 ; liste complète à confirmer


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité : à confirmer


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    j = journee_courante(u)
    return {
        "agences": lignes("select id, code, nom from agence where institution_id = %s order by code", (i,)),
        "journaux": lignes("select id, code, libelle from journal where institution_id = %s order by code", (i,)),
        "types": TYPES_GUICHET,
        "guichets": lignes("""select g.id, g.code, g.nom, coalesce(g.type_guichet, '') as "typeGuichet", g.actif,
                                     s.id is not null and s.fermee_le is null and s.statut = 'ouverte' as ouvert,
                                     case when s.id is not null then j.date_comptable::text else '' end as "dateOuverture"
                              from guichet g join agence a on a.id = g.agence_id
                              left join session_caisse s on s.guichet_id = g.id and s.journee_id = %s
                              left join journee_comptable j on j.id = s.journee_id
                              where a.institution_id = %s and g.agence_id = %s order by g.code""", (j["id"] if j else None, i, u["agence_id"])),
    }


def entier(d, k, nom):
    v = d.get(k)
    if v is None or v == "":
        raise ErreurMetier(f"À remplir : {nom}.")
    try:
        n = int(v)
    except (TypeError, ValueError):
        raise ErreurMetier(f"{nom[0].upper() + nom[1:]} : montant invalide.")
    if n < 0:
        raise ErreurMetier(f"{nom[0].upper() + nom[1:]} : montant invalide.")
    return n


def creer(u, d) -> dict:
    """« Gestion des guichets » (p. 18) : Agence*, Code guichet*, Désignation*, Type de guichet*, Journal*, Maximum autorisé en caisse*,
    Retrait plafonné*, comptes guichet, liaison, surplus et manquant, Billetage autorisé, Guichet Actif."""
    droit(u)
    i = u["institution_id"]
    code, nom, type_ = texte(d, "code"), texte(d, "designation"), texte(d, "typeGuichet")
    agence, journal = d.get("agenceId"), d.get("journalId")
    manque = [n for n, v in (("agence", agence), ("code guichet", code), ("désignation", nom), ("type de guichet", type_), ("journal", journal)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    maximum = entier(d, "maximumCaisse", "maximum autorisé en caisse")
    plafond = entier(d, "retraitPlafonne", "retrait plafonné")
    if type_ not in TYPES_GUICHET:
        raise ErreurMetier("Type de guichet inconnu.")
    if not une("select 1 from agence where id = %s and institution_id = %s", (agence, i)):
        raise ErreurMetier("Agence inconnue.")
    if not une("select 1 from journal where id = %s and institution_id = %s", (journal, i)):
        raise ErreurMetier("Journal inconnu.")
    comptes = {}
    for k, n in (("compteGuichet", "Compte guichet"), ("compteLiaison", "Compte liaison"), ("compteSurplus", "Compte surplus"), ("compteManquant", "Compte manquant")):
        v = texte(d, k)
        if v and not v.isdigit():
            raise ErreurMetier(f"{n} : chiffres seulement.")
        comptes[k] = v or None
    if une("select 1 from guichet where agence_id = %s and code = %s", (agence, code)):
        raise ErreurMetier("Ce code guichet existe déjà.")
    valeur("""insert into guichet (agence_id, code, nom, type_guichet, journal_id, maximum_caisse, retrait_plafonne,
                                  compte_guichet, compte_liaison, compte_surplus, compte_manquant, billetage, actif)
              values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
           (agence, code, nom, type_, journal, maximum, plafond, comptes["compteGuichet"], comptes["compteLiaison"], comptes["compteSurplus"],
            comptes["compteManquant"], bool(d.get("billetage")), bool(d.get("actif"))))
    return lire(u)


def ouvrir(u, gid: int) -> dict:
    """« Ouverture/Fermeture de guichets » (p. 19), bouton Ouverture"""
    g = une("select g.actif from guichet g join agence a on a.id = g.agence_id where g.id = %s and a.institution_id = %s", (gid, u["institution_id"]))
    if not g:
        raise ErreurMetier("Guichet introuvable.")
    if not g["actif"]:
        raise ErreurMetier("Guichet inactif.")
    ouvrir_caisse(u, gid)
    return lire(u)


def fermer(u, gid: int) -> dict:
    """« Ouverture/Fermeture de guichets » (p. 19), bouton Fermeture"""
    exiger(u, "caissier")                    # profil habilité : à confirmer (le même que pour l'ouverture)
    j = journee_courante(u)
    s = une("select * from session_caisse where guichet_id = %s and journee_id = %s for update", (gid, j["id"] if j else None))
    if not s or s["fermee_le"] or s["statut"] != "ouverte":
        raise ErreurMetier("Ce guichet n'est pas ouvert.")
    if s["caissier_id"] != u["id"]:
        raise ErreurMetier("Cette caisse n'est pas la vôtre.")
    executer("update session_caisse set fermee_le = now(), fermee_par = %s where id = %s", (u["id"], s["id"]))
    return lire(u)


# ---------- S10 : Administration > Guichet > Affectation (manuel Microfina++, p. 20, 96 et 110) ----------

def affectations(u) -> dict:
    """« Ajout et Retrait de Guichet à un utilisateur » (p. 96) : Login utilisateur, Nom utilisateur, Guichet, Agence ; fenêtre d'ajout (p. 20)"""
    exiger(u)
    i = u["institution_id"]
    return {
        "utilisateurs": lignes("""select u.id, u.login, u.nom, a.id as "agenceId", a.nom as agence, g.id as "guichetId", coalesce(g.nom, '') as guichet,
                                         coalesce(f.voir_solde, false) as "voirSolde", coalesce(f.voir_solde_vip, false) as "voirSoldeVip"
                                  from utilisateur u join agence a on a.id = u.agence_id
                                  left join affectation_guichet f on f.utilisateur_id = u.id and f.fin is null
                                  left join guichet g on g.id = f.guichet_id
                                  where u.institution_id = %s and u.actif order by u.login""", (i,)),
        "guichets": lignes("""select g.id, g.code, g.nom, g.agence_id as "agenceId" from guichet g join agence a on a.id = g.agence_id
                              where a.institution_id = %s order by g.code""", (i,)),
    }


def affecter(u, d) -> dict:
    """Bouton ✎ puis Ajouter : « Voulez-vous attribuer ce guichet à l'utilisateur ? » (p. 20). Un guichet à la fois (p. 96, registre S10-3)."""
    droit(u)
    d = d if isinstance(d, dict) else {}
    cible = une("select id, agence_id from utilisateur where id = %s and institution_id = %s and actif", (d.get("utilisateurId"), u["institution_id"]))
    if not cible:
        raise ErreurMetier("Utilisateur introuvable.")
    if not d.get("guichetId"):
        raise ErreurMetier("À remplir : guichet.")
    g = une("select id from guichet where id = %s and agence_id = %s", (d.get("guichetId"), cible["agence_id"]))
    if not g:
        raise ErreurMetier("Ce guichet n'est pas dans l'agence de l'utilisateur.")
    if une("select 1 from affectation_guichet where utilisateur_id = %s and fin is null for update", (cible["id"],)):
        raise ErreurMetier("Cet utilisateur a déjà un guichet. Retirez-le d'abord.")
    executer("""insert into affectation_guichet (guichet_id, utilisateur_id, voir_solde, voir_solde_vip, ajoute_par) values (%s, %s, %s, %s, %s)""",
             (g["id"], cible["id"], bool(d.get("voirSolde")), bool(d.get("voirSoldeVip")), u["id"]))
    return affectations(u)


def retirer(u, uid: int) -> dict:
    """Bouton ✖ : « Voulez-vous retirer le guichet à cet utilisateur » (p. 20)"""
    droit(u)
    f = une("""select f.id from affectation_guichet f join utilisateur x on x.id = f.utilisateur_id
               where f.utilisateur_id = %s and x.institution_id = %s and f.fin is null for update""", (uid, u["institution_id"]))
    if not f:
        raise ErreurMetier("Cet utilisateur n'a pas de guichet.")
    executer("update affectation_guichet set fin = now(), retire_par = %s where id = %s", (u["id"], f["id"]))
    return affectations(u)
