import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api } from "../donnees/api";
import { boiteOperation } from "../lib/examen";
import { aDesParts } from "../lib/vocabulaire";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { lireMontant, montant, montantEnLettres, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Textes, type Boite, Lecture } from "../composants";
import { OngletsGuichet, Recu, SoldesCaisse } from "./Guichet";
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
  const [coupuresDepot, setCoupuresDepot] = useState<Comptage>({});   // registre S73-1 : billetage du premier dépôt dans la devise du compte
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [billetage, setBilletage] = useState(false);
  const [recu, setRecu] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const [s, ctx, u, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.session.courante(), api.journees.courante()]);
    const frais = t ? await api.parametrage.fraisLies(t.id) : [];
    const piece = fait ? (await api.operations.recu(fait.id)).piece : "";
    const compte = t ? await api.tiers.compteAdhesion(t.id) : null;   // le numéro que la règle de S17 donnera au compte (registre S73-6)
    return { s, ctx, u, j, frais, piece, compte };
  }, [t?.id, fait?.id]);
  if (!donnees) return <Chargement />;
  const { s, ctx, u, j, frais, piece, compte } = donnees;
  if (!s || s.statut !== "ouverte") return (
    <><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>
  );
  const parts_ = aDesParts(ctx.institution);   // IMF : pas de parts sociales (loi 11/020, art. 14 et 15)
  const nParts = !parts_ ? 0 : /^\d+$/.test(parts.trim()) ? Number(parts.trim()) : 0;
  const mDepot = depot.trim() ? lireMontant(depot) : 0;
  // Registre S16-11 : la part est la ligne « Part sociale standard » des frais d'adhésion (capture p. 89), payée par nombre de parts
  const ligneParts = frais.find((f) => f.part), autres = frais.filter((f) => !f.part);
  const mFrais = autres.reduce((x, f) => x + (f.montant ?? 0), 0);
  const total = (mDepot ?? 0) + mFrais + nParts * (ligneParts?.montant ?? 0);
  const produit = t ? ctx.produits.find((p) => p.code === t.produitCode) : undefined;
  // Registre S73-1 : frais et parts en CDF ; premier dépôt dans la devise du compte ; un billetage par devise (T12)
  const devDepot = (produit?.devise ?? "CDF") as Devise, enDevise = devDepot !== "CDF";
  const totalCdf = enDevise ? total - (mDepot ?? 0) : total;
  const effacer = () => { setT(null); setDepot(""); setParts("1"); setCoupures({}); setCoupuresDepot({}); setCle(nouvelleCle()); setFait(null); };
  function enregistrer() {
    if (!t || mDepot === null) { setBoite({ type: "erreur", message: !t ? "À remplir : N° Client." : "Premier dépôt invalide." }); return; }
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment enregistrer ? Adhésion : ${montant(totalCdf, "CDF")}${enDevise && mDepot ? ` et premier dépôt de ${montant(mDepot, devDepot)}` : ""}.`, oui: async () => {
      try { const o = await api.guichet.adhesion({ cle, tiersId: t.id, parts: nParts, depot: mDepot, coupures, ...(enDevise ? { coupuresDepot } : {}) }); setFait(o); setBoite({ type: "succes", message: ["Enregistré avec succès !", o.avertissement].filter(Boolean).join(" ") }); }
      catch (x) { setBoite(boiteOperation(x, { type: "adhesion", tiersId: t.id, montant: totalCdf, devise: "CDF" }, setBoite)); }
    } });
  }
  return (
    <>
      
      <OngletsGuichet />
      <section className="bloc pile" aria-label="Adhésion">
        <div className="entete-ecran">
          {(piece) ? <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p> : null}
          <p>Date Opération : * <strong className="chiffres">{fr(j?.date ?? "")}</strong></p>
        </div>
        <div className="grille-cadres">
          <fieldset className="pile cadre-champs">
            <legend>Informations sur le Client</legend>
            <div className="ligne-champ">
              <Champ libelle="N° Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={!!fait} onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé :">{(p) => <Lecture {...p} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Nature :">{(p) => <Lecture {...p} value={t ? ({ physique: "Personne physique", morale: "Entreprise", groupe: "Groupe" } as const)[t.type] : ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Informations sur le Compte</legend>
            <Champ libelle="N° compte épargne :">{(p) => <input {...p} className="saisie code" readOnly value={compte?.numero ?? ""} />}</Champ>
            <Champ libelle={`Premier dépôt : *${produit ? ` (${produit.devise})` : ""}`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" required readOnly={!!fait}
              autoComplete="off" value={depot} onChange={(e) => { setDepot(e.target.value); setCle(nouvelleCle()); }} />}</Champ>
            <p>Total : <strong className="chiffres">{montant(totalCdf, "CDF")}</strong>{enDevise && mDepot ? <> + <strong className="chiffres">{montant(mDepot, devDepot)}</strong></> : null}</p>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Info guichet</legend>
            <dl className="infos">
              <div className="info-ligne"><dt>Agence</dt><dd>{ctx.agence.nom}</dd></div>
              <div className="info-ligne"><dt>Caisse</dt><dd>{ctx.guichets.find((g) => g.id === s.guichetId)?.nom ?? ""}</dd></div>
              <div className="info-ligne"><dt>Caissier</dt><dd>{u?.nom ?? ""}</dd></div>
              <SoldesCaisse sessionId={s.id} />
            </dl>
          </fieldset>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Liste des Frais</legend>
          <table className="grille">
            <thead><tr><th scope="col">Libellé Frais</th><th scope="col">Compte</th><th scope="col">Nombre</th><th scope="col">Montant</th></tr></thead>
            <tbody>
              {autres.length === 0 && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
              {autres.map((f) => <tr key={f.fraisId}><td>{f.libelle}</td><td className="chiffres">{f.compte}</td><td></td><td className="chiffres">{f.montant === null ? "" : montant(f.montant, "CDF")}</td></tr>)}
              {parts_ && <tr>
                <td>{ligneParts?.libelle ?? "Part sociale"}</td><td className="chiffres">{ligneParts?.compte ?? ""}</td>
                <td><input className="saisie code court" inputMode="numeric" aria-label="Nombre de parts sociales" readOnly={!!fait} value={parts}
                  onChange={(e) => { if (/^\d{0,4}$/.test(e.target.value)) { setParts(e.target.value); setCle(nouvelleCle()); } }} /></td>
                <td className="chiffres">{ligneParts ? montant(nParts * (ligneParts.montant ?? 0), "CDF") : ""}</td>
              </tr>}
            </tbody>
          </table>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!t || !!fait} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled={!fait} onClick={() => setRecu(true)}>Imprimer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
          <button className="bouton secondaire" type="button" disabled={!t || !!fait || total <= 0} onClick={() => setBilletage(true)}>Billetage</button>
        </div>
        <p className="montant-lettres">{[totalCdf > 0 ? montantEnLettres(totalCdf, "CDF") : "", enDevise && mDepot ? montantEnLettres(mDepot, devDepot) : ""].filter(Boolean).join(" ; ")}</p>
        <Textes sources={["Manuel Microfina++, p. 85 : Adhésion (N° Client, Intitulé*, Catégorie*, N° compte épargne*, Premier dépôt*, Total, Info guichet) ; p. 89 : Liste des Frais, Enregistrer, Imprimer, Effacer, Billetage, montant en lettres",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Loi 002/2002, art. 21 et 22 : au moins une part, intégralement libérée ; PCCI, comptes 103 (parts) et 330 (épargne)",
          "Instr. BCC 37 : ouverture de compte gratuite ; Instr. BCC 15 bis : examen renforcé à 10 000 USD en espèces"]} />
      </section>
      <Fiche titre="Billetage" ouverte={billetage} fermer={() => setBilletage(false)}>
        <div className="pile">
          {totalCdf > 0 && <Billetage devise="CDF" comptage={coupures} onChange={(c) => { setCoupures(c); setCle(nouvelleCle()); }} cible={totalCdf} sens="recue" />}
          {enDevise && mDepot ? <Billetage devise={devDepot} comptage={coupuresDepot} onChange={(c) => { setCoupuresDepot(c); setCle(nouvelleCle()); }} cible={mDepot} sens="recue" /> : null}
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
