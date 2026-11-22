import { useState, type ReactNode } from "react";
import { api, type FraisProduit, type ProduitCreditVue } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee } from "../composants";

const ONGLETS = ["Caractéristiques", "Retenues au déblocage", "Remboursement et pénalités"];   // cinq onglets ramenés à trois parties (plan d'allègement, point 2.16)
type Saisie = Record<string, string | boolean>;
const VIDE: Saisie = {
  typeProduit: "CNO", cyclique: false, numero: "", nom: "", devise: "", modeCalcul: "Dégressif", typeInteret: "Fixe", tauxInteret: "", tauxDiffere: "",
  montantMin: "", dureeMin: "", differeMin: "", interetMin: "", montantMax: "", dureeMax: "", differeMax: "", interetMax: "",
  clientPhysique: false, clientGroupe: false, clientEntreprise: false, maxParMembre: false,
  periodicite: "", modeDiffere: "Réparti", paiementInteret: "Normal", interetAnticipation: "OUI", ageMax: "",
  epargneNature: "", epargneValeur: "", solidariteNature: "", solidariteValeur: "", typeAssuranceId: "", assuranceNature: "", assuranceValeur: "",
  categorie: "", tauxRegle: false, penaliteRetard: "", penaliteAnticipation: "", ordreId: "", modeleId: "",
};
const IDS = ["typeAssuranceId", "ordreId", "modeleId"];
const LIGNE_FRAIS = { typeFrais: "", nature: "", valeur: "", compte: "" };

/** S23 : Paramétrage > Produit > Crédit > Produit crédit : création/modification (manuel Microfina++, p. 37 et 38) */
export default function ProduitCredit({ listeOuverte = false }: { listeOuverte?: boolean }) {
  const [f, setF] = useState<Saisie>(VIDE);
  const [frais, setFrais] = useState<Record<string, string>[]>([]);
  const [onglet, setOnglet] = useState(0);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [liste, setListe] = useState(listeOuverte);
  const [filtres, setFiltres] = useState({ numero: "", nom: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.produitsCredit.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const o = donnees.options;
  const nouveau = () => { setF(VIDE); setFrais([]); setChoisi(null); setOnglet(0); };
  async function ouvrir(id: number) {
    try {
      const p: ProduitCreditVue = await api.produitsCredit.lireProduit(id);
      const s: Saisie = { ...VIDE };
      for (const k of Object.keys(VIDE)) {
        const x = p[k];
        s[k] = typeof VIDE[k] === "boolean" ? !!x : k === "interetAnticipation" ? (x ? "OUI" : "NON") : x == null ? "" : String(x);
      }
      setF(s); setFrais(p.frais.map((x: FraisProduit) => ({ ...x, valeur: String(x.valeur) }))); setChoisi(id); setOnglet(0); setListe(false);
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const envoi = () => {
    const d: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) d[k] = IDS.includes(k) ? (v ? Number(v) : null) : k === "interetAnticipation" ? (v === "OUI" ? true : v === "NON" ? false : null) : v;
    d.frais = frais;
    // Une pénalité de remboursement anticipé (au plus 50 % des intérêts restant dus, Instr. BCC 38, art. 14) suffit : elle vaut perception (plan 2.16)
    d.interetAnticipation = Number(String(f.penaliteAnticipation ?? "").replace(",", ".")) > 0;
    return d;
  };
  const enregistrer = () => setBoite({ type: "confirmation", message: choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?", oui: async () => {
    try { const r = await api.produitsCredit.enregistrer(envoi(), choisi ?? undefined); setChoisi(r.produit.id); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  // Taux du crédit : mensuel, avec l'équivalent annuel proportionnel (× 12 ; Instr. BCC 38, art. 2 ; plan d'allègement, point 1.17)
  const annuel = (t: string) => { const n = Number(t.replace(",", ".")); return t && Number.isFinite(n) ? String(Math.round(n * 12 * 100) / 100).replace(".", ",") : ""; };
  const texte = (k: string, libelle: string, classe = "saisie") => (
    <Champ libelle={libelle}>{(p) => <input {...p} className={classe} value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Champ>);
  const choix = (k: string, libelle: string, valeurs: { v: string; l: string }[], vide = true) => (
    <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
      {vide && <option value=""></option>}{valeurs.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select>}</Champ>);
  const simple = (l: string[]) => l.map((x) => ({ v: x, l: x }));
  const case_ = (k: string, libelle: string) => (
    <label className="case"><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span>{libelle}</span></label>);
  const cadre = (titre: string, enfants: ReactNode) => <fieldset className="cadre-champs pile"><legend>{titre}</legend>{enfants}</fieldset>;
  const natures = simple(o.natures);
  const pages: ReactNode[] = [
    <div key="base" className="pile">
      <div className="grille-deux">
        {cadre("Minimum", <>{texte("montantMin", "Montant *", "saisie montant")}{texte("dureeMin", "Durée (mois) *", "saisie nombre")}{texte("differeMin", "Différé (mois) *", "saisie nombre")}{texte("interetMin", "Intérêt", "saisie nombre")}</>)}
        {cadre("Maximum", <>{texte("montantMax", "Montant *", "saisie montant")}{texte("dureeMax", "Durée (mois) *", "saisie nombre")}{texte("differeMax", "Différé (mois) *", "saisie nombre")}{texte("interetMax", "Intérêt", "saisie nombre")}</>)}
        {cadre("Identification", <>{choix("typeProduit", "Type Produit *", o.typesProduit.map((t: { code: string; libelle: string }) => ({ v: t.code, l: t.libelle })), false)}{case_("cyclique", "Cyclique")}
          {texte("numero", "Num Produit *", "saisie code")}{texte("nom", "Nom du produit *")}{choix("devise", "Devise *", simple(o.devises))}</>)}
        {cadre("Intérêt", <><p>Intérêts calculés sur le capital restant dû (méthode dégressive), à taux fixe ; différé réparti.</p>{texte("tauxInteret", "Taux d'intérêt mensuel (%) *", "saisie nombre")}<Champ libelle="Équivalent annuel (%)">{(p) => <input {...p} className="saisie nombre" readOnly value={annuel(String(f.tauxInteret))} />}</Champ>{texte("tauxDiffere", "Taux différé (%) *", "saisie nombre")}</>)}
      </div>
      <div className="grille-deux">
        {cadre("Types de client", <>{case_("clientPhysique", "Physique")}{case_("clientGroupe", "Groupe")}{case_("clientEntreprise", "Personne morale")}{case_("maxParMembre", "Appliquer montant max. prêt par mbre du groupe")}</>)}
        {cadre("Divers", <>{choix("periodicite", "Périodicité *", o.periodicites.map((t: { code: string; libelle: string }) => ({ v: t.code, l: t.libelle })))}
          {texte("ageMax", "Age max *", "saisie nombre")}</>)}
        {cadre("Catégorie de prêt", <>{choix("categorie", "Catégorie de prêt *", simple(o.categories))}{case_("tauxRegle", "Taux réglementé ou bonifié")}</>)}
      </div>
    </div>,
    <div key="retenues" className="pile"><div className="grille-deux">
      {cadre("Épargne obligatoire", <>{choix("epargneNature", "Nature", natures)}{texte("epargneValeur", "Valeur", "saisie code")}</>)}
      {cadre("Fonds de solidarité", <>{choix("solidariteNature", "Nature", natures)}{texte("solidariteValeur", "Valeur", "saisie code")}</>)}
      {cadre("Assurance", <>{choix("typeAssuranceId", "Type assurance", o.typesAssurance.map((t: { id: number; libelle: string }) => ({ v: String(t.id), l: t.libelle })))}
        {choix("assuranceNature", "Nature", natures)}{texte("assuranceValeur", "Valeur", "saisie code")}</>)}
    </div>
      <table className="grille" aria-label="Frais retenus au déblocage">
        <thead><tr><th scope="col">Type de frais</th><th scope="col">Nature</th><th scope="col" className="num">Valeur</th><th scope="col">Compte</th><th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
        <tbody>
          {frais.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
          {frais.map((x, i) => {
            const maj = (k: string, v: string) => setFrais(frais.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
            return (
              <tr key={i}>
                <td><select className="saisie" aria-label={`Type de frais, ligne ${i + 1}`} value={x.typeFrais} onChange={(e) => maj("typeFrais", e.target.value)}>
                  <option value=""></option>{o.typesFrais.map((t: string) => <option key={t}>{t}</option>)}</select></td>
                <td><select className="saisie" aria-label={`Nature, ligne ${i + 1}`} value={x.nature} onChange={(e) => maj("nature", e.target.value)}>
                  <option value=""></option>{o.natures.map((t: string) => <option key={t}>{t}</option>)}</select></td>
                <td><input className="saisie code num" aria-label={`Valeur, ligne ${i + 1}`} value={x.valeur} onChange={(e) => maj("valeur", e.target.value)} /></td>
                <td><input className="saisie code" aria-label={`Compte, ligne ${i + 1}`} value={x.compte} onChange={(e) => maj("compte", e.target.value)} /></td>
                <td><button className="bouton secondaire" type="button" onClick={() => setFrais(frais.filter((_, j) => j !== i))}>Retirer</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setFrais([...frais, { ...LIGNE_FRAIS }])}>Ajouter un frais</button></div>
    </div>,
    <div key="remboursement" className="grille-deux">
      {cadre("Pénalités", <>{texte("penaliteRetard", "Pénalité de retard (%)", "saisie code")}{texte("penaliteAnticipation", "Pénalité de remboursement anticipé (% des intérêts restant dus)", "saisie code")}</>)}
      {cadre("Remboursement", <>{choix("ordreId", "Ordre de remboursement", o.ordres.map((t: { id: number; libelle: string }) => ({ v: String(t.id), l: t.libelle })))}</>)}
      {cadre("Comptabilisation", <>{choix("modeleId", "Modèle", o.modeles.map((t: { id: number; libelle: string }) => ({ v: String(t.id), l: t.libelle })))}</>)}
    </div>,
  ];
  const produits = donnees.produits.filter((p: { numero: string; nom: string }) => p.numero.toLowerCase().includes(filtres.numero.trim().toLowerCase())
    && p.nom.toLowerCase().includes(filtres.nom.trim().toLowerCase()));
  return (
    <>
      <h2>Produit crédit : création/modification</h2>
      <div className="actions-onglets">
        <button className="bouton secondaire" type="button" aria-label="Nouveau produit crédit" onClick={nouveau}>+</button>
        <button className="bouton secondaire" type="button" onClick={() => setListe(true)}>Produits credit</button>
      </div>
      <div className="onglets" role="tablist" aria-label="Produit crédit">
        {ONGLETS.map((t, i) => <button key={t} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{t}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {pages[onglet]}
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={onglet === 0} onClick={() => setOnglet(onglet - 1)}>Précédent</button>
          {onglet < ONGLETS.length - 1 && <button className="bouton secondaire" type="button" onClick={() => setOnglet(onglet + 1)}>Suivant</button>}
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 37 et 38 : pages Information de base, Garanties financières, Assurance, Frais, Autres informations ; Information de base (Minimum, Maximum, Identification, Intérêt, Types de client, Divers) ; liste des produits crédits (Numero, Produit, Type de client, Taux interet, Taux différé)",
          "Instr. BCC n°38 du 03/01/2019 (TEG) : art. 5 (taux réglementés ou bonifiés), 6 (composantes et catégories), 9 (épargne obligatoire), 11 (méthode dégressive), 14 (remboursement anticipé : au plus 50 % des intérêts restant dus)",
          "Instr. BCC n°40 du 03/01/2019, art. 8 et 9 : frais de dossier, d'hypothèque, de mise en place, d'inscription des gages, de suivi du crédit ; frais d'assurance",
          "Manuel Microfina++, p. 40 : Modèle pour crédit (Model normal, Modèle ressources affectées), choisi par le produit",
          "Manuel Microfina++, p. 86 (Encaisser frais au déblocage) et p. 114 (épargne obligatoire, fonds de solidarité, assureur et montant suivant le paramétrage)"]} />
      </section>
      <Fiche titre="Produit Crédit" ouverte={liste} fermer={() => setListe(false)}>
        <Paginee lignes={produits}>{(visibles) => (<table className="grille">
          <caption>Liste des produits crédits</caption>
          <thead>
            <tr><th scope="col">Numéro</th><th scope="col">Produit</th><th scope="col">Type de client</th><th scope="col" className="num">Taux d'intérêt mensuel (%)</th><th scope="col" className="num">Taux différé (%)</th></tr>
            <tr className="filtres"><td><input className="saisie" type="search" aria-label="Filtrer Numéro" value={filtres.numero} onChange={(e) => setFiltres({ ...filtres, numero: e.target.value })} /></td>
              <td><input className="saisie" type="search" aria-label="Filtrer Produit" value={filtres.nom} onChange={(e) => setFiltres({ ...filtres, nom: e.target.value })} /></td><td /><td /><td /></tr>
          </thead>
          <tbody>
            {produits.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
            {visibles.map((p: { id: number; numero: string; nom: string; typeClient: string; tauxInteret: number; tauxDiffere: number }) => (
              <tr key={p.id} className="ligne-choix" tabIndex={0} onClick={() => ouvrir(p.id)} onKeyDown={(e) => { if (e.key === "Enter") void ouvrir(p.id); }}>
                <td>{p.numero}</td><td>{p.nom}</td><td>{p.typeClient}</td><td className="num">{p.tauxInteret.toFixed(1).replace(".", ",")}</td><td className="num">{p.tauxDiffere.toFixed(1).replace(".", ",")}</td>
              </tr>
            ))}
          </tbody>
        </table>)}</Paginee>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(false)}>Fermer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S24 : la liste des produits crédits (manuel p. 37 : « [Produits credit] pour obtenir la liste des Produits crédit (Fig.2) » ; capture p. 38).
 * C'est la fenêtre de S23, ouverte d'emblée ; un clic sur un produit le charge dans la fiche (registre S24-1). */
export function ListeProduitsCredit() {
  return <ProduitCredit listeOuverte />;
}
