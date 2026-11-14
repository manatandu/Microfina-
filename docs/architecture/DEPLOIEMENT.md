# Site en ligne : Google Cloud (Blaze) et déploiement automatique

Décision du porteur, 14/11/2026 : publier le logiciel officiel (pas la démonstration), puis déployer chaque avancée automatiquement.

## Ce qui tourne où

| Morceau | Service | Rôle |
|---|---|---|
| Pages web | Firebase Hosting | Sert l'application. `/api/**` est renvoyé vers Cloud Run. |
| Serveur | Cloud Run, service `likelemba-api` | Django + gunicorn. S'éteint sans visite, se rallume en quelques secondes. |
| Base | Cloud SQL, PostgreSQL 16, instance `likelemba-bd` | Sauvegarde automatique chaque nuit à 02:00. |
| Secrets | Secret Manager | Clé du serveur, mot de passe de la base, premier mot de passe du chef. Jamais dans le dépôt. |
| Images | Artifact Registry, dépôt `likelemba` | Une image par envoi. |

Région : `europe-west1` (Belgique). Page web et serveur sont sur le même domaine : le cookie de session reste « même site » et seul `__session` traverse Firebase Hosting, d'où `LIKELEMBA_COOKIE=__session`.

## Ce que fait un envoi sur la branche

1. Tests du serveur et de la page web. S'ils échouent, rien n'est publié.
2. Construction de l'image, puis tâche `likelemba-preparer` : migrations, graine (uniquement si la base est vide), premier mot de passe de `jpmukendi` (uniquement s'il n'en a pas).
3. Mise à jour du serveur, puis des pages web.
4. Contrôle : `/api/session/mode` doit répondre « mot de passe requis ».

GitHub se connecte à Google sans clé (Workload Identity Federation) : aucun secret à copier dans GitHub.

## Installation unique (le porteur)

1. Console Firebase : créer le projet, le passer au plan **Blaze** (carte bancaire à son nom). Notifier l'identifiant du projet.
2. Console Google Cloud, même projet : ouvrir Cloud Shell, puis `curl -fsSL https://raw.githubusercontent.com/manatandu/Microfina-/claude/cool-davinci-fwyyx7/deploiement/installer.sh -o installer.sh && bash installer.sh IDENTIFIANT`. Il demande un mot de passe pour le premier compte et affiche trois lignes à recopier dans la conversation.
3. Claude écrit ces lignes dans `deploiement/config.env` et pousse : le premier déploiement part seul.

## Coût (estimation à vérifier sur les pages de prix de Google)

Cloud SQL `db-f1-micro` avec 10 Go : environ 10 à 15 dollars par mois, même sans visite. Le reste (Cloud Run, Hosting, secrets, images) reste dans les quotas gratuits ou presque à petite échelle. Ce coût grimpe avec la base et le trafic, pas avec le nombre de pages. Un budget d'alerte se règle dans Facturation.

## Limites à connaître

- `db-f1-micro` est une machine partagée, sans engagement de disponibilité : acceptable pour commencer, à remplacer avant une vraie institution.
- Le site ne contient que la graine fictive (COOPEC Tujenge). Une vraie institution demande la création de sa première équipe : étape à part.
- Pas de limite d'essais de mot de passe (registre S01-3, à confirmer).
- L'accès de GitHub est limité au dépôt `manatandu/Microfina-` ; toute personne qui peut pousser sur ses branches de déploiement peut publier.
