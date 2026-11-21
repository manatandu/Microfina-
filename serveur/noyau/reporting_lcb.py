"""Confrontation du 21/11/2026, A11 : reporting LCB-FT mensuel à la Banque Centrale du Congo (Instr. BCC 15, art. 95, b ; annexe DSIF « Reporting LCB-FT
mensuel », p. 128 à 132 : codes LAB). Le logiciel calcule ce qu'il connaît ; les autres cellules se saisissent et restent gardées pour le mois.
Mêmes règles que web/src/donnees/api.ts (reportingLcb)."""
import json
from calendar import monthrange
from datetime import date

from django.conf import settings

from .bd import ErreurMetier, executer, lignes, valeur

# Les cinq tableaux de l'annexe, une seule copie lue aussi par le navigateur (web/src/donnees/api.ts)
MODELE = json.loads((settings.RACINE_DEPOT / "replica" / "reporting-lcb.json").read_text(encoding="utf-8"))
TABLEAUX = {t["cle"]: (t["titre"], [(l["code"], l["libelle"], l["rubrique"]) for l in t["lignes"]]) for t in MODELE["tableaux"]}
# Opérations de caisse de la clientèle : entrées (crédit) et sorties (débit) d'espèces
ENTREES = ("depot", "adhesion", "achat_parts", "remboursement_credit", "ed_encaissement")
SORTIES = ("retrait", "retrait_parts", "deblocage_credit", "ed_decaissement")
PROVINCES_SUIVIES = ("Nord-Kivu", "Sud-Kivu", "Ituri", "Maniema", "Haut-Uele", "Bas-Uele")   # annexe, Localisation, LAB9 à LAB14


def _niveaux(ins: int, fin: date) -> dict:
    """Dernier niveau de risque de chaque client à la fin du mois (Instr. BCC 15, art. 28)"""
    return {r["tiers_id"]: r["niveau"] for r in lignes("""select distinct on (p.tiers_id) p.tiers_id, p.niveau from profil_risque p join tiers t on t.id = p.tiers_id
                                                          where t.institution_id = %s and p.evalue_le <= %s order by p.tiers_id, p.evalue_le desc, p.id desc""", (ins, fin))}


def calculer(u: dict, annee: int, mois: int) -> dict:
    """Cellules calculées : {(tableau, code): valeur}"""
    from .conformite import ppe_active
    from .services import cours, en_usd
    ins = u["institution_id"]
    debut, fin = date(annee, mois, 1), date(annee, mois, monthrange(annee, mois)[1])
    ops = lignes("""select o.tiers_id, o.type, o.montant, o.devise, j.date_comptable from operation o join journee_comptable j on j.id = o.journee_id
                    where o.institution_id = %s and o.statut = 'validee' and o.tiers_id is not null and j.date_comptable between %s and %s""", (ins, debut, fin))
    cdf = lambda o: o["montant"] / 100 * cours(o["devise"], o["date_comptable"])
    usd = lambda o: en_usd(o["montant"], o["devise"])
    clients = lignes("select id, type, type_client, residence from tiers where institution_id = %s and statut not in ('prospect', 'resilie') and cree_le::date <= %s", (ins, fin))
    niv = _niveaux(ins, fin)
    ppe = {t["id"] for t in clients if ppe_active(t["id"])}
    par_niveau = lambda n: sum(cdf(o) for o in ops if niv.get(o["tiers_id"]) == n)
    nb_niveau = lambda n: sum(1 for t in clients if niv.get(t["id"]) == n)
    comptes = lignes("""select c.id, t.residence from compte_depot c join tiers t on t.id = c.tiers_id where t.institution_id = %s
                        and c.ouvert_le <= %s and (c.clos_le is null or c.clos_le > %s)""", (ins, fin, fin))
    prov = {r["id"]: (r["province"] or "") for r in lignes("""select t.id, a.province from tiers t join agence a on a.id = t.agence_id
                                                               where t.institution_id = %s""", (ins,))}
    r = {("dispositif", "LAB5"): sum(1 for o in ops if usd(o) >= 10000), ("dispositif", "LAB6"): sum(1 for o in ops if 9000 < usd(o) < 10000),
         ("dispositif", "LAB7"): nb_niveau("eleve"), ("dispositif", "LAB8"): nb_niveau("moyen"), ("dispositif", "LAB9"): nb_niveau("faible"),
         ("dispositif", "LAB10"): par_niveau("eleve"), ("dispositif", "LAB11"): par_niveau("moyen"), ("dispositif", "LAB12"): par_niveau("faible"),
         ("dispositif", "LAB13"): sum(cdf(o) for o in ops), ("dispositif", "LAB14"): sum(cdf(o) for o in ops if o["tiers_id"] in ppe),
         ("dispositif", "LAB15"): len(ppe),
         ("dispositif", "LAB17"): valeur("select count(*) from declaration_soupcon where institution_id = %s and transmise_le between %s and %s", (ins, debut, fin)),
         ("dispositif", "LAB21"): len(comptes), ("dispositif", "LAB22"): sum(1 for c in comptes if c["residence"] == "non_resident"),
         ("localisation", "LAB8"): sum(1 for t in clients if prov.get(t["id"]) not in PROVINCES_SUIVIES),
         ("portefeuille", "LAB2"): len(ppe), ("portefeuille", "LAB4"): sum(1 for t in clients if t["residence"] == "non_resident"),
         ("portefeuille", "LAB6"): sum(1 for t in clients if t["type"] == "physique"), ("portefeuille", "LAB7"): sum(1 for t in clients if t["type"] == "morale"),
         ("portefeuille", "LAB10"): sum(1 for t in clients if t["type"] == "groupe" and t["type_client"] == "Association"),
         ("portefeuille", "LAB12"): nb_niveau("eleve"), ("portefeuille", "LAB13"): nb_niveau("moyen"), ("portefeuille", "LAB14"): nb_niveau("faible"),
         # crédits débloqués et pas encore soldés ni passés en perte
         ("produits", "LAB4"): valeur("select count(*) from credit where institution_id = %s and statut = 'debloque' and debloque_le <= %s", (ins, fin)),
         ("produits", "LAB7"): sum(1 for o in ops if o["type"] in SORTIES and usd(o) > 10000), ("produits", "LAB8"): sum(1 for o in ops if o["type"] in SORTIES),
         ("produits", "LAB9"): sum(1 for o in ops if o["type"] in ENTREES and usd(o) > 10000), ("produits", "LAB10"): sum(1 for o in ops if o["type"] in ENTREES),
         ("produits", "LAB16"): par_niveau("faible"), ("produits", "LAB17"): par_niveau("moyen"), ("produits", "LAB18"): par_niveau("eleve")}
    for i, p in enumerate(PROVINCES_SUIVIES, start=9):
        r[("localisation", f"LAB{i}")] = sum(1 for t in clients if prov.get(t["id"]) == p)
    return r


def lire(u: dict, annee: int, mois: int) -> dict:
    from .services import exiger
    exiger(u)
    if not (2000 <= annee <= 2100 and 1 <= mois <= 12):
        raise ErreurMetier("Mois invalide.")
    calc = calculer(u, annee, mois)
    saisies = {(r["tableau"], r["code"]): r["valeur"] for r in lignes(
        "select tableau, code, valeur from reporting_lcb_saisie where institution_id = %s and annee = %s and mois = %s", (u["institution_id"], annee, mois))}
    nombre = lambda v: f"{v:.2f}".replace(".", ",") if isinstance(v, float) else str(v)
    sans_province = [r["nom"] for r in lignes("select nom from agence where institution_id = %s and coalesce(province, '') = '' order by code", (u["institution_id"],))]
    return {"annee": annee, "mois": mois, "agencesSansProvince": sans_province, "tableaux": [
        {"cle": k, "titre": titre, "lignes": [{"code": c, "libelle": l, "rubrique": rub, "calcule": (k, c) in calc,
                                               "valeur": "" if rub else nombre(calc[(k, c)]) if (k, c) in calc else saisies.get((k, c), "")} for c, l, rub in lignes_]}
        for k, (titre, lignes_) in TABLEAUX.items()]}


def enregistrer(u: dict, d: dict) -> dict:
    """Garde les cellules saisies du mois ; une cellule calculée ne se saisit pas"""
    from .services import exiger
    exiger(u)
    d = d if isinstance(d, dict) else {}
    annee, mois, cellules = d.get("annee"), d.get("mois"), d.get("saisies") or {}
    if not isinstance(annee, int) or not isinstance(mois, int) or not 1 <= mois <= 12 or not isinstance(cellules, dict):
        raise ErreurMetier("Mois invalide.")
    calc = calculer(u, annee, mois)
    for cle, v in cellules.items():
        tableau, _, code = str(cle).partition(":")
        if tableau not in TABLEAUX or not any(c == code and not rub for c, _, rub in TABLEAUX[tableau][1]):
            raise ErreurMetier(f"Cellule inconnue : {cle}.")
        if (tableau, code) in calc:
            raise ErreurMetier(f"{tableau} {code} : cellule calculée par le logiciel.")
        v = str(v or "").strip()
        if v:
            executer("""insert into reporting_lcb_saisie (institution_id, annee, mois, tableau, code, valeur, saisi_par) values (%s, %s, %s, %s, %s, %s, %s)
                        on conflict (institution_id, annee, mois, tableau, code) do update set valeur = excluded.valeur, saisi_par = excluded.saisi_par, saisi_le = now()""",
                     (u["institution_id"], annee, mois, tableau, code, v, u["id"]))
        else:
            executer("delete from reporting_lcb_saisie where institution_id = %s and annee = %s and mois = %s and tableau = %s and code = %s",
                     (u["institution_id"], annee, mois, tableau, code))
    return lire(u, annee, mois)
