"""S78 : Caisse > ED Divers (manuel Microfina++, p. 89 et 90 ; doublons p. 97 et 98). Mêmes règles que web/src/donnees/api.ts (guichet.edDivers).
Type operation (ENCAISSEMENT ou DECAISSEMENT), Operations (le référentiel S31 : PRODUIT en encaissement, CHARGE en décaissement), Compte affiché
automatiquement, Libelle modifiable (texte p. 97), Montant. Enregistrer : l'écriture passe au guichet, comme un dépôt.
Un montant par devise tenue (règle T12) ; billetage pour chaque devise (décision du porteur du 19/11/2026). Registre S78-1 à S78-6."""
import uuid

from .bd import ErreurMetier, une
from .services import (controler_montant_coupures, creer_operation, devises_tenues, nettoyer, nouvelle_piece, operation_par_cle, poster,
                       session_ouverte, theorique, vue_operation, avec_avertissement)

SENS = {"ENCAISSEMENT": "PRODUIT", "DECAISSEMENT": "CHARGE"}


def cle_devise(cle: str, devise: str, premiere: bool) -> str:
    """Une opération de caisse par devise : la première garde la clé du poste, les autres en dérivent (comme l'adhésion en devise)"""
    return cle if premiere else str(uuid.uuid5(uuid.UUID(cle), devise))


def enregistrer(u: dict, p: dict) -> dict:
    try:
        uuid.UUID(str(p.get("cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = operation_par_cle(p["cle"])
    if prec and prec["statut"] == "validee":
        return vue_operation(prec)
    type_op = p.get("typeOperation")
    if type_op not in SENS:
        raise ErreurMetier("À remplir : Type operation.")
    oid = p.get("operationId")
    od = une("select * from operation_diverse where id = %s and institution_id = %s", (oid, u["institution_id"])) \
        if isinstance(oid, int) and not isinstance(oid, bool) else None
    if not od:
        raise ErreurMetier("À remplir : Operations.")
    if od["statut"] != "ACTIF" or od["sens"] != SENS[type_op]:
        raise ErreurMetier("Cette opération n'est pas proposée en " + type_op.lower() + " (Paramétrage > ED divers).")
    libelle = (p.get("libelle") or "").strip() or od["libelle"]
    montants = p.get("montants") if isinstance(p.get("montants"), dict) else {}
    coupures = p.get("coupures") if isinstance(p.get("coupures"), dict) else {}
    tenues = devises_tenues()
    saisis = []
    for d, m in montants.items():
        if m in (None, 0):
            continue
        if d not in tenues:
            raise ErreurMetier(f"Devise {d} : le guichet ne la tient pas.")
        if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
            raise ErreurMetier(f"Montant ({d}) : un montant supérieur à zéro.")
        saisis.append((d, m, nettoyer(coupures.get(d) or {})))
    if not saisis:
        raise ErreurMetier("À remplir : Montant.")
    s = session_ouverte(u, saisis[0][0])
    encaissement = type_op == "ENCAISSEMENT"
    for d, m, c in saisis:
        controler_montant_coupures(c, m, d)
        if not encaissement:
            th = theorique(s["id"], d)
            if any(n > th.get(v, 0) for v, n in c.items()):
                raise ErreurMetier(f"Pas assez de coupures en caisse ({d}).")
    j = une("select date_comptable from journee_comptable where id = %s", (s["journeeId"],))
    l = []
    for d, m, _ in saisis:
        caisse = {"compte": "570", "contrat": f"guichet:{s['guichetId']}", "sens": "D" if encaissement else "C", "devise": d, "montant": m}
        autre = {"compte": od["compte"], "contrat": f"ed:{od['id']}", "sens": "C" if encaissement else "D", "devise": d, "montant": m}
        l += [caisse, autre]
    eid = poster(u, journal="CA", journee_id=s["journeeId"], libelle=libelle, piece=nouvelle_piece(u, "CA", j["date_comptable"]),
                 evenement="ed_encaissement" if encaissement else "ed_decaissement", cle=p["cle"], valide_par=u["id"], lignes_ecr=l)
    premier = None
    for i, (d, m, c) in enumerate(saisis):
        o = creer_operation(u, s, cle=cle_devise(p["cle"], d, i == 0), type_="ed_encaissement" if encaissement else "ed_decaissement", statut="validee",
                            tiers_id=None, contrat=f"ed:{od['id']}", montant=m, devise=d, coupures=c, remis_par=None, ecriture_id=eid, motif=libelle)
        premier = premier or o
    return avec_avertissement(vue_operation(une("select * from operation where id = %s", (premier,))), s, saisis[0][0])
