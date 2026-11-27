-- Trois libellés du PCCI recopiés de travers (un libellé coupé en deux avait décalé la suite ; relecture du 27/11/2026, registre T250).
-- PCCI, classe 2, encadré du compte 24 ; liste des comptes : 244, 246 et 249.
update compte set libelle = 'Avances et acomptes sur commandes de matériel et mobilier destinés au crédit–bail ou à la location avec option d’achat'
  where numero like '244%' and libelle = 'Avances et acomptes sur commandes de matériel et mobilier destinés au crédit–bail ou à';
update compte set libelle = 'Avances et acomptes sur commandes d’immobilisations incorporelles'
  where numero like '246%' and libelle = 'la location avec option d’achat';
update compte set libelle = 'Avances et acomptes sur commandes d’autres immobilisations corporelles'
  where numero like '249%' and libelle = 'Avances et acomptes sur commandes d’immobilisations incorporelles';
