-- S79 : Caisse > Billetage > Enregistrer de billetage (manuel Microfina++, p. 90 et 91) : champ « Bon de Caisse » de l'arrêté
alter table billetage add column bon_caisse bigint not null default 0 check (bon_caisse >= 0);
