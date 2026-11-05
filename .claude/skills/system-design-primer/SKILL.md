---
name: system-design-primer
description: Guide de conception de systèmes à grande échelle (The System Design Primer, Donne Martin). À employer pour raisonner sur la capacité, la répartition de charge, le cache, les files de messages, la cohérence et la disponibilité d'un service, ou pour relire l'architecture de Likelemba sous cet angle. Ne sert jamais de source comptable, fiscale ou juridique.
---

# The System Design Primer

Recueil organisé de notions et d'exercices de conception de systèmes, de Donne Martin
(licence CC BY 4.0, jointe en `LICENSE.txt`). Les textes sont COPIÉS tels quels dans
`references/` ; rien n'y est exécuté, et rien ne s'en importe dans le code de Likelemba.

## Quand l'employer

- Dimensionner ou expliquer une limite de capacité (pool de connexions, mémoire, nombre
  d'instances, plafond de fenêtre).
- Choisir ou relire une stratégie de cache et son invalidation.
- Décider si un traitement long relève d'une file de tâches ou reste dans la requête.
- Poser un compromis cohérence contre disponibilité, ou une reprise après sinistre.
- Préparer une revue d'architecture : montrer ce que Likelemba fait déjà, et ce qui ne lui
  convient pas.

## Où lire

| Besoin | Fichier |
|---|---|
| Table des matières, notions, tableaux de chiffres à connaître, questions d'entretien | `references/README.md` |
| Exercices corrigés de conception (pastebin, Twitter, crawler, cache de requêtes, agrégation de comptes bancaires `mint`, graphe social, classement des ventes, mise à l'échelle sur AWS) | `references/solutions/system_design/<exercice>/README.md`, et les `.py` du même dossier |
| Exercices de conception orientée objet | `references/solutions/object_oriented_design/<exercice>/` |

Les images et schémas ne sont pas dans la compétence ; ils sont dans le dépôt source,
https://github.com/donnemartin/system-design-primer. Les traductions
(japonais, chinois) ne sont pas reprises.

## Comment s'en servir ici

1. LIRE la section concernée AVANT d'en citer une règle, un chiffre ou un nom de motif ;
   ne jamais citer de mémoire.
2. Confronter chaque idée à ce que Likelemba a déjà décidé, lu dans `CLAUDE.md` et
   `docs/architecture/ARCHITECTURE.md` (§ 3 principes, § 5 noyau de données, § 7 réseau et
   agences, § 8 pile). Un chiffre du primer est un ordre de grandeur, jamais une mesure de
   Likelemba : une COOPEC traite quelques milliers d'opérations par jour.
3. Ce que le primer conseille pour des millions d'utilisateurs n'est pas un défaut de
   Likelemba. La contrainte de Likelemba est la JUSTESSE et l'AUDITABILITÉ des écritures
   (PCCI § 3.2 à 3.4 ; Instr. BCC 008, art. 11), pas le débit. Écarter d'office pour le
   livre-journal, le grand livre, la balance, les soldes des membres et la numérotation des
   pièces : la cohérence éventuelle, le partitionnement qui sépare une écriture de ses
   lignes, toute lecture périmée servie comme un solde, tout retrait accepté hors ligne.
4. Une proposition se dit comme une proposition, et se décide avec le porteur du projet.

## Ce que cette compétence ne fait pas

- Elle ne dit rien du plan de comptes, des états, des taux ni du droit : voir
  `reglementation-microfinance-rdc` (PCCI, lois 002/2002, 11/020, 22/069), `instructions-bcc-rdc`,
  `cenaref-blanchiment-capitaux-rdc`, `auscoop-acte-uniforme`.
- Elle ne remplace pas `docs/analyse/microfina-ecarts.md` pour les usages d'un logiciel de microfinance.
- Elle ne prime jamais sur `CLAUDE.md`.
