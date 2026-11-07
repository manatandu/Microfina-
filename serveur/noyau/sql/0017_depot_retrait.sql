-- S74 : Caisse > Opération > Dépôt / Retrait (manuel Microfina++, p. 86) : champ « Motif » du cadre Dépôt espèce
alter table operation add column motif text;
