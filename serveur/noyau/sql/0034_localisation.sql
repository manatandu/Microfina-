-- S20 : Info de base > Localisation (manuel Microfina++, p. 30 à 32), adaptée au découpage de la RDC à la demande du porteur (12/11/2026,
-- registre S20-1) : pays, province (Constitution, art. 2), ville ou territoire, commune / secteur / chefferie (Constitution, art. 3),
-- quartier ou groupement (Décret 22/07 du 02/03/2022, art. 9, point 26). Suppression logique (registre T02).
alter table localite
  add column nationalite text not null default '',
  add column code        text not null default '',
  add column zone        text not null default '',
  add column actif       boolean not null default true;
-- Les lieux déjà saisis sur trois niveaux (pays, ville, quartier) reçoivent les niveaux intermédiaires, du même nom
do $$
declare r record; n bigint;
begin
  for r in select v.id, v.parent_id, v.nom from localite v join localite p on p.id = v.parent_id where v.niveau = 'ville' and p.niveau = 'pays' loop
    insert into localite (parent_id, niveau, nom) values (r.parent_id, 'province', r.nom) returning id into n;
    update localite set parent_id = n where id = r.id;
  end loop;
  for r in select q.id, q.parent_id, q.nom from localite q join localite v on v.id = q.parent_id where q.niveau = 'quartier' and v.niveau = 'ville' loop
    insert into localite (parent_id, niveau, nom) values (r.parent_id, 'commune', r.nom) returning id into n;
    update localite set parent_id = n where id = r.id;
  end loop;
end $$;
alter table localite add constraint localite_niveau check (niveau in ('pays', 'province', 'ville', 'commune', 'quartier'));
