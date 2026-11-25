"""B4 (confrontation du 21/11/2026) : comptes courants débiteurs. Mêmes règles que web/src/donnees/api.ts (decouverts).
- Instr. BCC 003, art. 7, al. 2 : le compte courant débiteur sans mouvement créditeur significatif de plus de 30 jours est inclus dans les crédits douteux.
  Aucun texte de la microfinance ne fixe le seuil du mouvement « significatif » (l'Instr. BCC 16, art. 21, qui le fixe pour les banques, écarte les COOPEC
  et les IMF, art. 2) : tout versement compte (registre T84).
- PCCI, fiche du compte 33 : le solde débiteur du compte d'un client douteux est viré au compte 39 « Créances litigieuses ou en retard », par le crédit du
  compte du client ; le compte 39 est crédité du montant remboursé.
- Instr. BCC 003, art. 12 : provision au taux de la tranche de retard (comptes 380, dotation 6902, reprise 7902), comme pour les crédits (S99)."""
import uuid
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .modeles_credit import RETARD
from .provisions import PROVISION, jour, taux
from .remboursements import degre_de
from .services import compte_du_produit, exiger, journee_courante, nouvelle_piece, poster, solde_contrat, titulaire


def candidats(u, d: date) -> list[dict]:
    """Comptes courants débiteurs à la date, sans versement depuis plus de 30 jours"""
    out = []
    for k in lignes("""select k.id, k.numero, k.tiers_id, k.devise, sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end) as solde,
                              max(case when l.sens = 'C' then e.date_valeur end) as dernier_credit, min(e.date_valeur) as premier
                       from compte_depot k join produit_epargne pe on pe.id = k.produit_id join ligne_ecriture l on l.contrat_ref = 'depot:' || k.id
                       join ecriture e on e.id = l.ecriture_id where pe.institution_id = %s and pe.categorie_compte = 'Courant' and e.date_valeur <= %s
                       group by k.id, k.numero, k.tiers_id, k.devise order by k.numero""", (u["institution_id"], d)):
        depuis = k["dernier_credit"] or k["premier"]
        if int(k["solde"]) > 0 and (d - depuis).days > 30:
            g, lib = degre_de((d - depuis).days)
            out.append({"compteId": k["id"], "numero": k["numero"], "client": titulaire(k["tiers_id"]), "devise": k["devise"].strip(), "solde": int(k["solde"]),
                        "dernierVersement": k["dernier_credit"].isoformat() if k["dernier_credit"] else "", "retardDepuis": depuis.isoformat(),
                        "joursRetard": (d - depuis).days, "degre": lib, "tranche": g - 1, "taux": taux(g)})
    return out


def vue(x: dict, d: date) -> dict:
    k = une("select numero, tiers_id from compte_depot where id = %s", (x["compte_id"],))
    jours = (d - x["retard_depuis"]).days
    g, lib = degre_de(jours)
    return {"id": x["id"], "compteId": x["compte_id"], "numero": k["numero"], "client": titulaire(k["tiers_id"]), "devise": x["devise"].strip(), "montant": x["montant"],
            "restant": x["restant"], "retardDepuis": x["retard_depuis"].isoformat(), "joursRetard": jours, "degre": lib, "tranche": g - 1, "taux": taux(g),
            "provisionRequise": x["restant"] * taux(g) // 100, "provision": x["provision"], "classeLe": x["classe_le"].isoformat()}


def lire(u) -> dict:
    exiger(u)
    d = jour(u)
    return {"date": d.isoformat(), "candidats": candidats(u, d),
            "creances": [vue(x, d) for x in lignes("select * from decouvert_douteux where institution_id = %s and restant > 0 order by id", (u["institution_id"],))]}


def ecrire(u, d: date, libelle: str, evenement: str, lg: list[dict]):
    if lg:
        poster(u, journal="OD", journee_id=journee_courante(u)["id"], libelle=libelle, piece=nouvelle_piece(u, "OD", d), evenement=evenement,
               cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=lg)


def ajuster(u, x: dict, d: date, restant: int):
    """Tranche et provision de la créance à la date : le capital passe d'un compte 390 à l'autre, la provision suit (dotation 6902, reprise 7902)"""
    g = degre_de((d - x["retard_depuis"]).days)[0] if restant else x["degre"]
    k, dv, lg = f"decouvert:{x['id']}", x["devise"].strip(), []
    if restant and g != x["degre"]:
        lg += [{"compte": RETARD[g][0], "contrat": k, "sens": "D", "devise": dv, "montant": restant}, {"compte": RETARD[x["degre"]][0], "contrat": k, "sens": "C", "devise": dv, "montant": restant}]
    cible, ancien = restant * taux(g) // 100, x["provision"]
    if ancien and (g != x["degre"] or cible < ancien):
        repris = ancien if g != x["degre"] else ancien - cible
        lg += [{"compte": PROVISION[x["degre"]], "contrat": k, "sens": "D", "devise": dv, "montant": repris}, {"compte": "7902", "contrat": k, "sens": "C", "devise": dv, "montant": repris}]
        ancien -= repris
    if cible > ancien:
        lg += [{"compte": "6902", "contrat": k, "sens": "D", "devise": dv, "montant": cible - ancien}, {"compte": PROVISION[g], "contrat": k, "sens": "C", "devise": dv, "montant": cible - ancien}]
    numero = valeur("select numero from compte_depot where id = %s", (x["compte_id"],))
    ecrire(u, d, f"Provision du compte courant débiteur {numero}", "provision_credit", lg)
    executer("update decouvert_douteux set degre = %s, provision = %s, restant = %s, solde_le = %s where id = %s", (g, cible, restant, d if not restant else None, x["id"]))


def classer(u) -> dict:
    """Bouton Classer et provisionner : vire au compte 39 le solde débiteur des comptes repérés, puis met à leur tranche et provisionne toutes les créances"""
    exiger(u)
    d = jour(u)
    for c in candidats(u, d):
        kd = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s for update of c", (c["compteId"],))
        m = -solde_contrat(f"depot:{kd['id']}", kd["devise"], "C")
        if m <= 0:
            continue
        g = degre_de(c["joursRetard"])[0]
        did = valeur("""insert into decouvert_douteux (institution_id, compte_id, devise, montant, restant, retard_depuis, degre, classe_le, classe_par)
                        values (%s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""", (u["institution_id"], kd["id"], kd["devise"], m, m, c["retardDepuis"], g, d, u["id"]))
        ecrire(u, d, f"Compte courant débiteur {kd['numero']} viré en créances douteuses", "provision_credit",
               [{"compte": RETARD[g][0], "contrat": f"decouvert:{did}", "sens": "D", "devise": c["devise"], "montant": m},
                {"compte": compte_du_produit(kd), "contrat": f"depot:{kd['id']}", "sens": "C", "devise": c["devise"], "montant": m}])
    for x in lignes("select * from decouvert_douteux where institution_id = %s and restant > 0 order by id for update", (u["institution_id"],)):
        ajuster(u, x, d, x["restant"])
    return lire(u)


def recouvrer(u, did: int, p) -> dict:
    """Remboursement de la créance par le débit du compte du client, dans la limite de son disponible (PCCI, compte 39 : crédité du montant remboursé)"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    x = une("select * from decouvert_douteux where id = %s and institution_id = %s and restant > 0 for update", (did, u["institution_id"])) if isinstance(did, int) else None
    if not x:
        raise ErreurMetier("Choisir la créance dans la liste.")
    m = p.get("montant")
    if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
        raise ErreurMetier("À remplir : Montant à recouvrer.")
    if m > x["restant"]:
        raise ErreurMetier("Montant à recouvrer : au plus ce qui reste dû.")
    kd = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s for update of c", (x["compte_id"],))
    if m > solde_contrat(f"depot:{kd['id']}", kd["devise"], "C"):
        raise ErreurMetier("Montant à recouvrer : plus que le solde du compte du client.")
    d, dv = jour(u), x["devise"].strip()
    ecrire(u, d, f"Recouvrement de la créance sur le compte courant {kd['numero']}", "remboursement_credit",
           [{"compte": compte_du_produit(kd), "contrat": f"depot:{kd['id']}", "sens": "D", "devise": dv, "montant": m},
            {"compte": RETARD[x["degre"]][0], "contrat": f"decouvert:{x['id']}", "sens": "C", "devise": dv, "montant": m}])
    ajuster(u, x, d, x["restant"] - m)
    return lire(u)
