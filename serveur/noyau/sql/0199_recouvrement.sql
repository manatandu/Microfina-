-- Plan d'allègement, point 6.17 (demande du porteur du 25/11/2026) : suivi du recouvrement. Sur un crédit en retard, chaque démarche se note avec sa date,
-- sa nature, son auteur et son issue ; la commission de crédit vérifie le niveau des crédits en retard et s'assure du déclenchement des démarches de
-- recouvrement (Instr. BCC 007, art. 33). Natures de départ dans le référentiel du crédit, que l'institution complète.
create table credit_demarche_nature (
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  libelle text not null, actif boolean not null default true);
create table credit_demarche (
  id bigint generated always as identity primary key,
  credit_id bigint not null references credit on delete restrict,
  nature_id bigint not null references credit_demarche_nature on delete restrict,
  date_demarche date not null,
  issue text not null default '',
  par bigint not null references utilisateur on delete restrict,
  saisi_le timestamptz not null default now());
create index credit_demarche_credit on credit_demarche (credit_id, date_demarche desc);
insert into credit_demarche_nature (institution_id, libelle)
  select i.id, v.libelle from institution i
  cross join (values (1, 'Visite'), (2, 'Lettre de rappel'), (3, 'Convocation'), (4, 'Mise en demeure'), (5, 'Transfert à l''agent de recouvrement'),
                     (6, 'Saisine de l''avocat')) as v(n, libelle)
  order by i.id, v.n;
