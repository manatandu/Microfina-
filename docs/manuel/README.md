# Manuel d'utilisation d'Exofina

Demande du porteur du 27/11/2026 : un manuel complet, sur le modèle du guide de l'utilisateur de Microfina++, écran par écran, avec les notions
du métier que Microfina n'explique pas, et DWAC en entreprise pilote sur la page de garde.

- `chapitres/NN-*.md` : le texte, un fichier par chapitre ; `chapitres/NN-captures.json` : les captures que chaque chapitre demande.
- `outils/captures.cjs` : prend les captures sur un Exofina rempli (base du parcours de bout en bout), deux pixels par point.
- `outils/exhaustif.py` : vérifie que chaque écran du registre a sa section ou sa capture.
- `outils/assembler.py` puis `outils/finir.py` : Word (page de garde, sommaire, pieds de page), puis sommaire mis à jour et PDF par LibreOffice.

Les images ne sont pas dans le dépôt (plusieurs dizaines de mégaoctets) : elles se reprennent avec `captures.cjs`.
