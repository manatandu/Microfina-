// Écart E07 (docs/reglementaire/ECARTS-2026-11-15.md) : Client > Conformité > Plaintes. Écran imposé par les textes, absent de Microfina++.
// Instr. BCC 39 : art. 3 et 4 (reçues dans tous les points d'exploitation), 5 (suite sous 45 jours calendaires), 7 (référence unique remise au client),
// 10 (canaux), 15 (réparation), 17 (dossier gardé dix ans), 19 (rapport trimestriel) ; loi 11/020, art. 61.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { exporterExcel } from "../lib/excel";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

type Plainte = Awaited<ReturnType<typeof api.plaintes.lister>>[number];
type Rapport = Awaited<ReturnType<typeof api.plaintes.rapport>>;
const CANAUX = [["personne", "En personne"], ["lettre", "Lettre"], ["fax", "Fax"], ["courriel", "Courrier électronique"], ["formulaire", "Formulaire en ligne"], ["telephone", "Téléphone"], ["autre", "Autre canal"]] as const;
const PROVENANCES = [["agence", "Agence"], ["guichet", "Guichet"], ["siege", "Siège"], ["autre", "Autre"]] as const;
const NATURES = [["depot", "Dépôt"], ["retrait", "Retrait"], ["credit", "Crédit"], ["gestion_compte", "Gestion de compte"], ["frais", "Frais et commissions"], ["accueil", "Accueil et service"], ["autre", "Autre"]] as const;
const ONGLETS = [["recue", "À traiter"], ["repondue", "Répondues"], ["rapport", "Rapport trimestriel"]] as const;
const VIDE = { recueLe: "", plaignant: "", contact: "", canal: "personne", provenance: "agence", nature: "depot", objet: "" };
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

export default function Plaintes() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number][0]>("recue");
  const [relu, setRelu] = useState(0);
  const { donnees, erreur } = useDonnees(() => (onglet === "rapport" ? Promise.resolve([]) : api.plaintes.lister(onglet)), [onglet, relu]);
  const [nouvelle, setNouvelle] = useState(false);
  const [f, setF] = useState(VIDE);
  const [t, setT] = useState<Tiers | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const [recherche, setRecherche] = useState(false);
  const [choisie, setChoisie] = useState<Plainte | null>(null);
  const [r, setR] = useState<{ fondee: "" | "oui" | "non"; reponse: string; reparation: string }>({ fondee: "", reponse: "", reparation: "" });
  const [accuse, setAccuse] = useState<Plainte | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (j === undefined) return <Chargement />;
  if (erreur) return <><p role="alert" className="erreur-champ">{erreur}</p></>;
  const jour = j?.date ?? "";
  const maj = (p: Partial<typeof VIDE>) => setF({ ...f, ...p });
  const liste = (k: keyof typeof VIDE, libelle: string, valeurs: readonly (readonly [string, string])[]) => (
    <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={f[k]} onChange={(e) => maj({ [k]: e.target.value })}>{valeurs.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</Champ>);
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const p = await api.plaintes.enregistrer({ cle, ...f, recueLe: f.recueLe || jour, tiersId: t?.id ?? null });
        setNouvelle(false); setF(VIDE); setT(null); setCle(nouvelleCle()); setRelu((v) => v + 1); setAccuse(p);
        setBoite({ type: "succes", message: `Enregistré avec succès ! Référence de la plainte : ${p.reference}.` });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  function repondre() {
    if (!choisie) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer la réponse ?", oui: async () => {
      try { setChoisie(await api.plaintes.repondre(choisie.id, { fondee: r.fondee === "" ? undefined : r.fondee === "oui", reponse: r.reponse, reparation: r.reparation })); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      
      <div className="onglets" role="tablist" aria-label="Plaintes">
        {ONGLETS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={k === onglet} onClick={() => setOnglet(k)}>{l}</button>)}
      </div>
      {onglet === "rapport" ? <RapportPlaintes jour={jour} /> : <section className="bloc pile" aria-label="Liste des plaintes">
        <div className="actions-onglets"><button className="bouton" type="button" onClick={() => { setNouvelle(true); setF(VIDE); setT(null); setCle(nouvelleCle()); }}>Nouvelle plainte</button></div>
        <div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Référence</th><th scope="col">Reçue le</th><th scope="col">Plaignant</th><th scope="col">Canal</th><th scope="col">Nature</th><th scope="col">Objet</th>
            <th scope="col">{onglet === "recue" ? "Réponse due le" : "Répondue le"}</th></tr></thead>
          <tbody>
            {(donnees ?? []).length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {(donnees ?? []).map((x) => (
              <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={choisie?.id === x.id} onClick={() => { setChoisie(x); setR({ fondee: "", reponse: "", reparation: "" }); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setChoisie(x); setR({ fondee: "", reponse: "", reparation: "" }); } }}>
                <td className="chiffres">{x.reference}</td><td className="chiffres">{fr(x.recueLe)}</td><td>{x.plaignant}</td><td>{x.canalLibelle}</td><td>{x.natureLibelle}</td><td>{x.objet}</td>
                <td className="chiffres">{onglet === "recue" ? <>{fr(x.echeance)}{x.enRetard ? <strong> · en retard</strong> : ""}</> : fr(x.repondueLe)}</td>
              </tr>))}
          </tbody>
        </table></div>
        <Textes sources={["Instr. BCC 39, art. 3, 4 et 10 : la plainte se reçoit dans tout point d'exploitation, par tout canal, gratuitement", "Art. 7 : un numéro de référence unique, remis au client",
          "Art. 5 : suite dans 45 jours calendaires au plus ; à défaut, le client peut saisir la Banque Centrale du Congo", "Art. 15 : plainte fondée, réparation immédiate ; art. 17 : dossier gardé dix ans ; art. 19 : rapport trimestriel à la BCC"]} />
      </section>}
      <Fiche titre="Nouvelle plainte" ouverte={nouvelle} fermer={() => setNouvelle(false)}>
        <div className="pile">
          <div className="grille-deux">
            <div className="pile">
              <ChampDate libelle="Reçue le : *" valeur={f.recueLe || jour} onChange={(v) => maj({ recueLe: v })} />
              <div className="ligne-champ">
                <Champ libelle="N° client (si client) :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
                <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
              </div>
              {t ? <Champ libelle="Plaignant :">{(p) => <Lecture {...p} value={nomComplet(t)} />}</Champ>
                : <Champ libelle="Plaignant : *">{(p) => <input {...p} className="saisie" value={f.plaignant} onChange={(e) => maj({ plaignant: e.target.value })} />}</Champ>}
              <Champ libelle="Contact (téléphone, adresse) :">{(p) => <input {...p} className="saisie" value={f.contact} onChange={(e) => maj({ contact: e.target.value })} />}</Champ>
            </div>
            <div className="pile">
              {liste("canal", "Canal : *", CANAUX)}
              {liste("provenance", "Provenance : *", PROVENANCES)}
              {liste("nature", "Nature de l'opération : *", NATURES)}
            </div>
          </div>
          <Champ libelle="Objet de la plainte : *">{(p) => <textarea {...p} className="saisie" rows={3} value={f.objet} onChange={(e) => maj({ objet: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button><button className="bouton secondaire" type="button" onClick={() => setNouvelle(false)}>Fermer</button></div>
        </div>
      </Fiche>
      <Fiche titre={choisie ? `Plainte ${choisie.reference}` : ""} ouverte={!!choisie} fermer={() => setChoisie(null)}>
        {choisie && <div className="pile">
          <dl className="info-ligne-liste">
            <div className="info-ligne"><dt>Plaignant</dt><dd>{choisie.plaignant}{choisie.membre ? ` (${choisie.membre})` : ""}{choisie.contact ? ` · ${choisie.contact}` : ""}</dd></div>
            <div className="info-ligne"><dt>Reçue</dt><dd>le {fr(choisie.recueLe)}, {choisie.canalLibelle.toLowerCase()}, {choisie.provenanceLibelle.toLowerCase()} {choisie.agence}, par {choisie.enregistreePar}</dd></div>
            <div className="info-ligne"><dt>Nature</dt><dd>{choisie.natureLibelle}</dd></div>
            <div className="info-ligne"><dt>Objet</dt><dd>{choisie.objet}</dd></div>
            <div className="info-ligne"><dt>Réponse due le</dt><dd className="chiffres">{fr(choisie.echeance)}{choisie.enRetard ? " · en retard" : ""}</dd></div>
          </dl>
          {choisie.statut === "repondue"
            ? <dl className="info-ligne-liste">
                <div className="info-ligne"><dt>Suite</dt><dd>{choisie.fondee ? "Plainte fondée" : "Plainte non fondée"}, le {fr(choisie.repondueLe)}, par {choisie.repondueePar}</dd></div>
                <div className="info-ligne"><dt>Réponse</dt><dd>{choisie.reponse}</dd></div>
                {choisie.reparation && <div className="info-ligne"><dt>Réparation</dt><dd>{choisie.reparation}</dd></div>}
              </dl>
            : <fieldset className="pile cadre-champs">
                <legend>Réponse (chef d'agence)</legend>
                <fieldset className="oui-non"><legend>Plainte fondée : *</legend>
                  <label><input type="radio" name="fondee" checked={r.fondee === "oui"} onChange={() => setR({ ...r, fondee: "oui" })} /> Oui</label>
                  <label><input type="radio" name="fondee" checked={r.fondee === "non"} onChange={() => setR({ ...r, fondee: "non" })} /> Non</label>
                </fieldset>
                <Champ libelle="Réponse au plaignant : *">{(p) => <textarea {...p} className="saisie" rows={3} value={r.reponse} onChange={(e) => setR({ ...r, reponse: e.target.value })} />}</Champ>
                {r.fondee === "oui" && <Champ libelle="Réparation : *">{(p) => <textarea {...p} className="saisie" rows={2} value={r.reparation} onChange={(e) => setR({ ...r, reparation: e.target.value })} />}</Champ>}
              </fieldset>}
          <div className="actions-onglets">
            {choisie.statut === "recue" && <button className="bouton" type="button" onClick={repondre}>Enregistrer la réponse</button>}
            <button className="bouton secondaire" type="button" onClick={() => setAccuse(choisie)}>Accusé de réception</button>
            <button className="bouton secondaire" type="button" onClick={() => setChoisie(null)}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Fiche titre="Accusé de réception" ouverte={!!accuse} fermer={() => setAccuse(null)}>
        {accuse && <article className="releve-std contrat-dat a-imprimer" aria-label="Accusé de réception de la plainte">
          <header className="releve-tete"><p className="releve-num">Réf. <span className="chiffres">{accuse.reference}</span></p><h2 className="releve-titre">ACCUSÉ DE RÉCEPTION D'UNE PLAINTE</h2><div /></header>
          <p>Votre plainte, reçue le {fr(accuse.recueLe)} ({accuse.canalLibelle.toLowerCase()}), porte la référence <strong className="chiffres">{accuse.reference}</strong>. Rappelez-la pour suivre son traitement.</p>
          <p>Objet : {accuse.objet}</p>
          <p>Une réponse vous sera donnée au plus tard le <strong className="chiffres">{fr(accuse.echeance)}</strong>. Sans réponse satisfaisante, vous pouvez saisir la Banque Centrale du Congo en citant cette référence (Instruction BCC n° 39, art. 5, 7 et 11). Le dépôt d'une plainte est gratuit.</p>
          <div className="releve-haut"><div><strong>Le plaignant</strong><br /><br />{accuse.plaignant}</div><div style={{ textAlign: "right" }}><strong>Reçu par</strong><br /><br />{accuse.enregistreePar}, {accuse.agence}</div></div>
        </article>}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setAccuse(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? await api.tiers.rechercher(q) : [])} choisir={(x) => { setT(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Art. 19 : rapport trimestriel à la BCC, par provenance, canal, nature de l'opération et suite */
function RapportPlaintes({ jour }: { jour: string }) {
  const trimestre = (iso: string) => { const a = iso.slice(0, 4), m = Number(iso.slice(5, 7)), q = Math.floor((m - 1) / 3); const debut = `${a}-${String(q * 3 + 1).padStart(2, "0")}-01`;
    const finMois = new Date(Date.UTC(Number(a), q * 3 + 3, 0)).toISOString().slice(0, 10); return [debut, finMois] as const; };
  const [defDu, defAu] = jour ? trimestre(jour) : ["", ""];
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const { donnees: r, erreur } = useDonnees<Rapport | null>(() => ((du || defDu) && (au || defAu) ? api.plaintes.rapport(du || defDu, au || defAu) : Promise.resolve(null)), [du, au, defDu, defAu]);
  const tableau = (titre: string, l: { cle: string; libelle: string; nombre: number }[]) => (
    <fieldset className="pile cadre-champs"><legend>{titre}</legend>
      <table className="grille"><tbody>{l.map((x) => <tr key={x.cle}><td>{x.libelle}</td><td className="montant chiffres">{x.nombre}</td></tr>)}</tbody></table></fieldset>);
  return (
    <section className="bloc pile" aria-label="Rapport trimestriel des plaintes">
      <div className="ligne-champ"><ChampDate libelle="Du" valeur={du || defDu} onChange={setDu} /><ChampDate libelle="Au" valeur={au || defAu} onChange={setAu} /></div>
      {erreur && <p role="alert" className="erreur-champ">{erreur}</p>}
      {r && <>
        <p>Plaintes reçues : <strong className="chiffres">{r.total}</strong> · fondées : <strong className="chiffres">{r.suites.fondee}</strong> · non fondées : <strong className="chiffres">{r.suites.nonFondee}</strong> · en cours : <strong className="chiffres">{r.suites.enCours}</strong> · répondues hors délai : <strong className="chiffres">{r.suites.horsDelai}</strong></p>
        <div className="grille-cadres">{tableau("Provenance", r.provenances)}{tableau("Canal", r.canaux)}{tableau("Nature de l'opération", r.natures)}</div>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => exporterExcel("plaintes", ["Référence", "Reçue le", "Plaignant", "Provenance", "Canal", "Nature", "Objet", "Suite", "Répondue le"],
          r.plaintes.map((x) => [x.reference, fr(x.recueLe), x.plaignant, x.provenanceLibelle, x.canalLibelle, x.natureLibelle, x.objet, x.fondee === null ? "En cours" : x.fondee ? "Fondée" : "Non fondée", fr(x.repondueLe)]))}>Exporter</button></div>
      </>}
      <Textes sources={["Instr. BCC 39, art. 19 : rapport trimestriel à la BCC (Direction de la Surveillance des Intermédiaires Financiers) : nombre et dates, provenance, canaux, nature des transactions, suites"]} />
    </section>
  );
}
