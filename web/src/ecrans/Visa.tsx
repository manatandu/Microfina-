import { useEffect, useState } from "react";
import { api, IMAGE_MAX } from "../donnees/api";
import type { Representant, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Silhouette, Textes, type Boite } from "../composants";
import { lireMontant, montant } from "@design/montant.js";

type Ctx = Awaited<ReturnType<typeof api.referentiel.contexte>>;
const nomComplet = (t: { nom: string; postnom: string; prenom: string }) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const fr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const deviseDe = (ctx: Ctx, t: Tiers) => ctx.produits.find((p) => p.code === t.produitCode)?.devise ?? "CDF";

/** S40 : Client > Visa > Viser un client (manuel Microfina++, p. 52). Admission du membre : loi 002/2002, art. 22, 6°. */
export function VisaClient() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), attente: await api.tiers.aViser() }));
  const [t, setT] = useState<Tiers | null>(null);
  const [intitule, setIntitule] = useState("");
  const [depot, setDepot] = useState("");
  const [dateVisa, setDateVisa] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [contrat, setContrat] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: lies } = useDonnees(() => (t ? api.parametrage.fraisLies(t.id) : Promise.resolve([])), [t?.id]);
  const frais = lies ?? [];
  if (!donnees) return <Chargement />;
  const { ctx, attente } = donnees;
  const vise = t?.statut === "actif";

  async function choisir(x: Tiers) {
    const j = await api.journees.courante();
    setT(x); setIntitule(x.intitule || nomComplet(x)); setDepot(x.premierDepot ? String(x.premierDepot / 100).replace(".", ",") : "0");
    setDateVisa(j?.statut === "ouverte" ? j.date : ""); setRecherche(false);
  }
  function annuler() { setT(null); setIntitule(""); setDepot(""); setDateVisa(""); }
  function viser() {
    if (!t) { setBoite({ type: "erreur", message: "Rechercher d'abord le client." }); return; }
    const m = depot.trim() ? lireMontant(depot) : 0;
    if (m === null || m < 0) { setBoite({ type: "erreur", message: "Premier dépôt invalide." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        setT(await api.tiers.viser(t.id, { dateVisa, intitule, premierDepot: m }));
        setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <h1>Visa client</h1>
      <section className="bloc pile" aria-label="Visa">
        <div className="deux-colonnes">
          <fieldset className="pile cadre-champs">
            <legend>Informations du client</legend>
            <div className="ligne-champ">
              <Champ libelle="Numéro Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={vise} onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé : *">{(p) => <input {...p} className="saisie" required readOnly={!t || vise} autoComplete="off" value={intitule} onChange={(e) => setIntitule(e.target.value)} />}</Champ>
            <Champ libelle={`Prémier dépôt :${t ? ` (${deviseDe(ctx, t)})` : ""}`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" readOnly={!t || vise} autoComplete="off" value={depot} onChange={(e) => setDepot(e.target.value)} />}</Champ>
            <Champ libelle="Date Demande *">{(p) => <input {...p} className="saisie code" readOnly value={t ? fr(t.dateDemande) : ""} />}</Champ>
            <ChampDate libelle="Date Visa *" valeur={dateVisa} onChange={setDateVisa} requis />
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Liste des Frais liés</legend>
            <table className="grille">
              <thead><tr><th scope="col">Libellé Frais</th><th scope="col">Compte</th><th scope="col">Nbre</th><th scope="col">Montant</th></tr></thead>
              <tbody>
                {(!t || frais.length === 0) && <tr><td colSpan={4}>Liste vide</td></tr>}
                {t && frais.map((f, i) => <tr key={i}><td>{f.libelle}</td><td className="chiffres">{f.compte}</td><td></td><td className="chiffres">{f.montant === null ? "" : montant(f.montant, "CDF")}</td></tr>)}
              </tbody>
            </table>
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={vise} onClick={viser}>Viser</button>
          <button className="bouton secondaire" type="button" disabled={!vise} onClick={() => setContrat(true)}>Imprimer Contrat</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
      </section>

      {t && <DetailClient key={t.id} t={t} />}

      <Textes sources={["Manuel Microfina++, p. 52 : écran Visa client, recherche par numéro, nom et prénoms, double-clic, boutons Viser, Imprimer Contrat, Annuler ; contrat d'adhésion",
        "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
        "Loi 002/2002, art. 22 : demande d'adhésion signée (3°), engagement aux statuts (4°), droit d'adhésion (5°), admission par le Conseil d'administration (6°)",
        "ARCHITECTURE P7 : le visa vient d'une autre personne que celle qui a enrôlé"]} />

      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => attente.filter((x) => [x.numero, x.nom, x.postnom, x.prenom].join(" ").toLowerCase().includes(q))}
          choisir={(x) => void choisir(x)} fermer={() => setRecherche(false)} />
      </Fiche>
      <Fiche titre="Demande d'adhésion" ouverte={contrat} fermer={() => setContrat(false)}>
        {t && <Contrat t={t} ctx={ctx} />}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setContrat(false)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => window.print()}>Imprimer</button>
        </div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Fenêtre « Recherche d'un client » (manuel p. 85) : Filtre (Numero, Nom, Prénom), Resultat (Numéro, Nom prénom/raison s., Agence) ; double-clic sur la ligne.
 *  Entrée fait de même au clavier. */
export function RechercheClient({ source, choisir, fermer }: { source: (q: string) => Promise<Tiers[]>; choisir: (t: Tiers) => void; fermer: () => void }) {
  const [f, setF] = useState({ numero: "", nom: "", prenom: "" });
  const [cherche, setCherche] = useState(f);
  const premier = (cherche.numero || cherche.nom || cherche.prenom).trim().toLowerCase();
  const { donnees } = useDonnees(async () => ({ liste: await source(premier), ctx: await api.referentiel.contexte() }), [premier]);
  const garde = (t: Tiers) => t.numero.toLowerCase().includes(cherche.numero.trim().toLowerCase()) && t.nom.toLowerCase().includes(cherche.nom.trim().toLowerCase())
    && [t.postnom, t.prenom].join(" ").toLowerCase().includes(cherche.prenom.trim().toLowerCase());
  const liste = (donnees?.liste ?? []).filter(garde);
  const champ = (k: keyof typeof f, libelle: string) => <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" type="search" autoComplete="off" value={f[k]}
    onChange={(e) => { const n = { ...f, [k]: e.target.value }; setF(n); setCherche(n); }} onKeyDown={(e) => { if (e.key === "Enter") setCherche(f); }} />}</Champ>;
  return (
    <div className="pile">
      <fieldset className="cadre-champs">
        <legend>Filtre</legend>
        <div className="ligne-champ">
          {champ("numero", "Numero:")}{champ("nom", "Nom:")}{champ("prenom", "Prénom:")}
          <button className="bouton secondaire" type="button" onClick={() => setCherche(f)}>Rechercher</button>
        </div>
      </fieldset>
      <fieldset className="cadre-champs">
        <legend>Resultat</legend>
        <table className="grille">
          <thead><tr><th scope="col">Numéro</th><th scope="col">Nom prénom/raison s.</th><th scope="col">Agence</th></tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={3}>Liste vide</td></tr>}
            {liste.map((t) => (
              <tr key={t.id} className="ligne-choix" tabIndex={0} onDoubleClick={() => choisir(t)} onKeyDown={(e) => { if (e.key === "Enter") choisir(t); }}>
                <td className="chiffres">{t.numero}</td><td>{nomComplet(t)}</td><td>{donnees?.ctx.agence.nom ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
    </div>
  );
}

/** S41 : Client > Visa > Modifier frais (manuel Microfina++, p. 53) */
export function ModificationFrais() {
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [t, setT] = useState<Tiers | null>(null);
  const [saisies, setSaisies] = useState<Record<number, string>>({});
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: lies } = useDonnees(() => (t ? api.parametrage.fraisLies(t.id) : Promise.resolve([])), [t?.id]);
  if (!ctx) return <Chargement />;
  const frais = lies ?? [];
  const saisie = (f: { fraisId: number; montant: number | null }) => saisies[f.fraisId] ?? (f.montant === null ? "" : String(f.montant / 100).replace(".", ","));
  function annuler() { setT(null); setSaisies({}); }
  function modifier() {
    if (!t) { setBoite({ type: "erreur", message: "Rechercher d'abord le client." }); return; }
    const lignes = frais.map((f) => ({ fraisId: f.fraisId, montant: saisie(f).trim() ? lireMontant(saisie(f)) : 0 }));
    if (lignes.some((l) => l.montant === null || l.montant < 0)) { setBoite({ type: "erreur", message: "Montant invalide." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.parametrage.modifierFraisClient(t.id, lignes as { fraisId: number; montant: number }[]); setSaisies({}); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Modification de Frais</h1>
      <section className="bloc pile" aria-label="Modification de Frais">
        <div className="deux-colonnes">
          <fieldset className="pile cadre-champs">
            <legend>Informations du membre</legend>
            <div className="ligne-champ">
              <Champ libelle="Numéro du Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Date Visa *">{(p) => <input {...p} className="saisie code" readOnly value={t ? fr(t.dateVisa) : ""} />}</Champ>
            <Champ libelle="Nom ou Raison sociale :">{(p) => <input {...p} className="saisie" readOnly value={t ? t.intitule || nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Prémier dépôt:">{(p) => <input {...p} className="saisie montant" readOnly value={t ? montant(t.premierDepot, deviseDe(ctx, t)) : ""} />}</Champ>
            <Champ libelle="Date Demande *">{(p) => <input {...p} className="saisie code" readOnly value={t ? fr(t.dateDemande) : ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Liste des Frais liés</legend>
            <table className="grille">
              <thead><tr><th scope="col">Libellé</th><th scope="col">Compte</th><th scope="col">Nombre</th><th scope="col">Montant (CDF)</th></tr></thead>
              <tbody>
                {(!t || frais.length === 0) && <tr><td colSpan={4}>Liste vide</td></tr>}
                {t && frais.map((f) => (
                  <tr key={f.fraisId}><td>{f.libelle}</td><td className="chiffres">{f.compte}</td><td></td>
                    <td><input className="saisie montant" inputMode="decimal" autoComplete="off" aria-label={`Montant de ${f.libelle}`} value={saisie(f)}
                      onChange={(e) => setSaisies({ ...saisies, [f.fraisId]: e.target.value })} /></td></tr>
                ))}
              </tbody>
            </table>
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={modifier}>Modifier</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 53 : écran Modification de Frais, recherche par numéro, nom ou prénoms, montant modifié dans la Liste des frais liés, boutons Modifier et Annuler",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Loi 002/2002, art. 22, 5° : droit d'adhésion fixé, le cas échéant, par l'Assemblée générale"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); setSaisies({}); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Onglets en lecture du bas de l'écran (p. 52) : Info de base, Info Généraux, Autre Info, Personnes Liées, Bénéficiaires */
function DetailClient({ t }: { t: Tiers }) {
  const onglets = ["Info de base", "Info Généraux", "Autre Info", "Personnes Liées", "Bénéficiaires",
    ...(t.type === "morale" ? ["Dirigeant", "Signataires"] : t.type === "groupe" ? ["Membres Groupe"] : [])];
  const [o, setO] = useState(0);
  const { donnees: liees } = useDonnees(() => Promise.all(t.liees.map((id) => api.tiers.lire(id))), [t.id]);
  const lu = (libelle: string, v: string) => <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" readOnly value={v} />}</Champ>;
  const coche = (libelle: string, v: boolean) => <label className="case"><input type="checkbox" checked={v} disabled /><span>{libelle}</span></label>;
  const reps = (l: Representant[]) => l.length === 0 ? <p>Liste vide</p> : (
    <table className="grille"><thead><tr><th scope="col">Nom</th><th scope="col">Pièce</th><th scope="col">Signature</th></tr></thead>
      <tbody>{l.map((r, i) => <tr key={i}><td>{nomComplet(r)}</td><td>{r.pieceType} <span className="chiffres">{r.pieceNumero}</span></td><td>{r.specimen ? "Oui" : "Non"}</td></tr>)}</tbody></table>
  );
  return (
    <section className="pile" aria-label="Détail du client">
      <div className="onglets" role="tablist" aria-label="Détail du client">
        {onglets.map((x, i) => <button key={x} type="button" role="tab" id={`detail-${i}`} aria-controls="detail" aria-selected={i === o} onClick={() => setO(i)}>{x}</button>)}
      </div>
      <div className="bloc pile" id="detail" role="tabpanel" aria-labelledby={`detail-${o}`}>
        {o === 0 && (
          <div className="deux-colonnes">
            <div className="pile">{lu("Date demande :", fr(t.dateDemande))}{lu(t.type === "groupe" ? "Type de groupe :" : t.type === "morale" ? "Type entreprise :" : "Type Client :", t.typeClient)}{lu("Zone :", t.zone)}</div>
            <div className="pile">{lu("Sensibilisateur :", "")}{lu("Gestionnaire :", "")}{lu("Commercial :", "")}
              {coche("Résident", t.resident)}{coche("Prelever Agios", t.preleverAgios)}{coche("Calculer intéret", t.calculerInteret)}</div>
          </div>
        )}
        {o === 1 && (
          <div className="formulaire">
            {t.type === "physique" ? <>
              {lu("Nom :", t.nom)}{lu("Post-nom :", t.postnom)}{lu("Prénom :", t.prenom)}{lu("Sexe :", t.sexe === "F" ? "Féminin" : t.sexe === "M" ? "Masculin" : "")}
              {lu("Date de naissance :", fr(t.naissance))}{lu("Lieu de naissance :", t.lieuNaissance)}{lu("Adresse :", t.adresse)}{lu("Téléphone :", t.telephone)}
              {lu("Type de pièce :", t.pieceType)}{lu("N° de pièce :", t.pieceNumero)}{lu("Valide jusqu'au :", fr(t.pieceExpire))}
            </> : <>
              {lu("Dénomination :", t.nom)}{lu("Forme juridique :", t.formeJuridique)}{lu(t.type === "groupe" ? "N° du registre ou de l'acte :" : "N° du registre :", t.registre)}
              {lu(t.type === "groupe" ? "Adresse :" : "Adresse du siège :", t.adresse)}{lu("Nature de l'activité :", t.activite)}
              {t.type === "groupe" && <>{lu("Nombre d'Homme :", String(t.nbHommes))}{lu("Nombre de Femme :", String(t.nbFemmes))}</>}
            </>}
          </div>
        )}
        {o === 2 && coche("Personne politiquement exposée", t.personneExposee)}
        {o === 3 && (!liees || liees.length === 0 ? <p>Liste vide</p> : (
          <table className="grille"><thead><tr><th scope="col">N° du Client</th><th scope="col">Nom</th></tr></thead>
            <tbody>{liees.filter((x): x is Tiers => !!x).map((x) => <tr key={x.id}><td className="chiffres">{x.numero}</td><td>{nomComplet(x)}</td></tr>)}</tbody></table>
        ))}
        {o === 4 && <p>Liste vide</p>}
        {onglets[o] === "Dirigeant" && (t.dirigeant ? reps([t.dirigeant]) : <p>Liste vide</p>)}
        {onglets[o] === "Signataires" && reps(t.signataires)}
        {onglets[o] === "Membres Groupe" && reps(t.membres)}
      </div>
    </section>
  );
}

/** Contrat d'adhésion imprimé après le visa (p. 52). Ce que la capture coupe (fin de « Héritier désigné ») reste à confirmer. */
function Contrat({ t, ctx }: { t: Tiers; ctx: Ctx }) {
  const inst = ctx.institution.nom;
  const ligne = (a: string, b: string) => <p className="contrat-ligne"><span>{a}</span><strong>{b}</strong></p>;
  return (
    <article className="contrat">
      <h3>DEMANDE D'ADHÉSION</h3>
      <div className="contrat-deux">
        {ligne("Je soussigné(e) :", t.intitule || nomComplet(t))}{ligne("N°", t.numero)}
        {ligne("Profession :", "")}{ligne("Né(e)", fr(t.naissance))}
        {ligne("Fils de :", "")}{ligne("et de", "")}
        {ligne("Adresse :", t.adresse)}{ligne("Téléphone :", t.telephone)}
      </div>
      {ligne("Sollicite mon adhésion à", inst)}
      <p>Je m'engage à respecter ses statuts, ses règlements et les décisions des organes d'administration, à défendre les intérêts de {inst} et à être loyal(e) envers elle.</p>
      <h4>VERSEMENTS INITIAUX</h4>
      <div className="contrat-deux">{ligne("ADHESION", montant(t.premierDepot, deviseDe(ctx, t)))}{ligne("Total", montant(t.premierDepot, deviseDe(ctx, t)))}</div>
      <div className="contrat-deux">{ligne("Fait à", ctx.agence.nom)}{ligne("le", fr(t.dateVisa))}</div>
      <p className="contrat-signature">Signature</p>
      <h4>DÉCISION DU CONSEIL D'ADMINISTRATION</h4>
      <p>Le Conseil d'Administration de {inst}, réuni le {fr(t.dateVisa)}, « approuve, met en instance, rejette » la présente.</p>
      <p>« Rayer les mentions inutiles et préciser les raisons de la mise en instance et du rejet sur la ligne en dessous »</p>
      {ligne("Le nouveau membre est inscrit au registre des membres", t.numero)}
      <h4>HÉRITIER DÉSIGNÉ</h4>
      <p>En cas de décès, j'autorise {inst} à déduire de mes avoirs ce que je lui dois.</p>
      <p>Par ailleurs, je lui ordonne de verser le reste de mes avoirs à</p>
    </article>
  );
}

/** S42 : Client > Visa > Valider client modifié (manuel Microfina++, p. 54) : Numéro du Client*, Intitulé, Catégorie, activer client, Annuler, comptes du membre */
export function ValidationClientModifie() {
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [t, setT] = useState<Tiers | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  if (!ctx) return <Chargement />;
  function activer() {
    if (!t) { setBoite({ type: "erreur", message: "À remplir : numéro du client." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.tiers.activer(t.id); setT(null); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Validation d'un client modifié</h1>
      <section className="bloc pile" aria-label="Validation d'un client modifié">
        <fieldset className="pile cadre-champs">
          <legend>Informations sur le Client</legend>
          <div className="ligne-champ">
            <Champ libelle="Numéro du Client : *">{(p) => <input {...p} className="saisie code" readOnly required value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          <Champ libelle="Intitulé :">{(p) => <input {...p} className="saisie" readOnly value={t ? t.intitule || nomComplet(t) : ""} />}</Champ>
          <Champ libelle="Catégorie :">{(p) => <input {...p} className="saisie" readOnly value={t?.typeClient ?? ""} />}</Champ>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={activer}>activer client</button>
          <button className="bouton secondaire" type="button" onClick={() => setT(null)}>Annuler</button>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Liste des Comptes du membre</legend>
          <table className="grille">
            <thead><tr><th scope="col">N° Compte</th><th scope="col">Produit</th><th scope="col">Agence</th><th scope="col">Membre</th></tr></thead>
            <tbody>
              {(!t || !comptes || comptes.length === 0) && <tr><td colSpan={4}>liste vide</td></tr>}
              {t && comptes?.map((c) => <tr key={c.id}><td className="chiffres">{c.numero}</td><td>{c.intitule} {c.devise}</td><td>{ctx.agence.nom}</td><td>{nomComplet(t)}</td></tr>)}
            </tbody>
          </table>
        </fieldset>
        <Textes sources={["Manuel Microfina++, p. 54 : écran Validation d'un client modifié, Numéro du client obligatoire, bouton activer client",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "ARCHITECTURE P7 : la validation vient d'une autre personne que celle qui a modifié"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (await api.tiers.aRevalider()).filter((x) => [x.numero, x.nom, x.postnom, x.prenom].join(" ").toLowerCase().includes(q))}
          choisir={(x) => { setT(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Libellés des champs comparés dans « informations initiales et actuelles » */
const CHAMPS_SUIVIS: [keyof Tiers, string][] = [["nom", "Nom"], ["postnom", "Post-nom"], ["prenom", "Prénom"], ["sexe", "Sexe"], ["naissance", "Date de naissance"],
  ["lieuNaissance", "Lieu de naissance"], ["adresse", "Adresse"], ["telephone", "Téléphone"], ["pieceType", "Type de pièce"], ["pieceNumero", "N° de pièce"],
  ["pieceExpire", "Valide jusqu'au"], ["typeClient", "Type Client"], ["zone", "Zone"], ["resident", "Résident"], ["preleverAgios", "Prelever Agios"],
  ["calculerInteret", "Calculer intéret"], ["personneExposee", "Personne politiquement exposée"], ["liees", "Personnes liées"]];
const enTexte = (v: unknown) => (typeof v === "boolean" ? (v ? "Oui" : "Non") : Array.isArray(v) ? v.join(", ") : /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? fr(String(v)) : String(v ?? ""));

/** S43 : Client > Consulter client (manuel Microfina++, p. 54) : informations initiales et actuelles du client */
export function InformationsClient() {
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [t, setT] = useState<Tiers | null>(null);
  const [onglet, setOnglet] = useState(0);
  const [recherche, setRecherche] = useState(false);
  const { donnees: detail } = useDonnees(async () => t
    ? { images: await api.tiers.images(t.id), modifications: await api.tiers.modifications(t.id), comptes: await api.tiers.comptes(t.id), parts: await api.tiers.parts(t.id) }
    : null, [t?.id]);
  if (!ctx) return <Chargement />;
  const onglets = ["Renseignements généraux", "Autres renseignements", "Dépôts", "Crédits", "Part sociale"];
  const lu = (libelle: string, v: string) => <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" readOnly value={v} />}</Champ>;
  const initial = detail?.modifications[0]?.avant;
  const ecarts = t && initial ? CHAMPS_SUIVIS.filter(([k]) => enTexte(initial[k]) !== enTexte(t[k])) : [];
  return (
    <>
      <h1>Informations client</h1>
      <section className="bloc pile" aria-label="Client">
        <div className="formulaire">
          <div className="ligne-champ">
            <Champ libelle="N° Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          {lu("Date d'adhésion : *", t ? fr(t.dateVisa) : "")}
        </div>
        <div className="deux-colonnes">
          <fieldset className="cadre-champs formulaire">
            <legend>Renseignements généraux</legend>
            {lu("N° du Client :", t?.numero ?? "")}{lu("Gestionnaire :", "")}
            {lu("N° Manuel:", t?.numeroManuel ?? "")}{lu("Commercial :", "")}
            {lu("N° Matricule :", t?.matricule ?? "")}{lu("Sensibilisateur :", "")}
          </fieldset>
          <fieldset className="cadre-champs">
            <legend>Photo / Signature</legend>
            <div className="photo-signature">
              {detail?.images.photo ? <img src={detail.images.photo} alt="Photo du client" /> : <Silhouette />}
              <div className="cadre-signature">{detail?.images.signature ? <img src={detail.images.signature} alt="Signature du client" /> : null}</div>
            </div>
          </fieldset>
        </div>
      </section>
      <div className="onglets" role="tablist" aria-label="Informations client">
        {onglets.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {t && onglet === 0 && <>
          <div className="formulaire">
            {t.type === "physique" ? <>
              {lu("Nom :", t.nom)}{lu("Post-nom :", t.postnom)}{lu("Prénom :", t.prenom)}{lu("Sexe :", t.sexe === "F" ? "Féminin" : t.sexe === "M" ? "Masculin" : "")}
              {lu("Date de naissance :", fr(t.naissance))}{lu("Lieu de naissance :", t.lieuNaissance)}{lu("Adresse :", t.adresse)}{lu("Téléphone :", t.telephone)}
              {lu("Type de pièce :", t.pieceType)}{lu("N° de pièce :", t.pieceNumero)}{lu("Valide jusqu'au :", fr(t.pieceExpire))}
            </> : <>
              {lu("Dénomination :", t.nom)}{lu("Forme juridique :", t.formeJuridique)}{lu("N° du registre :", t.registre)}{lu("Adresse :", t.adresse)}{lu("Nature de l'activité :", t.activite)}
            </>}
          </div>
          <h2>Informations initiales et actuelles</h2>
          {ecarts.length === 0 ? <p>Aucune modification.</p> : (
            <table className="grille">
              <thead><tr><th scope="col">Champ</th><th scope="col">Initial</th><th scope="col">Actuel</th></tr></thead>
              <tbody>{ecarts.map(([k, l]) => <tr key={k}><td>{l}</td><td>{enTexte(initial![k])}</td><td>{enTexte(t[k])}</td></tr>)}</tbody>
            </table>
          )}
        </>}
        {t && onglet === 1 && (
          <div className="formulaire">
            {lu("Type Client :", t.typeClient)}{lu("Zone :", t.zone)}{lu("Date demande :", fr(t.dateDemande))}{lu("Date Visa :", fr(t.dateVisa))}
            {lu("Résident :", enTexte(t.resident))}{lu("Prelever Agios :", enTexte(t.preleverAgios))}{lu("Calculer intéret :", enTexte(t.calculerInteret))}
            {lu("Personne politiquement exposée :", enTexte(t.personneExposee))}
          </div>
        )}
        {t && onglet === 2 && (
          <table className="grille">
            <thead><tr><th scope="col">N° Compte</th><th scope="col">Produit</th><th scope="col">Solde</th><th scope="col">Bloqué</th><th scope="col">Disponible</th></tr></thead>
            <tbody>
              {(!detail || detail.comptes.length === 0) && <tr><td colSpan={5}>Liste vide</td></tr>}
              {detail?.comptes.map((c) => <tr key={c.id}><td className="chiffres">{c.numero}</td><td>{c.intitule} {c.devise}</td>
                <td className="chiffres">{montant(c.solde, c.devise)}</td><td className="chiffres">{montant(c.bloque, c.devise)}</td><td className="chiffres">{montant(c.disponible, c.devise)}</td></tr>)}
            </tbody>
          </table>
        )}
        {t && onglet === 3 && <p>Liste vide</p>}
        {t && onglet === 4 && (
          <div className="formulaire">
            {lu("Nombre de parts :", String(detail?.parts ?? 0))}{lu("Valeur des parts :", montant((detail?.parts ?? 0) * ctx.valeurPart, "CDF"))}
          </div>
        )}
        {!t && <p className="muet">Rechercher d'abord le client.</p>}
        <Textes sources={["Manuel Microfina++, p. 54 : écran Informations client, recherche par le bouton du champ Numéro client, informations initiales et actuelles",
          "Onglet Crédits : le module crédit n'est pas encore construit"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? api.tiers.rechercher(q) : [])} choisir={(x) => { setT(x); setOnglet(0); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
    </>
  );
}

/** S48 : Client > Résilier un client (manuel Microfina++, p. 57). Loi 002/2002, art. 24 et 27 ; clôture gratuite (Instr. BCC 37). */
export function ResiliationClient() {
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [t, setT] = useState<Tiers | null>(null);
  const [motif, setMotif] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  const { donnees: j } = useDonnees(() => api.journees.courante());
  if (!ctx) return <Chargement />;
  const lu = (libelle: string, v: string) => <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" readOnly value={v} />}</Champ>;
  const resilie = t?.statut === "resilie";
  const jour = resilie ? t!.resilieLe : j?.statut === "ouverte" ? j.date : "";
  const devises = [...new Set((comptes ?? []).map((c) => c.devise))];
  function resilier() {
    if (!t) { setBoite({ type: "erreur", message: "Rechercher d'abord le client." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment résilier ce client ?", oui: async () => {
      try { setT(await api.tiers.resilier(t.id, { motif })); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Résiliation du contrat client</h1>
      <section className="bloc pile a-imprimer" aria-label="Résiliation du contrat client">
        <div className="formulaire">
          <div className="ligne-champ">
            <Champ libelle="N° Client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire sans-impression" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          {lu("Intitulé", t ? t.intitule || nomComplet(t) : "")}{lu("Catégorie", t?.typeClient ?? "")}
        </div>
        <fieldset className="cadre-champs formulaire">
          <legend>Informations générales du client</legend>
          {lu("Secteur d'activité :", "")}{lu("Type d'activité :", "")}
          {lu("Raison sociale :", t ? nomComplet(t) : "")}{lu("RCCM :", t?.registre ?? "")}
          {lu("Autorisation d'Installation :", "")}{lu("Crée le :", "")}
          {lu("Catégorie :", t?.typeClient ?? "")}{lu("Nationalité :", "")}
          {lu("Type de pièce :", t?.pieceType ?? "")}{lu("Numero de pièce :", t?.pieceNumero ?? "")}
          {lu("Etabli à:", t?.pieceLieu ?? "")}{lu("Date dexpiration : *", t ? fr(t.pieceExpire) : "")}
          {t?.type === "groupe" && <>{lu("Type de Groupement :", t.typeClient)}{lu("Nombre d'Homme :", String(t.nbHommes))}{lu("Nombre de Femme :", String(t.nbFemmes))}</>}
        </fieldset>
        <div className="deux-colonnes">
          <div className="formulaire">
            {lu("Resilié le", fr(jour))}
            <Champ libelle="Motif *">{(p) => resilie
              ? <input {...p} className="saisie" readOnly value={t!.motifDepart} />
              : <select {...p} className="saisie" required value={motif} onChange={(e) => setMotif(e.target.value)}><option value=""></option>
                  {ctx.motifsDepart.map((m) => <option key={m}>{m}</option>)}</select>}</Champ>
          </div>
          <fieldset className="pile cadre-champs">
            <legend>Frais de résiliation de contrat</legend>
            <table className="grille"><thead><tr><th scope="col">Libelle Frais</th><th scope="col">Frais</th></tr></thead><tbody><tr><td colSpan={2}>Liste vide</td></tr></tbody></table>
          </fieldset>
        </div>
        <div className="actions-onglets sans-impression">
          <button className="bouton" type="button" disabled={!t || resilie} onClick={resilier}>Résilier</button>
          <button className="bouton secondaire" type="button" disabled={!resilie} onClick={() => window.print()}>Imprimer</button>
        </div>
        <table className="grille">
          <thead>
            <tr><th scope="col" rowSpan={2}>Intitulé</th><th scope="colgroup" colSpan={2}>Solde</th></tr>
            <tr><th scope="col">Débit</th><th scope="col">Crédit</th></tr>
          </thead>
          <tbody>
            {(!t || !comptes || comptes.length === 0) && <tr><td colSpan={3}>Liste vide</td></tr>}
            {t && comptes?.map((c) => <tr key={c.id}><td>{c.intitule} {c.devise}</td><td className="chiffres">{montant(Math.max(0, -c.solde), c.devise)}</td><td className="chiffres">{montant(Math.max(0, c.solde), c.devise)}</td></tr>)}
            {t && devises.map((d) => {
              const l = comptes!.filter((c) => c.devise === d);
              return <tr key={d}><th scope="row">Total {d}</th><td className="chiffres">{montant(l.reduce((s, c) => s + Math.max(0, -c.solde), 0), d)}</td><td className="chiffres">{montant(l.reduce((s, c) => s + Math.max(0, c.solde), 0), d)}</td></tr>;
            })}
          </tbody>
        </table>
        {t && devises.map((d) => <p key={d}>Solde Créditeur {d} : <strong className="chiffres">{montant(comptes!.filter((c) => c.devise === d).reduce((s, c) => s + c.solde, 0), d)}</strong></p>)}
        <Textes sources={["Manuel Microfina++, p. 57 : écran Résiliation du contrat client (N° Client, Informations générales, Résilié le, Motif*, Frais de résiliation, Résilier, Imprimer, soldes)",
          "Loi 002/2002, art. 24 : un membre emprunteur ou endosseur d'un prêt ne peut pas se retirer ; art. 27 : apurement à la perte de la qualité de membre",
          "Instr. BCC 37, annexe : clôture de compte gratuite",
          "Motifs : exemples de la capture « Motif de départ d'un client » (p. 26), paramétrage S18 à construire"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif" || x.statut === "resilie") : [])}
          choisir={(x) => { setT(x); setMotif(""); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Choisir une image (PNG ou JPEG, 300 Ko au plus) et la lire en données */
function lireImage(f: File): Promise<string> {
  return new Promise((ok, ko) => {
    if (!/^image\/(png|jpeg)$/.test(f.type)) { ko(new Error("Image PNG ou JPEG seulement.")); return; }
    const l = new FileReader();
    l.onload = () => { const v = String(l.result); if (v.length > IMAGE_MAX) ko(new Error("Image trop lourde : 300 Ko au plus.")); else ok(v); };
    l.onerror = () => ko(new Error("Lecture de l'image impossible."));
    l.readAsDataURL(f);
  });
}

/** Bouton « Capturer » (p. 58) : photo prise avec la caméra du poste */
function Capture({ ouverte, fermer, prise }: { ouverte: boolean; fermer: () => void; prise: (v: string) => void }) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [flux, setFlux] = useState<MediaStream | null>(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    if (!video || flux) return;
    let annule = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error();
        const f = await navigator.mediaDevices.getUserMedia({ video: true });
        if (annule) { f.getTracks().forEach((t) => t.stop()); return; }
        setFlux(f); video.srcObject = f; await video.play();
      } catch { if (!annule) setErreur("Caméra indisponible sur ce poste : utiliser « Choisir »."); }
    })();
    return () => { annule = true; };
  }, [video, flux]);
  function arreter() { flux?.getTracks().forEach((t) => t.stop()); setFlux(null); setErreur(""); fermer(); }
  function prendre() {
    if (!video) return;
    const c = document.createElement("canvas");
    const l = 320; c.width = l; c.height = Math.round((video.videoHeight || 240) * l / (video.videoWidth || 320));
    c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
    prise(c.toDataURL("image/jpeg", 0.8)); arreter();
  }
  return (
    <Fiche titre="Capturer" ouverte={ouverte} fermer={arreter}>
      <div className="pile">
        {erreur ? <p className="erreur">{erreur}</p> : <video ref={setVideo} className="apercu-video" muted playsInline />}
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" onClick={arreter}>Fermer</button>
          <button className="bouton" type="button" disabled={!!erreur || !flux} onClick={prendre}>Prendre la photo</button>
        </div>
      </div>
    </Fiche>
  );
}

/** S49 : Client > Gestion des photos et signatures (manuel Microfina++, p. 58) */
export function PhotosSignatures() {
  const [t, setT] = useState<Tiers | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [capture, setCapture] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: actuelles } = useDonnees(() => (t ? api.tiers.images(t.id) : Promise.resolve({ photo: null, signature: null })), [t?.id]);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const choisir = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]; e.target.value = "";
    if (fichier) lireImage(fichier).then(f, erreur);
  };
  const annuler = () => { setT(null); setPhoto(null); setSignature(null); };
  const genre = t?.type === "morale" ? "Entreprise" : t?.type === "groupe" ? "Groupe" : "Membre physique";
  const signataires = t?.type === "morale" ? t.signataires : t?.type === "groupe" ? t.membres : [];
  const apercuPhoto = photo ?? actuelles?.photo ?? null, apercuSignature = signature ?? actuelles?.signature ?? null;
  return (
    <>
      <h1>Modification ou Ajout (Photo/Signature) : {genre}</h1>
      <section className="bloc pile" aria-label="Client">
        <div className="formulaire">
          <div className="ligne-champ">
            <Champ libelle="N° client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          <Champ libelle="Intitulé">{(p) => <input {...p} className="saisie" readOnly value={t ? t.intitule || nomComplet(t) : ""} />}</Champ>
          <Champ libelle="Catégorie">{(p) => <input {...p} className="saisie" readOnly value={t?.typeClient ?? ""} />}</Champ>
        </div>
      </section>
      <section className="bloc pile" aria-label="Photo et signature">
        <div className="photos-signataires">
          <div className="pile">
            <fieldset className="pile cadre-champs">
              <legend>Photo client</legend>
              <div className="actions-ligne">
                <button className="bouton secondaire" type="button" disabled={!t} onClick={() => setCapture(true)}>Capturer</button>
                <label className={`bouton secondaire${t ? "" : " inactif"}`}>Choisir<input className="sr-only" type="file" accept="image/png,image/jpeg" disabled={!t} onChange={choisir(setPhoto)} /></label>
              </div>
              <p className="muet">APERCU PHOTO</p>
              <div className="cadre-signature apercu-grand">{apercuPhoto && <img src={apercuPhoto} alt="Aperçu de la photo" />}</div>
            </fieldset>
            <fieldset className="pile cadre-champs">
              <legend>Signature client</legend>
              <div className="actions-ligne">
                <label className={`bouton secondaire${t ? "" : " inactif"}`}>Choisir<input className="sr-only" type="file" accept="image/png,image/jpeg" disabled={!t} onChange={choisir(setSignature)} /></label>
              </div>
              <p className="muet">APERCU SIGNATURE</p>
              <div className="cadre-signature apercu-grand">{apercuSignature && <img src={apercuSignature} alt="Aperçu de la signature" />}</div>
            </fieldset>
          </div>
          <div className="pile">
            <fieldset className="pile cadre-champs">
              <legend>Liste des Signataires</legend>
              <table className="grille">
                <thead><tr><th scope="col">Nom</th><th scope="col">Prénom</th><th scope="col">Actif</th><th scope="col">Adresse</th><th scope="col">Action</th></tr></thead>
                <tbody>
                  {signataires.length === 0 && <tr><td colSpan={5}>Aucun Signataire Renseigné</td></tr>}
                  {signataires.map((r, i) => <tr key={i}><td>{r.nom}</td><td>{r.prenom}</td><td>Oui</td><td></td><td></td></tr>)}
                </tbody>
              </table>
            </fieldset>
            <div className="actions-onglets">
              <button className="bouton" type="button" disabled={!t || (!photo && !signature)} onClick={() => t && setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
                try { await api.tiers.changerSpecimen(t.id, { ...(photo ? { photo } : {}), ...(signature ? { signature } : {}) }); annuler(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
                catch (x) { erreur(x); }
              } })}>Valider les Modifications</button>
              <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
            </div>
          </div>
        </div>
        <Textes sources={["Manuel Microfina++, p. 58 : écran Modification ou Ajout (Photo/Signature), Capturer, Choisir, aperçus, Liste des Signataires, Valider les Modifications, Annuler",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Chaque dépôt garde son auteur et sa date ; le dernier dépôt fait foi au guichet"]} />
      </section>
      <Capture ouverte={capture} fermer={() => setCapture(false)} prise={(v) => (v.length > IMAGE_MAX ? erreur(new Error("Image trop lourde : 300 Ko au plus.")) : setPhoto(v))} />
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut !== "prospect" && x.statut !== "resilie") : [])}
          choisir={(x) => { setT(x); setPhoto(null); setSignature(null); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S50 : Client > Consentement (manuel Microfina++, p. 58). En RDC : Instr. BCC 5, art. 13, consentement écrit à la Centrale des risques. */
export function Consentement() {
  const [t, setT] = useState<Tiers | null>(null);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const vide = { code: "", dateDebut: aujourdhui, dateFin: "", commentaire: "" };
  const [d, setD] = useState(vide);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: liste } = useDonnees(() => (t ? api.tiers.consentements(t.id) : Promise.resolve([])), [t?.id]);
  const info = (libelle: string, v: string) => <div className="info-ligne"><dt>{libelle}</dt><dd>{v}</dd></div>;
  return (
    <>
      <h1>Consentement</h1>
      <section className="bloc pile" aria-label="Consentement">
        <div className="ligne-champ">
          <Champ libelle="N° Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
        </div>
        <div className="deux-colonnes">
          <fieldset className="cadre-champs">
            <legend>Info Membres</legend>
            <dl className="infos">
              {info("Intitulé client :", t ? t.intitule || nomComplet(t) : "")}{info("Téléphone :", t?.telephone ?? "")}{info("Adresse :", t?.adresse ?? "")}
              {info("Sexe :", t?.sexe ?? "")}{info("Email :", t?.email ?? "")}{info("Résident :", t ? (t.resident ? "Oui" : "Non") : "")}
              {info("Type Pièce", t?.pieceType ?? "")}{info("N° de Pièce :", t?.pieceNumero ?? "")}{info("Pays de délivrace :", t?.pieceLieu ?? "")}
              {info("Date de délivrace :", t ? fr(t.pieceDelivreeLe) : "")}{info("Date d'expiration :", t ? fr(t.pieceExpire) : "")}
            </dl>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend className="sr-only">Consentement</legend>
            <Champ libelle="Code *">{(p) => <input {...p} className="saisie code" required autoComplete="off" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} />}</Champ>
            <ChampDate libelle="Date début *" valeur={d.dateDebut} onChange={(v) => setD({ ...d, dateDebut: v })} requis />
            <ChampDate libelle="Date Fin" valeur={d.dateFin} onChange={(v) => setD({ ...d, dateFin: v })} />
            <Champ libelle="Commentaire">{(p) => <textarea {...p} className="saisie" rows={3} value={d.commentaire} onChange={(e) => setD({ ...d, commentaire: e.target.value })} />}</Champ>
            <div className="actions-onglets">
              <button className="bouton" type="button" disabled={!t} onClick={() => t && setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
                try { await api.tiers.creerConsentement(t.id, d); setD(vide); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
                catch (x) { setBoite({ type: "erreur", message: message(x) }); }
              } })}>Enregistrer</button>
              <button className="bouton secondaire" type="button" onClick={() => setD(vide)}>Annuler</button>
            </div>
          </fieldset>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Code</th><th scope="col">Date début</th><th scope="col">Date fin</th><th scope="col">Commentaire</th></tr></thead>
          <tbody>
            {(!liste || liste.length === 0) && <tr><td colSpan={4}>No records found.</td></tr>}
            {liste?.map((c) => <tr key={c.id}><td className="chiffres">{c.code}</td><td className="chiffres">{fr(c.dateDebut)}</td><td className="chiffres">{fr(c.dateFin)}</td><td>{c.commentaire}</td></tr>)}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 58 : écran Consentement (N° Client, Info Membres, Code*, Date début*, Date Fin, Commentaire, Enregistrer, Annuler)",
          "Instr. BCC 5, art. 13 : consentement écrit de l'emprunteur avant de communiquer ses informations à la Centrale des risques (le manuel parle du BIC de l'UEMOA)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut !== "prospect" && x.statut !== "resilie") : [])}
          choisir={(x) => { setT(x); setD(vide); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
