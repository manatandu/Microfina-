"""S107 : Comptabilité > Factures (manuel Microfina++, p. 124 à 128 ; procédures p. 147 à 153) : Bon de commande, Enregistrement, Règlement, Journal,
Rapport. S141 : Caisse > Règlement facture espèce. S108 : Déclaration de taxe (p. 128).
Chaîne (COMPLEMENTS § 6) : bon de commande, validation (S114), facture, visa (S113), validation (S114), règlement, visa (S113), validation (S114), puis
comptabilisation (S111) ou paiement en caisse (S141).
PCCI, compte 40 : crédité du montant des factures toutes taxes comprises par le débit des classes 2, 6 ou du compte 47 ; débité des règlements par le
crédit d'un compte de trésorerie. Compte 432 : impôts et taxes déductibles ; 433 : taxes retenues à la source dues au Trésor.
Mêmes règles que web/src/donnees/api.ts (factures). Registre S107, S108, S141."""
import re
import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from psycopg.types.json import Jsonb

from .banques import compte_du_plan
from .bd import ErreurMetier, executer, lignes, une, valeur
from .operations_compta import L, budget, cle_de, entier, jour_ouvert, tenu_par_la_gestion, texte
from .services import (controler_montant_coupures, creer_operation, exiger, json_lu, nettoyer, nom_utilisateur, nouvelle_piece, poster, session_ouverte,
                       theorique)

TVA_DEDUCTIBLE = "432"     # PCCI, compte 432 Impôts et taxes déductibles
TAXES_RETENUES = "433"     # PCCI, compte 433 Impôts et taxes collectés : retenues à la source dues au Trésor
MODES = {"CHEQUE": "CHEQUE", "ESPECE": "Espèce", "PRELEVEMENT": "Prélèvement", "VIREMENT": "Virement bancaire"}
ETAPES = {"visa": "saisie", "validation": "visee"}
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def dec(v, nom: str) -> Decimal:
    try:
        return Decimal(str(v).strip().replace(",", "."))
    except (InvalidOperation, AttributeError):
        raise ErreurMetier(f"{nom} : un nombre.")


def nombre(x: Decimal) -> str:
    """Écriture décimale sans zéros inutiles : 50, 12.5 (jamais 5E+1)"""
    t = format(x, "f")
    return t.rstrip("0").rstrip(".") if "." in t else t


def pct(montant: int, taux) -> int:
    """Part d'un montant, arrondie au centime le plus proche"""
    return int((Decimal(montant) * Decimal(str(taux)) / 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def d_iso(v, nom: str, defaut: str | None = None) -> str:
    x = (v or "").strip() if isinstance(v, str) else ""
    if not x and defaut:
        return defaut
    if not ISO.match(x):
        raise ErreurMetier(f"À remplir : {nom}.")
    return x


def fournisseur(u, fid) -> dict:
    f = une("""select id, intitule, compte from tiers_comptable where id = %s and institution_id = %s and actif and type_tiers = 'FOURNISSEUR'""",
            (fid, u["institution_id"])) if fid else None
    if not f:
        raise ErreurMetier("À remplir : Fournisseur (Comptabilité > Plan des tiers, type FOURNISSEUR).")
    return f


def taxes(u) -> list[dict]:
    return lignes("select id, code, designation, taux, compte from taxe where institution_id = %s and actif order by code", (u["institution_id"],))


def taxe_tva(u) -> dict:
    """La TVA se lit dans les taxes (S104) : aucun taux n'est écrit dans le logiciel"""
    t = next((x for x in taxes(u) if x["code"].strip().upper() == "TVA"), None)
    if not t:
        raise ErreurMetier("TVA : créer d'abord la taxe de code TVA (Comptabilité > Plan des comptes > Création des taxes).")
    return t


def compte_taxe(u, taxe_id) -> str:
    """Compte de la taxe (S104, point 2.26 du plan d'allègement) ; une taxe d'avant le compte garde 433, celui des retenues à la source"""
    return valeur("select compte from taxe where id = %s and institution_id = %s", (taxe_id, u["institution_id"])) or TAXES_RETENUES


def compte_achat(u, numero: str, quoi: str = "Compte") -> str:
    """Compte débité par la facture : classes 2 et 6, ou compte 47 (PCCI, compte 40)"""
    if not numero:
        raise ErreurMetier(f"À remplir : {quoi}.")
    compte_du_plan(u, numero, quoi)
    if not numero.startswith(("2", "6", "47")) or tenu_par_la_gestion(u, numero):
        raise ErreurMetier(f"{quoi} : un compte des classes 2 ou 6, ou du compte 47 (PCCI, compte 40).")
    return numero


def contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    j = journee_date(u)
    return {
        "date": j,
        "fournisseurs": lignes("""select id, intitule, compte from tiers_comptable where institution_id = %s and actif and type_tiers = 'FOURNISSEUR'
                                  order by intitule""", (i,)),
        "typesCommande": lignes("select id, code, libelle from type_commande where institution_id = %s and not supprime order by code", (i,)),
        "taxes": taxes(u),
        "elements": [{**e, "taux": float(e["taux"]), "tauxA": float(e["tauxA"]), "tauxNA": float(e["tauxNA"])} for e in elements(u)],
        "typesBudget": lignes("select id, code, libelle from budget_type where institution_id = %s and actif order by code", (i,)),
        "lignesBudget": lignes("""select l.id, l.numero, l.libelle, coalesce(b.nom, '') as bailleur from budget_ligne l left join bailleur b on b.id = l.bailleur_id
                                  where l.institution_id = %s and l.actif order by l.numero""", (i,)),
        "comptes": [c for c in lignes("""select numero, libelle from compte where (institution_id is null or institution_id = %s) and saisissable and ouvert
                                         and (numero like '2%%' or numero like '6%%' or numero like '47%%') order by numero""", (i,))
                    if not tenu_par_la_gestion(u, c["numero"])],
        "banques": lignes("select id, code, nom as libelle from banque where institution_id = %s and supprime_le is null order by code", (i,)),
        "comptesBancaires": lignes("""select cb.id, cb.banque_id as "banqueId", cb.numero, trim(cb.devise) as devise from compte_bancaire cb
                                      where cb.institution_id = %s and cb.supprime_le is null order by cb.numero""", (i,)),
        "modes": [{"code": k, "libelle": v} for k, v in MODES.items()],
        "exercices": [r["annee"] for r in lignes("select annee from exercice where institution_id = %s order by annee desc", (i,))],
    }


def journee_date(u) -> str:
    from .services import journee_courante
    j = journee_courante(u)
    return j["date"] if j and j["statut"] == "ouverte" else ""


def elements(u) -> list[dict]:
    return lignes("""select id, libelle, compte, taux, taux_a as "tauxA", taux_na as "tauxNA", retenue from element_facture
                     where institution_id = %s and actif and not supprime order by id""", (u["institution_id"],))


# ---------- Bon de commande (p. 124, 125, 147 à 149) ----------
def lignes_commande(u, brut) -> list[dict]:
    brut = brut if isinstance(brut, list) else []
    if not brut:
        raise ErreurMetier("Enregistrement des Lignes de commandes : au moins une ligne (Ajouter).")
    tva, par_id = None, {t["id"]: t for t in taxes(u)}
    out = []
    for x in brut:
        compte = compte_achat(u, texte(x, "compte"))
        designation = texte(x, "designation")
        if not designation:
            raise ErreurMetier("À remplir : Designation.")
        q, pu = dec(x.get("quantite"), "Quantité"), entier(x, "prixUnitaire")
        if q <= 0 or q != q.quantize(Decimal("0.01")):
            raise ErreurMetier("Quantité : un nombre supérieur à zéro, deux décimales au plus.")
        if not pu or pu <= 0:
            raise ErreurMetier("Prix U. : un montant supérieur à zéro.")
        tb, lb = budget(u, x)
        ht = int((q * pu).quantize(Decimal(1), rounding=ROUND_HALF_UP))
        m_tva, m_ret, ret = 0, 0, None
        if x.get("tva"):
            tva = tva or taxe_tva(u)
            m_tva = pct(ht, dec(tva["taux"], "Taux"))
        if entier(x, "retenueTaxeId"):
            ret = par_id.get(entier(x, "retenueTaxeId"))
            if not ret or ret["code"].strip().upper() == "TVA":
                raise ErreurMetier("Retenue : une taxe de la liste, autre que la TVA (Création des taxes).")
            m_ret = pct(ht, dec(ret["taux"], "Taux"))
        out.append({"compte": compte, "intitule": valeur("""select libelle from compte where numero = %s and (institution_id is null or institution_id = %s)
                                                             order by institution_id nulls last limit 1""", (compte, u["institution_id"])) or "",
                    "designation": designation, "unite": texte(x, "unite"), "quantite": nombre(q), "prixUnitaire": pu,
                    "ht": ht, "tva": m_tva, "retenueTaxeId": ret["id"] if ret else None, "retenueLibelle": f"{ret['designation']} {ret['taux']} %" if ret else "",
                    "retenueTaux": ret["taux"] if ret else "", "retenue": m_ret, "typeBudgetId": tb, "ligneBudgetId": lb})
    return out


def tranches_commande(brut, ht: int, date_op: str) -> list[dict]:
    """Tranches de paiement (capture p. 148) : Date, Montant, Taux (%) ; le total fait 100 % du hors taxes. Sans tranche : une seule, à 100 %."""
    brut = brut if isinstance(brut, list) else []
    if not brut:
        return [{"date": date_op, "montant": ht, "taux": "100"}]
    out, total = [], Decimal(0)
    for x in brut:
        t = x.get("taux")
        m = entier(x, "montant")
        if t not in (None, ""):
            taux = dec(t, "Taux (%)")
        elif m and ht:
            taux = (Decimal(m) * 100 / ht).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            raise ErreurMetier("Tranches de paiement : Montant ou Taux (%).")
        if taux <= 0 or taux > 100:
            raise ErreurMetier("Tranches de paiement : un taux entre 0 et 100.")
        total += taux
        out.append({"date": d_iso(x.get("date"), "Date de la tranche"), "montant": pct(ht, taux), "taux": nombre(taux)})
    if abs(total - 100) > Decimal("0.01"):
        raise ErreurMetier("Tranches de paiement : le total des taux fait 100 %.")
    out[-1]["montant"] = ht - sum(x["montant"] for x in out[:-1])
    return out


def enregistrer_commande(u, d) -> dict:
    """Bon de commande : saisi, puis validé par une autre personne (S114, « Validation de commandes »)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    prec = une("select * from commande_fournisseur where cle_idempotence = %s", (cle,))
    if prec:
        return vue_commande(prec)
    i = u["institution_id"]
    tc = une("select id, code, libelle from type_commande where id = %s and institution_id = %s and not supprime", (entier(d, "typeCommandeId"), i))
    if not tc:
        raise ErreurMetier("À remplir : Type Commande (Paramétrage > Facture > Référence Commande).")
    f = fournisseur(u, entier(d, "fournisseurId"))
    jour = jour_ouvert(u)
    date_op = d_iso(d.get("date"), "Date opération", jour)
    if date_op > jour:
        raise ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.")
    l = lignes_commande(u, d.get("lignes"))
    ht, tva = sum(x["ht"] for x in l), sum(x["tva"] for x in l)
    tr = tranches_commande(d.get("tranches"), ht, date_op)
    n = int(valeur("select count(*) from commande_fournisseur where institution_id = %s", (i,))) + 1
    cid = valeur("""insert into commande_fournisseur (institution_id, agence_id, numero, type_commande_id, fournisseur_id, libelle, date_operation, lignes, tranches,
                                                      montant_ht, tva, ttc, saisi_par, cle_idempotence)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (i, u["agence_id"], f"CMDE_F{n:05d}", tc["id"], f["id"], texte(d, "libelle"), date_op, Jsonb(l), Jsonb(tr), ht, tva, ht + tva, u["id"], cle))
    return vue_commande(une("select * from commande_fournisseur where id = %s", (cid,)))


def vue_commande(c: dict) -> dict:
    f = une("select intitule from tiers_comptable where id = %s", (c["fournisseur_id"],))
    tc = une("select code, libelle from type_commande where id = %s", (c["type_commande_id"],))
    faites = [r["tranche"] for r in lignes("select tranche from facture_fournisseur where commande_id = %s and statut <> 'annulee'", (c["id"],))]
    return {"id": c["id"], "numero": c["numero"], "typeCode": tc["code"], "type": tc["libelle"], "fournisseurId": c["fournisseur_id"], "fournisseur": f["intitule"],
            "libelle": c["libelle"] or "", "date": c["date_operation"].isoformat(), "lignes": json_lu(c["lignes"]), "tranches": json_lu(c["tranches"]),
            "tranchesFacturees": faites, "ht": c["montant_ht"], "tva": c["tva"], "ttc": c["ttc"], "statut": c["statut"], "saisiPar": nom_utilisateur(c["saisi_par"]),
            "validePar": nom_utilisateur(c["valide_par"])}


def commandes(u, statut: str) -> list[dict]:
    """S114 : « Validation de commandes » (saisies) et « Liste de commandes validées »"""
    exiger(u)
    if statut not in ("saisie", "validee"):
        raise ErreurMetier("Liste inconnue.")
    return [vue_commande(c) for c in lignes("""select * from commande_fournisseur where institution_id = %s and agence_id = %s and statut = %s
                                               order by date_operation, id""", (u["institution_id"], u["agence_id"], statut))]


def valider_commande(u, cid: int) -> dict:
    exiger(u)
    c = une("select * from commande_fournisseur where id = %s and institution_id = %s for update", (cid, u["institution_id"]))
    if not c or c["statut"] != "saisie":
        raise ErreurMetier("Rien à valider.")
    if c["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : pas de validation sur sa propre saisie.")
    executer("update commande_fournisseur set statut = 'validee', valide_par = %s, valide_le = now() where id = %s", (u["id"], cid))
    return vue_commande(une("select * from commande_fournisseur where id = %s", (cid,)))


def commandes_a_facturer(u, fid: int) -> list[dict]:
    """Liste « N° Commande » de l'enregistrement : commandes validées du fournisseur qui ont encore une tranche à facturer"""
    exiger(u)
    out = [vue_commande(c) for c in lignes("""select * from commande_fournisseur where institution_id = %s and fournisseur_id = %s and statut = 'validee'
                                              order by id""", (u["institution_id"], fid))]
    return [c for c in out if len(c["tranchesFacturees"]) < len(c["tranches"])]


# ---------- Enregistrement de factures (p. 125, 126, 149 et 150) ----------
def calculer(u, d) -> dict:
    """Montants de la facture : hors taxes, TVA, TTC, liste des charges et des retenues fiscales, montant à payer"""
    d = d if isinstance(d, dict) else {}
    f = fournisseur(u, entier(d, "fournisseurId"))
    charges, imput = [], []
    if d.get("directe"):
        ht = entier(d, "montantHt")
        if not ht or ht <= 0:
            raise ErreurMetier("À remplir : Montant (HT).")
        compte = compte_achat(u, texte(d, "compte"))
        tva = pct(ht, dec(taxe_tva(u)["taux"], "Taux")) if d.get("tva") else 0
        imput, c, tranche, type_facture = [{"compte": compte, "montant": ht}], None, None, ""
    else:
        c = une("select * from commande_fournisseur where id = %s and institution_id = %s and fournisseur_id = %s and statut = 'validee'",
                (entier(d, "commandeId"), u["institution_id"], f["id"]))
        if not c:
            raise ErreurMetier("À remplir : N° Commande.")
        tr, lc = json_lu(c["tranches"]), json_lu(c["lignes"])
        tranche = entier(d, "tranche")
        if tranche is None or not 1 <= tranche <= len(tr):
            raise ErreurMetier("À remplir : Tranche Paiement (%).")
        faites = lignes("select tranche, montant_ht, tva, lignes, charges from facture_fournisseur where commande_id = %s and statut <> 'annulee'", (c["id"],))
        if any(x["tranche"] == tranche for x in faites):
            raise ErreurMetier("Cette tranche est déjà facturée.")
        derniere = len(faites) == len(tr) - 1                     # la dernière facture prend le reste : aucun centime perdu
        taux = Decimal(tr[tranche - 1]["taux"])
        part = (lambda total, deja: total - deja) if derniere else (lambda total, deja: pct(total, taux))
        deja_l = [sum(json_lu(x["lignes"])[k]["montant"] for x in faites) for k in range(len(lc))]
        imput = [{"compte": x["compte"], "montant": part(x["ht"], deja_l[k]), "ligneBudgetId": x.get("ligneBudgetId")} for k, x in enumerate(lc)]
        ht = sum(x["montant"] for x in imput)
        tva = part(c["tva"], sum(x["tva"] for x in faites))
        for k, x in enumerate(lc):                                   # retenues posées sur les lignes de la commande (taxes de S104)
            if x.get("retenueTaxeId"):
                deja = sum(ch["montant"] for fa in faites for ch in json_lu(fa["charges"]) if ch.get("ligne") == k)
                m = part(x["retenue"], deja)
                if m:
                    charges.append({"libelle": x["retenueLibelle"], "taux": x["retenueTaux"], "montant": m, "retenue": True, "compte": compte_taxe(u, x["retenueTaxeId"]),
                                    "taxeId": x["retenueTaxeId"], "ligne": k})
        type_facture = valeur("select code from type_commande where id = %s", (c["type_commande_id"],)) or ""
    for e in elements(u):                                            # éléments de facture (S36) : taux « A. » avec numéro impôt, « N.A. » sans, sinon Taux
        taux = e["taux"]                                             # « Taux A. », « Taux N.A. » et la case NIF supprimés (registre T130)
        m = pct(ht, taux)
        if m:
            charges.append({"libelle": e["libelle"], "taux": str(taux), "montant": m, "retenue": bool(e["retenue"]), "compte": e["compte"], "elementId": e["id"]})
    ajouts, retenues = sum(x["montant"] for x in charges if not x["retenue"]), sum(x["montant"] for x in charges if x["retenue"])
    return {"fournisseur": f, "commande": c, "tranche": tranche, "typeFacture": type_facture, "ht": ht, "tva": tva, "ttc": ht + tva, "charges": charges, "imputation": imput,
            "du": ht + tva + ajouts, "aPayer": ht + tva + ajouts - retenues}


def apercu_facture(u, d) -> dict:
    exiger(u)
    x = calculer(u, d)
    return {"typeFacture": x["typeFacture"], "ht": x["ht"], "tva": x["tva"], "ttc": x["ttc"], "charges": x["charges"], "aPayer": x["aPayer"]}


def enregistrer_facture(u, d) -> dict:
    """Enregistrer : la facture est saisie, en attente du visa (S113, « Visa Facture ») puis de la validation (S114)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    prec = une("select * from facture_fournisseur where cle_idempotence = %s", (cle,))
    if prec:
        return vue_facture(prec)
    reference, libelle = texte(d, "reference"), texte(d, "libelle")
    if not reference:
        raise ErreurMetier("À remplir : Réf. Facture.")
    if not libelle:
        raise ErreurMetier("À remplir : Libellé.")
    jour = jour_ouvert(u)
    date_f = d_iso(d.get("dateFacture"), "Date Facture", jour)
    if date_f > jour:
        raise ErreurMetier("Date Facture : pas après la journée ouverte.")
    echeance = d_iso(d.get("dateEcheance"), "Date Echéance", date_f)
    if echeance < date_f:
        raise ErreurMetier("Date Echéance : pas avant la date de la facture.")
    x = calculer(u, d)
    i = u["institution_id"]
    if une("select 1 from facture_fournisseur where institution_id = %s and fournisseur_id = %s and upper(reference) = upper(%s) and statut <> 'annulee'",
           (i, x["fournisseur"]["id"], reference)):
        raise ErreurMetier("Réf. Facture : cette facture du fournisseur est déjà enregistrée.")
    n = int(valeur("select count(*) from facture_fournisseur where institution_id = %s", (i,))) + 1
    fid = valeur("""insert into facture_fournisseur (institution_id, agence_id, numero, commande_id, tranche, fournisseur_id, type_facture, reference, date_facture,
                                                     date_echeance, libelle, montant_ht, tva, ttc, charges, lignes, montant_du, montant_a_payer, a_jour, nif,
                                                     saisi_par, cle_idempotence)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (i, u["agence_id"], f"{n:06d}", x["commande"]["id"] if x["commande"] else None, x["tranche"], x["fournisseur"]["id"], x["typeFacture"], reference, date_f,
                  echeance, libelle, x["ht"], x["tva"], x["ttc"], Jsonb(x["charges"]), Jsonb(x["imputation"]), x["du"], x["aPayer"], True,
                  False, u["id"], cle))
    return vue_facture(une("select * from facture_fournisseur where id = %s", (fid,)))


def regle(fid: int, sauf: int | None = None) -> int:
    return int(valeur("select coalesce(sum(montant), 0) from reglement_fournisseur where facture_id = %s and (%s::bigint is null or id <> %s)", (fid, sauf, sauf)))


def vue_facture(f: dict) -> dict:
    fo = une("select intitule from tiers_comptable where id = %s", (f["fournisseur_id"],))
    paye = regle(f["id"])
    return {"id": f["id"], "numero": f["numero"], "commandeId": f["commande_id"], "commande": valeur("select numero from commande_fournisseur where id = %s", (f["commande_id"],)) or "",
            "tranche": f["tranche"], "fournisseurId": f["fournisseur_id"], "fournisseur": fo["intitule"], "typeFacture": f["type_facture"] or "", "reference": f["reference"],
            "date": f["date_facture"].isoformat(), "echeance": f["date_echeance"].isoformat(), "libelle": f["libelle"], "ht": f["montant_ht"], "tva": f["tva"], "ttc": f["ttc"],
            "charges": json_lu(f["charges"]), "totalCharges": sum(x["montant"] for x in json_lu(f["charges"])), "du": f["montant_du"], "aPayer": f["montant_a_payer"],
            "regle": paye, "reste": f["montant_du"] - paye, "statut": f["statut"], "etat": "soldee" if paye >= f["montant_du"] else "encours", "piece": f["piece"] or "",
            "saisiPar": nom_utilisateur(f["saisi_par"]), "visePar": nom_utilisateur(f["vise_par"]), "validePar": nom_utilisateur(f["valide_par"]),
            "dateValidation": f["date_validation"].isoformat() if f["date_validation"] else ""}


# ---------- Règlement de factures (p. 126, 127, 152 et 153) ----------
def factures_a_regler(u, fid: int) -> list[dict]:
    """Liste « N° Facture » du règlement : factures validées du fournisseur qui ne sont pas soldées"""
    exiger(u)
    out = [vue_facture(f) for f in lignes("""select * from facture_fournisseur where institution_id = %s and fournisseur_id = %s
                                             and statut in ('validee', 'comptabilisee') order by date_facture, id""", (u["institution_id"], fid))]
    return [f for f in out if f["reste"] > 0]


def retenues_reglement(f: dict, montant: int, sauf: int | None = None) -> list[dict]:
    """Retenues fiscales du règlement : la part des retenues de la facture qui revient au montant réglé ; le dernier règlement prend le reste"""
    ch = [x for x in json_lu(f["charges"]) if x["retenue"]]
    deja = lignes("select montant, charges from reglement_fournisseur where facture_id = %s and (%s::bigint is null or id <> %s)", (f["id"], sauf, sauf))
    solde = sum(x["montant"] for x in deja) + montant >= f["montant_du"]
    out = []
    for k, x in enumerate(ch):
        pris = sum(json_lu(r["charges"])[k]["montant"] for r in deja)
        m = x["montant"] - pris if solde else int((Decimal(x["montant"]) * montant / f["montant_du"]).quantize(Decimal(1), rounding=ROUND_HALF_UP))
        out.append({**x, "montant": max(m, 0)})
    return out


def apercu_reglement(u, fid: int, montant: int) -> dict:
    exiger(u)
    f = une("select * from facture_fournisseur where id = %s and institution_id = %s", (fid, u["institution_id"]))
    if not f:
        raise ErreurMetier("À remplir : N° Facture.")
    ch = retenues_reglement(f, montant)
    return {"charges": ch, "aPayer": montant - sum(x["montant"] for x in ch)}


def enregistrer_reglement(u, d) -> dict:
    """Enregistrer : le règlement est saisi, en attente du visa (S113, « Visa Règlement ») puis de la validation (S114)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    prec = une("select * from reglement_fournisseur where cle_idempotence = %s", (cle,))
    if prec:
        return vue_reglement(prec)
    f = une("select * from facture_fournisseur where id = %s and institution_id = %s and statut in ('validee', 'comptabilisee') for update",
            (entier(d, "factureId"), u["institution_id"]))
    if not f:
        raise ErreurMetier("À remplir : N° Facture.")
    m = entier(d, "montant")
    if not m or m <= 0:
        raise ErreurMetier("À remplir : Montant.")
    if m > f["montant_du"] - regle(f["id"]):
        raise ErreurMetier("Montant : plus que le reste à régler de la facture.")
    mode = texte(d, "mode")
    if mode not in MODES:
        raise ErreurMetier("À remplir : Mode Règlement.")
    jour = jour_ouvert(u)
    date_r = d_iso(d.get("dateReglement"), "Date Règlement", jour)
    if date_r > jour:
        raise ErreurMetier("Date Règlement : pas après la journée ouverte.")
    if date_r < f["date_facture"].isoformat():
        raise ErreurMetier("Date Règlement : pas avant la date de la facture.")
    ch = retenues_reglement(f, m)
    if mode == "ESPECE":                                                        # loi 22/068, art. 23 (confrontation du 21/11/2026, E4)
        from .services import controler_especes_hors_clientele
        controler_especes_hors_clientele([(m - sum(x["montant"] for x in ch), "CDF")])
    rid = valeur("""insert into reglement_fournisseur (institution_id, agence_id, facture_id, montant, date_reglement, mode, charges, montant_a_payer, observations,
                                                       saisi_par, cle_idempotence) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], u["agence_id"], f["id"], m, date_r, mode, Jsonb(ch), m - sum(x["montant"] for x in ch), texte(d, "observations"), u["id"], cle))
    return vue_reglement(une("select * from reglement_fournisseur where id = %s", (rid,)))


def vue_reglement(r: dict) -> dict:
    f = une("select * from facture_fournisseur where id = %s", (r["facture_id"],))
    fo = une("select intitule from tiers_comptable where id = %s", (f["fournisseur_id"],))
    ch = json_lu(r["charges"])
    return {"id": r["id"], "factureId": f["id"], "facture": f["numero"], "reference": f["reference"], "fournisseur": fo["intitule"], "ht": f["montant_ht"],
            "montant": r["montant"], "charges": ch, "totalCharges": sum(x["montant"] for x in ch), "aPayer": r["montant_a_payer"], "mode": r["mode"], "modeLibelle": MODES[r["mode"]],
            "date": r["date_reglement"].isoformat(), "observations": r["observations"] or "", "statut": r["statut"], "piece": r["piece"] or "", "cheque": r["cheque"] or "",
            "saisiPar": nom_utilisateur(r["saisi_par"]), "visePar": nom_utilisateur(r["vise_par"]), "validePar": nom_utilisateur(r["valide_par"])}


# ---------- S113 et S114 : visa et validation des factures et des règlements ----------
TABLES = {"facture": ("facture_fournisseur", vue_facture, "date_facture"), "reglement": ("reglement_fournisseur", vue_reglement, "date_reglement")}


def lister(u, etape: str, quoi: str) -> list[dict]:
    exiger(u)
    if etape not in ETAPES or quoi not in TABLES:
        raise ErreurMetier("Liste inconnue.")
    table, vue, tri = TABLES[quoi]
    return [vue(x) for x in lignes(f"select * from {table} where institution_id = %s and agence_id = %s and statut = %s order by {tri}, id",
                                   (u["institution_id"], u["agence_id"], ETAPES[etape]))]


def faire_suivre(u, quoi: str, oid: int, etape: str, d=None) -> dict:
    """Visa puis validation, par des personnes distinctes de celle qui a saisi (Instr. BCC 008, art. 66 ; registre S57-1).
    Validation d'un règlement par chèque, virement ou prélèvement : « Infos Chèque » (N° Chèque, Banque, N° Compte Bancaire, Date Emission, p. 153)."""
    exiger(u)
    if quoi not in TABLES:
        raise ErreurMetier("Liste inconnue.")
    table, vue, _ = TABLES[quoi]
    o = une(f"select * from {table} where id = %s and institution_id = %s and agence_id = %s for update", (oid, u["institution_id"], u["agence_id"]))
    if not o or o["statut"] != ETAPES.get(etape):
        raise ErreurMetier("Rien à viser." if etape == "visa" else "Rien à valider.")
    if o["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : " + ("pas de visa sur sa propre saisie." if etape == "visa" else "pas de validation sur sa propre saisie."))
    if etape == "visa":
        executer(f"update {table} set statut = 'visee', vise_par = %s, vise_le = now() where id = %s", (u["id"], oid))
        return vue(une(f"select * from {table} where id = %s", (oid,)))
    if o["vise_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a visé.")
    jour = jour_ouvert(u)
    if quoi == "reglement" and o["mode"] != "ESPECE":
        d = d if isinstance(d, dict) else {}
        cb = une("""select cb.id, trim(cb.devise) as devise from compte_bancaire cb where cb.id = %s and cb.institution_id = %s and cb.supprime_le is null""",
                 (entier(d, "compteBancaireId"), u["institution_id"]))
        if not cb:
            raise ErreurMetier("À remplir : Banque et N° Compte Bancaire.")
        if cb["devise"] != "CDF":
            raise ErreurMetier("N° Compte Bancaire : un compte en francs congolais, comme la facture.")
        cheque = texte(d, "cheque")
        if o["mode"] == "CHEQUE":
            if not cheque:
                raise ErreurMetier("À remplir : N° Chèque.")
            q = une("select id, statut from cheque_institution where compte_bancaire_id = %s and numero = %s for update", (cb["id"], cheque))
            if not q:
                raise ErreurMetier("N° Chèque : ce chèque n'appartient à aucun chéquier de ce compte bancaire (Gestion Chèque Institution).")
            if q["statut"] != "disponible":
                raise ErreurMetier("N° Chèque : ce chèque a déjà servi.")
            executer("update cheque_institution set statut = 'utilise' where id = %s", (q["id"],))
        emission = d_iso(d.get("dateEmission"), "Date Emission", jour)
        executer("update reglement_fournisseur set cheque = %s, compte_bancaire_id = %s, date_emission = %s where id = %s", (cheque or None, cb["id"], emission, oid))
    executer(f"update {table} set statut = 'validee', valide_par = %s, valide_le = now(), date_validation = %s where id = %s", (u["id"], jour, oid))
    return vue(une(f"select * from {table} where id = %s", (oid,)))


# ---------- S111 : ce que la comptabilisation passe ----------
def lignes_facture(f: dict) -> list[dict]:
    """Débit des comptes d'achat (hors taxes), de la TVA déductible (432) et des charges ajoutées ; crédit du fournisseur, toutes taxes comprises"""
    fo = une("select id, compte from tiers_comptable where id = %s", (f["fournisseur_id"],))
    l = [L(x["compte"], "D", "CDF", x["montant"], None, x.get("ligneBudgetId")) for x in json_lu(f["lignes"]) if x["montant"]]
    if f["tva"]:   # le compte de la taxe TVA (S104), 432 par défaut
        l.append(L(valeur("select compte from taxe where institution_id = %s and actif and upper(trim(code)) = 'TVA' limit 1", (f["institution_id"],)) or TVA_DEDUCTIBLE,
                   "D", "CDF", f["tva"]))
    l += [L(x["compte"], "D", "CDF", x["montant"]) for x in json_lu(f["charges"]) if not x["retenue"]]
    l.append(L(fo["compte"], "C", "CDF", f["montant_du"], f"tc:{fo['id']}"))
    return l


def lignes_reglement(r: dict, tresorerie: dict) -> list[dict]:
    """Débit du fournisseur ; crédit de la trésorerie pour le montant payé et des comptes des retenues fiscales"""
    f = une("select fournisseur_id from facture_fournisseur where id = %s", (r["facture_id"],))
    fo = une("select id, compte from tiers_comptable where id = %s", (f["fournisseur_id"],))
    l = [L(fo["compte"], "D", "CDF", r["montant"], f"tc:{fo['id']}")]
    if r["montant_a_payer"]:
        l.append(tresorerie)
    return l + [L(x["compte"], "C", "CDF", x["montant"]) for x in json_lu(r["charges"]) if x["montant"]]


def libelle_reglement(r: dict) -> str:
    ref = valeur("select reference from facture_fournisseur where id = %s", (r["facture_id"],))
    return f"Règlement de la facture {ref}" + (f", chèque {r['cheque']}" if r["cheque"] else "")


def fiche_imputation(u, rid: int) -> dict:
    """Etat de validation du règlement (« FICHE D'IMPUTATION », p. 154) : N° Journal, Date, N° de Pièce, Libellé, Référence ; COMPTE, INTITULE, DEBIT, CREDIT,
    ECHEANCE ; TOTAUX ; Saisie par, Approuvée par. Éditée dès la validation : la pièce vient à la comptabilisation (T13) ou au paiement en caisse (S141)."""
    exiger(u)
    r = une("select * from reglement_fournisseur where id = %s and institution_id = %s and agence_id = %s", (rid, u["institution_id"], u["agence_id"]))
    if not r or r["statut"] not in ("validee", "comptabilisee", "payee"):
        raise ErreurMetier("Fiche d'imputation : règlement pas encore validé.")
    f = une("select reference from facture_fournisseur where id = %s", (r["facture_id"],))
    if r["ecriture_id"]:
        e = une("select e.date_valeur, e.libelle, j.code from ecriture e join journal j on j.id = e.journal_id where e.id = %s", (r["ecriture_id"],))
        journal, jour, libelle = e["code"], e["date_valeur"], e["libelle"]
        lg = [{"compte": x["numero"], "intitule": x["libelle"], "debit": x["montant_cdf"] if x["sens"] == "D" else 0, "credit": x["montant_cdf"] if x["sens"] == "C" else 0}
              for x in lignes("""select c.numero, c.libelle, l.sens, l.montant_cdf from ligne_ecriture l join compte c on c.id = l.compte_id
                                 where l.ecriture_id = %s order by l.rang""", (r["ecriture_id"],))]
    else:
        from .comptabilisation import banque
        b = {"journal": "CA", "compte": "570"} if r["mode"] == "ESPECE" else banque(r["compte_bancaire_id"])
        journal, jour, libelle = b["journal"], r["date_validation"], libelle_reglement(r)
        lg = [{"compte": x["compte"], "debit": x["montant"] if x["sens"] == "D" else 0, "credit": x["montant"] if x["sens"] == "C" else 0,
               "intitule": valeur("""select libelle from compte where numero = %s and (institution_id is null or institution_id = %s)
                                     order by institution_id nulls last limit 1""", (x["compte"], u["institution_id"])) or ""}
              for x in lignes_reglement(r, L(b["compte"], "C", "CDF", r["montant_a_payer"]))]
    from .releves import entete
    return {"entete": entete(u["institution_id"]), "journal": journal, "date": jour.isoformat(), "piece": r["piece"] or "", "libelle": libelle, "reference": f["reference"],
            "lignes": lg, "debit": sum(x["debit"] for x in lg), "credit": sum(x["credit"] for x in lg), "saisiPar": nom_utilisateur(r["saisi_par"])}


def en_attente(u, j: dict) -> list[dict]:
    """Factures et règlements validés (hors espèces, payés en caisse : S141) à passer au plus tard à la date de la journée"""
    d, i, a = j["date_comptable"], u["institution_id"], u["agence_id"]
    out = []
    for f in lignes("""select * from facture_fournisseur where institution_id = %s and agence_id = %s and statut = 'validee' and date_validation <= %s
                       order by date_validation, id""", (i, a, d)):
        out.append({"source": "facture", "id": f["id"], "type": "facture", "libelle": f"Facture {f['reference']} : {f['libelle']}", "journal": "OD",
                    "lignes": lignes_facture(f), "date": f["date_validation"], "evenement": "facture"})
    from .comptabilisation import banque
    for r in lignes("""select * from reglement_fournisseur where institution_id = %s and agence_id = %s and statut = 'validee' and mode <> 'ESPECE'
                       and date_validation <= %s order by date_validation, id""", (i, a, d)):
        b = banque(r["compte_bancaire_id"])
        out.append({"source": "reglement", "id": r["id"], "type": "reglement", "libelle": libelle_reglement(r), "journal": b["journal"],
                    "lignes": lignes_reglement(r, L(b["compte"], "C", "CDF", r["montant_a_payer"])), "date": r["date_validation"], "evenement": "reglement_facture"})
    return out


def marquer(x: dict, piece: str, eid: int):
    table = "facture_fournisseur" if x["source"] == "facture" else "reglement_fournisseur"
    executer(f"update {table} set statut = 'comptabilisee', piece = %s, ecriture_id = %s where id = %s", (piece, eid, x["id"]))


# ---------- S141 : Caisse > Règlement facture espèce ----------
def reglements_espece(u) -> list[dict]:
    """Règlements en espèces validés (S114), en attente du caissier"""
    exiger(u)
    return [vue_reglement(r) for r in lignes("""select * from reglement_fournisseur where institution_id = %s and agence_id = %s and statut = 'validee' and mode = 'ESPECE'
                                                order by date_reglement, id""", (u["institution_id"], u["agence_id"]))]


def payer_reglement(u, rid: int, d) -> dict:
    """Le caissier paie le fournisseur, avec le billetage des coupures remises ; il n'a ni saisi, ni visé, ni validé le règlement (registre S141-2 à S141-4)"""
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    r = une("select * from reglement_fournisseur where id = %s and institution_id = %s and agence_id = %s for update", (rid, u["institution_id"], u["agence_id"]))
    if r and r["statut"] == "payee" and valeur("select 1 from operation where id = %s and cle_idempotence = %s", (r["operation_id"], cle)):
        return vue_reglement(r)
    if not r or r["mode"] != "ESPECE" or r["statut"] != "validee":
        raise ErreurMetier("Rien à régler.")
    if u["id"] in (r["saisi_par"], r["vise_par"], r["valide_par"]):
        raise ErreurMetier("Quatre yeux : le paiement en caisse vient d'une autre personne que celles qui ont saisi, visé et validé.")
    from .services import controler_especes_hors_clientele
    controler_especes_hors_clientele([(r["montant_a_payer"], "CDF")])            # le cours a pu changer depuis la saisie du règlement
    s = session_ouverte(u, "CDF")
    coupures = nettoyer(d.get("coupures") if isinstance(d.get("coupures"), dict) else {})
    controler_montant_coupures(coupures, r["montant_a_payer"], "CDF")
    th = theorique(s["id"], "CDF")
    if any(n > th.get(v, 0) for v, n in coupures.items()):
        raise ErreurMetier("Pas assez de coupures en caisse (CDF).")
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    ref = valeur("select reference from facture_fournisseur where id = %s", (r["facture_id"],))
    libelle = f"Règlement en espèces de la facture {ref}"
    piece = nouvelle_piece(u, "CA", j["date_comptable"])
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=libelle, piece=piece, evenement="reglement_facture", cle=cle, valide_par=u["id"],
                 lignes_ecr=lignes_reglement(r, L("570", "C", "CDF", r["montant_a_payer"], f"guichet:{s['guichetId']}")))
    fo = vue_reglement(r)["fournisseur"]
    op = creer_operation(u, s, cle=cle, type_="ed_decaissement", statut="validee", tiers_id=None, contrat=None, montant=r["montant_a_payer"], devise="CDF",
                         coupures=coupures, remis_par=fo, ecriture_id=eid, motif=libelle)
    executer("update reglement_fournisseur set statut = 'payee', piece = %s, ecriture_id = %s, operation_id = %s where id = %s", (piece, eid, op, rid))
    return vue_reglement(une("select * from reglement_fournisseur where id = %s", (rid,)))


# ---------- Journal achat (p. 128) et Rapport des factures (p. 128 et 153) ----------
def rapport(u, p: dict) -> dict:
    """Rapport > Facture : par période ou par date ; Visa (visée, validée, tout) ; État (soldée, en cours, annulée) ; détaillé ou groupé par fournisseur"""
    exiger(u)
    du = d_iso(p.get("du"), "Date Début")
    au = du if p.get("mode") == "date" else d_iso(p.get("au"), "Date Fin")
    if du > au:
        raise ErreurMetier("Date Début : avant la date fin.")
    visa, etat = p.get("visa") or "tout", p.get("etat") or ""
    fid = int(p["fournisseurId"]) if str(p.get("fournisseurId") or "").isdigit() else None
    out = []
    for f in lignes("""select * from facture_fournisseur where institution_id = %s and date_facture between %s and %s and (%s::bigint is null or fournisseur_id = %s)
                       and (%s::text = '' or type_facture = %s) order by date_facture, id""",
                    (u["institution_id"], du, au, fid, fid, p.get("typeFacture") or "", p.get("typeFacture") or "")):
        v = vue_facture(f)
        if visa == "visee" and f["statut"] != "visee" or visa == "validee" and f["statut"] not in ("validee", "comptabilisee"):
            continue
        if etat == "annulee" and f["statut"] != "annulee" or etat in ("soldee", "encours") and (f["statut"] == "annulee" or v["etat"] != etat):
            continue
        out.append(v)
    if p.get("resultat") == "groupe":
        g = {}
        for v in out:
            x = g.setdefault(v["fournisseur"], {"fournisseur": v["fournisseur"], "nombre": 0, "ht": 0, "tva": 0, "ttc": 0, "du": 0, "regle": 0, "reste": 0})
            x["nombre"] += 1
            for k in ("ht", "tva", "ttc", "du", "regle", "reste"):
                x[k] += v[k]
        return {"groupe": True, "lignes": [], "groupes": [g[k] for k in sorted(g)]}
    return {"groupe": False, "lignes": out, "groupes": []}


def declaration_taxes(u, p: dict) -> dict:
    """S108 : Etat de déclaration des taxes (p. 128) : pour l'exercice, le mois et la taxe choisis. TVA : factures validées dans le mois (taxe déductible) ;
    autre taxe : retenues des règlements validés dans le mois (exigibles au paiement). Registre S108-1 à S108-3."""
    exiger(u)
    if not str(p.get("exercice") or "").isdigit() or not str(p.get("mois") or "").isdigit() or not 1 <= int(p["mois"]) <= 12:
        raise ErreurMetier("À remplir : Exercice et Mois.")
    t = une("select id, code, designation, taux from taxe where id = %s and institution_id = %s", (int(p["taxeId"]) if str(p.get("taxeId") or "").isdigit() else None, u["institution_id"]))
    if not t:
        raise ErreurMetier("À remplir : Taxe.")
    an, mois, out = int(p["exercice"]), int(p["mois"]), []
    if t["code"].strip().upper() == "TVA":
        for f in lignes("""select f.*, tc.intitule from facture_fournisseur f join tiers_comptable tc on tc.id = f.fournisseur_id
                           where f.institution_id = %s and f.statut in ('validee', 'comptabilisee') and f.tva > 0
                             and extract(year from f.date_validation) = %s and extract(month from f.date_validation) = %s order by f.date_validation, f.id""",
                        (u["institution_id"], an, mois)):
            out.append({"date": f["date_validation"].isoformat(), "fournisseur": f["intitule"], "reference": f["reference"], "base": f["montant_ht"], "taux": t["taux"], "montant": f["tva"]})
    else:
        for r in lignes("""select r.*, f.reference, f.montant_ht, f.montant_du, tc.intitule from reglement_fournisseur r join facture_fournisseur f on f.id = r.facture_id
                           join tiers_comptable tc on tc.id = f.fournisseur_id
                           where r.institution_id = %s and r.statut in ('validee', 'comptabilisee', 'payee')
                             and extract(year from r.date_validation) = %s and extract(month from r.date_validation) = %s order by r.date_validation, r.id""",
                        (u["institution_id"], an, mois)):
            m = sum(x["montant"] for x in json_lu(r["charges"]) if x.get("taxeId") == t["id"])
            if m:
                base = int((Decimal(r["montant_ht"]) * r["montant"] / r["montant_du"]).quantize(Decimal(1), rounding=ROUND_HALF_UP))
                out.append({"date": r["date_validation"].isoformat(), "fournisseur": r["intitule"], "reference": r["reference"], "base": base, "taux": t["taux"], "montant": m})
    from .retenues import echeance
    from .services import journee_courante
    from .fuseau import jour_agence
    rv = une("select * from reversement_taxe where institution_id = %s and taxe_id = %s and annee = %s and mois = %s", (u["institution_id"], t["id"], an, mois))
    j = journee_courante(u)
    jour, ech = (j["date"] if j else jour_agence(u).isoformat()), echeance(an, mois)
    # Plan d'allègement 7.10 : échéance (O.-L. 10/001, art. 60 ; loi 004/2003, art. 22 bis : le 15 du mois qui suit) et référence de la quittance
    statut = "reverse" if rv else ("aucune" if not out else "en_retard" if jour > ech else "a_reverser")
    return {"taxe": f"{t['designation']} {t['taux']} %", "lignes": out, "totalBase": sum(x["base"] for x in out), "total": sum(x["montant"] for x in out),
            "echeance": ech, "statut": statut, "reverseLe": rv["reverse_le"].isoformat() if rv else "", "reference": rv["reference"] if rv else "",
            "notePar": nom_utilisateur(rv["note_par"]) if rv else ""}


def reverser_taxe(u, d: dict) -> dict:
    """Plan d'allègement 7.10 : la déclaration ou la quittance d'une taxe du mois se note une fois, par une date et une référence (comme les retenues, SF01)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    e = declaration_taxes(u, d)
    if e["statut"] == "aucune":
        raise ErreurMetier("Aucune ligne ce mois-là.")
    if e["statut"] == "reverse":
        raise ErreurMetier("Reversement déjà noté.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_) or not ref:
        raise ErreurMetier("À remplir : date du reversement et référence de la déclaration ou de la quittance.")
    from .services import journee_courante
    j = journee_courante(u)
    if j and date_ > j["date"]:
        raise ErreurMetier("La date du reversement ne peut pas dépasser la journée ouverte.")
    executer("insert into reversement_taxe (institution_id, taxe_id, annee, mois, reverse_le, reference, note_par) values (%s, %s, %s, %s, %s, %s, %s)",
             (u["institution_id"], int(d["taxeId"]), int(d["exercice"]), int(d["mois"]), date_, ref, u["id"]))
    return declaration_taxes(u, d)


def bon_de_commande(u, cid: int) -> dict:
    """État de validation du bon de commande (p. 150) : Bon de commande, Date, Fournisseur ; Quantité, Désignation, P.U, TVA, Montant HT, Montant TTC"""
    exiger(u)
    c = une("select * from commande_fournisseur where id = %s and institution_id = %s", (cid, u["institution_id"]))
    if not c:
        raise ErreurMetier("Commande introuvable.")
    from .releves import entete
    return {"entete": entete(u["institution_id"]), "commande": vue_commande(c)}
