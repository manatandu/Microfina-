import { useState } from "react";
import { api } from "../donnees/api";
import type { Representant, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
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
            <p className="a-confirmer">Frais d'adhésion paramétrés pour le type du client (S16). Colonne « Nbre » : à confirmer. Droit d'adhésion : loi 002/2002, art. 22, 5°.</p>
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

      <Fiche titre="Clients en attente de visa" ouverte={recherche} fermer={() => setRecherche(false)}>
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

/** Recherche par numéro, nom et prénoms ; sélection par double-clic sur la ligne (p. 52 et 53). Entrée fait de même au clavier. */
function RechercheClient({ source, choisir, fermer }: { source: (q: string) => Promise<Tiers[]>; choisir: (t: Tiers) => void; fermer: () => void }) {
  const [q, setQ] = useState("");
  const { donnees: liste = [] } = useDonnees(() => source(q.trim().toLowerCase()), [q]);
  return (
    <div className="pile">
      <Champ libelle="Numéro, Nom et Prénoms :">{(p) => <input {...p} className="saisie" type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />}</Champ>
      <table className="grille">
        <thead><tr><th scope="col">Numéro</th><th scope="col">Nom et Prénoms</th><th scope="col">Date Demande</th></tr></thead>
        <tbody>
          {liste.length === 0 && <tr><td colSpan={3}>Liste vide</td></tr>}
          {liste.map((t) => (
            <tr key={t.id} className="ligne-choix" tabIndex={0} onDoubleClick={() => choisir(t)} onKeyDown={(e) => { if (e.key === "Enter") choisir(t); }}>
              <td className="chiffres">{t.numero}</td><td>{nomComplet(t)}</td><td className="chiffres">{fr(t.dateDemande)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
            <p className="a-confirmer">Colonne « Nombre » : à confirmer. Frais en CDF comme leur paramétrage (S16).</p>
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
      <Fiche titre="Clients visés" ouverte={recherche} fermer={() => setRecherche(false)}>
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
      <p className="a-confirmer sans-impression">À confirmer : la suite du contrat n'est pas visible dans le manuel (p. 52). Profession et filiation ne sont pas encore saisies à l'enrôlement.</p>
    </article>
  );
}
