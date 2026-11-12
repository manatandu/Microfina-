import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api } from "../donnees/api";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { lireMontant, montant, montantEnLettres, totalComptage, type Comptage } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
import { OngletsGuichet, Recu } from "./Guichet";
import { RechercheClient } from "./Visa";

const fr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const enSaisie = (m: number) => (m ? String(m / 100).replace(".", ",") : "0");

/** S73 : Caisse > Opération > Adhésion (manuel Microfina++, p. 85 ; écran complet p. 89, « Adhésion à la Banque ») */
export default function Adhesion() {
  const [t, setT] = useState<Tiers | null>(null);
  const [depot, setDepot] = useState("");
  const [parts, setParts] = useState("1");
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [billetage, setBilletage] = useState(false);
  const [recu, setRecu] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const [s, ctx, u, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.session.courante(), api.journees.courante()]);
    const stock = s ? await api.caisses.theorique(s.id, "CDF") : {};
    const frais = t ? await api.parametrage.fraisLies(t.id) : [];
    const piece = fait ? (await api.operations.recu(fait.id)).piece : "";
    return { s, ctx, u, j, stock, frais, piece };
  }, [t?.id, fait?.id]);
  if (!donnees) return <Chargement />;
  const { s, ctx, u, j, stock, frais, piece } = donnees;
  if (!s || s.statut !== "ouverte") return (
    <><h1>Guichet</h1><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>
  );
  const nParts = /^\d+$/.test(parts.trim()) ? Number(parts.trim()) : 0;
  const mDepot = depot.trim() ? lireMontant(depot) : 0;
  const mFrais = frais.reduce((x, f) => x + (f.montant ?? 0), 0);
  const total = (mDepot ?? 0) + mFrais + nParts * ctx.valeurPart;
  const produit = t ? ctx.produits.find((p) => p.code === t.produitCode) : undefined;
  const effacer = () => { setT(null); setDepot(""); setParts("1"); setCoupures({}); setCle(nouvelleCle()); setFait(null); };
  function enregistrer() {
    if (!t || mDepot === null) { setBoite({ type: "erreur", message: !t ? "À remplir : N° Client." : "Premier dépôt invalide." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { setFait(await api.guichet.adhesion({ cle, tiersId: t.id, parts: nParts, depot: mDepot, coupures })); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Guichet</h1>
      <OngletsGuichet />
      <section className="bloc pile" aria-label="Adhésion">
        <div className="entete-ecran">
          <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p>
          <p>Date Operation : * <strong className="chiffres">{fr(j?.date ?? "")}</strong></p>
        </div>
        <div className="grille-cadres">
          <fieldset className="pile cadre-champs">
            <legend>Informations sur le Client</legend>
            <div className="ligne-champ">
              <Champ libelle="N° Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={!!fait} onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé : *">{(p) => <input {...p} className="saisie" readOnly value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Catégorie : *">{(p) => <input {...p} className="saisie" readOnly value={t?.typeClient ?? ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Informations sur le Compte</legend>
            <Champ libelle="N° compte épargne : *">{(p) => <input {...p} className="saisie code" readOnly value={t ? `${t.numero}-02` : ""} />}</Champ>
            <Champ libelle={`Premier dépôt : *${produit ? ` (${produit.devise})` : ""}`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" required readOnly={!!fait}
              autoComplete="off" value={depot} onChange={(e) => { setDepot(e.target.value); setCle(nouvelleCle()); }} />}</Champ>
            <p>Total : <strong className="chiffres">{montant(total, "CDF")}</strong></p>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Info guichet</legend>
            <dl className="infos">
              <div className="info-ligne"><dt>Agence</dt><dd>{ctx.agence.nom}</dd></div>
              <div className="info-ligne"><dt>Caisse</dt><dd>{ctx.guichets.find((g) => g.id === s.guichetId)?.nom ?? ""}</dd></div>
              <div className="info-ligne"><dt>Caissier</dt><dd>{u?.nom ?? ""}</dd></div>
              <div className="info-ligne"><dt>Solde</dt><dd className="chiffres">{montant(totalComptage(stock), "CDF")}</dd></div>
            </dl>
          </fieldset>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Liste des Frais</legend>
          <table className="grille">
            <thead><tr><th scope="col">Libellé Frais</th><th scope="col">Compte</th><th scope="col">Nombre</th><th scope="col">Montant</th></tr></thead>
            <tbody>
              {frais.length === 0 && <tr><td colSpan={4}>Liste des Frais vide</td></tr>}
              {frais.map((f) => <tr key={f.fraisId}><td>{f.libelle}</td><td className="chiffres">{f.compte}</td><td></td><td className="chiffres">{f.montant === null ? "" : montant(f.montant, "CDF")}</td></tr>)}
              <tr>
                <td>Part sociale</td><td className="chiffres">{t ? (t.type === "physique" ? "1030" : t.type === "groupe" && t.typeClient === "Groupement" ? "1031" : "1032") : ""}</td>
                <td><input className="saisie code court" inputMode="numeric" aria-label="Nombre de parts sociales" readOnly={!!fait} value={parts}
                  onChange={(e) => { if (/^\d{0,4}$/.test(e.target.value)) { setParts(e.target.value); setCle(nouvelleCle()); } }} /></td>
                <td className="chiffres">{montant(nParts * ctx.valeurPart, "CDF")}</td>
              </tr>
            </tbody>
          </table>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!t || !!fait} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled={!fait} onClick={() => setRecu(true)}>Imprimer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
          <button className="bouton secondaire" type="button" disabled={!t || !!fait || total <= 0} onClick={() => setBilletage(true)}>Billetage</button>
        </div>
        <p className="montant-lettres">{total > 0 ? montantEnLettres(total, "CDF") : ""}</p>
        <Textes sources={["Manuel Microfina++, p. 85 : Adhésion (N° Client, Intitulé*, Catégorie*, N° compte épargne*, Premier dépôt*, Total, Info guichet) ; p. 89 : Liste des Frais, Enregistrer, Imprimer, Effacer, Billetage, montant en lettres",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Loi 002/2002, art. 21 et 22 : au moins une part, intégralement libérée ; PCCI, comptes 103 (parts) et 330 (épargne)",
          "Instr. BCC 37 : ouverture de compte gratuite ; Instr. BCC 15 bis : examen renforcé à 10 000 USD en espèces"]} />
      </section>
      <Fiche titre="Billetage" ouverte={billetage} fermer={() => setBilletage(false)}>
        <div className="pile">
          <Billetage devise="CDF" comptage={coupures} onChange={(c) => { setCoupures(c); setCle(nouvelleCle()); }} cible={total} sens="recue" />
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setBilletage(false)}>Fermer</button></div>
        </div>
      </Fiche>
      <Fiche titre="Reçu" ouverte={recu} fermer={() => setRecu(false)}>
        {fait && <Recu id={fait.id} onNouveau={() => { setRecu(false); effacer(); }} />}
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); setDepot(enSaisie(x.premierDepot)); setParts("1"); setCoupures({}); setCle(nouvelleCle()); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
