-- S32 : Commune entre Ville et Quartier dans Information société (demande du porteur du 13/11/2026 ; découpage de S20, registre S32-7)
alter table institution add column commune text not null default '';
