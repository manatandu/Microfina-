import { useState } from "react";
import { api, type CompteModele } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

type Degre = { rang: number; libelle: string; taux: number; debut: number; fin: number };
type Terme = { rang: number; libelle: string; debut: number; fin: number };

/** S26 : Produits > Crédits > Modèle pour crédit (manuel Microfina++, p. 40). Degrés : Instr. BCC 003 ; termes : PCCI classe 3 (S21-1, S21-2). */
export default function ModeleCredit() {
  const [libelle, setLibelle] = useState("");
  const [comptes, setComptes] = useState<CompteModele[] | null>(null);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.modeles.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const matrice = comptes ?? (donnees.defauts as CompteModele[]);
  const effacer = () => { setLibelle(""); setComptes(null); setChoisi(null); };
  async function ouvrir(id: number) {
    try { const m = await api.modeles.lireModele(id); setChoisi(id); setLibelle(m.libelle); setComptes(m.comptes); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <section className="bloc pile" aria-label="Modèle pour crédit">
        <div className="ligne-champ"><Champ libelle="Libellé : *">{(p) => <input {...p} className="saisie" value={libelle} onChange={(e) => setLibelle(e.target.value)} />}</Champ></div>
        {/* Les 21 combinaisons classe et terme dans un seul tableau, modifiable sur place ; « Compte interne », jamais lu, n'est plus demandé (plan d'allègement, point 2.15) */}
        <div className="defile-x"><table className="grille" aria-label="Comptes par classe et par terme">
          <thead><tr><th scope="col">Classe (Instr. BCC 003)</th><th scope="col">Terme (PCCI)</th><th scope="col">Compte capital</th><th scope="col">Compte intérêt</th></tr></thead>
          <tbody>{(donnees.degres as Degre[]).flatMap((d) => (donnees.termes as Terme[]).map((t) => {
            const c = matrice.find((x) => x.degre === d.rang && x.terme === t.rang);
            const changer = (k: "compteCapital" | "compteInteret", v: string) => setComptes(matrice.map((x) => (x.degre === d.rang && x.terme === t.rang ? { ...x, [k]: v } : x)));
            return <tr key={`${d.rang}-${t.rang}`}><td>{d.libelle}</td><td>{t.libelle}</td>
              <td><input className="saisie code" aria-label={`Compte capital : ${d.libelle}, ${t.libelle}`} value={c?.compteCapital ?? ""} onChange={(e) => changer("compteCapital", e.target.value)} /></td>
              <td><input className="saisie code" aria-label={`Compte intérêt : ${d.libelle}, ${t.libelle}`} value={c?.compteInteret ?? ""} onChange={(e) => changer("compteInteret", e.target.value)} /></td></tr>;
          }))}</tbody>
        </table></div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
            () => api.modeles.enregistrer({ libelle, comptes: matrice }, choisi ?? undefined))}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null}
            onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.modeles.supprimer(choisi))}>Supprimer</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Libellé model</th></tr></thead>
          <tbody>
            {donnees.modeles.length === 0 && <tr><td>Aucune ligne.</td></tr>}
            {(donnees.modeles as { id: number; libelle: string }[]).map((m) => (
              <tr key={m.id} className="ligne-choix" tabIndex={0} aria-selected={m.id === choisi} onClick={() => ouvrir(m.id)} onKeyDown={(e) => { if (e.key === "Enter") void ouvrir(m.id); }}><td>{m.libelle}</td></tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 40 : « Remplir les champs Libellé (obligatoire), Compte capital, Compte interne, compte intérêt et [Enregistrer] » ; capture : Dégré, Terme, Libellé model",
          "Instr. BCC n°003 du 14/04/2012, art. 12 : tranches de retard (degrés de S21)",
          "PCCI, classe 3 : crédits à court, moyen et long terme (32, 31, 30) ; compte 390 (crédits en retard de 1 à 30, 31 à 60, 61 à 90, 91 à 180, 181 jours et plus) ; classe 7 : 710 à 712 (intérêts), 717 (intérêts sur crédits en retard)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
