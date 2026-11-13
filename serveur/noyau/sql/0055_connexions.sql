-- S07 : Administration > Utilisateur > Autres fonctions ; Déconnecter utilisateurs (manuel Microfina++, p. 18) : Connecté, Machine (registre S07-1).
-- Le jeton de connexion est porté par la session ; « Déconnecter » l'efface et la session tombe (registre S07-2).
alter table utilisateur add column jeton_session text, add column machine text not null default '', add column connecte_le timestamptz;
