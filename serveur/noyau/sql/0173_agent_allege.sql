-- Fiche de l'agent allégée (plan d'allègement, point 2.20) : nom, prénom, sexe, portable ; la date et le lieu de naissance ne sont plus demandés.
alter table agent_agence alter column date_naissance drop not null;
