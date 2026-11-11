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
    # Frais d'adhésion paramétrés (S16) : compte absent du plan, puis compte du plan
    f = chef.post("/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Droit d'entrée"}, **H).json()
    [pid] = chef.post("/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "valeur": 200000, "compte": "70291", "typesMembre": ["Physique"]}, **H).json()
    r = caisse.post("/api/guichet/adhesions", {**corps, "coupures": {"5000": 2, "1000": 4}}, **H)
    assert r.status_code == 422 and "plan comptable" in r.json()["message"]
    chef.post(f"/api/parametrage/frais-adhesion/{pid}", {"nature": "Montant", "valeur": 200000, "compte": "728"}, **H)
    assert "billetage" in caisse.post("/api/guichet/adhesions", corps, **H).json()["message"]      # 12 000 de parts + 2 000 de frais
    assert caisse.post("/api/guichet/adhesions", {**corps, "coupures": {"5000": 2, "1000": 4}}, **H).status_code == 200
    assert caisse.get(f"/api/tiers/{t['id']}/parts").json() == 3
    assert [c["devise"] for c in caisse.get(f"/api/tiers/{t['id']}/comptes").json()] == ["CDF"]
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
    [pid] = chef.post("/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "valeur": 500000, "compte": "70291", "typesMembre": ["Physique"]}, **H).json()
    assert "Déjà paramétré" in refus(chef, "/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "typesMembre": ["Physique"]})
    assert "paramétré" in chef.delete(f"/api/parametrage/frais/{f['id']}", **H).json()["message"]
    assert chef.post(f"/api/parametrage/frais-adhesion/{pid}", {"nature": "Montant", "valeur": 200000, "compte": "70291"}, **H).status_code == 200
    lu = chef.get("/api/parametrage/frais").json()
    assert lu["adhesion"] == [{"id": pid, "fraisId": f["id"], "typeMembre": "Physique", "valeur": 200000, "compte": "70291", "nature": "Montant"}]
    assert chef.get(f"/api/tiers/{T('0412-000318')}/frais").json() == [{"fraisId": f["id"], "libelle": "Droit d'entrée", "compte": "70291", "montant": 200000}]
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
    assert agent.post(f"/api/prospects/{t['id']}", {**p, "quartier": "Lemba"}, **H).json()["quartier"] == "Lemba"
    assert [x["id"] for x in agent.get("/api/prospects").json()] == [t["id"]]
    assert "introuvable" in refus(p, f"/api/prospects/{T('0412-000318')}")
    # « Choisir prospect » à l'enrôlement (S37, p. 49) : le prospect devient le client, même numéro
    fiche = {**FICHE, "dateDemande": "2026-11-07", "nom": "Tshibangu", "prenom": "Anne", "sexe": "F", "pieceType": "Passeport", "pieceNumero": "OP7"}
    assert "Prospect introuvable" in refus({**fiche, "prospectId": T("0412-000318")}, "/api/tiers")
    c = agent.post("/api/tiers", {**fiche, "prospectId": t["id"]}, **H).json()
    assert (c["id"], c["numero"], c["statut"], c["quartier"], c["profession"]) == (t["id"], t["numero"], "a_viser", "Lemba", "Commerçant")
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
    corps = {"agenceId": ag, "code": "G3", "designation": "Caisse 3", "typeGuichet": "SECONDAIRE", "journalId": jca, "maximumCaisse": 0, "retraitPlafonne": 0,
             "compteGuichet": "5701", "billetage": True, "actif": False}
    def refus(c):
        r = chef.post("/api/guichets", c, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "désignation" in refus({**corps, "designation": ""})
    assert "chiffres" in refus({**corps, "compteSurplus": "57A"})
    assert caisse.post("/api/guichets", corps, **H).status_code == 403
    g3 = next(g for g in chef.post("/api/guichets", corps, **H).json()["guichets"] if g["code"] == "G3")
    assert (g3["typeGuichet"], g3["actif"], g3["ouvert"]) == ("SECONDAIRE", False, False)
    assert "existe déjà" in refus(corps)
    assert "inactif" in caisse.post(f"/api/guichets/{g3['id']}/ouverture", **H).json()["message"]
    g2 = caisse.post(f"/api/guichets/{G2()}/ouverture", **H).json()
    g2 = next(g for g in g2["guichets"] if g["id"] == G2())
    assert g2["ouvert"] and g2["dateOuverture"] == "2026-11-05"
    assert caisse.post(f"/api/guichets/{G2()}/fermeture", **H).status_code == 200
    assert caisse.get("/api/caisses/moi", **H).json()["statut"] == "fermee"
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
    l = chef.post("/api/exercices", {"lignes": [{"annee": 2027, "actif": True, "ouvert": False, "valide": False}]}, **H).json()
    assert next(e for e in l["exercices"] if e["annee"] == 2027)["actif"]
    l = chef.post("/api/exercices/2027/ouverture", **H).json()
    assert len([d for d in l["details"] if d["annee"] == 2027]) == len(l["journaux"]) and l["enCours"] == 2027
    r = chef.post("/api/exercices/2027/ouverture", **H); assert r.status_code == 422 and "déjà ouvert" in r.json()["message"]
