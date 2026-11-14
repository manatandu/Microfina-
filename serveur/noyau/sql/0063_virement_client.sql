-- S53 : Banque > Virement prélèvement (manuel Microfina++, p. 61) : entre le compte d'un client et un compte bancaire de l'institution.
-- Même chaîne que S52 : saisie ici, visée puis validée (S57), comptabilisée (S111). Sens (registre S53-1) : virement = la banque crédite
-- le compte du client ; prélèvement = le compte du client est débité au profit de la banque.
alter table operation_banque add column compte_depot_id bigint references compte_depot on delete restrict;
alter table operation_banque drop constraint operation_banque_type_check;
alter table operation_banque add constraint operation_banque_type_check
  check (type in ('encaissement', 'decaissement', 'banque_caisse', 'banque_banque', 'virement_client', 'prelevement_client'));
alter table operation_banque add constraint operation_banque_compte_client_check
  check ((type in ('virement_client', 'prelevement_client')) = (compte_depot_id is not null));
