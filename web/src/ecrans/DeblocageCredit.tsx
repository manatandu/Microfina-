// S75 : Caisse > Opération > Déblocage crédit (manuel Microfina++, p. 86 et 87, capture « Déblocage crédit »), S54 : Banque > Déblocage crédit (p. 62)
// et S105 : Comptabilité > Déblocage crédit sur le compte d'épargne (p. 124, 156 et 157).
// Choisir le crédit visé, Encaisser frais (Prélever les frais par banque), Débloquer ; échéancier, contrat de prêt, reconnaissance de dette.
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
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { OngletsGuichet, SoldesCaisse } from "./Guichet";
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
        <div className="info-ligne"><dt>Épargne obligatoire</dt><dd className="chiffres">{montant(r.epargneObligatoire, dv)}</dd></div>
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
  const [relu, setRelu] = useState(0);
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [fiche, setFiche] = useState<"" | "billetage" | "echeancier" | "frais" | "reconnaissance" | "contrat">("");
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
  const { s, ctx, u, j, d, stock, piece } = donnees;
  if (!s || s.statut !== "ouverte") return <><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>;
  const dv = (d?.devise ?? fait?.devise ?? "CDF") as Devise;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const effacer = () => { setCid(null); setCoupures({}); setCle(nouvelleCle()); setFait(null); };
  function encaisser() {
    if (!d) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment encaisser les frais ?", oui: async () => {
      try { await api.deblocage.encaisserFrais(d.id); setFiche(""); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Frais encaissés : ils sont retenus sur le prêt au déblocage." }); }
      catch (x) { erreur(x); }
    } });
  }
  function debloquer() {
    if (!d) return;
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment débloquer le crédit ${d.numero}, ${d.client} ? Montant du prêt : ${montant(d.montant, d.devise as Devise)}.`, oui: async () => {
      try { const o = await api.deblocage.debloquerCaisse(d.id, { cle, coupures }); setFait(o); setBoite({ type: "succes", message: "Crédit débloqué avec succès !" }); }
      catch (x) { erreur(x); }
    } });
  }
  return (
    <>
      
      <OngletsGuichet />
      <section className="bloc pile" aria-label="Déblocage crédit">
        <div className="entete-ecran">{(piece) ? <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p> : null}<p>Date Opération : <strong className="chiffres">{fr(j?.date ?? "")}</strong></p></div>
        <div className="cadre-champs"><dl className="infos">
          <div className="info-ligne"><dt>Agence</dt><dd>{ctx.agence.nom}</dd></div>
          <div className="info-ligne"><dt>Nom</dt><dd>{ctx.guichets.find((g) => g.id === s.guichetId)?.nom ?? ""}</dd></div>
          <div className="info-ligne"><dt>Caissier</dt><dd>{u?.nom ?? ""}</dd></div>
          <SoldesCaisse sessionId={s.id} />
        </dl></div>
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
            {d && <p>{d.fraisEncaisses ? "Frais encaissés." : "Frais à encaisser."} Montant remis : <strong className="chiffres">{montant(d.retenues.net, dv)}</strong></p>}
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("echeancier")}>Echéancier</button>
          <button className="bouton secondaire" type="button" disabled={!d || d.fraisEncaisses || !!fait} onClick={() => setFiche("frais")}>Encaisser frais</button>
          <button className="bouton secondaire" type="button" disabled={!d || !d.fraisEncaisses || !!fait} onClick={() => setFiche("billetage")}>Billetage</button>
          <button className="bouton" type="button" disabled={!d || !d.fraisEncaisses || !!fait} onClick={debloquer}>Débloquer</button>
          <button className="bouton secondaire" type="button" disabled={!cid} onClick={() => setFiche("reconnaissance")}>Reconnaissance de dette</button>
          <button className="bouton secondaire" type="button" disabled={!cid} onClick={() => setFiche("contrat")}>Contrat de prêt</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 86 : sélectionner le crédit à décaisser, Encaisser frais, Débloquer ; visualiser l'échéancier et le contrat de prêt ; capture p. 87",
          "Registre CR-6 : frais, assurance, épargne obligatoire et fonds de solidarité retenus sur le prêt ; l'épargne obligatoire est bloquée en garantie (Instr. BCC 38, art. 9)",
          "Registre S75-1 : échéance d'un jour non ouvré reportée au premier jour ouvré ; CR-10 : octroi à déclarer à la Centrale des risques (Instr. BCC 05, art. 10) ; billetage (S75-5)"]} />
      </section>
      <Fiche titre="Frais" ouverte={fiche === "frais"} fermer={() => setFiche("")}>
        {d && <div className="pile"><Retenues d={d} /><div className="actions-onglets"><button className="bouton" type="button" onClick={encaisser}>Encaisser frais</button>
          <button className="bouton secondaire" type="button" onClick={() => setFiche("")}>Fermer</button></div></div>}
      </Fiche>
      <Fiche titre="Billetage" ouverte={fiche === "billetage"} fermer={() => setFiche("")}>
        {d && <div className="pile"><Billetage devise={dv} comptage={coupures} onChange={(c) => { setCoupures(c); setCle(nouvelleCle()); }} cible={d.retenues.net} sens="remise" stock={stock} />
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setFiche("")}>Fermer</button></div></div>}
      </Fiche>
      <Fiche titre="Echéancier" ouverte={fiche === "echeancier"} fermer={() => setFiche("")}>{d && <Echeancier d={d} fermer={() => setFiche("")} />}</Fiche>
      <Fiche titre="Reconnaissance de dette" ouverte={fiche === "reconnaissance"} fermer={() => setFiche("")}>{cid && <ContratPret id={cid} titre="Reconnaissance de dette" fermer={() => setFiche("")} />}</Fiche>
      <Fiche titre="Contrat de prêt" ouverte={fiche === "contrat"} fermer={() => setFiche("")}>{cid && <ContratPret id={cid} titre="Contrat de prêt" fermer={() => setFiche("")} />}</Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S54 : Banque > Déblocage crédit (capture p. 62) : Infos banque, Infos crédit, Info client, Frais, Financement ; Contrat de prêt */
export function DeblocageBanque() {
  const [cid, setCid] = useState<number | null>(null);
  const [relu, setRelu] = useState(0);
  const [f, setF] = useState({ banque: "", compte: "", cheque: "" });
  const [fait, setFait] = useState(false);
  const [fiche, setFiche] = useState<"" | "echeancier" | "contrat">("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => ({ t: await api.transferts.contexte(), d: cid && !fait ? await api.deblocage.detail(cid) : null }), [cid, relu, fait]);
  if (!donnees) return <Chargement />;
  const { t, d } = donnees;
  const comptes = t.comptes.filter((c) => String(c.banqueId) === f.banque);
  const cb = comptes.find((c) => String(c.id) === f.compte);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const effacer = () => { setCid(null); setF({ banque: "", compte: "", cheque: "" }); setFait(false); };
  function prelever() {
    if (!d) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment prélever les frais ?", oui: async () => {
      try { await api.deblocage.encaisserFrais(d.id); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Frais prélevés : ils sont retenus sur le prêt au déblocage." }); }
      catch (x) { erreur(x); }
    } });
  }
  function debloquer() {
    if (!d || !cb) return;
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment débloquer le crédit ${d.numero}, ${d.client} ? Montant du prêt : ${montant(d.montant, d.devise as Devise)}.`, oui: async () => {
      try { await api.deblocage.debloquerBanque(d.id, { compteBancaireId: cb.id, cheque: f.cheque }); setFait(true); setBoite({ type: "succes", message: "Crédit débloqué avec succès !" }); }
      catch (x) { erreur(x); }
    } });
  }
  return (
    <>
      <h2>Déblocage crédit</h2>
      <section className="bloc pile" aria-label="Déblocage crédit par banque">
        <fieldset className="cadre-champs formulaire"><legend>Infos banque</legend>
          <Champ libelle="Banque *">{(p) => <select {...p} className="saisie" value={f.banque} onChange={(e) => setF({ ...f, banque: e.target.value, compte: "" })}><option value=""></option>
            {t.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
          <Champ libelle="Compte *">{(p) => <select {...p} className="saisie" value={f.compte} disabled={!f.banque} onChange={(e) => setF({ ...f, compte: e.target.value })}><option value="">{f.banque ? "" : "Choisir d'abord la banque"}</option>
            {comptes.map((c) => <option key={c.id} value={c.id}>{`${c.compte} (${c.devise})`}</option>)}</select>}</Champ>
          <p>Solde banque <strong className="chiffres">{cb ? montant(cb.solde, cb.devise as Devise) : ""}</strong></p>
          <Champ libelle="N°chèque *">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.cheque} onChange={(e) => setF({ ...f, cheque: e.target.value })} />}</Champ>
        </fieldset>
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
              <Champ libelle="Numéro compte">{(p) => <Lecture {...p} value={d?.compteClient ?? ""} />}</Champ>
            </fieldset>
            <fieldset className="cadre-champs"><legend>Frais</legend>{d && <><Retenues d={d} />
              <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={d.fraisEncaisses} onClick={prelever}>Prélever les frais</button></div></>}</fieldset>
            <fieldset className="cadre-champs formulaire"><legend>Financement</legend>
              <Champ libelle="Ligne budgetaire">{(p) => <Lecture {...p} value={d?.ligneFinancement ?? ""} />}</Champ>
            </fieldset>
          </div>
        </div>
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("echeancier")}>Echéancier</button>
          <button className="bouton secondaire" type="button" disabled={!cid} onClick={() => setFiche("contrat")}>Contrat de prêt</button>
          <button className="bouton" type="button" disabled={!d || !d.fraisEncaisses || !cb || !f.cheque.trim() || fait} onClick={debloquer}>Débloquer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 62 : infos banque (banque, compte, solde, numéro de chèque), infos crédit, info client, frais, financement ; contrat de prêt ; capture",
          "Registre S54-2 à S54-5 : chèque d'un chéquier du compte bancaire (S60-5) ; retenues (CR-6) ; contrat de prêt (CR-12)"]} />
      </section>
      <Fiche titre="Echéancier" ouverte={fiche === "echeancier"} fermer={() => setFiche("")}>{d && <Echeancier d={d} fermer={() => setFiche("")} />}</Fiche>
      <Fiche titre="Contrat de prêt" ouverte={fiche === "contrat"} fermer={() => setFiche("")}>{cid && <ContratPret id={cid} titre="Contrat de prêt" fermer={() => setFiche("")} />}</Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S105 : Comptabilité > Déblocage crédit (captures p. 124 et 157) : Infos crédit, Info Client, Frais, Financement ; Echéancier, Contrat de prêt, Reconnaissance de dette */
export function DeblocageEpargne() {
  const [cid, setCid] = useState<number | null>(null);
  const [relu, setRelu] = useState(0);
  const [fait, setFait] = useState<{ piece: string } | null>(null);
  const [fiche, setFiche] = useState<"" | "echeancier" | "contrat" | "reconnaissance">("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => ({ j: await api.journees.courante(), d: cid && !fait ? await api.deblocage.detail(cid) : null }), [cid, relu, fait]);
  if (!donnees) return <Chargement />;
  const { j, d } = donnees;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const effacer = () => { setCid(null); setFait(null); };
  function prelever() {
    if (!d) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment prélever les frais ?", oui: async () => {
      try { await api.deblocage.encaisserFrais(d.id); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Frais prélevés : ils sont retenus sur le prêt au déblocage." }); }
      catch (x) { erreur(x); }
    } });
  }
  function debloquer() {
    if (!d) return;
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment débloquer le crédit ${d.numero}, ${d.client} ? Montant du prêt : ${montant(d.montant, d.devise as Devise)}.`, oui: async () => {
      try { const x = await api.deblocage.debloquerEpargne(d.id); setFait({ piece: x.piece }); setBoite({ type: "succes", message: "Crédit débloqué avec succès !" }); }
      catch (x) { erreur(x); }
    } });
  }
  return (
    <>
      <h2>Déblocage crédit</h2>
      <section className="bloc pile" aria-label="Déblocage crédit sur compte d'épargne">
        <div className="entete-ecran">{(fait?.piece ?? "") ? <p>Numéro de pièce : <strong className="chiffres">{fait?.piece ?? ""}</strong></p> : null}
          <Champ libelle="Date Opération :">{(p) => <Lecture {...p} value={fr(j?.date ?? "")} />}</Champ></div>
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
              <Champ libelle="Numéro compte">{(p) => <Lecture {...p} value={d?.comptePositionnement ?? ""} />}</Champ>
            </fieldset>
            <fieldset className="cadre-champs"><legend>Frais</legend>{d && <><Retenues d={d} />
              <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={d.fraisEncaisses} onClick={prelever}>Prélever les frais</button></div></>}</fieldset>
            <fieldset className="cadre-champs formulaire"><legend>Financement</legend>
              <Champ libelle="Type budget">{(p) => <Lecture {...p} value={d ? (d.ligneFinancement ? "Ressources affectées" : "Fonds propres") : ""} />}</Champ>
              <Champ libelle="Ligne budgétaire">{(p) => <Lecture {...p} value={d?.ligneFinancement ?? ""} />}</Champ>
            </fieldset>
          </div>
        </div>
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("echeancier")}>Echéancier</button>
          <button className="bouton secondaire" type="button" disabled={!cid} onClick={() => setFiche("contrat")}>Contrat de prêt</button>
          <button className="bouton" type="button" disabled={!d || !d.fraisEncaisses || !!fait} onClick={debloquer}>Débloquer</button>
          <button className="bouton secondaire" type="button" disabled={!cid} onClick={() => setFiche("reconnaissance")}>Reconnaissance de dette</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 124 : infos crédit, info client, frais, financement ; échéancier, contrat de prêt, débloquer ; capture",
          "Manuel Microfina++, p. 156 et 157 : « Déblocage de crédit par positionnement sur compte épargne » ; échéancier et reconnaissance de dette ; capture",
          "Registre S105-1 à S105-4 : le net est porté au compte d'épargne du client ; retenues (CR-6) ; contrat de prêt (CR-12)"]} />
      </section>
      <Fiche titre="Echéancier" ouverte={fiche === "echeancier"} fermer={() => setFiche("")}>{d && <Echeancier d={d} fermer={() => setFiche("")} />}</Fiche>
      <Fiche titre="Contrat de prêt" ouverte={fiche === "contrat"} fermer={() => setFiche("")}>{cid && <ContratPret id={cid} titre="Contrat de prêt" fermer={() => setFiche("")} />}</Fiche>
      <Fiche titre="Reconnaissance de dette" ouverte={fiche === "reconnaissance"} fermer={() => setFiche("")}>{cid && <ContratPret id={cid} titre="Reconnaissance de dette" fermer={() => setFiche("")} />}</Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
