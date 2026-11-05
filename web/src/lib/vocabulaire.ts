// DESIGN § 2.10 : les mots suivent le profil réglementaire de l'institution.
// COOPEC : membres et parts sociales (loi 002/2002). IMF : clients et actionnaires.
import type { Institution } from "../donnees/types";

const MOTS = {
  coopec: { membre: "membre", membres: "Membres", Membre: "Membre" },
  imf: { membre: "client", membres: "Clients", Membre: "Client" },
} as const;

export function mots(i: Pick<Institution, "profil">) { return MOTS[i.profil]; }
