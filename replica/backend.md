# Serveur de Likelemba : état et contrôles

Mis à jour le 05/11/2026. Lit `replica/architecture.md` et `replica/schema.sql`.

## Ce qui tourne

- Django 5.2 LTS, Django Ninja, PostgreSQL 16, SQL écrit à la main pour le grand livre (`serveur/`).
- Une route HTTP par fonction de la façade `web/src/donnees/api.ts`. Les écrans ne changent pas : `VITE_DONNEES=serveur` les branche sur le serveur, sinon ils restent sur la démonstration dans le navigateur.
- Périmètre : la tranche verticale (journée, caisse et billetage, enrôlement et visa, adhésion, dépôt, retrait, visa du chef, fermeture, balance, journal). Les autres fonctions de `features.csv` viendront module par module.

## Vérifications faites

| Contrôle | Résultat |
|---|---|
| Tests du serveur (`pytest`) | 12 réussis |
| Tests des écrans (`vitest`) | 22 réussis |
| Parcours complet dans Chromium contre le serveur | réussi, aucune erreur |
| Même parcours sur la démonstration locale | réussi, aucune erreur |

Défaut trouvé par le parcours et corrigé : un billetage déjà validé pouvait être validé une seconde fois. Il est refusé des deux côtés, avec un test.

## Connexion et droits

- [x] Session dans un cookie signé, `HttpOnly`, `SameSite=Strict`, `Secure` hors développement, durée 8 h.
- [x] Pas de mot de passe pour l'instant, à la demande du porteur. `LIKELEMBA_SANS_MOT_DE_PASSE=1` l'autorise ; sans cette variable, la connexion est refusée.
- [x] Un seul contrôle de profil (`exiger`) appelé par chaque service qui écrit.
- [x] Quatre yeux : le valideur d'un billetage n'est pas celui qui a compté ; le visa d'un retrait et d'un membre est réservé au chef d'agence. Testé avec un second utilisateur.
- [x] En-tête `X-Likelemba: 1` exigé sur toute écriture (requêtes forgées depuis un autre site).
- [ ] Mot de passe, verrouillage après échecs, délai d'inactivité : à confirmer (Instr. BCC 008, art. 16, à lire avant d'écrire).
- [ ] Les lectures (membre, compte, opération) vérifient la session mais pas encore l'institution du membre lu. Sans effet tant qu'il n'y a qu'une institution ; à faire avant le multi-institution (question ouverte au porteur).
- [ ] `/api/utilisateurs` liste les identifiants sans session, pour la page de connexion. À confirmer : Microfina++ propose-t-il cette liste ?

## Base de données

- [x] Migrations versionnées : `0001_schema` (lit `replica/schema.sql`), `0002_complements`. Lancement : `python manage.py migrate`.
- [x] Garanties tenues par la base : écriture équilibrée par devise et en CDF, grand livre non modifiable (correction par contre-passation), rien dans une période close, une seule journée ouverte par agence.
- [x] Une requête = une transaction. Verrou sur le compte et sur la session de caisse pendant l'écriture. Clé d'idempotence : la même opération envoyée deux fois ne paie pas deux fois (testé).
- [x] Données de démonstration fictives : `python manage.py graine`. Aucune donnée d'institution réelle.
- [ ] Sauvegardes : à mettre en place à l'installation (section F du plan des travaux).

## Paiements, courriels, intégrations

Sans objet pour l'instant : le manuel de Microfina++ ne montre ni paiement en ligne ni envoi de courriels. Le mobile money reste une question ouverte au porteur.

## Sécurité

- [x] Secrets seulement en variables d'environnement. `.env` et `.venv/` ignorés par git. `.env.example` donne les noms, sans valeur.
- [x] Montants, devises et coupures contrôlés par le serveur, jamais crus du navigateur.
- [x] Droits vérifiés à chaque écriture ; session vérifiée à chaque lecture.
- [ ] Limite de tentatives sur la connexion : à faire avec le mot de passe.
- [x] Pas de pièce jointe pour l'instant.
- [x] Pas de donnée de membre dans les adresses : seulement des numéros internes.
- [x] Dépendances du serveur auditées (`pip-audit`) : aucune faille connue après passage à Django 5.2.17.
- [x] Dépendances des écrans auditées (`npm audit`) : routeur et Vite mis à jour. Restent deux alertes sur vitest, outil de test qui ne part pas dans l'application ; le correctif demande vitest 5.
- [ ] Politique de protection des données : dépend de la loi applicable, question ouverte au porteur.

## Lancer le serveur

```bash
cd serveur && python -m venv .venv && .venv/bin/pip install -r requirements.txt
```

Copier `.env.example` en `.env`, le remplir, puis le charger dans le terminal :

```bash
set -a && . ./.env && set +a
```

```bash
.venv/bin/python manage.py migrate && .venv/bin/python manage.py graine
```

```bash
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

Écrans branchés sur le serveur, dans `web/` :

```bash
VITE_DONNEES=serveur npx vite
```
