import { vers } from "./registre";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { lireMontant, montant, montantEnLettres, totalComptage, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Silhouette, Specimen, Textes, Touche, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

export const titulaireDe = (t: Tiers) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

/** Onglets du guichet, dans l'ordre de Microfina++ (manuel p. 85) */
export function OngletsGuichet() {
  const [q] = useSearchParams();
  const op = q.get("op") ?? "depot";
  const onglet = (to: string, actif: boolean, texte: string) => <Link to={to} aria-current={actif ? "page" : undefined}>{texte}</Link>;
  const ici = (id: string) => location.pathname.endsWith(id.toLowerCase());
  return (
    <nav className="onglets" aria-label="Opération">
      {onglet(vers("S73"), ici("S73"), "Adhésion")}
      {onglet(vers("S74", `?op=${op}`), ici("S74"), "Dépôt / Retrait")}
      {onglet(vers("S75"), ici("S75"), "Décaissement crédit")}
      {onglet(vers("S76"), ici("S76"), "Remboursement de credit")}
      {onglet(vers("S77"), ici("S77"), "Part sociale(Achat/Retrait)")}
      {onglet(vers("S78"), ici("S78"), "ED Divers")}
    </nav>
  );
}

const nomComplet = (t: Tiers) => t.intitule || titulaireDe(t);

/** S74 : Caisse > Opération > Dépôt / Retrait (manuel Microfina++, p. 86) */
export const MASQUE = "Solde masqué : « Voir solde client » n'est pas coché pour vous (Administration > Guichet > Affectation)";

export default function GuichetDepotRetrait() {
  const [q, setQ] = useSearchParams();
  const op: "depot" | "retrait" = q.get("op") === "retrait" ? "retrait" : "depot";
  const [t, setT] = useState<Tiers | null>(null);
  const [compteId, setCompteId] = useState(0);
  const [saisie, setSaisie] = useState("");
  const [mandataire, setMandataire] = useState("");
  const [motif, setMotif] = useState("");
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [images, setImages] = useState(false);
  const [billetage, setBilletage] = useState(false);
  const [recu, setRecu] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);

  const { donnees } = useDonnees(async () => {
    const [s, ctx, u, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.session.courante(), api.journees.courante()]);
    const comptes = t ? await api.tiers.comptes(t.id) : [];
    const c = comptes.find((x) => x.id === compteId) ?? comptes[0];
    const stock = s && c ? await api.caisses.theorique(s.id, c.devise) : {};
    const img = t && images ? await api.tiers.images(t.id) : null;
    const piece = fait ? (await api.operations.recu(fait.id)).piece : "";
    return { s, ctx, u, j, comptes, c, stock, img, piece };
  }, [t?.id, compteId, fait?.id, images]);

  const effacer = () => { setT(null); setCompteId(0); setSaisie(""); setMandataire(""); setMotif(""); setCoupures({}); setCle(nouvelleCle()); setFait(null); };
  useEffect(() => { effacer(); }, [op]);   // changer d'onglet repart d'une saisie vierge
  // Arrivée par la recherche globale : le client est déjà choisi
  const tiersDemande = q.get("tiers");
  useEffect(() => {
    if (tiersDemande) void api.tiers.lire(Number(tiersDemande)).then((x) => { if (x) setT(x); });
  }, [tiersDemande, op]);

  if (!donnees) return <Chargement />;
  const { s, ctx, u, j, comptes, c, stock, img, piece } = donnees;
  if (!s || s.statut !== "ouverte") return (
    <><h1>Guichet</h1><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>
  );
  const devise: Devise = c?.devise ?? "CDF";
  const m = saisie.trim() ? lireMontant(saisie) : null;
  const nouvelle = () => setCle(nouvelleCle());
  const cadre = op === "depot" ? "Dépôt espèce" : "Retrait espèce";

  function enregistrer() {
    const manque = !t ? "N° client" : !c ? "N° compte" : !m ? "Montant" : "";
    if (manque) { setBoite({ type: "erreur", message: `À remplir : ${manque}.` }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const corps = { cle, compteId: c!.id, montant: m!, coupures, mandataire, motif };
        const o = op === "depot" ? await api.guichet.depot(corps) : await api.guichet.retrait(corps);
        if (o.statut === "visa_requis") {   // registre S08-5 : le retrait est enregistré en attente, pas payé ; le refaire après le visa
          setCle(nouvelleCle());
          setBoite({ type: "succes", message: "Enregistré avec succès ! Retrait au-delà du plafond du guichet : il attend le visa « Retrait plafond » (Visa > Retrait plafond). Après le visa, enregistrer de nouveau ce retrait pour le payer." });
          return;
        }
        setFait(o);
        setBoite({ type: "succes", message: ["Enregistré avec succès !", o.avertissement].filter(Boolean).join(" ") });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <h1>Guichet</h1>
      <OngletsGuichet />
      <section className="bloc pile" aria-label="Dépôt / Retrait">
        <div className="entete-ecran">
          <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p>
          <p>Date Opération : <strong className="chiffres">{j ? fr(j.date) : ""}</strong></p>
        </div>
        <div className="grille-cadres client-large">
          <fieldset className="pile cadre-champs">
            <legend>Info client</legend>
            <Champ libelle="Agence">{(p) => <select {...p} className="saisie" disabled value={ctx.agence.nom}><option>{ctx.agence.nom}</option></select>}</Champ>
            <div className="ligne-champ">
              <Champ libelle="N° client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={!!fait} onClick={() => setRecherche(true)}>Rechercher</button>
              <button className="bouton secondaire" type="button" aria-label="Photo et signature du client" disabled={!t} onClick={() => setImages(true)}>Photo</button>
            </div>
            <Champ libelle="N° compte">{(p) => (
              <select {...p} className="saisie code" disabled={!t || !!fait} value={c?.id ?? ""} onChange={(e) => { setCompteId(Number(e.target.value)); setCoupures({}); nouvelle(); }}>
                {comptes.map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}
              </select>)}</Champ>
            <Champ libelle="Intitulé">{(p) => <textarea {...p} className="saisie" rows={2} readOnly value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Type compte">{(p) => <input {...p} className="saisie" readOnly value={c?.intitule ?? ""} />}</Champ>
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
          <fieldset className="pile cadre-champs">
            <legend>Info guichet</legend>
            <dl className="infos">
              <div className="info-ligne"><dt>Agence</dt><dd>{ctx.agence.nom}</dd></div>
              <div className="info-ligne"><dt>Nom</dt><dd>{ctx.guichets.find((g) => g.id === s.guichetId)?.nom ?? ""}</dd></div>
              <div className="info-ligne"><dt>Caissier</dt><dd>{u?.nom ?? ""}</dd></div>
              <div className="info-ligne"><dt>Solde</dt><dd className="chiffres">{montant(totalComptage(stock), devise)}</dd></div>
            </dl>
          </fieldset>
        </div>
        <div className="onglets" role="tablist" aria-label="Opération">
          <button type="button" role="tab" id="op-depot" aria-controls="op" aria-selected={op === "depot"} onClick={() => setQ({ op: "depot" })}>Dépôt en espèce</button>
          <button type="button" role="tab" id="op-retrait" aria-controls="op" aria-selected={op === "retrait"} onClick={() => setQ({ op: "retrait" })}>Retrait en espèce</button>
        </div>
        <div className="pile" id="op" role="tabpanel" aria-labelledby={`op-${op}`}>
          <div className="deux-colonnes">
            <fieldset className="pile cadre-champs">
              <legend>{cadre}</legend>
              <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" readOnly={!!fait} value={saisie}
                onChange={(e) => { setSaisie(e.target.value); nouvelle(); }} />}</Champ>
              <Champ libelle="Total frais">{(p) => <input {...p} className="saisie montant" readOnly value="" />}</Champ>
              <Champ libelle="Mandataire">{(p) => <input {...p} className="saisie" readOnly={!!fait} value={mandataire} onChange={(e) => setMandataire(e.target.value)} />}</Champ>
              <Champ libelle="Motif:">{(p) => <input {...p} className="saisie" readOnly={!!fait} value={motif} onChange={(e) => setMotif(e.target.value)} />}</Champ>
            </fieldset>
            <fieldset className="pile cadre-champs">
              <legend>Frais d'opération</legend>
              <table className="grille">
                <thead><tr><th scope="col">Libelle Frais</th><th scope="col">Frais</th></tr></thead>
                <tbody></tbody>
              </table>
            </fieldset>
          </div>
          <div className="actions-onglets">
            <button className="bouton" type="button" disabled={!t || !!fait} onClick={enregistrer}>Enregistrer</button>
            <button className="bouton secondaire" type="button" disabled={!fait} onClick={() => setRecu(true)}>Imprimer</button>
            <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
            <button className="bouton secondaire" type="button" disabled={!c || !!fait || !m} onClick={() => setBilletage(true)}>Billetage</button>
            <button className="bouton secondaire" type="button" disabled>Detail</button>
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
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
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
      <p className="exemple">Impression : le gabarit du reçu 80 mm reste à dessiner (DESIGN § 2.8). Pas d'impression de la page du navigateur.</p>
    </div>
  );
}
