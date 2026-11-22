// S57 : Banque > Visa puis Banque > Validation (manuel Microfina++, p. 65 à 67) : quatre listes, vues au visa puis à la validation.
// Enc./Déc., Banque vers Caisse, Banque vers Banque, Virement / Prélèvement. Une flèche par ligne ; la comptabilisation vient ensuite (S111).
import { useState } from "react";
import { api, type EtapeVisaBanque, type LigneVisaBanque, type ListeVisaBanque } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { montant } from "@design/montant.js";
import { ChampDate, Chargement, Dialogue, Textes, type Boite, Paginee } from "../composants";

const LISTES: { id: ListeVisaBanque; libelle: string; viser: string; valider: string }[] = [
  { id: "enc_dec", libelle: "Encaissement Décaissement", viser: "Viser Encaissement Décaissement", valider: "Validation Encaissement Décaissement" },
  { id: "banque_caisse", libelle: "Virement Banque vers Caisse", viser: "Viser Virement Banque vers Caisse", valider: "Validation Virement Banque vers Caisse" },
  { id: "banque_banque", libelle: "Virement Banque Vers Banque", viser: "Viser Virement Banque Vers Banque", valider: "Validation Virement Banque Vers Banque" },
  { id: "virement", libelle: "Virement / Prélèvement", viser: "Viser Prélèvement/Virement", valider: "Validation prélèvement virement" },
];

export default function VisaBanque() {
  const [etape, setEtape] = useState<EtapeVisaBanque>("visa");
  const [liste, setListe] = useState(0);
  const [date, setDate] = useState("");
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const l = LISTES[liste]!;
  const { donnees } = useDonnees(() => api.banqueOperations.visas(etape, l.id), [etape, l.id, relu]);
  const { donnees: ctx } = useDonnees(() => api.banqueOperations.lire());
  if (!donnees || !ctx) return <Chargement />;
  const lignes = donnees as LigneVisaBanque[];
  const dateOp = date || ctx.date;
  const verbe = etape === "visa" ? "viser" : "valider";
  const agir = (x: LigneVisaBanque) => setBoite({ type: "confirmation", message: `Voulez-vous vraiment ${verbe} ?`, oui: async () => {
    try { await api.banqueOperations.suivre(x.id, etape, etape === "validation" ? { date: dateOp } : {}); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (e) { setBoite({ type: "erreur", message: message(e) }); }
  } });
  const m = (x: LigneVisaBanque) => montant(x.montant, x.devise);
  const colonnes: [string, (x: LigneVisaBanque) => React.ReactNode][] = l.id === "enc_dec"
    ? [["Date opération", (x) => fr(x.date)], ["Opération", (x) => x.operation], ["Montant", m], ["Banque", (x) => x.banque], ["Compte Banque", (x) => x.compteBanque],
       ["Numéro comptable", (x) => x.numeroComptable], ["Libellé", (x) => x.libelle]]
    : l.id === "banque_caisse"
    ? [["Date opération", (x) => fr(x.date)], ["Montant", m], ["Banque", (x) => x.banque], ["Compte Banque", (x) => x.compteBanque], ["Libellé", (x) => x.libelle]]
    : l.id === "banque_banque"
    ? [["Date opération", (x) => fr(x.date)], ["Montant", m], ["Banque Origine", (x) => x.banque], ["Compte Banque Origine", (x) => x.compteBanque],
       ["Banque Destinataire", (x) => x.banqueDest], ["Compte Banque Destinataire", (x) => x.compteBanqueDest]]
    : [["Date opération", (x) => fr(x.date)], ["Compte epargne", (x) => x.compteEpargne], ["Numéro comptable", (x) => x.numeroComptable], ["Libellé de l'opération", (x) => x.libelle],
       ["Débit", (x) => (x.debit ? montant(x.debit, x.devise) : "")], ["Crédit", (x) => (x.credit ? montant(x.credit, x.devise) : "")]];
  const titre = etape === "visa" ? l.viser : l.valider;

  return (
    <>
      <h1>{titre}</h1>
      <div className="onglets" role="tablist" aria-label="Étape">
        {(["visa", "validation"] as const).map((e) => <button key={e} type="button" role="tab" aria-selected={e === etape} onClick={() => { setEtape(e); setDate(""); }}>{e === "visa" ? "Visa" : "Validation"}</button>)}
      </div>
      <div className="onglets" role="tablist" aria-label={etape === "visa" ? "Visa" : "Validation"}>
        {LISTES.map((o, i) => <button key={o.id} type="button" role="tab" id={`liste-${i}`} aria-controls="volet" aria-selected={i === liste} onClick={() => setListe(i)}>{o.libelle}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`liste-${liste}`}>
        {etape === "validation" && l.id !== "virement" && (
          <div className="entete-ecran">
            <ChampDate libelle="Date opération : *" valeur={dateOp} onChange={setDate} requis />
          </div>
        )}
        <Paginee lignes={lignes}>{(visibles) => (<table className="grille">
          <thead><tr><th scope="col"><span className="sr-only">{etape === "visa" ? "Viser" : "Valider"}</span></th>{colonnes.map(([c]) => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={colonnes.length + 1}>{l.id === "virement" && etape === "validation" ? "Aucune ligne." : "Aucune ligne."}</td></tr>}
            {visibles.map((x) => (
              <tr key={x.id}>
                <td><button className="bouton secondaire" type="button" aria-label={`${etape === "visa" ? "Viser" : "Valider"} ${x.libelle}`} title={etape === "visa" ? "Viser" : "Valider"} onClick={() => agir(x)}>↑</button></td>
                {colonnes.map(([c, f]) => <td key={c} className={c === "Montant" || c === "Débit" || c === "Crédit" ? "montant chiffres" : undefined}>{f(x)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 65 à 67 : Banque > Visa et Banque > Validation, quatre listes chacune (Encaissement Décaissement, Virement Banque vers Caisse, Virement Banque Vers Banque, Virement / Prélèvement) ; flèche de visa en première colonne",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Chaîne de l'opération : saisie (S52, S53, S56), visée, validée ici, comptabilisée (S111) ; PCCI § 3.3 et 3.4 : le numéro de pièce vient à la comptabilisation",
          "Instr. BCC 008, art. 66 : séparation des tâches ; ARCHITECTURE P7 : celui qui saisit ne vise pas, celui qui a visé ne valide pas"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
