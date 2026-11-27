// S120 : Comptabilité > Grand livre, général et analytique (manuel Microfina++, p. 138 et 139, captures « Edition du grand livre » et « Edition du grand
// livre analytique »). S121 : Comptabilité > Balance, générale et analytique (p. 139 et 140, captures « Edition de la balance des comptes » et « Edition de
// la balance analytique des comptes »). Registre S120-1 à S120-4, S121-1 à S121-4, T13 : écritures définitives seulement, montants en CDF.
// Registre T246 (demande du porteur, 27/11/2026) : ni l'un ni l'autre ne s'affiche à l'écran ; ils sortent en Excel, avec les filtres.
import { enClair } from "../lib/enclair";
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, aujourdhui, heureDe } from "../lib/dates";
import { balanceClasseur, grandLivreClasseur, telecharger, type CompteGrandLivre } from "../lib/liasse";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite, Recherche } from "../composants";

type Ctx = Awaited<ReturnType<typeof api.etatsCompta.contexte>>;

/** En-tête des documents comptables (modèles FPM et CARRIGRES) : institution, période, date de tirage (registre T31) */
async function enteteDoc(du: string, au: string) {
  const ctx = await api.referentiel.contexte();
  return { institution: ctx.institution.nom, du, au, tirage: `${fr(aujourdhui())} ${heureDe().slice(0, 5)}` };   // heure de l'agence (point 11.4)
}
const versGl = (c: { compte: string; intitule: string; soldeInitial: number; lignes: { date: string; journal: string; piece: string; libelle: string; debit: number; credit: number }[] }): CompteGrandLivre =>
  ({ compte: c.compte, intitule: c.intitule, soldeInitial: c.soldeInitial, lignes: c.lignes.map(({ date, journal, piece, libelle, debit, credit }) => ({ date, journal, piece, libelle, debit, credit })) });

function useCadre() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.etatsCompta.contexte(), j: await api.journees.courante() }));
  return donnees;
}
/** Plan d'allègement 7.12 : les onglets Général et Analytique deviennent un champ, montré seulement si l'analytique est tenue */
function Plan({ ctx, valeur, changer }: { ctx: Ctx; valeur: string; changer: (v: string) => void }) {
  if (!ctx.analytique) return null;
  return <Champ libelle="Plan :">{(p) => <select {...p} className="saisie" value={valeur} onChange={(e) => changer(e.target.value)}>
    <option value="general">Général</option><option value="analytique">Analytique</option></select>}</Champ>;
}
function Communs({ ctx, f, setF }: { ctx: Ctx; f: { agence: string; exercice: string }; setF: (x: { agence: string; exercice: string }) => void }) {
  return <>
    {ctx.agences.length > 1 && <Champ libelle="Agence :">{(p) => <select {...p} className="saisie" value={f.agence} onChange={(e) => setF({ ...f, agence: e.target.value })}><option value="">Toutes les agences</option>
      {ctx.agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
  </>;
}

export function GrandLivre() {
  const cadre = useCadre();
  if (!cadre) return <Chargement />;
  return <EditionGrandLivre ctx={cadre.ctx} jour={cadre.j?.date ?? aujourdhui()} />;
}

function EditionGrandLivre({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const vide = { plan: "general", type: "global", agence: "", exercice: jour.slice(0, 4), du: `${jour.slice(0, 4)}-01-01`, au: jour, vidage: false };
  const [f, setF] = useState(vide);
  const [boite, setBoite] = useState<Boite | null>(null);
  const titre = "Edition du grand livre";
  // Registre T246 (demande du porteur, 27/11/2026) : le grand livre ne s'affiche plus à l'écran ; il sort en Excel, avec les filtres.
  // Général : modèle CARRIGRES ; analytique : grand-livre des tiers (modèle FPM, un bloc et un total par tiers) ; registre T31
  async function exporter() {
    try {
      const analytique = f.plan === "analytique";
      const r = await api.etatsCompta.grandLivre({ type: f.type, agenceId: f.agence ? Number(f.agence) : null, exercice: f.du.slice(0, 4), du: f.du, au: f.au, vidage: f.vidage }, analytique);
      if (r.comptes.length === 0) { setBoite({ type: "erreur", message: "Aucune écriture comptabilisée sur la période." }); return; }
      telecharger(`${analytique ? "grand-livre-des-tiers" : "grand-livre"}-${r.au}`, grandLivreClasseur(await enteteDoc(r.du, r.au),
        r.comptes.map((c) => versGl(analytique ? { ...c, intitule: `${c.auxiliaire || "sans tiers"} (${c.compte} ${c.intitule})` } : c)), analytique));
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  return (
    <section className="bloc pile" aria-label={titre}>
      <h2>{titre}</h2>
      <Recherche className="pile" label="Critères" envoyer={exporter}>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Critères</legend>
        <Plan ctx={ctx} valeur={f.plan} changer={(v) => setF({ ...f, plan: v })} />
        <Champ libelle="Type de grand livre">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {ctx.typesGrandLivre.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
        <Communs ctx={ctx} f={f} setF={(x) => setF({ ...f, ...x })} />
        <ChampDate libelle="Date début :" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
        <ChampDate libelle="Date fin :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
        <label className="case"><input type="checkbox" checked={f.vidage} onChange={(e) => setF({ ...f, vidage: e.target.checked })} /><span>Avec les écritures de clôture</span></label>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="submit">Exporter</button>
        <button className="bouton secondaire" type="button" onClick={() => setF(vide)}>Annuler</button>
      </div></Recherche>
      <Textes sources={["Manuel Microfina++, p. 138 et 139 : 17-1 General et 17-2 Analytique, « Rentrer le type de grand livre, l'Agence, Exercice, Date début, Date fin puis cliquer sur Recherche ou Annuler » ; captures « Edition du grand livre » et « Edition du grand livre analytique » ; plan d'allègement 7.12 : un formulaire, « Plan » montré si l'analytique est tenue",
        "Registre S120-1 à S120-4, T13 : écritures définitives (journées comptabilisées), en CDF ; par compte, solde d'ouverture, lignes, total et solde ; « avec vidage » ajoute les écritures de clôture des comptes de gestion ; analytique : détail par compte auxiliaire",
        "PCCI § 3.2 et § 3.3 : comptabilité tenue en monnaie nationale ; livre-journal, grand livre, balance",
        "Registre T246 (demande du porteur, 27/11/2026) : le grand livre ne s'affiche plus à l'écran ; Exporter sort le classeur Excel, filtres posés sur la ligne des en-têtes"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

export function BalanceComptes() {
  const cadre = useCadre();
  if (!cadre) return <Chargement />;
  return <EditionBalance ctx={cadre.ctx} jour={cadre.j?.date ?? aujourdhui()} />;
}

function EditionBalance({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const vide = { plan: "general", type: "8", balance: "groupee", agence: "", exercice: jour.slice(0, 4), du: `${jour.slice(0, 4)}-01-01`, au: jour, compteDe: "1", compteA: "99000000", niveau: "1", sansVidage: false };
  const [f, setF] = useState(vide);
  const [boite, setBoite] = useState<Boite | null>(null);
  const titre = "Edition de la balance des comptes";
  const criteresGl = () => ({ type: "global", agenceId: f.agence ? Number(f.agence) : null, exercice: f.du.slice(0, 4), du: f.du, au: f.au, vidage: !f.sansVidage });
  // Registre T246 (demande du porteur, 27/11/2026) : la balance ne s'affiche plus à l'écran ; elle sort en Excel, avec les filtres
  async function exporter() {
    try {
      const analytique = f.plan === "analytique";
      const r = await api.etatsCompta.balance({ type: f.type, balance: f.balance, agenceId: f.agence ? Number(f.agence) : null, exercice: f.du.slice(0, 4), du: f.du, au: f.au, compteDe: f.compteDe, compteA: f.compteA,
        niveau: f.niveau, sansVidage: f.sansVidage }, analytique);
      if (r.lignes.length === 0) { setBoite({ type: "erreur", message: "Aucune écriture comptabilisée sur la période." }); return; }
      if (analytique) {      // balance des tiers (modèle FPM) : une ligne par tiers et par compte, « Total général » (registre T31)
        telecharger(`balance-des-tiers-${r.au}`, balanceClasseur(await enteteDoc(r.du, r.au), r.lignes.map((x) => ({ compte: x.auxiliaire || x.compte, intitule: `${x.intitule} (${x.compte})`,
          anterieurD: x.ouvertureDebit, anterieurC: x.ouvertureCredit, mouvementD: x.mouvementDebit, mouvementC: x.mouvementCredit, soldeD: x.soldeDebit, soldeC: x.soldeCredit })), [], true));
        return;
      }
      const gl = await api.etatsCompta.grandLivre(criteresGl());
      telecharger(`balance-${r.au}`, balanceClasseur(await enteteDoc(r.du, r.au), r.lignes.map((x) => ({ compte: x.compte, intitule: x.intitule, anterieurD: x.ouvertureDebit, anterieurC: x.ouvertureCredit,
        mouvementD: x.mouvementDebit, mouvementC: x.mouvementCredit, soldeD: x.soldeDebit, soldeC: x.soldeCredit })), gl.comptes.map(versGl)));
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  return (
    <section className="bloc pile" aria-label={titre}>
      <h2>{titre}</h2>
      <Recherche className="pile" label="Critères" envoyer={exporter}>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Critères</legend>
        <Plan ctx={ctx} valeur={f.plan} changer={(v) => setF({ ...f, plan: v })} />
        <Champ libelle="Type de balance :">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {ctx.typesBalance.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Balance :">{(p) => <select {...p} className="saisie" value={f.balance} onChange={(e) => setF({ ...f, balance: e.target.value })}>
          <option value="groupee">Groupée</option><option value="detaillee">Détaillée</option></select>}</Champ>
        <Communs ctx={ctx} f={f} setF={(x) => setF({ ...f, ...x })} />
        <ChampDate libelle="Date début période :" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
        <ChampDate libelle="Date fin période :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
        <Champ libelle="Du compte :">{(p) => <input {...p} className="saisie code" inputMode="numeric" value={f.compteDe} onChange={(e) => setF({ ...f, compteDe: e.target.value })} />}</Champ>
        <Champ libelle="Au compte :">{(p) => <input {...p} className="saisie code" inputMode="numeric" value={f.compteA} onChange={(e) => setF({ ...f, compteA: e.target.value })} />}</Champ>
        <Champ libelle="Niveau de rupture :">{(p) => <select {...p} className="saisie court" value={f.niveau} onChange={(e) => setF({ ...f, niveau: e.target.value })}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{enClair(n)}</option>)}</select>}</Champ>
        <label className="case"><input type="checkbox" checked={f.sansVidage} onChange={(e) => setF({ ...f, sansVidage: e.target.checked })} /><span>Sans les écritures de clôture</span></label>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="submit">Exporter</button>
        <button className="bouton secondaire" type="button" onClick={() => setF(vide)}>Effacer les critères</button>
      </div></Recherche>
      <Textes sources={["Manuel Microfina++, p. 139 et 140 : 18-1 Générale et 18-2 Analytique ; captures « Edition de la balance des comptes » et « Edition de la balance analytique des comptes » (Type de balance, Balance, Agence, Exercice, Date début période, Date fin période, Compte … à …, Niveau de rupture, Balance sans VIDAGE, Rechercher, Rein. les champs)",
        "Registre S121-1 à S121-4, T13 : écritures définitives, en CDF ; 8 colonnes : solde d'ouverture, mouvements, cumuls, solde ; 6 colonnes sans les cumuls ; 4 colonnes : mouvements et solde ; Groupée : comptes regroupés au niveau de rupture (nombre de chiffres) ; « sans VIDAGE » écarte les écritures de clôture",
        "PCCI § 3.2 et § 3.3 : comptabilité tenue en monnaie nationale ; balance générale des comptes",
        "Registre T31 (demande du porteur, 21/11/2026) : l'export suit le modèle de balance FPM et relie chaque compte à sa feuille de grand livre",
        "Registre T246 (demande du porteur, 27/11/2026) : la balance ne s'affiche plus à l'écran ; Exporter sort le classeur Excel, filtres posés sur la ligne des en-têtes"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
