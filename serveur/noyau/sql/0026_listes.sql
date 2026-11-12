-- Moteur des listes simples (docs/architecture/COMPLEMENTS.md § 7.2) : pages de Info de base > Client > Général (manuel Microfina++, p. 23).
-- Une ligne = un code et un libellé, avec un parent quand la liste en a un ; suppression logique (manuel p. 12, registre T02).
create table liste_reference (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  liste          text not null,
  code           text not null,
  libelle        text not null,
  parent_id      bigint references liste_reference on delete restrict,
  actif          boolean not null default true,
  unique (institution_id, liste, code)
);
-- Les secteurs d'activité (S14) rejoignent le moteur
insert into liste_reference (institution_id, liste, code, libelle) select institution_id, 'secteur_activite', code, libelle from secteur_activite;
