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
    vider_journal_securite()


def vider_journal_securite():
    """Le journal de sécurité s'écrit hors de la transaction du test (connexion à part) : on le vide pour que chaque test parte de zéro"""
    import psycopg
    from django.db import connection
    db = connection.settings_dict
    with psycopg.connect(dbname=db["NAME"], user=db["USER"], password=db["PASSWORD"], host=db["HOST"], port=db["PORT"], autocommit=True) as c:
        c.execute("delete from journal_securite")


def connecter(c: Client, login: str):
    r = c.post("/api/session", {"login": login}, **H)
    assert r.status_code == 200, r.content


def cle():
    return str(uuid.uuid4())


def ident(sql, params=()):
    from noyau.bd import valeur
    return valeur(sql, params)


def lignes_bd(sql, params=()):
    from noyau.bd import lignes
    return [tuple(x.values()) for x in lignes(sql, params)]


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


def test_retrait_plafond_et_maximum(clients, journee):
    """S08 : retrait au-delà du plafond en attente du visa « Retrait plafond » puis payé (registre S08-5) ; avertissement au-delà du maximum (S08-4)"""
    from noyau.bd import executer
    caisse, chef, compta = clients["caisse"], clients["chef"], clients["compta"]
    executer("delete from guichet_plafond where guichet_id = %s", (G2(),))
    executer("insert into guichet_plafond (guichet_id, devise, maximum, retrait) values (%s, 'USD', 100000, 30000)", (G2(),))
    p = {"cle": cle(), "compteId": C("0412-000318-01"), "montant": 45000, "coupures": {"100": 4, "50": 1}}
    r = caisse.post("/api/guichet/retraits", p, **H).json()
    assert (r["statut"], r["ecritureId"]) == ("visa_requis", None), r
    assert caisse.post("/api/guichet/retraits", p, **H).json()["id"] == r["id"]                      # même clé : la même attente
    d = caisse.post("/api/guichet/retraits", {**p, "cle": cle()}, **H)
    assert d.status_code == 422 and "déjà en attente" in d.json()["message"]
    l = compta.get("/api/visas/retraits-plafond").json()
    assert [(x["montant"], x["compte"], x["devise"]) for x in l] == [(45000, "0412-000318-01", "USD")]
    assert caisse.post(f"/api/operations/{r['id']}/visa", **H).status_code in (403, 422)                # le caissier ne vise pas
    assert chef.post(f"/api/operations/{r['id']}/visa", **H).json()["statut"] == "visee"
    assert compta.get("/api/visas/retraits-plafond").json() == []
    paye = caisse.post("/api/guichet/retraits", {**p, "cle": cle()}, **H).json()
    assert (paye["id"], paye["statut"]) == (r["id"], "validee") and paye["ecritureId"]
    assert caisse.post("/api/guichet/retraits", {"cle": cle(), "compteId": C("0412-000318-01"), "montant": 20000, "coupures": {"100": 2}}, **H).json()["statut"] == "validee"
    # maximum autorisé : 1 000 USD ; l'encaisse USD du guichet est bien au-dessus : avertissement, jamais de refus
    v = caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-01"), "montant": 10000, "coupures": {"100": 1}, "mandataire": ""}, **H).json()
    assert v["statut"] == "validee" and "maximum autorisé (1 000 USD)" in v["avertissement"]
    assert "avertissement" not in caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 20000, "coupures": {"20000": 1}, "mandataire": ""}, **H).json()
    assert balance_equilibree(caisse)


def test_voir_solde_client(clients, journee):
    """S10 : sans « Voir solde client », le caissier ne reçoit pas les soldes au guichet (registre S10-1) ; les autres écrans ne sont pas touchés"""
    from noyau.bd import executer
    caisse, chef = clients["caisse"], clients["chef"]
    tid = T("0412-000318")
    assert all(c["solde"] is not None for c in caisse.get(f"/api/tiers/{tid}/comptes").json())          # case cochée dans la graine
    executer("update affectation_guichet set voir_solde = false where fin is null")
    l = caisse.get(f"/api/tiers/{tid}/comptes").json()
    assert all(c["masque"] and c["solde"] is None and c["disponible"] is None for c in l) and l[0]["numero"]
    assert all(c["solde"] is not None for c in chef.get(f"/api/tiers/{tid}/comptes").json())
    r = caisse.post("/api/guichet/retraits", {"cle": cle(), "compteId": C("0412-000319-01"), "montant": 60000, "coupures": {"100": 6}}, **H)
    assert r.status_code == 422 and "solde disponible" in r.json()["message"]                          # le contrôle reste au serveur
    executer("update affectation_guichet set voir_solde = true where fin is null")


def test_journees_en_attente(clients):
    """S12 : des journées attendent leur comptabilisation, au plus « Journée Maxi ouvert » (registre T14, S12-2, S12-5) ; comptabilisées dans l'ordre"""
    from noyau.bd import executer
    chef, caisse = clients["chef"], clients["caisse"]
    connecter(chef, "jpmukendi"); connecter(caisse, "engalula")
    ouvrir = lambda d: chef.post("/api/journees", {"date": d}, **H)
    j1 = ouvrir("2026-11-05").json()
    r = ouvrir("2026-11-06"); assert r.status_code == 422 and "Journée Maxi ouvert atteinte (1)" in r.json()["message"] and "05/11/2026" in r.json()["message"]
    executer("update institution set journee_max = 2")
    j2 = ouvrir("2026-11-06").json()
    assert ouvrir("2026-11-09").status_code == 422                                                   # deux journées en attente : le maximum
    s = caisse.post("/api/caisses", {"guichetId": G2()}, **H).json()
    assert s["journeeId"] == j2["id"]                                                                 # seule la dernière reçoit des opérations
    r = chef.post(f"/api/journees/{j2['id']}/fermeture", **H)
    assert r.status_code == 422 and "Comptabiliser d'abord la journée du 05/11/2026" in r.json()["message"]
    assert chef.post(f"/api/journees/{j1['id']}/fermeture", **H).json()["statut"] == "fermee"
    executer("update institution set journee_max = 1")


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
FICHE = {"images": {"copiePiece": "data:image/png;base64,iVBORw0KGgo=", "justificatifAdresse": "data:image/png;base64,iVBORw0KGgo="}, "dateDemande": "2026-11-05", "typeClient": "Client", "produitCode": "EAV-CDF", "premierDepot": 0, "resident": True, "preleverAgios": True,
         "calculerInteret": False, "liees": [], "personneExposee": False,
         # mentions de l'identité et de la pièce (Instr. BCC 15, art. 12 et 13 ; registre S37-1)
         "prenom": "Marie", "naissance": "1990-01-15", "lieuNaissance": "Kinshasa", "adresse": "Matete, avenue Kinsaku 12",
         "pieceDelivreeLe": "2024-01-10", "pieceLieu": "Kinshasa", "pieceAutorite": "DGM", "pieceExpire": "2030-01-10"}


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
    base = {**FICHE, "typeClient": "Entreprises privées", "zone": "Matete", "nom": "Boulangerie Kinsaku SARL", "formeJuridique": "Société à responsabilité limitée",
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


def test_fiche_entreprise(clients, journee):
    """S38 : listes comme pour S37 (registre S38-1), Retirer côté écran (S38-2), bénéficiaire effectif dans Personnes liées (S38-3 ; Instr. BCC 15, art. 18)"""
    agent = clients["agent"]
    physique = ident("select id from tiers where type = 'physique' order by id limit 1")
    morale = agent.post("/api/tiers/entreprises", {**FICHE, "typeClient": "Entreprises privées", "zone": "Matete", "nom": "Témoin SA",
                        "formeJuridique": "Société anonyme", "registre": "R0", "adresse": "Matete"}, **H).json()["id"]
    sens = ident("select id from agent_agence where role = 'sensibilisateur' and actif order by id limit 1")
    base = {**FICHE, "typeClient": "Entreprises privées", "zone": "Matete", "nom": "Kinsaku Pain SARL", "formeJuridique": "Société à responsabilité limitée",
            "registre": "R2", "adresse": "Matete", "secteurActivite": "PRIMAIRE", "pays": "", "email": "contact@exemple.cd", "sensibilisateurId": sens}
    def refus(corps):
        r = agent.post("/api/tiers/entreprises", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "Forme juridique : valeur inconnue" in refus({**base, "formeJuridique": "SARLU"})
    assert "Secteur d'activité : valeur inconnue" in refus({**base, "secteurActivite": "Pêche industrielle"})
    assert "Email invalide" in refus({**base, "email": "contact"})
    assert "Bénéficiaire effectif" in refus({**base, "beneficiairesEffectifs": [morale]})
    assert "Bénéficiaire effectif" in refus({**base, "liees": [physique], "beneficiairesEffectifs": [physique]})
    t = agent.post("/api/tiers/entreprises", {**base, "beneficiairesEffectifs": [physique]}, **H).json()
    assert (t["formeJuridique"], t["secteurActivite"], t["email"], t["beneficiairesEffectifs"], t["liees"]) == \
        ("Société à responsabilité limitée", "PRIMAIRE", "contact@exemple.cd", [physique], [])
    assert t["sensibilisateurId"] == sens or sens is None


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


def test_fiche_groupe(clients, journee):
    """S39 : listes comme pour S37 et S38 (registre S39-1), type de groupe de S14f (S39-2), Catégorie de groupe de S14j"""
    from noyau.bd import executer
    agent = clients["agent"]
    ins = ident("select institution_id from agence order by id limit 1")
    executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'categorie_groupe', 'G1', 'Groupe de femmes')", (ins,))
    executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'type_groupe', '9', 'Tontine')", (ins,))
    base = {**FICHE, "typeClient": "Tontine", "nom": "Tontine Kinsaku", "adresse": "Matete", "membres": [], "secteurActivite": "PRIMAIRE",
            "categorie": "Groupe de femmes", "email": "tontine@exemple.cd"}
    def refus(corps):
        r = agent.post("/api/tiers/groupes", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "Forme juridique : valeur inconnue" in refus({**base, "formeJuridique": "ASBL de fait"})
    assert "Catégorie : valeur inconnue" in refus({**base, "categorie": "Catégorie A"})
    assert "Email invalide" in refus({**base, "email": "tontine"})
    assert "Sensibilisateur inconnu" in refus({**base, "sensibilisateurId": 999999})
    r = agent.post("/api/tiers/groupes", base, **H); assert r.status_code == 200, r.content
    t = r.json()
    assert (t["typeClient"], t["categorie"], t["secteurActivite"], t["email"]) == ("Tontine", "Groupe de femmes", "PRIMAIRE", "tontine@exemple.cd")
    assert ident("select agent_economique from tiers where id = %s", (t["id"],)) == "menages"   # groupement sans personnalité juridique : ses membres sont des personnes physiques (registre S39-2)
    assert "Tontine" in agent.get("/api/referentiel", **H).json()["typesGroupe"]


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
    ident_ = {c: FICHE[c] for c in ("naissance", "lieuNaissance", "adresse", "pieceDelivreeLe", "pieceLieu", "pieceAutorite", "pieceExpire")}
    t0 = agent.get(f"/api/tiers/{k}").json()
    t = {**t0, **{c: v for c, v in ident_.items() if not t0.get(c)}, "prenom": t0["prenom"] or "Josée"}
    def refus(corps, tid=k):
        r = agent.post(f"/api/tiers/{tid}/modification", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "nom" in refus({**t, "nom": ""})
    assert "art. 12 et 13" in refus({**t, "lieuNaissance": ""})            # mentions de l'identité obligatoires à la mise à jour (registre S46-3)
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
    t9 = chef.get(f"/api/tiers/{T('0412-000319')}").json()
    assert chef.post(f"/api/tiers/{T('0412-000319')}/modification", {**t9, **{c: v for c, v in ident_.items() if not t9.get(c)}, "prenom": t9["prenom"] or "Grâce",
                                                                     "telephone": "1"}, **H).status_code == 200
    r = chef.post(f"/api/tiers/{T('0412-000319')}/activation", **H)
    assert r.status_code == 422 and "Quatre yeux" in r.json()["message"]
    assert chef.post(f"/api/tiers/{k}/activation", **H).json()["statut"] == "actif"
    assert "n'attend pas" in chef.post(f"/api/tiers/{k}/activation", **H).json()["message"]
    assert depot().status_code == 200
    # S43 : informations initiales et actuelles
    h = chef.get(f"/api/tiers/{k}/modifications").json()
    assert (h[0]["avant"]["telephone"], h[0]["apres"]["telephone"], h[0]["validePar"] is not None) == ("", "+243 990 000 001", True)
    assert chef.get(f"/api/tiers/{k}/images").json() == {"photo": None, "signature": None, "copiePiece": None, "justificatifAdresse": None}   # graine : pas d'image réelle


def test_connexion_avec_mot_de_passe(clients, settings):
    """Site en ligne (registre S01-2) : mot de passe vérifié, même réponse pour un identifiant inconnu et un mauvais mot de passe, liste des identifiants fermée"""
    chef, autre = clients["chef"], Client()
    connecter(chef, "jpmukendi")                                   # le chef crée un compte avec mot de passe (S05)
    ag = chef.get("/api/referentiel").json()["agence"]["id"]
    r = chef.post("/api/gestion-utilisateurs", {"nom": "Essai Test", "agenceId": ag, "login": "etest", "motDePasse": "secret-1", "confirmation": "secret-1",
                                                "portable": "+243 810 000 999"}, **H)
    assert r.status_code == 200, r.content
    settings.SANS_MOT_DE_PASSE = False
    def ouvrir(login, mdp=None):
        return autre.post("/api/session", {"login": login, **({"motDePasse": mdp} if mdp is not None else {})}, **H)
    inconnu, faux, vide = ouvrir("personne", "secret-1"), ouvrir("etest", "mauvais"), ouvrir("etest")
    assert {r.status_code for r in (inconnu, faux, vide)} == {422} and {r.json()["message"] for r in (inconnu, faux, vide)} == {"Nom d'utilisateur ou mot de passe incorrect."}
    assert ouvrir("jpmukendi", "n'importe quoi").status_code == 422        # compte de la graine : aucun mot de passe, donc fermé
    assert autre.get("/api/utilisateurs").json() == [] and autre.get("/api/session/mode").json() == {"motDePasseRequis": True}
    assert ouvrir("etest", "secret-1").status_code == 200
    assert autre.get("/api/session").json()["login"] == "etest"
    assert any(u["login"] == "jpmukendi" for u in autre.get("/api/referentiel").json()["utilisateurs"])   # après connexion : noms des rapports


def test_mise_a_jour_entreprise_groupe(clients, journee):
    """S46 : entreprise et groupe, mêmes onglets que leur enrôlement (registre S46-2) ; signataires et membres gardés, retirés ou ajoutés"""
    agent, chef = clients["agent"], clients["chef"]
    sig = {"nom": "Ilunga", "prenom": "Paul", "pieceType": "Passeport", "pieceNumero": "OP9", "signature": "data:image/png;base64,iVBORw0KGgo="}
    e = agent.post("/api/tiers/entreprises", {**FICHE, "typeClient": "Entreprises privées", "zone": "Matete", "nom": "Boulangerie Kinsaku SARL",
                   "formeJuridique": "Société à responsabilité limitée", "registre": "CD/KNG/RCCM/24-B-00001", "adresse": "Matete, avenue Kinsaku",
                   "dirigeant": {**sig, "signature": None}, "signataires": [sig]}, **H).json()["id"]
    g = agent.post("/api/tiers/groupes", {**FICHE, "typeClient": "Association", "nom": "Mamans de Kinsaku", "adresse": "Matete", "nbHommes": 0, "nbFemmes": 12,
                   "membres": [{**sig, "pieceNumero": "OP8"}, {**sig, "nom": "Mbuyi", "pieceNumero": "OP7"}]}, **H).json()["id"]
    for x in (e, g):
        assert chef.post(f"/api/tiers/{x}/visa", **H).status_code == 200
    def corps(tid):
        t = agent.get(f"/api/tiers/{tid}").json()
        sans = lambda r: {k: v for k, v in r.items() if k not in ("photo", "specimen")}
        return t, {**t, "dirigeant": sans(t["dirigeant"]) if t["dirigeant"] else None,
                   "signataires": [{**r, "existant": True} for r in t["signataires"]], "membres": [{**r, "existant": True} for r in t["membres"]]}
    t, c = corps(e)
    nouveau = {"nom": "Kabila", "postnom": "", "prenom": "Rose", "pieceType": "Carte d'électeur", "pieceNumero": "9-0412-0001", "pieceExpire": "2031-01-01"}
    r = agent.post(f"/api/tiers/{e}/modification", {**c, "signataires": c["signataires"] + [{**nouveau, "existant": True}]}, **H)
    assert r.status_code == 422 and "Signataire" in r.json()["message"] and "inconnu" in r.json()["message"]
    r = agent.post(f"/api/tiers/{e}/modification", {**c, "registre": "", "signataires": c["signataires"] + [nouveau]}, **H)
    assert r.status_code == 422 and "registre" in r.json()["message"]
    r = agent.post(f"/api/tiers/{e}/modification", {**c, "centreActivite": "Lemba", "signataires": c["signataires"] + [nouveau]}, **H)
    assert r.status_code == 200, r.content
    m = r.json()
    assert (m["statut"], m["centreActivite"], len(m["signataires"])) == ("modifie_a_revalider", "Lemba", len(t["signataires"]) + 1)
    assert [x["specimen"] for x in m["signataires"][:len(t["signataires"])]] == [x["specimen"] for x in t["signataires"]]   # images gardées
    t, c = corps(g)
    r = agent.post(f"/api/tiers/{g}/modification", {**c, "nbFemmes": 20, "membres": c["membres"][1:]}, **H)
    assert r.status_code == 200, r.content
    assert (r.json()["nbFemmes"], len(r.json()["membres"]), r.json()["statut"]) == (20, len(t["membres"]) - 1, "modifie_a_revalider")


def test_adhesion_apres_visa(clients, journee):
    caisse, chef, agent = clients["caisse"], clients["chef"], clients["agent"]
    t = agent.post("/api/tiers", {**FICHE, "nom": "Tshala", "postnom": "Muana", "prenom": "Marie", "naissance": "1990-02-01", "pieceType": "Carte d'électeur",
                                  "pieceNumero": "1-0412-0999", "pieceExpire": "2031-01-01", "adresse": "Matete"}, **H).json()
    corps = {"cle": cle(), "tiersId": t["id"], "parts": 3, "depot": 0, "coupures": {"5000": 2, "1000": 2}}
    assert "visa" in caisse.post("/api/guichet/adhesions", corps, **H).json()["message"]
    assert agent.post(f"/api/tiers/{t['id']}/visa", **H).status_code == 403                 # l'agent n'est pas chef
    assert chef.post(f"/api/tiers/{t['id']}/visa", **H).status_code == 200
    # Frais d'adhésion paramétrés (S16) : le compte est contrôlé sur le plan dès le paramétrage (règle T16)
    f = chef.post("/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Droit d'entrée", "fondement": "droit_adhesion"}, **H).json()
    chef.post("/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "valeur": 200000, "compte": "728", "typesMembre": ["Physique"]}, **H)
    assert "billetage" in caisse.post("/api/guichet/adhesions", corps, **H).json()["message"]      # 12 000 de parts + 2 000 de frais
    assert caisse.post("/api/guichet/adhesions", {**corps, "coupures": {"5000": 2, "1000": 4}}, **H).status_code == 200
    assert caisse.get(f"/api/tiers/{t['id']}/parts").json() == 3
    assert [c["devise"] for c in caisse.get(f"/api/tiers/{t['id']}/comptes").json()] == ["CDF"]
    assert [c["numero"] for c in caisse.get(f"/api/tiers/{t['id']}/comptes").json()] == [f"{t['numero']}-02"]   # S17-6 : sans règle, suffixe du produit CDF
    assert ident("select sum(montant_devise) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero = '728'") == 200000
    assert caisse.get(f"/api/tiers/{t['id']}/adhesion").json() == ident("select date_comptable::text from journee_comptable where statut = 'ouverte'")   # S43, registre S43-2
    # S41 : après l'encaissement de l'adhésion, les frais ne se modifient plus (registre S41-1, PCCI § 3.4)
    r = chef.post(f"/api/tiers/{t['id']}/frais", {"frais": [{"fraisId": f["id"], "montant": 100000}]}, **H)
    assert r.status_code == 422 and "déjà encaissée" in r.json()["message"]
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


def test_validation_compte_comptable(clients, journee):
    """S80-2 : la troisième case de la validation est le solde du compte comptable du guichet ; un dépôt l'augmente de son montant"""
    _, s = journee
    caisse = clients["caisse"]
    avant = caisse.get(f"/api/caisses/{s['id']}/solde-comptable?devise=CDF").json()
    assert caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 5000000, "coupures": {"20000": 2, "10000": 1}, "mandataire": ""}, **H).status_code == 200
    assert caisse.get(f"/api/caisses/{s['id']}/solde-comptable?devise=CDF").json() == avant + 5000000


def test_ecart_de_caisse(clients, journee):
    """S80-5 : à la validation, un manquant passe au débit de 671, un excédent au crédit de 7790, par le compte du guichet ;
    le compte comptable rejoint le solde réel (billetage + Bon de Caisse) (PCCI 671 et 7790)"""
    _, s = journee
    chef, caisse = clients["chef"], clients["caisse"]
    solde = lambda d: caisse.get(f"/api/caisses/{s['id']}/solde-comptable?devise={d}").json()
    th = caisse.get(f"/api/caisses/{s['id']}/theorique?devise=CDF").json()
    v = max(th, key=lambda k: float(k)); compte = {**th, v: th[v] - 1}      # un billet de moins que prévu : manquant
    avant = solde("CDF")
    b = caisse.post(f"/api/caisses/{s['id']}/billetages", {"devise": "CDF", "compte": compte}, **H).json()
    assert chef.post(f"/api/billetages/{b['id']}/validation", **H).status_code == 200
    manque = round(float(v) * 100)
    assert solde("CDF") == avant - manque
    assert ident("""select c.numero from ligne_ecriture l join compte c on c.id = l.compte_id join billetage b on b.ecriture_ecart_id = l.ecriture_id
                    where b.id = %s and l.sens = 'D'""", (b["id"],)) == "671"
    thu = caisse.get(f"/api/caisses/{s['id']}/theorique?devise=USD").json()
    avant = solde("USD")
    b = caisse.post(f"/api/caisses/{s['id']}/billetages", {"devise": "USD", "compte": thu, "bonCaisse": 1000}, **H).json()   # Bon de Caisse de 10 USD : excédent
    assert chef.post(f"/api/billetages/{b['id']}/validation", **H).status_code == 200
    assert solde("USD") == avant + 1000
    assert ident("""select c.numero from ligne_ecriture l join compte c on c.id = l.compte_id join billetage b on b.ecriture_ecart_id = l.ecriture_id
                    where b.id = %s and l.sens = 'C'""", (b["id"],)) == "7790"
    assert balance_equilibree(caisse)


def test_part_sociale_frais_adhesion(clients):
    """S16 : la part sociale est la ligne « Part sociale standard » des frais d'adhésion (capture p. 89) ; compte 103 du membre (PCCI) ;
    une seule valeur, celle des statuts (loi 002/2002, art. 20) ; registre S16-11"""
    chef = clients["chef"]; connecter(chef, "jpmukendi")
    def refus(chemin, c):
        r = chef.post(chemin, c, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    lu = chef.get("/api/parametrage/frais").json()["adhesion"]
    parts = {x["typeMembre"]: x for x in lu if x["compte"].startswith("103")}
    assert {k: (v["compte"], v["valeur"]) for k, v in parts.items()} == {"Physique": ("1030", 400000), "Personne morale": ("1032", 400000), "Groupe": ("1031", 400000)}
    assert chef.get("/api/referentiel").json()["valeurPart"] == 400000
    pid = parts["Physique"]["id"]
    assert "compte 1030" in refus(f"/api/parametrage/frais-adhesion/{pid}", {"nature": "Montant", "valeur": 400000, "compte": "1032"})
    assert "seule valeur nominale" in refus(f"/api/parametrage/frais-adhesion/{pid}", {"nature": "Montant", "valeur": 500000, "compte": "1030"})
    assert "obligatoire" in refus(f"/api/parametrage/frais-adhesion/{pid}", {"nature": "Montant", "valeur": None, "compte": "1030"})
    f = chef.post("/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Autre part", "fondement": "part_sociale"}, **H).json()
    assert "déjà paramétrée" in refus("/api/parametrage/frais-adhesion", {"fraisId": f["id"], "nature": "Montant", "valeur": 400000, "compte": "1030", "typesMembre": ["Physique"]})
    # Nouvelle valeur des statuts : la même sur les trois lignes
    for x in parts.values():
        executer = __import__("noyau.bd", fromlist=["executer"]).executer
        executer("update parametrage_frais_adhesion set valeur = 500000 where id = %s", (x["id"],))
    assert chef.get("/api/referentiel").json()["valeurPart"] == 500000
    fps = parts["Physique"]["fraisId"]
    assert "ne se modifie pas pour un client" in refus(f"/api/tiers/{T('0412-000318')}/frais", {"frais": [{"fraisId": fps, "montant": 1}]})


def test_compte_part_selon_nature():
    """PCCI, compte 103 selon la nature juridique du membre (registre S16-13) : banque, État, église, association, ONG en 1032"""
    from noyau.services import compte_parts
    cas = [("physique", "Client", "1030"), ("groupe", "Groupement solidaire", "1031"), ("groupe", "Association", "1032"), ("groupe", "ONG", "1032"),
           ("morale", "Banques commerciales et autres intermédiaires financiers", "1032"), ("morale", "Administration centrale", "1032"),
           ("morale", "Institutions sans but lucratif", "1032")]
    assert [compte_parts({"type": t, "type_client": c}) for t, c, _ in cas] == [x for _, _, x in cas]


def test_parametrage_frais(clients):
    chef, agent = clients["chef"], clients["agent"]
    connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    def refus(c, route, corps, methode="post"):
        r = getattr(c, methode)(route, corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Instr. BCC 37" in refus(chef, "/api/parametrage/frais", {"typeOperation": "DEPOT", "libelle": "FRAIS VERSEMENT"})
    assert "Droit manquant" in refus(agent, "/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Droit d'entrée", "fondement": "droit_adhesion"})
    f = chef.post("/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Droit d'entrée", "fondement": "droit_adhesion"}, **H).json()
    assert "existe déjà" in refus(chef, "/api/parametrage/frais", {"typeOperation": "ADHESION", "libelle": "Droit d'entrée", "fondement": "droit_adhesion"})
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
    assert [x for x in lu["adhesion"] if x["fraisId"] == f["id"]] == [{"id": pid, "fraisId": f["id"], "typeMembre": "Physique", "valeur": 200000, "compte": "727", "nature": "Montant"}]
    assert lu["compteAdhesion"] == "727" and "Femme" in lu["sousTypes"] and lu["natures"] == ["Montant", "Taux"]   # S16-4, S16-8, S16-2
    assert chef.get(f"/api/tiers/{T('0412-000318')}/frais").json() == [{"fraisId": ident("select id from frais where libelle = 'Part sociale standard'"), "libelle": "Part sociale standard",
                                                                       "compte": "1030", "montant": 400000, "part": True},
                                                                      {"fraisId": f["id"], "libelle": "Droit d'entrée", "compte": "727", "montant": 200000, "part": False}]
    # Modifier Catégorie (S16-6) : la ligne passe de Physique à Entreprise
    assert chef.post(f"/api/parametrage/frais-adhesion/{pid}/categorie", {"typeMembre": "Personne morale"}, **H).status_code == 200
    assert next(x for x in chef.get("/api/parametrage/frais").json()["adhesion"] if x["id"] == pid)["typeMembre"] == "Personne morale"
    chef.post(f"/api/parametrage/frais-adhesion/{pid}/categorie", {"typeMembre": "Physique"}, **H)
    # Frais d'opération au taux (S16-2) sur une part sociale (S16-1), sous type de Général (S16-8)
    assert "À remplir : fondement" in refus(chef, "/api/parametrage/frais", {"typeOperation": "PART_SOCIALE", "libelle": "Frais de part"})          # écart E14
    assert "autorisation préalable de la BCC" in refus(chef, "/api/parametrage/frais", {"typeOperation": "PART_SOCIALE", "libelle": "Frais de part", "fondement": "autorisation_bcc"})
    assert "droit d'adhésion se perçoit" in refus(chef, "/api/parametrage/frais", {"typeOperation": "PART_SOCIALE", "libelle": "Frais de part", "fondement": "droit_adhesion"})
    fp = chef.post("/api/parametrage/frais", {"typeOperation": "PART_SOCIALE", "libelle": "Frais de part", "fondement": "autorisation_bcc", "autorisationBcc": "BCC/DSIF/2026/031"}, **H).json()
    assert next(x for x in chef.get("/api/parametrage/frais").json()["frais"] if x["id"] == fp["id"])["autorisationBcc"] == "BCC/DSIF/2026/031"
    assert "Taux invalide" in refus(chef, "/api/parametrage/frais-operation", {"fraisId": fp["id"], "nature": "Taux", "valeur": 20000, "compte": "727", "sousTypes": ["Femme"]})
    [po] = chef.post("/api/parametrage/frais-operation", {"fraisId": fp["id"], "nature": "Taux", "valeur": 150, "compte": "727", "sousTypes": ["Femme"]}, **H).json()
    assert chef.get("/api/parametrage/frais").json()["operations"][0]["nature"] == "Taux"
    chef.delete(f"/api/parametrage/frais-operation/{po}", **H); chef.delete(f"/api/parametrage/frais/{fp['id']}", **H)
    # S41 : montant propre au client
    k = T("0412-000318")
    assert "Droit manquant" in refus(agent, f"/api/tiers/{k}/frais", {"frais": [{"fraisId": f["id"], "montant": 0}]})
    assert "Montant" in refus(chef, f"/api/tiers/{k}/frais", {"frais": [{"fraisId": f["id"], "montant": -1}]})
    assert "pas lié" in refus(chef, f"/api/tiers/{k}/frais", {"frais": [{"fraisId": 999999, "montant": 0}]})
    assert next(x for x in chef.post(f"/api/tiers/{k}/frais", {"frais": [{"fraisId": f["id"], "montant": 100000}]}, **H).json() if x["fraisId"] == f["id"])["montant"] == 100000
    assert next(x for x in chef.get(f"/api/tiers/{T('0412-000319')}/frais").json() if x["fraisId"] == f["id"])["montant"] == 200000
    assert chef.delete(f"/api/parametrage/frais-adhesion/{pid}", **H).status_code == 200
    assert chef.delete(f"/api/parametrage/frais/{f['id']}", **H).status_code == 200
    assert [x["libelle"] for x in chef.get("/api/parametrage/frais").json()["frais"]] == ["Part sociale standard"]   # registre S16-11


def test_groupe_solidaire(clients):
    agent = clients["agent"]
    connecter(agent, "bkasongo")
    def refus(route, corps, methode="post"):
        r = getattr(agent, methode)(route, corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    lu = agent.get("/api/groupes-solidaires").json()
    import re
    assert re.fullmatch(r"0412-\d{6}", lu["codeSuivant"]) and lu["groupes"] == []          # règle S15 en place (registre S44-2)
    assert "nom groupe" in refus("/api/groupes-solidaires", {"code": lu["codeSuivant"], "nom": ""})
    g = agent.post("/api/groupes-solidaires", {"code": lu["codeSuivant"], "nom": "Grp Kinsaku"}, **H).json()
    assert g["code"] == lu["codeSuivant"] and agent.get("/api/groupes-solidaires").json()["codeSuivant"] > g["code"]   # le compteur a avancé
    assert "existe déjà" in refus("/api/groupes-solidaires", {"code": lu["codeSuivant"], "nom": "Autre"})
    k, m = T("0412-000318"), T("0412-000319")
    lu = agent.post(f"/api/groupes-solidaires/{g['id']}/membres", {"tiersIds": [k, m]}, **H).json()
    assert [x["tiersId"] for x in lu["membres"]] == [k, m] and lu["groupes"][0]["agence"] == "Matete"
    assert "déjà membre" in refus(f"/api/groupes-solidaires/{g['id']}/membres", {"tiersIds": [k]})
    g2 = agent.post("/api/groupes-solidaires", {"code": "GS-2", "nom": "Grp Matete"}, **H).json()
    assert "déjà membre du groupe « Grp Kinsaku »" in refus(f"/api/groupes-solidaires/{g2['id']}/membres", {"tiersIds": [k]})   # registre S44-1
    assert agent.delete(f"/api/groupes-solidaires/{g2['id']}", **H).status_code == 200
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
    # Registre T02 (manuel p. 12) : suppression logique ; la ligne reste en base, datée et signée ; le libellé peut être repris
    from noyau.bd import une
    r = une("select supprime_le, supprime_par from type_procuration where id = %s", (t["id"],))
    assert r and r["supprime_le"] is not None and r["supprime_par"] is not None
    assert agent.post("/api/types-procuration", {"libelle": "Procuration générale"}, **H).status_code == 200
    assert agent.delete(f"/api/types-procuration/{t['id']}", **H).status_code == 422   # une ligne supprimée ne se supprime pas deux fois


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



COUPURES = {"CDF": [20000, 10000, 5000, 1000, 500, 200, 100, 50], "USD": [100, 50, 20, 10, 5, 1]}


def vider_comptes(chef, caisse, tid):
    """Apurement avant la résiliation (registre S48-1) : retrait du solde de chaque compte au guichet (S74)"""
    for c in chef.get(f"/api/tiers/{tid}/comptes").json():
        if c["solde"]:
            reste, coupures = c["solde"] // 100, {}
            for v in COUPURES[c["devise"]]:
                if reste >= v:
                    coupures[str(v)], reste = reste // v, reste % v
            r = caisse.post("/api/guichet/retraits", {"cle": cle(), "compteId": c["id"], "montant": c["solde"], "coupures": coupures, "mandataire": ""}, **H)
            assert r.status_code == 200 and r.json()["statut"] == "validee", r.content


def test_resiliation(clients, journee):
    chef, agent, caisse = clients["chef"], clients["agent"], clients["caisse"]
    k = T("0412-000320")
    def refus(c, corps, tid=k):
        r = c.post(f"/api/tiers/{tid}/resiliation", corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Droit manquant" in refus(agent, {"motif": "AUTRES"})
    assert "motif" in refus(chef, {"motif": ""})
    assert "Motif inconnu" in refus(chef, {"motif": "Fâché"})
    assert "compte à solder : 0412-000320-02" in refus(chef, {"motif": "Raisons personnelles"})   # registre S48-1 ; loi 002/2002, art. 27
    vider_comptes(chef, caisse, k)
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
    assert agent.get(f"/api/tiers/{k}/images").json() == {"photo": png, "signature": png, "copiePiece": None, "justificatifAdresse": None}
    # écart E03 : copie de la pièce et justificatif d'adresse (Instr. BCC 15, art. 12 et 29)
    assert agent.post(f"/api/tiers/{k}/specimen", {"copiePiece": png, "justificatifAdresse": png}, **H).status_code == 200
    assert agent.get(f"/api/tiers/{k}/images").json() == {"photo": png, "signature": png, "copiePiece": png, "justificatifAdresse": png}
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


def test_ed_divers_guichet(clients, journee):
    """S78 (p. 89 et 90) : opération du référentiel selon le sens, montant par devise avec billetage, écriture 570 contre le compte (registre S78-1 à S78-6)"""
    caisse, chef = clients["caisse"], clients["chef"]
    connecter(chef, "jpmukendi")
    p = chef.post("/api/operations-diverses", {"sens": "PRODUIT", "compte": "7790", "statut": "ACTIF", "libelle": "Vente de livret d'épargne"}, **H).json()["operations"][0]
    c = next(x for x in chef.post("/api/operations-diverses", {"sens": "CHARGE", "compte": "671", "statut": "ACTIF", "libelle": "Frais de transport"}, **H).json()["operations"]
             if x["sens"] == "CHARGE")
    op = lambda t, oid, montants, coupures, libelle="": caisse.post("/api/guichet/ed-divers", {"cle": cle(), "typeOperation": t, "operationId": oid, "montants": montants,
                                                                                            "coupures": coupures, "libelle": libelle}, **H)
    def refus(*a):
        r = op(*a); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "pas proposée en encaissement" in refus("ENCAISSEMENT", c["id"], {"CDF": 100000}, {"CDF": {"1000": 1}})
    assert "Montant" in refus("ENCAISSEMENT", p["id"], {}, {})
    assert "billetage" in refus("ENCAISSEMENT", p["id"], {"CDF": 200000}, {"CDF": {"1000": 1}})
    o = op("ENCAISSEMENT", p["id"], {"CDF": 200000}, {"CDF": {"1000": 2}}, "Livret Kalala").json()
    assert [o["type"], o["tiersId"], o["statut"]] == ["ed_encaissement", None, "validee"]
    r = caisse.get(f"/api/operations/{o['id']}/recu").json()
    assert sorted((l["compte"], l["sens"], l["montant"]) for l in r["lignes"]) == [("570", "D", 200000), ("7790", "C", 200000)]
    th = lambda: caisse.get(f"/api/caisses/{o['sessionId']}/theorique?devise=CDF").json().get("1000", 0)
    avant = th()
    assert op("DECAISSEMENT", c["id"], {"CDF": 100000}, {"CDF": {"1000": 1}}).json()["type"] == "ed_decaissement"
    assert th() == avant - 1
    assert "coupures en caisse" in refus("DECAISSEMENT", c["id"], {"USD": 10000000}, {"USD": {"100": 1000}})
    assert balance_equilibree(caisse)


def test_transferts(clients, journee):
    """S81 (p. 92 et 93) : caisse vers caisse par 579, caisse vers banque par 591, comptes d'attente soldés, coupures déplacées (registre S81-1 à S81-7)"""
    _, s = journee
    chef, caisse = clients["chef"], clients["caisse"]
    g1 = ident("select id from guichet where code = 'G1'")
    chef_id = ident("select id from utilisateur where login = 'jpmukendi'")
    assert chef.post("/api/affectations-guichets", {"utilisateurId": chef_id, "guichetId": g1, "voirSolde": True}, **H).status_code == 200
    s1 = chef.post("/api/caisses", {"guichetId": g1}, **H).json()
    l = chef.post("/api/banques", {"code": "RAW", "libelle": "Rawbank", "compteLiaison": "5601", "adresse": "Kinshasa"}, **H).json()
    cb = chef.post("/api/banques/comptes", {"banqueId": l["banques"][0]["id"], "compte": "56010003", "numeroBancaire": "R-CDF-1", "devise": "CDF",
                                            "journalId": l["journaux"][0]["id"], "contactNom": "Mutombo"}, **H).json()["comptes"][0]
    n = lambda sid: caisse.get(f"/api/caisses/{sid}/theorique?devise=CDF").json().get("1000", 0)
    a2, a1 = n(s["id"]), n(s1["id"])
    vc = lambda corps: caisse.post("/api/caisse/transferts/caisse", {"cle": cle(), **corps}, **H)
    vb = lambda corps: caisse.post("/api/caisse/transferts/banque", {"cle": cle(), **corps}, **H)
    def refus(r):
        assert r.status_code == 422, r.content; return r.json()["message"]
    base = {"origineSessionId": s["id"], "destinationSessionId": s1["id"]}
    assert "une autre caisse" in refus(vc({**base, "destinationSessionId": s["id"], "montants": {"CDF": 200000}, "coupures": {"CDF": {"1000": 2}}}))
    assert "billetage" in refus(vc({**base, "montants": {"CDF": 200000}, "coupures": {"CDF": {"1000": 1}}}))
    assert "Pas assez de coupures" in refus(vc({**base, "montants": {"CDF": 10000000000}, "coupures": {"CDF": {"1000": 100000}}}))
    o = vc({**base, "montants": {"CDF": 200000}, "coupures": {"CDF": {"1000": 2}}}).json()
    assert o["type"] == "transfert_sortie" and (n(s["id"]), n(s1["id"])) == (a2 - 2, a1 + 2)
    assert ident("""select coalesce(sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end), 0) from ligne_ecriture l join compte c on c.id = l.compte_id
                    where c.numero = '579' and l.ecriture_id = %s""", (o["ecritureId"],)) == 0
    assert "No de chèque" in refus(vb({"sessionId": s["id"], "compteBancaireId": cb["id"], "montant": 100000, "cheque": "", "coupures": {"1000": 1}}))
    solde = lambda: next(c for c in caisse.get("/api/caisse/transferts").json()["comptes"] if c["id"] == cb["id"])["solde"]
    avant = solde()
    v = vb({"sessionId": s["id"], "compteBancaireId": cb["id"], "montant": 100000, "cheque": "0001234", "coupures": {"1000": 1}}).json()
    assert v["type"] == "versement_banque" and solde() == avant + 100000 and n(s["id"]) == a2 - 3
    assert balance_equilibree(caisse)


def test_journal_caisse(clients, journee):
    """S83 (p. 95) : lignes du compte du guichet, débit à l'entrée d'espèces, crédit à la sortie (PCCI, compte 57), N° Client, période"""
    caisse, agent = clients["caisse"], clients["agent"]
    d = caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-01"), "montant": 10000, "coupures": {"100": 1}, "mandataire": ""}, **H).json()
    assert caisse.get("/api/caisse/journal/contexte").json()["guichetId"] == G2()
    piece = caisse.get(f"/api/operations/{d['id']}/recu").json()["piece"]
    l = caisse.get(f"/api/caisse/journal?guichetId={G2()}&du=2026-11-05&au=2026-11-05").json()
    x = next(x for x in l if x["piece"] == piece)
    assert (x["date"], x["client"], x["debit"], x["credit"], x["devise"]) == ("2026-11-05", "0412-000318", 10000, 0, "USD")
    assert caisse.get(f"/api/caisse/journal?guichetId={G2()}&du=2026-11-06&au=2026-11-06").json() == []
    assert agent.get(f"/api/caisse/journal?guichetId={G2()}&du=2026-11-05&au=2026-11-05").status_code == 403


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
    vider_comptes(chef, caisse, m)
    assert chef.post(f"/api/tiers/{m}/resiliation", {"motif": "AUTRES"}, **H).status_code == 200   # les parts restent, remboursées après (art. 22 et 27)
    assert op({"tiersId": m, "sens": "retrait", "nombre": 1, "coupures": {"1000": 4}}).json()["statut"] == "validee"
    assert "résilié" in refus({"tiersId": m, "sens": "achat", "nombre": 1, "coupures": {"1000": 4}})
    # Compte de parts selon le type de client (PCCI, compte 103) : une entreprise en 1032
    e = agent.post("/api/tiers/entreprises", {**FICHE, "typeClient": "Entreprises privées", "zone": "Matete", "nom": "Boulangerie Kinsaku SARL",
        "formeJuridique": "Société à responsabilité limitée", "registre": "R1", "adresse": "Matete", "signataires": []}, **H).json()
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
    assert "Droit manquant" in refus(agent, "/api/banques", b)
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


def test_operations_banque(clients, journee):
    """S52 (manuel p. 60 et 61) : trois onglets ; opération saisie, en attente du visa (S57) ; pièce donnée à la comptabilisation (registre S52-2)"""
    chef, compta, agent = clients["chef"], clients["compta"], clients["agent"]
    bid = chef.post("/api/banques", {"code": "RAW", "libelle": "Rawbank", "compteLiaison": "5601", "adresse": ""}, **H).json()["banques"][0]["id"]
    j = chef.get("/api/banques").json()["journaux"][0]["id"]
    for compte, num, dev in (("56010001", "R-USD-1", "USD"), ("56010002", "R-USD-2", "USD"), ("56010003", "R-CDF-1", "CDF")):
        r = chef.post("/api/banques/comptes", {"banqueId": bid, "compte": compte, "numeroBancaire": num, "devise": dev, "journalId": j, "contactNom": "Mutombo"}, **H)
        assert r.status_code == 200, r.content
    lu = compta.get("/api/banque/operations").json()
    usd1, usd2, cdf1 = [next(c["id"] for c in lu["comptes"] if c["numero"] == n) for n in ("R-USD-1", "R-USD-2", "R-CDF-1")]
    assert lu["date"] == "2026-11-05" and {c["solde"] for c in lu["comptes"]} == {0} and lu["guichets"]
    def refus(corps, c=compta):
        r = c.post("/api/banque/operations", {"cle": cle(), "date": "2026-11-05", **corps}, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    enc = {"type": "encaissement", "compteBancaireId": usd1, "compte": "727", "libelle": "Commission reçue", "montant": 50000}
    assert "Droit manquant" in refus(enc, agent)
    assert "n'est pas un compte du plan" in refus({**enc, "compte": "7"})
    assert "onglets de virement" in refus({**enc, "compte": "5601"})
    assert "Montant" in refus({**enc, "montant": 0})
    assert "dépasser la journée" in refus({**enc, "date": "2026-11-06"})
    k = cle()
    o = compta.post("/api/banque/operations", {"cle": k, "date": "2026-11-05", **enc}, **H).json()
    assert (o["statut"], o["piece"], o["devise"], o["montant"]) == ("saisie", "", "USD", 50000)
    assert compta.post("/api/banque/operations", {"cle": k, "date": "2026-11-05", **enc}, **H).json()["id"] == o["id"]      # même clé : même opération
    compta.post("/api/banque/chequiers", {"cle": cle(), "compteBancaireId": usd1, "nbFeuillets": 25, "debut": "0000101", "barre": True}, **H)   # S60
    d = compta.post("/api/banque/operations", {"cle": cle(), "date": "2026-11-05", **enc, "type": "decaissement", "compte": "671", "cheque": "0000123"}, **H).json()
    assert (d["type"], d["cheque"]) == ("decaissement", "0000123")
    assert "caisse" in refus({"type": "banque_caisse", "compteBancaireId": cdf1, "montant": 100000})
    assert compta.post("/api/banque/operations", {"cle": cle(), "date": "2026-11-05", "type": "banque_caisse", "compteBancaireId": cdf1, "montant": 100000,
                                                  "guichetId": G2()}, **H).json()["statut"] == "saisie"
    vir = {"type": "banque_banque", "compteBancaireId": usd1, "montant": 20000}
    assert "autre compte" in refus({**vir, "compteBancaireDestId": usd1})
    assert "deux devises" in refus({**vir, "compteBancaireDestId": cdf1})
    assert compta.post("/api/banque/operations", {"cle": cle(), "date": "2026-11-05", **vir, "compteBancaireDestId": usd2}, **H).json()["libelle"] == "Virement banque vers banque"
    assert ident("select count(*) from operation_banque where statut = 'saisie'") == 4
    assert ident("select count(*) from ecriture e join ligne_ecriture l on l.ecriture_id = e.id join compte c on c.id = l.compte_id where c.numero like '5601%%'") == 0   # rien n'est comptabilisé à la saisie


def test_virement_prelevement(clients, journee):
    """S53 (manuel p. 61) : entre le compte d'un client et un compte bancaire ; saisi en attente du visa (S57) ; registre S53-1 à S53-4"""
    chef, compta = clients["chef"], clients["compta"]
    bid = chef.post("/api/banques", {"code": "RAW", "libelle": "Rawbank", "compteLiaison": "5601", "adresse": ""}, **H).json()["banques"][0]["id"]
    j = chef.get("/api/banques").json()["journaux"][0]["id"]
    usd = next(c["id"] for c in chef.post("/api/banques/comptes", {"banqueId": bid, "compte": "56010001", "numeroBancaire": "R-USD-1", "devise": "USD", "journalId": j,
                                                                  "contactNom": "Mutombo"}, **H).json()["comptes"])
    cusd, ccdf = C("0412-000318-01"), C("0412-000318-02")
    dispo = next(c for c in compta.get(f"/api/tiers/{T('0412-000318')}/comptes").json() if c["id"] == cusd)["disponible"]
    base = {"date": "2026-11-05", "compteBancaireId": usd, "compteDepotId": cusd, "libelle": "Salaire", "montant": 30000}
    def refus(corps, route="/api/banque/virements"):
        r = compta.post(route, {"cle": cle(), **base, **corps}, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Type d'opération inconnu" in refus({"type": "virement_client"}, "/api/banque/operations")       # chaque écran sa route, donc son droit
    assert "Type d'opération inconnu" in refus({"type": "encaissement", "compte": "727"})
    assert "libellé opération" in refus({"type": "virement_client", "libelle": ""})
    assert "même devise" in refus({"type": "virement_client", "compteDepotId": ccdf})
    assert "disponible insuffisant" in refus({"type": "prelevement_client", "montant": dispo + 1})
    v = compta.post("/api/banque/virements", {"cle": cle(), **base, "type": "virement_client"}, **H).json()
    assert (v["statut"], v["compteDepotId"], v["libelle"]) == ("saisie", cusd, "Salaire")
    p = compta.post("/api/banque/virements", {"cle": cle(), **base, "type": "prelevement_client", "montant": dispo}, **H).json()
    assert p["type"] == "prelevement_client"
    assert "disponible insuffisant" in refus({"type": "prelevement_client", "montant": 1})      # le prélèvement saisi réserve le disponible


def test_adhesion_par_banque(clients, journee):
    """S56 (manuel p. 64) : adhésion payée par virement sur un compte bancaire en CDF ; saisie en attente du visa (S57) ; registre S56-1 à S56-3"""
    chef, compta, agent, caisse = clients["chef"], clients["compta"], clients["agent"], clients["caisse"]
    bid = chef.post("/api/banques", {"code": "RAW", "libelle": "Rawbank", "compteLiaison": "5601", "adresse": ""}, **H).json()["banques"][0]["id"]
    jn = chef.get("/api/banques").json()["journaux"][0]["id"]
    def banque(compte, num, dev):
        l = chef.post("/api/banques/comptes", {"banqueId": bid, "compte": compte, "numeroBancaire": num, "devise": dev, "journalId": jn, "contactNom": "Mutombo"}, **H).json()
        return next(c["id"] for c in l["comptes"] if c["numeroBancaire"] == num)
    cdf, usd = banque("56010001", "R-CDF-1", "CDF"), banque("56010002", "R-USD-1", "USD")
    t = agent.post("/api/tiers", {**FICHE, "nom": "Tshala", "pieceType": "Passeport", "pieceNumero": "OP2"}, **H).json()
    base = {"date": "2026-11-05", "tiersId": t["id"], "parts": 2, "depot": 50000, "compteBancaireId": cdf}
    def refus(corps, c=compta):
        r = c.post("/api/banque/adhesions", {"cle": cle(), **base, **corps}, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "visa" in refus({})                                       # client pas encore visé
    assert chef.post(f"/api/tiers/{t['id']}/visa", **H).status_code == 200
    assert "Droit manquant" in refus({}, agent)
    assert "Au moins une part" in refus({"parts": 0})
    assert "Premier dépôt invalide" in refus({"depot": -1})
    assert "en CDF" in refus({"compteBancaireId": usd})
    ap = compta.get(f"/api/banque/adhesions/apercu?tiersId={t['id']}&parts=2&depot=50000").json()
    assert ap["numeroCompte"].startswith(t["numero"]) and ap["total"] == 2 * ap["valeurPart"] + 50000 + sum(f["montant"] for f in ap["frais"])
    o = compta.post("/api/banque/adhesions", {"cle": cle(), **base}, **H).json()
    assert (o["type"], o["statut"], o["montant"], o["parts"], o["premierDepot"], o["devise"]) == ("adhesion_banque", "saisie", ap["total"], 2, 50000, "CDF")
    assert "déjà en cours" in refus({})
    assert ident("select count(*) from compte_depot where tiers_id = %s", (t["id"],)) == 0           # le compte s'ouvre à la validation, pas à la saisie
    assert "Droit manquant" in refus({}, caisse)


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
    corps = {"agenceId": ag, "code": "G3", "designation": "Caisse 3", "typeGuichet": "SECONDAIRE", "journalId": jca,
             "plafonds": {"CDF": {"maximum": 0, "retrait": 0}, "USD": {"maximum": 0, "retrait": 0}}, "compteGuichet": "570", "compteLiaison": "579", "billetage": False, "actif": False}
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
    assert "(USD)" in refus({**corps, "code": "G4", "plafonds": {"CDF": {"maximum": 0, "retrait": 0}}})   # registre S08-3 : une valeur par devise tenue
    m = next(g for g in chef.post(f"/api/guichets/{g3['id']}", {**corps, "designation": "Caisse trois",
             "plafonds": {**corps["plafonds"], "USD": {"maximum": 500000, "retrait": 0}}}, **H).json()["guichets"] if g["id"] == g3["id"])
    assert (m["nom"], m["plafonds"]["USD"]["maximum"]) == ("Caisse trois", 500000)          # Modifier, registre S08-8
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


def test_professions_s14b(clients):
    """S14b : la liste Profession du paramétrage alimente fiche, prospect et agents (registre S14b-2) ; démonstration tirée du ROME/RDC (S14b-1)"""
    chef, agent = clients["chef"], clients["agent"]
    connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/listes/profession", **H).json()["lignes"]
    assert {"code": "6330-01", "libelle": "Agriculteur"}.items() <= next(x for x in l if x["libelle"] == "Agriculteur").items()
    assert any(x["code"] == "COM" and x["libelle"] == "Commerçant" for x in l)
    p = {"nom": "Lukaku", "prenom": "Rose", "naissance": "1992-02-02", "lieuNaissance": "Kinshasa", "sexe": "F", "profession": "Vulcanisateur",
         "pays": "République démocratique du Congo", "ville": "Kinshasa", "quartier": "Kinsaku", "telephone": "+243 810 000 222"}
    r = agent.post("/api/prospects", p, **H); assert r.status_code == 422 and "Profession inconnue" in r.json()["message"]
    chef.post("/api/listes/profession", {"code": "7213-90", "libelle": "Vulcanisateur"}, **H)
    assert "Vulcanisateur" in agent.get("/api/referentiel", **H).json()["professions"]
    assert agent.post("/api/prospects", p, **H).status_code == 200


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


def test_simulation_credit(clients, journee):
    """S84 (p. 111) : échéance constante, méthode dégressive (Instr. BCC 38, art. 11) ; taux mensuel ; intérêts du différé répartis ; TEG proportionnel
    et actuariel avec frais et épargne obligatoire (Instr. BCC 38, art. 2, 4, 6, 9, annexe) ; bornes du produit (registre S84-1 à S84-9)"""
    chef, agent = clients["chef"], clients["agent"]
    pid = chef.post("/api/produits-credit", PRODUIT, **H).json()["produits"][0]["id"]
    sim = lambda **k: agent.post("/api/credit/simulation", {"produitId": pid, "montant": 100000000, "duree": 12, **k}, **H)
    assert "entre 3 et 12 mois" in sim(duree=24).json()["message"]
    assert "Montant du prêt" in sim(montant=100).json()["message"]
    r = sim().json()
    assert r["nombreTraites"] == 12 and r["echeanceConstante"] == 9748713                     # 1 000 000 × 2,5 % / (1 − 1,025^−12)
    assert sum(l["capital"] for l in r["echeancier"]) == 100000000 and r["echeancier"][-1]["capitalFin"] == 0
    assert r["echeancier"][0]["interet"] == 2500000 and r["frais"] == 1000000 and r["epargneObligatoire"] == 10000000
    assert (r["tegR"], r["tegA"]) == (38.49, 46.07)                                          # frais 1 % et épargne 10 % compris
    d = sim(differe=2).json()
    assert d["interetDiffere"] == 4000000 and sum(l["interet"] for l in d["echeancier"]) == r["totalInteret"] + 4000000
    assert d["dateDebut"] > r["dateDebut"]
    assert chef.post("/api/credit/simulation", {"produitId": pid, "montant": 100000000, "duree": 12}, **H).status_code == 403


def test_analyse_financiere(clients, journee):
    """S85 (p. 112) : revenu net, capacité de remboursement (échéance mensuelle de la simulation S84), bilan, ratios, garanties ; avis obligatoire (registre CR-11, S85)"""
    chef, agent = clients["chef"], clients["agent"]
    pid = chef.post("/api/produits-credit", PRODUIT, **H).json()["produits"][0]["id"]
    D = {"revenus": 300000000, "achats": 150000000, "chargesExploitation": 50000000, "chargesFamiliales": 30000000, "autresEcheances": 0,
         "tresorerie": 20000000, "stocks": 80000000, "creances": 0, "immobilisations": 100000000, "dettesCourtTerme": 40000000, "dettesLongTerme": 0,
         "garanties": [{"type": "Gage", "description": "Moto", "valeur": 150000000}]}
    a = {"type": "developpee", "tiersId": T("0412-000318"), "produitId": pid, "montant": 100000000, "duree": 12, "donnees": D, "avis": "favorable"}
    r = agent.post("/api/credit/analyses", {**a, "avis": ""}, **H)
    assert r.status_code == 422 and "Avis" in r.json()["message"]
    assert "entre 3 et 12 mois" in agent.post("/api/credit/analyses", {**a, "duree": 24}, **H).json()["message"]
    v = agent.post("/api/credit/analyses", a, **H).json()
    assert v["numero"] == "AF000001" and v["resultats"]["echeanceMensuelle"] == 9748713 and v["resultats"]["revenuNet"] == 70000000
    assert (v["resultats"]["capacite"], v["resultats"]["endettement"], v["resultats"]["liquidite"], v["resultats"]["couverture"]) == (13.93, 25.0, 250.0, 150.0)
    assert agent.get(f"/api/credit/analyses?tiersId={T('0412-000318')}", **H).json()["analyses"][0]["numero"] == "AF000001"
    assert clients["caisse"].post("/api/credit/analyses", a, **H).status_code == 403


def test_dossier_credit(clients, journee):
    """S86 à S88 (p. 113 et 114) : demande avec double saisie, contrôle par un autre utilisateur, approbation : Centrale des risques (Instr. BCC 05),
    fonds propres et plafond par emprunteur (Instr. BCC 002, art. 29 ; loi 002/2002, art. 59), apparenté (Instr. BCC 51) ; registre S86 à S88, CR-2, CR-3, CR-14"""
    chef, agent = clients["chef"], clients["agent"]
    pid = chef.post("/api/produits-credit", PRODUIT, **H).json()["produits"][0]["id"]
    ctx = agent.get("/api/credit/dossiers/contexte", **H).json()
    pr = next(x for x in ctx["provinces"] if x["nom"] == "Kinshasa")["id"]; vi = next(x for x in ctx["villes"] if x["provinceId"] == pr)["id"]
    k = T("0412-000318")                                                          # Kalala, une femme
    e = {"nbHommes": 0, "nbFemmes": 1, "montantHommes": 0, "montantFemmes": 100000000, "nbGroupes": 0}
    d = {"produitId": pid, "tiersId": k, "duree": 12, "provinceId": pr, "villeId": vi, **e, "ressaisie": e}
    refus = lambda c, url, x: c.post(url, x, **H).json()["message"]
    assert "ressaisis" in refus(agent, "/api/credit/dossiers", {**d, "ressaisie": {**e, "montantFemmes": 90000000}})
    assert "de son sexe" in refus(agent, "/api/credit/dossiers", {**d, "nbHommes": 1, "nbFemmes": 0, "montantHommes": 100000000, "montantFemmes": 0,
                                                                  "ressaisie": {**e, "nbHommes": 1, "nbFemmes": 0, "montantHommes": 100000000, "montantFemmes": 0}})
    x = agent.post("/api/credit/dossiers", d, **H).json()
    assert (x["numero"], x["statut"], x["montant"]) == ("DC000001", "saisie", 100000000)
    assert "Quatre yeux" in refus(agent, f"/api/credit/dossiers/{x['id']}/controle", {"effectif": 1, "nbGroupes": 0, "montant": 100000000})
    assert "ne correspondent pas" in refus(chef, f"/api/credit/dossiers/{x['id']}/controle", {"effectif": 1, "nbGroupes": 0, "montant": 90000000})
    assert chef.post(f"/api/credit/dossiers/{x['id']}/controle", {"effectif": 1, "nbGroupes": 0, "montant": 100000000}, **H).json()["statut"] == "controlee"
    a = {"montantApprouve": 100000000, "consultationCrLe": "2026-11-05", "consultationCrRef": "CR-2026-0001"}
    assert "consentement" in refus(chef, f"/api/credit/dossiers/{x['id']}/approbation", a)
    agent.post(f"/api/tiers/{k}/consentements", {"code": "CR", "dateDebut": "2026-01-01", "dateFin": "", "commentaire": ""}, **H)
    assert "Fonds propres prudentiels non saisis" in refus(chef, f"/api/credit/dossiers/{x['id']}/approbation", a)
    chef.post("/api/credit/fonds-propres", {"dateArrete": "2026-10-31", "montant": 500000000}, **H)            # 5 000 000 CDF : 10 % = 500 000 CDF
    assert "Plafond par emprunteur" in refus(chef, f"/api/credit/dossiers/{x['id']}/approbation", a)
    chef.post("/api/conformite/apparentes/" + str(k), {"lien": "personnel"}, **H)
    assert "Conseil d'administration" in refus(chef, f"/api/credit/dossiers/{x['id']}/approbation", {**a, "accordBccRef": "BCC/2026/12"})
    chef.post("/api/conformite/apparentes/" + str(k), {"lien": None}, **H)
    chef.post("/api/credit/fonds-propres", {"dateArrete": "2026-11-01", "montant": 100000000000}, **H)
    v = chef.post(f"/api/credit/dossiers/{x['id']}/approbation", a, **H).json()
    assert (v["statut"], v["montantApprouve"], v["consultationCrRef"]) == ("approuvee", 100000000, "CR-2026-0001")
    assert agent.get("/api/credit/dossiers?statut=approuvee", **H).json()[0]["numero"] == "DC000001"


def credit_approuve(clients, produit=None):
    """Produit, demande de Kalala (1 000 000 CDF sur 12 mois), contrôle et approbation : la demande approuvée, prête pour la mise en place (S89)"""
    chef, agent = clients["chef"], clients["agent"]
    pid = chef.post("/api/produits-credit", produit or PRODUIT, **H).json()["produits"][0]["id"]
    ctx = agent.get("/api/credit/dossiers/contexte", **H).json()
    pr = next(x for x in ctx["provinces"] if x["nom"] == "Kinshasa")["id"]; vi = next(x for x in ctx["villes"] if x["provinceId"] == pr)["id"]
    k = T("0412-000318")
    e = {"nbHommes": 0, "nbFemmes": 1, "montantHommes": 0, "montantFemmes": 100000000, "nbGroupes": 0}
    x = agent.post("/api/credit/dossiers", {"produitId": pid, "tiersId": k, "duree": 12, "provinceId": pr, "villeId": vi, **e, "ressaisie": e}, **H).json()
    chef.post(f"/api/credit/dossiers/{x['id']}/controle", {"effectif": 1, "nbGroupes": 0, "montant": 100000000}, **H)
    agent.post(f"/api/tiers/{k}/consentements", {"code": "CR", "dateDebut": "2026-01-01", "dateFin": "", "commentaire": ""}, **H)
    chef.post("/api/credit/fonds-propres", {"dateArrete": "2026-10-31", "montant": 100000000000}, **H)
    a = chef.post(f"/api/credit/dossiers/{x['id']}/approbation", {"montantApprouve": 100000000, "consultationCrLe": "2026-11-05", "consultationCrRef": "CR-1"}, **H)
    assert a.status_code == 200, a.content
    return pid, x["id"], k


def objet_credit(chef) -> int:
    o = ident("select id from credit_objet where libelle = 'Achat de marchandises'")
    if o:
        return o
    t = chef.get("/api/credit-referentiels/types_objet", **H).json()
    sid = next(iter(t["options"].values()))[0]["id"]
    tid = chef.post("/api/credit-referentiels/types_objet", {"libelle": "Commerce", "secteurId": sid}, **H).json()["lignes"][0]["id"]
    return chef.post("/api/credit-referentiels/objets", {"libelle": "Achat de marchandises", "typeObjetId": tid}, **H).json()["lignes"][0]["id"]


def test_mise_en_place(clients, journee):
    """S89 (p. 113 et 114) : crédit créé depuis la demande approuvée, échéancier et TEG (Instr. BCC 38, art. 3 et 5), comptes d'épargne obligatoire,
    objet et zone obligatoires, numéro agence/produit/rang (registre S89-1 à S89-9, CR-6, CR-24)"""
    chef, agent = clients["chef"], clients["agent"]
    _, did, k = credit_approuve(clients)
    objet = objet_credit(chef)
    ctx = agent.get("/api/credit/mise-en-place/contexte", **H).json()
    a = agent.post(f"/api/credit/mise-en-place/{did}/apercu", {}, **H).json()
    assert a["simulation"]["epargneObligatoire"] == 10000000 and a["simulation"]["tegA"] == 46.07
    ce = next(c["id"] for c in a["comptes"])
    m = {"compteEpargneId": ce, "objetId": objet, "zoneId": ctx["zones"][0]["id"], "agentId": a["demande"]["agentId"]}
    r = agent.post(f"/api/credit/mise-en-place/{did}", {**m, "objetId": None}, **H)
    assert r.status_code == 422 and "Objet" in r.json()["message"]
    r = agent.post(f"/api/credit/mise-en-place/{did}", {**m, "compteEpargneId": None}, **H)
    assert "épargne obligatoire" in r.json()["message"]
    c = agent.post(f"/api/credit/mise-en-place/{did}", m, **H).json()
    assert (c["numero"], c["statut"], c["montant"], c["nombreTraites"], c["tegA"]) == ("0412/L001/00001", "mis_en_place", 100000000, 12, 46.07)
    assert sum(e["capital"] for e in c["echeancier"]) == 100000000 and c["epargneObligatoire"] == 10000000 and c["frais"] == 1000000
    assert agent.get("/api/credit/dossiers?statut=mise_en_place", **H).json()[0]["numero"] == "DC000001"
    assert "pas en attente" in agent.post(f"/api/credit/mise-en-place/{did}", m, **H).json()["message"]


def credit_mis_en_place(clients, produit=None) -> int:
    """Crédit de Kalala mis en place par l'agent (S89), en attente des visas"""
    chef, agent = clients["chef"], clients["agent"]
    _, did, _ = credit_approuve(clients, produit)
    objet = objet_credit(chef)
    a = agent.post(f"/api/credit/mise-en-place/{did}/apercu", {}, **H).json()
    zone = agent.get("/api/credit/mise-en-place/contexte", **H).json()["zones"][0]["id"]
    c = agent.post(f"/api/credit/mise-en-place/{did}", {"compteEpargneId": a["comptes"][0]["id"], "objetId": objet, "zoneId": zone, "agentId": a["demande"]["agentId"]}, **H)
    assert c.status_code == 200, c.content
    return c.json()["id"]


def test_visas_credit(clients, journee):
    """S90 à S92 (p. 114 et 115) : trois visas dans l'ordre (CR-5), quatre yeux, commission de crédit d'une COOPEC à l'unanimité (loi 002/2002, art. 41 à 43 ;
    CR-4), historique, crédits validés non débloqués"""
    chef, agent, compta = clients["chef"], clients["agent"], clients["compta"]
    cid = credit_mis_en_place(clients)
    file = lambda c, n: [x["id"] for x in c.get(f"/api/credit/visas?niveau={n}", **H).json()]
    assert file(chef, "responsable_credit") == [cid] and file(chef, "comite") == []
    assert "Quatre yeux" in agent.post(f"/api/credit/visas/{cid}/responsable_credit", {"avis": "accepte"}, **H).json()["message"]
    assert "attend pas ce visa" in chef.post(f"/api/credit/visas/{cid}/comite", {"avis": "accepte"}, **H).json()["message"]
    assert chef.post(f"/api/credit/visas/{cid}/responsable_credit", {"avis": "accepte"}, **H).json()["avis"] == "accepte"
    assert "trois membres" in chef.post(f"/api/credit/visas/{cid}/comite", {"avis": "accepte"}, **H).json()["message"]
    m = [{"nom": "Mbala", "avis": "accepte"}, {"nom": "Ilunga", "avis": "accepte"}, {"nom": "Kabeya", "avis": "accepte"}]
    assert chef.post(f"/api/credit/visas/{cid}/comite", {"membres": m, "referencePv": "PV-12"}, **H).json()["avis"] == "accepte"
    r = compta.post(f"/api/credit/visas/{cid}/service_financier", {"avis": "accepte"}, **H).json()
    assert r["statut"] == "vise"
    assert [x["id"] for x in chef.get("/api/credit/valides-non-debloques?du=2026-01-01&au=2026-12-31", **H).json()] == [cid]
    h = chef.get("/api/credit/visas-historique?niveau=comite&avis=accepte&du=2026-01-01&au=2026-12-31", **H).json()
    assert h[0]["numero"] == "0412/L001/00001" and h[0]["referencePv"] == "PV-12" and len(h[0]["membres"]) == 3


def test_commission_unanime(clients, journee):
    """Un seul avis contraire de la commission de crédit refuse le crédit (loi 002/2002, art. 43 ; Instr. BCC 007, art. 32)"""
    chef = clients["chef"]
    cid = credit_mis_en_place(clients)
    chef.post(f"/api/credit/visas/{cid}/responsable_credit", {"avis": "accepte"}, **H)
    m = [{"nom": "Mbala", "avis": "accepte"}, {"nom": "Ilunga", "avis": "refuse"}, {"nom": "Kabeya", "avis": "accepte"}]
    assert "motif" in chef.post(f"/api/credit/visas/{cid}/comite", {"membres": m}, **H).json()["message"]
    r = chef.post(f"/api/credit/visas/{cid}/comite", {"membres": m, "motif": "Capacité insuffisante"}, **H).json()
    assert (r["avis"], r["statut"]) == ("refuse", "refuse")


def credit_vise(clients, produit=None) -> int:
    """Crédit de Kalala mis en place (S89) et visé aux trois niveaux (S90) : prêt au déblocage"""
    chef, compta = clients["chef"], clients["compta"]
    cid = credit_mis_en_place(clients, produit)
    chef.post(f"/api/credit/visas/{cid}/responsable_credit", {"avis": "accepte"}, **H)
    m = [{"nom": n, "avis": "accepte"} for n in ("Mbala", "Ilunga", "Kabeya")]
    chef.post(f"/api/credit/visas/{cid}/comite", {"membres": m, "referencePv": "PV-1"}, **H)
    assert compta.post(f"/api/credit/visas/{cid}/service_financier", {"avis": "accepte"}, **H).json()["statut"] == "vise"
    return cid


def test_deblocage_caisse(clients, journee):
    """S75 (p. 86 et 87) : Encaisser frais puis Débloquer ; frais et épargne obligatoire retenus sur le prêt (CR-6) ; épargne obligatoire bloquée
    en garantie (Instr. BCC 38, art. 9) ; échéances recalées sur la journée ; octroi à déclarer à la Centrale des risques (CR-10) ; contrat (CR-12)"""
    chef, caisse, agent = clients["chef"], clients["caisse"], clients["agent"]
    _, s = journee
    assert caisse.get("/api/credit/deblocage", **H).json() == []
    cid = credit_vise(clients)
    assert [x["id"] for x in caisse.get("/api/credit/deblocage", **H).json()] == [cid]
    d = caisse.get(f"/api/credit/deblocage/{cid}", **H).json()
    assert (d["fraisEncaisses"], d["retenues"]["net"], d["retenues"]["epargneObligatoire"]) == (False, 89000000, 10000000)
    assert d["echeancierDeblocage"][0]["date"] > "2026-11-05"
    def refus(c, route, corps=None):
        r = c.post(route, corps or {}, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Encaisser frais d'abord" in refus(caisse, f"/api/guichet/deblocage/{cid}", {"cle": cle(), "coupures": {}})
    assert "Droit manquant" in refus(agent, f"/api/credit/deblocage/{cid}/frais")
    assert caisse.post(f"/api/credit/deblocage/{cid}/frais", **H).json()["fraisEncaisses"] is True
    stock = caisse.get(f"/api/caisses/{s['id']}/theorique?devise=CDF", **H).json()
    cp, reste = {}, 890000                                              # coupures en unités, montants en centimes
    for v in sorted(stock, key=int, reverse=True):
        n = min(stock[v], reste // int(v))
        if n:
            cp[v], reste = n, reste - n * int(v)
    assert reste == 0, stock
    k = cle()
    o = caisse.post(f"/api/guichet/deblocage/{cid}", {"cle": k, "coupures": cp}, **H)
    assert o.status_code == 200, o.content
    o = o.json()
    assert (o["type"], o["montant"], o["statut"]) == ("deblocage_credit", 89000000, "validee")
    assert caisse.post(f"/api/guichet/deblocage/{cid}", {"cle": k, "coupures": cp}, **H).json()["id"] == o["id"]       # même clé : même opération
    assert "pas prêt au déblocage" in refus(caisse, f"/api/guichet/deblocage/{cid}", {"cle": cle(), "coupures": cp})
    assert ident("select statut from credit where id = %s", (cid,)) == "debloque"
    assert ident("select count(*) from blocage where garantie_de = %s", (cid,)) == 1
    assert ident("select evenement from declaration_centrale where credit_id = %s", (cid,)) == "octroi"
    assert ident("""select sum(case when l.sens = 'D' then l.montant_devise else -l.montant_devise end) from ligne_ecriture l join compte c on c.id = l.compte_id
                    where l.contrat_ref = %s""", (f"credit:{cid}",)) == 100000000
    assert balance_equilibree(caisse)
    c = chef.get(f"/api/credit/credits/{cid}/contrat", **H).json()
    assert c["credit"]["numero"] == "0412/L001/00001" and c["retenues"]["net"] == 89000000 and c["penaliteAnticipation"] <= 50


def test_deblocage_banque(clients, journee):
    """S54 (p. 62) : Prélever les frais, puis Débloquer par un chèque du chéquier du compte bancaire (registre S54-2 à S54-5, S60-5)"""
    chef, compta = clients["chef"], clients["compta"]
    ids = banque_usd(chef)
    cid = credit_vise(clients)
    def refus(corps):
        r = compta.post(f"/api/banque/deblocage/{cid}", corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Prélever les frais" in refus({"compteBancaireId": ids["R-CDF-1"], "cheque": "0000001"})
    compta.post(f"/api/credit/deblocage/{cid}/frais", **H)
    assert "Banque et Compte" in refus({"cheque": "0000001"})
    assert "devise du crédit" in refus({"compteBancaireId": ids["R-USD-1"], "cheque": "0000001"})
    assert "N° chèque" in refus({"compteBancaireId": ids["R-CDF-1"], "cheque": " "})
    assert "aucun chéquier" in refus({"compteBancaireId": ids["R-CDF-1"], "cheque": "0000001"})
    compta.post("/api/banque/chequiers", {"cle": cle(), "compteBancaireId": ids["R-CDF-1"], "nbFeuillets": 25, "debut": "0000001", "barre": True}, **H)
    r = compta.post(f"/api/banque/deblocage/{cid}", {"compteBancaireId": ids["R-CDF-1"], "cheque": "0000001"}, **H)
    assert r.status_code == 200, r.content
    assert r.json()["statut"] == "debloque"
    assert ident("select (mode_deblocage, cheque_deblocage) from credit where id = %s", (cid,)) == ("banque", "0000001")
    assert balance_equilibree(compta)


def billets(stock: dict, montant: int) -> dict:
    """Coupures (en unités) qui font le montant en centimes, prises dans le stock ; plus la plus petite coupure s'il reste des centimes"""
    cp, reste = {}, montant // 100
    for v in sorted(stock, key=int, reverse=True):
        n = min(stock[v], reste // int(v))
        if n:
            cp[v], reste = n, reste - n * int(v)
    return cp, reste


def credit_debloque(clients, journee, produit=None) -> int:
    """Crédit visé puis débloqué en caisse (S75)"""
    caisse = clients["caisse"]
    cid = credit_vise(clients, produit)
    caisse.post(f"/api/credit/deblocage/{cid}/frais", **H)
    net = caisse.get(f"/api/credit/deblocage/{cid}", **H).json()["retenues"]["net"]
    cp, _ = billets(caisse.get(f"/api/caisses/{journee[1]['id']}/theorique?devise=CDF", **H).json(), net)
    assert caisse.post(f"/api/guichet/deblocage/{cid}", {"cle": cle(), "coupures": cp}, **H).status_code == 200
    return cid


def test_remboursement_caisse(clients, journee):
    """S76 (p. 87 et 88) : retard, pénalité au jour le jour (CR-7), ordre du degré (S22-3, CR-20), répartition modifiée, anticipation avec intérêts
    recalculés (Instr. BCC 38, art. 11 et 14), Tout sur le crédit, appoint au compte (S76-8), crédit soldé et garanties libérées"""
    from django.db import connection
    caisse, chef = clients["caisse"], clients["chef"]
    cid = credit_debloque(clients, journee, {**PRODUIT, "penaliteRetard": 3, "interetAnticipation": True})
    with connection.cursor() as cur:                                     # deux échéances déjà passées : la première en retard de 31 jours
        cur.execute("update echeance set date_due = (date_due - interval '2 months')::date where credit_id = %s", (cid,))
    assert [x["id"] for x in caisse.get(f"/api/credit/remboursement/clients/{T('0412-000318')}", **H).json()] == [cid]
    d = caisse.get(f"/api/credit/remboursement/{cid}", **H).json()
    e1 = d["echeancier"][0]
    assert (d["joursRetard"], d["degre"], e1["date"]) == (31, "Douteux", "2026-10-05")
    assert d["du"]["penalite"] == round((e1["capital"] + e1["interet"]) * 0.03 * 31 / 30)
    assert d["ordre"][0] == "capital"                                    # Douteux : CIPES (graine, S22-3)
    def refus(corps):
        r = caisse.post(f"/api/guichet/remboursement/{cid}", {"cle": cle(), **corps}, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "Mandataire" in refus({"montant": 5000000, "coupures": {"20000": 2, "10000": 1}})
    base = {"mandataire": "Moi-même", "montant": 5000000, "coupures": {"20000": 2, "10000": 1}}
    assert "billetage" in refus({**base, "coupures": {"20000": 2}})
    assert "dû échu" in refus({**base, "repartition": {"penalite": 5000000}})
    p = caisse.post(f"/api/credit/remboursement/{cid}/repartition", {"montant": 5000000}, **H).json()
    assert (p["capital"], p["interet"], p["capitalAnticipe"]) == (5000000, 0, 0)
    m = {"interet": 2500000, "capital": 2500000}
    o = caisse.post(f"/api/guichet/remboursement/{cid}", {"cle": cle(), **base, "repartition": m}, **H)
    assert o.status_code == 200, o.content
    assert (o.json()["type"], o.json()["montant"]) == ("remboursement_credit", 5000000)
    d = caisse.get(f"/api/credit/remboursement/{cid}", **H).json()
    assert d["capitalRestant"] == 97500000 and d["dernierPaiement"] == "2026-11-05"
    tout = d["toutSurLeCredit"]
    stock = caisse.get(f"/api/caisses/{journee[1]['id']}/theorique?devise=CDF", **H).json()
    cp, reste = billets(stock, tout)
    cp["50"] = cp.get("50", 0) + (1 if tout % 5000 else 0)              # centimes : une coupure de 50 de plus, l'appoint va au compte
    assert "au plus le reste dû" in caisse.post(f"/api/credit/remboursement/{cid}/repartition", {"montant": tout + 1}, **H).json()["message"]
    r = caisse.post(f"/api/guichet/remboursement/{cid}", {"cle": cle(), "mandataire": "Moi-même", "montant": tout, "coupures": cp}, **H)
    assert r.status_code == 200, r.content
    assert ident("select statut from credit where id = %s", (cid,)) == "solde"
    assert ident("select count(*) from blocage where garantie_de = %s and fin is null", (cid,)) == 0
    assert ident("select count(*) from declaration_centrale where credit_id = %s and evenement = 'remboursement_total'", (cid,)) == 1
    s = chef.get(f"/api/credit/credits/{cid}/situation", **H).json()
    assert len(s["reel"]) == 2 and s["reel"][1]["repartition"]["anticipation"] > 0 and s["reel"][-1]["capitalRestant"] == 0
    assert balance_equilibree(caisse)
    assert "pas en cours" in refus(base)
    assert chef.post(f"/api/credit/credits/{cid}/memos", {"texte": "Client prévenu par téléphone"}, **H).status_code == 403
    assert caisse.post(f"/api/credit/credits/{cid}/memos", {"texte": "Client prévenu"}, **H).json()[0]["texte"] == "Client prévenu"


def test_remboursement_banque(clients, journee):
    """S55 (p. 63) : remboursement sur un compte bancaire de l'institution, date de règlement au plus la journée"""
    chef, compta = clients["chef"], clients["compta"]
    ids = banque_usd(chef)
    cid = credit_debloque(clients, journee)
    def refus(corps):
        r = compta.post(f"/api/banque/remboursement/{cid}", corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    b = {"mandataire": "Moi-même", "compteBancaireId": ids["R-CDF-1"], "montant": 1000000}
    assert "devise du crédit" in refus({**b, "compteBancaireId": ids["R-USD-1"]})
    assert "pas après" in refus({**b, "dateReglement": "2026-11-06"})
    r = compta.post(f"/api/banque/remboursement/{cid}", b, **H)
    assert r.status_code == 200, r.content
    assert (r.json()["mode"], r.json()["repartition"]["capitalAnticipe"]) == ("banque", 1000000)
    assert balance_equilibree(compta)


def test_etat_credit(clients, journee):
    """S93 (p. 115 et 116) : situation des crédits sur une période (date d'approbation) ou à une date fixe ; filtres ; capital restant (registre S93-1 à S93-4)"""
    agent, caisse = clients["agent"], clients["caisse"]
    cid = credit_debloque(clients, journee)
    q = lambda **k: agent.get("/api/credit/etat", k, **H)
    r = q(du="2026-11-01", au="2026-11-05")
    assert r.status_code == 200, r.content
    x = r.json()[0]
    assert (x["id"], x["dateApprobation"], x["statut"], x["capitalRestant"], x["joursRetard"], x["degre"]) == (cid, "2026-11-05", "Débloqué", 100000000, 0, "Sains")
    assert q(du="2026-11-06", au="2026-11-30").json() == []
    assert q(mode="date", date="2026-11-05", niveau="comite").json()[0]["id"] == cid
    assert q(du="2026-11-01", au="2026-11-05", operateur=">", montant=100000000).json() == []
    assert "Date début" in q(du="2026-11-06", au="2026-11-05").json()["message"]
    assert caisse.get("/api/credit/etat", {"du": "2026-11-01", "au": "2026-11-05"}, **H).status_code == 403


def test_garanties(clients, journee):
    """S94 (p. 116 à 118) : caution bloquée sur le compte d'un autre client et suivie en hors bilan (0112/091) ; dépôt de garantie sur le compte du client ;
    libération partielle puis totale ; rapport (registre S94-1 à S94-7, CR-21)"""
    agent = clients["agent"]
    cid = credit_debloque(clients, journee)
    def refus(route, corps):
        r = agent.post(route, corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    mw, k2 = T("0412-000319"), C("0412-000319-02")
    disp = next(x for x in agent.get(f"/api/tiers/{mw}/comptes", **H).json() if x["id"] == k2)["disponible"]
    base = {"type": "caution", "cautionId": mw, "compteId": k2, "montant": 1000000}
    assert "autre client" in refus(f"/api/credit/garanties/{cid}/ajout", {**base, "cautionId": T("0412-000318"), "compteId": C("0412-000318-02")})
    assert "devise du crédit" in refus(f"/api/credit/garanties/{cid}/ajout", {**base, "compteId": C("0412-000319-01")})
    assert "disponible" in refus(f"/api/credit/garanties/{cid}/ajout", {**base, "montant": disp + 1})
    r = agent.post(f"/api/credit/garanties/{cid}/ajout", base, **H)
    assert r.status_code == 200, r.content
    s = r.json()
    assert (s["total"], s["garanties"][0]["reste"], s["piece"] != "") == (1000000, 1000000, True)
    assert next(x for x in agent.get(f"/api/tiers/{mw}/comptes", **H).json() if x["id"] == k2)["disponible"] == disp - 1000000
    assert ident("select sum(case when l.sens = 'C' then l.montant_devise else -l.montant_devise end) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero = '0112'") == 1000000
    gid = s["garanties"][0]["id"]
    assert "au plus ce qui reste" in refus(f"/api/credit/garanties/liberation/{gid}", {"montant": 1000001})
    s = agent.post(f"/api/credit/garanties/liberation/{gid}", {"montant": 400000}, **H).json()
    assert (s["totalLibere"], s["garanties"][0]["reste"]) == (400000, 600000)
    assert next(x for x in agent.get(f"/api/tiers/{mw}/comptes", **H).json() if x["id"] == k2)["disponible"] == disp - 600000
    agent.post(f"/api/credit/garanties/liberation/{gid}", {"montant": 600000}, **H)
    assert ident("select count(*) from blocage where garantie_de = %s and compte_id = %s and fin is null", (cid, k2)) == 0
    assert ident("select sum(case when l.sens = 'C' then l.montant_devise else -l.montant_devise end) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero = '0112'") == 0
    d = agent.post(f"/api/credit/garanties/{cid}/ajout", {"type": "depot_garantie", "compteId": C("0412-000318-02"), "montant": 500000}, **H).json()
    assert (d["calcule"], d["total"], d["piece"]) == (10000000, 500000, "")       # calculé : épargne obligatoire du crédit (S94-3)
    l = agent.get("/api/credit/garanties-rapport", {"type": "caution", "du": "2026-11-01", "au": "2026-11-05"}, **H).json()
    assert (l[0]["numeroMembre"], l[0]["numeroCredit"], l[0]["ajoute"], l[0]["libere"], l[0]["reste"]) == ("0412-000319", "0412/L001/00001", 1000000, 1000000, 0)
    assert balance_equilibree(agent)
    assert clients["caisse"].post(f"/api/credit/garanties/{cid}/ajout", base, **H).status_code == 403


def test_consulter_pret(clients, journee):
    """S95 (p. 118 et 119) : situation du crédit et champs de la capture (registre S95-1 à S95-3)"""
    agent = clients["agent"]
    cid = credit_debloque(clients, journee)
    assert [x["id"] for x in agent.get(f"/api/credit/consultation/clients/{T('0412-000318')}", **H).json()] == [cid]
    d = agent.get(f"/api/credit/consultation/{cid}", **H).json()
    assert (d["rang"], d["terme"], d["tauxAnnuel"], d["periodiciteLibelle"], d["degre"], d["capitalRestant"], d["interetAnticipation"]) == \
        (1, "Court terme", 30.0, "Mensuel", "Sains", 100000000, False)
    assert clients["caisse"].get(f"/api/credit/consultation/{cid}", **H).status_code == 403
    assert agent.post(f"/api/credit/credits/{cid}/memos", {"texte": "Visite du 05/11"}, **H).json()[0]["texte"] == "Visite du 05/11"


def test_affectation(clients, journee):
    """S96 (p. 119) : le crédit passe du portefeuille d'un gestionnaire à un autre ; transfert tracé (registre S96-1 à S96-3)"""
    agent, chef = clients["agent"], clients["chef"]
    cid = credit_debloque(clients, journee)
    g = {x["nom"]: x["id"] for x in agent.get("/api/credit/affectation/contexte", **H).json()["gestionnaires"]}
    bk, jp = g["Bijou Kasongo"], g["J.-P. Mukendi"]
    assert [x["id"] for x in agent.get(f"/api/credit/affectation/{bk}", **H).json()] == [cid]
    def refus(corps):
        r = agent.post("/api/credit/affectation", corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "différents" in refus({"de": bk, "vers": bk, "credits": [cid]})
    assert "Cocher" in refus({"de": bk, "vers": jp, "credits": []})
    assert "plus dans le portefeuille" in refus({"de": jp, "vers": bk, "credits": [cid]})
    r = agent.post("/api/credit/affectation", {"de": bk, "vers": jp, "credits": [cid]}, **H).json()
    assert (r["de"], [x["id"] for x in r["vers"]]) == ([], [cid])
    assert ident("select count(*) from credit_affectation where credit_id = %s", (cid,)) == 1
    assert clients["caisse"].post("/api/credit/affectation", {"de": jp, "vers": bk, "credits": [cid]}, **H).status_code == 403


def test_liste_rouge(clients, journee):
    """S97 (p. 119 et 120) : Ajouter, Retirer avec motif ; un inscrit n'obtient ni demande, ni approbation, ni mise en place (CR-9 ; Instr. BCC 13, art. 7)"""
    chef, agent = clients["chef"], clients["agent"]
    k = T("0412-000318")
    def refus(c, route, corps):
        r = c.post(route, corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Motif" in refus(agent, "/api/credit/liste-rouge/ajout", {"tiersId": k, "motif": " "})
    l = agent.post("/api/credit/liste-rouge/ajout", {"tiersId": k, "motif": "Impayés répétés", "referenceBcc": "BCC/MI/2026/07"}, **H).json()
    assert (l[0]["membre"], l[0]["motif"], l[0]["referenceBcc"]) == ("0412-000318", "Impayés répétés", "BCC/MI/2026/07")
    assert "déjà" in refus(agent, "/api/credit/liste-rouge/ajout", {"tiersId": k, "motif": "x"})
    pid = chef.post("/api/produits-credit", {**PRODUIT, "numero": "L009"}, **H).json()["produit"]["id"]
    ctx = agent.get("/api/credit/dossiers/contexte", **H).json()
    pr = next(x for x in ctx["provinces"] if x["nom"] == "Kinshasa")["id"]; vi = next(x for x in ctx["villes"] if x["provinceId"] == pr)["id"]
    e = {"nbHommes": 0, "nbFemmes": 1, "montantHommes": 0, "montantFemmes": 100000000, "nbGroupes": 0}
    dem = {"produitId": pid, "tiersId": k, "duree": 12, "provinceId": pr, "villeId": vi, **e, "ressaisie": e}
    assert "liste rouge" in refus(agent, "/api/credit/dossiers", dem)
    assert agent.post("/api/credit/liste-rouge/retrait", {"tiersId": k, "motif": "Régularisé"}, **H).json() == []
    assert "pas sur la liste" in refus(agent, "/api/credit/liste-rouge/retrait", {"tiersId": k, "motif": "x"})
    _, did, _ = credit_approuve(clients)
    agent.post("/api/credit/liste-rouge/ajout", {"tiersId": k, "motif": "Fraude"}, **H)
    assert "liste rouge" in refus(agent, f"/api/credit/mise-en-place/{did}", {"compteEpargneId": None})
    assert clients["caisse"].post("/api/credit/liste-rouge/ajout", {"tiersId": k, "motif": "x"}, **H).status_code == 403


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


def test_modele_credit(clients):
    """S26 (p. 40) : libellé obligatoire ; comptes capital et intérêt pour chaque degré et terme, au plan (T16) ; comptes proposés par le PCCI"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/modeles-credit", **H).json()
    assert len(l["degres"]) == 7 and len(l["termes"]) == 3 and [m["libelle"] for m in l["modeles"]] == ["Model normal"]
    d = {(c["degre"], c["terme"]): c for c in l["defauts"]}
    assert (d[(1, 1)]["compteCapital"], d[(1, 1)]["compteInteret"], d[(2, 3)]["compteCapital"], d[(6, 2)]["compteInteret"]) == ("329", "7129", "3900", "7174")
    def refus(corps, mid=None):
        r = chef.post("/api/modeles-credit" + (f"/{mid}" if mid else ""), corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert agent.post("/api/modeles-credit", {"libelle": "X", "comptes": l["defauts"]}, **H).status_code == 403
    assert "Libellé" in refus({"libelle": "", "comptes": l["defauts"]})
    assert "à remplir" in refus({"libelle": "Modèle ressources affectées", "comptes": l["defauts"][1:]})
    faux = [{**c, "compteInterne": "99999"} if (c["degre"], c["terme"]) == (3, 1) else c for c in l["defauts"]]
    assert "n'existe pas" in refus({"libelle": "Modèle ressources affectées", "comptes": faux})
    assert "existe déjà" in refus({"libelle": "model NORMAL", "comptes": l["defauts"]})
    m = chef.post("/api/modeles-credit", {"libelle": "Modèle ressources affectées", "comptes": [{**c, "compteInterne": "3800"} if c["degre"] == 2 else c for c in l["defauts"]]}, **H).json()["modele"]
    assert next(c for c in m["comptes"] if (c["degre"], c["terme"]) == (2, 1))["compteInterne"] == "3800"
    p = chef.post("/api/produits-credit", {**PRODUIT, "modeleId": m["id"]}, **H).json()["produit"]
    assert p["modeleId"] == m["id"]
    assert "produit crédit" in chef.post(f"/api/modeles-credit/{m['id']}/suppression", {}, **H).json()["message"]


def test_produit_epargne(clients):
    """S27 (p. 40) : champs et options de la capture ; Devise ; codes et numéros uniques ; produit avec comptes : devise, famille, numéro figés,
    pas de suppression (registre S27-1 à S27-4)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/produits-epargne", **H).json()
    assert l["familles"] == ["EPARGNE", "BLOQUE", "TONTINE"] and {p["code"] for p in l["produits"]} == {"EAV-CDF", "EAV-USD"}
    P = {"numero": 5, "code": "G", "famille": "BLOQUE", "libelle": "Epargne De Garantie", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 1,
         "operer": True, "depotCheque": False, "caution": False, "nantissement": True, "calculerInteret": False, "soldeNegatif": False, "repartitionGroupe": False}
    def refus(corps, pid=None, route="/api/produits-epargne"):
        r = chef.post(route + (f"/{pid}" if pid else ""), corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert agent.post("/api/produits-epargne", P, **H).status_code == 403
    assert "Dépôt de chèque" in refus({**P, "depotCheque": None})
    assert "Famille produit inconnue" in refus({**P, "famille": "DAT"})
    assert "de 1 à 99" in refus({**P, "numero": 120})
    assert "Code produit existe" in refus({**P, "code": "eav-cdf"})
    assert "N° Produit existe" in refus({**P, "numero": 2})
    g = next(p for p in chef.post("/api/produits-epargne", P, **H).json()["produits"] if p["code"] == "G")
    assert (g["famille"], g["nantissement"], g["tenueCompte"], g["actif"]) == ("BLOQUE", True, None, False)
    assert chef.post(f"/api/produits-epargne/{g['id']}", {**P, "actif": True, "libelle": "Epargne de garantie"}, **H).status_code == 200
    eav = next(p for p in l["produits"] if p["code"] == "EAV-CDF")
    assert "ne se change plus" in refus({**{k: eav[k] for k in P}, "devise": "USD"}, eav["id"])
    r = chef.post(f"/api/produits-epargne/{eav['id']}/suppression", {}, **H); assert r.status_code == 422 and "décocher Actif" in r.json()["message"]
    assert chef.post(f"/api/produits-epargne/{g['id']}/suppression", {}, **H).status_code == 200


def test_parametrage_epargne(clients):
    """S28 (p. 41) : onglets Epargne, Courant, DAT, Bloqué ; compte lié de dépôts (PCCI 33 à 35) ; types clients de S14g ; compte figé quand
    des comptes sont ouverts ; le compte lié sert aux écritures (registre S28-1 à S28-3)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/parametrage-epargne", **H).json()
    assert [(o["onglet"], o["compte"]) for o in l["onglets"]] == [("Epargne", "330"), ("Courant", "331"), ("DAT", "340"), ("Bloqué", "334")]
    assert [x["libelle"] for x in l["typesClient"]] == ["Client"]                         # S14g de la démonstration (registre S37-2)
    tc = next(x for x in chef.post("/api/listes/type_client", {"code": "2", "libelle": "Membre"}, **H).json()["lignes"] if x["libelle"] == "Membre")
    eav = next(p for p in l["produits"] if p["code"] == "EAV-CDF")
    def refus(corps):
        r = chef.post("/api/parametrage-epargne", corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert agent.post("/api/parametrage-epargne", {"onglet": "Epargne", "produitId": eav["id"]}, **H).status_code == 403
    assert "Produit" in refus({"onglet": "Epargne"})
    assert "comptes 33 à 35" in refus({"onglet": "Epargne", "produitId": eav["id"], "compteLie": "570"})
    assert "ne se change plus" in refus({"onglet": "Courant", "produitId": eav["id"], "compteLie": "331"})
    assert "Type client inconnu" in refus({"onglet": "Epargne", "produitId": eav["id"], "compteLie": "330", "typesClient": [999999]})
    r = chef.post("/api/parametrage-epargne", {"onglet": "Epargne", "produitId": eav["id"], "compteLie": "330", "typesClient": [tc["id"]]}, **H).json()
    p = next(x for x in r["produits"] if x["code"] == "EAV-CDF")
    assert (p["categorie"], p["compteLie"], p["typesClient"]) == ("Epargne", "330", [tc["id"]])


def test_numero_piece(clients, journee):
    """S29 (p. 41) : numéro de pièce = exercice, puis Agence, Journal, compteur (sans règle) ou dans l'ordre des positions ; Institution si cochée ;
    compteur du journal dans l'exercice, sans trou (PCCI § 3.3 et 3.4 ; registre S11-7, S29-1, S29-2)"""
    from noyau.bd import lignes as lire_bd
    chef, caisse = clients["chef"], clients["caisse"]
    l = chef.get("/api/numerotation-pieces", **H).json()
    assert l["regle"] is None and l["exercice"] == 2026 and l["exemple"]["JOURNAL"] == "CA"
    depot = lambda: caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 500000, "coupures": {"5000": 1}, "mandataire": ""}, **H)
    assert depot().status_code == 200
    def refus(corps):
        r = chef.post("/api/numerotation-pieces", corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    i = l["institutions"][0]["id"]
    assert "Institution" in refus({"positions": {}})
    assert "même position" in refus({"institutionId": i, "institution": False, "positions": {"AGENCE": 1, "JOURNAL": 1, "COMPTEUR": 2}})
    assert "Position compteur" in refus({"institutionId": i, "institution": False, "positions": {"AGENCE": 1, "JOURNAL": 2}})
    r = chef.post("/api/numerotation-pieces", {"institutionId": i, "institution": True, "positions": {"INSTITUTION": 1, "AGENCE": 2, "JOURNAL": 4, "COMPTEUR": 3}}, **H)
    assert r.status_code == 200, r.content
    assert depot().status_code == 200
    nums = [x["numero"] for x in lire_bd("select numero from piece order by id")]
    assert nums[-2:] == ["2026-0412-CA-000001", "2026-CTJ-0412-000002-CA"], nums


def test_journaux(clients, journee):
    """S30 (p. 41 et 42) : Type Journal, Libelle, Code obligatoires ; Actif ; Détail journal dans l'exercice en cours ; un journal qui a servi
    garde son code et son type et ne se supprime pas ; un journal inactif ne reçoit plus d'écriture (registre S30-1 à S30-3)"""
    chef, caisse = clients["chef"], clients["caisse"]
    l = chef.get("/api/journaux", **H).json()
    assert l["exercice"] == 2026 and {j["code"] for j in l["journaux"]} == {"CA", "AN", "BQ", "OD"}
    ca = next(j for j in l["journaux"] if j["code"] == "CA")
    assert (ca["typeLibelle"], ca["actif"], ca["detail"]) == ("Journal de Caisse", True, True)
    def refus(corps, jid=None, suffixe=""):
        r = chef.post("/api/journaux" + (f"/{jid}" if jid else "") + suffixe, corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Type Journal, Libelle, Code" in refus({})
    assert "existe déjà" in refus({"type": "caisse", "libelle": "Autre", "code": "ca"})
    r = chef.post("/api/journaux", {"type": "operations_diverses", "libelle": "Opérations diverses 2", "code": "O2", "actif": True, "detail": True}, **H)
    assert r.status_code == 200, r.content
    od = next(j for j in r.json()["journaux"] if j["code"] == "O2")
    assert od["detail"] is True and od["typeLibelle"] == "Journal des Opérations diverses"
    assert chef.post(f"/api/journaux/{od['id']}/suppression", {}, **H).status_code == 200
    depot = lambda: caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 500000, "coupures": {"5000": 1}, "mandataire": ""}, **H)
    assert depot().status_code == 200
    assert "ne se changent plus" in refus({"type": "banque", "libelle": "Caisse", "code": "CA", "actif": True, "detail": True}, ca["id"])
    assert "ne se supprime pas" in refus({}, ca["id"], "/suppression")
    assert chef.post(f"/api/journaux/{ca['id']}", {"type": "caisse", "libelle": "Caisse", "code": "CA", "actif": False, "detail": True}, **H).status_code == 200
    r = depot(); assert r.status_code == 422 and "pas actif" in r.json()["message"]


def test_operations_diverses(clients):
    """S31 (p. 42) : Type Opération, Compte, Statut, Libellé obligatoires ; compte du plan, ouvert et saisissable, hors caisse ; modification par la
    grille ; INACTIF au lieu de supprimer (registre S31-1 à S31-3)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/operations-diverses", **H).json()
    assert (l["sens"], l["statuts"], l["operations"]) == (["PRODUIT", "CHARGE"], ["ACTIF", "INACTIF"], [])
    def refus(corps, oid=None):
        r = chef.post("/api/operations-diverses" + (f"/{oid}" if oid else ""), corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    O = {"sens": "PRODUIT", "compte": "7790", "statut": "ACTIF", "libelle": "Vente de livret d'épargne"}
    assert agent.post("/api/operations-diverses", O, **H).status_code == 403
    assert "Type Opération, Compte, Statut, Libellé opération" in refus({})
    assert "classe" in refus({**O, "compte": "6"})
    assert "caisse" in refus({**O, "compte": "570"})
    o = chef.post("/api/operations-diverses", O, **H).json()["operations"][0]
    assert "existe déjà" in refus({**O, "libelle": "vente de livret d'épargne"})
    assert chef.post("/api/operations-diverses", {**O, "sens": "CHARGE", "compte": "671"}, **H).status_code == 200    # même libellé, autre sens
    m = chef.post(f"/api/operations-diverses/{o['id']}", {**O, "statut": "INACTIF"}, **H).json()["operations"][0]
    assert m["statut"] == "INACTIF"


def test_info_societe(clients):
    """S32 (p. 42) : Info générale (obligatoires, Type base, localisation S20, comptes hors bilan classe 0, logo) ; page Agence (code figé quand des
    clients existent, suppression refusée si l'agence sert) ; registre S32-1 à S32-5"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/societe", **H).json()
    i = l["institution"]
    assert (i["code"], i["denomination"], i["typeBase"], i["journeeMax"], i["commune"], i["quartier"]) == ("CTJ", "COOPEC Tujenge", "coopec", 1, "Matete", "Kinsaku")
    assert [t["libelle"] for t in l["types"]] == ["COOPEC", "Société de microfinance", "Entreprise de micro-crédit", "Structure faîtière"]
    def refus(corps, route="/api/societe"):
        r = chef.post(route, corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert agent.post("/api/societe", i, **H).status_code == 403
    assert "Code Institution, Dénomination" in refus({**i, "code": "", "denomination": ""})
    assert "inconnu" in refus({**i, "quartier": "Gombe"})
    assert "commune" in refus({**i, "commune": "Lemba"})                     # Kinsaku est un quartier de Matete, pas de Lemba
    assert "classe 0" in refus({**i, "compteHorsBilan1": "570"})
    assert "PNG ou JPEG" in refus({**i, "logo": "data:text/html;base64,AAAA"})
    r = chef.post("/api/societe", {**i, "directeur": "J.-P. Mukendi", "journeeMax": 2, "logo": "data:image/png;base64,iVBORw0KGgo="}, **H)
    assert r.status_code == 200, r.content
    assert (r.json()["institution"]["directeur"], r.json()["institution"]["journeeMax"]) == ("J.-P. Mukendi", 2)
    ag = l["agences"][0]
    assert "ne change plus" in refus({"code": "0413", "nom": "Matete"}, f"/api/societe/agences/{ag['id']}")
    assert "existe déjà" in refus({"code": "0412", "nom": "Autre"}, "/api/societe/agences")
    n = next(a for a in chef.post("/api/societe/agences", {"code": "0413", "nom": "Lemba"}, **H).json()["agences"] if a["code"] == "0413")
    assert "des clients" in refus({}, f"/api/societe/agences/{ag['id']}/suppression")
    assert chef.post(f"/api/societe/agences/{n['id']}/suppression", {}, **H).status_code == 200


def test_agents_agence(clients):
    """S33 (p. 43) : onglets Gestionnaire, Sensibilisateur, Commercial ; obligatoires selon l'onglet ; pas de Supprimer pour le sensibilisateur ;
    le prospect (S45) choisit son sensibilisateur et son commercial dans ces listes (registre S33-1 à S33-4)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    A = "/api/agents"
    l = chef.get(f"{A}/gestionnaire", **H).json()
    assert l["agents"] == [] and l["agenceDefaut"] and "Commerçant" in l["professions"]
    def refus(role, corps, suffixe=""):
        r = chef.post(f"{A}/{role}{suffixe}", corps, **H); assert r.status_code in (403, 404, 422), r.content; return r.json()["message"]
    P = {"nom": "Kabeya", "prenom": "Sarah", "naissance": "1990-04-02", "sexe": "F", "profession": "Commerçant"}
    assert agent.post(f"{A}/gestionnaire", P, **H).status_code == 403
    assert "Nom, Prénom, Né(e) le, Sexe" in refus("gestionnaire", {})
    assert "à" in refus("sensibilisateur", P)                          # « à » obligatoire pour le sensibilisateur et le commercial
    assert "date invalide" in refus("gestionnaire", {**P, "naissance": "2999-01-01"})
    assert "Profession inconnue" in refus("gestionnaire", {**P, "profession": "Astronaute"})
    g = chef.post(f"{A}/gestionnaire", {**P, "agenceId": l["agenceDefaut"]}, **H).json()["agents"][0]
    assert (g["nom"], g["naissance"], g["agenceId"]) == ("Kabeya", "1990-04-02", l["agenceDefaut"])
    s = chef.post(f"{A}/sensibilisateur", {**P, "nom": "Mbuyi", "lieuNaissance": "Kananga"}, **H).json()["agents"][0]
    c = chef.post(f"{A}/commercial", {**P, "nom": "Tshala", "lieuNaissance": "Mbuji-Mayi"}, **H).json()["agents"][0]
    assert "ne se supprime pas" in refus("sensibilisateur", {}, f"/{s['id']}/suppression")
    ctx = chef.get("/api/referentiel", **H).json()
    assert [x["nom"] for x in ctx["sensibilisateurs"]] == ["Mbuyi Sarah"] and [x["nom"] for x in ctx["commerciaux"]] == ["Tshala Sarah"]
    pr = {"nom": "Ilunga", "prenom": "Marc", "naissance": "1988-01-01", "lieuNaissance": "Kinshasa", "sexe": "M", "pays": "République démocratique du Congo",
          "ville": "Kinshasa", "quartier": "Kinsaku", "telephone": "+243 810 000 333"}
    assert "Commercial inconnu" in agent.post("/api/prospects", {**pr, "commercialId": s["id"]}, **H).json()["message"]
    t = agent.post("/api/prospects", {**pr, "sensibilisateurId": s["id"], "commercialId": c["id"]}, **H).json()
    assert (t["sensibilisateurId"], t["commercialId"]) == (s["id"], c["id"])
    assert "Des clients" in refus("commercial", {}, f"/{c['id']}/suppression")
    assert chef.post(f"{A}/gestionnaire/{g['id']}/suppression", {}, **H).status_code == 200


def test_jours_travail_feries(clients):
    """S34 (p. 44) : Journées de travail par agence (Dimanche à Samedi) ; Jours fériés variables de l'institution : date, Description, Exercice,
    ajoutés dans la grille puis enregistrés (registre S34-1 et S34-2)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/jours", **H).json()
    a = l["agences"][0]
    assert a["jours"] == [False] * 7 and len(l["institutions"]) == 1 and 2026 in l["exercices"] and l["feries"] == []
    S = [False, True, True, True, True, True, True]
    assert agent.post("/api/jours/journees", {"agenceId": a["id"], "jours": S}, **H).status_code == 403
    assert "Agence" in chef.post("/api/jours/journees", {"jours": S}, **H).json()["message"]
    assert chef.post("/api/jours/journees", {"agenceId": a["id"], "jours": S}, **H).json()["agences"][0]["jours"] == S
    i = l["institutions"][0]["id"]
    def refus(corps):
        r = chef.post("/api/jours/feries", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    F = {"date": "2026-06-30", "description": "Fête de l'indépendance", "exercice": 2026}
    assert "Institution" in refus({"feries": [F]})
    assert "Description" in refus({"institutionId": i, "feries": [{**F, "description": " "}]})
    assert "pas dans l'exercice 2026" in refus({"institutionId": i, "feries": [{**F, "date": "2025-06-30"}]})
    assert "Exercice inconnu" in refus({"institutionId": i, "feries": [{**F, "exercice": 1990}]})
    assert "deux fois" in refus({"institutionId": i, "feries": [F, F]})
    r = chef.post("/api/jours/feries", {"institutionId": i, "feries": [F]}, **H).json()
    assert r["feries"] == [F]
    # Registre S34-4 : pas de journée un jour férié ni un jour non coché
    chef.post("/api/jours/feries", {"institutionId": i, "feries": [{"date": "2026-12-25", "description": "Noël", "exercice": 2026}]}, **H)
    assert "férié : Noël" in chef.post("/api/journees", {"date": "2026-12-25"}, **H).json()["message"]
    assert "dimanche" in chef.post("/api/journees", {"date": "2026-11-08"}, **H).json()["message"]
    assert chef.post("/api/jours/feries", {"institutionId": i, "feries": []}, **H).json()["feries"] == []


def test_devises_monnaies(clients):
    """S35 (p. 45 et 46) : Devise, Code, Unité, Subdivision ; Type de Monnaie ; Valeur fiduciaire, Type de Monnaie, Devise ;
    franc congolais : FC et cent centimes (D.-L. 080/1998, art. 1 et 2) ; registre S35-1 à S35-4"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/devises", **H).json()
    cdf = next(x for x in l["devises"] if x["code"] == "CDF")
    assert (cdf["unite"], cdf["subdivision"]) == ("FC", 100)
    assert {"devise": "CDF", "valeur": 500, "typeId": next(t["id"] for t in l["types"] if t["libelle"] == "Billet de 500"), "libelle": "Billet de 500"} in l["monnaies"]
    def refus(url, corps):
        r = chef.post(url, corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    E = {"libelle": "Euro", "code": "eur", "unite": "€", "subdivision": 100}
    assert agent.post("/api/devises", E, **H).status_code == 403
    assert "Devise, Code" in refus("/api/devises", {})
    assert "trois lettres" in refus("/api/devises", {**E, "code": "E"})
    assert "divise 100" in refus("/api/devises", {**E, "subdivision": 3})
    assert "D.-L. 080/1998" in refus("/api/devises/CDF", {**cdf, "unite": "F"})
    assert "existe déjà" in refus("/api/devises", {**E, "code": "USD"})
    assert {"code": "EUR", "libelle": "Euro", "unite": "€", "subdivision": 100} in chef.post("/api/devises", E, **H).json()["devises"]
    assert "ne se modifie pas" in refus("/api/devises/EUR", {**E, "code": "EUA"})
    assert "Type de Monnaie" in refus("/api/types-monnaie", {"libelle": " "})
    assert "existe déjà" in refus("/api/types-monnaie", {"libelle": "billet de 500"})
    t = chef.post("/api/types-monnaie", {"libelle": "Pièce de 50 centimes"}, **H).json()["types"][-1]
    assert "Valeur fiduciaire, Type de Monnaie, Devise" in refus("/api/monnaies", {})
    assert "deux décimales" in refus("/api/monnaies", {"valeur": "0.505", "typeId": t["id"], "devise": "CDF"})
    assert "existe déjà" in refus("/api/monnaies", {"valeur": 500, "typeId": t["id"], "devise": "CDF"})
    m = chef.post("/api/monnaies", {"valeur": "0,50", "typeId": t["id"], "devise": "CDF"}, **H).json()["monnaies"]
    assert {"devise": "CDF", "valeur": 0.5, "typeId": t["id"], "libelle": "Pièce de 50 centimes"} in m
    assert chef.post("/api/monnaies/CDF/50", {"valeur": "0.5", "typeId": t["id"], "devise": "EUR"}, **H).status_code == 200


def test_devise_partout(clients):
    """Une devise créée en S35 sert partout (demande du porteur, 13/11/2026) : guichets, billetage, cours du jour (PCCI § 7.1) ; registre S35-6, S08-3, S79-5"""
    chef = clients["chef"]; connecter(chef, "jpmukendi")
    chef.post("/api/devises", {"libelle": "Euro", "code": "EUR", "unite": "€", "subdivision": 100}, **H)
    t = chef.post("/api/types-monnaie", {"libelle": "Billet de 50 euros"}, **H).json()["types"][-1]
    chef.post("/api/monnaies", {"valeur": 50, "typeId": t["id"], "devise": "EUR"}, **H)
    def refus(url, corps):
        r = chef.post(url, corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "Devise, Date, Cours" in refus("/api/cours", {})
    assert "monnaie de tenue" in refus("/api/cours", {"devise": "CDF", "jour": "2026-11-05", "cours": 1})
    l = chef.post("/api/cours", {"devise": "EUR", "jour": "2026-11-05", "cours": "3100,5"}, **H).json()
    assert {"devise": "EUR", "jour": "2026-11-05", "cours": 3100.5} in l["cours"]
    ctx = chef.get("/api/referentiel", **H).json()
    assert ctx["cours"]["EUR"] == 3100.5 and ctx["monnaies"]["EUR"] == [{"valeur": 50.0, "libelle": "Billet de 50 euros"}]
    g = chef.get("/api/guichets", **H).json()
    assert g["devises"] == ["CDF", "EUR", "USD"]
    x = g["guichets"][0]
    corps = {"agenceId": x["agenceId"], "code": x["code"], "designation": x["nom"], "typeGuichet": x["typeGuichet"], "journalId": x["journalId"],
             "plafonds": {"CDF": {"maximum": 0, "retrait": 0}, "USD": {"maximum": 0, "retrait": 0}}, "actif": x["actif"]}
    assert "(EUR)" in refus(f"/api/guichets/{x['id']}", corps)


def test_facture_elements_types(clients):
    """S36 (p. 46) : Elément Facture (Libellé, Compte, Taux, Taux A., Taux N.A., Retenue Taux, Désactiver, Supprimer) ;
    Référence Commande (Code, Type Commande) ; registre S36-1 et S36-2"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    assert chef.get("/api/facture", **H).json() == {"elements": [], "types": []}
    def refus(url, corps):
        r = chef.post(url, corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    E = {"libelle": "TVA", "compte": "432", "taux": "16", "tauxA": "", "tauxNA": "", "retenue": False}
    assert agent.post("/api/facture/elements", E, **H).status_code == 403
    assert "Libellé, Compte" in refus("/api/facture/elements", {})
    assert "plan de comptes" in refus("/api/facture/elements", {**E, "compte": "4329999"})
    assert "0 à 100" in refus("/api/facture/elements", {**E, "taux": "120"})
    e = chef.post("/api/facture/elements", E, **H).json()["elements"][0]
    assert (e["libelle"], e["taux"], e["tauxA"], e["retenue"], e["actif"]) == ("TVA", 16.0, 0.0, False, True)
    assert "existe déjà" in refus("/api/facture/elements", {**E, "libelle": "tva"})
    assert chef.post(f"/api/facture/elements/{e['id']}", {**E, "retenue": True}, **H).json()["elements"][0]["retenue"] is True
    assert chef.post(f"/api/facture/elements/{e['id']}/actif", {"actif": False}, **H).json()["elements"][0]["actif"] is False
    assert chef.post(f"/api/facture/elements/{e['id']}/suppression", {}, **H).json()["elements"] == []
    assert "Code, Type Commande" in refus("/api/facture/types", {})
    t = chef.post("/api/facture/types", {"code": "acha_m", "libelle": "Achat de matériel"}, **H).json()["types"][0]
    assert (t["code"], t["libelle"]) == ("ACHA_M", "Achat de matériel")
    assert "existe déjà" in refus("/api/facture/types", {"code": "ACHA_M", "libelle": "Autre"})
    assert chef.post(f"/api/facture/types/{t['id']}/suppression", {}, **H).json()["types"] == []


def test_profils(clients):
    """S03 (p. 15) : Nom Droit* et Description ; grille Libellé profil, Description profil ; Modifier et Supprimer (p. 12) ;
    les quatre profils de départ gardent leur code (registre T07, S03-1, S03-2)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/profils", **H).json()["profils"]
    assert [p["nom"] for p in l] == ["AGENT DE CRÉDIT", "CAISSIER", "CHEF D'AGENCE", "COMPTABLE"]
    def refus(url, corps):
        r = chef.post(url, corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert agent.post("/api/profils", {"nom": "AUDITEUR"}, **H).status_code == 403
    assert "Nom Droit" in refus("/api/profils", {"nom": " "})
    assert "existe déjà" in refus("/api/profils", {"nom": "caissier"})
    a = next(p for p in chef.post("/api/profils", {"nom": "AUDITEUR", "description": "PROFIL DES AUDITEURS"}, **H).json()["profils"] if p["nom"] == "AUDITEUR")
    assert a["description"] == "PROFIL DES AUDITEURS"
    caissier = next(p for p in l if p["nom"] == "CAISSIER")
    assert "Des utilisateurs" in refus(f"/api/profils/{caissier['id']}/suppression", {})
    chef.post(f"/api/profils/{caissier['id']}", {"nom": "CAISSIÈRE", "description": ""}, **H)
    assert chef.get("/api/session", **H).status_code == 200
    connecter(clients["caisse"], "engalula")
    assert "caissier" in clients["caisse"].get("/api/session", **H).json()["roles"]          # le code reste, le nom change
    assert all(p["nom"] != "AUDITEUR" for p in chef.post(f"/api/profils/{a['id']}/suppression", {}, **H).json()["profils"])


def test_droits_profils(clients):
    """S04 (p. 15 et 16) : droits restants et octroyés d'un profil, une tâche par écran ; chaque écriture exige le droit de sa tâche ;
    les quatre profils de départ gardent ce qu'ils faisaient (registre T07, S04-1 à S04-3)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    pr = {p["nom"]: p["id"] for p in chef.get("/api/profils", **H).json()["profils"]}; CHEF = "CHEF D'AGENCE"
    l = chef.get(f"/api/droits?profil={pr[CHEF]}", **H).json()
    assert "S16" in l["octroyes"] and "S04" in l["octroyes"] and "S102" not in l["octroyes"]
    assert "S04" in chef.get("/api/session", **H).json()["droits"]
    assert "Droit manquant" in agent.post(f"/api/droits/{pr['AUDITEUR' if 'AUDITEUR' in pr else 'CAISSIER']}", {"droits": []}, **H).json()["message"]
    r = chef.post(f"/api/droits/{pr[CHEF]}", {"droits": ["S99X"]}, **H); assert "Droit inconnu" in r.json()["message"]
    sans16 = [c for c in l["octroyes"] if c != "S16"]
    assert chef.post(f"/api/droits/{pr[CHEF]}", {"droits": sans16}, **H).json()["octroyes"] == sans16
    r = chef.post("/api/parametrage/frais", {"typeOperation": "DEPOT", "libelle": "X"}, **H)
    assert r.status_code == 403 and "Frais et opérations" in r.json()["message"]
    chef.post(f"/api/droits/{pr[CHEF]}", {"droits": l["octroyes"]}, **H)
    assert chef.post("/api/parametrage/frais", {"typeOperation": "DEPOT", "libelle": "X"}, **H).status_code != 403


def test_utilisateurs_creation(clients):
    """S05 (p. 16 et 17) : champs marqués *, mot de passe confirmé et chiffré, nom utilisateur unique ; grille Nom user, Prenoms user,
    Agence, Telephone ; modifier sans retaper le mot de passe (registre S05-1 à S05-3)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    l = chef.get("/api/gestion-utilisateurs", **H).json()
    ag = l["agences"][0]["id"]
    def refus(url, corps):
        r = chef.post(url, corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    U = {"nom": "Mbala Joseph", "agenceId": ag, "login": "jmbala", "motDePasse": "secret-1", "confirmation": "secret-1", "portable": "+243 810 000 444"}
    assert agent.post("/api/gestion-utilisateurs", U, **H).status_code == 403
    assert "Nom et prénom(s), Agence, Nom utilisateur, Mot de passe, Confirmation, Portable" in refus("/api/gestion-utilisateurs", {})
    assert "différente" in refus("/api/gestion-utilisateurs", {**U, "confirmation": "x"})
    assert "existe déjà" in refus("/api/gestion-utilisateurs", {**U, "login": "JPMUKENDI"})
    x = next(v for v in chef.post("/api/gestion-utilisateurs", U, **H).json()["utilisateurs"] if v["login"] == "jmbala")
    assert (x["nom"], x["agence"], x["portable"]) == ("Mbala Joseph", "Matete", "+243 810 000 444")
    h = ident("select mot_de_passe_hash from utilisateur where login = 'jmbala'")
    assert h != "secret-1" and h.startswith(("pbkdf2", "argon2", "bcrypt", "scrypt"))
    chef.post(f"/api/gestion-utilisateurs/{x['id']}", {**U, "motDePasse": "", "confirmation": "", "portable": "+243 810 000 555"}, **H)
    assert ident("select mot_de_passe_hash from utilisateur where login = 'jmbala'") == h


def test_profils_utilisateurs(clients):
    """S06 (p. 17) : un utilisateur reçoit un profil ; modules liés ; historique ; pas de profil donné à soi-même ; l'utilisateur
    créé en S05 travaille avec les droits de son profil (registre T07, S06-1 à S06-3)"""
    chef, agent = clients["chef"], clients["agent"]; connecter(chef, "jpmukendi"); connecter(agent, "bkasongo")
    ag = chef.get("/api/gestion-utilisateurs", **H).json()["agences"][0]["id"]
    chef.post("/api/gestion-utilisateurs", {"nom": "Mbala Joseph", "agenceId": ag, "login": "jmbala", "motDePasse": "secret-1", "confirmation": "secret-1", "portable": "1"}, **H)
    l = chef.get("/api/profils-utilisateurs", **H).json()
    x = next(v for v in l["utilisateurs"] if v["login"] == "jmbala")
    caissier = next(p for p in l["profils"] if p["nom"] == "CAISSIER")
    assert caissier["modules"] == ["Dwacfina"]
    def refus(corps, c=chef):
        r = c.post("/api/profils-utilisateurs", corps, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Nom et prénom(s), Choix du profil" in refus({})
    assert "Droit manquant" in refus({"utilisateurId": x["id"], "profilId": caissier["id"]}, agent)
    moi = next(v for v in l["utilisateurs"] if v["login"] == "jpmukendi")
    assert "propre profil" in refus({"utilisateurId": moi["id"], "profilId": caissier["id"]})
    r = chef.post("/api/profils-utilisateurs", {"utilisateurId": x["id"], "profilId": caissier["id"]}, **H).json()
    assert r["profilId"] == caissier["id"] and r["historique"][0]["profil"] == "CAISSIER" and r["historique"][0]["attribuePar"] == "J.-P. Mukendi"
    assert "déjà ce profil" in refus({"utilisateurId": x["id"], "profilId": caissier["id"]})
    j = clients["compta"]; connecter(j, "jmbala")
    s = j.get("/api/session", **H).json()
    assert s["roles"] == ["caissier"] and "S74" in s["droits"]


def test_connexions(clients):
    """S07 (p. 18) : Connecté, Machine, Actif ; Déconnecter un utilisateur : sa session tombe ; « Control utilisateur connecté » (S05)
    empêche une seconde connexion (registre S07-1 à S07-3)"""
    chef, caisse = clients["chef"], clients["caisse"]; connecter(chef, "jpmukendi"); connecter(caisse, "engalula")
    l = chef.get("/api/connexions", **H).json()["utilisateurs"]
    e = next(x for x in l if x["login"] == "engalula")
    assert e["connecte"] and e["machine"] == "127.0.0.1" and e["actif"]
    moi = next(x for x in l if x["login"] == "jpmukendi")
    assert "bouton de sortie" in chef.post(f"/api/connexions/{moi['id']}/deconnexion", **H).json()["message"]
    assert "Droit manquant" in caisse.post(f"/api/connexions/{moi['id']}/deconnexion", **H).json()["message"]
    assert not next(x for x in chef.post(f"/api/connexions/{e['id']}/deconnexion", **H).json()["utilisateurs"] if x["login"] == "engalula")["connecte"]
    assert caisse.get("/api/session", **H).json() is None                                  # sa session est tombée
    assert caisse.get("/api/guichets", **H).status_code == 401
    ag = chef.get("/api/gestion-utilisateurs", **H).json()["agences"][0]["id"]
    chef.post("/api/gestion-utilisateurs", {"nom": "Mbala Joseph", "agenceId": ag, "login": "jmbala", "motDePasse": "secret-1", "confirmation": "secret-1", "portable": "1",
                                            "controleConnecte": True}, **H)
    connecter(caisse, "jmbala")
    r = clients["agent"].post("/api/session", {"login": "jmbala"}, **H)
    assert r.status_code == 422 and "Déjà connecté" in r.json()["message"]
    caisse.delete("/api/session", **H)
    connecter(clients["agent"], "jmbala")


def test_connexion_expire(clients):
    """S07 : la connexion tombe d'elle-même après la durée de la session ; « Control utilisateur connecté » ne bloque plus le lendemain (registre S07-4)"""
    chef, caisse = clients["chef"], clients["caisse"]; connecter(chef, "jpmukendi")
    ag = chef.get("/api/gestion-utilisateurs", **H).json()["agences"][0]["id"]
    chef.post("/api/gestion-utilisateurs", {"nom": "Mbala Joseph", "agenceId": ag, "login": "jmbala", "motDePasse": "secret-1", "confirmation": "secret-1", "portable": "1",
                                            "controleConnecte": True}, **H)
    connecter(caisse, "jmbala")
    assert "Déjà connecté" in clients["agent"].post("/api/session", {"login": "jmbala"}, **H).json()["message"]
    from noyau.bd import executer
    executer("update utilisateur set connecte_le = now() - interval '9 hours' where login = 'jmbala'")
    assert not next(x for x in chef.get("/api/connexions", **H).json()["utilisateurs"] if x["login"] == "jmbala")["connecte"]
    assert caisse.get("/api/session", **H).json() is None                                   # l'ancienne session est expirée
    connecter(clients["agent"], "jmbala")                                                     # nouvelle connexion acceptée
    assert next(x for x in chef.get("/api/connexions", **H).json()["utilisateurs"] if x["login"] == "jmbala")["connecte"]


def test_fiche_client_physique(clients, journee):
    """S37 (p. 48 et 49) : mentions de l'Instr. BCC 15, art. 12 et 13 ; listes de paramétrage (S14, S20, S33) ; fiche Bénéficiaire
    (registre S37-1 à S37-3)"""
    agent, chef = clients["agent"], clients["chef"]
    connecter(chef, "jpmukendi")
    chef.post("/api/listes/situation_matrimoniale", {"code": "1", "libelle": "Marié(e)"}, **H)
    chef.post("/api/listes/filiation", {"code": "1", "libelle": "Enfant"}, **H)
    primaire = next(x for x in chef.get("/api/listes/secteur_activite", **H).json()["lignes"] if x["libelle"] == "PRIMAIRE")
    chef.post("/api/listes/type_activite", {"code": "A1", "libelle": "Pisciculture", "parentId": primaire["id"]}, **H)
    base = {**FICHE, "nom": "Kalonji", "pieceType": "Passeport", "pieceNumero": "OP77"}
    def refus(corps):
        r = agent.post("/api/tiers", corps, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "prénom, date de naissance, lieu de naissance, adresse, délivrée le, lieu de délivrance, autorité de délivrance, valide jusqu'au (Instr. BCC 15" in refus(
        {**base, **{k: "" for k in ("prenom", "naissance", "lieuNaissance", "adresse", "pieceDelivreeLe", "pieceLieu", "pieceAutorite", "pieceExpire")}})
    assert "Pièce expirée" in refus({**base, "pieceExpire": "2020-01-01"})
    assert "Situation matrimoniale" in refus({**base, "situationMatrimoniale": "Pacsé"})
    assert "Type d'activité" in refus({**base, "secteurActivite": "SECONDAIRE", "typeActivite": "Pisciculture"})
    assert "Nationalité" in refus({**base, "nationalite": "Atlantide"})
    assert "Pays, ville, commune ou quartier" in refus({**base, "pays": "République démocratique du Congo", "ville": "Kinshasa", "quartier": "Nulle part"})
    assert "Gestionnaire inconnu" in refus({**base, "gestionnaireId": 999999})
    assert "Bénéficiaire 1 : à remplir : nom" in refus({**base, "beneficiaires": [{"nom": ""}]})
    assert "filiation inconnue" in refus({**base, "beneficiaires": [{"nom": "Kalonji", "filiation": "Cousin"}]})
    t = agent.post("/api/tiers", {**base, "situationMatrimoniale": "Marié(e)", "nationalite": "République démocratique du Congo", "pere": "Kalonji Pierre",
                                  "mere": "Mbuyi Anne", "secteurActivite": "PRIMAIRE", "typeActivite": "Pisciculture",
                                  "beneficiaires": [{"nom": "Kalonji", "prenom": "Paul", "filiation": "Enfant", "sexe": "M"}]}, **H).json()
    assert "situationMatrimoniale" in t, t
    assert (t["situationMatrimoniale"], t["pere"], t["typeActivite"], t["beneficiaires"][0]["filiation"]) == ("Marié(e)", "Kalonji Pierre", "Pisciculture", "Enfant")


def banque_usd(chef):
    bid = chef.post("/api/banques", {"code": "RAW", "libelle": "Rawbank", "compteLiaison": "5601", "adresse": ""}, **H).json()["banques"][0]["id"]
    j = chef.get("/api/banques").json()["journaux"][0]["id"]
    ids = {}
    for compte, num, dev in (("56010001", "R-USD-1", "USD"), ("56010003", "R-CDF-1", "CDF")):
        l = chef.post("/api/banques/comptes", {"banqueId": bid, "compte": compte, "numeroBancaire": num, "devise": dev, "journalId": j, "contactNom": "Mutombo"}, **H)
        assert l.status_code == 200, l.content
    for c in chef.get("/api/banques").json()["comptes"]:
        ids[c["numeroBancaire"]] = c["id"]
    return ids


def test_visa_validation_banque(clients, journee):
    """S57 (manuel p. 65 à 67) : visa puis validation, par d'autres personnes que celle qui a saisi (registre S57-1)"""
    chef, compta, agent = clients["chef"], clients["compta"], clients["agent"]
    ids = banque_usd(chef)
    o = compta.post("/api/banque/operations", {"cle": cle(), "date": "2026-11-05", "type": "encaissement", "compteBancaireId": ids["R-USD-1"], "compte": "727",
                                               "libelle": "Commission", "montant": 50000}, **H).json()
    assert [x["id"] for x in compta.get("/api/banque/visas?etape=visa&liste=enc_dec").json()] == [o["id"]]
    def refus(c, etape, corps=None):
        r = c.post(f"/api/banque/visas/{o['id']}/{etape}", corps or {}, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Quatre yeux" in refus(compta, "visa")
    assert "Droit manquant" in refus(agent, "visa")
    from noyau.bd import executer
    executer("insert into profil_droit (profil_id, droit_code) select id, 'S57' from profil where code = 'agent_credit'")   # le chef d'agence l'a au départ (registre S57-3)
    assert "Rien à valider" in refus(chef, "validation")
    assert chef.post(f"/api/banque/visas/{o['id']}/visa", {}, **H).json()["statut"] == "visee"
    assert "autre personne que celle qui a visé" in refus(chef, "validation")
    assert "précède" in refus(agent, "validation", {"date": "2026-11-04"})
    v = agent.post(f"/api/banque/visas/{o['id']}/validation", {}, **H).json()
    assert (v["statut"], v["piece"]) == ("validee", "")


def test_cheques_clients(clients, journee):
    """S59 (manuel p. 68 et 69) : dépôt, encaissement par une autre personne, retour, historique (registre S59-1 à S59-5)"""
    chef, compta, agent = clients["chef"], clients["compta"], clients["agent"]
    ids = banque_usd(chef)
    base = {"date": "2026-11-05", "compteDepotId": C("0412-000318-01"), "compteBancaireId": ids["R-USD-1"], "numeroCheque": "0001234", "tireur": "Kabeya Jean",
            "banqueTireur": "Equity", "montant": 40000, "deposant": "Kabeya Jean"}
    def refus(corps, c=compta):
        r = c.post("/api/banque/cheques", {"cle": cle(), **base, **corps}, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Droit manquant" in refus({}, agent)
    assert "même devise" in refus({"compteBancaireId": ids["R-CDF-1"]})
    assert "déposant" in refus({"deposant": ""})
    x = compta.post("/api/banque/cheques", {"cle": cle(), **base}, **H).json()
    assert x["statut"] == "depose"
    assert "déjà enregistré" in refus({"tireur": "KABEYA J."})                        # même numéro, même banque
    from noyau.bd import executer
    executer("update produit_epargne set depot_cheque = false where id = (select produit_id from compte_depot where id = %s)", (base["compteDepotId"],))
    assert "Dépôt de chèque = Non" in refus({"numeroCheque": "0009999"})                 # registre S74-5
    executer("update produit_epargne set depot_cheque = true where id = (select produit_id from compte_depot where id = %s)", (base["compteDepotId"],))
    y = compta.post("/api/banque/cheques", {"cle": cle(), **base, "numeroCheque": "0001235"}, **H).json()
    def traiter(c, cid, action, corps=None):
        return c.post(f"/api/banque/cheques/{cid}/{action}", corps or {}, **H)
    r = traiter(compta, x["id"], "encaisser", {"dateEncaissement": "2026-11-05"})
    assert r.status_code == 422 and "Quatre yeux" in r.json()["message"]
    assert traiter(chef, x["id"], "encaisser", {"dateEncaissement": "2026-11-05"}).json()["statut"] == "encaisse"   # le chef a S59 au départ
    assert traiter(chef, y["id"], "retourner").json()["statut"] == "retourne"
    assert compta.post("/api/banque/cheques", {"cle": cle(), **base, "numeroCheque": "0001235"}, **H).status_code == 200   # un chèque retourné peut revenir
    assert [c["statut"] for c in chef.get(f"/api/banque/cheques?compteBancaireId={ids['R-USD-1']}").json()] == ["encaisse", "retourne", "depose"]


def test_chequier_institution(clients, journee):
    """S60 (manuel p. 69) : chéquier généré, chèque utilisé une fois dans S52 ; un refus annule toute la requête"""
    chef, compta, agent = clients["chef"], clients["compta"], clients["agent"]
    ids = banque_usd(chef)
    base = {"compteBancaireId": ids["R-USD-1"], "nbFeuillets": 25, "debut": "0001001", "barre": True}
    def refus(route, corps, c=compta):
        r = c.post(route, {"cle": cle(), **corps}, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Droit manquant" in refus("/api/banque/chequiers", base, agent)
    assert "Nb.Feuillet" in refus("/api/banque/chequiers", {**base, "nbFeuillets": 30})
    assert "1 à 8 chiffres" in refus("/api/banque/chequiers", {**base, "debut": "123456789"})
    ch = compta.post("/api/banque/chequiers", {"cle": cle(), **base}, **H).json()
    assert (ch["debut"], ch["fin"]) == ("0001001", "0001025")
    assert "existent déjà" in refus("/api/banque/chequiers", {**base, "debut": "0001020"})
    lu = compta.get("/api/banque/operations").json()
    assert len([q for q in lu["cheques"] if q["compteBancaireId"] == ids["R-USD-1"]]) == 25
    dec = {"type": "decaissement", "date": "2026-11-05", "compteBancaireId": ids["R-USD-1"], "compte": "671", "libelle": "Frais", "montant": 1000}
    n = ident("select count(*) from operation_banque")
    assert "aucun chéquier" in refus("/api/banque/operations", {**dec, "cheque": "0009999"})
    assert ident("select count(*) from operation_banque") == n          # le refus a tout annulé, même l'opération déjà écrite
    assert compta.post("/api/banque/operations", {"cle": cle(), **dec, "cheque": "0001001"}, **H).json()["cheque"] == "0001001"
    assert "déjà servi" in refus("/api/banque/operations", {**dec, "cheque": "0001001"})


def test_emprunts_bancaires(clients, journee):
    """S61 (manuel p. 70) : mise en place au compte 533 (PCCI, compte 53), remboursement plafonné au capital restant"""
    chef, compta, agent = clients["chef"], clients["compta"], clients["agent"]
    ids = banque_usd(chef)
    base = {"compteBancaireId": ids["R-USD-1"], "reference": "RAW-2026-01", "montant": 1000000, "duree": 24, "dateEmprunt": "2026-11-05", "taux": "12,5",
            "totalInteret": 125000, "totalCommission": 5000, "totalFrais": 0, "commentaire": "", "compteEmprunt": "533"}
    def refus(route, corps, c=compta):
        r = c.post(route, {"cle": cle(), **corps}, **H); assert r.status_code in (403, 422), r.content; return r.json()["message"]
    assert "Droit manquant" in refus("/api/banque/emprunts", base, agent)
    assert "compte 533" in refus("/api/banque/emprunts", {**base, "compteEmprunt": "1619"})
    assert "Taux annuel" in refus("/api/banque/emprunts", {**base, "taux": "1e2"})
    e = compta.post("/api/banque/emprunts", {"cle": cle(), **base}, **H).json()
    assert (e["numero"], e["devise"], e["taux"], e["compteInteret"], e["capitalRestant"]) == (1, "USD", "12,5", "6020", 1000000)
    assert compta.post("/api/banque/emprunts", {"cle": cle(), **base, "duree": 6}, **H).json()["compteInteret"] == "6021"
    assert compta.get("/api/banque/emprunts?numero=1").json()["reference"] == "RAW-2026-01"
    r = {"date": "2026-11-05", "amortissement": 400000, "interet": 10000, "commission": 0}
    assert "Rien à rembourser" in refus(f"/api/banque/emprunts/{e['id']}/remboursements", {**r, "amortissement": 0, "interet": 0})
    assert compta.post(f"/api/banque/emprunts/{e['id']}/remboursements", {"cle": cle(), **r}, **H).json()["capitalRestant"] == 600000
    assert "capital restant" in refus(f"/api/banque/emprunts/{e['id']}/remboursements", {**r, "amortissement": 600001})


def test_rapport_banque(clients, journee):
    """S62 (manuel p. 71) : journal des opérations de la banque sur la période, hors refusées"""
    chef, compta = clients["chef"], clients["compta"]
    ids = banque_usd(chef)
    b = chef.get("/api/banques").json()["banques"][0]["id"]
    compta.post("/api/banque/operations", {"cle": cle(), "type": "encaissement", "date": "2026-11-05", "compteBancaireId": ids["R-USD-1"], "compte": "727",
                                           "libelle": "Commission", "montant": 50000}, **H)
    assert compta.get("/api/banque/rapport/contexte").json()["agences"]
    r = compta.get(f"/api/banque/rapport?du=2026-01-01&au=2026-11-05&banqueId={b}").json()
    assert [(x["operation"], x["numeroComptable"]) for x in r] == [("Encaissement divers", "727")]
    assert compta.get(f"/api/banque/rapport?du=2026-11-06&au=2026-11-30&banqueId={b}").json() == []
    assert compta.get(f"/api/banque/rapport?du=2026-11-06&au=2026-11-01&banqueId={b}").status_code == 422


def test_banques_complements(clients, journee):
    """S58 (manuel p. 67) : compte de liaison et compte de pénalité contrôlés sur le plan (T16), adresse du gestionnaire"""
    chef = clients["chef"]
    r = chef.post("/api/banques", {"code": "RAW", "libelle": "Rawbank", "compteLiaison": "99999", "adresse": ""}, **H)
    assert r.status_code == 422 and "pas un compte du plan" in r.json()["message"]
    bid = chef.post("/api/banques", {"code": "RAW", "libelle": "Rawbank", "compteLiaison": "5601", "adresse": ""}, **H).json()["banques"][0]["id"]
    j = chef.get("/api/banques").json()["journaux"][0]["id"]
    c = {"banqueId": bid, "compte": "56010001", "numeroBancaire": "R-1", "devise": "USD", "journalId": j, "contactNom": "Mutombo"}
    for compte, motif in (("60888", "pas un compte du plan"), ("7791", "compte de charges du compte 60"), ("670", "compte de charges du compte 60")):
        r = chef.post("/api/banques/comptes", {**c, "comptePenalite": compte}, **H)
        assert r.status_code == 422 and motif in r.json()["message"], (compte, r.content)
    l = chef.post("/api/banques/comptes", {**c, "comptePenalite": "607", "contactAdresse": "Boulevard du 30 Juin, Gombe"}, **H).json()
    assert (l["comptes"][0]["comptePenalite"], l["comptes"][0]["contactAdresse"]) == ("607", "Boulevard du 30 Juin, Gombe")


def test_nouveau_compte(clients, journee):
    """S63 (manuel p. 72 et 73) : un compte de plus pour un membre, Max compte à créer, N° selon la numérotation, ouverture gratuite"""
    chef, agent, caisse = clients["chef"], clients["agent"], clients["caisse"]
    P = {"numero": 5, "code": "G", "famille": "BLOQUE", "libelle": "Epargne De Garantie", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 1,
         "operer": True, "depotCheque": False, "caution": False, "nantissement": True, "calculerInteret": False, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}
    assert chef.post("/api/produits-epargne", P, **H).status_code == 200
    g = next(x for x in agent.get("/api/epargne/comptes/produits").json() if x["code"] == "G")
    kalala = T("0412-000318")
    assert agent.get(f"/api/epargne/comptes/apercu?tiersId={kalala}&produitId={g['id']}").json()["numero"] == "0412-000318-05"
    k = cle()
    c = agent.post("/api/epargne/comptes", {"cle": k, "tiersId": kalala, "produitId": g["id"]}, **H).json()
    assert (c["numero"], c["devise"], c["ouvertLe"]) == ("0412-000318-05", "CDF", "2026-11-05")
    assert agent.post("/api/epargne/comptes", {"cle": k, "tiersId": kalala, "produitId": g["id"]}, **H).json()["id"] == c["id"]
    r = agent.post("/api/epargne/comptes", {"cle": cle(), "tiersId": kalala, "produitId": g["id"]}, **H)
    assert r.status_code == 422 and "Max compte à créer" in r.json()["message"]
    assert ident("select count(*) from ligne_ecriture l join compte_depot d on 'depot:' || d.id = l.contrat_ref where d.id = %s", (c["id"],)) == 0   # gratuite, sans écriture
    assert caisse.post("/api/epargne/comptes", {"cle": cle(), "tiersId": kalala, "produitId": g["id"]}, **H).status_code == 403


def test_releve_situation(clients, journee):
    """S64 (manuel p. 73 et 74) : relevé (report, mouvements, totaux, solde comptable) et situation du client"""
    agent, caisse = clients["agent"], clients["caisse"]
    cid = C("0412-000318-02")
    r = agent.get(f"/api/epargne/releve?compteId={cid}&du=2020-01-01&au=2026-11-05").json()
    assert r["report"] == 0 and r["lignes"]
    assert r["report"] + r["totalCredit"] - r["totalDebit"] == r["soldeFin"] == r["soldeComptable"]
    assert r["client"]["numero"] == "0412-000318" and r["entete"]["nom"]
    tard = agent.get(f"/api/epargne/releve?compteId={cid}&du=2026-11-06&au=2026-11-30").json()
    assert (tard["report"], tard["lignes"], tard["soldeFin"]) == (r["soldeFin"], [], r["soldeFin"])
    assert agent.get(f"/api/epargne/releve?compteId={cid}&du=2026-11-06&au=2026-11-01").status_code == 422
    e1 = agent.post("/api/epargne/releve/edition", {"compteId": cid, "du": "2020-01-01", "au": "2026-11-05"}, **H).json()
    e2 = agent.post("/api/epargne/releve/edition", {"compteId": cid, "du": "2020-01-01", "au": "2026-11-05"}, **H).json()
    assert (e1["numeroReleve"], e2["numeroReleve"], e1["soldeDisponible"], e1["effetsEnInstance"]) == (1, 2, r["soldeFin"] - r["montantBloque"], 0)
    assert ident("select count(*) from releve_edition") == 2
    s = agent.get(f"/api/epargne/situation?tiersId={T('0412-000318')}&date=2026-11-05").json()
    ligne = next(x for x in s["comptes"] if x["compte"] == "0412-000318-02")
    assert ligne["credit"] == r["soldeComptable"]


def test_securite(clients, settings):
    """Sécurité (registre T22 à T26) : blocage après des connexions refusées, journal de sécurité, règle des mots de passe, refus de droit noté,
    documentation de l'API fermée, en-têtes de sécurité"""
    from noyau.bd import valeur as v
    settings.SANS_MOT_DE_PASSE = False
    autre = Client()
    def essai(login, mdp):
        return autre.post("/api/session", {"login": login, "motDePasse": mdp}, **H)
    for _ in range(5):
        assert essai("jpmukendi", "faux-mot-1").status_code == 422
    r = essai("jpmukendi", "faux-mot-1")
    assert r.status_code == 429 and "Trop d'essais" in r.json()["message"]
    import psycopg
    from django.db import connection
    db = connection.settings_dict
    with psycopg.connect(dbname=db["NAME"], user=db["USER"], password=db["PASSWORD"], host=db["HOST"], port=db["PORT"], autocommit=True) as c:
        n = c.execute("select count(*) from journal_securite where login = 'jpmukendi' and evenement in ('connexion_refusee', 'connexion_bloquee')").fetchone()[0]
        c.execute("delete from journal_securite")          # la trace survit au refus ; on nettoie pour les autres essais
    assert n >= 6
    settings.SANS_MOT_DE_PASSE = True
    chef = clients["chef"]; connecter(chef, "jpmukendi")
    ag = chef.get("/api/gestion-utilisateurs", **H).json()["agences"][0]["id"]
    U = {"nom": "Essai Mot", "agenceId": ag, "login": "emot", "portable": "1"}
    r = chef.post("/api/gestion-utilisateurs", {**U, "motDePasse": "court1", "confirmation": "court1"}, **H)
    assert r.status_code == 422 and "8 caractères" in r.json()["message"]
    assert chef.post("/api/gestion-utilisateurs", {**U, "motDePasse": "Kinshasa2026", "confirmation": "Kinshasa2026"}, **H).status_code == 200
    r = chef.post("/api/banque/operations", {"cle": cle(), "type": "encaissement"}, content_type="application/json")   # sans l'en-tête de l'application
    assert r.status_code == 403
    assert chef.get("/api/docs").status_code in (200, 404)    # ouverte en développement seulement (DEBUG=1 ici)
    agent = clients["agent"]; connecter(agent, "bkasongo")      # registre T27 : lectures d'administration verrouillées
    for route in ("/api/gestion-utilisateurs", "/api/connexions", "/api/droits", "/api/profils-utilisateurs", "/api/profils"):
        assert agent.get(route).status_code == 403, route
    assert chef.get("/api/gestion-utilisateurs").status_code == 200


def test_depot_terme(clients, journee):
    """S65, S66 (manuel p. 75 et 76) : mise en place, calculs, validation par une autre personne, écriture du compte émetteur au compte DAT (PCCI 340)"""
    chef, agent = clients["chef"], clients["agent"]
    P = {"numero": 6, "code": "DAT", "famille": "EPARGNE", "libelle": "Dépôt à terme", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 1,
         "operer": True, "depotCheque": False, "caution": False, "nantissement": False, "calculerInteret": True, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}
    assert chef.post("/api/produits-epargne", P, **H).status_code == 200
    pid = next(x["id"] for x in chef.get("/api/produits-epargne").json()["produits"] if x["code"] == "DAT")
    assert agent.get("/api/epargne/dat/produits").json() == []
    assert chef.post("/api/parametrage-epargne", {"onglet": "DAT", "produitId": pid, "compteLie": "340"}, **H).status_code == 200
    kalala = T("0412-000318"); em = C("0412-000318-02")
    cdat = agent.post("/api/epargne/comptes", {"cle": cle(), "tiersId": kalala, "produitId": pid}, **H).json()["id"]
    base = {"produitId": pid, "tiersId": kalala, "compteEmetteurId": em, "compteDatId": cdat, "montant": 1000000, "duree": 12, "tauxInteret": "7,5",
            "tauxPenalite": "2", "aEcheance": True, "dateDepot": "2026-11-05", "observation": "", "reconduction": False}
    from noyau.depots_terme import compte_interet
    assert [compte_interet(m) for m in (6, 7, 9, 10, 12, 13)] == ["6124", "6122", "6122", "6122", "6122", "6121"]   # registre S65-4
    r = agent.post("/api/epargne/dat", {"cle": cle(), **base, "duree": 0}, **H)
    assert r.status_code == 422 and "au moins 1 mois" in r.json()["message"]
    r = agent.post("/api/epargne/dat", {"cle": cle(), **base, "compteDatId": em}, **H)
    assert r.status_code == 422 and "Compte DAT" in r.json()["message"]
    x = agent.post("/api/epargne/dat", {"cle": cle(), **base}, **H).json()
    assert (x["certificat"], x["statut"], x["montantInteret"], x["montantAVerser"], x["dateEcheance"], x["compteInteret"]) == (1, "saisie", 75000, 1075000, "2027-11-05", "6122")
    assert agent.post(f"/api/epargne/dat/{x['id']}/validation", **H).status_code == 403
    avant = ident("select coalesce(sum(case sens when 'C' then montant_devise else -montant_devise end), 0) from ligne_ecriture where contrat_ref = %s", (f"depot:{em}",))
    rv = chef.post(f"/api/epargne/dat/{x['id']}/validation", **H)
    assert rv.status_code == 200, rv.json()
    v = rv.json()
    assert v["statut"] == "valide" and v["piece"]
    apres = ident("select coalesce(sum(case sens when 'C' then montant_devise else -montant_devise end), 0) from ligne_ecriture where contrat_ref = %s", (f"depot:{em}",))
    assert avant - apres == 1000000
    assert ident("select sum(montant_devise) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero = '340' and l.contrat_ref = %s", (f"depot:{cdat}",)) == 1000000
    assert chef.get(f"/api/epargne/dat/{x['id']}/contrat").json()["dat"]["certificat"] == 1
    y = agent.post("/api/epargne/dat", {"cle": cle(), **base, "montant": 50000}, **H).json()        # Annuler (S65-6)
    ri = agent.get(f"/api/epargne/releve?compteId={em}&du=2026-01-01&au=2026-11-05").json()
    assert ri["soldeIndicatif"] == ri["soldeComptable"] - 50000                                      # S64-2 : DAT en attente compris
    assert agent.post(f"/api/epargne/dat/{y['id']}/annulation", **H).json()["statut"] == "annule"
    r = agent.post(f"/api/epargne/dat/{x['id']}/annulation", **H)
    assert r.status_code == 422 and "se rompt" in r.json()["message"]
    rch = lambda c: [(y["certificat"], y["terme"]) for y in chef.get(f"/api/epargne/dat/recherche?choix={c}&du=2026-01-01&au=2026-11-05", **H).json()]
    assert (rch("mise_en_place"), rch("encours"), rch("echus")) == ([(1, "Court terme")], [(1, "Court terme")], [])   # S68
    # S67 : 90 jours sur 1 000 000 à 7,5 % = 18 493 ; pénalité 2 % ; retenue 20 % sur l'intérêt brut (loi 23/053, art. 120)
    from datetime import date as D
    from decimal import Decimal as Dec
    from noyau.depots_terme import calcul_rupture
    dat = {"montant": 1000000, "taux_interet": Dec("7.5"), "taux_penalite": Dec("2"), "date_depot": D(2026, 8, 7), "date_echeance": D(2027, 8, 7), "tiers_id": kalala}
    assert calcul_rupture(dat, D(2026, 11, 5)) == {"jours": 90, "interet": 18493, "penalite": 20000, "tauxIrc": "20", "irc": 3699, "montantAVerser": 994794}
    assert agent.post(f"/api/epargne/dat/{x['id']}/rupture", {}, **H).status_code == 403
    assert chef.get(f"/api/epargne/dat/{x['id']}/rupture", **H).json()["tauxIrc"] == "20"
    r = chef.post(f"/api/epargne/dat/{x['id']}/rupture", {"dateRupture": "2026-11-06"}, **H)
    assert r.status_code == 422 and "journée ouverte" in r.json()["message"]
    rp = chef.post(f"/api/epargne/dat/{x['id']}/rupture", {}, **H)
    assert rp.status_code == 200, rp.json()
    rr = rp.json()["rupture"]
    assert (rp.json()["statut"], rr["interet"], rr["penalite"], rr["montantAVerser"], bool(rr["piece"])) == ("rompu", 0, 20000, 980000, True)
    fin = ident("select coalesce(sum(case sens when 'C' then montant_devise else -montant_devise end), 0) from ligne_ecriture where contrat_ref = %s", (f"depot:{em}",))
    assert apres - fin == -980000
    assert ident("select coalesce(sum(case sens when 'C' then montant_devise else -montant_devise end), 0) from ligne_ecriture where contrat_ref = %s", (f"depot:{cdat}",)) == 0
    assert ident("select sum(montant_devise) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero = '7791'") == 20000
    assert chef.post(f"/api/epargne/dat/{x['id']}/rupture", {}, **H).status_code == 422
    assert rch("encours") == []


def test_dat_echeance(clients, journee):
    """S65, reconduction automatique (manuel p. 75) : à l'ouverture de journée, un DAT échu est versé au compte émetteur, ou reconduit aux mêmes
    conditions avec l'intérêt net versé au compte émetteur (décisions du porteur, 19/11/2026) ; retenue de 20 % (loi 23/053, art. 120)"""
    from noyau.bd import une
    from noyau.depots_terme import traiter_echeances
    j, _ = journee
    chef, agent = clients["chef"], clients["agent"]
    P = {"numero": 6, "code": "DAT", "famille": "EPARGNE", "libelle": "Dépôt à terme", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 2,
         "operer": True, "depotCheque": False, "caution": False, "nantissement": False, "calculerInteret": True, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}
    assert chef.post("/api/produits-epargne", P, **H).status_code == 200
    pid = next(x["id"] for x in chef.get("/api/produits-epargne").json()["produits"] if x["code"] == "DAT")
    assert chef.post("/api/parametrage-epargne", {"onglet": "DAT", "produitId": pid, "compteLie": "340"}, **H).status_code == 200
    kalala = T("0412-000318"); em = C("0412-000318-02")
    solde = lambda c: ident("select coalesce(sum(case sens when 'C' then montant_devise else -montant_devise end), 0) from ligne_ecriture where contrat_ref = %s", (f"depot:{c}",))
    dats = []
    cdat = agent.post("/api/epargne/comptes", {"cle": cle(), "tiersId": kalala, "produitId": pid}, **H).json()["id"]   # un compte DAT porte les deux contrats
    for reconduction in (True, False):
        x = agent.post("/api/epargne/dat", {"cle": cle(), "produitId": pid, "tiersId": kalala, "compteEmetteurId": em, "compteDatId": cdat, "montant": 1000000,
                                            "duree": 12, "tauxInteret": "7,5", "tauxPenalite": "2", "aEcheance": True, "dateDepot": "2025-11-05",
                                            "observation": "", "reconduction": reconduction}, **H).json()
        assert x["dateEcheance"] == "2026-11-05", x
        assert chef.post(f"/api/epargne/dat/{x['id']}/validation", **H).status_code == 200
        dats.append((x, cdat))
    avant = solde(em)
    u = une("select * from utilisateur where login = 'jpmukendi'")
    assert traiter_echeances(u, {"id": j["id"], "date": j["date"]}) == 2
    (xr, cr), (xe, ce) = dats
    # Intérêt 1 000 000 × 7,5 % sur 12 mois = 75 000 ; retenue 20 % = 15 000 ; net 60 000
    assert solde(em) - avant == 60000 + 1060000
    assert solde(cdat) == 1000000                                                 # le capital reconduit reste, l'autre est rendu
    vieux = une("select * from depot_terme where id = %s", (xr["id"],))
    neuf = une("select * from depot_terme where reconduit_de = %s", (xr["id"],))
    assert (vieux["statut"], vieux["irc"], vieux["montant_verse"]) == ("reconduit", 15000, 60000)
    assert (neuf["statut"], neuf["montant"], neuf["duree_mois"], float(neuf["taux_interet"]), neuf["date_depot"].isoformat(), neuf["date_echeance"].isoformat(),
            neuf["reconduction"]) == ("valide", 1000000, 12, 7.5, "2026-11-05", "2027-11-05", True)
    assert une("select statut from depot_terme where id = %s", (xe["id"],))["statut"] == "echu"
    assert traiter_echeances(u, {"id": j["id"], "date": j["date"]}) == 0          # rien deux fois
    assert balance_equilibree(clients["compta"])


def test_plan_epargne(clients, journee):
    """S69 (manuel p. 78 à 80) : plan d'épargne sur un produit à régime spécial (PCCI 35), intérêt par échéance sur le cumul versé (taux du produit),
    cotisations prélevées sur le compte épargne, rupture sans pénalité, fin à l'ouverture de journée (décisions du porteur du 19/11/2026)"""
    from noyau.bd import une
    from noyau.plans_epargne import traiter_fins
    j, _ = journee
    chef, agent = clients["chef"], clients["agent"]
    P = {"numero": 7, "code": "PE", "famille": "EPARGNE", "libelle": "Plan épargne scolaire", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 1, "tauxInteret": "6",
         "operer": True, "depotCheque": False, "caution": False, "nantissement": False, "calculerInteret": True, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}
    r = chef.post("/api/produits-epargne", {**P, "tauxInteret": "abc"}, **H); assert r.status_code == 422 and "pourcentage" in r.json()["message"]
    assert chef.post("/api/produits-epargne", P, **H).status_code == 200
    pid = next(x["id"] for x in chef.get("/api/produits-epargne").json()["produits"] if x["code"] == "PE")
    assert agent.get("/api/epargne/plans/contexte").json()["produits"] == []            # pas encore au compte 35
    assert chef.post("/api/parametrage-epargne", {"onglet": "Epargne", "produitId": pid, "compteLie": "354"}, **H).status_code == 200
    assert [p["taux"] for p in agent.get("/api/epargne/plans/contexte").json()["produits"]] == ["6"]
    s = agent.post("/api/epargne/plans/simulation", {"duree": 12, "periodicite": "M", "montantTerme": 1200000}, **H).json()
    assert s == {"echeances": 12, "montantTerme": 1200000, "montantPeriodique": 100000}
    r = agent.post("/api/epargne/plans/simulation", {"duree": 1, "periodicite": "Trim", "montantPeriodique": 1}, **H)
    assert r.status_code == 422 and "ne se découpe pas" in r.json()["message"]
    kalala = T("0412-000318"); em = C("0412-000318-02")
    solde = lambda c: ident("select coalesce(sum(case sens when 'C' then montant_devise else -montant_devise end), 0) from ligne_ecriture where contrat_ref = %s", (f"depot:{c}",))
    cpl = agent.post("/api/epargne/comptes", {"cle": cle(), "tiersId": kalala, "produitId": pid}, **H).json()["id"]
    base = {"tiersId": kalala, "produitId": pid, "compteEpargneId": em, "comptePlanId": cpl, "duree": 12, "periodicite": "M", "montant": 100000, "modeReglement": "CHEQUE"}
    r = agent.post("/api/epargne/plans", {"cle": cle(), **base, "compteEpargneId": cpl}, **H); assert r.status_code == 422 and "autre compte" in r.json()["message"]
    x = agent.post("/api/epargne/plans", {"cle": cle(), **base}, **H).json()
    assert (x["numero"], x["statut"], x["dateDebut"], x["dateFin"], x["taux"]) == (1, "en_cours", "2026-11-05", "2027-11-05", "6")
    tb = agent.get(f"/api/epargne/plans/{x['id']}/tableau", **H).json()
    assert [(l["rang"], l["datePrevue"], l["interetPrevu"]) for l in tb["lignes"][:2]] == [(1, "2026-11-05", 500), (2, "2026-12-05", 1000)]   # 6 % / 12 sur le cumul
    assert tb["total"]["capital"] == 1200000 and tb["total"]["interetPrevu"] == 39000
    avant = solde(em)
    ids = [l["id"] for l in tb["lignes"][:2]]
    c = agent.post(f"/api/epargne/plans/{x['id']}/cotisations", {"echeances": ids}, **H).json()
    assert [l["interetReel"] for l in c["lignes"][:3]] == [500, 1000, 0]
    assert (avant - solde(em), solde(cpl)) == (200000, 200000)
    r = agent.post(f"/api/epargne/plans/{x['id']}/cotisations", {"echeances": ids[:1]}, **H); assert r.status_code == 422 and "déjà cotisée" in r.json()["message"]
    assert len(agent.get(f"/api/epargne/plans/{x['id']}/tableau?filtre=cotisees", **H).json()["lignes"]) == 2
    # Rupture le 05/11/2026 : seule l'échéance 1 est atteinte : intérêt 500, retenue 20 % = 100 ; versé 200 000 ; sans pénalité
    a = agent.get(f"/api/epargne/plans/{x['id']}/rupture", **H).json()
    assert (a["verse"], a["interet"], a["irc"], a["montantAVerser"]) == (200000, 500, 100, 200400)
    assert agent.post(f"/api/epargne/plans/{x['id']}/rupture", {}, **H).json()["statut"] == "rompu"
    assert (solde(cpl), avant - solde(em)) == (0, -400)
    # Fin à l'ouverture de journée : un plan échu le 05/11/2026, ses douze échéances cotisées
    cpl2 = cpl
    y = agent.post("/api/epargne/plans", {"cle": cle(), **base, "comptePlanId": cpl2, "dateDebut": "2025-11-05"}, **H).json()
    tous = [l["id"] for l in agent.get(f"/api/epargne/plans/{y['id']}/tableau", **H).json()["lignes"]]
    assert agent.post(f"/api/epargne/plans/{y['id']}/cotisations", {"echeances": tous}, **H).status_code == 200
    avant = solde(em)
    assert traiter_fins(une("select * from utilisateur where login = 'jpmukendi'"), {"id": j["id"], "date": j["date"]}) == 1
    fin = une("select * from plan_epargne where id = %s", (y["id"],))
    assert (fin["statut"], fin["interet_verse"], fin["irc"], fin["montant_verse"]) == ("termine", 39000, 7800, 1231200)
    assert solde(em) - avant == 1231200 and solde(cpl2) == 0
    assert ident("select sum(montant_devise) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero = '6134'") == 39500
    assert balance_equilibree(clients["compta"])


def test_profil_imf(clients, journee):
    """Profil de l'institution (S32) : une IMF n'a pas de parts sociales (loi 11/020, art. 14 et 15 ; PCCI 100) ni de condition d'adhésion préalable ;
    une entreprise de micro-crédit ne collecte pas l'épargne (loi 11/020, art. 12) : seul le dépôt de garantie (famille BLOQUE)"""
    from django.db import connection
    caisse, chef, agent = clients["caisse"], clients["chef"], clients["agent"]
    with connection.cursor() as c:
        c.execute("update institution set profil = 'societe_microfinance'")
    t = agent.post("/api/tiers", {**FICHE, "nom": "Ilunga", "postnom": "Kasa", "prenom": "Rose", "naissance": "1991-03-01", "pieceType": "Carte d'électeur",
                                  "pieceNumero": "1-0412-0888", "pieceExpire": "2031-01-01", "adresse": "Matete"}, **H).json()
    assert chef.post(f"/api/tiers/{t['id']}/visa", **H).status_code == 200
    r = caisse.post("/api/guichet/adhesions", {"cle": cle(), "tiersId": t["id"], "parts": 2, "depot": 0, "coupures": {}}, **H)
    assert r.status_code == 422 and "Pas de parts sociales" in r.json()["message"]
    a = chef.get(f"/api/banque/adhesions/apercu?tiersId={t['id']}&depot=500000", **H).json()
    assert a["valeurPart"] == 0 and a["total"] % 100000 == 0, a       # montants en centimes
    r = caisse.post("/api/guichet/adhesions", {"cle": cle(), "tiersId": t["id"], "parts": 0, "depot": 500000, "coupures": {"1000": a["total"] // 100000}}, **H)
    assert r.status_code == 200, r.json()
    assert ident("select count(*) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero like '103%%' and l.contrat_ref = %s", (f"parts:{t['id']}",)) == 0
    assert caisse.get(f"/api/tiers/{t['id']}/parts").json() == 0
    r = caisse.post("/api/guichet/parts", {"cle": cle(), "sens": "achat", "tiersId": t["id"], "nombre": 1, "coupures": {}}, **H)
    assert r.status_code == 422 and "Pas de parts sociales" in r.json()["message"]
    P = {"numero": 7, "code": "EPX", "famille": "EPARGNE", "libelle": "Epargne X", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 1,
         "operer": True, "depotCheque": False, "caution": False, "nantissement": False, "calculerInteret": False, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}
    with connection.cursor() as c:
        c.execute("update institution set profil = 'entreprise_microcredit'")
    r = chef.post("/api/produits-epargne", P, **H)
    assert r.status_code == 422 and "micro-crédit ne collecte pas" in r.json()["message"]
    assert chef.post("/api/produits-epargne", {**P, "famille": "BLOQUE", "libelle": "Garantie"}, **H).status_code == 200
    r = caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 500000, "coupures": {"5000": 1}}, **H)
    assert r.status_code == 422 and "micro-crédit ne collecte pas" in r.json()["message"]


def test_examen_renforce(clients, journee):
    """Écart E01 : espèces de 10 000 USD ou plus (loi 22/068, art. 23 ; Instr. BCC 15, art. 61 et 62 ; Instr. BCC 15 bis, art. 5 à 7)"""
    caisse, chef = clients["caisse"], clients["chef"]
    op = {"compteId": C("0412-000318-01"), "montant": 1000000, "coupures": {"100": 100}, "mandataire": ""}
    r = caisse.post("/api/guichet/depots", {"cle": cle(), **op}, **H)
    assert r.status_code == 422 and "Examen renforcé requis" in r.json()["message"]
    d = {"type": "depot", "tiersId": T("0412-000318"), "compteId": op["compteId"], "montant": 1000000, "devise": "USD"}
    assert "Sous le seuil" in caisse.post("/api/conformite/examens", {**d, "cle": cle(), "montant": 500000}, **H).json()["message"]
    e = caisse.post("/api/conformite/examens", {**d, "cle": cle()}, **H).json()
    assert (e["numero"], e["statut"], e["cumulUsd"]) == (1, "a_examiner", 10000.0)
    assert "attend la conformité" in caisse.post("/api/guichet/depots", {"cle": cle(), **op}, **H).json()["message"]
    assert caisse.get("/api/conformite/examens", **H).status_code == 403                          # confidentiel
    assert caisse.post(f"/api/conformite/examens/{e['id']}/examen", {"decision": "autorise"}, **H).status_code == 403
    r = chef.post(f"/api/conformite/examens/{e['id']}/examen", {"decision": "autorise", "origineFonds": "Vente de stock"}, **H)
    assert r.status_code == 422 and "Destination des fonds, Objet" in r.json()["message"]
    a = chef.post(f"/api/conformite/examens/{e['id']}/examen", {"decision": "autorise", "origineFonds": "Vente de stock", "destinationFonds": "Épargne",
                                                                "objet": "Dépôt de la recette"}, **H).json()
    assert a["statut"] == "autorise"
    assert caisse.post("/api/guichet/depots", {"cle": cle(), **op}, **H).json()["statut"] == "validee"
    assert "Examen renforcé requis" in caisse.post("/api/guichet/depots", {"cle": cle(), **op}, **H).json()["message"]   # l'autorisation sert une fois
    assert chef.get("/api/conformite/examens?statut=autorise", **H).json()[0]["operationFaite"] is True
    dc = chef.post(f"/api/conformite/examens/{e['id']}/declaration", {"date": "2026-11-05", "reference": "CENAREF-2026-118"}, **H).json()
    assert dc["declareLe"] == "2026-11-05" and chef.get("/api/conformite/examens?statut=a_declarer", **H).json() == []
    assert chef.get(f"/api/conformite/examens/{e['id']}/rapport", **H).json()["examen"]["objet"] == "Dépôt de la recette"
    # quatre yeux : celui qui demande n'examine pas
    e2 = chef.post("/api/conformite/examens", {**d, "cle": cle(), "type": "retrait"}, **H)
    assert e2.status_code == 403                                                                      # le chef n'a pas le guichet


def test_personne_exposee(clients, journee):
    """Écart E02 : Instr. BCC 15, art. 41, 64, 65 ; Instr. BCC 52, art. 26"""
    from noyau.bd import executer
    agent, chef, compta = clients["agent"], clients["chef"], clients["compta"]
    t = agent.post("/api/tiers", {**FICHE, "nom": "Mbala", "postnom": "Kanku", "prenom": "Pierre", "naissance": "1970-04-02", "pieceType": "Passeport",
                                  "pieceNumero": "OP-778899", "pieceExpire": "2031-01-01", "adresse": "Gombe", "personneExposee": True}, **H).json()
    r = chef.post(f"/api/tiers/{t['id']}/visa", **H)
    assert r.status_code == 422 and "autorisation de la conformité" in r.json()["message"]
    assert [x["client"] for x in chef.get("/api/conformite/ppe", **H).json()] == ["Mbala Kanku Pierre"]
    assert "Origine du patrimoine" in chef.post(f"/api/conformite/ppe/{t['id']}", {"fonction": "Député provincial"}, **H).json()["message"]
    assert chef.post(f"/api/conformite/ppe/{t['id']}", {"fonction": "Député provincial", "originePatrimoine": "Indemnités, ferme"}, **H).status_code == 200
    assert "Quatre yeux" in chef.post(f"/api/conformite/ppe/{t['id']}", {"autoriser": True}, **H).json()["message"]
    assert agent.get("/api/conformite/ppe", **H).status_code == 403
    assert compta.post(f"/api/conformite/ppe/{t['id']}", {"autoriser": True}, **H).status_code == 403
    executer("insert into profil_droit (profil_id, droit_code) select id, 'SC01' from profil where code = 'comptable'")
    assert compta.post(f"/api/conformite/ppe/{t['id']}", {"autoriser": True}, **H).json()["autorisePar"]
    assert compta.post(f"/api/conformite/ppe/{t['id']}/information", {"date": "2026-11-05", "reference": "CENAREF-PPE-07"}, **H).json()["informeLe"] == "2026-11-05"
    assert chef.post(f"/api/tiers/{t['id']}/visa", **H).json()["statut"] == "actif"


def test_profil_risque(clients, journee):
    """Écart E08 : Instr. BCC 15, art. 27, 28, 41, 51"""
    agent, chef = clients["agent"], clients["chef"]
    echues = chef.get("/api/conformite/profils", **H).json()
    k = next(x for x in echues if x["membre"] == "0412-000318")
    assert k["niveau"] == "" and k["echue"] is True
    assert agent.get("/api/conformite/profils", **H).status_code == 403
    assert agent.post(f"/api/conformite/profils/{k['tiersId']}", {"niveau": "faible", "motif": "x", "donneesRevues": True}, **H).status_code == 403
    assert "Motif" in chef.post(f"/api/conformite/profils/{k['tiersId']}", {"niveau": "faible"}, **H).json()["message"]
    assert "données d'identification" in chef.post(f"/api/conformite/profils/{k['tiersId']}", {"niveau": "faible", "motif": "Commerçante, opérations régulières"}, **H).json()["message"]
    v = chef.post(f"/api/conformite/profils/{k['tiersId']}", {"niveau": "moyen", "motif": "Commerçante, opérations régulières", "donneesRevues": True}, **H).json()
    assert (v["niveauLibelle"], v["evalueLe"], v["prochaineRevue"], v["echue"]) == ("Moyen", "2026-11-05", "2027-05-05", False)
    assert all(x["membre"] != "0412-000318" for x in chef.get("/api/conformite/profils", **H).json())
    assert any(x["membre"] == "0412-000318" for x in chef.get("/api/conformite/profils?filtre=tous", **H).json())
    from noyau.bd import executer
    executer("update tiers set personne_exposee = true where id = %s", (k["tiersId"],))
    assert "niveau Élevé" in chef.post(f"/api/conformite/profils/{k['tiersId']}", {"niveau": "faible", "motif": "x", "donneesRevues": True}, **H).json()["message"]


def test_operations_atypiques(clients, journee):
    """Écart E09 : Instr. BCC 15, art. 31, 35, 36"""
    agent, chef, caisse = clients["agent"], clients["chef"], clients["caisse"]
    P = "?du=2026-01-01&au=2026-11-05"
    assert chef.get("/api/conformite/atypiques" + P, **H).json() == []                      # aucun critère fixé : rien n'est surveillé
    assert "au moins 2" in chef.post("/api/conformite/atypiques/criteres", {"nombreJour": 1}, **H).json()["message"]
    assert agent.post("/api/conformite/atypiques/criteres", {"montantUsd": 100}, **H).status_code == 403
    assert chef.post("/api/conformite/atypiques/criteres", {"montantUsd": "300", "nombreJour": 2}, **H).json() == {"montantUsd": 300.0, "montantEleveUsd": None, "nombreJour": 2, "reveilMois": None}
    for _ in range(2):    # 10 000 CDF, deux fois : petits montants, deux mouvements du compte dans la journée
        assert caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}, **H).status_code == 200
    al = [x for x in chef.get("/api/conformite/atypiques" + P, **H).json() if x["compte"] == "0412-000318-02" and x["date"] == "2026-11-05"]
    assert len(al) == 2 and all("2 mouvements ou plus" in " ".join(x["criteres"]) for x in al)
    assert agent.get("/api/conformite/atypiques" + P, **H).status_code == 403
    assert "Analyse" in chef.post("/api/conformite/atypiques/analyses", {"cle": al[0]["cle"], "conclusion": "atypique"}, **H).json()["message"]
    assert "Seule une opération conclue atypique" in chef.post("/api/conformite/atypiques/declarations", {"cle": al[0]["cle"], "date": "2026-11-05", "reference": "R"}, **H).json()["message"]
    v = chef.post("/api/conformite/atypiques/analyses", {"cle": al[0]["cle"], "conclusion": "atypique", "analyse": "Dépôts fractionnés sans motif"}, **H).json()
    assert (v["statut"], v["analysePar"]) == ("atypique", "J.-P. Mukendi")
    assert "déjà analysée" in chef.post("/api/conformite/atypiques/analyses", {"cle": al[0]["cle"], "conclusion": "justifiee", "analyse": "x"}, **H).json()["message"]
    d = chef.post("/api/conformite/atypiques/declarations", {"cle": al[0]["cle"], "date": "2026-11-05", "reference": "CENAREF-DOS-03"}, **H).json()
    assert d["declareLe"] == "2026-11-05"
    r = chef.get("/api/conformite/atypiques/rapport" + P, **H).json()
    assert [x["reference"] for x in r["operations"]] == ["CENAREF-DOS-03"]
    assert all(x["statut"] != "a_analyser" for x in chef.get("/api/conformite/atypiques" + P + "&statut=analysee", **H).json())


def test_gel_des_avoirs(clients, journee):
    """Écart E10 : loi 22/068 modifiée, art. 158 bis et 162 ; loi 22/069, art. 71 à 77"""
    agent, chef, caisse = clients["agent"], clients["chef"], clients["caisse"]
    d = {"membre": "0412-000318", "source": "conasafic", "decisionReference": "CONASAFIC/2026/014", "decisionLe": "2026-11-05", "motif": "Inscription sur la liste nationale"}
    assert agent.post("/api/conformite/gels", d, **H).status_code == 403
    assert "Référence de la décision" in chef.post("/api/conformite/gels", {**d, "decisionReference": ""}, **H).json()["message"]
    g = chef.post("/api/conformite/gels", d, **H).json()
    assert (g["client"], g["sourceLibelle"]) == ("Kalala Mbuyi Josée", "Liste nationale (CONASAFIC)")
    assert "déjà gelés" in chef.post("/api/conformite/gels", d, **H).json()["message"]
    r = caisse.post("/api/guichet/retraits", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 1000000, "coupures": {"10000": 1}}, **H)
    assert r.status_code == 422 and "Avoirs gelés" in r.json()["message"]
    assert caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}, **H).status_code == 200
    assert chef.post(f"/api/conformite/gels/{g['id']}/information", {"date": "2026-11-05", "reference": "CENAREF-GEL-02"}, **H).json()["informeLe"] == "2026-11-05"
    assert [x["id"] for x in chef.get("/api/conformite/gels", **H).json()] == [g["id"]]
    assert chef.post(f"/api/conformite/gels/{g['id']}/levee", {"date": "2026-11-05", "reference": "CONASAFIC/2026/020"}, **H).json()["levePar"] == "J.-P. Mukendi"
    assert chef.get("/api/conformite/gels", **H).json() == []
    assert caisse.post("/api/guichet/retraits", {"cle": cle(), "compteId": C("0412-000318-02"), "montant": 1000000, "coupures": {"10000": 1}}, **H).status_code == 200


def test_comptes_inactifs(clients, journee):
    """Écart E11 : loi 22/069, titre III, chap. Ier (dix ans ; lettre six mois avant)"""
    from noyau.bd import executer
    chef, agent = clients["chef"], clients["agent"]
    assert chef.get("/api/epargne/inactifs", **H).json() == []                         # comptes ouverts le 15/01/2026
    executer("update compte_depot set ouvert_le = '2016-12-01' where numero = '0412-000320-02'")   # sans opération depuis, hors reprise des soldes
    k = next(x for x in chef.get("/api/epargne/inactifs", **H).json() if x["compte"] == "0412-000320-02")
    assert (k["derniereOperation"], k["lettreDue"], k["echeance"], k["statut"]) == ("2016-12-01", "2026-06-01", "2026-12-01", "lettre")
    assert agent.get("/api/epargne/inactifs", **H).status_code == 403
    assert "accusé de réception" in chef.post(f"/api/epargne/inactifs/{k['compteId']}/lettre", {"date": "2026-11-05"}, **H).json()["message"]
    v = chef.post(f"/api/epargne/inactifs/{k['compteId']}/lettre", {"date": "2026-11-05", "reference": "AR-0001"}, **H).json()
    assert (v["statut"], v["referenceLettre"]) == ("lettre_envoyee", "AR-0001")
    assert chef.get(f"/api/epargne/inactifs/{k['compteId']}/lettre", **H).json()["compte"]["echeance"] == "2026-12-01"
    executer("update compte_depot set ouvert_le = '2016-04-01' where numero = '0412-000320-02'")
    assert next(x for x in chef.get("/api/epargne/inactifs", **H).json() if x["compte"] == "0412-000320-02")["statut"] == "a_cloturer"
    # une opération du titulaire fait sortir le compte de la liste
    assert clients["caisse"].post("/api/guichet/depots", {"cle": cle(), "compteId": C("0412-000320-02"), "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}, **H).status_code == 200
    assert all(x["compte"] != "0412-000320-02" for x in chef.get("/api/epargne/inactifs", **H).json())


def test_cloture_compte(clients, journee):
    """S70 (manuel p. 80, écran complété) : clôture à la demande, gratuite, solde nul (Instr. BCC 37, annexe ; registre S48-1) ;
    compte inactif depuis dix ans, lettre notée : solde aux avoirs en cours de prescription (PCCI 369), puis versé à la BCC (loi 22/069, titre III, chap. Ier)"""
    from noyau.bd import executer
    chef, agent, caisse = clients["chef"], clients["agent"], clients["caisse"]
    solde = lambda ref: ident("select coalesce(sum(case sens when 'C' then montant_devise else -montant_devise end), 0) from ligne_ecriture where contrat_ref = %s", (ref,))
    cdf = C("0412-000318-02")
    r = chef.post("/api/epargne/clotures", {"compteId": cdf}, **H); assert r.status_code == 422 and "encore un solde" in r.json()["message"]
    assert agent.post("/api/epargne/clotures", {"compteId": cdf}, **H).status_code == 403
    # Compte inactif : Lukusa, sans opération depuis le 01/04/2016 ; la lettre d'abord
    luk = C("0412-000320-02")
    executer("update compte_depot set ouvert_le = '2016-04-01' where id = %s", (luk,))
    r = chef.post("/api/epargne/clotures/inactifs", {"compteId": luk}, **H); assert r.status_code == 422 and "lettre" in r.json()["message"]
    assert chef.post(f"/api/epargne/inactifs/{luk}/lettre", {"date": "2026-05-01", "reference": "AR-0007"}, **H).status_code == 200
    s0 = solde(f"depot:{luk}")
    assert s0 > 0
    v = chef.post("/api/epargne/clotures/inactifs", {"compteId": luk}, **H).json()
    assert (v["motif"], v["solde"], v["verseeBccLe"]) == ("inactivite", s0, "")
    assert (solde(f"depot:{luk}"), solde(f"prescription:{luk}")) == (0, s0)
    assert all(x["compte"] != "0412-000320-02" for x in chef.get("/api/epargne/inactifs", **H).json())
    r = caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": luk, "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}, **H)
    assert r.status_code == 422 and "clôturé" in r.json()["message"]                                # registre S70-6
    # Versement à la BCC depuis le compte de l'institution à la BCC
    bid = chef.post("/api/banques", {"code": "BCC", "libelle": "Banque Centrale du Congo", "compteLiaison": "5601", "adresse": ""}, **H).json()["banques"][0]["id"]
    j = chef.get("/api/banques").json()["journaux"][0]["id"]
    assert chef.post("/api/banques/comptes", {"banqueId": bid, "compte": "56010003", "numeroBancaire": "BCC-CDF", "devise": "CDF", "journalId": j, "contactNom": "Service"}, **H).status_code == 200
    cb = next(c["id"] for c in chef.get("/api/banques").json()["comptes"] if c["numeroBancaire"] == "BCC-CDF")
    a = chef.get("/api/epargne/clotures/avoirs", **H).json()
    assert [x["compte"] for x in a] == ["0412-000320-02"]
    r = chef.post("/api/epargne/clotures/versement-bcc", {"ids": [a[0]["id"]], "compteBancaireId": cb}, **H); assert r.status_code == 422 and "Référence" in r.json()["message"]
    w = chef.post("/api/epargne/clotures/versement-bcc", {"ids": [a[0]["id"]], "compteBancaireId": cb, "reference": "BCC-2026-114"}, **H).json()
    assert (w["total"], w["avoirs"][0]["verseeBccLe"], w["avoirs"][0]["referenceBcc"]) == (s0, "2026-11-05", "BCC-2026-114")
    assert solde(f"prescription:{luk}") == 0
    r = chef.post("/api/epargne/clotures/versement-bcc", {"ids": [a[0]["id"]], "compteBancaireId": cb, "reference": "X"}, **H); assert r.status_code == 422
    # Clôture à la demande : un compte ouvert sans solde
    P = {"numero": 8, "code": "EPV", "famille": "EPARGNE", "libelle": "Épargne vacances", "devise": "USD", "soldeMinimum": 0, "nbMaxComptes": 1,
         "operer": True, "depotCheque": False, "caution": False, "nantissement": False, "calculerInteret": False, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}
    assert chef.post("/api/produits-epargne", P, **H).status_code == 200
    pid = next(x["id"] for x in chef.get("/api/produits-epargne").json()["produits"] if x["code"] == "EPV")
    rn = agent.post("/api/epargne/comptes", {"cle": cle(), "tiersId": T("0412-000318"), "produitId": pid}, **H)
    assert rn.status_code == 200, rn.content
    neuf = rn.json()["id"]
    v = chef.post("/api/epargne/clotures", {"compteId": neuf, "observation": "Demande du client"}, **H).json()
    assert (v["motif"], v["solde"], v["observation"]) == ("demande", 0, "Demande du client")
    assert chef.post("/api/epargne/clotures", {"compteId": neuf}, **H).status_code == 422                 # déjà clos
    assert balance_equilibree(clients["compta"])


def test_blocage_compte_et_montant(clients, journee):
    """S71 (manuel p. 81) : bloquer un montant ou tout le compte, avec motif ; déblocage depuis l'historique (modèle S94) ; le disponible suit"""
    chef, agent, caisse = clients["chef"], clients["agent"], clients["caisse"]
    usd = C("0412-000318-01")
    e = chef.get(f"/api/epargne/blocages?compteId={usd}", **H).json()
    assert (e["montantBloque"], e["compteBloque"], e["historique"]) == (0, False, [])
    solde = e["solde"]
    def refus(corps):
        r = chef.post("/api/epargne/blocages", {"compteId": usd, **corps}, **H); assert r.status_code == 422, r.content; return r.json()["message"]
    assert "Motif" in refus({"bloquerMontant": True, "montant": 1000})
    assert "Cocher" in refus({"motif": "x"})
    assert "épargne libre" in refus({"bloquerMontant": True, "montant": solde + 1, "motif": "Saisie"})
    assert agent.post("/api/epargne/blocages", {"compteId": usd, "bloquerMontant": True, "montant": 1000, "motif": "x"}, **H).status_code == 403
    e = chef.post("/api/epargne/blocages", {"compteId": usd, "bloquerMontant": True, "montant": 100000, "motif": "Litige"}, **H).json()
    assert (e["montantBloque"], e["epargneLibre"]) == (100000, solde - 100000)
    assert next(c for c in caisse.get(f"/api/tiers/{T('0412-000318')}/comptes").json() if c["id"] == usd)["disponible"] == solde - 100000
    e = chef.post("/api/epargne/blocages", {"compteId": usd, "bloquerCompte": True, "motif": "Décision de justice"}, **H).json()
    assert (e["compteBloque"], e["montantBloque"], e["epargneLibre"]) == (True, solde, 0)
    r = caisse.post("/api/guichet/retraits", {"cle": cle(), "compteId": usd, "montant": 100, "coupures": {"1": 1}}, **H)
    assert r.status_code == 422 and "disponible" in r.json()["message"]
    assert "déjà bloqué" in refus({"bloquerCompte": True, "motif": "x"})
    tout = next(b for b in e["historique"] if b["action"] == "Bloquer compte")
    r = chef.post(f"/api/epargne/blocages/{tout['id']}/deblocage", {}, **H); assert r.status_code == 422 and "Motif" in r.json()["message"]
    e = chef.post(f"/api/epargne/blocages/{tout['id']}/deblocage", {"motif": "Mainlevée"}, **H).json()
    assert (e["compteBloque"], e["montantBloque"]) == (False, 100000)
    m = next(b for b in e["historique"] if b["action"] == "Bloqué Montant")
    e = chef.post(f"/api/epargne/blocages/{m['id']}/deblocage", {"motif": "Litige réglé"}, **H).json()
    assert (e["montantBloque"], e["montantDebloque"], e["epargneLibre"]) == (0, 100000, solde)
    assert [b["enCours"] for b in e["historique"]] == [False, False]


def test_rapports_epargne(clients, journee):
    """S72 (manuel p. 82 à 84) : virements compte à compte, garanties, données de la recherche multicritère, indicateurs, comptes inactifs et dormants"""
    from noyau.bd import executer
    chef, agent, caisse = clients["chef"], clients["agent"], clients["caisse"]
    assert caisse.get("/api/epargne/rapports/virements?du=2026-01-01&au=2026-11-05", **H).status_code == 403
    assert agent.get("/api/epargne/rapports/virements?du=2026-01-01&au=2026-11-05", **H).json() == []
    # Un DAT constitué : le compte émetteur et le compte DAT bougent dans la même écriture (registre S72-1)
    P = {"numero": 6, "code": "DAT", "famille": "EPARGNE", "libelle": "Dépôt à terme", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 1,
         "operer": True, "depotCheque": False, "caution": False, "nantissement": False, "calculerInteret": True, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}
    assert chef.post("/api/produits-epargne", P, **H).status_code == 200
    pid = next(x["id"] for x in chef.get("/api/produits-epargne").json()["produits"] if x["code"] == "DAT")
    assert chef.post("/api/parametrage-epargne", {"onglet": "DAT", "produitId": pid, "compteLie": "340"}, **H).status_code == 200
    kalala, em = T("0412-000318"), C("0412-000318-02")
    cdat = agent.post("/api/epargne/comptes", {"cle": cle(), "tiersId": kalala, "produitId": pid}, **H).json()["id"]
    x = agent.post("/api/epargne/dat", {"cle": cle(), "produitId": pid, "tiersId": kalala, "compteEmetteurId": em, "compteDatId": cdat, "montant": 500000, "duree": 6,
                                        "tauxInteret": "5", "tauxPenalite": "1", "aEcheance": True, "dateDepot": "2026-11-05", "observation": "", "reconduction": False}, **H).json()
    assert chef.post(f"/api/epargne/dat/{x['id']}/validation", **H).status_code == 200
    v = agent.get("/api/epargne/rapports/virements?du=2026-11-05&au=2026-11-05", **H).json()
    assert sorted((l["compte"], l["debit"], l["credit"]) for l in v) == [("0412-000318-02", 500000, 0), (f"0412-000318-{6:02d}", 0, 500000)]
    assert agent.get("/api/epargne/rapports/garanties?du=2026-01-01&au=2026-11-05", **H).json() == []        # aucun crédit encore
    cs = {c["compte"]: c for c in agent.get("/api/epargne/rapports/comptes?du=2026-11-05&au=2026-11-05", **H).json()}
    assert cs["0412-000318-02"]["debits"] == 500000 and cs["0412-000318-02"]["operations"][0]["debit"] == 500000
    # Comptes dormants : dix ans sans opération (loi 22/069) ; inactifs : selon le nombre de jours
    executer("update compte_depot set ouvert_le = '2016-04-01' where numero = '0412-000320-02'")
    assert [c["compte"] for c in chef.get("/api/epargne/rapports/inactivite?date=2026-11-05", **H).json()] == ["0412-000320-02"]
    tous = chef.get("/api/epargne/rapports/inactivite?date=2026-11-05&jours=0&tous=true", **H).json()
    assert len(tous) >= 5 and next(c for c in tous if c["compte"] == "0412-000320-02")["jours"] == 3870
    assert chef.get("/api/epargne/rapports/inactivite?date=2026-11-05&jours=1", **H).json() != []
    ind = chef.get("/api/epargne/rapports/indicateurs?date=2026-11-05", **H).json()
    assert ind["annee"] == 2026 and sum(x["total"] for x in ind["comptesParSexe"]) >= 5 and ind["regroupementParSexe"] and ind["creditsEncours"] == []
    assert sum(x["parts"] for x in ind["partsSociales"]) > 0


def test_registre_des_membres(clients, journee):
    """Écart E12 : AUSCOOP, art. 9 ; loi 002/2002, art. 67"""
    from noyau.bd import executer
    chef, agent, caisse = clients["chef"], clients["agent"], clients["caisse"]
    m = chef.get("/api/clients/registre-membres", **H).json()["membres"]
    assert [(x["rang"], x["numero"]) for x in m[:3]] == [(1, "0412-000318"), (2, "0412-000319"), (3, "0412-000320")]
    k = m[0]
    assert (k["nom"], k["prenom"], k["piece"], k["partsSouscrites"], k["partsLiberees"], k["admissionLe"]) == ("Kalala Mbuyi", "Josée", "Carte d'électeur n° 1-0412-0089", 2, 2, "2026-01-15")
    assert agent.get("/api/clients/registre-membres", **H).status_code == 200
    assert caisse.get("/api/clients/registre-membres", **H).status_code == 403
    executer("update institution set profil = 'societe_microfinance'")
    assert "propre aux coopératives" in chef.get("/api/clients/registre-membres", **H).json()["message"]


def test_conditions_de_banque(clients, journee):
    """Écart E15 : Instr. BCC 40, art. 2 à 6"""
    e = clients["chef"].get("/api/parametrage/conditions-banque", **H).json()
    assert e["date"] == "2026-11-05" and e["retenueInterets"] == 20
    assert {"EAV-CDF", "EAV-USD"} <= {p["code"] for p in e["epargne"]}
    f = next(x for x in e["frais"] if x["libelle"] == "Part sociale standard")
    assert (f["operation"], f["nature"], f["fondement"]) == ("ADHESION", "Montant", "Part sociale (loi 002/2002, art. 22, 2°)")


def test_retenues_a_reverser(clients, journee):
    """Écart E16 : arrêté 008/2025, art. 2 (reversement au plus tard le 15 du mois suivant) ; loi 23/053, art. 120"""
    from noyau.bd import executer
    chef, agent, compta = clients["chef"], clients["agent"], clients["compta"]
    P = {"numero": 6, "code": "DAT", "famille": "EPARGNE", "libelle": "Dépôt à terme", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 1,
         "operer": True, "depotCheque": False, "caution": False, "nantissement": False, "calculerInteret": True, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}
    chef.post("/api/produits-epargne", P, **H)
    pid = next(x["id"] for x in chef.get("/api/produits-epargne").json()["produits"] if x["code"] == "DAT")
    chef.post("/api/parametrage-epargne", {"onglet": "DAT", "produitId": pid, "compteLie": "340"}, **H)
    kalala = T("0412-000318"); em = C("0412-000318-02")
    cdat = agent.post("/api/epargne/comptes", {"cle": cle(), "tiersId": kalala, "produitId": pid}, **H).json()["id"]
    x = agent.post("/api/epargne/dat", {"cle": cle(), "produitId": pid, "tiersId": kalala, "compteEmetteurId": em, "compteDatId": cdat, "montant": 1000000, "duree": 12,
                                         "tauxInteret": "7,5", "tauxPenalite": "2", "aEcheance": True, "dateDepot": "2026-08-07", "observation": "", "reconduction": False}, **H).json()
    chef.post(f"/api/epargne/dat/{x['id']}/validation", **H)
    assert chef.post(f"/api/epargne/dat/{x['id']}/rupture", {}, **H).json()["statut"] == "rompu"
    assert chef.get("/api/comptabilite/retenues?annee=2026&mois=11", **H).status_code == 403           # le chef n'a pas SF01
    e = compta.get("/api/comptabilite/retenues?annee=2026&mois=11", **H).json()
    assert (e["echeance"], e["statut"], e["totaux"]) == ("2026-12-15", "a_reverser", [{"devise": "CDF", "montant": 3699}])
    r = e["retenues"][0]
    assert (r["client"], r["certificat"], r["base"], r["taux"], r["retenue"]) == ("Kalala Mbuyi Josée", 1, 18493, 20.0, 3699)
    assert compta.get("/api/comptabilite/retenues?annee=2026&mois=10", **H).json()["statut"] == "aucune"
    assert "quittance" in compta.post("/api/comptabilite/retenues/reversements", {"annee": 2026, "mois": 11, "date": "2026-11-05"}, **H).json()["message"]
    v = compta.post("/api/comptabilite/retenues/reversements", {"annee": 2026, "mois": 11, "date": "2026-11-05", "reference": "DGI-Q-0042"}, **H).json()
    assert (v["statut"], v["reference"]) == ("reverse", "DGI-Q-0042")
    assert "déjà noté" in compta.post("/api/comptabilite/retenues/reversements", {"annee": 2026, "mois": 11, "date": "2026-11-05", "reference": "X"}, **H).json()["message"]
    assert agent.post("/api/comptabilite/retenues/reversements", {"annee": 2026, "mois": 11, "date": "2026-11-05", "reference": "X"}, **H).status_code == 403


def test_journal_de_securite(clients, journee):
    """Écart E17 : Instr. BCC 008, art. 16"""
    from datetime import date
    from noyau.bd import executer
    chef, compta = clients["chef"], clients["compta"]
    jour = date.today().isoformat()
    assert chef.post("/api/session", {"login": "inconnu"}, **H).status_code >= 400                  # identifiant inconnu : noté
    r = chef.get(f"/api/securite/journal?du={jour}&au={jour}", **H)
    assert r.status_code == 403                                                                      # aucun profil de départ n'a SA01
    connecter(chef, "jpmukendi")
    executer("insert into profil_droit (profil_id, droit_code) select id, 'SA01' from profil where code = 'comptable'")
    ev = compta.get(f"/api/securite/journal?du={jour}&au={jour}", **H).json()
    types = {x["evenement"] for x in ev}
    assert {"connexion", "connexion_impossible", "acces_refuse"} <= types
    assert any(x["login"] == "inconnu" and x["evenementLibelle"] == "Connexion impossible" for x in ev)
    assert all(x["evenement"] == "acces_refuse" for x in compta.get(f"/api/securite/journal?du={jour}&au={jour}&evenement=acces_refuse", **H).json())
    assert "Événement inconnu" in compta.get(f"/api/securite/journal?du={jour}&au={jour}&evenement=x", **H).json()["message"]


def test_client_mineur(clients, journee):
    """Écart E18 : Code de la famille, art. 219, 221, 289 ; loi 002/2002, art. 22"""
    from noyau.bd import executer
    agent, chef = clients["agent"], clients["chef"]
    def enroler(nom, naissance, piece):
        return agent.post("/api/tiers", {**FICHE, "nom": nom, "prenom": "Junior", "naissance": naissance, "pieceType": "Passeport", "pieceNumero": piece,
                                         "pieceExpire": "2031-01-01", "adresse": "Matete"}, **H).json()
    m = enroler("Ilunga", "2010-03-01", "OP-100001")
    r = chef.post(f"/api/tiers/{m['id']}/visa", {}, **H)
    assert r.status_code == 422 and "ne peut être admis comme membre" in r.json()["message"]
    v = chef.post(f"/api/tiers/{m['id']}/visa", {"emancipationReference": "TPE Matete RC 112/2026"}, **H).json()
    assert (v["statut"], v["emancipationReference"]) == ("actif", "TPE Matete RC 112/2026")
    d = enroler("Kabeya", "2008-11-05", "OP-100002")                       # dix-huit ans accomplis le jour du visa
    assert chef.post(f"/api/tiers/{d['id']}/visa", {}, **H).json()["statut"] == "actif"
    executer("update institution set profil = 'societe_microfinance'")
    k = enroler("Mbuyi", "2012-06-01", "OP-100003")
    assert "représentant légal" in chef.post(f"/api/tiers/{k['id']}/visa", {}, **H).json()["message"]
    v = chef.post(f"/api/tiers/{k['id']}/visa", {"representantLegal": "Mbuyi Jean, père, passeport OP-200300"}, **H).json()
    assert (v["statut"], v["representantLegal"]) == ("actif", "Mbuyi Jean, père, passeport OP-200300")


def test_parts_a_rembourser_et_auxiliaires(clients, journee):
    """Écarts E19 (AUSCOOP, art. 11) et E20 (loi 002/2002, art. 23)"""
    from noyau.bd import executer
    agent, chef = clients["agent"], clients["chef"]
    executer("update tiers set statut = 'resilie', resilie_le = '2025-10-01' where numero = '0412-000320'")
    r = chef.get("/api/clients/registre-membres", **H).json()["aRembourser"]
    k = next(x for x in r if x["numero"] == "0412-000320")
    assert (k["parts"], k["sortieLe"], k["echeance"], k["enRetard"]) == (1, "2025-10-01", "2026-10-01", True)
    m = agent.post("/api/tiers", {**FICHE, "nom": "Tshibola", "prenom": "Junior", "naissance": "2011-05-01", "pieceType": "Passeport", "pieceNumero": "OP-100009",
                                  "pieceExpire": "2031-01-01", "adresse": "Matete"}, **H).json()
    assert "statuts le prévoient" in chef.post(f"/api/tiers/{m['id']}/visa", {"auxiliaire": True}, **H).json()["message"]
    executer("update institution set membres_auxiliaires = 'Statuts, art. 12'")
    assert "représentant légal" in chef.post(f"/api/tiers/{m['id']}/visa", {"auxiliaire": True}, **H).json()["message"]
    v = chef.post(f"/api/tiers/{m['id']}/visa", {"auxiliaire": True, "representantLegal": "Tshibola Marie, mère, carte d'électeur 1-0412-0555"}, **H).json()
    assert (v["statut"], v["auxiliaire"]) == ("actif", True)
    assert next(x for x in chef.get("/api/clients/registre-membres", **H).json()["membres"] if x["numero"] == v["numero"])["categorie"] == "Auxiliaire"


def test_options_du_produit_au_guichet(clients, journee):
    """Registre S74-5 : solde minimum, retrait maximum par jour, Opérer sur compte, Dépôt de chèque (S27, p. 40)"""
    from noyau.bd import executer
    caisse = clients["caisse"]
    cpt = C("0412-000318-02")
    dep = lambda: caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": cpt, "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}, **H)
    ret = lambda: caisse.post("/api/guichet/retraits", {"cle": cle(), "compteId": cpt, "montant": 1000000, "coupures": {"10000": 1}}, **H)
    for _ in range(3):
        assert dep().status_code == 200
    executer("update produit_epargne set retrait_max_jour = 1500000 where code = 'EAV-CDF'")
    assert ret().status_code == 200
    r = ret()
    assert r.status_code == 422 and "Retrait maximum par jour du produit : 15 000 CDF ; déjà retiré ce jour : 10 000 CDF" in r.json()["message"]
    executer("update produit_epargne set retrait_max_jour = null where code = 'EAV-CDF'")
    solde = ident("select sum(case sens when 'C' then montant_devise else -montant_devise end) from ligne_ecriture where contrat_ref = %s", (f"depot:{cpt}",))
    executer("update produit_epargne set solde_minimum = %s where code = 'EAV-CDF'", (solde - 500000,))
    r = ret()
    assert r.status_code == 422 and "solde minimum du produit compris" in r.json()["message"]
    executer("update produit_epargne set solde_minimum = 0, operer_compte = false where code = 'EAV-CDF'")
    r = dep()
    assert r.status_code == 422 and "Opérer sur compte = Non" in r.json()["message"]
    assert "Opérer sur compte = Non" in ret().json()["message"]


def test_adhesion_compte_en_usd(clients, journee):
    """Registre S73-1 : frais et parts en CDF, premier dépôt dans la devise du compte, un billetage par devise (T12)"""
    caisse, chef, agent = clients["caisse"], clients["chef"], clients["agent"]
    t = agent.post("/api/tiers", {**FICHE, "produitCode": "EAV-USD", "nom": "Kabongo", "prenom": "Ruth", "pieceType": "Passeport", "pieceNumero": "OP-300001",
                                  "pieceExpire": "2031-01-01", "adresse": "Matete"}, **H).json()
    assert chef.post(f"/api/tiers/{t['id']}/visa", **H).status_code == 200
    corps = {"cle": cle(), "tiersId": t["id"], "parts": 1, "depot": 10000, "coupures": {"1000": 4}}
    assert "billetage" in caisse.post("/api/guichet/adhesions", corps, **H).json()["message"]          # 100 USD sans billetage en USD
    o = caisse.post("/api/guichet/adhesions", {**corps, "coupuresDepot": {"100": 1}}, **H).json()
    assert (o["devise"], o["montant"]) == ("CDF", 400000)
    assert [(c["devise"], c["solde"]) for c in caisse.get(f"/api/tiers/{t['id']}/comptes").json()] == [("USD", 10000)]
    assert caisse.get(f"/api/tiers/{t['id']}/parts").json() == 1
    assert ident("select count(*) from operation where tiers_id = %s and type = 'depot' and trim(devise) = 'USD' and montant = 10000", (t["id"],)) == 1


def test_solde_negatif_seulement_compte_courant(clients):
    """Registre S27-4, S74-6 : PCCI, compte 33 ; Instr. BCC 003, art. 7"""
    chef = clients["chef"]; connecter(chef, "jpmukendi")
    P = {"numero": 7, "code": "CC", "famille": "EPARGNE", "libelle": "Compte courant", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 1,
         "operer": True, "depotCheque": True, "caution": False, "nantissement": False, "calculerInteret": False, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}
    r = chef.post("/api/produits-epargne", {**P, "soldeNegatif": True}, **H)
    assert r.status_code == 422 and "seulement pour un compte courant" in r.json()["message"]
    assert chef.post("/api/produits-epargne", P, **H).status_code == 200
    pid = next(x["id"] for x in chef.get("/api/produits-epargne").json()["produits"] if x["code"] == "CC")
    assert chef.post("/api/parametrage-epargne", {"onglet": "Courant", "produitId": pid, "compteLie": "331"}, **H).status_code == 200
    assert chef.post(f"/api/produits-epargne/{pid}", {**P, "soldeNegatif": True}, **H).status_code == 200
    r = chef.post("/api/parametrage-epargne", {"onglet": "Epargne", "produitId": pid, "compteLie": "330"}, **H)
    assert r.status_code == 422 and "il se range seulement en Courant" in r.json()["message"]


def test_convention_et_admission(clients, journee):
    """Écart E04 : convention de compte (loi 22/069, titre III) ; écart E05 : admission par le Conseil d'Administration (loi 002/2002, art. 22, 6°)"""
    from noyau.bd import executer
    agent, chef = clients["agent"], clients["chef"]
    cv = agent.get(f"/api/epargne/comptes/{C('0412-000318-02')}/convention", **H).json()
    assert (cv["compte"]["numero"], cv["client"]["numero"], cv["coopec"]) == ("0412-000318-02", "0412-000318", True)
    t = agent.post("/api/tiers", {**FICHE, "nom": "Ngoy", "postnom": "Mwamba", "prenom": "Anne", "naissance": "1988-06-01", "pieceType": "Carte d'électeur",
                                  "pieceNumero": "1-0412-0777", "pieceExpire": "2031-01-01", "adresse": "Matete"}, **H).json()
    executer("update institution set delegation_admission = null")
    r = chef.post(f"/api/tiers/{t['id']}/visa", **H)
    assert r.status_code == 422 and "décision du Conseil d'Administration" in r.json()["message"]
    v = chef.post(f"/api/tiers/{t['id']}/visa", {"admissionLe": "2026-11-04", "admissionReference": "PV CA n° 12/2026"}, **H).json()
    assert (v["statut"], v["admissionLe"], v["admissionReference"]) == ("actif", "2026-11-04", "PV CA n° 12/2026")


def test_centrale_incidents(clients, journee):
    """Écart E06 : Instr. BCC 52, art. 10, 13, 15"""
    agent, chef = clients["agent"], clients["chef"]
    t = agent.post("/api/tiers", {**FICHE, "nom": "Kasa", "postnom": "Lufu", "prenom": "Rita", "naissance": "1993-07-01", "pieceType": "Carte d'électeur",
                                  "pieceNumero": "1-0412-0666", "pieceExpire": "2031-01-01", "adresse": "Matete"}, **H).json()
    assert agent.get("/api/conformite/cip?du=2026-01-01&au=2026-12-31", **H).status_code == 403
    assert chef.post(f"/api/tiers/{t['id']}/visa", **H).status_code == 200
    l = chef.get("/api/conformite/cip?du=2026-11-01&au=2026-11-30&statut=a_declarer", **H).json()
    nc = next(e for e in l if e["type"] == "nouveau_client" and e["tiersId"] == t["id"])
    assert (nc["date"], nc["echeance"], nc["icu"]) == ("2026-11-05", "2026-11-09", "")
    ev = [{"type": nc["type"], "objetId": nc["objetId"]}]
    assert "précède" in chef.post("/api/conformite/cip/declarations", {"evenements": ev, "date": "2026-11-04", "reference": "CIP-1"}, **H).json()["message"]
    assert chef.post("/api/conformite/cip/declarations", {"evenements": ev, "date": "2026-11-05", "reference": "CIP-1"}, **H).status_code == 200
    assert "déjà déclaré" in chef.post("/api/conformite/cip/declarations", {"evenements": ev, "date": "2026-11-05", "reference": "CIP-2"}, **H).json()["message"]
    assert [(e["membre"], e["reference"]) for e in chef.get("/api/conformite/cip?du=2026-11-01&au=2026-11-30&statut=declare", **H).json()] == [(t["numero"], "CIP-1")]
    assert chef.post(f"/api/conformite/cip/icu/{t['id']}", {"icu": "ICU-0001"}, **H).status_code == 200
    assert "déjà noté" in chef.post(f"/api/conformite/cip/icu/{T('0412-000318')}", {"icu": "ICU-0001"}, **H).json()["message"]


def test_visa_sans_copie_piece(clients, journee):
    """Écart E03, décision du porteur (15/11/2026) : pas de visa d'une personne physique sans copie de sa pièce (Instr. BCC 15, art. 12 et 29)"""
    agent, chef = clients["agent"], clients["chef"]
    fiche = {k: v for k, v in FICHE.items() if k != "images"}
    t = agent.post("/api/tiers", {**fiche, "nom": "Lusamba", "postnom": "Kitenge", "prenom": "Paul", "naissance": "1985-02-03", "pieceType": "Carte d'électeur",
                                  "pieceNumero": "1-0412-0555", "pieceExpire": "2031-01-01", "adresse": "Matete"}, **H).json()
    r = chef.post(f"/api/tiers/{t['id']}/visa", **H)
    assert r.status_code == 422 and "copie de la pièce d'identité, justificatif d'adresse" in r.json()["message"]
    assert agent.post(f"/api/tiers/{t['id']}/specimen", {"copiePiece": "data:image/png;base64,iVBORw0KGgo="}, **H).status_code == 200
    r = chef.post(f"/api/tiers/{t['id']}/visa", **H)
    assert r.status_code == 422 and "Manquant : justificatif d'adresse" in r.json()["message"]
    assert agent.post(f"/api/tiers/{t['id']}/specimen", {"justificatifAdresse": "data:image/png;base64,iVBORw0KGgo="}, **H).status_code == 200
    assert chef.post(f"/api/tiers/{t['id']}/visa", **H).json()["statut"] == "actif"


def test_plaintes(clients, journee):
    """Écart E07 : Instr. BCC 39, art. 5, 7, 10, 15, 19"""
    caisse, chef, compta = clients["caisse"], clients["chef"], clients["compta"]
    p = caisse.post("/api/plaintes", {"cle": cle(), "tiersId": T("0412-000318"), "canal": "personne", "provenance": "guichet", "nature": "retrait",
                                      "objet": "Attente de deux heures au guichet"}, **H).json()
    assert (p["reference"], p["recueLe"], p["echeance"]) == ("PL-2026-000001", "2026-11-05", "2026-12-20")
    r = caisse.post("/api/plaintes", {"cle": cle(), "canal": "fax", "provenance": "agence", "nature": "frais", "objet": ""}, **H)
    assert r.status_code == 422 and "Plaignant, Objet" in r.json()["message"]
    assert caisse.post(f"/api/plaintes/{p['id']}/reponse", {"fondee": True, "reponse": "Excuses"}, **H).status_code == 403
    assert "réparation" in chef.post(f"/api/plaintes/{p['id']}/reponse", {"fondee": True, "reponse": "Excuses"}, **H).json()["message"]
    rp = chef.post(f"/api/plaintes/{p['id']}/reponse", {"fondee": True, "reponse": "Excuses", "reparation": "Frais remboursés"}, **H).json()
    assert (rp["statut"], rp["fondee"]) == ("repondue", True)
    rap = chef.get("/api/plaintes/rapport?du=2026-10-01&au=2026-12-31", **H).json()
    assert (rap["total"], rap["suites"]["fondee"]) == (1, 1)
    assert [x["reference"] for x in chef.get("/api/plaintes?statut=repondue&du=&au=", **H).json()] == ["PL-2026-000001"]   # sans dates : toute la liste
    assert compta.get("/api/plaintes", **H).status_code == 403


def test_balance_agee(clients, journee):
    """S98 (p. 120) : Date lancement, Lancer la balance âgée ; classement à la date (Instr. BCC 003, art. 3, 6, 7) ; un crédit sain d'un client qui a un
    crédit litigieux est classé impayé (art. 6, al. 2) ; une nouvelle génération à la même date remplace la précédente (registre S98-1 à S98-4, CR-16)"""
    from django.db import connection
    agent, caisse = clients["agent"], clients["caisse"]
    c1 = credit_debloque(clients, journee)
    lancer = lambda d: agent.post("/api/credit/balance-agee", {"date": d}, **H)
    r = lancer("2026-11-05")
    assert r.status_code == 200, r.content
    assert r.json()["credits"] == 1 and r.json()["message"].startswith("Opération effectuée avec succès en ")
    assert ident("select classe from balance_agee_ligne") == "sain"
    c2 = credit_debloque(clients, journee, {**PRODUIT, "numero": "L009"})
    with connection.cursor() as cur:                                     # première échéance de c1 passée depuis 10 jours, puis 31 jours
        cur.execute("update echeance set date_due = (date_due - interval '40 days')::date where credit_id = %s", (c1,))
    lancer("2026-11-05")
    assert ident("select count(*) from balance_agee") == 1
    l = {x[0]: x[1:] for x in lignes_bd("select credit_id, classe, jours_retard, assimile from balance_agee_ligne")}
    assert l == {c1: ("impaye", 10, False), c2: ("impaye", 0, True)}
    with connection.cursor() as cur:
        cur.execute("update echeance set date_due = (date_due - interval '21 days')::date where credit_id = %s", (c1,))
    lancer("2026-11-05")
    assert ident(f"select classe || ' ' || jours_retard from balance_agee_ligne where credit_id = {c1}") == "douteux 31"
    assert "obligatoire" in lancer("").json()["message"]
    assert "pas après" in lancer("2026-11-06").json()["message"]
    assert lancer("2026-11-01").json()["credits"] == 0                  # aucun crédit débloqué à cette date
    assert caisse.post("/api/credit/balance-agee", {"date": "2026-11-05"}, **H).status_code == 403


def test_provisions(clients, journee):
    """S99 (p. 121) : Charger crédits (balance âgée de la date, S98) ; Provisionner : capital déclassé en 390 et provision au taux de la tranche en 380
    (Instr. BCC 003, art. 12 ; PCCI 38, 39, 6902, 7902) ; remboursement porté au compte déclassé ; Radier par anticipation seulement pour un
    irrécupérable au 31 décembre (art. 9 et 10 ; CR-18), perte 6910 et suivi hors bilan 0612/096 (registre S99-1 à S99-6)"""
    from django.db import connection
    agent, caisse = clients["agent"], clients["caisse"]
    solde = lambda n: ident("select coalesce(sum(case when l.sens = 'D' then l.montant_devise else -l.montant_devise end), 0) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero = %s", (n,))
    cid = credit_debloque(clients, journee)
    cap = ident("select montant from credit where id = %s", (cid,))
    sain = solde("329")
    def recule(n):
        with connection.cursor() as cur:
            cur.execute("update echeance set date_due = (date_due - %s * interval '1 day')::date where credit_id = %s", (n, cid))
    q = lambda: agent.get("/api/credit/provisions", {"date": "2026-11-05"}, **H)
    assert "lancer d'abord" in q().json()["message"]
    recule(40)                                                         # 10 jours de retard : impayé, 5 %
    agent.post("/api/credit/balance-agee", {"date": "2026-11-05"}, **H)
    x = q().json()[0]
    assert (x["id"], x["capitalRestant"], x["joursRetard"], x["degre"], x["taux"], x["provisionRequise"], x["provision"]) == (cid, cap, 10, "Impayés", 5, cap * 5 // 100, 0)
    assert "Cocher" in agent.post("/api/credit/provisions/provisionner", {"date": "2026-11-05", "credits": []}, **H).json()["message"]
    r = agent.post("/api/credit/provisions/provisionner", {"date": "2026-11-05", "credits": [cid]}, **H)
    assert r.status_code == 200, r.content
    assert (solde("3900"), solde("329"), solde("6902"), solde("3800")) == (cap, sain - cap, cap * 5 // 100, -(cap * 5 // 100))
    recule(21)                                                         # 31 jours : douteux, 25 %
    agent.post("/api/credit/balance-agee", {"date": "2026-11-05"}, **H)
    assert agent.post("/api/credit/provisions/tout", {"date": "2026-11-05"}, **H).status_code == 200
    assert (solde("3900"), solde("3901"), solde("3800"), solde("3801"), solde("6902")) == (0, cap, 0, -(cap * 25 // 100), cap * 25 // 100)
    assert balance_equilibree(agent)
    # Remboursement : le capital sort du compte déclassé (3901)
    r = caisse.post(f"/api/guichet/remboursement/{cid}", {"cle": cle(), "mandataire": "Moi-même", "montant": 5000000, "coupures": {"20000": 2, "10000": 1}}, **H)
    assert r.status_code == 200, r.content
    pc = ident("select (repartition->>'capital')::bigint from remboursement where credit_id = %s", (cid,))
    assert pc > 0 and solde("3901") == cap - pc and solde("329") == sain - cap
    cap -= pc
    # Radiation : refusée hors du 31 décembre et pour un crédit non irrécupérable
    assert "31 décembre" in agent.post("/api/credit/provisions/radiation", {"date": "2026-11-05", "credits": [cid]}, **H).json()["message"]
    with connection.cursor() as cur:
        cur.execute("update journee_comptable set date_comptable = '2026-12-31' where id = %s", (journee[0]["id"],))
    agent.post("/api/credit/balance-agee", {"date": "2026-12-31"}, **H)
    assert "irrécupérable" in agent.post("/api/credit/provisions/radiation", {"date": "2026-12-31", "credits": [cid]}, **H).json()["message"]
    recule(400)
    agent.post("/api/credit/balance-agee", {"date": "2026-12-31"}, **H)
    r = agent.post("/api/credit/provisions/radiation", {"date": "2026-12-31", "credits": [cid]}, **H)
    assert r.status_code == 200, r.content
    assert ident("select statut from credit where id = %s", (cid,)) == "passe_en_perte"
    assert (solde("3904"), solde("3901"), solde("3801"), solde("3804"), solde("6910"), solde("0612"), solde("096")) == (0, 0, 0, 0, cap, cap, -cap)
    assert balance_equilibree(agent)
    assert clients["caisse"].get("/api/credit/provisions", {"date": "2026-12-31"}, **H).status_code == 403


def test_engagement_signature(clients, journee):
    """S100 (p. 121) : engagement par signature en hors bilan (0012 contre 090), frais = montant × pourcentage + forfait prélevés sur le compte épargne
    (727), garantie saisie bloquée sur le compte garanti ; plafond par client avec les crédits (Instr. BCC 002, art. 23 et 28 ; CR-14, CR-22)"""
    agent, chef, caisse = clients["agent"], clients["chef"], clients["caisse"]
    solde = lambda n: ident("select coalesce(sum(case when l.sens = 'D' then l.montant_devise else -l.montant_devise end), 0) from ligne_ecriture l join compte c on c.id = l.compte_id where c.numero = %s", (n,))
    k = T("0412-000318")
    b = agent.get(f"/api/credit/engagements/beneficiaire/{k}", **H).json()
    ce = next(x for x in b["comptes"] if x["devise"] == "CDF")
    base = {"tiersId": k, "reference": "ES-001", "type": "caution", "description": "Caution de marché", "montant": 50000000, "duree": 6, "pourcentage": "1,5",
            "forfait": 100000, "garantie": 200000, "compteEpargneId": ce["id"], "compteGarantiId": ce["id"]}
    refus = lambda corps: agent.post("/api/credit/engagements", corps, **H).json()["message"]
    assert "Référence, Type engagement" in refus({**base, "reference": " ", "type": "x"})
    assert "Fonds propres" in refus(base)
    chef.post("/api/credit/fonds-propres", {"dateArrete": "2026-10-31", "montant": 100000000}, **H)
    assert "Plafond par emprunteur" in refus(base)                      # 500 000 CDF > 5 % ou 10 % de 1 000 000 CDF
    chef.post("/api/credit/fonds-propres", {"dateArrete": "2026-10-31", "montant": 100000000000}, **H)
    assert "Garantie" in refus({**base, "garantie": ce["disponible"]})
    r = agent.post("/api/credit/engagements", base, **H)
    assert r.status_code == 200, r.content
    e = r.json()
    assert (e["frais"], e["dateFin"], e["typeLibelle"], e["piece"] != "") == (50000000 * 15 // 1000 + 100000, "2027-05-05", "Caution", True)
    assert (solde("0012"), solde("090"), solde("727")) == (50000000, -50000000, -e["frais"])
    c2 = next(x for x in agent.get(f"/api/credit/engagements/beneficiaire/{k}", **H).json()["comptes"] if x["id"] == ce["id"])
    assert c2["disponible"] == ce["disponible"] - e["frais"] - 200000
    assert "déjà utilisée" in refus(base)
    assert [x["reference"] for x in agent.get("/api/credit/engagements", **H).json()] == ["ES-001"]
    from noyau.dossiers import encours
    assert encours({"institution_id": ident("select institution_id from tiers where id = %s", (k,)), "agence_id": ident("select id from agence limit 1")}, [k]) >= 50000000
    assert caisse.get("/api/credit/engagements", **H).status_code == 403


def test_rapports_credit(clients, journee):
    """S101 (p. 121, menu seul) : huit rapports (registre S101-1 à S101-10, CR-13) ; indicateur de gestion selon l'annexe de l'Instr. BCC 004 (CR-26)"""
    from django.db import connection
    agent, caisse = clients["agent"], clients["caisse"]
    cid = credit_debloque(clients, journee)
    cap = ident("select montant from credit where id = %s", (cid,))
    with connection.cursor() as cur:                                     # première échéance due il y a 10 jours
        cur.execute("update echeance set date_due = (date_due - interval '40 days')::date where credit_id = %s", (cid,))
    e1 = lignes_bd("select date_due, capital, interet from echeance where credit_id = %s order by rang limit 1", (cid,))[0]
    r = lambda nom, **k: agent.get(f"/api/credit/rapports/{nom}", k, **H)
    j = r("journal", du="2026-11-01", au="2026-11-05").json()
    assert [c["titre"] for c in j["colonnes"]][:3] == ["Date", "N°Pièce", "N° crédit"] and any(x["v"][2] == "0412/L001/00001" for x in j["lignes"])
    b = r("base", du="2026-11-01", au="2026-11-05").json()["lignes"]
    assert (b[0]["v"][0], b[0]["v"][8], b[0]["v"][9], b[0]["v"][10]) == ("0412/L001/00001", cap, cap, "Débloqué")
    g = r("multicritere", date="2026-11-05", mode="groupe", ordre="degre").json()["lignes"]
    assert [x["v"][:2] for x in g] == [["Impayés", 1]]
    assert "lancer d'abord" in r("synthese", date="2026-11-05").json()["message"]
    agent.post("/api/credit/balance-agee", {"date": "2026-11-05"}, **H)
    s = r("synthese", date="2026-11-05").json()["lignes"]
    assert (s[0]["v"][1], s[0]["v"][2], s[0]["v"][5], s[0]["v"][6], s[0]["v"][7]) == (1, cap, 100, 5, cap * 5 // 100)
    t = r("taux", du="2026-10-01", au="2026-11-05").json()["lignes"]
    assert (t[0]["v"][1], t[0]["v"][2], t[0]["v"][4]) == (e1[1] + e1[2], 0, 0)
    x = r("exigibles", du="2026-10-01", au="2026-11-05").json()["lignes"]
    assert (x[0]["v"][5], x[0]["v"][8], x[0]["v"][9]) == (e1[0].isoformat(), e1[1] + e1[2], 10)
    pv = r("previsionnel", du="2026-11-01", au="2027-12-31").json()["lignes"]
    assert pv[-1]["v"][3] == e1[1] and sum(y["v"][1] for y in pv) == ident("select sum(capital) from echeance where credit_id = %s and date_due > '2026-11-05'", (cid,))
    ind = {y["v"][1]: y["v"] for y in r("indicateurs", du="2026-11-01", au="2026-11-05").json()["lignes"]}
    assert ind["Portefeuille à Risque"][4] == 100 and ind["Portefeuille à Risque"][6] == "Non"
    assert ind["Nombre d'emprunteurs par agent de crédit"][4] == 1
    assert "Rapport inconnu" in r("x").json()["message"] and "Du" in r("base", du="2026-11-06", au="2026-11-05").json()["message"]
    assert caisse.get("/api/credit/rapports/base", {"du": "2026-11-01", "au": "2026-11-05"}, **H).status_code == 403


def test_rapports_epargne_credit(clients, journee):
    """S72-2 et S72-4 lus du module Crédit : épargne obligatoire (S75), dépôt de garantie et caution (S94), crédits en cours par produit et devise"""
    agent, chef = clients["agent"], clients["chef"]
    cid = credit_debloque(clients, journee)
    c = lignes_bd("select montant, epargne_obligatoire from credit where id = %s", (cid,))[0]
    mw, k2 = T("0412-000319"), C("0412-000319-02")
    assert agent.post(f"/api/credit/garanties/{cid}/ajout", {"type": "caution", "cautionId": mw, "compteId": k2, "montant": 1000000}, **H).status_code == 200
    g = agent.get("/api/epargne/rapports/garanties?du=2026-11-01&au=2026-11-05", **H).json()
    assert [(x["credit"], x["montantPret"], x["epargneGarantie"], x["garantieEncours"], x["garantieLiberee"]) for x in g] == \
        [("0412/L001/00001", c[0], c[1], c[1] + 1000000, 0)]
    gid = agent.get(f"/api/credit/garanties/{cid}?type=caution", **H).json()["garanties"][0]["id"]
    agent.post(f"/api/credit/garanties/liberation/{gid}", {"montant": 400000}, **H)
    g = agent.get("/api/epargne/rapports/garanties?du=2026-11-01&au=2026-11-05", **H).json()[0]
    assert (g["garantieEncours"], g["garantieLiberee"]) == (c[1] + 600000, 400000)
    ind = chef.get("/api/epargne/rapports/indicateurs?date=2026-11-05", **H).json()
    assert (ind["garantieEpargne"], ind["caution"]) == (c[1], 600000)
    assert ind["creditsEncours"] == [{"produit": ident("select nom from produit_credit limit 1"), "devise": "CDF", "prets": 1, "encours": c[0]}]
