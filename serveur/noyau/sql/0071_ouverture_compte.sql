-- S63 : Épargne > Nouveau compte (manuel Microfina++, p. 72 et 73) : un compte de plus pour un membre. La clé évite qu'un double clic ouvre deux comptes.
alter table compte_depot add column cle_idempotence uuid unique;
