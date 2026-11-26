"""S65, S66, S67 : Épargne > Dépôt à terme (manuel Microfina++, p. 75 à 77) : mise en place, validation, contrat, rupture.
Mêmes règles que web/src/donnees/api.ts (depotsTerme). PCCI, compte 340 « Dépôts à terme ». Registre S65-1 à S65-8, S67-1 à S67-6."""
import calendar
import re
import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .cloison import clause
from .bd import ErreurMetier, executer, lignes, une, valeur, verrou_numero
from .services import compte_du_produit, controler_collecte_epargne, controler_statut_actif, exiger, journee_courante, nouvelle_piece, poster, solde_contrat, titulaire


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def taux(d, k, nom, maxi):
    t = texte(d, k).replace(",", ".") or "0"
    if not re.match(r"^\d+(\.\d{1,4})?$", t) or Decimal(t) >= maxi:
        raise ErreurMetier(f"{nom} : un pourcentage, par exemple 7,5.")
    return Decimal(t)


def pct(t: Decimal) -> str:
    """7.5000 → « 7,5 » ; 20.00 → « 20 » (sans notation 2E+1)"""
    return format(t.normalize(), "f").replace(".", ",")


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
    rows = lignes("""select id, code, libelle, trim(devise) as devise, coalesce(compte_lie, '') as "compteLie", taux_interet, taux_negociable as "tauxNegociable"
                     from produit_epargne where institution_id = %s and actif and not supprime and categorie_compte = 'DAT' order by code""", (u["institution_id"],))
    return [{**{k: v for k, v in r.items() if k != "taux_interet"}, "tauxInteret": pct(r["taux_interet"] or Decimal(0))} for r in rows]   # plan d'allègement, point 5.2


def disponible(compte_id: int, devise: str) -> int:
    from .services import montant_bloque, sorties_en_attente
    solde = solde_contrat(f"depot:{compte_id}", devise, "C")
    return solde - montant_bloque(compte_id, solde) - sorties_en_attente(compte_id)


def mettre_en_place(u, d) -> dict:
    """Bouton Enregistrer de « Mise en place DAT » : le DAT est saisi, en attente de validation (S66)"""
    exiger(u)
    controler_collecte_epargne(u, "DAT")               # loi 11/020, art. 12 : pas de DAT dans une entreprise de micro-crédit
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
    from .gel import controler_gel
    controler_gel(t["id"], u)                          # écart E10
    dev = p["devise"].strip()

    def compte(cle_, nom):
        cid = d.get(cle_)
        c = une("""select c.*, trim(c.devise) as dv from compte_depot c where c.id = %s and c.tiers_id = %s and c.statut = 'ouvert'""", (cid, t["id"])) \
            if isinstance(cid, int) and not isinstance(cid, bool) else None
        if not c:
            raise ErreurMetier(f"À remplir : {nom}.")
        return c
    em = compte("compteEmetteurId", "N° Compte (compte émetteur)")
    if d.get("compteDatId") is None:
        # Plan d'allègement, point 5.2 : le compte DAT du client sur ce produit se prend d'office, ou s'ouvre dans le même geste (mêmes contrôles qu'en S63)
        cid = valeur("select id from compte_depot where tiers_id = %s and produit_id = %s and statut = 'ouvert' order by id limit 1", (t["id"], p["id"]))
        if cid is None:
            from .comptes_epargne import ouvrir
            cid = ouvrir(u, {"cle": str(uuid.uuid5(uuid.UUID(cle), "compte-dat")), "tiersId": t["id"], "produitId": p["id"]})["id"]
        d = {**d, "compteDatId": cid}
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
    tp = taux(d, "tauxPenalite", "Taux pénalité", 101)
    taux_produit = p["taux_interet"] or Decimal(0)    # le taux vient du produit (plan d'allègement, point 5.2)
    ti = taux(d, "tauxInteret", "Taux intérêt", 100) if texte(d, "tauxInteret") else taux_produit
    if not p["taux_negociable"] and ti != taux_produit:   # registre T142 : négociable seulement si le produit le permet
        raise ErreurMetier(f"Taux intérêt : {pct(taux_produit)} %, le taux du produit (taux non négociable).")
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
    verrou_numero("depot_terme", i)
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
            "duree": x["duree_mois"], "tauxInteret": pct(x["taux_interet"]), "tauxPenalite": pct(x["taux_penalite"]),
            "montantInteret": x["montant_interet"], "montantAVerser": x["montant"] + x["montant_interet"], "aEcheance": x["a_echeance"],
            "dateDepot": x["date_depot"].isoformat(), "dateEcheance": x["date_echeance"].isoformat(), "observation": x["observation"] or "",
            "reconduction": x["reconduction"], "statut": x["statut"], "compteInteret": compte_interet(x["duree_mois"]),
            "piece": valeur("select p.numero from ecriture e join piece p on p.id = e.piece_id where e.id = %s", (x["ecriture_id"],)) if x["ecriture_id"] else "",
            "rupture": None if not x.get("date_rupture") else {
                "dateRupture": x["date_rupture"].isoformat(), "dateDemande": x["date_demande"].isoformat(), "jours": x["jours_courus"], "interet": x["interet_rupture"],
                "penalite": x["penalite"], "tauxIrc": pct(x["taux_irc"]), "irc": x["irc"], "montantAVerser": x["montant_verse"],
                "piece": valeur("select p.numero from ecriture e join piece p on p.id = e.piece_id where e.id = %s", (x["ecriture_rupture_id"],))}}


def liste(u, statut: str = "") -> list[dict]:
    """Liste DAT (mise en place) et Liste DAT à valider (S66)"""
    exiger(u)
    if statut and statut not in ("saisie", "valide", "rompu", "echu", "annule", "reconduit"):
        raise ErreurMetier("Statut inconnu.")
    ag, pa = clause(u, "(select t.agence_id from tiers t where t.id = depot_terme.tiers_id)")   # ses membres seulement (registre T213)
    return [vue(x) for x in lignes(f"select * from depot_terme where institution_id = %s and (%s = '' or statut = %s){ag} order by certificat",
                                     (u["institution_id"], statut, statut, *pa))]


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
    eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Constitution DAT n° {x['certificat']}" + (f", valeur {x['date_depot'].strftime('%d/%m/%Y')}" if x["date_depot"].isoformat() != j["date"] else ""),   # PCCI § 3.4
                 piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])),
                 evenement="dat_constitution", cle=str(uuid.uuid4()), valide_par=u["id"],
                 lignes_ecr=[{"compte": compte_du_produit(em), "contrat": f"depot:{em['id']}", "sens": "D", "devise": dev, "montant": x["montant"]},
                             {"compte": compte_dat, "contrat": f"depot:{x['compte_dat_id']}", "sens": "C", "devise": dev, "montant": x["montant"]}])
    executer("update depot_terme set valide_par = %s, valide_le = now(), ecriture_id = %s where id = %s", (u["id"], eid, did))
    return vue(une("select * from depot_terme where id = %s", (did,)))


def annuler(u, did: int) -> dict:
    """Bouton Annuler de « Mise en place DAT » (capture p. 75) : un DAT saisi et pas encore validé s'annule ; aucune écriture n'existe encore (registre S65-6)"""
    exiger(u)
    x = une("select * from depot_terme where id = %s and institution_id = %s for update", (did, u["institution_id"]))
    if not x or x["statut"] != "saisie":
        raise ErreurMetier("Seul un DAT en attente de validation s'annule ; un DAT validé se rompt (Rupture de DAT).")
    if x["saisi_par"] != u["id"]:                      # plan d'allègement, point 5.1 : annulé par son auteur
        raise ErreurMetier("Seule la personne qui a mis ce DAT en place peut l'annuler.")
    executer("update depot_terme set statut = 'annule' where id = %s", (did,))
    return vue(une("select * from depot_terme where id = %s", (did,)))


def contrat(u, did: int) -> dict:
    """Bouton Contrat (S66) : les données du contrat de DAT, document de l'institution cliente (registre S65-7)"""
    from .releves import client, entete
    exiger(u)
    x = une("select * from depot_terme where id = %s and institution_id = %s", (did, u["institution_id"]))
    if not x:
        raise ErreurMetier("DAT introuvable.")
    return {"entete": entete(u["institution_id"]), "client": client(x["tiers_id"]), "dat": vue(x)}


TAUX_IRC_PHYSIQUE = Decimal("20")   # loi 23/053, art. 120 : retenue à la source de 20 % (registre S67-3)
COMPTE_IRC = "433"                   # PCCI 433 « Impôts et taxes collectés » : taxes retenues à la source sur les comptes des clients (compte 43)
COMPTE_PENALITE = "7791"             # PCCI 7791 « Dédits (…) pénalités (…) » : produits exceptionnels (compte 77)
COMPTE_COURUS = "349"                # PCCI 349 « Dettes rattachées (intérêts sur dépôts) » : intérêts courus passés en fin de période (S128)


def lignes_interet(x: dict, interet_: int, dev: str) -> list[dict]:
    """Intérêt porté en charge à l'échéance ou à la rupture. La part déjà passée en intérêts courus (Autres > Calculs, PCCI § 6.4) sort du 349 ;
    le reste va au 612 de la durée ; un trop-passé est repris au crédit du 612. Registre S128-6."""
    courus = x.get("interets_courus") or 0
    l = []
    if courus:
        l.append({"compte": COMPTE_COURUS, "sens": "D", "devise": dev, "montant": courus})
    if interet_ > courus:
        l.append({"compte": compte_interet(x["duree_mois"]), "sens": "D", "devise": dev, "montant": interet_ - courus})
    elif courus > interet_:
        l.append({"compte": compte_interet(x["duree_mois"]), "sens": "C", "devise": dev, "montant": courus - interet_})
    return l


def taux_irc(tiers_id: int) -> Decimal:
    """Personne physique, ou groupe sans personnalité juridique (ses membres sont des personnes physiques) : 20 % ; personne morale, association, ONG : 0
    (loi 23/053, art. 14 et 120 ; registre S67-3, S67-7)"""
    from .services import TYPES_GROUPE
    t = une("select type, type_client from tiers where id = %s", (tiers_id,))
    physique = t["type"] == "physique" or (t["type"] == "groupe" and TYPES_GROUPE.get(t["type_client"]) is None)
    return TAUX_IRC_PHYSIQUE if physique else Decimal("0")


def calcul_rupture(x: dict, date_r: date) -> dict:
    """Rupture avant l'échéance (S67) : intérêt couru au prorata des jours (base 365), pénalité sur le montant du DAT,
    retenue de 20 % sur l'intérêt brut des personnes physiques (loi 23/053, art. 78, 81 et 120). Registre S67-1 à S67-3."""
    if date_r < x["date_depot"]:
        raise ErreurMetier("Date rupture : au plus tôt la date de dépôt du DAT.")
    if date_r >= x["date_echeance"]:
        raise ErreurMetier("Date rupture : le DAT est échu à cette date ; ce n'est plus une rupture.")
    jours = (date_r - x["date_depot"]).days
    interet = int((Decimal(x["montant"]) * x["taux_interet"] / 100 * jours / 365).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    penalite = int((Decimal(x["montant"]) * x["taux_penalite"] / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    t_irc = taux_irc(x["tiers_id"])
    irc = int((Decimal(interet) * t_irc / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    verser = x["montant"] + interet - penalite - irc
    if verser < 0:
        raise ErreurMetier("La pénalité dépasse le montant du DAT et l'intérêt couru.")
    return {"jours": jours, "interet": interet, "penalite": penalite, "tauxIrc": pct(t_irc), "irc": irc, "montantAVerser": verser}


def _date(d, k, nom, defaut: str) -> date:
    v = texte(d, k) or defaut
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        raise ErreurMetier(f"À remplir : {nom}.")
    return date.fromisoformat(v)


def apercu_rupture(u, did: int, date_r: str) -> dict:
    """Infos de la fenêtre Rupture DAT (p. 77) après le choix du DAT : intérêt, pénalité, IRC, montant à verser"""
    exiger(u)
    x = une("select * from depot_terme where id = %s and institution_id = %s", (did, u["institution_id"]))
    if not x or x["statut"] != "valide":
        raise ErreurMetier("Ce DAT n'est pas en cours (validé et pas encore rompu).")
    j = journee_courante(u)
    return {"dat": vue(x), **calcul_rupture(x, _date({"d": date_r}, "d", "Date rupture", j["date"] if j else ""))}


def rompre(u, did: int, d: dict) -> dict:
    """Bouton Rompre le DAT (S67, p. 76) : le compte DAT est soldé, le montant à verser revient au compte émetteur ;
    intérêt couru en charge (612), retenue au 433, pénalité au 7791. Registre S67-1 à S67-6."""
    exiger(u)
    x = une("select * from depot_terme where id = %s and institution_id = %s for update", (did, u["institution_id"]))
    if not x or x["statut"] != "valide":
        raise ErreurMetier("Ce DAT n'est pas en cours (validé et pas encore rompu).")
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    date_r = _date(d, "dateRupture", "Date rupture", j["date"])
    if date_r > date.fromisoformat(j["date"]):
        raise ErreurMetier("La date de rupture ne peut pas dépasser la journée ouverte.")
    date_d = _date(d, "dateDemande", "Date demande", date_r.isoformat())
    if date_d < x["date_depot"] or date_d > date_r:
        raise ErreurMetier("Date demande : entre la date de dépôt et la date de rupture.")
    r = calcul_rupture(x, date_r)
    dev = x["devise"].strip()
    p = une("select * from produit_epargne where id = %s", (x["produit_id"],))
    em = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s", (x["compte_emetteur_id"],))
    l = [{"compte": p["compte_lie"], "contrat": f"depot:{x['compte_dat_id']}", "sens": "D", "devise": dev, "montant": x["montant"]}]
    l += lignes_interet(x, r["interet"], dev)
    if r["montantAVerser"]:
        l.append({"compte": compte_du_produit(em), "contrat": f"depot:{em['id']}", "sens": "C", "devise": dev, "montant": r["montantAVerser"]})
    if r["irc"]:
        l.append({"compte": COMPTE_IRC, "sens": "C", "devise": dev, "montant": r["irc"]})
    if r["penalite"]:
        l.append({"compte": COMPTE_PENALITE, "sens": "C", "devise": dev, "montant": r["penalite"]})
    eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Rupture DAT n° {x['certificat']}", piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])),
                 evenement="dat_rupture", cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=l)
    executer("""update depot_terme set statut = 'rompu', date_rupture = %s, date_demande = %s, jours_courus = %s, interet_rupture = %s, penalite = %s,
                taux_irc = %s, irc = %s, montant_verse = %s, rompu_par = %s, rompu_le = now(), ecriture_rupture_id = %s, interets_courus = 0 where id = %s""",
             (date_r, date_d, r["jours"], r["interet"], r["penalite"], Decimal(r["tauxIrc"].replace(",", ".")), r["irc"], r["montantAVerser"], u["id"], eid, did))
    return vue(une("select * from depot_terme where id = %s", (did,)))


def traiter_echeances(u: dict, journee: dict) -> int:
    """S65, reconduction automatique (manuel p. 75 : « renouvellement automatique du contrat de DAT aux mêmes conditions »).
    À l'ouverture d'une journée (décision du porteur, 19/11/2026), chaque DAT validé dont l'échéance est atteinte :
    - l'intérêt du contrat passe en charge (612 de sa durée, registre S65-4), la retenue de 20 % des personnes physiques au 433 (registre S67-3),
      l'intérêt net au compte émetteur (décision du porteur, 19/11/2026) ;
    - sans reconduction, le compte DAT (340) est soldé vers le compte émetteur (PCCI, compte 34) : statut echu ;
    - avec reconduction, le capital reste au compte DAT et repart pour la même durée, au même taux, sous un nouveau certificat :
      l'ancien passe à reconduit, le nouveau est validé d'office (aucun argent ne bouge). Un DAT dont plusieurs échéances sont passées
      est reconduit autant de fois qu'il le faut.
    Un DAT dont le titulaire a ses avoirs gelés (écart E10) attend : il ne bloque pas l'ouverture. Rend le nombre de DAT traités."""
    from .gel import gel_actif
    jour = date.fromisoformat(str(journee["date"]))
    n, attente = 0, [0]          # attente : DAT gelés, laissés pour une prochaine ouverture
    while True:
        echus = lignes("""select * from depot_terme where institution_id = %s and agence_id = %s and statut = 'valide' and date_echeance <= %s
                          and not (id = any(%s)) order by date_echeance, id for update""", (u["institution_id"], u["agence_id"], jour, attente))
        if not echus:
            return n
        for x in echus:
            if gel_actif(x["tiers_id"]):
                attente.append(x["id"]); continue
            dev = x["devise"].strip()
            interet_ = x["montant_interet"]
            irc = int((Decimal(interet_) * taux_irc(x["tiers_id"]) / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
            p = une("select * from produit_epargne where id = %s", (x["produit_id"],))
            em = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s", (x["compte_emetteur_id"],))
            reconduit = bool(x["reconduction"])
            verse = interet_ - irc + (0 if reconduit else x["montant"])
            l = []
            if not reconduit:
                l.append({"compte": p["compte_lie"], "contrat": f"depot:{x['compte_dat_id']}", "sens": "D", "devise": dev, "montant": x["montant"]})
            l += lignes_interet(x, interet_, dev)
            if verse:
                l.append({"compte": compte_du_produit(em), "contrat": f"depot:{em['id']}", "sens": "C", "devise": dev, "montant": verse})
            if irc:
                l.append({"compte": COMPTE_IRC, "sens": "C", "devise": dev, "montant": irc})
            eid = None
            if l:
                eid = poster(u, journal="OD", journee_id=journee["id"], libelle=f"{'Reconduction' if reconduit else 'Échéance'} DAT n° {x['certificat']}",
                             piece=nouvelle_piece(u, "OD", jour), evenement="dat_echeance", cle=str(uuid.uuid5(uuid.NAMESPACE_URL, f"dat-echeance:{x['id']}")),
                             valide_par=u["id"], lignes_ecr=l)
            executer("""update depot_terme set statut = %s, echu_le = %s, interet_echeance = %s, taux_irc = %s, irc = %s, montant_verse = %s,
                        ecriture_echeance_id = %s, interets_courus = 0 where id = %s""",
                     ("reconduit" if reconduit else "echu", x["date_echeance"], interet_, taux_irc(x["tiers_id"]), irc, verse, eid, x["id"]))
            if reconduit:
                verrou_numero("depot_terme", x["institution_id"])
                certificat = int(valeur("select coalesce(max(certificat), 0) + 1 from depot_terme where institution_id = %s", (x["institution_id"],)))
                echeance = ajouter_mois(x["date_echeance"], x["duree_mois"])
                executer("""insert into depot_terme (institution_id, agence_id, certificat, produit_id, tiers_id, compte_emetteur_id, compte_dat_id, montant, devise,
                                                     duree_mois, taux_interet, taux_penalite, montant_interet, a_echeance, date_depot, date_echeance, observation,
                                                     reconduction, cle_idempotence, saisi_par, statut, valide_par, valide_le, reconduit_de)
                            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, %s, %s, 'valide', %s, now(), %s)""",
                         (x["institution_id"], x["agence_id"], certificat, x["produit_id"], x["tiers_id"], x["compte_emetteur_id"], x["compte_dat_id"], x["montant"],
                          x["devise"], x["duree_mois"], x["taux_interet"], x["taux_penalite"], interet(x["montant"], x["taux_interet"], x["duree_mois"]),
                          x["a_echeance"], x["date_echeance"], echeance, x["observation"], str(uuid.uuid4()), u["id"], u["id"], x["id"]))
            n += 1


def terme(mois: int) -> str:
    """Terme selon la durée, comme le classement des crédits du PCCI (comptes 30 à 32) : un an au plus court terme, 1 à 5 ans moyen terme, au-delà long terme (registre S68-3)"""
    return "Court terme" if mois <= 12 else "Moyen terme" if mois <= 60 else "Long terme"


def recherche(u, choix: str, du: str, au: str) -> list[dict]:
    """S68 : Recherche multicritères DAT (manuel p. 77). Mise en place : déposés dans la période ; Échus : échéance dans la période ;
    Encours : mis en place dans la période et encore en cours à la date de fin. Registre S68-1 à S68-4."""
    exiger(u)
    if choix not in ("mise_en_place", "echus", "encours"):
        raise ErreurMetier("Choix : Mise en place, Échus ou Encours.")
    for v, nom in ((du, "Du"), (au, "Au")):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v or ""):
            raise ErreurMetier(f"À remplir : {nom}.")
    if du > au:
        raise ErreurMetier("La date de début dépasse la date de fin.")
    filtre = {"mise_en_place": "date_depot between %(du)s and %(au)s and statut <> 'annule'",
              "echus": "date_echeance between %(du)s and %(au)s and statut in ('valide', 'echu', 'reconduit')",
              "encours": "date_depot between %(du)s and %(au)s and date_echeance > %(au)s and (statut = 'valide' or (statut = 'rompu' and date_rupture > %(au)s))"}[choix]
    rows = lignes(f"select * from depot_terme where institution_id = %(i)s and {filtre} order by certificat", {"i": u["institution_id"], "du": du, "au": au})
    return [{**vue(x), "agence": valeur("select nom from agence where id = %s", (x["agence_id"],)),
             "agent": valeur("select nom from utilisateur where id = %s", (x["saisi_par"],)), "terme": terme(x["duree_mois"])} for x in rows]
