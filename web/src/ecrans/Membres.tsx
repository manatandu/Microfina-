import { useState, type ReactNode } from "react";
import { enClair } from "../lib/enclair";
import { api, enrolementVide, IMAGE_MAX, NATURES_EFFECTIF, type Images, type NouveauTiers, type RepresentantSaisi } from "../donnees/api";
import type { Beneficiaire, ControleEffectif, Tiers } from "../donnees/types";
import { BlocAdresse } from "../composants/Adresse";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Lecture } from "../composants";
import { lireMontant } from "@design/montant.js";
import { RechercheClient } from "./Visa";

type Ctx = Awaited<ReturnType<typeof api.referentiel.contexte>>;
const nomComplet = (t: { nom: string; postnom: string; prenom: string }) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

// ---------- Parties communes aux enrôlements (S37, S38, S39) ----------

/** Onglets, boutons Suivant, Précédent, Enregistrer et boîtes de dialogue (manuel p. 10, 11, 48 à 51) */
function Enrolement({ titre, onglets, numero, onglet, setOnglet, enregistrer, boite, setBoite, textes, children }: {
  titre: string; onglets: readonly string[]; numero?: string; onglet: number; setOnglet: (i: number) => void; enregistrer: () => void;
  boite: Boite | null; setBoite: (b: Boite | null) => void; textes: string[]; children: ReactNode;
}) {
  const dernier = onglets.length - 1;
  return (
    <>
      <div className="entete-ecran">
        <h2>{titre}</h2>
        {numero && <p className="chiffres">N° {numero}</p>}
      </div>
      <div className="onglets" role="tablist" aria-label={titre}>
        {onglets.map((o, i) => (
          <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>
        ))}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        <h2>{onglets[onglet]}</h2>
        {children}
        <div className="actions-onglets">
          {onglet > 0 && <button className="bouton secondaire" type="button" onClick={() => setOnglet(onglet - 1)}>Précédent</button>}
          {onglet < dernier && <button className="bouton" type="button" onClick={() => setOnglet(onglet + 1)}>Suivant</button>}
          {onglet === dernier && <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>}
        </div>
        <Textes sources={textes} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Onglet « Informations de base » : physique p. 48, entreprise p. 49, groupe p. 50 (mêmes champs pour l'essentiel, colonnes différentes) */
/** A8 (confrontation du 21/11/2026) : objet et nature de la relation, avant d'entrer en relation (loi 22/068, art. 34, al. 3 et art. 47) ;
 * provenance des fonds, exigée pour une personne morale (Instr. BCC 15, art. 17 b) */
function ChampsRelation({ f, maj, morale }: { f: NouveauTiers; maj: (p: Partial<NouveauTiers>) => void; morale: boolean }) {
  return <>
    <Champ libelle="Objet et nature de la relation : *">{(p) => <input {...p} className="saisie" required autoComplete="off" value={f.objetRelation ?? ""} onChange={(e) => maj({ objetRelation: e.target.value })} />}</Champ>
    <Champ libelle={morale ? "Origine des fonds : *" : "Origine des fonds :"}>{(p) => <input {...p} className="saisie" required={morale} autoComplete="off" value={f.origineFonds ?? ""} onChange={(e) => maj({ origineFonds: e.target.value })} />}</Champ>
  </>;
}

function InformationsDeBase({ genre, f, maj, ctx, numero, depot, setDepot, choisirProspect }: {
  genre: "physique" | "entreprise" | "groupe"; f: NouveauTiers; maj: (p: Partial<NouveauTiers>) => void; ctx: Ctx; numero: string; depot: string; setDepot: (v: string) => void;
  choisirProspect?: () => void;
}) {
  const sel = (k: "typeClient" | "zone" | "produitCode") => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLSelectElement>) => maj({ [k]: e.target.value }) });
  const nombre = (k: "nbHommes" | "nbFemmes") => ({ value: String(f[k] || ""), onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim(); if (/^\d{0,6}$/.test(v)) maj({ [k]: Number(v) });   // chiffres seulement
  } });
  const produit = ctx.produits.find((p) => p.code === f.produitCode);
  const physique = genre === "physique", entreprise = genre === "entreprise", groupe = genre === "groupe";
  const types = physique ? ctx.typesClient : entreprise ? ctx.typesEntreprise : ctx.typesGroupe;
  return (
    <div className="deux-colonnes">
      <div className="pile">
        {groupe
          ? <ChampDate libelle="Date demande : *" valeur={f.dateDemande} onChange={(v) => maj({ dateDemande: v })} requis />
          : <div className="ligne-champ">
              <ChampDate libelle="Date demande : *" valeur={f.dateDemande} onChange={(v) => maj({ dateDemande: v })} requis />
              <button className="bouton secondaire" type="button" disabled={!choisirProspect} onClick={choisirProspect}
                title={choisirProspect ? undefined : "Un prospect (S45) est une personne physique"}>Choisir prospect</button>
            </div>}
        <Champ libelle={entreprise ? "N° de l'entreprise :" : groupe ? "N° du groupe :" : "N° du Client :"}>{(p) => <input {...p} className="saisie code" readOnly value={numero} />}</Champ>
        <Champ libelle="N° Manuel :">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.numeroManuel} onChange={(e) => maj({ numeroManuel: e.target.value })} />}</Champ>
        {physique && <Champ libelle="N° Matricule :">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.matricule} onChange={(e) => maj({ matricule: e.target.value })} />}</Champ>}
        <Champ libelle={entreprise ? "Type entreprise : *" : groupe ? "Type de groupe *" : "Type Client : *"}>{(p) => <select {...p} className="saisie" required {...sel("typeClient")}>
          {!physique && <option value=""></option>}{types.map((t) => <option key={t} value={t}>{enClair(t)}</option>)}</select>}</Champ>
        {groupe && <>
          <Champ libelle="Nombre d'Homme :">{(p) => <input {...p} className="saisie code court" inputMode="numeric" autoComplete="off" {...nombre("nbHommes")} />}</Champ>
          <Champ libelle="Nombre de Femme :">{(p) => <input {...p} className="saisie code court" inputMode="numeric" autoComplete="off" {...nombre("nbFemmes")} />}</Champ>
        </>}
        <Champ libelle={entreprise ? "Zone : *" : "Zone :"}>{(p) => <select {...p} className="saisie" required={entreprise} {...sel("zone")}><option value=""></option>
          {ctx.zones.map((z) => <option key={z} value={z}>{enClair(z)}</option>)}</select>}</Champ>
        {physique && <Champ libelle="Sensibilisateur :">{(p) => <select {...p} className="saisie" value={f.sensibilisateurId ?? ""}
          onChange={(e) => maj({ sensibilisateurId: e.target.value ? Number(e.target.value) : null })}><option value=""></option>
          {ctx.sensibilisateurs.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
      </div>
      <div className="pile">
        {!physique && <AgentsClient f={f} maj={maj} ctx={ctx} />}
        {physique ? <>
          <Champ libelle="Gestionnaire :">{(p) => <select {...p} className="saisie" value={f.gestionnaireId ?? ""}
            onChange={(e) => maj({ gestionnaireId: e.target.value ? Number(e.target.value) : null })}><option value=""></option>
            {ctx.gestionnaires.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
          <Champ libelle="Commercial :">{(p) => <select {...p} className="saisie" value={f.commercialId ?? ""}
            onChange={(e) => maj({ commercialId: e.target.value ? Number(e.target.value) : null })}><option value=""></option>
            {ctx.commerciaux.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
        </> : null}
        <Champ libelle="Type de compte à créer *">{(p) => <select {...p} className="saisie" required {...sel("produitCode")}><option value=""></option>
          {ctx.produits.map((x) => <option key={x.code} value={x.code}>{x.libelle} {x.devise}</option>)}</select>}</Champ>
        <Champ libelle={`Premier dépôt :${produit ? ` (${produit.devise})` : ""}`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={depot} onChange={(e) => setDepot(e.target.value)} />}</Champ>
        <ChampsRelation f={f} maj={maj} morale={genre === "entreprise"} />
        <label className="case"><input type="checkbox" checked={f.resident} onChange={(e) => maj({ resident: e.target.checked })} /><span>Résident</span></label>
        <label className="case"><input type="checkbox" checked={f.preleverAgios} onChange={(e) => maj({ preleverAgios: e.target.checked })} /><span>Prelever Agios</span></label>
        <label className="case"><input type="checkbox" checked={f.calculerInteret} onChange={(e) => maj({ calculerInteret: e.target.checked })} /><span>Calculer intéret</span></label>
      </div>
    </div>
  );
}

const LIENS = { liee: "Personne liée", effectif: "Bénéficiaire effectif" } as const;
type Controles = Record<number, ControleEffectif>;
const CONTROLE_VIDE: ControleEffectif = { nature: "", part: "" };
/** Nature et part de chaque bénéficiaire effectif, dans l'ordre de la liste (confrontation du 21/11/2026, E1) */
const versControles = (effectifs: Tiers[], c: Controles) => effectifs.map((t) => c[t.id] ?? CONTROLE_VIDE);
/** Onglet « Personnes Liées » : rechercher un membre, +Ajouter, Retirer (p. 48 à 50). Entreprise : lien Bénéficiaire effectif, une personne physique
 * (registre S38-3 ; Instr. BCC 15, art. 18) */
function PersonnesLiees({ liees, onChange, effectifs, onEffectifs, controles = {}, onControles }: { liees: Tiers[]; onChange: (l: Tiers[]) => void;
  effectifs?: Tiers[]; onEffectifs?: (l: Tiers[]) => void; controles?: Controles; onControles?: (c: Controles) => void }) {
  const ctl = (id: number, p: Partial<ControleEffectif>) => onControles?.({ ...controles, [id]: { ...(controles[id] ?? CONTROLE_VIDE), ...p } });
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<Tiers[]>([]);
  const [choisi, setChoisi] = useState(0);
  const [lien, setLien] = useState<keyof typeof LIENS>("liee");
  const tous = [...liees, ...(effectifs ?? [])];
  const proposes = trouves.filter((t) => lien === "liee" || t.type === "physique");
  async function chercher() {
    const r = (await api.tiers.rechercher(q)).filter((t) => t.statut === "actif" && !tous.some((x) => x.id === t.id));
    setTrouves(r); setChoisi(r.find((t) => lien === "liee" || t.type === "physique")?.id ?? 0);
  }
  function ajouter() {
    const t = proposes.find((x) => x.id === choisi);
    if (!t) return;
    if (lien === "effectif" && effectifs && onEffectifs) onEffectifs([...effectifs, t]); else onChange([...liees, t]);
    setTrouves(trouves.filter((x) => x.id !== t.id)); setChoisi(0);
  }
  const lignes = [...liees.map((t) => ({ t, lien: "liee" as const })), ...(effectifs ?? []).map((t) => ({ t, lien: "effectif" as const }))];
  const retirer = (id: number, l: keyof typeof LIENS) => l === "effectif" ? onEffectifs?.((effectifs ?? []).filter((x) => x.id !== id)) : onChange(liees.filter((x) => x.id !== id));
  return (
    <>
      <div className="formulaire">
        {onEffectifs && <Champ libelle="Lien :">{(p) => <select {...p} className="saisie" value={lien} onChange={(e) => {
          const l = e.target.value as keyof typeof LIENS; setLien(l); setChoisi(trouves.find((t) => l === "liee" || t.type === "physique")?.id ?? 0); }}>
          {Object.entries(LIENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Champ>}
        <Champ libelle="Membre :">{(p) => <input {...p} className="saisie" type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void chercher(); } }} />}</Champ>
        <div className="champ"><span className="libelle-vide" aria-hidden="true">&nbsp;</span>
          <button className="bouton secondaire" type="button" onClick={() => void chercher()}>Rechercher</button></div>
      </div>
      {proposes.length > 0 && (
        <div className="formulaire">
          <Champ libelle="Liste des membres :">{(p) => <select {...p} className="saisie" value={choisi} onChange={(e) => setChoisi(Number(e.target.value))}>
            {proposes.map((t) => <option key={t.id} value={t.id}>{t.numero} {nomComplet(t)}</option>)}</select>}</Champ>
          <div className="champ"><span className="libelle-vide" aria-hidden="true">&nbsp;</span>
            <button className="bouton secondaire" type="button" onClick={ajouter}>+Ajouter</button></div>
        </div>
      )}
      {lignes.length > 0 && (
        <table className="grille">
          <thead><tr><th scope="col">N° du Client</th><th scope="col">Nom</th>{onEffectifs && <><th scope="col">Lien</th><th scope="col">Nature du contrôle</th>
            <th scope="col">Part (%)</th></>}<th scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{lignes.map(({ t, lien: l }) => (
            <tr key={t.id}><td className="chiffres">{t.numero}</td><td>{nomComplet(t)}</td>{onEffectifs && <><td>{LIENS[l]}</td>
              {/* loi 22/068, art. 34 bis, 1° à 3° ; participation de contrôle : plus de 25 % (art. 39, al. 2) */}
              <td>{l === "effectif" && <select className="saisie" aria-label={`Nature du contrôle : ${nomComplet(t)}`} value={controles[t.id]?.nature ?? ""}
                onChange={(e) => ctl(t.id, { nature: e.target.value })}><option value=""></option>{NATURES_EFFECTIF.map((n) => <option key={n} value={n}>{enClair(n)}</option>)}</select>}</td>
              <td>{l === "effectif" && <input className="saisie montant court" inputMode="decimal" autoComplete="off" aria-label={`Part (%) : ${nomComplet(t)}`}
                value={controles[t.id]?.part ?? ""} onChange={(e) => ctl(t.id, { part: e.target.value })} />}</td></>}
              <td><button className="bouton secondaire" type="button" onClick={() => retirer(t.id, l)}>Retirer</button></td></tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}

/** Photo et signature : Choisir, Choisir Photo ou Signature, Charger (p. 48 à 51) */
function ChargementImages({ images, onChange, erreur }: { images: Images; onChange: (i: Images) => void; erreur: (m: string) => void }) {
  const [quoi, setQuoi] = useState<"photo" | "signature">("photo");
  const [fichier, setFichier] = useState<File | null>(null);
  const [cle, setCle] = useState(0);   // vide le champ fichier après chargement
  function charger() {
    if (!fichier) return;
    if (!/^image\/(png|jpeg)$/.test(fichier.type)) { erreur("Image PNG ou JPEG seulement."); return; }
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const v = String(lecteur.result);
      if (v.length > IMAGE_MAX) { erreur("Image trop lourde : 300 Ko au plus."); return; }
      onChange({ ...images, [quoi]: v }); setFichier(null); setCle(cle + 1);
    };
    lecteur.readAsDataURL(fichier);
  }
  return (
    <>
      <div className="formulaire">
        <Champ libelle="Choisir :">{(p) => <select {...p} className="saisie" value={quoi} onChange={(e) => setQuoi(e.target.value as "photo" | "signature")}>
          <option value="photo">Photo</option><option value="signature">Signature</option></select>}</Champ>
        <Champ libelle="Fichier :">{(p) => <div className="ligne-champ"><label className="bouton secondaire">Choisir un fichier<input {...p} key={cle} className="sr-only" type="file" accept="image/png,image/jpeg" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} /></label><span>{fichier?.name ?? ""}</span></div>}</Champ>
        <div className="champ"><span className="libelle-vide" aria-hidden="true">&nbsp;</span>
          <button className="bouton secondaire" type="button" disabled={!fichier} onClick={charger}>Charger</button></div>
      </div>
      <div className="formulaire">
        <figure className="apercu"><figcaption>Photo</figcaption>{images.photo ? <img src={images.photo} alt="Photo chargée" /> : <span className="muet">Aucune</span>}</figure>
        <figure className="apercu"><figcaption>Signature</figcaption>{images.signature ? <img src={images.signature} alt="Signature chargée" /> : <span className="muet">Aucune</span>}</figure>
      </div>
    </>
  );
}

/** Champs d'identité d'un dirigeant, d'un signataire ou d'un membre de groupe, identifié comme un client (loi 22/068, art. 33 ; Instr. BCC 15, art. 13, 14 et 16 ;
 * confrontation du 21/11/2026, E1). Qualité ou pouvoir pour une entreprise (art. 31, al. 3). Personne exposée pour le dirigeant (E3). Adresse unique (registre T41). */
export function ChampsRepresentant({ r, maj, ctx, qualite, exposee }: { r: RepresentantSaisi; maj: (p: Partial<RepresentantSaisi>) => void; ctx: Ctx; qualite?: boolean; exposee?: boolean }) {
  type Cle = "nom" | "postnom" | "prenom" | "pieceNumero" | "lieuNaissance" | "pieceLieu" | "pieceAutorite" | "qualite";
  const t = (k: Cle) => ({ value: r[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => maj({ [k]: e.target.value }) });
  return (
    <div className="deux-colonnes">
      <div className="pile">
        <Champ libelle="Nom : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...t("nom")} />}</Champ>
        <Champ libelle="Post-nom :">{(p) => <input {...p} className="saisie" autoComplete="off" {...t("postnom")} />}</Champ>
        <Champ libelle="Prénom : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...t("prenom")} />}</Champ>
        {qualite && <Champ libelle="Qualité ou pouvoir : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...t("qualite")} />}</Champ>}
        <ChampDate libelle="Date de naissance : *" valeur={r.naissance ?? ""} onChange={(v) => maj({ naissance: v })} requis />
        <Champ libelle="Lieu de naissance : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...t("lieuNaissance")} />}</Champ>
        <Champ libelle="Type de pièce : *">{(p) => <select {...p} className="saisie" required value={r.pieceType} onChange={(e) => maj({ pieceType: e.target.value })}>
          <option value=""></option>{ctx.pieces.map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
        <Champ libelle="N° de pièce : *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...t("pieceNumero")} />}</Champ>
        <Champ libelle="Pays de délivrance :">{(p) => <select {...p} className="saisie" value={r.piecePays ?? ""} onChange={(e) => maj({ piecePays: e.target.value })}>
          <option value=""></option>{ctx.localites.map((x) => <option key={x.pays}>{x.pays}</option>)}</select>}</Champ>
        <Champ libelle="Lieu de délivrance : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...t("pieceLieu")} />}</Champ>
        <ChampDate libelle="Date de délivrance : *" valeur={r.pieceDelivreeLe ?? ""} onChange={(v) => maj({ pieceDelivreeLe: v })} requis />
        <ChampDate libelle="Date d'expiration : *" valeur={r.pieceExpire} onChange={(v) => maj({ pieceExpire: v })} requis />
        <Champ libelle="Autorité de délivrance : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...t("pieceAutorite")} />}</Champ>
        {exposee && <label className="case"><input type="checkbox" checked={!!r.personneExposee} onChange={(e) => maj({ personneExposee: e.target.checked })} /><span>Personne politiquement exposée</span></label>}
      </div>
      <div className="pile">
        <BlocAdresse valeur={r} maj={(a) => { const { adresse: _ecrite, ...reste } = a; maj(reste); }} arbre={ctx.arbreLieux} requis ajouterQuartier={api.adresse.ajouterQuartier} />
      </div>
    </div>
  );
}
const REPRESENTANT_VIDE: RepresentantSaisi = { nom: "", postnom: "", prenom: "", pieceType: "", pieceNumero: "", pieceExpire: "" };

/** Liste avec fiche ouverte par un bouton : signataires d'une entreprise (p. 49), membres d'un groupe (p. 50) ; Retirer comme pour les personnes liées (registre S38-2) */
function ListeRepresentants({ fiche: titre, ajouter, liste, onChange, ctx, qualite, erreur }: {
  fiche: string; ajouter: string; liste: RepresentantSaisi[]; onChange: (l: RepresentantSaisi[]) => void; ctx: Ctx; qualite?: boolean; erreur: (m: string) => void;
}) {
  const [fiche, setFiche] = useState<RepresentantSaisi | null>(null);
  return (
    <>
      <div><button className="bouton secondaire" type="button" onClick={() => setFiche(REPRESENTANT_VIDE)}>{ajouter}</button></div>
      {liste.length > 0 && (
        <table className="grille">
          <thead><tr><th scope="col">Nom</th>{qualite && <th scope="col">Qualité</th>}<th scope="col">Pièce</th><th scope="col">Photo</th><th scope="col">Signature</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{liste.map((r, i) => (
            <tr key={i}><td>{nomComplet(r)}</td>{qualite && <td>{r.qualite}</td>}<td>{r.pieceType} <span className="chiffres">{r.pieceNumero}</span></td>
              <td>{r.photo || r.existant?.photo ? "Oui" : "Non"}</td><td>{r.signature || r.existant?.specimen ? "Oui" : "Non"}</td>
              <td><button className="bouton secondaire" type="button" onClick={() => onChange(liste.filter((_, k) => k !== i))}>Retirer</button></td></tr>
          ))}</tbody>
        </table>
      )}
      <Fiche titre={titre} ouverte={!!fiche} fermer={() => setFiche(null)}>
        {fiche && (
          <div className="pile">
            <ChampsRepresentant r={fiche} maj={(p) => setFiche({ ...fiche, ...p })} ctx={ctx} qualite={qualite} />
            <ChargementImages key={liste.length} images={{ photo: fiche.photo, signature: fiche.signature }} onChange={(i) => setFiche({ ...fiche, ...i })} erreur={erreur} />
            <div className="actions-onglets">
              <button className="bouton secondaire" type="button" onClick={() => setFiche(null)}>Fermer</button>
              <button className="bouton" type="button" onClick={() => {
                if (!fiche.nom.trim() || !fiche.prenom.trim() || !fiche.pieceType || !fiche.pieceNumero.trim()) { erreur("À remplir : nom, prénom, type de pièce, numéro de pièce."); return; }
                onChange([...liste, fiche]); setFiche(REPRESENTANT_VIDE);
              }}>Enregistrer</button>
            </div>
          </div>
        )}
      </Fiche>
    </>
  );
}

function useCommun() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), j: await api.journees.courante() }));
  const [d, setD] = useState<NouveauTiers | null>(null);
  const [onglet, setOnglet] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [cree, setCree] = useState<Tiers | null>(null);
  const [depot, setDepot] = useState("");
  const [liees, setLiees] = useState<Tiers[]>([]);
  const [generation, setGeneration] = useState(0);   // remet à zéro les onglets à état propre après un enregistrement
  const f = d ?? enrolementVide(donnees?.j?.statut === "ouverte" ? donnees.j.date : "");
  const maj = (p: Partial<NouveauTiers>) => setD({ ...f, ...p });
  const erreur = (m: string) => setBoite({ type: "erreur", message: m });
  /** Boîte « Voulez-vous vraiment enregistrer ? », puis succès ou erreur (p. 11) */
  function confirmer(creer: (premierDepot: number) => Promise<Tiers>, vider: () => void) {
    const m = depot.trim() ? lireMontant(depot) : 0;
    if (m === null || m < 0) { erreur("Premier dépôt invalide."); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const t = await creer(m);
        setD(null); setOnglet(0); setDepot(""); setLiees([]); setGeneration(generation + 1); vider();
        setCree(t); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { erreur(message(x)); }
    } });
  }
  return { donnees, d, f, maj, onglet, setOnglet, boite, setBoite, cree, depot, setDepot, liees, setLiees, generation, erreur, confirmer,
    numero: d ? "" : cree?.numero ?? "" };
}

/** Sensibilisateur, Gestionnaire, Commercial : agents d'agence de S33 ; case vide = aucun (registre S33-4, S37-2 ; plan d'allègement, point 1.5) */
function AgentsClient({ f, maj, ctx }: { f: NouveauTiers; maj: (p: Partial<NouveauTiers>) => void; ctx: Ctx }) {
  const liste = (libelle: string, k: "sensibilisateurId" | "gestionnaireId" | "commercialId", agents: { id: number; nom: string }[]) => (
    <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={f[k] ?? ""} onChange={(e) => maj({ [k]: e.target.value ? Number(e.target.value) : null })}>
      <option value=""></option>{agents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>);
  return <>{liste("Sensibilisateur :", "sensibilisateurId", ctx.sensibilisateurs)}{liste("Gestionnaire :", "gestionnaireId", ctx.gestionnaires)}
    {liste("Commercial :", "commercialId", ctx.commerciaux)}</>;
}

type CleTexte = "civilite" | "situationMatrimoniale" | "secteurActivite" | "typeActivite" | "categorie" | "sousTypeClient" | "nationalite" | "profession" | "piecePays"
  | "pere" | "mere" | "pays" | "ville" | "commune" | "quartier" | "rue" | "email" | "bp" | "telephoneFixe";
/** Liste déroulante lue dans le paramétrage (registre S37-2) */
function ChoixListe({ libelle, k, valeurs, f, maj, apres }: { libelle: string; k: CleTexte; valeurs: string[]; f: NouveauTiers; maj: (p: Partial<NouveauTiers>) => void;
  apres?: Partial<NouveauTiers> }) {
  return <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={f[k] ?? ""} onChange={(e) => maj({ [k]: e.target.value, ...apres })}>
    <option value=""></option>{valeurs.map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>;
}

/** Onglet Renseignements généraux (Info Généraux en S46) : identité et pièce. Le manuel ne montre pas ces champs : ceux que d'autres écrans affichent
 * du client (contrat p. 52, résiliation p. 56, situation p. 74) et les mentions de l'Instr. BCC 15, art. 12 et 13 (registre S37-1) */
// Pièce d'identité (décision du porteur du 21/11/2026, registre T42) : trois formes proposées, « Autre » ouvre une case à préciser parmi les autres pièces
// admises par l'Instr. BCC 15, art. 14
const FORMES_PIECE = ["Passeport", "Carte d'identité nationale", "Carte d'électeur"];
const AUTRE_PIECE = "Autre (veuillez préciser)";

function IdentitePhysique({ f, maj, ctx }: { f: NouveauTiers; maj: (p: Partial<NouveauTiers>) => void; ctx: Ctx }) {
  const texte = (k: keyof NouveauTiers) => ({ value: (f[k] as string) ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => maj({ [k]: e.target.value }) });
  const [autre, setAutre] = useState(!!f.pieceType && !FORMES_PIECE.includes(f.pieceType));
  const forme = autre ? AUTRE_PIECE : f.pieceType;
  const autresPieces = ctx.pieces.filter((x) => !FORMES_PIECE.includes(x));
  const pays = ctx.localites.map((x) => x.pays);
  return (
    <div className="deux-colonnes">
      <div className="pile">
        <ChoixListe libelle="Civilité :" k="civilite" valeurs={ctx.listesFiche.civilite ?? []} f={f} maj={maj} />
        <Champ libelle="Nom : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("nom")} />}</Champ>
        <Champ libelle="Post-nom :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("postnom")} />}</Champ>
        <Champ libelle="Prénom : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("prenom")} />}</Champ>
        <Champ libelle="Forme d'identité : *">{(p) => <select {...p} className="saisie" required value={forme} onChange={(e) => {
          const v = e.target.value; setAutre(v === AUTRE_PIECE); maj({ pieceType: v === AUTRE_PIECE ? "" : v });
        }}><option value=""></option>{[...FORMES_PIECE, AUTRE_PIECE].map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
        {autre && <Champ libelle="Précisez la pièce : *">{(p) => <>
          <input {...p} className="saisie" required autoComplete="off" list="pieces-admises" {...texte("pieceType")} />
          <datalist id="pieces-admises">{autresPieces.map((x) => <option key={x} value={x} />)}</datalist></>}</Champ>}
        <Champ libelle="N° de pièce : *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...texte("pieceNumero")} />}</Champ>
        <ChoixListe libelle="Pays de délivrance :" k="piecePays" valeurs={pays} f={f} maj={maj} />
        <Champ libelle="Lieu de délivrance : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("pieceLieu")} />}</Champ>
        <ChampDate libelle="Date de délivrance : *" valeur={f.pieceDelivreeLe} onChange={(v) => maj({ pieceDelivreeLe: v })} requis />
        <ChampDate libelle="Date d'expiration : *" valeur={f.pieceExpire} onChange={(v) => maj({ pieceExpire: v })} requis />
        {/* Instr. BCC 15, art. 13 : la pièce décline « les noms et la qualité de l'Autorité » qui l'a délivrée */}
        <Champ libelle="Autorité de délivrance : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("pieceAutorite")} />}</Champ>
      </div>
      <div className="pile">
        <ChoixListe libelle="Nationalité :" k="nationalite" valeurs={pays} f={f} maj={maj} />
        <Champ libelle="Sexe :">{(p) => <select {...p} className="saisie" {...texte("sexe")}><option value=""></option><option value="F">Féminin</option><option value="M">Masculin</option></select>}</Champ>
        <ChoixListe libelle="Situation matrimoniale :" k="situationMatrimoniale" valeurs={ctx.listesFiche.situationMatrimoniale ?? []} f={f} maj={maj} />
        <Champ libelle="Numéro de téléphone :">{(p) => <input {...p} className="saisie code" type="tel" inputMode="tel" autoComplete="off" {...texte("telephone")} />}</Champ>
        <Champ libelle="Adresse électronique :">{(p) => <input {...p} className="saisie" type="email" autoComplete="off" {...texte("email")} />}</Champ>
        <ChampDate libelle="Date de naissance : *" valeur={f.naissance} onChange={(v) => maj({ naissance: v })} requis />
        <Champ libelle="Lieu de naissance : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("lieuNaissance")} />}</Champ>
        <Champ libelle="Noms du père :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("pere")} />}</Champ>
        <Champ libelle="Noms de la mère :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("mere")} />}</Champ>
        {/* profession : champ libre (décision du porteur du 21/11/2026, registre T42) */}
        <Champ libelle="Profession :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("profession")} />}</Champ>
      </div>
    </div>
  );
}

/** Onglet Autres renseignements (Autre Info en S46) : domicile (S20), coordonnées, activité (S14, S14a, S14c, S14h), personne exposée (registre S37-1, S37-2).
 * Groupe : Catégorie de groupe, S14j (registre S39-1) */
function AutresRenseignements({ f, maj, ctx, categories, physique }: { f: NouveauTiers; maj: (p: Partial<NouveauTiers>) => void; ctx: Ctx; categories?: string[];
  physique?: boolean }) {
  const texte = (k: CleTexte, libelle: string, classe = "saisie") => (
    <Champ libelle={libelle}>{(p) => <input {...p} className={classe} autoComplete="off" value={f[k] ?? ""} onChange={(e) => maj({ [k]: e.target.value })} />}</Champ>);
  return (
    <div className="deux-colonnes">
      <div className="pile">
        {/* Adresse géographique, la même que partout (registre T41) */}
        <BlocAdresse valeur={f} maj={maj} arbre={ctx.arbreLieux} requis ajouterQuartier={api.adresse.ajouterQuartier} />
        {texte("bp", "BP :", "saisie code")}
        {texte("telephoneFixe", "Téléphone fixe :", "saisie code")}
        {!physique && texte("email", "Email :")}
      </div>
      <div className="pile">
        {/* Une seule liste « Activité » ; le secteur s'en déduit (plan d'allègement, point 2.1 ; Instr. BCC 15, art. 13) */}
        <Champ libelle="Activité :">{(p) => <select {...p} className="saisie" value={f.typeActivite ?? ""}
          onChange={(e) => maj({ typeActivite: e.target.value, secteurActivite: ctx.typesActivite.find((t) => t.libelle === e.target.value)?.secteur ?? "" })}>
          <option value=""></option>{ctx.typesActivite.map((t) => <option key={`${t.secteur}-${t.libelle}`} value={t.libelle}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Secteur :">{(p) => <Lecture {...p} value={enClair(f.secteurActivite ?? "")} />}</Champ>
        {/* A7 : activité déclarée, pièce qui habilite à l'exercer (loi 22/068, art. 33, al. 4 ; Instr. BCC 15, art. 13, al. 2) ; sa copie se dépose dans Photos et signatures */}
        {physique && <Champ libelle={f.secteurActivite ? "Pièce d'habilitation professionnelle : *" : "Pièce d'habilitation professionnelle :"}>{(p) =>
          <input {...p} className="saisie" required={!!f.secteurActivite} autoComplete="off" value={f.habilitationReference ?? ""} onChange={(e) => maj({ habilitationReference: e.target.value })} />}</Champ>}
        <ChoixListe libelle="Catégorie :" k="categorie" valeurs={categories ?? ctx.listesFiche.categorie ?? []} f={f} maj={maj} />
        <ChoixListe libelle="Sous type client :" k="sousTypeClient" valeurs={ctx.listesFiche.sousTypeClient ?? []} f={f} maj={maj} />
        <label className="case"><input type="checkbox" checked={f.personneExposee} onChange={(e) => maj({ personneExposee: e.target.checked })} /><span>Personne politiquement exposée</span></label>
      </div>
    </div>
  );
}

const BENEFICIAIRE_VIDE: Beneficiaire = { nom: "", postnom: "", prenom: "", sexe: "", naissance: "", filiation: "", telephone: "" };
/** Onglet Bénéficiaires (p. 48) : +Ajouter ouvre la fiche, Ajouter l'inscrit, Fermer la quitte ; Retirer comme pour les personnes liées (registre S37-3) */
function Beneficiaires({ liste, onChange, filiations }: { liste: Beneficiaire[]; onChange: (l: Beneficiaire[]) => void; filiations: string[] }) {
  const [ouverte, setOuverte] = useState(false);
  const [b, setB] = useState<Beneficiaire>(BENEFICIAIRE_VIDE);
  const [erreur, setErreur] = useState("");
  const texte = (k: "nom" | "postnom" | "prenom" | "telephone", libelle: string) => (
    <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" autoComplete="off" value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} />}</Champ>);
  const ajouter = () => {
    if (!b.nom.trim()) { setErreur("À remplir : nom."); return; }
    onChange([...liste, { ...b, nom: b.nom.trim() }]); setB(BENEFICIAIRE_VIDE); setErreur("");
  };
  return (
    <>
      <div><button className="bouton secondaire" type="button" onClick={() => setOuverte(true)}>+Ajouter</button></div>
      <table className="grille">
        <thead><tr><th scope="col">Nom</th><th scope="col">Prénom</th><th scope="col">Filiation</th><th scope="col">Téléphone</th><th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
        <tbody>
          {liste.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
          {liste.map((x, i) => (
            <tr key={i}><td>{[x.nom, x.postnom].filter(Boolean).join(" ")}</td><td>{x.prenom}</td><td>{x.filiation}</td><td>{x.telephone}</td>
              <td><button className="bouton secondaire" type="button" onClick={() => onChange(liste.filter((_, k) => k !== i))}>Retirer</button></td></tr>
          ))}
        </tbody>
      </table>
      <Fiche titre="Bénéficiaire" ouverte={ouverte} fermer={() => setOuverte(false)}>
        <div className="formulaire">
          {texte("nom", "Nom : *")}{texte("postnom", "Post-nom :")}{texte("prenom", "Prénom :")}
          <Champ libelle="Sexe :">{(p) => <select {...p} className="saisie" value={b.sexe} onChange={(e) => setB({ ...b, sexe: e.target.value as Beneficiaire["sexe"] })}>
            <option value=""></option><option value="F">Féminin</option><option value="M">Masculin</option></select>}</Champ>
          <ChampDate libelle="Date de naissance :" valeur={b.naissance} onChange={(v) => setB({ ...b, naissance: v })} />
          <Champ libelle="Filiation :">{(p) => <select {...p} className="saisie" value={b.filiation} onChange={(e) => setB({ ...b, filiation: e.target.value })}>
            <option value=""></option>{filiations.map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
          {texte("telephone", "Téléphone :")}
        </div>
        {erreur && <p className="ecart ko" role="alert">{erreur}</p>}
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={ajouter}>Ajouter</button>
          <button className="bouton secondaire" type="button" onClick={() => setOuverte(false)}>Fermer</button>
        </div>
      </Fiche>
    </>
  );
}

type Maj = (p: Partial<NouveauTiers>) => void;
const texteDe = (f: NouveauTiers, maj: Maj) => (k: keyof NouveauTiers) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => maj({ [k]: e.target.value }) });

/** Onglet « Renseignements généraux » d'une entreprise (S38, Instr. BCC 15, art. 17), repris à la mise à jour (S46) */
function RenseignementsEntreprise({ f, maj, ctx }: { f: NouveauTiers; maj: Maj; ctx: Ctx }) {
  const texte = texteDe(f, maj);
  return (
    <div className="formulaire">
      <Champ libelle="Dénomination : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("nom")} />}</Champ>
      <Champ libelle="Forme juridique : *">{(p) => <select {...p} className="saisie" required value={f.formeJuridique} onChange={(e) => maj({ formeJuridique: e.target.value })}>
        <option value=""></option>{(ctx.listesFiche.formeJuridique ?? []).map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
      <Champ libelle="N° du registre : *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...texte("registre")} />}</Champ>
      <Champ libelle="Principal centre d'activité :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("centreActivite")} />}</Champ>
    </div>
  );
}

/** Onglet « Renseignements généraux » d'un groupe (S39), repris à la mise à jour (S46) */
function RenseignementsGroupe({ f, maj, ctx }: { f: NouveauTiers; maj: Maj; ctx: Ctx }) {
  const texte = texteDe(f, maj);
  return (
    <div className="formulaire">
      <Champ libelle="Dénomination : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("nom")} />}</Champ>
      <Champ libelle="Forme juridique :">{(p) => <select {...p} className="saisie" value={f.formeJuridique} onChange={(e) => maj({ formeJuridique: e.target.value })}>
        <option value=""></option>{(ctx.listesFiche.formeJuridiqueGroupe ?? []).map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
      <Champ libelle="N° du registre ou de l'acte :">{(p) => <input {...p} className="saisie code" autoComplete="off" {...texte("registre")} />}</Champ>
    </div>
  );
}

// ---------- S37 : Client > Enrôlement > Physique (manuel p. 48 et 49) ----------

const ONGLETS_PHYSIQUE = ["Informations de base", "Renseignements généraux", "Autres renseignements", "Personnes Liées", "Héritiers désignés", "Photo"] as const;

export function EnrolementPhysique() {
  const c = useCommun();
  const [images, setImages] = useState<Images>({});
  const [prospect, setProspect] = useState<Tiers | null>(null);
  const [rechercheProspect, setRechercheProspect] = useState(false);
  if (!c.donnees) return <Chargement />;
  const { ctx } = c.donnees;
  const { f, maj } = c;
  return (
    <Enrolement titre="Enrôlement d'un Client physique" onglets={ONGLETS_PHYSIQUE} numero={c.cree?.numero} onglet={c.onglet} setOnglet={c.setOnglet}
      boite={c.boite} setBoite={c.setBoite}
      enregistrer={() => c.confirmer((m) => api.tiers.creer({ ...f, premierDepot: m, liees: c.liees.map((t) => t.id) }, images, prospect?.id), () => { setImages({}); setProspect(null); })}
      textes={["Manuel Microfina++, p. 48 et 49 : onglets, champs de l'onglet Informations de base, boutons Suivant, Précédent, Enregistrer ; fiche des bénéficiaires (+Ajouter, Ajouter, Fermer)",
        "Champs des onglets non montrés, pris aux écrans qui affichent le client : contrat d'adhésion p. 52 (profession, fils de, et de), résiliation p. 56 (secteur, type d'activité, catégorie, nationalité, pièce, établie à, date d'expiration), rapport p. 58, situation p. 74 (domicile, BP, email)",
        "Listes lues dans le paramétrage : Info de base > Client > Général (S14 à S14n), Localisation (S20), Agence > Paramètre (S33)",
        "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
        "PCCI § 10.1 : lieu de résidence (case Résident)",
        "Instr. BCC 15, art. 12 et 13 : pièce d'identité et ses mentions ; art. 14 : pièces admises",
        "Instr. BCC 15, art. 60 : personne politiquement exposée",
        "ARCHITECTURE P7 : enrôlement et visa par deux personnes"]}>

      {c.onglet === 0 && <InformationsDeBase genre="physique" f={f} maj={maj} ctx={ctx} numero={prospect?.numero ?? c.numero} depot={c.depot} setDepot={c.setDepot}
        choisirProspect={() => setRechercheProspect(true)} />}
      <Fiche titre="Prospects" ouverte={rechercheProspect} fermer={() => setRechercheProspect(false)}>
        <RechercheClient source={async (q) => (await api.tiers.prospects()).filter((x) => [x.numero, x.nom, x.prenom].join(" ").toLowerCase().includes(q))}
          choisir={(p) => { setProspect(p); setRechercheProspect(false);
            maj({ nom: p.nom, prenom: p.prenom, sexe: p.sexe, naissance: p.naissance, lieuNaissance: p.lieuNaissance, telephone: p.telephone,   // registre S37-6
              profession: p.profession, pays: p.pays, ville: p.ville, quartier: p.quartier, rue: p.rue, email: p.email, bp: p.bp, telephoneFixe: p.telephoneFixe,
              sensibilisateurId: p.sensibilisateurId ?? null, commercialId: p.commercialId ?? null }); }}
          fermer={() => setRechercheProspect(false)} />
      </Fiche>

      {c.onglet === 1 && <IdentitePhysique f={f} maj={maj} ctx={ctx} />}

      {c.onglet === 2 && <AutresRenseignements f={f} maj={maj} ctx={ctx} physique />}

      {c.onglet === 3 && <PersonnesLiees key={c.generation} liees={c.liees} onChange={c.setLiees} />}

      {c.onglet === 4 && <Beneficiaires liste={f.beneficiaires ?? []} onChange={(l) => maj({ beneficiaires: l })} filiations={ctx.listesFiche.filiation ?? []} />}

      {c.onglet === 5 && <ChargementImages key={c.generation} images={images} onChange={setImages} erreur={c.erreur} />}
    </Enrolement>
  );
}

// ---------- S38 : Client > Enrôlement > Entreprise (manuel p. 49 et 50) ----------

const ONGLETS_ENTREPRISE = ["Informations de base", "Renseignements généraux", "Autres renseignements", "Dirigeant", "Personnes Liées", "Signataires"] as const;

export function EnrolementEntreprise() {
  const c = useCommun();
  const [avecDirigeant, setAvecDirigeant] = useState(true);   // « par défaut, le champ [Renseigner Dirigeant] est coché » (p. 50)
  const [dirigeant, setDirigeant] = useState<RepresentantSaisi>(REPRESENTANT_VIDE);
  const [signataires, setSignataires] = useState<RepresentantSaisi[]>([]);
  const [effectifs, setEffectifs] = useState<Tiers[]>([]);
  const [controles, setControles] = useState<Controles>({});
  if (!c.donnees) return <Chargement />;
  const { ctx } = c.donnees;
  const { f, maj } = c;
  function vider() { setAvecDirigeant(true); setDirigeant(REPRESENTANT_VIDE); setSignataires([]); setEffectifs([]); setControles({}); }
  return (
    <Enrolement titre="Enregistrement d'une entreprise" onglets={ONGLETS_ENTREPRISE} numero={c.cree?.numero} onglet={c.onglet} setOnglet={c.setOnglet}
      boite={c.boite} setBoite={c.setBoite}
      enregistrer={() => c.confirmer((m) => api.tiers.creerEntreprise({ ...f, premierDepot: m, liees: c.liees.map((t) => t.id), beneficiairesEffectifs: effectifs.map((t) => t.id), controleEffectifs: versControles(effectifs, controles) }, avecDirigeant ? dirigeant : null, signataires), vider)}
      textes={["Manuel Microfina++, p. 49 : onglets, champs de l'onglet Informations de base, Renseigner Dirigeant coché par défaut, personnes liées (+Ajouter, Retirer), fiche des signataires",
        "Onglet Autres renseignements et listes : comme le client physique (S37) ; Forme juridique : Paramétrage > Info de base > Client > Général (S14i) ; Sensibilisateur, Gestionnaire, Commercial : Agence > Paramètre (S33)",
        "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
        "PCCI § 10.1 : lieu de résidence ; § 10.2 : agents économiques (liste provisoire des types d'entreprise)",
        "Instr. BCC 15, art. 17 : dénomination, forme juridique, registre, siège, activité, dirigeants ; art. 18 : bénéficiaire effectif",
        "AUSCGIE, art. 6 : formes des sociétés commerciales",
        "Instr. BCC 15, art. 16 : représentants identifiés comme des clients ; art. 13 et 14 : pièces",
        "Instr. BCC 15, art. 60 : personne politiquement exposée",
        "ARCHITECTURE P7 : enrôlement et visa par deux personnes"]}>

      {c.onglet === 0 && <InformationsDeBase genre="entreprise" f={f} maj={maj} ctx={ctx} numero={c.numero} depot={c.depot} setDepot={c.setDepot} />}

      {c.onglet === 1 && <RenseignementsEntreprise f={f} maj={maj} ctx={ctx} />}

      {c.onglet === 2 && <AutresRenseignements f={f} maj={maj} ctx={ctx} />}

      {c.onglet === 3 && (
        <>
          <label className="case"><input type="checkbox" checked={avecDirigeant} onChange={(e) => setAvecDirigeant(e.target.checked)} /><span>Renseigner Dirigeant</span></label>
          {avecDirigeant && (
            <>
              <ChampsRepresentant r={dirigeant} maj={(p) => setDirigeant({ ...dirigeant, ...p })} ctx={ctx} qualite exposee />
            </>
          )}
        </>
      )}

      {c.onglet === 4 && <PersonnesLiees key={c.generation} liees={c.liees} onChange={c.setLiees} effectifs={effectifs} onEffectifs={setEffectifs} controles={controles} onControles={setControles} />}

      {c.onglet === 5 && <ListeRepresentants fiche="Signataire" ajouter="+Ajouter" liste={signataires} onChange={setSignataires} ctx={ctx} qualite erreur={c.erreur} />}
    </Enrolement>
  );
}

// ---------- S39 : Client > Enrôlement > Groupe (manuel p. 47 et 50) ----------

const ONGLETS_GROUPE = ["Informations de base", "Renseignements généraux", "Membres Groupe", "Autres renseignements", "Personnes Liées", "Photo"] as const;

export function EnrolementGroupe() {
  const c = useCommun();
  const [membres, setMembres] = useState<RepresentantSaisi[]>([]);
  const [images, setImages] = useState<Images>({});
  if (!c.donnees) return <Chargement />;
  const { ctx } = c.donnees;
  const { f, maj } = c;
  return (
    <Enrolement titre="Enregistrement d'un groupe" onglets={ONGLETS_GROUPE} numero={c.cree?.numero} onglet={c.onglet} setOnglet={c.setOnglet}
      boite={c.boite} setBoite={c.setBoite}
      enregistrer={() => c.confirmer((m) => api.tiers.creerGroupe({ ...f, premierDepot: m, liees: c.liees.map((t) => t.id) }, membres, images),
        () => { setMembres([]); setImages({}); })}
      textes={["Manuel Microfina++, p. 47 : groupements, associations, ONG ; p. 50 : onglets, champs de l'onglet Informations de base, membres du groupe (Ajouter, Enregistrer), personnes liées, photo",
        "Onglet Autres renseignements et listes : comme le client physique (S37) ; Type de groupe (S14f), Catégorie de groupe (S14j), Forme juridique du groupe (S14o ; loi 004/2001, art. 2) : Paramétrage > Info de base > Client > Général ; Sensibilisateur, Gestionnaire, Commercial : Agence > Paramètre (S33)",
        "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
        "PCCI § 10.1 : lieu de résidence ; § 10.2 : agents économiques (associations et ONG : institutions sans but lucratif)",
        "Instr. BCC 15, art. 11 et 17 : identification d'une personne morale ou d'une autre entité juridique",
        "Instr. BCC 15, art. 13 et 14 : identité des membres",
        "Instr. BCC 15, art. 60 : personne politiquement exposée",
        "ARCHITECTURE P7 : enrôlement et visa par deux personnes"]}>

      {c.onglet === 0 && <InformationsDeBase genre="groupe" f={f} maj={maj} ctx={ctx} numero={c.numero} depot={c.depot} setDepot={c.setDepot} />}

      {c.onglet === 1 && <RenseignementsGroupe f={f} maj={maj} ctx={ctx} />}

      {c.onglet === 2 && <ListeRepresentants fiche="Membre du groupe" ajouter="Ajouter" liste={membres} onChange={setMembres} ctx={ctx} erreur={c.erreur} />}

      {c.onglet === 3 && <AutresRenseignements f={f} maj={maj} ctx={ctx} categories={ctx.listesFiche.categorieGroupe ?? []} />}

      {c.onglet === 4 && <PersonnesLiees key={c.generation} liees={c.liees} onChange={c.setLiees} />}

      {c.onglet === 5 && <ChargementImages key={c.generation} images={images} onChange={setImages} erreur={c.erreur} />}
    </Enrolement>
  );
}

// ---------- S46 : Client > Mise à jour d'un client (manuel p. 56) ----------

/** Onglets de la capture p. 56 (client physique) ; entreprise et groupe : ceux de leur enrôlement, sans l'onglet Photo, repris par S49 (registre S46-2) */
const ONGLETS_MODIFICATION = {
  physique: ["Info de base", "Info Généraux", "Autre Info", "Personnes Liées", "Héritiers désignés"],
  morale: ["Informations de base", "Renseignements généraux", "Autres renseignements", "Dirigeant", "Personnes Liées", "Signataires"],
  groupe: ["Informations de base", "Renseignements généraux", "Membres Groupe", "Autres renseignements", "Personnes Liées"],
} as const;
const TITRES_MODIFICATION = { physique: "Modification d'un client physique", morale: "Modification d'une entreprise", groupe: "Modification d'un groupe" } as const;
/** Signataire ou membre déjà enregistré : gardé tel quel, avec ses images, ou retiré */
const gardeRepresentant = ({ photo, specimen, ...r }: Tiers["signataires"][number]): RepresentantSaisi => ({ ...r, existant: { photo, specimen } });

/** Modification d'un client : N° Client, Intitulé, Catégorie, onglets, Modifier puis Terminer (registre S46-1). Le client passe « à revalider » (S42). */
export function MiseAJourClient() {
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [t, setT] = useState<Tiers | null>(null);
  const [f, setF] = useState<NouveauTiers | null>(null);
  const [liees, setLiees] = useState<Tiers[]>([]);
  const [effectifs, setEffectifs] = useState<Tiers[]>([]);
  const [controles, setControles] = useState<Controles>({});
  const [avecDirigeant, setAvecDirigeant] = useState(false);
  const [dirigeant, setDirigeant] = useState<RepresentantSaisi>(REPRESENTANT_VIDE);
  const [liste, setListe] = useState<RepresentantSaisi[]>([]);   // signataires ou membres
  const [edition, setEdition] = useState(false);
  const [onglet, setOnglet] = useState(0);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const genre = t?.type ?? "physique";
  const onglets = ONGLETS_MODIFICATION[genre], nom = onglets[onglet] ?? onglets[0];
  const titre = TITRES_MODIFICATION[genre];
  const maj = (p: Partial<NouveauTiers>) => f && setF({ ...f, ...p });
  const sel = (k: "typeClient" | "zone") => ({ value: f?.[k] ?? "", onChange: (e: React.ChangeEvent<HTMLSelectElement>) => maj({ [k]: e.target.value }) });
  const nombre = (k: "nbHommes" | "nbFemmes") => ({ value: String(f?.[k] || ""), onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim(); if (/^\d{0,6}$/.test(v)) maj({ [k]: Number(v) });
  } });
  const lire = async (ids: number[]) => (await Promise.all(ids.map((id) => api.tiers.lire(id)))).filter((y): y is Tiers => !!y);

  async function choisir(x: Tiers) {
    setT(x); setF({ ...x }); setEdition(false); setOnglet(0); setRecherche(false);
    setAvecDirigeant(!!x.dirigeant);
    setDirigeant(x.dirigeant ? (({ photo: _p, specimen: _s, ...r }) => r)(x.dirigeant) : REPRESENTANT_VIDE);
    setListe((x.type === "groupe" ? x.membres : x.signataires).map(gardeRepresentant));
    setLiees(await lire(x.liees)); setEffectifs(await lire(x.beneficiairesEffectifs ?? []));
    setControles(Object.fromEntries((x.beneficiairesEffectifs ?? []).map((id, i) => [id, x.controleEffectifs?.[i] ?? CONTROLE_VIDE])));
  }
  function vider() { setT(null); setF(null); setLiees([]); setEffectifs([]); setControles({}); setListe([]); setEdition(false); setOnglet(0); }
  function terminer() {
    if (!t || !f || !edition) { vider(); return; }
    const d = { ...f, liees: liees.map((x) => x.id), ...(t.type === "morale" ? { beneficiairesEffectifs: effectifs.map((x) => x.id), controleEffectifs: versControles(effectifs, controles) } : {}) };
    const r = t.type === "morale" ? { dirigeant: avecDirigeant ? dirigeant : null, signataires: liste } : t.type === "groupe" ? { membres: liste } : {};
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.tiers.modifier(t.id, d, r); vider(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const erreur = (m: string) => setBoite({ type: "erreur", message: m });
  const types = genre === "morale" ? ctx.typesEntreprise : genre === "groupe" ? ctx.typesGroupe : ctx.typesClient;

  return (
    <>
      <h2>{titre}</h2>
      <section className="bloc pile" aria-label="Client">
        <div className="formulaire">
          <div className="ligne-champ">
            <Champ libelle="N° Client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          <Champ libelle="Intitulé">{(p) => <Lecture {...p} value={t ? t.intitule || nomComplet(t) : ""} />}</Champ>
          <Champ libelle="Nature">{(p) => <Lecture {...p} value={t ? ({ physique: "Personne physique", morale: "Entreprise", groupe: "Groupe" } as const)[t.type] : ""} />}</Champ>
        </div>
      </section>
      <div className="onglets" role="tablist" aria-label={titre}>
        {onglets.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        <h2>{nom === "Info de base" ? "Informations de base" : nom}</h2>
        {f && t && (
          <fieldset className="sans-cadre pile" disabled={!edition}>
            {(nom === "Info de base" || nom === "Informations de base") && (
              <div className="deux-colonnes">
                <div className="pile">
                  <ChampDate libelle="Date demande : *" valeur={f.dateDemande} onChange={(v) => maj({ dateDemande: v })} requis />
                  <Champ libelle={genre === "morale" ? "Type entreprise : *" : genre === "groupe" ? "Type de groupe *" : "Type Client : *"}>{(p) =>
                    <select {...p} className="saisie" required {...sel("typeClient")}>{genre !== "physique" && <option value=""></option>}{types.map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
                  {genre === "groupe" && <>
                    <Champ libelle="Nombre d'Homme :">{(p) => <input {...p} className="saisie code court" inputMode="numeric" autoComplete="off" {...nombre("nbHommes")} />}</Champ>
                    <Champ libelle="Nombre de Femme :">{(p) => <input {...p} className="saisie code court" inputMode="numeric" autoComplete="off" {...nombre("nbFemmes")} />}</Champ>
                  </>}
                  <Champ libelle={genre === "morale" ? "Zone : *" : "Zone :"}>{(p) => <select {...p} className="saisie" required={genre === "morale"} {...sel("zone")}><option value=""></option>
                    {ctx.zones.map((z) => <option key={z} value={z}>{enClair(z)}</option>)}</select>}</Champ>
                  <ChampsRelation f={f} maj={maj} morale={genre === "morale"} />
                </div>
                <div className="pile">
                  <AgentsClient f={f} maj={maj} ctx={ctx} />
                  <label className="case"><input type="checkbox" checked={f.resident} onChange={(e) => maj({ resident: e.target.checked })} /><span>Résident</span></label>
                  <label className="case"><input type="checkbox" checked={f.preleverAgios} onChange={(e) => maj({ preleverAgios: e.target.checked })} /><span>Prelever Agios</span></label>
                  <label className="case"><input type="checkbox" checked={f.calculerInteret} onChange={(e) => maj({ calculerInteret: e.target.checked })} /><span>Calculer intéret</span></label>
                </div>
              </div>
            )}
            {nom === "Info Généraux" && <IdentitePhysique f={f} maj={maj} ctx={ctx} />}
            {nom === "Renseignements généraux" && (genre === "morale" ? <RenseignementsEntreprise f={f} maj={maj} ctx={ctx} /> : <RenseignementsGroupe f={f} maj={maj} ctx={ctx} />)}
            {(nom === "Autre Info" || nom === "Autres renseignements") &&
              <AutresRenseignements f={f} maj={maj} ctx={ctx} categories={genre === "groupe" ? ctx.listesFiche.categorieGroupe ?? [] : undefined} physique={genre === "physique"} />}
            {nom === "Dirigeant" && <>
              <label className="case"><input type="checkbox" checked={avecDirigeant} onChange={(e) => setAvecDirigeant(e.target.checked)} /><span>Renseigner Dirigeant</span></label>
              {avecDirigeant && <ChampsRepresentant r={dirigeant} maj={(p) => setDirigeant({ ...dirigeant, ...p })} ctx={ctx} qualite exposee />}
            </>}
            {nom === "Personnes Liées" && (edition
              ? <PersonnesLiees liees={liees} onChange={setLiees} {...(genre === "morale" ? { effectifs, onEffectifs: setEffectifs, controles, onControles: setControles } : {})} />
              : liees.length + effectifs.length === 0 ? <p>Aucune ligne.</p> : (
                <table className="grille"><thead><tr><th scope="col">N° du Client</th><th scope="col">Nom</th><th scope="col">Lien</th><th scope="col">Nature du contrôle</th>
                  <th scope="col">Part (%)</th></tr></thead>
                  <tbody>{[...liees.map((x) => [x, LIENS.liee] as const), ...effectifs.map((x) => [x, LIENS.effectif] as const)].map(([x, l]) =>
                    <tr key={x.id}><td className="chiffres">{x.numero}</td><td>{nomComplet(x)}</td><td>{l}</td><td>{l === LIENS.effectif ? controles[x.id]?.nature : ""}</td>
                      <td className="chiffres">{l === LIENS.effectif ? controles[x.id]?.part : ""}</td></tr>)}</tbody></table>
              ))}
            {nom === "Héritiers désignés" && <Beneficiaires liste={f.beneficiaires ?? []} onChange={(l) => maj({ beneficiaires: l })} filiations={ctx.listesFiche.filiation ?? []} />}
            {(nom === "Signataires" || nom === "Membres Groupe") &&
              <ListeRepresentants fiche={genre === "groupe" ? "Membre du groupe" : "Signataire"} ajouter={genre === "groupe" ? "Ajouter" : "+Ajouter"} liste={liste} onChange={setListe}
                ctx={ctx} qualite={genre === "morale"} erreur={erreur} />}
          </fieldset>
        )}
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!t || edition} onClick={() => setEdition(true)}>Modifier</button>
          <button className="bouton" type="button" onClick={terminer}>Terminer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 56 : écran Modification d'un client physique, onglets, boutons Modifier et Terminer",
          "Entreprise et groupe : onglets de leur enrôlement (p. 49 et 50), sans l'onglet Photo repris par Photos et signatures (p. 58)",
          "Manuel Microfina++, p. 54 : le client modifié est validé puis réactivé (S42)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 15, art. 10 : identification à refaire quand les éléments du client changent ; art. 12 et 13 : mentions de l'identité, exigées à la mise à jour ; art. 14, 16 à 18 et 60",
          "Instr. BCC 37, annexe : changement d'éléments du dossier du client, gratuit"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif" || x.statut === "modifie_a_revalider") : [])}
          choisir={(x) => void choisir(x)} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
