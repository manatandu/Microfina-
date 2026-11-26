"""Installation d'une institution réelle sur une base vide, puis le chemin jusqu'au premier dépôt par les routes des écrans
(audit du 21/11/2026, point bloquant B5 ; registre T227). Noms inventés."""
import uuid

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client

from tests.test_tranche import FICHE, H, vider_journal_securite

pytestmark = pytest.mark.django_db(transaction=False)
INSTALLATION = {"nom": "Institution d'essai", "sigle": "IE", "type": "coopec", "agence_code": "01", "agence_nom": "Siège", "exercice": 2026,
                "admin_login": "admin.essai", "admin_nom": "Administrateur Essai"}


@pytest.fixture(autouse=True)
def journal_vide(django_db_setup, django_db_blocker):
    vider_journal_securite()      # il s'écrit hors de la transaction de l'essai : les connexions refusées d'un essai ne bloquent pas le suivant


def val(sql, params=()):
    from noyau.bd import valeur
    return valeur(sql, params)


def test_installation_une_seule_fois_et_sans_donnees_fictives():
    with pytest.raises(CommandError, match="identifiant de l'administrateur"):
        call_command("installer", **{**INSTALLATION, "admin_login": " "})
    with pytest.raises(CommandError, match="sans espace"):
        call_command("installer", **{**INSTALLATION, "admin_login": "admin essai"})
    assert val("select count(*) from institution") == 0                       # un refus ne laisse rien
    call_command("installer", **INSTALLATION)
    assert val("select nom || '|' || profil || '|' || demonstration || '|' || mot_de_passe_jours from institution") == "Institution d'essai|coopec|false|90"
    with pytest.raises(CommandError, match="une installation par institution"):
        call_command("installer", **{**INSTALLATION, "nom": "Seconde"})
    # Rien de fictif : ni membre, ni compte, ni guichet, ni produit, ni cours, ni journée ; un seul utilisateur visible
    for table in ("tiers", "compte_depot", "guichet", "produit_epargne", "cours_change", "journee_comptable", "ecriture", "frais"):
        assert val(f"select count(*) from {table}") == 0, table
    assert val("select string_agg(login, ',' order by login) from utilisateur where not est_admin_systeme") == "admin.essai"
    assert val("select count(*) from profil") == 10 and val("select count(*) from exercice where actif and ouvert and annee = 2026") == 1
    assert val("select count(*) from schema_comptable where valide_par is not null") == val("select count(*) from schema_comptable") > 0
    # La graine et les exemples ne s'appliquent qu'à la démonstration
    call_command("graine"); call_command("exemples")
    assert val("select count(*) from institution") == 1 and val("select count(*) from tiers") == 0
    assert val("select count(*) from utilisateur where not est_admin_systeme") == 1


def test_de_l_installation_au_premier_depot(settings, monkeypatch):
    call_command("installer", **INSTALLATION)
    settings.SANS_MOT_DE_PASSE = False
    admin = Client()
    ouvrir = lambda c, login, mdp: c.post("/api/session", {"login": login, "motDePasse": mdp}, **H)
    assert ouvrir(admin, "admin.essai", "Depart-2026").status_code == 422      # pas encore de mot de passe : compte fermé
    monkeypatch.setenv("LIKELEMBA_MOT_DE_PASSE", "Depart-2026")
    call_command("definir_mot_de_passe", "admin.essai")
    assert ouvrir(Client(), "installation", "Depart-2026").status_code == 422   # le compte technique ne se connecte pas
    assert ouvrir(admin, "admin.essai", "Depart-2026").status_code == 200
    s = admin.get("/api/session").json()
    assert s["motDePasseAChanger"] is True and s["roles"] == ["administrateur"]  # registre T207 : remplacé à la première connexion

    def changer(c, ancien, nouveau):
        r = c.post("/api/session/mot-de-passe", {"ancien": ancien, "nouveau": nouveau, "confirmation": nouveau}, **H)
        assert r.status_code == 200, r.content
    changer(admin, "Depart-2026", "Essai-admin-1")

    # Le premier administrateur crée les utilisateurs et leur donne un profil (S05, S06)
    ag = admin.get("/api/referentiel").json()["agence"]["id"]
    profils = {p["nom"]: p["id"] for p in admin.get("/api/profils-utilisateurs", **H).json()["profils"]}
    postes = {}
    for n, (login, nom, profil) in enumerate((("c.essai", "Chef Essai", "CHEF D'AGENCE"), ("k.essai", "Caissier Essai", "CAISSIER"),
                                              ("a.essai", "Agent Essai", "AGENT DE CRÉDIT"))):
        r = admin.post("/api/gestion-utilisateurs", {"nom": nom, "agenceId": ag, "login": login, "motDePasse": "Depart-2026", "confirmation": "Depart-2026",
                                                     "portable": f"+243 810 000 00{n}"}, **H)
        assert r.status_code == 200, r.content
        uid = val("select id from utilisateur where login = %s", (login,))
        r = admin.post("/api/profils-utilisateurs", {"utilisateurId": uid, "profilId": profils[profil]}, **H)
        assert r.status_code == 200, r.content
        postes[login] = Client()
        assert ouvrir(postes[login], login, "Depart-2026").status_code == 200
        changer(postes[login], "Depart-2026", f"Essai-poste-{n}")
    assert "installation" not in [u["login"] for u in admin.get("/api/profils-utilisateurs", **H).json()["utilisateurs"]]
    chef, caisse, agent = postes["c.essai"], postes["k.essai"], postes["a.essai"]

    # Le chef d'agence paramètre : quartier du siège (S20), fiche Société avec la valeur de la part des statuts (S32), produit, guichet, journée
    matete = next(c for c in chef.get("/api/localisation/commune", **H).json()["lignes"] if c["nom"] == "Matete")
    assert chef.post("/api/localisation/quartier", {"parentId": matete["id"], "nom": "Quartier d'essai"}, **H).status_code == 200
    soc = chef.get("/api/societe").json()["institution"]
    assert (soc["denomination"], soc["typeBase"]) == ("Institution d'essai", "coopec")
    r = chef.post("/api/societe", {**soc, "province": "Kinshasa", "ville": "Kinshasa", "commune": "Matete", "quartier": "Quartier d'essai",
                                   "valeurPart": 500000, "partEffet": "2026-01-01"}, **H)
    assert r.status_code == 200, r.content
    r = chef.post("/api/produits-epargne", {"numero": 2, "code": "EAV-CDF", "famille": "EPARGNE", "libelle": "Épargne à vue", "devise": "CDF", "soldeMinimum": 0,
                                            "nbMaxComptes": 1, "operer": True, "depotCheque": False, "caution": False, "nantissement": False,
                                            "calculerInteret": False, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}, **H)
    assert r.status_code == 200, r.content
    l = chef.get("/api/guichets", **H).json()
    jca = next(x["id"] for x in l["journaux"] if x["code"] == "CA")
    r = chef.post("/api/guichets", {"agenceId": l["agences"][0]["id"], "code": "G1", "designation": "Caisse 1", "typeGuichet": "PRINCIPALE", "journalId": jca,
                                    "plafonds": {"CDF": {"maximum": 0, "retrait": 0}, "USD": {"maximum": 0, "retrait": 0}}, "compteGuichet": "57000000",
                                    "compteLiaison": "57900000", "compteSurplus": "77900000", "compteManquant": "67100000", "billetage": True, "actif": True}, **H)
    assert r.status_code == 200, r.content
    g1 = next(g["id"] for g in r.json()["guichets"] if g["code"] == "G1")
    r = chef.post("/api/affectations-guichets", {"utilisateurId": val("select id from utilisateur where login = 'k.essai'"), "guichetId": g1, "voirSolde": True}, **H)
    assert r.status_code == 200, r.content
    r = chef.post("/api/journees", {"date": "2026-11-05"}, **H); assert r.status_code == 200, r.content
    r = chef.post("/api/cours", {"devise": "USD", "jour": "2026-11-05", "cours": 2850}, **H); assert r.status_code == 200, r.content   # cours du jour (S35)

    # L'agent enrôle, le chef vise, le caissier encaisse l'adhésion et le premier dépôt
    r = agent.post("/api/tiers", {**FICHE, "nom": "Premier", "pieceType": "Passeport", "pieceNumero": "IE-1"}, **H); assert r.status_code == 200, r.content
    t = r.json()
    assert "art. 22" in chef.post(f"/api/tiers/{t['id']}/visa", **H).json()["message"]      # admission par le Conseil d'administration (loi 002/2002)
    r = chef.post(f"/api/tiers/{t['id']}/visa", {"admissionLe": "2026-11-04", "admissionReference": "PV CA n° 1/2026"}, **H); assert r.status_code == 200, r.content
    r = caisse.post("/api/caisses", {"guichetId": g1}, **H); assert r.status_code == 200, r.content
    cle = lambda: str(uuid.uuid4())
    corps = {"cle": cle(), "tiersId": t["id"], "parts": 1, "depot": 0, "coupures": {"5000": 1}}
    r = caisse.post("/api/guichet/adhesions", corps, **H)
    assert r.status_code == 200, r.content
    compte = caisse.get(f"/api/tiers/{t['id']}/comptes").json()[0]
    r = caisse.post("/api/guichet/depots", {"cle": cle(), "compteId": compte["id"], "montant": 1000000, "coupures": {"10000": 1}, "mandataire": ""}, **H)
    assert r.status_code == 200 and r.json()["statut"] == "validee", r.content
    assert val("select coalesce(sum(case when sens = 'D' then montant_cdf else -montant_cdf end), 0) from ligne_ecriture") == 0
    assert val("select count(*) from ecriture") == 2 and compte["numero"].startswith(t["numero"])
