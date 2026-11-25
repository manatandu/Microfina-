/** Plan d'allègement, lot 10 : seuls les comptes de l'institution reçoivent des écritures (registre T128, T129, T167 à T172).
 *  Sous chaque compte du PCCI, l'institution a ses comptes d'utilisation (manuel Microfina++, p. 145 à 147 ; PCCI § 9).
 *  Mêmes règles que la base (serveur/noyau/sql/0190_comptes_utilisation.sql, fonction compte_ecriture). Fonctions pures sur l'état local. */
import PCCI from "@pcci";
import type { CompteInstitution, Etat } from "./types";

const PAR_NUMERO = new Map(PCCI.comptes.map((c) => [c.numero, c]));
const FEUILLES = new Set(PCCI.comptes.filter((c) => !PCCI.comptes.some((e) => e.numero !== c.numero && e.numero.startsWith(c.numero))).map((c) => c.numero));
const CATEGORIES = ["personnes physiques", "groupements solidaires", "personnes morales"];

export const estComptePcci = (n: string) => PAR_NUMERO.has(n);
/** Comptes tenus par la gestion (registre S109-4) : leurs comptes d'utilisation naissent bloqués (T171) */
export const compteDeGestion = (x: string) => /^(3[0-5]|3[89]|57|59|103|451)/.test(x);
/** Catégorie du membre (PCCI, compte 103 ; même règle que compteParts) : 0 personnes physiques, 1 groupements solidaires, 2 personnes morales */
export const categorieMembre = (t: { type: string; typeClient?: string | null }) => (t.type === "physique" ? 0 : t.type === "groupe" && t.typeClient === "Groupement solidaire" ? 1 : 2);

function ouvrir(e: Etat, x: string, n: string, libelle: string, objet: string, categorie: string): string {
  const p = PAR_NUMERO.get(x)!;
  if (!e.comptesInstitution.some((c) => c.numero === n)) {
    const c: CompteInstitution = { numero: n, libelle, classe: p.classe, nature: p.nature, ouvert: true, bloque: compteDeGestion(x), saisissable: true, saisieAnalytique: false,
      saisieEcheance: false, lettrageAuto: false, saisieTiers: false, immobilisation: false, compteTaxe: false, compteTaxable: false, typeSuivi: "" };
    e.comptesInstitution.push(c);
  }
  const u = (e.comptesUtilisation ??= []);
  if (!u.some((y) => y.pcci === x && y.objet === objet && y.categorie === categorie)) u.push({ pcci: x, objet, categorie, numero: n });
  return u.find((y) => y.pcci === x && y.objet === objet && y.categorie === categorie)!.numero;
}

/** T167 : le compte proposé sous le compte du PCCI x, son numéro suivi de zéros jusqu'à huit chiffres, son libellé */
export function comptePropose(e: Etat, x: string): string {
  const deja = e.comptesUtilisation?.find((y) => y.pcci === x && y.objet === "" && y.categorie === "");
  return deja ? deja.numero : ouvrir(e, x, x.padEnd(8, "0"), PAR_NUMERO.get(x)!.libelle, "", "");
}

/** Rang d'un objet (produit, guichet) sous le compte du PCCI x : celui qu'il a déjà, sinon le suivant ; lu dans le numéro (position p, deux chiffres) */
function rang(e: Etat, x: string, objet: string, p: number) {
  const u = e.comptesUtilisation ?? [], lu = (n: string) => Number(n.slice(p - 1, p + 1));
  const deja = u.find((y) => y.pcci === x && y.objet === objet);
  return deja ? lu(deja.numero) : Math.max(0, ...u.filter((y) => y.pcci === x && y.objet !== "").map((y) => lu(y.numero))) + 1;
}

/** T169 : le compte du produit (« epargne:12 », « credit:7 ») pour la catégorie k sous le compte du PCCI x : le compte du PCCI, la catégorie, le rang
 *  du produit sous ce compte sur deux chiffres, des zéros jusqu'à huit chiffres ; libellé : produit et catégorie. Comme la base (compte_produit). */
export function compteProduit(e: Etat, x: string, objet: string, libelle: string, k: number): string {
  const deja = e.comptesUtilisation?.find((y) => y.pcci === x && y.objet === objet && y.categorie === String(k));
  if (deja) return deja.numero;
  const r = rang(e, x, objet, x.length + 2);
  return ouvrir(e, x, `${x}${k}${String(r).padStart(2, "0")}`.padEnd(8, "0"), `${libelle}, ${CATEGORIES[k]}`, objet, String(k));
}

/** Produit et titulaire d'un contrat de dépôt, de crédit ou de découvert */
function produitDuContrat(e: Etat, contrat: string): { objet: string; libelle: string; tiersId: number } | null {
  const [quoi, id] = contrat.split(":") as [string, string];
  if (quoi === "credit") {
    const c = e.credits.find((x) => x.id === Number(id)), p = c && e.produitsCredit.find((x) => x.id === c.produitId);
    return c && p ? { objet: `credit:${p.id}`, libelle: `${String(p.nom ?? "")} ${String(p.numero ?? "")}`.trim(), tiersId: c.tiersId } : null;
  }
  const cid = quoi === "depot" ? Number(id) : e.decouvertsDouteux?.find((x) => x.id === Number(id))?.compteId;
  const c = e.comptes.find((x) => x.id === cid);
  const p = c && e.produits.find((x) => (c.produitId !== undefined ? x.id === c.produitId : x.libelle === c.intitule && x.devise === c.devise));
  return c && p ? { objet: `epargne:${p.id}`, libelle: `${p.libelle} ${p.code}`, tiersId: c.tiersId } : null;
}

/** T168, T169, T170 : le compte qui reçoit une ligne. Un compte de l'institution reste tel quel ; un compte du PCCI passe sur le compte d'utilisation :
 *  celui du produit et de la catégorie du membre (crédits et dépôts, 30 à 35 et 39), celui du guichet et de la devise (caisse, 57), sinon le compte proposé.
 *  Null : le numéro n'est pas au plan. */
export function compteEcriture(e: Etat, n: string, contrat?: string | null, dv = "CDF"): string | null {
  if (e.comptesInstitution.some((c) => c.numero === n) || e.comptesBancaires.some((b) => b.compte === n)) return n;
  if (!PAR_NUMERO.has(n)) return null;
  if (/^(3[0-5]|39)/.test(n) && contrat && /^(depot|credit|decouvert):\d+$/.test(contrat)) {
    const p = produitDuContrat(e, contrat), t = p && e.tiers.find((x) => x.id === p.tiersId);
    if (p && t) return compteProduit(e, n, p.objet, p.libelle, categorieMembre(t));
  }
  if (/^57/.test(n) && contrat && /^guichet:\d+$/.test(contrat)) {
    const deja = e.comptesUtilisation?.find((y) => y.pcci === n && y.objet === contrat && y.categorie === dv);
    if (deja) return deja.numero;
    const g = e.guichets.find((x) => x.id === Number(contrat.split(":")[1]));
    const d = dv === "CDF" ? 0 : 1 + e.devises.filter((x) => x.code !== "CDF" && x.code < dv).length;
    const r = rang(e, n, contrat, n.length + 1);
    return ouvrir(e, n, `${n}${String(r).padStart(2, "0")}${d}`.padEnd(8, "0"), `Caisse ${g?.nom ?? ""} ${dv}`, contrat, dv);
  }
  return comptePropose(e, n);
}

/** T172 : le compte du PCCI dont n est le compte proposé (son numéro suivi de zéros), s'il en est un */
export function pcciDuPropose(n: string): string | null {
  if (n.length !== 8) return null;
  for (let k = 5; k > 0; k--) { const x = n.slice(0, k); if (FEUILLES.has(x) && x.padEnd(8, "0") === n) return x; }
  return null;
}

/** T172 : un compte du PCCI paramétré est remplacé par son compte proposé */
const parametre = (e: Etat, n: string | null | undefined) => (n && PAR_NUMERO.has(n) ? comptePropose(e, n) : n);

/** T172 : mise en service ; les paramétrages de compte passent sur les comptes de l'institution. Même liste que la fonction comptes_parametres (migration 0190). */
export function comptesParametres(e: Etat) {
  const p = <T extends object>(o: T, ...cles: (keyof T)[]) => {
    const x = o as Record<string, unknown>;
    for (const k of cles) if (typeof x[k as string] === "string") x[k as string] = parametre(e, x[k as string] as string);
  };
  e.paramOperations.forEach((x) => p(x, "compte"));
  e.paramAdhesion.forEach((x) => p(x, "compte"));
  e.produitsCredit.forEach((x) => x.frais.forEach((f) => p(f, "compte")));
  e.banques.forEach((x) => p(x, "compteLiaison"));
  e.guichets.forEach((x) => p(x, "compteGuichet", "compteLiaison", "compteSurplus", "compteManquant"));
  (e.credit.assureurs ?? []).forEach((x) => p(x, "compte"));
  e.operationsDiverses.forEach((x) => p(x, "compte"));
  e.elementsFacture.forEach((x) => p(x, "compte"));
  e.comptesBancaires.forEach((x) => p(x, "comptePenalite"));
  (e.referentiels.tiers?.tiers ?? []).forEach((x) => p(x, "compte"));
  (e.referentiels.paie?.types_avance ?? []).forEach((x) => p(x, "compte"));
  (e.referentiels.taxes?.taxes ?? []).forEach((x) => p(x, "compte"));
  (e.referentiels.immobilisations?.familles ?? []).forEach((x) => p(x, "compteAcquisition", "compteDotation", "compteAmortissement", "compteProduits", "compteChargeVcn"));
  p(e.institution, "compteHorsBilan1", "compteHorsBilan2");
}

/** Mise en service de la démonstration : les lignes de reprise et les paramétrages passent sur les comptes de l'institution */
export function miseEnService(e: Etat): Etat {
  e.ecritures = e.ecritures.map((x) => ({ ...x, lignes: x.lignes.map((l) => ({ ...l, compte: compteEcriture(e, l.compte, l.contrat, l.devise) ?? l.compte })) }));
  comptesParametres(e);
  return e;
}
