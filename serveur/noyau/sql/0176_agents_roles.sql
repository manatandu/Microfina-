-- Plan d'allègement, point 2.20 : une seule liste d'agents, chacun avec ses rôles cochés (gestionnaire, sensibilisateur, commercial)
-- et l'utilisateur du logiciel qui lui correspond. Une personne saisie dans plusieurs onglets ne fait plus qu'un agent : les clients
-- qui la portaient la gardent.
alter table agent_agence add column if not exists gestionnaire boolean not null default false,
  add column if not exists sensibilisateur boolean not null default false,
  add column if not exists commercial boolean not null default false,
  add column if not exists utilisateur_id bigint references utilisateur on delete restrict;
alter table agent_agence alter column role drop not null;
update agent_agence set gestionnaire = (role = 'gestionnaire'), sensibilisateur = (role = 'sensibilisateur'), commercial = (role = 'commercial')
 where role is not null and not (gestionnaire or sensibilisateur or commercial);
-- la même personne (institution, nom, prénom, sexe) : on garde le plus petit numéro
create temporary table agent_double on commit drop as
  select a.id, min(a.id) over (partition by a.institution_id, lower(trim(a.nom)), lower(trim(a.prenom)), a.sexe) as garde
    from agent_agence a where a.actif;
update agent_agence g set gestionnaire = g.gestionnaire or x.ge, sensibilisateur = g.sensibilisateur or x.se, commercial = g.commercial or x.co,
       agence_id = coalesce(g.agence_id, x.ag), portable = case when g.portable = '' then x.po else g.portable end
  from (select d.garde, bool_or(a.gestionnaire) ge, bool_or(a.sensibilisateur) se, bool_or(a.commercial) co, max(a.agence_id) ag, max(a.portable) po
          from agent_double d join agent_agence a on a.id = d.id group by d.garde) x
 where g.id = x.garde;
update tiers t set gestionnaire_agent_id = d.garde from agent_double d where t.gestionnaire_agent_id = d.id and d.id <> d.garde;
update tiers t set sensibilisateur_id = d.garde from agent_double d where t.sensibilisateur_id = d.id and d.id <> d.garde;
update tiers t set commercial_id = d.garde from agent_double d where t.commercial_id = d.id and d.id <> d.garde;
update agent_agence a set actif = false from agent_double d where a.id = d.id and d.id <> d.garde;
