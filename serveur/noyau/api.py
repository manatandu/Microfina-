"""API HTTP de Likelemba (Django Ninja). Une route par fonction de la façade web/src/donnees/api.ts, mêmes données.
Chaque route lit l'utilisateur de la session ; les droits sont vérifiés dans les services (exiger)."""
from django.http import HttpRequest
from ninja import Body, NinjaAPI

from . import frais as fr
from . import groupes as gs
from . import procurations as pr
from . import banques as bq
from . import guichets as gu
from . import exercices as ex
from . import listes as li
from . import budget as bu
from . import localisation as lo
from . import credit as cr
from . import ordres as od
from . import comptes as cp
from . import numerotation as nu
from . import services as s
from .bd import ErreurMetier

api = NinjaAPI(title="Likelemba", version="0.1", urls_namespace="likelemba", docs_url="/docs" )

METHODES_SURES = {"GET", "HEAD", "OPTIONS"}


@api.exception_handler(ErreurMetier)
def refus(request, exc: ErreurMetier):
    return api.create_response(request, {"message": exc.message}, status=exc.statut)


def u(request: HttpRequest) -> dict:
    # Protection contre les requêtes forgées depuis un autre site : en-tête propre à l'application sur toute écriture
    if request.method not in METHODES_SURES and request.headers.get("X-Likelemba") != "1":
        raise ErreurMetier("Requête refusée.", 403)
    return s.exiger(s.charger_utilisateur(request.session.get("utilisateur")))


# ---------- Session ----------
@api.post("/session")
def session_ouvrir(request, corps: dict = Body(...)):
    if request.headers.get("X-Likelemba") != "1":
        raise ErreurMetier("Requête refusée.", 403)
    util = s.ouvrir_session(corps.get("login", ""), corps.get("motDePasse"))
    request.session.cycle_key()
    request.session["utilisateur"] = util["id"]
    return s.vue_utilisateur(util)


@api.delete("/session")
def session_fermer(request):
    request.session.flush()
    return None


@api.get("/session")
def session_courante(request):
    util = s.charger_utilisateur(request.session.get("utilisateur"))
    return s.vue_utilisateur(util) if util else None


@api.get("/utilisateurs")
def utilisateurs(request):
    return s.utilisateurs()


@api.get("/referentiel")
def referentiel(request):
    return s.contexte(u(request))


# ---------- Journées ----------
@api.get("/journees")
def journees_liste(request):
    return s.journees(u(request))


@api.get("/journees/courante")
def journee_courante(request):
    return s.journee_courante(u(request)) if request.session.get("utilisateur") else None


@api.post("/journees")
def journee_ouvrir(request, corps: dict = Body(...)):
    return s.ouvrir_journee(u(request), corps["date"])


@api.get("/journees/{jid}/controles")
def journee_controles(request, jid: int):
    u(request)
    return s.controles_journee(jid)


@api.post("/journees/{jid}/fermeture")
def journee_fermer(request, jid: int):
    return s.fermer_journee(u(request), jid)


@api.get("/journees/{jid}/caisses")
def caisses_journee(request, jid: int):
    u(request)
    return s.sessions_journee(jid)


@api.get("/journees/{jid}/operations")
def operations_journee(request, jid: int):
    u(request)
    return s.operations_du_jour(jid)


# ---------- Caisses et billetages ----------
@api.get("/caisses/moi")
def caisse_du_caissier(request):
    return s.session_du_caissier(u(request))


@api.post("/caisses")
def caisse_ouvrir(request, corps: dict = Body(...)):
    return s.ouvrir_caisse(u(request), int(corps["guichetId"]))


@api.get("/caisses/{sid}/theorique")
def caisse_theorique(request, sid: int, devise: str):
    u(request)
    return s.theorique(sid, devise)


@api.get("/caisses/{sid}/billetages")
def caisse_billetages(request, sid: int):
    u(request)
    return s.billetages(sid)


@api.post("/caisses/{sid}/billetages")
def billetage_saisir(request, sid: int, corps: dict = Body(...)):
    return s.saisir_billetage(u(request), sid, corps["devise"], corps.get("compte") or {}, corps.get("bonCaisse") or 0)


@api.get("/billetages/a-valider")
def billetages_a_valider(request):
    return s.billetages_a_valider(u(request))


@api.post("/billetages/{bid}/validation")
def billetage_valider(request, bid: int):
    return s.valider_billetage(u(request), bid)


# ---------- Tiers ----------
@api.get("/tiers")
def tiers_rechercher(request, q: str = ""):
    return s.rechercher_tiers(u(request), q)


@api.get("/prospects")
def prospects_lire(request):
    return s.prospects(u(request))


@api.post("/prospects")
def prospect_creer(request, corps: dict = Body(...)):
    return s.creer_prospect(u(request), corps)


@api.post("/prospects/{tid}")
def prospect_modifier(request, tid: int, corps: dict = Body(...)):
    return s.modifier_prospect(u(request), tid, corps)


@api.get("/rapports/clients")
def rapport_clients(request):
    return s.rapport_clients(u(request))


@api.get("/rapports/modifications")
def rapport_modifications(request):
    return s.rapport_modifications(u(request))


@api.get("/rapports/transactions")
def rapport_transactions(request, du: str = "", au: str = ""):
    return s.rapport_transactions(u(request), du, au)


@api.get("/tiers/a-revalider")
def tiers_a_revalider(request):
    return s.tiers_a_revalider(u(request))


@api.post("/tiers/{tid}/activation")
def tiers_activer(request, tid: int):
    return s.activer_tiers(u(request), tid)


@api.get("/tiers/a-viser")
def tiers_a_viser(request):
    return s.tiers_a_viser(u(request))


@api.post("/tiers/entreprises")
def entreprise_creer(request, corps: dict = Body(...)):
    return s.creer_entreprise(u(request), corps)


@api.post("/tiers/groupes")
def groupe_creer(request, corps: dict = Body(...)):
    return s.creer_groupe(u(request), corps)


@api.get("/tiers/{tid}")
def tiers_lire(request, tid: int):
    u(request)
    return s.lire_tiers(tid)


@api.post("/tiers")
def tiers_creer(request, corps: dict = Body(...)):
    return s.creer_tiers(u(request), corps)


@api.post("/tiers/{tid}/visa")
def tiers_viser(request, tid: int, corps: dict | None = Body(None)):
    return s.viser_tiers(u(request), tid, corps)


@api.get("/tiers/{tid}/comptes")
def tiers_comptes(request, tid: int):
    u(request)
    return s.comptes_du_tiers(tid)


@api.post("/tiers/{tid}/modification")
def tiers_modifier(request, tid: int, corps: dict = Body(...)):
    return s.modifier_tiers(u(request), tid, corps)


@api.post("/tiers/{tid}/resiliation")
def tiers_resilier(request, tid: int, corps: dict = Body(...)):
    return s.resilier_tiers(u(request), tid, corps)


@api.post("/tiers/{tid}/specimen")
def tiers_specimen(request, tid: int, corps: dict = Body(...)):
    return s.changer_specimen(u(request), tid, corps)


@api.get("/tiers/{tid}/consentements")
def tiers_consentements(request, tid: int):
    return s.consentements(u(request), tid)


@api.post("/tiers/{tid}/consentements")
def tiers_consentement_creer(request, tid: int, corps: dict = Body(...)):
    return s.creer_consentement(u(request), tid, corps)


@api.get("/tiers/{tid}/images")
def tiers_images(request, tid: int):
    return s.images_tiers(u(request), tid)


@api.get("/tiers/{tid}/modifications")
def tiers_modifications(request, tid: int):
    return s.modifications_tiers(u(request), tid)


@api.get("/tiers/{tid}/frais")
def tiers_frais(request, tid: int):
    return fr.frais_lies(u(request), tid)


@api.post("/tiers/{tid}/frais")
def tiers_frais_modifier(request, tid: int, corps: dict = Body(...)):
    return fr.modifier_frais_client(u(request), tid, corps)


@api.get("/tiers/{tid}/parts")
def tiers_parts(request, tid: int):
    u(request)
    return s.parts_du_tiers(tid)


# ---------- Guichet ----------
@api.post("/guichet/depots")
def guichet_depot(request, corps: dict = Body(...)):
    return s.depot(u(request), corps)


@api.post("/guichet/retraits")
def guichet_retrait(request, corps: dict = Body(...)):
    return s.retrait(u(request), corps)


@api.post("/guichet/parts")
def guichet_parts(request, corps: dict = Body(...)):
    return s.operation_parts(u(request), corps)


@api.post("/guichet/adhesions")
def guichet_adhesion(request, corps: dict = Body(...)):
    return s.adhesion(u(request), corps)


# ---------- Opérations ----------
@api.get("/operations/en-attente")
def operations_en_attente(request):
    return s.operations_en_attente(u(request))


@api.get("/operations/{oid}")
def operation_lire(request, oid: int):
    u(request)
    return s.lire_operation(oid)


@api.get("/operations/{oid}/recu")
def operation_recu(request, oid: int):
    u(request)
    return s.recu(oid)


@api.post("/operations/{oid}/visa")
def operation_viser(request, oid: int):
    return s.viser_operation(u(request), oid)


@api.post("/operations/{oid}/refus")
def operation_refuser(request, oid: int):
    s.refuser_operation(u(request), oid)
    return None


# ---------- États ----------
@api.get("/etats/balance")
def etats_balance(request):
    return s.balance(u(request))


@api.get("/etats/journal")
def etats_journal(request, journee: int | None = None):
    return s.journal(u(request), journee)


# ---------- Paramétrage : frais (S16) ----------
TABLES = {"operation": "parametrage_frais", "adhesion": "parametrage_frais_adhesion"}


@api.get("/parametrage/frais")
def frais_lire(request):
    return fr.lire(u(request))


@api.post("/parametrage/frais")
def frais_creer(request, corps: dict = Body(...)):
    return fr.creer_frais(u(request), corps)


@api.post("/parametrage/frais/{fid}")
def frais_modifier(request, fid: int, corps: dict = Body(...)):
    return fr.modifier_frais(u(request), fid, corps)


@api.delete("/parametrage/frais/{fid}")
def frais_supprimer(request, fid: int):
    fr.supprimer_frais(u(request), fid)
    return None


@api.post("/parametrage/frais-operation")
def frais_parametrer_operation(request, corps: dict = Body(...)):
    return fr.parametrer_operation(u(request), corps)


@api.post("/parametrage/frais-adhesion")
def frais_parametrer_adhesion(request, corps: dict = Body(...)):
    return fr.parametrer_adhesion(u(request), corps)


@api.post("/parametrage/frais-{genre}/{pid}")
def parametrage_modifier(request, genre: str, pid: int, corps: dict = Body(...)):
    if genre not in TABLES:
        raise ErreurMetier("Introuvable.", 404)
    fr.modifier_parametrage(u(request), TABLES[genre], pid, corps)
    return None


@api.post("/parametrage/frais-adhesion/{pid}/categorie")
def parametrage_categorie(request, pid: int, corps: dict = Body(...)):
    fr.modifier_categorie(u(request), pid, corps)
    return {"ok": True}


@api.delete("/parametrage/frais-{genre}/{pid}")
def parametrage_supprimer(request, genre: str, pid: int):
    if genre not in TABLES:
        raise ErreurMetier("Introuvable.", 404)
    fr.supprimer_parametrage(u(request), TABLES[genre], pid)
    return None


# ---------- Client : groupes solidaires (S44) ----------
@api.get("/groupes-solidaires")
def gs_lire(request):
    return gs.lire(u(request))


@api.post("/groupes-solidaires")
def gs_creer(request, corps: dict = Body(...)):
    return gs.creer(u(request), corps)


@api.post("/groupes-solidaires/{gid}")
def gs_modifier(request, gid: int, corps: dict = Body(...)):
    return gs.modifier(u(request), gid, corps)


@api.delete("/groupes-solidaires/{gid}")
def gs_supprimer(request, gid: int):
    gs.supprimer(u(request), gid)
    return None


@api.post("/groupes-solidaires/{gid}/membres")
def gs_affecter(request, gid: int, corps: dict = Body(...)):
    return gs.affecter(u(request), gid, corps)


@api.post("/groupes-solidaires/{gid}/retrait")
def gs_retirer(request, gid: int, corps: dict = Body(...)):
    return gs.retirer(u(request), gid, corps)


# ---------- Client : types de procuration (S47) ----------
@api.get("/types-procuration")
def tp_lire(request):
    return pr.lire(u(request))


@api.post("/types-procuration")
def tp_creer(request, corps: dict = Body(...)):
    return pr.creer(u(request), corps)


@api.delete("/types-procuration/{tid}")
def tp_supprimer(request, tid: int):
    pr.supprimer(u(request), tid)
    return None


# ---------- Banque : création banque (S58) ----------
@api.get("/banques")
def bq_lire(request):
    return bq.lire(u(request))


@api.post("/banques")
def bq_creer(request, corps: dict = Body(...)):
    return bq.enregistrer_banque(u(request), corps)


@api.post("/banques/comptes")
def bq_compte_creer(request, corps: dict = Body(...)):
    return bq.enregistrer_compte(u(request), corps)


@api.post("/banques/comptes/{cid}")
def bq_compte_modifier(request, cid: int, corps: dict = Body(...)):
    return bq.enregistrer_compte(u(request), corps, cid)


@api.delete("/banques/comptes/{cid}")
def bq_compte_supprimer(request, cid: int):
    return bq.supprimer_compte(u(request), cid)


@api.post("/banques/{bid}")
def bq_modifier(request, bid: int, corps: dict = Body(...)):
    return bq.enregistrer_banque(u(request), corps, bid)


@api.delete("/banques/{bid}")
def bq_supprimer(request, bid: int):
    return bq.supprimer_banque(u(request), bid)


# ---------- Administration : guichets (S08, S09) ----------
@api.get("/guichets")
def gu_lire(request):
    return gu.lire(u(request))


@api.post("/guichets")
def gu_creer(request, corps: dict = Body(...)):
    return gu.enregistrer(u(request), corps)


@api.post("/guichets/{gid}/ouverture")
def gu_ouvrir(request, gid: int, corps: dict = Body(None)):
    return gu.ouvrir(u(request), gid, (corps or {}).get("journeeId"))


@api.post("/guichets/{gid}")
def gu_modifier(request, gid: int, corps: dict = Body(...)):
    return gu.enregistrer(u(request), corps, gid)


@api.get("/affectations-guichets")
def gu_affectations(request):
    return gu.affectations(u(request))


@api.post("/affectations-guichets")
def gu_affecter(request, corps: dict = Body(...)):
    return gu.affecter(u(request), corps)


@api.post("/affectations-guichets/{uid}/retrait")
def gu_retirer(request, uid: int):
    return gu.retirer(u(request), uid)


@api.post("/guichets/{gid}/fermeture")
def gu_fermer(request, gid: int):
    return gu.fermer(u(request), gid)


# ---------- Administration : exercice (S11) ----------
@api.get("/exercices")
def ex_lire(request):
    return ex.lire(u(request))


@api.post("/exercices")
def ex_enregistrer(request, corps: dict = Body(...)):
    return ex.enregistrer(u(request), corps)


@api.post("/exercices/completer")
def ex_completer(request, corps: dict = Body(...)):
    return ex.completer(u(request), corps)


@api.post("/exercices/{annee}/ouverture")
def ex_ouvrir(request, annee: int):
    return ex.ouvrir(u(request), annee)


# ---------- Info de base > Client > Général : moteur des listes (S14, S14a à S14n) ----------
@api.get("/listes/{liste}")
def li_lire(request, liste: str):
    return li.lire(u(request), liste)


@api.post("/listes/{liste}")
def li_creer(request, liste: str, corps: dict = Body(...)):
    return li.enregistrer(u(request), liste, corps)


@api.post("/listes/{liste}/{lid}")
def li_modifier(request, liste: str, lid: int, corps: dict = Body(...)):
    return li.enregistrer(u(request), liste, corps, lid)


@api.post("/listes/{liste}/{lid}/suppression")
def li_supprimer(request, liste: str, lid: int):
    return li.supprimer(u(request), liste, lid)


# ---------- Info de base > Budget : huit référentiels (S19) ----------
@api.get("/budget-referentiels/{page}")
def bu_lire(request, page: str):
    return bu.lire(u(request), page)


@api.post("/budget-referentiels/{page}")
def bu_creer(request, page: str, corps: dict = Body(...)):
    return bu.enregistrer(u(request), page, corps)


@api.post("/budget-referentiels/{page}/{lid}")
def bu_modifier(request, page: str, lid: int, corps: dict = Body(...)):
    return bu.enregistrer(u(request), page, corps, lid)


@api.post("/budget-referentiels/{page}/{lid}/suppression")
def bu_supprimer(request, page: str, lid: int):
    return bu.supprimer(u(request), page, lid)


# ---------- Info de base > Localisation (S20) ----------
@api.get("/localisation/{niveau}")
def lo_lire(request, niveau: str):
    return lo.lire(u(request), niveau)


@api.post("/localisation/{niveau}")
def lo_creer(request, niveau: str, corps: dict = Body(...)):
    return lo.enregistrer(u(request), niveau, corps)


@api.post("/localisation/{niveau}/{lid}")
def lo_modifier(request, niveau: str, lid: int, corps: dict = Body(...)):
    return lo.enregistrer(u(request), niveau, corps, lid)


@api.post("/localisation/{niveau}/{lid}/suppression")
def lo_supprimer(request, niveau: str, lid: int):
    return lo.supprimer(u(request), niveau, lid)


# ---------- Produits > Crédits > Général (S21) ----------
@api.get("/credit-referentiels/{page}")
def cr_lire(request, page: str):
    return cr.lire(u(request), page)


@api.post("/credit-referentiels/{page}")
def cr_creer(request, page: str, corps: dict = Body(...)):
    return cr.enregistrer(u(request), page, corps)


@api.post("/credit-referentiels/{page}/{lid}")
def cr_modifier(request, page: str, lid: int, corps: dict = Body(...)):
    return cr.enregistrer(u(request), page, corps, lid)


@api.post("/credit-referentiels/{page}/{lid}/suppression")
def cr_supprimer(request, page: str, lid: int):
    return cr.supprimer(u(request), page, lid)


@api.post("/credit-degres/ordres")
def cr_degres_ordres(request, corps: dict = Body(...)):
    return cr.enregistrer_ordres(u(request), corps)


# ---------- Paramétrage > Produit > Crédit > Ordre remboursement crédit (S22) ----------
@api.get("/ordres-remboursement")
def od_lire(request):
    return od.lire(u(request))


@api.post("/ordres-remboursement")
def od_creer(request, corps: dict = Body(...)):
    return od.enregistrer(u(request), corps)


@api.post("/ordres-remboursement/{oid}")
def od_modifier(request, oid: int, corps: dict = Body(...)):
    return od.enregistrer(u(request), corps, oid)


@api.post("/ordres-remboursement/{oid}/suppression")
def od_supprimer(request, oid: int):
    return od.supprimer(u(request), oid)


@api.get("/gestionnaires/{gid}/portefeuille")
def cr_portefeuille(request, gid: int):
    return cr.portefeuille(u(request), gid)


# ---------- Info de base : numérotation des clients (S15) ----------
@api.get("/numerotation-clients")
def nu_lire(request):
    return nu.lire(u(request))


@api.post("/numerotation-clients")
def nu_enregistrer(request, corps: dict = Body(...)):
    return nu.enregistrer(u(request), corps)


# ---------- Comptabilité > Plan des comptes (S102) ----------
@api.get("/plan-comptes")
def cp_lire(request):
    return cp.lire(u(request))


@api.post("/plan-comptes")
def cp_creer(request, corps: dict = Body(...)):
    return cp.enregistrer(u(request), corps)


@api.post("/plan-comptes/{numero}")
def cp_modifier(request, numero: str, corps: dict = Body(...)):
    return cp.enregistrer(u(request), corps, numero)


@api.post("/plan-comptes/{numero}/suppression")
def cp_supprimer(request, numero: str):
    return cp.supprimer(u(request), numero)


# ---------- Info de base : numéro de compte client (S17) ----------
@api.get("/numerotation-comptes")
def nu_lire_compte(request):
    return nu.lire_compte(u(request))


@api.post("/numerotation-comptes")
def nu_enregistrer_compte(request, corps: dict = Body(...)):
    return nu.enregistrer_compte(u(request), corps)
