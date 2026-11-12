-- S10 : Administration > Guichet > Affectation (manuel Microfina++, p. 20, 96 et 110) : cases « Voir solde client » et « Voir solde client VIP »,
-- auteur de l'ajout et du retrait
alter table affectation_guichet
  add column voir_solde     boolean not null default false,
  add column voir_solde_vip boolean not null default false,
  add column ajoute_par     bigint references utilisateur on delete restrict,
  add column retire_par     bigint references utilisateur on delete restrict;
