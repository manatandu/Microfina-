// S56 : Banque > Adhésion (manuel Microfina++, p. 64 : écran « Adhésion à la Banque »). Comme l'adhésion au guichet (S73), avec la banque à la place de la caisse :
// Info Banque (Banque, Compte Banque, Solde). Saisie en attente du visa (S57) ; le compte épargne s'ouvre à la validation (registre S56-1).
import { useState } from "react";
import { api } from "../donnees/api";
import { aDesParts } from "../lib/vocabulaire";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { lireMontant, montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Lecture } from "../composants";
import { RechercheClient } from "./Visa";
import { ChoixBanque } from "./OperationsBanque";

const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const enSaisie = (m: number) => (m ? String(m / 100).replace(".", ",") : "0");

export function AdhesionBanque() {
  const { donnees } = useDonnees(async () => ({ lu: await api.banqueOperations.lire(), ctx: await api.referentiel.contexte() }));
  const [t, setT] = useState<Tiers | null>(null);
  const [depot, setDepot] = useState("");
  const [parts, setParts] = useState("1");
  const [f, setF] = useState({ date: "", banque: "", compte: "" });
  const [cle, setCle] = useState(nouvelleCle);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const parts_ = donnees ? aDesParts(donnees.ctx.institution) : true;   // IMF : pas de parts sociales (loi 11/020, art. 14 et 15)
  const nParts = !parts_ ? 0 : /^\d+$/.test(parts.trim()) ? Number(parts.trim()) : 0;
  const mDepot = depot.trim() ? lireMontant(depot) : 0;
  const { donnees: ap, erreur } = useDonnees(async () => (t && mDepot !== null && (nParts >= 1 || !parts_) ? await api.banqueOperations.apercuAdhesion(t.id, nParts, mDepot) : null), [t?.id, nParts, mDepot]);
  if (!donnees) return <Chargement />;
  const { lu } = donnees;
  const date = f.date || lu.date;
  const cb = lu.comptes.find((c) => String(c.id) === f.compte);
  const effacer = () => { setT(null); setDepot(""); setParts("1"); setF({ date: "", banque: "", compte: "" }); setCle(nouvelleCle()); };
  const total = ap?.total ?? 0;
  const lignePart = ap && parts_ ? { libelle: "Part sociale standard", montant: nParts * ap.valeurPart } : null;

  function enregistrer() {
    if (!t || mDepot === null) { setBoite({ type: "erreur", message: !t ? "À remplir : N° Client." : "Premier dépôt invalide." }); return; }
    const d = { cle, date, tiersId: t.id, parts: nParts, depot: mDepot, compteBancaireId: f.compte ? Number(f.compte) : undefined };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.banqueOperations.enregistrerAdhesion(d); effacer(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <h1>Adhésion a la Banque</h1>
      <section className="bloc pile" aria-label="Adhésion à la banque">
        <div className="entete-ecran">
          <p>Numéro de pièce : <strong className="chiffres"></strong></p>
          <ChampDate libelle="Date Operation : *" valeur={date} onChange={(v) => setF({ ...f, date: v })} requis />
        </div>
        <div className="grille-cadres">
          <fieldset className="pile cadre-champs">
            <legend>Informations sur le Client</legend>
            <div className="ligne-champ">
              <Champ libelle="N° Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé : *">{(p) => <Lecture {...p} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Catégorie : *">{(p) => <Lecture {...p} value={t?.typeClient ?? ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Informations sur le Compte</legend>
            <Champ libelle="N° compte épargne : *">{(p) => <input {...p} className="saisie code" readOnly value={ap?.numeroCompte ?? ""} />}</Champ>
            <Champ libelle="Premier dépôt : *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" required autoComplete="off" value={depot}
              onChange={(e) => { setDepot(e.target.value); setCle(nouvelleCle()); }} />}</Champ>
            <p>Total : <strong className="chiffres">{montant(total, "CDF")}</strong></p>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Info Banque</legend>
            <ChoixBanque lu={lu} libelleBanque="Banque *" libelleCompte="Compte Banque *" banque={f.banque} compte={f.compte}
              onBanque={(v) => setF((x) => ({ ...x, banque: v, compte: "" }))} onCompte={(v) => setF((x) => ({ ...x, compte: v }))} />
            <p>Solde : <strong className="chiffres">{cb ? montant(cb.solde, cb.devise as Devise) : "0"}</strong></p>
          </fieldset>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Liste des Frais</legend>
          <table className="grille">
            <thead><tr><th scope="col">Libellé Frais</th><th scope="col">Compte</th><th scope="col">Nombre</th><th scope="col">Montant</th></tr></thead>
            <tbody>
              {(!ap || ap.frais.length === 0) && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
              {ap?.frais.map((x) => <tr key={x.fraisId}><td>{x.libelle}</td><td className="chiffres">{x.compte}</td><td></td><td className="chiffres">{montant(x.montant, "CDF")}</td></tr>)}
              {lignePart && <tr><td>{lignePart.libelle}</td><td></td>
                <td><input className="saisie code court" inputMode="numeric" aria-label="Nombre de parts sociales" value={parts}
                  onChange={(e) => { if (/^\d{0,4}$/.test(e.target.value)) { setParts(e.target.value); setCle(nouvelleCle()); } }} /></td>
                <td className="chiffres">{montant(lignePart.montant, "CDF")}</td></tr>}
            </tbody>
          </table>
        </fieldset>
        {erreur && t && <p role="alert" className="erreur-champ">{erreur}</p>}
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!t} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled title="Le reçu vient avec la validation à la caisse (registre S56-1)">Imprimer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <p className="montant-lettres">{total > 0 ? montantEnLettres(total, "CDF") : ""}</p>
        <Textes sources={["Manuel Microfina++, p. 64 : écran Adhésion a la Banque (N° Client, Intitulé*, Catégorie*, N° compte épargne*, Premier dépôt*, Total, Info Banque, Liste des Frais, Enregistrer, Imprimer, Effacer)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Même règles que l'adhésion au guichet (S73) : loi 002/2002, art. 21 et 22 (au moins une part, intégralement libérée) ; PCCI, comptes 103 (parts) et 330 (épargne) ; Instr. BCC 37 (ouverture de compte gratuite)",
          "Chaîne : saisie ici, visée puis validée (Banque > Visa, Validation, S57), validée à la caisse (p. 89 et 104), comptabilisée (S111) ; le compte épargne s'ouvre à la validation"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); setDepot(enSaisie(x.premierDepot)); setParts("1"); setCle(nouvelleCle()); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
