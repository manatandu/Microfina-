# Likelemba, application web

Écrans en React et TypeScript. Données provisoires dans le navigateur (`src/donnees/api.ts`) jusqu'au serveur Django.

```bash
npm install
```

```bash
npm run dev
```

Puis ouvrir l'adresse affichée et choisir un profil : le chef d'agence ouvre la journée, la caissière ouvre sa caisse, l'agent enrôle, le comptable lit la balance. « Remettre la démonstration à zéro » est sur la page de connexion.

```bash
npm test
```

Parcours complet dans un navigateur, le serveur de développement lancé sur le port 5199 :

```bash
node e2e/tranche-verticale.cjs /tmp/captures 1366
```

Les jetons et les styles des composants viennent de `../replica/design/` : on les change là, avec `generer.py`.
