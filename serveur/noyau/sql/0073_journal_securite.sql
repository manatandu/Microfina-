-- Sécurité (demande du porteur, 15/11/2026, registre T22 à T26) : journal des événements de sécurité (connexions réussies et refusées,
-- blocages, refus de droit, dépassements de la limite de requêtes). Écrit hors de la transaction de la requête : un refus ne l'efface pas.
create table journal_securite (
  id bigint generated always as identity primary key,
  le timestamptz not null default now(),
  evenement text not null,
  login text,
  ip text,
  utilisateur_id bigint,
  detail text
);
create index on journal_securite (evenement, login, le);
create index on journal_securite (evenement, ip, le);
