"""S65, S66 : Épargne > Dépôt à terme (manuel Microfina++, p. 75 et 76) : mise en place, validation, contrat.
Mêmes règles que web/src/donnees/api.ts (depotsTerme). PCCI, compte 340 « Dépôts à terme ». Registre S65-1 à S65-8."""
import calendar
import re
import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import compte_du_produit, controler_statut_actif, exiger, journee_courante, nouvelle_piece, poster, solde_contrat, titulaire


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def taux(d, k, nom, maxi):
    t = texte(d, k).replace(",", ".") or "0"
    if not re.match(r"^\d+(\.\d{1,4})?$", t) or Decimal(t) >= maxi:
        raise ErreurMetier(f"{nom} : un pourcentage, par exemple 7,5.")
    return Decimal(t)


def ajouter_mois(d: date, n: int) -> date:
    m = d.month - 1 + n
    a, m = d.year + m // 12, m % 12 + 1
    return date(a, m, min(d.day, calendar.monthrange(a, m)[1]))


def interet(montant: int, t: Decimal, mois: int) -> int:
    """Intérêt simple sur la durée : montant × taux annuel × mois / 12, arrondi à l'unité (registre S65-3)"""
    return int((Decimal(montant) * t / 100 * mois / 12).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def compte_interet(mois: int) -> str:
    """PCCI, compte 612 : 6124 six mois au plus, 6122 neuf mois au plus, 6121 plus de 12 mois ; 10 à 12 mois en 6122, court terme comme les crédits d'un an au plus (PCCI, comptes 30 à 32 ; registre S65-4)"""
    return "6124" if mois <= 6 else "6122" if mois <= 12 else "6121"


def produits(u) -> list[dict]:
    """Liste Produit : les produits d'épargne actifs rangés dans l'onglet DAT (S28)"""
    exiger(u)
    return lignes("""select id, code, libelle, trim(devise) as devise, coalesce(compte_lie, '') as "compteLie" from produit_epargne
                     where institution_id = %s and actif and not supprime and categorie_compte = 'DAT' order by code""", (u["institution_id"],))


def disponible(compte_id: int, devise: str) -> int:
    bloque = int(valeur("select coalesce(sum(montant), 0) from blocage where compte_id = %s and (fin is null or fin > now())", (compte_id,)))
    attente = int(valeur("select coalesce(sum(montant), 0) from depot_terme where compte_emetteur_id = %s and statut = 'saisie'", (compte_id,)))
    return solde_contrat(f"depot:{compte_id}", devise, "C") - bloque - attente


def mettre_en_place(u, d) -> dict:
    """Bouton Enregistrer de « Mise en place DAT » : le DAT est saisi, en attente de validation (S66)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    try:
        cle = str(uuid.UUID(texte(d, "cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = une("select * from depot_terme where cle_idempotence = %s", (cle,))
    if prec:
        return vue(prec)
    i = u["institution_id"]
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    pid = d.get("produitId")
    p = une("select * from produit_epargne where id = %s and institution_id = %s and actif and not supprime and categorie_compte = 'DAT'", (pid, i)) \
        if isinstance(pid, int) and not isinstance(pid, bool) else None
    if not p:
        raise ErreurMetier("À remplir : Produit (un produit de l'onglet DAT, Paramétrage des produits épargne).")
    tid = d.get("tiersId")
    t = une("select * from tiers where id = %s and institution_id = %s", (tid, i)) if isinstance(tid, int) and not isinstance(tid, bool) else None
    if not t:
        raise ErreurMetier("À remplir : N° du Client.")
    controler_statut_actif(t["statut"])
    dev = p["devise"].strip()

    def compte(cle_, nom):
        cid = d.get(cle_)
        c = une("""select c.*, trim(c.devise) as dv from compte_depot c where c.id = %s and c.tiers_id = %s and c.statut = 'ouvert'""", (cid, t["id"])) \
            if isinstance(cid, int) and not isinstance(cid, bool) else None
        if not c:
            raise ErreurMetier(f"À remplir : {nom}.")
        return c
    em = compte("compteEmetteurId", "N° Compte (compte émetteur)")
    dat = compte("compteDatId", "Compte DAT")
    if dat["produit_id"] != p["id"]:
        raise ErreurMetier("Compte DAT : un compte du produit choisi (Épargne > Nouveau compte).")
    if em["produit_id"] == p["id"] or em["id"] == dat["id"]:
        raise ErreurMetier("N° Compte : le compte émetteur est un autre compte que le compte DAT.")
    if em["dv"] != dev:
        raise ErreurMetier(f"N° Compte : le compte émetteur doit être en {dev}, comme le produit.")
    montant = d.get("montant")
    if not isinstance(montant, int) or isinstance(montant, bool) or montant <= 0:
        raise ErreurMetier("Montant : un montant supérieur à zéro.")
    mois = d.get("duree")
    if not isinstance(mois, int) or isinstance(mois, bool) or mois < 1:
        raise ErreurMetier("Durée (Mois) : au moins 1 mois.")      # aucune durée maximale dans les textes (registre S65-8)
    ti, tp = taux(d, "tauxInteret", "Taux intérêt", 100), taux(d, "tauxPenalite", "Taux pénalité", 101)
    depot = texte(d, "dateDepot") or j["date"]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", depot):
        raise ErreurMetier("À remplir : Date de dépôt.")
    if depot > j["date"]:
        raise ErreurMetier("La date de dépôt ne peut pas dépasser la journée ouverte.")
    if montant > disponible(em["id"], dev):
        raise ErreurMetier("Solde disponible insuffisant sur le compte émetteur.")
    try:
        echeance = ajouter_mois(date.fromisoformat(depot), mois)
    except (ValueError, OverflowError):
        raise ErreurMetier("Durée (Mois) : l'échéance tombe hors du calendrier.")
    certificat = int(valeur("select coalesce(max(certificat), 0) + 1 from depot_terme where institution_id = %s", (i,)))
    did = valeur("""insert into depot_terme (institution_id, agence_id, certificat, produit_id, tiers_id, compte_emetteur_id, compte_dat_id, montant, devise, duree_mois,
                                             taux_interet, taux_penalite, montant_interet, a_echeance, date_depot, date_echeance, observation, reconduction,
                                             cle_idempotence, saisi_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (i, t["agence_id"], certificat, p["id"], t["id"], em["id"], dat["id"], montant, dev, mois, ti, tp, interet(montant, ti, mois),
                  bool(d.get("aEcheance")), depot, echeance, texte(d, "observation") or None, bool(d.get("reconduction")), cle, u["id"]))
    return vue(une("select * from depot_terme where id = %s", (did,)))


def vue(x: dict) -> dict:
    c = lambda cid: valeur("select numero from compte_depot where id = %s", (cid,))
    return {"id": x["id"], "certificat": x["certificat"], "produitId": x["produit_id"], "produit": valeur("select libelle from produit_epargne where id = %s", (x["produit_id"],)),
            "tiersId": x["tiers_id"], "membre": valeur("select numero from tiers where id = %s", (x["tiers_id"],)), "client": titulaire(x["tiers_id"]),
            "compteEmetteur": c(x["compte_emetteur_id"]), "compteDat": c(x["compte_dat_id"]), "montant": x["montant"], "devise": x["devise"].strip(),
            "duree": x["duree_mois"], "tauxInteret": str(x["taux_interet"].normalize()).replace(".", ","), "tauxPenalite": str(x["taux_penalite"].normalize()).replace(".", ","),
            "montantInteret": x["montant_interet"], "montantAVerser": x["montant"] + x["montant_interet"], "aEcheance": x["a_echeance"],
            "dateDepot": x["date_depot"].isoformat(), "dateEcheance": x["date_echeance"].isoformat(), "observation": x["observation"] or "",
            "reconduction": x["reconduction"], "statut": x["statut"], "compteInteret": compte_interet(x["duree_mois"]),
            "piece": valeur("select p.numero from ecriture e join piece p on p.id = e.piece_id where e.id = %s", (x["ecriture_id"],)) if x["ecriture_id"] else ""}


def liste(u, statut: str = "") -> list[dict]:
    """Liste DAT (mise en place) et Liste DAT à valider (S66)"""
    exiger(u)
    if statut and statut not in ("saisie", "valide", "rompu", "echu"):
        raise ErreurMetier("Statut inconnu.")
    return [vue(x) for x in lignes("select * from depot_terme where institution_id = %s and (%s = '' or statut = %s) order by certificat",
                                     (u["institution_id"], statut, statut))]


def valider(u, did: int) -> dict:
    """Bouton Valider (S66, p. 76) : par une autre personne que celle qui a saisi ; l'argent passe du compte émetteur au compte DAT (PCCI 340)"""
    exiger(u)
    x = une("select * from depot_terme where id = %s and institution_id = %s for update", (did, u["institution_id"]))
    if not x or x["statut"] != "saisie":
        raise ErreurMetier("Ce DAT n'est pas en attente de validation.")
    if x["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a mis le DAT en place.")
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    p = une("select * from produit_epargne where id = %s", (x["produit_id"],))
    compte_dat = p["compte_lie"] or ""
    if not compte_dat.startswith("34"):
        raise ErreurMetier("Produit DAT : compte lié 340 « Dépôts à terme » à paramétrer (Paramétrage des produits épargne, onglet DAT).")   # registre S65-5
    em = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s for update of c", (x["compte_emetteur_id"],))
    executer("update depot_terme set statut = 'valide' where id = %s", (did,))      # sort du disponible « en attente » avant le contrôle
    if x["montant"] > disponible(em["id"], x["devise"].strip()):
        raise ErreurMetier("Solde disponible insuffisant sur le compte émetteur.")
    dev = x["devise"].strip()
    eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Constitution DAT n° {x['certificat']}", piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])),
                 evenement="dat_constitution", cle=str(uuid.uuid4()), valide_par=u["id"],
                 lignes_ecr=[{"compte": compte_du_produit(em), "contrat": f"depot:{em['id']}", "sens": "D", "devise": dev, "montant": x["montant"]},
                             {"compte": compte_dat, "contrat": f"depot:{x['compte_dat_id']}", "sens": "C", "devise": dev, "montant": x["montant"]}])
    executer("update depot_terme set valide_par = %s, valide_le = now(), ecriture_id = %s where id = %s", (u["id"], eid, did))
    return vue(une("select * from depot_terme where id = %s", (did,)))


def contrat(u, did: int) -> dict:
    """Bouton Contrat (S66) : les données du contrat de DAT, document de l'institution cliente (registre S65-7)"""
    from .releves import client, entete
    exiger(u)
    x = une("select * from depot_terme where id = %s and institution_id = %s", (did, u["institution_id"]))
    if not x:
        raise ErreurMetier("DAT introuvable.")
    return {"entete": entete(u["institution_id"]), "client": client(x["tiers_id"]), "dat": vue(x)}
