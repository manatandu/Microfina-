-- Vérification du 22/11/2026 (confrontation BCC, § 18.2) : les modèles du bilan, du hors-bilan, du compte de résultat et du tableau de flux portent en
-- en-tête la dénomination, le sigle, le n° d'agrément, la date et le NRC (PCCI 14.1 à 14.3). Le NRC se note sur la société (S32).
alter table institution add column nrc text;
