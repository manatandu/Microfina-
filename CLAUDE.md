# Likelemba : règles de travail

Logiciel de gestion pour COOPEC et IMF en RDC. Le porteur du projet ne code pas : il valide sur écran, en langage métier (voir `README.md`).

## 0. Le modèle, c'est Microfina++ : rien d'inventé

Décision du porteur, 05/11/2026, valable pour tout le projet.

- Chaque écran, chaque parcours, chaque champ, chaque bouton reprend ce que fait Microfina++, tel que le montre son manuel (page citée). Avant d'écrire un écran, ouvrir la page du manuel qui le montre.
- Ne rien ajouter : ni page, ni texte, ni motif, ni fonction, ni raccourci que Microfina++ n'a pas. Pas de texte d'accroche, pas de décoration.
- Seule l'apparence est la nôtre (jetons de `replica/design/`) ; la structure est celle de Microfina++.
- Un écart n'est permis que si un texte l'impose (Instructions BCC, PCCI, lois), avec sa référence, ou si le porteur le demande. Sinon, on pose la question au porteur avant de faire.
- Ce que le manuel ne montre pas ne s'invente pas : on le marque « à confirmer » et on demande.

Deux phases, dans cet ordre (décision du porteur, 05/11/2026) :

1. **Reproduire exactement.** Les 146 fonctions de `replica/features.csv`, module par module, dans l'ordre des menus de Microfina++, avec ses schémas de fonctionnement tels quels : confirmations Oui/Non, étape « Comptabiliser » séparée, boutons Modifier et Supprimer, enchaînement des fenêtres. Ce que j'avais ajouté aux écrans déjà faits est retiré. Seule exception : un comportement qu'un texte interdit (Instructions BCC, PCCI, lois). Il est signalé au porteur avec la référence, jamais corrigé en silence.
2. **Ensuite seulement, alléger ou améliorer** là où Microfina++ est limité, point par point, avec l'accord du porteur.
   Les limites constatées sont notées au fil des écrans dans `docs/architecture/LIMITES-MICROFINA.md` ; à la fin de la phase 1, une analyse approfondie en part pour moderniser (demande du porteur, 13/11/2026).

### Ce que le manuel ne montre pas : complété par nous (décision du porteur, 12/11/2026)

Le porteur n'a pas de capture pour ce qui manque. Ces manques se complètent par nous, selon `docs/architecture/COMPLEMENTS.md`. Cette décision remplace, pour les manques seulement, la règle « on marque à confirmer et on demande ».

- Avant de construire un écran : lire sa ligne dans `replica/atlas.csv` et ouvrir **toutes** les pages du manuel qu'elle cite (des écrans sont montrés deux fois).
- Ce que le manuel montre se recopie toujours exactement.
- Un manque se complète en descendant l'échelle des preuves (COMPLEMENTS § 3) : capture, texte du manuel, règle générale du manuel (p. 7 à 12), écran voisin de la même famille, donnée exigée par un autre écran, texte réglementaire lu, puis seulement le porteur.
- L'écran complété prend le gabarit de sa famille (COMPLEMENTS § 4) et tient dans sa chaîne d'états (§ 6).
- Avant de compléter un point : chercher sa réponse dans `replica/decisions.csv` (page lisible : `docs/architecture/DECISIONS.md`). Une décision « retenue » se construit sans redemander.
- Chaque choix fait par nous est noté dans `replica/decisions.csv` avec son origine, et seulement là : aucun bloc de commentaire sur les écrans (décision du porteur, 12/11/2026 ; Microfina++ n'en a pas). Le porteur valide en fin de lot, à partir du registre. Après toute modification du registre : `python replica/decisions.py`.
- Toujours interdit : ajouter ce que l'atlas ne nomme pas comme manque, améliorer en passant, écrire une règle métier sans l'avoir lue.

Le travail suivant se choisit dans l'ordre des étapes de `docs/architecture/COMPLEMENTS.md` § 8 : la première étape qui a encore une fonction partielle ou à faire (`replica/couverture.csv`, colonne etape), puis l'ordre de l'atlas dans cette étape. Jamais « l'écran qui suit le dernier construit » : la colonne construit de l'atlas dit qu'un écran existe, pas qu'il est complet (demande du porteur, 13/11/2026).

Chaque réponse au porteur affiche l'état des travaux en une phrase, sans tableau : faites, partielles, à faire (demande du porteur, 13/11/2026 ; chiffres de `replica/couverture.csv`).

Suivi des travaux (demande du porteur, 12/11/2026) : à chaque avancée, chaque travail dit ce qui est fait et ce qui reste. `python replica/couverture.py` calcule l'état : « Fait » quand tous ses écrans sont construits et qu'aucune décision du registre ne reste à appliquer pour eux, sinon « Partiel » ; la page des travaux écrit sous chaque travail ce qui reste. Une décision appliquée passe à « en place » dans `replica/decisions.csv` au moment où elle l'est.

Après chaque fonction construite : mettre à jour `replica/features.csv`, `replica/atlas.csv` (colonne construit), `replica/decisions.csv`, relancer `python replica/couverture.py`, régénérer la page des travaux (`python replica/travaux.py <fichier>`) et la republier sur l'artefact « Travaux Likelemba ».

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

Chaque écran et chaque règle du code est **confronté aux Instructions de la BCC et aux lois des institutions** (loi 22/069, loi 11/020, loi 002/2002, AUSCOOP, PCCI) avant d'être livré (demande du porteur, 13/11/2026). La réponse dit ce qui a été lu et ce qui en sort, même quand aucun texte ne parle de l'écran. La matrice `docs/reglementaire/matrice-exigences.md` garde la trace de ce qui a été lu.

## 2. Design

- Règles du projet : `docs/design/DESIGN.md`. Elles priment sur les skills de design.
- Finition et mouvement : skill `emil-kowalski` (dans `.claude/skills/`). Lire la fiche qui correspond à la tâche avant d'écrire ou de juger, jamais de mémoire. Pour une maquette : `emil-design-eng` et `break-ui`.
- Les maquettes sont dans `docs/design/maquettes/`.
- Catalogue de composants 21st.dev : serveur MCP `21st` déclaré dans `.mcp.json`, clé dans la variable `API_KEY_21ST` de chaque poste, jamais dans le dépôt. Un composant trouvé là sert de point de départ : il est réécrit avec nos jetons et nos composants (`replica/design/`), sans Tailwind ni couleur en dur, puis confronté à DESIGN.md (pas d'animation sur ce qui se répète, couleur réservée au sens). Mode d'emploi : skill `21st-composants-ui`.

## 3. Architecture

- Décisions : `docs/architecture/ARCHITECTURE.md`.
- Capacité, cache, files, disponibilité : skill `system-design-primer` (dans `.claude/skills/`). La justesse des écritures passe avant le débit.

## 4. Écriture

Français, phrases courtes, pas de tiret cadratin. Données confidentielles des institutions auditées : jamais dans le dépôt.
