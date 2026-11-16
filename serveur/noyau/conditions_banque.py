"""Écart E15 (docs/reglementaire/ECARTS-2026-11-15.md) : état des conditions de banque, à afficher et à transmettre à la BCC.
Instr. BCC 40, art. 2 (taux, prélèvements au profit de l'État, commissions, frais), art. 3 (publication trimestrielle et à chaque changement,
transmission à la BCC), art. 4 (support papier, libellés précis, tarifs, dates de valeur), art. 5 (police d'au moins 12), art. 6 (informations à jour).
L'état reprend ce qui est paramétré, avec les libellés des écrans de paramétrage. Mêmes règles que web/src/donnees/api.ts (conditionsBanque)."""
from .bd import lignes
from .depots_terme import TAUX_IRC_PHYSIQUE
from .frais import FONDEMENTS
from .produits_credit import PERIODICITES
from .releves import entete
from .services import exiger, journee_courante


def _n(v) -> float | None:
    return None if v is None else float(v)


def etat(u: dict) -> dict:
    exiger(u)
    i = u["institution_id"]
    j = journee_courante(u)
    per = dict(PERIODICITES)
    epargne = [{"code": r["code"], "libelle": r["libelle"], "devise": r["devise"].strip(), "categorie": r["categorie_compte"] or "", "soldeMinimum": r["solde_minimum"],
                "retraitMaxJour": r["retrait_max_jour"], "calculInteret": bool(r["calcul_interet"]), "tenueCompte": r["tenue_compte"]}
               for r in lignes("select * from produit_epargne where institution_id = %s and actif and not supprime order by code", (i,))]
    credit = []
    for r in lignes("select * from produit_credit where institution_id = %s and actif order by numero", (i,)):
        credit.append({"numero": r["numero"], "nom": r["nom"], "devise": r["devise"].strip(), "tauxInteret": _n(r["taux_interet"]), "typeInteret": r["type_interet"] or "",
                       "modeCalcul": r["mode_calcul"] or "", "periodicite": per.get(r["periodicite"], r["periodicite"] or ""), "tauxDiffere": _n(r["taux_differe"]),
                       "penaliteRetard": _n(r["penalite_retard"]), "penaliteAnticipation": _n(r["penalite_anticipation"]),
                       "epargne": {"nature": r["epargne_nature"] or "", "valeur": _n(r["epargne_valeur"])}, "assurance": {"nature": r["assurance_nature"] or "", "valeur": _n(r["assurance_valeur"])},
                       "frais": [{"type": f["type_frais"], "nature": f["nature"], "valeur": float(f["valeur"])}
                                 for f in lignes("select * from produit_credit_frais where produit_id = %s order by id", (r["id"],))]})
    frais = []
    for f in lignes("select * from frais where institution_id = %s order by id", (i,)):
        for p in lignes("""select initcap(p.nature) as nature, p.valeur, s.libelle as pour from parametrage_frais p join liste_reference s on s.id = p.sous_type_id
                           where p.frais_id = %s union all
                           select initcap(nature), valeur, case type_membre when 'physique' then 'Physique' when 'morale' then 'Personne morale' else 'Groupe' end
                           from parametrage_frais_adhesion where frais_id = %s""", (f["id"], f["id"])):
            frais.append({"libelle": f["libelle"], "operation": f["type_operation"], "pour": p["pour"], "nature": p["nature"], "valeur": p["valeur"],
                          "fondement": FONDEMENTS.get(f["fondement"] or "", "À renseigner"), "autorisationBcc": f["autorisation_bcc"] or ""})
    return {"entete": entete(i), "date": j["date"] if j else "", "epargne": epargne, "credit": credit, "frais": frais,
            "retenueInterets": float(TAUX_IRC_PHYSIQUE)}
