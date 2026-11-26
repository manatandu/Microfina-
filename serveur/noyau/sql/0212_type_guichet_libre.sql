-- Types de guichet : l'institution en ajoute depuis l'écran Guichets (demande du porteur du 26/11/2026, registre T234).
-- La liste (liste_reference, « type_guichet ») fait foi : le type d'un guichet n'est plus tenu aux deux valeurs de la capture (manuel p. 19).
alter table guichet drop constraint if exists guichet_type_guichet_check;
alter table guichet add constraint guichet_type_guichet_check check (type_guichet is null or length(type_guichet) between 1 and 30);
