"""S44 : groupes solidaires et affectation des clients (manuel Microfina++, p. 54 et 55). Mêmes règles que web/src/donnees/api.ts (groupes)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import apercu_numero_client, exiger, numero_client, titulaire


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {
        "codeSuivant": apercu_numero_client(u),     # code proposé selon la règle de numérotation des clients (S15), registre S44-2
        "groupes": lignes("""select g.id, g.code, g.nom, a.nom as agence from groupe_solidaire g left join agence a on a.id = g.agence_id
                             where g.institution_id = %s order by g.id""", (i,)),
        "membres": [{**r, "membre": titulaire(r["tiersId"])} for r in
                    lignes("""select m.groupe_id as "groupeId", m.tiers_id as "tiersId", t.numero from groupe_solidaire_membre m
                              join tiers t on t.id = m.tiers_id join groupe_solidaire g on g.id = m.groupe_id
                              where g.institution_id = %s order by m.affecte_le, t.numero""", (i,))],
    }


def controler(u, d, gid=None) -> tuple[str, str]:
    code, nom = texte(d, "code"), texte(d, "nom")
    manque = [n for n, v in (("code groupe", code), ("nom groupe", nom)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if valeur("select 1 from groupe_solidaire where institution_id = %s and code = %s and id is distinct from %s", (u["institution_id"], code, gid)):
        raise ErreurMetier("Ce code groupe existe déjà.")
    return code, nom


def groupe_de(u, gid):
    g = une("select * from groupe_solidaire where id = %s and institution_id = %s for update", (gid, u["institution_id"]))
    if not g:
        raise ErreurMetier("Groupe introuvable.")
    return g


def creer(u, d) -> dict:
    exiger(u)
    code, nom = controler(u, d)
    if code == apercu_numero_client(u):            # code proposé gardé : le compteur de la règle S15 avance (registre S44-2)
        code = numero_client(u)
        controler(u, {"code": code, "nom": nom})
    gid = valeur("insert into groupe_solidaire (institution_id, agence_id, code, nom) values (%s, %s, %s, %s) returning id",
                 (u["institution_id"], u["agence_id"], code, nom))
    return {"id": gid, "code": code, "nom": nom}


def modifier(u, gid: int, d) -> dict:
    exiger(u)
    groupe_de(u, gid)
    code, nom = controler(u, d, gid)
    executer("update groupe_solidaire set code = %s, nom = %s where id = %s", (code, nom, gid))
    return {"id": gid, "code": code, "nom": nom}


def supprimer(u, gid: int):
    exiger(u)
    groupe_de(u, gid)
    if valeur("select 1 from groupe_solidaire_membre where groupe_id = %s", (gid,)):
        raise ErreurMetier("Ce groupe a des membres : les retirer d'abord.")
    executer("delete from groupe_solidaire where id = %s", (gid,))


def ids_de(d) -> list[int]:
    ids = d.get("tiersIds") if isinstance(d, dict) else None
    if not isinstance(ids, list) or not ids or any(not isinstance(x, int) or isinstance(x, bool) for x in ids) or len(set(ids)) != len(ids):
        raise ErreurMetier("Aucun client choisi.")
    return ids


def affecter(u, gid: int, d) -> dict:
    """Onglet « Affectation Groupe Solidarité » : Ajouter puis Enregistrer (p. 55)"""
    exiger(u)
    groupe_de(u, gid)
    for tid in ids_de(d):
        t = une("select statut from tiers where id = %s and institution_id = %s", (tid, u["institution_id"]))
        if not t:
            raise ErreurMetier("Client introuvable.")
        if t["statut"] != "actif":
            raise ErreurMetier(f"{titulaire(tid)} : client non actif (visa ou validation à faire).")
        if valeur("select 1 from groupe_solidaire_membre where groupe_id = %s and tiers_id = %s", (gid, tid)):
            raise ErreurMetier(f"{titulaire(tid)} est déjà membre de ce groupe.")
        autre = valeur("""select g.nom from groupe_solidaire_membre m join groupe_solidaire g on g.id = m.groupe_id
                          where m.tiers_id = %s and m.groupe_id <> %s""", (tid, gid))
        if autre:                                   # un seul groupe solidaire à la fois (registre S44-1)
            raise ErreurMetier(f"{titulaire(tid)} est déjà membre du groupe « {autre} » : le retirer d'abord.")
        executer("insert into groupe_solidaire_membre (groupe_id, tiers_id, affecte_par) values (%s, %s, %s)", (gid, tid, u["id"]))
    return lire(u)


def retirer(u, gid: int, d) -> dict:
    exiger(u)
    groupe_de(u, gid)
    for tid in ids_de(d):
        if not valeur("select 1 from groupe_solidaire_membre where groupe_id = %s and tiers_id = %s", (gid, tid)):
            raise ErreurMetier("Ce client n'est pas membre de ce groupe.")
        executer("delete from groupe_solidaire_membre where groupe_id = %s and tiers_id = %s", (gid, tid))
    return lire(u)
