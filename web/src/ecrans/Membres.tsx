import { useState, type ReactNode } from "react";
import { api, enrolementVide, IMAGE_MAX, type Images, type NouveauTiers, type RepresentantSaisi } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
import { lireMontant } from "@design/montant.js";
import { RechercheClient } from "./Visa";

const INCONNU = "INCONNU";   // seule valeur montrée pour Sensibilisateur, Gestionnaire et Commercial (p. 49 et 50) ; la liste vient de S33
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
        <h1>{titre}</h1>
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

/** Onglet « Informations de base » : physique p. 49, entreprise p. 50, groupe p. 51 (mêmes champs pour l'essentiel, colonnes différentes) */
function InformationsDeBase({ genre, f, maj, ctx, numero, depot, setDepot, choisirProspect }: {
  genre: "physique" | "entreprise" | "groupe"; f: NouveauTiers; maj: (p: Partial<NouveauTiers>) => void; ctx: Ctx; numero: string; depot: string; setDepot: (v: string) => void;
  choisirProspect?: () => void;
}) {
  const sel = (k: "typeClient" | "zone" | "produitCode") => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLSelectElement>) => maj({ [k]: e.target.value }) });
  const nombre = (k: "nbHommes" | "nbFemmes") => ({ value: String(f[k] || ""), onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim(); if (/^\d{0,6}$/.test(v)) maj({ [k]: Number(v) });   // chiffres seulement
  } });
  const produit = ctx.produits.find((p) => p.code === f.produitCode);
  const inconnu = (libelle: string) => <Champ libelle={libelle}>{(p) => <select {...p} className="saisie"><option>{INCONNU}</option></select>}</Champ>;
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
                title={choisirProspect ? undefined : "À confirmer : le prospect (S45) est une personne physique"}>Choisir prospect</button>
            </div>}
        <Champ libelle={entreprise ? "N° de l'entreprise :" : groupe ? "N° du groupe :" : "N° du Client :"}>{(p) => <input {...p} className="saisie code" readOnly value={numero} />}</Champ>
        <Champ libelle="N° Manuel :">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.numeroManuel} onChange={(e) => maj({ numeroManuel: e.target.value })} />}</Champ>
        {physique && <Champ libelle="N° Matricule :">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.matricule} onChange={(e) => maj({ matricule: e.target.value })} />}</Champ>}
        <Champ libelle={entreprise ? "Type entreprise : *" : groupe ? "Type de groupe *" : "Type Client : *"}>{(p) => <select {...p} className="saisie" required {...sel("typeClient")}>
          {!physique && <option value=""></option>}{types.map((t) => <option key={t}>{t}</option>)}</select>}</Champ>
        {groupe && <>
          <Champ libelle="Nombre d'Homme :">{(p) => <input {...p} className="saisie code court" inputMode="numeric" autoComplete="off" {...nombre("nbHommes")} />}</Champ>
          <Champ libelle="Nombre de Femme :">{(p) => <input {...p} className="saisie code court" inputMode="numeric" autoComplete="off" {...nombre("nbFemmes")} />}</Champ>
        </>}
        <Champ libelle={entreprise ? "Zone : *" : "Zone :"}>{(p) => <select {...p} className="saisie" required={entreprise} {...sel("zone")}><option value=""></option>
          {ctx.zones.map((z) => <option key={z}>{z}</option>)}</select>}</Champ>
        {physique && inconnu("Sensibilisateur :")}
      </div>
      <div className="pile">
        {!physique && inconnu("Sensibilisateur :")}
        {inconnu("Gestionnaire :")}
        {inconnu("Commercial :")}
        <Champ libelle="Type de compte à créer *">{(p) => <select {...p} className="saisie" required {...sel("produitCode")}><option value=""></option>
          {ctx.produits.map((x) => <option key={x.code} value={x.code}>{x.libelle} {x.devise}</option>)}</select>}</Champ>
        <Champ libelle={`Premier dépôt :${produit ? ` (${produit.devise})` : ""}`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={depot} onChange={(e) => setDepot(e.target.value)} />}</Champ>
        <label className="case"><input type="checkbox" checked={f.resident} onChange={(e) => maj({ resident: e.target.checked })} /><span>Résident</span></label>
        <label className="case"><input type="checkbox" checked={f.preleverAgios} onChange={(e) => maj({ preleverAgios: e.target.checked })} /><span>Prelever Agios</span></label>
        <label className="case"><input type="checkbox" checked={f.calculerInteret} onChange={(e) => maj({ calculerInteret: e.target.checked })} /><span>Calculer intéret</span></label>
      </div>
    </div>
  );
}

/** Onglet « Personnes Liées » : rechercher un membre, +Ajouter, Retirer (p. 48 à 50) */
function PersonnesLiees({ liees, onChange }: { liees: Tiers[]; onChange: (l: Tiers[]) => void }) {
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<Tiers[]>([]);
  const [choisi, setChoisi] = useState(0);
  async function chercher() {
    const r = (await api.tiers.rechercher(q)).filter((t) => t.statut === "actif" && !liees.some((x) => x.id === t.id));
    setTrouves(r); setChoisi(r[0]?.id ?? 0);
  }
  function ajouter() {
    const t = trouves.find((x) => x.id === choisi);
    if (!t) return;
    onChange([...liees, t]); setTrouves(trouves.filter((x) => x.id !== t.id)); setChoisi(0);
  }
  return (
    <>
      <div className="formulaire">
        <Champ libelle="Membre :">{(p) => <input {...p} className="saisie" type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void chercher(); } }} />}</Champ>
        <div className="champ"><span className="libelle-vide" aria-hidden="true">&nbsp;</span>
          <button className="bouton secondaire" type="button" onClick={() => void chercher()}>Rechercher</button></div>
      </div>
      {trouves.length > 0 && (
        <div className="formulaire">
          <Champ libelle="Liste des membres :">{(p) => <select {...p} className="saisie" value={choisi} onChange={(e) => setChoisi(Number(e.target.value))}>
            {trouves.map((t) => <option key={t.id} value={t.id}>{t.numero} {nomComplet(t)}</option>)}</select>}</Champ>
          <div className="champ"><span className="libelle-vide" aria-hidden="true">&nbsp;</span>
            <button className="bouton secondaire" type="button" onClick={ajouter}>+Ajouter</button></div>
        </div>
      )}
      {liees.length > 0 && (
        <table className="grille">
          <thead><tr><th scope="col">N° du Client</th><th scope="col">Nom</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{liees.map((t) => (
            <tr key={t.id}><td className="chiffres">{t.numero}</td><td>{nomComplet(t)}</td>
              <td><button className="bouton secondaire" type="button" onClick={() => onChange(liees.filter((x) => x.id !== t.id))}>Retirer</button></td></tr>
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
        <Champ libelle="Choisir Photo ou Signature :">{(p) => <input {...p} key={cle} className="saisie" type="file" accept="image/png,image/jpeg" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />}</Champ>
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

/** Champs d'identité d'un dirigeant ou d'un signataire. Le manuel ne les montre pas : Instr. BCC 15, art. 13, 14 et 16. */
function ChampsRepresentant({ r, maj, pieces }: { r: RepresentantSaisi; maj: (p: Partial<RepresentantSaisi>) => void; pieces: string[] }) {
  const t = (k: "nom" | "postnom" | "prenom" | "pieceNumero") => ({ value: r[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => maj({ [k]: e.target.value }) });
  return (
    <div className="formulaire">
      <Champ libelle="Nom : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...t("nom")} />}</Champ>
      <Champ libelle="Post-nom :">{(p) => <input {...p} className="saisie" autoComplete="off" {...t("postnom")} />}</Champ>
      <Champ libelle="Prénom :">{(p) => <input {...p} className="saisie" autoComplete="off" {...t("prenom")} />}</Champ>
      <Champ libelle="Type de pièce : *">{(p) => <select {...p} className="saisie" required value={r.pieceType} onChange={(e) => maj({ pieceType: e.target.value })}>
        <option value=""></option>{pieces.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
      <Champ libelle="N° de pièce : *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...t("pieceNumero")} />}</Champ>
      <ChampDate libelle="Valide jusqu'au :" valeur={r.pieceExpire} onChange={(v) => maj({ pieceExpire: v })} />
    </div>
  );
}
const REPRESENTANT_VIDE: RepresentantSaisi = { nom: "", postnom: "", prenom: "", pieceType: "", pieceNumero: "", pieceExpire: "" };

/** Liste avec fiche ouverte par un bouton : signataires d'une entreprise (p. 50), membres d'un groupe (p. 51) */
function ListeRepresentants({ fiche: titre, ajouter, page, liste, onChange, pieces, erreur }: {
  fiche: string; ajouter: string; page: string; liste: RepresentantSaisi[]; onChange: (l: RepresentantSaisi[]) => void; pieces: string[]; erreur: (m: string) => void;
}) {
  const [fiche, setFiche] = useState<RepresentantSaisi | null>(null);
  return (
    <>
      <div><button className="bouton secondaire" type="button" onClick={() => setFiche(REPRESENTANT_VIDE)}>{ajouter}</button></div>
      {liste.length > 0 && (
        <table className="grille">
          <thead><tr><th scope="col">Nom</th><th scope="col">Pièce</th><th scope="col">Photo</th><th scope="col">Signature</th></tr></thead>
          <tbody>{liste.map((r, i) => (
            <tr key={i}><td>{nomComplet(r)}</td><td>{r.pieceType} <span className="chiffres">{r.pieceNumero}</span></td>
              <td>{r.photo ? "Oui" : "Non"}</td><td>{r.signature ? "Oui" : "Non"}</td></tr>
          ))}</tbody>
        </table>
      )}
      <Fiche titre={titre} ouverte={!!fiche} fermer={() => setFiche(null)}>
        {fiche && (
          <div className="pile">
            <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de la fiche ({page}). Identité selon l'Instr. BCC 15, art. 13 et 14.</p>
            <ChampsRepresentant r={fiche} maj={(p) => setFiche({ ...fiche, ...p })} pieces={pieces} />
            <ChargementImages key={liste.length} images={{ photo: fiche.photo, signature: fiche.signature }} onChange={(i) => setFiche({ ...fiche, ...i })} erreur={erreur} />
            <div className="actions-onglets">
              <button className="bouton secondaire" type="button" onClick={() => setFiche(null)}>Fermer</button>
              <button className="bouton" type="button" onClick={() => {
                if (!fiche.nom.trim() || !fiche.pieceType || !fiche.pieceNumero.trim()) { erreur("À remplir : nom, type de pièce, numéro de pièce."); return; }
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

/** Identité et pièce d'une personne physique (onglet Renseignements généraux / Info Généraux). Le manuel ne montre pas ces champs :
 * Instr. BCC 15, art. 12 à 14 ; sexe et téléphone demandés par le porteur. */
function IdentitePhysique({ f, maj, pieces }: { f: NouveauTiers; maj: (p: Partial<NouveauTiers>) => void; pieces: string[] }) {
  const texte = (k: keyof NouveauTiers) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => maj({ [k]: e.target.value }) });
  const ctx = { pieces };
  return (
    <div className="formulaire">
      <Champ libelle="Nom : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("nom")} />}</Champ>
      <Champ libelle="Post-nom :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("postnom")} />}</Champ>
      <Champ libelle="Prénom :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("prenom")} />}</Champ>
      <Champ libelle="Sexe :">{(p) => <select {...p} className="saisie" {...texte("sexe")}><option value=""></option><option value="F">Féminin</option><option value="M">Masculin</option></select>}</Champ>
      <ChampDate libelle="Date de naissance :" valeur={f.naissance} onChange={(v) => maj({ naissance: v })} />
      <Champ libelle="Lieu de naissance :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("lieuNaissance")} />}</Champ>
      <Champ libelle="Adresse :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("adresse")} />}</Champ>
      <Champ libelle="Téléphone :">{(p) => <input {...p} className="saisie code" type="tel" inputMode="tel" autoComplete="off" {...texte("telephone")} />}</Champ>
      <Champ libelle="Type de pièce : *">{(p) => <select {...p} className="saisie" required {...texte("pieceType")}><option value=""></option>
        {ctx.pieces.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
      <Champ libelle="N° de pièce : *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...texte("pieceNumero")} />}</Champ>
      <ChampDate libelle="Délivrée le :" valeur={f.pieceDelivreeLe} onChange={(v) => maj({ pieceDelivreeLe: v })} />
      <Champ libelle="Lieu de délivrance :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("pieceLieu")} />}</Champ>
      <Champ libelle="Autorité de délivrance :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("pieceAutorite")} />}</Champ>
      <ChampDate libelle="Valide jusqu'au :" valeur={f.pieceExpire} onChange={(v) => maj({ pieceExpire: v })} />
    </div>
  );
}

// ---------- S37 : Client > Enrôlement > Physique (manuel p. 48 et 49) ----------

const ONGLETS_PHYSIQUE = ["Informations de base", "Renseignements généraux", "Autres renseignements", "Personnes Liées", "Bénéficiaires", "Photo"] as const;

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
      textes={["Manuel Microfina++, p. 48 et 49 : onglets, champs de l'onglet Informations de base, boutons Suivant, Précédent, Enregistrer",
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
            maj({ nom: p.nom, prenom: p.prenom, sexe: p.sexe, naissance: p.naissance, lieuNaissance: p.lieuNaissance, telephone: p.telephone }); }}
          fermer={() => setRechercheProspect(false)} />
      </Fiche>

      {c.onglet === 1 && (
        <>
          <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 49). Identité et pièce : Instr. BCC 15, art. 12 à 14. Sexe et téléphone : demandés par le porteur.</p>
          <IdentitePhysique f={f} maj={maj} pieces={ctx.pieces} />
        </>
      )}

      {c.onglet === 2 && (
        <>
          <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 49). Celui-ci est exigé par l'Instr. BCC 15, art. 60.</p>
          <label className="case"><input type="checkbox" checked={f.personneExposee} onChange={(e) => maj({ personneExposee: e.target.checked })} /><span>Personne politiquement exposée</span></label>
        </>
      )}

      {c.onglet === 3 && <PersonnesLiees key={c.generation} liees={c.liees} onChange={c.setLiees} />}

      {c.onglet === 4 && (
        <>
          <p className="a-confirmer">À confirmer : le manuel ne montre pas la fiche d'un bénéficiaire (p. 49). Bouton désactivé jusqu'à ce que ses champs soient connus.</p>
          <div><button className="bouton secondaire" type="button" disabled>+Ajouter</button></div>
        </>
      )}

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
  if (!c.donnees) return <Chargement />;
  const { ctx } = c.donnees;
  const { f, maj } = c;
  const texte = (k: keyof NouveauTiers) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => maj({ [k]: e.target.value }) });
  function vider() { setAvecDirigeant(true); setDirigeant(REPRESENTANT_VIDE); setSignataires([]); }
  return (
    <Enrolement titre="Enregistrement d'une entreprise" onglets={ONGLETS_ENTREPRISE} numero={c.cree?.numero} onglet={c.onglet} setOnglet={c.setOnglet}
      boite={c.boite} setBoite={c.setBoite}
      enregistrer={() => c.confirmer((m) => api.tiers.creerEntreprise({ ...f, premierDepot: m, liees: c.liees.map((t) => t.id) }, avecDirigeant ? dirigeant : null, signataires), vider)}
      textes={["Manuel Microfina++, p. 49 et 50 : onglets, champs de l'onglet Informations de base, Renseigner Dirigeant coché par défaut, fiche des signataires",
        "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
        "PCCI § 10.1 : lieu de résidence ; § 10.2 : agents économiques (liste provisoire des types d'entreprise)",
        "Instr. BCC 15, art. 17 : dénomination, forme juridique, registre, siège, activité, dirigeants",
        "Instr. BCC 15, art. 16 : représentants identifiés comme des clients ; art. 13 et 14 : pièces",
        "Instr. BCC 15, art. 60 : personne politiquement exposée",
        "ARCHITECTURE P7 : enrôlement et visa par deux personnes"]}>

      {c.onglet === 0 && <InformationsDeBase genre="entreprise" f={f} maj={maj} ctx={ctx} numero={c.numero} depot={c.depot} setDepot={c.setDepot} />}

      {c.onglet === 1 && (
        <>
          <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 50). Ceux-ci sont exigés par l'Instr. BCC 15, art. 17.</p>
          <div className="formulaire">
            <Champ libelle="Dénomination : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("nom")} />}</Champ>
            <Champ libelle="Forme juridique : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("formeJuridique")} />}</Champ>
            <Champ libelle="N° du registre : *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...texte("registre")} />}</Champ>
            <Champ libelle="Adresse du siège : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("adresse")} />}</Champ>
            <Champ libelle="Principal centre d'activité :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("centreActivite")} />}</Champ>
            <Champ libelle="Nature de l'activité :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("activite")} />}</Champ>
          </div>
        </>
      )}

      {c.onglet === 2 && (
        <>
          <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 50). Celui-ci est exigé par l'Instr. BCC 15, art. 60.</p>
          <label className="case"><input type="checkbox" checked={f.personneExposee} onChange={(e) => maj({ personneExposee: e.target.checked })} /><span>Personne politiquement exposée</span></label>
        </>
      )}

      {c.onglet === 3 && (
        <>
          <label className="case"><input type="checkbox" checked={avecDirigeant} onChange={(e) => setAvecDirigeant(e.target.checked)} /><span>Renseigner Dirigeant</span></label>
          {avecDirigeant && (
            <>
              <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs du dirigeant (p. 50). Identité selon l'Instr. BCC 15, art. 13, 14 et 17.</p>
              <ChampsRepresentant r={dirigeant} maj={(p) => setDirigeant({ ...dirigeant, ...p })} pieces={ctx.pieces} />
            </>
          )}
        </>
      )}

      {c.onglet === 4 && <PersonnesLiees key={c.generation} liees={c.liees} onChange={c.setLiees} />}

      {c.onglet === 5 && <ListeRepresentants fiche="Signataire" ajouter="+Ajouter" page="p. 50" liste={signataires} onChange={setSignataires} pieces={ctx.pieces} erreur={c.erreur} />}
    </Enrolement>
  );
}

// ---------- S39 : Client > Enrôlement > Groupe (manuel p. 47 et 51) ----------

const ONGLETS_GROUPE = ["Informations de base", "Renseignements généraux", "Membres Groupe", "Autres renseignements", "Personnes Liées", "Photo"] as const;

export function EnrolementGroupe() {
  const c = useCommun();
  const [membres, setMembres] = useState<RepresentantSaisi[]>([]);
  const [images, setImages] = useState<Images>({});
  if (!c.donnees) return <Chargement />;
  const { ctx } = c.donnees;
  const { f, maj } = c;
  const texte = (k: keyof NouveauTiers) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => maj({ [k]: e.target.value }) });
  return (
    <Enrolement titre="Enregistrement d'un groupe" onglets={ONGLETS_GROUPE} numero={c.cree?.numero} onglet={c.onglet} setOnglet={c.setOnglet}
      boite={c.boite} setBoite={c.setBoite}
      enregistrer={() => c.confirmer((m) => api.tiers.creerGroupe({ ...f, premierDepot: m, liees: c.liees.map((t) => t.id) }, membres, images),
        () => { setMembres([]); setImages({}); })}
      textes={["Manuel Microfina++, p. 47 : groupements, associations, ONG ; p. 51 : onglets, champs de l'onglet Informations de base, membres du groupe, photo",
        "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
        "PCCI § 10.1 : lieu de résidence ; § 10.2 : agents économiques (associations et ONG : institutions sans but lucratif)",
        "Instr. BCC 15, art. 11 et 17 : identification d'une personne morale ou d'une autre entité juridique",
        "Instr. BCC 15, art. 13 et 14 : identité des membres",
        "Instr. BCC 15, art. 60 : personne politiquement exposée",
        "ARCHITECTURE P7 : enrôlement et visa par deux personnes"]}>

      {c.onglet === 0 && <InformationsDeBase genre="groupe" f={f} maj={maj} ctx={ctx} numero={c.numero} depot={c.depot} setDepot={c.setDepot} />}

      {c.onglet === 1 && (
        <>
          <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 51). Dénomination et adresse : Instr. BCC 15, art. 17. Forme juridique et registre : facultatifs, un groupement de fait n'en a pas.</p>
          <div className="formulaire">
            <Champ libelle="Dénomination : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("nom")} />}</Champ>
            <Champ libelle="Adresse : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("adresse")} />}</Champ>
            <Champ libelle="Forme juridique :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("formeJuridique")} />}</Champ>
            <Champ libelle="N° du registre ou de l'acte :">{(p) => <input {...p} className="saisie code" autoComplete="off" {...texte("registre")} />}</Champ>
            <Champ libelle="Nature de l'activité :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("activite")} />}</Champ>
          </div>
        </>
      )}

      {c.onglet === 2 && <ListeRepresentants fiche="Membre du groupe" ajouter="Ajouter" page="p. 51" liste={membres} onChange={setMembres} pieces={ctx.pieces} erreur={c.erreur} />}

      {c.onglet === 3 && (
        <>
          <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 51). Celui-ci est exigé par l'Instr. BCC 15, art. 60.</p>
          <label className="case"><input type="checkbox" checked={f.personneExposee} onChange={(e) => maj({ personneExposee: e.target.checked })} /><span>Personne politiquement exposée</span></label>
        </>
      )}

      {c.onglet === 4 && <PersonnesLiees key={c.generation} liees={c.liees} onChange={c.setLiees} />}

      {c.onglet === 5 && <ChargementImages key={c.generation} images={images} onChange={setImages} erreur={c.erreur} />}
    </Enrolement>
  );
}

// ---------- S46 : Client > Mise à jour d'un client (manuel p. 56) ----------

const ONGLETS_MODIFICATION = ["Info de base", "Info Généraux", "Autre Info", "Personnes Liées", "Bénéficiaires"] as const;

/** Modification d'un client physique : N° Client, Intitulé, Catégorie, cinq onglets, Modifier puis Terminer. Le client passe « à revalider » (S42). */
export function MiseAJourClient() {
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [t, setT] = useState<Tiers | null>(null);
  const [f, setF] = useState<NouveauTiers | null>(null);
  const [liees, setLiees] = useState<Tiers[]>([]);
  const [edition, setEdition] = useState(false);
  const [onglet, setOnglet] = useState(0);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const maj = (p: Partial<NouveauTiers>) => f && setF({ ...f, ...p });
  const sel = (k: "typeClient" | "zone") => ({ value: f?.[k] ?? "", onChange: (e: React.ChangeEvent<HTMLSelectElement>) => maj({ [k]: e.target.value }) });
  const inconnu = (libelle: string) => <Champ libelle={libelle}>{(p) => <select {...p} className="saisie"><option>{INCONNU}</option></select>}</Champ>;

  async function choisir(x: Tiers) {
    setT(x); setF({ ...x }); setEdition(false); setOnglet(0); setRecherche(false);
    setLiees((await Promise.all(x.liees.map((id) => api.tiers.lire(id)))).filter((y): y is Tiers => !!y));
  }
  function vider() { setT(null); setF(null); setLiees([]); setEdition(false); setOnglet(0); }
  function terminer() {
    if (!t || !f || !edition) { vider(); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.tiers.modifier(t.id, { ...f, liees: liees.map((x) => x.id) }); vider(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <h1>Modification d'un client physique</h1>
      <section className="bloc pile" aria-label="Client">
        <div className="formulaire">
          <div className="ligne-champ">
            <Champ libelle="N° Client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          <Champ libelle="Intitulé">{(p) => <input {...p} className="saisie" readOnly value={t ? t.intitule || nomComplet(t) : ""} />}</Champ>
          <Champ libelle="Catégorie">{(p) => <input {...p} className="saisie" readOnly value={t ? t.typeClient : ""} />}</Champ>
        </div>
      </section>
      <div className="onglets" role="tablist" aria-label="Modification d'un client physique">
        {ONGLETS_MODIFICATION.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        <h2>{onglet === 0 ? "Informations de base" : ONGLETS_MODIFICATION[onglet]}</h2>
        {f && (
          <fieldset className="sans-cadre pile" disabled={!edition}>
            {onglet === 0 && (
              <div className="deux-colonnes">
                <div className="pile">
                  <ChampDate libelle="Date demande : *" valeur={f.dateDemande} onChange={(v) => maj({ dateDemande: v })} requis />
                  <Champ libelle="Type Client : *">{(p) => <select {...p} className="saisie" required {...sel("typeClient")}>{ctx.typesClient.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
                  <Champ libelle="Zone :">{(p) => <select {...p} className="saisie" {...sel("zone")}><option value=""></option>{ctx.zones.map((z) => <option key={z}>{z}</option>)}</select>}</Champ>
                </div>
                <div className="pile">
                  {inconnu("Sensibilisateur :")}{inconnu("Gestionnaire :")}{inconnu("Commercial :")}
                  <label className="case"><input type="checkbox" checked={f.resident} onChange={(e) => maj({ resident: e.target.checked })} /><span>Résident</span></label>
                  <label className="case"><input type="checkbox" checked={f.preleverAgios} onChange={(e) => maj({ preleverAgios: e.target.checked })} /><span>Prelever Agios</span></label>
                  <label className="case"><input type="checkbox" checked={f.calculerInteret} onChange={(e) => maj({ calculerInteret: e.target.checked })} /><span>Calculer intéret</span></label>
                </div>
              </div>
            )}
            {onglet === 1 && <>
              <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 56). Mêmes champs qu'à l'enrôlement.</p>
              <IdentitePhysique f={f} maj={maj} pieces={ctx.pieces} />
            </>}
            {onglet === 2 && <>
              <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 56). Celui-ci est exigé par l'Instr. BCC 15, art. 60.</p>
              <label className="case"><input type="checkbox" checked={f.personneExposee} onChange={(e) => maj({ personneExposee: e.target.checked })} /><span>Personne politiquement exposée</span></label>
            </>}
            {onglet === 3 && (edition
              ? <PersonnesLiees liees={liees} onChange={setLiees} />
              : liees.length === 0 ? <p>Liste vide</p> : (
                <table className="grille"><thead><tr><th scope="col">N° du Client</th><th scope="col">Nom</th></tr></thead>
                  <tbody>{liees.map((x) => <tr key={x.id}><td className="chiffres">{x.numero}</td><td>{nomComplet(x)}</td></tr>)}</tbody></table>
              ))}
            {onglet === 4 && <p>Liste vide</p>}
          </fieldset>
        )}
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!t || edition} onClick={() => setEdition(true)}>Modifier</button>
          <button className="bouton" type="button" onClick={terminer}>Terminer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 56 : écran Modification d'un client physique, onglets, boutons Modifier et Terminer",
          "Manuel Microfina++, p. 54 : le client modifié est validé puis réactivé (S42)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 15, art. 10 : identification à refaire quand les éléments du client changent ; art. 12 à 14 et 60",
          "Instr. BCC 37, annexe : changement d'éléments du dossier du client, gratuit"]} />
      </section>
      <Fiche titre="Clients" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.type === "physique" && x.statut !== "a_viser") : [])}
          choisir={(x) => void choisir(x)} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
