import { useState } from "react";
import type { Adresse } from "../donnees/types";
import type { ArbreLieux } from "../donnees/api";
import { message } from "../lib/useDonnees";
import { Champ } from ".";

const PAYS_DEFAUT = "République démocratique du Congo";

/** L'adresse écrite, lue par les contrats et les documents : « N° 12, avenue Kasa-Vubu, quartier Kinsaku, Matete, Kinshasa » (mêmes règles que noyau/adresse.py) */
export function composerAdresse(a: Adresse): string {
  const m = [a.numeroRue ? `N° ${a.numeroRue}` : "", a.rue ? `avenue ${a.rue}` : "", a.quartier ? `quartier ${a.quartier}` : "", a.commune ?? "",
    a.ville && a.ville !== a.commune ? a.ville : ""];
  return m.filter(Boolean).join(", ");
}

/** Une seule adresse, la même partout (décision du porteur du 21/11/2026, registre T41) : Province, Ville ou territoire, Commune, secteur ou chefferie,
 * Quartier ou groupement (Localisation, S20), puis Avenue et N°. Chaque liste ne montre que ce qui est dans le choix précédent. Un quartier absent
 * s'ajoute ici et rejoint la Localisation. Chaque changement rend aussi l'adresse écrite (« adresse »). */
export function BlocAdresse({ valeur, maj, arbre, requis, ajouterQuartier }: {
  valeur: Adresse; maj: (p: Adresse & { adresse: string }) => void; arbre: ArbreLieux; requis?: boolean;
  ajouterQuartier?: (d: Adresse & { nom: string }) => Promise<{ arbre: ArbreLieux }>;
}) {
  const [arbreAjour, setArbreAjour] = useState<ArbreLieux | null>(null);
  const [nouveau, setNouveau] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const a = arbreAjour ?? arbre;
  const v: Adresse = { ...valeur, pays: valeur.pays || (a.length === 1 ? a[0]!.pays : PAYS_DEFAUT) };
  const pays = a.find((p) => p.pays === v.pays);
  const province = pays?.provinces.find((p) => p.province === v.province);
  const ville = province?.villes.find((x) => x.ville === v.ville);
  const commune = ville?.communes.find((x) => x.commune === v.commune);
  const changer = (p: Adresse) => { const n = { ...v, ...p }; maj({ ...n, adresse: composerAdresse(n) }); };
  const etoile = requis ? " *" : "";
  // Sous une commune, un quartier ; sous un secteur ou une chefferie, un groupement (Décret 22/07, art. 9, point 26)
  const quoiQuartier = commune && !commune.natures.includes("Commune") ? "groupement" : "quartier";
  const groupes = <T extends { natures: string[] }>(liste: T[], ordre: string[], cle: (x: T) => string) => ordre.map((nat) => {
    const l = liste.filter((x) => (x.natures[0] ?? ordre[0]) === nat);
    return l.length ? <optgroup key={nat} label={nat === "Chefferie" ? "Chefferies" : `${nat}s`}>{l.map((x) => <option key={cle(x)}>{cle(x)}</option>)}</optgroup> : null;
  });
  const ajouter = async () => {
    if (!ajouterQuartier || !nouveau?.trim()) return;
    try {
      const r = await ajouterQuartier({ pays: v.pays, province: v.province, ville: v.ville, commune: v.commune, nom: nouveau.trim() });
      setArbreAjour(r.arbre); changer({ quartier: nouveau.trim() }); setNouveau(null); setErreur("");
    } catch (x) { setErreur(message(x)); }
  };
  return (
    <>
      {a.length > 1 && <Champ libelle={`Pays${etoile}`}>{(p) => <select {...p} className="saisie" value={v.pays} onChange={(e) =>
        changer({ pays: e.target.value, province: "", ville: "", commune: "", quartier: "" })}>{a.map((x) => <option key={x.pays}>{x.pays}</option>)}</select>}</Champ>}
      <Champ libelle={`Province :${etoile}`}>{(p) => <select {...p} className="saisie" value={v.province ?? ""} onChange={(e) =>
        changer({ province: e.target.value, ville: "", commune: "", quartier: "" })}><option value=""></option>
        {(pays?.provinces ?? []).map((x) => <option key={x.province}>{x.province}</option>)}</select>}</Champ>
      <Champ libelle={`Ville ou territoire :${etoile}`}>{(p) => <select {...p} className="saisie" value={v.ville ?? ""} disabled={!province} onChange={(e) =>
        changer({ ville: e.target.value, commune: "", quartier: "" })}><option value=""></option>
        {groupes(province?.villes ?? [], ["Ville", "Territoire"], (x) => x.ville)}</select>}</Champ>
      <Champ libelle={`Commune, secteur ou chefferie :${etoile}`}>{(p) => <select {...p} className="saisie" value={v.commune ?? ""} disabled={!ville} onChange={(e) =>
        changer({ commune: e.target.value, quartier: "" })}><option value=""></option>
        {groupes(ville?.communes ?? [], ["Commune", "Secteur", "Chefferie"], (x) => x.commune)}</select>}</Champ>
      <Champ libelle={`Quartier ou groupement :${etoile}`} erreur={erreur || undefined}>{(p) => <div className="ligne-champ">
        <select {...p} className="saisie" value={v.quartier ?? ""} disabled={!commune} onChange={(e) => changer({ quartier: e.target.value })}>
          <option value=""></option>{(commune?.quartiers ?? []).map((q) => <option key={q}>{q}</option>)}</select>
        {ajouterQuartier && commune && nouveau === null && <button className="bouton secondaire" type="button" onClick={() => setNouveau("")}>Ajouter un {quoiQuartier}</button>}
      </div>}</Champ>
      {nouveau !== null && <Champ libelle={`Nouveau ${quoiQuartier} :`}>{(p) => <div className="ligne-champ">
        <input {...p} className="saisie" autoComplete="off" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
        <button className="bouton" type="button" onClick={ajouter}>Ajouter</button>
        <button className="bouton secondaire" type="button" onClick={() => { setNouveau(null); setErreur(""); }}>Annuler</button>
      </div>}</Champ>}
      <Champ libelle="Avenue :">{(p) => <input {...p} className="saisie" autoComplete="off" value={v.rue ?? ""} onChange={(e) => changer({ rue: e.target.value })} />}</Champ>
      <Champ libelle="N° :">{(p) => <input {...p} className="saisie code" autoComplete="off" value={v.numeroRue ?? ""} onChange={(e) => changer({ numeroRue: e.target.value })} />}</Champ>
    </>
  );
}
