"""S99 : Crédit > Déclassement provision et crédit (manuel Microfina++, p. 121, capture « Déclassement et provisionnement de crédit »).
Mêmes règles que web/src/donnees/api.ts (provisions). Registre S99-1 à S99-6, CR-17, CR-18.

Capture : Provisionner tout les crédits ; Date Opération * ; Charger crédits, Radier par anticipation, Provisionner ; grille à cocher (N° crédit, Client,
Montant prêt, Date déblocage, Capital Restant…). Le manuel n'a pas de texte : les règles viennent des textes lus.
- Les crédits et leur classe sont ceux de la balance âgée de la date (S98).
- Déclassement : le capital restant passe du compte du crédit sain (32, 31, 30) au compte 390 de sa tranche, ou d'une tranche à l'autre, ou revient au
  compte sain (PCCI, compte 39 : débité des créances en retard, crédité des créances redevenues saines). Le sain assimilé va en 3900 (Instr. BCC 003, art. 6, al. 2).
- Provision : capital restant × taux de la tranche (S21-1 ; Instr. BCC 003, art. 12), au compte 380 de la tranche ; hausse : dotation 6902 ; baisse :
  reprise 7902 (PCCI, comptes 38, 690, 790).
- Radier par anticipation : seulement un crédit irrécupérable, et seulement au 31 décembre, clôture du bilan (Instr. BCC 003, art. 9 et 10 ; CR-18) ;
  perte 6910 (couverte par la provision) et 6911 (le reste), reprise de la provision ; suivi en hors bilan : 0612 contre 096 (PCCI, hors bilan, 06 et 096)."""
import uuid
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .balance_agee import rafraichir
from .deblocage import comptes_credit
from .modeles_credit import DEGRES
from .remboursements import etat
from .services import exiger, journee_courante, nouvelle_piece, poster, titulaire

PROVISION = {2: "3800", 3: "3801", 4: "3802", 5: "3803", 6: "3804", 7: "3804"}      # PCCI 380, par tranche de retard


def taux(degre: int) -> int:
    return int(DEGRES[degre - 1]["taux"]) if degre > 1 else 0


def jour(u) -> date:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]


def date_operation(u, d) -> date:
    if not d:
        raise ErreurMetier("Date Opération : obligatoire.")
    try:
        x = date.fromisoformat(d)
    except (TypeError, ValueError):
        raise ErreurMetier("Date Opération : une date.")
    if x > jour(u):
        raise ErreurMetier("Date Opération : pas après la journée ouverte.")
    return x


def balance(u, d: date) -> int:
    b = valeur("select id from balance_agee where institution_id = %s and date_lancement = %s", (u["institution_id"], d))
    if not b:
        raise ErreurMetier(f"Aucune balance âgée au {d.strftime('%d/%m/%Y')} : la lancer d'abord (Génération de balance âgée).")
    return b


def cible(l: dict) -> int:
    """Degré comptable visé : celui de la balance ; le sain assimilé est un impayé (3900, 5 %)"""
    return 2 if l["assimile"] else l["degre"]


def charger(u, p) -> list[dict]:
    exiger(u)
    d = date_operation(u, (p or {}).get("date") if isinstance(p, dict) else None)
    b = balance(u, d)
    out = []
    for l in lignes("""select l.*, c.numero, c.debloque_le, c.provision, c.statut from balance_agee_ligne l join credit c on c.id = l.credit_id
                       where l.balance_id = %s order by c.numero""", (b,)):
        g = cible(l)
        out.append({"id": l["credit_id"], "numero": l["numero"], "client": titulaire(l["tiers_id"]), "montant": l["montant"], "devise": l["devise"],
                    "dateDeblocage": l["debloque_le"].isoformat(), "capitalRestant": l["capital_restant"], "joursRetard": l["jours_retard"],
                    "degre": DEGRES[g - 1]["libelle"] + (" (assimilé)" if l["assimile"] else ""), "tranche": g - 1, "taux": taux(g),
                    "provisionRequise": l["capital_restant"] * taux(g) // 100, "provision": l["provision"], "statut": l["statut"],
                    "irrecuperable": l["classe"] == "irrecuperable"})
    return out


def controle_date(c: dict, d: date):
    """Les montants viennent de la balance de la date : rien ne doit s'être passé sur le crédit depuis (registre S99-5)"""
    if c["provisionne_le"] and c["provisionne_le"] > d:
        raise ErreurMetier(f"Crédit {c['numero']} : déjà provisionné au {c['provisionne_le'].strftime('%d/%m/%Y')} ; choisir une date égale ou postérieure.")
    if valeur("select 1 from remboursement where credit_id = %s and date_reglement > %s limit 1", (c["id"], d)):
        raise ErreurMetier(f"Crédit {c['numero']} : remboursé après le {d.strftime('%d/%m/%Y')} ; lancer la balance âgée à une date plus récente.")


def provisionner_un(u, c: dict, l: dict | None, d: date, j: date) -> bool:
    """Déclassement et provision d'un crédit d'après sa ligne de balance (None : plus en cours, tout revient à zéro)"""
    controle_date(c, d)
    dv = c["devise"].strip()
    g_av, p_av = c["degre_comptable"], c["provision"]
    g = cible(l) if l else 1
    capital = l["capital_restant"] if l else 0
    p = capital * taux(g) // 100
    gp_av = c["degre_provision"]
    lg: list[dict] = []
    k = f"credit:{c['id']}"
    if l and g != g_av and capital:
        de, vers = comptes_credit(c, g_av)["capital"], comptes_credit(c, g)["capital"]
        if de != vers:
            lg += [{"compte": vers, "contrat": k, "sens": "D", "devise": dv, "montant": capital}, {"compte": de, "contrat": k, "sens": "C", "devise": dv, "montant": capital}]
    cp_av = PROVISION.get(gp_av) if p_av else None
    cp = PROVISION.get(g) if p else None
    if p_av and cp and cp_av != cp:                                    # la provision suit la tranche
        m = min(p_av, p)
        lg += [{"compte": cp_av, "contrat": k, "sens": "D", "devise": dv, "montant": m}, {"compte": cp, "contrat": k, "sens": "C", "devise": dv, "montant": m}]
    if p > p_av:
        lg += [{"compte": "6902", "contrat": k, "sens": "D", "devise": dv, "montant": p - p_av}, {"compte": cp, "contrat": k, "sens": "C", "devise": dv, "montant": p - p_av}]
    elif p < p_av:
        lg += [{"compte": cp_av, "contrat": k, "sens": "D", "devise": dv, "montant": p_av - p}, {"compte": "7902", "contrat": k, "sens": "C", "devise": dv, "montant": p_av - p}]
    hb_av = c["interets_hors_bilan"]                                  # CR-19 : intérêts non réglés d'un crédit litigieux, suivis en 0630 contre 096
    hb = l["interet_impaye"] if l and g > 1 else 0
    if hb > hb_av:
        lg += [{"compte": "0630", "contrat": k, "sens": "D", "devise": dv, "montant": hb - hb_av}, {"compte": "096", "contrat": k, "sens": "C", "devise": dv, "montant": hb - hb_av}]
    elif hb < hb_av:
        lg += [{"compte": "096", "contrat": k, "sens": "D", "devise": dv, "montant": hb_av - hb}, {"compte": "0630", "contrat": k, "sens": "C", "devise": dv, "montant": hb_av - hb}]
    if not lg and g == g_av and p == p_av:
        executer("update credit set provisionne_le = %s where id = %s", (d, c["id"]))
        return False
    eid = poster(u, journal="OD", journee_id=journee_courante(u)["id"], libelle=f"Déclassement et provision du crédit {c['numero']} au {d.strftime('%d/%m/%Y')}",
                 piece=nouvelle_piece(u, "OD", j), evenement="provision_credit", cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=lg) if lg else None
    executer("update credit set degre_comptable = %s, provision = %s, degre_provision = %s, provisionne_le = %s, interets_hors_bilan = %s where id = %s",
             (g, p, g if p else None, d, hb, c["id"]))
    executer("""insert into provision_credit (institution_id, credit_id, date_operation, nature, degre_avant, degre_apres, provision_avant, provision_apres,
                capital_restant, ecriture_id, par) values (%s, %s, %s, 'provision', %s, %s, %s, %s, %s, %s, %s)""",
             (u["institution_id"], c["id"], d, g_av, g, p_av, p, capital, eid, u["id"]))
    return True


def compenser(u, c: dict, d: date) -> int:
    """CR-21b : compensation de plein droit entre le dépôt que le client a nanti (épargne obligatoire bloquée au déblocage, dépôts de garantie de S94)
    et sa dette exigible, c'est-à-dire l'échu impayé ; les frais dus (pénalité de retard) sont déduits d'abord (loi 11/020, art. 45 à 48 ; Code civil,
    livre III, art. 181 à 183). Pas de compensation sur le compte d'une caution (art. 48 vise le dépôt du client ; Code civil, art. 186), ni quand les
    avoirs du client sont gelés (art. 46, 1° : chose qui ne fait l'objet d'aucune saisie). Rend le montant compensé."""
    from .gel import gel_actif
    from .remboursements import CLES, enregistrer, ordre
    from .services import compte_du_produit, solde_contrat
    if gel_actif(c["tiers_id"]):
        return 0
    total = 0
    dv = c["devise"].strip()
    for b in lignes("""select b.*, cd.produit_id, p.famille, p.compte_lie from blocage b join compte_depot cd on cd.id = b.compte_id
                       join produit_epargne p on p.id = cd.produit_id
                       where b.garantie_de = %s and b.fin is null and cd.tiers_id = %s and trim(cd.devise) = %s and cd.statut = 'ouvert' order by b.id""",
                    (c["id"], c["tiers_id"], dv)):
        c = une("select * from credit where id = %s", (c["id"],))
        if c["statut"] != "debloque":
            break
        s = etat(c, d)
        exigible = {k: s["du"][k] for k in ("penalite", "capital", "interet", "tva")}
        a = min(b["montant"] or 0, sum(exigible.values()), max(0, solde_contrat(f"depot:{b['compte_id']}", dv, "C")))
        if a <= 0:
            continue
        rep, reste = {k: 0 for k in CLES}, a
        for k in ["penalite"] + [x for x in ordre(c, s["degre"]) if x in ("capital", "interet")] + ["tva"]:   # frais d'abord, puis l'ordre du crédit (CR-20)
            m = min(reste, exigible.get(k, 0) - rep[k])
            rep[k] += m
            reste -= m
        _, rid = enregistrer(u, c, d, a, rep, {"compte": compte_du_produit(b), "contrat": f"depot:{b['compte_id']}"}, "OD", str(uuid.uuid4()),
                             "Compensation du dépôt nanti (loi 11/020, art. 48)",
                             {"mode": "compensation", "libelle": f"Compensation du dépôt nanti, crédit {c['numero']}"})
        executer("update blocage set fin = now(), leve_par = %s, motif_levee = %s where id = %s",
                 (u["id"], f"Compensation avec le crédit {c['numero']} : {a / 100:.2f}", b["id"]))
        g = une("select * from garantie where blocage_id = %s", (b["id"],))
        solde_ = valeur("select statut from credit where id = %s", (c["id"],)) == "solde"     # crédit soldé : l'épargne obligatoire est déjà libérée (S76-9)
        nb = valeur("insert into blocage (compte_id, montant, motif, garantie_de, pose_par) values (%s, %s, %s, %s, %s) returning id",
                    (b["compte_id"], b["montant"] - a, b["motif"], c["id"], u["id"])) if b["montant"] - a > 0 and (g or not solde_) else None
        if g:                                                           # dépôt de garantie de S94 : la part compensée compte comme libérée
            executer("update garantie set libere = libere + %s, blocage_id = %s, liberee_le = %s where id = %s",
                     (a, nb, d if g["montant"] - g["libere"] - a == 0 else None, g["id"]))
            executer("insert into garantie_liberation (garantie_id, montant, date_op, par) values (%s, %s, %s, %s)", (g["id"], a, d, u["id"]))
        total += a
    return total


def provisionner(u, p, tout: bool = False) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    d = date_operation(u, p.get("date"))
    j = jour(u)
    b = balance(u, d)
    par_credit = {l["credit_id"]: l for l in lignes("select * from balance_agee_ligne where balance_id = %s", (b,))}
    if tout:
        ids = sorted(set(par_credit) | {x["id"] for x in lignes("""select id from credit where institution_id = %s and (provision > 0 or degre_comptable > 1)
                                                                    and statut <> 'passe_en_perte'""", (u["institution_id"],))})
    else:
        ids = [int(x) for x in (p.get("credits") or []) if isinstance(x, int) and not isinstance(x, bool)]
        if not ids:
            raise ErreurMetier("Cocher au moins un crédit.")
        for i in ids:
            if i not in par_credit:
                raise ErreurMetier("Crédit absent de la balance âgée de cette date.")
    n = 0
    for i in ids:
        c = une("select * from credit where id = %s and institution_id = %s", (i, u["institution_id"]))
        if not c or c["statut"] == "passe_en_perte":
            continue
        l = par_credit.get(i)
        if l and l["jours_retard"] > 0 and c["statut"] == "debloque":
            controle_date(c, d)
            if compenser(u, c, d):                                    # CR-21b : le dépôt nanti paie d'abord l'échu ; la ligne de balance est recalculée
                c = une("select * from credit where id = %s", (i,))
                l = rafraichir(b, c, d)
        n += provisionner_un(u, c, l, d, j)
    return {"credits": len(ids), "ecritures": n, "lignes": charger(u, {"date": d.isoformat()})}


def radier(u, p) -> dict:
    """Radier par anticipation, dans la limite de l'Instr. BCC 003, art. 9 et 10 (CR-18)"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    d = date_operation(u, p.get("date"))
    j = jour(u)
    if (d.month, d.day) != (12, 31):
        raise ErreurMetier("Radiation : seulement à la clôture du bilan, au 31 décembre (Instr. BCC 003, art. 10).")
    b = balance(u, d)
    ids = [int(x) for x in (p.get("credits") or []) if isinstance(x, int) and not isinstance(x, bool)]
    if not ids:
        raise ErreurMetier("Cocher au moins un crédit.")
    par_credit = {l["credit_id"]: l for l in lignes("select * from balance_agee_ligne where balance_id = %s", (b,))}
    for i in ids:
        l = par_credit.get(i)
        if not l:
            raise ErreurMetier("Crédit absent de la balance âgée de cette date.")
        if l["classe"] != "irrecuperable":
            n = valeur("select numero from credit where id = %s", (i,))
            raise ErreurMetier(f"Crédit {n} : seul un crédit irrécupérable (plus de 12 mois de retard) passe en perte (Instr. BCC 003, art. 9 et 10).")
    for i in ids:
        c = une("select * from credit where id = %s", (i,))
        provisionner_un(u, c, par_credit[i], d, j)                    # provision à 100 % d'abord
        c = une("select * from credit where id = %s", (i,))
        dv, k, r, pv = c["devise"].strip(), f"credit:{i}", par_credit[i]["capital_restant"], c["provision"]
        cap = comptes_credit(c, c["degre_comptable"])["capital"]
        lg = [{"compte": "6910", "contrat": k, "sens": "D", "devise": dv, "montant": min(pv, r)}] if min(pv, r) else []
        if r > pv:
            lg.append({"compte": "6911", "contrat": k, "sens": "D", "devise": dv, "montant": r - pv})
        lg.append({"compte": cap, "contrat": k, "sens": "C", "devise": dv, "montant": r})
        if pv:
            lg += [{"compte": PROVISION[c["degre_provision"]], "contrat": k, "sens": "D", "devise": dv, "montant": pv},
                   {"compte": "7902", "contrat": k, "sens": "C", "devise": dv, "montant": pv}]
        lg += [{"compte": "0612", "contrat": k, "sens": "D", "devise": dv, "montant": r}, {"compte": "096", "contrat": k, "sens": "C", "devise": dv, "montant": r}]
        eid = poster(u, journal="OD", journee_id=journee_courante(u)["id"], libelle=f"Passage en perte du crédit {c['numero']}", piece=nouvelle_piece(u, "OD", j),
                     evenement="radiation_credit", cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=lg)
        executer("update credit set statut = 'passe_en_perte', provision = 0, degre_provision = null, radie_le = %s where id = %s", (d, i))
        executer("""insert into provision_credit (institution_id, credit_id, date_operation, nature, degre_avant, degre_apres, provision_avant, provision_apres,
                    capital_restant, ecriture_id, par) values (%s, %s, %s, 'radiation', %s, %s, %s, 0, %s, %s, %s)""",
                 (u["institution_id"], i, d, c["degre_comptable"], c["degre_comptable"], pv, r, eid, u["id"]))
    return {"credits": len(ids), "lignes": charger(u, {"date": d.isoformat()})}


def reste_radie(c: dict) -> int:
    """Ce qui reste suivi en hors bilan (0612) d'un crédit passé en perte"""
    return int(valeur("""select coalesce(sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end), 0) from ligne_ecriture l
                         join compte k on k.id = l.compte_id where k.numero like '0612%%' and l.contrat_ref = %s""", (f"credit:{c['id']}",)))


def radies(u) -> list[dict]:
    """B18 (confrontation du 21/11/2026) : crédits passés en perte dont une part reste suivie en hors bilan"""
    exiger(u)
    out = []
    for c in lignes("select * from credit where institution_id = %s and statut = 'passe_en_perte' order by numero", (u["institution_id"],)):
        r = reste_radie(c)
        if r > 0:
            out.append({"id": c["id"], "numero": c["numero"], "client": titulaire(c["tiers_id"]), "tiersId": c["tiers_id"], "devise": c["devise"].strip(),
                        "radieLe": c["radie_le"].isoformat() if c["radie_le"] else "", "reste": r})
    return out


def rentree(u, cid: int, p) -> list[dict]:
    """B18 : rentrée sur une créance passée en perte : produit au 791 « Rentrées sur créances irrécouvrables », sortie du hors bilan (0612 contre 096).
    Elle est prélevée sur un compte du client, sur son ordre (PCCI, compte 79 ; hors bilan 06 ; Code civil, livre III, art. 185, 2°, registre T71)."""
    from .services import comptes_du_tiers
    exiger(u)
    p = p if isinstance(p, dict) else {}
    c = une("select * from credit where id = %s and institution_id = %s and statut = 'passe_en_perte' for update", (cid, u["institution_id"])) if isinstance(cid, int) else None
    if not c:
        raise ErreurMetier("Choisir le crédit passé en perte dans la liste.")
    k = next((x for x in comptes_du_tiers(c["tiers_id"]) if x["id"] == p.get("compteId")), None)
    if not k:
        raise ErreurMetier("À remplir : Compte Client.")
    if k["devise"] != c["devise"].strip():
        raise ErreurMetier("Le compte du client n'est pas dans la devise du crédit.")
    ordre = p.get("ordreClient").strip() if isinstance(p.get("ordreClient"), str) else ""
    if not ordre:
        raise ErreurMetier("À remplir : Ordre du client (Code civil, livre III, art. 185, 2° : pas de prélèvement sur un dépôt sans l'ordre du client).")
    m = p.get("montant")
    if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
        raise ErreurMetier("À remplir : Montant de la rentrée.")
    if m > reste_radie(c):
        raise ErreurMetier("Montant de la rentrée : au plus ce qui reste suivi en hors bilan.")
    if m > k["disponible"]:
        raise ErreurMetier("Montant de la rentrée : plus que le solde disponible du compte.")
    j, dv, kc = jour(u), c["devise"].strip(), f"credit:{c['id']}"
    poster(u, journal="OD", journee_id=journee_courante(u)["id"], libelle=f"Rentrée sur le crédit {c['numero']} passé en perte (ordre : {ordre})",
           piece=nouvelle_piece(u, "OD", j), evenement="remboursement_credit", cle=str(uuid.uuid4()), valide_par=u["id"],
           lignes_ecr=[{"compte": k["pcci"], "contrat": f"depot:{k['id']}", "sens": "D", "devise": dv, "montant": m},
                       {"compte": "791", "contrat": kc, "sens": "C", "devise": dv, "montant": m},
                       {"compte": "096", "contrat": kc, "sens": "D", "devise": dv, "montant": m},
                       {"compte": "0612", "contrat": kc, "sens": "C", "devise": dv, "montant": m}])
    return radies(u)
