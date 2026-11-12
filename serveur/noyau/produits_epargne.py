"""S27 : Paramétrage > Produit > Epargne > Gestion des produits épargnes (manuel Microfina++, p. 40). Champs, options Oui/Non et boutons de la
capture ; Devise ajoutée (registre S27-1). Montants en unités mineures, comme les opérations. Mêmes règles que web/src/donnees/api.ts (produitsEpargne)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

FAMILLES = ["EPARGNE", "BLOQUE", "TONTINE"]            # capture p. 40 (grille Famille)
# clé -> (colonne, libellé, sorte) ; sorte : texte, entier, montant, oui (case), ouiNon (boutons Oui/Non)
CHAMPS = {
    "numero": ("numero", "N° Produit", "entier"), "code": ("code", "Code produit", "texte"), "famille": ("famille", "Famille produit", "texte"),
    "libelle": ("libelle", "Libellé produit", "texte"), "devise": ("devise", "Devise", "texte"),
    "soldeMinimum": ("solde_minimum", "Solde minimum", "montant"), "retraitMaxJour": ("retrait_max_jour", "Max retrait/jour", "montant"),
    "nbMaxComptes": ("nb_max_comptes", "Max compte à créer", "entier"),
    "afficherAdhesion": ("afficher_adhesion", "Afficher à l'adhésion", "oui"), "actif": ("actif", "Actif", "oui"),
    "virementPrelevement": ("virement_prelevement", "Virement prélèvement", "oui"),
    "operer": ("operer_compte", "Opérer sur compte", "ouiNon"), "depotCheque": ("depot_cheque", "Dépôt de chèque", "ouiNon"),
    "caution": ("caution", "Caution", "ouiNon"), "nantissement": ("nantissement", "Nantissement", "ouiNon"),
    "tenueCompte": ("tenue_compte", "Tenu de compte", "ouiNon"), "calculerInteret": ("calcul_interet", "Calculer interêt", "ouiNon"),
    "soldeNegatif": ("solde_negatif", "Solde négatif", "ouiNon"), "repartitionGroupe": ("repartition_groupe", "Repartition groupe obligatoire", "ouiNon"),
}
OBLIGATOIRES = ["numero", "code", "famille", "libelle", "devise", "soldeMinimum", "nbMaxComptes", "operer", "depotCheque", "caution", "nantissement",
                "calculerInteret", "soldeNegatif", "repartitionGroupe"]


def vue(r) -> dict:
    return {"id": r["id"], **{k: r[col] for k, (col, _, _) in CHAMPS.items()}}


def lire(u) -> dict:
    exiger(u)
    rows = lignes("select * from produit_epargne where institution_id = %s and not supprime order by code", (u["institution_id"],))
    return {"familles": FAMILLES, "devises": [r["code"] for r in lignes("select code from devise order by code desc")], "produits": [vue(r) for r in rows]}


def valider(d) -> dict:
    v, manque = {}, []
    for k, (col, lib, sorte) in CHAMPS.items():
        x = d.get(k)
        if sorte == "texte":
            x = x.strip() if isinstance(x, str) and x.strip() else None
        elif sorte in ("oui", "ouiNon"):
            x = x if isinstance(x, bool) else (False if sorte == "oui" else None)
        else:
            if x in (None, ""):
                x = None
            elif not isinstance(x, int) or isinstance(x, bool) or x < 0:
                raise ErreurMetier(f"{lib} : nombre entier positif ou nul.")
        if x is None and k in OBLIGATOIRES:
            manque.append(lib)
        v[k] = x
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if v["famille"] not in FAMILLES:
        raise ErreurMetier("Famille produit inconnue.")
    if not valeur("select 1 from devise where code = %s", (v["devise"],)):
        raise ErreurMetier("Devise inconnue.")
    if not 1 <= v["numero"] <= 99:
        raise ErreurMetier("N° Produit : de 1 à 99 (il sert de suffixe au numéro de compte, S17).")
    if v["nbMaxComptes"] < 1:
        raise ErreurMetier("Max compte à créer : au moins 1.")
    return v


def enregistrer(u, d, pid: int | None = None) -> dict:
    """Enregistrer (nouveau produit) ou Modifier (produit choisi dans la grille), après confirmation (manuel p. 10 à 12)"""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    actuel = None
    if pid is not None:
        actuel = une("select * from produit_epargne where id = %s and institution_id = %s and not supprime for update", (pid, i))
        if not actuel:
            raise ErreurMetier("Produit introuvable.")
    v = valider(d)
    if une("select 1 from produit_epargne where institution_id = %s and not supprime and lower(code) = lower(%s) and id is distinct from %s", (i, v["code"], pid)):
        raise ErreurMetier("Ce Code produit existe déjà.")
    if une("select 1 from produit_epargne where institution_id = %s and not supprime and numero = %s and id is distinct from %s", (i, v["numero"], pid)):
        raise ErreurMetier("Ce N° Produit existe déjà.")
    if actuel and valeur("select 1 from compte_depot where produit_id = %s limit 1", (pid,)):       # registre S27-3
        for k in ("devise", "famille", "numero"):
            if v[k] != actuel[CHAMPS[k][0]]:
                raise ErreurMetier(f"Des comptes sont ouverts sur ce produit : {CHAMPS[k][1]} ne se change plus.")
    cols = [c for c, _, _ in CHAMPS.values()]
    vals = [v[k] for k in CHAMPS]
    if pid is None:
        executer(f"insert into produit_epargne (institution_id, {', '.join(cols)}) values (%s, {', '.join(['%s'] * len(cols))})", (i, *vals))
    else:
        executer(f"update produit_epargne set {', '.join(f'{c} = %s' for c in cols)} where id = %s", (*vals, pid))
    return lire(u)


def supprimer(u, pid: int) -> dict:
    """Supprimer (p. 12) : logique (T02). Un produit qui a des comptes ne se supprime pas : décocher Actif (registre S27-3)"""
    exiger(u, "chef_agence")
    if not une("select 1 from produit_epargne where id = %s and institution_id = %s and not supprime for update", (pid, u["institution_id"])):
        raise ErreurMetier("Produit introuvable.")
    if valeur("select 1 from compte_depot where produit_id = %s limit 1", (pid,)) or valeur("select 1 from tiers where produit_id = %s limit 1", (pid,)):
        raise ErreurMetier("Des comptes sont ouverts sur ce produit : décocher Actif pour ne plus le proposer.")
    executer("update produit_epargne set supprime = true where id = %s", (pid,))
    return lire(u)
