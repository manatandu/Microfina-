import { useState } from "react";
import { api, MOTIFS_FIN_PROCURATION, type RepresentantSaisi, type SaisieProcuration } from "../donnees/api";
import type { Procuration, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Lecture, Paginee } from "../composants";
import { ChampsRepresentant } from "./Membres";
import { lireImage, RechercheClient } from "./Visa";

const ONGLETS = ["Nouveau type procuration", "Procurations"] as const;

/** S47 : Client > Gestion des procurations (manuel Microfina++, p. 56). Premier onglet : l'écran « Nouveau type procuration » du manuel.
 * Second onglet : la procuration elle-même, que le manuel ne montre pas, imposée par la loi 22/068, art. 31, al. 3, 33 et 44, 2° (confrontation du 21/11/2026, E2). */
export function TypesProcuration() {
  const [onglet, setOnglet] = useState(0);
  return (
    <>
      <div className="onglets" role="tablist" aria-label="Gestion des procurations">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <div id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>{onglet === 0 ? <NouveauType /> : <ProcurationsClient />}</div>
    </>
  );
}

function NouveauType() {
  const { donnees: liste } = useDonnees(() => api.procurations.lire());
  const [libelle, setLibelle] = useState("");
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!liste) return <Chargement />;
  const annuler = () => { setLibelle(""); setChoisi(null); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); annuler(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <h1>Nouveau type procuration</h1>
      <section className="bloc pile" aria-label="Type de procuration">
        <div className="formulaire">
          <Champ libelle="Libellé *">{(p) => <input {...p} className="saisie" required autoComplete="off" value={libelle} onChange={(e) => setLibelle(e.target.value)} />}</Champ>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.procurations.creer({ libelle }))}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.procurations.supprimer(choisi))}>Supprimer</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <Paginee lignes={liste}>{(visibles) => (<table className="grille">
          <thead><tr><th scope="col">Nom Type procuration</th></tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td>Aucune ligne.</td></tr>}
            {visibles.map((t) => (
              <tr key={t.id} className="ligne-choix" tabIndex={0} aria-selected={choisi === t.id} onClick={() => setChoisi(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setChoisi(t.id); }}>
                <td>{t.libelle}</td>
              </tr>
            ))}
          </tbody>
        </table>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 56 : « Gestion des procurations », écran Nouveau type procuration (Libellé*, Enregistrer, Supprimer, Annuler, Nom Type procuration)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 15, art. 11 et 16 : le mandataire est identifié et habilité ; la saisie d'une procuration n'est pas montrée par le manuel"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

const VIDE: Omit<SaisieProcuration, "mandantId" | "typeId"> = { dateDebut: "", nom: "", postnom: "", prenom: "", pieceType: "", pieceNumero: "", pieceExpire: "", reference: "", dateFin: "", telephone: "" };

/** Procurations d'un client : mandant, type, mandataire identifié, copies, dates, fin du mandat (Code civil, art. 526 à 548 ; loi 22/068, art. 31, 33 et 44 ;
 * Instr. BCC 15, art. 11, 12, 16 et 29). Au guichet, le retrait par un mandataire se fait sur une procuration en cours. */
function ProcurationsClient() {
  const [t, setT] = useState<Tiers | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), types: await api.procurations.lire(),
    liste: t ? await api.procurations.duClient(t.id) : [] }), [t?.id, relu]);
  const [f, setF] = useState<typeof VIDE & { typeId?: number }>(VIDE);
  const [choisie, setChoisie] = useState<Procuration | null>(null);
  const [fin, setFin] = useState({ motif: "", date: "" });
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { ctx, types, liste } = donnees;
  const maj = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const confirmer = (texte: string, faire: () => Promise<unknown>, apres: () => void) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); apres(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const image = (k: "copieActe" | "copiePiece") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]; e.target.value = "";
    if (fichier) lireImage(fichier).then((v) => maj({ [k]: v }), (x) => setBoite({ type: "erreur", message: message(x) }));
  };
  const nom = (p: { nom: string; postnom: string; prenom: string }) => [p.nom, p.postnom, p.prenom].filter(Boolean).join(" ");
  return (
    <section className="bloc pile" aria-label="Procurations">
      <h1>Procurations</h1>
      <div className="formulaire">
        <div className="ligne-champ">
          <Champ libelle="N° client (mandant)">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
        </div>
        <Champ libelle="Intitulé">{(p) => <Lecture {...p} value={t ? t.intitule || nom(t) : ""} />}</Champ>
      </div>
      {t && <>
        <table className="grille" aria-label="Procurations du client">
          <thead><tr><th scope="col">Type</th><th scope="col">Mandataire</th><th scope="col">Pièce</th><th scope="col">Du</th><th scope="col">Au</th><th scope="col">État</th></tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
            {liste.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={choisie?.id === x.id} onClick={() => setChoisie(x)}
              onKeyDown={(e) => { if (e.key === "Enter") setChoisie(x); }}>
              <td>{x.type}</td><td>{nom(x)}</td><td>{x.pieceType} <span className="chiffres">{x.pieceNumero}</span></td><td className="chiffres">{x.dateDebut}</td>
              <td className="chiffres">{x.dateFin}</td><td>{x.finLe ? `Terminée le ${x.finLe} : ${x.finMotif}` : x.enCours ? (x.ayantDroit ? "En cours (ayant droit)" : "En cours") : "Pas encore en vigueur"}</td></tr>)}
          </tbody>
        </table>
        {choisie && !choisie.finLe && <fieldset className="pile cadre-champs champs-a-gauche">
          <legend>Fin de la procuration de {nom(choisie)}</legend>
          <Champ libelle="Motif : *">{(p) => <select {...p} className="saisie" value={fin.motif} onChange={(e) => setFin({ ...fin, motif: e.target.value })}>
            <option value=""></option>{MOTIFS_FIN_PROCURATION.map((m) => <option key={m}>{m}</option>)}</select>}</Champ>
          <ChampDate libelle="Date de fin : *" valeur={fin.date} onChange={(v) => setFin({ ...fin, date: v })} requis />
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.procurations.mettreFin(choisie.id, fin),
              () => { setChoisie(null); setFin({ motif: "", date: "" }); })}>Mettre fin</button>
            <button className="bouton secondaire" type="button" onClick={() => setChoisie(null)}>Annuler</button>
          </div>
        </fieldset>}
        <fieldset className="pile cadre-champs">
          <legend>Nouvelle procuration</legend>
          <div className="formulaire">
            <Champ libelle="Type de procuration : *">{(p) => <select {...p} className="saisie" value={f.typeId ?? ""} onChange={(e) => maj({ typeId: e.target.value ? Number(e.target.value) : undefined })}>
              <option value=""></option>{types.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Référence de l'acte :">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.reference ?? ""} onChange={(e) => maj({ reference: e.target.value })} />}</Champ>
            <ChampDate libelle="Date de début : *" valeur={f.dateDebut} onChange={(v) => maj({ dateDebut: v })} requis />
            <ChampDate libelle="Date de fin :" valeur={f.dateFin ?? ""} onChange={(v) => maj({ dateFin: v })} />
            {t.decesLe && <label className="case"><input type="checkbox" checked={!!f.ayantDroit} onChange={(e) => maj({ ayantDroit: e.target.checked })} />
              <span>Ayant droit (titulaire décédé le {t.decesLe}), sur la pièce de succession</span></label>}
            <Champ libelle="Téléphone du mandataire :">{(p) => <input {...p} className="saisie code" type="tel" autoComplete="off" value={f.telephone ?? ""} onChange={(e) => maj({ telephone: e.target.value })} />}</Champ>
          </div>
          <h2>Mandataire</h2>
          <ChampsRepresentant r={f as RepresentantSaisi} maj={(p) => maj(p as Partial<typeof f>)} ctx={ctx} />
          <div className="deux-colonnes">
            {([["copieActe", f.ayantDroit ? "Copie de la pièce de succession" : "Copie de la procuration"], ["copiePiece", "Copie de la pièce du mandataire"]] as const).map(([k, titre]) => (
              <fieldset key={k} className="pile cadre-champs">
                <legend>{titre} *</legend>
                <div className="actions-ligne"><label className="bouton secondaire">Choisir un fichier<input className="sr-only" type="file" accept="image/png,image/jpeg" aria-label={`Choisir : ${titre}`} onChange={image(k)} /></label></div>
                <div className="cadre-signature apercu-grand">{f[k] ? <img src={f[k]} alt={`Aperçu : ${titre}`} /> : <p className="muet">Aucune image déposée</p>}</div>
              </fieldset>))}
          </div>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?",
              () => api.procurations.enregistrer({ ...f, mandantId: t.id, typeId: f.typeId ?? 0 }), () => setF(VIDE))}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setF(VIDE)}>Annuler</button>
          </div>
        </fieldset>
      </>}
      <Textes sources={["Code civil, livre III, art. 526 à 548 : le mandat ; sa fin par révocation, renonciation, décès ou déconfiture (art. 544)",
        "Loi 22/068, art. 31, al. 3 : représentants habilités ; art. 33 : identité, pièce et pouvoir, dont il est pris copie ; art. 44, 2° : informations centralisées sur les mandataires",
        "Instr. BCC 15, art. 11, 12, 13, 16 et 29 : mandataire identifié comme un client, copies gardées",
        "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut !== "prospect" && x.statut !== "resilie") : [])}
          choisir={(x) => { setT(x); setChoisie(null); setF(VIDE); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
