-- Registre T14, S12-2 : plusieurs journées peuvent attendre leur comptabilisation ; seule la dernière reçoit des opérations.
-- Le nombre de journées ouvertes à la fois est borné par « Journée Maxi ouvert » (Information société, registre S12-5).
drop index if exists journee_une_ouverte;
