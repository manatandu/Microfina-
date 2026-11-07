import { vers } from "./registre";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, SEUIL_CAISSIER_USD, type CompteAvecSolde } from "../donnees/api";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { useTouches } from "../lib/useTouches";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { lireMontant, montant, montantEnLettres, totalComptage, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Bloquant, Chargement, ChampMontant, Etapes, Silhouette, Specimen, Textes, Touche } from "../composants";
import { mots } from "../lib/vocabulaire";

export const titulaireDe = (t: Tiers) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

/** Onglets du guichet : un seul écran, un onglet par opération (écarts Microfina++, § 5) */
export function OngletsGuichet() {
  const [q] = useSearchParams();
  const op = q.get("op") ?? "depot";
  const onglet = (to: string, actif: boolean, texte: string) => <Link to={to} aria-current={actif ? "page" : undefined}>{texte}</Link>;
  return (
    <nav className="onglets" aria-label="Opération">
      {onglet(vers("S74", "?op=depot"), location.pathname.endsWith("s74") && op === "depot", "Dépôt")}
      {onglet(vers("S74", "?op=retrait"), location.pathname.endsWith("s74") && op === "retrait", "Retrait")}
      {onglet(vers("S73"), location.pathname.endsWith("s73"), "Adhésion")}
      {onglet(vers("S76"), false, "Remboursement")}
      {onglet(vers("S77"), location.pathname.endsWith("s77"), "Parts sociales")}
    </nav>
  );
}

/** Colonne de gauche : qui est au guichet */
export function PanneauMembre({ tiers, onChoisir, refRecherche, filtre, enfants }: {
  tiers: Tiers | null; onChoisir: (t: Tiers | null) => void; refRecherche: React.RefObject<HTMLInputElement | null>;
  filtre?: (t: Tiers) => boolean; enfants?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const { donnees } = useDonnees(async () => ({ res: await api.tiers.rechercher(q), ctx: await api.referentiel.contexte() }), [q]);
  const res = (donnees?.res ?? []).filter(filtre ?? (() => true));
  const m = donnees ? mots(donnees.ctx.institution) : null;
  return (
    <section className="bloc pile" aria-labelledby="t-membre">
      <h2 id="t-membre">{m?.Membre ?? "Membre"}</h2>
      <div className="recherche">
        <label className="dense muet" htmlFor="recherche-membre">Nom, numéro ou compte <Touche>F2</Touche></label>
        <input id="recherche-membre" ref={refRecherche} autoFocus className="saisie" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
          role="combobox" aria-expanded={q.length > 0 && !tiers} aria-controls="resultats-membre" />
        {q && !tiers && (
          <ul className="suggestions" id="resultats-membre" role="listbox" aria-label="Résultats">
            {res.length ? res.map((t) => (
              <li key={t.id} role="option" aria-selected="false" tabIndex={0}
                onClick={() => { onChoisir(t); setQ(""); }} onKeyDown={(e) => { if (e.key === "Enter") { onChoisir(t); setQ(""); } }}>
                <span className="nom">{titulaireDe(t)}</span><span className="type chiffres">{t.numero}</span>
              </li>
            )) : <li className="vide" role="option" aria-disabled="true" aria-selected="false">Aucun résultat pour « {q} ».</li>}
          </ul>
        )}
      </div>
      {!tiers ? <p className="muet">Aucun {m?.membre ?? "membre"} choisi.</p> : (
        <>
          <div className="identite">
            <div className="photo">{tiers.photo ? <Silhouette /> : <span className="absente">Pas de photo</span>}</div>
            <div>
              <p className="nom">{titulaireDe(tiers)}</p>
              <dl><dt>N°</dt><dd><span className="chiffres">{tiers.numero}</span></dd><dt>Pièce</dt><dd>{tiers.pieceType}<br /><span className="reference">{tiers.pieceNumero}</span></dd></dl>
            </div>
          </div>
          <div className="specimen">{tiers.specimen ? <Specimen /> : <span className="absente">Pas de specimen : ne pas payer</span>}</div>
          {tiers.statut !== "actif" && <Bloquant>pas encore visé par le chef d'agence.</Bloquant>}
          {enfants}
          <div><button type="button" className="bouton discret" onClick={() => onChoisir(null)}>Changer de {m?.membre ?? "membre"}</button></div>
        </>
      )}
    </section>
  );
}

function ListeComptes({ comptes, choisi, onChoisir }: { comptes: CompteAvecSolde[]; choisi: number; onChoisir: (id: number) => void }) {
  if (!comptes.length) return <p className="muet">Pas de compte : adhésion d'abord.</p>;
  return (
    <div className="comptes" role="radiogroup" aria-label="Compte">
      {comptes.map((c) => (
        <label key={c.id} className="compte">
          <input type="radio" name="compte" checked={choisi === c.id} onChange={() => onChoisir(c.id)} />
          <span><span className="intitule">{c.intitule}, {c.devise}</span><br /><span className="numero">{c.numero}</span></span>
          <dl className="soldes"><dt>Solde</dt><dd>{montant(c.solde, c.devise)}</dd><dt>Bloqué</dt><dd>{montant(c.bloque, c.devise)}</dd><dt>Libre</dt><dd><strong>{montant(c.disponible, c.devise)}</strong></dd></dl>
          {c.motifBlocage && <span className="motif">{c.motifBlocage}</span>}
        </label>
      ))}
    </div>
  );
}

/** S74 : dépôt et retrait d'espèces */
export default function GuichetDepotRetrait() {
  const [q] = useSearchParams();
  const op: "depot" | "retrait" = q.get("op") === "retrait" ? "retrait" : "depot";
  const recherche = useRef<HTMLInputElement>(null);
  const premiereCoupure = useRef<string>("coupure-1");
  const [tiers, setTiers] = useState<Tiers | null>(null);
  const [compteId, setCompteId] = useState(0);
  const [saisie, setSaisie] = useState("");
  const [coupures, setCoupures] = useState<Comptage>({});
  const [verifie, setVerifie] = useState({ piece: false, signature: false, carnet: false });
  const [remisPar, setRemisPar] = useState("");
  const [cle, setCle] = useState(nouvelleCle);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState<Operation | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const { donnees } = useDonnees(async () => {
    const [s, ctx] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte()]);
    const comptes = tiers ? await api.tiers.comptes(tiers.id) : [];
    const c = comptes.find((x) => x.id === compteId);
    const stock = s && c ? await api.caisses.theorique(s.id, c.devise) : undefined;
    const attente = resultat?.statut === "visa_requis" ? await api.operations.lire(resultat.id) : null;
    const enAttente = s ? (await api.operations.enAttente()).filter((o) => o.sessionId === s.id) : [];
    return { s, ctx, comptes, c, stock, attente, enAttente };
  }, [tiers?.id, compteId, resultat?.id, resultat?.statut]);

  const vider = () => { setTiers(null); setCompteId(0); setSaisie(""); setCoupures({}); setVerifie({ piece: false, signature: false, carnet: false }); setRemisPar(""); setErreur(""); setResultat(null); setCle(nouvelleCle()); recherche.current?.focus(); };
  useEffect(() => { vider(); }, [op]);   // changer d'onglet repart d'un bordereau vierge
  // Arrivée par la recherche globale : le membre est déjà choisi
  const tiersDemande = q.get("tiers");
  useEffect(() => {
    if (!tiersDemande) return;
    void api.tiers.lire(Number(tiersDemande)).then((t) => { if (t) { setTiers(t); setCompteId(0); setResultat(null); } });
  }, [tiersDemande, op]);
  // Un visa vaut pour un montant et un compte : toute modification tire une nouvelle clé
  useEffect(() => { if (resultat?.statut !== "visa_requis") setCle(nouvelleCle()); }, [saisie, compteId]);

  const c = donnees?.c;
  const devise: Devise = c?.devise ?? "CDF";
  const m = lireMontant(saisie);
  const errMontant = saisie && m === null ? "Montant illisible." : op === "retrait" && m && c && m > c.disponible ? "Dépasse le solde disponible." : "";
  const billetsOk = !!m && totalComptage(coupures) === m;
  const usd = m ? (devise === "USD" ? m / 100 : m / 100 / (donnees?.ctx.cours.USD ?? 1)) : 0;
  const visaNecessaire = op === "retrait" && usd > SEUIL_CAISSIER_USD;
  const vise = !!donnees?.attente?.visePar;
  const etapes = op === "depot"
    ? [{ titre: "Membre", ok: !!tiers }, { titre: "Compte", ok: !!c }, { titre: "Montant", ok: !!m && !errMontant }, { titre: "Billetage", ok: billetsOk }]
    : [{ titre: "Membre", ok: !!tiers }, { titre: "Compte", ok: !!c }, { titre: "Montant", ok: !!m && !errMontant },
       { titre: "Pièce", ok: verifie.piece }, { titre: "Signature", ok: verifie.signature && !!tiers?.specimen, ko: !!tiers && !tiers.specimen }, { titre: "Carnet", ok: verifie.carnet },
       { titre: "Billetage", ok: billetsOk }, ...(visaNecessaire ? [{ titre: "Visa du chef", ok: vise }] : [])];
  const pret = etapes.every((e) => e.ok || e.titre === "Visa du chef") && !envoi && resultat?.statut !== "validee";

  async function valider() {
    if (!pret || !c || !m) return;
    setEnvoi(true); setErreur("");
    try {
      const o = op === "depot"
        ? await api.guichet.depot({ cle, compteId: c.id, montant: m, coupures, remisPar })
        : await api.guichet.retrait({ cle, compteId: c.id, montant: m, coupures, verifie });
      setResultat(o);
    } catch (x) { setErreur(message(x)); } finally { setEnvoi(false); }
  }

  useTouches({
    F2: () => recherche.current?.focus(),
    F4: () => document.getElementById(premiereCoupure.current)?.focus(),
    F9: () => { void valider(); },
    Escape: () => vider(),
  });

  async function reprendre(o: Operation) {
    const t = await api.tiers.lire(o.tiersId);
    setTiers(t); setCompteId(o.compteId ?? 0); setSaisie(String(o.montant / 100).replace(".", ",")); setCoupures(o.coupures);
    setCle(o.cle); setResultat(o); setErreur("");
  }

  if (!donnees) return <Chargement />;
  if (!donnees.s || donnees.s.statut !== "ouverte") return (
    <><h1>Guichet</h1><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>, puis faire valider le fonds.</Attention></>
  );
  const mo = mots(donnees.ctx.institution);
  const fini = resultat?.statut === "validee";

  return (
    <>
      <h1 className="sr-only">Guichet</h1>
      <OngletsGuichet />
      {op === "retrait" && donnees.enAttente.length > 0 && resultat?.statut !== "visa_requis" && (
        <ul className="liste-taches" aria-label="Retraits en attente de visa">
          {donnees.enAttente.map((o) => (
            <li key={o.id}>
              <span>Retrait de <span className="chiffres">{montant(o.montant, o.devise)}</span> pour {o.remisPar} : {o.visePar ? "visé, prêt à payer" : "en attente du visa"}</span>
              <button type="button" className="bouton secondaire" onClick={() => void reprendre(o)}>Reprendre</button>
            </li>
          ))}
        </ul>
      )}
      <div className="guichet">
        <PanneauMembre tiers={tiers} onChoisir={(t) => { setTiers(t); setCompteId(0); setResultat(null); }} refRecherche={recherche}
          enfants={tiers && donnees.comptes && <ListeComptes comptes={donnees.comptes} choisi={compteId} onChoisir={(id) => { setCompteId(id); setCoupures({}); }} />} />

        <section className="bloc bordereau" aria-labelledby="t-bordereau">
          <h2 id="t-bordereau">{op === "depot" ? "Dépôt d'espèces" : "Retrait d'espèces"}{c ? <span className="muet"> · <span className="chiffres">{c.numero}</span></span> : ""}</h2>
          {fini ? <Recu id={resultat!.id} onNouveau={vider} /> : (
            <>
              <ChampMontant valeur={saisie} onChange={setSaisie} devise={devise} erreur={errMontant} />
              {op === "depot" ? (
                <div className="champ">
                  <label htmlFor="remis-par">Déposé par</label>
                  <input id="remis-par" className="saisie" value={remisPar} placeholder={tiers ? `${titulaireDe(tiers)}, le titulaire` : ""} onChange={(e) => setRemisPar(e.target.value)} aria-describedby="aide-remis" />
                  <p className="aide" id="aide-remis">Laisser vide si c'est le titulaire.</p>
                </div>
              ) : (
                <fieldset className="choix">
                  <legend>J'ai vérifié</legend>
                  <label className="case"><input type="checkbox" checked={verifie.piece} onChange={(e) => setVerifie({ ...verifie, piece: e.target.checked })} /><span>La pièce d'identité</span></label>
                  <label className="case"><input type="checkbox" checked={verifie.signature} disabled={!tiers?.specimen} onChange={(e) => setVerifie({ ...verifie, signature: e.target.checked })} /><span>La signature, comparée au specimen</span></label>
                  <label className="case"><input type="checkbox" checked={verifie.carnet} onChange={(e) => setVerifie({ ...verifie, carnet: e.target.checked })} /><span>Le carnet{c ? <> : <span className="chiffres">{montant(c.solde, c.devise)}</span></> : ""}</span></label>
                </fieldset>
              )}
              {visaNecessaire && !vise && <Attention>Au-delà de <span className="chiffres">{montant(SEUIL_CAISSIER_USD * 100, "USD")}</span> : visa du chef d'agence. {resultat?.statut === "visa_requis" ? "Demande envoyée, en attente." : "La demande part avec F9."} <span className="exemple">Seuil d'exemple, fixé par la COOPEC.</span></Attention>}
              {visaNecessaire && vise && <p className="resultat-ok">Visé par le chef d'agence. <Touche>F9</Touche> pour payer.</p>}
              <Bloquant>{erreur}</Bloquant>
              <div className="pied-guichet">
                <Etapes etapes={etapes} />
                <button type="button" className="bouton grand" disabled={!pret} aria-keyshortcuts="F9" onClick={() => void valider()}>
                  {op === "depot" ? "Valider le dépôt" : visaNecessaire && !vise ? "Demander le visa" : "Valider le retrait"} <Touche>F9</Touche>
                </button>
              </div>
              <Textes sources={op === "depot"
                ? ["Instr. BCC 37 : dépôt sans frais", "PCCI, comptes 570 (caisse) et 330 (épargnes)", "Instr. BCC 15 bis, art. 1 : examen renforcé dès 10 000 USD en espèces"]
                : ["Instr. BCC 37 : retrait sans frais", "PCCI, comptes 330 (épargnes) et 570 (caisse)", "Instr. BCC 15 bis, art. 1 : examen renforcé dès 10 000 USD en espèces", "ARCHITECTURE P7 : visa à quatre yeux"]} />
            </>
          )}
        </section>

        <section className="bloc" aria-labelledby="t-billetage">
          <h2 id="t-billetage">{op === "depot" ? "Billets reçus" : "Billets à remettre"} {devise} <Touche>F4</Touche></h2>
          {c ? <Billetage devise={devise} comptage={coupures} onChange={setCoupures} stock={op === "retrait" ? donnees.stock : undefined}
              cible={m} sens={op === "retrait" ? "remise" : "recue"} idPremier={premiereCoupure.current} lectureSeule={fini} />
            : <p className="muet">Choisir d'abord le compte du {mo.membre}.</p>}
        </section>
      </div>
    </>
  );
}

/** Reçu : ce que le membre reçoit (Instr. BCC 40, art. 13) */
export function Recu({ id, onNouveau }: { id: number; onNouveau: () => void }) {
  const { donnees: r } = useDonnees(() => api.operations.recu(id), [id]);
  const lettres = useMemo(() => (r ? montantEnLettres(r.o.montant, r.o.devise) : ""), [r]);
  if (!r) return <Chargement />;
  const titre = { depot: "Dépôt enregistré", retrait: "Retrait enregistré", adhesion: "Adhésion enregistrée", achat_parts: "Achat de parts enregistré", retrait_parts: "Retrait de parts enregistré" }[r.o.type];
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
      <p className="exemple">Impression : le gabarit du reçu 80 mm reste à dessiner (DESIGN § 2.8). Pas d'impression de la page du navigateur.</p>
    </div>
  );
}
