import type { BeneficiaireVirement, DonneurOrdre } from "../donnees/types";
import { Champ } from ".";

export type Parties = { donneurOrdre: DonneurOrdre; beneficiaire: BeneficiaireVirement };
export const PARTIES_VIDES: Parties = { donneurOrdre: { nom: "", compte: "", identification: "", institution: "" }, beneficiaire: { nom: "", compte: "" } };

/** A12 (confrontation du 21/11/2026) : informations qui accompagnent un virement entre institutions (loi 22/068, art. 57 et 58 ; art. 61 pour un virement reçu).
 * recu : le donneur d'ordre ; sortant : le bénéficiaire. */
export function PartiesVirement({ valeur, maj, recu, sortant }: { valeur: Parties; maj: (p: Parties) => void; recu: boolean; sortant: boolean }) {
  const d = valeur.donneurOrdre, b = valeur.beneficiaire;
  const champ = (libelle: string, v: string, f: (x: string) => void) =>
    <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" autoComplete="off" value={v} onChange={(e) => f(e.target.value)} />}</Champ>;
  return <>
    {recu && <fieldset className="cadre-champs formulaire">
      <legend>Donneur d'ordre</legend>
      {champ("Nom complet : *", d.nom, (x) => maj({ ...valeur, donneurOrdre: { ...d, nom: x } }))}
      {champ("Numéro de compte : *", d.compte, (x) => maj({ ...valeur, donneurOrdre: { ...d, compte: x } }))}
      {champ("Adresse, n° d'identification ou date et lieu de naissance : *", d.identification, (x) => maj({ ...valeur, donneurOrdre: { ...d, identification: x } }))}
      {champ("Institution financière : *", d.institution, (x) => maj({ ...valeur, donneurOrdre: { ...d, institution: x } }))}
    </fieldset>}
    {sortant && <fieldset className="cadre-champs formulaire">
      <legend>Bénéficiaire</legend>
      {champ("Nom : *", b.nom, (x) => maj({ ...valeur, beneficiaire: { ...b, nom: x } }))}
      {champ("Numéro de compte : *", b.compte, (x) => maj({ ...valeur, beneficiaire: { ...b, compte: x } }))}
    </fieldset>}
  </>;
}
