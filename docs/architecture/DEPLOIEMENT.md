# Site en ligne : Google Cloud (Blaze) et déploiement automatique

Décision du porteur, 14/11/2026 : publier le logiciel officiel (pas la démonstration), puis déployer chaque avancée automatiquement.

## Ce qui tourne où

| Morceau | Service | Rôle |
|---|---|---|
| Pages web | Firebase Hosting | Sert l'application. `/api/**` est renvoyé vers Cloud Run. |
| Serveur | Cloud Run, service `likelemba-api` | Django + gunicorn. S'éteint sans visite, se rallume en quelques secondes. |
| Base | Neon, PostgreSQL, plan gratuit (1 Go, s'endort après 5 minutes sans visite) | Hors Google. Départ gratuit ; bascule possible vers Cloud SQL plus tard (copie de la base, aucun changement du logiciel). |
| Secrets | Secret Manager | Clé du serveur, mot de passe et adresse de la base, premier mot de passe du chef. Jamais dans le dépôt. |
| Images | Artifact Registry, dépôt `likelemba` | Une image par envoi. |

Région : `europe-west1` (Belgique). Page web et serveur sont sur le même domaine : le cookie de session reste « même site » et seul `__session` traverse Firebase Hosting, d'où `LIKELEMBA_COOKIE=__session`.

## Ce que fait un envoi sur la branche

1. Tests du serveur et de la page web. S'ils échouent, rien n'est publié.
2. Construction de l'image, puis tâche `likelemba-preparer` : migrations, graine (uniquement si la base est vide), premier mot de passe de `jpmukendi` (uniquement s'il n'en a pas).
3. Mise à jour du serveur, puis des pages web.
4. Contrôle : `/api/session/mode` doit répondre « mot de passe requis ».

GitHub se connecte à Google sans clé (Workload Identity Federation) : aucun secret à copier dans GitHub.

## Installation unique (le porteur)

1. Console Firebase : créer le projet, le passer au plan **Blaze** (carte bancaire à son nom). Noter l'**ID du projet** (Paramètres du projet > Général).
2. neon.com : créer un compte et un projet (région Europe). Bouton **Connect** : décocher « Connection pooling » (adresse directe), copier l'adresse `postgresql://...`.
3. Console Google Cloud, même projet : ouvrir Cloud Shell, puis `curl -fsSL https://raw.githubusercontent.com/manatandu/Microfina-/claude/cool-davinci-fwyyx7/deploiement/installer.sh -o installer.sh && bash installer.sh IDENTIFIANT`. Il demande l'adresse Neon, puis un mot de passe pour le premier compte, et affiche des lignes sans secret à recopier dans la conversation.
4. Claude écrit ces lignes dans `deploiement/config.env` et pousse : le premier déploiement part seul.

## Coût (estimation à vérifier sur les pages de prix de Google et de Neon)

Départ : près de zéro. Cloud Run, Hosting, secrets et images restent dans les quotas gratuits de Google à petite échelle ; Neon gratuit ne coûte rien. Le plan Blaze demande une carte bancaire mais ne facture que ce qui dépasse les quotas. Un budget d'alerte se règle dans Facturation. Passer à Cloud SQL (`db-f1-micro`) ajoute environ 10 à 15 dollars par mois.

## Limites à connaître

- Neon gratuit : 1 Go au plus (au-delà, les écritures sont refusées), base endormie après 5 minutes (premier appel lent), sauvegardes limitées. Acceptable avec la graine fictive ; à remplacer par Cloud SQL ou une offre payante avant une vraie institution.
- Le site ne contient que la graine fictive (COOPEC Tujenge). Une vraie institution demande la création de sa première équipe : étape à part.
- Pas de limite d'essais de mot de passe (registre S01-3, à confirmer).
- L'accès de GitHub est limité au dépôt `manatandu/Microfina-` ; toute personne qui peut pousser sur ses branches de déploiement peut publier.
