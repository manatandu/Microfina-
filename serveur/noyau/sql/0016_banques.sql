-- S58 : Banque > Création banque (manuel Microfina++, p. 67) : Banque Client et Banque Institution
alter table banque drop constraint banque_nom_key;
alter table banque
  add column institution_id bigint references institution on delete restrict,
  add column code           text,
  add column compte_liaison text check (compte_liaison ~ '^[0-9]+$'),
  add column adresse        text;
alter table banque add constraint banque_code_unique unique (institution_id, code);
-- Compte de l'institution dans une banque : compte NOSTRI (PCCI, compte 560), journal de banque, contact
alter table compte_bancaire
  add column journal_id          bigint references journal on delete restrict,
  add column contact_nom         text,
  add column contact_nom_complet text,
  add column contact_telephone   text;
