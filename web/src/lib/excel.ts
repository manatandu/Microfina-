/** Export d'une grille vers Excel (manuel p. 9 : « Une grille peut être exportée vers Excel » ; registre T17).
 * Vrai classeur .xlsx, écrit sans bibliothèque (lib/xlsx.ts ; registre T247). Chaque export porte les filtres automatiques d'Excel sur sa ligne
 * de titres (demande du porteur, 27/11/2026 ; registre T246). */
import { traduire } from "./langue";
import { telechargerXlsx, xlsx } from "./xlsx";

/** La feuille de l'export : le cartouche s'il y en a un (une ligne par mention, puis une ligne vide), la ligne des titres, puis les lignes ;
 *  filtres sur les titres dès qu'il y a une ligne */
export function grilleXlsx(nom: string, entetes: string[], lignes: (string | number)[][], cartouche: string[] = []) {
  const avant: (string | number)[][] = cartouche.length ? [...cartouche.map((t) => [t]), []] : [], titres = avant.length + 1;
  return xlsx([{ nom, lignes: [...avant, entetes, ...lignes].map((cellules) => ({ style: "", cellules })), filtre: { entete: titres, derniere: titres + lignes.length, colonnes: entetes.length } }]);
}

/** En anglais, les titres et les libellés de la grille sortent en anglais, comme à l'écran (registre T118) ; les montants et les données ne changent pas.
 *  cartouche : mentions à porter au-dessus de la grille (en-tête des modèles du PCCI 14.1 à 14.3 ; registre T250) */
export function exporterExcel(nom: string, entetes0: string[], lignes0: (string | number)[][], cartouche: string[] = []) {
  const entetes = entetes0.map(traduire), lignes = lignes0.map((l) => l.map((v) => (typeof v === "string" ? traduire(v) : v)));
  nom = traduire(nom);
  telechargerXlsx(nom, grilleXlsx(nom, entetes, lignes, cartouche));
}
