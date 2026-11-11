"""S11 : Administration > Exercice (manuel Microfina++, p. 20 et 21). Mêmes règles que web/src/donnees/api.ts (exercices)."""
from .bd import ErreurMetier, executer, lignes, une
from .services import exiger


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité : à confirmer


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    ex = lignes("select annee, actif, ouvert, valide from exercice where institution_id = %s order by annee", (i,))
    en_cours = max((e["annee"] for e in ex if e["ouvert"] and not e["valide"]), default=None)
    return {
        "exercices": ex,
        "enCours": en_cours,
        "journaux": lignes("select id, code, libelle, type from journal where institution_id = %s order by code", (i,)),
        "details": lignes("""select d.id, d.annee, d.journal_id as "journalId", j.libelle, j.code, j.type, d.actif, d.ouvert, d.compteur
                             from journal_detail d join journal j on j.id = d.journal_id where d.institution_id = %s order by d.annee, j.code""", (i,)),
    }


def annee_de(v) -> int:
    try:
        a = int(str(v).strip())
    except (TypeError, ValueError):
        raise ErreurMetier("Année invalide.")
    if not 1900 <= a <= 2999:
        raise ErreurMetier("Année invalide.")
    return a


def enregistrer(u, d) -> dict:
    """« Nouvel Exercice » (p. 20) : Année*, puis les cases Actif ?, Ouvert ?, Validé ? cochées dans la liste, Enregistrer."""
    droit(u)
    i = u["institution_id"]
    texte = str(d.get("annee") or "").strip()
    lignes_ = d.get("lignes") or []
    if not texte and not lignes_:
        raise ErreurMetier("À remplir : année.")
    if texte:
        a = annee_de(texte)
        if une("select 1 from exercice where institution_id = %s and annee = %s", (i, a)):
            raise ErreurMetier("Cet exercice existe déjà.")
        executer("insert into exercice (institution_id, annee) values (%s, %s)", (i, a))
    for l in lignes_:
        a = annee_de(l.get("annee"))
        if not une("select 1 from exercice where institution_id = %s and annee = %s for update", (i, a)):
            raise ErreurMetier("Exercice introuvable.")
        executer("update exercice set actif = %s, ouvert = %s, valide = %s where institution_id = %s and annee = %s",
                 (bool(l.get("actif")), bool(l.get("ouvert")), bool(l.get("valide")), i, a))
    return lire(u)


def ouvrir(u, annee) -> dict:
    """« Ouverture d'un Exercice » (p. 21) : Exercice à ouvrir, Ouvrir ; la Liste Détails Journal reçoit les journaux de l'institution."""
    droit(u)
    i = u["institution_id"]
    a = annee_de(annee)
    if not une("select 1 from exercice where institution_id = %s and annee = %s for update", (i, a)):
        raise ErreurMetier("Exercice introuvable.")
    if une("select 1 from journal_detail where institution_id = %s and annee = %s", (i, a)):
        raise ErreurMetier("Cet exercice est déjà ouvert.")
    executer("""insert into journal_detail (institution_id, annee, journal_id) select %s, %s, id from journal where institution_id = %s""", (i, a, i))
    executer("update exercice set ouvert = true where institution_id = %s and annee = %s", (i, a))
    return lire(u)
