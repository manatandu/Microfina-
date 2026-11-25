// S75 : Caisse > Opération > Déblocage crédit (manuel Microfina++, p. 86 et 87, capture « Déblocage crédit ») ; S54 (banque, p. 62) et S105 (compte d'épargne,
// p. 124, 156 et 157) réunis dans Crédit > Déblocage (plan d'allègement, point 6.6).
// Choisir le crédit visé, Débloquer ; échéancier, contrat de prêt, reconnaissance de dette. Plan d'allègement, points 4.7 et 6.7 : plus d'étape « Encaisser frais »
// ni « Prélever les frais », qui n'écrivaient rien ; une seule confirmation montre les retenues et le montant remis (Instr. BCC 38, art. 6 ; registre CR-6).
// Registre S75-1 à S75-8, S54-2 à S54-5, S105-1 à S105-4, CR-6, CR-10, CR-12.
import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api } from "../donnees/api";
import type { Operation } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { montant, montantEnLettres, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Formulaire } from "../composants";
import { billetageBon, OngletsGuichet, recapitulatif, Recu } from "./Guichet";
import { ContratPret } from "./ContratPret";

type Detail = Awaited<ReturnType<typeof api.deblocage.detail>>;

function ChoixCredit({ choisir }: { choisir: (id: number) => void }) {
  const [ouverte, setOuverte] = useState(false);
  const { donnees: l } = useDonnees(() => (ouverte ? api.deblocage.aDebloquer() : Promise.resolve([])), [ouverte]);
  return <>
    <button className="bouton secondaire" type="button" aria-label="Rechercher un crédit" onClick={() => setOuverte(true)}>Rechercher</button>
    <Fiche titre="Crédits à débloquer" ouverte={ouverte} fermer={() => setOuverte(false)}>
      <div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">N° crédit</th><th scope="col">Client</th><th scope="col" className="num">Montant du prêt</th></tr></thead>
        <tbody>{(l ?? []).length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
          {(l ?? []).map((x) => <tr key={x.id} onClick={() => { choisir(x.id); setOuverte(false); }}><td className="code">{x.numero}</td><td>{x.client}</td>
            <td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td></tr>)}</tbody>
      </table></div>
    </Fiche>
  </>;
}

function InfosCredit({ d }: { d: Detail | null }) {
  const dv = (d?.devise ?? "CDF") as Devise;
  const v = (l: string, x: string) => <Champ key={l} libelle={l}>{(p) => <Lecture {...p} value={d ? x : ""} />}</Champ>;
  return <>
    {v("Date demande", fr(d?.dateDemande ?? ""))}{v("Durée", d ? `${d.duree} Mois` : "")}{v("Date effet", fr(d?.dateEffet ?? ""))}{v("Date début", fr(d?.echeancierDeblocage[0]?.date ?? ""))}
    {v("Montant du prêt", d ? montant(d.montant, dv) : "")}{v("Différé", d ? `${d.differe} Mois` : "")}{v("Nombre traite", String(d?.nombreTraites ?? ""))}
    {v("Produit", d?.produit ?? "")}{v("Objet du crédit", d?.objet ?? "")}{v("Agent de crédit", d?.agent ?? "")}
    {v("Taux d'intérêt mensuel", d ? `${d.tauxInteret.replace(".", ",")} % (${String(Math.round(Number(d.tauxInteret) * 1200) / 100).replace(".", ",")} % l'an)` : "")}
  </>;
}

function Retenues({ d }: { d: Detail }) {
  const dv = d.devise as Devise, r = d.retenues;
  return (
    <div className="pile">
      <div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">Libellé</th><th scope="col" className="num">Valeur</th><th scope="col">Compte</th></tr></thead>
        <tbody>{r.frais.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
          {r.frais.map((f) => <tr key={f.libelle}><td>{f.libelle}</td><td className="num chiffres">{montant(f.montant, dv)}</td><td className="code">{f.compte}</td></tr>)}</tbody>
      </table></div>
      <dl className="infos">
        <div className="info-ligne"><dt>Assurance</dt><dd className="chiffres">{montant(r.assurance, dv)}</dd></div>
        <div className="info-ligne"><dt>Épargne obligatoire, déposée et bloquée (non retenue)</dt><dd className="chiffres">{montant(r.epargneObligatoire, dv)}</dd></div>
        <div className="info-ligne"><dt>Fonds de solidarité</dt><dd className="chiffres">{montant(r.fondsSolidarite, dv)}</dd></div>
        <div className="info-ligne"><dt>Montant remis</dt><dd className="chiffres"><strong>{montant(r.net, dv)}</strong></dd></div>
      </dl>
      <p className="montant-lettres">{montantEnLettres(r.net, dv)}</p>
    </div>
  );
}

function Echeancier({ d, fermer }: { d: Detail; fermer: () => void }) {
  const dv = d.devise as Devise;
  return <div className="pile"><div className="defile-x"><table className="grille">
    <thead><tr><th scope="col">N°</th><th scope="col">Date</th><th scope="col" className="num">Capital</th><th scope="col" className="num">Intérêt</th><th scope="col" className="num">Échéance</th></tr></thead>
    <tbody>{d.echeancierDeblocage.map((l) => <tr key={l.rang}><td className="chiffres">{l.rang}</td><td className="chiffres">{fr(l.date)}</td><td className="num chiffres">{montant(l.capital, dv)}</td>
      <td className="num chiffres">{montant(l.interet, dv)}</td><td className="num chiffres">{montant(l.capital + l.interet, dv)}</td></tr>)}</tbody>
  </table></div><div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div></div>;
}

/** S75 : onglet Déblocage crédit du guichet (capture p. 87) */
export function DeblocageGuichet() {
  const [cid, setCid] = useState<number | null>(null);
  const [relu] = useState(0);
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [fiche, setFiche] = useState<"" | "recu" | "echeancier" | "reconnaissance" | "contrat">("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const [s, ctx, u, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.session.courante(), api.journees.courante()]);
    const d = cid && !fait ? await api.deblocage.detail(cid) : null;
    const dvc = (d?.devise ?? fait?.devise) as Devise | undefined;
    const stock = s && dvc ? await api.caisses.theorique(s.id, dvc) : {};
    const piece = fait ? (await api.operations.recu(fait.id)).piece : "";
    return { s, ctx, u, j, d, stock, piece };
  }, [cid, relu, fait?.id]);
  if (!donnees) return <Chargement />;
  const { s, j, d, stock, piece } = donnees;
  if (!s || s.statut !== "ouverte") return <><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>;
  const dv = (d?.devise ?? fait?.devise ?? "CDF") as Devise;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const effacer = () => { setCid(null); setCoupures({}); setCle(nouvelleCle()); setFait(null); };
  function debloquer() {
    if (!d) return;
    const r = d.retenues;
    setBoite({ type: "confirmation", message: recapitulatif(`Déblocage du crédit ${d.numero}`, [["Client", `${d.client} (${d.membre})`], ["Prêt", montant(d.montant, dv)],
      ["Retenues", montant(d.montant - r.net, dv)], ["Montant remis", montant(r.net, dv)], ["En lettres", montantEnLettres(r.net, dv)], ["Remis à", d.client]]), oui: async () => {
      try { const o = await api.deblocage.debloquerCaisse(d.id, { cle, coupures }); setFait(o); setFiche("recu"); }
      catch (x) { erreur(x); }
    } });
  }
  return (
    <>
      
      <OngletsGuichet version={fait?.id} />
      <Formulaire className="bloc pile" label="Déblocage crédit" envoyer={debloquer}>
        <div className="entete-ecran">{(piece) ? <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p> : null}<p>Date Opération : <strong className="chiffres">{fr(j?.date ?? "")}</strong></p></div>
        <div className="grille-deux">
          <fieldset className="cadre-champs formulaire"><legend>Info crédit</legend>
            <Champ libelle="N° crédit">{(p) => <input {...p} className="saisie code" readOnly value={d?.numero ?? ""} />}</Champ>
            <div className="ligne-champ"><ChoixCredit choisir={(x) => { effacer(); setCid(x); }} /></div>
            <InfosCredit d={d} />
          </fieldset>
          <fieldset className="cadre-champs formulaire"><legend>Info client</legend>
            <Champ libelle="N° client">{(p) => <Lecture {...p} value={d?.membre ?? ""} />}</Champ>
            <Champ libelle="Intitulé du compte">{(p) => <Lecture {...p} value={d?.client ?? ""} />}</Champ>
            <Champ libelle="Numéro compte">{(p) => <Lecture {...p} value={d?.compteClient ?? ""} />}</Champ>
          </fieldset>
        </div>
        {d && !fait && <div className="deux-colonnes">
          <fieldset className="pile cadre-champs"><legend>Retenues</legend><Retenues d={d} /></fieldset>
          <fieldset className="pile cadre-champs"><legend>Billetage</legend>
            <Billetage devise={dv} comptage={coupures} onChange={(c) => { setCoupures(c); setCle(nouvelleCle()); }} cible={d.retenues.net} sens="remise" stock={stock} /></fieldset>
        </div>}
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("echeancier")}>Echéancier</button>
          <button className="bouton" type="submit" disabled={!d || !!fait} aria-disabled={(!!d && !billetageBon(coupures, d.retenues.net)) || undefined} aria-describedby={d && !billetageBon(coupures, d.retenues.net) ? `ecart-${dv}` : undefined}>Débloquer</button>
          <button className="bouton secondaire" type="button" disabled={!cid} onClick={() => setFiche("reconnaissance")}>Reconnaissance de dette</button>
          <button className="bouton secondaire" type="button" disabled={!cid} onClick={() => setFiche("contrat")}>Contrat de prêt</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 86 : sélectionner le crédit à décaisser, Débloquer ; visualiser l'échéancier et le contrat de prêt ; capture p. 87. L'étape « Encaisser frais », qui n'écrivait rien, disparaît (plan d'allègement, point 4.7)",
          "Registre CR-6 : frais, assurance, épargne obligatoire et fonds de solidarité retenus sur le prêt ; l'épargne obligatoire est bloquée en garantie (Instr. BCC 38, art. 9)",
          "Registre S75-1 : échéance d'un jour non ouvré reportée au premier jour ouvré ; CR-10 : octroi à déclarer à la Centrale des risques (Instr. BCC 05, art. 10) ; billetage (S75-5)"]} />
      </Formulaire>
      <Fiche titre="Reçu" ouverte={fiche === "recu"} fermer={() => setFiche("")}>{fait && <Recu id={fait.id} onNouveau={() => { setFiche(""); effacer(); }} />}</Fiche>
      <Fiche titre="Echéancier" ouverte={fiche === "echeancier"} fermer={() => setFiche("")}>{d && <Echeancier d={d} fermer={() => setFiche("")} />}</Fiche>
      <Fiche titre="Reconnaissance de dette" ouverte={fiche === "reconnaissance"} fermer={() => setFiche("")}>{cid && <ContratPret id={cid} titre="Reconnaissance de dette" fermer={() => setFiche("")} />}</Fiche>
      <Fiche titre="Contrat de prêt" ouverte={fiche === "contrat"} fermer={() => setFiche("")}>{cid && <ContratPret id={cid} titre="Contrat de prêt" fermer={() => setFiche("")} />}</Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

const MODES_DEBLOCAGE = [["epargne", "Compte d'épargne du client", "S105"], ["banque", "Chèque bancaire", "S54"]] as const;
/** Crédit > Déblocage (plan d'allègement, point 6.6) : S105 (compte d'épargne, captures p. 124 et 157) et S54 (banque, capture p. 62) en un écran, le mode choisi
 *  dedans selon les droits ; au guichet, le même déblocage en espèces (S75). Mêmes boutons partout : Echéancier, Contrat de prêt, Reconnaissance de dette. */
export function Deblocage() {
  const [cid, setCid] = useState<number | null>(null);
  const [mode, setMode] = useState<"" | "epargne" | "banque">("");
  const [f, setF] = useState({ banque: "", compte: "", cheque: "" });
  const [fait, setFait] = useState<{ piece: string } | null>(null);
  const [fiche, setFiche] = useState<"" | "echeancier" | "contrat" | "reconnaissance">("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const [j, u, t] = await Promise.all([api.journees.courante(), api.session.courante(), api.transferts.contexte().catch(() => ({ banques: [], comptes: [] }))]);
    return { j, t, droits: new Set((u as { droits?: string[] } | null)?.droits ?? []), d: cid && !fait ? await api.deblocage.detail(cid) : null };
  }, [cid, fait]);
  if (!donnees) return <Chargement />;
  const { j, t, droits, d } = donnees;
  const modes = MODES_DEBLOCAGE.filter(([, , dr]) => droits.has(dr));
  const m = mode || modes[0]?.[0] || "";
  const comptes = t.comptes.filter((c) => String(c.banqueId) === f.banque);
  const cb = comptes.find((c) => String(c.id) === f.compte);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const effacer = () => { setCid(null); setF({ banque: "", compte: "", cheque: "" }); setFait(null); };
  const pret = !!d && !fait && (m === "epargne" || (m === "banque" && !!cb && !!f.cheque.trim()));
  function debloquer() {
    if (!d) return;
    const dv = d.devise as Devise;
    setBoite({ type: "confirmation", message: recapitulatif(`Déblocage du crédit ${d.numero}`, [["Client", `${d.client} (${d.membre})`], ["Prêt", montant(d.montant, dv)],
      ["Retenues", montant(d.montant - d.retenues.net, dv)], ["Montant remis", montant(d.retenues.net, dv)],
      m === "banque" ? ["Chèque", f.cheque.trim()] : ["Porté au compte", d.comptePositionnement]]), oui: async () => {
      try {
        // Plan d'allègement, point 7.2 : hors guichet, le déblocage attend son visa et sa validation (registre T138 ; Instr. BCC 008, art. 66)
        await (m === "banque" ? api.deblocage.debloquerBanque(d.id, { compteBancaireId: cb!.id, cheque: f.cheque }) : api.deblocage.debloquerEpargne(d.id));
        setFait({ piece: "" }); setBoite({ type: "succes", message: "Déblocage enregistré : il attend son visa et sa validation dans « Opérations en attente »." });
      } catch (x) { erreur(x); }
    } });
  }
  return (
    <>
      <Formulaire className="bloc pile" label="Déblocage" envoyer={debloquer}>
        <div className="entete-ecran">{fait?.piece ? <p>Numéro de pièce : <strong className="chiffres">{fait.piece}</strong></p> : <span />}
          <Champ libelle="Date Opération :">{(p) => <Lecture {...p} value={fr(j?.date ?? "")} />}</Champ></div>
        <fieldset className="cadre-champs"><legend>Mode *</legend><div className="ligne-champ">
          {modes.map(([k, l]) => <label key={k} className="case"><input type="radio" name="mode-deblocage" checked={m === k} disabled={!!fait} onChange={() => setMode(k)} /><span>{l}</span></label>)}
        </div></fieldset>
        {m === "banque" && <fieldset className="cadre-champs formulaire"><legend>Infos banque</legend>
          <Champ libelle="Banque *">{(p) => <select {...p} className="saisie" value={f.banque} onChange={(e) => setF({ ...f, banque: e.target.value, compte: "" })}><option value=""></option>
            {t.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
          <Champ libelle="Compte *">{(p) => <select {...p} className="saisie" value={f.compte} disabled={!f.banque} onChange={(e) => setF({ ...f, compte: e.target.value })}><option value="">{f.banque ? "" : "Choisir d'abord la banque"}</option>
            {comptes.map((c) => <option key={c.id} value={c.id}>{`${c.compte} (${c.devise})`}</option>)}</select>}</Champ>
          <Champ libelle="Solde banque">{(p) => <Lecture {...p} value={cb ? montant(cb.solde, cb.devise as Devise) : ""} />}</Champ>
          <Champ libelle="N°chèque *">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.cheque} onChange={(e) => setF({ ...f, cheque: e.target.value })} />}</Champ>
        </fieldset>}
        <div className="grille-deux">
          <fieldset className="cadre-champs formulaire"><legend>Infos crédit</legend>
            <Champ libelle="N° crédit">{(p) => <input {...p} className="saisie code" readOnly value={d?.numero ?? ""} />}</Champ>
            <div className="ligne-champ"><ChoixCredit choisir={(x) => { effacer(); setCid(x); }} /></div>
            <InfosCredit d={d} />
          </fieldset>
          <div className="pile">
            <fieldset className="cadre-champs formulaire"><legend>Info Client</legend>
              <Champ libelle="N° Client">{(p) => <Lecture {...p} value={d?.membre ?? ""} />}</Champ>
              <Champ libelle="Intitulé du compte">{(p) => <Lecture {...p} value={d?.client ?? ""} />}</Champ>
              <Champ libelle="Numéro compte">{(p) => <Lecture {...p} value={(m === "banque" ? d?.compteClient : d?.comptePositionnement) ?? ""} />}</Champ>
            </fieldset>
            <fieldset className="cadre-champs"><legend>Frais</legend>{d && <Retenues d={d} />}</fieldset>
            <fieldset className="cadre-champs formulaire"><legend>Financement</legend>
              <Champ libelle="Type budget">{(p) => <Lecture {...p} value={d ? (d.ligneFinancement ? "Ressources affectées" : "Fonds propres") : ""} />}</Champ>
              <Champ libelle="Ligne budgétaire">{(p) => <Lecture {...p} value={d?.ligneFinancement ?? ""} />}</Champ>
            </fieldset>
          </div>
        </div>
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("echeancier")}>Echéancier</button>
          <button className="bouton secondaire" type="button" disabled={!cid} onClick={() => setFiche("contrat")}>Contrat de prêt</button>
          <button className="bouton secondaire" type="button" disabled={!cid} onClick={() => setFiche("reconnaissance")}>Reconnaissance de dette</button>
          <button className="bouton" type="submit" disabled={!pret}>Débloquer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 62 (banque), p. 124, 156 et 157 (compte d'épargne) ; plan d'allègement, point 6.6 : un écran dans le menu Crédit, le mode choisi dedans",
          "Registre S54-2 à S54-5 : chèque d'un chéquier du compte bancaire (S60-5) ; S105-1 à S105-4 : le net est porté au compte d'épargne du client ; retenues (CR-6) ; contrat de prêt (CR-12)",
          "Instr. BCC 008, art. 66 : seul le caissier manie les espèces ; le déblocage en espèces se fait au guichet (S75)"]} />
      </Formulaire>
      <Fiche titre="Echéancier" ouverte={fiche === "echeancier"} fermer={() => setFiche("")}>{d && <Echeancier d={d} fermer={() => setFiche("")} />}</Fiche>
      <Fiche titre="Contrat de prêt" ouverte={fiche === "contrat"} fermer={() => setFiche("")}>{cid && <ContratPret id={cid} titre="Contrat de prêt" fermer={() => setFiche("")} />}</Fiche>
      <Fiche titre="Reconnaissance de dette" ouverte={fiche === "reconnaissance"} fermer={() => setFiche("")}>{cid && <ContratPret id={cid} titre="Reconnaissance de dette" fermer={() => setFiche("")} />}</Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
