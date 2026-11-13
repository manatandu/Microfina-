import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type InfoSociete } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
import { Onglet as PageZone } from "./Credit";

const PAGES = [["societe", "Information Societe"], ["agence", "Agence"], ["zone", "Zone"]] as const;

/** S32 : Paramétrage > Info société (manuel Microfina++, p. 42) : pages Information Societe, Agence, Zone */
export default function InfoSocietePage() {
  const [params, setParams] = useSearchParams();
  const page = PAGES.some(([p]) => p === params.get("page")) ? params.get("page")! : "societe";
  return (
    <>
      <h1>Information société</h1>
      <div className="onglets" role="tablist" aria-label="Information société">
        {PAGES.map(([p, nom]) => <button key={p} type="button" role="tab" id={`onglet-${p}`} aria-controls={`volet-${p}`} aria-selected={p === page}
          onClick={() => setParams(p === "societe" ? {} : { page: p })}>{nom}</button>)}
      </div>
      {page === "societe" && <InformationSociete />}
      {page === "agence" && <Agences />}
      {page === "zone" && <div id="volet-zone" role="tabpanel" aria-labelledby="onglet-zone"><PageZone page="zones" /></div>}
    </>
  );
}

function InformationSociete() {
  const [f, setF] = useState<InfoSociete | null>(null);
  const [liste, setListe] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.societe.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const v: InfoSociete = f ?? donnees.institution;
  const maj = (x: Partial<InfoSociete>) => setF({ ...v, ...x });
  const pays = donnees.localites.find((p: { pays: string }) => p.pays === v.pays);
  const ville = pays?.villes.find((x: { ville: string }) => x.ville === v.ville);
  const commune = ville?.communes.find((x: { commune: string }) => x.commune === v.commune);
  const texte = (k: keyof InfoSociete, libelle: string, classe = "saisie") => (
    <Champ libelle={libelle}>{(p) => <input {...p} className={classe} value={String(v[k] ?? "")} onChange={(e) => maj({ [k]: e.target.value })} />}</Champ>);
  function choisirLogo(fichier: File | undefined) {
    if (!fichier) return;
    if (!["image/png", "image/jpeg"].includes(fichier.type)) { setBoite({ type: "erreur", message: "Logo : une image PNG ou JPEG." }); return; }
    if (fichier.size > 200_000) { setBoite({ type: "erreur", message: "Logo : image trop lourde (200 Ko au plus)." }); return; }
    const r = new FileReader(); r.onload = () => maj({ logo: String(r.result) }); r.readAsDataURL(fichier);
  }
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.societe.enregistrer({ ...v, journeeMax: /^\d+$/.test(String(v.journeeMax)) ? Number(v.journeeMax) : null }); setF(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <section className="bloc pile" id="volet-societe" role="tabpanel" aria-labelledby="onglet-societe">
      <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setListe(true)}>Liste institution</button></div>
      <fieldset className="cadre-champs">
        <legend>Info générale</legend>
        <div className="grille-deux">
          <div className="pile champs-a-gauche">
            {texte("code", "Code Institution : *", "saisie code")}
            {texte("denomination", "Dénomination *")}
            <Champ libelle="Type base : *">{(p) => <select {...p} className="saisie" value={v.typeBase} onChange={(e) => maj({ typeBase: e.target.value })}>
              <option value=""></option>{donnees.types.map((t: { code: string; libelle: string }) => <option key={t.code} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Description :">{(p) => <textarea {...p} className="saisie" rows={3} value={v.description} onChange={(e) => maj({ description: e.target.value })} />}</Champ>
            {texte("directeur", "Directeur :")}
            {texte("agrement", "N° Agrément", "saisie code")}
            <Champ libelle="Journée Maxi ouvert : *">{(p) => <input {...p} className="saisie code" inputMode="numeric" value={String(v.journeeMax ?? "")}
              onChange={(e) => setF({ ...v, journeeMax: e.target.value as unknown as number })} />}</Champ>
            {texte("compteHorsBilan1", "Compte Hors Bilan 1", "saisie code")}
            {texte("ifu", "NIF")}
          </div>
          <div className="pile champs-a-gauche">
            <Champ libelle="Pays">{(p) => <select {...p} className="saisie" value={v.pays} onChange={(e) => maj({ pays: e.target.value, ville: "", commune: "", quartier: "" })}>
              <option value=""></option>{donnees.localites.map((x: { pays: string }) => <option key={x.pays}>{x.pays}</option>)}</select>}</Champ>
            <Champ libelle="Ville:">{(p) => <select {...p} className="saisie" value={v.ville} onChange={(e) => maj({ ville: e.target.value, commune: "", quartier: "" })}>
              <option value=""></option>{pays?.villes.map((x: { ville: string }) => <option key={x.ville}>{x.ville}</option>)}</select>}</Champ>
            <Champ libelle="Commune">{(p) => <select {...p} className="saisie" value={v.commune} onChange={(e) => maj({ commune: e.target.value, quartier: "" })}>
              <option value=""></option>{ville?.communes.map((x: { commune: string }) => <option key={x.commune}>{x.commune}</option>)}</select>}</Champ>
            <Champ libelle="Quartier *">{(p) => <select {...p} className="saisie" value={v.quartier} onChange={(e) => maj({ quartier: e.target.value })}>
              <option value=""></option>{commune?.quartiers.map((q: string) => <option key={q}>{q}</option>)}</select>}</Champ>
            {texte("rue", "Rue / Maison")}
            {texte("email", "email :")}
            {texte("bp", "BP", "saisie code")}
            {texte("telephoneFixe", "Telephone fixe :")}
            {texte("adresse", "Adresse :")}
            {texte("compteHorsBilan2", "Hors Bilan 2", "saisie code")}
          </div>
        </div>
        <fieldset className="cadre-champs pile">
          <legend>Logo</legend>
          <label className="bouton choisir-fichier">Choisir<input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => choisirLogo(e.target.files?.[0])} /></label>
          <span>APERCU LOGO</span>
          {v.logo ? <img src={v.logo} alt="Logo de l'institution" className="apercu-logo" /> : <div className="apercu-logo" aria-hidden="true" />}
        </fieldset>
      </fieldset>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button></div>
      <Textes sources={["Manuel Microfina++, p. 42 : « Information société, Agence et zone, puis renseigner successivement sans omettre les champs obligatoires avec la possibilité d'intégrer le logo de l'institution » ; capture : Code Institution*, Dénomination*, Type base*, Description, Directeur, N° Agrément, Journée Maxi ouvert*, Compte Hors Bilan 1, I.F.U (NIF en RDC, demande du porteur du 13/11/2026), Pays, Ville, Quartier*, Rue / Maison (Commune entre Ville et Quartier : demande du porteur du 13/11/2026, découpage de S20), email, BP, Telephone fixe, Adresse, Hors Bilan 2, Logo (Choisir, APERCU LOGO), Liste institution",
        "Loi 002/2002 (COOPEC, structures faîtières) ; loi 11/020, art. 11 (sociétés de microfinance, entreprises de micro-crédit) : Type base",
        "PCCI § 9 : classe 0, comptes de hors bilan"]} />
      <Fiche titre="Liste institution" ouverte={liste} fermer={() => setListe(false)}>
        <table className="grille">
          <thead><tr><th scope="col">Code Institution</th><th scope="col">Dénomination</th></tr></thead>
          <tbody><tr><td>{donnees.institution.code}</td><td>{donnees.institution.denomination}</td></tr></tbody>
        </table>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(false)}>Fermer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

function Agences() {
  const [f, setF] = useState({ code: "", nom: "" });
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.societe.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const effacer = () => { setF({ code: "", nom: "" }); setChoisi(null); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const choisir = (a: { id: number; code: string; nom: string }) => { setChoisi(a.id); setF({ code: a.code, nom: a.nom }); };
  return (
    <section className="bloc pile" id="volet-agence" role="tabpanel" aria-labelledby="onglet-agence">
      <div className="ligne-champ">
        <Champ libelle="Code : *">{(p) => <input {...p} className="saisie code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}</Champ>
        <Champ libelle="Nom : *">{(p) => <input {...p} className="saisie" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />}</Champ>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
          () => api.societe.enregistrerAgence(f, choisi ?? undefined))}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.societe.supprimerAgence(choisi!))}>Supprimer</button>
      </div>
      <table className="grille">
        <thead><tr><th scope="col">Code</th><th scope="col">Nom</th></tr></thead>
        <tbody>
          {donnees.agences.map((a: { id: number; code: string; nom: string }) => (
            <tr key={a.id} className="ligne-choix" tabIndex={0} aria-selected={a.id === choisi} onClick={() => choisir(a)} onKeyDown={(e) => { if (e.key === "Enter") choisir(a); }}>
              <td>{a.code}</td><td>{a.nom}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Textes sources={["Manuel Microfina++, p. 42 : pages Information société, Agence et zone ; page Agence non montrée : gabarit liste (COMPLEMENTS § 4.1), code et nom",
        "Manuel Microfina++, p. 23 et 24 : le code de l'agence entre dans le numéro du client (S15)"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
