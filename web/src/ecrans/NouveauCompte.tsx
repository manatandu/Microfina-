// S63 : Épargne > Nouveau compte (manuel Microfina++, p. 72 texte, p. 73 capture « Création d'un compte Epargne »).
// Un compte de plus pour un membre : produit, client, N° du compte proposé selon la numérotation (S17), date de création. Ouverture gratuite, sans écriture.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";
import { ConventionCompte, type DonneesConvention } from "./Convention";
import { imprimer } from "../lib/imprimer";

const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

export function NouveauCompte() {
  const { donnees } = useDonnees(async () => ({ produits: await api.comptesEpargne.produits(), j: await api.journees.courante() }));
  const [produit, setProduit] = useState("");
  const [t, setT] = useState<Tiers | null>(null);
  const [date, setDate] = useState("");
  const [cle, setCle] = useState(nouvelleCle);
  const [relu, setRelu] = useState(0);
  const [recherche, setRecherche] = useState(false);
  const [convention, setConvention] = useState<DonneesConvention | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: ap, erreur } = useDonnees(async () => (t && produit ? await api.comptesEpargne.apercu(t.id, Number(produit)) : null), [t?.id, produit, relu]);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id, relu]);
  if (!donnees) return <Chargement />;
  const jour = donnees.j && donnees.j.statut === "ouverte" ? donnees.j.date : "";
  const annuler = () => { setProduit(""); setT(null); setDate(""); setCle(nouvelleCle()); };

  function enregistrer() {
    const d = { cle, tiersId: t?.id, produitId: produit ? Number(produit) : undefined, date: date || jour };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.comptesEpargne.ouvrir(d); setCle(nouvelleCle()); setProduit(""); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <h1>Création d'un compte Epargne</h1>
      <section className="bloc pile" aria-label="Création d'un compte Epargne">
        <fieldset className="pile cadre-champs">
          <legend>Informations sur le Produit</legend>
          <Champ libelle="Produit Epargne *">{(p) => <select {...p} className="saisie" value={produit} onChange={(e) => setProduit(e.target.value)}>
            <option value=""></option>{donnees.produits.map((x) => <option key={x.id} value={x.id}>{x.libelle} ({x.code})</option>)}</select>}</Champ>
        </fieldset>
        <div className="grille-cadres">
          <fieldset className="pile cadre-champs">
            <legend>Informations sur le client</legend>
            <div className="ligne-champ">
              <Champ libelle="Numéro du Client *">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé :">{(p) => <Lecture {...p} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Catégorie :">{(p) => <Lecture {...p} value={t?.typeClient ?? ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Informations sur le compte</legend>
            <Champ libelle="N° du compte : *">{(p) => <input {...p} className="saisie code" readOnly value={ap?.numero ?? ""} />}</Champ>
            <ChampDate libelle="Date création : *" valeur={date || jour} onChange={setDate} requis />
          </fieldset>
        </div>
        {erreur && t && produit && <p role="alert" className="erreur-champ">{erreur}</p>}
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!t || !produit || !ap} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Liste des Comptes du membre</legend>
          <div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">N° du compte</th><th scope="col">Produit</th><th scope="col">Devise</th><th scope="col" className="montant">Solde</th><th scope="col">Convention</th></tr></thead>
            <tbody>
              {(comptes ?? []).length === 0 && <tr><td colSpan={5}>Liste vide</td></tr>}
              {(comptes ?? []).map((c) => <tr key={c.id}><td className="chiffres">{c.numero}</td><td>{c.intitule}</td><td>{c.devise}</td>
                <td className="montant chiffres">{c.solde === null || c.solde === undefined ? "" : montant(c.solde, c.devise as Devise)}</td>
                <td><button className="bouton secondaire" type="button" aria-label={`Convention du compte ${c.numero}`} onClick={async () => {
                  try { setConvention(await api.comptesEpargne.convention(c.id)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }}>Imprimer</button></td></tr>)}
            </tbody>
          </table></div>
        </fieldset>
        <Textes sources={["Manuel Microfina++, p. 72 (texte : choisir le produit, taper le numéro du client, Enregistrer ou Annuler) et p. 73 (capture : Informations sur le Produit, Informations sur le client, Informations sur le compte, Liste des Comptes du membre)",
          "Loi 002/2002, art. 1er : la COOPEC collecte l'épargne de ses membres ; l'adhésion ouvre le premier compte",
          "Instr. BCC 37, annexe : ouverture de compte gratuite ; Paramétrage > Produit épargne : Max compte à créer ; Paramétrage > Numéro de compte client : N° du compte",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Fiche titre="Convention de compte" ouverte={!!convention} fermer={() => setConvention(null)}>
        {convention && <ConventionCompte c={convention} />}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setConvention(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); setCle(nouvelleCle()); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
