"""API HTTP de Likelemba (Django Ninja). Une route par fonction de la façade web/src/donnees/api.ts, mêmes données.
Chaque route lit l'utilisateur de la session ; les droits sont vérifiés dans les services (exiger)."""
from django.http import HttpRequest
from ninja import Body, NinjaAPI

from . import frais as fr
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
    return s.saisir_billetage(u(request), sid, corps["moment"], corps["devise"], corps.get("compte") or {}, corps.get("justification"))


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


@api.delete("/parametrage/frais-{genre}/{pid}")
def parametrage_supprimer(request, genre: str, pid: int):
    if genre not in TABLES:
        raise ErreurMetier("Introuvable.", 404)
    fr.supprimer_parametrage(u(request), TABLES[genre], pid)
    return None
