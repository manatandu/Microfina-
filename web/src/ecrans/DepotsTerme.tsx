// S65 : Épargne > Dépôt à terme > Mise en place DAT (manuel Microfina++, p. 75 texte, p. 76 capture) ; S66 : Validation DAT (p. 76) et contrat.
// Échéance, intérêt et montant à verser calculés ; le DAT attend sa validation par une autre personne, qui passe l'écriture (PCCI 340). Registre S65-1 à S65-8.
import { useState } from "react";
import { ajouterMois, api, interetDat } from "../donnees/api";
import type { Beneficiaire, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { lireMontant, montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee } from "../composants";
import { RechercheClient } from "./Visa";
import { valeur as valeurCritere } from "../lib/rapports";

type Dat = Awaited<ReturnType<typeof api.depotsTerme.liste>>[number];
type Contrat = Awaited<ReturnType<typeof api.depotsTerme.contrat>>;
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const VIDE = { produit: "", compte: "", dat: "", montant: "", duree: "", ti: "", tp: "", aEcheance: false, depot: "", observation: "", reconduction: false };

export function MiseEnPlaceDat() {
  const { donnees } = useDonnees(async () => ({ produits: await api.depotsTerme.produits(), j: await api.journees.courante() }));
  const [f, setF] = useState(VIDE);
  const [t, setT] = useState<Tiers | null>(null);
  const [fait, setFait] = useState<Dat | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const [recherche, setRecherche] = useState(false);
  const [liste, setListe] = useState<Dat[] | null>(null);
  const [aAnnuler, setAAnnuler] = useState<Dat | null>(null);
  const [benef, setBenef] = useState<Beneficiaire[] | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  if (!donnees) return <Chargement />;
  const maj = (p: Partial<typeof VIDE>) => { setF((x) => ({ ...x, ...p })); setFait(null); };
  const jour = donnees.j && donnees.j.statut === "ouverte" ? donnees.j.date : "";
  const p = donnees.produits.find((x) => String(x.id) === f.produit);
  const duProduit = (c: { intitule: string; devise: string }) => !!p && c.intitule === p.libelle && c.devise === p.devise;
  const emetteurs = (comptes ?? []).filter((c) => p && !duProduit(c) && c.devise === p.devise);
  const comptesDat = (comptes ?? []).filter((c) => duProduit(c));
  const em = emetteurs.find((c) => String(c.id) === f.compte);
  const dev = (p?.devise ?? "CDF") as Devise;
  const m = f.montant.trim() ? lireMontant(f.montant) : null, mois = /^\d{1,3}$/.test(f.duree) ? Number(f.duree) : 0;
  const tauxOk = /^\d+([.,]\d{1,4})?$/.test(f.ti.trim() || "0");
  const interet = m && mois && tauxOk ? interetDat(m, f.ti.trim() || "0", mois) : 0;
  const depot = f.depot || jour;
  const echeance = depot && mois ? ajouterMois(depot, mois) : "";
  const effacer = () => { setF(VIDE); setT(null); setFait(null); setCle(nouvelleCle()); };

  /** Bouton Annuler (capture p. 75) : le DAT choisi dans Liste DAT, encore en attente de validation (registre S65-6) */
  function annuler() {
    if (!aAnnuler) return;
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment annuler le DAT n° ${String(aAnnuler.certificat).padStart(6, "0")} ?`, oui: async () => {
      try { await api.depotsTerme.annuler(aAnnuler.id); setAAnnuler(null); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  function enregistrer() {
    const d = { cle, produitId: p?.id, tiersId: t?.id, compteEmetteurId: f.compte ? Number(f.compte) : undefined, compteDatId: f.dat ? Number(f.dat) : undefined,
      montant: m ?? 0, duree: mois, tauxInteret: f.ti, tauxPenalite: f.tp, aEcheance: f.aEcheance, dateDepot: depot, observation: f.observation, reconduction: f.reconduction };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { setFait(await api.depotsTerme.mettreEnPlace(d)); setCle(nouvelleCle()); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <h2>Mise en place DAT</h2>
      <div className="actions-onglets">
        <button className="bouton secondaire" type="button" disabled={!aAnnuler} aria-label="Annuler un DAT" title="Annuler le DAT choisi dans Liste DAT" onClick={annuler}>⊘</button>
        <button className="bouton secondaire" type="button" onClick={async () => setListe(await api.depotsTerme.liste())}>Liste DAT</button>
      </div>
      <section className="bloc pile" aria-label="Mise en place DAT">
        <div className="grille-deux">
          <fieldset className="pile cadre-champs">
            <legend>Infos de base</legend>
            <Champ libelle="Produit : *">{(pp) => <select {...pp} className="saisie" value={f.produit} onChange={(e) => maj({ produit: e.target.value, compte: "", dat: "" })}>
              <option value=""></option>{donnees.produits.map((x) => <option key={x.id} value={x.id}>{x.libelle} ({x.code})</option>)}</select>}</Champ>
            <div className="ligne-champ">
              <Champ libelle="N° du Client :">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé du compte :">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="N° Compte :">{(pp) => <select {...pp} className="saisie" value={f.compte} disabled={!t || !p} onChange={(e) => maj({ compte: e.target.value })}>
              <option value="">{!t ? "Choisir d'abord le client" : !p ? "Choisir d'abord le produit" : ""}</option>{emetteurs.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            <p>Solde : <strong className="chiffres">{em && em.solde !== null && em.solde !== undefined ? montant(em.disponible ?? em.solde, dev) : "0"}</strong></p>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Infos Certificat</legend>
            {fait ? <p>Certificat N° : <strong className="chiffres">{String(fait.certificat).padStart(6, "0")}</strong></p> : null}
            <Champ libelle="Montant : *">{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
            <Champ libelle="Durée (Mois) : *">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.duree} onChange={(e) => { if (/^\d{0,3}$/.test(e.target.value)) maj({ duree: e.target.value }); }} />}</Champ>
            <Champ libelle="Taux intérêt (%) :">{(pp) => <input {...pp} className="saisie code" inputMode="decimal" autoComplete="off" value={f.ti} onChange={(e) => maj({ ti: e.target.value })} />}</Champ>
            <Champ libelle="Taux pénalité (%) :">{(pp) => <input {...pp} className="saisie code" inputMode="decimal" autoComplete="off" value={f.tp} onChange={(e) => maj({ tp: e.target.value })} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Intérêt</legend>
            <Champ libelle="Compte DAT :">{(pp) => <select {...pp} className="saisie" value={f.dat} onChange={(e) => maj({ dat: e.target.value })}>
              <option value=""></option>{comptesDat.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
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
        </div>
        <p className="montant-lettres">{m ? montantEnLettres(m, dev) : ""}</p>
        <Textes sources={["Manuel Microfina++, p. 75 (texte : numéro de compte du client, montant, durée en mois, compte émetteur, échéance, intérêt et montant à verser calculés, reconduction automatique) et p. 76 (capture Mise en place DAT)",
          "PCCI, compte 34 : 340 Dépôts à terme ; compte 612 : 6121 plus de 12 mois, 6122 neuf mois au plus, 6124 six mois au plus",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur ; validation par une autre personne (Épargne > Dépôt à terme > Validation DAT)"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); maj({ compte: "", dat: "" }); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <FicheBeneficiaires lignes={benef} fermer={() => setBenef(null)} />
      <Fiche titre="Liste DAT" ouverte={!!liste} fermer={() => setListe(null)}>
        <ListeDat lignes={liste ?? []} avecStatut choisi={aAnnuler?.id ?? null} choisir={(y) => setAAnnuler(y.statut === "saisie" ? y : null)} />
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(null)}>Fermer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
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
function ListeDat({ lignes, choisi, choisir, avecStatut }: { lignes: Dat[]; choisi?: number | null; choisir?: (x: Dat) => void; avecStatut?: boolean }) {
  const statut = avecStatut ?? !choisir;
  return (
    <Paginee lignes={lignes}>{(visibles) => (<div className="defile-x"><table className="grille">
      <thead><tr><th scope="col">Certificat</th><th scope="col">Date opération</th><th scope="col">N° compte</th><th scope="col">N° membre</th><th scope="col" className="montant">Montant dépôt</th>
        <th scope="col">Durée</th><th scope="col">Taux interêt</th><th scope="col" className="montant">Montant interêt</th><th scope="col">Date échéance</th>{statut && <th scope="col">Statut</th>}</tr></thead>
      <tbody>
        {lignes.length === 0 && <tr><td colSpan={statut ? 10 : 9}>Aucune ligne.</td></tr>}
        {visibles.map((x) => (
          <tr key={x.id} {...(choisir ? { className: "ligne-choix", tabIndex: 0, "aria-selected": choisi === x.id, onClick: () => choisir(x), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") choisir(x); } } : {})}>
            <td className="chiffres">{String(x.certificat).padStart(6, "0")}</td><td className="chiffres">{fr(x.dateDepot)}</td><td className="chiffres">{x.compteDat}</td><td className="chiffres">{x.membre}</td>
            <td className="montant chiffres">{montant(x.montant, x.devise as Devise)}</td><td>{x.duree} mois</td><td className="chiffres">{x.tauxInteret} %</td>
            <td className="montant chiffres">{montant(x.montantInteret, x.devise as Devise)}</td><td className="chiffres">{fr(x.dateEcheance)}</td>{statut && <td>{STATUTS[x.statut]}</td>}
          </tr>
        ))}
      </tbody>
    </table></div>)}</Paginee>
  );
}

export function ValidationDat() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.depotsTerme.liste("saisie"), [relu]);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [dernier, setDernier] = useState<Dat | null>(null);
  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  function valider() {
    if (choisi === null) { setBoite({ type: "erreur", message: "Choisir un DAT dans la liste." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment valider ?", oui: async () => {
      try { setDernier(await api.depotsTerme.valider(choisi)); setChoisi(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const pourContrat = choisi ?? dernier?.id ?? null;
  return (
    <>
      <h2>Validation DAT</h2>
      <section className="bloc pile" aria-label="Validation DAT">
        {(dernier?.piece ?? "") ? <p>Numéro de pièce : <strong className="chiffres">{dernier?.piece ?? ""}</strong></p> : null}
        <fieldset className="pile cadre-champs">
          <legend>Liste DAT à valider</legend>
          <ListeDat lignes={donnees} choisi={choisi} choisir={(x) => setChoisi(x.id)} />
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={choisi === null} onClick={valider}>Valider</button>
          <button className="bouton secondaire" type="button" disabled={pourContrat === null} onClick={async () => pourContrat !== null && setContrat(await api.depotsTerme.contrat(pourContrat))}>Contrat</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 76 (texte : la liste des DAT en attente de validation, choisir puis Valider ; capture « Liste DAT à valider », boutons Valider et Contrat)",
          "Quatre yeux : la validation vient d'une autre personne que celle qui a mis le DAT en place (Instr. BCC 008, art. 66) ; écriture au journal des opérations diverses, du compte émetteur au compte DAT (PCCI 340)"]} />
      </section>
      <Fiche titre="Contrat de dépôt à terme" ouverte={!!contrat} fermer={() => setContrat(null)}>
        {contrat && <ContratDat c={contrat} />}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setContrat(null)}>Fermer</button>
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
/** S67 : Épargne > Dépôt à terme > Rupture de DAT (manuel p. 76 texte, p. 77 capture). Registre S67-1 à S67-6. */
export function RuptureDat() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [date, setDate] = useState("");
  const [demande, setDemande] = useState("");
  const [choix, setChoix] = useState<Dat | null>(null);
  const [calc, setCalc] = useState<Apercu | null>(null);
  const [liste, setListe] = useState<Dat[] | null>(null);
  const [fait, setFait] = useState<Dat | null>(null);
  const [avis, setAvis] = useState<Contrat | null>(null);
  const [benef, setBenef] = useState<Beneficiaire[] | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (j === undefined) return <Chargement />;
  const jour = j && j.statut === "ouverte" ? j.date : "";
  const dr = date || jour;
  async function calculer(x: Dat, d: string) {
    setChoix(x); setFait(null);
    try { setCalc(await api.depotsTerme.apercuRupture(x.id, d)); }
    catch (e) { setCalc(null); setBoite({ type: "erreur", message: message(e) }); }
  }
  async function ouvrirListe() { setListe((await api.depotsTerme.liste("valide")).filter((x) => !dr || x.dateEcheance > dr)); }
  function rompre() {
    if (!choix) { setBoite({ type: "erreur", message: "À remplir : Certificat N° (choisir le DAT dans la liste)." }); return; }
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
      <h2>Rupture DAT</h2>
      <section className="bloc pile" aria-label="Rupture DAT">
        <div className="grille-deux">
          {(fait?.rupture?.piece ?? "") ? <p>Numéro de pièce : <strong className="chiffres">{fait?.rupture?.piece ?? ""}</strong></p> : null}
          <ChampDate libelle="Date rupture : *" valeur={dr} onChange={(v) => { setDate(v); if (choix && !fait) void calculer(choix, v); }} requis />
        </div>
        <div className="grille-deux">
          <fieldset className="pile cadre-champs">
            <legend>Infos du DAT</legend>
            <div className="ligne-champ">
              <Champ libelle="Certificat N° :">{(pp) => <input {...pp} className="saisie code" readOnly value={x ? String(x.certificat).padStart(6, "0") : ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un DAT" onClick={ouvrirListe}>Rechercher</button>
            </div>
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
          <fieldset className="pile cadre-champs">
            <legend>Intérêt / pénalité</legend>
            <p>Taux intérêt : <strong className="chiffres">{x ? `${x.tauxInteret} %` : "%"}</strong> · Taux pénalité : <strong className="chiffres">{x ? `${x.tauxPenalite} %` : "%"}</strong> · Taux IRC : <strong className="chiffres">{r ? `${r.tauxIrc} %` : "%"}</strong></p>
            <p>Montant intérêt : <strong className="chiffres">{mt(r?.interet)}</strong></p>
            <p>Montant pénalité : <strong className="chiffres">{mt(r?.penalite)}</strong></p>
            <p>Montant IRC : <strong className="chiffres">{mt(r?.irc)}</strong></p>
            <p>Montant à verser : <strong className="chiffres">{mt(r?.montantAVerser)}</strong></p>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Autres infos</legend>
            <Champ libelle="Observation :">{(pp) => <Lecture {...pp} value={x?.observation ?? ""} />}</Champ>
            <label className="case"><input type="checkbox" checked={!!x?.reconduction} readOnly disabled /><span>Reconduction automatique</span></label>
            <button className="bouton secondaire" type="button" disabled={!x} onClick={async () => { if (x) setBenef((await api.tiers.lire(x.tiersId))?.beneficiaires ?? []); }}>Bénéficiaire</button>
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!choix || !!fait} onClick={rompre}>Rompre le DAT</button>
          <button className="bouton secondaire" type="button" disabled={!fait} onClick={async () => fait && setAvis(await api.depotsTerme.contrat(fait.id))}>Imprimer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 76 (texte : la liste des DAT en attente de rupture, choisir le DAT par un double clic puis Rompre le DAT) et p. 77 (capture « Rupture DAT »)",
          "Intérêt couru au prorata des jours, pénalité sur le montant du DAT (décisions du porteur, 15/11/2026)",
          "Retenue de 20 % sur l'intérêt brut des dépôts à échéance fixe des personnes physiques (loi 23/053, art. 78, 81 et 120), au compte 433 ; pénalité au compte 7791 ; intérêt au compte 612 de la durée du DAT (PCCI)"]} />
      </section>
      <FicheBeneficiaires lignes={benef} fermer={() => setBenef(null)} />
      <Fiche titre="Liste DAT à rompre" ouverte={!!liste} fermer={() => setListe(null)}>
        {liste && <ListeDat lignes={liste} choisi={choix?.id ?? null} choisir={(y) => { setListe(null); void calculer(y, dr); }} />}
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(null)}>Fermer</button></div>
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

type LigneRecherche = Awaited<ReturnType<typeof api.depotsTerme.recherche>>[number];
const CRITERES_DAT = [["agence", "Agence"], ["agent", "Agent de crédit"], ["genre", "Genre"], ["produit", "Produit"], ["objet", "Objet du crédit"], ["terme", "Terme du crédit"],
  ["profession", "Profession"], ["categorie", "Catégorie"], ["zone", "Zone"], ["nationalite", "Nationalité"], ["gestionnaire", "Gestionnaire"], ["secteur", "Secteur"], ["montant", "Montant"]] as const;
type CritereDat = (typeof CRITERES_DAT)[number][0];

/** S68 : Épargne > Dépôt à terme > Recherche multicritères DAT (manuel p. 77). Registre S68-1 à S68-4. */
export function RechercheDat() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), clients: await api.rapports.clients(), j: await api.journees.courante() }));
  const [choix, setChoix] = useState<"mise_en_place" | "echus" | "encours">("mise_en_place");
  const [coches, setCoches] = useState<Set<CritereDat>>(() => new Set(CRITERES_DAT.map(([k]) => k)));
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [lignes, setLignes] = useState<LigneRecherche[] | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { ctx, clients } = donnees;
  const agents = Object.fromEntries([...ctx.gestionnaires, ...ctx.commerciaux, ...ctx.sensibilisateurs].map((a) => [a.id, a.nom]));
  const cx = { agence: ctx.agence.nom, agents };
  const fin = au || donnees.j?.date || "", debut = du || (fin ? `${fin.slice(0, 4)}-01-01` : "");
  const cols = CRITERES_DAT.filter(([k]) => coches.has(k));
  const cellule = (x: LigneRecherche, k: CritereDat) => {
    const t = clients.find((c) => c.id === x.tiersId);
    switch (k) {
      case "agence": return x.agence; case "agent": return x.agent; case "produit": return x.produit; case "terme": return x.terme;
      case "objet": return "";   // pas d'objet pour un dépôt (registre S68-2)
      case "montant": return montant(x.montant, x.devise as Devise);
      case "profession": return t?.profession ?? "";
      default: return t ? valeurCritere(t, k, cx) : "";
    }
  };
  async function valider() {
    try { setLignes(await api.depotsTerme.recherche(choix, debut, fin)); }
    catch (e) { setBoite({ type: "erreur", message: message(e) }); }
  }
  const basculer = (k: CritereDat) => setCoches((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const totaux = lignes && coches.has("montant") ? Object.entries(lignes.reduce<Record<string, number>>((m, x) => ({ ...m, [x.devise]: (m[x.devise] ?? 0) + x.montant }), {})) : [];
  return (
    <>
      <h2>Recherche multicritères DAT</h2>
      <section className="bloc pile" aria-label="Recherche multicritères DAT">
        <div className="grille-deux">
          <fieldset className="pile cadre-champs">
            <legend>Recherche par</legend>
            <fieldset className="pile cadre-champs">
              <legend>Choix</legend>
              {([["mise_en_place", "Mise en place"], ["echus", "Echûs"], ["encours", "Encours"]] as const).map(([v, l]) =>
                <label key={v} className="case"><input type="radio" name="choix-dat" checked={choix === v} onChange={() => { setChoix(v); setLignes(null); }} /><span>{l}</span></label>)}
            </fieldset>
            {CRITERES_DAT.map(([k, l]) => <label key={k} className="case"><input type="checkbox" checked={coches.has(k)} onChange={() => basculer(k)} /><span>{l}</span></label>)}
          </fieldset>
          <div className="pile">
            <fieldset className="pile cadre-champs">
              <legend>Date de recherche</legend>
              <div className="ligne-champ">
                <ChampDate libelle="Du" valeur={debut} onChange={(v) => { setDu(v); setLignes(null); }} />
                <ChampDate libelle="Au" valeur={fin} onChange={(v) => { setAu(v); setLignes(null); }} />
                <button className="bouton" type="button" onClick={valider}>Valider</button>
              </div>
            </fieldset>
            <fieldset className="pile cadre-champs">
              <legend>Element de recherche</legend>
              {lignes && <div className="defile-x"><table className="grille">
                <thead><tr><th scope="col">Certificat</th><th scope="col">Date dépôt</th><th scope="col">Date échéance</th><th scope="col">N° compte DAT</th><th scope="col">Client</th>
                  {cols.map(([k, l]) => <th key={k} scope="col" className={k === "montant" ? "montant" : undefined}>{l}</th>)}</tr></thead>
                <tbody>
                  {lignes.length === 0 && <tr><td colSpan={5 + cols.length}>Aucune ligne.</td></tr>}
                  {lignes.map((x) => <tr key={x.id}><td className="chiffres">{String(x.certificat).padStart(6, "0")}</td><td className="chiffres">{fr(x.dateDepot)}</td>
                    <td className="chiffres">{fr(x.dateEcheance)}</td><td className="chiffres">{x.compteDat}</td><td>{x.client}</td>
                    {cols.map(([k]) => <td key={k} className={k === "montant" ? "montant chiffres" : undefined}>{cellule(x, k)}</td>)}</tr>)}
                </tbody>
                {totaux.length > 0 && <tfoot>{totaux.map(([d, m]) => <tr key={d}><th scope="row" colSpan={4 + cols.length}>Total {d}</th><td className="montant chiffres">{montant(m, d as Devise)}</td></tr>)}</tfoot>}
              </table></div>}
            </fieldset>
          </div>
        </div>
        <Textes sources={["Manuel Microfina++, p. 77 (texte : date de début et de fin, cocher les éléments recherchés, Valider ; capture « Recherche par » : Mise en place, Echûs, Encours et treize cases)",
          "Terme selon la durée, comme le classement des crédits du PCCI (comptes 30 à 32) : un an au plus court terme, 1 à 5 ans moyen terme, au-delà long terme"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
