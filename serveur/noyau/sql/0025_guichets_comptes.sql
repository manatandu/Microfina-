-- S08 : Gestion des guichets (manuel Microfina++, p. 18 et 95) ; registre des décisions S08-3 et S08-7.
-- Maximum autorisé en caisse et retrait plafonné : une valeur par devise (règle T12) ; les colonnes existantes portent le CDF.
alter table guichet
  add column maximum_caisse_usd   bigint not null default 0 check (maximum_caisse_usd >= 0),
  add column retrait_plafonne_usd bigint not null default 0 check (retrait_plafonne_usd >= 0);
-- Comptes du PCCI proposés par défaut pour un guichet (liste des comptes du PCCI) :
-- 579 Mouvements de fonds inter caisses, 671 Déficits de caisse non récupérés, 7790 Excédents de caisse
insert into compte (numero, libelle, classe, nature)
select v.numero, v.libelle, v.classe, v.nature
from (values ('579', 'Mouvements de fonds inter caisses', 5, 'actif'), ('671', 'Déficits de caisse non récupérés', 6, 'charge'),
             ('7790', 'Excédents de caisse', 7, 'produit')) as v(numero, libelle, classe, nature)
where not exists (select 1 from compte c where c.numero = v.numero and c.institution_id is null);
