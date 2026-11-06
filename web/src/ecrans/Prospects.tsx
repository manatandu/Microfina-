import { useState } from "react";
import { api, type Prospect } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite } from "../composants";

const INCONNU = "INCONNU";   // Sensibilisateur et Commercial : liste de S33, pas encore construite
const VIDE: Prospect = { nom: "", prenom: "", naissance: "", lieuNaissance: "", sexe: "", profession: "", pays: "", ville: "", quartier: "", rue: "", email: "", bp: "", telephoneFixe: "", telephone: "" };
const fr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** S45 : Client > Nouveau prospect (manuel Microfina++, p. 55) */
export function NouveauProspect() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), liste: await api.tiers.prospects() }));
  const [d, setD] = useState<Prospect>(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { ctx, liste } = donnees;
  const maj = (p: Partial<Prospect>) => setD({ ...d, ...p });
  const texte = (k: keyof Prospect) => ({ value: d[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => maj({ [k]: e.target.value }) });
  const pays = ctx.localites.find((p) => p.pays === d.pays);
  const ville = pays?.villes.find((v) => v.ville === d.ville);
  const annuler = () => { setD(VIDE); setChoisi(null); };
  const confirmer = (faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await faire(); annuler(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const inconnu = (libelle: string) => <Champ libelle={libelle}>{(p) => <select {...p} className="saisie"><option>{INCONNU}</option></select>}</Champ>;
  return (
    <>
      <h1>Enregistrement d'un prospect</h1>
      <section className="bloc pile" aria-label="Prospect">
        <div className="deux-colonnes">
          <div className="pile">
            {inconnu("Sensibilisateur")}{inconnu("Commercial")}
            <Champ libelle="Nom : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("nom")} />}</Champ>
            <Champ libelle="Prenoms : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("prenom")} />}</Champ>
            <ChampDate libelle="Date naissance : *" valeur={d.naissance} onChange={(v) => maj({ naissance: v })} requis />
            <Champ libelle="à : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...texte("lieuNaissance")} />}</Champ>
            <Champ libelle="Sexe : *">{(p) => <select {...p} className="saisie court" required {...texte("sexe")}><option value=""></option><option value="M">M</option><option value="F">F</option></select>}</Champ>
            <Champ libelle="Proffession :">{(p) => <select {...p} className="saisie" {...texte("profession")}><option value=""></option>{ctx.professions.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
          </div>
          <div className="pile">
            <Champ libelle="Pays : *">{(p) => <select {...p} className="saisie" required value={d.pays} onChange={(e) => maj({ pays: e.target.value, ville: "", quartier: "" })}>
              <option value=""></option>{ctx.localites.map((x) => <option key={x.pays}>{x.pays}</option>)}</select>}</Champ>
            <Champ libelle="Ville : *">{(p) => <select {...p} className="saisie" required value={d.ville} onChange={(e) => maj({ ville: e.target.value, quartier: "" })}>
              <option value=""></option>{pays?.villes.map((x) => <option key={x.ville}>{x.ville}</option>)}</select>}</Champ>
            <Champ libelle="Quartier : *">{(p) => <select {...p} className="saisie" required {...texte("quartier")}><option value=""></option>{ville?.quartiers.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
            <Champ libelle="Rue / maison :">{(p) => <input {...p} className="saisie" autoComplete="off" {...texte("rue")} />}</Champ>
            <Champ libelle="Email :">{(p) => <input {...p} className="saisie" type="email" autoComplete="off" {...texte("email")} />}</Champ>
            <Champ libelle="BP :">{(p) => <input {...p} className="saisie court" autoComplete="off" {...texte("bp")} />}</Champ>
            <Champ libelle="Téléphone fixe :">{(p) => <input {...p} className="saisie code" type="tel" inputMode="tel" autoComplete="off" {...texte("telephoneFixe")} />}</Champ>
            <Champ libelle="Portable :">{(p) => <input {...p} className="saisie code" type="tel" inputMode="tel" autoComplete="off" {...texte("telephone")} />}</Champ>
          </div>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={choisi !== null} onClick={() => confirmer(() => api.tiers.creerProspect(d))}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => choisi !== null && confirmer(() => api.tiers.modifierProspect(choisi, d))}>Modifier</button>
        </div>
      </section>
      <table className="grille">
        <thead><tr><th scope="col">Nom / Prenom</th><th scope="col">Né(e) le</th><th scope="col">Profession</th><th scope="col">Quartier</th><th scope="col">Agence</th></tr></thead>
        <tbody>
          {liste.length === 0 && <tr><td colSpan={5}>No records found.</td></tr>}
          {liste.map((t) => (
            <tr key={t.id} className="ligne-choix" tabIndex={0} aria-selected={choisi === t.id}
              onClick={() => { setChoisi(t.id); setD({ nom: t.nom, prenom: t.prenom, naissance: t.naissance, lieuNaissance: t.lieuNaissance, sexe: t.sexe, profession: t.profession,
                pays: t.pays, ville: t.ville, quartier: t.quartier, rue: t.rue, email: t.email, bp: t.bp, telephoneFixe: t.telephoneFixe, telephone: t.telephone }); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLElement).click(); }}>
              <td>{t.nom} {t.prenom}</td><td className="chiffres">{fr(t.naissance)}</td><td>{t.profession}</td><td>{t.quartier}</td><td>{ctx.agence.nom}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Textes sources={["Manuel Microfina++, p. 55 : écran Enregistrement d'un prospect, champs obligatoires, boutons Enregistrer, Annuler, Modifier",
        "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
        "Listes Pays, Ville, Quartier et Profession : valeurs fictives tant que la Localisation et S14 ne sont pas construits"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
