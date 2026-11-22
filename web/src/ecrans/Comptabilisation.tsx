// S111 : Comptabilité > Comptabilisation (manuel Microfina++, p. 130, capture « Comptabilisation d'écriture comptable » ; reprise p. 155) : case Recherche
// avancée, liste Journée non comptabilisée, bouton Comptabiliser, grille Date opération, N°Pièce, N° Compte, Débit, Crédit, Référence écriture, Intitulé ;
// confirmation « Êtes-vous sûre de vouloir effectuer cette opération? ». Registre S111-1 à S111-5, T13, T14.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { montant, type Devise } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Paginee, Textes, type Boite } from "../composants";

export default function Comptabilisation() {
  const [choisie, setChoisie] = useState<number | null>(null);
  const [relu, setRelu] = useState(0);
  const [avancee, setAvancee] = useState(false);
  const [filtres, setFiltres] = useState({ piece: "", compte: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const attente = (await api.journees.liste()).filter((x) => x.statut !== "fermee").sort((a, b) => a.date.localeCompare(b.date));
    const j = attente.find((x) => x.id === choisie) ?? attente[0] ?? null;
    return { attente, j, g: j ? await api.comptabilisation.aComptabiliser(j.id) : null };
  }, [choisie, relu]);
  if (!donnees) return <Chargement />;
  const { attente, j, g } = donnees;
  const lignes = (g?.lignes ?? []).filter((l) => !avancee || (l.piece.toLowerCase().includes(filtres.piece.trim().toLowerCase()) && l.compte.startsWith(filtres.compte.trim())));
  const m = (v: number, d: string) => (v ? montant(v, d as Devise) : "");
  function comptabiliser() {
    if (!j) return;
    setBoite({ type: "confirmation", message: "Êtes-vous sûre de vouloir effectuer cette opération ?", oui: async () => {
      try { await api.comptabilisation.comptabiliser(j.id); setChoisie(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Opération effectuée avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Comptabilisation d'écriture comptable</h1>
      <section className="bloc pile" aria-label="Comptabilisation d'écriture comptable">
        <div className="barre-filtres">
          <label className="case"><input type="checkbox" checked={avancee} onChange={(e) => setAvancee(e.target.checked)} /><span>Recherche avancée</span></label>
          <Champ libelle="Journée non comptabilisée :">{(p) => <select {...p} className="saisie code" value={j?.id ?? ""} onChange={(e) => setChoisie(Number(e.target.value))}>
            {attente.length === 0 && <option value=""></option>}{attente.map((x) => <option key={x.id} value={x.id}>{fr(x.date)}</option>)}</select>}</Champ>
          {avancee && <>
            <Champ libelle="N°Pièce">{(p) => <input {...p} className="saisie code" type="search" value={filtres.piece} onChange={(e) => setFiltres({ ...filtres, piece: e.target.value })} />}</Champ>
            <Champ libelle="N° Compte">{(p) => <input {...p} className="saisie code" type="search" value={filtres.compte} onChange={(e) => setFiltres({ ...filtres, compte: e.target.value })} />}</Champ></>}
        </div>
        <div className="actions-onglets"><button className="bouton" type="button" disabled={!j} onClick={comptabiliser}>Comptabiliser</button></div>
        <Paginee lignes={lignes}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Date opération</th><th scope="col">N°Pièce</th><th scope="col">N° Compte</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th>
            <th scope="col">Référence écriture</th><th scope="col">Intitulé</th></tr></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={7}>{j ? "Aucune ligne." : "Aucune journée à comptabiliser."}</td></tr>}
            {v.map((l, i) => <tr key={i}><td className="chiffres">{fr(l.date)}</td><td className="code">{l.piece}</td><td className="code">{l.compte}</td>
              <td className="num chiffres">{m(l.debit, l.devise)}</td><td className="num chiffres">{m(l.credit, l.devise)}</td><td className="code">{l.reference}</td><td>{l.intitule}</td></tr>)}</tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 130 : 8-Comptabilisation, « Cliquer sur Comptabiliser pour effectuer l'opération » ; capture Comptabilisation d'écriture comptable (Recherche avancée, Journée non comptabilisée, Comptabiliser, confirmation) ; reprise p. 155",
          "Registre S111-2, T14 : journées comptabilisées dans l'ordre des dates ; refus tant qu'une caisse n'est pas arrêtée, qu'un billetage n'est pas validé ou qu'une opération attend son visa",
          "Registre S111-4 : la comptabilisation passe, avec leur N° de pièce, les écritures que la Banque laisse en attente (opérations validées, chèques encaissés, emprunts) : elles figurent dans la grille sans pièce ; banque vers caisse : compte 591, la caisse encaisse les fonds par un encaissement divers",
          "Registre T13 ; PCCI § 3.4 : les écritures naissent à l'opération et deviennent définitives à la comptabilisation"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
