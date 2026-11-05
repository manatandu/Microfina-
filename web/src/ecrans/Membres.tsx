import { useState } from "react";
import { api, enrolementVide, IMAGE_MAX, type Images, type NouveauTiers } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite } from "../composants";
import { lireMontant } from "@design/montant.js";

/** Onglets de l'enrôlement d'un client physique, dans l'ordre du manuel Microfina++ (p. 49) */
const ONGLETS = ["Informations de base", "Renseignements généraux", "Autres renseignements", "Personnes Liées", "Bénéficiaires", "Photo"] as const;
const INCONNU = "INCONNU";   // seule valeur montrée pour Sensibilisateur, Gestionnaire et Commercial (p. 49) ; la liste vient de S33

/** S37 : Client > Enrôlement > Physique (manuel Microfina++, p. 48 et 49). Le visa (S40) vient d'une autre personne. */
export function Enrolement() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), j: await api.journees.courante() }));
  const [d, setD] = useState<NouveauTiers | null>(null);
  const [onglet, setOnglet] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [cree, setCree] = useState<Tiers | null>(null);
  const [depot, setDepot] = useState("");
  // Personnes liées
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<Tiers[]>([]);
  const [choisi, setChoisi] = useState(0);
  const [liees, setLiees] = useState<Tiers[]>([]);
  // Photo
  const [quoi, setQuoi] = useState<"photo" | "signature">("photo");
  const [fichier, setFichier] = useState<File | null>(null);
  const [images, setImages] = useState<Images>({});

  if (!donnees) return <Chargement />;
  const { ctx, j } = donnees;
  const f = d ?? enrolementVide(j?.statut === "ouverte" ? j.date : "");
  const maj = (p: Partial<NouveauTiers>) => setD({ ...f, ...p });
  const texte = (k: keyof NouveauTiers) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => maj({ [k]: e.target.value }) });
  const produit = ctx.produits.find((p) => p.code === f.produitCode);

  function vider() {
    setD(null); setOnglet(0); setDepot(""); setQ(""); setTrouves([]); setChoisi(0); setLiees([]); setFichier(null); setImages({});
  }
  async function chercher() {
    const r = (await api.tiers.rechercher(q)).filter((t) => t.statut === "actif" && !f.liees.includes(t.id));
    setTrouves(r); setChoisi(r[0]?.id ?? 0);
  }
  function ajouterLiee() {
    const t = trouves.find((x) => x.id === choisi);
    if (!t) return;
    maj({ liees: [...f.liees, t.id] }); setLiees([...liees, t]); setTrouves(trouves.filter((x) => x.id !== t.id)); setChoisi(0);
  }
  function retirerLiee(id: number) { maj({ liees: f.liees.filter((x) => x !== id) }); setLiees(liees.filter((x) => x.id !== id)); }
  function charger() {
    if (!fichier) return;
    if (!/^image\/(png|jpeg)$/.test(fichier.type)) { setBoite({ type: "erreur", message: "Image PNG ou JPEG seulement." }); return; }
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const v = String(lecteur.result);
      if (v.length > IMAGE_MAX) { setBoite({ type: "erreur", message: "Image trop lourde : 300 Ko au plus." }); return; }
      setImages({ ...images, [quoi]: v }); setFichier(null);
    };
    lecteur.readAsDataURL(fichier);
  }
  function enregistrer() {
    const m = depot.trim() ? lireMontant(depot) : 0;
    if (m === null || m < 0) { setBoite({ type: "erreur", message: "Premier dépôt invalide." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const t = await api.tiers.creer({ ...f, premierDepot: m }, images);
        vider(); setCree(t); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <div className="entete-ecran">
        <h1>Enrôlement d'un Client physique</h1>
        {cree && <p className="chiffres">N° {cree.numero}</p>}
      </div>
      <div className="onglets" role="tablist" aria-label="Enrôlement">
        {ONGLETS.map((o, i) => (
          <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>
        ))}
      </div>

      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        <h2>{ONGLETS[onglet]}</h2>

        {onglet === 0 && (
          <div className="deux-colonnes">
            <div className="pile">
              <div className="ligne-champ">
                <ChampDate libelle="Date demande : *" valeur={f.dateDemande} onChange={(v) => maj({ dateDemande: v })} requis />
                <button className="bouton secondaire" type="button" disabled title="Prospects : fonction S45, pas encore construite">Choisir prospect</button>
              </div>
              <Champ libelle="N° du Client :">{(p) => <input {...p} className="saisie code" readOnly value={d ? "" : cree?.numero ?? ""} />}</Champ>
              <Champ libelle="N° Manuel :">{(p) => <input {...p} className="saisie code" autoComplete="off" {...texte("numeroManuel")} />}</Champ>
              <Champ libelle="N° Matricule :">{(p) => <input {...p} className="saisie code" autoComplete="off" {...texte("matricule")} />}</Champ>
              <Champ libelle="Type Client : *">{(p) => <select {...p} className="saisie" required {...texte("typeClient")}>{ctx.typesClient.map((t) => <option key={t}>{t}</option>)}</select>}</Champ>
              <Champ libelle="Zone :">{(p) => <select {...p} className="saisie" {...texte("zone")}><option value=""></option>{ctx.zones.map((z) => <option key={z}>{z}</option>)}</select>}</Champ>
              <Champ libelle="Sensibilisateur :">{(p) => <select {...p} className="saisie"><option>{INCONNU}</option></select>}</Champ>
            </div>
            <div className="pile">
              <Champ libelle="Gestionnaire :">{(p) => <select {...p} className="saisie"><option>{INCONNU}</option></select>}</Champ>
              <Champ libelle="Commercial :">{(p) => <select {...p} className="saisie"><option>{INCONNU}</option></select>}</Champ>
              <Champ libelle="Type de compte à créer *">{(p) => <select {...p} className="saisie" required {...texte("produitCode")}><option value=""></option>
                {ctx.produits.map((x) => <option key={x.code} value={x.code}>{x.libelle} {x.devise}</option>)}</select>}</Champ>
              <Champ libelle={`Premier dépôt :${produit ? ` (${produit.devise})` : ""}`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={depot} onChange={(e) => setDepot(e.target.value)} />}</Champ>
              <label className="case"><input type="checkbox" checked={f.resident} onChange={(e) => maj({ resident: e.target.checked })} /><span>Résident</span></label>
              <label className="case"><input type="checkbox" checked={f.preleverAgios} onChange={(e) => maj({ preleverAgios: e.target.checked })} /><span>Prelever Agios</span></label>
              <label className="case"><input type="checkbox" checked={f.calculerInteret} onChange={(e) => maj({ calculerInteret: e.target.checked })} /><span>Calculer intéret</span></label>
            </div>
          </div>
        )}

        {onglet === 1 && (
          <>
            <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 49). Identité et pièce : Instr. BCC 15, art. 12 et 13. Sexe et téléphone : demandés par le porteur.</p>
            <div className="formulaire">
              <Champ libelle="Nom : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("nom")} />}</Champ>
              <Champ libelle="Post-nom :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("postnom")} />}</Champ>
              <Champ libelle="Prénom :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("prenom")} />}</Champ>
              <Champ libelle="Sexe :">{(p) => <select {...p} className="saisie" {...texte("sexe")}><option value=""></option><option value="F">Féminin</option><option value="M">Masculin</option></select>}</Champ>
              <ChampDate libelle="Date de naissance :" valeur={f.naissance} onChange={(v) => maj({ naissance: v })} />
              <Champ libelle="Lieu de naissance :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("lieuNaissance")} />}</Champ>
              <Champ libelle="Adresse :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("adresse")} />}</Champ>
              <Champ libelle="Téléphone :">{(p) => <input {...p} className="saisie code" type="tel" inputMode="tel" autoComplete="off" {...texte("telephone")} />}</Champ>
              <Champ libelle="Type de pièce : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("pieceType")} />}</Champ>
              <Champ libelle="N° de pièce : *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...texte("pieceNumero")} />}</Champ>
              <ChampDate libelle="Délivrée le :" valeur={f.pieceDelivreeLe} onChange={(v) => maj({ pieceDelivreeLe: v })} />
              <Champ libelle="Lieu de délivrance :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("pieceLieu")} />}</Champ>
              <Champ libelle="Autorité de délivrance :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("pieceAutorite")} />}</Champ>
              <ChampDate libelle="Valide jusqu'au :" valeur={f.pieceExpire} onChange={(v) => maj({ pieceExpire: v })} />
            </div>
          </>
        )}

        {onglet === 2 && (
          <>
            <p className="a-confirmer">À confirmer : le manuel ne montre pas les champs de cet onglet (p. 49). Celui-ci est exigé par l'Instr. BCC 15, art. 60.</p>
            <label className="case"><input type="checkbox" checked={f.personneExposee} onChange={(e) => maj({ personneExposee: e.target.checked })} /><span>Personne politiquement exposée</span></label>
          </>
        )}

        {onglet === 3 && (
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
                  {trouves.map((t) => <option key={t.id} value={t.id}>{t.numero} {[t.nom, t.postnom, t.prenom].filter(Boolean).join(" ")}</option>)}</select>}</Champ>
                <div className="champ"><span className="libelle-vide" aria-hidden="true">&nbsp;</span>
                  <button className="bouton secondaire" type="button" onClick={ajouterLiee}>+Ajouter</button></div>
              </div>
            )}
            {liees.length > 0 && (
              <table className="grille">
                <thead><tr><th scope="col">N° du Client</th><th scope="col">Nom</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
                <tbody>{liees.map((t) => (
                  <tr key={t.id}><td className="chiffres">{t.numero}</td><td>{[t.nom, t.postnom, t.prenom].filter(Boolean).join(" ")}</td>
                    <td><button className="bouton secondaire" type="button" onClick={() => retirerLiee(t.id)}>Retirer</button></td></tr>
                ))}</tbody>
              </table>
            )}
          </>
        )}

        {onglet === 4 && (
          <>
            <p className="a-confirmer">À confirmer : le manuel ne montre pas la fiche d'un bénéficiaire (p. 49). Bouton désactivé jusqu'à ce que ses champs soient connus.</p>
            <div><button className="bouton secondaire" type="button" disabled>+Ajouter</button></div>
          </>
        )}

        {onglet === 5 && (
          <>
            <div className="formulaire">
              <Champ libelle="Choisir :">{(p) => <select {...p} className="saisie" value={quoi} onChange={(e) => setQuoi(e.target.value as "photo" | "signature")}>
                <option value="photo">Photo</option><option value="signature">Signature</option></select>}</Champ>
              <Champ libelle="Choisir Photo ou Signature :">{(p) => <input {...p} className="saisie" type="file" accept="image/png,image/jpeg" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />}</Champ>
              <div className="champ"><span className="libelle-vide" aria-hidden="true">&nbsp;</span>
                <button className="bouton secondaire" type="button" disabled={!fichier} onClick={charger}>Charger</button></div>
            </div>
            <div className="formulaire">
              <figure className="apercu"><figcaption>Photo</figcaption>{images.photo ? <img src={images.photo} alt="Photo chargée" /> : <span className="muet">Aucune</span>}</figure>
              <figure className="apercu"><figcaption>Signature</figcaption>{images.signature ? <img src={images.signature} alt="Signature chargée" /> : <span className="muet">Aucune</span>}</figure>
            </div>
          </>
        )}

        <div className="actions-onglets">
          {onglet > 0 && <button className="bouton secondaire" type="button" onClick={() => setOnglet(onglet - 1)}>Précédent</button>}
          {onglet < ONGLETS.length - 1 && <button className="bouton" type="button" onClick={() => setOnglet(onglet + 1)}>Suivant</button>}
          {onglet === ONGLETS.length - 1 && <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>}
        </div>
        <Textes sources={["Manuel Microfina++, p. 48 et 49 : onglets, champs de l'onglet Informations de base, boutons Suivant, Précédent, Enregistrer",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "PCCI § 10.1 : lieu de résidence (case Résident)",
          "Instr. BCC 15, art. 12 et 13 : pièce d'identité et ses mentions",
          "Instr. BCC 15, art. 60 : personne politiquement exposée",
          "ARCHITECTURE P7 : enrôlement et visa par deux personnes"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
