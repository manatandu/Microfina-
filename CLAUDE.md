# Likelemba : règles de travail

Logiciel de gestion pour COOPEC et IMF en RDC. Le porteur du projet ne code pas : il valide sur écran, en langage métier (voir `README.md`).

## 1. Rien de mémoire

Toute règle métier, tout article, tout compte, tout taux, tout seuil ou délai est **lu dans le texte avant d'être écrit**, puis cité avec sa référence exacte (« Instr. BCC 15 bis, art. 7 », « PCCI, compte 3900 »). Ce qui n'a pas été lu ne s'écrit pas : on le marque « à confirmer » et on le pose comme question au porteur.

Sources, à ouvrir dans cet ordre :

| Sujet | Skill |
|---|---|
| Instructions de la BCC (version en vigueur, index des modifications) | `instructions-bcc-rdc` |
| PCCI, loi 11/020, loi 002/2002 (COOPEC), loi 22/069, Instructions BCC historiques | `reglementation-microfinance-rdc` |
| Blanchiment, CENAREF, loi 22/068 modifiée par la loi 25/048 | `cenaref-blanchiment-capitaux-rdc` |
| Acte uniforme OHADA sur les sociétés coopératives | `auscoop-acte-uniforme` |
| Obligations, paiements, imputation | `code-civil-livre-iii-rdc` |

Chaque écran et chaque règle du code est **confronté aux Instructions de la BCC** avant d'être livré. La matrice `docs/reglementaire/matrice-exigences.md` garde la trace de ce qui a été lu.

## 2. Design

- Règles du projet : `docs/design/DESIGN.md`. Elles priment sur les skills de design.
- Finition et mouvement : skill `emil-kowalski` (dans `.claude/skills/`). Lire la fiche qui correspond à la tâche avant d'écrire ou de juger, jamais de mémoire. Pour une maquette : `emil-design-eng` et `break-ui`.
- Les maquettes sont dans `docs/design/maquettes/`.

## 3. Architecture

- Décisions : `docs/architecture/ARCHITECTURE.md`.
- Capacité, cache, files, disponibilité : skill `system-design-primer` (dans `.claude/skills/`). La justesse des écritures passe avant le débit.

## 4. Écriture

Français, phrases courtes, pas de tiret cadratin. Données confidentielles des institutions auditées : jamais dans le dépôt.
