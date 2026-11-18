-- Registre T02 (manuel Microfina++, p. 12) : « Les suppressions sont généralement logiques, c'est-à-dire que les données supprimées
-- n'apparaîtront plus pour l'utilisateur mais seront toutefois présentes dans la base de données afin de retracer les historiques. »
-- Chaque table dont un écran porte un bouton Supprimer garde la ligne, avec la date et l'auteur de la suppression.
-- L'unicité ne porte plus que sur les lignes vivantes : un code ou un libellé supprimé peut être repris.
alter table banque add column supprime_le timestamptz, add column supprime_par integer references utilisateur(id);
alter table compte_bancaire add column supprime_le timestamptz, add column supprime_par integer references utilisateur(id);
alter table frais add column supprime_le timestamptz, add column supprime_par integer references utilisateur(id);
alter table parametrage_frais add column supprime_le timestamptz, add column supprime_par integer references utilisateur(id);
alter table parametrage_frais_adhesion add column supprime_le timestamptz, add column supprime_par integer references utilisateur(id);
alter table groupe_solidaire add column supprime_le timestamptz, add column supprime_par integer references utilisateur(id);
alter table type_procuration add column supprime_le timestamptz, add column supprime_par integer references utilisateur(id);

alter table banque drop constraint banque_code_unique;
create unique index banque_code_unique on banque (institution_id, code) where supprime_le is null;
alter table compte_bancaire drop constraint compte_bancaire_banque_id_numero_key;
create unique index compte_bancaire_banque_id_numero_key on compte_bancaire (banque_id, numero) where supprime_le is null;
alter table frais drop constraint frais_institution_id_type_operation_libelle_key;
create unique index frais_institution_id_type_operation_libelle_key on frais (institution_id, type_operation, libelle) where supprime_le is null;
alter table parametrage_frais drop constraint parametrage_frais_frais_id_sous_type_id_key;
create unique index parametrage_frais_frais_id_sous_type_id_key on parametrage_frais (frais_id, sous_type_id) where supprime_le is null;
alter table parametrage_frais_adhesion drop constraint parametrage_frais_adhesion_frais_id_type_membre_key;
create unique index parametrage_frais_adhesion_frais_id_type_membre_key on parametrage_frais_adhesion (frais_id, type_membre) where supprime_le is null;
alter table groupe_solidaire drop constraint groupe_solidaire_code_unique;
create unique index groupe_solidaire_code_unique on groupe_solidaire (institution_id, code) where supprime_le is null;
alter table type_procuration drop constraint type_procuration_institution_id_libelle_key;
create unique index type_procuration_institution_id_libelle_key on type_procuration (institution_id, libelle) where supprime_le is null;
