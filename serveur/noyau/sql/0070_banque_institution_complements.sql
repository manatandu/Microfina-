-- S58 : Banque Institution, champs du texte p. 67 absents de la capture (registre S58-3) : compte de pénalité et adresse du gestionnaire.
alter table compte_bancaire
  add column compte_penalite text,
  add column contact_adresse text;
