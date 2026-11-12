-- S102 : Comptabilité > Plan des comptes (manuel Microfina++, p. 122, 123, 145 à 147) : options d'un compte du formulaire
-- « Plan général » (Statut Ouvert, Nature Saisible, Saisie analytique, Saisie de l'échéance, Lettrage automatique, Saisie compte tiers,
-- Immobilisation, Compte de Taxe, Compte Taxable, Type de suivi)
alter table compte
  add column ouvert            boolean not null default true,
  add column saisie_analytique boolean not null default false,
  add column saisie_echeance   boolean not null default false,
  add column lettrage_auto     boolean not null default false,
  add column saisie_tiers      boolean not null default false,
  add column immobilisation    boolean not null default false,
  add column compte_taxe       boolean not null default false,
  add column compte_taxable    boolean not null default false,
  add column type_suivi        text;
