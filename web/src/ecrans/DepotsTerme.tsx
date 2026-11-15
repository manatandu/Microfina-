// S65 : Épargne > Dépôt à terme > Mise en place DAT (manuel Microfina++, p. 75 texte, p. 76 capture) ; S66 : Validation DAT (p. 76) et contrat.
// Échéance, intérêt et montant à verser calculés ; le DAT attend sa validation par une autre personne, qui passe l'écriture (PCCI 340). Registre S65-1 à S65-8.
import { useState } from "react";
import { ajouterMois, api, interetDat } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { lireMontant, montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

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
      <h1>Mise en place DAT</h1>
      <div className="actions-onglets">
        <button className="bouton secondaire" type="button" aria-label="Nouveau DAT" title="Nouveau" onClick={effacer}>+</button>
        <button className="bouton secondaire" type="button" disabled aria-label="Annuler un DAT" title="À confirmer : le manuel ne dit pas ce que fait ce bouton (registre S65-6)">⊘</button>
        <button className="bouton secondaire" type="button" onClick={async () => setListe(await api.depotsTerme.liste())}>Liste DAT</button>
      </div>
      <section className="bloc pile" aria-label="Mise en place DAT">
        <div className="grille-deux">
          <fieldset className="pile cadre-champs">
            <legend>Infos de base</legend>
            <Champ libelle="Produit : *">{(pp) => <select {...pp} className="saisie" value={f.produit} onChange={(e) => maj({ produit: e.target.value, compte: "", dat: "" })}>
              <option value=""></option>{donnees.produits.map((x) => <option key={x.id} value={x.id}>{x.libelle} ({x.code})</option>)}</select>}</Champ>
            <div className="ligne-champ">
              <Champ libelle="N° du Client : *">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé du compte :">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="N° Compte :">{(pp) => <select {...pp} className="saisie" value={f.compte} onChange={(e) => maj({ compte: e.target.value })}>
              <option value=""></option>{emetteurs.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            <p>Solde : <strong className="chiffres">{em && em.solde !== null && em.solde !== undefined ? montant(em.disponible ?? em.solde, dev) : "0"}</strong></p>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Infos Certificat</legend>
            <p>Certificat N° : <strong className="chiffres">{fait ? String(fait.certificat).padStart(6, "0") : ""}</strong></p>
            <label className="case"><input type="checkbox" checked={f.aEcheance} onChange={(e) => maj({ aEcheance: e.target.checked })} /><span>A échéance</span></label>
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
            <ChampDate libelle="Date de dépôt : *" valeur={depot} onChange={(v) => maj({ depot: v })} requis />
            <Champ libelle="Date échéance :">{(pp) => <input {...pp} className="saisie code" readOnly value={echeance ? fr(echeance) : ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Autres infos</legend>
            <Champ libelle="Observation :">{(pp) => <textarea {...pp} className="saisie" rows={2} value={f.observation} onChange={(e) => maj({ observation: e.target.value })} />}</Champ>
            <label className="case"><input type="checkbox" checked={f.reconduction} onChange={(e) => maj({ reconduction: e.target.checked })} /><span>Reconduction automatique</span></label>
            <button className="bouton secondaire" type="button" disabled title="À confirmer : le manuel ne montre pas cette fenêtre (registre S65-6)">Bénéficiaire</button>
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
      <Fiche titre="Liste DAT" ouverte={!!liste} fermer={() => setListe(null)}>
        <ListeDat lignes={liste ?? []} />
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(null)}>Fermer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

const STATUTS: Record<string, string> = { saisie: "À valider", valide: "Validé", rompu: "Rompu", echu: "Échu" };
function ListeDat({ lignes, choisi, choisir }: { lignes: Dat[]; choisi?: number | null; choisir?: (x: Dat) => void }) {
  return (
    <div className="defile-x"><table className="grille">
      <thead><tr><th scope="col">Certificat</th><th scope="col">Date opération</th><th scope="col">N° compte</th><th scope="col">N° membre</th><th scope="col" className="montant">Montant dépôt</th>
        <th scope="col">Durée</th><th scope="col">Taux interêt</th><th scope="col" className="montant">Montant interêt</th><th scope="col">Date échéance</th>{!choisir && <th scope="col">Statut</th>}</tr></thead>
      <tbody>
        {lignes.length === 0 && <tr><td colSpan={choisir ? 9 : 10}>No records found.</td></tr>}
        {lignes.map((x) => (
          <tr key={x.id} {...(choisir ? { className: "ligne-choix", tabIndex: 0, "aria-selected": choisi === x.id, onClick: () => choisir(x), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") choisir(x); } } : {})}>
            <td className="chiffres">{String(x.certificat).padStart(6, "0")}</td><td className="chiffres">{fr(x.dateDepot)}</td><td className="chiffres">{x.compteDat}</td><td className="chiffres">{x.membre}</td>
            <td className="montant chiffres">{montant(x.montant, x.devise as Devise)}</td><td>{x.duree} mois</td><td className="chiffres">{x.tauxInteret} %</td>
            <td className="montant chiffres">{montant(x.montantInteret, x.devise as Devise)}</td><td className="chiffres">{fr(x.dateEcheance)}</td>{!choisir && <td>{STATUTS[x.statut]}</td>}
          </tr>
        ))}
      </tbody>
    </table></div>
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
      <h1>Validation DAT</h1>
      <section className="bloc pile" aria-label="Validation DAT">
        <p>Numéro de pièce : <strong className="chiffres">{dernier?.piece ?? ""}</strong></p>
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
