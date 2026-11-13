-- Une devise créée en S35 sert partout (demande du porteur, 13/11/2026) :
-- Maximum autorisé en caisse et Retrait plafonné du guichet, une valeur par devise tenue (registre S08-3, S79-5).
create table guichet_plafond (
  guichet_id bigint not null references guichet on delete cascade,
  devise char(3) not null references devise on delete restrict,
  maximum bigint not null check (maximum >= 0), retrait bigint not null check (retrait >= 0),
  primary key (guichet_id, devise)
);
insert into guichet_plafond (guichet_id, devise, maximum, retrait)
  select id, 'CDF', coalesce(maximum_caisse, 0), coalesce(retrait_plafonne, 0) from guichet
  union all
  select id, 'USD', coalesce(maximum_caisse_usd, 0), coalesce(retrait_plafonne_usd, 0) from guichet;
alter table guichet drop column maximum_caisse, drop column retrait_plafonne, drop column maximum_caisse_usd, drop column retrait_plafonne_usd;
