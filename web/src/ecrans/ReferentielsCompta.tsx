// S104 : Comptabilité > Plan des comptes > Taxes (manuel Microfina++, p. 123 et 124, capture « Création et mise à jour de taxes »).
// S103 : Comptabilité > Plan des comptes > Plan des tiers (p. 123, capture « Plan Tiers » ; texte repris p. 156). Registre S104-1, S103-1 à S103-3.
import { api } from "../donnees/api";
import { Referentiels, type FacadeReferentiel } from "./Referentiels";

export function Taxes() {
  return <Referentiels facade={api.refTaxes as unknown as FacadeReferentiel} pages={["taxes"]} sources={{ taxes: [
    "Manuel Microfina++, p. 123 et 124 : 1-5 Taxes, « Saisir le code, Désignation, le taux de la taxe puis Enregistrer, Effacer en cas d'erreur ou Supprimer » ; capture Création et mise à jour de taxes (Code*, Désignation*, Taux*, Listes de taxes : Désignation, Taux %, Rafraichir)",
    "Registre S104-1 : les taxes sont saisies par l'institution ; aucune n'est créée d'avance"] }} />;
}

export function PlanTiers() {
  return <Referentiels facade={api.refTiers as unknown as FacadeReferentiel} pages={["tiers"]} sources={{ tiers: [
    "Manuel Microfina++, p. 123 : 1-3 Plan des tiers, « Renseigner toutes les informations concernant l'entreprise, le contact et la banque puis cliquez sur le bouton Enregistrer » ; capture Plan Tiers, Liste des tiers (Compte banque, Type Tiers, Intitulé, Qualité, Date création, Compte, Pays)",
    "Registre S103-1 à S103-3 : cadres Entreprise, Contact et Banque d'après le texte ; Compte : un compte du plan de comptes ; Type Tiers sert au « Type de suivi » du plan des comptes (S102-7)"] }} />;
}
