"""S81 : Caisse > Transfert entre caisse (manuel Microfina++, p. 92 et 93 ; doublons p. 106 et 107). Mêmes règles que web/src/donnees/api.ts (transferts).

- Caisse vers caisse (« ALIMENTATION DE GUICHET ») : Caisse d'origine, Montant, Caisse destination, Enregistrer, Annuler. Le compte des mouvements
  de fonds (PCCI 579, compte liaison du guichet, S08-7) sert de contrepartie entre les caisses ; il est soldé dans la même écriture.
- Caisse vers banque (« Virement de Caisse vers Banque », Encaissement Especes) : Caisse, Montant, Banque, Compte Banque, No de chèque. Le virement
  passe par le compte 591 « Virement caisse à banque » (PCCI, compte 59, compte d'attente), soldé dans la même écriture.
Un montant par devise tenue entre caisses (T12) ; vers la banque, la devise du compte bancaire. Billetage sur les deux (décision du porteur du
19/11/2026). Registre S81-1 à S81-7."""
import uuid

from .bd import ErreurMetier, executer, lignes, une
from .services import (controler_montant_coupures, creer_operation, devises_tenues, enregistrer_coupures, exiger, journee_courante, nettoyer, nom_utilisateur,
                       nouvelle_piece, operation_par_cle, poster, theorique, total_comptage, vue_operation)

VIREMENT_CAISSE_BANQUE = "591"     # PCCI, compte 59 : 591 Virement caisse à banque


def caisses_ouvertes(u) -> list[dict]:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        return []
    return [{"sessionId": s["id"], "guichetId": s["guichet_id"], "nom": s["nom"], "caissier": nom_utilisateur(s["caissier_id"]),
             "soldes": {d: total_comptage(theorique(s["id"], d)) for d in devises_tenues()}}
            for s in lignes("""select s.*, g.nom from session_caisse s join guichet g on g.id = s.guichet_id
                               where s.journee_id = %s and s.statut = 'ouverte' and g.agence_id = %s order by g.code""", (j["id"], u["agence_id"]))]


def contexte(u) -> dict:
    exiger(u)
    from .banque_operations import solde_banque
    j = journee_courante(u)
    comptes = lignes("""select cb.id, cb.banque_id as "banqueId", b.code as "banqueCode", b.nom as banque, cb.numero, trim(cb.devise) as devise, c.numero as compte,
                               c.libelle as intitule, cb.compte_id
                        from compte_bancaire cb join banque b on b.id = cb.banque_id join compte c on c.id = cb.compte_id
                        where cb.institution_id = %s and cb.supprime_le is null and b.supprime_le is null order by b.code, cb.numero""", (u["institution_id"],))
    return {"date": j["date"] if j and j["statut"] == "ouverte" else "", "caisses": caisses_ouvertes(u), "devises": devises_tenues(),
            "banques": lignes("select id, code, nom as libelle from banque where institution_id = %s and supprime_le is null order by code", (u["institution_id"],)),
            "comptes": [{k: v for k, v in c.items() if k != "compte_id"} | {"solde": solde_banque(c["compte_id"], c["devise"])} for c in comptes]}


def session(u, sid, quoi: str) -> dict:
    s = une("""select s.*, g.compte_liaison, g.nom from session_caisse s join guichet g on g.id = s.guichet_id
               where s.id = %s and g.agence_id = %s for update of s""", (sid, u["agence_id"])) if isinstance(sid, int) and not isinstance(sid, bool) else None
    if not s:
        raise ErreurMetier(f"À remplir : {quoi}.")
    if s["statut"] != "ouverte":
        raise ErreurMetier(f"{quoi} : la caisse n'est pas ouverte.")
    return s


def cle_valide(p) -> str:
    try:
        return str(uuid.UUID(str((p or {}).get("cle"))))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")


def deja(cle: str):
    o = operation_par_cle(cle)
    return vue_operation(o) if o and o["statut"] == "validee" else None


def sortie_possible(sid: int, devise: str, coupures: dict):
    th = theorique(sid, devise)
    if any(n > th.get(v, 0) for v, n in coupures.items()):
        raise ErreurMetier(f"Pas assez de coupures dans la caisse d'origine ({devise}).")


def caisse_vers_caisse(u, p) -> dict:
    """3-1 Caisse vers caisse (p. 92) : C 570 de la caisse d'origine, D 570 de la caisse destination, par le compte 579 (registre S81-2)"""
    exiger(u)
    cle = cle_valide(p)
    if (v := deja(cle)):
        return v
    o, d = session(u, p.get("origineSessionId"), "Caisse d'origine"), session(u, p.get("destinationSessionId"), "Caisse destination")
    if o["id"] == d["id"]:
        raise ErreurMetier("Caisse destination : une autre caisse que celle d'origine.")
    tenues, saisis = devises_tenues(), []
    montants = p.get("montants") if isinstance(p.get("montants"), dict) else {}
    coupures = p.get("coupures") if isinstance(p.get("coupures"), dict) else {}
    for dv, m in montants.items():
        if m in (None, 0):
            continue
        if dv not in tenues:
            raise ErreurMetier(f"Devise {dv} : les guichets ne la tiennent pas.")
        if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
            raise ErreurMetier(f"Montant ({dv}) : un montant supérieur à zéro.")
        c = nettoyer(coupures.get(dv) or {})
        controler_montant_coupures(c, m, dv)
        sortie_possible(o["id"], dv, c)
        saisis.append((dv, m, c))
    if not saisis:
        raise ErreurMetier("À remplir : Montant.")
    j = une("select date_comptable from journee_comptable where id = %s", (o["journee_id"],))
    # Plan d'allègement, point 7.5 : la sortie se passe tout de suite (C 570 de la caisse d'origine, D 579) ; l'entrée attend que le caissier qui reçoit
    # la confirme avec son billetage (« Fonds à recevoir » : D 570 de sa caisse, C 579). Le 579 est soldé à la réception (PCCI, compte 57).
    l = []
    for dv, m, _ in saisis:
        l += [{"compte": d["compte_liaison"] or "579", "sens": "D", "devise": dv, "montant": m},
              {"compte": "570", "contrat": f"guichet:{o['guichet_id']}", "sens": "C", "devise": dv, "montant": m}]
    eid = poster(u, journal="CA", journee_id=o["journee_id"], libelle=f"Alimentation de guichet : {o['nom']} vers {d['nom']}",
                 piece=nouvelle_piece(u, "CA", j["date_comptable"]), evenement="transfert_caisse", cle=cle, valide_par=u["id"], lignes_ecr=l)
    s_o, s_d = {"id": o["id"], "journeeId": o["journee_id"]}, {"id": d["id"], "journeeId": d["journee_id"]}
    premier = None
    for i, (dv, m, c) in enumerate(saisis):
        k = cle if i == 0 else str(uuid.uuid5(uuid.UUID(cle), dv))
        oid = creer_operation(u, s_o, cle=k, type_="transfert_sortie", statut="validee", tiers_id=None, contrat=f"guichet:{d['guichet_id']}", montant=m,
                              devise=dv, coupures=c, remis_par=None, ecriture_id=eid, motif=f"Vers {d['nom']}")
        creer_operation(u, s_d, cle=str(uuid.uuid5(uuid.UUID(cle), f"entree:{dv}")), type_="transfert_entree", statut="a_recevoir", tiers_id=None,
                        contrat=f"guichet:{o['guichet_id']}", montant=m, devise=dv, coupures={}, remis_par=None, motif=f"De {o['nom']}")
        premier = premier or oid
    return vue_operation(une("select * from operation where id = %s", (premier,)))


def ma_caisse(u) -> dict:
    """La caisse ouverte de l'utilisateur : celle qui reçoit"""
    s = une("""select s.*, g.compte_liaison, g.nom from session_caisse s join guichet g on g.id = s.guichet_id join journee_comptable j on j.id = s.journee_id
               where s.caissier_id = %s and s.statut = 'ouverte' and j.agence_id = %s and j.statut = 'ouverte' order by s.id desc limit 1 for update of s""",
            (u["id"], u["agence_id"]))
    if not s:
        raise ErreurMetier("Aucune caisse ouverte à votre nom.")
    return s


def a_recevoir(u) -> list[dict]:
    """« Fonds à recevoir » de la caisse ouverte de l'utilisateur (plan d'allègement, point 7.5) : alimentations venues d'une autre caisse, et virements de banque
    vers ce guichet validés dans « Opérations en attente » (S57), pas encore reçus"""
    exiger(u)
    j = journee_courante(u)
    s = une("""select s.* from session_caisse s where s.caissier_id = %s and s.statut = 'ouverte' and s.journee_id = %s order by s.id desc limit 1""",
            (u["id"], j["id"])) if j and j["statut"] == "ouverte" else None
    if not s:
        return []
    out = [{"source": "caisse", "id": o["id"], "date": j["date"], "de": (o["motif"] or "").removeprefix("De "), "montant": o["montant"],
            "devise": o["devise"].strip(), "envoyePar": nom_utilisateur(o["saisi_par"])}
           for o in lignes("""select * from operation where session_caisse_id = %s and type = 'transfert_entree' and statut = 'a_recevoir' order by id""", (s["id"],))]
    out += [{"source": "banque", "id": b["id"], "date": b["date_operation"].isoformat(), "de": f"{b['banque']} {b['numero']}", "montant": b["montant"],
             "devise": b["devise"].strip(), "envoyePar": nom_utilisateur(b["saisi_par"])}
            for b in lignes("""select o.*, bq.nom as banque, cb.numero from operation_banque o join compte_bancaire cb on cb.id = o.compte_bancaire_id
                               join banque bq on bq.id = cb.banque_id
                               where o.type = 'banque_caisse' and o.statut in ('validee', 'comptabilisee') and o.recu_operation_id is null
                               and o.guichet_id = %s order by o.date_validation, o.id""", (s["guichet_id"],))]
    return out


def recevoir(u, p) -> dict:
    """Bouton Recevoir de « Fonds à recevoir » : le caissier compte les billets reçus ; D 570 de sa caisse, C 579 (venus d'une caisse) ou C 591 (venus de la
    banque) ; le billetage fait le montant (plan d'allègement, point 7.5 ; PCCI, comptes 57 et 59)"""
    exiger(u)
    cle = cle_valide(p)
    if (v := deja(cle)):
        return v
    s = ma_caisse(u)
    oid = p.get("id") if isinstance(p.get("id"), int) and not isinstance(p.get("id"), bool) else None
    j = une("select date_comptable from journee_comptable where id = %s", (s["journee_id"],))
    if p.get("source") == "caisse":
        o = une("""select * from operation where id = %s and session_caisse_id = %s and type = 'transfert_entree' and statut = 'a_recevoir' for update""",
                (oid, s["id"])) if oid else None
        if not o:
            raise ErreurMetier("Ces fonds ne sont pas à recevoir dans votre caisse.")
        dv, m = o["devise"].strip(), o["montant"]
        c = nettoyer(p.get("coupures") or {})
        controler_montant_coupures(c, m, dv)
        origine = une("select nom, compte_liaison from guichet where id = %s", (int(o["contrat_ref"].split(":")[1]),))
        eid = poster(u, journal="CA", journee_id=s["journee_id"], libelle=f"Alimentation de guichet : {origine['nom']} vers {s['nom']}, reçue",
                     piece=nouvelle_piece(u, "CA", j["date_comptable"]), evenement="transfert_caisse", cle=cle, valide_par=u["id"], lignes_ecr=[
                         {"compte": "570", "contrat": f"guichet:{s['guichet_id']}", "sens": "D", "devise": dv, "montant": m},
                         {"compte": origine["compte_liaison"] or "579", "sens": "C", "devise": dv, "montant": m}])
        executer("update operation set statut = 'validee', valide_par = %s, ecriture_id = %s where id = %s", (u["id"], eid, o["id"]))
        enregistrer_coupures(o["id"], dv, c)
        return vue_operation(une("select * from operation where id = %s", (o["id"],)))
    if p.get("source") == "banque":
        b = une("""select * from operation_banque where id = %s and type = 'banque_caisse' and statut in ('validee', 'comptabilisee') and recu_operation_id is null
                   and guichet_id = %s for update""", (oid, s["guichet_id"])) if oid else None
        if not b:
            raise ErreurMetier("Ces fonds ne sont pas à recevoir dans votre caisse.")
        dv, m = b["devise"].strip(), b["montant"]
        c = nettoyer(p.get("coupures") or {})
        controler_montant_coupures(c, m, dv)
        eid = poster(u, journal="CA", journee_id=s["journee_id"], libelle=f"{b['libelle']}, reçu en caisse", piece=nouvelle_piece(u, "CA", j["date_comptable"]),
                     evenement="transfert_banque", cle=cle, valide_par=u["id"], lignes_ecr=[
                         {"compte": "570", "contrat": f"guichet:{s['guichet_id']}", "sens": "D", "devise": dv, "montant": m},
                         {"compte": VIREMENT_CAISSE_BANQUE, "sens": "C", "devise": dv, "montant": m}])
        r = creer_operation(u, {"id": s["id"], "journeeId": s["journee_id"]}, cle=cle, type_="transfert_entree", statut="validee", tiers_id=None,
                            contrat=f"banque:{b['compte_bancaire_id']}", montant=m, devise=dv, coupures=c, remis_par=None, ecriture_id=eid, motif=f"De la banque ({b['libelle']})")
        executer("update operation_banque set recu_operation_id = %s where id = %s", (r, b["id"]))
        return vue_operation(une("select * from operation where id = %s", (r,)))
    raise ErreurMetier("Fonds à recevoir : origine inconnue.")


def caisse_vers_banque(u, p) -> dict:
    """3-2 Caisse vers banque (p. 92 et 93) : C 570 de la caisse, D du compte de la banque, par le compte 591 (registre S81-3)"""
    exiger(u)
    cle = cle_valide(p)
    if (v := deja(cle)):
        return v
    s = session(u, p.get("sessionId"), "Caisse")
    cid = p.get("compteBancaireId")
    cb = une("""select cb.*, trim(cb.devise) as dv, c.numero as compte from compte_bancaire cb join compte c on c.id = cb.compte_id
                where cb.id = %s and cb.institution_id = %s and cb.supprime_le is null""", (cid, u["institution_id"])) \
        if isinstance(cid, int) and not isinstance(cid, bool) else None
    if not cb:
        raise ErreurMetier("À remplir : Compte Banque.")
    bid = p.get("banqueId")
    if bid is not None and bid != cb["banque_id"]:
        raise ErreurMetier("Ce compte n'est pas un compte de la banque choisie.")
    cheque = (p.get("cheque") or "").strip() if isinstance(p.get("cheque"), str) else ""
    if not cheque:
        raise ErreurMetier("À remplir : N° du bordereau de versement.")
    m = p.get("montant")
    if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
        raise ErreurMetier("Montant : un montant supérieur à zéro.")
    dv = cb["dv"]
    c = nettoyer(p.get("coupures") or {})
    controler_montant_coupures(c, m, dv)
    sortie_possible(s["id"], dv, c)
    j = une("select date_comptable from journee_comptable where id = %s", (s["journee_id"],))
    eid = poster(u, journal="CA", journee_id=s["journee_id"], libelle=f"Versement en banque, bordereau {cheque}", piece=nouvelle_piece(u, "CA", j["date_comptable"]),
                 evenement="transfert_banque", cle=cle, valide_par=u["id"], lignes_ecr=[
                     {"compte": VIREMENT_CAISSE_BANQUE, "sens": "D", "devise": dv, "montant": m},
                     {"compte": "570", "contrat": f"guichet:{s['guichet_id']}", "sens": "C", "devise": dv, "montant": m},
                     {"compte": cb["compte"], "sens": "D", "devise": dv, "montant": m},
                     {"compte": VIREMENT_CAISSE_BANQUE, "sens": "C", "devise": dv, "montant": m}])
    oid = creer_operation(u, {"id": s["id"], "journeeId": s["journee_id"]}, cle=cle, type_="versement_banque", statut="validee", tiers_id=None,
                          contrat=f"banque:{cb['id']}", montant=m, devise=dv, coupures=c, remis_par=None, ecriture_id=eid, motif=f"Chèque {cheque}")
    return vue_operation(une("select * from operation where id = %s", (oid,)))

