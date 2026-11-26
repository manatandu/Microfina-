import { vers } from "./registre";
import { useEffect, useMemo, useRef, useState, useId } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { boiteOperation } from "../lib/examen";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr, aujourdhui } from "../lib/dates";
import { lireMontant, montant, montantEnLettres, totalComptage, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Formulaire, Paginee, Silhouette, Specimen, Textes, Touche, type Boite, Lecture, LigneFiltres } from "../composants";
import { RechercheClient } from "./Visa";
import { EnTeteDocument, MentionExemplaire, useImpression } from "../composants/Documents";

export const titulaireDe = (t: Tiers) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

/** Une seule entrée « Guichet » : onglets du plus fréquent au plus rare, sous le bandeau de la caisse (plan d'allègement, points 4.1 et 4.5).
 *  Un onglet n'apparaît qu'avec le droit de son écran (registre T07). `version` recharge les soldes après une opération. */
const ONGLETS_GUICHET: [string, string, string][] = [["S74", "?op=depot", "Dépôt"], ["S74", "?op=retrait", "Retrait"], ["S76", "", "Remboursement"], ["S73", "", "Adhésion"],
  ["S75", "", "Déblocage"], ["S77", "", "Parts sociales"], ["S78", "", "Autres encaissements et décaissements"], ["S82", "", "Paiements préparés"]];
export function OngletsGuichet({ version }: { version?: unknown }) {
  const [q] = useSearchParams();
  const op = q.get("op") === "retrait" ? "retrait" : "depot";
  const { donnees } = useDonnees(async () => {
    const [s, u, ctx] = await Promise.all([api.caisses.duCaissier(), api.session.courante(), api.referentiel.contexte()]);
    return { s, u, ctx };
  });
  const droits = new Set((donnees?.u as { droits?: string[] } | undefined)?.droits ?? []);
  const ici = (id: string, requete: string) => location.pathname.endsWith(id.toLowerCase()) && (id !== "S74" || requete === `?op=${op}`);
  const s = donnees?.s && donnees.s.statut === "ouverte" ? donnees.s : null;
  return (
    <>
      {s && <section className="bandeau-caisse" aria-label="Caisse"><dl className="infos">
        <div className="info-ligne"><dt>Caisse</dt><dd>{donnees?.ctx.guichets.find((g) => g.id === s.guichetId)?.nom ?? ""}</dd></div>
        <div className="info-ligne"><dt>Caissier</dt><dd>{donnees?.u?.nom ?? ""}</dd></div>
        <SoldesCaisse key={String(version ?? "")} sessionId={s.id} />
      </dl></section>}
      <nav className="onglets" aria-label="Opération">
        {ONGLETS_GUICHET.filter(([id]) => !donnees || droits.has(id)).map(([id, requete, texte]) =>
          <Link key={texte} to={vers(id, requete)} aria-current={ici(id, requete) ? "page" : undefined}>{texte}</Link>)}
      </nav>
    </>
  );
}

const nomComplet = (t: Tiers) => t.intitule || titulaireDe(t);

/** N° client saisissable (plan d'allègement, point 4.4) : un numéro ou un nom, les clients actifs proposés pendant la frappe ; « Rechercher » reste à côté */
export function ChampClient({ client, choisir, desactive, libelle = "N° client" }: { client: Tiers | null; choisir: (t: Tiers) => void; desactive?: boolean; libelle?: string }) {
  const [q, setQ] = useState<string | null>(null);
  const [proposes, setProposes] = useState<Tiers[]>([]);
  const [actif, setActif] = useState(0);
  const liste = useId();
  useEffect(() => { setActif(0); }, [proposes]);
  useEffect(() => {
    const t = q?.trim() ?? "";
    if (t.length < 2) { setProposes([]); return; }
    let vivant = true;
    const minuterie = setTimeout(() => { void api.tiers.rechercher(t).then((r) => { if (vivant) setProposes(r.filter((x) => x.statut === "actif").slice(0, 8)); }); }, 200);
    return () => { vivant = false; clearTimeout(minuterie); };
  }, [q]);
  const prendre = (t: Tiers) => { setQ(null); setProposes([]); choisir(t); };
  return (
    <div className="champ-client">
      <Champ libelle={libelle}>{(p) => <input {...p} className="saisie code" role="combobox" aria-expanded={proposes.length > 0} aria-autocomplete="list" autoComplete="off"
        aria-controls={liste} aria-activedescendant={proposes[actif] ? `${liste}-${actif}` : undefined}
        disabled={desactive} value={q ?? client?.numero ?? ""} onChange={(e) => setQ(e.target.value)} onBlur={() => setTimeout(() => setProposes([]), 150)}
        onKeyDown={(e) => {
          const n = proposes.length;
          if (n && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); setActif((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n); }
          else if (e.key === "Enter" && proposes[actif]) { e.preventDefault(); prendre(proposes[actif]!); }
          // Échap ferme la liste seule, pas la fiche qui contient la case
          else if (e.key === "Escape" && (n || q !== null)) { e.preventDefault(); e.stopPropagation(); setQ(null); setProposes([]); }
        }} />}</Champ>
      {proposes.length > 0 && <ul className="propositions" role="listbox" id={liste} aria-label="Clients proposés">
        {proposes.map((t, i) => <li key={t.id} id={`${liste}-${i}`} role="option" aria-selected={i === actif} onMouseDown={(e) => { e.preventDefault(); prendre(t); }}>
          <span className="chiffres">{t.numero}</span> {nomComplet(t)}</li>)}</ul>}
    </div>
  );
}

/** Récapitulatif de la confirmation (plan d'allègement, point 4.3) : l'opération, puis client, compte, montant en chiffres et en lettres, versé par ou remis à */
export function recapitulatif(operation: string, lignes: [string, string | undefined][]) {
  return [operation, ...lignes.filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`), "", "Voulez-vous vraiment enregistrer ?"].join("\n");
}
/** Billetage sous le montant (plan d'allègement, point 4.2) : Enregistrer ne s'active que quand le compte des coupures égale le montant */
export const billetageBon = (comptage: Comptage, cible: number | null | undefined) => !!cible && cible > 0 && totalComptage(comptage) === cible;

/** Solde de la caisse dans chaque devise, chargé dès l'ouverture : le même dans tous les onglets du guichet (plan d'allègement, point 0.10 ; registre S74-9) */
export function SoldesCaisse({ sessionId }: { sessionId: number }) {
  const { donnees } = useDonnees(async () => {
    const devises = ((await api.referentiel.contexte()).devises ?? [{ code: "CDF" }, { code: "USD" }]).map((d: { code: string }) => d.code as Devise);
    return Promise.all(devises.map(async (d) => [d, totalComptage(await api.caisses.theorique(sessionId, d))] as const));
  }, [sessionId]);
  return <>{(donnees ?? []).map(([d, m]) => <div key={d} className="info-ligne"><dt>Solde {d}</dt><dd className="chiffres">{montant(m, d)}</dd></div>)}</>;
}

/** S74 : Caisse > Opération > Dépôt / Retrait (manuel Microfina++, p. 86) */
export const MASQUE = "Solde masqué : « Voir solde client » n'est pas coché pour vous (Administration > Guichets, Affecter un caissier)";

export default function GuichetDepotRetrait() {
  const [q] = useSearchParams();
  const op: "depot" | "retrait" = q.get("op") === "retrait" ? "retrait" : "depot";
  const [t, setT] = useState<Tiers | null>(null);
  const [compteId, setCompteId] = useState(0);
  const [saisie, setSaisie] = useState("");
  const [mandataire, setMandataire] = useState("");
  const [procurationId, setProcurationId] = useState<number | null>(null);   // E2 : au retrait, le mandataire vient d'une procuration en cours
  const [motif, setMotif] = useState("");
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [images, setImages] = useState(false);
  const [recu, setRecu] = useState(false);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.releves.releve>> | null>(null);   // registre S74-1
  const [boite, setBoite] = useState<Boite | null>(null);

  const { donnees } = useDonnees(async () => {
    const [s, ctx, u, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.session.courante(), api.journees.courante()]);
    const comptes = t ? await api.tiers.comptes(t.id) : [];
    const c = comptes.find((x) => x.id === compteId) ?? comptes[0];
    const stock = s && c ? await api.caisses.theorique(s.id, c.devise) : {};
    const img = t && images ? await api.tiers.images(t.id) : null;
    const piece = fait ? (await api.operations.recu(fait.id)).piece : "";
    const procurations = t && op === "retrait" ? await api.procurations.enCours(t.id) : [];
    return { s, ctx, u, j, comptes, c, stock, img, piece, procurations };
  }, [t?.id, compteId, fait?.id, images, op]);

  const effacer = () => { setT(null); setCompteId(0); setSaisie(""); setMandataire(""); setProcurationId(null); setMotif(""); setCoupures({}); setCle(nouvelleCle()); setFait(null); };
  // Après le reçu, une nouvelle opération : le focus va à « N° client » (plan d'allègement, point 11.1), une fois la fenêtre fermée
  const nouvelleOperation = () => { setRecu(false); effacer(); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".champ-client input")?.focus()); };
  useEffect(() => { effacer(); }, [op]);   // changer d'onglet repart d'une saisie vierge
  // Arrivée par la recherche globale : le client est déjà choisi
  const tiersDemande = q.get("tiers");
  useEffect(() => {
    if (tiersDemande) void api.tiers.lire(Number(tiersDemande)).then((x) => { if (x) setT(x); });
  }, [tiersDemande, op]);

  if (!donnees) return <Chargement />;
  const { s, j, comptes, c, stock, img, piece, procurations } = donnees;
  if (!s || s.statut !== "ouverte") return (
    <><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>
  );
  const devise: Devise = c?.devise ?? "CDF";
  const m = saisie.trim() ? lireMontant(saisie) : null;
  const nouvelle = () => setCle(nouvelleCle());
  const cadre = op === "depot" ? "Dépôt espèce" : "Retrait en espèces";   // registre S74-3 : texte p. 86

  function enregistrer() {
    if (!t || fait) return;
    const manque = !t ? "N° client" : !c ? "N° compte" : !m ? "Montant" : "";
    if (manque) { setBoite({ type: "erreur", message: `À remplir : ${manque}.` }); return; }
    if (!billetageBon(coupures, m)) return;   // le bouton dit l'écart du billetage (aria-describedby)
    const personne: [string, string] = op === "depot" ? ["Versé par", mandataire.trim() || "Le titulaire"] : ["Remis à", procurationId ? (() => { const x = procurations.find((y) => y.id === procurationId); return x ? [x.nom, x.postnom, x.prenom].filter(Boolean).join(" ") : ""; })() : "Le titulaire"];
    setBoite({ type: "confirmation", message: recapitulatif(cadre, [["Client", `${nomComplet(t!)} (${t!.numero})`], ["Compte", c!.numero], ["Montant", montant(m!, devise)], ["En lettres", montantEnLettres(m!, devise)], personne, ["Motif", motif.trim()]]), oui: async () => {
      try {
        const corps = { cle, compteId: c!.id, montant: m!, coupures, mandataire, motif };
        const o = op === "depot" ? await api.guichet.depot(corps) : await api.guichet.retrait({ ...corps, mandataire: "", procurationId });
        if (o.statut === "visa_requis") {   // registre S08-5 : le retrait est enregistré en attente, pas payé ; le refaire après le visa
          setCle(nouvelleCle());
          setBoite({ type: "succes", message: "Enregistré avec succès ! Retrait au-delà du plafond du guichet : il attend le visa « Retrait plafond » (Visa > Retrait plafond). Après le visa, enregistrer de nouveau ce retrait pour le payer.", garder: true });
          return;
        }
        setFait(o); setRecu(true);   // le reçu s'ouvre d'office (plan 4.3 ; Instr. BCC 40, art. 13)
        if (o.avertissement) setBoite({ type: "succes", message: o.avertissement, garder: true });
      } catch (x) { setBoite(boiteOperation(x, { type: op === "depot" ? "depot" : "retrait", tiersId: t!.id, compteId: c!.id, montant: m!, devise: c!.devise, motif }, setBoite)); }
    } });
  }

  return (
    <>
      <OngletsGuichet version={fait?.id} />
      <Formulaire className="bloc pile" label={op === "depot" ? "Dépôt" : "Retrait"} envoyer={enregistrer}>
        <div className="entete-ecran">
          {(piece) ? <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p> : null}
          <p>Date Opération : <strong className="chiffres">{j ? fr(j.date) : ""}</strong></p>
        </div>
        <div className="grille-cadres client-large">
          <fieldset className="pile cadre-champs">
            <legend>Info client</legend>
            <div className="ligne-champ">
              <ChampClient client={t} desactive={!!fait} choisir={(x) => { setT(x); setCompteId(0); setCoupures({}); nouvelle(); }} />
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={!!fait} onClick={() => setRecherche(true)}>Rechercher</button>
              <button className="bouton secondaire" type="button" aria-label="Photo et signature du client" disabled={!t} onClick={() => setImages(true)}>Photo</button>
            </div>
            <Champ libelle="N° compte">{(p) => (
              <select {...p} className="saisie code" disabled={!t || !!fait} value={c?.id ?? ""} onChange={(e) => { setCompteId(Number(e.target.value)); setCoupures({}); nouvelle(); }}>
                {!t && <option value="">Choisir d'abord le client</option>}{comptes.map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}
              </select>)}</Champ>
            <Champ libelle="Intitulé">{(p) => <textarea {...p} className="saisie" rows={2} readOnly value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Type compte">{(p) => <Lecture {...p} value={c?.intitule ?? ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Info compte</legend>
            <dl className="infos">
              {/* Registre S10-1 : sans « Voir solde client » (S10), les soldes sont masqués */}
              {([["Solde client", "solde"], ["Montant bloqué", "bloque"], ["Montant libre", "disponible"]] as const).map(([libelle, k]) => (
                <div key={k} className="info-ligne"><dt>{libelle}</dt>
                  <dd className="chiffres">{!c ? "" : c.masque ? <span className="muet" title={MASQUE}>•••••</span> : montant(c[k], c.devise)}</dd></div>))}
            </dl>
          </fieldset>
        </div>
        <div className="pile">
          <div className="deux-colonnes">
            <fieldset className="pile cadre-champs">
              <legend>{cadre}</legend>
              <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" readOnly={!!fait} value={saisie}
                onChange={(e) => { setSaisie(e.target.value); nouvelle(); }} />}</Champ>
              {op === "depot"
                ? <Champ libelle="Versé par">{(p) => <input {...p} className="saisie" readOnly={!!fait} value={mandataire} onChange={(e) => setMandataire(e.target.value)} />}</Champ>
                /* Retrait : le titulaire, ou un mandataire d'une procuration en cours (loi 22/068, art. 31, al. 3 ; confrontation du 21/11/2026, E2) */
                : <Champ libelle="Remis à">{(p) => <select {...p} className="saisie" disabled={!!fait} value={procurationId ?? ""}
                    onChange={(e) => setProcurationId(e.target.value ? Number(e.target.value) : null)}><option value="">Le titulaire</option>
                    {procurations.map((x) => <option key={x.id} value={x.id}>{[x.nom, x.postnom, x.prenom].filter(Boolean).join(" ")} : {x.pieceType} {x.pieceNumero}</option>)}</select>}</Champ>}
              <Champ libelle="Motif:">{(p) => <input {...p} className="saisie" readOnly={!!fait} value={motif} onChange={(e) => setMotif(e.target.value)} />}</Champ>
            </fieldset>
            {/* Ni « Total frais » ni « Frais d'opération » : dépôt et retrait d'espèces sont gratuits (Instr. BCC 37, art. 2, 3 et annexe ; plan d'allègement, point 0.15) */}
            {c && m && !fait ? <fieldset className="pile cadre-champs"><legend>Billetage</legend>
              <Billetage devise={devise} comptage={coupures} onChange={(x) => { setCoupures(x); nouvelle(); }} stock={op === "retrait" ? stock : undefined}
                cible={m} sens={op === "retrait" ? "remise" : "recue"} /></fieldset> : null}
          </div>
          <div className="actions-onglets">
            {/* Billetage pas juste : le bouton reste inactif (DESIGN § 2.2) mais atteignable, et dit pourquoi (guide accessibility, aria-disabled) */}
            <button className="bouton" type="submit" disabled={!t || !!fait} aria-disabled={!billetageBon(coupures, m) || undefined}
              aria-describedby={c && m && !billetageBon(coupures, m) ? `ecart-${devise}` : undefined}>Enregistrer</button>
            <button className="bouton secondaire" type="button" disabled={!fait} onClick={() => setRecu(true)}>Imprimer</button>
            <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
            <button className="bouton secondaire" type="button" disabled={!c} onClick={async () => {
              if (!c) return; const jour = j?.date ?? aujourdhui();
              try { setDetail(await api.releves.releve(c.id, `${jour.slice(0, 4)}-01-01`, jour)); } catch (x) { setBoite({ type: "erreur", message: x instanceof Error ? x.message : String(x) }); }
            }}>Detail</button>
          </div>
          <p className="montant-lettres">{m ? montantEnLettres(m, devise) : ""}</p>
        </div>
        <Textes sources={["Manuel Microfina++, p. 86 : Info client, Info compte, Info guichet, Dépôt en espèce / Retrait en espèce, Montant*, Total frais, Mandataire, Motif, Frais d'opération, Enregistrer, Imprimer, Effacer, Billetage, Detail, montant en lettres",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 37, art. 2 et 3, annexe : dépôt et retrait sans frais", "PCCI, comptes 570 (caisse), 330 et 334 (épargnes)",
          "Instr. BCC 15 bis, art. 1 : examen renforcé dès 10 000 USD en espèces",
          "Manuel Microfina++, p. 20 : case « Voir solde client » de l'affectation du guichet (S10) ; loi 22/069, titre III, chapitre II : secret professionnel"]} />
      </Formulaire>
      <Fiche titre="Reçu" ouverte={recu} fermer={nouvelleOperation}>
        {fait && <Recu id={fait.id} onNouveau={nouvelleOperation} echap />}
      </Fiche>
      <Fiche titre="Photo et signature" ouverte={images} fermer={() => setImages(false)}>
        <div className="photos-signataires">
          <div className="cadre-signature apercu-grand">{img?.photo ? <img src={img.photo} alt="Photo du client" /> : <Silhouette />}</div>
          <div className="cadre-signature apercu-grand">{img?.signature ? <img src={img.signature} alt="Signature du client" /> : <Specimen />}</div>
        </div>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setImages(false)}>Fermer</button></div>
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (x) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : [])}
          choisir={(x) => { setT(x); setCompteId(0); setCoupures({}); nouvelle(); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Fiche titre={detail ? `Détail du compte ${detail.compte.numero}` : ""} ouverte={!!detail} fermer={() => setDetail(null)}>
        {detail && <div className="pile">
          <p>Du <span className="chiffres">{fr(detail.du)}</span> au <span className="chiffres">{fr(detail.au)}</span> · report <span className="chiffres">{montant(detail.report, detail.compte.devise as Devise)}</span></p>
          <Paginee lignes={detail.lignes} colonnes={(l) => [fr(l.date), l.piece, l.libelle, l.debit ? montant(l.debit, detail.compte.devise as Devise) : "", l.credit ? montant(l.credit, detail.compte.devise as Devise) : "", montant(l.solde, detail.compte.devise as Devise)]}>{(visibles) => (<div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">Date</th><th scope="col">Pièce</th><th scope="col">Libellé</th><th scope="col" className="montant">Débit</th><th scope="col" className="montant">Crédit</th><th scope="col" className="montant">Solde</th></tr><LigneFiltres titres={["Date", "Pièce", "Libellé", "Débit", "Crédit", "Solde"]} /></thead>
            <tbody>
              {visibles.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
              {visibles.map((l, i) => <tr key={`${l.piece}-${i}`}><td className="chiffres">{fr(l.date)}</td><td className="chiffres">{l.piece}</td><td>{l.libelle}</td>
                <td className="montant chiffres">{l.debit ? montant(l.debit, detail.compte.devise as Devise) : ""}</td><td className="montant chiffres">{l.credit ? montant(l.credit, detail.compte.devise as Devise) : ""}</td>
                <td className="montant chiffres">{montant(l.solde, detail.compte.devise as Devise)}</td></tr>)}
            </tbody>
          </table></div>)}</Paginee>
          <p>Solde au <span className="chiffres">{fr(detail.au)}</span> : <strong className="chiffres">{montant(detail.soldeFin, detail.compte.devise as Devise)}</strong></p>
          <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setDetail(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Titre imprimé de chaque reçu, et les opérations où l'argent sort de la caisse (« Remis à », « Le bénéficiaire ») */
const PAPIER: Partial<Record<Operation["type"], string>> = { depot: "Reçu de dépôt", retrait: "Reçu de retrait", adhesion: "Reçu d'adhésion", achat_parts: "Reçu d'achat de parts",
  retrait_parts: "Reçu de retrait de parts", ed_encaissement: "Reçu d'encaissement", ed_decaissement: "Reçu de décaissement", deblocage_credit: "Reçu de déblocage de crédit",
  remboursement_credit: "Reçu de remboursement de crédit", transfert_sortie: "Bordereau de transfert", transfert_entree: "Bordereau de réception", versement_banque: "Bordereau de versement en banque" };
const SORTIE = new Set<Operation["type"]>(["retrait", "retrait_parts", "ed_decaissement", "deblocage_credit"]);
/** Reçu : ce que le membre reçoit (Instr. BCC 40, art. 13) */
/** Reçu d'une opération de caisse. « Échap » n'est rappelé que là où la touche lance vraiment une nouvelle opération (guichet ; DESIGN § 2.1 ; plan d'allègement, point 11.1) */
export function Recu({ id, onNouveau, echap = false }: { id: number; onNouveau: () => void; echap?: boolean }) {
  const { donnees: r } = useDonnees(() => api.operations.recu(id), [id]);
  const nouvelle = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (r) nouvelle.current?.focus(); }, [r]);   // l'action principale du reçu reçoit le focus (guide dialog), une fois le reçu chargé
  const lettres = useMemo(() => (r ? montantEnLettres(r.o.montant, r.o.devise) : ""), [r]);
  const imp = useImpression("recu", id, ".fiche .a-imprimer");
  if (!r) return <Chargement />;
  const titre = { depot: "Dépôt enregistré", retrait: "Retrait enregistré", adhesion: "Adhésion enregistrée", achat_parts: "Achat de parts enregistré", retrait_parts: "Retrait de parts enregistré", ed_encaissement: "Encaissement enregistré", ed_decaissement: "Décaissement enregistré", transfert_sortie: "Transfert enregistré", transfert_entree: "Transfert reçu", versement_banque: "Versement en banque enregistré", deblocage_credit: "Déblocage de crédit", remboursement_credit: "Remboursement de crédit enregistré" }[r.o.type];
  return (
    <div className="pile">
      <p className="resultat-ok" role="status"><strong>{titre}.</strong> Pièce <span className="chiffres">{r.piece}</span>.</p>
      {/* Point bloquant B12 : ticket de 80 mm, à la taille réelle du papier (DESIGN § 2.8 ; registre T215) */}
      <div className="papier a-imprimer apercu-ticket">
        <article className="ticket" aria-label="Aperçu du reçu">
          <EnTeteDocument e={r.entete} agence={r.agence} />
          <h2 className="ticket-titre">{PAPIER[r.o.type] ?? titre}</h2>
          <dl className="ticket-lignes">
            <div><dt>Pièce</dt><dd>{r.piece}</dd></div>
            <div><dt>Date</dt><dd>{fr(r.date)} à {r.o.heure}</dd></div>
            {r.numeroMembre && <div><dt>{r.o.type === "adhesion" ? "Membre" : "Client"}</dt><dd>{r.titulaire}<br />{r.numeroMembre}</dd></div>}
            {r.compte && <div><dt>Compte</dt><dd>{r.compte}</dd></div>}
            {r.o.parts ? <div><dt>Parts</dt><dd>{r.o.parts}</dd></div> : null}
            <div className="ticket-montant"><dt>Montant</dt><dd>{montant(r.o.montant, r.o.devise)}</dd></div>
            <div className="ticket-lettres"><dt>En lettres</dt><dd>{lettres}</dd></div>
            {r.o.remisPar ? <div><dt>{SORTIE.has(r.o.type) ? "Remis à" : "Versé par"}</dt><dd>{r.o.remisPar}</dd></div> : null}
            {r.o.motif ? <div><dt>Motif</dt><dd>{r.o.motif}</dd></div> : null}
            <div><dt>Caissier</dt><dd>{r.caissier}{r.viseur ? `, visa ${r.viseur}` : ""}</dd></div>
          </dl>
          <div className="ticket-signatures"><span>Le caissier</span><span>{SORTIE.has(r.o.type) ? "Le bénéficiaire" : "Le déposant"}</span></div>
          <MentionExemplaire x={imp.exemplaire} />
        </article>
      </div>
      {imp.erreur && <p className="attention" role="alert">{imp.erreur}</p>}
      <details className="textes"><summary>Écriture</summary>
        <table className="grille"><thead><tr><th scope="col">Compte</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
          <tbody>{r.lignes.map((l, i) => <tr key={i}><td className="chiffres">{l.compte}</td><td className="num">{l.sens === "D" ? montant(l.montant, l.devise) : ""}</td><td className="num">{l.sens === "C" ? montant(l.montant, l.devise) : ""}</td></tr>)}</tbody></table>
      </details>
      <div className="rangee">
        <button type="button" className="bouton secondaire" onClick={() => void imp.imprimer()}>Imprimer</button>
        <button ref={nouvelle} type="button" className="bouton" onClick={onNouveau}>Nouvelle opération{echap && <> <Touche>Échap</Touche></>}</button>
      </div>
    </div>
  );
}
