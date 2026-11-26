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
2. Construction de l'image, puis tâche `likelemba-preparer` : migrations, graine (uniquement si la base est vide), premier mot de passe des six comptes de démonstration (`jpmukendi`, `engalula`, `bkasongo`, `stshibanda`, `plumbala`, `gmbuyi`), le même pour tous, uniquement pour un compte qui n'en a pas (demande du porteur du 25/11/2026). Chacun le change ensuite depuis l'icône de clé.
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
- Le site ne contient que la graine fictive (COOPEC Tujenge). Une vraie institution s'installe à part : voir « Installer une institution réelle ».
- Pas de limite d'essais de mot de passe (registre S01-3, à confirmer).
- L'accès de GitHub est limité au dépôt `manatandu/Microfina-` ; toute personne qui peut pousser sur ses branches de déploiement peut publier.


## Contrôle du site en ligne (demande du porteur, 14/11/2026)

Après chaque déploiement, le travail « Contrôle du site en ligne » (`.github/workflows/verifier.yml`) se connecte au site avec un compte de vérification
et ouvre chaque écran construit, sans rien enregistrer. Il signale les erreurs de page et les réponses 5xx du serveur ; les captures des écrans en panne
sont jointes au travail. Il se lance aussi à la main (Actions > Contrôle du site en ligne > Run workflow).

Le compte est créé par l'administrateur dans le logiciel (Administration > Utilisateur > Création). Son identifiant et son mot de passe sont rangés
dans les secrets du dépôt GitHub (Settings > Secrets and variables > Actions) sous les noms `VERIF_LOGIN` et `VERIF_MOT_DE_PASSE`, jamais dans le dépôt
ni dans une conversation. Sans ces secrets, le contrôle échoue (audit du 21/11/2026, point bloquant B2) : le site est publié, mais le travail
« verification » reste rouge tant que le compte n'est pas donné.

Le compte de vérification tient un profil en lecture seule (AUDITEUR), sans second facteur. Si les mots de passe de l'institution expirent,
le sien se renouvelle avant l'échéance et le secret `VERIF_MOT_DE_PASSE` se met à jour (registre T218).

## Alerte en cas d'erreur du serveur (audit du 21/11/2026, point bloquant B2 ; registre T219)

Une erreur du serveur s'écrit dans le journal de l'hébergeur. Elle part aussi par courriel quand ces variables sont données au service du serveur :

- `LIKELEMBA_ALERTE_COURRIELS` : les adresses qui reçoivent l'alerte, séparées par des virgules ;
- `LIKELEMBA_SMTP_HOTE`, `LIKELEMBA_SMTP_PORT` (587 par défaut, 465 pour SSL), `LIKELEMBA_SMTP_UTILISATEUR`, `LIKELEMBA_SMTP_EXPEDITEUR` : le relais de courrier de l'exploitant ;
- `LIKELEMBA_SMTP_MOT_DE_PASSE` : un secret de l'hébergeur, jamais dans le dépôt.

Le courriel donne la date, la requête sans ses paramètres, le type de l'erreur et l'endroit du code. Il ne contient aucune donnée d'un membre.
La même erreur ne repart pas avant un quart d'heure. Sans adresse ou sans relais, aucun courriel ne part.

## Adresse du poste (audit du 21/11/2026, point I4 ; registre T229)

Le journal de sécurité, le blocage après trop de connexions refusées et la limite de requêtes se servent de l'adresse du poste. Derrière un ou
plusieurs relais (hébergeur, répartiteur, proxy de l'agence), elle se lit dans l'en-tête `X-Forwarded-For` : chaque relais y ajoute, à la fin,
l'adresse qu'il a vue. Le début de l'en-tête peut être écrit par le poste lui-même.

- `LIKELEMBA_RELAIS_DE_CONFIANCE` : le nombre de relais placés devant le serveur. `1` derrière un seul relais, `2` derrière deux, `0` sans relais.

Pour le fixer : se connecter depuis un poste dont on connaît l'adresse publique, puis lire l'adresse notée dans le Journal de sécurité. Elle doit
être celle du poste. Sans ce réglage, la première adresse de l'en-tête sert, comme avant : le blocage par adresse se contourne alors ; le blocage
par identifiant reste.

## Installer une institution réelle

Audit du 21/11/2026, point bloquant B5 (registre T227). Une installation par institution : sa base, sa clé de sauvegarde, son contrôle (décision D2).

Sur une base vide, jamais sur celle de la démonstration :

```bash
python manage.py migrate
```

```bash
python manage.py installer --nom "Dénomination de l'agrément" --sigle "SIGLE" --type coopec --agence-code 01 --agence-nom "Siège" --exercice 2027 --admin-login identifiant --admin-nom "Nom et prénoms"
```

```bash
python manage.py definir_mot_de_passe identifiant
```

`--type` : `coopec`, `societe_microfinance`, `entreprise_microcredit` ou `faitiere`. `--fuseau` : `Africa/Kinshasa` (par défaut) ou `Africa/Lubumbashi`.

La commande crée l'institution, sa première agence, l'exercice et ses journaux, les jours fériés légaux, les listes et les profils de départ, et le premier administrateur. Elle ne crée ni membre, ni compte, ni guichet, ni produit. Elle refuse une base qui contient déjà une institution. La graine et les exemples ne s'appliquent pas à une institution réelle : ne pas les lancer au déploiement.

Ensuite, dans le logiciel, dans cet ordre :

1. Le premier administrateur se connecte, remplace son mot de passe, crée les utilisateurs et leur donne un profil (Administration > Utilisateurs). Il règle la durée des mots de passe et le second facteur (Règles de connexion).
2. Le chef d'agence ajoute le quartier du siège (Paramétrage > Localisation), puis remplit la fiche Société : adresse, numéro d'agrément, valeur de la part sociale des statuts pour une COOPEC, contact de l'Unité des plaintes.
3. Il vérifie les devises et les coupures, saisit le cours du jour, crée les produits d'épargne et de crédit, les frais, les guichets et leurs affectations.
4. Il ouvre la première journée. Les soldes de départ entrent par la reprise des données (point B4).

L'essai `serveur/tests/test_installation.py` suit ce chemin, de la base vide au premier dépôt.
