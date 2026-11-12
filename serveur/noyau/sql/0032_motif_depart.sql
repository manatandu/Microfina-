-- S18 : Motif de départ d'un client (manuel Microfina++, p. 26). La page Motif de départ de la liste de gauche (S14m) et S18 sont
-- une seule liste (registre S18-1) : les motifs rejoignent le moteur des listes. Numéro interne dans l'ordre de saisie (registre S18-2).
insert into liste_reference (institution_id, liste, code, libelle)
  select institution_id, 'motif_depart', row_number() over (partition by institution_id order by id)::text, libelle from motif_depart;
drop table motif_depart;
