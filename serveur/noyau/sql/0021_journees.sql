-- S12 : Administration > Ouverture de journée (manuel Microfina++, p. 21) : liste Journée, Ouverte par, Heure ouverture, Date fermeture, Fermée par
alter table journee_comptable add column ouverte_le timestamptz not null default now(), add column fermee_le timestamptz;
