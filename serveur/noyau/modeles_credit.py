"""S26 : Produits > Crédits > Modèle pour crédit (manuel Microfina++, p. 40). « Remplir les champs Libellé (obligatoire), Compte capital,
Compte interne, compte intérêt et [Enregistrer] ». Les degrés et les termes sont ceux de S21 (Instr. BCC 003 ; PCCI classe 3).
Comptes proposés : PCCI, comptes 30 à 32 et 390 (capital), 710 à 712 et 717 (intérêts) ; registre S26-2. Mêmes règles que web/src/donnees/api.ts (modeles)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .credit import CATALOGUE as CATALOGUE_CREDIT
from .moteur import compte_existe
from .services import exiger

FIXES = {c["page"]: c["fixe"] for c in CATALOGUE_CREDIT if "fixe" in c}
DEGRES, TERMES = FIXES["degres"], FIXES["termes"]          # rangs 1 à 7 et 1 à 3
SAINS_CAPITAL = {1: "329", 2: "319", 3: "309"}              # PCCI : autres crédits à court, moyen, long terme
SAINS_INTERET = {1: "7129", 2: "7119", 3: "7101"}           # PCCI : intérêts sur autres crédits à court, moyen, long terme
RETARD = {2: ("3900", "7170"), 3: ("3901", "7171"), 4: ("3902", "7172"), 5: ("3903", "7173"), 6: ("3904", "7174"), 7: ("3904", "7174")}   # PCCI 390 et 717


def defauts() -> list[dict]:
    """Comptes proposés pour un nouveau modèle, modifiables (T16)"""
    r = []
    for d in range(1, len(DEGRES) + 1):
        for t in range(1, len(TERMES) + 1):
            cap, inte = (SAINS_CAPITAL[t], SAINS_INTERET[t]) if d == 1 else RETARD[d]
            r.append({"degre": d, "terme": t, "compteCapital": cap, "compteInterne": "", "compteInteret": inte})
    return r


def lire(u) -> dict:
    exiger(u)
    return {"degres": [{"rang": n + 1, **x} for n, x in enumerate(DEGRES)], "termes": [{"rang": n + 1, **x} for n, x in enumerate(TERMES)],
            "defauts": defauts(), "modeles": lignes("select id, libelle from credit_modele where institution_id = %s and actif order by id", (u["institution_id"],))}


def lire_modele(u, mid: int) -> dict:
    exiger(u)
    m = une("select id, libelle from credit_modele where id = %s and institution_id = %s and actif", (mid, u["institution_id"]))
    if not m:
        raise ErreurMetier("Modèle introuvable.")
    m["comptes"] = lignes("""select degre, terme, compte_capital as "compteCapital", compte_interne as "compteInterne", compte_interet as "compteInteret"
                             from credit_modele_compte where modele_id = %s order by degre, terme""", (mid,))
    return m


def enregistrer(u, d, mid: int | None = None) -> dict:
    """Enregistrer (nouveau modèle) ou modifier le modèle choisi : libellé et comptes de chaque degré et terme (registre S26-1)"""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    libelle = d.get("libelle").strip() if isinstance(d.get("libelle"), str) else ""
    if not libelle:
        raise ErreurMetier("À remplir : Libellé.")
    if mid is not None and not une("select 1 from credit_modele where id = %s and institution_id = %s and actif for update", (mid, i)):
        raise ErreurMetier("Modèle introuvable.")
    comptes = {}
    for c in d.get("comptes") or []:
        if not isinstance(c, dict) or c.get("degre") not in range(1, len(DEGRES) + 1) or c.get("terme") not in range(1, len(TERMES) + 1):
            raise ErreurMetier("Degré ou terme inconnu.")
        comptes[(c["degre"], c["terme"])] = {k: (c.get(k) or "").strip() for k in ("compteCapital", "compteInterne", "compteInteret")}
    for dg in range(1, len(DEGRES) + 1):
        for t in range(1, len(TERMES) + 1):
            nom = f"{DEGRES[dg - 1]['libelle']} {DEGRES[dg - 1]['debut']}-{DEGRES[dg - 1]['fin']} jours, {TERMES[t - 1]['libelle']}"
            c = comptes.get((dg, t))
            if not c or not c["compteCapital"] or not c["compteInteret"]:
                raise ErreurMetier(f"{nom} : compte capital et compte intérêt à remplir.")
            for k, lib in (("compteCapital", "Compte capital"), ("compteInterne", "Compte interne"), ("compteInteret", "Compte interet")):
                if c[k] and not compte_existe(u, c[k]):
                    raise ErreurMetier(f"{nom} : {lib} {c[k]} n'existe pas au plan de comptes.")      # T16
    if une("select 1 from credit_modele where institution_id = %s and lower(libelle) = lower(%s) and actif and id is distinct from %s", (i, libelle, mid)):
        raise ErreurMetier("Ce Libellé existe déjà.")
    if mid is None:
        mid = valeur("insert into credit_modele (institution_id, libelle) values (%s, %s) returning id", (i, libelle))
    else:
        executer("update credit_modele set libelle = %s where id = %s", (libelle, mid))
        executer("delete from credit_modele_compte where modele_id = %s", (mid,))
    for (dg, t), c in comptes.items():
        executer("""insert into credit_modele_compte (modele_id, degre, terme, compte_capital, compte_interne, compte_interet) values (%s, %s, %s, %s, %s, %s)""",
                 (mid, dg, t, c["compteCapital"], c["compteInterne"], c["compteInteret"]))
    return {**lire(u), "modele": lire_modele(u, mid)}


def supprimer(u, mid: int) -> dict:
    """Supprimer (p. 12) : logique (T02) ; un modèle choisi par un produit crédit ne se supprime pas"""
    exiger(u, "chef_agence")
    if not une("select 1 from credit_modele where id = %s and institution_id = %s and actif for update", (mid, u["institution_id"])):
        raise ErreurMetier("Modèle introuvable.")
    if une("select 1 from produit_credit where modele_id = %s limit 1", (mid,)):
        raise ErreurMetier("Ce modèle est choisi par un produit crédit : le changer d'abord.")
    executer("update credit_modele set actif = false where id = %s", (mid,))
    return lire(u)
