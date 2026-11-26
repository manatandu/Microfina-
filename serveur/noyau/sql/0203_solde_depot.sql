-- Audit du 21/11/2026, constat F11 (registre T210) : la base refuse qu'un compte de dépôt passe en solde négatif, sauf le compte courant dont le produit a
-- « Solde négatif = Oui » (registre S27-4, S74-6 ; PCCI, compte 33). Le serveur fait le même contrôle avant d'écrire (services.controler_soldes_depot) ;
-- ce déclencheur garde ce qui passerait à côté (correction à la main, code futur). Contrôle à la fin de la transaction : une écriture qui débite puis
-- recrédite le même compte n'est pas refusée à tort.
create or replace function solde_depot_controler() returns trigger language plpgsql as $$
declare
  k record;
  s bigint;
begin
  select c.numero, p.solde_negatif into k from compte_depot c join produit_epargne p on p.id = c.produit_id
   where c.id = substring(new.contrat_ref from 7)::bigint;
  if not found or k.solde_negatif then return null; end if;
  select coalesce(sum(case sens when 'C' then montant_devise else -montant_devise end), 0) into s
    from ligne_ecriture where contrat_ref = new.contrat_ref and devise = new.devise;
  if s < 0 then
    raise exception 'Le compte % passerait en solde négatif : une épargne ne devient pas débitrice (PCCI, compte 33 ; registre S27-4).', k.numero;
  end if;
  return null;
end $$;
drop trigger if exists solde_depot on ligne_ecriture;
create constraint trigger solde_depot after insert on ligne_ecriture deferrable initially deferred
  for each row when (new.contrat_ref like 'depot:%' and new.sens = 'D') execute function solde_depot_controler();
