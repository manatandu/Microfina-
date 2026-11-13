-- S06 : Administration > Utilisateur > Gestion des profils (manuel Microfina++, p. 17) : un profil par utilisateur (registre T07, S06-1) ;
-- Historique profil : qui a reçu quel profil, quand, et de qui (registre S06-2).
create table utilisateur_profil_historique (
  id bigint generated always as identity primary key,
  utilisateur_id bigint not null references utilisateur on delete cascade,
  profil_id bigint not null references profil on delete restrict,
  debut timestamptz not null default now(), fin timestamptz,
  attribue_par bigint references utilisateur on delete restrict
);
insert into utilisateur_profil_historique (utilisateur_id, profil_id) select utilisateur_id, profil_id from utilisateur_profil;
