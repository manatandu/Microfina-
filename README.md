# Likelemba

Logiciel de gestion pour les COOPEC et les institutions de microfinance en RDC, conforme au PCCI et aux Instructions de la Banque Centrale du Congo. Nom de travail.

## Où en est le projet

Phase de conception. Aucune ligne de code pour l'instant.

| Document | Contenu |
|---|---|
| [Architecture](docs/architecture/ARCHITECTURE.md) | Les choix de fond et leurs raisons |
| [Direction design](docs/design/DESIGN.md) | Comment les écrans doivent se comporter |
| [Matrice réglementaire](docs/reglementaire/matrice-exigences.md) | Chaque exigence des textes et le module qui la porte |
| [Analyse de Microfina++](docs/analyse/microfina-ecarts.md) | Ce qu'on garde, corrige ou laisse du logiciel existant |

## Comment on travaille

Le porteur du projet ne code pas. Il apporte l'expertise métier : PCCI, réglementation BCC, audit, fonctionnement réel d'une COOPEC.

- **Construction** : Claude écrit le code, la base de données et les tests.
- **Validation** : le porteur valide ce qu'il voit, en langage métier, jamais en lisant du code. Chaque étape livre quelque chose à manipuler (écran, état, reçu) et une liste de scénarios rédigés comme un comptable les vérifierait :
  > Dépôt de 100 USD au guichet. Le solde du membre augmente de 100 USD. L'écriture débite le 570 et crédite le 330. Le billetage de la caisse compte un billet de 100 de plus.
- **Décisions** : chaque choix tranché est daté dans le document d'architecture.

Avant toute mise en service dans une institution réelle, il faudra au moins une personne technique côté porteur (employée ou prestataire) pour l'installation, les sauvegardes, la sécurité et les incidents. L'Instruction BCC 008 impose de toute façon un responsable de la sécurité informatique.
