// S110 : Comptabilité > Rapprochement bancaire (manuel Microfina++, p. 129 ; procédure p. 154 et 155) ; S112 : Historique rapprochement (p. 130) ;
// S119 : Lettrage (p. 138 et 160) ; S118 : Contrôle (Trésorerie, Rapport annulation, Etat des revenus : p. 136 et 137, 162 et 163) ;
// S143 : Autres > Trésorerie ; S142 : Annulation de règlement de crédit (p. 158). Registre S110, S112, S118, S119, S142, S143.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { decimal, lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee, Formulaire, Recherche } from "../composants";

const n = (v: number) => decimal.format(v / 100);
const TEXTE_008 = "Instr. BCC 008, art. 10 et 11 : fiabilité et exhaustivité de l'enregistrement comptable, piste d'audit, justification des soldes comptables";
type Journal = Awaited<ReturnType<typeof api.controlesCompta.journalBanque>>;
type EtatR = Awaited<ReturnType<typeof api.controlesCompta.etatRapprochement>>;

/** S110 : Info Relevé (Banque, Compte), Période, Situation (Solde début, Solde Fin), Rechercher ; Nouveau, Exporter ; Rafraichir ; journal de la banque à cocher */
export function Rapprochement() {
  const { donnees: ctx } = useDonnees(() => api.controlesCompta.rapproContexte());
  const [f, setF] = useState({ banque: "", compte: "", du: "", au: "", soldeFin: "" });
  const [j, setJ] = useState<Journal | null>(null);
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [etat, setEtat] = useState<EtatR | null>(null);
  const [fait, setFait] = useState(false);
  const [nouveau, setNouveau] = useState<{ type: "encaissement" | "decaissement"; compte: string; libelle: string; montant: string; date: string } | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const jour = ctx.date;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const q = () => ({ compteBancaireId: f.compte ? Number(f.compte) : null, du: f.du || jour, au: f.au });
  const envoi = () => ({ ...q(), soldeFin: f.soldeFin.trim() ? lireMontant(f.soldeFin) : null, lignes: [...coches] });
  const dv = (j?.devise ?? "CDF") as Devise;
  async function rechercher() { try { setJ(await api.controlesCompta.journalBanque(q())); setCoches(new Set()); setFait(false); } catch (x) { erreur(x); } }
  async function exporter() { try { setEtat(await api.controlesCompta.etatRapprochement(envoi())); } catch (x) { erreur(x); } }
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.controlesCompta.enregistrerRapprochement(envoi()); setFait(true); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { erreur(x); }
    } });
  }
  function enregistrerNouveau() {
    if (!nouveau) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.controlesCompta.nouvelleOperation({ cle, type: nouveau.type, date: nouveau.date || jour, compteBancaireId: f.compte ? Number(f.compte) : undefined, compte: nouveau.compte.trim(),
          libelle: nouveau.libelle, montant: lireMontant(nouveau.montant) ?? 0 });
        setNouveau(null); setCle(nouvelleCle()); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { erreur(x); }
    } });
  }
  const basculer = (id: string) => { const s = new Set(coches); if (s.has(id)) s.delete(id); else s.add(id); setCoches(s); };
  const lignes = j?.lignes ?? [], tous = lignes.length > 0 && lignes.every((x) => coches.has(x.id));
  return (
    <>
      
      <section className="bloc pile" aria-label="Rapprochement Bancaire">
        <Recherche label="Info Relevé" envoyer={rechercher}><fieldset className="cadre-champs pile"><legend>Info Relevé</legend>
          <div className="ligne-champ">
            <Champ libelle="Banque *">{(p) => <select {...p} className="saisie" value={f.banque} onChange={(e) => setF({ ...f, banque: e.target.value, compte: "" })}><option value=""></option>
              {ctx.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Compte *">{(p) => <select {...p} className="saisie" value={f.compte} disabled={!f.banque} onChange={(e) => setF({ ...f, compte: e.target.value })}><option value="">{f.banque ? "" : "Choisir d'abord la banque"}</option>
              {ctx.comptes.filter((c) => String(c.banqueId) === f.banque).map((c) => <option key={c.id} value={c.id}>{`${c.numero} (${c.devise})`}</option>)}</select>}</Champ>
          </div>
          <div className="deux-colonnes">
            <fieldset className="cadre-champs formulaire"><legend>Période</legend>
              <ChampDate libelle="Date Début *" valeur={f.du || ctx.date} onChange={(v) => setF({ ...f, du: v })} requis />
              <ChampDate libelle="Date Fin *" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} requis /></fieldset>
            <fieldset className="cadre-champs formulaire"><legend>Situation</legend>
              <Champ libelle="Solde début">{(p) => <Lecture {...p} value={j ? montant(j.soldeDebut, dv) : ""} />}</Champ>
              <Champ libelle="Solde Fin">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.soldeFin} onChange={(e) => setF({ ...f, soldeFin: e.target.value })} />}</Champ></fieldset>
          </div>
          <div className="actions-onglets"><button className="bouton" type="submit">Rechercher</button></div>
        </fieldset></Recherche>
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!f.compte} onClick={() => setNouveau({ type: "decaissement", compte: "", libelle: "", montant: "", date: "" })}>Nouveau</button>
          <button className="bouton secondaire" type="button" disabled={!j} onClick={exporter}>Exporter</button>
        </div>
        <Paginee lignes={lignes}>{(visibles) => (<table className="grille">
          <thead><tr><th scope="col"><input type="checkbox" aria-label="Tout cocher" checked={tous} onChange={() => setCoches(tous ? new Set() : new Set(lignes.map((x) => x.id)))} /></th>
            <th scope="col">N°piece</th><th scope="col">Date Comptable</th><th scope="col">Libellé Opération</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
          <tbody>{lignes.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.id}><td><input type="checkbox" aria-label={`Cocher ${x.libelle}`} checked={coches.has(x.id)} onChange={() => basculer(x.id)} /></td>
              <td className="chiffres">{x.piece}</td><td className="chiffres">{fr(x.date)}</td><td>{x.libelle}</td><td className="num chiffres">{x.debit ? n(x.debit) : ""}</td><td className="num chiffres">{x.credit ? n(x.credit) : ""}</td></tr>)}</tbody>
        </table>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 129 : capture « Rapprochement Bancaire » ; p. 154 et 155 : banque, compte, période, solde à rapprocher ; Rechercher fait apparaître le journal banque ; cocher les opérations du relevé ; Nouveau pour celles qui manquent à nos livres ; Exporter pour l'état",
          TEXTE_008, "Registre S110-1 à S110-5 : lignes pas encore pointées jusqu'à la date de fin ; état du solde comptable au solde du relevé ; le rapprochement enregistré entre à l'historique (S112)"]} />
      </section>
      <Fiche titre="État de rapprochement bancaire" ouverte={!!etat} fermer={() => setEtat(null)}>
        {etat && <div className="pile">
          <article className="a-imprimer pile" aria-label="État de rapprochement bancaire">
            <p><strong>{etat.banque}</strong>, compte <span className="chiffres">{etat.compte}</span> ({etat.devise}), du {fr(etat.du)} au {fr(etat.au)}</p>
            <table className="grille"><tbody>
              <tr><th scope="row">Solde comptable au {fr(etat.au)}</th><td className="num chiffres">{n(etat.soldeComptable)}</td></tr>
              <tr><th scope="row">Encaissements que la banque n'a pas encore portés</th><td className="num chiffres">- {n(etat.suspensDebit)}</td></tr>
              <tr><th scope="row">Paiements que la banque n'a pas encore débités</th><td className="num chiffres">+ {n(etat.suspensCredit)}</td></tr>
              <tr><th scope="row">Solde attendu au relevé</th><td className="num chiffres"><strong>{n(etat.soldeTheorique)}</strong></td></tr>
              <tr><th scope="row">Solde du relevé (Solde Fin)</th><td className="num chiffres">{n(etat.soldeFin)}</td></tr>
              <tr><th scope="row">Écart</th><td className="num chiffres"><strong>{n(etat.ecart)}</strong></td></tr>
            </tbody></table>
            <table className="grille"><caption>Opérations en suspens</caption>
              <thead><tr><th scope="col">N°piece</th><th scope="col">Date Comptable</th><th scope="col">Libellé Opération</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
              <tbody>{etat.suspens.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
                {etat.suspens.map((x) => <tr key={x.id}><td className="chiffres">{x.piece}</td><td className="chiffres">{fr(x.date)}</td><td>{x.libelle}</td><td className="num chiffres">{x.debit ? n(x.debit) : ""}</td><td className="num chiffres">{x.credit ? n(x.credit) : ""}</td></tr>)}</tbody></table>
          </article>
          <div className="actions-onglets sans-impression"><button className="bouton secondaire" type="button" onClick={() => window.print()}>Imprimer</button>
            <button className="bouton" type="button" disabled={fait} onClick={enregistrer}>Enregistrer</button><button className="bouton secondaire" type="button" onClick={() => setEtat(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Fiche titre="Nouveau" ouverte={!!nouveau} fermer={() => setNouveau(null)}>
        {nouveau && <Formulaire className="pile formulaire" envoyer={enregistrerNouveau}>
          <Champ libelle="Type operation">{(p) => <select {...p} className="saisie" value={nouveau.type} onChange={(e) => setNouveau({ ...nouveau, type: e.target.value as "encaissement" | "decaissement" })}>
            <option value="encaissement">Encaissement divers</option><option value="decaissement">Décaissement divers</option></select>}</Champ>
          <ChampDate libelle="Date opération" valeur={nouveau.date || ctx.date} onChange={(v) => setNouveau({ ...nouveau, date: v })} />
          <Champ libelle="Compte *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={nouveau.compte} onChange={(e) => setNouveau({ ...nouveau, compte: e.target.value })} />}</Champ>
          <Champ libelle="Libellé">{(p) => <input {...p} className="saisie" autoComplete="off" value={nouveau.libelle} onChange={(e) => setNouveau({ ...nouveau, libelle: e.target.value })} />}</Champ>
          <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={nouveau.montant} onChange={(e) => setNouveau({ ...nouveau, montant: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button><button className="bouton secondaire" type="button" onClick={() => setNouveau(null)}>Annuler</button></div>
        </Formulaire>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S112 : Rechercher (Par période, Par date), Période, Elément de la recherche (période rapprochée, Banque, Compte) ; Rechercher, Effacer */
export function HistoriqueRapprochement() {
  const { donnees: ctx } = useDonnees(() => api.controlesCompta.rapproContexte());
  const vide = { du: "", au: "", periodeDu: "", periodeAu: "", banque: "", compte: "" };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Awaited<ReturnType<typeof api.controlesCompta.historique>> | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  async function rechercher() {
    try { setR(await api.controlesCompta.historique({ mode: "periode", du: f.du || ctx!.date, au: f.au || f.du || ctx!.date, periodeDu: f.periodeDu, periodeAu: f.periodeAu, banqueId: f.banque, compteBancaireId: f.compte })); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  return (
    <>
      <h2>Historique rapprochement</h2>
      <section className="bloc pile" aria-label="Historique rapprochement"><Recherche className="pile" label="Critères" envoyer={rechercher}>
        <div className="deux-colonnes">
          <fieldset className="cadre-champs formulaire"><legend>Période</legend>
            <ChampDate libelle="Du :" valeur={f.du || ctx.date} onChange={(v) => setF({ ...f, du: v })} />
            <ChampDate libelle="Au :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} /></fieldset>
        </div>
        <fieldset className="cadre-champs"><legend>Elément de la recherche</legend>
          <div className="deux-colonnes">
            <ChampDate libelle="Date deb. période rapprochement :" valeur={f.periodeDu} onChange={(v) => setF({ ...f, periodeDu: v })} />
            <ChampDate libelle="Date fin période rapprochement :" valeur={f.periodeAu} onChange={(v) => setF({ ...f, periodeAu: v })} />
            <Champ libelle="Banque :">{(p) => <select {...p} className="saisie" value={f.banque} onChange={(e) => setF({ ...f, banque: e.target.value, compte: "" })}><option value=""></option>
              {ctx.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Compte :">{(p) => <select {...p} className="saisie" value={f.compte} onChange={(e) => setF({ ...f, compte: e.target.value })}><option value=""></option>
              {ctx.comptes.filter((c) => !f.banque || String(c.banqueId) === f.banque).map((c) => <option key={c.id} value={c.id}>{`${c.numero} (${c.devise})`}</option>)}</select>}</Champ>
          </div>
        </fieldset>
        <div className="actions-onglets"><button className="bouton" type="submit">Rechercher</button><button className="bouton secondaire" type="button" onClick={() => { setF(vide); setR(null); }}>Effacer</button></div></Recherche>
        <Paginee lignes={r ?? []}>{(visibles) => (<table className="grille">
          <thead><tr><th scope="col">Date</th><th scope="col">Banque</th><th scope="col">Compte</th><th scope="col">Date début</th><th scope="col">Date fin</th><th scope="col" className="num">Solde début</th>
            <th scope="col" className="num">Solde Fin</th><th scope="col" className="num">Solde comptable</th><th scope="col" className="num">Écart</th><th scope="col">Utilisateur</th></tr></thead>
          <tbody>{(r ?? []).length === 0 && <tr><td colSpan={10}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.id}><td className="chiffres">{fr(x.date)}</td><td>{x.banque}</td><td className="chiffres">{x.compte}</td><td className="chiffres">{fr(x.du)}</td><td className="chiffres">{fr(x.au)}</td>
              <td className="num chiffres">{n(x.soldeDebut)}</td><td className="num chiffres">{n(x.soldeReleve)}</td><td className="num chiffres">{n(x.soldeComptable)}</td><td className="num chiffres">{n(x.ecart)}</td><td>{x.preparePar}</td></tr>)}</tbody>
        </table>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 130 : « La recherche peut se faire par période ou par date » ; capture « Historique rapprochement »", TEXTE_008,
          "Registre S112-1 et S112-2 : la période de la recherche porte sur la journée comptable de l'enregistrement ; grille des rapprochements enregistrés (S110)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S119 : Rechercher (Date début *, Date fin, Compte *, écritures non lettrées, lettrées, toutes), Solde sélection, Lettrer, Liste des écritures comptables */
export function Lettrage() {
  const { donnees: jour } = useDonnees(() => api.journees.courante());
  const vide = { du: "", au: "", compte: "", etat: "non" };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Awaited<ReturnType<typeof api.controlesCompta.lettrageLignes>> | null>(null);
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [boite, setBoite] = useState<Boite | null>(null);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const du = f.du || (jour?.date ? `${jour.date.slice(0, 4)}-01-01` : "");
  async function afficher() { try { setR(await api.controlesCompta.lettrageLignes({ compte: f.compte.trim(), du, au: f.au, etat: f.etat })); setCoches(new Set()); } catch (x) { erreur(x); } }
  function lettrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment lettrer ?", oui: async () => {
      try { await api.controlesCompta.lettrer({ compte: f.compte.trim(), lignes: [...coches] }); await afficher(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { erreur(x); }
    } });
  }
  const lignes = r?.lignes ?? [], sel = lignes.filter((x) => coches.has(x.id)), td = sel.reduce((t, x) => t + x.debit, 0), tc = sel.reduce((t, x) => t + x.credit, 0);
  const basculer = (id: string) => { const s = new Set(coches); if (s.has(id)) s.delete(id); else s.add(id); setCoches(s); };
  const radio = (v: string, l: string) => <label className="case"><input type="radio" name="lt-etat" checked={f.etat === v} onChange={() => setF({ ...f, etat: v })} /><span>{l}</span></label>;
  return (
    <>
      <h2>Lettrage des écritures comptables</h2>
      <section className="bloc pile" aria-label="Lettrage des écritures comptables">
        <div className="deux-colonnes">
          <Recherche label="Rechercher" envoyer={afficher}><fieldset className="cadre-champs pile"><legend>Rechercher</legend>
            <div className="ligne-champ"><ChampDate libelle="Date début *" valeur={du} onChange={(v) => setF({ ...f, du: v })} requis /><ChampDate libelle="Date fin" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} /></div>
            <div className="ligne-champ"><Champ libelle="Compte *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={f.compte} onChange={(e) => setF({ ...f, compte: e.target.value })} />}</Champ>
              <Champ libelle="Intitulé">{(p) => <Lecture {...p} value={r?.intitule ?? ""} />}</Champ></div>
            <div className="ligne-champ" role="radiogroup">{radio("non", "Ecritures non lettrées")}{radio("lettrees", "Ecritures lettrées")}{radio("toutes", "Toutes les écritures")}</div>
            <div className="actions-onglets"><button className="bouton secondaire" type="submit">Afficher</button>
              <button className="bouton secondaire" type="button" onClick={() => { setF(vide); setR(null); setCoches(new Set()); }}>Effacer</button></div>
          </fieldset></Recherche>
          <fieldset className="cadre-champs formulaire"><legend>Solde sélection</legend>
            <Champ libelle="Tot. débit">{(p) => <Lecture {...p} value={n(td)} />}</Champ><Champ libelle="Tot. crédit">{(p) => <Lecture {...p} value={n(tc)} />}</Champ>
            <Champ libelle="Solde débit.">{(p) => <Lecture {...p} value={td > tc ? n(td - tc) : ""} />}</Champ><Champ libelle="Solde crédit.">{(p) => <Lecture {...p} value={tc > td ? n(tc - td) : ""} />}</Champ>
          </fieldset>
        </div>
        <div className="actions-onglets"><button className="bouton" type="button" disabled={coches.size < 2} onClick={lettrer}>Lettrer</button></div>
        <Paginee lignes={lignes}>{(visibles) => (<table className="grille"><caption>Liste des écritures comptables</caption>
          <thead><tr><th scope="col"><span className="sr-only">Cocher</span></th><th scope="col">Date</th><th scope="col">N°piece</th><th scope="col">Libellé</th><th scope="col" className="num">Débit</th>
            <th scope="col" className="num">Crédit</th><th scope="col">Lettre</th></tr></thead>
          <tbody>{lignes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.id}><td><input type="checkbox" aria-label={`Cocher ${x.libelle}`} disabled={!!x.lettre} checked={coches.has(x.id)} onChange={() => basculer(x.id)} /></td>
              <td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.piece}</td><td>{x.libelle}</td><td className="num chiffres">{x.debit ? n(x.debit) : ""}</td>
              <td className="num chiffres">{x.credit ? n(x.credit) : ""}</td><td className="code">{x.lettre}</td></tr>)}</tbody>
        </table>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 138 : le compte à lettrer, la date début et fin, Afficher puis Lettrer ; p. 160 ; capture « Lettrage des écritures comptables »", TEXTE_008,
          "Registre S119-1 à S119-3 : lignes définitives du compte (T13) ; un même code pour les lignes cochées quand le total débit égale le total crédit ; une ligne se lettre une seule fois"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Contrôle > Trésorerie (p. 136 et 162) : Date *, Afficher ; « Solde des caisses au … », « Solde des banques au … ». Aussi Autres > Trésorerie (S143). */
function EtatTresorerie() {
  const { donnees: jour } = useDonnees(() => api.journees.courante());
  const [date, setDate] = useState("");
  const [r, setR] = useState<Awaited<ReturnType<typeof api.controlesCompta.tresorerie>> | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function afficher() { try { setR(await api.controlesCompta.tresorerie({ date: date || jour?.date || "" })); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  const table = (titre: string, l: { compte: string; designation: string; devise: string; solde: number }[], tot: Record<string, number>) => <table className="grille"><caption>{titre}</caption>
    <thead><tr><th scope="col">Compte</th><th scope="col">Désignation</th><th scope="col" className="num">Solde</th></tr></thead>
    <tbody>{l.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
      {l.map((x, i) => <tr key={i}><td className="code">{x.compte}</td><td>{x.designation}</td><td className="num chiffres">{montant(x.solde, x.devise as Devise)}</td></tr>)}</tbody>
    <tfoot>{Object.entries(tot).map(([dv, v]) => <tr key={dv}><td></td><td></td><td className="num chiffres"><strong>{montant(v, dv as Devise)}</strong></td></tr>)}</tfoot></table>;
  return <>
    <Recherche className="ligne-champ" label="Critères" envoyer={afficher}><ChampDate libelle="Date : *" valeur={date || jour?.date || ""} onChange={setDate} requis />
      <button className="bouton" type="submit">Afficher</button></Recherche>
    {r && <>{table(`Solde des caisses au ${fr(r.date)}`, r.caisses, r.totalCaisses)}{table(`Solde des banques au ${fr(r.date)}`, r.banques, r.totalBanques)}</>}
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </>;
}
const SOURCES_TRESORERIE = ["Manuel Microfina++, p. 136 : renseigner le champ Date, obligatoire, puis Afficher pour le solde des caisses ; p. 162 : soldes des caisses et des banques pour la journée comptable ; capture",
  TEXTE_008, "Registre S118-1 : soldes lus au grand livre à la date, brouillard compris ; un solde par devise"];
export function Tresorerie() {
  return <><section className="bloc pile" aria-label="Trésorerie"><EtatTresorerie /><Textes sources={[...SOURCES_TRESORERIE, "Manuel Microfina++, p. 163 : le menu Autres affiche Clôture, Trésorerie, Calculs ; registre S143-1 : même état que Contrôle > Trésorerie"]} /></section></>;
}

function RapportAnnulations() {
  const { donnees: ctx } = useDonnees(async () => ({ c: await api.controlesCompta.annulationsContexte(), j: await api.journees.courante() }));
  const [f, setF] = useState({ guichet: "", du: "", au: "", type: "", utilisateur: "" });
  const [r, setR] = useState<Awaited<ReturnType<typeof api.controlesCompta.annulations>> | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const jour = ctx.j?.date ?? "";
  async function rechercher() {
    try { setR(await api.controlesCompta.annulations({ du: f.du || jour, au: f.au || jour, guichetId: f.guichet, type: f.type, utilisateurId: f.utilisateur })); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  return <>
    <h2>Rapports des annulations</h2>
    <Recherche className="pile" label="Critères" envoyer={rechercher}><div className="deux-colonnes">
      <fieldset className="cadre-champs formulaire"><legend>Element de Recherche</legend>
        <Champ libelle="Guichet :">{(p) => <select {...p} className="saisie" value={f.guichet} onChange={(e) => setF({ ...f, guichet: e.target.value })}><option value=""></option>
          {ctx.c.guichets.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}</select>}</Champ>
        <Champ libelle="Rapport :">{(p) => <select {...p} className="saisie"><option>Les annulations</option></select>}</Champ>
        <ChampDate libelle="Du :" valeur={f.du || jour} onChange={(v) => setF({ ...f, du: v })} /><ChampDate libelle="Au :" valeur={f.au || jour} onChange={(v) => setF({ ...f, au: v })} /></fieldset>
      <fieldset className="cadre-champs formulaire"><legend>Filtre</legend>
        <Champ libelle="Type d'opération :">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value=""></option>
          {ctx.c.types.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Utilisateur :">{(p) => <select {...p} className="saisie" value={f.utilisateur} onChange={(e) => setF({ ...f, utilisateur: e.target.value })}><option value=""></option>
          {ctx.c.utilisateurs.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}</select>}</Champ></fieldset>
    </div>
    <div className="actions-onglets"><button className="bouton" type="submit">Rechercher</button>
      <button className="bouton secondaire" type="button" disabled={!r || r.length === 0} onClick={() => r && exporterExcel("annulations", ["N° Pièce ancien", "N° Pièce nouveau", "N° Client", "Nom Prénom", "Montant", "Date", "Type d'opération", "Utilisateur"],
        r.map((x) => [x.ancienne, x.nouvelle, x.numeroClient, x.nom, x.montant / 100, fr(x.date), x.type, x.utilisateur]))}>Exporter</button></div></Recherche>
    <Paginee lignes={r ?? []}>{(visibles) => (<table className="grille">
      <thead><tr><th scope="col">N° Pièce ancien</th><th scope="col">N° Pièce nouveau</th><th scope="col">N° Client</th><th scope="col">Nom Prénom</th><th scope="col" className="num">Montant</th>
        <th scope="col">Date</th><th scope="col">Type d'opération</th><th scope="col">Utilisateur</th></tr></thead>
      <tbody>{(r ?? []).length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
        {visibles.map((x, i) => <tr key={i}><td className="chiffres">{x.ancienne}</td><td className="chiffres">{x.nouvelle}</td><td className="chiffres">{x.numeroClient}</td><td>{x.nom}</td>
          <td className="num chiffres">{montant(x.montant, "CDF")}</td><td className="chiffres">{fr(x.date)}</td><td>{x.type}</td><td>{x.utilisateur}</td></tr>)}</tbody>
    </table>)}</Paginee>
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </>;
}

function EtatRevenus() {
  const { donnees: jour } = useDonnees(() => api.journees.courante());
  const [f, setF] = useState({ du: "", au: "", resultat: "detaille" });
  const [r, setR] = useState<Awaited<ReturnType<typeof api.controlesCompta.revenus>> | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const du = f.du || (jour?.date ? `${jour.date.slice(0, 4)}-01-01` : ""), au = f.au || jour?.date || "";
  async function afficher() { try { setR(await api.controlesCompta.revenus({ du, au, resultat: f.resultat })); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  return <>
    <h2>État des revenus</h2>
    <Recherche className="pile" label="Critères" envoyer={afficher}><div className="deux-colonnes">
      <fieldset className="cadre-champs"><legend>Période</legend><div className="ligne-champ"><ChampDate libelle="Du :" valeur={du} onChange={(v) => setF({ ...f, du: v })} /><ChampDate libelle="Au :" valeur={au} onChange={(v) => setF({ ...f, au: v })} /></div></fieldset>
      <div className="ligne-champ" role="radiogroup">
        <label className="case"><input type="radio" name="rv" checked={f.resultat === "detaille"} onChange={() => setF({ ...f, resultat: "detaille" })} /><span>Détaillé</span></label>
        <label className="case"><input type="radio" name="rv" checked={f.resultat === "synthese"} onChange={() => setF({ ...f, resultat: "synthese" })} /><span>Synthèse</span></label></div>
    </div>
    <div className="actions-onglets"><button className="bouton" type="submit">Afficher</button></div></Recherche>
    <Paginee lignes={r?.lignes ?? []}>{(visibles) => (<table className="grille">
      <thead><tr><th scope="col">Date Opération</th><th scope="col">AGENCE</th><th scope="col" className="num">DEPENSES</th><th scope="col" className="num">RECETTES</th><th scope="col" className="num">RESULTATS</th></tr></thead>
      <tbody>{(r?.lignes ?? []).length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
        {visibles.map((x, i) => <tr key={i}><td className="chiffres">{x.date ? fr(x.date) : ""}</td><td>{x.agence}</td><td className="num chiffres">{n(x.depenses)}</td><td className="num chiffres">{n(x.recettes)}</td><td className="num chiffres">{n(x.resultat)}</td></tr>)}</tbody>
      <tfoot><tr><td></td><td></td><td className="num chiffres">{r ? n(r.depenses) : ""}</td><td className="num chiffres">{r ? n(r.recettes) : ""}</td><td className="num chiffres">{r ? n(r.resultat) : ""}</td></tr></tfoot>
    </table>)}</Paginee>
    <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={!r || r.lignes.length === 0} onClick={() => r && exporterExcel("etat-des-revenus", ["Date Opération", "AGENCE", "DEPENSES", "RECETTES", "RESULTATS"],
      r.lignes.map((x) => [x.date ? fr(x.date) : "", x.agence, x.depenses / 100, x.recettes / 100, x.resultat / 100]))}>Export</button></div>
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </>;
}

/** S118 : Comptabilité > Contrôle : Trésorerie, Rapport annulation, Etat des revenus (le contrôle « Compte », écart entre gestion et comptabilité, n'est pas repris) */
export function Controles() {
  const [onglet, setOnglet] = useState(0);
  const ONGLETS = ["Trésorerie", "Rapport annulation", "État des revenus"];
  return (
    <>
      <h2>Contrôle</h2>
      <div className="onglets" role="tablist" aria-label="Contrôle">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`ct-${i}`} aria-controls="ct-volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="ct-volet" role="tabpanel" aria-labelledby={`ct-${onglet}`}>
        {onglet === 0 && <EtatTresorerie />}{onglet === 1 && <RapportAnnulations />}{onglet === 2 && <EtatRevenus />}
        <Textes sources={[...SOURCES_TRESORERIE, "Manuel Microfina++, p. 137 : Rapport annulation ; Etat des revenus, Détaillé ou Synthèse, Afficher ou Exporter ; captures",
          "PCCI § 3.3 : toute correction se fait par inscription en négatif ; classes 6 (charges) et 7 (produits)",
          "Registre S118-2 à S118-4 : annulations lues dans les écritures liées à leur écriture d'origine ; revenus : classes 6 et 7 par jour, en CDF ; le contrôle « Compte » (écart gestion et comptabilité) n'est pas repris : un seul grand livre"]} />
      </section>
    </>
  );
}

/** S142 : Infos règlement (N° de pièce recherché, Date règlement, Crédit, Client, Compte client), Détail montant règlement ; Valider, Effacer */
export function AnnulationReglement() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => ({ j: await api.journees.courante(), l: await api.controlesCompta.reglementsAnnulables() }), [relu]);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [fait, setFait] = useState<{ piece: string } | null>(null);
  const [cherche, setCherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { j, l } = donnees, r = l.find((x) => x.id === choisi) ?? null, dv = (r?.devise ?? "CDF") as Devise;
  function valider() {
    if (!r) { setBoite({ type: "erreur", message: "À remplir : N° de pièce." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment annuler ce remboursement ?", oui: async () => {
      try { const x = await api.controlesCompta.annulerReglement(r.id); setFait({ piece: x.pieceAnnulation }); setChoisi(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Opération effectuée avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const m = (libelle: string, v: number | undefined) => <Champ libelle={libelle}>{(p) => <Lecture {...p} value={r ? montant(v ?? 0, dv) : ""} />}</Champ>;
  return (
    <>
      <section className="bloc pile" aria-label="Annulation de règlement de crédit">
        <div className="entete-ecran">{(fait?.piece ?? "") ? <p>Numéro de pièce : <strong className="chiffres">{fait?.piece ?? ""}</strong></p> : null}<p>Date Opération: <strong className="chiffres">{fr(j?.date ?? "")}</strong></p></div>
        <div className="deux-colonnes">
          <fieldset className="cadre-champs formulaire"><legend>Infos règlement</legend>
            <div className="ligne-champ"><Champ libelle="N° de pièce :">{(p) => <input {...p} className="saisie code" readOnly value={r?.piece ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un règlement" onClick={() => setCherche(true)}>Rechercher</button></div>
            <Champ libelle="Date règlement :">{(p) => <Lecture {...p} value={r ? fr(r.date) : ""} />}</Champ>
            <Champ libelle="Credit:">{(p) => <Lecture {...p} value={r?.credit ?? ""} />}</Champ>
            <Champ libelle="Client :">{(p) => <Lecture {...p} value={r?.client ?? ""} />}</Champ>
            <Champ libelle="Mode :">{(p) => <Lecture {...p} value={r?.mode ?? ""} />}</Champ>
            <Champ libelle="Compte :">{(p) => <Lecture {...p} value={r?.compteClient ?? ""} />}</Champ>
          </fieldset>
          <fieldset className="cadre-champs formulaire"><legend>Détail montant règlement</legend>
            {m("Capital", r?.capital)}{m("Intérêt", r?.interet)}{m("Epargne", r?.epargne)}{m("Fonds solid.", r?.solidarite)}{m("Pénalité", r?.penalite)}{m("Montant total", r?.montant)}
          </fieldset>
        </div>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={valider}>Annuler ce remboursement</button><button className="bouton secondaire" type="button" onClick={() => { setChoisi(null); setFait(null); }}>Effacer</button></div>
        <Textes sources={["Manuel Microfina++, p. 158 : sélectionner le numéro de pièce du règlement à annuler puis Valider ; capture « Annulation de règlement d'un crédit effectué par prélèvement sur compte »",
          "Plan d'allègement, point 6.9 : ouverte aussi aux remboursements par banque ; bouton « Annuler ce remboursement »",
          "PCCI § 3.3 : toute correction d'erreur s'effectue par inscription en négatif des éléments erronés ; § 3.4 : irréversibilité des enregistrements",
          "Instr. BCC 008, art. 66 : séparation des tâches ; registre S142-1 à S142-5 : dernier règlement d'un crédit en cours ; écriture inverse liée à l'écriture d'origine ; le client retrouve la somme ; les échéances d'avant un remboursement anticipé reviennent"]} />
      </section>
      <Fiche titre="Remboursements annulables" ouverte={cherche} fermer={() => setCherche(false)}>
        <div className="pile"><div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">N° de pièce</th><th scope="col">Date règlement</th><th scope="col">Crédit</th><th scope="col">Client</th><th scope="col">Mode</th><th scope="col" className="num">Montant total</th></tr></thead>
          <tbody>{l.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
            {l.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} onClick={() => { setChoisi(x.id); setFait(null); setCherche(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setChoisi(x.id); setFait(null); setCherche(false); } }}>
              <td className="chiffres">{x.piece}</td><td className="chiffres">{fr(x.date)}</td><td className="code">{x.credit}</td><td>{x.client}</td><td>{x.mode}</td><td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td></tr>)}</tbody>
        </table></div><div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setCherche(false)}>Fermer</button></div></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
