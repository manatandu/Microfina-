-- S14b : la fiche client, le prospect, les agents et le rapport lisent la liste Profession du paramétrage (registre S14b-2).
-- Les professions de l'ancienne table passent dans la liste ; leur code reprend leur numéro.
insert into liste_reference (institution_id, liste, code, libelle)
select p.institution_id, 'profession', 'P' || p.id, p.libelle from profession p
where not exists (select 1 from liste_reference l where l.institution_id = p.institution_id and l.liste = 'profession' and l.libelle = p.libelle);
