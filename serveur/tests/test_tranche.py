"""La tranche verticale par HTTP, comme les écrans l'appelleront. Mêmes scénarios que web/src/donnees/api.test.ts."""
import uuid

import pytest
from django.core.management import call_command
from django.test import Client

pytestmark = pytest.mark.django_db(transaction=False)
H = {"HTTP_X_LIKELEMBA": "1", "content_type": "application/json"}


@pytest.fixture(autouse=True)
def graine(django_db_setup, django_db_blocker):
    call_command("graine")


def connecter(c: Client, login: str):
    r = c.post("/api/session", {"login": login}, **H)
    assert r.status_code == 200, r.content


def cle():
    return str(uuid.uuid4())


def ident(sql, params=()):
    from noyau.bd import valeur
    return valeur(sql, params)


def G2():
    return ident("select id from guichet where code = 'G2'")


def C(numero):
    """Compte de dépôt par son numéro : 0412-000318-01 (Kalala, USD), -02 (CDF) ; 000319-01/02 (Mwamba) ; 000320-02 (Lukusa, sans specimen)"""
    return ident("select id from compte_depot where numero = %s", (numero,))


def T(numero):
    return ident("select id from tiers where numero = %s", (numero,))


@pytest.fixture
def clients():
    return {n: Client() for n in ("chef", "caisse", "agent", "compta")}


@pytest.fixture
def journee(clients):
    chef, caisse = clients["chef"], clients["caisse"]
    connecter(chef, "jpmukendi"); connecter(caisse, "engalula")
    connecter(clients["agent"], "bkasongo"); connecter(clients["compta"], "plumbala")
    j = chef.post("/api/journees", {"date": "2026-11-05"}, **H).json()
    s = caisse.post("/api/caisses", {"guichetId": G2()}, **H).json()
    return j, s


def balance_equilibree(c):
    b = c.get("/api/etats/balance").json()
    return sum(x["debitCdf"] for x in b) == sum(x["creditCdf"] for x in b)


def test_graine_equilibree(clients):
    connecter(clients["compta"], "plumbala")
    assert balance_equilibree(clients["compta"])


def test_sans_session_rien(clients):
    assert clients["caisse"].get("/api/etats/balance").status_code == 401
    assert clients["caisse"].get("/api/tiers?q=Kalala").status_code == 401


def test_ecriture_sans_entete_refusee(clients, journee):
    r = clients["caisse"].post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}, content_type="application/json")
    assert r.status_code == 403


def test_depot_retrait(clients, journee):
    caisse = clients["caisse"]
    _, s = journee
    assert caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 5000000, "coupures": {"20000": 2, "10000": 1}, "mandataire": ""}, **H).status_code == 200
    comptes = {c["id"]: c for c in caisse.get(f"/api/tiers/{T('0412-000318')}/comptes").json()}
    assert comptes[C("0412-000318-02")]["solde"] == 341250000 + 5000000
    r = caisse.post("/api/guichet/retraits", {"cle": cle(), "compteId": C("0412-000318-01"), "montant": 45000, "coupures": {"100": 4, "50": 1}}, **H)
    assert r.json()["statut"] == "validee", r.content
    assert caisse.get(f"/api/caisses/{s['id']}/theorique?devise=USD").json()["100"] == 136
    assert balance_equilibree(caisse)


def test_meme_cle_ne_paie_pas_deux_fois(clients, journee):
    caisse = clients["caisse"]
    p = {"cle": cle(), "compteId": C("0412-000318-01"), "montant": 10000, "coupures": {"100": 1}}
    a = caisse.post("/api/guichet/retraits", p, **H).json(); b = caisse.post("/api/guichet/retraits", p, **H).json()
    assert a["id"] == b["id"]
    assert len(caisse.get("/api/etats/journal").json()) == 2   # reprise des soldes + un seul retrait


def test_refus(clients, journee):
    caisse = clients["caisse"]
    def msg(route, corps):
        r = caisse.post(route, corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "solde disponible" in msg("/api/guichet/retraits", {"cle": cle(), "compteId": C("0412-000319-01"), "montant": 60000, "coupures": {"100": 6}})
    assert "billetage ne fait pas" in msg("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 30000, "coupures": {"20000": 1}, "mandataire": ""})


def test_depot_retrait_mandataire_motif(clients, journee):
    """S74 (manuel p. 86) : Mandataire et Motif ; pas de visa ni de cases à cocher, que Microfina++ ne montre pas"""
    caisse = clients["caisse"]
    d = caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 500000, "coupures": {"5000": 1},
                                            "mandataire": "Moi même", "motif": "ECOLAGE"}, **H).json()
    assert (d["statut"], d["remisPar"], d["motif"]) == ("validee", "Moi même", "ECOLAGE")
    r = caisse.post("/api/guichet/retraits", {"cle": cle(), "compteId": C("0412-000318-01"), "montant": 150000, "coupures": {"100": 15}, "motif": "Loyer"}, **H).json()
    assert (r["statut"], r["motif"]) == ("validee", "Loyer") and r["remisPar"]


# Fiche d'enrôlement S37 avec les valeurs par défaut de la p. 49
FICHE = {"dateDemande": "2026-11-05", "typeClient": "Client", "produitCode": "EAV-CDF", "premierDepot": 0, "resident": True, "preleverAgios": True,
         "calculerInteret": False, "liees": [], "personneExposee": False}


def test_enrolement(clients, journee):
    agent = clients["agent"]
    base = {**FICHE, "nom": "Tshala", "pieceType": "Passeport", "pieceNumero": "OP1"}
    def refus(corps):
        r = agent.post("/api/tiers", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "type de compte à créer" in refus({**base, "produitCode": ""})
    assert "Personne liée" in refus({**base, "liees": [999999]})
    assert "PNG ou JPEG" in refus({**base, "images": {"photo": "data:text/html;base64,AA=="}})
    assert "Premier dépôt" in refus({**base, "premierDepot": -5})
    assert "Sexe" in refus({**base, "sexe": "X"})
    r = agent.post("/api/tiers", {**base, "produitCode": "EAV-USD", "premierDepot": 2000, "resident": False, "liees": [T("0412-000318")], "sexe": "F", "telephone": "+243 810 000 000",
                                  "images": {"signature": "data:image/png;base64,iVBORw0KGgo="}}, **H)
    t = r.json()
    assert r.status_code == 200, r.content
    assert (t["sexe"], t["telephone"]) == ("F", "+243 810 000 000")
    assert (t["statut"], t["produitCode"], t["premierDepot"], t["resident"], t["liees"], t["specimen"], t["photo"]) == \
        ("a_viser", "EAV-USD", 2000, False, [T("0412-000318")], True, False)


def test_piece_admise(clients, journee):
    r = clients["agent"].post("/api/tiers", {**FICHE, "nom": "X", "pieceType": "Carte de membre", "pieceNumero": "1"}, **H)
    assert r.status_code == 422 and "art. 14" in r.json()["message"]


def test_enrolement_entreprise(clients, journee):
    agent = clients["agent"]
    sig = {"nom": "Ilunga", "prenom": "Paul", "pieceType": "Passeport", "pieceNumero": "OP9", "signature": "data:image/png;base64,iVBORw0KGgo="}
    base = {**FICHE, "typeClient": "Entreprises privées", "zone": "Matete", "nom": "Boulangerie Kinsaku SARL", "formeJuridique": "SARL",
            "registre": "CD/KNG/RCCM/24-B-00001", "adresse": "Matete, avenue Kinsaku", "dirigeant": {**sig, "signature": None}, "signataires": [sig]}
    def refus(corps):
        r = agent.post("/api/tiers/entreprises", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "zone" in refus({**base, "zone": ""})
    assert "forme juridique" in refus({**base, "formeJuridique": ""})
    assert "Type inconnu" in refus({**base, "typeClient": "Client"})
    assert "Signataire 1 : à remplir : nom" in refus({**base, "signataires": [{**sig, "nom": ""}]})
    assert "Dirigeant" in refus({**base, "dirigeant": {**sig, "pieceType": "Badge"}})
    r = agent.post("/api/tiers/entreprises", base, **H)
    assert r.status_code == 200, r.content
    t = r.json()
    assert (t["type"], t["nom"], t["zone"], t["registre"], t["dirigeant"]["nom"], len(t["signataires"]), t["specimen"]) == \
        ("morale", "Boulangerie Kinsaku SARL", "Matete", "CD/KNG/RCCM/24-B-00001", "Ilunga", 1, True)
    assert any(x["id"] == t["id"] for x in agent.get("/api/tiers?q=boulangerie").json())
    assert ident("select agent_economique from tiers where id = %s", (t["id"],)) == "Entreprises privées"


def test_enrolement_groupe(clients, journee):
    agent = clients["agent"]
    mb = {"nom": "Mbuyi", "prenom": "Anne", "pieceType": "Carte d'électeur", "pieceNumero": "1-0412-7777", "signature": "data:image/png;base64,iVBORw0KGgo="}
    base = {**FICHE, "typeClient": "Association", "nom": "Mamans de Kinsaku", "adresse": "Matete, quartier Kinsaku", "nbHommes": 0, "nbFemmes": 12, "membres": [mb]}
    def refus(corps):
        r = agent.post("/api/tiers/groupes", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "type de groupe" in refus({**base, "typeClient": ""})
    assert "Type inconnu" in refus({**base, "typeClient": "Coopérative"})
    assert "Nombre" in refus({**base, "nbFemmes": -1})
    assert "Membre 1 : Type de pièce non admis" in refus({**base, "membres": [{**mb, "pieceType": "Badge"}]})
    r = agent.post("/api/tiers/groupes", base, **H)
    assert r.status_code == 200, r.content
    t = r.json()
    assert (t["type"], t["nom"], t["nbFemmes"], len(t["membres"]), t["membres"][0]["specimen"], t["statut"]) == ("groupe", "Mamans de Kinsaku", 12, 1, True, "a_viser")
    assert ident("select agent_economique from tiers where id = %s", (t["id"],)) == "Institutions sans but lucratif"


def test_visa_client(clients, journee):
    agent, chef = clients["agent"], clients["chef"]
    t = agent.post("/api/tiers", {**FICHE, "nom": "Tshala", "pieceType": "Passeport", "pieceNumero": "OP2", "premierDepot": 200000}, **H).json()
    def refus(corps):
        r = chef.post(f"/api/tiers/{t['id']}/visa", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "précède" in refus({"dateVisa": "2026-11-01"})
    assert "dépasser" in refus({"dateVisa": "2026-11-06"})
    assert "intitulé" in refus({"intitule": " "})
    r = chef.post(f"/api/tiers/{t['id']}/visa", {"dateVisa": "2026-11-05", "intitule": "TSHALA", "premierDepot": 300000}, **H)
    assert r.status_code == 200, r.content
    v = r.json()
    assert (v["statut"], v["dateVisa"], v["intitule"], v["premierDepot"]) == ("actif", "2026-11-05", "TSHALA", 300000)
    assert "pas en attente" in refus({})


def test_mise_a_jour_client(clients, journee):
    agent, caisse = clients["agent"], clients["caisse"]
    k = T("0412-000318")
    t = agent.get(f"/api/tiers/{k}").json()
    def refus(corps, tid=k):
        r = agent.post(f"/api/tiers/{tid}/modification", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "nom" in refus({**t, "nom": ""})
    assert "art. 14" in refus({**t, "pieceType": "Badge"})
    assert "propre personne liée" in refus({**t, "liees": [k]})
    r = agent.post(f"/api/tiers/{k}/modification", {**t, "telephone": "+243 990 000 001", "liees": [T("0412-000319")]}, **H)
    assert r.status_code == 200, r.content
    m = r.json()
    assert (m["statut"], m["telephone"], m["liees"]) == ("modifie_a_revalider", "+243 990 000 001", [T("0412-000319")])
    assert ident("select avant->>'telephone' from tiers_modification where tiers_id = %s", (k,)) == ""
    depot = lambda: caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}, **H)
    r = depot()
    assert r.status_code == 422 and "à valider" in r.json()["message"]
    # S42 : validation par le chef, autre que celui qui a modifié
    chef = clients["chef"]
    assert [x["id"] for x in chef.get("/api/tiers/a-revalider").json()] == [k]
    assert agent.post(f"/api/tiers/{k}/activation", **H).status_code == 403
    chef.post(f"/api/tiers/{T('0412-000319')}/modification", {**chef.get(f"/api/tiers/{T('0412-000319')}").json(), "telephone": "1"}, **H)
    r = chef.post(f"/api/tiers/{T('0412-000319')}/activation", **H)
    assert r.status_code == 422 and "Quatre yeux" in r.json()["message"]
    assert chef.post(f"/api/tiers/{k}/activation", **H).json()["statut"] == "actif"
    assert "n'attend pas" in chef.post(f"/api/tiers/{k}/activation", **H).json()["message"]
    assert depot().status_code == 200
    # S43 : informations initiales et actuelles
    h = chef.get(f"/api/tiers/{k}/modifications").json()
    assert (h[0]["avant"]["telephone"], h[0]["apres"]["telephone"], h[0]["validePar"] is not None) == ("", "+243 990 000 001", True)
    assert chef.get(f"/api/tiers/{k}/images").json() == {"photo": None, "signature": None}   # graine : pas d'image réelle


def test_adhesion_apres_visa(clients, journee):
    caisse, chef, agent = clients["caisse"], clients["chef"], clients["agent"]
    t = agent.post("/api/tiers", {**FICHE, "nom": "Tshala", "postnom": "Muana", "prenom": "Marie", "naissance": "1990-02-01", "pieceType": "Carte d'électeur",
                                  "pieceNumero": "1-0412-0999", "pieceExpire": "2031-01-01", "adresse": "Matete"}, **H).json()
    corps = {"cle": cle(), "tiersId": t["id"], "parts": 3, "depot": 0, "coupures": {"5000": 2, "1000": 2}}
    assert "visa" in caisse.post("/api/guichet/adhesions", corps, **H).json()["message"]
    assert agent.post(f"/api/tiers/{t['id']}/visa", **H).status_code == 403                 # l'agent n'est pas chef
    assert chef.post(f"/api/tiers/{t['id']}/visa", **H).status_code == 200
    # Frais d'adhésion paramétrés (S16) : le compte est contrôlé sur le plan dès le paramétrage (règle T16)
    f = chef.post("/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Droit d'entrée"}, **H).json()
    chef.post("/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "valeur": 200000, "compte": "728", "typesMembre": ["Physique"]}, **H)
    assert "billetage" in caisse.post("/api/guichet/adhesions", corps, **H).json()["message"]      # 12 000 de parts + 2 000 de frais
    assert caisse.post("/api/guichet/adhesions", {**corps, "coupures": {"5000": 2, "1000": 4}}, **H).status_code == 200
    assert caisse.get(f"/api/tiers/{t['id']}/parts").json() == 3
    assert [c["devise"] for c in caisse.get(f"/api/tiers/{t['id']}/comptes").json()] == ["CDF"]
    assert [c["numero"] for c in caisse.get(f"/api/tiers/{t['id']}/comptes").json()] == [f"{t['numero']}-02"]   # S17-6 : sans règle, suffixe du produit CDF
    assert ident("select sum(montant_devise) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero = '728'") == 200000
    assert balance_equilibree(caisse)


def test_fermeture(clients, journee):
    caisse, chef = clients["caisse"], clients["chef"]
    j, s = journee
    caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000319-02"), "montant": 2000000, "coupures": {"20000": 1}, "mandataire": ""}, **H)
    assert "caisses arrêtées" in chef.post(f"/api/journees/{j['id']}/fermeture", **H).json()["message"]
    for d in ("CDF", "USD"):
        th = caisse.get(f"/api/caisses/{s['id']}/theorique?devise={d}").json()
        caisse.post(f"/api/caisses/{s['id']}/billetages", {"devise": d, "compte": th}, **H)
    for b in chef.get("/api/billetages/a-valider").json():
        chef.post(f"/api/billetages/{b['id']}/validation", **H)
    assert chef.post(f"/api/journees/{j['id']}/fermeture", **H).json()["statut"] == "fermee"
    assert caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000319-02"), "montant": 2000000, "coupures": {"20000": 1}, "mandataire": ""}, **H).status_code == 422


def test_quatre_yeux_billetage(clients):
    chef, caisse = clients["chef"], clients["caisse"]
    connecter(chef, "jpmukendi"); connecter(caisse, "engalula")
    chef.post("/api/journees", {"date": "2026-11-05"}, **H)
    s = caisse.post("/api/caisses", {"guichetId": G2()}, **H).json()
    th = caisse.get(f"/api/caisses/{s['id']}/theorique?devise=CDF").json()
    b = caisse.post(f"/api/caisses/{s['id']}/billetages", {"devise": "CDF", "compte": th}, **H).json()
    assert caisse.post(f"/api/billetages/{b['id']}/validation", **H).status_code == 403


def test_grand_livre_immuable(clients, journee):
    from django.db import connection, DatabaseError
    with pytest.raises(DatabaseError, match="contre-passation"):
        with connection.cursor() as c:
            c.execute("update ecriture set libelle = 'x' where id = (select min(id) from ecriture)")


def test_billetage_valide_une_seule_fois(clients, journee):
    _, s = journee
    chef, caisse = clients["chef"], clients["caisse"]
    th = caisse.get(f"/api/caisses/{s['id']}/theorique?devise=CDF").json()
    b = caisse.post(f"/api/caisses/{s['id']}/billetages", {"devise": "CDF", "compte": th}, **H).json()
    assert chef.post(f"/api/billetages/{b['id']}/validation", **H).status_code == 200
    r = chef.post(f"/api/billetages/{b['id']}/validation", **H)
    assert r.status_code == 422 and "déjà validé" in r.json()["message"]


def test_parametrage_frais(clients):
    chef, agent = clients["chef"], clients["agent"]
    connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    def refus(c, route, corps, methode="post"):
        r = getattr(c, methode)(route, corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Instr. BCC 37" in refus(chef, "/api/parametrage/frais", {"typeOperation": "DEPOT", "libelle": "FRAIS VERSEMENT"})
    assert "Réservé" in refus(agent, "/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Droit d'entrée"})
    f = chef.post("/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Droit d'entrée"}, **H).json()
    assert "existe déjà" in refus(chef, "/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Droit d'entrée"})
    assert "Paramétrage frais Adhésion" in refus(chef, "/api/parametrage/frais-operation", {"fraisId": f["id"], "nature": "Montant", "sousTypes": ["Femme"]})
    assert "Compte" in refus(chef, "/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "valeur": 500000, "compte": "70A", "typesMembre": ["Physique"]})
    # Règle T16 : le compte de l'exemple du manuel (70291) n'est pas dans le plan de comptes ; S16-2 : un frais d'adhésion est un Montant
    assert "plan de comptes" in refus(chef, "/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "valeur": 500000, "compte": "70291", "typesMembre": ["Physique"]})
    assert "Montant" in refus(chef, "/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Taux", "valeur": 500, "compte": "727", "typesMembre": ["Physique"]})
    [pid] = chef.post("/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "valeur": 500000, "compte": "727", "typesMembre": ["Physique"]}, **H).json()
    assert "Déjà paramétré" in refus(chef, "/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "typesMembre": ["Physique"]})
    assert "paramétré" in chef.delete(f"/api/parametrage/frais/{f['id']}", **H).json()["message"]
    assert chef.post(f"/api/parametrage/frais-adhesion/{pid}", {"nature": "Montant", "valeur": 200000, "compte": "727"}, **H).status_code == 200
    lu = chef.get("/api/parametrage/frais").json()
    assert lu["adhesion"] == [{"id": pid, "fraisId": f["id"], "typeMembre": "Physique", "valeur": 200000, "compte": "727", "nature": "Montant"}]
    assert lu["compteAdhesion"] == "727" and "Femme" in lu["sousTypes"] and lu["natures"] == ["Montant", "Taux"]   # S16-4, S16-8, S16-2
    assert chef.get(f"/api/tiers/{T('0412-000318')}/frais").json() == [{"fraisId": f["id"], "libelle": "Droit d'entrée", "compte": "727", "montant": 200000}]
    # Modifier Catégorie (S16-6) : la ligne passe de Physique à Entreprise
    assert chef.post(f"/api/parametrage/frais-adhesion/{pid}/categorie", {"typeMembre": "Entreprise"}, **H).status_code == 200
    assert chef.get("/api/parametrage/frais").json()["adhesion"][0]["typeMembre"] == "Entreprise"
    chef.post(f"/api/parametrage/frais-adhesion/{pid}/categorie", {"typeMembre": "Physique"}, **H)
    # Frais d'opération au taux (S16-2) sur une part sociale (S16-1), sous type de Général (S16-8)
    fp = chef.post("/api/parametrage/frais", {"typeOperation": "PART_SOCIALE", "libelle": "Frais de part"}, **H).json()
    assert "Taux invalide" in refus(chef, "/api/parametrage/frais-operation", {"fraisId": fp["id"], "nature": "Taux", "valeur": 20000, "compte": "727", "sousTypes": ["Femme"]})
    [po] = chef.post("/api/parametrage/frais-operation", {"fraisId": fp["id"], "nature": "Taux", "valeur": 150, "compte": "727", "sousTypes": ["Femme"]}, **H).json()
    assert chef.get("/api/parametrage/frais").json()["operations"][0]["nature"] == "Taux"
    chef.delete(f"/api/parametrage/frais-operation/{po}", **H); chef.delete(f"/api/parametrage/frais/{fp['id']}", **H)
    # S41 : montant propre au client
    k = T("0412-000318")
    assert "Réservé" in refus(agent, f"/api/tiers/{k}/frais", {"frais": [{"fraisId": f["id"], "montant": 0}]})
    assert "Montant" in refus(chef, f"/api/tiers/{k}/frais", {"frais": [{"fraisId": f["id"], "montant": -1}]})
    assert "pas lié" in refus(chef, f"/api/tiers/{k}/frais", {"frais": [{"fraisId": 999999, "montant": 0}]})
    assert chef.post(f"/api/tiers/{k}/frais", {"frais": [{"fraisId": f["id"], "montant": 100000}]}, **H).json()[0]["montant"] == 100000
    assert chef.get(f"/api/tiers/{T('0412-000319')}/frais").json()[0]["montant"] == 200000
    assert chef.delete(f"/api/parametrage/frais-adhesion/{pid}", **H).status_code == 200
    assert chef.delete(f"/api/parametrage/frais/{f['id']}", **H).status_code == 200
    assert chef.get("/api/parametrage/frais").json()["frais"] == []


def test_groupe_solidaire(clients):
    agent = clients["agent"]
    connecter(agent, "bkasongo")
    def refus(route, corps, methode="post"):
        r = getattr(agent, methode)(route, corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    lu = agent.get("/api/groupes-solidaires").json()
    assert lu["codeSuivant"] == "GS/0412/000001" and lu["groupes"] == []
    assert "nom groupe" in refus("/api/groupes-solidaires", {"code": lu["codeSuivant"], "nom": ""})
    g = agent.post("/api/groupes-solidaires", {"code": lu["codeSuivant"], "nom": "Grp Kinsaku"}, **H).json()
    assert "existe déjà" in refus("/api/groupes-solidaires", {"code": lu["codeSuivant"], "nom": "Autre"})
    k, m = T("0412-000318"), T("0412-000319")
    lu = agent.post(f"/api/groupes-solidaires/{g['id']}/membres", {"tiersIds": [k, m]}, **H).json()
    assert [x["tiersId"] for x in lu["membres"]] == [k, m] and lu["groupes"][0]["agence"] == "Matete"
    assert "déjà membre" in refus(f"/api/groupes-solidaires/{g['id']}/membres", {"tiersIds": [k]})
    r = agent.delete(f"/api/groupes-solidaires/{g['id']}", **H); assert r.status_code == 422 and "membres" in r.json()["message"]
    agent.post(f"/api/groupes-solidaires/{g['id']}/retrait", {"tiersIds": [k, m]}, **H)
    assert agent.post(f"/api/groupes-solidaires/{g['id']}", {"code": "GS/0412/000009", "nom": "Grp Kinsaku 2"}, **H).json()["nom"] == "Grp Kinsaku 2"
    assert agent.delete(f"/api/groupes-solidaires/{g['id']}", **H).status_code == 200


def test_prospect(clients):
    agent = clients["agent"]
    connecter(agent, "bkasongo")
    p = {"nom": "Tshibangu", "prenom": "Anne", "naissance": "1995-03-01", "lieuNaissance": "Kinshasa", "sexe": "F", "profession": "Commerçant",
         "pays": "République démocratique du Congo", "ville": "Kinshasa", "quartier": "Kinsaku", "telephone": "+243 810 000 111"}
    def refus(corps, route="/api/prospects"):
        r = agent.post(route, corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "prénoms" in refus({**p, "prenom": ""})
    assert "quartier inconnu" in refus({**p, "quartier": "Gombe"})
    assert "Email" in refus({**p, "email": "pas-un-email"})
    assert "Profession" in refus({**p, "profession": "Astronaute"})
    t = agent.post("/api/prospects", p, **H).json()
    assert (t["statut"], t["quartier"], t["profession"]) == ("prospect", "Kinsaku", "Commerçant")
    chef = clients["chef"]; connecter(chef, "jpmukendi")               # un quartier ajouté dans Localisation (S20) est proposé aussitôt
    lemba = next(c for c in chef.get("/api/localisation/commune", **H).json()["lignes"] if c["nom"] == "Lemba")
    assert chef.post("/api/localisation/quartier", {"parentId": lemba["id"], "nom": "Quartier d'essai"}, **H).status_code == 200
    assert agent.post(f"/api/prospects/{t['id']}", {**p, "quartier": "Quartier d'essai"}, **H).json()["quartier"] == "Quartier d'essai"
    assert [x["id"] for x in agent.get("/api/prospects").json()] == [t["id"]]
    assert "introuvable" in refus(p, f"/api/prospects/{T('0412-000318')}")
    # « Choisir prospect » à l'enrôlement (S37, p. 49) : le prospect devient le client, même numéro
    fiche = {**FICHE, "dateDemande": "2026-11-07", "nom": "Tshibangu", "prenom": "Anne", "sexe": "F", "pieceType": "Passeport", "pieceNumero": "OP7"}
    assert "Prospect introuvable" in refus({**fiche, "prospectId": T("0412-000318")}, "/api/tiers")
    c = agent.post("/api/tiers", {**fiche, "prospectId": t["id"]}, **H).json()
    assert (c["id"], c["numero"], c["statut"], c["quartier"], c["profession"]) == (t["id"], t["numero"], "a_viser", "Quartier d'essai", "Commerçant")
    assert agent.get("/api/prospects").json() == []


def test_type_procuration(clients):
    agent = clients["agent"]
    connecter(agent, "bkasongo")
    assert agent.get("/api/types-procuration").json() == []
    r = agent.post("/api/types-procuration", {"libelle": " "}, **H); assert r.status_code == 422 and "libellé" in r.json()["message"]
    t = agent.post("/api/types-procuration", {"libelle": "Procuration générale"}, **H).json()
    r = agent.post("/api/types-procuration", {"libelle": "procuration générale"}, **H); assert r.status_code == 422 and "existe déjà" in r.json()["message"]
    assert [x["libelle"] for x in agent.get("/api/types-procuration").json()] == ["Procuration générale"]
    assert agent.delete(f"/api/types-procuration/{t['id']}", **H).status_code == 200
    assert agent.get("/api/types-procuration").json() == []


def test_motif_depart(clients):
    """S18 (p. 26) : Libelle Motif seul, unique, ordre de saisie ; la résiliation (S48) lit la même liste (registre S18-1, S18-2)"""
    chef = clients["chef"]; connecter(chef, "jpmukendi")
    l = chef.get("/api/listes/motif_depart", **H).json()
    assert l["lignes"][0]["libelle"] == "DEPART DU PAYS" and l["liste"]["sansCode"]
    def refus(corps):
        r = chef.post("/api/listes/motif_depart", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "Libelle Motif" in refus({"code": "", "libelle": ""})
    assert "existe déjà" in refus({"code": "", "libelle": "autres"})
    m = chef.post("/api/listes/motif_depart", {"code": "", "libelle": "Mutation professionnelle"}, **H).json()["lignes"][-1]
    r = chef.post(f"/api/listes/motif_depart/{m['id']}", {"code": "", "libelle": "Mutation"}, **H)
    assert r.status_code == 200, r.content
    assert r.json()["lignes"][-1] == {**m, "libelle": "Mutation"}
    assert "Mutation" in chef.get("/api/referentiel", **H).json()["motifsDepart"]
    assert chef.post(f"/api/listes/motif_depart/{m['id']}/suppression", {}, **H).status_code == 200
    assert "Mutation" not in chef.get("/api/referentiel", **H).json()["motifsDepart"]



def test_resiliation(clients, journee):
    chef, agent, caisse = clients["chef"], clients["agent"], clients["caisse"]
    k = T("0412-000320")
    def refus(c, corps, tid=k):
        r = c.post(f"/api/tiers/{tid}/resiliation", corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Réservé" in refus(agent, {"motif": "AUTRES"})
    assert "motif" in refus(chef, {"motif": ""})
    assert "Motif inconnu" in refus(chef, {"motif": "Fâché"})
    r = chef.post(f"/api/tiers/{k}/resiliation", {"motif": "Raisons personnelles"}, **H)
    assert r.status_code == 200, r.content
    v = r.json()
    assert (v["statut"], v["motifDepart"], v["resilieLe"]) == ("resilie", "Raisons personnelles", "2026-11-05")
    assert "déjà résilié" in refus(chef, {"motif": "AUTRES"})
    r = caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000320-02"), "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}, **H)
    assert r.status_code == 422 and "résilié" in r.json()["message"]


def test_photo_signature(clients):
    agent = clients["agent"]
    connecter(agent, "bkasongo")
    k = T("0412-000320")                      # Lukusa : sans specimen
    png = "data:image/png;base64,iVBORw0KGgo="
    def refus(corps):
        r = agent.post(f"/api/tiers/{k}/specimen", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "Aucune" in refus({})
    assert "PNG ou JPEG" in refus({"signature": "data:text/html;base64,AA=="})
    t = agent.post(f"/api/tiers/{k}/specimen", {"signature": png}, **H).json()
    assert (t["specimen"], t["photo"]) == (True, False)
    agent.post(f"/api/tiers/{k}/specimen", {"photo": png}, **H)
    assert agent.get(f"/api/tiers/{k}/images").json() == {"photo": png, "signature": png}
    assert ident("select depose_par from specimen where tiers_id = %s order by id desc limit 1", (k,)) == ident("select id from utilisateur where login = 'bkasongo'")


def test_consentement(clients):
    agent = clients["agent"]
    connecter(agent, "bkasongo")
    k = T("0412-000318")
    def refus(corps):
        r = agent.post(f"/api/tiers/{k}/consentements", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "code" in refus({"dateDebut": "2026-11-07"})
    assert "précède" in refus({"code": "CR-1", "dateDebut": "2026-11-07", "dateFin": "2026-11-01"})
    l = agent.post(f"/api/tiers/{k}/consentements", {"code": "CR-1", "dateDebut": "2026-11-07", "commentaire": "Signé à la demande de crédit"}, **H).json()
    assert [(x["code"], x["dateDebut"], x["dateFin"], x["commentaire"]) for x in l] == [("CR-1", "2026-11-07", "", "Signé à la demande de crédit")]
    assert agent.get(f"/api/tiers/{k}/consentements").json() == l


def test_rapports(clients):
    agent = clients["agent"]
    connecter(agent, "bkasongo")
    l = agent.get("/api/rapports/clients").json()
    assert [x["numero"] for x in l] == ["0412-000318", "0412-000319", "0412-000320"] and all(x["creeLe"] for x in l)
    assert agent.get("/api/rapports/modifications").json() == []


def test_parts_sociales(clients, journee):
    caisse, agent, chef = clients["caisse"], clients["agent"], clients["chef"]
    k, m = T("0412-000318"), T("0412-000319")                   # Kalala : 2 parts ; Mwamba : 1 part ; 4 000 CDF la part
    op = lambda corps: caisse.post("/api/guichet/parts", {"cle": cle(), **corps}, **H)
    def refus(corps):
        r = op(corps); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "art. 21" in refus({"tiersId": k, "sens": "achat", "nombre": 0, "coupures": {}})
    assert "billetage" in refus({"tiersId": k, "sens": "achat", "nombre": 1, "coupures": {"1000": 3}})
    assert op({"tiersId": k, "sens": "achat", "nombre": 1, "coupures": {"1000": 4}}).json()["statut"] == "validee"
    assert caisse.get(f"/api/tiers/{k}/parts").json() == 3
    assert "art. 22" in refus({"tiersId": m, "sens": "retrait", "nombre": 1, "coupures": {"1000": 4}})
    assert "ne détient que" in refus({"tiersId": k, "sens": "retrait", "nombre": 5, "coupures": {"1000": 20}})
    assert op({"tiersId": k, "sens": "retrait", "nombre": 2, "coupures": {"5000": 1, "1000": 3}}).json()["statut"] == "validee"
    assert caisse.get(f"/api/tiers/{k}/parts").json() == 1
    # Membre résilié : toutes ses parts lui sont rendues (apurement, art. 27)
    chef.post(f"/api/tiers/{m}/resiliation", {"motif": "AUTRES"}, **H)
    assert op({"tiersId": m, "sens": "retrait", "nombre": 1, "coupures": {"1000": 4}}).json()["statut"] == "validee"
    assert "résilié" in refus({"tiersId": m, "sens": "achat", "nombre": 1, "coupures": {"1000": 4}})
    # Compte de parts selon le type de client (PCCI, compte 103) : une entreprise en 1032
    e = agent.post("/api/tiers/entreprises", {**FICHE, "typeClient": "Entreprises privées", "zone": "Matete", "nom": "Boulangerie Kinsaku SARL",
        "formeJuridique": "SARL", "registre": "R1", "adresse": "Matete", "signataires": []}, **H).json()
    chef.post(f"/api/tiers/{e['id']}/visa", {}, **H)
    caisse.post("/api/guichet/adhesions", {"cle": cle(), "tiersId": e["id"], "parts": 1, "depot": 0, "compteUsd": False, "coupures": {"1000": 4}}, **H)
    assert ident("""select c.numero from ligne_ecriture l join compte c on c.id = l.compte_id where l.contrat_ref = %s""", (f"parts:{e['id']}",)) == "1032"
    assert balance_equilibree(caisse)


def test_banques(clients):
    chef, agent = clients["chef"], clients["agent"]
    connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    def refus(c, route, corps, methode="post"):
        r = getattr(c, methode)(route, corps, **H) if corps is not None else getattr(c, methode)(route, **H)
        assert r.status_code in (403, 422), r.content; return r.json()["message"]
    b = {"code": "RAW", "libelle": "Rawbank", "compteLiaison": "5601", "adresse": "Kinshasa, Gombe"}
    assert "Réservé" in refus(agent, "/api/banques", b)
    assert "compte liaison" in refus(chef, "/api/banques", {**b, "compteLiaison": ""})
    l = chef.post("/api/banques", b, **H).json()
    assert "existe déjà" in refus(chef, "/api/banques", b)
    bid = l["banques"][0]["id"]
    j = l["journaux"][0]["id"]
    c = {"banqueId": bid, "compte": "56010001", "numeroBancaire": "05100-01234567-89", "devise": "USD", "journalId": j, "contactNom": "Mutombo"}
    assert "NOSTRI" in refus(chef, "/api/banques/comptes", {**c, "compte": "5701"})
    assert "nom" in refus(chef, "/api/banques/comptes", {**c, "contactNom": ""})
    l = chef.post("/api/banques/comptes", c, **H).json()
    assert (l["comptes"][0]["libelle"], l["comptes"][0]["intitule"]) == ("Rawbank USD", "Banque et autres intermédiaires financiers")
    assert ident("select classe from compte where numero = '56010001'") == 5
    assert "déjà attribué" in refus(chef, "/api/banques/comptes", {**c, "numeroBancaire": "AUTRE"})
    assert "comptes de l'institution" in refus(chef, f"/api/banques/{bid}", None, "delete")
    cid = l["comptes"][0]["id"]
    assert chef.post(f"/api/banques/comptes/{cid}", {**c, "contactTelephone": "+243 810 000 222"}, **H).json()["comptes"][0]["contactTelephone"] == "+243 810 000 222"
    assert chef.delete(f"/api/banques/comptes/{cid}", **H).json()["comptes"] == []
    assert chef.delete(f"/api/banques/{bid}", **H).json()["banques"] == []


def test_arrete_de_caisse(clients, journee):
    """S79 (manuel p. 90 et 91) : pas de comptage à l'ouverture ; Solde Caisse = dernier arrêté validé + opérations du jour ;
    Bon de Caisse enregistré ; Enregistrer refait la saisie tant que le billetage n'est pas validé"""
    caisse = clients["caisse"]
    _, s = journee
    avant = caisse.get(f"/api/caisses/{s['id']}/theorique?devise=CDF").json()
    assert caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 1000000, "coupures": {"10000": 1}}, **H).status_code == 200
    apres = caisse.get(f"/api/caisses/{s['id']}/theorique?devise=CDF").json()
    assert apres.get("10000", 0) == avant.get("10000", 0) + 1
    b = caisse.post(f"/api/caisses/{s['id']}/billetages", {"devise": "CDF", "compte": {"10000": 1}, "bonCaisse": 500000}, **H).json()
    assert b["bonCaisse"] == 500000
    b2 = caisse.post(f"/api/caisses/{s['id']}/billetages", {"devise": "CDF", "compte": apres, "bonCaisse": 0}, **H).json()
    assert b2["id"] == b["id"] and b2["bonCaisse"] == 0


def test_guichets(clients):
    """S08 (p. 18) : champs obligatoires, code unique ; S09 (p. 19) : liste, ouverture d'un guichet actif, fermeture"""
    chef, caisse = clients["chef"], clients["caisse"]
    connecter(chef, "jpmukendi"); connecter(caisse, "engalula")
    chef.post("/api/journees", {"date": "2026-11-05"}, **H)
    l = chef.get("/api/guichets", **H).json()
    ag, jca = l["agences"][0]["id"], next(x["id"] for x in l["journaux"] if x["code"] == "CA")
    corps = {"agenceId": ag, "code": "G3", "designation": "Caisse 3", "typeGuichet": "SECONDAIRE", "journalId": jca, "maximumCaisse": 0, "maximumCaisseUsd": 0,
             "retraitPlafonne": 0, "retraitPlafonneUsd": 0, "compteGuichet": "570", "compteLiaison": "579", "billetage": False, "actif": False}
    assert [j["code"] for j in l["journaux"]] == ["CA"]                                     # registre S08-2
    assert "plan de comptes" in (lambda r: r.json()["message"])(chef.post("/api/guichets", {**corps, "compteSurplus": "5799"}, **H))   # règle T16
    def refus(c):
        r = chef.post("/api/guichets", c, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "désignation" in refus({**corps, "designation": ""})
    assert "chiffres" in refus({**corps, "compteSurplus": "57A"})
    assert caisse.post("/api/guichets", corps, **H).status_code == 403
    g3 = next(g for g in chef.post("/api/guichets", corps, **H).json()["guichets"] if g["code"] == "G3")
    assert (g3["typeGuichet"], g3["actif"], g3["ouvert"], g3["billetage"]) == ("SECONDAIRE", False, False, True)   # registre S08-6
    assert "existe déjà" in refus(corps)
    assert "(USD)" in refus({**corps, "code": "G4", "maximumCaisseUsd": None})                # registre S08-3
    m = next(g for g in chef.post(f"/api/guichets/{g3['id']}", {**corps, "designation": "Caisse trois", "maximumCaisseUsd": 500000}, **H).json()["guichets"]
             if g["id"] == g3["id"])
    assert (m["nom"], m["maximumCaisseUsd"]) == ("Caisse trois", 500000)                      # Modifier, registre S08-8
    assert "inactif" in caisse.post(f"/api/guichets/{g3['id']}/ouverture", **H).json()["message"]
    g2 = caisse.post(f"/api/guichets/{G2()}/ouverture", **H).json()
    g2 = next(g for g in g2["guichets"] if g["id"] == G2())
    assert g2["ouvert"] and g2["dateOuverture"] == "2026-11-05"
    r = caisse.post(f"/api/guichets/{G2()}/fermeture", **H)
    assert r.status_code == 422 and "billetage" in r.json()["message"]                      # registre S09-5
    sid = caisse.get("/api/caisses/moi", **H).json()["id"]
    for dv in ("CDF", "USD"):
        th = caisse.get(f"/api/caisses/{sid}/theorique?devise={dv}", **H).json()
        assert caisse.post(f"/api/caisses/{sid}/billetages", {"devise": dv, "compte": th, "bonCaisse": 0}, **H).status_code == 200
    assert caisse.post(f"/api/guichets/{G2()}/fermeture", **H).status_code == 200
    assert caisse.get("/api/caisses/moi", **H).json()["statut"] == "fermee"
    l = caisse.post(f"/api/guichets/{G2()}/ouverture", {}, **H).json()                       # registre S09-6 : réouverture
    assert next(g for g in l["guichets"] if g["id"] == G2())["ouvert"] and l["derniereJournee"] == "2026-11-05"
    assert caisse.post(f"/api/guichets/{G2()}/fermeture", **H).status_code == 200
    for b in chef.get("/api/billetages/a-valider", **H).json():
        chef.post(f"/api/billetages/{b['id']}/validation", **H)
    r = caisse.post(f"/api/guichets/{G2()}/ouverture", {}, **H)
    assert r.status_code == 422 and "validé" in r.json()["message"]
    r = caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 1000000, "coupures": {"10000": 1}}, **H)
    assert r.status_code == 422 and "Aucune caisse ouverte" in r.json()["message"]


def test_exercices(clients):
    """S11 (p. 20 et 21) : Nouvel Exercice (année obligatoire et unique, cases Actif, Ouvert, Validé), Ouverture d'un Exercice (journaux)"""
    chef, agent = clients["chef"], clients["agent"]
    connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/exercices", **H).json()
    assert [(e["annee"], e["ouvert"], e["valide"]) for e in l["exercices"]] == [(2025, True, True), (2026, True, False)] and l["enCours"] == 2026
    def refus(c):
        r = chef.post("/api/exercices", c, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "année" in refus({"annee": ""})
    assert "invalide" in refus({"annee": "20x7"})
    assert "existe déjà" in refus({"annee": "2026"})
    assert agent.post("/api/exercices", {"annee": "2027"}, **H).status_code == 403
    l = chef.post("/api/exercices", {"annee": "2027", "lignes": [{"annee": 2026, "actif": True, "ouvert": True, "valide": False}]}, **H).json()
    assert {"annee": 2027, "actif": False, "ouvert": False, "valide": False} in l["exercices"]
    assert "Un seul exercice actif" in refus({"lignes": [{"annee": 2027, "actif": True, "ouvert": False, "valide": False}]})            # registre S11-1
    assert "ne se rouvre pas" in refus({"lignes": [{"annee": 2025, "actif": False, "ouvert": True, "valide": False}]})          # registre S11-3
    r = chef.post("/api/journees", {"date": "2027-01-04"}, **H); assert r.status_code == 422 and "pas ouvert" in r.json()["message"]   # registre S11-2
    chef.post("/api/journees", {"date": "2026-11-05"}, **H)
    assert "journée ouverte" in refus({"lignes": [{"annee": 2026, "actif": True, "ouvert": True, "valide": True}]})
    l = chef.post("/api/exercices", {"lignes": [{"annee": 2026, "actif": False, "ouvert": True, "valide": False},
                                                {"annee": 2027, "actif": True, "ouvert": False, "valide": False}]}, **H).json()
    assert next(e for e in l["exercices"] if e["annee"] == 2027)["actif"] and l["enCours"] == 2027
    l = chef.post("/api/exercices/2027/ouverture", **H).json()
    assert len([d for d in l["details"] if d["annee"] == 2027]) == len(l["journaux"]) and l["enCours"] == 2027
    r = chef.post("/api/exercices/2027/ouverture", **H); assert r.status_code == 422 and "déjà ouvert" in r.json()["message"]
    # Compléter journal détail (registre S11-8) : un journal ajouté à l'exercice en cours
    jid = l["journaux"][0]["id"]
    chef.post("/api/exercices", {"annee": "2028", "lignes": [{"annee": 2027, "actif": False, "ouvert": True, "valide": False}]}, **H)
    l = chef.post("/api/exercices", {"lignes": [{"annee": 2028, "actif": True, "ouvert": True, "valide": False}]}, **H).json()
    assert l["enCours"] == 2028 and not [d for d in l["details"] if d["annee"] == 2028]
    r = chef.post("/api/exercices/completer", {"journalIds": []}, **H); assert r.status_code == 422
    l = chef.post("/api/exercices/completer", {"journalIds": [jid]}, **H).json()
    assert [d["journalId"] for d in l["details"] if d["annee"] == 2028] == [jid]


def test_liste_des_journees(clients, journee):
    """S12 (p. 21) : Journée, Ouverte par, Heure ouverture, Date fermeture, Fermée par ; la plus récente d'abord"""
    l = clients["chef"].get("/api/journees", **H).json()
    assert [j["date"] for j in l][:2] == ["2026-11-05", "2026-11-04"] and l[0]["ouverteLe"] and l[0]["fermeeLe"] is None


def test_rapport_des_transactions(clients, journee):
    """S13 (p. 22) : par utilisateur, Nbres Opérations, Nbres Annulations, Nbres Tansactions sur la période DU AU"""
    caisse, chef = clients["caisse"], clients["chef"]
    for _ in range(2):
        assert caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 1000000, "coupures": {"10000": 1}}, **H).status_code == 200
    l = chef.get("/api/rapports/transactions?du=2026-11-05&au=2026-11-05", **H).json()
    assert l == [{"utilisateur": "Esther Ngalula", "operations": 2, "annulations": 0, "transactions": 2}]
    assert chef.get("/api/rapports/transactions?du=2026-11-06&au=2026-11-30", **H).json() == []
    r = chef.get("/api/rapports/transactions?du=&au=2026-11-05", **H); assert r.status_code == 422 and "DU et AU" in r.json()["message"]


def test_listes_general(clients):
    """S14, S14a à S14n (p. 23) : obligatoires, code unique, Modifier et Supprimer logique (p. 12), parent ; Type Guichet alimente S08 (S08-1)"""
    chef, agent = clients["chef"], clients["agent"]
    connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/listes/secteur_activite", **H).json()
    assert [x["code"] for x in l["lignes"]][:3] == ["S1", "S2", "S3"] and l["lignes"][0]["libelle"] == "PRIMAIRE" and len(l["catalogue"]) == 15
    def refus(chemin, c):
        r = chef.post(chemin, c, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "N° secteur" in refus("/api/listes/secteur_activite", {"code": "", "libelle": "Pêche"})
    assert "existe déjà" in refus("/api/listes/secteur_activite", {"code": "S1", "libelle": "Pêche"})
    assert agent.post("/api/listes/secteur_activite", {"code": "S9", "libelle": "Pêche"}, **H).status_code == 403
    assert chef.get("/api/listes/inconnue", **H).status_code == 404
    l = chef.post("/api/listes/secteur_activite", {"code": "S9", "libelle": "Peche"}, **H).json()
    s9 = next(x["id"] for x in l["lignes"] if x["code"] == "S9")
    l = chef.post(f"/api/listes/secteur_activite/{s9}", {"code": "S9", "libelle": "Pêche"}, **H).json()
    assert next(x for x in l["lignes"] if x["id"] == s9)["libelle"] == "Pêche"
    assert "Secteur d'activite" in refus("/api/listes/type_activite", {"code": "A1", "libelle": "Pisciculture"})
    l = chef.post("/api/listes/type_activite", {"code": "A1", "libelle": "Pisciculture", "parentId": s9}, **H).json()
    assert (l["lignes"][0]["code"], l["lignes"][0]["parent"]) == ("A1", "Pêche")
    assert "Type d'activité" in refus(f"/api/listes/secteur_activite/{s9}/suppression", {})
    chef.post(f"/api/listes/type_activite/{l['lignes'][0]['id']}/suppression", **H)
    l = chef.post(f"/api/listes/secteur_activite/{s9}/suppression", **H).json()
    assert not [x for x in l["lignes"] if x["code"] == "S9"]
    assert "existe déjà" in refus("/api/listes/secteur_activite", {"code": "S9", "libelle": "Pêche"})
    chef.post("/api/listes/type_guichet", {"code": "3", "libelle": "MOBILE"}, **H)
    assert "MOBILE" in chef.get("/api/guichets", **H).json()["types"]

def test_parametrages_lies_aux_clients(clients):
    """S15 (p. 23, capture p. 24) : Institution obligatoire ; l'ordre reprend les éléments cochés et le compteur"""
    chef, agent = clients["chef"], clients["agent"]
    connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/numerotation-clients", **H).json()
    i = l["institutions"][0]["id"]; assert l["regles"] == {}
    r = {"institutionId": i, "prefixe": {"actif": True, "valeur": "TJ"}, "suffixe": {"actif": False, "valeur": ""},
         "institution": {"actif": False, "position": 1}, "agence": {"actif": True, "position": 2}, "categorie": {"actif": False, "position": 1},
         "position": 1, "compteur": 1, "ordre": ["PREFIXE", "AGENCE", "COMPTEUR"]}
    def refus(c):
        x = chef.post("/api/numerotation-clients", c, **H); assert x.status_code == 422, x.content; return x.json()["message"]
    assert "Institution" in refus({**r, "institutionId": None})
    assert "Ordre" in refus({**r, "ordre": ["PREFIXE", "COMPTEUR"]})
    assert "Compteur" in refus({**r, "compteur": 0})
    assert agent.post("/api/numerotation-clients", r, **H).status_code == 403
    assert "Préfixe" in refus({**r, "prefixe": {"actif": True, "valeur": ""}})
    # Sans règle : code agence, tiret, compteur (S15-9) ; exemple et compteur par agence (S15-6, S15-7)
    assert l["compteurs"][0]["dernier"] == 320 and l["exemple"]["COMPTEUR"] == 321 and l["exemple"]["INSTITUTION"] == "CTJ"
    p = {"nom": "Tshibangu", "prenom": "Anne", "naissance": "1995-03-01", "lieuNaissance": "Kinshasa", "sexe": "F", "profession": "Commerçant",
         "pays": "République démocratique du Congo", "ville": "Kinshasa", "quartier": "Kinsaku", "telephone": "+243 810 000 111"}
    assert agent.post("/api/prospects", p, **H).json()["numero"] == "0412-000321"
    l = chef.post("/api/numerotation-clients", {**r, "compteur": 500}, **H).json()
    regle = l["regles"][str(i)]
    assert regle["ordre"] == ["PREFIXE", "AGENCE", "COMPTEUR"] and regle["prefixe"]["valeur"] == "TJ"
    assert (regle["agence"]["position"], regle["position"]) == (2, 3)                          # S15-1, S15-2 : rangs
    # La règle vaut pour les clients créés ensuite (S15-9) ; le compteur part de sa valeur de départ (S15-3)
    assert agent.post("/api/prospects", {**p, "nom": "Kabeya"}, **H).json()["numero"] == "TJ-0412-000500"


def test_affectation_des_guichets(clients):
    """S10 (p. 20, 96) : un guichet à la fois, ajout et retrait ; un guichet ne s'ouvre que pour l'utilisateur à qui il est affecté"""
    chef, caisse, agent = clients["chef"], clients["caisse"], clients["agent"]
    connecter(chef, "jpmukendi"); connecter(caisse, "engalula"); connecter(agent, "bkasongo")
    l = chef.get("/api/affectations-guichets", **H).json()
    ligne = lambda l, login: next(x for x in l["utilisateurs"] if x["login"] == login)
    assert ligne(l, "engalula")["guichet"] == "Caisse 2" and ligne(l, "bkasongo")["guichet"] == ""
    g1 = next(g["id"] for g in l["guichets"] if g["code"] == "G1")
    bijou = ligne(l, "bkasongo")["id"]; esther = ligne(l, "engalula")["id"]
    assert agent.post("/api/affectations-guichets", {"utilisateurId": bijou, "guichetId": g1}, **H).status_code == 403
    r = chef.post("/api/affectations-guichets", {"utilisateurId": esther, "guichetId": g1}, **H)
    assert r.status_code == 422 and "déjà un guichet" in r.json()["message"]
    l = chef.post("/api/affectations-guichets", {"utilisateurId": bijou, "guichetId": g1, "voirSolde": True}, **H).json()
    assert ligne(l, "bkasongo")["guichet"] == "Caisse 1" and ligne(l, "bkasongo")["voirSolde"]
    l = chef.post(f"/api/affectations-guichets/{bijou}/retrait", **H).json()
    assert ligne(l, "bkasongo")["guichet"] == ""
    r = chef.post(f"/api/affectations-guichets/{bijou}/retrait", **H); assert r.status_code == 422
    # La caissière ne peut pas ouvrir la Caisse 1, qui ne lui est pas affectée
    chef.post("/api/journees", {"date": "2026-11-05"}, **H)
    r = caisse.post("/api/caisses", {"guichetId": g1}, **H)
    assert r.status_code == 422 and "pas affecté" in r.json()["message"]


def test_journee_suivante_refusee_guichet_ouvert(clients, journee):
    """S12, registre S12-4 : pas de journée suivante tant qu'un guichet est ouvert ; le message nomme le guichet"""
    r = clients["chef"].post("/api/journees", {"date": "2026-11-06"}, **H)
    assert r.status_code == 422 and "Guichet encore ouvert : Caisse 2 (05/11/2026)" in r.json()["message"]


def test_plan_des_comptes(clients):
    """S102 (p. 122, 146) et T20 : le PCCI complet ; compte divisionnaire (PCCI § 9) ; comptes du PCCI non modifiables ; suppression"""
    compta, chef = clients["compta"], clients["chef"]
    connecter(compta, "plumbala"); connecter(chef, "jpmukendi")
    l = compta.get("/api/plan-comptes", **H).json()
    pcci = [c for c in l["comptes"] if c["pcci"]]
    assert len(pcci) == 604 + 9 and l["groupes"]["6"] == "Gestion"                   # 604 comptes et 9 classes
    assert next(c for c in pcci if c["numero"] == "6581")["libelle"] == "Cadres conventionnés"
    corps = {"parent": "5701", "suite": "1", "libelle": "Caisse Matete CDF", "ouvert": True, "saisissable": True}
    def refus(c, route="/api/plan-comptes"):
        r = compta.post(route, c, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Parent" in refus({**corps, "parent": "5799"})
    assert "chiffres" in refus({**corps, "suite": "1A"})
    assert "Statut" in refus({**corps, "ouvert": None})
    assert chef.post("/api/plan-comptes", corps, **H).status_code == 403
    assert "existe déjà" in refus({**corps, "parent": "57", "suite": "0"})         # 570 est déjà au PCCI
    l = compta.post("/api/plan-comptes", {**corps, "parent": "570", "suite": "1"}, **H).json()
    c = next(x for x in l["comptes"] if x["numero"] == "5701")
    assert (c["pcci"], c["libelle"], c["ouvert"]) == (False, "Caisse Matete CDF", True)
    l = compta.post("/api/plan-comptes/5701", {**corps, "parent": "570", "suite": "1", "libelle": "Caisse Matete", "ouvert": False, "lettrageAuto": True}, **H).json()
    c = next(x for x in l["comptes"] if x["numero"] == "5701")
    assert (c["libelle"], c["ouvert"], c["lettrageAuto"]) == ("Caisse Matete", False, True)
    assert "PCCI" in refus({**corps, "parent": "57", "suite": "0"}, "/api/plan-comptes/570")              # S102-1
    assert "PCCI" in refus({}, "/api/plan-comptes/570/suppression")
    l = compta.post("/api/plan-comptes/5701/suppression", **H).json()
    assert not [x for x in l["comptes"] if x["numero"] == "5701"]

def test_numero_de_compte(clients):
    """S17 (p. 26) : règle Prefixe, Suffixe, Position ; sans règle, N° Client et suffixe sur deux chiffres"""
    from noyau.services import composer_numero_compte
    assert composer_numero_compte(None, "0412-000321", "0412", 2) == "0412-000321-02"
    assert composer_numero_compte({"prefixe": True, "suffixe": True, "position": 3}, "0412-000321", "0412", 2) == "0412-0412-000321-002"
    assert composer_numero_compte({"prefixe": False, "suffixe": False, "position": 2}, "0412-000321", "0412", 2) == "0412-000321"
    chef, agent = clients["chef"], clients["agent"]
    connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/numerotation-comptes", **H).json()
    assert l["regle"] is None and l["exemple"]["agence"] == "0412"
    r = chef.post("/api/numerotation-comptes", {"prefixe": True, "suffixe": True, "position": 0}, **H)
    assert r.status_code == 422 and "Position" in r.json()["message"]
    assert agent.post("/api/numerotation-comptes", {"prefixe": True, "suffixe": True, "position": 3}, **H).status_code == 403
    l = chef.post("/api/numerotation-comptes", {"prefixe": True, "suffixe": True, "position": 3}, **H).json()
    assert l["regle"] == {"prefixe": True, "suffixe": True, "position": 3}


def test_budget_referentiels(clients):
    """S19 (p. 27 à 30) : huit référentiels du budget ; obligatoires, code unique, JJ/MM, Param Compte au plan, parents sans boucle,
    Supprimer logique refusé quand la valeur sert ailleurs (registre S19-1 à S19-8)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    B = "/api/budget-referentiels"
    def ok(page, corps, lid=None):
        r = chef.post(f"{B}/{page}" + (f"/{lid}" if lid else ""), corps, **H); assert r.status_code == 200, r.content; return r.json()
    def refus(page, corps, lid=None):
        r = chef.post(f"{B}/{page}" + (f"/{lid}" if lid else ""), corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    l = chef.get(f"{B}/types_centre", **H).json()
    assert [x["menu"] for x in l["catalogue"]][:2] == ["Types de centre de coût", "Centres de coût"] and l["fiche"]["rafraichir"]
    tc = {x["code"]: x for x in l["lignes"]}
    assert tc["DIR"]["affichage"]["parentId"] == "Direction Générale"
    assert agent.post(f"{B}/types_centre", {"code": "X", "libelle": "X"}, **H).status_code == 403
    assert "Code, Libellé" in refus("types_centre", {"code": "", "libelle": ""})
    assert "existe déjà" in refus("types_centre", {"code": "AG", "libelle": "Autre"})
    assert "ne peut pas" in refus("types_centre", {"code": "INST", "libelle": "Institution", "parentId": tc["SER"]["id"]}, tc["INST"]["id"])
    assert "Type" in refus("centres", {"code": "AGM", "libelle": "Agence de Matete"})
    c = ok("centres", {"code": "AGM", "libelle": "Agence de Matete", "typeId": tc["SER"]["id"]})
    agm = next(x for x in c["lignes"] if x["code"] == "AGM")
    assert agm["affichage"]["typeId"] == "Service"
    assert "Centres de coût" in chef.post(f"{B}/types_centre/{tc['SER']['id']}/suppression", {}, **H).json()["message"]
    assert "Param Compte" in refus("types_budget", {"code": "BX", "libelle": "X", "paramCompte": "6x"})
    assert "aucun compte" in refus("types_budget", {"code": "BX", "libelle": "X", "paramCompte": "6*,99999*"})
    tb = ok("types_budget", {"code": "BX", "libelle": "BUDGET X", "paramCompte": " 6* , 70* "})
    assert next(x for x in tb["lignes"] if x["code"] == "BX")["paramCompte"] == "6*,70*"
    assert "nombre entier" in refus("types_periode", {"code": "BIM", "libelle": "Bimestriel", "dureeMois": "-2"})
    tp = ok("types_periode", {"code": "BIM", "libelle": "Bimestriel", "dureeMois": 2})
    bim = next(x for x in tp["lignes"] if x["code"] == "BIM"); assert (bim["dureeMois"], bim["dureeJours"]) == (2, 0)
    assert "Date Début, Date Fin" in refus("periodes", {"code": "B1", "libelle": "1er bimestre", "typeId": bim["id"]})
    assert "JJ/MM" in refus("periodes", {"code": "B1", "libelle": "1er bimestre", "typeId": bim["id"], "debut": "30/02", "fin": "28/02"})
    assert "précède" in refus("periodes", {"code": "B1", "libelle": "1er bimestre", "typeId": bim["id"], "debut": "01/03", "fin": "28/02"})
    ok("periodes", {"code": "B1", "libelle": "1er bimestre", "typeId": bim["id"], "debut": "01/01", "fin": "28/02"})
    assert "Année inconnu" in refus("plans", {"annee": 1990, "code": "1990-PL", "libelle": "Plan 1990"})
    p = ok("plans", {"annee": 2026, "code": "2026-PL", "libelle": "PLAN BUDGETAIRE ANNEE 2026"})["lignes"][0]
    assert p["affichage"]["annee"] == "2026"
    assert "Centre de coût" in refus("lignes", {"numero": "1", "libelle": "Salaires", "planId": p["id"]})
    li = ok("lignes", {"numero": "1", "libelle": "Salaires", "planId": p["id"], "centreId": agm["id"]})["lignes"][0]
    assert li["affichage"] == {"numero": "1", "libelle": "Salaires", "planId": "PLAN BUDGETAIRE ANNEE 2026", "centreId": "Agence de Matete", "bailleurId": ""}
    assert "existe déjà" in refus("lignes", {"numero": "1", "libelle": "Autre", "planId": p["id"], "centreId": agm["id"]})
    o = ok("operations", {"typeOperation": "DEPOT", "typeBudgetId": next(x for x in tb["lignes"] if x["code"] == "BO")["id"]})["lignes"][0]
    assert o["affichage"]["typeOperation"] == "DEPOT" and o["affichage"]["typeBudgetId"] == "BUDGET DES OPERATIONS"
    assert "existe déjà" in refus("operations", {"typeOperation": "DEPOT", "typeBudgetId": o["typeBudgetId"]})
    assert "inconnu" in refus("operations", {"typeOperation": "PRET", "typeBudgetId": o["typeBudgetId"]})
    assert chef.post(f"{B}/lignes/{li['id']}/suppression", {}, **H).status_code == 200
    ok("lignes", {"numero": "1", "libelle": "Salaires", "planId": p["id"], "centreId": agm["id"]})      # numéro d'une ligne retirée : réutilisable
    m = ok("plans", {"annee": 2026, "code": "2026-PL", "libelle": "PLAN 2026"}, p["id"])
    assert m["lignes"][0]["libelle"] == "PLAN 2026"


def test_localisation(clients):
    """S20 (p. 30 à 32), découpage de la RDC (registre S20-1 à S20-4) : parents obligatoires, nom unique sous un parent, Zone, Supprimer logique"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    L = "/api/localisation"
    def refus(niveau, corps, lid=None):
        r = chef.post(f"{L}/{niveau}" + (f"/{lid}" if lid else ""), corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    pr = chef.get(f"{L}/province", **H).json()
    assert len(pr["lignes"]) == 26 and [o["onglet"] for o in pr["onglets"]][1] == "Province"
    rdc = chef.get(f"{L}/pays", **H).json()["lignes"][0]
    assert (rdc["nationalite"], rdc["code"], rdc["zone"]) == ("Congolaise", "CD", "Afrique")
    assert agent.post(f"{L}/province", {"parentId": rdc["id"], "nom": "X"}, **H).status_code == 403
    assert "Nationalite, Code, Zone" in refus("pays", {"nom": "Angola"})
    assert "Zone inconnue" in refus("pays", {"nom": "Angola", "nationalite": "Angolaise", "code": "AO", "zone": "Lune"})
    assert "code existe" in refus("pays", {"nom": "Congo", "nationalite": "Congolaise", "code": "cd", "zone": "Afrique"})
    assert "Pays" in refus("province", {"nom": "Nouvelle"})
    assert "existe déjà" in refus("province", {"parentId": rdc["id"], "nom": "nord-kivu"})
    nk = next(x for x in pr["lignes"] if x["nom"] == "Nord-Kivu")
    assert "Ville ou territoire inconnu" in refus("commune", {"parentId": nk["id"], "nom": "Goma"})           # une commune se rattache à une ville ou un territoire
    v = chef.post(f"{L}/ville", {"parentId": nk["id"], "nom": "Goma"}, **H).json()["lignes"]
    goma = next(x for x in v if x["nom"] == "Goma")
    assert goma["ascendants"]["province"]["nom"] == "Nord-Kivu" and goma["ascendants"]["pays"]["nom"] == "République démocratique du Congo"
    c = next(x for x in chef.post(f"{L}/commune", {"parentId": goma["id"], "nom": "Karisimbi"}, **H).json()["lignes"] if x["nom"] == "Karisimbi")
    r = chef.post(f"{L}/ville/{goma['id']}/suppression", {}, **H); assert r.status_code == 422 and "rattachés" in r.json()["message"]
    assert chef.post(f"{L}/commune/{c['id']}", {"parentId": goma["id"], "nom": "Karisimbi-Centre"}, **H).status_code == 200
    assert chef.post(f"{L}/commune/{c['id']}/suppression", {}, **H).status_code == 200
    assert chef.post(f"{L}/ville/{goma['id']}/suppression", {}, **H).status_code == 200
    assert all(x["nom"] != "Goma" for x in chef.get(f"{L}/ville", **H).json()["lignes"])


def test_credit_general(clients):
    """S21 (p. 32 à 36) : onze onglets ; Degré selon l'Instr. BCC 003, Terme selon le PCCI (registre S21-1 à S21-7)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    C = "/api/credit-referentiels"
    def ok(page, corps, lid=None):
        r = chef.post(f"{C}/{page}" + (f"/{lid}" if lid else ""), corps, **H); assert r.status_code == 200, r.content; return r.json()
    def refus(page, corps, lid=None):
        r = chef.post(f"{C}/{page}" + (f"/{lid}" if lid else ""), corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    l = chef.get(f"{C}/types_objet", **H).json()
    assert [x["menu"] for x in l["catalogue"]][:3] == ["Type Objet", "Objet Credit", "Type produit Credit"] and len(l["catalogue"]) == 11
    assert agent.post(f"{C}/cycles", {"code": "C03", "libelle": "TROISIEME CYCLE"}, **H).status_code == 403
    d = chef.get(f"{C}/degres", **H).json()["lignes"]                     # Instr. BCC 003, art. 12
    assert [(x["debut"], x["fin"], x["taux"]) for x in d] == [(0, 0, 0), (1, 30, 5), (31, 60, 25), (61, 90, 50), (91, 180, 75), (181, 365, 100), (366, 999999, 100)]
    assert "ne se modifie pas" in refus("degres", {"libelle": "X"})
    t = chef.get(f"{C}/termes", **H).json()["lignes"]                     # PCCI, classe 3
    assert [(x["libelle"], x["debut"], x["fin"]) for x in t] == [("Court terme", 1, 12), ("Moyen terme", 13, 60), ("Long terme", 61, 9999)]
    assert len(chef.get(f"{C}/periodicites", **H).json()["lignes"]) == 8
    assert "Secteur Activité" in refus("types_objet", {"libelle": "Pêche artisanale"})
    sec = l["options"]["secteurId"][0]["id"]
    to = next(x for x in ok("types_objet", {"libelle": "Pêche artisanale", "secteurId": sec})["lignes"] if x["libelle"] == "Pêche artisanale")
    assert "existe déjà" in refus("types_objet", {"libelle": "pêche ARTISANALE", "secteurId": sec})
    ob = ok("objets", {"libelle": "Achat de filets", "typeObjetId": to["id"]})
    assert next(x for x in ob["lignes"] if x["libelle"] == "Achat de filets")["affichage"]["typeObjetId"] == "Pêche artisanale"
    assert "Objet Credit" in chef.post(f"{C}/types_objet/{to['id']}/suppression", {}, **H).json()["message"]
    assert "existe déjà" in refus("cycles", {"code": "C01", "libelle": "X"})
    z = chef.get(f"{C}/zones", **H).json()
    ag = z["options"]["agenceId"][0]["id"]
    assert "Description" in refus("zones", {"code": "Z02", "nom": "Lemba", "agenceId": ag})
    assert "existe déjà" in refus("zones", {"code": "Z02", "nom": "matete", "description": "x", "agenceId": ag})
    ok("zones", {"code": "Z02", "nom": "Lemba", "description": "Commune de Lemba", "agenceId": ag})
    assert "Lemba" in chef.get("/api/referentiel", **H).json()["zones"]               # la zone de la fiche client (registre S21-4)
    ta = chef.get(f"{C}/types_assurance", **H).json()["lignes"][0]
    assert "n'existe pas" in refus("assureurs", {"nom": "Assureur A", "typeAssuranceId": ta["id"], "compte": "99999"})
    assert "email invalide" in refus("assureurs", {"nom": "Assureur A", "typeAssuranceId": ta["id"], "email": "x"})
    ok("assureurs", {"nom": "Assureur A", "typeAssuranceId": ta["id"], "portable": "+243 810 000 222"})
    us = chef.get(f"{C}/gestionnaires", **H).json()["options"]["utilisateurId"]
    assert "borne haute" in refus("gestionnaires", {"code": "1-AA", "nom": "Agent A", "montantDe": 500, "montantA": 100})
    g = ok("gestionnaires", {"code": "1-AA", "nom": "Agent A", "utilisateurId": us[0]["id"], "montantDe": 100, "montantA": 500, "enActivite": True})["lignes"][0]
    assert g["affichage"]["enActivite"] == "OUI"
    assert chef.get(f"/api/gestionnaires/{g['id']}/portefeuille", **H).json() == []


def test_ordre_remboursement(clients):
    """S22 (p. 37) : les cinq éléments une fois chacun, code des initiales, ordre unique ; l'ordre de chaque degré (S21) ; Code civil art. 152"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/ordres-remboursement", **H).json()
    assert [e["code"] for e in l["elements"]] == ["I", "C", "P", "E", "S"] and [x["code"] for x in l["lignes"]] == ["CIPES", "CPIES", "PICES"]
    def refus(corps, oid=None):
        r = chef.post("/api/ordres-remboursement" + (f"/{oid}" if oid else ""), corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert agent.post("/api/ordres-remboursement", {"ordre": list("ICPES")}, **H).status_code == 403
    assert "une fois chacun" in refus({"ordre": list("ICPE")})
    assert "une fois chacun" in refus({"ordre": list("ICPEE")})
    assert "existe déjà" in refus({"ordre": list("CIPES")})
    r = chef.post("/api/ordres-remboursement", {"ordre": list("ICPES")}, **H).json()["lignes"][-1]
    assert (r["code"], r["libelle"]) == ("ICPES", "Intérêt Capital Pénalité Epargne Solidarité")
    m = chef.post(f"/api/ordres-remboursement/{r['id']}", {"ordre": list("IPCES")}, **H).json()["lignes"][-1]
    assert m["id"] == r["id"] and m["code"] == "IPCES"
    d = chef.get("/api/credit-referentiels/degres", **H).json()
    assert d["lignes"][0]["affichage"]["ordre"] == "PICES ==> Pénalité Intérêt Capital Epargne Solidarité"
    cipes = next(x for x in l["lignes"] if x["code"] == "CIPES")
    assert "attaché à un degré" in chef.post(f"/api/ordres-remboursement/{cipes['id']}/suppression", {}, **H).json()["message"]
    d = chef.post("/api/credit-degres/ordres", {"ordres": {"7": m["id"]}}, **H).json()
    assert d["lignes"][6]["affichage"]["ordre"].startswith("IPCES") and d["lignes"][6]["taux"] == 100
    assert "inconnu" in chef.post("/api/credit-degres/ordres", {"ordres": {"9": m["id"]}}, **H).json()["message"]
    assert chef.post(f"/api/ordres-remboursement/{next(x for x in l['lignes'] if x['code'] == 'CPIES')['id']}/suppression", {}, **H).status_code == 200


PRODUIT = {"typeProduit": "CNO", "numero": "L001", "nom": "Crédit commerce", "devise": "CDF", "modeCalcul": "Dégressif", "typeInteret": "Fixe",
           "tauxInteret": "2,5", "tauxDiffere": 2, "montantMin": 100000, "montantMax": 5000000, "dureeMin": 3, "dureeMax": 12, "differeMin": 0, "differeMax": 2,
           "interetMin": 1, "interetMax": 4, "clientPhysique": True, "periodicite": "M", "modeDiffere": "Réparti", "paiementInteret": "Normal",
           "interetAnticipation": False, "ageMax": 65, "epargneNature": "Taux", "epargneValeur": 10, "categorie": "Prêt commercial",
           "penaliteAnticipation": 50, "frais": [{"typeFrais": "Frais de dossier", "nature": "Taux", "valeur": 1, "compte": "7152"}]}


def test_produit_credit(clients):
    """S23 (p. 37 et 38) : Information de base de la capture ; méthode dégressive (Instr. BCC 38, art. 11) ; garanties, assurance, frais
    (Instr. BCC 38 art. 6, Instr. BCC 40 art. 8) ; pénalité d'anticipation au plus 50 % (Instr. BCC 38, art. 14) ; registre S23-1 à S23-7"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/produits-credit", **H).json()
    assert l["options"]["modesCalcul"] == ["Dégressif"] and "CNO" in [t["code"] for t in l["options"]["typesProduit"]]
    def refus(corps, pid=None):
        r = chef.post("/api/produits-credit" + (f"/{pid}" if pid else ""), corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert agent.post("/api/produits-credit", PRODUIT, **H).status_code == 403
    assert "Num Produit, Nom du produit" in refus({**PRODUIT, "numero": "", "nom": ""})
    assert "dégressive" in refus({**PRODUIT, "modeCalcul": "Linéaire"})
    assert "au moins un type" in refus({**PRODUIT, "clientPhysique": False})
    assert "Montant : le maximum" in refus({**PRODUIT, "montantMax": 1000})
    assert "différé maximum" in refus({**PRODUIT, "differeMax": 12})
    assert "hors des bornes" in refus({**PRODUIT, "tauxInteret": 5})
    assert "50 %" in refus({**PRODUIT, "penaliteAnticipation": 60})
    assert "choisir Montant ou Taux" in refus({**PRODUIT, "epargneNature": None})
    assert "type d'assurance" in refus({**PRODUIT, "assuranceNature": "Taux", "assuranceValeur": 2})
    assert "n'existe pas" in refus({**PRODUIT, "frais": [{"typeFrais": "Frais de dossier", "nature": "Taux", "valeur": 1, "compte": "99999"}]})
    assert "deux fois" in refus({**PRODUIT, "frais": PRODUIT["frais"] * 2})
    r = chef.post("/api/produits-credit", PRODUIT, **H); assert r.status_code == 200, r.content
    p = r.json()["produit"]
    assert (p["tauxInteret"], p["frais"][0]["compte"], p["assuranceNature"]) == (2.5, "7152", None)
    assert r.json()["produits"][0]["typeClient"] == "Physique"
    assert "existe déjà" in refus({**PRODUIT, "numero": "l001"})
    m = chef.post(f"/api/produits-credit/{p['id']}", {**PRODUIT, "nom": "Crédit commerce AGR", "clientGroupe": True, "frais": []}, **H).json()["produit"]
    assert (m["nom"], m["clientGroupe"], m["frais"]) == ("Crédit commerce AGR", True, [])


def test_activation_produits_credit(clients):
    """S25 (p. 39) : Activer et Désactiver les produits cochés (registre S25-1)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    p = chef.post("/api/produits-credit", PRODUIT, **H).json()["produit"]
    def refus(corps):
        r = chef.post("/api/produits-credit/activation", corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert agent.post("/api/produits-credit/activation", {"ids": [p["id"]], "actif": False}, **H).status_code == 403
    assert "Cocher" in refus({"ids": [], "actif": False})
    assert "introuvable" in refus({"ids": [p["id"], 999999], "actif": False})
    l = chef.post("/api/produits-credit/activation", {"ids": [p["id"]], "actif": False}, **H).json()
    assert l["produits"][0]["actif"] is False
    assert chef.post("/api/produits-credit/activation", {"ids": [p["id"]], "actif": True}, **H).json()["produits"][0]["actif"] is True
