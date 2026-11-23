import { vers } from "./registre";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { boiteOperation } from "../lib/examen";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { lireMontant, montant, montantEnLettres, totalComptage, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Paginee, Silhouette, Specimen, Textes, Touche, type Boite, Lecture, LigneFiltres } from "../composants";
import { RechercheClient } from "./Visa";

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

/** Solde de la caisse dans chaque devise, chargé dès l'ouverture : le même dans tous les onglets du guichet (plan d'allègement, point 0.10 ; registre S74-9) */
export function SoldesCaisse({ sessionId }: { sessionId: number }) {
  const { donnees } = useDonnees(async () => {
    const devises = ((await api.referentiel.contexte()).devises ?? [{ code: "CDF" }, { code: "USD" }]).map((d: { code: string }) => d.code as Devise);
    return Promise.all(devises.map(async (d) => [d, totalComptage(await api.caisses.theorique(sessionId, d))] as const));
  }, [sessionId]);
  return <>{(donnees ?? []).map(([d, m]) => <div key={d} className="info-ligne"><dt>Solde {d}</dt><dd className="chiffres">{montant(m, d)}</dd></div>)}</>;
}

/** S74 : Caisse > Opération > Dépôt / Retrait (manuel Microfina++, p. 86) */
export const MASQUE = "Solde masqué : « Voir solde client » n'est pas coché pour vous (Administration > Guichet > Affectation)";

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
  const [billetage, setBilletage] = useState(false);
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
    const manque = !t ? "N° client" : !c ? "N° compte" : !m ? "Montant" : "";
    if (manque) { setBoite({ type: "erreur", message: `À remplir : ${manque}.` }); return; }
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment enregistrer ? ${cadre} : ${montant(m!, devise)}, compte ${c!.numero}, ${nomComplet(t!)}.`, oui: async () => {
      try {
        const corps = { cle, compteId: c!.id, montant: m!, coupures, mandataire, motif };
        const o = op === "depot" ? await api.guichet.depot(corps) : await api.guichet.retrait({ ...corps, mandataire: "", procurationId });
        if (o.statut === "visa_requis") {   // registre S08-5 : le retrait est enregistré en attente, pas payé ; le refaire après le visa
          setCle(nouvelleCle());
          setBoite({ type: "succes", message: "Enregistré avec succès ! Retrait au-delà du plafond du guichet : il attend le visa « Retrait plafond » (Visa > Retrait plafond). Après le visa, enregistrer de nouveau ce retrait pour le payer." });
          return;
        }
        setFait(o);
        setBoite({ type: "succes", message: ["Enregistré avec succès !", o.avertissement].filter(Boolean).join(" ") });
      } catch (x) { setBoite(boiteOperation(x, { type: op === "depot" ? "depot" : "retrait", tiersId: t!.id, compteId: c!.id, montant: m!, devise: c!.devise, motif }, setBoite)); }
    } });
  }

  return (
    <>
      <OngletsGuichet version={fait?.id} />
      <section className="bloc pile" aria-label={op === "depot" ? "Dépôt" : "Retrait"}>
        <div className="entete-ecran">
          {(piece) ? <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p> : null}
          <p>Date Opération : <strong className="chiffres">{j ? fr(j.date) : ""}</strong></p>
        </div>
        <div className="grille-cadres client-large">
          <fieldset className="pile cadre-champs">
            <legend>Info client</legend>
            <div className="ligne-champ">
              <Champ libelle="N° client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
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
          </div>
          <div className="actions-onglets">
            <button className="bouton" type="button" disabled={!t || !!fait} onClick={enregistrer}>Enregistrer</button>
            <button className="bouton secondaire" type="button" disabled={!fait} onClick={() => setRecu(true)}>Imprimer</button>
            <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
            <button className="bouton secondaire" type="button" disabled={!c || !!fait || !m} onClick={() => setBilletage(true)}>Billetage</button>
            <button className="bouton secondaire" type="button" disabled={!c} onClick={async () => {
              if (!c) return; const jour = j?.date ?? new Date().toISOString().slice(0, 10);
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
      </section>
      <Fiche titre="Billetage" ouverte={billetage} fermer={() => setBilletage(false)}>
        <div className="pile">
          <Billetage devise={devise} comptage={coupures} onChange={(x) => { setCoupures(x); nouvelle(); }} stock={op === "retrait" ? stock : undefined}
            cible={m ?? 0} sens={op === "retrait" ? "remise" : "recue"} />
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setBilletage(false)}>Fermer</button></div>
        </div>
      </Fiche>
      <Fiche titre="Reçu" ouverte={recu} fermer={() => setRecu(false)}>
        {fait && <Recu id={fait.id} onNouveau={() => { setRecu(false); effacer(); }} />}
      </Fiche>
      <Fiche titre="Photo et signature" ouverte={images} fermer={() => setImages(false)}>
        <div className="photos-signataires">
          <div className="cadre-signature apercu-grand">{img?.photo ? <img src={img.photo} alt="Photo du client" /> : <Silhouette />}</div>
          <div className="cadre-signature apercu-grand">{img?.signature ? <img src={img.signature} alt="Signature du client" /> : <Specimen />}</div>
        </div>
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

/** Reçu : ce que le membre reçoit (Instr. BCC 40, art. 13) */
export function Recu({ id, onNouveau }: { id: number; onNouveau: () => void }) {
  const { donnees: r } = useDonnees(() => api.operations.recu(id), [id]);
  const lettres = useMemo(() => (r ? montantEnLettres(r.o.montant, r.o.devise) : ""), [r]);
  if (!r) return <Chargement />;
  const titre = { depot: "Dépôt enregistré", retrait: "Retrait enregistré", adhesion: "Adhésion enregistrée", achat_parts: "Achat de parts enregistré", retrait_parts: "Retrait de parts enregistré", ed_encaissement: "Encaissement enregistré", ed_decaissement: "Décaissement enregistré", transfert_sortie: "Transfert enregistré", transfert_entree: "Transfert reçu", versement_banque: "Versement en banque enregistré", deblocage_credit: "Déblocage de crédit", remboursement_credit: "Remboursement de crédit enregistré" }[r.o.type];
  return (
    <div className="pile">
      <p className="resultat-ok" role="status"><strong>{titre}.</strong> Pièce <span className="chiffres">{r.piece}</span>.</p>
      <div className="papier" aria-label="Aperçu du reçu">
        <dl>
          <dt>Pièce</dt><dd className="chiffres">{r.piece}</dd>
          <dt>Date</dt><dd className="chiffres">{fr(r.date)} à {r.o.heure}</dd>
          <dt>Membre</dt><dd>{r.titulaire} <span className="chiffres">{r.numeroMembre}</span></dd>
          {r.compte && <><dt>Compte</dt><dd className="chiffres">{r.compte}</dd></>}
          {r.o.parts ? <><dt>Parts</dt><dd>{r.o.parts}</dd></> : null}
          <dt>Montant</dt><dd className="chiffres">{montant(r.o.montant, r.o.devise)}</dd>
          <dt>En lettres</dt><dd>{lettres}</dd>
          <dt>{r.o.type === "retrait" ? "Remis à" : "Versé par"}</dt><dd>{r.o.remisPar}</dd>
          {r.o.motif ? <><dt>Motif</dt><dd>{r.o.motif}</dd></> : null}
          <dt>Caissier</dt><dd>{r.caissier}{r.viseur ? `, visa ${r.viseur}` : ""}</dd>
        </dl>
      </div>
      <details className="textes"><summary>Écriture</summary>
        <table className="grille"><thead><tr><th scope="col">Compte</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
          <tbody>{r.lignes.map((l, i) => <tr key={i}><td className="chiffres">{l.compte}</td><td className="num">{l.sens === "D" ? montant(l.montant, l.devise) : ""}</td><td className="num">{l.sens === "C" ? montant(l.montant, l.devise) : ""}</td></tr>)}</tbody></table>
      </details>
      <div className="rangee">
        <button type="button" className="bouton" onClick={onNouveau}>Nouvelle opération <Touche>Échap</Touche></button>
      </div>
    </div>
  );
}
