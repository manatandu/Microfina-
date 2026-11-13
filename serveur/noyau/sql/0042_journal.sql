-- S30 : Comptabilité > Journal (manuel Microfina++, p. 41 et 42) : Type Journal, Libelle, Code, Actif, Détail journal. Suppression logique (T02).
alter table journal add column actif boolean not null default true, add column supprime boolean not null default false;
