"""S84 : Crédit > Plan d'amortissement (manuel Microfina++, p. 111 : « Simulation tableau d'amortissement pour un crédit donné »).
Mêmes règles que web/src/donnees/api.ts (simulationCredit). Registre S84-1 à S84-9 (décisions du porteur du 19/11/2026).

- Méthode dégressive (Instr. BCC 38, art. 11), à échéance constante : les intérêts portent sur le capital restant dû.
- Taux int. et Taux diff. du produit : taux mensuels, ramenés à la périodicité (taux mensuel × 12 / dénominateur).
- Différé (mois) : rien n'est payé ; ses intérêts, au taux différé, sont répartis à parts égales sur les échéances.
- TEG (Instr. BCC 38, art. 2, 4, 6, 9 et annexe) : le taux de période qui égalise ce que le client reçoit au déblocage (montant moins frais,
  assurance et épargne obligatoire) et ce qu'il verse (échéances), l'épargne obligatoire lui revenant à la dernière échéance.
  T.E.G R : taux de période × dénominateur (art. 2) ; T.E.G A : taux annuel actuariel (annexe). Deux décimales. Pas de TEG pour un taux
  réglementé ou bonifié (art. 5)."""
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from .bd import ErreurMetier, lignes as lire, une
from .plans_epargne import PERIODICITES, date_rang, nombre_echeances
from .services import exiger, journee_courante


def arrondi(x) -> int:
    return int(Decimal(x).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def charge(nature, valeur, montant: int) -> int:
    """Frais, assurance ou épargne obligatoire du produit : un montant (en unités) ou un taux du montant du prêt (S23-5, S23-6)"""
    if valeur is None:
        return 0
    v = Decimal(valeur)
    return arrondi(v * 100) if (nature or "Montant") == "Montant" else arrondi(Decimal(montant) * v / 100)


def taux_periode(flux: list[int]) -> float:
    """Taux de période r tel que la somme des flux actualisés soit nulle (flux[k] au rang k ; méthode des intérêts composés, Instr. BCC 38, art. 4)"""
    f = lambda r: sum(x / (1 + r) ** k for k, x in enumerate(flux))
    bas, haut = 0.0, 10.0                     # un taux de période entre 0 et 1 000 %
    if f(bas) * f(haut) > 0:
        return 0.0
    for _ in range(200):
        m = (bas + haut) / 2
        if f(bas) * f(m) <= 0:
            haut = m
        else:
            bas = m
    return (bas + haut) / 2


def entier(d, k, nom) -> int:
    v = (d or {}).get(k)
    if not isinstance(v, int) or isinstance(v, bool):
        raise ErreurMetier(f"À remplir : {nom}.")
    return v


def simuler(u, d) -> dict:
    exiger(u)
    pid = (d or {}).get("produitId")
    p = une("select * from produit_credit where id = %s and institution_id = %s", (pid, u["institution_id"])) \
        if isinstance(pid, int) and not isinstance(pid, bool) else None
    if not p:
        raise ErreurMetier("À remplir : Produit.")
    code = (d or {}).get("periodicite") or p["periodicite"]
    per = PERIODICITES.get(code)
    if not per:
        raise ErreurMetier("À remplir : Périodicité.")
    montant = entier(d, "montant", "Montant du prêt")
    duree = entier(d, "duree", "Durée")
    differe = (d or {}).get("differe") or 0
    if not isinstance(differe, int) or isinstance(differe, bool) or differe < 0:
        raise ErreurMetier("Différé : un nombre de mois, zéro ou plus.")
    unites = Decimal(montant) / 100
    if montant <= 0 or unites < Decimal(p["montant_min"]) or unites > Decimal(p["montant_max"]):
        raise ErreurMetier(f"Montant du prêt : entre {p['montant_min']:,} et {p['montant_max']:,} {p['devise'].strip()} pour ce produit.".replace(",", " "))
    if duree < p["duree_min"] or duree > p["duree_max"]:
        raise ErreurMetier(f"Durée : entre {p['duree_min']} et {p['duree_max']} mois pour ce produit.")
    if differe < p["differe_min"] or differe > p["differe_max"]:
        raise ErreurMetier(f"Différé : entre {p['differe_min']} et {p['differe_max']} mois pour ce produit.")
    n = nombre_echeances(duree, code)
    nd = Decimal(differe) * Decimal(per["denominateur"]) / 12
    if nd != nd.to_integral_value():
        raise ErreurMetier(f"Différé : {differe} mois ne se découpe pas en périodes « {per['libelle']} ».")
    nd = int(nd)
    j = journee_courante(u)
    try:
        deblocage = date.fromisoformat((d or {}).get("dateDeblocage") or (j["date"] if j else date.today().isoformat()))
    except ValueError:
        raise ErreurMetier("Date deblocage : une date.")
    den = Decimal(per["denominateur"])
    r = Decimal(p["taux_interet"]) * 12 / den / 100                       # taux de période (registre S84-2)
    rd = Decimal(p["taux_differe"]) * 12 / den / 100
    interet_differe = arrondi(Decimal(montant) * rd * nd)                 # registre S84-3
    part_differe = [interet_differe // n + (1 if k < interet_differe % n else 0) for k in range(n)]
    a = Decimal(montant) / n if r == 0 else Decimal(montant) * r / (1 - (1 + r) ** -n)
    a = arrondi(a)
    lignes, reste = [], montant
    premiere = date_rang(deblocage, code, nd + 1)
    for k in range(n):
        i = arrondi(Decimal(reste) * r)
        c = reste if k == n - 1 else min(reste, a - i)
        lignes.append({"rang": k + 1, "date": date_rang(deblocage, code, nd + 1 + k).isoformat(), "capitalDebut": reste, "capital": c,
                       "interet": i + part_differe[k], "echeance": c + i + part_differe[k], "capitalFin": reste - c})
        reste -= c
    frais = sum(charge(f["nature"], f["valeur"], montant) for f in lire("select nature, valeur from produit_credit_frais where produit_id = %s", (p["id"],)))
    assurance = charge(p["assurance_nature"], p["assurance_valeur"], montant) if p["type_assurance_id"] else 0
    epargne = charge(p["epargne_nature"], p["epargne_valeur"], montant)
    flux = [-(montant - frais - assurance - epargne)] + [0] * (nd + n)
    for k, l in enumerate(lignes):
        flux[nd + 1 + k] += l["echeance"]
    flux[-1] -= epargne                                                     # l'épargne obligatoire revient au client (Instr. BCC 38, art. 9)
    teg_r = teg_a = None
    if not p["taux_regle"]:
        t = taux_periode(flux)
        teg_r = round(t * float(den) * 100, 2)
        teg_a = round(((1 + t) ** float(den) - 1) * 100, 2)
    return {"produit": p["nom"], "devise": p["devise"].strip(), "periodicite": code, "libellePeriodicite": per["libelle"], "modeCalcul": p["mode_calcul"],
            "modeDiffere": p["mode_differe"], "tauxInteret": str(Decimal(p["taux_interet"]).normalize()), "tauxDiffere": str(Decimal(p["taux_differe"]).normalize()),
            "montant": montant, "duree": duree, "differe": differe, "nombreTraites": n, "dateDeblocage": deblocage.isoformat(),
            "dateEffet": deblocage.isoformat(), "dateDebut": premiere.isoformat(), "dateFin": lignes[-1]["date"],
            "echeanceConstante": a, "echeanceMensuelle": arrondi(Decimal(lignes[0]["echeance"]) * den / 12), "totalInteret": sum(l["interet"] for l in lignes), "interetDiffere": interet_differe,
            "frais": frais, "assurance": assurance, "epargneObligatoire": epargne, "tegR": teg_r, "tegA": teg_a, "tauxRegle": bool(p["taux_regle"]),
            "echeancier": lignes}

