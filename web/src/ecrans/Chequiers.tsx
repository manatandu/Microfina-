// S60 : Banque > Gestion Chèque Institution > Générer chéquier (manuel Microfina++, p. 69, capture « Numéro Chequier »).
// Le chéquier remis par la banque pour un compte de l'institution ; ses chèques alimentent la liste « N° de chèque » de S52 (registre S60-1 à S60-4).
// « Chèque pour crédit » : l'onglet ne marche pas dans le manuel (p. 70) ; il viendra avec le déblocage de crédit par banque (S54).
import { useState } from "react";
import { api, FEUILLETS } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { Champ, Chargement, Dialogue, Lecture, Textes, type Boite } from "../composants";
import { ChoixBanque } from "./OperationsBanque";

const VIDE = { banque: "", compte: "", nb: "", debut: "", barre: null as boolean | null, vise: null as boolean | null, certifie: null as boolean | null };

function OuiNon({ libelle, valeur, onChange }: { libelle: string; valeur: boolean | null; onChange: (v: boolean) => void }) {
  const nom = `type-${libelle}`;
  return (
    <div className="ligne-champ" role="radiogroup" aria-label={libelle.replace(" *", "")}>
      <span>{libelle}</span>
      <label className="case"><input type="radio" name={nom} checked={valeur === true} onChange={() => onChange(true)} /><span>Oui</span></label>
      <label className="case"><input type="radio" name={nom} checked={valeur === false} onChange={() => onChange(false)} /><span>Non</span></label>
    </div>
  );
}

export function Chequiers() {
  const { donnees: lu } = useDonnees(() => api.banqueOperations.lire());
  const [f, setF] = useState(VIDE);
  const [cle, setCle] = useState(nouvelleCle);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!lu) return <Chargement />;
  const maj = (p: Partial<typeof VIDE>) => setF((x) => ({ ...x, ...p }));
  const debut = f.debut.trim();
  const fin = /^\d{1,8}$/.test(debut) && f.nb ? String(Number(debut) + Number(f.nb) - 1).padStart(debut.length, "0") : "";

  function generer() {
    const d = { cle, compteBancaireId: f.compte ? Number(f.compte) : undefined, nbFeuillets: f.nb ? Number(f.nb) : undefined, debut,
      barre: f.barre ?? undefined, vise: f.vise, certifie: f.certifie };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment générer ?", oui: async () => {
      try { await api.chequiers.generer(d); setF(VIDE); setCle(nouvelleCle()); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <h1>Numéro Chequier</h1>
      <section className="bloc pile" aria-label="Numéro Chequier">
        <div className="grille-deux">
          <div className="pile">
            <ChoixBanque lu={lu} libelleBanque="Banque *" libelleCompte="Compte *" banque={f.banque} compte={f.compte}
              onBanque={(v) => maj({ banque: v, compte: "" })} onCompte={(v) => maj({ compte: v })} />
            <Champ libelle="Nb.Feuillet *">{(p) => <select {...p} className="saisie" value={f.nb} onChange={(e) => maj({ nb: e.target.value })}>
              <option value=""></option>{FEUILLETS.map((n) => <option key={n} value={n}>{n}</option>)}</select>}</Champ>
            <div className="ligne-champ">
              <Champ libelle="Début *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" maxLength={8} value={f.debut}
                onChange={(e) => { if (/^\d{0,8}$/.test(e.target.value)) maj({ debut: e.target.value }); }} />}</Champ>
              <Champ libelle="Fin">{(p) => <Lecture {...p} value={fin} />}</Champ>
            </div>
          </div>
          <fieldset className="pile cadre-champs">
            <legend>Type Cheque :</legend>
            <OuiNon libelle="Barré *" valeur={f.barre} onChange={(v) => maj({ barre: v })} />
            <OuiNon libelle="Visé" valeur={f.vise} onChange={(v) => maj({ vise: v })} />
            <OuiNon libelle="Certifié" valeur={f.certifie} onChange={(v) => maj({ certifie: v })} />
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={generer}>Generer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 69 : capture « Numéro Chequier » (Banque*, Compte*, Nb.Feuillet*, Début*, Fin, Type Cheque : Barré*, Visé, Certifié, Generer) ; p. 70 : « Chèque pour crédit », l'onglet ne marche pas",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 25 (normalisation du chèque), § 3.2 : numéro du chèque sur 8 caractères, code de type de chèque ; § 3.1 : barrement par deux barres parallèles",
          "Les chèques générés alimentent la liste « N° de chèque » de Banque > Opération (S52) ; un chèque ne sert qu'une fois"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
