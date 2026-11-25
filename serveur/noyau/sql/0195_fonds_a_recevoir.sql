-- Plan d'allègement, point 7.5 : virements internes de trésorerie. Les fonds envoyés à une caisse attendent que le caissier qui les reçoit les confirme
-- avec son billetage (« Fonds à recevoir ») ; le compte de mouvements de fonds (579) ou de virements internes (59) attend jusque-là (PCCI, comptes 57 et 59).
alter table operation drop constraint if exists operation_statut_check;
alter table operation add constraint operation_statut_check check (statut in ('saisie', 'visee', 'validee', 'refusee', 'a_recevoir'));
alter table operation_banque add column if not exists recu_operation_id bigint references operation(id) on delete restrict;
-- Noms des droits, comme les écrans (points 7.1, 7.5 et 7.6)
update droit set libelle = 'Virements internes de trésorerie' where code in ('S52', 'S81');
update droit set libelle = 'Adhésion' where code = 'S56';
update droit set libelle = 'Opérations en attente : banque' where code = 'S57';
update droit set libelle = 'Opérations en attente' where code = 'S113';
update droit set libelle = 'Opérations en attente : validation' where code = 'S114';
