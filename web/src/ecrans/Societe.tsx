import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type InfoSociete } from "../donnees/api";
import { BlocAdresse, composerAdresse } from "../composants/Adresse";
import type { Adresse } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee } from "../composants";
import { fr } from "../lib/dates";
import { lireMontant, montant } from "@design/montant.js";
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
      {page === "societe" && <><InformationSociete /><FondsPropres /></>}
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
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(true)}>Liste institution</button></div>
      <div className="onglets" role="tablist" aria-label="Information société">
        <button type="button" role="tab" aria-selected="true">Info générale</button>
        <button type="button" role="tab" aria-selected="false" disabled title="Le manuel ne montre pas le contenu de cet onglet (registre S32-6)">Autres Info</button>
      </div>
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
            {texte("nrc", "NRC")}
            {/* Police d'assurance de la trésorerie : déclarée une fois, lue par les normes prudentielles (Instr. BCC 002 ; registre SN01-4) */}
            {texte("assuranceAssureur", "Assurance de la trésorerie : assureur")}
            {texte("assurancePolice", "Assurance de la trésorerie : n° de police", "saisie code")}
            <ChampDate libelle="Assurance de la trésorerie : échéance" valeur={String(v.assuranceEcheance ?? "")} onChange={(x) => maj({ assuranceEcheance: x })} />
            {(v.typeBase === "coopec" || v.typeBase === "faitiere") && texte("delegationAdmission", "Délégation d'admission (décision du CA) :")}
            {v.typeBase === "coopec" && texte("faitiereAffiliation", "Faîtière d'affiliation :")}
            {(v.typeBase === "coopec" || v.typeBase === "faitiere") && texte("membresAuxiliaires", "Membres auxiliaires (article des statuts) :")}
          </div>
          <div className="pile champs-a-gauche">
            <BlocAdresse valeur={v} maj={(x) => maj(x)} arbre={donnees.arbreLieux} ajouterQuartier={api.adresse.ajouterQuartier} />
            {texte("email", "email :")}
            {texte("bp", "BP", "saisie code")}
            {texte("telephoneFixe", "Telephone fixe :")}
            {texte("adresse", "Adresse :")}
            {texte("compteHorsBilan2", "Hors Bilan 2", "saisie code")}
          </div>
        </div>
        <fieldset className="cadre-champs pile">
          <legend>Logo</legend>
          <label className="bouton secondaire choisir-fichier">Choisir<input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => choisirLogo(e.target.files?.[0])} /></label>
          <span>APERCU LOGO</span>
          {v.logo ? <img src={v.logo} alt="Logo de l'institution" className="apercu-logo" /> : <div className="apercu-logo" aria-hidden="true" />}
        </fieldset>
      </fieldset>
      <fieldset className="cadre-champs">
        <legend>Info sécurité</legend>
        <div className="grille-deux">
          <Champ libelle="Longueur minimale du mot de passe :">{(p) => <input {...p} className="saisie code" readOnly value={String(donnees.securite.motDePasseMin)} />}</Champ>
          <Champ libelle="Essais de connexion refusés avant blocage :">{(p) => <input {...p} className="saisie code" readOnly value={`${donnees.securite.essais} en ${donnees.securite.fenetreMinutes} minutes`} />}</Champ>
        </div>
      </fieldset>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button></div>
      <Textes sources={["Manuel Microfina++, p. 42 : « Information société, Agence et zone, puis renseigner successivement sans omettre les champs obligatoires avec la possibilité d'intégrer le logo de l'institution » ; capture : Code Institution*, Dénomination*, Type base*, Description, Directeur, N° Agrément, Journée Maxi ouvert*, Compte Hors Bilan 1, I.F.U (NIF en RDC, demande du porteur du 13/11/2026), Pays, Ville, Quartier*, Rue / Maison (Commune entre Ville et Quartier : demande du porteur du 13/11/2026, découpage de S20), email, BP, Telephone fixe, Adresse, Hors Bilan 2, Logo (Choisir, APERCU LOGO), Liste institution",
        "Loi 002/2002 (COOPEC, structures faîtières) ; loi 11/020, art. 11 (sociétés de microfinance, entreprises de micro-crédit) : Type base",
        "PCCI § 9 : classe 0, comptes de hors bilan",
        "Loi 002/2002, art. 22, 6° : le Conseil d'Administration admet les membres ; sa décision de déléguer l'admission au visa se note ici (écart E05)"]} />
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

type SaisieAgence = Adresse & { code: string; nom: string; autorisationReference: string; autorisationLe: string };
const AGENCE_VIDE: SaisieAgence = { code: "", nom: "", autorisationReference: "", autorisationLe: "", pays: "", province: "", ville: "", commune: "", quartier: "", rue: "", numeroRue: "" };
function Agences() {
  const [f, setF] = useState<SaisieAgence>(AGENCE_VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.societe.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const effacer = () => { setF(AGENCE_VIDE); setChoisi(null); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const choisir = (a: SaisieAgence & { id: number }) => { setChoisi(a.id); const { id: _id, ...x } = a; setF({ ...AGENCE_VIDE, ...x }); };
  return (
    <section className="bloc pile" id="volet-agence" role="tabpanel" aria-labelledby="onglet-agence">
      <div className="ligne-champ">
        <Champ libelle="Code : *">{(p) => <input {...p} className="saisie code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}</Champ>
        <Champ libelle="Nom : *">{(p) => <input {...p} className="saisie" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />}</Champ>
      </div>
      {/* A3 et B19 (confrontation du 21/11/2026) : autorisation préalable de la BCC pour ouvrir une agence (Instr. BCC 41, art. 35) */}
      <div className="ligne-champ">
        <Champ libelle="Autorisation de la BCC, référence : *">{(p) => <input {...p} className="saisie code" value={f.autorisationReference} onChange={(e) => setF({ ...f, autorisationReference: e.target.value })} />}</Champ>
        <ChampDate libelle="Date de l'autorisation : *" valeur={f.autorisationLe} onChange={(v) => setF({ ...f, autorisationLe: v })} />
      </div>
      {/* Adresse de l'agence, la même que partout (décision du porteur du 21/11/2026, registre T41) */}
      <fieldset className="pile cadre-champs champs-a-gauche">
        <legend>Adresse de l'agence</legend>
        <BlocAdresse valeur={f} maj={(x) => { const { adresse: _a, ...r } = x; setF({ ...f, ...r }); }} arbre={donnees.arbreLieux} ajouterQuartier={api.adresse.ajouterQuartier} />
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
          () => api.societe.enregistrerAgence(f, choisi ?? undefined))}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.societe.supprimerAgence(choisi!))}>Supprimer</button>
      </div>
      <Paginee lignes={donnees.agences}>{(visibles) => (<table className="grille">
        <thead><tr><th scope="col">Code</th><th scope="col">Nom</th><th scope="col">Adresse</th></tr></thead>
        <tbody>
          {visibles.map((a: SaisieAgence & { id: number }) => (
            <tr key={a.id} className="ligne-choix" tabIndex={0} aria-selected={a.id === choisi} onClick={() => choisir(a)} onKeyDown={(e) => { if (e.key === "Enter") choisir(a); }}>
              <td>{a.code}</td><td>{a.nom}</td><td>{composerAdresse(a)}</td>
            </tr>
          ))}
        </tbody>
      </table>)}</Paginee>
      <Textes sources={["Manuel Microfina++, p. 42 : pages Information société, Agence et zone ; page Agence non montrée : gabarit liste (COMPLEMENTS § 4.1), code et nom",
        "Manuel Microfina++, p. 23 et 24 : le code de l'agence entre dans le numéro du client (S15)"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** Registre CR-2 : fonds propres prudentiels du dernier arrêté mensuel, saisis par la direction ; ils servent aux plafonds du crédit (Instr. BCC 002, art. 7 à 11, 25 à 29) */
function FondsPropres() {
  const [relu, setRelu] = useState(0);
  const { donnees: fp } = useDonnees(() => api.dossiers.fondsPropres(), [relu]);
  const [f, setF] = useState({ date: "", montant: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.dossiers.enregistrerFondsPropres({ dateArrete: f.date, montant: (f.montant.trim() ? lireMontant(f.montant) : null) ?? NaN }); setF({ date: "", montant: "" }); setRelu((v) => v + 1);
      setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <section className="bloc pile" aria-label="Fonds propres prudentiels">
      <fieldset className="cadre-champs pile">
        <legend>Fonds propres prudentiels</legend>
        <p>Dernier arrêté : <strong className="chiffres">{fp ? `${montant(fp.montant, "CDF")} au ${fr(fp.dateArrete)}` : "non saisi"}</strong></p>
        <div className="ligne-champ">
          <ChampDate libelle="Date de l'arrêté *" valeur={f.date} onChange={(v) => setF({ ...f, date: v })} />
          <Champ libelle="Montant (CDF) *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
          <button className="bouton secondaire" type="button" disabled={!f.date || !f.montant.trim()} onClick={enregistrer}>Enregistrer</button>
        </div>
      </fieldset>
      <Textes sources={["Registre CR-2 (décision du porteur, 19/11/2026) : montant du dernier arrêté mensuel ; Instr. BCC 002, art. 7 à 11 (composition), 25 à 29 (plafonds du crédit)"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
