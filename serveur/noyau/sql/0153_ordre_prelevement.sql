-- Confrontation du 21/11/2026, T1 : pas de compensation contre la restitution d'un dépôt (Code civil, livre III, art. 185, 2°) ; seule la rétention d'un
-- dépôt nanti se compense de plein droit (loi 11/020, art. 48). Un remboursement par prélèvement sur l'épargne garde la référence de l'ordre du client.
alter table remboursement add column ordre_client text;
