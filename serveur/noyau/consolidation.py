"""Consolidation d'un réseau par sa faîtière (demande du porteur du 26/11/2026 ; registre T235). Mêmes règles que web/src/donnees/api.ts (consolidation).

Textes :
- Loi 002/2002, art. 65 : la COOPEC adresse son rapport annuel à la COOCEC ou à la Fédération à laquelle elle est affiliée, « qui se charge d'élaborer le
  rapport annuel sur une base consolidée pour le réseau ».
- Instr. BCC 0011, art. 47 : le rapport annuel de la faîtière contient « un relevé de l'actif et du passif et celui des résultats de la faîtière et des
  assujettis présentés sur une base consolidée suivant les principes comptables généralement reconnus ».
- PCCI § 10.3 « Appartenance au réseau » : les institutions dotées d'un organe faîtier identifient les opérations faites avec les affiliées du même
  réseau et avec les fonds de garantie du réseau. Ici, l'attribut est porté par le compte de l'institution (Plan des comptes, case « Réseau »).
- Instr. BCC 006 : le PCCI est le plan de toutes les institutions ; les balances s'additionnent donc compte du PCCI par compte du PCCI.
- PCCI § 4.3.8 : pas de compensation entre actif et passif ; les soldes débiteurs et créditeurs restent chacun de leur côté.

Aucun texte lu ne donne la méthode de consolidation. Le logiciel s'en tient à ce qui est commun à toute consolidation : additionner les balances, puis
retirer les comptes que les institutions ont elles-mêmes marqués « Réseau ». Il ne décide d'aucune élimination. Les comptes réciproques doivent
s'accorder (total des débits retirés égal au total des crédits retirés, au bilan d'une part, en gestion d'autre part) : sinon l'écart est montré et
les états consolidés ne s'établissent pas.

Chaque institution garde sa propre installation (ARCHITECTURE, décision D2) : l'affiliée exporte sa balance en fichier, la faîtière l'importe."""
import csv
import io
import json
import re
from collections import defaultdict
from datetime import date

from . import etats_financiers as ef
from .bd import ErreurMetier, executer, lignes, une, valeur
from .etats_compta import d_
from .services import exiger, nom_utilisateur, profil_institution

ENTETE = ["Exofina", "balance pour consolidation", "1"]
COLONNES = ["Compte", "PCCI", "Libellé", "Débit", "Crédit", "Réseau"]
MONTANT_MAX = 9_000_000_000_000_000
LIGNES_MAX = 20_000
TAILLE_MAX = 2_000_000


def est_faitiere(u) -> bool:
    return profil_institution(u) == "faitiere"


def identite(u) -> dict:
    r = une("select sigle, nom, coalesce(numero_agrement, '') as agrement, coalesce(faitiere_affiliation, '') as faitiere from institution where id = %s", (u["institution_id"],))
    return {"sigle": (r["sigle"] or "").strip(), "denomination": r["nom"], "agrement": r["agrement"], "faitiere": r["faitiere"]}


def pcci_de(numero: str, pcci: set) -> str:
    """Le compte du PCCI sous lequel un compte de l'institution est ouvert : le plus long numéro du PCCI qui commence le sien"""
    for n in range(len(numero), 1, -1):
        if numero[:n] in pcci:
            return numero[:n]
    return ""


def balance_propre(u, au: date) -> dict:
    """La balance de l'institution à la date, telle qu'elle part à la faîtière. Comptes de bilan (classes 1 à 5) : soldes définitifs, écritures de clôture
    comprises, les soldes débiteurs et créditeurs des comptes de clients et de tiers chacun de son côté (PCCI § 4.3.8). Comptes de gestion (classes 6 à 8) :
    mouvements de l'exercice, hors écritures de clôture. Le hors bilan n'est pas consolidé (Instr. BCC 0011, art. 47 : actif, passif et résultats)."""
    ex, i = au.year, u["institution_id"]
    s, resultat, anterieurs = ef.soldes(u, au, ex, vidage=True)
    parts = ef.parts_tiers(u, au, vidage=True)
    gestion = ef.mouvements_gestion(u, date(ex, 1, 1), au, vidage=False)
    pcci = {r["numero"] for r in lignes("select numero from compte where institution_id is null")}
    propres = {r["numero"]: r for r in lignes("select numero, libelle, reseau from compte where institution_id = %s", (i,))}
    noms = ef.intitules(u)
    lg = []
    for n in sorted(set(s) | set(gestion)):
        if n[0] not in "12345678":
            continue
        if n[0] in ef.GESTION:
            v = gestion.get(n, 0)
            debit, credit = max(v, 0), max(-v, 0)
        elif n in parts:
            debit, credit = parts[n][0], -parts[n][1]
        else:
            debit, credit = max(s[n], 0), max(-s[n], 0)
        if debit or credit:
            lg.append({"compte": n, "pcci": pcci_de(n, pcci), "libelle": noms.get(n, ""), "debit": debit, "credit": credit, "reseau": bool(propres.get(n, {}).get("reseau"))})
    return {**identite(u), "date": au.isoformat(), "resultat": resultat, "anterieurs": anterieurs, "lignes": lg}


def equilibre(b: dict) -> int:
    """Ce qui manque pour que le bilan de la balance s'équilibre : actif moins passif, résultat compris. Zéro pour une balance juste."""
    bilan = sum(l["debit"] - l["credit"] for l in b["lignes"] if l["compte"][0] in "12345")
    return bilan - b["resultat"] - b["anterieurs"]


def decimal(v: int) -> str:
    return f"{'-' if v < 0 else ''}{abs(v) // 100}.{abs(v) % 100:02d}"


def ecrire(b: dict) -> str:
    """Le fichier remis à la faîtière : texte CSV, point-virgule, montants en francs congolais avec deux décimales"""
    out = io.StringIO(newline="")
    w = csv.writer(out, delimiter=";", lineterminator="\r\n")
    w.writerow(ENTETE)
    w.writerow(["Institution", b["sigle"], b["denomination"], b["agrement"]])
    w.writerow(["Arrêté", b["date"]])
    w.writerow(["Résultat en formation", decimal(b["resultat"])])
    w.writerow(["Résultats antérieurs non clôturés", decimal(b["anterieurs"])])
    w.writerow(COLONNES)
    for l in b["lignes"]:
        w.writerow([l["compte"], l["pcci"], l["libelle"], decimal(l["debit"]), decimal(l["credit"]), "O" if l["reseau"] else "N"])
    w.writerow(["Total", "", "", decimal(sum(l["debit"] for l in b["lignes"])), decimal(sum(l["credit"] for l in b["lignes"])), str(len(b["lignes"]))])
    return out.getvalue()


def montant(t: str, quoi: str, signe: bool = False) -> int:
    t = (t or "").strip()
    neg = signe and t.startswith("-")
    corps = t[1:] if neg else t
    if not re.fullmatch(r"[0-9]+(\.[0-9]{1,2})?", corps):
        raise ErreurMetier(f"{quoi} : montant illisible.")
    ent, _, dec = corps.partition(".")
    v = int(ent) * 100 + int(dec.ljust(2, "0"))
    if v > MONTANT_MAX:
        raise ErreurMetier(f"{quoi} : montant illisible.")
    return -v if neg else v


def lire_fichier(contenu, pcci: set) -> dict:
    """Relit un fichier de balance. Tout est contrôlé : le fichier vient d'une autre institution. Rien n'en est exécuté ni repris sans contrôle."""
    if not isinstance(contenu, str) or not contenu.strip():
        raise ErreurMetier("À remplir : Fichier de balance.")
    if len(contenu) > TAILLE_MAX:
        raise ErreurMetier("Fichier de balance : trop lourd.")
    rangs = [r for r in csv.reader(io.StringIO(contenu.lstrip("﻿"), newline=""), delimiter=";") if any(x.strip() for x in r)]
    if len(rangs) < 7 or [x.strip() for x in rangs[0][:3]] != ENTETE or [x.strip() for x in rangs[5][:6]] != COLONNES:
        raise ErreurMetier("Fichier de balance : ce n'est pas une balance pour consolidation.")
    inst, arr = [x.strip() for x in rangs[1]], [x.strip() for x in rangs[2]]
    if len(inst) < 3 or inst[0] != "Institution" or not inst[1] or not inst[2] or len(arr) < 2 or arr[0] != "Arrêté":
        raise ErreurMetier("Fichier de balance : ce n'est pas une balance pour consolidation.")
    if len(inst[1]) > 30 or len(inst[2]) > 200:
        raise ErreurMetier("Fichier de balance : sigle ou dénomination trop long.")
    jour = d_(arr[1], "Date d'arrêté du fichier")
    b = {"sigle": inst[1], "denomination": inst[2], "agrement": (inst[3] if len(inst) > 3 else "")[:60], "date": jour.isoformat(),
         "resultat": montant(rangs[3][1] if len(rangs[3]) > 1 else "", "Résultat en formation", True),
         "anterieurs": montant(rangs[4][1] if len(rangs[4]) > 1 else "", "Résultats antérieurs non clôturés", True), "lignes": []}
    corps, total = rangs[6:-1], [x.strip() for x in rangs[-1]]
    if total[:1] != ["Total"] or len(total) < 6:
        raise ErreurMetier("Fichier de balance : la ligne des totaux manque ; le fichier est incomplet.")
    if len(corps) > LIGNES_MAX:
        raise ErreurMetier("Fichier de balance : trop de lignes.")
    vus = set()
    for k, r in enumerate(corps, start=7):
        r = [x.strip() for x in r] + [""] * 6
        compte, reseau = r[0], r[5].upper()
        if not re.fullmatch(r"[1-8][0-9]{0,19}", compte):
            raise ErreurMetier(f"Fichier de balance, ligne {k} : compte illisible.")
        parent = pcci_de(compte, pcci)          # le rattachement se refait ici : la colonne PCCI du fichier n'est qu'une lecture
        if not parent:
            raise ErreurMetier(f"Fichier de balance, ligne {k} : le compte {compte} n'est rattaché à aucun compte du PCCI.")
        if compte in vus:
            raise ErreurMetier(f"Fichier de balance, ligne {k} : le compte {compte} est en double.")
        if reseau not in ("O", "N"):
            raise ErreurMetier(f"Fichier de balance, ligne {k} : colonne Réseau, O ou N.")
        vus.add(compte)
        b["lignes"].append({"compte": compte, "pcci": parent, "libelle": r[2][:200], "debit": montant(r[3], f"Fichier de balance, ligne {k}"),
                            "credit": montant(r[4], f"Fichier de balance, ligne {k}"), "reseau": reseau == "O"})
    if (montant(total[3], "Total"), montant(total[4], "Total"), total[5]) != (sum(l["debit"] for l in b["lignes"]), sum(l["credit"] for l in b["lignes"]), str(len(b["lignes"]))):
        raise ErreurMetier("Fichier de balance : les totaux ne correspondent pas aux lignes ; le fichier est incomplet ou modifié.")
    if equilibre(b):
        raise ErreurMetier(f"Fichier de balance : la balance de {b['sigle']} n'est pas équilibrée (écart de {decimal(abs(equilibre(b)))} CDF).")
    return b


def date_arrete(p) -> date:
    return d_((p or {}).get("au") if isinstance(p, dict) else None, "Date d'arrêté")


def exporter(u, p) -> dict:
    """Bouton « Exporter la balance » : le fichier que l'institution remet à sa faîtière"""
    exiger(u)
    au = date_arrete(p)
    b = balance_propre(u, au)
    if not b["sigle"]:
        raise ErreurMetier("À remplir : Code de l'institution (Paramétrage > Info société).")
    if equilibre(b):
        raise ErreurMetier("La balance n'est pas équilibrée à cette date : elle ne s'exporte pas.")
    return {"nom": f"balance-consolidation-{b['sigle']}-{b['date']}.csv", "contenu": ecrire(b)}


def exiger_faitiere(u):
    exiger(u)
    if not est_faitiere(u):
        raise ErreurMetier("La consolidation revient à la faîtière du réseau (loi 002/2002, art. 65).")


def importer(u, p) -> dict:
    """Bouton « Importer » : la balance d'une affiliée pour la date d'arrêté ; une nouvelle balance de la même affiliée remplace la précédente"""
    exiger_faitiere(u)
    au = date_arrete(p)
    b = lire_fichier((p or {}).get("contenu"), {r["numero"] for r in lignes("select numero from compte where institution_id is null")})
    if b["date"] != au.isoformat():
        raise ErreurMetier(f"Ce fichier est arrêté au {b['date'][8:]}/{b['date'][5:7]}/{b['date'][:4]}, pas à la date demandée.")
    if b["sigle"].upper() == identite(u)["sigle"].upper():
        raise ErreurMetier("Ce fichier est la balance de la faîtière elle-même : elle se lit dans ses livres.")
    executer("""insert into consolidation_balance (institution_id, date_arrete, sigle, denomination, agrement, resultat, anterieurs, lignes, importe_par)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (institution_id, date_arrete, sigle) do update set denomination = excluded.denomination, agrement = excluded.agrement,
                  resultat = excluded.resultat, anterieurs = excluded.anterieurs, lignes = excluded.lignes, importe_par = excluded.importe_par, importe_le = now()""",
             (u["institution_id"], au, b["sigle"], b["denomination"], b["agrement"], b["resultat"], b["anterieurs"], json.dumps(b["lignes"]), u["id"]))
    return etat(u, p)


def retirer(u, bid: int, p) -> dict:
    """Bouton « Retirer » : la balance importée par erreur sort de la consolidation"""
    exiger_faitiere(u)
    if not valeur("delete from consolidation_balance where id = %s and institution_id = %s returning id", (bid, u["institution_id"])):
        raise ErreurMetier("Balance introuvable.")
    return etat(u, p)


def balances(u, au: date) -> list[dict]:
    """La balance de la faîtière, lue dans ses livres, puis celles des affiliées importées pour la date"""
    out = [{**balance_propre(u, au), "id": None, "propre": True, "importeLe": "", "importePar": ""}]
    for r in lignes("select * from consolidation_balance where institution_id = %s and date_arrete = %s order by sigle", (u["institution_id"], au)):
        lg = r["lignes"] if isinstance(r["lignes"], list) else json.loads(r["lignes"])
        out.append({"sigle": r["sigle"], "denomination": r["denomination"], "agrement": r["agrement"], "date": au.isoformat(), "resultat": r["resultat"],
                    "anterieurs": r["anterieurs"], "lignes": lg, "id": r["id"], "propre": False, "importeLe": r["importe_le"].isoformat(),
                    "importePar": nom_utilisateur(r["importe_par"])})
    return out


def consolider(bs: list[dict]) -> dict:
    """Addition des balances, compte du PCCI par compte du PCCI, puis retrait des comptes marqués « Réseau ». Rend les soldes consolidés (débit, crédit),
    le détail de ce qui est retiré et les écarts de réciprocité (débits retirés moins crédits retirés), au bilan et en gestion."""
    cumul, retire = defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0])
    for b in bs:
        for l in b["lignes"]:
            cible = retire if l["reseau"] else cumul
            cible[l["pcci"]][0] += l["debit"]
            cible[l["pcci"]][1] += l["credit"]
    ecart = {"bilan": sum(d - c for n, (d, c) in retire.items() if n[0] in "12345"), "gestion": sum(d - c for n, (d, c) in retire.items() if n[0] in ef.GESTION)}
    return {"cumul": dict(cumul), "retire": dict(retire), "ecart": ecart, "resultat": sum(b["resultat"] for b in bs), "anterieurs": sum(b["anterieurs"] for b in bs)}


def etats_consolides(c: dict, c1: dict | None, noms: dict, au: date) -> dict:
    """Bilan et compte de résultat consolidés, aux modèles du PCCI (chap. 14), comme les états de l'institution (S122)"""
    tout = lambda n: True

    def postes(x):
        if x is None:
            return {cote: [{"valeur": 0, "comptes": {}} for _ in ef.MODELE["bilan"][cote]] for cote in ("actif", "passif")}, [{"valeur": 0, "comptes": {}} for _ in ef.MODELE["resultat"]]
        bil = {n: v for n, v in x["cumul"].items() if n[0] in "12345"}
        return (ef.postes_bilan({n: d - c for n, (d, c) in bil.items()}, x["resultat"], x["anterieurs"], tout, {n: (d, -c) for n, (d, c) in bil.items()}),
                ef.rubriques({n: d - c for n, (d, c) in x["cumul"].items() if n[0] in ef.GESTION}, tout)[0])

    (a, r), (a1, r1) = postes(c), postes(c1)
    actif = ef.presenter(ef.MODELE["bilan"]["actif"], a["actif"], a1["actif"], noms)
    passif = ef.presenter(ef.MODELE["bilan"]["passif"], a["passif"], a1["passif"], noms)
    lg = []
    for i, m in enumerate(ef.MODELE["resultat"]):
        cles = sorted(set(r[i]["comptes"]) | set(r1[i]["comptes"]))
        lg.append({"signe": m.get("signe", ""), "solde": "solde" in m, "libelle": m["libelle"], "n": r[i]["valeur"], "n1": r1[i]["valeur"],
                   "comptes": [{"compte": k, "intitule": noms.get(k, ""), "n": r[i]["comptes"].get(k, 0), "n1": r1[i]["comptes"].get(k, 0)} for k in cles]})
    ta, tp = {k: sum(x[k] for x in actif) for k in ("n", "n1")}, {k: sum(x[k] for x in passif) for k in ("n", "n1")}
    return {"bilan": {"au": au.isoformat(), "precedent": ef.fin_precedent(au.year).isoformat(), "actif": actif, "passif": passif, "totalActif": ta, "totalPassif": tp,
                      "equilibre": ta == tp},
            "resultat": {"du": date(au.year, 1, 1).isoformat(), "au": au.isoformat(), "lignes": lg}}


def etat(u, p) -> dict:
    """L'onglet « Réseau » des États financiers. Pour toute institution : l'export de sa balance. Pour la faîtière : les balances réunies, ce qui est
    retiré, les écarts de réciprocité et, quand les comptes réciproques s'accordent, le bilan et le compte de résultat consolidés."""
    exiger(u)
    moi = identite(u)
    out = {"faitiere": est_faitiere(u), "sigle": moi["sigle"], "affiliation": moi["faitiere"]}
    if not out["faitiere"] or not (isinstance(p, dict) and p.get("au")):
        return out
    au = date_arrete(p)
    bs = balances(u, au)
    c = consolider(bs)
    noms = ef.intitules(u)
    vue = lambda b: {"id": b["id"], "sigle": b["sigle"], "denomination": b["denomination"], "agrement": b["agrement"], "propre": b["propre"],
                     "debit": sum(l["debit"] for l in b["lignes"]), "credit": sum(l["credit"] for l in b["lignes"]),
                     "reseauDebit": sum(l["debit"] for l in b["lignes"] if l["reseau"]), "reseauCredit": sum(l["credit"] for l in b["lignes"] if l["reseau"]),
                     "importeLe": b["importeLe"], "importePar": b["importePar"]}
    out.update({"au": au.isoformat(), "balances": [vue(b) for b in bs],
                "retire": [{"compte": n, "intitule": noms.get(n, ""), "debit": d, "credit": k} for n, (d, k) in sorted(c["retire"].items())],
                "ecart": c["ecart"], "accord": not c["ecart"]["bilan"] and not c["ecart"]["gestion"], "etats": None})
    if out["accord"] and len(bs) > 1:
        # Colonne N-1 : la consolidation arrêtée à la fin de l'exercice précédent, quand des balances d'affiliées y ont été importées et qu'elle s'accorde
        avant = balances(u, ef.fin_precedent(au.year))
        c1 = consolider(avant) if len(avant) > 1 else None
        if c1 and (c1["ecart"]["bilan"] or c1["ecart"]["gestion"]):
            c1 = None
        out["etats"] = etats_consolides(c, c1, noms, au)
    return out
