"""API HTTP de Likelemba (Django Ninja). Une route par fonction de la façade web/src/donnees/api.ts, mêmes données.
Chaque route lit l'utilisateur de la session ; les droits sont vérifiés dans les services (exiger)."""
from django.conf import settings
from django.db import transaction
from django.http import HttpRequest
from ninja import Body, NinjaAPI

from . import frais as fr
from . import groupes as gs
from . import procurations as pr
from . import banques as bq
from . import banque_operations as bop
from . import plans_epargne as ple
from . import clotures as clo
from . import blocages as blo
from . import rapports_epargne as rep
from . import cheques_clients as chq
from . import chequiers as chqr
from . import emprunts as emp
from . import comptes_epargne as cep
from . import releves as rel
from . import atypiques as aty
from . import gel
from . import inactifs as ina
from . import registre_membres as rmb
from . import conditions_banque as cdb
from . import retenues as ret
from . import depots_terme as dat
from . import conformite as conf
from . import declarations_systematiques as dsy
from . import soupcons as sou
from . import cip
from . import plaintes
from . import guichets as gu
from . import exercices as ex
from . import listes as li
from . import budget as bu
from . import localisation as lo
from . import credit as cr
from . import ordres as od
from . import produits_credit as pc
from . import modeles_credit as mc
from . import produits_epargne as pe
from . import parametrage_epargne as pp
from . import journaux as jo
from . import ed_divers as ed
from . import societe as so
from . import agents as ag
from . import jours as jt
from . import devises as dv
from . import facture as fa
from . import profils as pf
from . import droits as dr
from . import comptes_utilisateurs as cu
from . import profils_utilisateurs as pu
from . import connexions as cx
from . import comptes as cp
from . import numerotation as nu
from . import services as s
from .bd import ErreurMetier
from .securite import adresse, controler_tentatives, noter

# Documentation technique de l'API : seulement en développement ; en ligne, elle décrirait toutes les routes à un attaquant (registre T25)
api = NinjaAPI(title="Dwacfina", version="0.1", urls_namespace="likelemba", docs_url="/docs" if settings.DEBUG else None,
               openapi_url="/openapi.json" if settings.DEBUG else None)

METHODES_SURES = {"GET", "HEAD", "OPTIONS"}


@api.exception_handler(ErreurMetier)
def refus(request, exc: ErreurMetier):
    # Le refus est rendu comme une réponse, l'exception ne sort pas de la vue : sans ceci, ATOMIC_REQUESTS validerait
    # ce qui a été écrit avant le refus. Un refus annule toute la requête (tout ou rien).
    transaction.set_rollback(True)
    if exc.statut == 403:                                            # refus de droit ou requête forgée : noté au journal de sécurité (registre T26)
        noter("acces_refuse", ip=adresse(request), utilisateur_id=request.session.get("utilisateur"), detail=f"{request.method} {request.path} : {exc.message}")
    return api.create_response(request, {"message": exc.message}, status=exc.statut)


def u(request: HttpRequest) -> dict:
    # Protection contre les requêtes forgées depuis un autre site : en-tête propre à l'application sur toute écriture
    if request.method not in METHODES_SURES and request.headers.get("X-Likelemba") != "1":
        raise ErreurMetier("Requête refusée.", 403)
    util = s.exiger(s.utilisateur_de_session(request.session.get("utilisateur"), request.session.get("jeton")))
    dr.verifier_route(util, request.method, request.path)      # droit de la tâche (registre S04-3)
    return util


# ---------- Session ----------
@api.post("/session")
def session_ouvrir(request, corps: dict = Body(...)):
    if request.headers.get("X-Likelemba") != "1":
        raise ErreurMetier("Requête refusée.", 403)
    login, ip = str(corps.get("login", ""))[:80].strip(), adresse(request)
    controler_tentatives(login, ip)                                  # registre T22 : blocage après des connexions refusées
    try:
        util = s.ouvrir_session(login, corps.get("motDePasse"), ip)
    except ErreurMetier as e:
        # seul un mauvais mot de passe compte pour le blocage ; « déjà connecté » ou un compte inactif sont notés à part
        noter("connexion_refusee" if "mot de passe incorrect" in e.message else "connexion_impossible", login, ip, detail=e.message)
        raise
    noter("connexion", login, ip, util["id"])
    request.session.cycle_key()
    request.session["utilisateur"] = util["id"]
    request.session["jeton"] = util.pop("jeton")
    return s.vue_utilisateur(util)


@api.delete("/session")
def session_fermer(request):
    s.fermer_session(request.session.get("utilisateur"), request.session.get("jeton"))
    request.session.flush()
    return None


@api.get("/session")
def session_courante(request):
    util = s.utilisateur_de_session(request.session.get("utilisateur"), request.session.get("jeton"))
    return s.vue_utilisateur(util) if util else None


@api.get("/session/mode")
def session_mode(request):
    return {"motDePasseRequis": not settings.SANS_MOT_DE_PASSE}


@api.get("/utilisateurs")
def utilisateurs(request):
    return s.utilisateurs(public=True)


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


@api.get("/caisses/{sid}/solde-comptable")
def caisse_solde_comptable(request, sid: int, devise: str):
    u(request)
    return s.solde_comptable_caisse(sid, devise)


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
    usager = u(request)
    comptes = s.comptes_du_tiers(tid)
    return s.masquer_soldes(comptes) if s.soldes_masques(usager) else comptes   # registre S10-1


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


@api.get("/tiers/{tid}/adhesion")
def tiers_adhesion(request, tid: int):
    u(request)
    return s.date_adhesion(tid)


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


@api.post("/guichet/ed-divers")
def guichet_ed_divers(request, corps: dict = Body(...)):
    from . import ed_guichet
    return ed_guichet.enregistrer(u(request), corps)


@api.get("/credit/deblocage")
def deblocage_liste(request):
    from . import deblocage as db
    return db.a_debloquer(u(request))


@api.get("/credit/deblocage/{cid}")
def deblocage_detail(request, cid: int):
    from . import deblocage as db
    return db.detail(u(request), cid)


@api.post("/credit/deblocage/{cid}/frais")
def deblocage_frais(request, cid: int):
    from . import deblocage as db
    return db.encaisser_frais(u(request), cid)


@api.post("/guichet/deblocage/{cid}")
def deblocage_caisse(request, cid: int, corps: dict = Body(...)):
    from . import deblocage as db
    return db.debloquer_caisse(u(request), cid, corps)


@api.post("/banque/deblocage/{cid}")
def deblocage_banque(request, cid: int, corps: dict = Body(...)):
    from . import deblocage as db
    return db.debloquer_banque(u(request), cid, corps)


@api.get("/credit/credits/{cid}/contrat")
def credit_contrat(request, cid: int):
    from . import deblocage as db
    return db.contrat(u(request), cid)


# ---------- S76 et S55 : remboursement de crédit, au guichet (p. 87 et 88) et par banque (p. 63) ----------
@api.get("/credit/remboursement/clients/{tid}")
def remboursement_credits_client(request, tid: int):
    from . import remboursements as rb
    return rb.credits_du_client(u(request), tid)


@api.get("/credit/remboursement/{cid}")
def remboursement_detail(request, cid: int, date: str = ""):
    from . import remboursements as rb
    return rb.detail(u(request), cid, date or None)


@api.post("/credit/remboursement/{cid}/repartition")
def remboursement_repartition(request, cid: int, corps: dict = Body(...)):
    from . import remboursements as rb
    return rb.proposer(u(request), cid, corps)


@api.post("/guichet/remboursement/{cid}")
def remboursement_caisse(request, cid: int, corps: dict = Body(...)):
    from . import remboursements as rb
    return rb.rembourser_caisse(u(request), cid, corps)


@api.post("/banque/remboursement/{cid}")
def remboursement_banque(request, cid: int, corps: dict = Body(...)):
    from . import remboursements as rb
    return rb.rembourser_banque(u(request), cid, corps)


@api.get("/credit/consultation/clients/{tid}")
def consultation_credits(request, tid: int):
    from . import remboursements as rb
    return rb.credits_du_client(u(request), tid)


@api.get("/credit/consultation/{cid}")
def consultation_credit(request, cid: int, date: str = ""):
    from . import remboursements as rb
    return rb.consultation(u(request), cid, date or None)


@api.get("/credit/credits/{cid}/situation")
def credit_situation(request, cid: int):
    from . import remboursements as rb
    return rb.situation(u(request), cid)


@api.get("/credit/credits/{cid}/memos")
def credit_memos(request, cid: int):
    from . import remboursements as rb
    return rb.memos(u(request), cid)


@api.post("/credit/credits/{cid}/memos")
def credit_memo(request, cid: int, corps: dict = Body(...)):
    from . import remboursements as rb
    return rb.ajouter_memo(u(request), cid, corps)


@api.get("/credit/etat")
def credit_etat(request):
    from . import etat_credit as ec
    g = request.GET
    n = lambda k: int(g[k]) if g.get(k, "").lstrip("-").isdigit() else None
    return ec.situation(u(request), {"mode": g.get("mode"), "du": g.get("du"), "au": g.get("au"), "date": g.get("date"), "produitId": n("produitId"),
                                      "niveau": g.get("niveau") or None, "agentId": n("agentId"), "operateur": g.get("operateur") or None, "montant": n("montant"),
                                      "archives": g.get("archives") == "1"})


# ---------- S94 : caution et nantissement (p. 116 à 118) ----------
@api.get("/credit/garanties/clients/{tid}")
def garanties_credits(request, tid: int):
    from . import garanties as g
    return g.credits(u(request), tid)


@api.get("/credit/garanties/{cid}")
def garanties_situation(request, cid: int, type: str = ""):
    from . import garanties as g
    return g.situation(u(request), cid, type)


@api.post("/credit/garanties/{cid}/ajout")
def garanties_ajout(request, cid: int, corps: dict = Body(...)):
    from . import garanties as g
    return g.ajouter(u(request), cid, corps)


@api.post("/credit/garanties/liberation/{gid}")
def garanties_liberation(request, gid: int, corps: dict = Body(...)):
    from . import garanties as g
    return g.liberer(u(request), gid, corps)


@api.get("/credit/garanties-rapport")
def garanties_rapport(request, type: str = "", du: str = "", au: str = ""):
    from . import garanties as g
    return g.rapport(u(request), type, du, au)


# ---------- S96 : affectation de dossier (p. 119) ----------
@api.get("/credit/affectation/contexte")
def affectation_contexte(request):
    from . import affectation as af
    return af.contexte(u(request))


@api.get("/credit/affectation/{agent}")
def affectation_portefeuille(request, agent: int):
    from . import affectation as af
    return af.portefeuille(u(request), agent)


@api.post("/credit/affectation")
def affectation_affecter(request, corps: dict = Body(...)):
    from . import affectation as af
    return af.affecter(u(request), corps)


# ---------- S97 : liste rouge (p. 119 et 120) ----------
@api.get("/credit/liste-rouge")
def liste_rouge_lister(request):
    from . import liste_rouge as lr
    return lr.lister(u(request))


@api.post("/credit/liste-rouge/ajout")
def liste_rouge_ajouter(request, corps: dict = Body(...)):
    from . import liste_rouge as lr
    return lr.ajouter(u(request), corps)


@api.post("/credit/liste-rouge/retrait")
def liste_rouge_retirer(request, corps: dict = Body(...)):
    from . import liste_rouge as lr
    return lr.retirer(u(request), corps)


# ---------- S98 : génération de balance âgée (p. 120) ----------
@api.post("/credit/balance-agee")
def balance_agee_lancer(request, corps: dict = Body(...)):
    from . import balance_agee as ba
    return ba.lancer(u(request), corps)


# ---------- S99 : déclassement provision et crédit (p. 121) ----------
@api.get("/credit/provisions")
def provisions_charger(request, date: str = ""):
    from . import provisions as pv
    return pv.charger(u(request), {"date": date})


@api.post("/credit/provisions/provisionner")
def provisions_provisionner(request, corps: dict = Body(...)):
    from . import provisions as pv
    return pv.provisionner(u(request), corps)


@api.post("/credit/provisions/tout")
def provisions_tout(request, corps: dict = Body(...)):
    from . import provisions as pv
    return pv.provisionner(u(request), corps, tout=True)


@api.post("/credit/provisions/radiation")
def provisions_radier(request, corps: dict = Body(...)):
    from . import provisions as pv
    return pv.radier(u(request), corps)


# ---------- S100 : engagement par signature (p. 121) ----------
@api.get("/credit/engagements")
def engagements_lister(request):
    from . import engagements as en
    return en.lister(u(request))


@api.get("/credit/engagements/contexte")
def engagements_contexte(request):
    from . import engagements as en
    return en.contexte(u(request))


@api.get("/credit/engagements/beneficiaire/{tid}")
def engagements_beneficiaire(request, tid: int):
    from . import engagements as en
    return en.beneficiaire(u(request), tid)


@api.post("/credit/engagements")
def engagements_enregistrer(request, corps: dict = Body(...)):
    from . import engagements as en
    return en.enregistrer(u(request), corps)


# ---------- S101 : rapports crédit (p. 121) ----------
@api.get("/credit/rapports/{nom}")
def rapports_credit(request, nom: str):
    from . import rapports_credit as rc
    p = {k: v for k, v in request.GET.items() if v != ""}
    for k in ("produitId", "agentId"):
        if k in p:
            p[k] = int(p[k]) if p[k].isdigit() else None
    return rc.rapport(u(request), nom, p)


# ---------- Écart E27 : prorogation et contentieux (Instr. BCC 003, art. 5, 8 et 12) ----------
@api.get("/credit/litigieux/clients/{tid}")
def litigieux_credits(request, tid: int):
    from . import litigieux as lt
    return lt.credits_du_client(u(request), tid)


@api.get("/credit/litigieux/{cid}")
def litigieux_situation(request, cid: int):
    from . import litigieux as lt
    return lt.situation(u(request), cid)


@api.post("/credit/litigieux/{cid}/prorogation")
def litigieux_proroger(request, cid: int, corps: dict = Body(...)):
    from . import litigieux as lt
    return lt.proroger(u(request), cid, corps)


@api.post("/credit/litigieux/{cid}/contentieux")
def litigieux_contentieux(request, cid: int, corps: dict = Body(...)):
    from . import litigieux as lt
    return lt.ouvrir_contentieux(u(request), cid, corps)


@api.post("/credit/litigieux/{cid}/cloture")
def litigieux_cloture(request, cid: int, corps: dict = Body(...)):
    from . import litigieux as lt
    return lt.clore_contentieux(u(request), cid, corps)


@api.post("/credit/engagements/{eid}/fin")
def engagements_finir(request, eid: int, corps: dict = Body(...)):
    from . import engagements as en
    return en.finir(u(request), eid, corps)


@api.get("/credit/visas/contexte")
def visas_contexte(request):
    from .services import est_coopec
    from .bd import lignes as lg
    x = u(request)
    return {"agents": lg("select id, nom from utilisateur where agence_id = %s and actif order by nom", (x["agence_id"],)), "coopec": est_coopec(x)}


@api.get("/credit/visas")
def visas_file(request, niveau: str, agentId: int | None = None):
    from . import visas_credit as vc
    return vc.a_viser(u(request), niveau, agentId)


@api.post("/credit/visas/{cid}/{niveau}")
def visa_donner(request, cid: int, niveau: str, corps: dict = Body(...)):
    from . import visas_credit as vc
    return vc.viser(u(request), cid, niveau, corps)


@api.get("/credit/visas-historique")
def visas_historique(request, niveau: str, avis: str, du: str, au: str):
    from . import visas_credit as vc
    return vc.historique(u(request), niveau, avis, du, au)


@api.get("/credit/valides-non-debloques")
def valides_non_debloques(request, du: str, au: str, agentId: int | None = None, archives: bool = False):
    from . import visas_credit as vc
    return vc.valides_non_debloques(u(request), du, au, agentId, archives)


@api.get("/credit/mise-en-place/contexte")
def mise_en_place_contexte(request):
    from . import mise_en_place as mp
    return mp.contexte(u(request))


@api.post("/credit/mise-en-place/{did}/apercu")
def mise_en_place_apercu(request, did: int, corps: dict = Body(...)):
    from . import mise_en_place as mp
    return mp.apercu(u(request), did, corps)


@api.post("/credit/mise-en-place/{did}")
def mise_en_place_enregistrer(request, did: int, corps: dict = Body(...)):
    from . import mise_en_place as mp
    return mp.mettre_en_place(u(request), did, corps)


@api.get("/credit/credits/{cid}")
def credit_lire(request, cid: int):
    from . import mise_en_place as mp
    return mp.lire(u(request), cid)


@api.get("/credit/dossiers/contexte")
def dossiers_contexte(request):
    from . import dossiers
    return dossiers.contexte(u(request))


@api.get("/credit/dossiers")
def dossiers_lister(request, statut: str):
    from . import dossiers
    return dossiers.lister(u(request), statut)


@api.post("/credit/dossiers")
def dossier_demander(request, corps: dict = Body(...)):
    from . import dossiers
    return dossiers.demander(u(request), corps)


@api.post("/credit/dossiers/{did}/controle")
def dossier_controler(request, did: int, corps: dict = Body(...)):
    from . import dossiers
    return dossiers.controler(u(request), did, corps)


@api.post("/credit/dossiers/{did}/approbation")
def dossier_approuver(request, did: int, corps: dict = Body(...)):
    from . import dossiers
    return dossiers.approuver(u(request), did, corps)


@api.get("/credit/fonds-propres")
def fonds_propres_lire(request):
    from . import dossiers
    u(request)
    return dossiers.fonds_propres(u(request))


@api.post("/credit/fonds-propres")
def fonds_propres_enregistrer(request, corps: dict = Body(...)):
    from . import dossiers
    return dossiers.enregistrer_fonds_propres(u(request), corps)


@api.get("/conformite/apparentes")
def apparentes_lister(request):
    from . import dossiers
    return dossiers.apparentes(u(request))


@api.post("/conformite/apparentes/{tid}")
def apparente_marquer(request, tid: int, corps: dict = Body(...)):
    from . import dossiers
    return dossiers.marquer_apparente(u(request), tid, corps)


@api.get("/credit/analyses")
def analyses_historique(request, tiersId: int):
    from . import analyses
    return analyses.historique(u(request), tiersId)


@api.get("/credit/analyses/{aid}")
def analyse_lire(request, aid: int):
    from . import analyses
    return analyses.lire(u(request), aid)


@api.post("/credit/analyses")
def analyse_enregistrer(request, corps: dict = Body(...)):
    from . import analyses
    return analyses.enregistrer(u(request), corps)


@api.post("/credit/simulation")
def credit_simulation(request, corps: dict = Body(...)):
    from . import simulation_credit
    return simulation_credit.simuler(u(request), corps)


@api.get("/caisse/journal/contexte")
def journal_caisse_contexte(request):
    from . import journal_caisse
    return journal_caisse.contexte(u(request))


@api.get("/caisse/journal")
def journal_caisse(request, guichetId: int, du: str, au: str):
    from . import journal_caisse as jc
    return jc.journal(u(request), guichetId, du, au)


@api.get("/caisse/transferts")
def transferts_contexte(request):
    from . import transferts
    return transferts.contexte(u(request))


@api.post("/caisse/transferts/caisse")
def transfert_caisse(request, corps: dict = Body(...)):
    from . import transferts
    return transferts.caisse_vers_caisse(u(request), corps)


@api.post("/caisse/transferts/banque")
def transfert_banque(request, corps: dict = Body(...)):
    from . import transferts
    return transferts.caisse_vers_banque(u(request), corps)


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


@api.get("/visas/retraits-plafond")
def visas_retraits_plafond(request):
    return s.retraits_plafond(u(request))


@api.post("/operations/{oid}/visa")
def operation_viser(request, oid: int):
    return s.viser_operation(u(request), oid)


@api.post("/operations/{oid}/refus")
def operation_refuser(request, oid: int):
    s.refuser_operation(u(request), oid)
    return None


# ---------- S105 : déblocage sur compte d'épargne (p. 124 et 157) ; S106 : remboursement par prélèvement (p. 125 et 157) ----------
@api.post("/comptabilite/deblocage/{cid}")
def deblocage_epargne(request, cid: int, corps: dict = Body(...)):
    from . import deblocage as db
    return db.debloquer_epargne(u(request), cid, corps)


@api.get("/credit/remboursement/comptes/{tid}")
def remboursement_comptes(request, tid: int):
    from . import remboursements as rb
    return rb.comptes_client(u(request), tid)


@api.post("/comptabilite/remboursement/{cid}")
def remboursement_epargne(request, cid: int, corps: dict = Body(...)):
    from . import remboursements as rb
    return rb.rembourser_epargne(u(request), cid, corps)


# ---------- S109 Saisie d'écriture, S116 Autres opérations, S117 Virements mensuels, S113 Visa, S114 Validation, S82 validation en caisse ----------
@api.get("/comptabilite/operations/contexte")
def operations_compta_contexte(request):
    from . import operations_compta as oc
    return oc.lire(u(request))


@api.get("/comptabilite/operations/comptes/{tid}")
def operations_compta_comptes(request, tid: int):
    from . import operations_compta as oc
    return oc.comptes_du_client(u(request), tid)


@api.get("/comptabilite/operations/compte")
def operations_compta_compte(request, numero: str = ""):
    from . import operations_compta as oc
    return oc.compte_par_numero(u(request), numero)


@api.post("/comptabilite/ecritures/ouverture")
def ecriture_ouvrir(request, corps: dict = Body(...)):
    from . import operations_compta as oc
    return oc.ecriture_ouvrir(u(request), corps)


@api.post("/comptabilite/ecritures/lignes")
def ecriture_ajouter(request, corps: dict = Body(...)):
    from . import operations_compta as oc
    return oc.ecriture_ajouter(u(request), corps)


@api.post("/comptabilite/ecritures/{oid}/lignes/{rang}/suppression")
def ecriture_supprimer(request, oid: int, rang: int):
    from . import operations_compta as oc
    return oc.ecriture_supprimer(u(request), oid, rang)


@api.post("/comptabilite/operations/virement")
def operation_virement(request, corps: dict = Body(...)):
    from . import operations_compta as oc
    return oc.enregistrer_virement(u(request), corps)


@api.post("/comptabilite/operations/compte-a-compte")
def operation_compte_a_compte(request, corps: dict = Body(...)):
    from . import operations_compta as oc
    return oc.enregistrer_compte_a_compte(u(request), corps)


@api.post("/comptabilite/operations/diverse")
def operation_diverse(request, corps: dict = Body(...)):
    from . import operations_compta as oc
    return oc.enregistrer_diverse(u(request), corps)


@api.post("/comptabilite/operations/deplacee")
def operation_deplacee(request, corps: dict = Body(...)):
    from . import operations_compta as oc
    return oc.enregistrer_deplacee(u(request), corps)


@api.post("/comptabilite/operations/mensuel")
def operation_mensuel(request, corps: dict = Body(...)):
    from . import operations_compta as oc
    return oc.enregistrer_mensuel(u(request), corps)


@api.get("/comptabilite/operations/saisies/{type_}")
def operations_compta_saisies(request, type_: str):
    from . import operations_compta as oc
    return oc.saisies(u(request), type_)


@api.get("/comptabilite/operations/visas/{etape}/{liste}")
def operations_compta_visas(request, etape: str, liste: str):
    from . import operations_compta as oc
    return oc.lister(u(request), etape, liste)


@api.post("/comptabilite/operations/{oid}/visa")
def operation_compta_visa(request, oid: int):
    from . import operations_compta as oc
    return oc.faire_suivre(u(request), oid, "visa")


@api.post("/comptabilite/operations/{oid}/validation")
def operation_compta_validation(request, oid: int, corps: dict = Body(...)):
    from . import operations_compta as oc
    return oc.faire_suivre(u(request), oid, "validation", corps)


@api.get("/caisse/operations-compta/{type_}")
def caisse_operations_compta(request, type_: str):
    from . import operations_compta as oc
    return oc.a_payer(u(request), type_)


@api.post("/caisse/operations-compta/{oid}/validation")
def caisse_operation_compta_valider(request, oid: int, corps: dict = Body(...)):
    from . import operations_compta as oc
    return oc.payer(u(request), oid, corps)


# ---------- S107 Factures (p. 124 à 128, 147 à 153), S108 Déclaration de taxe (p. 128), S141 Règlement facture espèce ----------
@api.get("/comptabilite/etats-financiers/contexte")
def etats_financiers_contexte(request):
    from . import etats_financiers as ef
    return ef.contexte(u(request))


@api.get("/comptabilite/etats-financiers/{etat}")
def etats_financiers_etat(request, etat: str):
    from . import etats_financiers as ef
    f = {"bilan": ef.bilan, "hors-bilan": ef.hors_bilan, "resultat": ef.resultat, "annexe": ef.annexe}.get(etat)
    if not f:
        raise ErreurMetier("Etat inconnu.")
    return f(u(request), request.GET.dict())


@api.get("/comptabilite/indicateurs-financiers")
def indicateurs_financiers(request):
    from . import etats_financiers as ef
    return ef.indicateurs(u(request), request.GET.dict())


@api.get("/comptabilite/factures/contexte")
def factures_contexte(request):
    from . import factures_fournisseurs as ff
    return ff.contexte(u(request))


@api.post("/comptabilite/factures/commandes")
def factures_commande(request, corps: dict = Body(...)):
    from . import factures_fournisseurs as ff
    return ff.enregistrer_commande(u(request), corps)


@api.get("/comptabilite/factures/commandes")
def factures_commandes(request, statut: str = "saisie"):
    from . import factures_fournisseurs as ff
    return ff.commandes(u(request), statut)


@api.post("/comptabilite/factures/commandes/{cid}/validation")
def factures_commande_valider(request, cid: int):
    from . import factures_fournisseurs as ff
    return ff.valider_commande(u(request), cid)


@api.get("/comptabilite/factures/commandes/{cid}/bon")
def factures_bon(request, cid: int):
    from . import factures_fournisseurs as ff
    return ff.bon_de_commande(u(request), cid)


@api.get("/comptabilite/factures/fournisseurs/{fid}/commandes")
def factures_commandes_a_facturer(request, fid: int):
    from . import factures_fournisseurs as ff
    return ff.commandes_a_facturer(u(request), fid)


@api.get("/comptabilite/factures/fournisseurs/{fid}/factures")
def factures_a_regler(request, fid: int):
    from . import factures_fournisseurs as ff
    return ff.factures_a_regler(u(request), fid)


@api.post("/comptabilite/factures/apercu")
def factures_apercu(request, corps: dict = Body(...)):
    from . import factures_fournisseurs as ff
    return ff.apercu_facture(u(request), corps)


@api.post("/comptabilite/factures/enregistrement")
def factures_enregistrer(request, corps: dict = Body(...)):
    from . import factures_fournisseurs as ff
    return ff.enregistrer_facture(u(request), corps)


@api.get("/comptabilite/factures/{fid}/reglement-apercu")
def factures_reglement_apercu(request, fid: int, montant: int = 0):
    from . import factures_fournisseurs as ff
    return ff.apercu_reglement(u(request), fid, montant)


@api.post("/comptabilite/factures/reglements")
def factures_reglement(request, corps: dict = Body(...)):
    from . import factures_fournisseurs as ff
    return ff.enregistrer_reglement(u(request), corps)


@api.get("/comptabilite/factures/reglements/{rid}/fiche")
def factures_fiche_imputation(request, rid: int):
    from . import factures_fournisseurs as ff
    return ff.fiche_imputation(u(request), rid)


@api.get("/comptabilite/factures/visas/{etape}/{quoi}")
def factures_visas(request, etape: str, quoi: str):
    from . import factures_fournisseurs as ff
    return ff.lister(u(request), etape, quoi)


@api.post("/comptabilite/factures/{quoi}/{oid}/visa")
def factures_viser(request, quoi: str, oid: int):
    from . import factures_fournisseurs as ff
    return ff.faire_suivre(u(request), quoi, oid, "visa")


@api.post("/comptabilite/factures/{quoi}/{oid}/validation")
def factures_valider(request, quoi: str, oid: int, corps: dict = Body(...)):
    from . import factures_fournisseurs as ff
    return ff.faire_suivre(u(request), quoi, oid, "validation", corps)


@api.get("/comptabilite/factures/rapport")
def factures_rapport(request):
    from . import factures_fournisseurs as ff
    return ff.rapport(u(request), request.GET.dict())


@api.get("/comptabilite/declaration-taxes")
def declaration_taxes(request):
    from . import factures_fournisseurs as ff
    return ff.declaration_taxes(u(request), request.GET.dict())


@api.get("/caisse/reglements-factures")
def caisse_reglements_factures(request):
    from . import factures_fournisseurs as ff
    return ff.reglements_espece(u(request))


@api.post("/caisse/reglements-factures/{rid}/paiement")
def caisse_reglement_facture_payer(request, rid: int, corps: dict = Body(...)):
    from . import factures_fournisseurs as ff
    return ff.payer_reglement(u(request), rid, corps)


# ---------- S110 Rapprochement bancaire, S112 Historique, S119 Lettrage, S118 Contrôle, S143 Trésorerie, S142 Annulation de règlement de crédit ----------
@api.get("/comptabilite/rapprochement/contexte")
def rappro_contexte(request):
    from . import controles_compta as cc
    return cc.rappro_contexte(u(request))


@api.get("/comptabilite/rapprochement/journal")
def rappro_journal(request):
    from . import controles_compta as cc
    return cc.journal_banque(u(request), request.GET.dict())


@api.post("/comptabilite/rapprochement/etat")
def rappro_etat(request, corps: dict = Body(...)):
    from . import controles_compta as cc
    return cc.etat_rapprochement(u(request), corps)


@api.post("/comptabilite/rapprochement")
def rappro_enregistrer(request, corps: dict = Body(...)):
    from . import controles_compta as cc
    return cc.enregistrer_rapprochement(u(request), corps)


@api.post("/comptabilite/rapprochement/operation")
def rappro_operation(request, corps: dict = Body(...)):
    """Bouton Nouveau : une opération du relevé absente de nos livres se saisit comme une opération de banque (S52) ; elle suit sa chaîne de visa (S57)"""
    from . import banque_operations as bo
    return bo.enregistrer(u(request), corps)


@api.get("/comptabilite/rapprochement/historique")
def rappro_historique(request):
    from . import controles_compta as cc
    return cc.historique(u(request), request.GET.dict())


@api.get("/comptabilite/lettrage")
def lettrage_lignes(request):
    from . import controles_compta as cc
    return cc.lettrage_lignes(u(request), request.GET.dict())


@api.post("/comptabilite/lettrage")
def lettrage_lettrer(request, corps: dict = Body(...)):
    from . import controles_compta as cc
    return cc.lettrer(u(request), corps)


@api.get("/comptabilite/controle/tresorerie")
def controle_tresorerie(request):
    from . import controles_compta as cc
    return cc.tresorerie(u(request), request.GET.dict())


@api.get("/comptabilite/controle/annulations/contexte")
def controle_annulations_contexte(request):
    from . import controles_compta as cc
    return cc.annulations_contexte(u(request))


@api.get("/comptabilite/controle/annulations")
def controle_annulations(request):
    from . import controles_compta as cc
    return cc.annulations(u(request), request.GET.dict())


@api.get("/comptabilite/controle/revenus")
def controle_revenus(request):
    from . import controles_compta as cc
    return cc.revenus(u(request), request.GET.dict())


@api.get("/comptabilite/annulation-reglement")
def annulation_reglements(request):
    from . import controles_compta as cc
    return cc.reglements_annulables(u(request))


@api.post("/comptabilite/annulation-reglement/{rid}")
def annulation_reglement(request, rid: int):
    from . import controles_compta as cc
    return cc.annuler_reglement(u(request), rid)


# ---------- S115 : journaux comptables (p. 133) ----------
@api.get("/comptabilite/journaux-comptables/contexte")
def journaux_comptables_contexte(request):
    from . import etats_compta as ec
    return ec.journaux_contexte(u(request))


@api.get("/comptabilite/journaux-comptables")
def journaux_comptables(request):
    from . import etats_compta as ec
    return ec.journaux(u(request), request.GET.dict())


# ---------- S111 : comptabilisation de la journée (p. 130 et 155) ----------
@api.get("/comptabilite/comptabilisation/{jid}")
def comptabilisation_lire(request, jid: int):
    from . import comptabilisation as cp
    return cp.a_comptabiliser(u(request), jid)


@api.post("/comptabilite/comptabilisation/{jid}")
def comptabilisation_passer(request, jid: int):
    from . import comptabilisation as cp
    return cp.comptabiliser(u(request), jid)


# ---------- S120 grand livre et S121 balance, généraux et analytiques (p. 138 à 140) ----------
def _criteres(request) -> dict:
    return {k: v for k, v in request.GET.items() if v != ""}


@api.get("/comptabilite/etats/contexte")
def etats_compta_contexte(request):
    from . import etats_compta as ec
    return ec.contexte(u(request))


@api.get("/comptabilite/grand-livre")
def etats_grand_livre(request, analytique: bool = False):
    from . import etats_compta as ec
    return ec.grand_livre(u(request), _criteres(request), analytique)


@api.get("/comptabilite/balance")
def etats_balance_periode(request, analytique: bool = False):
    from . import etats_compta as ec
    return ec.balance(u(request), _criteres(request), analytique)


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


@api.post("/tiers/{tid}/deces")
def tiers_deces(request, tid: int, corps: dict = Body(...)):
    return pr.declarer_deces(u(request), tid, corps)


# ---------- Client : procurations (S47 ; confrontation du 21/11/2026, E2) ----------
@api.get("/procurations")
def proc_lister(request, tiers: int):
    return pr.lister_client(u(request), tiers)


@api.post("/procurations")
def proc_enregistrer(request, corps: dict = Body(...)):
    return pr.enregistrer(u(request), corps)


@api.post("/procurations/{pid}/fin")
def proc_fin(request, pid: int, corps: dict = Body(...)):
    return pr.mettre_fin(u(request), pid, corps)


@api.get("/guichet/procurations/{tid}")
def proc_en_cours(request, tid: int):
    return pr.en_cours(u(request), tid)


# ---------- Banque : création banque (S58) ----------
@api.get("/banque/operations")
def banque_operations_lire(request):
    return bop.lire(u(request))


@api.post("/banque/operations")
def banque_operations_enregistrer(request, corps: dict = Body(...)):
    return bop.enregistrer(u(request), corps)


@api.post("/banque/virements")
def banque_virements_enregistrer(request, corps: dict = Body(...)):
    return bop.enregistrer(u(request), corps, client=True)


@api.get("/banque/visas")
def banque_visas(request, etape: str, liste: str):
    return bop.lister_visas(u(request), etape, liste)


@api.post("/banque/visas/{oid}/{etape}")
def banque_visa_faire(request, oid: int, etape: str, corps: dict = Body(default={})):
    return bop.faire_suivre(u(request), oid, etape, corps)


@api.get("/banque/cheques")
def banque_cheques(request, compteBancaireId: int, statut: str = ""):
    return chq.lister(u(request), compteBancaireId, statut)


@api.post("/banque/cheques")
def banque_cheque_deposer(request, corps: dict = Body(...)):
    return chq.deposer(u(request), corps)


@api.post("/banque/cheques/{cid}/{action}")
def banque_cheque_traiter(request, cid: int, action: str, corps: dict = Body(default={})):
    if action not in ("encaisser", "retourner"):
        raise ErreurMetier("Action inconnue.")
    return chq.traiter(u(request), cid, action, corps)


@api.post("/banque/chequiers")
def banque_chequier_generer(request, corps: dict = Body(...)):
    return chqr.generer(u(request), corps)


@api.get("/banque/emprunts")
def banque_emprunt_lire(request, numero: int):
    return emp.lire(u(request), numero)


@api.post("/banque/emprunts")
def banque_emprunt_mettre_en_place(request, corps: dict = Body(...)):
    return emp.mettre_en_place(u(request), corps)


@api.post("/banque/emprunts/{eid}/remboursements")
def banque_emprunt_rembourser(request, eid: int, corps: dict = Body(...)):
    return emp.rembourser(u(request), eid, corps)


@api.get("/banque/rapport/contexte")
def banque_rapport_contexte(request):
    return bop.rapport_contexte(u(request))


@api.get("/banque/rapport")
def banque_rapport(request, du: str, au: str, banqueId: int, compteBancaireId: int | None = None, agenceId: int | None = None):
    return bop.rapport(u(request), du, au, banqueId, compteBancaireId, agenceId)


@api.get("/epargne/comptes/produits")
def epargne_produits(request):
    return cep.produits(u(request))


@api.get("/epargne/comptes/{cid}/convention")
def epargne_compte_convention(request, cid: int):
    return cep.convention(u(request), cid)


@api.get("/epargne/comptes/apercu")
def epargne_compte_apercu(request, tiersId: int, produitId: int):
    return cep.apercu(u(request), tiersId, produitId)


@api.post("/epargne/comptes")
def epargne_compte_ouvrir(request, corps: dict = Body(...)):
    return cep.ouvrir(u(request), corps)


@api.get("/epargne/releve")
def epargne_releve(request, compteId: int, du: str, au: str):
    return rel.releve(u(request), compteId, du, au)


@api.post("/epargne/releve/edition")
def epargne_releve_edition(request, corps: dict = Body(...)):
    return rel.editer(u(request), corps.get("compteId"), corps.get("du", ""), corps.get("au", ""))


@api.get("/epargne/situation")
def epargne_situation(request, tiersId: int, date: str):
    return rel.situation(u(request), tiersId, date)


@api.get("/epargne/dat/produits")
def epargne_dat_produits(request):
    return dat.produits(u(request))


@api.get("/epargne/dat")
def epargne_dat_liste(request, statut: str = ""):
    return dat.liste(u(request), statut)


@api.post("/epargne/dat")
def epargne_dat_mettre_en_place(request, corps: dict = Body(...)):
    return dat.mettre_en_place(u(request), corps)


@api.get("/epargne/dat/recherche")
def epargne_dat_recherche(request, choix: str = "", du: str = "", au: str = ""):
    return dat.recherche(u(request), choix, du, au)


@api.get("/epargne/dat/{did}/contrat")
def epargne_dat_contrat(request, did: int):
    return dat.contrat(u(request), did)


@api.post("/epargne/dat/{did}/validation")
def epargne_dat_valider(request, did: int):
    return dat.valider(u(request), did)


@api.post("/epargne/dat/{did}/annulation")
def epargne_dat_annuler(request, did: int):
    return dat.annuler(u(request), did)


@api.get("/epargne/dat/{did}/rupture")
def epargne_dat_apercu_rupture(request, did: int, date: str = ""):
    return dat.apercu_rupture(u(request), did, date)


@api.post("/epargne/dat/{did}/rupture")
def epargne_dat_rompre(request, did: int, corps: dict = Body(...)):
    return dat.rompre(u(request), did, corps)


# ---------- S69 : Épargne > Plan Epargne (manuel p. 78 à 80) ----------
@api.get("/epargne/plans/contexte")
def epargne_plans_contexte(request):
    return ple.contexte(u(request))


@api.post("/epargne/plans/simulation")
def epargne_plans_simuler(request, corps: dict = Body(...)):
    return ple.simuler(u(request), corps)


@api.get("/epargne/plans")
def epargne_plans_liste(request, tiersId: int):
    return ple.plans(u(request), tiersId)


@api.post("/epargne/plans")
def epargne_plans_creer(request, corps: dict = Body(...)):
    return ple.creer(u(request), corps)


@api.get("/epargne/plans/{pid}/tableau")
def epargne_plans_tableau(request, pid: int, filtre: str = "toutes"):
    return ple.tableau(u(request), pid, filtre)


@api.post("/epargne/plans/{pid}/cotisations")
def epargne_plans_cotiser(request, pid: int, corps: dict = Body(...)):
    return ple.cotiser(u(request), pid, corps)


@api.get("/epargne/plans/{pid}/rupture")
def epargne_plans_apercu_rupture(request, pid: int):
    return ple.apercu_rupture(u(request), pid)


@api.post("/epargne/plans/{pid}/rupture")
def epargne_plans_rompre(request, pid: int, corps: dict = Body(...)):
    return ple.rompre(u(request), pid, corps)


# ---------- S70 : Épargne > Clôturer un Compte (manuel p. 80 ; écran complété) ----------
@api.post("/epargne/clotures")
def epargne_cloturer(request, corps: dict = Body(...)):
    return clo.cloturer(u(request), corps)


@api.post("/epargne/clotures/inactifs")
def epargne_cloturer_inactif(request, corps: dict = Body(...)):
    return clo.cloturer_inactif(u(request), corps)


@api.get("/epargne/clotures/avoirs")
def epargne_avoirs_prescription(request):
    return clo.avoirs(u(request))


@api.post("/epargne/clotures/versement-bcc")
def epargne_verser_bcc(request, corps: dict = Body(...)):
    return clo.verser_bcc(u(request), corps)


# ---------- S71 : Épargne > Blocage compte et montant (manuel p. 81) ----------
@api.get("/epargne/blocages")
def epargne_blocage_etat(request, compteId: int):
    return blo.etat(u(request), compteId)


@api.post("/epargne/blocages")
def epargne_bloquer(request, corps: dict = Body(...)):
    return blo.bloquer(u(request), corps)


@api.post("/epargne/blocages/{bid}/deblocage")
def epargne_debloquer(request, bid: int, corps: dict = Body(...)):
    return blo.debloquer(u(request), bid, corps)


# ---------- S72 : Épargne > Rapport (manuel p. 82 à 84) ----------
@api.get("/epargne/rapports/virements")
def epargne_rapport_virements(request, du: str = "", au: str = ""):
    return rep.virements(u(request), du, au)


@api.get("/epargne/rapports/garanties")
def epargne_rapport_garanties(request, du: str = "", au: str = "", produitId: int | None = None, agentId: int | None = None):
    return rep.garanties(u(request), du, au, produitId, agentId)


@api.get("/epargne/rapports/comptes")
def epargne_rapport_comptes(request, du: str = "", au: str = ""):
    return rep.comptes(u(request), du, au)


@api.get("/epargne/rapports/indicateurs")
def epargne_rapport_indicateurs(request, date: str = "", auxiliaires: bool = False):
    return rep.indicateurs(u(request), date, auxiliaires)


@api.get("/epargne/rapports/inactivite")
def epargne_rapport_inactivite(request, date: str = "", jours: int | None = None, tous: bool = False):
    return rep.inactivite(u(request), date, jours, tous)


@api.get("/banque/adhesions/apercu")
def banque_adhesion_apercu(request, tiersId: int, parts: int | None = None, depot: int = 0):
    return bop.apercu_adhesion(u(request), tiersId, parts, depot)


@api.post("/banque/adhesions")
def banque_adhesion_enregistrer(request, corps: dict = Body(...)):
    return bop.enregistrer_adhesion(u(request), corps)


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
# ---------- S124 Nouveau budget, S125 Consultation, suivi budgétaire et consommation par centre de coût ----------
@api.get("/budget/contexte")
def budget_contexte(request):
    from . import budgets
    return budgets.contexte(u(request))


@api.get("/budget/comptes")
def budget_comptes(request, typeId: int):
    from . import budgets
    return budgets.comptes_du_type(u(request), typeId)


@api.get("/budget/valeurs")
def budget_valeurs(request):
    from . import budgets
    return budgets.valeurs(u(request), request.GET.dict())


@api.post("/budget/valeurs")
def budget_ajouter(request, corps: dict = Body(...)):
    from . import budgets
    return budgets.ajouter(u(request), corps)


@api.post("/budget/valeurs/{vid}")
def budget_modifier(request, vid: int, corps: dict = Body(...)):
    from . import budgets
    return budgets.modifier(u(request), vid, corps)


@api.post("/budget/suppression")
def budget_supprimer(request, corps: dict = Body(...)):
    from . import budgets
    return budgets.supprimer(u(request), corps)


@api.post("/budget/reconduction")
def budget_reconduire(request, corps: dict = Body(...)):
    from . import budgets
    return budgets.reconduire(u(request), corps)


@api.get("/budget/suivi")
def budget_suivi(request):
    from . import budgets
    return budgets.suivi(u(request), request.GET.dict())


@api.get("/budget/consommation")
def budget_consommation(request):
    from . import budgets
    return budgets.consommation(u(request), request.GET.dict())


# ---------- S128 Autres > Calculs ; S127 Autres > Clôture (crédit, dépôt, comptabilité) ----------
@api.get("/autres/calculs/contexte")
def fin_contexte(request):
    from . import fin_periode
    return fin_periode.contexte(u(request))


@api.get("/autres/calculs/tenue")
def fin_tenue(request):
    from . import fin_periode
    return fin_periode.apercu_tenue(u(request), request.GET.dict())


@api.post("/autres/calculs/tenue")
def fin_tenue_passer(request, corps: dict = Body(...)):
    from . import fin_periode
    return fin_periode.passer_tenue(u(request), corps)


@api.get("/autres/calculs/interets-dav")
def fin_dav(request):
    from . import fin_periode
    return fin_periode.apercu_interets_dav(u(request), request.GET.dict())


@api.post("/autres/calculs/interets-dav")
def fin_dav_passer(request, corps: dict = Body(...)):
    from . import fin_periode
    return fin_periode.passer_interets_dav(u(request), corps)


@api.get("/autres/calculs/interets-dat")
def fin_dat(request):
    from . import fin_periode
    return fin_periode.apercu_interets_dat(u(request), request.GET.dict())


@api.post("/autres/calculs/interets-dat")
def fin_dat_passer(request, corps: dict = Body(...)):
    from . import fin_periode
    return fin_periode.passer_interets_dat(u(request), corps)


@api.post("/autres/calculs/interets-et-frais")
def fin_interets_et_frais(request, corps: dict = Body(...)):
    from . import fin_periode
    return fin_periode.interets_et_frais(u(request), corps)


@api.get("/autres/calculs/provisions")
def fin_provisions(request):
    from . import fin_periode
    return fin_periode.etat_provisions(u(request), request.GET.dict())


@api.get("/autres/cloture/affectation")
def affectation_apercu(request):
    from . import affectation_resultat
    return affectation_resultat.apercu(u(request), request.GET.dict())


@api.post("/autres/cloture/affectation")
def affectation_passer(request, corps: dict = Body(...)):
    from . import affectation_resultat
    return affectation_resultat.affecter(u(request), corps)


@api.get("/autres/cloture/contexte")
def fin_cloture_contexte(request):
    from . import fin_periode
    return fin_periode.contexte(u(request))


@api.get("/autres/cloture/provisions")
def fin_cloture_provisions(request):
    from . import fin_periode
    return fin_periode.etat_provisions(u(request), request.GET.dict())


@api.get("/autres/cloture/depot")
def fin_cloture_depot(request):
    from . import fin_periode
    return fin_periode.apercu_interets_dat(u(request), request.GET.dict())


@api.get("/autres/cloture/comptabilite")
def fin_cloture(request):
    from . import fin_periode
    return fin_periode.apercu_cloture(u(request), request.GET.dict())


@api.post("/autres/cloture/mois")
def fin_cloturer_mois(request, corps: dict = Body(...)):
    from . import fin_periode
    return fin_periode.cloturer_mois(u(request), corps)


@api.post("/autres/cloture/exercice")
def fin_cloturer(request, corps: dict = Body(...)):
    from . import fin_periode
    return fin_periode.cloturer(u(request), corps)


# ---------- Paie : S133 Nouvel employé, S134 Maquette et liste des employés, S135 Retenues ----------
@api.get("/paie/contexte")
def paie_contexte(request):
    from . import paie
    return paie.contexte(u(request))


@api.get("/paie/employes")
def paie_employes(request):
    from . import paie
    return paie.liste(u(request), request.GET.dict())


@api.post("/paie/employes")
def paie_creer(request, corps: dict = Body(...)):
    from . import paie
    return paie.enregistrer(u(request), corps)


@api.get("/paie/employes/{eid}")
def paie_fiche(request, eid: int):
    from . import paie
    return paie.fiche(u(request), eid)


@api.post("/paie/employes/{eid}")
def paie_modifier(request, eid: int, corps: dict = Body(...)):
    from . import paie
    return paie.enregistrer(u(request), corps, eid)


@api.get("/paie/maquette")
def paie_maquette(request, employeId: int):
    from . import paie
    return paie.maquette(u(request), employeId)


@api.post("/paie/maquette")
def paie_maquette_ajouter(request, corps: dict = Body(...)):
    from . import paie
    return paie.ajouter_maquette(u(request), corps)


@api.post("/paie/maquette/{mid}/suppression")
def paie_maquette_retirer(request, mid: int):
    from . import paie
    return paie.retirer_maquette(u(request), mid)


@api.get("/paie/retenues")
def paie_retenues(request):
    from . import paie
    return paie.retenues(u(request), request.GET.dict())


@api.post("/paie/retenues")
def paie_retenue_creer(request, corps: dict = Body(...)):
    from . import paie
    return paie.mettre_en_place(u(request), corps)


@api.post("/paie/retenues/{rid}/visa")
def paie_retenue_viser(request, rid: int):
    from . import paie
    return paie.viser(u(request), rid)


# ---------- Immobilisations : S137 biens, S138 mouvements, S139 amortissement, inventaire, sortie, S140 rapports ----------
@api.get("/immobilisations/contexte")
def immo_0_contexte(request):
    from . import immobilisations as im
    return im.contexte(u(request))


@api.get("/immobilisations/biens")
def immo_1_liste(request):
    from . import immobilisations as im
    return im.liste(u(request), request.GET.dict())


@api.post("/immobilisations/biens")
def immo_2_enregistrer(request, corps: dict = Body(...)):
    from . import immobilisations as im
    return im.enregistrer(u(request), corps)


@api.get("/immobilisations/biens/{bid}")
def immo_3_fiche(request, bid: int):
    from . import immobilisations as im
    return im.fiche(u(request), bid)


@api.post("/immobilisations/biens/{bid}")
def immo_4_enregistrer(request, bid: int, corps: dict = Body(...)):
    from . import immobilisations as im
    return im.enregistrer(u(request), corps, bid)


@api.post("/immobilisations/biens/{bid}/suppression")
def immo_5_supprimer(request, bid: int):
    from . import immobilisations as im
    return im.supprimer(u(request), bid)


@api.get("/immobilisations/biens/{bid}/tableau")
def immo_6_tableau(request, bid: int):
    from . import immobilisations as im
    return im.tableau(u(request), bid)


@api.post("/immobilisations/affectation")
def immo_7_affecter(request, corps: dict = Body(...)):
    from . import immobilisations as im
    return im.affecter(u(request), corps)


@api.post("/immobilisations/transfert-bien")
def immo_8_transferer_bien(request, corps: dict = Body(...)):
    from . import immobilisations as im
    return im.transferer_bien(u(request), corps)


@api.post("/immobilisations/transfert-employe")
def immo_9_transferer_employe(request, corps: dict = Body(...)):
    from . import immobilisations as im
    return im.transferer_employe(u(request), corps)


@api.post("/immobilisations/liberation")
def immo_10_liberer(request, corps: dict = Body(...)):
    from . import immobilisations as im
    return im.liberer(u(request), corps)


@api.post("/immobilisations/amortissement")
def immo_11_amortir(request, corps: dict = Body(...)):
    from . import immobilisations as im
    return im.amortir(u(request), corps)


@api.post("/immobilisations/inventaire")
def immo_12_inventorier(request, corps: dict = Body(...)):
    from . import immobilisations as im
    return im.inventorier(u(request), corps)


@api.post("/immobilisations/sortie")
def immo_13_sortir(request, corps: dict = Body(...)):
    from . import immobilisations as im
    return im.sortir(u(request), corps)


@api.get("/immobilisations/rapports/biens")
def immo_14_rapport_biens(request):
    from . import immobilisations as im
    return im.rapport_biens(u(request), request.GET.dict())


@api.get("/immobilisations/rapports/inventaires")
def immo_15_rapport_inventaires(request):
    from . import immobilisations as im
    return im.rapport_inventaires(u(request), request.GET.dict())


@api.get("/immobilisations/rapports/simulation")
def immo_16_simuler(request):
    from . import immobilisations as im
    return im.simuler(u(request), request.GET.dict())


@api.get("/immobilisations/rapports/suivi")
def immo_17_suivi(request):
    from . import immobilisations as im
    return im.suivi(u(request), request.GET.dict())


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


# ---------- Référentiels partagés (replica/referentiels.json) : taxes (S104), tiers (S103), paie, immobilisations ----------
@api.get("/referentiels/{famille}/{page}")
def ref_lire(request, famille: str, page: str):
    from . import referentiels as rf
    return rf.lire(u(request), famille, page)


@api.post("/referentiels/{famille}/{page}")
def ref_creer(request, famille: str, page: str, corps: dict = Body(...)):
    from . import referentiels as rf
    return rf.enregistrer(u(request), famille, page, corps)


@api.post("/referentiels/{famille}/{page}/{lid}")
def ref_modifier(request, famille: str, page: str, lid: int, corps: dict = Body(...)):
    from . import referentiels as rf
    return rf.enregistrer(u(request), famille, page, corps, lid)


@api.post("/referentiels/{famille}/{page}/{lid}/suppression")
def ref_supprimer(request, famille: str, page: str, lid: int):
    from . import referentiels as rf
    return rf.supprimer(u(request), famille, page, lid)


# ---------- Info de base > Localisation (S20) ----------
@api.post("/adresse/quartiers")
def ad_quartier(request, corps: dict = Body(...)):
    from . import adresse
    return adresse.ajouter_quartier(u(request), corps)


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


# ---------- Paramétrage > Produit > Crédit > Produit crédit : création/modification (S23) ----------
@api.get("/produits-credit")
def pc_lire(request):
    return pc.lire(u(request))


@api.post("/produits-credit/activation")
def pc_activer(request, corps: dict = Body(...)):
    return pc.activer(u(request), corps)


@api.get("/produits-credit/{pid}")
def pc_lire_produit(request, pid: int):
    return pc.lire_produit(u(request), pid)


@api.post("/produits-credit")
def pc_creer(request, corps: dict = Body(...)):
    return pc.enregistrer(u(request), corps)


@api.post("/produits-credit/{pid}")
def pc_modifier(request, pid: int, corps: dict = Body(...)):
    return pc.enregistrer(u(request), corps, pid)


# ---------- Paramétrage > Produit > Epargne : gestion des produits épargnes (S27) ----------
@api.get("/produits-epargne")
def pe_lire(request):
    return pe.lire(u(request))


@api.post("/produits-epargne")
def pe_creer(request, corps: dict = Body(...)):
    return pe.enregistrer(u(request), corps)


@api.post("/produits-epargne/{pid}")
def pe_modifier(request, pid: int, corps: dict = Body(...)):
    return pe.enregistrer(u(request), corps, pid)


@api.post("/produits-epargne/{pid}/suppression")
def pe_supprimer(request, pid: int):
    return pe.supprimer(u(request), pid)


# ---------- Agence > Paramètre : gestionnaire, sensibilisateur, commercial (S33) ----------
@api.get("/agents/{role}")
def ag_lire(request, role: str):
    return ag.lire(u(request), role)


@api.post("/agents/{role}")
def ag_creer(request, role: str, corps: dict = Body(...)):
    return ag.enregistrer(u(request), role, corps)


@api.post("/agents/{role}/{aid}")
def ag_modifier(request, role: str, aid: int, corps: dict = Body(...)):
    return ag.enregistrer(u(request), role, corps, aid)


@api.post("/agents/{role}/{aid}/suppression")
def ag_supprimer(request, role: str, aid: int):
    return ag.supprimer(u(request), role, aid)


# ---------- Agence > Journée de travail et Jours fériés (S34) ----------
@api.get("/jours")
def jt_lire(request):
    return jt.lire(u(request))


@api.post("/jours/journees")
def jt_journees(request, corps: dict = Body(...)):
    return jt.enregistrer_journees(u(request), corps)


@api.post("/jours/feries")
def jt_feries(request, corps: dict = Body(...)):
    return jt.enregistrer_feries(u(request), corps)


# ---------- Préférences > Devise, Type sous, Sous (S35) ----------
@api.get("/devises")
def dv_lire(request):
    return dv.lire(u(request))


@api.post("/devises")
def dv_devise(request, corps: dict = Body(...)):
    return dv.enregistrer_devise(u(request), corps)


@api.post("/devises/{code}")
def dv_devise_modifier(request, code: str, corps: dict = Body(...)):
    return dv.enregistrer_devise(u(request), corps, code)


@api.post("/cours")
def dv_cours(request, corps: dict = Body(...)):
    return dv.enregistrer_cours(u(request), corps)


@api.post("/types-monnaie")
def dv_type(request, corps: dict = Body(...)):
    return dv.enregistrer_type(u(request), corps)


@api.post("/types-monnaie/{tid}")
def dv_type_modifier(request, tid: int, corps: dict = Body(...)):
    return dv.enregistrer_type(u(request), corps, tid)


@api.post("/monnaies")
def dv_monnaie(request, corps: dict = Body(...)):
    return dv.enregistrer_monnaie(u(request), corps)


@api.post("/monnaies/{devise}/{centiemes}")
def dv_monnaie_modifier(request, devise: str, centiemes: int, corps: dict = Body(...)):
    return dv.enregistrer_monnaie(u(request), corps, (devise, centiemes))


# ---------- Administration > Profil > Création modification (S03) ----------
@api.get("/profils")
def pf_lire(request):
    return pf.lire(u(request))


@api.post("/profils")
def pf_creer(request, corps: dict = Body(...)):
    return pf.enregistrer(u(request), corps)


@api.post("/profils/{pid}")
def pf_modifier(request, pid: int, corps: dict = Body(...)):
    return pf.enregistrer(u(request), corps, pid)


@api.post("/profils/{pid}/suppression")
def pf_supprimer(request, pid: int):
    return pf.supprimer(u(request), pid)


# ---------- Administration > Utilisateur > Création (S05) ----------
@api.get("/gestion-utilisateurs")
def cu_lire(request):
    return cu.lire(u(request))


@api.post("/gestion-utilisateurs")
def cu_creer(request, corps: dict = Body(...)):
    return cu.enregistrer(u(request), corps)


@api.post("/gestion-utilisateurs/{uid}")
def cu_modifier(request, uid: int, corps: dict = Body(...)):
    return cu.enregistrer(u(request), corps, uid)


# ---------- Administration > Utilisateur > Gestion des profils (S06) ----------
@api.get("/profils-utilisateurs")
def pu_lire(request, utilisateur: int | None = None):
    return pu.lire(u(request), utilisateur)


@api.post("/profils-utilisateurs")
def pu_enregistrer(request, corps: dict = Body(...)):
    return pu.enregistrer(u(request), corps)


# ---------- Administration > Utilisateur > Autres fonctions ; Déconnecter utilisateurs (S07) ----------
@api.get("/connexions")
def cx_lire(request):
    return cx.lire(u(request))


@api.post("/connexions/{uid}/deconnexion")
def cx_deconnecter(request, uid: int):
    return cx.deconnecter(u(request), uid)


# ---------- Administration > Profil > Assigner droit ; Modifier droit d'un profil (S04) ----------
@api.get("/droits")
def dr_lire(request, profil: int | None = None):
    return dr.lire(u(request), profil)


@api.post("/droits/{pid}")
def dr_enregistrer(request, pid: int, corps: dict = Body(...)):
    return dr.enregistrer(u(request), pid, corps)


# ---------- Facture : Elément Facture, Référence Commande (S36) ----------
@api.get("/facture")
def fa_lire(request):
    return fa.lire(u(request))


@api.post("/facture/elements")
def fa_element(request, corps: dict = Body(...)):
    return fa.enregistrer_element(u(request), corps)


@api.post("/facture/elements/{eid}")
def fa_element_modifier(request, eid: int, corps: dict = Body(...)):
    return fa.enregistrer_element(u(request), corps, eid)


@api.post("/facture/elements/{eid}/actif")
def fa_element_actif(request, eid: int, corps: dict = Body(...)):
    return fa.activer_element(u(request), eid, corps.get("actif"))


@api.post("/facture/elements/{eid}/suppression")
def fa_element_supprimer(request, eid: int):
    return fa.supprimer_element(u(request), eid)


@api.post("/facture/types")
def fa_type(request, corps: dict = Body(...)):
    return fa.enregistrer_type(u(request), corps)


@api.post("/facture/types/{tid}")
def fa_type_modifier(request, tid: int, corps: dict = Body(...)):
    return fa.enregistrer_type(u(request), corps, tid)


@api.post("/facture/types/{tid}/suppression")
def fa_type_supprimer(request, tid: int):
    return fa.supprimer_type(u(request), tid)


# ---------- Paramétrage > Info société (S32) ----------
@api.get("/societe")
def so_lire(request):
    return so.lire(u(request))


@api.post("/societe")
def so_enregistrer(request, corps: dict = Body(...)):
    return so.enregistrer(u(request), corps)


@api.post("/societe/agences")
def so_creer_agence(request, corps: dict = Body(...)):
    return so.enregistrer_agence(u(request), corps)


@api.post("/societe/agences/{aid}")
def so_modifier_agence(request, aid: int, corps: dict = Body(...)):
    return so.enregistrer_agence(u(request), corps, aid)


@api.post("/societe/agences/{aid}/suppression")
def so_supprimer_agence(request, aid: int):
    return so.supprimer_agence(u(request), aid)


# ---------- Comptabilité > ED DIVERS : paramétrage autres opérations (S31) ----------
@api.get("/operations-diverses")
def ed_lire(request):
    return ed.lire(u(request))


@api.post("/operations-diverses")
def ed_creer(request, corps: dict = Body(...)):
    return ed.enregistrer(u(request), corps)


@api.post("/operations-diverses/{oid}")
def ed_modifier(request, oid: int, corps: dict = Body(...)):
    return ed.enregistrer(u(request), corps, oid)


# ---------- Comptabilité > Journal (S30) ----------
@api.get("/journaux")
def jo_lire(request):
    return jo.lire(u(request))


@api.post("/journaux")
def jo_creer(request, corps: dict = Body(...)):
    return jo.enregistrer(u(request), corps)


@api.post("/journaux/{jid}")
def jo_modifier(request, jid: int, corps: dict = Body(...)):
    return jo.enregistrer(u(request), corps, jid)


@api.post("/journaux/{jid}/suppression")
def jo_supprimer(request, jid: int):
    return jo.supprimer(u(request), jid)


# ---------- Produits > Epargne > Paramétrage des produits (S28) ----------
@api.get("/parametrage-epargne")
def pp_lire(request):
    return pp.lire(u(request))


@api.post("/parametrage-epargne")
def pp_enregistrer(request, corps: dict = Body(...)):
    return pp.enregistrer(u(request), corps)


# ---------- Produits > Crédits > Modèle pour crédit (S26) ----------
@api.get("/modeles-credit")
def mc_lire(request):
    return mc.lire(u(request))


@api.get("/modeles-credit/{mid}")
def mc_lire_modele(request, mid: int):
    return mc.lire_modele(u(request), mid)


@api.post("/modeles-credit")
def mc_creer(request, corps: dict = Body(...)):
    return mc.enregistrer(u(request), corps)


@api.post("/modeles-credit/{mid}")
def mc_modifier(request, mid: int, corps: dict = Body(...)):
    return mc.enregistrer(u(request), corps, mid)


@api.post("/modeles-credit/{mid}/suppression")
def mc_supprimer(request, mid: int):
    return mc.supprimer(u(request), mid)


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
@api.get("/numerotation-pieces")
def nu_lire_piece(request):
    return nu.lire_piece(u(request))


@api.post("/numerotation-pieces")
def nu_enregistrer_piece(request, corps: dict = Body(...)):
    return nu.enregistrer_piece(u(request), corps)


@api.get("/numerotation-comptes")
def nu_lire_compte(request):
    return nu.lire_compte(u(request))


@api.post("/numerotation-comptes")
def nu_enregistrer_compte(request, corps: dict = Body(...)):
    return nu.enregistrer_compte(u(request), corps)


# ---------- Écart E01 : examen renforcé (loi 22/068, art. 23 ; Instr. BCC 15, art. 61 et 62 ; Instr. BCC 15 bis) ----------
@api.post("/conformite/examens")
def conformite_demander(request, corps: dict = Body(...)):
    return conf.demander(u(request), corps)


@api.get("/conformite/examens")
def conformite_lister(request, statut: str = ""):
    return conf.lister(u(request), statut)


@api.post("/conformite/examens/{eid}/examen")
def conformite_examiner(request, eid: int, corps: dict = Body(...)):
    return conf.examiner(u(request), eid, corps)


@api.post("/conformite/examens/{eid}/declaration")
def conformite_declarer(request, eid: int, corps: dict = Body(...)):
    return conf.declarer(u(request), eid, corps)


# ---------- Déclarations systématiques à la CENAREF (loi 22/068, art. 92 bis, al. 3 ; confrontation du 21/11/2026, E5) ----------
@api.get("/conformite/systematiques")
def conformite_systematiques(request, annee: int, mois: int):
    return dsy.etat(u(request), annee, mois)


@api.post("/conformite/systematiques/declarations")
def conformite_systematiques_declarer(request, corps: dict = Body(...)):
    return dsy.declarer(u(request), corps)


# ---------- Registre des déclarations de soupçon (loi 22/068, art. 92 à 94 ; confrontation du 21/11/2026, E6) ----------
@api.get("/conformite/soupcons")
def conformite_soupcons(request):
    return sou.lister(u(request))


@api.post("/conformite/soupcons")
def conformite_soupcon_enregistrer(request, corps: dict = Body(...)):
    return sou.enregistrer(u(request), corps)


@api.get("/conformite/attentes")
def conformite_attentes(request):
    return sou.attentes(u(request))


@api.post("/conformite/attentes")
def conformite_attente(request, corps: dict = Body(...)):
    return sou.mettre_en_attente(u(request), corps)


@api.post("/conformite/attentes/{aid}/levee")
def conformite_attente_levee(request, aid: int, corps: dict = Body(...)):
    return sou.lever_attente(u(request), aid, corps)


@api.post("/conformite/soupcons/{sid}/suivi")
def conformite_soupcon_suivre(request, sid: int, corps: dict = Body(...)):
    return sou.suivre(u(request), sid, corps)


@api.get("/conformite/ppe")
def conformite_ppe(request):
    return conf.ppe_lister(u(request))


@api.post("/conformite/ppe/{tid}")
def conformite_ppe_enregistrer(request, tid: int, corps: dict = Body(...)):
    return conf.ppe_enregistrer(u(request), tid, corps)


@api.post("/conformite/ppe/{tid}/information")
def conformite_ppe_informer(request, tid: int, corps: dict = Body(...)):
    return conf.ppe_informer(u(request), tid, corps)


@api.get("/conformite/atypiques/criteres")
def atypiques_criteres(request):
    return aty.criteres(u(request))


@api.post("/conformite/atypiques/criteres")
def atypiques_fixer(request, corps: dict = Body(...)):
    return aty.fixer_criteres(u(request), corps)


@api.get("/conformite/atypiques")
def atypiques_alertes(request, du: str = "", au: str = "", statut: str = "a_analyser"):
    return aty.alertes(u(request), du, au, statut)


@api.post("/conformite/atypiques/analyses")
def atypiques_analyser(request, corps: dict = Body(...)):
    return aty.analyser(u(request), corps)


@api.post("/conformite/atypiques/declarations")
def atypiques_declarer(request, corps: dict = Body(...)):
    return aty.declarer(u(request), corps)


@api.get("/conformite/atypiques/rapport")
def atypiques_rapport(request, du: str = "", au: str = ""):
    return aty.rapport(u(request), du, au)


@api.get("/conformite/gels")
def gels_lister(request, statut: str = "actifs"):
    return gel.lister(u(request), statut)


@api.post("/conformite/gels")
def gels_geler(request, corps: dict = Body(...)):
    return gel.geler(u(request), corps)


@api.get("/conformite/reporting-mensuel")
def reporting_lcb_lire(request, annee: int, mois: int):
    from . import reporting_lcb
    return reporting_lcb.lire(u(request), annee, mois)


@api.post("/conformite/reporting-mensuel")
def reporting_lcb_enregistrer(request, corps: dict = Body(...)):
    from . import reporting_lcb
    return reporting_lcb.enregistrer(u(request), corps)


@api.get("/conformite/listes-gel")
def listes_gel(request):
    return gel.listes(u(request))


@api.post("/conformite/listes-gel")
def listes_gel_importer(request, corps: dict = Body(...)):
    return gel.importer_liste(u(request), corps)


@api.post("/conformite/listes-gel/rapprochement")
def listes_gel_rapprocher(request):
    from .services import exiger
    usr = u(request)
    exiger(usr)
    return {"correspondances": gel.rapprocher(usr)}


@api.post("/conformite/correspondances-gel/{cid}")
def correspondance_examiner(request, cid: int, corps: dict = Body(...)):
    return gel.examiner(u(request), cid, corps)


@api.post("/conformite/gels/{gid}/information")
def gels_informer(request, gid: int, corps: dict = Body(...)):
    return gel.informer(u(request), gid, corps)


@api.post("/conformite/gels/{gid}/levee")
def gels_lever(request, gid: int, corps: dict = Body(...)):
    return gel.lever(u(request), gid, corps)


@api.get("/epargne/inactifs")
def inactifs_lister(request, statut: str = ""):
    return ina.comptes(u(request), statut)


@api.post("/epargne/inactifs/{cid}/lettre")
def inactifs_lettre(request, cid: int, corps: dict = Body(...)):
    return ina.noter_lettre(u(request), cid, corps)


@api.get("/epargne/inactifs/{cid}/lettre")
def inactifs_lettre_imprimer(request, cid: int):
    return ina.lettre(u(request), cid)


@api.get("/clients/registre-membres")
def registre_membres(request):
    return rmb.membres(u(request))


@api.get("/parametrage/conditions-banque")
def conditions_banque(request):
    return cdb.etat(u(request))


@api.get("/comptabilite/retenues")
def retenues_etat(request, annee: str = "", mois: str = ""):
    return ret.etat(u(request), annee, mois)


@api.post("/comptabilite/retenues/reversements")
def retenues_reverser(request, corps: dict = Body(...)):
    return ret.reverser(u(request), corps)


@api.get("/securite/journal")
def securite_journal(request, du: str = "", au: str = "", evenement: str = ""):
    from .securite import consulter
    return consulter(u(request), du, au, evenement)


@api.get("/conformite/profils")
def conformite_profils(request, filtre: str = "echues"):
    return conf.profils_lister(u(request), filtre)


@api.post("/conformite/profils/{tid}")
def conformite_profil_evaluer(request, tid: int, corps: dict = Body(...)):
    return conf.profil_evaluer(u(request), tid, corps)


@api.get("/conformite/examens/{eid}/rapport")
def conformite_rapport(request, eid: int):
    return conf.rapport(u(request), eid)


# ---------- Écart E06 : Centrale des incidents de paiement (Instr. BCC 52, art. 10 à 15) ----------
# ---------- Écart E26 : Centrale des risques (Instr. BCC 05, annexe I) ----------
@api.get("/conformite/centrale-risques")
def centrale_risques(request, du: str = "", au: str = "", statut: str = ""):
    from . import centrale_risques as cr
    return cr.evenements(u(request), du, au, statut)


@api.post("/conformite/centrale-risques/declarations")
def centrale_risques_declarer(request, corps: dict = Body(...)):
    from . import centrale_risques as cr
    return cr.declarer(u(request), corps)


@api.get("/conformite/cip")
def cip_evenements(request, du: str = "", au: str = "", statut: str = ""):
    return cip.evenements(u(request), du, au, statut)


@api.post("/conformite/cip/declarations")
def cip_declarer(request, corps: dict = Body(...)):
    return cip.declarer(u(request), corps)


@api.post("/conformite/cip/icu/{tid}")
def cip_icu(request, tid: int, corps: dict = Body(...)):
    return cip.noter_icu(u(request), tid, corps)


# ---------- Écart E07 : plaintes (Instr. BCC 39) ----------
@api.post("/plaintes")
def plaintes_enregistrer(request, corps: dict = Body(...)):
    return plaintes.enregistrer(u(request), corps)


@api.get("/plaintes")
def plaintes_lister(request, statut: str = "", du: str = "", au: str = ""):
    return plaintes.lister(u(request), statut, du, au)


@api.post("/plaintes/{pid}/reponse")
def plaintes_repondre(request, pid: int, corps: dict = Body(...)):
    return plaintes.repondre(u(request), pid, corps)


@api.get("/plaintes/rapport")
def plaintes_rapport(request, du: str = "", au: str = ""):
    return plaintes.rapport(u(request), du, au)
