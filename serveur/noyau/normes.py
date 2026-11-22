"""SN01 : Comptabilité > Normes prudentielles (confrontation du 21/11/2026, A2, B5 et B6). Les normes se calculent sur la balance définitive à la date,
en CDF, avec les comptes que nomme l'Instruction BCC 002 relative aux normes prudentielles des COOPEC et des IMF :
- fonds propres de base, complémentaires et prudentiels (art. 7 à 11) ;
- capital minimum (art. 3, 4 et 6 ; Instr. BCC 0010, art. 4 : 250 000 USD pour une entreprise de microcrédit, 700 000 USD pour une société de microfinance) ;
- solvabilité, 10 % au moins, sauf entreprise de microcrédit (art. 12 à 15) ; liquidité immédiate, 20 % au moins, sauf entreprise de microcrédit (art. 16 à 18) ;
- risques d'une COOPEC, au plus le double des dépôts (art. 22 à 24 ; loi 002/2002, art. 59, 5°) ; apparentés (art. 25 et 26 ; loi 002/2002, art. 59, 4°) ;
  un seul client (art. 28 et 29 ; loi 002/2002, art. 59, 6°) ; participations (art. 30) ;
- ressources stables (art. 31 à 33 ; loi 002/2002, art. 59, 2°) ; immobilisations (art. 34 à 36) ; produits connexes (art. 39) ; positions de change (art. 40 à 43).
La loi 002/2002, art. 59, 3° (liquidité de 80 %) renvoie le calcul à une instruction de la BCC qui n'en définit pas les éléments : il n'est pas calculé.
Mêmes règles que web/src/donnees/api.ts (normes)."""
from collections import defaultdict
from datetime import date

from .bd import ErreurMetier, lignes, une, valeur
from .etats_financiers import mouvements_gestion, soldes
from .services import cours, exiger

CAPITAL_MINIMUM_USD = {"entreprise_microcredit": 250000, "societe_microfinance": 700000}      # Instr. BCC 0010, art. 4
CONNEXES = ("721", "722", "723", "727", "7289", "741", "748")                                 # Instr. BCC 002, art. 39
CREDITS = ("30", "31", "32", "39")                                                            # crédits distribués (art. 23)


def d(s: dict, *pref, sauf=()) -> int:
    """Solde débiteur (débit moins crédit) des comptes qui commencent par l'un des préfixes"""
    return sum(v for k, v in s.items() if k.startswith(pref) and not (sauf and k.startswith(sauf)))


def c(s: dict, *pref, sauf=()) -> int:
    """Solde créditeur"""
    return -d(s, *pref, sauf=sauf)


def fonds_propres(s: dict, resultat: int, decote: int = 0) -> dict:
    """Art. 8 : base ; art. 9 : complémentaires ; art. 11 : complémentaires dans la limite de la base, dettes subordonnées dans la limite de 50 % de la base.
    Le résultat de l'exercice pas encore affecté se lit comme les excédents non affectés ou la perte (sous-comptes 130 et 131)."""
    base = c(s, "10", "110", "111", "12", "13", "144", "170", "171") + resultat - d(s, "20", "252", "2510")
    subordonnes = c(s, "1622") - decote            # art. 10 : 20 % de moins par an quand il reste moins de cinq ans à courir
    complementaires = c(s, "14") - c(s, "144") + c(s, "15") + min(subordonnes, max(base, 0) // 2) + c(s, "172") + c(s, "18") - d(s, "255")
    retenus = min(complementaires, max(base, 0))
    return {"base": base, "complementaires": complementaires, "retenus": retenus, "prudentiels": base + retenus}


def ligne(code, libelle, reference, num, den, norme, sens, applicable=True) -> dict:
    """sens : « min » (ratio au moins égal à la norme), « max » (au plus), « bande » (entre -norme et +norme)"""
    ratio = round(num / den * 100, 2) if den else None
    respect = None if not applicable or ratio is None else (ratio >= norme if sens == "min" else abs(ratio) <= norme if sens == "bande" else ratio <= norme)
    return {"code": code, "libelle": libelle, "reference": reference, "numerateur": num, "denominateur": den, "ratio": ratio, "norme": norme, "sens": sens,
            "applicable": applicable, "respect": respect}


def calculer(profil: str, s: dict, resultat: int, connexes_n: int, produits_n1: int, positions: dict, encours: dict, apparentes: int,
             usd: float, tresorerie_assuree: bool, decote: int = 0, correspondant: int = 0) -> dict:
    """Le calcul, sans base de données : les deux côtés (serveur et navigateur) le font de la même façon"""
    coopec = profil in ("coopec", "faitiere")
    emc = profil == "entreprise_microcredit"
    fp = fonds_propres(s, resultat, decote)
    fpp = fp["prudentiels"]
    depots = c(s, "33", "34", "35", "36", "373")
    out = []
    if not coopec:
        mini = CAPITAL_MINIMUM_USD.get(profil, 0) * usd
        out.append(ligne("capital", "Fonds propres de base / capital minimum", "Instr. BCC 002, art. 3 et 6 ; Instr. BCC 0010, art. 4", fp["base"], round(mini * 100), 100, "min"))
    # Solvabilité : actifs pondérés (art. 14 et 15), hors éléments déduits des fonds propres (art. 8 et 9)
    deduits = ("20", "252", "2510", "255")
    actif = {k: v for k, v in s.items() if k[0] in "2345" and not k.startswith(deduits) and (v > 0 or k.startswith(("28", "29", "38", "48", "58")))}
    pondere = round(sum(v * (0 if k.startswith("57") and tresorerie_assuree else 20 if k.startswith("57") else 25 if k.startswith(("53", "56")) else 100) / 100
                        for k, v in actif.items())) + d(s, "00")
    out.append(ligne("solvabilite", "Solvabilité : fonds propres prudentiels / actifs pondérés", "Instr. BCC 002, art. 12 à 15", fpp, pondere, 10, "min", not emc))
    out.append(ligne("liquidite", "Liquidité immédiate : disponibilités / dépôts à vue", "Instr. BCC 002, art. 16 à 18", d(s, "56", "57"), c(s, "330", "331", "332"), 20, "min", not emc))
    if coopec:
        risques = d(s, *CREDITS) + d(s, "25") + d(s, "53", "56") + d(s, "00")
        out.append(ligne("risques", "Risques / dépôts des membres", "Instr. BCC 002, art. 22 à 24 ; loi 002/2002, art. 59, 5°", risques, depots, 200, "max"))
    out.append(ligne("apparentes", "Crédits et engagements aux apparentés / fonds propres prudentiels", "Instr. BCC 002, art. 25 et 27", apparentes, fpp, 20, "max"))
    if coopec:
        out.append(ligne("apparentes_depots", "Crédits et engagements aux apparentés / dépôts des membres", "Instr. BCC 002, art. 26 ; loi 002/2002, art. 59, 4°", apparentes, depots, 20, "max"))
    plus_gros = max(encours.values(), default=0)
    out.append(ligne("division", "Plus gros risque sur un seul " + ("membre" if coopec else "client") + " / fonds propres prudentiels",
                     "Instr. BCC 002, art. 29" if coopec else "Instr. BCC 002, art. 28", plus_gros, fpp, 10 if coopec else 5, "max"))
    if coopec:
        out.append(ligne("division_depots", "Plus gros risque sur un seul membre / dépôts des membres", "Loi 002/2002, art. 59, 6°, et art. 60", plus_gros, depots, 10, "max"))
    out.append(ligne("correspondants", "Plus gros avoir chez un correspondant / fonds propres prudentiels",
                     "Instr. BCC 002, art. 29, al. 2" if coopec else "Instr. BCC 002, art. 28, al. 4", correspondant, fpp, 10 if coopec else 5, "max"))
    out.append(ligne("participations", "Participations / fonds propres prudentiels", "Instr. BCC 002, art. 30",
                     d(s, "25") - (d(s, "252") if coopec else 0), fpp, 25, "max"))
    stables = fpp + c(s, "34") + c(s, "35") + c(s, "16") - c(s, "1622")
    emplois = d(s, "2") + d(s, "30", "31") + d(s, "39", "38")
    out.append(ligne("ressources", "Ressources stables / emplois stables", "Instr. BCC 002, art. 31 à 33" + (" ; loi 002/2002, art. 59, 2°" if coopec else ""), stables, emplois, 100, "min"))
    immobilisations = d(s, "2") - d(s, "251") - d(s, "255") - d(s, "20")
    out.append(ligne("immobilisations", "Immobilisations retenues / fonds propres prudentiels", "Instr. BCC 002, art. 34 à 36", immobilisations, fpp, 50, "max"))
    out.append(ligne("connexes", "Produits des opérations connexes / produits de l'année précédente", "Instr. BCC 002, art. 39", connexes_n, produits_n1, 20, "max"))
    plus_utilisee = max(positions, key=lambda k: positions[k]["volume"], default=None)
    for dv in sorted(positions):
        out.append(ligne(f"change_{dv}", f"Position de change en {dv} / fonds propres prudentiels", "Instr. BCC 002, art. 40 à 43", positions[dv]["position"], fpp,
                         15 if dv == plus_utilisee else 5, "bande"))
    if positions:
        out.append(ligne("change", "Position de change, toutes devises / fonds propres prudentiels", "Instr. BCC 002, art. 40 à 43",
                         sum(x["position"] for x in positions.values()), fpp, 15, "bande"))
    return {"fondsPropres": fp, "depots": depots, "normes": out}


def etat(u, p) -> dict:
    """Critère : Date de l'arrêté. La trésorerie est couverte (art. 15 : 0 % au lieu de 20 %) quand la fiche de l'institution déclare une police en cours
    à la date de l'arrêté (plan d'allègement, point 0.18 ; registre SN01-4)"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    try:
        au = date.fromisoformat(str(p.get("date") or ""))
    except ValueError:
        raise ErreurMetier("À remplir : Date de l'arrêté.")
    i = u["institution_id"]
    profil = valeur("select profil from institution where id = %s", (i,)) or ""
    pol = une("select assurance_tresorerie_assureur as assureur, assurance_tresorerie_police as police, assurance_tresorerie_echeance as echeance from institution where id = %s", (i,))
    assuree = bool(pol and pol["police"] and pol["echeance"] >= au.isoformat())
    s, resultat, anterieurs = soldes(u, au, au.year, vidage=True)
    mv = mouvements_gestion(u, date(au.year, 1, 1), au, vidage=False)
    mv1 = mouvements_gestion(u, date(au.year - 1, 1, 1), date(au.year - 1, 12, 31), vidage=False)
    connexes = -sum(v for k, v in mv.items() if k.startswith(CONNEXES))
    produits_n1 = -sum(v for k, v in mv1.items() if k.startswith("7"))
    # Positions de change (art. 42) : avoirs moins engagements en devises, hors immobilisations et comptes de gestion, au cours du jour de l'arrêté
    positions = {}
    for r in lignes("""select l.devise, sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end) as net, sum(l.montant_devise) as volume
                       from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id join compte k on k.id = l.compte_id
                       where e.institution_id = %s and jc.statut = 'fermee' and e.date_valeur <= %s and l.devise <> 'CDF' and left(k.numero, 1) in ('1', '3', '4', '5')
                         and left(k.numero, 3) not in ('472', '473', '474')
                       group by 1""", (i, au)):
        t = cours(r["devise"], au)
        positions[r["devise"].strip()] = {"position": round(int(r["net"]) * t), "volume": round(int(r["volume"]) * t)}
    # Risques par client (loi 002/2002, art. 60 : prêts et engagements par signature) ; apparentés (Instr. BCC 002, art. 27 ; fiche, registre CR-3)
    encours: dict = defaultdict(int)
    for r in lignes("""select coalesce(cr.tiers_id, es.tiers_id) as tiers_id, sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) as s
                       from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id join compte k on k.id = l.compte_id
                       left join credit cr on l.contrat_ref = 'credit:' || cr.id and cr.institution_id = e.institution_id
                       left join engagement_signature es on l.contrat_ref = 'engagement:' || es.reference and es.institution_id = e.institution_id
                       where e.institution_id = %s and jc.statut = 'fermee' and e.date_valeur <= %s
                         and (left(k.numero, 2) in ('30', '31', '32', '39') or left(k.numero, 2) = '00') and coalesce(cr.tiers_id, es.tiers_id) is not null
                       group by 1""", (i, au)):
        if int(r["s"]) > 0:
            encours[r["tiers_id"]] += int(r["s"])
    apparentes = {r["id"] for r in lignes("select id from tiers where institution_id = %s and apparente is not null", (i,))}
    # B16 : « une seule signature » : les risques des clients liés par le contrôle s'additionnent (art. 28, al. 3)
    from .dossiers import groupe_signature
    groupes: dict = defaultdict(int)
    for tid, v in encours.items():
        groupes[groupe_signature(u, tid)[0]] += v
    # B21 : dettes subordonnées à moins de cinq ans de leur échéance : 20 % de moins par an (art. 10) ; l'échéance se lit sur l'emprunt (S61)
    from .depots_terme import ajouter_mois
    decote = 0
    for e in lignes("""select e.montant, e.devise, e.date_emprunt, e.duree_mois,
                              coalesce((select sum(r.amortissement) from remboursement_emprunt r where r.emprunt_id = e.id and r.date_operation <= %s), 0) as amorti
                       from emprunt e where e.institution_id = %s and e.compte_emprunt like '1622%%' and e.date_emprunt <= %s""", (au, i, au)):
        annees = max((ajouter_mois(e["date_emprunt"], e["duree_mois"]) - au).days, 0) // 365
        if annees < 5:
            decote += round((int(e["montant"]) - int(e["amorti"])) * cours(e["devise"].strip(), au) * (5 - annees) * 20 / 100)
    # B15 : le plafond par signature vaut aussi pour les avoirs chez un correspondant (art. 28, al. 4 ; art. 29, al. 2) : comptes 53 et 56
    correspondant = max((v for k, v in s.items() if k.startswith(("53", "56")) and v > 0), default=0)
    x = calculer(profil, s, resultat + anterieurs, connexes, produits_n1, positions, dict(groupes), sum(v for k, v in encours.items() if k in apparentes),
                 cours("USD", au), assuree, decote, correspondant)
    return {"date": au.isoformat(), "profil": profil, **x, "assuranceTresorerie": {"couverte": assuree, "assureur": (pol or {}).get("assureur") or "",
                                                                                "police": (pol or {}).get("police") or "", "echeance": (pol or {}).get("echeance") or ""}}
