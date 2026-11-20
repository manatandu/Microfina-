-- Écart E26 : Client > Conformité > Centrale des risques (Instr. BCC 05, annexe I, art. 1, 4, 5, 6, 7 et 10 ; registre CR-10).
-- Les événements à déclarer se lisent dans les données (octroi, remboursements, engagements, modifications, passages en perte, radiations) ;
-- seule la déclaration faite par le préposé est enregistrée ici. Remplace declaration_centrale, jamais déclarée depuis un écran.
drop table if exists declaration_centrale;
create table declaration_risque (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  type_evenement  text not null check (type_evenement in ('octroi', 'remboursement', 'engagement', 'modification', 'passage_en_perte', 'radiation')),
  objet_id        bigint not null,
  date_evenement  date not null,
  declare_le      date not null,
  reference       text not null,
  declare_par     bigint not null references utilisateur on delete restrict
);
create unique index declaration_risque_unique on declaration_risque (institution_id, type_evenement, objet_id);
insert into droit (code, libelle) values ('SC05', 'Centrale des risques') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SC05' from profil p where p.code in ('chef_agence', 'agent_credit')
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SC05');
