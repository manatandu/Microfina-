"""S30 : Comptabilité > Journal (manuel Microfina++, p. 41 et 42). « renseigner le type journal et le libelle et [Enregistrer] ».
Les journaux auxiliaires sont au choix de l'institution (PCCI § 3.3). Mêmes règles que web/src/donnees/api.ts (journaux)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

TYPES = {"caisse": "Journal de Caisse", "banque": "Journal de Banque", "operations_diverses": "Journal des Opérations diverses",
         "credit": "Journal de Crédit", "epargne": "Journal d'Epargne", "provisions": "Journal des Provisions", "paie": "Journal de Paie",
         "immobilisations": "Journal des Immobilisations", "a_nouveaux": "Journal des À-nouveaux"}   # types du schéma (replica/schema.sql)


def exercice_en_cours(i):
    return valeur("select annee from exercice where institution_id = %s and actif", (i,))


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    ex = exercice_en_cours(i)
    rows = lignes("""select j.id, j.code, j.libelle, j.type, j.actif,
                            exists (select 1 from journal_detail d where d.journal_id = j.id and d.annee = %s) as detail
                     from journal j where j.institution_id = %s and not j.supprime order by j.code""", (ex, i))
    for r in rows:
        r["typeLibelle"] = TYPES[r["type"]]
    return {"types": [{"code": k, "libelle": v} for k, v in TYPES.items()], "exercice": ex, "journaux": rows}


def utilise(jid) -> str | None:
    if valeur("select 1 from ecriture where journal_id = %s limit 1", (jid,)):
        return "des écritures y sont passées"
    if valeur("select 1 from guichet where journal_id = %s limit 1", (jid,)):
        return "un guichet l'utilise"
    if valeur("select 1 from compte_bancaire where journal_id = %s limit 1", (jid,)):
        return "un compte bancaire l'utilise"
    return None


def enregistrer(u, d, jid: int | None = None) -> dict:
    """Enregistrer (nouveau journal) ou modifier le journal choisi (registre S30-1 à S30-3). Tous les contrôles avant d'écrire."""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    texte = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    type_, libelle, code = texte("type"), texte("libelle"), texte("code").upper()
    actif, detail = bool(d.get("actif")), bool(d.get("detail"))
    manque = [n for n, v in (("Type Journal", type_), ("Libelle", libelle), ("Code", code)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if type_ not in TYPES:
        raise ErreurMetier("Type Journal inconnu.")
    actuel = None
    if jid is not None:
        actuel = une("select * from journal where id = %s and institution_id = %s and not supprime for update", (jid, i))
        if not actuel:
            raise ErreurMetier("Journal introuvable.")
        pourquoi = utilise(jid)
        if pourquoi and (code != actuel["code"] or type_ != actuel["type"]):
            raise ErreurMetier(f"Le code et le type ne se changent plus : {pourquoi}.")
    if une("select 1 from journal where institution_id = %s and code = %s and id is distinct from %s", (i, code, jid)):
        raise ErreurMetier("Ce Code existe déjà.")
    ex = exercice_en_cours(i)
    if detail and ex is None:
        raise ErreurMetier("Détail journal : aucun exercice en cours (Administration > Exercice).")
    if not detail and jid is not None and ex is not None and \
            valeur("select compteur from journal_detail where journal_id = %s and annee = %s", (jid, ex)):
        raise ErreurMetier(f"Détail journal : des pièces sont numérotées sur l'exercice {ex}, le détail reste.")
    if jid is None:
        jid = valeur("insert into journal (institution_id, code, libelle, type, actif) values (%s, %s, %s, %s, %s) returning id", (i, code, libelle, type_, actif))
    else:
        executer("update journal set code = %s, libelle = %s, type = %s, actif = %s where id = %s", (code, libelle, type_, actif, jid))
    if ex is not None:
        if detail:
            executer("insert into journal_detail (institution_id, annee, journal_id) values (%s, %s, %s) on conflict do nothing", (i, ex, jid))
        else:
            executer("delete from journal_detail where journal_id = %s and annee = %s and compteur = 0", (jid, ex))
    return lire(u)


def supprimer(u, jid: int) -> dict:
    """Supprimer (p. 12) : logique (T02) ; un journal qui a servi ne se supprime pas : décocher Actif (registre S30-3)"""
    exiger(u, "chef_agence")
    if not une("select 1 from journal where id = %s and institution_id = %s and not supprime for update", (jid, u["institution_id"])):
        raise ErreurMetier("Journal introuvable.")
    pourquoi = utilise(jid) or ("il a un détail dans un exercice" if valeur("select 1 from journal_detail where journal_id = %s and compteur > 0 limit 1", (jid,)) else None)
    if pourquoi:
        raise ErreurMetier(f"Ce journal ne se supprime pas : {pourquoi}. Décocher Actif.")
    executer("delete from journal_detail where journal_id = %s", (jid,))
    executer("update journal set supprime = true, actif = false where id = %s", (jid,))
    return lire(u)
