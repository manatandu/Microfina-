"""États comptables : grand livre (S120, manuel Microfina++, p. 138 et 139) et balance (S121, p. 139 et 140), généraux et analytiques.
Mêmes règles que web/src/donnees/api.ts (etatsCompta). Registre S120-1 à S120-4, S121-1 à S121-4, T13.

Captures « Edition du grand livre » (Type de grand livre, Agence, Exercice, Date début, Date fin, Grand livre avec vidage) et « Edition de la balance des
comptes » (Type de balance, Balance, Agence, Exercice, Date début période, Date fin période, Compte … à …, Niveau de rupture, Balance sans VIDAGE).
- Les états officiels ne lisent que les écritures définitives : celles des journées comptabilisées (T13 ; PCCI § 3.4).
- Montants en CDF, monnaie de tenue de la comptabilité (PCCI § 3.2).
- « Vidage » : les écritures de clôture qui soldent les comptes de gestion (classes 6 et 7) dans le résultat (S127) ; un état « sans vidage » les écarte.
- Solde d'ouverture : cumul avant la date de début ; pour les comptes de gestion, depuis le 1er janvier de l'exercice seulement.
- Analytique : le détail par compte auxiliaire (compte de dépôt, crédit, guichet, parts, tiers), que chaque ligne d'écriture porte (ARCHITECTURE P1)."""
from collections import defaultdict
from datetime import date

from .bd import ErreurMetier, lignes, valeur
from .services import exiger

TYPES_GRAND_LIVRE = {"global": "Global", **{f"classe{n}": f"Classe {n}" for n in range(0, 8)}}
TYPES_BALANCE = {"8": "Balance à 8 colonnes", "6": "Balance à 6 colonnes", "4": "Balance à 4 colonnes"}


def d_(v, nom: str) -> date:
    try:
        return date.fromisoformat(v)
    except (TypeError, ValueError):
        raise ErreurMetier(f"À remplir : {nom}.")


def contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"agences": lignes("select id, nom from agence where institution_id = %s and not supprime order by code", (i,)),
            "exercices": [r["annee"] for r in lignes("select annee from exercice where institution_id = %s order by annee desc", (i,))],
            "typesGrandLivre": [{"code": k, "libelle": v} for k, v in TYPES_GRAND_LIVRE.items()],
            "typesBalance": [{"code": k, "libelle": v} for k, v in TYPES_BALANCE.items()],
            # « Plan : Général / Analytique » montré seulement si l'analytique est tenue : une écriture définitive porte un compte auxiliaire (allègement 7.12)
            "analytique": bool(valeur("""select exists (select 1 from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                                         where e.institution_id = %s and jc.statut = 'fermee' and coalesce(l.contrat_ref, '') <> '')""", (i,)))}


def periode(u, p: dict) -> tuple[date, date, int]:
    du, au = d_(p.get("du"), "Date début"), d_(p.get("au"), "Date fin")
    if du > au:
        raise ErreurMetier("Date début : avant la date fin.")
    ex = p.get("exercice")
    ex = int(ex) if str(ex or "").isdigit() else du.year
    if du.year != ex or au.year != ex:
        raise ErreurMetier(f"Les dates sont dans l'exercice {ex}.")
    return du, au, ex


def mouvements(u, jusqua: date, *, vidage: bool, agence_id=None) -> list[dict]:
    """Lignes définitives jusqu'à la date : écritures des journées comptabilisées (T13)"""
    return lignes(f"""select c.numero as compte, c.libelle as intitule, e.date_valeur, j.code as journal, p.numero as piece, e.numero as reference, e.libelle,
                             l.sens, l.montant_cdf, coalesce(l.contrat_ref, '') as auxiliaire
                      from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                      join compte c on c.id = l.compte_id join journal j on j.id = e.journal_id join piece p on p.id = e.piece_id
                      where e.institution_id = %s and jc.statut = 'fermee' and e.date_valeur <= %s and (%s::bigint is null or jc.agence_id = %s)
                      {"" if vidage else "and e.type <> 'vidage'"} order by c.numero, e.date_valeur, e.id, l.rang""",
                  (u["institution_id"], jusqua, agence_id, agence_id))


def ouverture(m: dict, du: date, exercice: int) -> bool:
    """La ligne compte-t-elle dans le solde d'ouverture ? Comptes de gestion (6, 7) : depuis le 1er janvier de l'exercice seulement"""
    return m["date_valeur"] < du and (m["compte"][0] not in "67" or m["date_valeur"].year == exercice)


def grand_livre(u, p, analytique: bool = False) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    du, au, ex = periode(u, p)
    t = p.get("type") or "global"
    if t not in TYPES_GRAND_LIVRE:
        raise ErreurMetier("Type de grand livre inconnu.")
    agence = int(p["agenceId"]) if str(p.get("agenceId") or "").isdigit() else None
    prefixe = str(p.get("compte") or "").strip()          # compte cliqué dans la balance (demande du porteur, 21/11/2026 ; registre T31)
    if prefixe and not prefixe.isdigit():
        raise ErreurMetier("Compte : chiffres seulement.")
    comptes: dict = {}
    for m in mouvements(u, au, vidage=str(p.get("vidage")) in ("True", "true", "1"), agence_id=agence):
        if t != "global" and m["compte"][0] != t[-1]:
            continue
        if prefixe and not m["compte"].startswith(prefixe):
            continue
        if m["compte"][0] in "67" and m["date_valeur"].year != ex:
            continue
        k = (m["compte"], m["auxiliaire"] if analytique else "")
        c = comptes.setdefault(k, {"compte": m["compte"], "intitule": m["intitule"], "auxiliaire": k[1], "soldeInitial": 0, "lignes": [], "debit": 0, "credit": 0})
        signe = m["montant_cdf"] if m["sens"] == "D" else -m["montant_cdf"]
        if ouverture(m, du, ex):
            c["soldeInitial"] += signe
        elif m["date_valeur"] >= du:
            c["debit" if m["sens"] == "D" else "credit"] += m["montant_cdf"]
            c["lignes"].append({"date": m["date_valeur"].isoformat(), "journal": m["journal"], "piece": m["piece"], "reference": m["reference"], "libelle": m["libelle"],
                                "debit": m["montant_cdf"] if m["sens"] == "D" else 0, "credit": m["montant_cdf"] if m["sens"] == "C" else 0})
    out = []
    for c in comptes.values():
        s = c["soldeInitial"]
        for l in c["lignes"]:
            s += l["debit"] - l["credit"]
            l["solde"] = s
        c["soldeFinal"] = s
        if c["lignes"] or c["soldeInitial"]:
            out.append(c)
    return {"du": du.isoformat(), "au": au.isoformat(), "exercice": ex, "comptes": out,
            "totalDebit": sum(c["debit"] for c in out), "totalCredit": sum(c["credit"] for c in out)}


def balance(u, p, analytique: bool = False) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    du, au, ex = periode(u, p)
    t = str(p.get("type") or "8")
    if t not in TYPES_BALANCE:
        raise ErreurMetier("Type de balance inconnu.")
    groupee = (p.get("balance") or "groupee") == "groupee"
    de, a = str(p.get("compteDe") or "").strip(), str(p.get("compteA") or "").strip()
    if (de and not de.isdigit()) or (a and not a.isdigit()):
        raise ErreurMetier("Compte : chiffres seulement.")
    niveau = int(p["niveau"]) if str(p.get("niveau") or "").isdigit() and int(p["niveau"]) > 0 else None
    agence = int(p["agenceId"]) if str(p.get("agenceId") or "").isdigit() else None
    sans_vidage = str(p.get("sansVidage")) in ("True", "true", "1")
    noms = {r["numero"]: r["libelle"] for r in lignes("select numero, libelle from compte where institution_id is null or institution_id = %s", (u["institution_id"],))}
    g = defaultdict(lambda: [0, 0, 0, 0])                              # ouverture D-C, mouvements D, mouvements C, (réserve)
    for m in mouvements(u, au, vidage=not sans_vidage, agence_id=agence):
        n = m["compte"]
        if m["compte"][0] in "67" and m["date_valeur"].year != ex:
            continue
        if (de and n.ljust(8, "0") < de.ljust(8, "0")) or (a and n.ljust(8, "0")[:len(a.ljust(8, "0"))] > a.ljust(8, "0")):
            continue
        cle = n[:niveau] if groupee and niveau else n
        k = (cle, m["auxiliaire"] if analytique else "")
        if ouverture(m, du, ex):
            g[k][0] += m["montant_cdf"] if m["sens"] == "D" else -m["montant_cdf"]
        elif m["date_valeur"] >= du:
            g[k][1 if m["sens"] == "D" else 2] += m["montant_cdf"]
    out = []
    for (cle, aux), (ouv, md, mc, _) in sorted(g.items()):
        fin = ouv + md - mc
        out.append({"compte": cle, "intitule": noms.get(cle, ""), "auxiliaire": aux, "ouvertureDebit": max(ouv, 0), "ouvertureCredit": max(-ouv, 0),
                    "mouvementDebit": md, "mouvementCredit": mc, "cumulDebit": max(ouv, 0) + md, "cumulCredit": max(-ouv, 0) + mc,
                    "soldeDebit": max(fin, 0), "soldeCredit": max(-fin, 0)})
    tot = {k: sum(x[k] for x in out) for k in ("ouvertureDebit", "ouvertureCredit", "mouvementDebit", "mouvementCredit", "cumulDebit", "cumulCredit", "soldeDebit", "soldeCredit")}
    return {"du": du.isoformat(), "au": au.isoformat(), "exercice": ex, "type": t, "lignes": out, "totaux": tot,
            "equilibree": tot["mouvementDebit"] == tot["mouvementCredit"] and tot["soldeDebit"] == tot["soldeCredit"]}


# ---------- S115 : Journaux comptables (manuel p. 133, capture « Journal comptables ») ----------
MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
MODES = {"debut": "{}%", "contient": "%{}%", "fin": "%{}"}


# B22 : libellés des évènements comptables du logiciel (schema_comptable.type_evenement). Mêmes libellés que web/src/donnees/api.ts.
EVENEMENTS_COMPTA = {
    "depot": "Dépôt en espèces", "retrait": "Retrait en espèces", "adhesion": "Adhésion", "achat_parts": "Achat de parts sociales",
    "retrait_parts": "Retrait de parts sociales", "a_nouveaux": "À-nouveaux", "dat_constitution": "Constitution d'un dépôt à terme",
    "dat_rupture": "Rupture d'un dépôt à terme", "dat_echeance": "Échéance d'un dépôt à terme", "frais_tenue": "Frais de tenue de compte",
    "interet_dav": "Intérêts des comptes d'épargne", "interet_dat_couru": "Intérêts courus des dépôts à terme",
    "interet_credit_couru": "Intérêts courus des crédits", "reevaluation": "Réévaluation des comptes en devises", "cloture_exercice": "Clôture de l'exercice",
    "affectation_resultat": "Affectation du résultat", "immo_dotation": "Dotation aux amortissements", "immo_sortie": "Sortie d'un bien du patrimoine",
    "plan_cotisation": "Cotisation d'un plan d'épargne", "plan_fin": "Fin d'un plan d'épargne", "cloture_inactif": "Clôture d'un compte inactif",
    "versement_bcc": "Versement à la BCC des avoirs en cours de prescription", "ed_encaissement": "Encaissement divers", "ed_decaissement": "Décaissement divers",
    "ecart_caisse": "Écart de caisse", "transfert_caisse": "Alimentation de guichet", "transfert_banque": "Versement en banque",
    "deblocage_credit": "Déblocage de crédit", "remboursement_credit": "Remboursement de crédit", "garantie_caution": "Caution reçue ou libérée",
    "provision_credit": "Déclassement et provision des crédits", "radiation_credit": "Passage en perte d'un crédit",
    "engagement_signature": "Engagement par signature", "fin_engagement": "Fin d'un engagement par signature", "comptabilisation_banque": "Opération de banque",
    "ecriture_manuelle": "Écriture saisie", "operation_comptable": "Opération comptable", "facture": "Facture fournisseur",
    "reglement_facture": "Règlement de facture", "annulation": "Annulation par contre-passation",
}


def schemas(u, p: dict) -> dict:
    """B22 : édition des schémas comptables que le logiciel applique, pour le manuel de procédures de l'institution (Instr. BCC 008, art. 9 : les
    manuels décrivent « les schémas comptables correspondants » ; PCCI § 3.1 : documentation décrivant les procédures et l'organisation comptable).
    Par évènement : les journaux, les comptes débités et les comptes crédités des écritures définitives de l'exercice (journées comptabilisées, T13)."""
    exiger(u)
    ex = p.get("exercice")
    if not str(ex or "").isdigit():
        raise ErreurMetier("À remplir : Exercice.")
    base = """from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
              join compte c on c.id = l.compte_id join journal j on j.id = e.journal_id join schema_comptable sc on sc.id = e.schema_id
              where e.institution_id = %s and jc.statut = 'fermee' and extract(year from e.date_valeur) = %s"""
    q = (u["institution_id"], int(ex))
    out = {}
    for r in lignes(f"select sc.type_evenement as ev, count(distinct e.id) as n, array_agg(distinct j.code) as journaux {base} group by 1", q):
        out[r["ev"]] = {"evenement": r["ev"], "libelle": EVENEMENTS_COMPTA.get(r["ev"], r["ev"]), "journaux": sorted(r["journaux"]), "ecritures": r["n"],
                        "debit": [], "credit": []}
    for r in lignes(f"select distinct sc.type_evenement as ev, c.numero as compte, c.libelle as intitule, l.sens {base} order by 2", q):
        out[r["ev"]]["debit" if r["sens"] == "D" else "credit"].append({"compte": r["compte"], "intitule": r["intitule"]})
    return {"exercice": int(ex), "schemas": sorted(out.values(), key=lambda x: x["libelle"])}


def journaux_contexte(u) -> dict:
    """Critères recherche : Exercice, Mois, Type journal, Journal, Mouvement, Utilisateur"""
    exiger(u)
    from .journaux import TYPES
    i = u["institution_id"]
    return {"exercices": [r["annee"] for r in lignes("select annee from exercice where institution_id = %s order by annee desc", (i,))],
            "exerciceActif": valeur("select annee from exercice where institution_id = %s and actif", (i,)),
            "mois": [{"code": n + 1, "libelle": m} for n, m in enumerate(MOIS)],
            "types": [{"code": k, "libelle": v} for k, v in TYPES.items()],
            "journaux": lignes("select id, code, libelle, type from journal where institution_id = %s and not supprime order by code", (i,)),
            "utilisateurs": lignes("select id, nom from utilisateur where institution_id = %s order by nom", (i,))}


def journaux(u, p: dict) -> dict:
    """Bouton Afficher : les lignes définitives (journées comptabilisées, T13) de l'exercice et du mois, par journal ; « Journal centralisé » : les totaux
    par journal et par compte (PCCI § 3.3 : centralisation au moins mensuelle des journaux auxiliaires). Montants en CDF. Registre S115-1 à S115-4."""
    exiger(u)
    ex = p.get("exercice")
    if not str(ex or "").isdigit():
        raise ErreurMetier("À remplir : Exercice.")
    mois = int(p["mois"]) if str(p.get("mois") or "").isdigit() and 1 <= int(p["mois"]) <= 12 else None
    journal = int(p["journalId"]) if str(p.get("journalId") or "").isdigit() else None
    type_ = p.get("type") or None
    sens = {"D": "D", "C": "C"}.get(p.get("mouvement") or "")
    montant = int(p["montant"]) if str(p.get("montant") or "").isdigit() else None
    util = int(p["utilisateurId"]) if str(p.get("utilisateurId") or "").isdigit() else None
    piece = MODES.get(p.get("pieceMode") or "debut", "{}%").format(p["piece"].strip()) if (p.get("piece") or "").strip() else None
    libelle = MODES.get(p.get("libelleMode") or "debut", "{}%").format(p["libelle"].strip()) if (p.get("libelle") or "").strip() else None
    achats = bool(p.get("achats"))          # S107, Journal achat : les écritures des factures et de leurs règlements
    rows = lignes("""select j.code || ' ' || j.libelle as journal, c.numero as compte, c.libelle as intitule, l.sens, l.montant_cdf, e.date_valeur, pc.numero as piece,
                            e.libelle
                     from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                     join compte c on c.id = l.compte_id join journal j on j.id = e.journal_id join piece pc on pc.id = e.piece_id
                     join schema_comptable sc on sc.id = e.schema_id
                     where e.institution_id = %s and jc.statut = 'fermee' and extract(year from e.date_valeur) = %s
                       and (not %s or sc.type_evenement in ('facture', 'reglement_facture'))
                       and (%s::int is null or extract(month from e.date_valeur) = %s) and (%s::bigint is null or j.id = %s) and (%s::text is null or j.type = %s)
                       and (%s::text is null or l.sens = %s) and (%s::bigint is null or l.montant_cdf = %s) and (%s::bigint is null or e.saisi_par = %s)
                       and (%s::text is null or pc.numero ilike %s) and (%s::text is null or e.libelle ilike %s)
                     order by j.code, e.date_valeur, e.id, l.rang""",
                  (u["institution_id"], int(ex), achats, mois, mois, journal, journal, type_, type_, sens, sens, montant, montant, util, util, piece, piece, libelle, libelle))
    if journal or achats:
        out = [{"journal": r["journal"], "compte": r["compte"], "intitule": r["intitule"], "debit": r["montant_cdf"] if r["sens"] == "D" else 0,
                "credit": r["montant_cdf"] if r["sens"] == "C" else 0} for r in rows]
    else:
        tot = defaultdict(lambda: [0, 0, ""])
        for r in rows:
            t = tot[(r["journal"], r["compte"])]
            t[0 if r["sens"] == "D" else 1] += r["montant_cdf"]
            t[2] = r["intitule"]
        out = [{"journal": k[0], "compte": k[1], "intitule": v[2], "debit": v[0], "credit": v[1]} for k, v in sorted(tot.items())]
    return {"lignes": out, "totalDebit": sum(x["debit"] for x in out), "totalCredit": sum(x["credit"] for x in out)}
