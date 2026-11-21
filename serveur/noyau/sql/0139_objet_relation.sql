-- Confrontation du 21/11/2026, A8 : objet et nature de la relation d'affaires, recueillis avant d'entrer en relation (loi 22/068, art. 34, al. 3 et art. 47) ;
-- provenance des fonds d'une personne morale (Instr. BCC 15, art. 17 b)
alter table tiers add column objet_relation text, add column origine_fonds text;
