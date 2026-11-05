\set ON_ERROR_STOP 0
insert into devise values ('CDF','Franc congolais'),('USD','Dollar américain');
insert into institution (nom, profil) values ('COOPEC Test','coopec');
insert into agence (institution_id, code, nom) values (1,'01','Agence test');
insert into utilisateur (institution_id, login, nom, mot_de_passe_hash) values (1,'caissier','Caissier','x'),(1,'chef','Chef','x');
insert into journee_comptable (agence_id, date_comptable, statut) values (1,'2026-11-05','ouverte');
insert into journal (institution_id, code, libelle, type) values (1,'CA','Caisse','caisse');
insert into compte (numero, libelle, classe, nature) values ('570','Caisse','5'::smallint,'actif'),('330','Dépôts','3'::smallint,'passif');
insert into piece (institution_id, numero, type, date_piece) values (1,'P1','bordereau','2026-11-05'),(1,'P2','bordereau','2026-11-05'),(1,'P3','bordereau','2026-11-05'),(1,'P4','bordereau','2026-11-05');
\echo '--- 1. écriture équilibrée (doit passer)'
begin;
insert into ecriture (institution_id, numero, journal_id, journee_id, date_valeur, libelle, piece_id, evenement_id, saisi_par, valide_par)
 values (1,'E1',1,1,'2026-11-05','Dépôt',1,gen_random_uuid(),1,2);
insert into ligne_ecriture (ecriture_id, rang, compte_id, sens, devise, montant_devise, montant_cdf) values
 (currval('ecriture_id_seq'),1,1,'D','CDF',100000,100000),(currval('ecriture_id_seq'),2,2,'C','CDF',100000,100000);
commit;
\echo '--- 2. écriture déséquilibrée (doit échouer)'
begin;
insert into ecriture (institution_id, numero, journal_id, journee_id, date_valeur, libelle, piece_id, evenement_id, saisi_par, valide_par)
 values (1,'E2',1,1,'2026-11-05','Dépôt faux',2,gen_random_uuid(),1,2);
insert into ligne_ecriture (ecriture_id, rang, compte_id, sens, devise, montant_devise, montant_cdf) values
 (currval('ecriture_id_seq'),1,1,'D','CDF',100000,100000),(currval('ecriture_id_seq'),2,2,'C','CDF',90000,90000);
commit;
\echo '--- 3. écriture sans ligne (doit échouer)'
begin;
insert into ecriture (institution_id, numero, journal_id, journee_id, date_valeur, libelle, piece_id, evenement_id, saisi_par, valide_par)
 values (1,'E3',1,1,'2026-11-05','Vide',3,gen_random_uuid(),1,2);
commit;
\echo '--- 4. modification et suppression (doivent échouer)'
update ecriture set libelle='x' where numero='E1';
delete from ligne_ecriture where ecriture_id=1;
\echo '--- 5. saisie manuelle sans second valideur (doit échouer)'
insert into ecriture (institution_id, numero, journal_id, journee_id, date_valeur, libelle, piece_id, evenement_id, saisi_par, valide_par)
 values (1,'E5',1,1,'2026-11-05','Seul',4,gen_random_uuid(),1,1);
\echo '--- 6. période clôturée (doit échouer)'
insert into periode values (1,2026,11,'cloturee',now(),2);
insert into ecriture (institution_id, numero, journal_id, journee_id, date_valeur, libelle, piece_id, evenement_id, saisi_par, valide_par)
 values (1,'E6',1,1,'2026-11-05','Après clôture',4,gen_random_uuid(),1,2);
\echo '--- 7. deuxième journée ouverte dans la même agence (doit échouer)'
insert into journee_comptable (agence_id, date_comptable, statut) values (1,'2026-11-06','ouverte');
\echo '--- bilan'
select e.numero, count(l.*) lignes from ecriture e left join ligne_ecriture l on l.ecriture_id=e.id group by 1 order by 1;
