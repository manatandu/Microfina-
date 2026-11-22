"""B13 : rapport d'activités annuel, au modèle de l'annexe de l'Instruction BCC 009 (art. 3 : « conformément au modèle repris en annexe »).
Le logiciel remplit les tableaux qu'il sait tirer de ses données : identité et effectifs, bilan résumé, compte de résultat résumé, ratios prudentiels
(normes.py, Instr. BCC 002), indicateurs de performance (rapports_credit.indicateurs, Instr. BCC 004). Les rubriques à rédiger (environnement économique,
présentation, difficultés, faits saillants, conclusion et perspectives) et les réponses Oui/Non restent à l'institution : elles sortent vides.
Le modèle (libellés, comptes rattachés) est dans replica/etats-pcci.json, clé « rapportActivites », lu aussi par le navigateur. Registre T110."""
from datetime import date

from .bd import ErreurMetier, lignes, une
from .etats_financiers import MODELE, an_dernier, mouvements_gestion, rubriques, soldes

RA = MODELE["rapportActivites"]
CONTRE = tuple(RA["contre"])


def poste_actif(s: dict, pref: tuple) -> int:
    """Classe 2 : valeur nette. Classes 3 à 5 : soldes débiteurs, moins les provisions de la classe (comptes 38, 48, 58)"""
    return sum(v if k[0] == "2" or k.startswith(CONTRE) else max(v, 0) for k, v in s.items() if k[0] in "2345" and k.startswith(pref))


def poste_passif(s: dict, pref: tuple) -> int:
    """Classe 1 : solde créditeur net. Classes 3 à 5 : soldes créditeurs, hors provisions (portées en moins de l'actif)"""
    return sum(-v if k[0] == "1" else max(-v, 0) for k, v in s.items() if k[0] in "1345" and not k.startswith(CONTRE) and k.startswith(pref))


def bilan(s: dict, resultat: int, anterieurs: int) -> list:
    """Une valeur par ligne du modèle (None pour un titre). Fonds propres : classe 1 hors emprunts (16), plus le résultat pas encore viré."""
    actif = sum(poste_actif(s, (k,)) for k in "2345")
    fp = poste_passif(s, ("1",)) - poste_passif(s, ("16",)) + resultat + anterieurs
    passif = fp + poste_passif(s, ("16",)) + sum(poste_passif(s, (k,)) for k in "345")
    out = []
    for r in RA["bilan"]:
        if r.get("titre"):
            out.append(None)
        elif "total" in r:
            out.append(actif if r["total"] == "actif" else passif)
        elif r.get("fondsPropres"):
            out.append(fp)
        elif "actif" in r:
            out.append(poste_actif(s, tuple(r["actif"])))
        else:
            out.append(poste_passif(s, tuple(r["passif"])) + (resultat if r.get("resultat") else 0))
    return out


def compte_resultat(mv: dict) -> list:
    """Une valeur par ligne du modèle : soldes du compte de résultat du logiciel (etats_financiers.rubriques), détails par compte du PCCI"""
    soldes_ = {m["libelle"]: x["valeur"] for m, x in zip(MODELE["resultat"], rubriques(mv, lambda n: True)[0]) if "solde" in m}
    somme = lambda pref: sum(v for k, v in mv.items() if k.startswith(tuple(pref)))
    out = []
    for r in RA["resultat"]:
        if "solde" in r:
            out.append(soldes_[r["solde"]] + somme(r.get("plus", [])))
        elif "produits" in r:
            out.append(-somme(r["produits"]))
        else:
            out.append(somme(r["charges"]))
    return out


def pct(a, b):
    return round(a * 10000 / b) / 100 if b else None


def variation(n, n1):
    return pct(n - n1, abs(n1)) if n is not None and n1 else None


def ratios(nn: dict) -> list:
    """Ratios du modèle lus sur l'état des normes (normes.etat) : (norme, valeur) par ligne ; « Capitalisation » n'est défini par aucune Instruction en
    vigueur (Instr. BCC 002) : ligne vide"""
    par = {x["code"]: x for x in nn["normes"]}
    out = []
    for r in RA["ratios"]:
        x = par.get(r.get("code") or "")
        if r.get("fondsPropres"):
            out.append(("", nn["fondsPropres"]["prudentiels"]))
        elif x and x["applicable"]:
            out.append((("≥ " if x["sens"] == "min" else "≤ ") + f"{x['norme']} %".replace(".", ","), x["ratio"]))
        else:
            out.append(("", None))
    return out


def identite(u, au: date, au1: date) -> list:
    """Tableau « RUBRIQUES, N, N-1 » : ce que le logiciel tient. Sans historique, l'identité et les réseaux ne se lisent qu'à la date d'aujourd'hui (colonne N).
    Le personnel se lit aux deux dates sur les dates d'embauche et de fin de contrat (Paie)."""
    i = u["institution_id"]
    ins = une("select * from institution where id = %s", (i,))
    adresse = ", ".join(x for x in ((f"{ins['numero_rue']} {ins['rue'] or ''}".strip() if ins.get("numero_rue") else ins.get("rue")), ins.get("quartier"), ins.get("commune"),
                                    ins.get("ville"), ins.get("province")) if x) or (ins.get("adresse") or "")
    compter = lambda sql, p: lignes(sql, p)[0]["n"]
    # Sexe : « M » ou « F » sur la fiche du client, « Masculin » ou « Féminin » sur la fiche de l'employé (Paie) : la première lettre suffit
    organes = {r["sexe"]: r["n"] for r in lignes("""select left(coalesce(p.sexe, ''), 1) as sexe, count(*) as n from tiers t left join tiers_personne p on p.tiers_id = t.id
                                                    where t.institution_id = %s and t.apparente in ('administrateur', 'dirigeant') group by 1""", (i,))}

    def personnel(d: date) -> dict:
        r = lignes("""select left(coalesce(sexe, ''), 1) as sexe, count(*) as n, coalesce(sum(salaire_base), 0) as s from paie_employe
                      where institution_id = %s and (date_embauche is null or date_embauche <= %s) and (date_fin_contrat is null or date_fin_contrat > %s) group by 1""", (i, d, d))
        n = sum(x["n"] for x in r)
        return {"n": n, "f": sum(x["n"] for x in r if x["sexe"] == "F"), "h": sum(x["n"] for x in r if x["sexe"] == "M"),
                "moyen": round(sum(int(x["s"]) for x in r) / n) if n else None}
    p, p1 = personnel(au), personnel(au1)
    L = lambda libelle, n=None, n1=None, type_="texte": {"libelle": libelle, "valeurs": [n, n1], "type": type_}
    return [L("Dénomination de la COOPEC/ IMF", ins["nom"]), L("Date du début des activités"), L("Coordonnées téléphoniques", ins.get("telephone_fixe") or ""),
            L("Adresses électroniques", ins.get("email") or ""), L("Adresse physique", adresse), L("Nombre de"),
            L("- Agences", compter("select count(*) as n from agence where institution_id = %s and not supprime", (i,)), None, "nombre"),
            L("- Guichets", compter("select count(*) as n from guichet g join agence a on a.id = g.agence_id where a.institution_id = %s and g.actif", (i,)), None, "nombre"),
            L("- Antennes"),
            L("Organes statutaires dont :", sum(organes.values()), None, "nombre"), L("- Femmes", organes.get("F", 0), None, "nombre"),
            L("- Hommes", organes.get("M", 0), None, "nombre"),
            L("Personnel dont :", p["n"], p1["n"], "nombre"), L("- Femmes", p["f"], p1["f"], "nombre"), L("- Hommes", p["h"], p1["h"], "nombre"),
            L("Salaire moyen (salaire de base, CDF)", p["moyen"], p1["moyen"], "montant")]


def rapport(u, du: date, au: date, ex: int) -> dict:
    """Sections du rapport, dans l'ordre du modèle. N : la période demandée ; N-1 : les mêmes dates un an plus tôt."""
    from . import normes
    from .rapports_credit import indicateurs
    du1, au1 = an_dernier(du), an_dernier(au)
    b, b1 = bilan(*soldes(u, au, ex, vidage=True)), bilan(*soldes(u, au1, ex - 1, vidage=True))
    r, r1 = compte_resultat(mouvements_gestion(u, du, au, vidage=False)), compte_resultat(mouvements_gestion(u, du1, au1, vidage=False))
    tot = lambda v, m: v[next(k for k, x in enumerate(RA["bilan"]) if x.get("total") == ("actif" if m else "passif"))]
    cote, lb = True, []
    for k, m in enumerate(RA["bilan"]):
        if m.get("titre"):
            cote = m["libelle"] == "ACTIF"
            lb.append({"libelle": m["libelle"], "titre": True, "valeurs": [None] * 5})
            continue
        lb.append({"libelle": m["libelle"], "gras": "total" in m, "valeurs": [b[k], pct(b[k], tot(b, cote)), b1[k], pct(b1[k], tot(b1, cote)), variation(b[k], b1[k])]})
    lr = [{"libelle": m["libelle"], "gras": "solde" in m, "valeurs": [r[k], r1[k], variation(r[k], r1[k])]} for k, m in enumerate(RA["resultat"])]
    rn = ratios(normes.etat(u, {"date": au.isoformat()}))
    try:                                                  # N-1 : sans cours du dollar à cette date (avant le démarrage), la colonne reste vide
        rn1 = ratios(normes.etat(u, {"date": au1.isoformat()}))
    except ErreurMetier:
        rn1 = [("", None)] * len(RA["ratios"])
    lp = [{"libelle": m["libelle"], "valeurs": [rn[k][0], rn[k][1], rn1[k][1]], "type": "montant" if m.get("fondsPropres") else "taux"} for k, m in enumerate(RA["ratios"])]
    ind = lambda a, z: {x["v"][1]: x["v"][4] for x in indicateurs(u, {"du": a.isoformat(), "au": z.isoformat()})["lignes"]}
    i, i1 = ind(du, au), ind(du1, au1)
    li = [{"libelle": m["libelle"], "valeurs": [m["type"], i.get(m["ratio"]), i1.get(m["ratio"])]} for m in RA["indicateurs"]]
    C = lambda *c: [{"titre": t, "type": y} for t, y in c]
    return {"sections": [
        *RA["rediger"],
        {"titre": "", "colonnes": C(("N", "texte"), ("N-1", "texte")), "lignes": identite(u, au, au1)},
        {"titre": "AUTRES INFORMATIONS (à spécifier)", "colonnes": C(("OUI", "texte"), ("NON", "texte")), "lignes": [{"libelle": x, "valeurs": [None, None]} for x in RA["autres"]]},
        {"titre": "BILAN", "colonnes": C(("N", "montant"), ("%", "taux"), ("N-1", "montant"), ("%", "taux"), ("Var. %", "taux")), "lignes": lb},
        {"titre": "5. COMPTE DE GESTION OU COMPTE DE RESULTAT", "colonnes": C(("N", "montant"), ("N - 1", "montant"), ("VAR. %", "taux")), "lignes": lr},
        {"titre": "RATIOS PRUDENTIELS", "colonnes": C(("NORME", "texte"), ("N", "taux"), ("N-1", "taux")), "lignes": lp},
        {"titre": "INDICATEURS DE PERFORMANCE", "colonnes": C(("TYPE D'INDICATEUR", "texte"), ("N", "taux"), ("N-1", "taux")), "lignes": li},
        {"titre": RA["conclusion"]}]}
