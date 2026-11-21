"""S86 à S88 : Crédit > Dossier de crédit : demande (analyse), contrôle, approbation (manuel Microfina++, p. 113 et 114).
Mêmes règles que web/src/donnees/api.ts (dossiers). Registre S86-1 à S86-6, S87-1 à S87-3, S88-1 à S88-6, CR-2, CR-3, CR-8, CR-14, CR-25.

- Demande : produit, client, cycle, effectifs et montants hommes et femmes, groupes solidaires ; Suivant, détail : province et ville (région et
  préfecture du manuel), effectifs et montants ressaisis, Enregistrer (texte p. 113, 2.1 à 2.8).
- Contrôle : effectif, nombre de groupes et montant ressaisis par un autre utilisateur, Terminer (2.9 à 2.12).
- Approbation : montant approuvé ressaisi, Approuver (2.13 à 2.15) ; Centrale des risques (Instr. BCC 05), plafonds (Instr. BCC 002 ; loi 002/2002),
  personnes apparentées (Instr. BCC 51), gel des avoirs (loi 22/068)."""
from datetime import date

from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import cours, est_coopec, exiger, journee_courante, json_lu, titulaire

APPARENTES = ("actionnaire", "administrateur", "dirigeant", "personnel", "famille", "societe_liee", "contrat")
EN_COURS = ("mis_en_place", "vise", "debloque")                           # crédits qui comptent dans l'encours


def entier(d, k, nom, mini=0) -> int:
    v = (d or {}).get(k)
    if v in (None, ""):
        v = 0
    if not isinstance(v, int) or isinstance(v, bool) or v < mini:
        raise ErreurMetier(f"{nom} : un nombre entier, {mini} ou plus.")
    return v


def jour(u) -> date:
    j = journee_courante(u)
    return date.fromisoformat(j["date"]) if j else date.today()


def produit(u, pid) -> dict:
    p = une("select * from produit_credit where id = %s and institution_id = %s", (pid, u["institution_id"])) if isinstance(pid, int) and not isinstance(pid, bool) else None
    if not p:
        raise ErreurMetier("À remplir : Produit.")
    return p


def contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"produits": [{"id": p["id"], "nom": p["nom"], "devise": p["devise"].strip(), "physique": p["client_physique"], "groupe": p["client_groupe"],
                          "entreprise": p["client_entreprise"], "montantMin": int(p["montant_min"] * 100), "montantMax": int(p["montant_max"] * 100),
                          "dureeMin": p["duree_min"], "dureeMax": p["duree_max"]}
                         for p in lignes("select * from produit_credit where institution_id = %s and actif order by numero", (i,))],
            "cycles": lignes("select id, code, libelle from credit_cycle where institution_id = %s and actif order by code", (i,)),
            "provinces": lignes("select id, nom from localite where niveau = 'province' and actif order by nom"),
            "villes": lignes("select id, parent_id as \"provinceId\", nom, nature from localite where niveau = 'ville' and actif order by nom"),   # nature : registre S20-8
            # lieu de l'activité jusqu'à la commune, au secteur ou à la chefferie (registre T41)
            "communes": lignes("select id, parent_id as \"villeId\", nom, nature from localite where niveau = 'commune' and actif order by nom"),
            "fondsPropres": fonds_propres(u), "coopec": est_coopec(u)}


def fonds_propres(u) -> dict | None:
    f = une("select * from fonds_propres where institution_id = %s order by date_arrete desc limit 1", (u["institution_id"],))
    return {"dateArrete": f["date_arrete"].isoformat(), "montant": f["montant"]} if f else None


def enregistrer_fonds_propres(u, d) -> dict:
    """Registre CR-2 : saisis chaque mois par la direction, montant du dernier arrêté (Instr. BCC 002, art. 7 à 11)"""
    exiger(u)
    try:
        da = date.fromisoformat((d or {}).get("dateArrete") or "")
    except ValueError:
        raise ErreurMetier("À remplir : Date de l'arrêté.")
    if da > jour(u):
        raise ErreurMetier("Date de l'arrêté : pas après la journée.")
    m = entier(d, "montant", "Fonds propres prudentiels", 1)
    executer("""insert into fonds_propres (institution_id, date_arrete, montant, saisi_par) values (%s, %s, %s, %s)
                on conflict (institution_id, date_arrete) do update set montant = excluded.montant, saisi_par = excluded.saisi_par, saisi_le = now()""",
             (u["institution_id"], da, m, u["id"]))
    return fonds_propres(u)


def apparentes(u) -> list[dict]:
    exiger(u)
    return [{"tiersId": t["id"], "numero": t["numero"], "client": titulaire(t["id"]), "lien": t["apparente"]}
            for t in lignes("select id, numero, apparente from tiers where institution_id = %s and apparente is not null order by numero", (u["institution_id"],))]


def marquer_apparente(u, tid: int, d) -> list[dict]:
    """Registre CR-3 : case « Personne apparentée » et lien, tenus par le chef d'agence ou la conformité (Instr. BCC 002, art. 27)"""
    exiger(u)
    lien = (d or {}).get("lien")
    if lien is not None and lien not in APPARENTES:
        raise ErreurMetier("Lien : actionnaire ou fondateur, administrateur, dirigeant, personnel, famille, société liée ou contrat.")
    if not une("select 1 from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])):
        raise ErreurMetier("Client introuvable.")
    executer("update tiers set apparente = %s, apparente_par = %s, apparente_le = now() where id = %s", (lien, u["id"], tid))
    return apparentes(u)


def vue(x: dict) -> dict:
    p = une("select nom, devise from produit_credit where id = %s", (x["produit_id"],))
    nom = lambda uid: valeur("select nom from utilisateur where id = %s", (uid,)) or ""
    return {"id": x["id"], "numero": x["numero"], "tiersId": x["tiers_id"], "membre": valeur("select numero from tiers where id = %s", (x["tiers_id"],)),
            "client": titulaire(x["tiers_id"]), "produitId": x["produit_id"], "produit": p["nom"], "devise": (x["devise"] or p["devise"]).strip(),
            "cycle": valeur("select libelle from credit_cycle where id = %s", (x["cycle_id"],)) or "", "analyse": valeur("select numero from analyse_financiere where id = %s", (x["analyse_id"],)) or "",
            "nbHommes": x["nb_hommes"], "nbFemmes": x["nb_femmes"], "montantHommes": x["montant_hommes"], "montantFemmes": x["montant_femmes"],
            "nbGroupes": x["nb_groupes"], "montant": x["montant_demande"], "duree": x["duree_mois"], "montantApprouve": x["montant_approuve"],
            "province": valeur("select nom from localite where id = %s", (x["province_id"],)) or "", "ville": valeur("select nom from localite where id = %s", (x["ville_id"],)) or "", "commune": valeur("select nom from localite where id = %s", (x["commune_id"],)) or "" if x.get("commune_id") else "",
            "parts": json_lu(x["parts"]) or [], "statut": x["statut"], "date": x["cree_le"].date().isoformat(), "saisiPar": nom(x["saisi_par"]),
            "controlePar": nom(x["controle_par"]), "approuvePar": nom(x["approuve_par"]), "consultationCrLe": x["consultation_cr_le"].isoformat() if x["consultation_cr_le"] else "",
            "consultationCrRef": x["consultation_cr_ref"] or "", "accordConseilRef": x["accord_conseil_ref"] or "", "accordBccRef": x["accord_bcc_ref"] or ""}


def lister(u, statut: str) -> list[dict]:
    exiger(u)
    if statut not in ("saisie", "controlee", "approuvee", "mise_en_place"):
        raise ErreurMetier("Statut inconnu.")
    return [vue(x) for x in lignes("select * from demande_credit where institution_id = %s and statut = %s order by id", (u["institution_id"], statut))]


def effectifs(d) -> dict:
    return {"nbHommes": entier(d, "nbHommes", "Effectif hommes"), "nbFemmes": entier(d, "nbFemmes", "Effectif femmes"),
            "montantHommes": entier(d, "montantHommes", "Montant hommes"), "montantFemmes": entier(d, "montantFemmes", "Montant femmes"),
            "nbGroupes": entier(d, "nbGroupes", "Nombre de groupes solidaires")}


def demander(u, d) -> dict:
    """2.1 à 2.8 (p. 113) ; registre S86-1 à S86-6"""
    exiger(u)
    d = d or {}
    p = produit(u, d.get("produitId"))
    if not p["actif"]:
        raise ErreurMetier("Ce produit est désactivé (Produits > Crédits > Activation) : il n'est plus proposé aux nouvelles demandes.")
    tid = d.get("tiersId")
    t = une("select * from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])) if isinstance(tid, int) and not isinstance(tid, bool) else None
    if not t:
        raise ErreurMetier("À remplir : Numéro client.")
    from .liste_rouge import controler as liste_rouge
    liste_rouge(t["id"])                                               # registre CR-9
    controler_retard(u, t["id"])                                       # registre CR-15
    if t["statut"] != "actif":
        raise ErreurMetier("Le client n'est pas actif (adhésion visée et payée).")
    if not {"physique": p["client_physique"], "groupe": p["client_groupe"], "morale": p["client_entreprise"]}.get(t["type"]):
        raise ErreurMetier("Ce produit n'est pas ouvert à ce type de client (Produits > Crédits, Type de client).")
    e = effectifs(d)
    if effectifs(d.get("ressaisie") or {}) != e:
        raise ErreurMetier("Les effectifs et montants ressaisis ne correspondent pas à ceux de la première page.")
    if e["nbHommes"] + e["nbFemmes"] < 1:
        raise ErreurMetier("Effectif : au moins une personne.")
    sexe = valeur("select sexe from tiers_personne where tiers_id = %s", (t["id"],)) if t["type"] == "physique" else None
    if t["type"] == "physique" and (e["nbHommes"], e["nbFemmes"]) != ((1, 0) if sexe == "M" else (0, 1)):
        raise ErreurMetier("Personne physique : effectif d'une personne, de son sexe (fiche client).")
    montant = e["montantHommes"] + e["montantFemmes"]
    if (e["montantHommes"] and not e["nbHommes"]) or (e["montantFemmes"] and not e["nbFemmes"]):
        raise ErreurMetier("Un montant sans effectif.")
    duree = entier(d, "duree", "Durée (mois)", 1)
    if montant < p["montant_min"] * 100 or montant > p["montant_max"] * 100:
        raise ErreurMetier(f"Montant demandé : entre {int(p['montant_min']):,} et {int(p['montant_max']):,} {p['devise'].strip()} pour ce produit.".replace(",", " "))
    if duree < p["duree_min"] or duree > p["duree_max"]:
        raise ErreurMetier(f"Durée : entre {p['duree_min']} et {p['duree_max']} mois pour ce produit.")
    cid = d.get("cycleId")
    if cid is not None and not une("select 1 from credit_cycle where id = %s and institution_id = %s and actif", (cid, u["institution_id"])):
        raise ErreurMetier("Cycle inconnu.")
    pr = une("select id from localite where id = %s and niveau = 'province' and actif", (d.get("provinceId"),)) if isinstance(d.get("provinceId"), int) else None
    vi = une("select id from localite where id = %s and niveau = 'ville' and parent_id = %s and actif", (d.get("villeId"), pr["id"] if pr else None)) \
        if pr and isinstance(d.get("villeId"), int) else None
    if not pr or not vi:
        raise ErreurMetier("À remplir : Province (région), Ville ou territoire (préfecture).")
    co = None
    if d.get("communeId") not in (None, "", 0):
        co = une("select id from localite where id = %s and niveau = 'commune' and parent_id = %s and actif", (d.get("communeId"), vi["id"])) \
            if isinstance(d.get("communeId"), int) else None
        if not co:
            raise ErreurMetier("Commune, secteur ou chefferie : il n'est pas dans la ville ou le territoire choisi.")
    aid = d.get("analyseId")
    if aid is not None and not une("select 1 from analyse_financiere where id = %s and tiers_id = %s and produit_id = %s", (aid, t["id"], p["id"])):
        raise ErreurMetier("Cette analyse financière n'est pas celle de ce client et de ce produit.")
    parts = []
    if t["type"] == "groupe":                                         # registre CR-8 : un crédit au nom du groupe, la part de chaque membre notée
        membres = [r["nom"] + (" " + r["prenom"] if r["prenom"] else "") for r in lignes("select nom, prenom from representant where tiers_id = %s and role = 'membre' order by id", (t["id"],))]
        brut = d.get("parts") or []
        if not isinstance(brut, list) or len(brut) != len(membres):
            raise ErreurMetier("Groupe : la part de chaque membre de la fiche du groupe.")
        parts = [{"membre": m, "montant": entier(x, "montant", f"Part de {m}", 0)} for m, x in zip(membres, brut)]
        if sum(x["montant"] for x in parts) != montant:
            raise ErreurMetier("Groupe : la somme des parts des membres doit égaler le montant demandé.")
    n = int(valeur("select count(*) from demande_credit where institution_id = %s", (u["institution_id"],))) + 1
    did = valeur("""insert into demande_credit (institution_id, agence_id, tiers_id, produit_id, montant_demande, duree_mois, nb_hommes, nb_femmes, montant_hommes,
                    montant_femmes, nb_groupes, statut, numero, analyse_id, cycle_id, province_id, ville_id, devise, parts, saisi_par, commune_id)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'saisie', %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], u["agence_id"], t["id"], p["id"], montant, duree, e["nbHommes"], e["nbFemmes"], e["montantHommes"], e["montantFemmes"],
                  e["nbGroupes"], f"DC{n:06d}", aid, cid, pr["id"], vi["id"], p["devise"], Jsonb(parts), u["id"], co["id"] if co else None))
    return vue(une("select * from demande_credit where id = %s", (did,)))


def demande(u, did, statut: str) -> dict:
    x = une("select * from demande_credit where id = %s and institution_id = %s for update", (did, u["institution_id"])) if isinstance(did, int) else None
    if not x:
        raise ErreurMetier("Demande introuvable.")
    if x["statut"] != statut:
        raise ErreurMetier({"saisie": "Cette demande n'est plus à contrôler.", "controlee": "Cette demande n'est plus à approuver."}[statut])
    return x


def controler(u, did: int, d) -> dict:
    """2.9 à 2.12 : effectif, nombre de groupes et montant ressaisis, Terminer ; un autre utilisateur que celui qui a saisi (registre S87-1 à S87-3)"""
    exiger(u)
    x = demande(u, did, "saisie")
    if x["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : le contrôle est fait par un autre utilisateur que celui qui a saisi la demande.")
    if (entier(d, "effectif", "Effectif"), entier(d, "nbGroupes", "Nombre de groupes solidaires"), entier(d, "montant", "Montant")) != \
            (x["nb_hommes"] + x["nb_femmes"], x["nb_groupes"], x["montant_demande"]):
        raise ErreurMetier("L'effectif, le nombre de groupes ou le montant ressaisis ne correspondent pas à la demande.")
    executer("update demande_credit set statut = 'controlee', controle_par = %s, controle_le = now() where id = %s", (u["id"], x["id"]))
    return vue(une("select * from demande_credit where id = %s", (x["id"],)))


def encours(u, tiers_ids: list[int] | None = None) -> int:
    """En CDF, au cours du jour (PCCI § 7.1) : crédits en cours (capital prêté moins capital remboursé), demandes approuvées pas encore mises en place
    et engagements par signature en cours (S100) ;
    pour une COOPEC, hors ressources affectées des bailleurs (loi 002/2002, art. 60) ; tous les clients si None (registre S88-4)"""
    filtre = "" if tiers_ids is None else " and c.tiers_id = any(%s)"
    args = (u["institution_id"],) + (() if tiers_ids is None else (tiers_ids,))
    j = jour(u)
    total = 0
    for r in lignes(f"""select c.devise, sum(c.montant) - coalesce(sum((select sum((r.repartition->>'capital')::bigint) from remboursement r where r.credit_id = c.id)), 0) as m
                        from credit c where c.institution_id = %s and c.statut in ('mis_en_place', 'vise', 'debloque'){filtre}
                        and not (%s and c.ligne_budget_id is not null) group by c.devise""", args + (est_coopec(u),)):
        total += round(int(r["m"]) * cours(r["devise"], j))
    for r in lignes(f"""select c.devise, sum(c.montant_approuve) as m from demande_credit c where c.institution_id = %s and c.statut = 'approuvee'{filtre}
                        group by c.devise""", args):
        total += round(int(r["m"]) * cours(r["devise"], j))
    for r in lignes(f"""select c.devise, sum(c.montant - c.utilise) as m from engagement_signature c where c.institution_id = %s and c.date_fin >= %s
                        and c.cloture_le is null{filtre}
                        group by c.devise""", (u["institution_id"], j) + args[1:]):   # engagements par signature en cours (Instr. BCC 002, art. 23 ; CR-22)
        total += round(int(r["m"]) * cours(r["devise"], j))
    return total



def controler_retard(u, tid: int):
    """CR-15 : pas de nouveau crédit à un client qui a un crédit en retard, pour qu'aucun crédit ne serve à rembourser un crédit en retard
    (Instr. BCC 003, art. 5, al. 3). Le retard se lit au jour de la journée, comme au remboursement (S76)."""
    from .remboursements import etat
    j = jour(u)
    for c in lignes("select * from credit where tiers_id = %s and statut = 'debloque' and debloque_le <= %s", (tid, j)):
        n = etat(c, j)["joursRetard"]
        if n > 0:
            raise ErreurMetier(f"Le crédit {c['numero']} de ce client est en retard de {n} jour{'s' if n > 1 else ''} : aucun nouveau crédit ne peut servir "
                               "à rembourser un crédit en retard (Instr. BCC 003, art. 5, al. 3).")


def controler_plafonds(u, tid: int, m_cdf: int, apparente, bcc: str | None):
    """Plafonds par client et des apparentés, crédits et engagements par signature confondus (CR-14 ; Instr. BCC 002, art. 23, 25 à 29 ;
    loi 002/2002, art. 59 et 60). Commun à l'approbation (S88) et à l'engagement par signature (S100)."""
    fp = fonds_propres(u)
    if not fp:
        raise ErreurMetier("Fonds propres prudentiels non saisis : la direction les saisit d'abord (registre CR-2 ; Instr. BCC 002).")
    risque = encours(u, [tid]) + m_cdf
    coopec = est_coopec(u)
    depasse = []
    if coopec:
        if risque * 10 > fp["montant"]:
            depasse.append("10 % des fonds propres prudentiels (Instr. BCC 002, art. 29)")
        if risque * 10 > depots_membres(u):
            depasse.append("10 % des dépôts des membres (loi 002/2002, art. 59, 6°)")
    elif risque * 20 > fp["montant"]:
        depasse.append("5 % des fonds propres prudentiels (Instr. BCC 002, art. 28)")
    if depasse and not bcc:
        raise ErreurMetier("Plafond par emprunteur dépassé : " + " ; ".join(depasse) + ". Il faut l'accord préalable ou la dérogation de la BCC, référence à noter.")
    if apparente:
        ids = [r["id"] for r in lignes("select id from tiers where institution_id = %s and apparente is not null", (u["institution_id"],))]
        tot = encours(u, ids) + m_cdf
        if tot * 5 > fp["montant"] and not (coopec and bcc):
            raise ErreurMetier("Crédits aux personnes apparentées au-delà de 20 % des fonds propres prudentiels (Instr. BCC 002, art. 25 ; Instr. BCC 51).")
        if coopec and tot * 5 > depots_membres(u) and not bcc:
            raise ErreurMetier("Crédits aux dirigeants au-delà de 20 % des dépôts des membres (loi 002/2002, art. 59, 4°) : dérogation de la BCC à noter.")

def depots_membres(u) -> int:
    """Ensemble des dépôts des membres (comptes 33 à 36 et 373 : loi 002/2002, art. 59 ; Instr. BCC 002, art. 24) : soldes créditeurs des comptes de dépôt, en CDF"""
    return int(valeur("""select coalesce(sum(case l.sens when 'C' then l.montant_cdf else -l.montant_cdf end), 0) from ligne_ecriture l join ecriture e on e.id = l.ecriture_id
                         where e.institution_id = %s and l.contrat_ref like 'depot:%%'""", (u["institution_id"],)))


def texte(d, k) -> str:
    v = (d or {}).get(k)
    return v.strip() if isinstance(v, str) else ""


def approuver(u, did: int, d) -> dict:
    """2.13 à 2.15 : montant approuvé ressaisi, Approuver ; registre S88-1 à S88-6, CR-3, CR-14, CR-25"""
    exiger(u)
    x = demande(u, did, "controlee")
    if u["id"] == x["saisi_par"]:
        raise ErreurMetier("Quatre yeux : l'approbation est faite par un autre utilisateur que celui qui a saisi la demande.")
    m = entier(d, "montantApprouve", "Montant approuvé", 1)
    p = produit(u, x["produit_id"])
    if m > x["montant_demande"]:
        raise ErreurMetier("Montant approuvé : pas plus que le montant demandé.")
    if m < p["montant_min"] * 100:
        raise ErreurMetier("Montant approuvé : pas moins que le minimum du produit.")
    j = jour(u)
    from .gel import gel_actif
    if gel_actif(x["tiers_id"]):                                       # registre CR-25
        raise ErreurMetier("Avoirs gelés : aucun crédit à ce client (loi 22/068, art. 158 bis ; E10).")
    from .liste_rouge import controler as liste_rouge
    liste_rouge(x["tiers_id"])                                         # registre CR-9
    controler_retard(u, x["tiers_id"])                                 # registre CR-15
    if not une("""select 1 from consentement where tiers_id = %s and date_debut <= %s and (date_fin is null or date_fin >= %s)""", (x["tiers_id"], j, j)):
        raise ErreurMetier("Pas de consentement écrit à la Centrale des risques en cours de validité (Client > Consentement ; Instr. BCC 05, art. 13).")
    try:
        cr = date.fromisoformat((d or {}).get("consultationCrLe") or "")
    except ValueError:
        raise ErreurMetier("À remplir : Date de consultation de la Centrale des risques (Instr. BCC 05, art. 4).")
    ref = texte(d, "consultationCrRef")
    if cr > j or not ref:
        raise ErreurMetier("Consultation de la Centrale des risques : date (pas après la journée) et référence du rapport (Instr. BCC 05, art. 4 et 13).")
    t = une("select type, apparente from tiers where id = %s", (x["tiers_id"],))
    conseil, bcc = texte(d, "accordConseilRef"), texte(d, "accordBccRef")
    if t["apparente"] and not conseil:
        raise ErreurMetier("Personne apparentée : référence de l'accord préalable du Conseil d'administration (Instr. BCC 51 ; registre CR-3).")
    controler_plafonds(u, x["tiers_id"], round(m * cours(x["devise"], j)), t["apparente"], bcc)
    executer("""update demande_credit set statut = 'approuvee', montant_approuve = %s, approuve_par = %s, approuve_le = %s, consultation_cr_le = %s,
                consultation_cr_ref = %s, accord_conseil_ref = %s, accord_bcc_ref = %s where id = %s""",
             (m, u["id"], jour(u), cr, ref, conseil or None, bcc or None, x["id"]))
    return vue(une("select * from demande_credit where id = %s", (x["id"],)))
