"""S97 : Crédit > Liste rouge (manuel Microfina++, p. 119 et 120, captures « Gestion de la liste rouge »). Mêmes règles que web/src/donnees/api.ts
(listeRouge). Registre S97-1 à S97-4, CR-9.

« Rechercher le numéro du client, renseigner le motif ensuite cliquer sur [Ajouter] » ; « … sur [Retirer] pour confirmer l'opération ».
Effet (CR-9) : un client inscrit ne peut ni déposer une demande, ni être approuvé, ni recevoir une mise en place. Une mise à l'index de la BCC s'inscrit
avec la référence de la décision ; pour une personne morale, ses dirigeants sont touchés aussi (Instr. BCC 13, art. 7 a et b)."""
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from psycopg.types.json import Jsonb

from .services import exiger, journee_courante, json_lu, titulaire


def jour(u) -> date:
    j = journee_courante(u)
    return (date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]) if j else date.today()


def inscription(tid: int) -> dict | None:
    return une("select * from liste_rouge where tiers_id = %s and retire_le is null", (tid,))


def bloquant(tid: int) -> dict | None:
    """L'inscription du client, ou celle de la personne morale indexée par la BCC dont il est dirigeant (fiche de l'entreprise) ou dont la décision le vise
    comme dirigeant ou associé (pièces notées à l'inscription, registre S97-4) : même pièce d'identité (Instr. BCC 13, art. 7 b)"""
    i = inscription(tid)
    if i:
        return i
    return une("""select lr.* from liste_rouge lr join tiers_personne p on p.tiers_id = %s and p.piece_numero is not null and p.piece_numero <> ''
                  where lr.retire_le is null and lr.reference_bcc is not null
                  and (exists (select 1 from representant r where r.tiers_id = lr.tiers_id and r.role = 'dirigeant' and r.retire_le is null
                               and upper(trim(r.piece_numero)) = upper(trim(p.piece_numero)))
                       or exists (select 1 from jsonb_array_elements(lr.personnes_visees) x where upper(trim(x->>'piece')) = upper(trim(p.piece_numero))))
                  limit 1""", (tid,))


def index_bcc(tid: int) -> dict | None:
    """Mise à l'index de la BCC seulement (décision avec sa référence), du client ou de la personne morale dont il est dirigeant ou associé"""
    i = une("select * from liste_rouge where tiers_id = %s and retire_le is null and reference_bcc is not null", (tid,))
    if i:
        return i
    b = bloquant(tid)
    return b if b and b["reference_bcc"] else None


def controler_ouverture(tid: int) -> None:
    """P4 (confrontation du 21/11/2026) : la mise à l'index suspend les services et facilités auprès de tous les organismes de crédit (Instr. BCC 13,
    art. 7 a ; loi 22/069, titre III, chap. IV) : pas d'ouverture de compte pour la personne frappée, ni pour le dirigeant ou l'associé d'une personne
    morale frappée (art. 7 b)"""
    i = index_bcc(tid)
    if i:
        cible = "" if i["tiers_id"] == tid else f", comme dirigeant ou associé de {titulaire(i['tiers_id'])}"
        raise ErreurMetier(f"Mise à l'index de la BCC (décision {i['reference_bcc']}{cible}) : pas d'ouverture de compte (Instr. BCC 13, art. 7).")


def controler(tid: int) -> None:
    """CR-9 : refus de la demande, de l'approbation et de la mise en place"""
    i = bloquant(tid)
    if i:
        quoi = f"mise à l'index, décision BCC {i['reference_bcc']} (Instr. BCC 13, art. 7)" if i["reference_bcc"] else f"motif : {i['motif']}"
        cible = "" if i["tiers_id"] == tid else f" ; dirigeant ou associé de {titulaire(i['tiers_id'])}"
        raise ErreurMetier(f"Client sur la liste rouge ({quoi}{cible}) : aucun crédit.")


def vue(x: dict) -> dict:
    return {"id": x["id"], "tiersId": x["tiers_id"], "membre": valeur("select numero from tiers where id = %s", (x["tiers_id"],)), "client": titulaire(x["tiers_id"]),
            "date": x["ajoute_le"].isoformat(), "motif": x["motif"], "referenceBcc": x["reference_bcc"] or "",
            "personnesVisees": json_lu(x["personnes_visees"]) or []}


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


def personnes_visees(p) -> list[dict]:
    """Dirigeants et associés que la décision de mise à l'index d'une personne morale vise (Instr. BCC 13, art. 7 b) : nom et numéro de pièce"""
    out = []
    for x in (p or {}).get("personnesVisees") or []:
        nom, piece = str((x or {}).get("nom") or "").strip(), str((x or {}).get("piece") or "").strip()
        if not nom and not piece:
            continue
        if not nom or not piece:
            raise ErreurMetier("Dirigeants et associés visés : un nom et un numéro de pièce par ligne.")
        out.append({"nom": nom, "piece": piece})
    return out


def ajouter(u, p) -> list[dict]:
    exiger(u)
    tid, motif = tiers_de(u, p), texte(p, "motif")
    if not motif:
        raise ErreurMetier("À remplir : Motif.")
    if inscription(tid):
        raise ErreurMetier("Ce client est déjà sur la liste rouge.")
    ref = texte(p, "referenceBcc") or None
    visees = personnes_visees(p)
    if visees and not ref:
        raise ErreurMetier("Dirigeants et associés visés : seulement pour une mise à l'index de la BCC (Réf. décision BCC).")
    executer("""insert into liste_rouge (institution_id, tiers_id, motif, reference_bcc, ajoute_le, ajoute_par, personnes_visees)
                values (%s, %s, %s, %s, %s, %s, %s)""", (u["institution_id"], tid, motif, ref, jour(u), u["id"], Jsonb(visees)))
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
