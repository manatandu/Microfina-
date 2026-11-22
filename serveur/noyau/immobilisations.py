"""Module Immobilisation (manuel Microfina++, chap. 7, p. 1 à 9 du chapitre). S137 : Création de bien ; S138 : Affectation, Transfert par bien,
par employé, Libération ; S139 : Amortissement (matériel ou lot de matériel), Inventaire, Sortie de biens ; S140 : rapports (biens, inventaires, tableau
d'amortissement simulé, suivi des mouvements, recherche multicritère).
Textes lus : PCCI, classe 2 (inventaire détaillé des immobilisations, fichier ou registre ; cession : comptes d'amortissements, 673 mise au rebut, 674
moins-value, 774 plus-value), compte 28 (amortissements), compte 681 (dotations aux amortissements des immobilisations corporelles).
Mêmes règles que web/src/donnees/api.ts (immobilisations). Registre S137-1 à S137-6, S138-1 à S138-3, S139-1 à S139-6, S140-1 à S140-3."""
import re
import uuid
from datetime import date, datetime

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante, nom_utilisateur, nouvelle_piece, poster

ETATS = ["Bon", "Moyen", "Mauvais", "Hors d'usage"]           # registre S139-3
SORTIES = ["Cession", "Mise au rebut"]                         # PCCI, classe 2 : cession, mise au rebut (673)
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def lire_date(d, k, nom, requis=True) -> date | None:
    v = d.get(k)
    if not v:
        if requis:
            raise ErreurMetier(f"À remplir : {nom}.")
        return None
    if not isinstance(v, str) or not DATE.match(v[:10]):
        raise ErreurMetier(f"{nom} : une date.")
    return date.fromisoformat(v[:10])


def opts(u, table, champ="libelle") -> list[dict]:
    return [{"id": r["id"], "libelle": f"{r['code']} {r[champ]}" if "code" in r else r[champ]}
            for r in lignes(f"select * from {table} where institution_id = %s and actif order by id", (u["institution_id"],))]


def contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"categories": opts(u, "immo_categorie"), "utilisations": opts(u, "immo_utilisation"), "localisations": opts(u, "immo_localisation"), "types": opts(u, "immo_type"),
            "familles": lignes("""select id, code, libelle, categorie_id as "categorieId", type_id as "typeId", systeme, duree_min as "dureeMin", duree_max as "dureeMax", periodicite,
                                         compte_acquisition as "compteAcquisition", compte_dotation as "compteDotation", compte_amortissement as "compteAmortissement",
                                         compte_produits as "compteProduits", compte_charge_vcn as "compteChargeVcn", immatriculation, chassis, carburant,
                                         titre_foncier as "titreFoncier", description from immo_famille where institution_id = %s and actif order by id""", (i,)),
            "utilisationsTva": {r["id"]: (r["tva"] if r["tva_applicable"] else "") for r in lignes("select * from immo_utilisation where institution_id = %s and actif", (i,))},
            "fournisseurs": [{"id": r["id"], "libelle": f"{r['compte']} {r['intitule']}"} for r in lignes(
                "select id, compte, intitule from tiers_comptable where institution_id = %s and actif and type_tiers = 'FOURNISSEUR' order by intitule", (i,))],
            "factures": lignes("""select id, fournisseur_id as "fournisseurId", numero, ttc as "montant" from facture_fournisseur where institution_id = %s order by id""", (i,)),
            "employes": [{"id": r["id"], "matricule": r["matricule"], "nom": f"{r['nom']} {r['prenoms']}", "departement": r["fonction"]}
                         for r in lignes("select id, matricule, nom, prenoms, fonction from paie_employe where institution_id = %s order by matricule", (i,))],
            "etats": ETATS, "sorties": SORTIES, "systemes": ["Linéaire", "Dégressif"], "periodicites": ["Annuelle", "Mensuelle"],
            "coefficients": lignes("select coefficient, de, a from immo_coefficient where institution_id = %s and actif order by de", (i,))}


def coefficient(u, duree: int) -> float:
    for r in lignes("select coefficient, de, a from immo_coefficient where institution_id = %s and actif order by de", (u["institution_id"],)):
        if r["de"] <= duree <= r["a"]:
            return float(r["coefficient"].replace(",", "."))
    raise ErreurMetier(f"Aucun coefficient de dégressivité pour une durée de {duree} ans (Données de base > Coefficient de dégressivité).")


def plan(systeme: str, base: int, debut: date, duree: int, coef: float | None = None) -> list[dict]:
    """Plan d'amortissement par exercice. Première annuité au prorata des mois depuis la mise en service (mois de mise en service compris).
    Linéaire : base ÷ durée. Dégressif : valeur nette × taux linéaire × coefficient, et l'annuité linéaire sur la durée restante dès qu'elle est plus forte.
    La dernière annuité solde la valeur nette. Registre S139-1."""
    if base <= 0 or duree <= 0:
        return []
    mois1 = 13 - debut.month
    out, cumul, an = [], 0, debut.year
    fin_mois = duree * 12                  # mois à amortir
    ecoules = 0
    while cumul < base and ecoules < fin_mois:
        mois = min(mois1 if not out else 12, fin_mois - ecoules)
        vnc = base - cumul
        lineaire = round(base * mois / fin_mois)
        if systeme == "Dégressif":
            reste = fin_mois - ecoules
            deg = round(vnc * (1 / duree) * (coef or 1) * mois / 12)
            lin_reste = round(vnc * mois / reste)
            dot = max(deg, lin_reste)
        else:
            dot = lineaire
        if ecoules + mois >= fin_mois or dot > vnc:
            dot = vnc
        cumul += dot
        ecoules += mois
        out.append({"exercice": an, "mois": mois, "base": base, "vncDebut": vnc, "dotation": dot, "cumul": cumul, "vnc": base - cumul})
        an += 1
    return out


def vue(u, b: dict) -> dict:
    f = une("select * from immo_famille where id = %s", (b["famille_id"],))
    am = lignes("select * from immo_amortissement where bien_id = %s order by exercice", (b["id"],))
    det = une("select matricule, nom, prenoms, fonction from paie_employe where id = %s", (b["detenteur_id"],)) if b["detenteur_id"] else None
    loc = une("select code, libelle from immo_localisation where id = %s", (b["localisation_id"],))
    return {"id": b["id"], "numeroPiece": b["numero_piece"], "dateOperation": b["date_operation"].isoformat(), "codification": b["codification"],
            "refConstructeur": b["ref_constructeur"], "categorieId": b["categorie_id"], "familleId": b["famille_id"], "famille": f["libelle"], "libelle": b["libelle"],
            "dateAcquisition": b["date_acquisition"].isoformat(), "dureeVie": b["duree_vie"], "utilisationId": b["utilisation_id"], "localisationId": b["localisation_id"],
            "localisation": loc["libelle"], "dateMiseService": b["date_mise_service"].isoformat(), "fournisseurId": b["fournisseur_id"], "factureId": b["facture_id"],
            "montantTtc": b["montant_ttc"], "tva": b["tva"], "prixAcquisition": b["prix_acquisition"], "amortissable": b["amortissable"], "subventionne": b["subventionne"],
            "immatriculation": b["immatriculation"], "chassis": b["chassis"], "carburant": b["carburant"], "titreFoncier": b["titre_foncier"], "description": b["description"], "autorisationBcc": b.get("autorisation_bcc") or "",
            "statut": b["statut"], "detenteurId": b["detenteur_id"], "detenteur": f"{det['matricule']} {det['nom']} {det['prenoms']}" if det else "",
            "departement": det["fonction"] if det else "", "systeme": f["systeme"], "periodicite": f["periodicite"],
            "comptes": {k: f[c] for k, c in (("acquisition", "compte_acquisition"), ("dotation", "compte_dotation"), ("amortissement", "compte_amortissement"),
                                               ("produit", "compte_produits"), ("chargeVcn", "compte_charge_vcn"))},
            "dernierAmortissement": am[-1]["exercice"] if am else None, "dateAmortissement": am[-1]["le"].date().isoformat() if am else "",
            "cumulAmortissements": am[-1]["cumul"] if am else 0}


def bien(u, bid: int, verrou=False) -> dict:
    b = une(f"select * from immo_bien where id = %s and institution_id = %s and actif{' for update' if verrou else ''}", (bid, u["institution_id"]))
    if not b:
        raise ErreurMetier("Bien introuvable.")
    return b


# ---------- S137 : Création de bien ----------
def valider(u, d: dict, bid: int | None) -> dict:
    d = d if isinstance(d, dict) else {}
    t = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    ent = lambda k: d.get(k) if isinstance(d.get(k), int) and not isinstance(d.get(k), bool) else None
    manque = [n for k, n in (("codification", "Codification"), ("libelle", "Libellé Bien")) if not t(k)] + \
             [n for k, n in (("categorieId", "Catégorie"), ("familleId", "Famille"), ("dureeVie", "Durée de vie"), ("utilisationId", "Utilisation"),
                             ("localisationId", "Localisation"), ("montantTtc", "Montant TTC")) if ent(k) is None]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    da, ds = lire_date(d, "dateAcquisition", "Date Acquisition"), lire_date(d, "dateMiseService", "Date mise en service")
    if ds < da:
        raise ErreurMetier("Date mise en service : au plus tôt la date d'acquisition.")
    i = u["institution_id"]
    f = une("select * from immo_famille where id = %s and institution_id = %s and actif", (ent("familleId"), i))
    if not f:
        raise ErreurMetier("Famille inconnue.")
    if f["categorie_id"] != ent("categorieId"):
        raise ErreurMetier("Famille : elle n'est pas de cette catégorie.")
    if not f["duree_min"] <= ent("dureeVie") <= f["duree_max"]:
        raise ErreurMetier(f"Durée de vie : entre {f['duree_min']} et {f['duree_max']} ans pour cette famille (Normes).")
    ut = une("select * from immo_utilisation where id = %s and institution_id = %s and actif", (ent("utilisationId"), i))
    if not ut:
        raise ErreurMetier("Utilisation inconnue.")
    if not une("select 1 from immo_localisation where id = %s and institution_id = %s and actif", (ent("localisationId"), i)):
        raise ErreurMetier("Localisation inconnue.")
    if ent("montantTtc") <= 0:
        raise ErreurMetier("Montant TTC : supérieur à zéro.")
    if ent("fournisseurId") and not une("select 1 from tiers_comptable where id = %s and institution_id = %s", (ent("fournisseurId"), i)):
        raise ErreurMetier("Fournisseur inconnu.")
    if ent("factureId") and not une("select 1 from facture_fournisseur where id = %s and institution_id = %s and fournisseur_id is not distinct from %s",
                                    (ent("factureId"), i, ent("fournisseurId"))):
        raise ErreurMetier("Facture : pas une facture de ce fournisseur.")
    if une("select 1 from immo_bien where institution_id = %s and actif and lower(codification) = lower(%s) and id is distinct from %s", (i, t("codification"), bid)):
        raise ErreurMetier("Cette Codification existe déjà.")
    ttc = ent("montantTtc")
    taux = float(ut["tva"].replace(",", ".")) if ut["tva_applicable"] and ut["tva"] else 0.0
    tva = round(ttc * taux / (100 + taux))                     # registre S137-3 : TVA comprise dans le TTC
    v = {"codification": t("codification"), "ref_constructeur": t("refConstructeur"), "categorie_id": ent("categorieId"), "famille_id": f["id"], "libelle": t("libelle"),
         "date_acquisition": da, "duree_vie": ent("dureeVie"), "utilisation_id": ut["id"], "localisation_id": ent("localisationId"), "date_mise_service": ds,
         "fournisseur_id": ent("fournisseurId"), "facture_id": ent("factureId"), "montant_ttc": ttc, "tva": tva, "prix_acquisition": ttc - tva,
         "amortissable": d.get("amortissable") is not False, "subventionne": d.get("subventionne") is True}
    for k, c in (("immatriculation", "immatriculation"), ("chassis", "chassis"), ("carburant", "carburant"), ("titreFoncier", "titre_foncier"), ("description", "description")):
        v[c] = t(k) if f[c] else ""
    # Acquisition d'un actif patrimonial au-delà de 10 % des fonds propres de base : autorisation préalable de la BCC (Instr. BCC 41, art. 33), comme la cession
    v["autorisation_bcc"] = t("autorisationBcc")
    if not v["autorisation_bcc"]:
        from .etats_financiers import soldes
        from .normes import fonds_propres
        j = journee_courante(u)
        jd = date.fromisoformat(j["date"]) if j else date.today()
        s, res, ant = soldes(u, jd, jd.year, vidage=True)
        if v["prix_acquisition"] * 10 > max(fonds_propres(s, res + ant)["base"], 0):
            raise ErreurMetier("Acquisition au-delà de 10 % des fonds propres de base : à remplir, Autorisation BCC (Instr. BCC 41, art. 33).")
    return v


def enregistrer(u, d, bid: int | None = None) -> dict:
    exiger(u)
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    if bid is not None:
        b = bien(u, bid, True)
        if b["statut"] == "SORTI" or une("select 1 from immo_amortissement where bien_id = %s", (bid,)):
            raise ErreurMetier("Bien déjà amorti ou sorti : il ne se modifie plus (PCCI § 3.4).")
    v = valider(u, d, bid)
    if bid is None:
        # Aucun numéro de pièce à la création : elle ne passe pas d'écriture, et le journal OD ne doit pas avoir de trou (PCCI § 3.4 ; plan d'allègement,
        # point 0.2 ; registre S137-2). L'acquisition est comptabilisée par sa facture.
        v |= {"numero_piece": "", "date_operation": j["date"], "institution_id": u["institution_id"], "cree_par": u["id"]}
        bid = valeur(f"insert into immo_bien ({', '.join(v)}) values ({', '.join(['%s'] * len(v))}) returning id", tuple(v.values()))
    else:
        executer(f"update immo_bien set {', '.join(f'{k} = %s' for k in v)} where id = %s", (*v.values(), bid))
    return vue(u, bien(u, bid))


def supprimer(u, bid: int) -> dict:
    exiger(u)
    b = bien(u, bid, True)
    if b["statut"] != "LIBRE" or une("select 1 from immo_amortissement where bien_id = %s union select 1 from immo_mouvement where bien_id = %s", (bid, bid)):
        raise ErreurMetier("Bien déjà affecté, amorti ou sorti : il ne se supprime plus.")
    executer("update immo_bien set actif = false where id = %s", (bid,))          # suppression logique (T02)
    return {"id": bid}


def liste(u, p: dict | None = None) -> list[dict]:
    exiger(u)
    p = p or {}
    out = [vue(u, b) for b in lignes("select * from immo_bien where institution_id = %s and actif order by codification", (u["institution_id"],))]
    if p.get("statut"):
        out = [b for b in out if b["statut"] == p["statut"]]
    if str(p.get("detenteurId") or "").isdigit():
        out = [b for b in out if b["detenteurId"] == int(p["detenteurId"])]
    return out


def fiche(u, bid: int) -> dict:
    exiger(u)
    return vue(u, bien(u, bid))


def tableau(u, bid: int) -> list[dict]:
    """Bouton « Tableau amortissement » de la fiche : le plan du bien, avec les dotations déjà passées"""
    exiger(u)
    b = vue(u, bien(u, bid))
    coef = coefficient(u, b["dureeVie"]) if b["systeme"] == "Dégressif" else None
    passe = {r["exercice"] for r in lignes("select exercice from immo_amortissement where bien_id = %s", (bid,))}
    return [{**x, "passe": x["exercice"] in passe} for x in plan(b["systeme"], b["prixAcquisition"], date.fromisoformat(b["dateMiseService"]), b["dureeVie"], coef)]


# ---------- S138 : Affectation, transfert, libération ----------
def employe(u, eid) -> dict:
    e = une("select * from paie_employe where id = %s and institution_id = %s", (eid, u["institution_id"])) if isinstance(eid, int) else None
    if not e:
        raise ErreurMetier("Matricule : employé introuvable (Paie > Personnel).")
    return e


def quand(d, k, nom) -> datetime:
    v = d.get(k)
    if not v or not isinstance(v, str):
        raise ErreurMetier(f"À remplir : {nom}.")
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        raise ErreurMetier(f"{nom} : une date.")


def mouvement(u, b: dict, type_, nouveau, localisation, quand_):
    executer("""insert into immo_mouvement (bien_id, type, ancien_detenteur_id, nouveau_detenteur_id, ancienne_localisation_id, nouvelle_localisation_id, date_mouvement, par)
                values (%s, %s, %s, %s, %s, %s, %s, %s)""", (b["id"], type_, b["detenteur_id"], nouveau, b["localisation_id"], localisation or b["localisation_id"], quand_, u["id"]))
    executer("update immo_bien set detenteur_id = %s, localisation_id = %s, statut = %s where id = %s",
             (nouveau, localisation or b["localisation_id"], "AFFECTE" if nouveau else "LIBRE", b["id"]))


def localisation_de(u, d) -> int | None:
    x = d.get("localisationId")
    if x in (None, ""):
        return None
    if not une("select 1 from immo_localisation where id = %s and institution_id = %s and actif", (x, u["institution_id"])):
        raise ErreurMetier("Localisation inconnue.")
    return x


def biens_de(u, d, statut) -> list[dict]:
    ids = d.get("biens") if isinstance(d.get("biens"), list) else []
    if not ids:
        raise ErreurMetier("Liste des biens choisis : au moins un bien.")
    out = [bien(u, x, True) for x in ids]
    for b in out:
        if b["statut"] != statut:
            raise ErreurMetier(f"Bien {b['codification']} : {'déjà affecté ou sorti' if statut == 'LIBRE' else 'pas en cours d’utilisation'}.")
    return out


def affecter(u, d) -> list[dict]:
    """« Création des affectations de Biens » : Matricule, Localisation, Date affectation, la liste des biens libres choisis"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    e, q, loc = employe(u, d.get("employeId")), quand(d, "date", "Date affectation"), localisation_de(u, d)
    bs = biens_de(u, d, "LIBRE")
    for b in bs:
        mouvement(u, b, "affectation", e["id"], loc, q)
    return [vue(u, bien(u, b["id"])) for b in bs]


def transferer_bien(u, d) -> dict:
    """« Transférer un bien immobilier » : le bien, le nouveau détenteur, sa localisation, la date"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    b = bien(u, d.get("bienId"), True)
    if b["statut"] != "AFFECTE":
        raise ErreurMetier("Ce bien n'est pas en cours d'utilisation : l'affecter d'abord.")
    e, q = employe(u, d.get("employeId")), quand(d, "date", "Date transfert")
    loc = localisation_de(u, d)
    if loc is None:
        raise ErreurMetier("À remplir : Localisation.")
    if e["id"] == b["detenteur_id"]:
        raise ErreurMetier("Nouveau Détenteur : il détient déjà ce bien.")
    mouvement(u, b, "transfert", e["id"], loc, q)
    return vue(u, bien(u, b["id"]))


def transferer_employe(u, d) -> list[dict]:
    """« Transfert de biens d'un employé à un autre » : les biens choisis de l'ancien détenteur passent au nouveau"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    ancien, nouveau, q = employe(u, d.get("ancienId")), employe(u, d.get("nouveauId")), quand(d, "date", "Date transfert")
    if ancien["id"] == nouveau["id"]:
        raise ErreurMetier("Nouveau détenteur : un autre employé que l'ancien.")
    bs = biens_de(u, d, "AFFECTE")
    if any(b["detenteur_id"] != ancien["id"] for b in bs):
        raise ErreurMetier("Liste des biens choisis : seulement des biens de l'ancien détenteur.")
    loc = localisation_de(u, d)
    for b in bs:
        mouvement(u, b, "transfert", nouveau["id"], loc, q)
    return [vue(u, bien(u, b["id"])) for b in bs]


def liberer(u, d) -> list[dict]:
    """« Libération d'un bien encours d'utilisation » : les biens choisis redeviennent libres"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    q, loc = quand(d, "date", "Date libération"), localisation_de(u, d)
    bs = biens_de(u, d, "AFFECTE")
    for b in bs:
        mouvement(u, b, "liberation", None, loc, q)
    return [vue(u, bien(u, b["id"])) for b in bs]


# ---------- S139 : Amortissement, inventaire, sortie ----------
def jour_ouvert(u) -> dict:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return j


def amortir_un(u, b: dict, exercice: int, j: dict) -> bool:
    if not b["amortissable"] or b["statut"] == "SORTI":
        return False
    if une("select 1 from immo_amortissement where bien_id = %s and exercice = %s", (b["id"], exercice)):
        return False
    v = vue(u, b)
    lignes_plan = tableau(u, b["id"])
    x = next((l for l in lignes_plan if l["exercice"] == exercice), None)
    if not x:
        return False
    avant = [l for l in lignes_plan if l["exercice"] < exercice and not l["passe"]]
    if avant:
        raise ErreurMetier(f"Bien {b['codification']} : amortir d'abord l'exercice {avant[0]['exercice']}.")
    eid = None
    if x["dotation"]:
        lg = [{"compte": v["comptes"]["dotation"], "sens": "D", "devise": "CDF", "montant": x["dotation"]},
              {"compte": v["comptes"]["amortissement"], "sens": "C", "devise": "CDF", "montant": x["dotation"]}]
        if b["subventionne"]:
            # B26 : la subvention d'équipement est rapportée au résultat d'un montant égal à la dotation du bien qu'elle a financé, dans la limite de
            # ce qui en reste au compte 15 (PCCI, fiche du compte 15 : débit du 15 par le crédit du 77 ; comptes 158 et 771)
            reste = -int(valeur("""select coalesce(sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end), 0) from ligne_ecriture l
                                   join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
                                   where e.institution_id = %s and c.numero like '15%%'""", (u["institution_id"],)))
            reprise = min(x["dotation"], max(reste, 0))
            if reprise:
                lg += [{"compte": "158", "sens": "D", "devise": "CDF", "montant": reprise}, {"compte": "771", "sens": "C", "devise": "CDF", "montant": reprise}]
        eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Dotation aux amortissements {exercice}, bien {b['codification']}",
                     piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])), evenement="immo_dotation", cle=str(uuid.uuid4()), valide_par=u["id"],
                     lignes_ecr=lg)
    executer("insert into immo_amortissement (bien_id, exercice, dotation, cumul, vnc, ecriture_id, par) values (%s, %s, %s, %s, %s, %s, %s)",
             (b["id"], exercice, x["dotation"], x["cumul"], x["vnc"], eid, u["id"]))
    return True


def amortir(u, d) -> dict:
    """« Amortissement » : par matériel (un bien) ou par lot de matériel (tous les biens amortissables) ; l'exercice choisi ; écriture D dotation / C amortissement"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    ex = d.get("exercice")
    if not isinstance(ex, int) or not une("select 1 from exercice where institution_id = %s and annee = %s and ouvert and not valide", (u["institution_id"], ex)):
        raise ErreurMetier("Exercice : un exercice ouvert.")
    j = jour_ouvert(u)
    if d.get("par") == "lot":
        bs = lignes("select * from immo_bien where institution_id = %s and actif and amortissable and statut <> 'SORTI' order by codification for update", (u["institution_id"],))
    else:
        bs = [bien(u, d.get("bienId"), True)]
    n = sum(1 for b in bs if amortir_un(u, b, ex, j))
    if not n:
        raise ErreurMetier("Rien à amortir pour cet exercice.")
    return {"amortis": n}


def inventorier(u, d) -> dict:
    """« Inventaire de biens » : code bien, état du bien, date d'inventaire, observation (PCCI, classe 2 : inventaire détaillé)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    b = bien(u, d.get("bienId"))
    etat = d.get("etat")
    if etat not in ETATS:
        raise ErreurMetier("À remplir : État du bien.")
    q = lire_date(d, "date", "Date inventaire")
    if q > date.fromisoformat(jour_ouvert(u)["date"]):
        raise ErreurMetier("Date inventaire : pas après la journée ouverte.")
    obs = d.get("observation").strip() if isinstance(d.get("observation"), str) else ""
    executer("insert into immo_inventaire (bien_id, etat, date_inventaire, observation, par) values (%s, %s, %s, %s, %s)", (b["id"], etat, q, obs, u["id"]))
    return {"bienId": b["id"], "etat": etat, "date": q.isoformat()}


def compte_gestion(compte_famille: str, racine: str) -> str:
    """Le compte de gestion du PCCI pour une sortie : celui de la famille s'il en est un sous-compte, sinon le compte du PCCI lui-même"""
    return compte_famille if compte_famille and compte_famille.startswith(racine) else racine


def sortir(u, d) -> dict:
    """« Sortie de biens du patrimoine » : type de sortie, bien, date, observation ; pour une cession, le prix et le compte qui le reçoit.
    PCCI, classe 2 (fonctionnement des comptes de valeurs immobilisées) : la valeur d'origine est créditée « par le débit d'un compte de trésorerie
    ou de tiers pour le prix de la cession, des comptes d'amortissements antérieurs et d'un compte de gestion (674 : moins-values, 774 : plus-values
    ou 673 : mise au rebut d'immobilisation) ». Plan d'allègement, point 0.1 ; registre S139-5."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    if d.get("type") not in SORTIES:
        raise ErreurMetier("À remplir : Type de sortie.")
    b = bien(u, d.get("bienId"), True)
    if b["statut"] == "SORTI":
        raise ErreurMetier("Ce bien est déjà sorti du patrimoine.")
    if b["statut"] == "AFFECTE":
        raise ErreurMetier("Ce bien est en cours d'utilisation : le libérer d'abord.")
    q = lire_date(d, "date", "Date de sortie")
    j = jour_ouvert(u)
    if q > date.fromisoformat(j["date"]):
        raise ErreurMetier("Date de sortie : pas après la journée ouverte.")
    v = vue(u, b)
    cumul = v["cumulAmortissements"]
    vnc = b["prix_acquisition"] - cumul
    autorisation = d.get("autorisationBcc").strip() if isinstance(d.get("autorisationBcc"), str) else ""
    if d["type"] == "Cession" and not autorisation:
        # B28 : cession d'un actif patrimonial au-delà de 10 % des fonds propres de base : autorisation préalable de la BCC (Instr. BCC 41, art. 33)
        from .etats_financiers import soldes
        from .normes import fonds_propres
        jd = date.fromisoformat(j["date"])
        s, res, ant = soldes(u, jd, jd.year, vidage=True)
        base = fonds_propres(s, res + ant)["base"]
        if b["prix_acquisition"] * 10 > max(base, 0):
            raise ErreurMetier("Cession au-delà de 10 % des fonds propres de base : à remplir, Autorisation BCC (Instr. BCC 41, art. 33).")
    prix, contrepartie = 0, ""
    if d["type"] == "Cession":
        prix = d.get("prixCession")
        if isinstance(prix, bool) or not isinstance(prix, (int, float)) or prix < 0:
            raise ErreurMetier("À remplir : Prix de cession (0 si le bien est cédé sans prix).")
        prix = round(prix, 2)
        contrepartie = d.get("compteContrepartie").strip() if isinstance(d.get("compteContrepartie"), str) else ""
        if prix and (not contrepartie.isdigit() or contrepartie[0] not in "45"
                     or not une("select 1 from compte where numero = %s and (institution_id is null or institution_id = %s)", (contrepartie, u["institution_id"]))):
            raise ErreurMetier("Compte qui reçoit le prix : un compte de trésorerie (classe 5) ou de tiers (classe 4) du plan de comptes.")
    lg = [{"compte": v["comptes"]["acquisition"], "sens": "C", "devise": "CDF", "montant": b["prix_acquisition"]}]
    if cumul:
        lg.append({"compte": v["comptes"]["amortissement"], "sens": "D", "devise": "CDF", "montant": cumul})
    if d["type"] == "Mise au rebut":
        if vnc:
            lg.append({"compte": compte_gestion(v["comptes"]["chargeVcn"], "673"), "sens": "D", "devise": "CDF", "montant": vnc})
    else:
        if prix:
            lg.append({"compte": contrepartie, "sens": "D", "devise": "CDF", "montant": prix})
        ecart = round(prix - vnc, 2)
        if ecart < 0:
            lg.append({"compte": compte_gestion(v["comptes"]["chargeVcn"], "674"), "sens": "D", "devise": "CDF", "montant": -ecart})
        elif ecart > 0:
            lg.append({"compte": compte_gestion(v["comptes"]["produit"], "774"), "sens": "C", "devise": "CDF", "montant": ecart})
    eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Sortie du patrimoine ({d['type']}), bien {b['codification']}",
                 piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])), evenement="immo_sortie", cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=lg)
    obs = d.get("observation").strip() if isinstance(d.get("observation"), str) else ""
    if autorisation:
        obs = (obs + " " if obs else "") + f"Autorisation BCC : {autorisation}"
    executer("insert into immo_sortie (bien_id, type, date_sortie, observation, vnc, cumul, ecriture_id, par, prix_cession, compte_contrepartie)"
             " values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", (b["id"], d["type"], q, obs, vnc, cumul, eid, u["id"], prix, contrepartie))
    executer("update immo_bien set statut = 'SORTI' where id = %s", (b["id"],))
    return {**vue(u, bien(u, b["id"])), "vnc": vnc, "prixCession": prix, "resultatCession": round(prix - vnc, 2) if d["type"] == "Cession" else 0}


# ---------- S140 : rapports ----------
def periode(p: dict) -> tuple[date | None, date | None]:
    """Rechercher : Sur une Période (début, fin), A une date fixe (le jour même), Jusqu'à une date fixe (fin seule)"""
    mode = p.get("rechercher") or "periode"
    du = date.fromisoformat(p["du"]) if DATE.match(str(p.get("du") or "")) else None
    au = date.fromisoformat(p["au"]) if DATE.match(str(p.get("au") or "")) else None
    if mode == "date":
        return du or au, du or au
    if mode == "jusqua":
        return None, au or du
    return du, au


def dans(x: date, du, au) -> bool:
    return (du is None or x >= du) and (au is None or x <= au)


def rapport_biens(u, p: dict) -> list[dict]:
    """« Eléments immobilisés sur une période donnée » et « Recherche multicritère » : biens acquis dans la période, filtrés par les éléments de la recherche"""
    exiger(u)
    du, au = periode(p)
    out = [b for b in liste(u) if dans(date.fromisoformat(b["dateAcquisition"]), du, au)]
    for k in ("categorieId", "familleId", "utilisationId", "localisationId"):
        if str(p.get(k) or "").isdigit():
            out = [b for b in out if b[k] == int(p[k])]
    if p.get("statut"):
        out = [b for b in out if b["statut"] == p["statut"]]
    if p.get("subventionne") in ("Oui", "Non"):
        out = [b for b in out if b["subventionne"] == (p["subventionne"] == "Oui")]
    if p.get("amorti") in ("Oui", "Non"):
        out = [b for b in out if (b["dernierAmortissement"] is not None) == (p["amorti"] == "Oui")]
    if p.get("aAmortir") in ("true", True):
        out = [b for b in out if b["amortissable"] and b["statut"] != "SORTI"]
    return out


def rapport_inventaires(u, p: dict) -> list[dict]:
    exiger(u)
    du, au = periode(p)
    out = []
    for r in lignes("""select i.*, b.codification, b.libelle, b.localisation_id, b.categorie_id, b.famille_id from immo_inventaire i join immo_bien b on b.id = i.bien_id
                       where b.institution_id = %s order by i.date_inventaire, i.id""", (u["institution_id"],)):
        if not dans(r["date_inventaire"], du, au) or (p.get("etat") and r["etat"] != p["etat"]):
            continue
        if str(p.get("localisationId") or "").isdigit() and r["localisation_id"] != int(p["localisationId"]):
            continue
        out.append({"date": r["date_inventaire"].isoformat(), "codification": r["codification"], "libelle": r["libelle"], "etat": r["etat"], "observation": r["observation"],
                    "par": nom_utilisateur(r["par"])})
    return out


def simuler(u, p: dict) -> list[dict]:
    """« Tableau Amortissement », Simuler : Système, Coef. degressi., Périodicité, Date Acquisition, Durée de vie, Montant Acquis."""
    exiger(u)
    s = p.get("systeme")
    if s not in ("Linéaire", "Dégressif"):
        raise ErreurMetier("À remplir : Système.")
    da = lire_date(p, "dateAcquisition", "Date Acquisition")
    try:
        duree, montant = int(p.get("duree")), int(p.get("montant"))
    except (TypeError, ValueError):
        raise ErreurMetier("À remplir : Durée de vie, Montant Acquis.")
    coef = None
    if s == "Dégressif":
        try:
            coef = float(str(p.get("coefficient")).replace(",", "."))
        except ValueError:
            raise ErreurMetier("À remplir : Coef. degressi.")
    return plan(s, montant, da, duree, coef)


def suivi(u, p: dict) -> list[dict]:
    """« État des transferts de biens effectués sur une période donnée » : Résultat Affectation, Transfert ou Libération"""
    exiger(u)
    du, au = periode(p)
    t = p.get("resultat") or "transfert"
    nom = lambda e: (lambda r: f"{r['matricule']} {r['nom']} {r['prenoms']}" if r else "")(une("select matricule, nom, prenoms from paie_employe where id = %s", (e,)) if e else None)
    loc = lambda x: valeur("select libelle from immo_localisation where id = %s", (x,)) or "" if x else ""
    return [{"date": r["date_mouvement"].date().isoformat(), "codification": r["codification"], "libelle": r["libelle"], "ancienDetenteur": nom(r["ancien_detenteur_id"]),
             "nouveauDetenteur": nom(r["nouveau_detenteur_id"]), "ancienneLocalisation": loc(r["ancienne_localisation_id"]), "nouvelleLocalisation": loc(r["nouvelle_localisation_id"])}
            for r in lignes("""select m.*, b.codification, b.libelle from immo_mouvement m join immo_bien b on b.id = m.bien_id
                               where b.institution_id = %s and m.type = %s order by m.date_mouvement, m.id""", (u["institution_id"], t))
            if dans(r["date_mouvement"].date(), du, au)]
