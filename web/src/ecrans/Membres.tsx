import { useState } from "react";
import { api, type NouveauTiers } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Attention, Bloquant, Champ, Chargement, Textes, ChampDate } from "../composants";
import { mots } from "../lib/vocabulaire";

const VIDE: NouveauTiers = { nom: "", postnom: "", prenom: "", sexe: "", naissance: "", pieceType: "", pieceNumero: "", pieceExpire: "", adresse: "", telephone: "", personneExposee: false };

/** S37 : enrôlement d'une personne physique. Le visa (S40) vient d'une autre personne. */
export function Enrolement() {
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [d, setD] = useState<NouveauTiers>(VIDE);
  const [erreur, setErreur] = useState("");
  const [cree, setCree] = useState<Tiers | null>(null);
  if (!ctx) return <Chargement />;
  const m = mots(ctx.institution);
  const champ = <K extends keyof NouveauTiers>(k: K) => ({ value: d[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value }) });

  if (cree) return (
    <>
      <h1>Enrôlement</h1>
      <p className="resultat-ok"><strong>{[cree.nom, cree.postnom, cree.prenom].filter(Boolean).join(" ")}</strong> est enregistré sous le numéro <span className="chiffres">{cree.numero}</span>. Le chef d'agence doit le viser avant l'adhésion au guichet.</p>
      <Attention>Photo et specimen de signature : capture pas encore branchée. Sans specimen, aucun retrait ne sera payé.</Attention>
      <div><button className="bouton secondaire" type="button" onClick={() => { setCree(null); setD(VIDE); }}>Enrôler un autre {m.membre}</button></div>
    </>
  );

  return (
    <>
      <h1>Enrôler un {m.membre}</h1>
      <p className="chapeau">Personne physique. Les champs marqués d'un astérisque sont exigés ; la liste complète reste à confirmer.</p>
      <form className="bloc pile" onSubmit={async (e) => { e.preventDefault(); setErreur(""); try { setCree(await api.tiers.creer(d)); } catch (x) { setErreur(message(x)); } }}>
        <fieldset className="formulaire choix">
          <legend>Identité</legend>
          <Champ libelle="Nom *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...champ("nom")} />}</Champ>
          <Champ libelle="Post-nom">{(p) => <input {...p} className="saisie" autoComplete="off" {...champ("postnom")} />}</Champ>
          <Champ libelle="Prénom">{(p) => <input {...p} className="saisie" autoComplete="off" {...champ("prenom")} />}</Champ>
          <Champ libelle="Sexe">{(p) => <select {...p} className="saisie" {...champ("sexe")}><option value="">Non renseigné</option><option value="F">Femme</option><option value="M">Homme</option></select>}</Champ>
          <ChampDate libelle="Date de naissance" valeur={d.naissance} onChange={(v) => setD({ ...d, naissance: v })} />
        </fieldset>
        <fieldset className="formulaire choix">
          <legend>Pièce d'identité</legend>
          <Champ libelle="Type de pièce *">{(p) => <select {...p} className="saisie" required {...champ("pieceType")}><option value="">Choisir</option><option>Carte d'électeur</option><option>Passeport</option><option>Permis de conduire</option><option>Autre pièce officielle</option></select>}</Champ>
          <Champ libelle="Numéro *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...champ("pieceNumero")} />}</Champ>
          <ChampDate libelle="Expire le" valeur={d.pieceExpire} onChange={(v) => setD({ ...d, pieceExpire: v })} />
        </fieldset>
        <fieldset className="formulaire choix">
          <legend>Coordonnées</legend>
          <Champ libelle="Adresse">{(p) => <input {...p} className="saisie" autoComplete="off" {...champ("adresse")} />}</Champ>
          <Champ libelle="Téléphone">{(p) => <input {...p} className="saisie code" inputMode="tel" autoComplete="off" {...champ("telephone")} />}</Champ>
        </fieldset>
        <label className="case"><input type="checkbox" checked={d.personneExposee} onChange={(e) => setD({ ...d, personneExposee: e.target.checked })} /><span>Personne politiquement exposée</span></label>
        <Bloquant>{erreur}</Bloquant>
        <div><button className="bouton" type="submit">Enregistrer, à viser</button></div>
        <Textes sources={["Instr. BCC 15, art. 10 et 11 : éléments d'identification (liste des champs exigés à confirmer)", "Instr. BCC 15, art. 60 : personnes politiquement exposées", "ARCHITECTURE P7 : enrôlement et visa par deux personnes"]} />
      </form>
    </>
  );
}
