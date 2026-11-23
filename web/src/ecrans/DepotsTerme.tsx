// Épargne > Dépôts à terme (plan d'allègement, point 5.1) : une liste filtrée par statut, les actions permises sur chaque ligne, un bouton « Nouveau DAT ».
// Reprend S65 mise en place (manuel Microfina++, p. 75 et 76), S66 validation et contrat (p. 76), S67 rupture (p. 76 et 77), S68 recherche (p. 77).
// Le DAT attend sa validation par une autre personne, qui passe l'écriture (PCCI 340). Registre S65-1 à S65-13, S67-1 à S67-6.
import { useState } from "react";
import { ajouterMois, api, interetDat } from "../donnees/api";
import type { Beneficiaire, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { lireMontant, montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee, LigneFiltres } from "../composants";
import { RechercheClient } from "./Visa";
import { InteretsDat } from "./FinPeriode";

type Dat = Awaited<ReturnType<typeof api.depotsTerme.liste>>[number];
type Contrat = Awaited<ReturnType<typeof api.depotsTerme.contrat>>;
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const VIDE = { produit: "", compte: "", montant: "", duree: "", ti: "", tp: "", aEcheance: false, depot: "", observation: "", reconduction: false };

/** « Nouveau DAT » : la fenêtre de mise en place (S65) */
function FormulaireDat({ fini }: { fini: () => void }) {
  const { donnees } = useDonnees(async () => ({ produits: await api.depotsTerme.produits(), j: await api.journees.courante() }));
  const [f, setF] = useState(VIDE);
  const [t, setT] = useState<Tiers | null>(null);
  const [fait, setFait] = useState<Dat | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const [recherche, setRecherche] = useState(false);
  const [benef, setBenef] = useState<Beneficiaire[] | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  // Plan d'allègement, point 5.2 : le compte DAT se prend d'office ; s'il n'existe pas, son numéro est celui qu'ouvrira l'enregistrement
  const { donnees: nouveauDat } = useDonnees(() => (t && f.produit ? api.comptesEpargne.apercu(t.id, Number(f.produit)).then((a) => a.numero, () => "") : Promise.resolve("")), [t?.id, f.produit]);
  if (!donnees) return <Chargement />;
  const maj = (p: Partial<typeof VIDE>) => { setF((x) => ({ ...x, ...p })); setFait(null); };
  const jour = donnees.j && donnees.j.statut === "ouverte" ? donnees.j.date : "";
  const p = donnees.produits.find((x) => String(x.id) === f.produit);
  const duProduit = (c: { intitule: string; devise: string }) => !!p && c.intitule === p.libelle && c.devise === p.devise;
  const emetteurs = (comptes ?? []).filter((c) => p && !duProduit(c) && c.devise === p.devise);
  const compteDat = (comptes ?? []).find((c) => duProduit(c))?.numero ?? nouveauDat ?? "";
  const em = emetteurs.find((c) => String(c.id) === f.compte);
  const dev = (p?.devise ?? "CDF") as Devise;
  const m = f.montant.trim() ? lireMontant(f.montant) : null, mois = /^\d{1,3}$/.test(f.duree) ? Number(f.duree) : 0;
  const tauxOk = /^\d+([.,]\d{1,4})?$/.test(f.ti.trim() || "0");
  const interet = m && mois && tauxOk ? interetDat(m, f.ti.trim() || "0", mois) : 0;
  const depot = f.depot || jour;
  const echeance = depot && mois ? ajouterMois(depot, mois) : "";
  const effacer = () => { setF(VIDE); setT(null); setFait(null); setCle(nouvelleCle()); };

  function enregistrer() {
    const d = { cle, produitId: p?.id, tiersId: t?.id, compteEmetteurId: f.compte ? Number(f.compte) : undefined,
      montant: m ?? 0, duree: mois, tauxInteret: f.ti, tauxPenalite: f.tp, aEcheance: f.aEcheance, dateDepot: depot, observation: f.observation, reconduction: f.reconduction };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { setFait(await api.depotsTerme.mettreEnPlace(d)); setCle(nouvelleCle()); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <section className="pile" aria-label="Mise en place DAT">
        <div className="grille-deux">
          <fieldset className="pile cadre-champs">
            <legend>Infos de base</legend>
            <div className="ligne-champ">
              <Champ libelle="N° du Client :">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé du compte :">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Produit : *">{(pp) => <select {...pp} className="saisie" value={f.produit} onChange={(e) => maj({ produit: e.target.value, compte: "",
              ti: donnees.produits.find((x) => String(x.id) === e.target.value)?.tauxInteret ?? "" })}>
              <option value=""></option>{donnees.produits.map((x) => <option key={x.id} value={x.id}>{x.libelle} ({x.code})</option>)}</select>}</Champ>
            <Champ libelle="N° Compte :">{(pp) => <select {...pp} className="saisie" value={f.compte} disabled={!t || !p} onChange={(e) => maj({ compte: e.target.value })}>
              <option value="">{!t ? "Choisir d'abord le client" : !p ? "Choisir d'abord le produit" : ""}</option>{emetteurs.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            <p>Solde : <strong className="chiffres">{em && em.solde !== null && em.solde !== undefined ? montant(em.disponible ?? em.solde, dev) : "0"}</strong></p>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Infos Certificat</legend>
            {fait ? <p>Certificat N° : <strong className="chiffres">{String(fait.certificat).padStart(6, "0")}</strong></p> : null}
            <Champ libelle="Montant : *">{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
            <Champ libelle="Durée (Mois) : *">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.duree} onChange={(e) => { if (/^\d{0,3}$/.test(e.target.value)) maj({ duree: e.target.value }); }} />}</Champ>
            <Champ libelle="Taux intérêt (%) :">{(pp) => <input {...pp} className="saisie code" inputMode="decimal" autoComplete="off" readOnly={!p?.tauxNegociable} value={f.ti} onChange={(e) => maj({ ti: e.target.value })} />}</Champ>
            <Champ libelle="Taux pénalité (%) :">{(pp) => <input {...pp} className="saisie code" inputMode="decimal" autoComplete="off" value={f.tp} onChange={(e) => maj({ tp: e.target.value })} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Intérêt</legend>
            <Champ libelle="Compte DAT :">{(pp) => <Lecture {...pp} value={compteDat} />}</Champ>
            <p>Montant intérêt : <strong className="chiffres">{montant(interet, dev)}</strong></p>
            <p>Montant à verser : <strong className="chiffres">{montant((m ?? 0) + interet, dev)}</strong></p>
            <Champ libelle="Date de dépôt">{(p) => <input {...p} className="saisie date" readOnly value={fr(depot)} />}</Champ>
            <Champ libelle="Date échéance :">{(pp) => <input {...pp} className="saisie date" readOnly value={echeance ? fr(echeance) : ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Autres infos</legend>
            <Champ libelle="Observation :">{(pp) => <textarea {...pp} className="saisie" rows={2} value={f.observation} onChange={(e) => maj({ observation: e.target.value })} />}</Champ>
            <label className="case"><input type="checkbox" checked={f.reconduction} onChange={(e) => maj({ reconduction: e.target.checked })} /><span>Reconduction automatique</span></label>
            <button className="bouton secondaire" type="button" disabled={!t} onClick={() => setBenef(t?.beneficiaires ?? [])}>Bénéficiaire</button>
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!!fait} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
          <button className="bouton secondaire" type="button" onClick={fini}>Fermer</button>
        </div>
        <p className="montant-lettres">{m ? montantEnLettres(m, dev) : ""}</p>
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); maj({ compte: "" }); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <FicheBeneficiaires lignes={benef} fermer={() => setBenef(null)} />
      <Dialogue boite={boite} fermer={() => { const b = boite; setBoite(null); if (b?.type === "succes") fini(); }} />
    </>
  );
}

const STATUTS: Record<string, string> = { saisie: "À valider", valide: "Validé", rompu: "Rompu", echu: "Échu", annule: "Annulé", reconduit: "Reconduit" };
/** Bouton Bénéficiaire (captures p. 75 et 77) : les bénéficiaires inscrits sur la fiche du client (S37, registre S37-3), en lecture (registre S65-6) */
export function FicheBeneficiaires({ lignes, fermer }: { lignes: Beneficiaire[] | null; fermer: () => void }) {
  return (
    <Fiche titre="Bénéficiaire" ouverte={!!lignes} fermer={fermer}>
      <div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">Nom</th><th scope="col">Post-nom</th><th scope="col">Prénom</th><th scope="col">Sexe</th><th scope="col">Date de naissance</th><th scope="col">Lien de parenté</th><th scope="col">Téléphone</th></tr></thead>
        <tbody>
          {(lignes ?? []).length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
          {(lignes ?? []).map((b, i) => <tr key={i}><td>{b.nom}</td><td>{b.postnom}</td><td>{b.prenom}</td><td>{b.sexe}</td><td className="chiffres">{b.naissance ? fr(b.naissance) : ""}</td><td>{b.filiation}</td><td className="chiffres">{b.telephone}</td></tr>)}
        </tbody>
      </table></div>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
    </Fiche>
  );
}
/** Épargne > Dépôts à terme (plan d'allègement, point 5.1) : chaque ligne montre les actions que le statut et les droits de l'utilisateur permettent */
const FILTRES: [string, string, Dat["statut"][]][] = [["", "Tous", []], ["saisie", "À valider", ["saisie"]], ["valide", "En cours", ["valide"]],
  ["echu", "Échus", ["echu", "reconduit"]], ["rompu", "Rompus", ["rompu"]], ["annule", "Annulés", ["annule"]]];
export default function DepotsATerme() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const [lignes, u, j] = await Promise.all([api.depotsTerme.liste(), api.session.courante(), api.journees.courante()]);
    return { lignes, droits: new Set((u as { droits?: string[] } | null)?.droits ?? []), jour: j?.date ?? "" };
  }, [relu]);
  const [filtre, setFiltre] = useState("");
  const [nouveau, setNouveau] = useState(false);
  const [courus, setCourus] = useState(false);
  const [rompre, setRompre] = useState<Dat | null>(null);
  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [avis, setAvis] = useState<Contrat | null>(null);
  const [piece, setPiece] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { droits } = donnees;
  const statuts = FILTRES.find(([k]) => k === filtre)?.[2] ?? [];
  const lignes = donnees.lignes.filter((x) => !statuts.length || statuts.includes(x.statut));
  const relire = () => setRelu((v) => v + 1);
  const confirmer = (question: string, faire: () => Promise<void>) => setBoite({ type: "confirmation", message: question, oui: async () => {
    try { await faire(); relire(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (e) { setBoite({ type: "erreur", message: message(e) }); }
  } });
  const num = (x: Dat) => String(x.certificat).padStart(6, "0");
  const actions = (x: Dat) => {
    const b: [string, () => void][] = [];
    if (x.statut === "saisie" && droits.has("S66")) b.push(["Valider", () => confirmer("Voulez-vous vraiment valider ?", async () => { setPiece((await api.depotsTerme.valider(x.id)).piece ?? ""); })]);
    if (x.statut === "saisie" && droits.has("S65")) b.push(["Annuler", () => confirmer(`Voulez-vous vraiment annuler le DAT n° ${num(x)} ?`, async () => { await api.depotsTerme.annuler(x.id); })]);
    if (x.statut !== "annule" && x.statut !== "rompu") b.push(["Contrat", async () => setContrat(await api.depotsTerme.contrat(x.id))]);
    if (x.statut === "valide" && droits.has("S67")) b.push(["Rompre", () => setRompre(x)]);
    if (x.statut === "rompu") b.push(["Avis de rupture", async () => setAvis(await api.depotsTerme.contrat(x.id))]);
    return b;
  };
  return (
    <>
      <section className="bloc pile" aria-label="Dépôts à terme">
        <div className="ligne-champ">
          <Champ libelle="Statut :">{(pp) => <select {...pp} className="saisie" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            {FILTRES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>
          {droits.has("S65") && <button className="bouton" type="button" onClick={() => setNouveau(true)}>Nouveau DAT</button>}
          <button className="bouton secondaire" type="button" onClick={() => setCourus(true)}>Intérêts courus</button>
        </div>
        {piece ? <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p> : null}
        <Paginee lignes={lignes} colonnes={(x) => [num(x), fr(x.dateDepot), x.membre, x.client, x.compteDat, montant(x.montant, x.devise as Devise), `${x.duree} mois`, `${x.tauxInteret} %`,
          montant(x.montantInteret, x.devise as Devise), fr(x.dateEcheance), STATUTS[x.statut] ?? "", null]}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Certificat</th><th scope="col">Date dépôt</th><th scope="col">N° membre</th><th scope="col">Client</th><th scope="col">N° compte DAT</th>
            <th scope="col" className="montant">Montant dépôt</th><th scope="col">Durée</th><th scope="col">Taux intérêt</th><th scope="col" className="montant">Montant intérêt</th>
            <th scope="col">Date échéance</th><th scope="col">Statut</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
            <LigneFiltres titres={["Certificat", "Date dépôt", "N° membre", "Client", "N° compte DAT", "Montant dépôt", "Durée", "Taux intérêt", "Montant intérêt", "Date échéance", "Statut", null]} /></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={12}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.id}>
              <td className="chiffres">{num(x)}</td><td className="chiffres">{fr(x.dateDepot)}</td><td className="chiffres">{x.membre}</td><td>{x.client}</td><td className="chiffres">{x.compteDat}</td>
              <td className="montant chiffres">{montant(x.montant, x.devise as Devise)}</td><td>{x.duree} mois</td><td className="chiffres">{x.tauxInteret} %</td>
              <td className="montant chiffres">{montant(x.montantInteret, x.devise as Devise)}</td><td className="chiffres">{fr(x.dateEcheance)}</td><td>{STATUTS[x.statut]}</td>
              <td><div className="ligne-champ">{actions(x).map(([l, f]) => <button key={l} className="bouton secondaire" type="button" aria-label={`${l} ${num(x)}`} onClick={f}>{l}</button>)}</div></td>
            </tr>)}
          </tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 75 à 77 : mise en place, validation et contrat, rupture, recherche des DAT",
          "Plan d'allègement, point 5.1 : une liste par statut, les actions sur la ligne, un bouton Nouveau DAT",
          "Quatre yeux : la validation vient d'une autre personne que celle qui a mis le DAT en place (Instr. BCC 008, art. 66) ; écriture du compte émetteur au compte DAT (PCCI 340)",
          "Intérêts courus des DAT : PCCI § 6.4 (charges rattachées à la période)",
          "Rupture : retenue de 20 % sur l'intérêt brut des dépôts à échéance fixe des personnes physiques (loi 23/053, art. 78, 81 et 120), au compte 433 ; pénalité au compte 7791"]} />
      </section>
      <Fiche titre="Mise en place DAT" ouverte={nouveau} fermer={() => setNouveau(false)}>
        {nouveau && <FormulaireDat fini={() => { setNouveau(false); relire(); }} />}
      </Fiche>
      <Fiche titre="Intérêts courus sur dépôts à terme" ouverte={courus} fermer={() => setCourus(false)}>
        {courus && <InteretsDat jour={donnees.jour} valider={droits.has("S128")} />}
        <div className="actions-onglets sans-impression"><button className="bouton secondaire" type="button" onClick={() => setCourus(false)}>Fermer</button></div>
      </Fiche>
      <Fiche titre="Rupture DAT" ouverte={!!rompre} fermer={() => { setRompre(null); relire(); }}>
        {rompre && <FormulaireRupture dat={rompre} fini={(pc) => { setRompre(null); if (pc) setPiece(pc); relire(); }} />}
      </Fiche>
      <Fiche titre="Contrat de dépôt à terme" ouverte={!!contrat} fermer={() => setContrat(null)}>
        {contrat && <ContratDat c={contrat} />}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setContrat(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>
      <Fiche titre="Avis de rupture de DAT" ouverte={!!avis} fermer={() => setAvis(null)}>
        {avis && <AvisRupture c={avis} />}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setAvis(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Contrat de dépôt à terme (registre S65-7) : document de l'institution cliente, conditions du DAT, signatures */
function ContratDat({ c }: { c: Contrat }) {
  const x = c.dat, e = c.entete, cl = c.client, dev = x.devise as Devise;
  const nom = cl.intitule || [cl.nom, cl.postnom, cl.prenom].filter(Boolean).join(" ");
  const lignes: [string, string][] = [
    ["Certificat n°", String(x.certificat).padStart(6, "0")], ["Client", `${nom} (n° ${x.membre})`], ["Compte DAT", x.compteDat], ["Compte émetteur", x.compteEmetteur],
    ["Montant déposé", `${montant(x.montant, dev)} (${montantEnLettres(x.montant, dev)})`], ["Durée", `${x.duree} mois`], ["Date de dépôt", fr(x.dateDepot)],
    ["Date d'échéance", fr(x.dateEcheance)], ["Taux d'intérêt annuel", `${x.tauxInteret} %`], ["Intérêt à l'échéance", montant(x.montantInteret, dev)],
    ["Montant à verser à l'échéance", montant(x.montantAVerser, dev)], ["Taux de pénalité en cas de rupture anticipée", `${x.tauxPenalite} %`],
    ["Reconduction automatique", x.reconduction ? "Oui, aux mêmes conditions" : "Non"],
    ["Calcul de l'intérêt", "Intérêt simple : montant × taux annuel × nombre de mois / 12, payé à l'échéance"],   // Code civil, art. 480 ; Instr. BCC 40, art. 4 (S65-3)
    ["Rupture avant l'échéance", "Intérêt au prorata des jours courus (année de 365 jours), moins une pénalité égale au taux de pénalité appliqué au montant déposé"],   // S67-2
    ["Retenue d'impôt", "20 % de l'intérêt pour une personne physique"],   // S67-3
  ];
  return (
    <article className="releve-std contrat-dat a-imprimer" aria-label="Contrat de dépôt à terme">
      <header className="releve-tete">
        <p className="releve-num">N° <span className="chiffres">{String(x.certificat).padStart(6, "0")}</span></p>
        <h2 className="releve-titre">CONTRAT DE DÉPÔT À TERME</h2>
        <div className="releve-logo">{e.logo ? <img src={e.logo} alt={e.nom} /> : <strong>{e.sigle || e.nom}</strong>}<span>{e.nom}</span></div>
      </header>
      <table className="releve-synthese"><tbody>{lignes.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td style={{ textAlign: "left" }}>{v}</td></tr>)}</tbody></table>
      {x.observation && <p>Observation : {x.observation}</p>}
      <div className="releve-haut">
        <div><strong>Le client</strong><br /><br /><br />{nom}</div>
        <div style={{ textAlign: "right" }}><strong>Pour {e.nom}</strong><br /><br /><br />Fait le {fr(x.dateDepot)}</div>
      </div>
      <footer className="releve-pied">
        <strong>{e.nom.toUpperCase()}</strong>
        <span>{[e.adresse, e.commune, e.ville, e.pays].filter(Boolean).join(", ")}</span>
        <span>{[e.agrement && `Agrément BCC n° ${e.agrement}`, e.ifu && `N° impôt : ${e.ifu}`, e.bp && `B.P. ${e.bp}`].filter(Boolean).join(" · ")}</span>
      </footer>
    </article>
  );
}

type Apercu = Awaited<ReturnType<typeof api.depotsTerme.apercuRupture>>;
/** Action « Rompre » d'un DAT en cours : la fenêtre de S67 (manuel p. 76 texte, p. 77 capture). Registre S67-1 à S67-6. */
function FormulaireRupture({ dat, fini }: { dat: Dat; fini: (piece?: string) => void }) {
  const { donnees: j } = useDonnees(async () => { const jj = await api.journees.courante(); const d = jj && jj.statut === "ouverte" ? jj.date : "";
    try { setCalc(await api.depotsTerme.apercuRupture(dat.id, d)); } catch (e) { setBoite({ type: "erreur", message: message(e) }); } return jj; }, [dat.id]);
  const [date, setDate] = useState("");
  const [demande, setDemande] = useState("");
  const choix = dat;
  const [calc, setCalc] = useState<Apercu | null>(null);
  const [fait, setFait] = useState<Dat | null>(null);
  const [avis, setAvis] = useState<Contrat | null>(null);
  const [benef, setBenef] = useState<Beneficiaire[] | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (j === undefined) return <Chargement />;
  const jour = j && j.statut === "ouverte" ? j.date : "";
  const dr = date || jour;
  async function calculer(x: Dat, d: string) {
    setFait(null);
    try { setCalc(await api.depotsTerme.apercuRupture(x.id, d)); }
    catch (e) { setCalc(null); setBoite({ type: "erreur", message: message(e) }); }
  }
  function rompre() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment rompre ce DAT ?", oui: async () => {
      try { setFait(await api.depotsTerme.rompre(choix.id, { dateRupture: dr, dateDemande: demande || dr })); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (e) { setBoite({ type: "erreur", message: message(e) }); }
    } });
  }
  const x = fait ?? calc?.dat ?? choix;
  const r = fait?.rupture ?? calc;
  const dev = (x?.devise ?? "CDF") as Devise;
  const mt = (v: number | undefined) => (x && v !== undefined ? montant(v, dev) : "");
  return (
    <>
      <section className="pile" aria-label="Rupture DAT">
        <div className="grille-deux">
          {(fait?.rupture?.piece ?? "") ? <p>Numéro de pièce : <strong className="chiffres">{fait?.rupture?.piece ?? ""}</strong></p> : null}
          <ChampDate libelle="Date rupture : *" valeur={dr} onChange={(v) => { setDate(v); if (choix && !fait) void calculer(choix, v); }} requis />
        </div>
        <div className="grille-deux">
          <fieldset className="pile cadre-champs">
            <legend>Infos du DAT</legend>
            <Champ libelle="Certificat N° :">{(pp) => <input {...pp} className="saisie code" readOnly value={x ? String(x.certificat).padStart(6, "0") : ""} />}</Champ>
            <ChampDate libelle="Date demande :" valeur={demande || dr} onChange={setDemande} />
            <p>Durée prêt : <strong className="chiffres">{x ? `${x.duree} Mois` : "Mois"}</strong></p>
            <Champ libelle="Date échéance :">{(pp) => <input {...pp} className="saisie date" readOnly value={x ? fr(x.dateEcheance) : ""} />}</Champ>
            <p>Montant du DAT : <strong className="chiffres">{mt(x?.montant)}</strong></p>
            <p>Produit : <strong>{x?.produit ?? ""}</strong></p>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Infos client</legend>
            <Champ libelle="N° Client :">{(pp) => <input {...pp} className="saisie code" readOnly value={x?.membre ?? ""} />}</Champ>
            <Champ libelle="Intitulé du compte :">{(pp) => <Lecture {...pp} value={x?.client ?? ""} />}</Champ>
            <Champ libelle="N° compte :">{(pp) => <input {...pp} className="saisie code" readOnly value={x?.compteEmetteur ?? ""} />}</Champ>
            <Champ libelle="N° compte DAT :">{(pp) => <input {...pp} className="saisie code" readOnly value={x?.compteDat ?? ""} />}</Champ>
          </fieldset>
          <RecapRupture dev={dev} capital={r ? x?.montant : undefined} interet={r?.interet} tauxInteret={x?.tauxInteret} penalite={r?.penalite} tauxPenalite={x?.tauxPenalite}
            irc={r?.irc} tauxIrc={r?.tauxIrc} net={r?.montantAVerser} />
          <fieldset className="pile cadre-champs">
            <legend>Autres infos</legend>
            <Champ libelle="Observation :">{(pp) => <Lecture {...pp} value={x?.observation ?? ""} />}</Champ>
            <label className="case"><input type="checkbox" checked={!!x?.reconduction} readOnly disabled /><span>Reconduction automatique</span></label>
            <button className="bouton secondaire" type="button" disabled={!x} onClick={async () => { if (x) setBenef((await api.tiers.lire(x.tiersId))?.beneficiaires ?? []); }}>Bénéficiaire</button>
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!!fait} onClick={rompre}>Rompre le DAT</button>
          <button className="bouton secondaire" type="button" disabled={!fait} onClick={async () => fait && setAvis(await api.depotsTerme.contrat(fait.id))}>Imprimer</button>
          <button className="bouton secondaire" type="button" onClick={() => fini(fait?.rupture?.piece)}>Fermer</button>
        </div>
      </section>
      <FicheBeneficiaires lignes={benef} fermer={() => setBenef(null)} />
      <Fiche titre="Avis de rupture de DAT" ouverte={!!avis} fermer={() => setAvis(null)}>
        {avis && <AvisRupture c={avis} />}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setAvis(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Rupture d'une épargne à terme, même modèle pour un DAT et un plan d'épargne (plan d'allègement, point 5.5) : capital, intérêt acquis, pénalité s'il y en a,
 * retenue d'impôt de 20 % des personnes physiques (loi 23/053, art. 120), net à verser */
export function RecapRupture({ dev, capital, interet, tauxInteret, penalite, tauxPenalite, irc, tauxIrc, net }: { dev: Devise; capital?: number; interet?: number; tauxInteret?: string;
  penalite?: number; tauxPenalite?: string; irc?: number; tauxIrc?: string; net?: number }) {
  const mt = (v: number | undefined) => (v === undefined ? "" : montant(v, dev));
  return (
    <fieldset className="pile cadre-champs">
      <legend>Rupture</legend>
      <p>Capital : <strong className="chiffres">{mt(capital)}</strong></p>
      <p>Intérêt acquis{tauxInteret ? ` (${tauxInteret} %)` : ""} : <strong className="chiffres">{mt(interet)}</strong></p>
      {penalite !== undefined && penalite > 0 && <p>Pénalité{tauxPenalite ? ` (${tauxPenalite} %)` : ""} : <strong className="chiffres">{mt(penalite)}</strong></p>}
      <p>Retenue d'impôt{tauxIrc ? ` (${tauxIrc} %)` : ""} : <strong className="chiffres">{mt(irc)}</strong></p>
      <p>Net à verser : <strong className="chiffres">{mt(net)}</strong></p>
    </fieldset>
  );
}

/** Document remis au client à la rupture (Instr. BCC 40, art. 13), même gabarit que le contrat (registre S67-6) */
function AvisRupture({ c }: { c: Contrat }) {
  const x = c.dat, e = c.entete, cl = c.client, dev = x.devise as Devise, r = x.rupture!;
  const nom = cl.intitule || [cl.nom, cl.postnom, cl.prenom].filter(Boolean).join(" ");
  const lignes: [string, string][] = [
    ["Certificat n°", String(x.certificat).padStart(6, "0")], ["Client", `${nom} (n° ${x.membre})`], ["Compte DAT", x.compteDat], ["Compte crédité", x.compteEmetteur],
    ["Montant du DAT", montant(x.montant, dev)], ["Date de dépôt", fr(x.dateDepot)], ["Date d'échéance prévue", fr(x.dateEcheance)],
    ["Date de la demande", fr(r.dateDemande)], ["Date de rupture", fr(r.dateRupture)], ["Jours courus", String(r.jours)],
    ["Intérêt couru", `${montant(r.interet, dev)} (taux ${x.tauxInteret} %)`], ["Pénalité de rupture", `${montant(r.penalite, dev)} (taux ${x.tauxPenalite} %)`],
    ["Retenue d'impôt (IRC)", `${montant(r.irc, dev)} (taux ${r.tauxIrc} %)`], ["Montant versé", `${montant(r.montantAVerser, dev)} (${montantEnLettres(r.montantAVerser, dev)})`],
    ["N° de pièce", r.piece],
  ];
  return (
    <article className="releve-std contrat-dat a-imprimer" aria-label="Avis de rupture de DAT">
      <header className="releve-tete">
        <p className="releve-num">N° <span className="chiffres">{String(x.certificat).padStart(6, "0")}</span></p>
        <h2 className="releve-titre">RUPTURE DE DÉPÔT À TERME</h2>
        <div className="releve-logo">{e.logo ? <img src={e.logo} alt={e.nom} /> : <strong>{e.sigle || e.nom}</strong>}<span>{e.nom}</span></div>
      </header>
      <table className="releve-synthese"><tbody>{lignes.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td style={{ textAlign: "left" }}>{v}</td></tr>)}</tbody></table>
      <div className="releve-haut">
        <div><strong>Le client</strong><br /><br /><br />{nom}</div>
        <div style={{ textAlign: "right" }}><strong>Pour {e.nom}</strong><br /><br /><br />Fait le {fr(r.dateRupture)}</div>
      </div>
      <footer className="releve-pied">
        <strong>{e.nom.toUpperCase()}</strong>
        <span>{[e.adresse, e.commune, e.ville, e.pays].filter(Boolean).join(", ")}</span>
        <span>{[e.agrement && `Agrément BCC n° ${e.agrement}`, e.ifu && `N° impôt : ${e.ifu}`, e.bp && `B.P. ${e.bp}`].filter(Boolean).join(" · ")}</span>
      </footer>
    </article>
  );
}
