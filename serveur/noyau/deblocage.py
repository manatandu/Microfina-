"""S75 et S54 : déblocage du crédit, au guichet (manuel Microfina++, p. 86 et 87, capture « Déblocage crédit ») et par banque (p. 62).
Mêmes règles que web/src/donnees/api.ts (deblocage). Registre S75-1 à S75-8, S54-2 à S54-5, CR-6, CR-10, CR-12.

- Guichet : choisir le crédit visé, Encaisser frais, puis Débloquer ; échéancier et contrat de prêt (texte p. 86).
- Banque : banque, compte, numéro de chèque (chéquier de l'institution, S60), frais, financement ; contrat de prêt (texte p. 62).
- Une écriture : débit du compte de capital du crédit (modèle S26, selon le terme S21) ; crédit de la caisse ou de la banque pour le net ; frais,
  assurance, épargne obligatoire et fonds de solidarité retenus sur le prêt (décision du porteur, CR-6). L'épargne obligatoire et le fonds de solidarité
  vont aux comptes du client et y sont bloqués en garantie du crédit jusqu'à son remboursement (Instr. BCC 38, art. 9 ; S71).
- L'échéancier est recalé sur la date du déblocage ; une échéance qui tombe un jour non ouvré passe au premier jour ouvré suivant (registre S75-1).
- L'octroi entre dans la liste des déclarations à faire à la Centrale des risques (Instr. BCC 05, art. 10 ; CR-10)."""
import uuid
from datetime import date, timedelta

from .bd import ErreurMetier, executer, lignes, une, valeur
from .plans_epargne import date_rang
from .produits_credit import FIXES
from .services import (controler_montant_coupures, creer_operation, exiger, journee_courante, nettoyer, nouvelle_piece, operation_par_cle, poster,
                       session_ouverte, theorique, titulaire, vue_operation)

DEFAUT_CAPITAL = {1: "329", 2: "319", 3: "309"}        # PCCI : autres crédits à court, moyen, long terme (registre S26-2)
DEFAUT_INTERET = {1: "7129", 2: "7119", 3: "7101"}


def terme(duree: int) -> int:
    """S21-2 : court terme 1 à 12 mois, moyen terme 13 à 60, long terme au-delà (PCCI, classe 3)"""
    for n, t in enumerate(FIXES["termes"], start=1):
        if int(t["debut"]) <= duree <= int(t["fin"]):
            return n
    return 3


def fonds_commun(c: dict) -> str:
    """Registre T143 : le compte de l'institution sous 172 « Fonds de garantie mutuels » qui reçoit le fonds de solidarité mis en commun"""
    x = valeur("select solidarite_compte from produit_credit where id = %s", (c["produit_id"],))
    if not x:
        raise ErreurMetier("Fonds de solidarité mis en commun : le produit n'a pas de compte du fonds commun (Paramétrage > Crédit > Produit).")
    return x


def comptes_credit(c: dict, degre: int = 1) -> dict:
    """Comptes du crédit selon le modèle du produit (S26), le degré (sain : 1) et le terme"""
    t = terme(c["duree_mois"])
    m = une("""select mc.compte_capital, mc.compte_interet from credit_modele_compte mc join produit_credit p on p.modele_id = mc.modele_id
               where p.id = %s and mc.degre = %s and mc.terme = %s""", (c["produit_id"], degre, t))
    from .modeles_credit import RETARD
    cap, inte = (DEFAUT_CAPITAL[t], DEFAUT_INTERET[t]) if degre == 1 else RETARD[degre]      # sans modèle : les comptes proposés par S26 (PCCI 390 et 717)
    return {"capital": (m or {}).get("compte_capital") or cap, "interet": (m or {}).get("compte_interet") or inte}


def jour(u) -> date:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return date.fromisoformat(j["date"])


def ouvre(u, d: date) -> date:
    """Premier jour ouvré à partir de d : ni férié (S34), ni jour non coché pour l'agence (registre S75-1)"""
    jt = valeur("select jours_travail from agence where id = %s", (u["agence_id"],)) or []
    for _ in range(31):
        ferie = une("select 1 from jour_ferie where institution_id = %s and date_ferie = %s", (u["institution_id"], d))
        if not ferie and not (any(jt) and not jt[d.isoweekday() % 7]):
            return d
        d += timedelta(days=1)
    return d


def credit_vise(u, cid, agir: bool = False) -> dict:
    c = une("select * from credit where id = %s and institution_id = %s for update", (cid, u["institution_id"])) if isinstance(cid, int) and not isinstance(cid, bool) else None
    if not c:
        raise ErreurMetier("À remplir : N° crédit.")
    if c["statut"] != "vise":
        raise ErreurMetier("Ce crédit n'est pas prêt au déblocage : il faut les trois visas (Crédit > Visas).")
    if agir:                                                            # frais et déblocage : manipulation des valeurs (Instr. BCC 008, art. 66 ; registre CR-28)
        from .separation_credit import separer
        separer(u, "manipulation", c["demande_id"], c["id"])
    return c


def frais_du(c: dict) -> list[dict]:
    """Lignes de frais du produit (S23-6) : libellé, compte, montant pour ce prêt"""
    from .simulation_credit import charge
    return [{"libelle": f["type_frais"], "compte": f["compte"], "montant": charge(f["nature"], f["valeur"], c["montant"])}
            for f in lignes("select * from produit_credit_frais where produit_id = %s order by id", (c["produit_id"],))]


def retenues(c: dict) -> dict:
    fr = frais_du(c)
    # L'épargne obligatoire n'est pas retenue sur le prêt : l'emprunteur la dépose, elle est bloquée au déblocage (Instr. BCC 40, art. 10 ;
    # Instr. BCC 38, art. 9 ; registre T136)
    total = sum(x["montant"] for x in fr) + c["assurance"] + c["fonds_solidarite"]
    return {"frais": fr, "assurance": c["assurance"], "epargneObligatoire": c["epargne_obligatoire"], "fondsSolidarite": c["fonds_solidarite"],
            "total": total, "net": c["montant"] - total}


def echeancier_recale(u, c: dict, d: date) -> list[dict]:
    """Les échéances de la mise en place, aux dates comptées depuis le déblocage, reportées au jour ouvré (S75-1) ; montants inchangés"""
    from .plans_epargne import PERIODICITES
    nd = int(round(c["differe_mois"] * float(PERIODICITES[c["periodicite"]]["denominateur"]) / 12))
    return [{"rang": e["rang"], "date": ouvre(u, date_rang(d, c["periodicite"], nd + e["rang"])).isoformat(), "capital": e["capital"], "interet": e["interet"]}
            for e in lignes("select * from echeance where credit_id = %s order by rang", (c["id"],))]


def a_debloquer(u) -> list[dict]:
    exiger(u)
    from .cloison import clause
    ag, pa = clause(u, "(select t.agence_id from tiers t where t.id = credit.tiers_id)")     # les crédits de ses membres (registre T213, T230)
    return [{"id": c["id"], "numero": c["numero"], "client": titulaire(c["tiers_id"]), "montant": c["montant"], "devise": c["devise"].strip()}
            for c in lignes(f"select * from credit where institution_id = %s and statut = 'vise'{ag} order by id", (u["institution_id"], *pa))]


def compte_positionnement(c) -> dict | None:
    """S105 : compte où le prêt est positionné : le premier compte d'épargne à vue du client ouvert dans la devise du crédit, sinon le compte
    d'épargne du crédit (registre S105-1)"""
    return une("""select cd.id, cd.numero, p.famille, p.compte_lie from compte_depot cd join produit_epargne p on p.id = cd.produit_id
                  where cd.tiers_id = %s and cd.statut = 'ouvert' and trim(cd.devise) = %s and (p.famille = 'EPARGNE' or cd.id = %s)
                  order by (p.famille = 'EPARGNE') desc, cd.numero limit 1""", (c["tiers_id"], c["devise"].strip(), c["compte_epargne_id"]))


def detail(u, cid: int) -> dict:
    """Infos crédit, Info client, frais et retenues, échéancier recalé sur la journée (captures p. 62 et 87)"""
    exiger(u)
    from .mise_en_place import vue
    c = credit_vise(u, cid)
    compte = valeur("select numero from compte_depot where id = %s", (c["compte_epargne_id"],)) if c["compte_epargne_id"] else \
        valeur("select numero from compte_depot where tiers_id = %s and statut = 'ouvert' order by numero limit 1", (c["tiers_id"],))
    return {**vue(c), "compteClient": compte or "", "comptePositionnement": (compte_positionnement(c) or {}).get("numero", ""),
            "fraisEncaisses": bool(c["frais_encaisses_le"]), "retenues": retenues(c),
            "echeancierDeblocage": echeancier_recale(u, c, jour(u))}


def encaisser_frais(u, cid: int) -> dict:
    """« Encaisser frais » (texte p. 86) : les frais et retenues sont arrêtés ; ils seront retenus sur le prêt au déblocage (CR-6)"""
    exiger(u)
    c = credit_vise(u, cid, True)
    executer("update credit set frais_encaisses_le = %s, frais_encaisses_par = %s where id = %s", (jour(u), u["id"], c["id"]))
    return detail(u, c["id"])


def ecriture(u, c: dict, d: date, contrepartie: dict, journal: str, cle: str) -> int:
    r = retenues(c)
    dv = c["devise"].strip()
    l = [{"compte": comptes_credit(c)["capital"], "contrat": f"credit:{c['id']}", "sens": "D", "devise": dv, "montant": c["montant"]},
         {**contrepartie, "sens": "C", "devise": dv, "montant": r["net"]}]
    for f in r["frais"]:
        if f["montant"]:
            l.append({"compte": f["compte"], "sens": "C", "devise": dv, "montant": f["montant"]})
    if c["assurance"]:
        ca = valeur("select compte from credit_assureur where id = %s", (c["assureur_id"],)) or ""
        if not ca:
            raise ErreurMetier("L'assureur n'a pas de compte (Paramétrage > Crédit > Assureur crédit).")
        l.append({"compte": ca, "sens": "C", "devise": dv, "montant": c["assurance"]})
    from .services import compte_du_produit
    if c["epargne_obligatoire"]:                     # déposée d'abord par l'emprunteur (Instr. BCC 40, art. 10 ; registre T136)
        from .depots_terme import disponible
        if not c["compte_epargne_id"] or disponible(c["compte_epargne_id"], dv) < c["epargne_obligatoire"]:
            num = valeur("select numero from compte_depot where id = %s", (c["compte_epargne_id"],)) or ""
            raise ErreurMetier(f"Épargne obligatoire : l'emprunteur dépose d'abord {c['epargne_obligatoire'] / 100:,.2f} {dv}".replace(",", " ").replace(".", ",")
                               + (f" sur le compte {num}" if num else "") + " ; elle n'est pas retenue sur le prêt (Instr. BCC 40, art. 10).")
    for cid_, m in ((c["compte_solidarite_id"], c["fonds_solidarite"]),):
        if m and not cid_:     # registre T143 : fonds mis en commun, au compte 172 du produit (PCCI, compte 17)
            l.append({"compte": fonds_commun(c), "sens": "C", "devise": dv, "montant": m})
        elif m:
            p = une("""select p.famille, p.compte_lie from compte_depot cd join produit_epargne p on p.id = cd.produit_id where cd.id = %s""", (cid_,))
            l.append({"compte": compte_du_produit(p), "contrat": f"depot:{cid_}", "sens": "C", "devise": dv, "montant": m})
    if r["net"] <= 0:
        raise ErreurMetier("Les retenues dépassent le montant du prêt.")
    eid = poster(u, journal=journal, journee_id=journee_courante(u)["id"], libelle=f"Déblocage du crédit {c['numero']}",
                 piece=nouvelle_piece(u, journal, d), evenement="deblocage_credit", cle=cle, valide_par=u["id"], lignes_ecr=l)
    return eid


def apres_deblocage(u, c: dict, d: date, eid: int, mode: str):
    for cid_, m, quoi in ((c["compte_epargne_id"], c["epargne_obligatoire"], "Épargne obligatoire"), (c["compte_solidarite_id"], c["fonds_solidarite"], "Fonds de solidarité")):
        if m and cid_:                                                   # bloqués en garantie du crédit (Instr. BCC 38, art. 9 ; S71) ; pas le fonds commun
            executer("insert into blocage (compte_id, montant, motif, garantie_de, pose_par) values (%s, %s, %s, %s, %s)",
                     (cid_, m, f"{quoi} du crédit {c['numero']}", c["id"], u["id"]))
    for e in echeancier_recale(u, c, d):
        executer("update echeance set date_due = %s where credit_id = %s and rang = %s", (e["date"], c["id"], e["rang"]))
    premiere = valeur("select min(date_due) from echeance where credit_id = %s", (c["id"],))
    executer("""update credit set statut = 'debloque', debloque_le = %s, date_effet = %s, date_debut = %s, ecriture_deblocage_id = %s, mode_deblocage = %s
                where id = %s""", (d, d, premiere, eid, mode, c["id"]))


def debloquer_caisse(u, cid: int, p) -> dict:
    """S75 : Débloquer au guichet, en espèces, avec le billetage des coupures remises (registre S75-2 à S75-8)"""
    exiger(u)
    cle = str(uuid.UUID(str((p or {}).get("cle"))))
    prec = operation_par_cle(cle)
    if prec and prec["statut"] == "validee":
        return vue_operation(prec)
    c = credit_vise(u, cid, True)
    if not c["frais_encaisses_le"]:                 # plan d'allègement, point 4.7 : plus d'étape « Encaisser frais » au guichet ; la date se note au déblocage
        executer("update credit set frais_encaisses_le = %s, frais_encaisses_par = %s where id = %s", (jour(u), u["id"], c["id"]))
        c = {**c, "frais_encaisses_le": jour(u), "frais_encaisses_par": u["id"]}
    dv = c["devise"].strip()
    s = session_ouverte(u, dv)
    net = retenues(c)["net"]
    coupures = nettoyer((p or {}).get("coupures") or {})
    controler_montant_coupures(coupures, net, dv)
    th = theorique(s["id"], dv)
    if any(n > th.get(v, 0) for v, n in coupures.items()):
        raise ErreurMetier("Pas assez de coupures en caisse.")
    from . import conformite
    examen = conformite.autorisation(u, c["tiers_id"], s["journeeId"], "deblocage_credit", net, dv)     # écart E01 : espèces de 10 000 USD ou plus
    d = jour(u)
    eid = ecriture(u, c, d, {"compte": "570", "contrat": f"guichet:{s['guichetId']}"}, "CA", cle)
    oid = creer_operation(u, s, cle=cle, type_="deblocage_credit", statut="validee", tiers_id=c["tiers_id"], contrat=f"credit:{c['id']}", montant=net,
                          devise=dv, coupures=coupures, remis_par=titulaire(c["tiers_id"]), ecriture_id=eid, motif=f"Déblocage {c['numero']}")
    apres_deblocage(u, c, d, eid, "caisse")
    conformite.lier(examen, oid)
    return vue_operation(une("select * from operation where id = %s", (oid,)))


def debloquer_banque(u, cid: int, p) -> dict:
    """S54 : déblocage par banque : le net part du compte bancaire choisi, par un chèque du chéquier de l'institution (registre S54-2 à S54-5, S60-5)"""
    exiger(u)
    c = credit_vise(u, cid, True)
    if not c["frais_encaisses_le"]:                 # plan d'allègement, point 6.7 : plus d'étape « Prélever les frais » ; la date se note au déblocage
        executer("update credit set frais_encaisses_le = %s, frais_encaisses_par = %s where id = %s", (jour(u), u["id"], c["id"]))
        c = {**c, "frais_encaisses_le": jour(u), "frais_encaisses_par": u["id"]}
    cbid = (p or {}).get("compteBancaireId")
    cb = une("""select cb.*, co.numero as compte from compte_bancaire cb join compte co on co.id = cb.compte_id
                where cb.id = %s and cb.institution_id = %s and cb.supprime_le is null""", (cbid, u["institution_id"])) if isinstance(cbid, int) else None
    if not cb:
        raise ErreurMetier("À remplir : Banque et Compte.")
    if cb["devise"].strip() != c["devise"].strip():
        raise ErreurMetier("Le compte bancaire n'est pas dans la devise du crédit.")
    cheque = (p or {}).get("cheque").strip() if isinstance((p or {}).get("cheque"), str) else ""
    if not cheque:
        raise ErreurMetier("À remplir : N° chèque.")
    from . import chequiers
    d = jour(u)
    chequiers.utiliser(cb["id"], cheque, None)                         # registre S60-5 : un chèque du chéquier du compte, une seule fois
    eid = ecriture(u, c, d, {"compte": cb["compte"]}, "OD", str(uuid.uuid4()))
    executer("update credit set cheque_deblocage = %s, compte_bancaire_deblocage_id = %s where id = %s", (cheque, cb["id"], c["id"]))
    apres_deblocage(u, c, d, eid, "banque")
    from .mise_en_place import vue
    return vue(une("select * from credit where id = %s", (c["id"],)))


def debloquer_epargne(u, cid: int, p) -> dict:
    """S105 : Comptabilité > Déblocage crédit (manuel p. 124 ; « Déblocage de crédit par positionnement sur compte épargne », p. 156 et 157) :
    le net est porté au compte d'épargne du client, celui du crédit ou son premier compte ouvert dans la devise (registre S105-1 à S105-3)"""
    exiger(u)
    c = credit_vise(u, cid, True)
    if not c["frais_encaisses_le"]:                 # plan d'allègement, point 6.7 : plus d'étape « Prélever les frais » ; la date se note au déblocage
        executer("update credit set frais_encaisses_le = %s, frais_encaisses_par = %s where id = %s", (jour(u), u["id"], c["id"]))
        c = {**c, "frais_encaisses_le": jour(u), "frais_encaisses_par": u["id"]}
    from .services import compte_du_produit
    k = compte_positionnement(c)
    if not k:
        raise ErreurMetier("Le client n'a pas de compte d'épargne ouvert dans la devise du crédit.")
    d = jour(u)
    eid = ecriture(u, c, d, {"compte": compte_du_produit(k), "contrat": f"depot:{k['id']}"}, "OD", str(uuid.uuid4()))
    apres_deblocage(u, c, d, eid, "epargne")
    from .mise_en_place import vue
    return {**vue(une("select * from credit where id = %s", (c["id"],))), "compteCredite": k["numero"],
            "piece": valeur("select pc.numero from ecriture e join piece pc on pc.id = e.piece_id where e.id = %s", (eid,))}


def contrat(u, cid: int) -> dict:
    """Contrat de prêt et reconnaissance de dette (boutons p. 62 et 87) : rédigés par nous à partir du dossier, avec les mentions des textes (registre CR-12) :
    montant, durée, taux, TEG (Instr. BCC 38, art. 3 et 5), échéancier, frais, garanties, pénalité de retard (CR-7), pénalité d'anticipation au plus
    50 % des intérêts restant dus (art. 14)"""
    exiger(u)
    from .mise_en_place import vue
    from .releves import client, entete
    from .services import est_coopec
    c = une("select * from credit where id = %s and institution_id = %s", (cid, u["institution_id"]))
    if not c:
        raise ErreurMetier("Crédit introuvable.")
    p = une("select penalite_retard, penalite_anticipation, taux_regle from produit_credit where id = %s", (c["produit_id"],))
    v = vue(c)
    if c["statut"] == "vise":
        v["echeancier"] = echeancier_recale(u, c, jour(u))
    return {"entete": entete(u["institution_id"]), "client": client(c["tiers_id"]), "coopec": est_coopec(u), "credit": v, "retenues": retenues(c),
            "penaliteRetard": float(p["penalite_retard"] or 0), "penaliteAnticipation": float(p["penalite_anticipation"] or 0), "tauxRegle": bool(p["taux_regle"]),
            "garanties": [{"type": g["type"], "montant": g["montant"], "caution": titulaire(g["caution_id"]) if g["caution_id"] else ""}
                          for g in lignes("select * from garantie where credit_id = %s and liberee_le is null order by id", (c["id"],))]
            # A4 : nantissement du matériel professionnel, avec les mentions de la loi 11/020, art. 50
            + [{"type": "materiel", "montant": n["montant"], "caution": "", "description": n["description"], "emplacement": n["emplacement"]}
               for n in lignes("select * from nantissement_materiel where credit_id = %s and libere_le is null order by id", (c["id"],))],
            "agence": valeur("select nom from agence where id = %s", (u["agence_id"],)), "date": jour(u).isoformat()}
