-- S32 : Paramétrage > Info société (manuel Microfina++, p. 42) : Information Societe (Info générale, logo), Agence, Zone.
-- Code Institution : le sigle (déjà lu par S15 et S29) ; Type base : le profil (loi 002/2002 ; loi 11/020, art. 11) (registre S32-1, S32-2).
alter table institution
  add column description         text not null default '',
  add column directeur           text not null default '',
  add column journee_max         integer not null default 1 check (journee_max >= 1),
  add column compte_hors_bilan_1 text,
  add column compte_hors_bilan_2 text,
  add column ifu                 text not null default '',
  add column pays                text not null default '',
  add column ville               text not null default '',
  add column quartier            text not null default '',
  add column rue                 text not null default '',
  add column email               text not null default '',
  add column bp                  text not null default '',
  add column telephone_fixe      text not null default '',
  add column adresse             text not null default '',
  add column logo                text;
alter table agence add column supprime boolean not null default false;
