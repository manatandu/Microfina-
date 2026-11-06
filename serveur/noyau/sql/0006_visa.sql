-- S40 : visa du client (manuel Microfina++, p. 52) : Intitulé et Date Visa saisis au visa
alter table tiers
  add column intitule   text,
  add column date_visa  date;
