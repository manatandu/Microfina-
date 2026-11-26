"""Audit du 21/11/2026, point bloquant B13 (constats F22 et F23 ; registre T226) : jeu de données de l'essai en charge.

Sur une base neuve (migrate, graine), il ajoute des agences, leurs utilisateurs et leurs guichets, des dizaines de milliers de membres fictifs
avec leur compte d'épargne, et dix mois d'opérations de guichet (dépôts et retraits) avec leurs écritures, journées fermées comprises.
Tout est inventé : aucun nom, aucun numéro ne vient d'une institution réelle.

    PG_BASE=likelemba_charge LIKELEMBA_SANS_MOT_DE_PASSE=1 LIKELEMBA_DEBUG=1 python outils/charge/jeu.py [agences] [membres] [opérations par agence et par jour]

Les agences, les utilisateurs, les membres et l'historique s'écrivent en SQL, déclencheurs suspendus, pour tenir en quelques minutes ; les guichets
s'ouvrent par le logiciel lui-même. À la fin, le script vérifie ce que les déclencheurs auraient vérifié : écritures équilibrées, aucun solde négatif."""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "likelemba.settings")
import django  # noqa: E402

django.setup()
from django.db import connection, transaction  # noqa: E402
from django.test import Client  # noqa: E402

AGENCES = int(sys.argv[1]) if len(sys.argv) > 1 else 5
MEMBRES = int(sys.argv[2]) if len(sys.argv) > 2 else 30000
OPS = int(sys.argv[3]) if len(sys.argv) > 3 else 350
DU, AU = "2026-01-02", "2026-11-03"                         # la graine tient la journée du 04/11/2026 ; l'essai ouvre le 05/11/2026
H = {"HTTP_X_LIKELEMBA": "1", "content_type": "application/json"}


def sql(requete, params=None, lire=False):
    with connection.cursor() as c:
        c.execute(requete, params if params is not None else ())      # toujours des paramètres : « %% » vaut « % » partout
        return c.fetchall() if lire else c.rowcount


def chrono(nom, t0):
    print(f"  {nom} : {time.time() - t0:.1f} s", flush=True)


def agences_et_utilisateurs():
    """Agences 2 à N, copies de la première ; pour chacune un chef, deux caissiers, un agent de crédit et un comptable"""
    with transaction.atomic():
        sql("set local session_replication_role = replica")
        for k in range(2, AGENCES + 1):
            sql("""insert into agence (institution_id, zone_id, code, nom, fuseau, supprime, jours_travail, pays, province, ville, commune, quartier, rue, numero_rue,
                                       autorisation_bcc_reference, autorisation_bcc_le)
                   select institution_id, zone_id, %s, %s, fuseau, supprime, jours_travail, pays, province, ville, commune, quartier, rue, numero_rue,
                          autorisation_bcc_reference, autorisation_bcc_le from agence where id = 1 and not exists (select 1 from agence where code = %s)""",
                (f"{412 + k - 1:04d}", f"Agence {k}", f"{412 + k - 1:04d}"))
            for login, nom, profil in ((f"chef{k}", f"Chef Agence {k}", "chef_agence"), (f"caisse{k}a", f"Caissier A Agence {k}", "caissier"),
                                       (f"caisse{k}b", f"Caissier B Agence {k}", "caissier"), (f"agent{k}", f"Agent Agence {k}", "agent_credit"),
                                       (f"compta{k}", f"Comptable Agence {k}", "comptable")):
                sql("""insert into utilisateur (institution_id, agence_id, login, nom, mot_de_passe_hash)
                       select 1, a.id, %s, %s, '!' from agence a where a.code = %s and not exists (select 1 from utilisateur where login = %s)""",
                    (login, nom, f"{412 + k - 1:04d}", login))
                sql("""insert into utilisateur_profil (utilisateur_id, profil_id) select u.id, p.id from utilisateur u, profil p
                       where u.login = %s and p.code = %s and p.institution_id = 1 and not exists (select 1 from utilisateur_profil x where x.utilisateur_id = u.id)""", (login, profil))


def guichets():
    """Deux guichets par nouvelle agence, ouverts par son chef dans le logiciel (comptes de caisse créés par le logiciel), un caissier sur chacun"""
    for k in range(2, AGENCES + 1):
        chef = Client(SERVER_NAME="localhost")
        r = chef.post("/api/session", {"login": f"chef{k}"}, **H)
        assert r.status_code == 200, r.content
        l = chef.get("/api/guichets").json()
        ag = sql("select id from agence where code = %s", (f"{412 + k - 1:04d}",), lire=True)[0][0]
        jca = next(x["id"] for x in l["journaux"] if x["code"] == "CA")
        for code, nom, typ, caissier in (("G1", "Caisse 1", "PRINCIPALE", f"caisse{k}a"), ("G2", "Caisse 2", "SECONDAIRE", f"caisse{k}b")):
            if sql("select 1 from guichet where agence_id = %s and code = %s", (ag, code), lire=True):
                continue
            r = chef.post("/api/guichets", {"agenceId": ag, "code": code, "designation": nom, "typeGuichet": typ, "journalId": jca,
                                            "plafonds": {"CDF": {"maximum": 0, "retrait": 0}, "USD": {"maximum": 0, "retrait": 0}},
                                            "compteGuichet": "57000000", "compteLiaison": "57900000", "billetage": False, "actif": True}, **H)
            assert r.status_code == 200, r.content
            gid = sql("select id from guichet where agence_id = %s and code = %s", (ag, code), lire=True)[0][0]
            uid = sql("select id from utilisateur where login = %s", (caissier,), lire=True)[0][0]
            r = chef.post("/api/affectations-guichets", {"utilisateurId": uid, "guichetId": gid, "voirSolde": True}, **H)
            assert r.status_code == 200, r.content


NOMS = ["Kabongo", "Mbuyi", "Ilunga", "Kasongo", "Mutombo", "Ngalula", "Tshibanda", "Lumbala", "Kalala", "Mukendi", "Banza", "Kazadi", "Mwamba", "Nkulu", "Lukusa",
        "Mbala", "Kapinga", "Tshimanga", "Bokele", "Mayele", "Ngoy", "Kyungu", "Masengo", "Lelo", "Matondo"]
POSTNOMS = ["wa Kabongo", "Mulumba", "Kabeya", "Ntumba", "Mpoyi", "Kanku", "Bope", "Luzolo", "Makiese", "Nsimba", "Nzuzi", "Lusamba", "Mbombo", "Kalonji", "Odia"]
PRENOMS = ["Josée", "Patrick", "Grâce", "Jean", "Marie", "Esther", "Sarah", "Bijou", "Joseph", "Rita", "Paul", "Lucie", "Daniel", "Ruth", "Samuel", "Aline", "David", "Nadine"]


def membres():
    """Membres fictifs, répartis entre les agences, chacun avec un compte d'épargne à vue en CDF"""
    with transaction.atomic():
        sql("set local session_replication_role = replica")
        base = sql("select coalesce(max(id), 0) from tiers", lire=True)[0][0]
        produit = sql("select produit_id from compte_depot where devise = 'CDF' order by id limit 1", lire=True)[0][0]
        sql("""create temp table _ag on commit drop as select id, code, row_number() over (order by id) - 1 as rang,
                      (select id from utilisateur u where u.agence_id = a.id order by id limit 1) as auteur from agence a where not supprime""")
        sql("""insert into tiers (id, institution_id, agence_id, numero, type, statut, residence, agent_economique, personne_exposee, vise_par, vise_le, cree_le, cree_par,
                                  date_demande, type_client, prelever_agios, calculer_interet, date_visa, auxiliaire)
               overriding system value
               select %(b)s + g, 1, a.id, a.code || '-' || lpad((100000 + g)::text, 6, '0'), 'physique', 'actif', 'resident', 'menages', false, a.auteur, now(), now(), a.auteur,
                      date '2026-01-02', 'Client', true, false, date '2026-01-02', false
               from generate_series(1, %(n)s) g join _ag a on a.rang = g %% %(ag)s""", {"b": base, "n": MEMBRES, "ag": AGENCES})
        sql("""insert into tiers_personne (tiers_id, nom, postnom, prenom, sexe, date_naissance, piece_type, piece_numero, piece_validite, adresse, telephone)
               select %(b)s + g, (%(noms)s::text[])[1 + g %% %(nn)s], (%(post)s::text[])[1 + (g / 7) %% %(np)s], (%(pre)s::text[])[1 + (g / 3) %% %(npr)s],
                      case when (g / 3) %% 2 = 0 then 'F' else 'M' end, date '1960-01-01' + (g %% 14000), 'Carte d''électeur', 'E-' || lpad(g::text, 8, '0'), date '2031-12-31',
                      'Avenue ' || (1 + g %% 400) || ', n° ' || (1 + g %% 90), '+243 81' || lpad((g %% 10000000)::text, 7, '0')
               from generate_series(1, %(n)s) g""",
            {"b": base, "n": MEMBRES, "noms": NOMS, "nn": len(NOMS), "post": POSTNOMS, "np": len(POSTNOMS), "pre": PRENOMS, "npr": len(PRENOMS)})
        sql("""insert into compte_depot (institution_id, agence_id, tiers_id, produit_id, numero, devise, statut, ouvert_le)
               select 1, t.agence_id, t.id, %s, t.numero || '-02', 'CDF', 'ouvert', date '2026-01-02' from tiers t where t.id > %s""", (produit, base))
        sql("select setval(pg_get_serial_sequence('tiers', 'id'), (select max(id) from tiers))")


def historique():
    """Journées fermées du lundi au vendredi, hors jours fériés, et OPS opérations de guichet par agence et par jour : trois dépôts puis un retrait par compte,
    chacune avec sa pièce, son écriture équilibrée et ses deux lignes"""
    with transaction.atomic():
        sql("set local session_replication_role = replica")
        sql("""create temp table _ag on commit drop as select a.id, a.code, (select id from utilisateur u where u.agence_id = a.id order by id limit 1) as chef,
                      (select g.id from guichet g where g.agence_id = a.id order by g.id limit 1) as guichet from agence a where not supprime""")
        sql("""insert into journee_comptable (agence_id, date_comptable, statut, ouverte_par, fermee_par, ouverte_le, fermee_le)
               select a.id, d::date, 'fermee', a.chef, a.chef, d + interval '7 hours', d + interval '17 hours'
               from _ag a cross join generate_series(%s::date, %s::date, interval '1 day') d
               where extract(isodow from d) < 6 and not exists (select 1 from jour_ferie f where f.date_ferie = d::date)
                 and not exists (select 1 from journee_comptable j where j.agence_id = a.id and j.date_comptable = d::date)""", (DU, AU))
        sql("""create temp table _cpt on commit drop as select c.id as compte_id, c.tiers_id, c.agence_id, row_number() over (partition by c.agence_id order by c.id) - 1 as rang,
                      count(*) over (partition by c.agence_id) as nb from compte_depot c join tiers t on t.id = c.tiers_id where c.devise = 'CDF' and t.numero like '%%-1%%'""")
        sql("create index on _cpt (agence_id, rang)")
        bp, be, bo = (sql(f"select coalesce(max(id), 0) from {t}", lire=True)[0][0] for t in ("piece", "ecriture", "operation"))
        sql("""create temp table _ops on commit drop as
               select row_number() over (order by j.date_comptable, j.agence_id, s) as n, j.id as journee_id, j.agence_id, j.date_comptable as d, a.code, a.chef, a.guichet,
                      (row_number() over (partition by j.agence_id order by j.date_comptable, s) - 1) as na
               from journee_comptable j join _ag a on a.id = j.agence_id cross join generate_series(1, %s) s
               where j.date_comptable between %s and %s""", (OPS, DU, AU))
        sql("""create temp table _o on commit drop as
               select o.*, c.compte_id, c.tiers_id, ((o.na / c.nb) %% 4 = 3) as retrait,
                      case when (o.na / c.nb) %% 4 = 3 then 500000 else (1 + o.na %% 5) * 1000000 end as montant
               from _ops o join _cpt c on c.agence_id = o.agence_id and c.rang = o.na %% c.nb""")
        n = sql("select count(*) from _o", lire=True)[0][0]
        caisse = dict(sql("select id, compte_ecriture(1, '57000000', 'guichet:' || guichet, 'CDF') from _ag", lire=True))
        depot = sql("select compte_id from ligne_ecriture where contrat_ref like 'depot:%%' and devise = 'CDF' limit 1", lire=True)[0][0]
        sd, sr = (sql("select id from schema_comptable where institution_id = 1 and type_evenement = %s and valide_par is not null order by version desc limit 1", (e,), lire=True)[0][0]
                  for e in ("depot", "retrait"))
        jca = sql("select id from journal where institution_id = 1 and code = 'CA'", lire=True)[0][0]
        sql("""insert into piece (id, institution_id, numero, type, date_piece) overriding system value
               select %s + n, 1, extract(year from d)::text || '-' || code || '-CA-' || lpad(n::text, 7, '0'), 'bordereau', d from _o""", (bp,))
        sql("""insert into ecriture (id, institution_id, numero, journal_id, journee_id, date_valeur, horodatage, libelle, piece_id, evenement_id, schema_id, saisi_par, valide_par, type)
               overriding system value
               select %s + n, 1, 'CA-' || extract(year from d)::text || '-H' || lpad(n::text, 7, '0'), %s, journee_id, d, d + interval '8 hours' + (n %% 30000) * interval '1 second',
                      case when retrait then 'Retrait ' else 'Dépôt ' end || code || '-' || lpad((100000 + tiers_id)::text, 6, '0'), %s + n, gen_random_uuid(),
                      case when retrait then %s else %s end, chef, chef, 'normale' from _o""", (be, jca, bp, sr, sd))
        for rang, sens_depot, compte_sql, ref_sql in ((1, "D", "(%(caisse)s::jsonb ->> agence_id::text)::bigint", "'guichet:' || guichet"), (2, "C", "%(depot)s", "'depot:' || compte_id")):
            sql(f"""insert into ligne_ecriture (ecriture_id, rang, compte_id, contrat_ref, sens, devise, montant_devise, montant_cdf)
                    select %(be)s + n, {rang}, {compte_sql}, {ref_sql}, case when retrait then %(inverse)s else %(sens)s end, 'CDF', montant, montant from _o""",
                {"be": be, "caisse": __import__("json").dumps({str(k): v for k, v in caisse.items()}), "depot": depot, "sens": sens_depot, "inverse": "C" if sens_depot == "D" else "D"})
        sql("""insert into operation (id, institution_id, agence_id, journee_id, type, tiers_id, contrat_ref, montant, devise, statut, cle_idempotence, saisi_par, ecriture_id, cree_le)
               overriding system value
               select %s + n, 1, agence_id, journee_id, case when retrait then 'retrait' else 'depot' end, tiers_id, 'depot:' || compte_id, montant, 'CDF', 'validee', gen_random_uuid(),
                      chef, %s + n, d + interval '8 hours' + (n %% 30000) * interval '1 second' from _o""", (bo, be))
        for t in ("piece", "ecriture", "operation"):
            sql(f"select setval(pg_get_serial_sequence('{t}', 'id'), (select max(id) from {t}))")
        return n


def verifier():
    """Ce que les déclencheurs suspendus auraient garanti"""
    deseq = sql("""select count(*) from (select ecriture_id from ligne_ecriture group by ecriture_id
                   having sum(case sens when 'D' then montant_cdf else -montant_cdf end) <> 0) x""", lire=True)[0][0]
    negatifs = sql("""select count(*) from (select contrat_ref from ligne_ecriture where contrat_ref like 'depot:%%' group by contrat_ref
                      having sum(case sens when 'C' then montant_devise else -montant_devise end) < 0) x""", lire=True)[0][0]
    assert deseq == 0 and negatifs == 0, (deseq, negatifs)
    return {t: sql(f"select count(*) from {t}", lire=True)[0][0] for t in ("agence", "utilisateur", "guichet", "tiers", "compte_depot", "journee_comptable", "operation", "ecriture", "ligne_ecriture")}


if __name__ == "__main__":
    for nom, f in (("agences et utilisateurs", agences_et_utilisateurs), ("guichets", guichets), ("membres et comptes", membres), ("historique", historique)):
        t0 = time.time()
        f()
        chrono(nom, t0)
    t0 = time.time()
    sql("analyze")
    chrono("statistiques", t0)
    print(verifier())
