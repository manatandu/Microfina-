-- Demande du porteur (14/11/2026) : « Groupement » devient « Groupement solidaire » (loi 11/020, art. 1er, 7° et 19° ; PCCI, compte 1031)
update liste_reference set libelle = 'Groupement solidaire' where liste = 'type_groupe' and libelle = 'Groupement';
update tiers set type_client = 'Groupement solidaire' where type = 'groupe' and type_client = 'Groupement';
