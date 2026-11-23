"""S90 à S92 : Crédit > Suivi dossier crédit (manuel Microfina++, p. 114 et 115) : visa du responsable crédit, du comité de crédit, du service
financier ; historique ; crédits validés non débloqués. Mêmes règles que web/src/donnees/api.ts (visasCredit). Registre S90-1 à S92-3, CR-4, CR-5.
Tout crédit passe par les trois visas, dans l'ordre (CR-5) ; un refus arrête le crédit. Comité d'une COOPEC : la commission de crédit, trois membres,
unanimité (loi 002/2002, art. 41 à 43 ; Instr. BCC 007, art. 32)."""
from datetime import date

from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import est_coopec, exiger, journee_courante, json_lu, titulaire

NIVEAUX = ("responsable_credit", "comite", "service_financier")
LIBELLES = {"responsable_credit": "Responsable crédit", "comite": "Comité de crédit", "service_financier": "Service financier"}


def ligne(c: dict) -> dict:
    compte = valeur("select numero from compte_depot where id = %s", (c["compte_epargne_id"],)) if c["compte_epargne_id"] else \
        valeur("select numero from compte_depot where tiers_id = %s and statut = 'ouvert' order by numero limit 1", (c["tiers_id"],))
    return {"id": c["id"], "numero": c["numero"], "dateDemande": valeur("select cree_le from demande_credit where id = %s", (c["demande_id"],)).date().isoformat(),
            "compte": compte or "", "client": titulaire(c["tiers_id"]), "montant": c["montant"], "devise": c["devise"].strip(), "duree": c["duree_mois"],
            "produit": valeur("select nom from produit_credit where id = %s", (c["produit_id"],)), "agentId": c["agent_id"],
            "agent": valeur("select nom from utilisateur where id = %s", (c["agent_id"],)) or "",
            "groupe": titulaire(c["tiers_id"]) if valeur("select type from tiers where id = %s", (c["tiers_id"],)) == "groupe" else ""}


def niveau_ok(n: str):
    if n not in NIVEAUX:
        raise ErreurMetier("Niveau hiérarchique inconnu.")


def a_viser(u, niveau: str, agent_id: int | None = None) -> list[dict]:
    """La file d'un niveau : crédits mis en place dont le niveau précédent a accepté et celui-ci n'a pas encore visé (registre CR-5)"""
    exiger(u)
    niveau_ok(niveau)
    i = NIVEAUX.index(niveau)
    prec = "true" if i == 0 else f"exists (select 1 from visa_credit v where v.credit_id = c.id and v.niveau = '{NIVEAUX[i - 1]}' and (v.avis = 'accepte' or v.appel_decision = 'accorde'))"
    return [ligne(c) for c in lignes(f"""select c.* from credit c where c.institution_id = %s and c.statut = 'mis_en_place' and {prec}
                                         and not exists (select 1 from visa_credit v where v.credit_id = c.id and v.niveau = %s)
                                         and (%s::bigint is null or c.agent_id = %s) order by c.id""", (u["institution_id"], niveau, agent_id, agent_id))]


def viser(u, cid: int, niveau: str, d) -> dict:
    """Viser : avis Accepté ou Refusé, motif d'un refus ; comité d'une COOPEC : les trois membres et leur avis (registre S90-2 à S90-5, CR-4)"""
    exiger(u)
    niveau_ok(niveau)
    c = une("select * from credit where id = %s and institution_id = %s for update", (cid, u["institution_id"]))
    if not c or c["id"] not in {x["id"] for x in a_viser(u, niveau)}:
        raise ErreurMetier("Ce crédit n'attend pas ce visa.")
    if c["mis_en_place_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : le visa est donné par un autre utilisateur que celui qui a mis le crédit en place.")
    from .separation_credit import separer
    separer(u, "verification" if niveau == "responsable_credit" else "autorisation", c["demande_id"], cid)
    avis = (d or {}).get("avis")
    membres = []
    if niveau == "comite" and est_coopec(u):
        brut = (d or {}).get("membres")
        if not isinstance(brut, list) or len(brut) != 3:
            raise ErreurMetier("Commission de crédit : les trois membres et l'avis de chacun (loi 002/2002, art. 41).")
        for m in brut:
            nom = (m or {}).get("nom", "").strip() if isinstance((m or {}).get("nom"), str) else ""
            if not nom or (m or {}).get("avis") not in ("accepte", "refuse"):
                raise ErreurMetier("Commission de crédit : le nom et l'avis de chacun des trois membres.")
            membres.append({"nom": nom, "avis": m["avis"]})
        avis = "accepte" if all(m["avis"] == "accepte" for m in membres) else "refuse"     # unanimité (art. 43 ; Instr. BCC 007, art. 32)
    if avis not in ("accepte", "refuse"):
        raise ErreurMetier("À remplir : Avis.")
    motif = (d or {}).get("motif").strip() if isinstance((d or {}).get("motif"), str) else ""
    if avis == "refuse" and not motif:
        raise ErreurMetier("À remplir : motif du refus.")
    pv = (d or {}).get("referencePv").strip() if isinstance((d or {}).get("referencePv"), str) else ""
    executer("insert into visa_credit (credit_id, niveau, avis, par, reference_pv, motif, membres) values (%s, %s, %s, %s, %s, %s, %s)",
             (cid, niveau, avis, u["id"], pv or None, motif or None, Jsonb(membres)))
    if avis == "refuse":
        executer("update credit set statut = 'refuse' where id = %s", (cid,))
    elif niveau == "service_financier":
        executer("update credit set statut = 'vise' where id = %s", (cid,))
    return {"credit": ligne(une("select * from credit where id = %s", (cid,))), "avis": avis, "statut": valeur("select statut from credit where id = %s", (cid,))}


def appel(u, cid: int, d) -> dict:
    """B29 : appel d'un refus de la Commission de crédit devant le Conseil d'administration, dans une COOPEC (Instr. BCC 007, art. 18 : le Conseil
    statue en appel sur les décisions de la Commission de crédit à l'endroit d'un membre). Accordé : le crédit reprend le circuit des visas."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    if not est_coopec(u):
        raise ErreurMetier("L'appel devant le Conseil d'administration est propre aux coopératives (Instr. BCC 007, art. 18).")
    c = une("select * from credit where id = %s and institution_id = %s for update", (cid, u["institution_id"]))
    v = une("select * from visa_credit where credit_id = %s and niveau = 'comite' and avis = 'refuse' and appel_decision is null", (cid,)) if c else None
    if not c or c["statut"] != "refuse" or not v:
        raise ErreurMetier("Seul un refus de la Commission de crédit, pas encore porté en appel, se porte devant le Conseil d'administration.")
    if d.get("decision") not in ("accorde", "confirme"):
        raise ErreurMetier("À remplir : Décision du Conseil d'administration.")
    ref = d.get("reference").strip() if isinstance(d.get("reference"), str) else ""
    if not ref:
        raise ErreurMetier("À remplir : Référence de la décision du Conseil d'administration.")
    j = journee_courante(u)
    executer("update visa_credit set appel_decision = %s, appel_reference = %s, appel_le = %s, appel_par = %s where credit_id = %s and niveau = 'comite'",
             (d["decision"], ref, j["date"] if j else date.today(), u["id"], cid))
    if d["decision"] == "accorde":
        executer("update credit set statut = 'mis_en_place' where id = %s", (cid,))
    return {"statut": valeur("select statut from credit where id = %s", (cid,)), "decision": d["decision"]}


def date_iso(v: str, nom: str) -> date:
    try:
        return date.fromisoformat(v or "")
    except ValueError:
        raise ErreurMetier(f"À remplir : {nom}.")


def historique(u, niveau: str, avis: str, du: str, au: str) -> list[dict]:
    """4-4 Historique suivi (capture p. 115) : Niveau hiérarchique, Avis, Du, A ; Exporter"""
    exiger(u)
    niveau_ok(niveau)
    if avis not in ("accepte", "refuse"):
        raise ErreurMetier("À remplir : Avis.")
    d1, d2 = date_iso(du, "Du"), date_iso(au, "A")
    sortie = []
    for v in lignes("""select v.*, c.* from visa_credit v join credit c on c.id = v.credit_id where c.institution_id = %s and v.niveau = %s and v.avis = %s
                       and v.le::date between %s and %s order by v.le""", (u["institution_id"], niveau, avis, d1, d2)):
        sortie.append({**ligne(v), "visaLe": v["le"].date().isoformat(), "visePar": valeur("select nom from utilisateur where id = %s", (v["par"],)) or "",
                       "motif": v["motif"] or "", "membres": json_lu(v["membres"]) or [], "referencePv": v["reference_pv"] or "", "creditId": v["credit_id"],
                       "appel": ({"accorde": "Accordé", "confirme": "Refus confirmé"}[v["appel_decision"]] + f" ({v['appel_reference']})") if v.get("appel_decision") else ""})
    if avis == "refuse" and niveau in ("responsable_credit", "comite"):   # refus à la vérification ou à la décision : le crédit n'est pas né (plan 6.1)
        for x in lignes("""select * from demande_credit where institution_id = %s and refus_niveau = %s and
                           (case when refus_niveau = 'comite' then approuve_le::date else controle_le::date end) between %s and %s order by id""",
                        (u["institution_id"], niveau, d1, d2)):
            par = x["approuve_par"] if niveau == "comite" else x["controle_par"]
            le = x["approuve_le"] if niveau == "comite" else x["controle_le"]
            sortie.append({"id": None, "numero": x["numero"], "dateDemande": x["cree_le"].date().isoformat(), "compte": "", "client": titulaire(x["tiers_id"]),
                           "montant": x["montant_demande"], "devise": (x["devise"] or "").strip(), "duree": x["duree_mois"],
                           "produit": valeur("select nom from produit_credit where id = %s", (x["produit_id"],)), "agentId": x["saisi_par"],
                           "agent": valeur("select nom from utilisateur where id = %s", (x["saisi_par"],)) or "", "groupe": "",
                           "visaLe": (le.date() if hasattr(le, "date") else le).isoformat(), "visePar": valeur("select nom from utilisateur where id = %s", (par,)) or "",
                           "motif": (x["decision_motif"] if niveau == "comite" else x["verification_motif"]) or "", "membres": json_lu(x["decision_membres"]) or [],
                           "referencePv": x["decision_pv"] or "", "creditId": None, "demandeId": x["id"],
                           "appel": ({"accorde": "Accordé", "confirme": "Refus confirmé"}[x["appel_decision"]] + f" ({x['appel_reference']})") if x["appel_decision"] else ""})
    return sortie


def valides_non_debloques(u, du: str, au: str, agent_id: int | None = None, archives: bool = False) -> list[dict]:
    """4-5 Crédits validés non débloqués (capture p. 115) : Du, A, Agence, Agent, Afficher les crédits archivés ; Rechercher, Exporter.
    « Archivés » : les crédits validés déjà débloqués s'y ajoutent (registre S92-2)"""
    exiger(u)
    d1, d2 = date_iso(du, "Du"), date_iso(au, "A")
    statuts = ["vise", "debloque", "solde"] if archives else ["vise"]
    return [ligne(c) for c in lignes("""select c.* from credit c join demande_credit d on d.id = c.demande_id where c.institution_id = %s and c.statut = any(%s)
                                         and d.cree_le::date between %s and %s and (%s::bigint is null or c.agent_id = %s) order by c.id""",
                                      (u["institution_id"], statuts, d1, d2, agent_id, agent_id))]
