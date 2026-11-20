-- S128 : Autres > Calculs (manuel p. 163 : frais de tenue de comptes, intérêt sur DAV, intérêts sur DAT, état des provisions de crédits).
-- S127 : Autres > Clôture (crédit, dépôt, comptabilité).
-- Un calcul mensuel ne passe qu'une fois par compte (frais de tenue, intérêts des comptes à vue).
create table calcul_periodique (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  agence_id       bigint not null references agence on delete restrict,
  type            text not null check (type in ('tenue_compte', 'interet_dav')),
  exercice        integer not null,
  mois            integer not null check (mois between 1 and 12),
  compte_depot_id bigint not null references compte_depot on delete restrict,
  base            bigint not null default 0,
  montant         bigint not null check (montant > 0),
  retenue         bigint not null default 0 check (retenue >= 0),
  devise          char(3) not null,
  ecriture_id     bigint not null references ecriture on delete restrict,
  passe_par       bigint not null references utilisateur on delete restrict,
  passe_le        timestamptz not null default now(),
  unique (type, exercice, mois, compte_depot_id)
);
-- Intérêts courus des dépôts à terme déjà portés en charge (PCCI § 6.4 ; compte 349 « Dettes rattachées »).
alter table depot_terme add column interets_courus bigint not null default 0 check (interets_courus >= 0);
-- Réévaluation des comptes en devises au cours de clôture (PCCI § 7.1) : la ligne ajuste la contre-valeur en CDF sans toucher au montant en devise.
alter table ligne_ecriture drop constraint ligne_ecriture_montant_devise_check;
alter table ligne_ecriture add constraint ligne_ecriture_montant_devise_check check (montant_devise >= 0);
-- Clôture de l'exercice : qui et quand.
alter table exercice add column cloture_le timestamptz, add column cloture_par bigint references utilisateur on delete restrict;
-- Schémas des nouveaux événements, sur le modèle du dépôt.
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par
from schema_comptable s cross join (values ('frais_tenue'), ('interet_dav'), ('interet_dat_couru'), ('reevaluation'), ('cloture_exercice')) as e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);
-- Écritures de clôture (type vidage) : les charges et produits en devises sont comptabilisés après conversion en CDF (PCCI § 7.1) ; les soldes de
-- gestion et le résultat se déterminent donc en CDF. L'équilibre en CDF reste exigé ; l'équilibre par devise ne l'est plus pour ces écritures.
create or replace function controler_equilibre() returns trigger language plpgsql as $$
declare t text; ecart_devise bigint; ecart_cdf bigint;
begin
  select e.type into t from ecriture e where e.id = new.ecriture_id;
  select coalesce(sum(case sens when 'D' then montant_cdf else -montant_cdf end), 0)
    into ecart_cdf from ligne_ecriture where ecriture_id = new.ecriture_id;
  if ecart_cdf <> 0 then
    raise exception 'Écriture % déséquilibrée en CDF', new.ecriture_id;
  end if;
  if t not in ('reevaluation', 'vidage') then
    select coalesce(max(abs(s)), 0) into ecart_devise from (
      select sum(case sens when 'D' then montant_devise else -montant_devise end) s
      from ligne_ecriture where ecriture_id = new.ecriture_id group by devise) x;
    if ecart_devise <> 0 then
      raise exception 'Écriture % déséquilibrée dans une devise', new.ecriture_id;
    end if;
  end if;
  return null;
end $$;
