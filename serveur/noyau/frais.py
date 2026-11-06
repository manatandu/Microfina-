"""S16 : frais et leur paramétrage (manuel Microfina++, p. 25 à 27). Mêmes règles que web/src/donnees/api.ts (parametrage)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

# Types d'opération montrés par le manuel (p. 25 et 26). Liste complète à confirmer.
TYPES_OPERATION = ["ADHESION", "DEPOT"]
# Services gratuits « sans aucune condition » : Instr. BCC 37, art. 2 et 3, annexe (ouverture et clôture de compte, dépôt et retrait d'espèces,
# virement de compte à compte dans la même institution, deux premiers relevés mensuels…)
GRATUITS = {"DEPOT": "dépôt d'espèces", "RETRAIT": "retrait d'espèces", "OUVERTURE": "ouverture de compte", "CLOTURE": "clôture de compte",
            "VIREMENT": "virement de compte à compte"}
NATURES = ["Montant"]                        # seule nature montrée (p. 26) ; autres à confirmer
TYPES_MEMBRE = {"Physique": "physique", "Entreprise": "morale", "Groupe": "groupe"}   # les trois types de client (p. 47)


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité au paramétrage : à confirmer (S04 à S07)


def texte(d, k):
    v = d.get(k)
    return v.strip() if isinstance(v, str) else ""


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {
        "typesOperation": TYPES_OPERATION, "natures": NATURES, "typesMembre": list(TYPES_MEMBRE),
        "sousTypes": [r["libelle"] for r in lignes("select libelle from sous_type_client where institution_id = %s order by id", (i,))],
        "frais": lignes("select id, libelle, type_operation as \"typeOperation\" from frais where institution_id = %s order by id", (i,)),
        "operations": lignes("""select p.id, p.frais_id as "fraisId", s.libelle as "sousType", p.valeur, p.compte, 'Montant' as nature
                                 from parametrage_frais p join sous_type_client s on s.id = p.sous_type_id join frais f on f.id = p.frais_id
                                 where f.institution_id = %s order by p.id""", (i,)),
        "adhesion": [{**r, "typeMembre": next(k for k, v in TYPES_MEMBRE.items() if v == r["typeMembre"])} for r in
                     lignes("""select p.id, p.frais_id as "fraisId", p.type_membre as "typeMembre", p.valeur, p.compte, 'Montant' as nature
                               from parametrage_frais_adhesion p join frais f on f.id = p.frais_id where f.institution_id = %s order by p.id""", (i,))],
    }


def controler_frais(u, d) -> tuple[str, str]:
    t, l = texte(d, "typeOperation"), texte(d, "libelle")
    manque = [n for n, v in (("type opération", t), ("libellé du frais", l)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if t not in TYPES_OPERATION:
        raise ErreurMetier("Type d'opération inconnu.")
    if t in GRATUITS:
        raise ErreurMetier(f"Aucun frais sur le {GRATUITS[t]} : service gratuit sans condition (Instr. BCC 37, art. 2 et 3, annexe).")
    return t, l


def creer_frais(u, d) -> dict:
    droit(u)
    t, l = controler_frais(u, d)
    if valeur("select 1 from frais where institution_id = %s and type_operation = %s and libelle = %s", (u["institution_id"], t, l)):
        raise ErreurMetier("Ce frais existe déjà.")
    fid = valeur("insert into frais (institution_id, type_operation, libelle) values (%s, %s, %s) returning id", (u["institution_id"], t, l))
    return {"id": fid, "libelle": l, "typeOperation": t}


def frais_de(u, fid) -> dict:
    f = une("select * from frais where id = %s and institution_id = %s for update", (fid, u["institution_id"]))
    if not f:
        raise ErreurMetier("Frais introuvable.")
    return f


def modifier_frais(u, fid: int, d) -> dict:
    droit(u)
    frais_de(u, fid)
    t, l = controler_frais(u, d)
    if valeur("select 1 from frais where institution_id = %s and type_operation = %s and libelle = %s and id <> %s", (u["institution_id"], t, l, fid)):
        raise ErreurMetier("Ce frais existe déjà.")
    executer("update frais set type_operation = %s, libelle = %s where id = %s", (t, l, fid))
    return {"id": fid, "libelle": l, "typeOperation": t}


def supprimer_frais(u, fid: int):
    droit(u)
    frais_de(u, fid)
    if valeur("select 1 from parametrage_frais where frais_id = %s union select 1 from parametrage_frais_adhesion where frais_id = %s", (fid, fid)):
        raise ErreurMetier("Ce frais est paramétré : supprimer d'abord son paramétrage.")
    executer("delete from frais where id = %s", (fid,))


def controler_valeurs(d) -> tuple[int | None, str | None]:
    if texte(d, "nature") not in NATURES:
        raise ErreurMetier("À remplir : nature du frais.")
    v, c = d.get("valeur"), texte(d, "compte")
    if v is not None and (not isinstance(v, int) or isinstance(v, bool) or v < 0):
        raise ErreurMetier("Valeur invalide.")
    if c and not c.isdigit():
        raise ErreurMetier("Compte : chiffres seulement.")
    return v, c or None


def parametrer_operation(u, d) -> list[dict]:
    """« Paramétrage frais » : Opération*, Frais*, Nature du frais*, Valeur, Compte, Sous type client cochés (p. 26)."""
    droit(u)
    f = frais_de(u, d.get("fraisId"))
    if f["type_operation"] == "ADHESION":
        raise ErreurMetier("Un frais d'adhésion se paramètre dans l'onglet Paramétrage frais Adhésion.")
    v, c = controler_valeurs(d)
    sous = d.get("sousTypes") or []
    if not sous:
        raise ErreurMetier("Cocher au moins un sous type client.")
    ids = []
    for s in sous:
        sid = valeur("select id from sous_type_client where institution_id = %s and libelle = %s", (u["institution_id"], s))
        if not sid:
            raise ErreurMetier("Sous type client inconnu.")
        if valeur("select 1 from parametrage_frais where frais_id = %s and sous_type_id = %s", (f["id"], sid)):
            raise ErreurMetier(f"Déjà paramétré pour « {s} » : passer par Modif Paramétrage frais.")
        ids.append(valeur("insert into parametrage_frais (frais_id, sous_type_id, nature, valeur, compte) values (%s, %s, 'montant', %s, %s) returning id",
                          (f["id"], sid, v, c)))
    return ids


def parametrer_adhesion(u, d) -> list[int]:
    """« Paramétrage frais Adhésion » : Frais*, Nature du frais*, Type client cochés (p. 26)."""
    droit(u)
    f = frais_de(u, d.get("fraisId"))
    if f["type_operation"] != "ADHESION":
        raise ErreurMetier("Ce frais n'est pas un frais d'adhésion.")
    v, c = controler_valeurs(d)
    types = d.get("typesMembre") or []
    if not types:
        raise ErreurMetier("Cocher au moins un type client.")
    ids = []
    for t in types:
        if t not in TYPES_MEMBRE:
            raise ErreurMetier("Type client inconnu.")
        if valeur("select 1 from parametrage_frais_adhesion where frais_id = %s and type_membre = %s", (f["id"], TYPES_MEMBRE[t])):
            raise ErreurMetier(f"Déjà paramétré pour « {t} » : passer par Modif Paramétrage frais Adhésion.")
        ids.append(valeur("""insert into parametrage_frais_adhesion (frais_id, type_membre, nature, valeur, compte) values (%s, %s, 'montant', %s, %s) returning id""",
                          (f["id"], TYPES_MEMBRE[t], v, c)))
    return ids


def ligne_de(u, table: str, pid: int):
    r = une(f"select p.* from {table} p join frais f on f.id = p.frais_id where p.id = %s and f.institution_id = %s for update", (pid, u["institution_id"]))
    if not r:
        raise ErreurMetier("Paramétrage introuvable.")
    return r


def modifier_parametrage(u, table: str, pid: int, d):
    """« Modif Paramétrage frais » et « … Adhésion » : Action > Modifier infos (p. 26 et 27)."""
    droit(u)
    ligne_de(u, table, pid)
    v, c = controler_valeurs(d)
    executer(f"update {table} set valeur = %s, compte = %s where id = %s", (v, c, pid))


def supprimer_parametrage(u, table: str, pid: int):
    droit(u)
    ligne_de(u, table, pid)
    executer(f"delete from {table} where id = %s", (pid,))


def frais_lies(u, tid: int) -> list[dict]:
    """« Liste des Frais liés » (p. 52 et 53) : frais d'adhésion paramétrés pour le type du client, ou le montant modifié pour ce client (S41)."""
    exiger(u)
    return lignes("""select f.id as "fraisId", f.libelle, p.compte, coalesce(fc.montant, p.valeur) as montant
                     from parametrage_frais_adhesion p join frais f on f.id = p.frais_id
                     join tiers t on t.type = p.type_membre and t.institution_id = f.institution_id
                     left join frais_client fc on fc.tiers_id = t.id and fc.frais_id = f.id
                     where t.id = %s order by p.id""", (tid,))


def modifier_frais_client(u, tid: int, d) -> list[dict]:
    """S41 : Client > Visa > Modifier frais (p. 53). Modifier le montant des frais dans la Liste des frais liés."""
    exiger(u, "chef_agence")                 # profil habilité : à confirmer
    t = une("select id, statut from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] != "actif":
        raise ErreurMetier("Client non visé : viser d'abord le client.")
    lies = {r["fraisId"] for r in frais_lies(u, tid)}
    lignes_ = d.get("frais") if isinstance(d, dict) else None
    if not isinstance(lignes_, list) or not lignes_:
        raise ErreurMetier("Aucun frais à modifier.")
    for l in lignes_:
        fid, m = (l or {}).get("fraisId"), (l or {}).get("montant")
        if fid not in lies:
            raise ErreurMetier("Ce frais n'est pas lié à ce client.")
        if not isinstance(m, int) or isinstance(m, bool) or m < 0:
            raise ErreurMetier("Montant invalide.")
    for l in lignes_:
        executer("""insert into frais_client (tiers_id, frais_id, montant, modifie_par) values (%s, %s, %s, %s)
                    on conflict (tiers_id, frais_id) do update set montant = excluded.montant, modifie_par = excluded.modifie_par, modifie_le = now()""",
                 (tid, l["fraisId"], l["montant"], u["id"]))
    return frais_lies(u, tid)
