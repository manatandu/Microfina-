// S52 (Banque) et S81 (Caisse) : Virements internes de trésorerie (plan d'allègement, point 7.5). Les onglets « V. Banque vers caisse » et « V. Banque vers
// Banque » de S52 (manuel Microfina++, p. 60 et 61) et « Caisse vers caisse », « Caisse vers banque » de S81 (p. 92 et 93) en un écran : De, Vers, Montant.
// Chaque origine avec son droit (S52 : un compte bancaire ; S81 : sa caisse). Depuis une banque, l'opération passe par « Opérations en attente ». Le caissier
// qui reçoit confirme avec son billetage depuis « Fonds à recevoir » (PCCI, comptes 57 et 59).
import { useState } from "react";
import { api, TYPES_CHEQUE } from "../donnees/api";
import type { Operation } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { lireMontant, montant, montantEnLettres, type Comptage, type Devise } from "@design/montant.js";
import { Billetage, Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Formulaire } from "../composants";
import { billetageBon } from "./Guichet";

type Recevable = Awaited<ReturnType<typeof api.transferts.aRecevoir>>[number];

export default function VirementsTresorerie() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const [u, ctx, s] = await Promise.all([api.session.courante(), api.transferts.contexte(), api.caisses.duCaissier()]);
    const droits = new Set((u as { droits?: string[] } | null)?.droits ?? []);
    const lu = droits.has("S52") ? await api.banqueOperations.lire() : null;
    const mienne = droits.has("S81") && s && s.statut === "ouverte" ? ctx.caisses.find((c) => c.sessionId === s.id) : undefined;
    const fonds = s && s.statut === "ouverte" ? await api.transferts.aRecevoir() : [];
    return { ctx, lu, mienne, fonds };
  }, [relu]);
  const VIDE = { de: "", vers: "", date: "", montant: "", montants: {} as Partial<Record<Devise, string>>, bordereau: "", cheque: "" };
  const [f, setF] = useState(VIDE);
  const [coupures, setCoupures] = useState<Partial<Record<Devise, Comptage>>>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [recoit, setRecoit] = useState<Recevable | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { ctx, lu, mienne, fonds } = donnees;
  const devises = ctx.devises as Devise[];
  const nouveau = () => { setCle(nouvelleCle()); setFait(null); };
  const maj = (x: Partial<typeof VIDE>, garder = false) => { setF((v) => ({ ...v, ...x })); if (!garder) setCoupures({}); nouveau(); };
  const annuler = () => { setF(VIDE); setCoupures({}); nouveau(); };

  // De : sa caisse (S81), les comptes bancaires (S52) ; Vers : selon l'origine
  const compteB = (id: string) => ctx.comptes.find((c) => `banque:${c.id}` === id);
  const deCaisse = f.de === "caisse" && mienne;
  const deBanque = compteB(f.de);
  const versCaisse = ctx.caisses.find((c) => `caisse:${c.sessionId}` === f.vers);
  const versGuichet = lu?.guichets.find((g) => `guichet:${g.id}` === f.vers);
  const versBanque = compteB(f.vers);
  const nomBanque = (c: (typeof ctx.comptes)[number]) => `${c.banqueCode} ${c.numero} (${c.devise})`;
  const versCaisses = deCaisse ? ctx.caisses.filter((c) => c.sessionId !== mienne.sessionId).map((c) => [`caisse:${c.sessionId}`, c.nom])
    : deBanque ? (lu?.guichets ?? []).map((g) => [`guichet:${g.id}`, g.nom]) : [];
  const versBanques = deCaisse || deBanque ? ctx.comptes.filter((c) => c.id !== deBanque?.id).map((c) => [`banque:${c.id}`, nomBanque(c)]) : [];
  const parDevise = !!(deCaisse && versCaisse);                                     // caisse vers caisse : un montant par devise (registre T12)
  const dv = ((deBanque ?? versBanque)?.devise ?? "CDF") as Devise;
  const lire = (t?: string) => (t?.trim() ? lireMontant(t) : 0);
  const saisis = parDevise ? devises.filter((d) => (lire(f.montants[d]) ?? 0) > 0) : (lire(f.montant) ?? 0) > 0 ? [dv] : [];
  const m = (d: Devise) => (parDevise ? lire(f.montants[d]) : lire(f.montant)) ?? 0;
  const soldeCaisse = (c?: { soldes: Partial<Record<Devise, number>> }) => (c ? devises.map((d) => montant(c.soldes[d] ?? 0, d)).join(" · ") : "");
  const soldeDe = deCaisse ? soldeCaisse(mienne) : deBanque ? montant(deBanque.solde, deBanque.devise as Devise) : "";
  const soldeVers = versCaisse ? soldeCaisse(versCaisse) : versGuichet ? soldeCaisse(versGuichet) : versBanque ? montant(versBanque.solde, versBanque.devise as Devise) : "";
  const billets = !!deCaisse && saisis.length > 0 && !fait;
  const pret = !!f.de && !!f.vers && saisis.length > 0 && !fait && (!deCaisse || saisis.every((d) => billetageBon(coupures[d] ?? {}, m(d))))
    && (!(deCaisse && versBanque) || !!f.bordereau.trim());

  function enregistrer() {
    const envoi = deCaisse && versCaisse
      ? () => api.transferts.caisseVersCaisse({ cle, origineSessionId: mienne.sessionId, destinationSessionId: versCaisse.sessionId,
          montants: Object.fromEntries(saisis.map((d) => [d, m(d)])), coupures: Object.fromEntries(saisis.map((d) => [d, coupures[d] ?? {}])) })
      : deCaisse && versBanque
      ? () => api.transferts.caisseVersBanque({ cle, sessionId: mienne.sessionId, banqueId: versBanque.banqueId, compteBancaireId: versBanque.id, montant: m(dv), cheque: f.bordereau, coupures: coupures[dv] ?? {} })
      : deBanque && versGuichet
      ? () => api.banqueOperations.enregistrer({ cle, date: f.date || ctx.date, type: "banque_caisse", compteBancaireId: deBanque.id, guichetId: versGuichet.id, montant: m(dv), cheque: f.cheque })
      : deBanque && versBanque
      ? () => api.banqueOperations.enregistrer({ cle, date: f.date || ctx.date, type: "banque_banque", compteBancaireId: deBanque.id, compteBancaireDestId: versBanque.id, montant: m(dv) })
      : null;
    if (!envoi) { setBoite({ type: "erreur", message: "À remplir : De, Vers, Montant." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const r = await envoi();
        if (deCaisse) { setFait(r as Operation); setRelu((v) => v + 1); } else annuler();
        setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      {mienne !== undefined || fonds.length > 0 ? <FondsARecevoir fonds={fonds} recevoir={setRecoit} /> : null}
      <Formulaire className="bloc pile" label="Virement interne" envoyer={enregistrer}>
        <Entete fait={fait} date={ctx.date} />
        <fieldset className="cadre-champs formulaire">
          <legend>Virement interne</legend>
          {deBanque ? <ChampDate libelle="Date opération" valeur={f.date || ctx.date} onChange={(v) => maj({ date: v }, true)} /> : null}
          <div className="pile">
            <Champ libelle="De *">{(p) => <select {...p} className="saisie" disabled={!!fait} value={f.de} onChange={(e) => maj({ de: e.target.value, vers: "", montant: "", montants: {}, cheque: "" })}>
              <option value=""></option>
              {mienne && <optgroup label="Caisses"><option value="caisse">{mienne.nom}</option></optgroup>}
              {lu && <optgroup label="Banques">{ctx.comptes.map((c) => <option key={c.id} value={`banque:${c.id}`}>{nomBanque(c)}</option>)}</optgroup>}</select>}</Champ>
            {soldeDe && <p>Solde : <strong className="chiffres">{soldeDe}</strong></p>}
          </div>
          <div className="pile">
            <Champ libelle="Vers *">{(p) => <select {...p} className="saisie" disabled={!!fait || !f.de} value={f.vers} onChange={(e) => maj({ vers: e.target.value, montant: "", montants: {} })}>
              <option value=""></option>
              {versCaisses.length > 0 && <optgroup label="Caisses">{versCaisses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>}
              {versBanques.length > 0 && <optgroup label="Banques">{versBanques.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>}</select>}</Champ>
            {soldeVers && <p>Solde : <strong className="chiffres">{soldeVers}</strong></p>}
          </div>
          {parDevise
            ? devises.map((d) => <Champ key={d} libelle={`Montant (${d})${d === devises[0] ? " *" : ""}`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off"
                readOnly={!!fait} value={f.montants[d] ?? ""} onChange={(e) => maj({ montants: { ...f.montants, [d]: e.target.value } })} />}</Champ>)
            : <Champ libelle={`Montant${f.vers ? ` (${dv})` : ""} *`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off"
                readOnly={!!fait || !f.vers} value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>}
          {deCaisse && versBanque && <Champ libelle="N° du bordereau de versement *">{(p) => <input {...p} className="saisie code" autoComplete="off" readOnly={!!fait}
            value={f.bordereau} onChange={(e) => maj({ bordereau: e.target.value }, true)} />}</Champ>}
          {deBanque && versGuichet && lu && <Champ libelle="N° de chèque">{(p) => <select {...p} className="saisie" value={f.cheque} onChange={(e) => maj({ cheque: e.target.value }, true)}>
            <option value=""></option>{lu.cheques.filter((q) => q.compteBancaireId === deBanque.id).map((q) =>
              <option key={q.id} value={q.numero}>{q.type && q.type !== "ordinaire" ? `${q.numero} (${TYPES_CHEQUE[q.type]})` : q.numero}</option>)}</select>}</Champ>}
        </fieldset>
        <p className="montant-lettres">{saisis.map((d) => montantEnLettres(m(d), d)).join(" ; ")}</p>
        {billets && mienne && <fieldset className="pile cadre-champs"><legend>Billetage</legend>
          {saisis.map((d) => <BilletageSortie key={d} sessionId={mienne.sessionId} devise={d} comptage={coupures[d] ?? {}} cible={m(d)}
            onChange={(c) => { setCoupures((x) => ({ ...x, [d]: c })); nouveau(); }} />)}</fieldset>}
        <div className="actions-onglets">
          <button className="bouton" type="submit" disabled={!pret}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 60 et 61 (Banque > Opération : banque vers caisse, banque vers banque) et p. 92 et 93 (Caisse > Transferts : caisse vers caisse, caisse vers banque) ; plan d'allègement, point 7.5",
          "PCCI, compte 57 : le 579 sert de contrepartie entre les caisses, nul en fin de journée ; compte 59 : virements internes, compte d'attente soldé en fin de période",
          "Depuis une banque : visa et validation dans « Opérations en attente » (Instr. BCC 008, art. 66) ; billetage de la caisse qui envoie et de celle qui reçoit"]} />
      </Formulaire>
      <Fiche titre="Recevoir des fonds" ouverte={!!recoit} fermer={() => setRecoit(null)}>
        {recoit && <Reception x={recoit} fermer={() => setRecoit(null)} fait={() => { setRecoit(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }} />}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Numéro de pièce (après Enregistrer) et date de l'opération */
function Entete({ fait, date }: { fait: Operation | null; date: string }) {
  const { donnees: piece } = useDonnees(async () => (fait ? (await api.operations.recu(fait.id)).piece : ""), [fait?.id]);
  return (
    <div className="entete-ecran">
      {piece ? <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p> : null}
      <p>Date opération : <strong className="chiffres">{fr(date)}</strong></p>
    </div>
  );
}

/** « Fonds à recevoir » de sa caisse : envoyés par une autre caisse, ou virés de la banque et validés */
function FondsARecevoir({ fonds, recevoir }: { fonds: Recevable[]; recevoir: (x: Recevable) => void }) {
  return (
    <section className="bloc pile" aria-label="Fonds à recevoir">
      <h2>Fonds à recevoir</h2>
      <div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">Date</th><th scope="col">De</th><th scope="col" className="num">Montant</th><th scope="col">Envoyé par</th><th scope="col"><span className="sr-only">Recevoir</span></th></tr></thead>
        <tbody>{fonds.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
          {fonds.map((x) => <tr key={`${x.source}-${x.id}`}><td className="chiffres">{fr(x.date)}</td><td>{x.de}</td><td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td>
            <td>{x.envoyePar}</td><td><button className="bouton secondaire petit" type="button" aria-label={`Recevoir ${montant(x.montant, x.devise as Devise)} de ${x.de}`} onClick={() => recevoir(x)}>Recevoir</button></td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

/** Le caissier compte les billets reçus ; le billetage fait le montant */
function Reception({ x, fermer, fait }: { x: Recevable; fermer: () => void; fait: () => void }) {
  const [c, setC] = useState<Comptage>({});
  const [cle] = useState(nouvelleCle);
  const [boite, setBoite] = useState<Boite | null>(null);
  const dv = x.devise as Devise;
  function recevoir() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.transferts.recevoir({ cle, source: x.source, id: x.id, coupures: c }); fait(); }
      catch (e) { setBoite({ type: "erreur", message: message(e) }); }
    } });
  }
  return (
    <div className="pile">
      <Champ libelle="De">{(p) => <Lecture {...p} value={x.de} />}</Champ>
      <Champ libelle="Montant">{(p) => <Lecture {...p} value={montant(x.montant, dv)} />}</Champ>
      <Billetage devise={dv} comptage={c} onChange={setC} cible={x.montant} sens="recue" />
      <div className="actions-onglets">
        <button className="bouton" type="button" disabled={!billetageBon(c, x.montant)} onClick={recevoir}>Recevoir</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Annuler</button>
      </div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </div>
  );
}

/** Billetage des coupures qui sortent d'une caisse : le stock de la caisse limite chaque coupure */
function BilletageSortie({ sessionId, devise, comptage, cible, onChange }: { sessionId: number; devise: Devise; comptage: Comptage; cible: number; onChange: (c: Comptage) => void }) {
  const { donnees: stock } = useDonnees(() => api.caisses.theorique(sessionId, devise), [sessionId, devise]);
  if (!stock) return <Chargement />;
  return <Billetage devise={devise} comptage={comptage} onChange={onChange} cible={cible} sens="remise" stock={stock} />;
}
