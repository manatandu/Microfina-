"""S89 : Crédit > Dossier de crédit > Mise en place (manuel Microfina++, p. 113 et 114, texte 2.16 à 2.23). Mêmes règles que web/src/donnees/api.ts (miseEnPlace).
Demandes approuvées ; montant et durée ; ligne de financement et bailleur ; comptes d'épargne obligatoire et de fonds de solidarité ; assureur (montant selon
le produit) ; objet de crédit et zone ; échéancier, agent de crédit, Enregistrer. Le crédit reçoit son échéancier et son TEG (Instr. BCC 38, art. 3 et 5).
Registre S89-1 à S89-9, CR-6, CR-8, CR-24."""
from datetime import date

from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante, json_lu, titulaire
from .simulation_credit import charge, simuler

STRUCTURES = ("Part. classique",)                 # capture p. 113 : seule valeur montrée (registre S89-4)


def jour(u) -> date:
    j = journee_courante(u)
    return date.fromisoformat(j["date"]) if j else date.today()


def contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"objets": lignes("select id, libelle from credit_objet where institution_id = %s and actif order by libelle", (i,)),
            "zones": lignes("select id, code, nom from zone where institution_id = %s and actif order by nom", (i,)),
            "assureurs": lignes("select id, nom, type_assurance_id as \"typeAssuranceId\" from credit_assureur where institution_id = %s order by nom", (i,)),
            "agents": lignes("select id, nom from utilisateur where agence_id = %s and actif order by nom", (u["agence_id"],)),
            "lignesBudget": lignes("select id, numero, libelle from budget_ligne where institution_id = %s and actif order by numero", (i,)),
            "structures": list(STRUCTURES)}


def demande(u, did) -> dict:
    x = une("select * from demande_credit where id = %s and institution_id = %s for update", (did, u["institution_id"])) if isinstance(did, int) and not isinstance(did, bool) else None
    if not x:
        raise ErreurMetier("Demande introuvable.")
    if x["statut"] != "approuvee":
        raise ErreurMetier("Cette demande n'est pas en attente de mise en place.")
    return x


def comptes_client(u, tid: int, devise: str) -> list[dict]:
    return lignes("""select c.id, c.numero, p.libelle as produit from compte_depot c join produit_epargne p on p.id = c.produit_id
                     where c.tiers_id = %s and c.statut = 'ouvert' and c.devise = %s order by c.numero""", (tid, devise))


def apercu(u, did: int, d) -> dict:
    """Informations sur le montant et la durée, comptes du client et échéancier de la demande (2.18, 2.23)"""
    exiger(u)
    x = demande(u, did)
    differe = (d or {}).get("differe") or 0
    s = simuler(u, {"produitId": x["produit_id"], "montant": x["montant_approuve"], "duree": x["duree_mois"], "differe": differe, "dateDeblocage": jour(u).isoformat()})
    p = une("select * from produit_credit where id = %s", (x["produit_id"],))
    t = une("select zone_id, type from tiers where id = %s", (x["tiers_id"],))
    return {"demande": {"id": x["id"], "numero": x["numero"], "tiersId": x["tiers_id"], "client": titulaire(x["tiers_id"]), "produit": p["nom"], "produitId": p["id"],
                        "montant": x["montant_approuve"], "duree": x["duree_mois"], "date": x["cree_le"].date().isoformat(), "zoneId": t["zone_id"], "agentId": x["saisi_par"],
                        "typeAssuranceId": p["type_assurance_id"], "parts": json_lu(x["parts"]) or []},
            "comptes": comptes_client(u, x["tiers_id"], p["devise"].strip()), "fondsSolidarite": charge(p["solidarite_nature"], p["solidarite_valeur"], x["montant_approuve"]),
            "differeMin": p["differe_min"], "differeMax": p["differe_max"], "simulation": s}


def entier_ou_rien(d, k):
    v = (d or {}).get(k)
    if v in (None, ""):
        return None
    if not isinstance(v, int) or isinstance(v, bool):
        raise ErreurMetier(f"{k} : choix invalide.")
    return v


def creer_depuis_demande(u, x: dict) -> int:
    """Plan d'allègement, point 6.1 : le crédit naît à la décision, avec ce que la demande a recueilli (différé, objet, comptes, assureur, ligne de
    financement) ; la zone est celle du membre, l'agent celui qui a saisi la demande. Mêmes contrôles qu'à l'ancienne mise en place (S89)."""
    p = une("select * from produit_credit where id = %s", (x["produit_id"],))
    s = simuler(u, {"produitId": p["id"], "montant": x["montant_approuve"], "duree": x["duree_mois"], "differe": x["differe_mois"] or 0, "dateDeblocage": jour(u).isoformat()})
    fonds = charge(p["solidarite_nature"], p["solidarite_valeur"], x["montant_approuve"])
    lb = une("select b.numero, b.libelle, b.bailleur_id from budget_ligne b where b.id = %s", (x["ligne_budget_id"],)) if x["ligne_budget_id"] else None
    bailleur = valeur("select nom from bailleur where id = %s", (lb["bailleur_id"],)) if lb and lb["bailleur_id"] else None
    n = int(valeur("select count(*) from credit where institution_id = %s", (u["institution_id"],))) + 1
    numero = f"{valeur('select code from agence where id = %s', (x['agence_id'],))}/{p['numero']}/{n:05d}"
    zone = valeur("select zone_id from tiers where id = %s", (x["tiers_id"],))
    cid = valeur("""insert into credit (institution_id, demande_id, numero, tiers_id, produit_id, montant, devise, duree_mois, date_effet, date_debut, nb_echeances,
                    zone_id, agent_id, ligne_financement, statut, cycle_id, periodicite, taux_interet, taux_differe, differe_mois, ligne_budget_id, bailleur, structure,
                    compte_epargne_id, compte_solidarite_id, epargne_obligatoire, fonds_solidarite, frais, assurance, assureur_id, objet_id, teg_r, teg_a, parts,
                    mis_en_place_par, mis_en_place_le, usage_precis)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'mis_en_place', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], x["id"], numero, x["tiers_id"], p["id"], x["montant_approuve"], p["devise"], x["duree_mois"], s["dateEffet"], s["dateDebut"],
                  s["nombreTraites"], zone, x["agent_id"] or x["saisi_par"], f"{lb['numero']} {lb['libelle']}" if lb else None, x["cycle_id"], s["periodicite"],
                  p["taux_interet"], p["taux_differe"], s["differe"], x["ligne_budget_id"], bailleur, STRUCTURES[0],
                  x["compte_epargne_id"] if s["epargneObligatoire"] else None, x["compte_solidarite_id"] if fonds else None, s["epargneObligatoire"], fonds,
                  s["frais"], s["assurance"], x["assureur_id"] if p["type_assurance_id"] else None, x["objet_id"], s["tegR"], s["tegA"],
                  Jsonb(json_lu(x["parts"]) or []), x["saisi_par"], jour(u), x["usage_precis"] or ""))
    for l in s["echeancier"]:
        executer("insert into echeance (credit_id, rang, date_due, capital, interet) values (%s, %s, %s, %s, %s)", (cid, l["rang"], l["date"], l["capital"], l["interet"]))
    executer("update demande_credit set statut = 'mise_en_place' where id = %s", (x["id"],))
    return cid


def mettre_en_place(u, did: int, d) -> dict:
    """2.16 à 2.23 ; registre S89-1 à S89-9"""
    exiger(u)
    a = apercu(u, did, d)
    x = demande(u, did)
    from .separation_credit import separer
    separer(u, "enregistrement", x["id"])
    from .liste_rouge import controler as liste_rouge
    liste_rouge(x["tiers_id"])                                         # registre CR-9
    p = une("select * from produit_credit where id = %s", (x["produit_id"],))
    s = a["simulation"]
    ids = {c["id"] for c in a["comptes"]}
    ce, cs = entier_ou_rien(d, "compteEpargneId"), entier_ou_rien(d, "compteSolidariteId")
    if s["epargneObligatoire"] and ce not in ids:
        raise ErreurMetier("À remplir : compte d'épargne obligatoire du client, dans la devise du crédit.")
    if a["fondsSolidarite"] and cs not in ids:
        raise ErreurMetier("À remplir : compte du fonds de solidarité du client, dans la devise du crédit.")
    assureur = entier_ou_rien(d, "assureurId")
    if p["type_assurance_id"]:
        if not une("select 1 from credit_assureur where id = %s and institution_id = %s and type_assurance_id = %s", (assureur, u["institution_id"], p["type_assurance_id"])):
            raise ErreurMetier("À remplir : Assureur (de l'assurance du produit).")
    else:
        assureur = None
    objet = entier_ou_rien(d, "objetId")
    o = une("select souscription_parts from credit_objet where id = %s and institution_id = %s and actif", (objet, u["institution_id"]))
    if not o:
        raise ErreurMetier("À remplir : Objet de crédit.")
    if o["souscription_parts"]:   # A6
        raise ErreurMetier("Objet interdit : pas de crédit pour souscrire ou acquérir des parts ou des actions de l'institution (loi 22/069, titre II, chap. II, section 4).")
    usage = str(d.get("usagePrecis") or "").strip()[:200]   # usage précis de l'objet (plan d'allègement, point 2.1)
    zone = entier_ou_rien(d, "zoneId")
    if not une("select 1 from zone where id = %s and institution_id = %s and actif", (zone, u["institution_id"])):
        raise ErreurMetier("À remplir : Zone.")
    agent = entier_ou_rien(d, "agentId")
    if not une("select 1 from utilisateur where id = %s and agence_id = %s and actif", (agent, u["agence_id"])):
        raise ErreurMetier("À remplir : Agent de crédit.")
    ligne = entier_ou_rien(d, "ligneBudgetId")
    lb = une("select b.numero, b.libelle, b.bailleur_id from budget_ligne b where b.id = %s and b.institution_id = %s and b.actif", (ligne, u["institution_id"])) if ligne else None
    if ligne and not lb:
        raise ErreurMetier("Ligne de financement inconnue.")
    structure = (d or {}).get("structure") or STRUCTURES[0]
    if structure not in STRUCTURES:
        raise ErreurMetier("Structure de référencement inconnue.")
    n = int(valeur("select count(*) from credit where institution_id = %s", (u["institution_id"],))) + 1
    numero = f"{valeur('select code from agence where id = %s', (x['agence_id'],))}/{p['numero']}/{n:05d}"
    bailleur = valeur("select nom from bailleur where id = %s", (lb["bailleur_id"],)) if lb and lb["bailleur_id"] else None
    cid = valeur("""insert into credit (institution_id, demande_id, numero, tiers_id, produit_id, montant, devise, duree_mois, date_effet, date_debut, nb_echeances,
                    zone_id, agent_id, ligne_financement, statut, cycle_id, periodicite, taux_interet, taux_differe, differe_mois, ligne_budget_id, bailleur, structure,
                    compte_epargne_id, compte_solidarite_id, epargne_obligatoire, fonds_solidarite, frais, assurance, assureur_id, objet_id, teg_r, teg_a, parts,
                    mis_en_place_par, mis_en_place_le, usage_precis)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'mis_en_place', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], x["id"], numero, x["tiers_id"], p["id"], x["montant_approuve"], p["devise"], x["duree_mois"], s["dateEffet"], s["dateDebut"],
                  s["nombreTraites"], zone, agent, f"{lb['numero']} {lb['libelle']}" if lb else None, x["cycle_id"], s["periodicite"], p["taux_interet"], p["taux_differe"],
                  s["differe"], ligne, bailleur, structure, ce if s["epargneObligatoire"] else None, cs if a["fondsSolidarite"] else None, s["epargneObligatoire"],
                  a["fondsSolidarite"], s["frais"], s["assurance"], assureur, objet, s["tegR"], s["tegA"], Jsonb(json_lu(x["parts"]) or []), u["id"], jour(u), usage))
    for l in s["echeancier"]:
        executer("insert into echeance (credit_id, rang, date_due, capital, interet) values (%s, %s, %s, %s, %s)", (cid, l["rang"], l["date"], l["capital"], l["interet"]))
    executer("update demande_credit set statut = 'mise_en_place' where id = %s", (x["id"],))
    return lire(u, cid)


def vue(c: dict) -> dict:
    nom = lambda uid: valeur("select nom from utilisateur where id = %s", (uid,)) or ""
    return {"id": c["id"], "numero": c["numero"], "tiersId": c["tiers_id"], "membre": valeur("select numero from tiers where id = %s", (c["tiers_id"],)),
            "client": titulaire(c["tiers_id"]), "produitId": c["produit_id"], "produit": valeur("select nom from produit_credit where id = %s", (c["produit_id"],)),
            "montant": c["montant"], "devise": c["devise"].strip(), "duree": c["duree_mois"], "nombreTraites": c["nb_echeances"], "differe": c["differe_mois"],
            "periodicite": c["periodicite"] or "", "tauxInteret": str(c["taux_interet"].normalize()) if c["taux_interet"] is not None else "",
            "dateEffet": c["date_effet"].isoformat() if c["date_effet"] else "", "dateDebut": c["date_debut"].isoformat() if c["date_debut"] else "",
            "objet": valeur("select libelle from credit_objet where id = %s", (c["objet_id"],)) or "", "usagePrecis": c["usage_precis"] or "", "zone": valeur("select nom from zone where id = %s", (c["zone_id"],)) or "",
            "agentId": c["agent_id"], "agent": nom(c["agent_id"]), "ligneFinancement": c["ligne_financement"] or "", "bailleur": c["bailleur"] or "",
            "epargneObligatoire": c["epargne_obligatoire"], "fondsSolidarite": c["fonds_solidarite"], "frais": c["frais"], "assurance": c["assurance"],
            "assureur": valeur("select nom from credit_assureur where id = %s", (c["assureur_id"],)) or "", "tegR": float(c["teg_r"]) if c["teg_r"] is not None else None,
            "tegA": float(c["teg_a"]) if c["teg_a"] is not None else None, "parts": json_lu(c["parts"]) or [], "statut": c["statut"],
            "demande": valeur("select numero from demande_credit where id = %s", (c["demande_id"],)), "dateDemande": valeur("select cree_le from demande_credit where id = %s", (c["demande_id"],)).date().isoformat(),
            "misEnPlaceLe": c["mis_en_place_le"].isoformat() if c["mis_en_place_le"] else "", "misEnPlacePar": nom(c["mis_en_place_par"]),
            "debloqueLe": c["debloque_le"].isoformat() if c["debloque_le"] else "",
            "echeancier": [{"rang": e["rang"], "date": e["date_due"].isoformat(), "capital": e["capital"], "interet": e["interet"]}
                           for e in lignes("select * from echeance where credit_id = %s order by rang", (c["id"],))]}


def lire(u, cid: int) -> dict:
    exiger(u)
    c = une("select * from credit where id = %s and institution_id = %s", (cid, u["institution_id"]))
    if not c:
        raise ErreurMetier("Crédit introuvable.")
    return vue(c)
