"""S08, S09 et S10 : Administration > Guichet (manuel Microfina++, p. 18 à 20, 95 et 96). Mêmes règles que web/src/donnees/api.ts (guichets)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import devises_tenues, exiger, journee_courante, ouvrir_caisse
from .listes import valeurs


def types_guichet(u) -> list[str]:
    """Registre S08-1 : les types viennent de Général > Type Guichet (S14n)"""
    return [v["libelle"] for v in valeurs(u, "type_guichet")]

# Registre S08-7 : comptes du PCCI proposés par défaut (570, 579, 7790, 671), modifiables, contrôlés sur le plan de comptes (règle T16)
COMPTES_DEFAUT = {"compteGuichet": "570", "compteLiaison": "579", "compteSurplus": "7790", "compteManquant": "671"}


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité : à confirmer


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def avec_plafonds(gs: list[dict]) -> list[dict]:
    """Maximum autorisé en caisse et Retrait plafonné, par devise (registre S08-3)"""
    for g in gs:
        g["plafonds"] = {r["devise"].strip(): {"maximum": r["maximum"], "retrait": r["retrait"]}
                         for r in lignes("select devise, maximum, retrait from guichet_plafond where guichet_id = %s", (g["id"],))}
    return gs


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    j = journee_courante(u)
    return {
        "agences": lignes("select id, code, nom from agence where institution_id = %s order by code", (i,)),
        "journaux": lignes("select id, code, libelle from journal where institution_id = %s and type = 'caisse' and actif and not supprime order by code", (i,)),   # registre S08-2
        "comptesDefaut": COMPTES_DEFAUT,
        # Registre S09-1 et S09-2 (p. 19) : « Dernière journée ouverte », « Journée ouverte à associer »
        "derniereJournee": j["date"] if j else "",
        "journeesOuvertes": [{"id": x["id"], "date": x["date_comptable"].isoformat()} for x in
                             lignes("select id, date_comptable from journee_comptable where agence_id = %s and statut = 'ouverte' order by date_comptable desc",
                                    (u["agence_id"],))],
        "types": types_guichet(u),
        "guichets": avec_plafonds(lignes("""select g.id, g.code, g.nom, coalesce(g.type_guichet, '') as "typeGuichet", g.actif, g.agence_id as "agenceId",
                                     g.journal_id as "journalId",
                                     coalesce(g.compte_guichet, '') as "compteGuichet", coalesce(g.compte_liaison, '') as "compteLiaison",
                                     coalesce(g.compte_surplus, '') as "compteSurplus", coalesce(g.compte_manquant, '') as "compteManquant", g.billetage,
                                     s.id is not null and s.fermee_le is null and s.statut = 'ouverte' as ouvert,
                                     case when s.id is not null then j.date_comptable::text else '' end as "dateOuverture"
                              from guichet g join agence a on a.id = g.agence_id
                              left join session_caisse s on s.guichet_id = g.id and s.journee_id = %s
                              left join journee_comptable j on j.id = s.journee_id
                              where a.institution_id = %s and g.agence_id = %s order by g.code""", (j["id"] if j else None, i, u["agence_id"]))),
        "devises": devises_tenues(),
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


def enregistrer(u, d, gid: int | None = None) -> dict:
    """« Gestion des guichets » (p. 18 et 95) : Agence*, Code guichet*, Désignation*, Type de guichet*, Journal*, Maximum autorisé en caisse*,
    Retrait plafonné* (une valeur par devise, registre S08-3), comptes guichet, liaison, surplus et manquant, Billetage autorisé, Guichet Actif.
    Sans gid : Enregistrer. Avec gid : Modifier, après un clic sur la ligne de la liste (manuel p. 12, registre S08-8)."""
    droit(u)
    i = u["institution_id"]
    if gid is not None and not une("select 1 from guichet g join agence a on a.id = g.agence_id where g.id = %s and a.institution_id = %s", (gid, i)):
        raise ErreurMetier("Guichet introuvable.")
    code, nom, type_ = texte(d, "code"), texte(d, "designation"), texte(d, "typeGuichet")
    agence, journal = d.get("agenceId"), d.get("journalId")
    manque = [n for n, v in (("agence", agence), ("code guichet", code), ("désignation", nom), ("type de guichet", type_), ("journal", journal)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    p = d.get("plafonds") if isinstance(d.get("plafonds"), dict) else {}
    plafonds = {dv: (entier(p.get(dv) if isinstance(p.get(dv), dict) else {}, "maximum", f"maximum autorisé en caisse ({dv})"),
                     entier(p.get(dv) if isinstance(p.get(dv), dict) else {}, "retrait", f"retrait plafonné ({dv})")) for dv in devises_tenues()}
    if type_ not in types_guichet(u):
        raise ErreurMetier("Type de guichet inconnu.")
    if not une("select 1 from agence where id = %s and institution_id = %s", (agence, i)):
        raise ErreurMetier("Agence inconnue.")
    if not une("select 1 from journal where id = %s and institution_id = %s and type = 'caisse' and actif and not supprime", (journal, i)):
        raise ErreurMetier("Journal inconnu.")
    comptes = {}
    for k, n in (("compteGuichet", "Compte guichet"), ("compteLiaison", "Compte liaison"), ("compteSurplus", "Compte surplus"), ("compteManquant", "Compte manquant")):
        v = texte(d, k)
        if v and not v.isdigit():
            raise ErreurMetier(f"{n} : chiffres seulement.")
        if v and not une("select 1 from compte where numero = %s and (institution_id is null or institution_id = %s)", (v, i)):
            raise ErreurMetier(f"{n} : le compte {v} n'est pas dans le plan de comptes.")   # règle T16
        comptes[k] = v or None
    if une("select 1 from guichet where agence_id = %s and code = %s and id is distinct from %s", (agence, code, gid)):
        raise ErreurMetier("Ce code guichet existe déjà.")
    valeurs = (agence, code, nom, type_, journal, comptes["compteGuichet"], comptes["compteLiaison"], comptes["compteSurplus"],
               comptes["compteManquant"], bool(d.get("actif")))
    # Billetage autorisé : toujours vrai (registre S08-6, ARCHITECTURE P8)
    if gid is None:
        gid = valeur("""insert into guichet (agence_id, code, nom, type_guichet, journal_id, compte_guichet, compte_liaison, compte_surplus, compte_manquant, actif, billetage)
                         values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true) returning id""", valeurs)
    else:
        executer("""update guichet set agence_id = %s, code = %s, nom = %s, type_guichet = %s, journal_id = %s, compte_guichet = %s, compte_liaison = %s, compte_surplus = %s,
                                       compte_manquant = %s, actif = %s, billetage = true where id = %s""", (*valeurs, gid))
    executer("delete from guichet_plafond where guichet_id = %s", (gid,))
    for dv, (maximum, retrait) in plafonds.items():
        executer("insert into guichet_plafond (guichet_id, devise, maximum, retrait) values (%s, %s, %s, %s)", (gid, dv, maximum, retrait))
    return lire(u)


def ouvrir(u, gid: int, journee_id: int | None = None) -> dict:
    """« Ouverture/Fermeture de guichets » (p. 19), bouton Ouverture, sur la « Journée ouverte à associer » (registre S09-2)"""
    g = une("select g.actif from guichet g join agence a on a.id = g.agence_id where g.id = %s and a.institution_id = %s", (gid, u["institution_id"]))
    if not g:
        raise ErreurMetier("Guichet introuvable.")
    if not g["actif"]:
        raise ErreurMetier("Guichet inactif.")
    ouvrir_caisse(u, gid, journee_id)
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
    # Registre S09-5 : pas de Fermeture sans billetage du jour enregistré (S79), dans chaque devise (T12)
    faites = {r["devise"].strip() for r in lignes("select devise from billetage where session_caisse_id = %s and moment = 'arret'", (s["id"],))}
    manque = [d for d in devises_tenues() if d not in faites]
    if manque:
        raise ErreurMetier("Enregistrez d'abord le billetage de la caisse (Caisse > Billetage) : " + ", ".join(manque) + ".")
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
