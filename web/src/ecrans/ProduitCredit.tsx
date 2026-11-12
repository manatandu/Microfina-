import { useState, type ReactNode } from "react";
import { api, type FraisProduit, type ProduitCreditVue } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";

const ONGLETS = ["Information de base", "Garanties financières", "Assurance", "Frais", "Autres informations"];
type Saisie = Record<string, string | boolean>;
const VIDE: Saisie = {
  typeProduit: "CNO", cyclique: false, numero: "", nom: "", devise: "", modeCalcul: "Dégressif", typeInteret: "Fixe", tauxInteret: "", tauxDiffere: "",
  montantMin: "", dureeMin: "", differeMin: "", interetMin: "", montantMax: "", dureeMax: "", differeMax: "", interetMax: "",
  clientPhysique: false, clientGroupe: false, clientEntreprise: false, maxParMembre: false,
  periodicite: "", modeDiffere: "Réparti", paiementInteret: "Normal", interetAnticipation: "OUI", ageMax: "",
  epargneNature: "", epargneValeur: "", solidariteNature: "", solidariteValeur: "", typeAssuranceId: "", assuranceNature: "", assuranceValeur: "",
  categorie: "", tauxRegle: false, penaliteRetard: "", penaliteAnticipation: "", ordreId: "",
};
const IDS = ["typeAssuranceId", "ordreId"];
const LIGNE_FRAIS = { typeFrais: "", nature: "", valeur: "", compte: "" };

/** S23 : Paramétrage > Produit > Crédit > Produit crédit : création/modification (manuel Microfina++, p. 37 et 38) */
export default function ProduitCredit() {
  const [f, setF] = useState<Saisie>(VIDE);
  const [frais, setFrais] = useState<Record<string, string>[]>([]);
  const [onglet, setOnglet] = useState(0);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [liste, setListe] = useState(false);
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
    return d;
  };
  const enregistrer = () => setBoite({ type: "confirmation", message: choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?", oui: async () => {
    try { const r = await api.produitsCredit.enregistrer(envoi(), choisi ?? undefined); setChoisi(r.produit.id); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const texte = (k: string, libelle: string, classe = "saisie") => (
    <Champ libelle={libelle}>{(p) => <input {...p} className={classe} value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Champ>);
  const choix = (k: string, libelle: string, valeurs: { v: string; l: string }[], vide = true) => (
    <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
      {vide && <option value=""></option>}{valeurs.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select>}</Champ>);
  const simple = (l: string[]) => l.map((x) => ({ v: x, l: x }));
  const case_ = (k: string, libelle: string) => (
    <label className="case"><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span>{libelle}</span></label>);
  const cadre = (titre: string, enfants: ReactNode) => <fieldset className="cadre-champs"><legend>{titre}</legend><div className="ligne-champ">{enfants}</div></fieldset>;
  const natures = simple(o.natures);
  const pages: ReactNode[] = [
    <div key="base" className="pile">
      <div className="grille-deux">
        {cadre("Minimum", <>{texte("montantMin", "Montant *")}{texte("dureeMin", "Durée (mois) *", "saisie code")}{texte("differeMin", "Différé (mois) *", "saisie code")}{texte("interetMin", "Intérêt", "saisie code")}</>)}
        {cadre("Maximum", <>{texte("montantMax", "Montant *")}{texte("dureeMax", "Durée (mois) *", "saisie code")}{texte("differeMax", "Différé (mois) *", "saisie code")}{texte("interetMax", "Intérêt", "saisie code")}</>)}
        {cadre("Identification", <>{choix("typeProduit", "Type Produit *", o.typesProduit.map((t: { code: string; libelle: string }) => ({ v: t.code, l: t.libelle })), false)}{case_("cyclique", "Cyclique")}
          {texte("numero", "Num Produit *", "saisie code")}{texte("nom", "Nom du produit *")}{choix("devise", "Devise *", simple(o.devises))}{choix("modeCalcul", "Mode calcul int *", simple(o.modesCalcul), false)}</>)}
        {cadre("Intérêt", <>{choix("typeInteret", "Type *", simple(o.typesInteret), false)}{texte("tauxInteret", "Taux int. (%) *", "saisie code")}{texte("tauxDiffere", "Taux diff. (%) *", "saisie code")}</>)}
      </div>
      <div className="grille-deux">
        {cadre("Types de client", <>{case_("clientPhysique", "Physique")}{case_("clientGroupe", "Groupe")}{case_("clientEntreprise", "Entreprise")}{case_("maxParMembre", "Appliquer montant max. prêt par mbre du groupe")}</>)}
        {cadre("Divers", <>{choix("periodicite", "Périodicité *", o.periodicites.map((t: { code: string; libelle: string }) => ({ v: t.code, l: t.libelle })))}
          {choix("modeDiffere", "Mode différé: *", simple(o.modesDiffere), false)}{choix("paiementInteret", "Paiement intérêt *", simple(o.paiementsInteret), false)}
          {choix("interetAnticipation", "Percevoir int. par anticipation *", simple(["OUI", "NON"]), false)}{texte("ageMax", "Age max *", "saisie code")}</>)}
      </div>
    </div>,
    <div key="garanties" className="grille-deux">
      {cadre("Épargne obligatoire", <>{choix("epargneNature", "Nature", natures)}{texte("epargneValeur", "Valeur", "saisie code")}</>)}
      {cadre("Fonds de solidarité", <>{choix("solidariteNature", "Nature", natures)}{texte("solidariteValeur", "Valeur", "saisie code")}</>)}
    </div>,
    <div key="assurance">
      {cadre("Assurance", <>{choix("typeAssuranceId", "Type assurance", o.typesAssurance.map((t: { id: number; libelle: string }) => ({ v: String(t.id), l: t.libelle })))}
        {choix("assuranceNature", "Nature", natures)}{texte("assuranceValeur", "Valeur", "saisie code")}</>)}
    </div>,
    <div key="frais" className="pile">
      <table className="grille">
        <thead><tr><th scope="col">Type de frais</th><th scope="col">Nature</th><th scope="col" className="num">Valeur</th><th scope="col">Compte</th><th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
        <tbody>
          {frais.length === 0 && <tr><td colSpan={5}>Liste vide</td></tr>}
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
    <div key="autres" className="grille-deux">
      {cadre("Taux effectif global", <>{choix("categorie", "Catégorie de prêt *", simple(o.categories))}{case_("tauxRegle", "Taux réglementé ou bonifié")}</>)}
      {cadre("Pénalités", <>{texte("penaliteRetard", "Pénalité de retard (%)", "saisie code")}{texte("penaliteAnticipation", "Pénalité de remboursement anticipé (% des intérêts restant dus)", "saisie code")}</>)}
      {cadre("Remboursement", <>{choix("ordreId", "Ordre de remboursement", o.ordres.map((t: { id: number; libelle: string }) => ({ v: String(t.id), l: t.libelle })))}</>)}
    </div>,
  ];
  const produits = donnees.produits.filter((p: { numero: string; nom: string }) => p.numero.toLowerCase().includes(filtres.numero.trim().toLowerCase())
    && p.nom.toLowerCase().includes(filtres.nom.trim().toLowerCase()));
  return (
    <>
      <h1>Produit crédit : création/modification</h1>
      <div className="actions-onglets">
        <button className="bouton" type="button" aria-label="Nouveau produit crédit" onClick={nouveau}>+</button>
        <button className="bouton" type="button" onClick={() => setListe(true)}>Produits credit</button>
      </div>
      <div className="onglets" role="tablist" aria-label="Produit crédit">
        {ONGLETS.map((t, i) => <button key={t} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{t}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {pages[onglet]}
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={onglet === 0} onClick={() => setOnglet(onglet - 1)}>Précédent</button>
          {onglet < ONGLETS.length - 1
            ? <button className="bouton" type="button" onClick={() => setOnglet(onglet + 1)}>Suivant</button>
            : <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>}
        </div>
        <Textes sources={["Manuel Microfina++, p. 37 et 38 : pages Information de base, Garanties financières, Assurance, Frais, Autres informations ; Information de base (Minimum, Maximum, Identification, Intérêt, Types de client, Divers) ; liste des produits crédits (Numero, Produit, Type de client, Taux interet, Taux différé)",
          "Instr. BCC n°38 du 03/01/2019 (TEG) : art. 5 (taux réglementés ou bonifiés), 6 (composantes et catégories), 9 (épargne obligatoire), 11 (méthode dégressive), 14 (remboursement anticipé : au plus 50 % des intérêts restant dus)",
          "Instr. BCC n°40 du 03/01/2019, art. 8 et 9 : frais de dossier, d'hypothèque, de mise en place, d'inscription des gages, de suivi du crédit ; frais d'assurance",
          "Manuel Microfina++, p. 86 (Encaisser frais au déblocage) et p. 114 (épargne obligatoire, fonds de solidarité, assureur et montant suivant le paramétrage)"]} />
      </section>
      <Fiche titre="Produit Crédit" ouverte={liste} fermer={() => setListe(false)}>
        <table className="grille">
          <caption>Liste des produits crédits</caption>
          <thead>
            <tr><th scope="col">Numero</th><th scope="col">Produit</th><th scope="col">Type de client</th><th scope="col" className="num">Taux interet</th><th scope="col" className="num">Taux différé</th></tr>
            <tr className="filtres"><td><input className="saisie" type="search" aria-label="Filtrer Numero" value={filtres.numero} onChange={(e) => setFiltres({ ...filtres, numero: e.target.value })} /></td>
              <td><input className="saisie" type="search" aria-label="Filtrer Produit" value={filtres.nom} onChange={(e) => setFiltres({ ...filtres, nom: e.target.value })} /></td><td /><td /><td /></tr>
          </thead>
          <tbody>
            {produits.length === 0 && <tr><td colSpan={5}>Liste vide</td></tr>}
            {produits.map((p: { id: number; numero: string; nom: string; typeClient: string; tauxInteret: number; tauxDiffere: number }) => (
              <tr key={p.id} className="ligne-choix" tabIndex={0} onClick={() => ouvrir(p.id)} onKeyDown={(e) => { if (e.key === "Enter") void ouvrir(p.id); }}>
                <td>{p.numero}</td><td>{p.nom}</td><td>{p.typeClient}</td><td className="num">{p.tauxInteret.toFixed(1)}</td><td className="num">{p.tauxDiffere.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(false)}>Fermer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
