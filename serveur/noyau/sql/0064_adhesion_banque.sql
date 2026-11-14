-- S56 : Banque > Adhésion (manuel Microfina++, p. 64 ; écran « Adhésion à la Banque » p. 64). Le membre paie son adhésion (parts, premier dépôt, frais)
-- par virement sur un compte bancaire de l'institution. Même chaîne que S52 : saisie ici, visée puis validée (S57), validée à la caisse (p. 89 et 104),
-- comptabilisée (S111). Le compte épargne s'ouvre à la validation, pas à la saisie (registre S56-1).
alter table operation_banque add column tiers_id bigint references tiers on delete restrict;
alter table operation_banque add column parts integer check (parts is null or parts >= 1);
alter table operation_banque add column premier_depot bigint check (premier_depot is null or premier_depot >= 0);
alter table operation_banque drop constraint operation_banque_type_check;
alter table operation_banque add constraint operation_banque_type_check
  check (type in ('encaissement', 'decaissement', 'banque_caisse', 'banque_banque', 'virement_client', 'prelevement_client', 'adhesion_banque'));
alter table operation_banque add constraint operation_banque_adhesion_check
  check ((type = 'adhesion_banque') = (tiers_id is not null and parts is not null and premier_depot is not null));
