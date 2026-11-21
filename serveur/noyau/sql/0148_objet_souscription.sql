-- Confrontation du 21/11/2026, A6 : pas de crédit pour souscrire ou acquérir des parts ou des actions de l'institution (loi 22/069, titre II, chap. II, section 4)
alter table credit_objet add column souscription_parts boolean not null default false;
