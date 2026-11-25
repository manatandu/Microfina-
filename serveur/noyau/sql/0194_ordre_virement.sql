-- Plan d'allègement, point 7.3 : un prélèvement sur le compte d'un client se fait sur son ordre, dont la référence est gardée
-- (Code civil, livre III, art. 185, 2° : pas de compensation contre la restitution d'un dépôt ; loi 11/020, art. 48 ; registre T71).
alter table operation_banque add column if not exists ordre_client text;
alter table operation_comptable add column if not exists ordre_client text;
