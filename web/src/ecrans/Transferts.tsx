// S81 : Caisse > Transferts de fonds (manuel Microfina++, p. 92 et 93 ; doublons p. 106 et 107) : Caisse vers caisse, Caisse vers banque.
// Plan d'allègement, point 4.10 : la caisse d'origine est celle de l'utilisateur ; banque et compte avant le montant ; billetage sous le montant (4.2).
// Billetage sur les deux (décision du porteur du 19/11/2026). Registre S81-1 à S81-7.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import type { Operation } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { lireMontant, montant, montantEnLettres, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Lecture, Textes, type Boite } from "../composants";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { billetageBon } from "./Guichet";

const PAGES = [["caisse", "Caisse vers caisse"], ["banque", "Caisse vers banque"]] as const;
type Page = (typeof PAGES)[number][0];
type Contexte = Awaited<ReturnType<typeof api.transferts.contexte>>;

export default function Transferts() {
  const [params, setParams] = useSearchParams();
  const page = (PAGES.some(([k]) => k === params.get("page")) ? params.get("page") : "caisse") as Page;
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => ({ ctx: await api.transferts.contexte(), s: await api.caisses.duCaissier() }), [relu]);
  if (!donnees) return <Chargement />;
  const { ctx } = donnees;
  // La caisse d'origine est celle de l'utilisateur (plan d'allègement, point 4.10)
  const mienne = donnees.s && donnees.s.statut === "ouverte" ? ctx.caisses.find((c) => c.sessionId === donnees.s!.id) : undefined;
  if (!mienne) return <Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention>;
  return (
    <>
      <div className="onglets" role="tablist" aria-label="Transferts de fonds">
        {PAGES.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => setParams({ page: k })}>{l}</button>)}
      </div>
      {page === "caisse" ? <CaisseVersCaisse key="caisse" ctx={ctx} o={mienne} relire={() => setRelu((v) => v + 1)} /> : <CaisseVersBanque key="banque" ctx={ctx} s={mienne} relire={() => setRelu((v) => v + 1)} />}
    </>
  );
}

/** En-tête commun aux deux captures : Numéro de pièce (après Enregistrer) et Date operation (la journée ouverte) */
function Entete({ fait, date }: { fait: Operation | null; date: string }) {
  const { donnees: piece } = useDonnees(async () => (fait ? (await api.operations.recu(fait.id)).piece : ""), [fait?.id]);
  return (
    <div className="entete-ecran">
      {(piece ?? "") ? <p>Numéro de pièce : <strong className="chiffres">{piece ?? ""}</strong></p> : null}
      <p>Date opération : <strong className="chiffres">{fr(date)}</strong></p>
    </div>
  );
}

type Caisse = Contexte["caisses"][number];
type Proprietes = { ctx: Contexte; relire: () => void };

/** 3-1 Caisse vers caisse (capture p. 92) : « ALIMENTATION DE GUICHET » : Caisse d'origine, Montant, Caisse destination (registre S81-2, S81-4) */
function CaisseVersCaisse({ ctx, o, relire }: Proprietes & { o: Caisse }) {
  const VIDE = { destination: "", montants: {} as Partial<Record<Devise, string>> };
  const [f, setF] = useState(VIDE);
  const [coupures, setCoupures] = useState<Partial<Record<Devise, Comptage>>>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const devises = ctx.devises as Devise[];
  const d = ctx.caisses.find((c) => String(c.sessionId) === f.destination);
  const lu = (dv: Devise) => { const t = f.montants[dv]?.trim(); return t ? lireMontant(t) : 0; };
  const saisies = devises.filter((dv) => (lu(dv) ?? 0) > 0);
  const nouveau = () => { setCle(nouvelleCle()); setFait(null); };
  const annuler = () => { setF(VIDE); setCoupures({}); nouveau(); };
  function enregistrer() {
    if (!d || saisies.length === 0) { setBoite({ type: "erreur", message: "À remplir : Montant, Caisse destination." }); return; }
    if (devises.some((dv) => lu(dv) === null)) { setBoite({ type: "erreur", message: "Montant invalide." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const r = await api.transferts.caisseVersCaisse({ cle, origineSessionId: o.sessionId, destinationSessionId: d.sessionId,
          montants: Object.fromEntries(saisies.map((dv) => [dv, lu(dv) ?? 0])), coupures: Object.fromEntries(saisies.map((dv) => [dv, coupures[dv] ?? {}])) });
        setFait(r); relire(); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const soldes = (c?: Contexte["caisses"][number]) => c ? <p className="chiffres">{c.caissier} · {devises.map((dv) => montant(c.soldes[dv] ?? 0, dv)).join(" · ")}</p> : null;
  return (
    <section className="bloc pile" aria-label="Caisse vers Caisse">
      <h2>Caisse vers Caisse</h2>
      <Entete fait={fait} date={ctx.date} />
      <fieldset className="cadre-champs formulaire">
        <legend>ALIMENTATION DE GUICHET</legend>
        <div className="pile">
          <Champ libelle="Caisse d'origine">{(p) => <Lecture {...p} value={o.nom} />}</Champ>
          {soldes(o)}
        </div>
        <div className="pile">
          {devises.map((dv) => <Champ key={dv} libelle={`Montant (${dv})${dv === devises[0] ? " *" : ""}`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off"
            readOnly={!!fait} value={f.montants[dv] ?? ""} onChange={(e) => { setF({ ...f, montants: { ...f.montants, [dv]: e.target.value } }); setCoupures({ ...coupures, [dv]: {} }); nouveau(); }} />}</Champ>)}
        </div>
        <div className="pile">
          <Champ libelle="Caisse destination *">{(p) => <select {...p} className="saisie" disabled={!!fait} value={f.destination} onChange={(e) => { setF({ ...f, destination: e.target.value }); nouveau(); }}>
            <option value=""></option>{ctx.caisses.filter((c) => c.sessionId !== o.sessionId).map((c) => <option key={c.sessionId} value={c.sessionId}>{c.nom}</option>)}</select>}</Champ>
          {soldes(d)}
        </div>
      </fieldset>
      <p className="montant-lettres">{saisies.map((dv) => montantEnLettres(lu(dv) ?? 0, dv)).join(" ; ")}</p>
      {saisies.length > 0 && !fait && <fieldset className="pile cadre-champs"><legend>Billetage</legend>
        {saisies.map((dv) => <BilletageSortie key={dv} sessionId={o.sessionId} devise={dv} comptage={coupures[dv] ?? {}} cible={lu(dv) ?? 0}
          onChange={(c) => { setCoupures({ ...coupures, [dv]: c }); nouveau(); }} />)}</fieldset>}
      <div className="actions-onglets">
        <button className="bouton" type="button" disabled={!d || saisies.length === 0 || !!fait || !saisies.every((dv) => billetageBon(coupures[dv] ?? {}, lu(dv)))} onClick={enregistrer}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
      </div>
      <Textes sources={["Manuel Microfina++, p. 92 (doublon p. 106) : choisir la caisse d'origine, saisir le montant et la caisse de destination, Enregistrer ou Annuler ; capture Caisse vers Caisse",
        "PCCI, compte 57 : le compte 579 « Mouvements de fonds inter caisses » sert de contrepartie entre les caisses ; son solde doit être nul en fin de journée (registre S81-2)",
        "Registre T12 : un montant par devise ; billetage (décision du porteur du 19/11/2026, registre S81-4)"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** Billetage des coupures qui sortent d'une caisse : le stock de la caisse limite chaque coupure */
function BilletageSortie({ sessionId, devise, comptage, cible, onChange }: { sessionId: number; devise: Devise; comptage: Comptage; cible: number; onChange: (c: Comptage) => void }) {
  const { donnees: stock } = useDonnees(() => api.caisses.theorique(sessionId, devise), [sessionId, devise]);
  if (!stock) return <Chargement />;
  return <Billetage devise={devise} comptage={comptage} onChange={onChange} cible={cible} sens="remise" stock={stock} />;
}

/** 3-2 Caisse vers banque (capture p. 93) : « Virement de Caisse vers Banque », Encaissement Especes : Caisse, Montant, Banque, Compte Banque, No de chèque (registre S81-3, S81-5) */
function CaisseVersBanque({ ctx, s, relire }: Proprietes & { s: Caisse }) {
  const VIDE = { montant: "", banque: "", compte: "", cheque: "" };
  const [f, setF] = useState(VIDE);
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const comptes = ctx.comptes.filter((c) => String(c.banqueId) === f.banque);
  const cb = comptes.find((c) => String(c.id) === f.compte);
  const dv = (cb?.devise ?? "CDF") as Devise;
  const m = f.montant.trim() ? lireMontant(f.montant) : 0;
  const nouveau = () => { setCle(nouvelleCle()); setFait(null); };
  const maj = (x: Partial<typeof VIDE>, garderCoupures = false) => { setF({ ...f, ...x }); if (!garderCoupures) setCoupures({}); nouveau(); };
  function enregistrer() {
    if (!cb || !m || !f.cheque.trim()) { setBoite({ type: "erreur", message: "À remplir : Banque, Compte Banque, Montant, N° du bordereau de versement." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const r = await api.transferts.caisseVersBanque({ cle, sessionId: s.sessionId, banqueId: Number(f.banque), compteBancaireId: cb.id, montant: m, cheque: f.cheque, coupures });
        setFait(r); relire(); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <section className="bloc pile" aria-label="Caisse vers Banque">
      <h2>Caisse vers Banque</h2>
      <Entete fait={fait} date={ctx.date} />
      <fieldset className="cadre-champs formulaire">
        <legend>Virement de Caisse vers Banque</legend>
        <div className="pile">
          <Champ libelle="Caisse">{(p) => <Lecture {...p} value={s.nom} />}</Champ>
          <p>Solde de la caisse : <strong className="chiffres">{cb ? montant(s.soldes[dv] ?? 0, dv) : ""}</strong></p>
        </div>
        <div className="pile">
          <Champ libelle="Banque *">{(p) => <select {...p} className="saisie" disabled={!!fait} value={f.banque} onChange={(e) => maj({ banque: e.target.value, compte: "" })}>
            <option value=""></option>{ctx.banques.map((b) => <option key={b.id} value={b.id}>{`${b.code}:${b.libelle}`}</option>)}</select>}</Champ>
          <p>Solde de la Banque : <strong className="chiffres">{cb ? montant(cb.solde, dv) : ""}</strong></p>
        </div>
        <Champ libelle="Compte Banque *">{(p) => <select {...p} className="saisie" disabled={!!fait} value={f.compte} onChange={(e) => maj({ compte: e.target.value })}>
          <option value=""></option>{comptes.map((c) => <option key={c.id} value={c.id}>{`${c.compte} ${c.intitule} (${c.devise})`}</option>)}</select>}</Champ>
        <Champ libelle={`Montant${cb ? ` (${dv})` : ""} *`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" readOnly={!!fait || !cb} value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
        <Champ libelle="N° du bordereau de versement *">{(p) => <input {...p} className="saisie code" autoComplete="off" readOnly={!!fait} value={f.cheque} onChange={(e) => maj({ cheque: e.target.value }, true)} />}</Champ>
      </fieldset>
      <p className="montant-lettres">{m ? montantEnLettres(m, dv) : ""}</p>
      {cb && m && !fait ? <fieldset className="pile cadre-champs"><legend>Billetage</legend>
        <BilletageSortie sessionId={s.sessionId} devise={dv} comptage={coupures} cible={m} onChange={(c) => { setCoupures(c); nouveau(); }} /></fieldset> : null}
      <div className="actions-onglets">
        <button className="bouton" type="button" disabled={!cb || !m || !f.cheque.trim() || !!fait || !billetageBon(coupures, m)} onClick={enregistrer}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={() => { setF(VIDE); setCoupures({}); nouveau(); }}>Annuler</button>
      </div>
      <Textes sources={["Manuel Microfina++, p. 92 et 93 (doublons p. 106 et 107) : choisir la caisse d'alimentation, saisir le montant, la banque et son compte, saisir le numéro de chèque, Enregistrer ou Annuler ; capture Caisse vers Banque",
        "PCCI, compte 59 : 591 « Virement caisse à banque », compte d'attente soldé dans la même écriture (registre S81-3)",
        "Montant dans la devise du compte bancaire (registre S81-5) ; billetage (décision du porteur du 19/11/2026, registre S81-4)"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
