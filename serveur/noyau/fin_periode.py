"""S128 : Autres > Calculs (manuel Microfina++, p. 163 : « frais de tenue de comptes, calcul intérêt sur DAV, calcul des intérêts sur DAT, intérêt et
frais de tenue de comptes, Etat des provisions de crédits » ; menu seul). S127 : Autres > Clôture : crédit (capture « Etat des provisions de crédits »),
Dépôt, Comptabilité.
Textes lus :
- Instr. BCC 37 (services gratuits) et 40, art. 8 et 12 : la tenue de compte n'est pas gratuite d'office ; son frais demande l'autorisation de la BCC,
  saisie avec le frais (écart E21, E14). PCCI, compte 720 « Commissions de tenue des comptes ».
- Loi 23/053, art. 78 (intérêts des dépôts à vue ou à échéance fixe et des comptes courants : imposables), art. 80 (intérêts des comptes d'épargne :
  exonérés), art. 120 (retenue à la source). PCCI, comptes 610 (intérêts sur épargne et comptes ordinaires), 433 (taxes retenues).
- PCCI § 6.4 (rattachement à la période ; intérêts courus) ; comptes 612 et 349 « Dettes rattachées (intérêts sur dépôts) ».
- Instr. BCC 003, art. 12 (provisions à constituer chaque mois) et art. 14 (niveau constaté à la fin de chaque mois).
- PCCI § 3.4 : validation au terme de chaque période, qui ne dépasse pas le mois ; procédure mensuelle de « clôture informatique » qui fige la
  chronologie.
- PCCI § 7.1 : conversion au cours de clôture lors des arrêtés ; à chaque clôture intermédiaire ou annuelle, les différences vont en produits ou en
  charges ; charges et produits en devises sont comptabilisés après conversion en CDF. Comptes 623 « Pertes de change », 723 « Profits de change ».
  § 4.3.5 (coût historique) : seuls les avoirs et dettes en monnaie se réévaluent, pas les immobilisations ni les fonds propres.
- PCCI, classe 8 (soldes de gestion 80, 82, 83, 84, 85, 86, 87) et compte 13 (130 bénéfice, 131 perte) ; § 4.3.1 ; § 4.3.6.
Mêmes règles que web/src/donnees/api.ts (finPeriode). Registre S127-1 à S127-12, S128-1 à S128-9."""
import calendar
import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from .bd import ErreurMetier, executer, lignes, une, valeur
from .depots_terme import COMPTE_COURUS as DETTES_DAT, COMPTE_IRC, compte_interet, disponible, taux_irc
from .deblocage import comptes_credit
from .modeles_credit import DEGRES, TERMES
from .provisions import PROVISION, taux as taux_provision
from .services import compte_du_produit, cours, exiger, id_compte, journee_courante, nom_utilisateur, nouvelle_piece, poster, schema_valide, titulaire

TENUE, COMPTE_TENUE = "TENUE_COMPTE", "720"          # PCCI 720 Commissions de tenue des comptes (proposé ; le compte du frais l'emporte)
INTERET_DAV = "610"                                  # PCCI 610 Intérêts sur épargne et comptes ordinaires
DOTATION = "6902"                                    # PCCI 690 : dotation aux provisions sur créances (S99)
PERTE_CHANGE, PROFIT_CHANGE = "623", "723"           # PCCI 623 Pertes de change ; 723 Profits de change
MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
# Avoirs et dettes en monnaie : clientèle, tiers, trésorerie, emprunts et fonds affectés (PCCI § 4.3.5 et § 7.1)
MONETAIRES = "(left(c.numero, 1) in ('3', '4', '5') or left(c.numero, 2) in ('16', '17'))"
# Soldes de gestion (PCCI, classe 8) : compte de solde, comptes qu'il reçoit
SOLDES = [("80", ("70", "71", "72", "73", "60", "61", "62", "63")), ("82", ("80", "74", "64", "65", "66")), ("83", ("82", "78", "79", "68", "69")),
          ("84", ("76", "77", "67")), ("85", ("83", "84")), ("87", ("85", "86"))]


def arrondi(x: Decimal) -> int:
    return int(x.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def periode(p: dict) -> tuple[int, int, date, date]:
    ex, m = p.get("exercice"), p.get("mois")
    if not str(ex or "").isdigit():
        raise ErreurMetier("À remplir : Exercice.")
    if not str(m or "").isdigit() or not 1 <= int(m) <= 12:
        raise ErreurMetier("À remplir : Mois.")
    ex, m = int(ex), int(m)
    return ex, m, date(ex, m, 1), date(ex, m, calendar.monthrange(ex, m)[1])


def jour_ouvert(u) -> dict:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return j


def contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    j = journee_courante(u)
    return {"date": j["date"] if j else "", "mois": MOIS,
            "exercices": lignes("""select annee, ouvert, valide, cloture_le is not null as cloture from exercice where institution_id = %s order by annee desc""", (i,))}


# ---------- Comptes concernés ----------
def comptes_ouverts(u, condition: str) -> list[dict]:
    """Comptes de dépôt ouverts de l'agence dont le produit et le client portent l'option"""
    return lignes(f"""select c.id, c.numero, trim(c.devise) as devise, c.tiers_id, c.ouvert_le, p.libelle as produit, p.famille, p.compte_lie, p.categorie_compte, p.taux_interet,
                             t.numero as numero_client, t.sous_type_client, t.type as type_tiers
                      from compte_depot c join produit_epargne p on p.id = c.produit_id join tiers t on t.id = c.tiers_id
                      where c.institution_id = %s and c.agence_id = %s and c.statut = 'ouvert' and {condition} order by c.numero""", (u["institution_id"], u["agence_id"]))


def deja(type_: str, ex: int, m: int) -> dict:
    return {r["compte_depot_id"]: r for r in lignes("select * from calcul_periodique where type = %s and exercice = %s and mois = %s", (type_, ex, m))}


# ---------- S128 : Frais de tenue de comptes ----------
def frais_tenue(u, sous_type: str | None) -> dict | None:
    """Le frais de tenue de compte paramétré pour le sous type du client (Paramétrage > Frais) ; un Montant, en CDF (registre S16-3)"""
    return une("""select pf.valeur, coalesce(pf.compte, %s) as compte, f.libelle from parametrage_frais pf join frais f on f.id = pf.frais_id
                  join liste_reference s on s.id = pf.sous_type_id
                  where f.institution_id = %s and f.type_operation = %s and f.supprime_le is null and pf.supprime_le is null and pf.nature = 'montant'
                    and pf.valeur > 0 and s.libelle = %s order by pf.id limit 1""", (COMPTE_TENUE, u["institution_id"], TENUE, sous_type or ""))


def apercu_tenue(u, p: dict) -> dict:
    """Bouton Calculer : un frais par compte et par mois, pour les comptes dont le produit a « Tenue de compte » et le client « Prélever agios ».
    Le frais est en CDF ; sur un compte en devise il est converti au cours du jour. Un compte sans disponible suffisant n'est pas débité."""
    exiger(u)
    ex, m, du, au = periode(p)
    if not une("select 1 from frais where institution_id = %s and type_operation = %s and supprime_le is null", (u["institution_id"], TENUE)):
        raise ErreurMetier("Frais de tenue de compte : le créer d'abord dans Paramétrage > Frais (opération TENUE COMPTE), avec la référence de l'autorisation "
                           "de la BCC (Instr. BCC 40, art. 12).")
    j = jour_ouvert(u)
    fait = deja("tenue_compte", ex, m)
    out = []
    for c in comptes_ouverts(u, "p.tenue_compte is true and t.prelever_agios is true and coalesce(p.categorie_compte, '') <> 'DAT'"):
        if c["ouvert_le"] and c["ouvert_le"] > au:
            continue
        f = frais_tenue(u, c["sous_type_client"])
        ligne = {"compteId": c["id"], "numero": c["numero"], "client": titulaire(c["tiers_id"]), "produit": c["produit"], "devise": c["devise"], "montant": 0, "etat": ""}
        if c["id"] in fait:
            ligne.update(montant=fait[c["id"]]["montant"], etat="Déjà prélevé")
        elif not f:
            ligne["etat"] = "Aucun frais paramétré pour ce sous type de client"
        else:
            montant = f["valeur"] if c["devise"] == "CDF" else arrondi(Decimal(f["valeur"]) / Decimal(str(cours(c["devise"], date.fromisoformat(j["date"])))))
            dispo = disponible(c["id"], c["devise"])
            ligne.update(montant=montant, compteFrais=f["compte"], etat="À prélever" if 0 < montant <= dispo else "Disponible insuffisant")
        out.append(ligne)
    return {"exercice": ex, "mois": m, "lignes": out, "total": defaultdict_somme(out, "À prélever")}


def defaultdict_somme(out: list[dict], etat: str) -> dict:
    tot: dict = defaultdict(int)
    for x in out:
        if x["etat"] == etat:
            tot[x["devise"]] += x["montant"]
    return dict(tot)


def passer_tenue(u, p: dict) -> dict:
    """Bouton Valider : une écriture par compte, débit du compte du client, crédit du compte du frais"""
    exiger(u)
    a = apercu_tenue(u, p)
    j = jour_ouvert(u)
    n = 0
    for x in a["lignes"]:
        if x["etat"] != "À prélever":
            continue
        c = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s", (x["compteId"],))
        eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Frais de tenue de compte {MOIS[a['mois'] - 1]} {a['exercice']}, compte {x['numero']}",
                     piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])), evenement="frais_tenue", cle=str(uuid.uuid4()), valide_par=u["id"],
                     lignes_ecr=[{"compte": compte_du_produit(c), "contrat": f"depot:{c['id']}", "sens": "D", "devise": x["devise"], "montant": x["montant"]},
                                 {"compte": x["compteFrais"], "sens": "C", "devise": x["devise"], "montant": x["montant"]}])
        executer("""insert into calcul_periodique (institution_id, agence_id, type, exercice, mois, compte_depot_id, montant, devise, ecriture_id, passe_par)
                    values (%s, %s, 'tenue_compte', %s, %s, %s, %s, %s, %s, %s)""",
                 (u["institution_id"], u["agence_id"], a["exercice"], a["mois"], c["id"], x["montant"], x["devise"], eid, u["id"]))
        n += 1
    if not n:
        raise ErreurMetier("Rien à prélever pour ce mois.")
    return {**apercu_tenue(u, p), "passes": n}


# ---------- S128 : Calcul Intérêt sur DAV ----------
def soldes_du_mois(compte_id: int, devise: str, du: date, au: date) -> list[int]:
    """Solde de fin de journée du compte, chaque jour du mois (crédit moins débit, dans la devise du compte)"""
    ref = f"depot:{compte_id}"
    solde = int(valeur("""select coalesce(sum(case l.sens when 'C' then l.montant_devise else -l.montant_devise end), 0) from ligne_ecriture l
                          join ecriture e on e.id = l.ecriture_id where l.contrat_ref = %s and l.devise = %s and e.date_valeur < %s""", (ref, devise, du)))
    mv = {r["date_valeur"]: int(r["s"]) for r in lignes(
        """select e.date_valeur, sum(case l.sens when 'C' then l.montant_devise else -l.montant_devise end) as s from ligne_ecriture l
           join ecriture e on e.id = l.ecriture_id where l.contrat_ref = %s and l.devise = %s and e.date_valeur between %s and %s group by 1""", (ref, devise, du, au))}
    out, d = [], du
    while d <= au:
        solde += mv.get(d, 0)
        out.append(solde)
        d += timedelta(days=1)
    return out


def apercu_interets_dav(u, p: dict) -> dict:
    """Bouton Calculer : intérêt du mois sur le solde créditeur de chaque jour, au taux annuel du produit, base 365 jours (comme la rupture d'un DAT,
    S67-2). Compte d'épargne : exonéré (loi 23/053, art. 80) ; compte courant d'une personne physique : retenue de 20 % (art. 78 et 120)."""
    exiger(u)
    ex, m, du, au = periode(p)
    j = jour_ouvert(u)
    if date.fromisoformat(j["date"]) < au:
        raise ErreurMetier("Le mois n'est pas fini : l'intérêt se calcule une fois le dernier jour du mois atteint.")
    fait = deja("interet_dav", ex, m)
    out = []
    for c in comptes_ouverts(u, """p.calcul_interet is true and coalesce(p.taux_interet, 0) > 0 and t.calculer_interet is true
                                   and coalesce(p.categorie_compte, '') <> 'DAT'"""):
        ligne = {"compteId": c["id"], "numero": c["numero"], "client": titulaire(c["tiers_id"]), "produit": c["produit"], "devise": c["devise"],
                 "taux": f"{Decimal(c['taux_interet']).normalize():f}".replace(".", ","), "base": 0, "interet": 0, "retenue": 0, "net": 0, "etat": ""}
        if c["id"] in fait:
            r = fait[c["id"]]
            ligne.update(base=r["base"], interet=r["montant"], retenue=r["retenue"], net=r["montant"] - r["retenue"], etat="Déjà servi")
        else:
            soldes = [max(s, 0) for s in soldes_du_mois(c["id"], c["devise"], du, au)]
            interet = arrondi(Decimal(sum(soldes)) * Decimal(c["taux_interet"]) / 100 / 365)
            courant = c["categorie_compte"] == "Courant"
            retenue = arrondi(Decimal(interet) * taux_irc(c["tiers_id"]) / 100) if courant else 0
            ligne.update(base=round(sum(soldes) / len(soldes)), interet=interet, retenue=retenue, net=interet - retenue, etat="À servir" if interet > 0 else "Aucun intérêt")
        out.append(ligne)
    return {"exercice": ex, "mois": m, "lignes": out}


def passer_interets_dav(u, p: dict) -> dict:
    """Bouton Valider : débit 610, crédit du compte du client pour le net et du 433 pour la retenue"""
    exiger(u)
    a = apercu_interets_dav(u, p)
    j = jour_ouvert(u)
    n = 0
    for x in a["lignes"]:
        if x["etat"] != "À servir":
            continue
        c = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s", (x["compteId"],))
        lg = [{"compte": INTERET_DAV, "sens": "D", "devise": x["devise"], "montant": x["interet"]}]
        if x["net"]:
            lg.append({"compte": compte_du_produit(c), "contrat": f"depot:{c['id']}", "sens": "C", "devise": x["devise"], "montant": x["net"]})
        if x["retenue"]:
            lg.append({"compte": COMPTE_IRC, "sens": "C", "devise": x["devise"], "montant": x["retenue"]})
        eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Intérêts {MOIS[a['mois'] - 1]} {a['exercice']}, compte {x['numero']}",
                     piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])), evenement="interet_dav", cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=lg)
        executer("""insert into calcul_periodique (institution_id, agence_id, type, exercice, mois, compte_depot_id, base, montant, retenue, devise, ecriture_id, passe_par)
                    values (%s, %s, 'interet_dav', %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                 (u["institution_id"], u["agence_id"], a["exercice"], a["mois"], c["id"], x["base"], x["interet"], x["retenue"], x["devise"], eid, u["id"]))
        n += 1
    if not n:
        raise ErreurMetier("Aucun intérêt à servir pour ce mois.")
    return {**apercu_interets_dav(u, p), "passes": n}


# ---------- S128 : Calcul des intérêts sur DAT (intérêts courus) ; S127 : Clôture > Dépôt ----------
def couru(x: dict, d: date) -> int:
    """Intérêt couru d'un DAT à la date : au taux du contrat, pour les jours courus depuis le dépôt (base 365), sans dépasser l'intérêt du contrat"""
    jours = max((min(d, x["date_echeance"]) - x["date_depot"]).days, 0)
    return min(arrondi(Decimal(x["montant"]) * x["taux_interet"] / 100 * jours / 365), x["montant_interet"])


def date_arrete(u, p: dict) -> date:
    j = jour_ouvert(u)
    try:
        d = date.fromisoformat(p["date"]) if p.get("date") else date.fromisoformat(j["date"])
    except (TypeError, ValueError):
        raise ErreurMetier("À remplir : Date.")
    if d > date.fromisoformat(j["date"]):
        raise ErreurMetier("Date : pas après la journée ouverte.")
    return d


def apercu_interets_dat(u, p: dict) -> dict:
    """État des intérêts courus sur les dépôts à terme en cours, à la date"""
    exiger(u)
    d = date_arrete(u, p)
    out = []
    for x in lignes("""select * from depot_terme where institution_id = %s and agence_id = %s and statut = 'valide' and date_depot <= %s order by certificat""",
                    (u["institution_id"], u["agence_id"], d)):
        c = couru(x, d)
        out.append({"id": x["id"], "certificat": x["certificat"], "client": titulaire(x["tiers_id"]), "devise": x["devise"].strip(), "montant": x["montant"],
                    "taux": f"{x['taux_interet'].normalize():f}".replace(".", ","), "depot": x["date_depot"].isoformat(), "echeance": x["date_echeance"].isoformat(),
                    "terme": "Court terme" if x["duree_mois"] <= 12 else "Moyen terme" if x["duree_mois"] <= 60 else "Long terme",
                    "interetContrat": x["montant_interet"], "couru": c, "dejaPasse": x["interets_courus"], "aPasser": max(c - x["interets_courus"], 0),
                    "compteCharge": compte_interet(x["duree_mois"]), "compteDette": DETTES_DAT})
    tot: dict = defaultdict(lambda: {"couru": 0, "aPasser": 0})
    for x in out:
        tot[x["devise"]]["couru"] += x["couru"]
        tot[x["devise"]]["aPasser"] += x["aPasser"]
    return {"date": d.isoformat(), "lignes": out, "totaux": dict(tot)}


def passer_interets_dat(u, p: dict) -> dict:
    """Bouton Valider : la part des intérêts courus pas encore passée : débit 612, crédit 349 ; l'échéance et la rupture la reprennent"""
    exiger(u)
    a = apercu_interets_dat(u, p)
    j = jour_ouvert(u)
    n = 0
    for x in a["lignes"]:
        if not x["aPasser"]:
            continue
        une("select id from depot_terme where id = %s for update", (x["id"],))
        poster(u, journal="OD", journee_id=j["id"], libelle=f"Intérêts courus au {date.fromisoformat(a['date']).strftime('%d/%m/%Y')}, DAT n° {x['certificat']}",
               piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])), evenement="interet_dat_couru", cle=str(uuid.uuid4()), valide_par=u["id"],
               lignes_ecr=[{"compte": x["compteCharge"], "sens": "D", "devise": x["devise"], "montant": x["aPasser"]},
                           {"compte": DETTES_DAT, "sens": "C", "devise": x["devise"], "montant": x["aPasser"]}])
        executer("update depot_terme set interets_courus = interets_courus + %s where id = %s", (x["aPasser"], x["id"]))
        n += 1
    if not n:
        raise ErreurMetier("Aucun intérêt couru à passer à cette date.")
    return {**apercu_interets_dat(u, p), "passes": n}


RATTACHEES = {1: "328", 2: "318", 3: "308"}      # PCCI, classe 3 : créances rattachées des crédits à court, moyen et long terme


def couru_credit(c: dict, d: date) -> int:
    """B8 : intérêt couru non échu d'un crédit sain à la date : la part, au prorata des jours, de l'intérêt de la prochaine échéance, moins ce que le
    client en a déjà payé d'avance. Un crédit en retard n'en porte pas (PCCI § 6.4 : produits des créances en retard à l'encaissement seulement)."""
    from .remboursements import etat
    if c["statut"] != "debloque":
        return 0
    s = etat(c, d)
    if s["joursRetard"] or not s["nonEchu"]:
        return 0
    e = s["nonEchu"][0]
    echus = [x for x in s["echeances"] if x["date_due"] <= d]
    debut = echus[-1]["date_due"] if echus else c["debloque_le"]
    duree = (e["date_due"] - debut).days
    if duree <= 0 or d <= debut:
        return 0
    avance = max(s["payes"]["interet"] - sum(x["interet"] for x in echus), 0)
    return max(arrondi(Decimal(e["interet"]) * (d - debut).days / duree) - avance, 0)


def apercu_interets_credits(u, p: dict) -> dict:
    """État des intérêts courus non échus sur les crédits sains, à la date ; un crédit qui n'est plus sain voit sa part passée reprise"""
    from .deblocage import terme
    exiger(u)
    d = date_arrete(u, p)
    out = []
    for c in lignes("""select * from credit where institution_id = %s and debloque_le <= %s and (statut = 'debloque' or interets_courus > 0) order by numero""",
                    (u["institution_id"], d)):
        couru_ = couru_credit(c, d)
        if not couru_ and not c["interets_courus"]:
            continue
        out.append({"id": c["id"], "numero": c["numero"], "client": titulaire(c["tiers_id"]), "devise": c["devise"].strip(), "montant": c["montant"],
                    "couru": couru_, "dejaPasse": c["interets_courus"], "aPasser": couru_ - c["interets_courus"],
                    "compteRattache": RATTACHEES[terme(c["duree_mois"])], "compteProduit": comptes_credit(c, 1)["interet"]})
    tot: dict = defaultdict(lambda: {"couru": 0, "aPasser": 0})
    for x in out:
        tot[x["devise"]]["couru"] += x["couru"]
        tot[x["devise"]]["aPasser"] += x["aPasser"]
    return {"date": d.isoformat(), "lignes": out, "totaux": dict(tot)}


def passer_interets_credits(u, p: dict) -> dict:
    """Bouton Valider : la différence entre l'intérêt couru et la part déjà passée : débit de la créance rattachée, crédit du produit ; l'inverse pour une reprise"""
    exiger(u)
    a = apercu_interets_credits(u, p)
    j = jour_ouvert(u)
    n = 0
    for x in a["lignes"]:
        if not x["aPasser"]:
            continue
        une("select id from credit where id = %s for update", (x["id"],))
        plus, m, k = x["aPasser"] > 0, abs(x["aPasser"]), f"credit:{x['id']}"
        poster(u, journal="OD", journee_id=j["id"], libelle=f"Intérêts courus au {date.fromisoformat(a['date']).strftime('%d/%m/%Y')}, crédit {x['numero']}",
               piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])), evenement="interet_credit_couru", cle=str(uuid.uuid4()), valide_par=u["id"],
               lignes_ecr=[{"compte": x["compteRattache"], "contrat": k, "sens": "D" if plus else "C", "devise": x["devise"], "montant": m},
                           {"compte": x["compteProduit"], "contrat": k, "sens": "C" if plus else "D", "devise": x["devise"], "montant": m}])
        executer("update credit set interets_courus = %s where id = %s", (x["couru"], x["id"]))
        n += 1
    if not n:
        raise ErreurMetier("Aucun intérêt couru à passer à cette date.")
    return {**apercu_interets_credits(u, p), "passes": n}


def interets_et_frais(u, p: dict) -> dict:
    """« Intérêt et Frais de tenue de comptes » : les intérêts du mois d'abord, puis les frais de tenue"""
    exiger(u)
    i = f = 0
    try:
        i = passer_interets_dav(u, p)["passes"]
    except ErreurMetier as e:
        if "Aucun intérêt" not in str(e):
            raise
    try:
        f = passer_tenue(u, p)["passes"]
    except ErreurMetier as e:
        if "Rien à prélever" not in str(e):
            raise
    if not i and not f:
        raise ErreurMetier("Rien à passer pour ce mois : ni intérêt, ni frais de tenue de compte.")
    return {"interets": i, "frais": f}


# ---------- S127 Clôture > crédit et S128 : Etat des provisions de crédits (capture p. 163) ----------
def etat_provisions(u, p: dict) -> dict:
    """« Balance âgée des crédits au … », Afficher (capture p. 163) : par degré et par terme, l'encours, le retard, la provision et les comptes.
    Les crédits et leur degré sont ceux de la balance âgée de la date (S98) ; taux et comptes : ceux du provisionnement (S99)."""
    exiger(u)
    try:
        d = date.fromisoformat(p.get("date") or "")
    except ValueError:
        raise ErreurMetier("À remplir : Balance âgée des crédits au.")
    b = valeur("select id from balance_agee where institution_id = %s and date_lancement = %s", (u["institution_id"], d))
    if not b:
        raise ErreurMetier(f"Aucune balance âgée au {d.strftime('%d/%m/%Y')} : la lancer d'abord (Crédit > Génération de balance âgée).")
    credits = {c["id"]: c for c in lignes("select c.* from credit c join balance_agee_ligne l on l.credit_id = c.id where l.balance_id = %s", (b,))}
    g: dict = {}
    for x in lignes("select * from balance_agee_ligne where balance_id = %s", (b,)):
        c = credits[x["credit_id"]]
        rang = 2 if x["assimile"] else x["degre"]
        terme = next((n for n, t in enumerate(TERMES, start=1) if t["debut"] <= c["duree_mois"] <= t["fin"]), len(TERMES))
        t = g.setdefault((rang, terme, x["devise"].strip(), comptes_credit(c, rang)["capital"]), {"encours": 0, "retard": 0, "provisions": 0})
        t["encours"] += x["capital_restant"]
        t["retard"] += x["capital_impaye"] + x["interet_impaye"]
        t["provisions"] += x["capital_restant"] * taux_provision(rang) // 100
    out = []
    for (rang, terme, dv, compte), t in sorted(g.items()):
        dg = DEGRES[rang - 1]
        out.append({"degre": dg["libelle"] + (f" {dg['debut']} à {dg['fin']} jours" if 1 < rang < len(DEGRES) else ""), "terme": TERMES[terme - 1]["libelle"], "devise": dv,
                    "encours": t["encours"], "retard": t["retard"], "taux": taux_provision(rang), "provisions": t["provisions"], "compteCapital": compte,
                    "compteProvisionDebit": DOTATION if rang > 1 else "", "compteProvisionCredit": PROVISION[rang] if rang > 1 else ""})
    return {"date": d.isoformat(), "lignes": out}


# ---------- S127 : Clôture > Comptabilité ----------
def ecrire(u, journee_id: int, jour: date, libelle: str, type_: str, evenement: str, lg: list[dict]) -> int:
    """Écriture de clôture, à la date de la dernière journée de la période, déjà comptabilisée : réévaluation ou soldes de gestion.
    Chaque ligne porte son montant en devise et sa contre-valeur ; l'équilibre en CDF est garanti par la base (replica/schema.sql)."""
    jid = valeur("select id from journal where institution_id = %s and code = 'OD' and actif and not supprime", (u["institution_id"],))
    if jid is None:
        raise ErreurMetier("Le journal OD n'est pas actif (Comptabilité > Journal).")
    piece = nouvelle_piece(u, "OD", jour)
    pid = valeur("insert into piece (institution_id, numero, type, date_piece) values (%s, %s, 'bordereau', %s) returning id", (u["institution_id"], piece, jour))
    numero = f"OD-{jour.year}-{valeur('select nextval(%s)', ('numero_ecriture',)):06d}"
    eid = valeur("""insert into ecriture (institution_id, numero, journal_id, journee_id, date_valeur, libelle, piece_id, evenement_id, schema_id, saisi_par, valide_par, type)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], numero, jid, journee_id, jour, libelle, pid, str(uuid.uuid4()), schema_valide(u, evenement), u["id"], u["id"], type_))
    for rang, l in enumerate(lg, start=1):
        executer("""insert into ligne_ecriture (ecriture_id, rang, compte_id, contrat_ref, sens, devise, montant_devise, montant_cdf) values (%s, %s, %s, %s, %s, %s, %s, %s)""",
                 (eid, rang, id_compte(l["compte"], u["institution_id"]), l.get("contrat"), l["sens"], l["devise"], l["montant"], l["cdf"]))
    return eid


def fin_de(annee: int, mois: int | None) -> date:
    return date(annee, mois or 12, calendar.monthrange(annee, mois or 12)[1])


def derniere_journee(u, annee: int, mois: int | None) -> dict | None:
    return une("""select j.* from journee_comptable j where j.agence_id = %s and j.date_comptable between %s and %s order by j.date_comptable desc limit 1""",
               (u["agence_id"], date(annee, mois or 1, 1), fin_de(annee, mois)))


POSITION, CONTREVALEUR, AJUSTEMENT = "472", "473", "474"      # PCCI § 7.1 : position de change, contre-valeur, ajustement devises


def positions(u, d: date) -> list[dict]:
    """Avoirs et dettes tenus en devise : solde en devise, contre-valeur au livre, valeur au cours de la date, écart. Les comptes de position de change
    (472, 473, 474) se traitent à part."""
    out = []
    for r in lignes(f"""select c.numero, coalesce(l.contrat_ref, '') as contrat, trim(l.devise) as devise,
                              sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end)::bigint as sd,
                              sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end)::bigint as sc
                       from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
                       where e.institution_id = %s and e.date_valeur <= %s and l.devise <> 'CDF' and {MONETAIRES} and left(c.numero, 3) not in ('472', '473', '474')
                       group by 1, 2, 3 order by 1, 2, 3""", (u["institution_id"], d)):
        if r["sd"] or r["sc"]:
            cible = arrondi(Decimal(r["sd"]) * Decimal(str(cours(r["devise"], d))))
            out.append({"compte": r["numero"], "contrat": r["contrat"], "devise": r["devise"], "soldeDevise": r["sd"], "valeurLivre": r["sc"], "valeurCours": cible,
                        "ecart": cible - r["sc"]})
    return out


def solde_position(u, d: date, compte: str) -> dict:
    """Soldes débiteurs (débit moins crédit) d'un compte de position, par devise : montant en devise et contre-valeur"""
    return {r["devise"]: (int(r["sd"]), int(r["sc"])) for r in lignes(
        """select trim(l.devise) as devise, sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end) as sd,
                  sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) as sc
           from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
           where e.institution_id = %s and e.date_valeur <= %s and c.numero like %s group by 1""", (u["institution_id"], d, compte + "%"))}


def vue_reevaluation(pos: list[dict], d: date, ajustement: int = 0) -> dict:
    """Profit ou perte de change de la clôture, net par devise (PCCI § 7.1), plus le solde du compte d'ajustement (474)"""
    g: dict = defaultdict(lambda: {"soldeDevise": 0, "valeurLivre": 0, "valeurCours": 0, "ecart": 0})
    net: dict = defaultdict(int)
    for x in pos:
        net[x["devise"]] += x["ecart"]
        for k in ("soldeDevise", "valeurLivre", "valeurCours", "ecart"):
            g[(x["compte"], x["devise"])][k] += x[k]
    return {"date": d.isoformat(), "lignes": [{"compte": c, "devise": dv, **v} for (c, dv), v in sorted(g.items()) if v["ecart"]],
            "profit": sum(v for v in net.values() if v > 0) + max(-ajustement, 0), "perte": -sum(v for v in net.values() if v < 0) + max(ajustement, 0)}


def ajustement_devises(u, d: date) -> int:
    """Solde débiteur du compte d'ajustement (474), en CDF : écarts d'arrondi logés en cours de période (registre T37)"""
    return sum(v[1] for v in solde_position(u, d, AJUSTEMENT).values())


def lignes_reevaluation(u, pos: list[dict], d: date) -> list[dict]:
    """Chaque compte en devise est ramené à sa valeur au cours de clôture, sans toucher au montant en devise. Par devise, le 472 reçoit le mouvement
    de la position (en devise) et la réévaluation de la position déjà tenue, le 473 est porté à la valeur de la position, et la différence est le
    résultat de change de la devise : 723 (profit) ou 623 (perte), sans compensation entre devises (PCCI § 7.1 et § 4.3.8). Le solde du 474 suit."""
    def resultat(lg: list[dict]):
        solde = sum(x["cdf"] if x["sens"] == "D" else -x["cdf"] for x in lg)
        if solde > 0:
            lg.append({"compte": PROFIT_CHANGE, "sens": "C", "devise": "CDF", "montant": solde, "cdf": solde})
        elif solde < 0:
            lg.append({"compte": PERTE_CHANGE, "sens": "D", "devise": "CDF", "montant": -solde, "cdf": -solde})
        return lg

    p472 = solde_position(u, d, POSITION)
    p473 = {r["contrat"]: int(r["sc"]) for r in lignes(
        """select coalesce(l.contrat_ref, '') as contrat, sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) as sc
           from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
           where e.institution_id = %s and e.date_valeur <= %s and c.numero like '473%%' group by 1""", (u["institution_id"], d))}
    out = []
    for dv in sorted({x["devise"] for x in pos} | set(p472)):
        l = [x for x in pos if x["devise"] == dv]
        lg = [{"compte": x["compte"], "contrat": x["contrat"] or None, "sens": "D" if x["ecart"] > 0 else "C", "devise": dv, "montant": 0, "cdf": abs(x["ecart"])}
              for x in l if x["ecart"]]
        position, valeur_ = sum(x["soldeDevise"] for x in l), sum(x["valeurCours"] for x in l)
        tenue_d, tenue_c = (-v for v in p472.get(dv, (0, 0)))                       # 472 : solde créditeur, en devise et en CDF
        mouvement = position - tenue_d
        cdf_mouvement = arrondi(Decimal(abs(mouvement)) * Decimal(str(cours(dv, d)))) * (1 if mouvement > 0 else -1)
        if cdf_mouvement:
            lg.append({"compte": POSITION, "sens": "C" if mouvement > 0 else "D", "devise": dv, "montant": abs(mouvement), "cdf": abs(cdf_mouvement)})
        reste = valeur_ - tenue_c - cdf_mouvement                                   # réévaluation de la position déjà tenue
        if reste:
            lg.append({"compte": POSITION, "sens": "C" if reste > 0 else "D", "devise": dv, "montant": 0, "cdf": abs(reste)})
        contre = p473.get(f"devise:{dv}", 0)                                        # 473 : solde débiteur de la devise, en CDF
        if valeur_ - contre:
            m = abs(valeur_ - contre)
            lg.append({"compte": CONTREVALEUR, "contrat": f"devise:{dv}", "sens": "D" if valeur_ > contre else "C", "devise": "CDF", "montant": m, "cdf": m})
        out += resultat(lg)
    aj = ajustement_devises(u, d)
    if aj:
        out += resultat([{"compte": AJUSTEMENT, "sens": "C" if aj > 0 else "D", "devise": "CDF", "montant": abs(aj), "cdf": abs(aj)}])
    return out


def reevaluer(u, annee: int, mois: int | None) -> int:
    """Réévaluation au cours du dernier jour de la période, datée de sa dernière journée. Rend 1 si une écriture est passée."""
    j = derniere_journee(u, annee, mois)
    if not j:
        return 0
    d = fin_de(annee, mois)
    lg = lignes_reevaluation(u, positions(u, d), d)
    if not lg:
        return 0
    ecrire(u, j["id"], j["date_comptable"], f"Réévaluation des comptes en devises au {d.strftime('%d/%m/%Y')}", "reevaluation", "reevaluation", lg)
    return 1


def exercice_de(u, p: dict) -> dict:
    ex = p.get("exercice")
    e = une("select * from exercice where institution_id = %s and annee = %s", (u["institution_id"], int(ex))) if str(ex or "").isdigit() else None
    if not e:
        raise ErreurMetier("À remplir : Exercice.")
    return e


def periodes(u, annee: int) -> list[dict]:
    faits = {r["mois"]: r for r in lignes("select * from periode where institution_id = %s and annee = %s and statut = 'cloturee'", (u["institution_id"], annee))}
    return [{"mois": m, "libelle": MOIS[m - 1], "cloture": m in faits, "clotureLe": faits[m]["cloturee_le"].date().isoformat() if m in faits and faits[m]["cloturee_le"] else "",
             "cloturePar": nom_utilisateur(faits[m]["cloturee_par"]) if m in faits and faits[m]["cloturee_par"] else ""} for m in range(1, 13)]


def controles(u, annee: int, mois: int | None) -> list[dict]:
    """Contrôles avant la clôture du mois ou de l'exercice. Bloquants : période finie, journées comptabilisées, caisses arrêtées (PCCI § 3.4).
    Les autres sont des travaux de fin de période à régulariser : ils sont signalés."""
    i, debut, fin = u["institution_id"], date(annee, 1, 1), fin_de(annee, mois)
    quoi = "du mois" if mois else "au 31 décembre"
    out = []

    def ajouter(libelle, ok, detail="", bloquant=False):
        out.append({"libelle": libelle, "ok": bool(ok), "detail": "" if ok else detail, "bloquant": bloquant})

    apres = valeur("""select count(*) from journee_comptable j join agence a on a.id = j.agence_id where a.institution_id = %s and j.date_comptable > %s""", (i, fin))
    ajouter("Période terminée", apres, "Aucune journée ouverte après le " + fin.strftime("%d/%m/%Y"), True)
    nj = valeur("""select count(*) from journee_comptable j join agence a on a.id = j.agence_id where a.institution_id = %s and j.date_comptable between %s and %s
                   and j.statut <> 'fermee'""", (i, debut, fin))
    ajouter("Journées comptabilisées", nj == 0, f"{nj} journée(s) à comptabiliser (Comptabilité > Comptabilisation)", True)
    ns = valeur("""select count(*) from session_caisse s join journee_comptable j on j.id = s.journee_id join agence a on a.id = j.agence_id
                   where a.institution_id = %s and j.date_comptable between %s and %s and s.statut = 'ouverte'""", (i, debut, fin))
    ajouter("Caisses arrêtées", ns == 0, f"{ns} caisse(s) encore ouverte(s)", True)
    sans = [r["numero"] for r in lignes("""select cb.numero from compte_bancaire cb where cb.institution_id = %s and cb.supprime_le is null
                                           and not exists (select 1 from rapprochement r where r.compte_bancaire_id = cb.id and r.fin >= %s) order by cb.numero""", (i, fin))]
    ajouter(f"Rapprochements bancaires {quoi}", not sans, "Sans rapprochement : " + ", ".join(sans))
    att = lignes("""select c.numero from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
                    where e.institution_id = %s and e.date_valeur <= %s and (c.numero like '475%%' or c.numero like '37%%') group by 1
                    having sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) <> 0 order by 1""", (i, fin))
    ajouter("Comptes d'attente (475) et de suspens (37) soldés", not att, "Non soldés : " + ", ".join(r["numero"] for r in att))
    # B23 : le compte 59 « Virements internes » est un compte d'attente qui doit être soldé en fin de période (PCCI, fiche du compte 59)
    vi = lignes("""select c.numero from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
                   where e.institution_id = %s and e.date_valeur <= %s and c.numero like '59%%' group by 1
                   having sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) <> 0 order by 1""", (i, fin))
    ajouter("Virements internes (59) soldés", not vi, "Non soldés : " + ", ".join(r["numero"] for r in vi))
    # B24 : un suspens se reclasse dans la semaine (PCCI, fiche du compte 37) : ceux qui n'étaient déjà pas soldés sept jours plus tôt sont signalés
    vieux = lignes("""select c.numero from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
                      where e.institution_id = %s and e.date_valeur <= %s and c.numero like '37%%' group by c.numero, coalesce(l.contrat_ref, '')
                      having sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) <> 0
                         and sum(case when e.date_valeur <= %s then (case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) else 0 end) <> 0
                      order by 1""", (i, fin, fin - timedelta(days=7)))
    ajouter("Suspens (37) reclassés dans la semaine", not vieux, "En suspens depuis plus d'une semaine : " + ", ".join(sorted({r["numero"] for r in vieux})))
    credits = valeur("select count(*) from credit where institution_id = %s and statut = 'debloque' and debloque_le <= %s", (i, fin))
    ba = valeur("select 1 from balance_agee where institution_id = %s and date_lancement = %s", (i, fin))
    ajouter(f"Balance âgée et provisions {quoi}", not credits or ba,
            f"Lancer la balance âgée au {fin.strftime('%d/%m/%Y')}, puis provisionner (Crédit ; Instr. BCC 003, art. 12)")
    if ba:
        # B2 : provision requise (capital restant × taux de la tranche, art. 12) contre provision constatée aux comptes 380 ; pénalité mensuelle de 1 % de
        # l'insuffisance (Instr. BCC 003, art. 14). B3 : irrécupérables passés en perte à la clôture du bilan au 31 décembre (art. 9 et 10)
        from .provisions import cible
        from .services import cours
        bl = lignes("""select l.* from balance_agee_ligne l join balance_agee b on b.id = l.balance_id join credit c on c.id = l.credit_id
                       where b.institution_id = %s and b.date_lancement = %s and c.statut <> 'passe_en_perte'""", (i, fin))
        requise = round(sum(l["capital_restant"] * taux_provision(cible(l)) // 100 * cours(l["devise"], fin) for l in bl))
        constatee = -(valeur("""select coalesce(sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end), 0) from ligne_ecriture l
                                join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
                                where e.institution_id = %s and e.date_valeur <= %s and c.numero like '380%%'""", (i, fin)) or 0)
        manque = max(requise - constatee, 0)
        ajouter(f"Provisions au niveau requis {quoi}", manque == 0, f"Insuffisance : {manque / 100:,.2f} CDF ; pénalité mensuelle de 1 % : {manque / 10000:,.2f} CDF "
                f"(Instr. BCC 003, art. 12 et 14). Provisionner (Crédit > Déclassement et provisions)".replace(",", " "))
        from .services import est_coopec
        if est_coopec(u):
            # B28 : le membre d'un organe d'une COOPEC ne détient aucune créance en retard de remboursement (Instr. BCC 41, art. 21)
            organes = {r["id"]: r["numero"] for r in lignes("select id, numero from tiers where institution_id = %s and apparente in ('administrateur', 'dirigeant')", (i,))}
            retard = sorted({organes[l["tiers_id"]] for l in bl if l["jours_retard"] > 0 and l["tiers_id"] in organes})
            ajouter("Membres des organes sans créance en retard", not retard, "En retard de remboursement (Instr. BCC 41, art. 21) : " + ", ".join(retard))
        if not mois:
            irr = [valeur("select numero from credit where id = %s", (l["credit_id"],)) for l in bl if l["classe"] == "irrecuperable"]
            ajouter("Crédits irrécupérables passés en perte", not irr, "À passer en perte au 31 décembre (Instr. BCC 003, art. 9 et 10) : " + ", ".join(irr))
    # B4 : compte courant débiteur sans mouvement créditeur depuis plus de 30 jours, inclus dans les crédits douteux (Instr. BCC 003, art. 7, al. 2). Le seuil
    # du mouvement « significatif » n'étant défini par aucun texte lu, le dernier versement est montré pour que l'institution en juge
    deb = []
    for k in lignes("""select k.id, k.numero, sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end) as solde, k.devise,
                              max(case when l.sens = 'C' then e.date_valeur end) as dernier_credit
                       from compte_depot k join produit_epargne pe on pe.id = k.produit_id join ligne_ecriture l on l.contrat_ref = 'depot:' || k.id
                       join ecriture e on e.id = l.ecriture_id where pe.institution_id = %s and pe.categorie_compte = 'Courant' and e.date_valeur <= %s
                       group by k.id, k.numero, k.devise""", (i, fin)):
        if int(k["solde"]) > 0 and (not k["dernier_credit"] or (fin - k["dernier_credit"]).days > 30):
            dc = k["dernier_credit"]
            deb.append(f"{k['numero']} (dernier versement : {dc.strftime('%d/%m/%Y') if dc else 'aucun'})")
    ajouter("Comptes courants débiteurs sans versement depuis plus de 30 jours", not deb,
            "À classer en crédits douteux (Instr. BCC 003, art. 7, al. 2) : " + ", ".join(deb))
    # B25 : les engagements de garantie reçus s'évaluent sur les sommes dues par le débiteur à la clôture (PCCI § 7.3.1.2) : une caution qui reste
    # engagée au-delà du capital restant dû du crédit est signalée ; elle se ramène par Libérer caution (S94)
    from .remboursements import etat as etat_credit
    trop = []
    for g in lignes("""select g.credit_id, sum(g.montant - g.libere) as reste from garantie g join credit c on c.id = g.credit_id
                       where c.institution_id = %s and g.type = 'caution' and g.montant > g.libere group by 1""", (i,)):
        c = une("select * from credit where id = %s", (g["credit_id"],))
        if c["statut"] != "debloque" or int(g["reste"]) > etat_credit(c, fin)["capitalRestant"]:
            trop.append(c["numero"])
    ajouter("Cautions reçues au plus égales au restant dû", not trop, "À ramener au restant dû (Crédit > Caution et nantissement > Libérer caution ; PCCI § 7.3.1.2) : " + ", ".join(sorted(trop)))
    from .incidents import ouverts                                     # B17 : traitement des incidents et dépassements (Instr. BCC 008, art. 49)
    no = ouverts(i)
    ajouter("Incidents et dépassements régularisés", no == 0, f"{no} incident(s) ou dépassement(s) à traiter (Client > Conformité > Incidents et dépassements)")
    reste = sum(max(couru(x, fin) - x["interets_courus"], 0) for x in lignes(
        "select * from depot_terme where institution_id = %s and statut = 'valide' and date_depot <= %s", (i, fin)))
    ajouter("Intérêts courus des dépôts à terme", reste == 0, "À passer : Autres > Calculs > Calcul des intérêts sur DAT")
    # B8 : intérêts courus non échus des crédits sains aux créances rattachées (PCCI § 4.1.3 et § 6.4)
    ecart = sum(abs(couru_credit(c, fin) - c["interets_courus"]) for c in lignes(
        "select * from credit where institution_id = %s and debloque_le <= %s and (statut = 'debloque' or interets_courus > 0)", (i, fin)))
    ajouter("Intérêts courus des crédits sains", ecart == 0, "À passer : Autres > Calculs > Intérêts courus sur crédits")
    return out


def soldes_gestion(u, ex: int) -> list[dict]:
    """Soldes des comptes de gestion de l'exercice, par compte et devise : débit moins crédit"""
    return lignes("""select c.numero, trim(l.devise) as devise, sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end)::bigint as sd,
                            sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end)::bigint as sc
                     from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
                     where e.institution_id = %s and extract(year from e.date_valeur) = %s and left(c.numero, 1) in ('6', '7', '8')
                     group by 1, 2 having sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) <> 0 order by 1, 2""", (u["institution_id"], ex))


def resultats(u, ex: int) -> list[dict]:
    """Soldes de gestion de l'exercice dans l'ordre de la classe 8 (PCCI) : positif = excédent"""
    s: dict = defaultdict(int)
    for r in soldes_gestion(u, ex):
        s[r["numero"][:2]] += r["sc"]

    def somme(*prefixes):
        return -sum(s[k] for k in prefixes)
    pnf = somme("70", "71", "72", "73", "60", "61", "62", "63", "80")
    rbe = pnf + somme("74", "64", "65", "66", "82")
    rce = rbe + somme("78", "79", "68", "69", "83")
    rex = somme("76", "77", "67", "84")
    impot = -somme("86")
    net = rce + rex + somme("85", "87") - impot
    return [{"compte": "80", "libelle": "Produit net financier", "montant": pnf}, {"compte": "82", "libelle": "Résultat brut d'exploitation", "montant": rbe},
            {"compte": "83", "libelle": "Résultat courant d'exploitation", "montant": rce}, {"compte": "84", "libelle": "Résultat exceptionnel", "montant": rex},
            {"compte": "85", "libelle": "Résultat avant impôt", "montant": rce + rex}, {"compte": "86", "libelle": "Impôt sur le résultat", "montant": impot},
            {"compte": "87", "libelle": "Résultat net de l'exercice", "montant": net}]


def echeances(u, ex: int, m: int | None) -> list[str]:
    """B31 : dates de transmission à la BCC (Instr. BCC 009, art. 1er ; Instr. BCC 41, art. 67)"""
    from .services import est_coopec
    if m:
        a, mm = (ex + 1, 1) if m == 12 else (ex, m + 1)
        return [f"Situation comptable et états annexes de {MOIS[m - 1].lower()} {ex} : à transmettre à la BCC au plus tard le 15/{mm:02d}/{a} (Instr. BCC 009, art. 1er)."]
    coopec = est_coopec(u)
    rang = 6 if coopec else 4
    out = [f"États financiers certifiés et états annexes de l'exercice {ex} : à transmettre à la BCC le {rang}e mois qui suit la clôture, en {MOIS[rang - 1].lower()} {ex + 1} "
           "(Instr. BCC 009, art. 1er)."]
    if coopec:
        out.append(f"Composition du capital social (membres effectifs, parts sociales, adresses) : à déclarer à la BCC au plus tard fin janvier {ex + 1} (Instr. BCC 41, art. 67).")
        faitiere = valeur("select faitiere_affiliation from institution where id = %s", (u["institution_id"],))
        if faitiere:
            # B30 : cotisation au fonds de sécurité, 1 % de l'encours de crédit net à la fin de l'exercice (Instr. BCC 0011, art. 29)
            net = int(valeur("""select coalesce(sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end), 0) from ligne_ecriture l
                                join ecriture e on e.id = l.ecriture_id join compte c on c.id = l.compte_id
                                where e.institution_id = %s and e.date_valeur <= %s and left(c.numero, 2) in ('30', '31', '32', '38', '39')""",
                             (u["institution_id"], date(ex, 12, 31))))
            out.append(f"Cotisation au fonds de sécurité de {faitiere} : 1 % de l'encours de crédit net au 31/12/{ex}, soit {max(net, 0) // 100 / 100:,.2f} CDF, ".replace(",", " ")
                       + f"à verser au plus tard le 30/06/{ex + 1} (Instr. BCC 0011, art. 29).")
    return out


def apercu_cloture(u, p: dict) -> dict:
    """Clôture > Comptabilité : les douze mois de l'exercice et leur état ; pour le mois choisi, les contrôles et la réévaluation à passer ;
    pour l'exercice, les contrôles et les soldes de gestion (classe 8) dont le dernier est viré au compte 13"""
    exiger(u)
    e = exercice_de(u, p)
    ex = e["annee"]
    m = int(p["mois"]) if str(p.get("mois") or "").isdigit() and 1 <= int(p["mois"]) <= 12 else None
    out = {"exercice": ex, "ouvert": e["ouvert"], "valide": e["valide"], "clotureLe": e["cloture_le"].date().isoformat() if e["cloture_le"] else "",
           "cloturePar": nom_utilisateur(e["cloture_par"]) if e["cloture_par"] else "", "periodes": periodes(u, ex), "mois": None,
           "controles": controles(u, ex, None), "soldes": resultats(u, ex), "echeances": echeances(u, ex, None)}
    if m:
        try:
            reev = vue_reevaluation(positions(u, fin_de(ex, m)), fin_de(ex, m), ajustement_devises(u, fin_de(ex, m)))
        except ErreurMetier as err:
            reev = {"date": fin_de(ex, m).isoformat(), "lignes": [], "profit": 0, "perte": 0, "erreur": str(err)}
        out["mois"] = {"mois": m, "libelle": MOIS[m - 1], "controles": controles(u, ex, m), "reevaluation": reev, "echeances": echeances(u, ex, m)}
    return out


def fermer_periodes(u, ex: int, jusqua: int):
    executer("""insert into periode (institution_id, annee, mois, statut, cloturee_le, cloturee_par)
                select %s, %s, m, 'cloturee', now(), %s from generate_series(1, %s) m
                on conflict (institution_id, annee, mois) do update set statut = 'cloturee', cloturee_le = now(), cloturee_par = excluded.cloturee_par
                where periode.statut <> 'cloturee'""", (u["institution_id"], ex, u["id"], jusqua))


def bloquants(liste: list[dict]):
    b = [c for c in liste if c["bloquant"] and not c["ok"]]
    if b:
        raise ErreurMetier("Clôture impossible : " + " ; ".join(f"{c['libelle']} ({c['detail']})" for c in b) + ".")


def cloturer_mois(u, p: dict) -> dict:
    """Bouton Clôturer le mois (clôture informatique, PCCI § 3.4) : réévaluation des comptes en devises au cours du dernier jour (§ 7.1), puis le mois
    et les mois d'avant passent à « clôturé » : plus rien n'y entre. Décembre se clôture avec l'exercice."""
    exiger(u)
    e = exercice_de(u, p)
    ex, m, _, _ = periode(p)
    if e["valide"]:
        raise ErreurMetier("Exercice validé : il ne se clôture plus.")
    if m == 12:
        raise ErreurMetier("Décembre se clôture avec l'exercice (Clôturer l'exercice).")
    if valeur("select 1 from periode where institution_id = %s and annee = %s and mois = %s and statut = 'cloturee'", (u["institution_id"], ex, m)):
        raise ErreurMetier(f"{MOIS[m - 1]} {ex} est déjà clôturé.")
    bloquants(controles(u, ex, m))
    reevaluer(u, ex, m)
    fermer_periodes(u, ex, m)
    return apercu_cloture(u, p)


def lignes_solde(r: dict) -> list[dict]:
    """Solde un compte de gestion : sens inverse de son solde en CDF ; le montant en devise suit quand il est du même sens"""
    meme = r["sd"] and (r["sd"] > 0) == (r["sc"] > 0)
    return [{"compte": r["numero"], "sens": "C" if r["sc"] > 0 else "D", "devise": r["devise"], "montant": abs(r["sd"]) if meme else 0, "cdf": abs(r["sc"])}]


def cloturer(u, p: dict) -> dict:
    """Bouton Clôturer l'exercice : réévaluation au 31 décembre, puis écritures de clôture (type vidage) qui soldent les comptes de gestion par les
    soldes de la classe 8 et virent le résultat net au compte 13 (130 bénéfice, 131 perte), en CDF (PCCI § 7.1), à la date de la dernière journée de
    l'exercice. Les douze mois passent à « clôturé » et l'exercice n'est plus ouvert."""
    exiger(u)
    e = exercice_de(u, p)
    ex = e["annee"]
    if e["valide"]:
        raise ErreurMetier("Exercice validé : il ne se clôture plus.")
    if e["cloture_le"]:
        raise ErreurMetier(f"L'exercice {ex} est déjà clôturé.")
    bloquants(controles(u, ex, None))
    j = derniere_journee(u, ex, None)
    if not j:
        raise ErreurMetier(f"Aucune journée dans l'exercice {ex}.")
    jour = j["date_comptable"]
    n = reevaluer(u, ex, None)
    for cible, sources in SOLDES:
        lg, net = [], 0
        for r in soldes_gestion(u, ex):
            if r["numero"].startswith(sources):
                lg += lignes_solde(r)
                net += r["sc"]
        if not lg:
            continue
        if net:
            lg.append({"compte": cible, "sens": "D" if net > 0 else "C", "devise": "CDF", "montant": abs(net), "cdf": abs(net)})
        ecrire(u, j["id"], jour, f"Clôture {ex} : solde de gestion {cible}", "vidage", "cloture_exercice", lg)
        n += 1
    net = sum(r["sc"] for r in soldes_gestion(u, ex) if r["numero"].startswith("87"))
    if net:
        benefice = net < 0
        ecrire(u, j["id"], jour, f"Clôture {ex} : résultat net de l'exercice", "vidage", "cloture_exercice",
               [{"compte": "87", "sens": "D" if benefice else "C", "devise": "CDF", "montant": abs(net), "cdf": abs(net)},
                {"compte": "130" if benefice else "131", "sens": "C" if benefice else "D", "devise": "CDF", "montant": abs(net), "cdf": abs(net)}])
        n += 1
    fermer_periodes(u, ex, 12)
    executer("update exercice set ouvert = false, cloture_le = now(), cloture_par = %s where institution_id = %s and annee = %s", (u["id"], u["institution_id"], ex))
    return {**apercu_cloture(u, p), "ecritures": n}
