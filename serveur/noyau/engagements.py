"""S100 : Crédit > Engagement par signature (manuel Microfina++, p. 121, capture « Création engagement par signature »). Mêmes règles que
web/src/donnees/api.ts (engagements). Registre S100-1 à S100-7, CR-22, CR-14.

« Rechercher le numéro du client avec le bouton de recherche du champ [N° Client], ensuite renseigner les champs (*) puis [Enregistrer], ensuite
[imprimer] ou [Annuler] en cas d'erreur. »
- Hors bilan : débit 0001 (engagement de financement) ou 0012 (aval, caution : garantie donnée en faveur de la clientèle), crédit 090
  (PCCI, comptes 00 et 090).
- Frais à payer = montant × pourcentage + forfait, prélevés sur le Compte Epargne au profit du compte 727 (autres commissions).
- Garantie saisie par l'agent (décision du porteur, 20/11/2026), bloquée sur le Compte Garanti.
- L'engagement compte dans les risques du client : plafonds par client et des apparentés (Instr. BCC 002, art. 23, 25 à 29 ; loi 002/2002, art. 59 et 60).
- Liste rouge et gel des avoirs : aucun engagement (Instr. BCC 13, art. 7 ; loi 22/068)."""
import calendar
import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from .cloison import clause
from .bd import ErreurMetier, executer, lignes, une, valeur
from .releves import client, entete
from .services import compte_actif, comptes_du_tiers, cours, est_coopec, exiger, journee_courante, nouvelle_piece, poster, titulaire

MOTIFS = {"echeance": "Échéance", "mainlevee": "Mainlevée", "mise_en_jeu": "Mise en jeu de la garantie"}
TYPES = {"financement": ("Engagement de financement", "0001"), "aval": ("Aval", "0012"), "caution": ("Caution", "0012")}


def jour(u) -> date:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]


def plus_mois(d: date, n: int) -> date:
    m = d.month - 1 + n
    a, m = d.year + m // 12, m % 12 + 1
    return date(a, m, min(d.day, calendar.monthrange(a, m)[1]))


def banques(u) -> list[dict]:
    return lignes("""select cb.id, b.nom as banque, cb.numero, trim(cb.devise) as devise from compte_bancaire cb join banque b on b.id = cb.banque_id
                     where cb.institution_id = %s and cb.supprime_le is null and b.supprime_le is null order by b.nom, cb.numero""", (u["institution_id"],))


def contexte(u) -> dict:
    exiger(u)
    j = journee_courante(u)
    return {"types": [{"code": k, "libelle": v[0]} for k, v in TYPES.items()], "banques": banques(u), "date": j["date"] if j else "",
            "entete": entete(u["institution_id"]), "coopec": est_coopec(u)}


def beneficiaire(u, tid: int) -> dict:
    exiger(u)
    if not valeur("select 1 from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])):
        raise ErreurMetier("Client introuvable.")
    c = client(tid)
    return {"tiersId": tid, "numero": c["numero"], "nom": titulaire(tid), "profession": c["profession"], "sexe": c["sexe"], "contacts": c["telephone"],
            "adresse": c["adresse"], "comptes": [{k: x[k] for k in ("id", "numero", "intitule", "devise", "solde", "disponible")} for x in comptes_du_tiers(tid)]}


def frais_de(montant: int, pourcentage: Decimal, forfait: int) -> int:
    return int((Decimal(montant) * pourcentage / 100).quantize(Decimal(1), rounding=ROUND_HALF_UP)) + forfait


def entier(p: dict, k: str, nom: str, requis=False) -> int:
    v = p.get(k)
    if v in (None, "") and not requis:
        return 0
    if not isinstance(v, int) or isinstance(v, bool) or v < 0 or (requis and v == 0):
        raise ErreurMetier(f"À remplir : {nom}.")
    return v


def vue(e: dict) -> dict:
    return {"id": e["id"], "reference": e["reference"], "tiersId": e["tiers_id"], "membre": valeur("select numero from tiers where id = %s", (e["tiers_id"],)),
            "client": titulaire(e["tiers_id"]), "type": e["type"], "typeLibelle": TYPES[e["type"]][0], "description": e["description"],
            "dateDebut": e["date_debut"].isoformat(), "dateFin": e["date_fin"].isoformat(), "duree": e["duree_mois"], "montant": e["montant"], "devise": e["devise"].strip(),
            "pourcentage": str(e["pourcentage"].normalize()).replace(".", ","), "forfait": e["forfait"], "frais": e["frais"], "garantie": e["garantie"],
            "compteEpargne": valeur("select numero from compte_depot where id = %s", (e["compte_epargne_id"],)),
            "compteGaranti": valeur("select numero from compte_depot where id = %s", (e["compte_garanti_id"],)),
            "banque": valeur("select b.nom || ' ' || cb.numero from compte_bancaire cb join banque b on b.id = cb.banque_id where cb.id = %s", (e["compte_bancaire_id"],)) or "",
            "observation": e["observation"] or "", "utilise": e["utilise"], "clotureLe": e["cloture_le"].isoformat() if e["cloture_le"] else "",
            "motifFin": MOTIFS.get(e["motif_fin"] or "", ""), "piece": valeur("select pc.numero from ecriture x join piece pc on pc.id = x.piece_id where x.id = %s", (e["ecriture_id"],)) or ""}


def lister(u) -> list[dict]:
    exiger(u)
    ag, pa = clause(u, "(select t.agence_id from tiers t where t.id = engagement_signature.tiers_id)")   # ses membres (registre T213)
    return [vue(e) for e in lignes(f"select * from engagement_signature where institution_id = %s{ag} order by date_debut desc, id desc", (u["institution_id"], *pa))]


def enregistrer(u, p) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    j = jour(u)
    tid = p.get("tiersId")
    if not isinstance(tid, int) or not valeur("select 1 from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])):
        raise ErreurMetier("À remplir : N° Client.")
    ref = (p.get("reference") or "").strip() if isinstance(p.get("reference"), str) else ""
    manque = [n for n, ok in (("Référence", ref), ("Type engagement", p.get("type") in TYPES), ("Description", isinstance(p.get("description"), str) and p["description"].strip()))
              if not ok]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if valeur("select 1 from engagement_signature where institution_id = %s and upper(trim(reference)) = upper(%s)", (u["institution_id"], ref)):
        raise ErreurMetier("Référence : déjà utilisée pour un autre engagement.")
    m = entier(p, "montant", "Montant", True)
    duree = entier(p, "duree", "Durée(mois)", True)
    try:
        debut = date.fromisoformat(p.get("dateDebut") or j.isoformat())
    except ValueError:
        raise ErreurMetier("Date Début : une date.")
    try:
        pct = Decimal(str(p.get("pourcentage") or "0").replace(",", "."))
    except InvalidOperation:
        raise ErreurMetier("Pourcentage : un nombre.")
    if pct < 0 or pct > 100:
        raise ErreurMetier("Pourcentage : entre 0 et 100.")
    forfait, garantie = entier(p, "forfait", "Forfait"), entier(p, "garantie", "Garantie")
    # Audit du 21/11/2026, B11 (F10) : les comptes sont verrouillés avant de lire leur disponible (ordre des id : pas d'interblocage)
    for cid in sorted({x for x in (p.get("compteEpargneId"), p.get("compteGarantiId")) if isinstance(x, int) and not isinstance(x, bool)}):
        if valeur("select 1 from compte_depot where id = %s and tiers_id = %s", (cid, tid)):
            compte_actif(cid, verrou=True)
    comptes = {x["id"]: x for x in comptes_du_tiers(tid)}
    ce, cg = comptes.get(p.get("compteEpargneId")), comptes.get(p.get("compteGarantiId"))
    if not ce:
        raise ErreurMetier("À remplir : Compte Epargne.")
    if not cg:
        raise ErreurMetier("À remplir : Compte Garanti.")
    dv = ce["devise"]
    if cg["devise"] != dv:
        raise ErreurMetier("Le compte garanti n'est pas dans la devise du compte épargne.")
    cb = p.get("compteBancaireId")
    if cb is not None and not any(x["id"] == cb for x in banques(u)):
        raise ErreurMetier("Compte Banque inconnu.")
    frais = frais_de(m, pct, forfait)
    if frais > ce["disponible"]:
        raise ErreurMetier("Frais à payer : le solde disponible du compte épargne ne suffit pas.")
    if garantie > cg["disponible"] - (frais if cg["id"] == ce["id"] else 0):
        raise ErreurMetier("Garantie : elle dépasse le solde disponible du compte garanti.")
    from .gel import gel_actif
    if gel_actif(tid):
        raise ErreurMetier("Avoirs gelés : aucun engagement pour ce client (loi 22/068, art. 158 bis ; E10).")
    from .liste_rouge import controler as liste_rouge
    liste_rouge(tid)
    from .dossiers import controler_plafonds
    controler_plafonds(u, tid, round(m * cours(dv, j)), valeur("select apparente from tiers where id = %s", (tid,)), None)
    libelle, compte = TYPES[p["type"]]
    k = f"engagement:{ref}"
    lg = [{"compte": compte, "contrat": k, "sens": "D", "devise": dv, "montant": m}, {"compte": "090", "contrat": k, "sens": "C", "devise": dv, "montant": m}]
    if frais:
        lg += [{"compte": ce["pcci"], "contrat": f"depot:{ce['id']}", "sens": "D", "devise": dv, "montant": frais},
               {"compte": "727", "contrat": k, "sens": "C", "devise": dv, "montant": frais}]
    eid = poster(u, journal="OD", journee_id=journee_courante(u)["id"], libelle=f"{libelle} {ref}, {titulaire(tid)}", piece=nouvelle_piece(u, "OD", j),
                 evenement="engagement_signature", cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=lg)
    bid = valeur("insert into blocage (compte_id, montant, motif, pose_par) values (%s, %s, %s, %s) returning id",
                 (cg["id"], garantie, f"Garantie de l'engagement par signature {ref}", u["id"])) if garantie else None
    eng = valeur("""insert into engagement_signature (institution_id, reference, tiers_id, type, description, date_debut, date_fin, duree_mois, montant, devise,
                    pourcentage, forfait, frais, garantie, compte_epargne_id, compte_garanti_id, compte_bancaire_id, observation, blocage_id, ecriture_id, saisi_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], ref, tid, p["type"], p["description"].strip(), debut, plus_mois(debut, duree), duree, m, dv, pct, forfait, frais, garantie,
                  ce["id"], cg["id"], cb, (p.get("observation") or "").strip() or None, bid, eid, u["id"]))
    return vue(une("select * from engagement_signature where id = %s", (eng,)))


def finir(u, eid: int, p) -> dict:
    """S100-7 : fin de l'engagement. Le compte 00 est crédité du montant de l'engagement devenu sans objet : utilisation totale ou partielle, réception
    de la mainlevée, mise en jeu de la garantie (PCCI, compte 00). Échéance ou mainlevée : l'engagement restant sort du hors bilan et la garantie est
    libérée. Mise en jeu : l'institution paie le bénéficiaire par la banque de l'engagement ; elle se rembourse sur la garantie bloquée puis sur le
    compte épargne du client (compensation, loi 11/020, art. 48) ; le montant payé ne dépasse ni l'engagement restant ni ces fonds."""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    j = jour(u)
    e = une("select * from engagement_signature where id = %s and institution_id = %s", (eid, u["institution_id"]))
    if not e:
        raise ErreurMetier("Choisir un engagement dans la liste.")
    if e["cloture_le"]:
        raise ErreurMetier("Cet engagement a déjà pris fin.")
    motif = p.get("motif")
    if motif not in MOTIFS:
        raise ErreurMetier("À remplir : Motif de fin.")
    if motif == "echeance" and j < e["date_fin"]:
        raise ErreurMetier("Échéance : la Date Fin de l'engagement n'est pas encore atteinte.")
    dv, k, reste = e["devise"].strip(), f"engagement:{e['reference']}", e["montant"] - e["utilise"]
    compte = TYPES[e["type"]][1]
    bl = une("select * from blocage where id = %s and fin is null", (e["blocage_id"],)) if e["blocage_id"] else None
    lg, paye = [], 0
    if motif == "mise_en_jeu":
        paye = entier(p, "montant", "Montant payé", True)
        if paye > reste:
            raise ErreurMetier("Montant payé : au plus ce qui reste de l'engagement.")
        cb = une("""select cb.id, c.numero as compte from compte_bancaire cb join compte c on c.id = cb.compte_id where cb.id = %s and cb.institution_id = %s""",
                 (e["compte_bancaire_id"], u["institution_id"])) if e["compte_bancaire_id"] else None
        if not cb:
            raise ErreurMetier("Mise en jeu : l'engagement n'a pas de Compte Banque pour payer le bénéficiaire.")
        comptes = {x["id"]: x for x in comptes_du_tiers(e["tiers_id"])}
        cg, ce = comptes.get(e["compte_garanti_id"]), comptes.get(e["compte_epargne_id"])
        garantie = min(bl["montant"] or 0, paye) if bl and cg else 0
        sur_epargne = paye - garantie
        dispo = ce["disponible"] if ce else 0
        if sur_epargne > dispo:
            raise ErreurMetier("Mise en jeu : la garantie bloquée et le compte épargne du client ne couvrent pas ce montant ; payer au plus ce qu'ils couvrent.")
        if garantie:
            lg.append({"compte": cg["pcci"], "contrat": f"depot:{cg['id']}", "sens": "D", "devise": dv, "montant": garantie})
        if sur_epargne:
            lg.append({"compte": ce["pcci"], "contrat": f"depot:{ce['id']}", "sens": "D", "devise": dv, "montant": sur_epargne})
        lg.append({"compte": cb["compte"], "sens": "C", "devise": dv, "montant": paye})
        sortie = paye
        if bl and garantie:
            executer("update blocage set fin = now(), leve_par = %s, motif_levee = %s where id = %s", (u["id"], f"Mise en jeu de l'engagement {e['reference']}", bl["id"]))
            nb = valeur("insert into blocage (compte_id, montant, motif, pose_par) values (%s, %s, %s, %s) returning id",
                        (bl["compte_id"], bl["montant"] - garantie, bl["motif"], u["id"])) if bl["montant"] - garantie > 0 and paye < reste else None
            executer("update engagement_signature set blocage_id = %s where id = %s", (nb, eid))
    else:
        sortie = reste
        if bl:
            executer("update blocage set fin = now(), leve_par = %s, motif_levee = %s where id = %s", (u["id"], f"{MOTIFS[motif]} de l'engagement {e['reference']}", bl["id"]))
            executer("update engagement_signature set blocage_id = null where id = %s", (eid,))
    lg += [{"compte": "090", "contrat": k, "sens": "D", "devise": dv, "montant": sortie}, {"compte": compte, "contrat": k, "sens": "C", "devise": dv, "montant": sortie}]
    poster(u, journal="OD", journee_id=journee_courante(u)["id"], libelle=f"{MOTIFS[motif]}, engagement {e['reference']}", piece=nouvelle_piece(u, "OD", j),
           evenement="fin_engagement", cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=lg)
    fini = motif != "mise_en_jeu" or paye == reste
    executer("update engagement_signature set utilise = utilise + %s, cloture_le = %s, motif_fin = %s, cloture_par = %s where id = %s",
             (paye, j if fini else None, motif if fini else None, u["id"] if fini else None, eid))
    return vue(une("select * from engagement_signature where id = %s", (eid,)))
