"""S71 : Épargne > Blocage compte et montant (manuel Microfina++, p. 81 : « Blocage et déblocage de compte »). Mêmes règles que web/src/donnees/api.ts (blocages).
Bloquer le compte (montant vide : tout le compte, aucun débit possible ; les dépôts restent acceptés) ou un montant, avec motif. Le déblocage, que le manuel
ne montre pas, se fait depuis l'historique des actions, sur le modèle de la libération des garanties (S94). Registre S71-1 à S71-5."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, montant_bloque, solde_contrat, titulaire


def texte(d, k):
    v = (d or {}).get(k)
    return v.strip() if isinstance(v, str) else ""


def compte_de(u, cid) -> dict:
    c = une("""select c.*, trim(c.devise) as dv, p.libelle as produit from compte_depot c join produit_epargne p on p.id = c.produit_id
               where c.id = %s and c.institution_id = %s""", (cid, u["institution_id"])) if isinstance(cid, int) and not isinstance(cid, bool) else None
    if not c:
        raise ErreurMetier("À remplir : compte.")
    return c


def nom(uid):
    return valeur("select nom from utilisateur where id = %s", (uid,)) or ""


def etat(u, cid: int) -> dict:
    """Infos compte (capture p. 81) : Solde du compte, Montant bloqué, Montant débloqué, Epargne libre ; et l'historique des actions (registre S71-2, S71-4)"""
    exiger(u)
    c = compte_de(u, cid)
    solde = solde_contrat(f"depot:{c['id']}", c["dv"], "C")
    bloque = montant_bloque(c["id"], solde)
    hist = lignes("select * from blocage where compte_id = %s order by debut desc, id desc", (c["id"],))
    en_cours = lambda b: b["fin"] is None
    return {"compteId": c["id"], "compte": c["numero"], "produit": c["produit"], "devise": c["dv"], "client": titulaire(c["tiers_id"]),
            "solde": solde, "montantBloque": bloque, "montantDebloque": sum(b["montant"] or 0 for b in hist if not en_cours(b)), "epargneLibre": solde - bloque,
            "compteBloque": any(en_cours(b) and b["montant"] is None for b in hist),
            "historique": [{"id": b["id"], "action": "Bloquer compte" if b["montant"] is None else "Bloqué Montant", "montant": b["montant"], "motif": b["motif"],
                            "debut": b["debut"].date().isoformat(), "posePar": nom(b["pose_par"]), "fin": b["fin"].date().isoformat() if b["fin"] else "",
                            "levePar": nom(b["leve_par"]), "motifLevee": b["motif_levee"] or "", "garantie": b["garantie_de"] is not None, "enCours": en_cours(b)} for b in hist]}


def bloquer(u, d) -> dict:
    """Enregistrer (p. 81) : cocher Bloquer compte ou Bloqué Montant, le montant et le motif (registre S71-1, S71-3)"""
    exiger(u)
    c = compte_de(u, (d or {}).get("compteId"))
    if c["statut"] != "ouvert":
        raise ErreurMetier("Ce compte n'est pas ouvert.")
    motif = texte(d, "motif")
    tout, montant = bool((d or {}).get("bloquerCompte")), bool((d or {}).get("bloquerMontant"))
    if tout == montant:
        raise ErreurMetier("Cocher Bloquer compte ou Bloqué Montant.")
    if not motif:
        raise ErreurMetier("À remplir : Motif.")
    e = etat(u, c["id"])
    if e["compteBloque"]:
        raise ErreurMetier("Ce compte est déjà bloqué.")
    if montant:
        m = (d or {}).get("montant")
        if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
            raise ErreurMetier("Montant à bloquer : un montant supérieur à zéro.")
        if m > e["epargneLibre"]:
            raise ErreurMetier("Le montant à bloquer dépasse l'épargne libre du compte.")
        executer("insert into blocage (compte_id, montant, motif, pose_par) values (%s, %s, %s, %s)", (c["id"], m, motif, u["id"]))
    else:
        executer("insert into blocage (compte_id, montant, motif, pose_par) values (%s, null, %s, %s)", (c["id"], motif, u["id"]))
    return etat(u, c["id"])


def debloquer(u, bid: int, d) -> dict:
    """Déblocage (complété, modèle S94) : un blocage en cours, avec le motif de la levée ; une garantie de crédit se libère par Caution et nantissement (registre S71-5)"""
    exiger(u)
    b = une("""select b.* from blocage b join compte_depot c on c.id = b.compte_id where b.id = %s and c.institution_id = %s for update of b""", (bid, u["institution_id"]))
    if not b or b["fin"] is not None:
        raise ErreurMetier("Ce blocage n'est plus en cours.")
    if b["garantie_de"] is not None:
        raise ErreurMetier("Ce montant garantit un crédit : il se libère par Crédit > Caution et nantissement.")
    motif = texte(d, "motif")
    if not motif:
        raise ErreurMetier("À remplir : Motif.")
    executer("update blocage set fin = now(), leve_par = %s, motif_levee = %s where id = %s", (u["id"], motif, bid))
    return etat(u, b["compte_id"])
