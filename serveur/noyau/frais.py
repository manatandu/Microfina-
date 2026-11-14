"""S16 : frais et leur paramétrage (manuel Microfina++, p. 25 à 27). Mêmes règles que web/src/donnees/api.ts (parametrage)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger
from .listes import valeurs as valeurs_liste

# Registre S16-1 : les opérations des menus Caisse et Banque déjà construites (ADHESION et DEPOT sont montrés p. 25 et 26)
TYPES_OPERATION = ["ADHESION", "DEPOT", "RETRAIT", "PART_SOCIALE"]
# Services gratuits « sans aucune condition » : Instr. BCC 37, art. 2 et 3, annexe (ouverture et clôture de compte, dépôt et retrait d'espèces,
# virement de compte à compte dans la même institution, deux premiers relevés mensuels…)
GRATUITS = {"DEPOT": "dépôt d'espèces", "RETRAIT": "retrait d'espèces", "OUVERTURE": "ouverture de compte", "CLOTURE": "clôture de compte",
            "VIREMENT": "virement de compte à compte"}
NATURES = {"Montant": "montant", "Taux": "taux"}   # registre S16-2 : Taux = pourcentage du montant de l'opération
TYPES_MEMBRE = {"Physique": "physique", "Entreprise": "morale", "Groupe": "groupe"}   # les trois types de client (p. 47)


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité : registre T07, en attendant S03 à S06


def texte(d, k):
    v = d.get(k)
    return v.strip() if isinstance(v, str) else ""


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {
        "typesOperation": TYPES_OPERATION, "natures": list(NATURES), "typesMembre": list(TYPES_MEMBRE),
        "sousTypes": [r["libelle"] for r in valeurs_liste(u, "sous_type_client")],   # registre S16-8 : Général > Sous type de client
        "compteAdhesion": "727",                                                       # registre S16-4 : proposé, modifiable
        "frais": lignes("select id, libelle, type_operation as \"typeOperation\" from frais where institution_id = %s order by id", (i,)),
        "operations": lignes("""select p.id, p.frais_id as "fraisId", s.libelle as "sousType", p.valeur, p.compte, initcap(p.nature) as nature
                                 from parametrage_frais p join liste_reference s on s.id = p.sous_type_id join frais f on f.id = p.frais_id
                                 where f.institution_id = %s order by p.id""", (i,)),
        "adhesion": [{**r, "typeMembre": next(k for k, v in TYPES_MEMBRE.items() if v == r["typeMembre"])} for r in
                     lignes("""select p.id, p.frais_id as "fraisId", p.type_membre as "typeMembre", p.valeur, p.compte, initcap(p.nature) as nature
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


def controler_valeurs(u, d, adhesion: bool = False) -> tuple[str, int | None, str | None]:
    n = texte(d, "nature")
    if n not in NATURES:
        raise ErreurMetier("À remplir : nature du frais.")
    if adhesion and n != "Montant":
        raise ErreurMetier("Un frais d'adhésion est un Montant : il n'a pas de montant d'opération sur lequel calculer un taux.")
    v, c = d.get("valeur"), texte(d, "compte")
    if v is not None and (not isinstance(v, int) or isinstance(v, bool) or v < 0):
        raise ErreurMetier("Valeur invalide.")
    if n == "Taux" and v is not None and v > 10000:
        raise ErreurMetier("Taux invalide : 100 % au plus.")
    if c and not c.isdigit():
        raise ErreurMetier("Compte : chiffres seulement.")
    if c and not une("select 1 from compte where numero = %s and (institution_id is null or institution_id = %s)", (c, u["institution_id"])):
        raise ErreurMetier(f"Compte : le compte {c} n'est pas dans le plan de comptes.")   # règle T16
    return NATURES[n], v, c or None


# Registre S16-11 : la part sociale est la ligne des frais d'adhésion portée par un compte 103 (PCCI : 1030 personnes physiques,
# 1031 groupements solidaires, 1032 personnes morales) ; une seule valeur nominale, celle des statuts (loi 002/2002, art. 20)
COMPTES_PART = {"physique": ("1030",), "morale": ("1032",), "groupe": ("1031", "1032")}
NOMS_MEMBRE = {v: k for k, v in TYPES_MEMBRE.items()}


def controler_part(u, types: list[str], v, c, sauf: int | None = None):
    """Contrôles de la ligne de part (registre S16-11), pour les types de membre donnés (physique, morale, groupe)"""
    if not c or not c.startswith("103"):
        return
    if not v:
        raise ErreurMetier("Part sociale : la valeur de la part, celle des statuts, est obligatoire (loi 002/2002, art. 20).")
    for t in types:
        if c not in COMPTES_PART[t]:
            raise ErreurMetier(f"Part sociale « {NOMS_MEMBRE[t]} » : compte {' ou '.join(COMPTES_PART[t])} (PCCI, compte 103), pas {c}.")
        if valeur("""select 1 from parametrage_frais_adhesion p join frais f on f.id = p.frais_id where f.institution_id = %s and p.type_membre = %s
                     and p.compte like '103%%' and p.id <> coalesce(%s, 0)""", (u["institution_id"], t, sauf)):
            raise ErreurMetier(f"Une part sociale est déjà paramétrée pour « {NOMS_MEMBRE[t]} ».")
    autre = valeur("""select p.valeur from parametrage_frais_adhesion p join frais f on f.id = p.frais_id where f.institution_id = %s
                      and p.compte like '103%%' and p.id <> coalesce(%s, 0) limit 1""", (u["institution_id"], sauf))
    if autre is not None and autre != v:
        raise ErreurMetier("La part sociale a une seule valeur nominale, celle des statuts (loi 002/2002, art. 20) : "
                           "la même pour tous les types de membre.")


def parametrer_operation(u, d) -> list[dict]:
    """« Paramétrage frais » : Opération*, Frais*, Nature du frais*, Valeur, Compte, Sous type client cochés (p. 26)."""
    droit(u)
    f = frais_de(u, d.get("fraisId"))
    if f["type_operation"] == "ADHESION":
        raise ErreurMetier("Un frais d'adhésion se paramètre dans l'onglet Paramétrage frais Adhésion.")
    nat, v, c = controler_valeurs(u, d)
    sous = d.get("sousTypes") or []
    if not sous:
        raise ErreurMetier("Cocher au moins un sous type client.")
    ids = []
    for s in sous:
        sid = valeur("select id from liste_reference where institution_id = %s and liste = 'sous_type_client' and libelle = %s and actif", (u["institution_id"], s))
        if not sid:
            raise ErreurMetier("Sous type client inconnu.")
        if valeur("select 1 from parametrage_frais where frais_id = %s and sous_type_id = %s", (f["id"], sid)):
            raise ErreurMetier(f"Déjà paramétré pour « {s} » : passer par Modif Paramétrage frais.")
        ids.append(valeur("insert into parametrage_frais (frais_id, sous_type_id, nature, valeur, compte) values (%s, %s, %s, %s, %s) returning id",
                          (f["id"], sid, nat, v, c)))
    return ids


def parametrer_adhesion(u, d) -> list[int]:
    """« Paramétrage frais Adhésion » : Frais*, Nature du frais*, Type client cochés (p. 26)."""
    droit(u)
    f = frais_de(u, d.get("fraisId"))
    if f["type_operation"] != "ADHESION":
        raise ErreurMetier("Ce frais n'est pas un frais d'adhésion.")
    nat, v, c = controler_valeurs(u, d, adhesion=True)
    types = d.get("typesMembre") or []
    if not types:
        raise ErreurMetier("Cocher au moins un type client.")
    if any(t not in TYPES_MEMBRE for t in types):
        raise ErreurMetier("Type client inconnu.")
    controler_part(u, [TYPES_MEMBRE[t] for t in types], v, c)
    ids = []
    for t in types:
        if t not in TYPES_MEMBRE:
            raise ErreurMetier("Type client inconnu.")
        if valeur("select 1 from parametrage_frais_adhesion where frais_id = %s and type_membre = %s", (f["id"], TYPES_MEMBRE[t])):
            raise ErreurMetier(f"Déjà paramétré pour « {t} » : passer par Modif Paramétrage frais Adhésion.")
        ids.append(valeur("""insert into parametrage_frais_adhesion (frais_id, type_membre, nature, valeur, compte) values (%s, %s, %s, %s, %s) returning id""",
                          (f["id"], TYPES_MEMBRE[t], nat, v, c)))
    return ids


def ligne_de(u, table: str, pid: int):
    r = une(f"select p.* from {table} p join frais f on f.id = p.frais_id where p.id = %s and f.institution_id = %s for update", (pid, u["institution_id"]))
    if not r:
        raise ErreurMetier("Paramétrage introuvable.")
    return r


def modifier_parametrage(u, table: str, pid: int, d):
    """« Modif Paramétrage frais » et « … Adhésion » : Action > Modifier infos (p. 26 et 27)."""
    droit(u)
    r = ligne_de(u, table, pid)
    nat, v, c = controler_valeurs(u, d, adhesion=table == "parametrage_frais_adhesion")
    if table == "parametrage_frais_adhesion":
        controler_part(u, [r["type_membre"]], v, c, sauf=pid)
    executer(f"update {table} set nature = %s, valeur = %s, compte = %s where id = %s", (nat, v, c, pid))


def modifier_categorie(u, pid: int, d):
    """« Modif Paramétrage frais Adhésion », Action > Modifier Catégorie (capture p. 26) : change le Type membre de la ligne (registre S16-6)"""
    droit(u)
    r = ligne_de(u, "parametrage_frais_adhesion", pid)
    t = texte(d, "typeMembre")
    if t not in TYPES_MEMBRE:
        raise ErreurMetier("À remplir : type membre.")
    if valeur("select 1 from parametrage_frais_adhesion where frais_id = %s and type_membre = %s and id <> %s", (r["frais_id"], TYPES_MEMBRE[t], pid)):
        raise ErreurMetier(f"Ce frais est déjà paramétré pour « {t} ».")
    controler_part(u, [TYPES_MEMBRE[t]], r["valeur"], r["compte"], sauf=pid)
    executer("update parametrage_frais_adhesion set type_membre = %s where id = %s", (TYPES_MEMBRE[t], pid))


def supprimer_parametrage(u, table: str, pid: int):
    droit(u)
    ligne_de(u, table, pid)
    executer(f"delete from {table} where id = %s", (pid,))


def frais_lies(u, tid: int) -> list[dict]:
    """« Liste des Frais liés » (p. 52 et 53) : frais d'adhésion paramétrés pour le type du client, ou le montant modifié pour ce client (S41)."""
    exiger(u)
    from .services import compte_parts
    t = une("select * from tiers where id = %s", (tid,))
    l = lignes("""select f.id as "fraisId", f.libelle, p.compte, case when p.compte like '103%%' then p.valeur else coalesce(fc.montant, p.valeur) end as montant,
                            coalesce(p.compte like '103%%', false) as part
                     from parametrage_frais_adhesion p join frais f on f.id = p.frais_id
                     join tiers t on t.type = p.type_membre and t.institution_id = f.institution_id
                     left join frais_client fc on fc.tiers_id = t.id and fc.frais_id = f.id
                     where t.id = %s order by p.id""", (tid,))
    # La ligne de part prend le compte 103 de la nature juridique du membre (registre S16-13)
    return [{**r, "compte": compte_parts(t)} if r["part"] else r for r in l] if t else l


def modifier_frais_client(u, tid: int, d) -> list[dict]:
    """S41 : Client > Visa > Modifier frais (p. 53). Modifier le montant des frais dans la Liste des frais liés."""
    exiger(u, "chef_agence")                 # profil habilité : à confirmer
    t = une("select id, statut from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if t["statut"] != "actif":
        raise ErreurMetier("Client non visé : viser d'abord le client.")
    lies = {r["fraisId"] for r in frais_lies(u, tid) if not r["part"]}
    if any((l or {}).get("fraisId") in {r["fraisId"] for r in frais_lies(u, tid) if r["part"]} for l in (d.get("frais") or [] if isinstance(d, dict) else [])):
        raise ErreurMetier("La part sociale garde la valeur des statuts : elle ne se modifie pas pour un client (loi 002/2002, art. 20).")
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
