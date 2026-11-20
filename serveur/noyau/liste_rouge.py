"""S97 : Crédit > Liste rouge (manuel Microfina++, p. 119 et 120, captures « Gestion de la liste rouge »). Mêmes règles que web/src/donnees/api.ts
(listeRouge). Registre S97-1 à S97-4, CR-9.

« Rechercher le numéro du client, renseigner le motif ensuite cliquer sur [Ajouter] » ; « … sur [Retirer] pour confirmer l'opération ».
Effet (CR-9) : un client inscrit ne peut ni déposer une demande, ni être approuvé, ni recevoir une mise en place. Une mise à l'index de la BCC s'inscrit
avec la référence de la décision ; pour une personne morale, ses dirigeants sont touchés aussi (Instr. BCC 13, art. 7 a et b)."""
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante, titulaire


def jour(u) -> date:
    j = journee_courante(u)
    return (date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]) if j else date.today()


def inscription(tid: int) -> dict | None:
    return une("select * from liste_rouge where tiers_id = %s and retire_le is null", (tid,))


def bloquant(tid: int) -> dict | None:
    """L'inscription du client, ou celle de la personne morale indexée par la BCC dont il est dirigeant (même pièce d'identité ; Instr. BCC 13, art. 7 b)"""
    i = inscription(tid)
    if i:
        return i
    return une("""select lr.* from liste_rouge lr join representant r on r.tiers_id = lr.tiers_id and r.role = 'dirigeant'
                  join tiers_personne p on p.tiers_id = %s and p.piece_numero is not null and p.piece_numero <> ''
                       and upper(trim(p.piece_numero)) = upper(trim(r.piece_numero))
                  where lr.retire_le is null and lr.reference_bcc is not null limit 1""", (tid,))


def controler(tid: int) -> None:
    """CR-9 : refus de la demande, de l'approbation et de la mise en place"""
    i = bloquant(tid)
    if i:
        quoi = f"mise à l'index, décision BCC {i['reference_bcc']} (Instr. BCC 13, art. 7)" if i["reference_bcc"] else f"motif : {i['motif']}"
        cible = "" if i["tiers_id"] == tid else f" ; dirigeant de {titulaire(i['tiers_id'])}"
        raise ErreurMetier(f"Client sur la liste rouge ({quoi}{cible}) : aucun crédit.")


def vue(x: dict) -> dict:
    return {"id": x["id"], "tiersId": x["tiers_id"], "membre": valeur("select numero from tiers where id = %s", (x["tiers_id"],)), "client": titulaire(x["tiers_id"]),
            "date": x["ajoute_le"].isoformat(), "motif": x["motif"], "referenceBcc": x["reference_bcc"] or ""}


def lister(u) -> list[dict]:
    exiger(u)
    return [vue(x) for x in lignes("select * from liste_rouge where institution_id = %s and retire_le is null order by ajoute_le desc, id desc", (u["institution_id"],))]


def texte(p, k) -> str:
    v = (p or {}).get(k)
    return v.strip() if isinstance(v, str) else ""


def tiers_de(u, p) -> int:
    tid = (p or {}).get("tiersId")
    if not isinstance(tid, int) or isinstance(tid, bool) or not valeur("select 1 from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])):
        raise ErreurMetier("À remplir : N° Client.")
    return tid


def ajouter(u, p) -> list[dict]:
    exiger(u)
    tid, motif = tiers_de(u, p), texte(p, "motif")
    if not motif:
        raise ErreurMetier("À remplir : Motif.")
    if inscription(tid):
        raise ErreurMetier("Ce client est déjà sur la liste rouge.")
    executer("insert into liste_rouge (institution_id, tiers_id, motif, reference_bcc, ajoute_le, ajoute_par) values (%s, %s, %s, %s, %s, %s)",
             (u["institution_id"], tid, motif, texte(p, "referenceBcc") or None, jour(u), u["id"]))
    return lister(u)


def retirer(u, p) -> list[dict]:
    exiger(u)
    tid, motif = tiers_de(u, p), texte(p, "motif")
    if not motif:
        raise ErreurMetier("À remplir : Motif.")
    i = inscription(tid)
    if not i:
        raise ErreurMetier("Ce client n'est pas sur la liste rouge.")
    executer("update liste_rouge set retire_le = %s, retire_par = %s, motif_retrait = %s where id = %s", (jour(u), u["id"], motif, i["id"]))
    return lister(u)
