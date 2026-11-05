# Journal de construction

Une ligne par écran. Les captures sont dans `clone-screens/` (1366 px, et 390 px en `-390`). Le parcours qui les produit est `web/e2e/tranche-verticale.cjs`.

## 05/11/2026 : coquille et tranche verticale

**Coquille.** Application React et TypeScript dans `web/`. Les 140 écrans de l'inventaire ont leur adresse ; ceux qui ne sont pas construits disent à quoi ils serviront et leur priorité, sans faire semblant. Jetons et composants lus dans `replica/design/` (une seule source). Menu à deux niveaux : module, puis écran.

**Données provisoires.** `web/src/donnees/api.ts`, en mémoire et dans le navigateur, avec les mêmes fonctions que les routes de `architecture.md`. Toutes rendent une promesse, comme le client HTTP du futur serveur. Les règles d'argent y sont déjà : écriture équilibrée par devise et en CDF, écritures figées, clé d'idempotence, quatre yeux. 8 tests (`npm test`).

**Tranche verticale.** Parcours complet joué dans un vrai navigateur, au clavier pour le guichet, à 1366 et 390 px, sans erreur console : ouverture de journée, ouverture de caisse, billetage d'ouverture avec écart justifié puis corrigé, enrôlement, visa, adhésion avec parts et premier dépôt, dépôt, retrait au-delà du seuil avec visa du chef, refus d'un membre sans specimen, arrêté de caisse, validation, fermeture de journée, balance équilibrée.

| Écran | Date | État | Ce qui manque | Plus dur que prévu |
| --- | --- | --- | --- | --- |
| S01 Connexion | 05/11/2026 | partiel | Mot de passe, TOTP, verrouillage (Instr. BCC 008, art. 16) : démonstration sans mot de passe | |
| S09 Ouverture de caisse | 05/11/2026 | partiel | Affectation des guichets (S10) | Le manuel range S09 dans Administration : les liens écrits à la main pointaient vers Caisse. Tous les liens passent désormais par l'inventaire |
| S12 Journée | 05/11/2026 | partiel | Clôture mensuelle ; traitements de fin de journée (rien à calculer sans crédit) | |
| S37 Enrôlement | 05/11/2026 | partiel | Onglets, personnes liées, résidence et agent économique, capture photo et specimen ; liste des champs exigés à confirmer | |
| S40 Visa du client | 05/11/2026 | partiel | Contrat d'adhésion imprimé | |
| S73 Adhésion | 05/11/2026 | partiel | Frais d'adhésion et minimum de parts : statuts à fournir | |
| S74 Dépôt et retrait | 05/11/2026 | partiel | Circuit d'examen renforcé (l'opération est bloquée en attendant), mandataire, reçu 80 mm | Le visa passe par un autre poste : sans reprise, le caissier perdait son bordereau en changeant d'utilisateur. Ajout de « Reprendre » sur la même clé ; un visa ne vaut que pour son montant et son compte |
| S79 Billetage | 05/11/2026 | fait | Écriture d'un écart de caisse : compte à confirmer, d'ici là la fermeture reste bloquée | |
| S80 Validation du billetage | 05/11/2026 | partiel | Écran à part ; aujourd'hui dans « Ma journée » du chef | |
| S121 Balance | 05/11/2026 | partiel | Filtres par période et par agence ; grand livre détaillé (S120) | |

Écarts avec la consigne du skill :

- **Un seul commit pour la tranche**, pas un par écran : les écrans du guichet partagent leurs composants (S73 réutilise le panneau membre et le reçu de S74, S40 et S80 la liste « À valider »). Les séparer aurait donné des commits qui ne compilent pas.
- **Captures à 1366 et 390 px**, pas 1440 : 1366 × 768 est l'écran de référence de DESIGN.md.
- **Pas de comparaison avec les écrans de Microfina++** : leurs captures restent hors du dépôt (manuel confidentiel). `replica-diff` comparera sur les fonctions, pas sur les pixels.

Valeurs d'exemple encore dans la démonstration, toutes signalées à l'écran : cours 2 850 CDF pour 1 USD, valeur de la part 4 000 CDF (exemple du manuel), seuil de visa 1 000 USD, coupures.
