/** Plan d'allègement, point 7.17 : le bloc budget (type de budget, ligne, bailleur) ne s'affiche que si un budget a des lignes et qu'un compte
 *  de l'opération est une immobilisation (classe 2), une charge (classe 6) ou un produit (classe 7). Hors de ces cas, rien n'est envoyé. */
export const blocBudget = (lignesBudget: unknown[], comptes: string[]) => lignesBudget.length > 0 && comptes.some((c) => /^[267]/.test(c.trim()));
