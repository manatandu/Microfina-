-- Plan d'allègement, lot 10 : seuls les comptes de l'institution reçoivent des écritures (registre T128, T129, T167 à T172).
-- Les comptes du PCCI servent de cadre ; sous chacun, l'institution a ses comptes d'utilisation (manuel Microfina++, p. 145 à 147 ; PCCI § 9).

-- 10.6 : Statut « Bloqué » : le compte ne reçoit que les écritures du logiciel, jamais une saisie à la main (T171)
alter table compte add column bloque boolean not null default false;

-- Comptes d'utilisation ouverts par le logiciel sous un compte du PCCI : le compte proposé (objet vide, T167), le compte d'un produit
-- pour une catégorie de membre (objet « epargne:12 » ou « credit:7 », T169), le compte d'un guichet dans une devise (objet « guichet:3 », T170)
create table compte_utilisation (
  institution_id bigint not null references institution on delete restrict,
  pcci           text not null,
  objet          text not null default '',
  categorie      text not null default '',
  compte_id      bigint not null unique references compte on delete restrict,
  primary key (institution_id, pcci, objet, categorie)
);

-- Comptes tenus par la gestion (registre S109-4) : leurs comptes d'utilisation naissent bloqués (T171)
create function compte_de_gestion(x text) returns boolean language sql immutable as $$
  select x ~ '^(3[0-5]|3[89]|57|59|103|451)'
$$;

-- Ouvre (ou retrouve) le compte d'utilisation n sous le compte du PCCI x et le note pour l'objet donné
create function compte_utilisation_ouvrir(i bigint, x text, n text, lib text, o text, cat text) returns bigint language plpgsql as $$
declare p compte; cid bigint;
begin
  select * into p from compte where numero = x and institution_id is null;
  insert into compte (institution_id, numero, libelle, classe, nature, saisissable, ouvert, bloque)
  values (i, n, lib, p.classe, p.nature, true, true, compte_de_gestion(x)) on conflict do nothing;
  select id into cid from compte where numero = n and institution_id = i;
  insert into compte_utilisation (institution_id, pcci, objet, categorie, compte_id) values (i, x, o, cat, cid) on conflict do nothing;
  select compte_id into cid from compte_utilisation where institution_id = i and pcci = x and objet = o and categorie = cat;
  return cid;
end $$;

-- T167 : le compte proposé sous le compte du PCCI x, son numéro suivi de zéros jusqu'à huit chiffres, son libellé
create function compte_propose(i bigint, x text) returns bigint language plpgsql as $$
declare cid bigint; lib text;
begin
  select compte_id into cid from compte_utilisation where institution_id = i and pcci = x and objet = '' and categorie = '';
  if cid is not null then return cid; end if;
  select libelle into lib from compte where numero = x and institution_id is null;
  if lib is null then return null; end if;
  return compte_utilisation_ouvrir(i, x, rpad(x, 8, '0'), lib, '', '');
end $$;

-- Rang d'un objet (produit, guichet) sous le compte du PCCI x : celui qu'il a déjà, sinon le suivant ; lu dans le numéro (position p, deux chiffres)
create function compte_utilisation_rang(i bigint, x text, o text, p int) returns int language sql stable as $$
  select coalesce((select substr(c.numero, p, 2)::int from compte_utilisation u join compte c on c.id = u.compte_id
                    where u.institution_id = i and u.pcci = x and u.objet = o limit 1),
                  (select coalesce(max(substr(c.numero, p, 2)::int), 0) + 1 from compte_utilisation u join compte c on c.id = u.compte_id
                    where u.institution_id = i and u.pcci = x and u.objet <> ''))
$$;

-- Catégorie du membre (PCCI, compte 103 ; même règle que services.compte_parts) : 0 personnes physiques, 1 groupements solidaires, 2 personnes morales
create function categorie_membre(t bigint) returns int language sql stable as $$
  select case when type = 'physique' then 0 when type = 'groupe' and type_client = 'Groupement solidaire' then 1 else 2 end from tiers where id = t
$$;

-- T169 : le compte du produit o (« epargne:12 », « credit:7 ») pour la catégorie k sous le compte du PCCI x : le compte du PCCI, la catégorie,
-- le rang du produit sous ce compte sur deux chiffres, des zéros jusqu'à huit chiffres ; libellé : produit et catégorie
create function compte_produit(i bigint, x text, o text, lib text, k int) returns bigint language plpgsql as $$
declare cid bigint; r int;
begin
  select compte_id into cid from compte_utilisation where institution_id = i and pcci = x and objet = o and categorie = k::text;
  if cid is not null then return cid; end if;
  r := compte_utilisation_rang(i, x, o, length(x) + 2);
  return compte_utilisation_ouvrir(i, x, rpad(x || k || lpad(r::text, 2, '0'), 8, '0'),
                                   lib || ', ' || (array['personnes physiques', 'groupements solidaires', 'personnes morales'])[k + 1], o, k::text);
end $$;

-- T168, T169, T170 : le compte qui reçoit une ligne d'écriture. Un compte de l'institution reste tel quel ; un compte du PCCI passe sur le compte
-- d'utilisation : celui du produit et de la catégorie du membre (crédits et dépôts, 30 à 35 et 39), celui du guichet et de la devise (caisse, 57),
-- sinon le compte proposé. Null : le numéro n'est pas au plan.
create function compte_ecriture(i bigint, n text, contrat text, dv text) returns bigint language plpgsql as $$
declare c compte; o text; lib text; t bigint; r int; d int;
begin
  select * into c from compte where numero = n and (institution_id = i or institution_id is null) order by institution_id nulls last limit 1;
  if not found then return null; end if;
  if c.institution_id is not null then return c.id; end if;
  if n ~ '^(3[0-5]|39)' and contrat ~ '^(depot|credit|decouvert):\d+$' then
    if contrat like 'credit:%' then
      select 'credit:' || p.id, p.nom || ' ' || p.numero, k2.tiers_id into o, lib, t from credit k2 join produit_credit p on p.id = k2.produit_id
       where k2.id = split_part(contrat, ':', 2)::bigint;
    else
      select 'epargne:' || p.id, p.libelle || ' ' || p.code, cd.tiers_id into o, lib, t from compte_depot cd join produit_epargne p on p.id = cd.produit_id
       where cd.id = case when contrat like 'depot:%' then split_part(contrat, ':', 2)::bigint
                          else (select compte_id from decouvert_douteux where id = split_part(contrat, ':', 2)::bigint) end;
    end if;
    if o is not null then
      return compte_produit(i, n, o, lib, categorie_membre(t));
    end if;
  end if;
  if n ~ '^57' and contrat ~ '^guichet:\d+$' then
    o := contrat;
    select compte_id into c.id from compte_utilisation where institution_id = i and pcci = n and objet = o and categorie = dv;
    if found then return c.id; end if;
    select 'Caisse ' || nom into lib from guichet where id = split_part(contrat, ':', 2)::bigint;
    d := case when dv = 'CDF' then 0 else 1 + (select count(*) from devise where code <> 'CDF' and code < dv) end;
    r := compte_utilisation_rang(i, n, o, length(n) + 1);
    return compte_utilisation_ouvrir(i, n, rpad(n || lpad(r::text, 2, '0') || d, 8, '0'), lib || ' ' || dv, o, dv);
  end if;
  return compte_propose(i, n);
end $$;

-- T172 : un compte du PCCI paramétré est remplacé par son compte proposé (même règle qu'à l'écriture)
create function compte_parametre(i bigint, n text) returns text language plpgsql as $$
declare cid bigint;
begin
  if n is null or not exists (select 1 from compte where numero = n and institution_id is null) then return n; end if;
  cid := compte_propose(i, n);
  return (select numero from compte where id = cid);
end $$;

create function comptes_parametres(i bigint) returns void language plpgsql as $$
begin
  update parametrage_frais pf set compte = compte_parametre(i, pf.compte) from frais f where f.id = pf.frais_id and f.institution_id = i and pf.compte is not null;
  update parametrage_frais_adhesion pa set compte = compte_parametre(i, pa.compte) from frais f where f.id = pa.frais_id and f.institution_id = i and pa.compte is not null;
  update produit_credit_frais pf set compte = compte_parametre(i, pf.compte) from produit_credit p where p.id = pf.produit_id and p.institution_id = i;
  update banque set compte_liaison = compte_parametre(i, compte_liaison) where institution_id = i and compte_liaison is not null;
  update guichet g set compte_guichet = compte_parametre(i, g.compte_guichet), compte_liaison = compte_parametre(i, g.compte_liaison),
                       compte_surplus = compte_parametre(i, g.compte_surplus), compte_manquant = compte_parametre(i, g.compte_manquant)
    from agence a where a.id = g.agence_id and a.institution_id = i;
  update credit_assureur set compte = compte_parametre(i, compte) where institution_id = i and compte is not null;
  update operation_diverse set compte = compte_parametre(i, compte) where institution_id = i and compte is not null;
  update element_facture set compte = compte_parametre(i, compte) where institution_id = i and compte is not null;
  update compte_bancaire set compte_penalite = compte_parametre(i, compte_penalite) where institution_id = i and compte_penalite is not null;
  update tiers_comptable set compte = compte_parametre(i, compte) where institution_id = i and compte is not null;
  update paie_type_avance set compte = compte_parametre(i, compte) where institution_id = i and compte is not null;
  update taxe set compte = compte_parametre(i, compte) where institution_id = i and compte is not null;
  update immo_famille set compte_acquisition = compte_parametre(i, compte_acquisition), compte_dotation = compte_parametre(i, compte_dotation),
                          compte_amortissement = compte_parametre(i, compte_amortissement), compte_produits = compte_parametre(i, compte_produits),
                          compte_charge_vcn = compte_parametre(i, compte_charge_vcn) where institution_id = i;
  update institution set compte_hors_bilan_1 = compte_parametre(i, compte_hors_bilan_1), compte_hors_bilan_2 = compte_parametre(i, compte_hors_bilan_2) where id = i;
end $$;

-- Les comptes bancaires étaient ouverts comme des lignes du PCCI : ils deviennent des comptes de l'institution, bloqués (registre S109-4)
update compte c set institution_id = cb.institution_id, bloque = true from compte_bancaire cb where cb.compte_id = c.id and c.institution_id is null;
-- 10.1 : le PCCI sert de cadre
update compte set saisissable = false where institution_id is null;
select comptes_parametres(id) from institution;

-- 10.1 : la base refuse une ligne d'écriture sur un compte qui n'est pas de l'institution de l'écriture
create function ligne_compte_institution() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from compte c join ecriture e on e.id = new.ecriture_id where c.id = new.compte_id and c.institution_id = e.institution_id) then
    raise exception 'Seuls les comptes de l''institution reçoivent des écritures (plan d''allègement, point 10.1 ; PCCI § 9).';
  end if;
  return new;
end $$;
create trigger ligne_compte_institution before insert on ligne_ecriture for each row execute function ligne_compte_institution();

-- 10.4 (registre T143) : le fonds de solidarité, au choix du produit de crédit : rendu au membre à la fin du prêt (dépôt de la clientèle, classe 3)
-- ou mis en commun pour couvrir les impayés (compte 172 « Fonds de garantie mutuels », PCCI, compte 17), sur un compte de l'institution
alter table produit_credit add column solidarite_destination text not null default 'membre' check (solidarite_destination in ('membre', 'commun')),
                           add column solidarite_compte text;
