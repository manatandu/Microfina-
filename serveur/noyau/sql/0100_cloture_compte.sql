-- S70 : Épargne > Clôturer un Compte (manuel Microfina++, p. 80 : « l'onglet ne marche pas » ; écran complété, registre S70).
-- Deux clôtures : à la demande du client (gratuite, Instr. BCC 37, annexe ; solde nul, comme la résiliation S48-1) ;
-- d'un compte inactif depuis dix ans, la lettre envoyée (loi 22/069, titre III, chap. Ier) : le solde passe aux avoirs en cours
-- de prescription (PCCI, compte 36, ligne 369), puis il est versé à la BCC, qui le détient cinq ans pour le titulaire.
create table cloture_compte (
  id bigserial primary key,
  institution_id bigint not null references institution on delete restrict,
  compte_id bigint not null unique references compte_depot on delete restrict,
  motif text not null check (motif in ('demande', 'inactivite')),
  observation text,
  date_cloture date not null,
  solde bigint not null check (solde >= 0),
  devise char(3) not null,
  ecriture_id bigint references ecriture on delete restrict,
  cloture_par bigint not null references utilisateur on delete restrict,
  cloture_le timestamptz not null default now(),
  versee_bcc_le date,
  reference_bcc text,
  compte_bancaire_id bigint references compte_bancaire on delete restrict,
  ecriture_versement_id bigint references ecriture on delete restrict,
  verse_par bigint references utilisateur on delete restrict
);
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s cross join (values ('cloture_inactif'), ('versement_bcc')) e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);
insert into profil_droit (profil_id, droit_code) select p.id, 'S70' from profil p where p.code = 'chef_agence'
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S70');
