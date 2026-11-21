-- Confrontation du 21/11/2026, A16 : décès du titulaire. Le mandat finit par la mort du mandant (Code civil, livre III, art. 544) ; les retraits ne se font plus
-- qu'à un ayant droit identifié sur la pièce de succession (AUSCOOP, art. 380 pour les parts). La désignation des héritiers relève du Code de la famille, non relu.
alter table tiers add column deces_le date, add column deces_reference text, add column deces_par bigint references utilisateur;
alter table procuration add column ayant_droit boolean not null default false;
