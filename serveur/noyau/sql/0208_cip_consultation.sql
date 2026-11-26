-- Écart E06, fin (registre E06-2 ; Instr. BCC 52, art. 13) : l'ouverture d'un compte requiert la consultation préalable du sous-registre des clients
-- et comptes (SRCC), et l'établissement garde la trace de la réponse. La consultation se note avec les déclarations : sa date et la référence de la réponse.
alter table declaration_cip drop constraint if exists declaration_cip_type_evenement_check;
alter table declaration_cip add constraint declaration_cip_type_evenement_check
  check (type_evenement in ('ouverture_compte', 'cloture_compte', 'nouveau_client', 'modification_client', 'consultation_srcc'));
