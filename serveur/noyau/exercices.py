"""S11 : Administration > Exercice (manuel Microfina++, p. 20 et 21). Mêmes règles que web/src/donnees/api.ts (exercices)."""
from .bd import ErreurMetier, executer, lignes, une
from .services import exiger


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité : registre T07, en attendant S03 à S06


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    ex = lignes("select annee, actif, ouvert, valide from exercice where institution_id = %s order by annee", (i,))
    en_cours = next((e["annee"] for e in ex if e["actif"]), None)   # registre S11-1 : l'exercice actif est l'exercice en cours
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
        annee_de(texte)
    # Tout est contrôlé avant d'écrire : une erreur ne laisse rien à moitié enregistré
    voulu = {e["annee"]: e for e in lignes("select * from exercice where institution_id = %s for update", (i,))}
    maj = []
    for l in lignes_:
        a = annee_de(l.get("annee"))
        e = voulu.get(a)
        if not e:
            raise ErreurMetier("Exercice introuvable.")
        valide = bool(l.get("valide"))
        if e["valide"] and not valide:
            # Registre S11-3 : PCCI § 3.4 (irréversibilité) et § 4.3.6 (intangibilité du bilan d'ouverture)
            raise ErreurMetier(f"L'exercice {a} est validé : il ne se rouvre pas.")
        if valide and not e["valide"] and une("""select 1 from journee_comptable j join agence g on g.id = j.agence_id
                                                  where g.institution_id = %s and extract(year from j.date_comptable) = %s and j.statut <> 'fermee'""", (i, a)):
            raise ErreurMetier(f"L'exercice {a} a encore une journée ouverte : la comptabiliser avant de le valider.")
        voulu[a] = {**e, "actif": bool(l.get("actif")), "ouvert": bool(l.get("ouvert")), "valide": valide}
        maj.append(a)
    if sum(1 for e in voulu.values() if e["actif"]) > 1:
        raise ErreurMetier("Un seul exercice actif à la fois.")   # registre S11-1
    if texte:
        a = annee_de(texte)
        if a in voulu:
            raise ErreurMetier("Cet exercice existe déjà.")
        executer("insert into exercice (institution_id, annee) values (%s, %s)", (i, a))
    for a in maj:
        e = voulu[a]
        executer("update exercice set actif = %s, ouvert = %s, valide = %s where institution_id = %s and annee = %s", (e["actif"], e["ouvert"], e["valide"], i, a))
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


def completer(u, d) -> dict:
    """« Completer journal detail de l'exercice encours » (p. 21) : les journaux cochés reçoivent leur ligne dans l'exercice en cours.
    Le bas de l'écran est coupé sur la capture ; bouton Enregistrer et confirmation (registre S11-8, manuel p. 11)."""
    droit(u)
    i = u["institution_id"]
    a = lire(u)["enCours"]
    if a is None:
        raise ErreurMetier("Aucun exercice en cours.")
    ids = d.get("journalIds") if isinstance(d, dict) and isinstance(d.get("journalIds"), list) else []
    if not ids:
        raise ErreurMetier("À remplir : journaux à ajouter.")
    for jid in ids:
        if not une("select 1 from journal where id = %s and institution_id = %s", (jid, i)):
            raise ErreurMetier("Journal inconnu.")
    for jid in ids:
        if not une("select 1 from journal_detail where institution_id = %s and annee = %s and journal_id = %s", (i, a, jid)):
            executer("insert into journal_detail (institution_id, annee, journal_id) values (%s, %s, %s)", (i, a, jid))
    return lire(u)
