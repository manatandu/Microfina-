import { useState, type ReactNode } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

const PAR_PAGE = 10;
const nomComplet = (t: { nom: string; postnom: string; prenom: string }) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const fr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** Tableau avec un filtre sous chaque en-tête et des pages de 10 lignes (captures p. 54 et 55) */
export function TableFiltree<T>({ colonnes, lignes, cle, vide = "Liste vide", avant, apres, choisir, choisi }: {
  colonnes: { titre: string; valeur: (l: T) => string; classe?: string }[]; lignes: T[]; cle: (l: T) => string | number; vide?: string;
  avant?: { titre: ReactNode; cellule: (l: T) => ReactNode }; apres?: { titre: string; cellule: (l: T) => ReactNode };
  choisir?: (l: T) => void; choisi?: string | number | null;
}) {
  const [filtres, setFiltres] = useState<string[]>(colonnes.map(() => ""));
  const [page, setPage] = useState(0);
  const retenues = lignes.filter((l) => colonnes.every((c, i) => c.valeur(l).toLowerCase().includes(filtres[i]!.trim().toLowerCase())));
  const pages = Math.max(1, Math.ceil(retenues.length / PAR_PAGE));
  const p = Math.min(page, pages - 1);
  return (
    <div className="pile">
      {pages > 1 && (
        <nav className="pagination" aria-label="Pages">
          {Array.from({ length: pages }, (_, i) => <button key={i} type="button" aria-current={i === p ? "page" : undefined} onClick={() => setPage(i)}>{i + 1}</button>)}
        </nav>
      )}
      <table className="grille">
        <thead>
          <tr>{avant && <th scope="col">{avant.titre}</th>}{colonnes.map((c) => <th key={c.titre} scope="col">{c.titre}</th>)}{apres && <th scope="col">{apres.titre}</th>}</tr>
          <tr className="filtres">{avant && <td />}{colonnes.map((c, i) => (
            <td key={c.titre}><input className="saisie" type="search" aria-label={`Filtrer ${c.titre}`} value={filtres[i]}
              onChange={(e) => { setFiltres(filtres.map((f, j) => (j === i ? e.target.value : f))); setPage(0); }} /></td>
          ))}{apres && <td />}</tr>
        </thead>
        <tbody>
          {retenues.length === 0 && <tr><td colSpan={colonnes.length + (avant ? 1 : 0) + (apres ? 1 : 0)}>{vide}</td></tr>}
          {retenues.slice(p * PAR_PAGE, (p + 1) * PAR_PAGE).map((l) => (
            <tr key={cle(l)} {...(choisir ? { className: "ligne-choix", tabIndex: 0, "aria-selected": choisi === cle(l), onClick: () => choisir(l),
              onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") choisir(l); } } : {})}>{avant && <td>{avant.cellule(l)}</td>}{colonnes.map((c) => <td key={c.titre} className={c.classe}>{c.valeur(l)}</td>)}{apres && <td>{apres.cellule(l)}</td>}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Donnees = Awaited<ReturnType<typeof api.groupes.lire>>;
type Groupe = Donnees["groupes"][number];
const COLONNES_GROUPES = [{ titre: "N° GROUPE", valeur: (g: Groupe) => g.code, classe: "chiffres" }, { titre: "NOM", valeur: (g: Groupe) => g.nom }, { titre: "AGENCE", valeur: (g: Groupe) => g.agence }];

/** S44 : Client > Groupe solidaire (manuel Microfina++, p. 54 et 55) */
export function GroupeSolidaire() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), g: await api.groupes.lire() }));
  const [onglet, setOnglet] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  // Onglet Groupe Solidarité
  const [code, setCode] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [edition, setEdition] = useState<number | null>(null);
  // Onglet Affectation
  const [groupeId, setGroupeId] = useState(0);
  const [client, setClient] = useState<Tiers | null>(null);
  const [ajoutes, setAjoutes] = useState<Tiers[]>([]);
  const [coches, setCoches] = useState<number[]>([]);
  const [recherche, setRecherche] = useState(false);
  if (!donnees) return <Chargement />;
  const { ctx, g } = donnees;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const effacer = () => { setCode(null); setNom(""); setEdition(null); };
  const confirmer = (texte: string, faire: () => Promise<unknown>, succes: string, apres?: () => void) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); apres?.(); setBoite({ type: "succes", message: succes }); } catch (x) { erreur(x); }
  } });
  const groupe = g.groupes.find((x) => x.id === groupeId);
  const lignesAffectation = [
    ...g.membres.filter((m) => m.groupeId === groupeId).map((m) => ({ tiersId: m.tiersId, membre: m.membre, nouveau: false })),
    ...ajoutes.map((t) => ({ tiersId: t.id, membre: nomComplet(t), nouveau: true })),
  ];

  return (
    <>
      <h1>Groupe solidaire</h1>
      <div className="onglets" role="tablist" aria-label="Groupe solidaire">
        {["Groupe Solidarité", "Affectation Groupe Solidarité"].map((o, i) => (
          <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>
        ))}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {onglet === 0 && <>
          <div className="formulaire">
            <Champ libelle="Code groupe *">{(p) => <input {...p} className="saisie code" required autoComplete="off" value={code ?? g.codeSuivant} onChange={(e) => setCode(e.target.value)} />}</Champ>
            <Champ libelle="nom groupe *">{(p) => <input {...p} className="saisie" required autoComplete="off" value={nom} onChange={(e) => setNom(e.target.value)} />}</Champ>
            <Champ libelle="Agence *">{(p) => <select {...p} className="saisie" disabled><option>{ctx.agence.nom}</option></select>}</Champ>
          </div>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => {
              const d = { code: code ?? g.codeSuivant, nom };
              confirmer("Voulez-vous vraiment enregistrer ?", () => (edition ? api.groupes.modifier(edition, d) : api.groupes.creer(d)), "Groupe solidarité enregistré avec succès", effacer);
            }}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={effacer}>effacer</button>
          </div>
          <TableFiltree colonnes={COLONNES_GROUPES} lignes={g.groupes} cle={(x) => x.id} />
        </>}

        {onglet === 1 && <>
          <div className="deux-colonnes">
            <fieldset className="pile cadre-champs">
              <legend>Info client</legend>
              <Champ libelle="Groupe Solidaire *">{(p) => <select {...p} className="saisie" required value={groupeId} onChange={(e) => { setGroupeId(Number(e.target.value)); setAjoutes([]); setCoches([]); }}>
                <option value={0}></option>{g.groupes.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
              <div className="ligne-champ">
                <Champ libelle="N° Client *">{(p) => <input {...p} className="saisie code" readOnly required value={client?.numero ?? ""} />}</Champ>
                <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
              </div>
              <Champ libelle="Intitulé :">{(p) => <input {...p} className="saisie" readOnly value={client ? client.intitule || nomComplet(client) : ""} />}</Champ>
              <Champ libelle="Categorie :">{(p) => <input {...p} className="saisie" readOnly value={client?.typeClient ?? ""} />}</Champ>
              <Champ libelle="Né (e) le :">{(p) => <input {...p} className="saisie code" readOnly value={client ? fr(client.naissance) : ""} />}</Champ>
              <div className="actions-onglets">
                <button className="bouton" type="button" disabled={!client || !groupeId} onClick={() => {
                  if (!client) return;
                  if (lignesAffectation.some((l) => l.tiersId === client.id)) { erreur(new Error(`${nomComplet(client)} est déjà membre de ce groupe.`)); return; }
                  setAjoutes([...ajoutes, client]); setClient(null);
                }}>Ajouter</button>
                <button className="bouton secondaire" type="button" onClick={() => setClient(null)}>Annuler</button>
              </div>
            </fieldset>
            <div className="pile">
              <TableFiltree lignes={lignesAffectation} cle={(l) => l.tiersId}
                colonnes={[{ titre: "NOM GROUPE", valeur: () => groupe?.nom ?? "" }, { titre: "Membre", valeur: (l) => l.membre }, { titre: "Agence", valeur: () => groupe?.agence ?? "" }]}
                avant={{ titre: <span className="sr-only">Choisir</span>, cellule: (l) => <input type="checkbox" aria-label={`Choisir ${l.membre}`} checked={coches.includes(l.tiersId)}
                  onChange={(e) => setCoches(e.target.checked ? [...coches, l.tiersId] : coches.filter((x) => x !== l.tiersId))} /> }} />
              <div className="actions-onglets">
                <button className="bouton" type="button" disabled={ajoutes.length === 0} onClick={() => confirmer("Voulez-vous vraiment enregistrer ?",
                  () => api.groupes.affecter(groupeId, ajoutes.map((t) => t.id)), "Enregistré avec succès !", () => setAjoutes([]))}>Enregistrer</button>
                <button className="bouton secondaire" type="button" disabled={coches.length === 0} onClick={() => {
                  const enregistres = coches.filter((id) => !ajoutes.some((t) => t.id === id));
                  setAjoutes(ajoutes.filter((t) => !coches.includes(t.id)));
                  if (enregistres.length === 0) { setCoches([]); return; }
                  confirmer("Voulez-vous vraiment retirer ?", () => api.groupes.retirer(groupeId, enregistres), "Enregistré avec succès !", () => setCoches([]));
                }}>Retirer</button>
              </div>
            </div>
          </div>
          <TableFiltree colonnes={COLONNES_GROUPES} lignes={g.groupes} cle={(x) => x.id}
            apres={{ titre: "Action", cellule: (x) => (
              <span className="actions-ligne">
                <button className="bouton secondaire" type="button" aria-label={`Modifier ${x.nom}`} onClick={() => { setCode(x.code); setNom(x.nom); setEdition(x.id); setOnglet(0); }}>Modifier</button>
                <button className="bouton secondaire" type="button" aria-label={`Supprimer ${x.nom}`} onClick={() => confirmer("Voulez-vous vraiment supprimer ?",
                  () => api.groupes.supprimer(x.id), "Enregistré avec succès !", () => { if (groupeId === x.id) setGroupeId(0); })}>Supprimer</button>
              </span>
            ) }} />
        </>}

        <Textes sources={["Manuel Microfina++, p. 54 et 55 : onglets Groupe Solidarité (Code groupe*, nom groupe*, Agence*, Enregistrer, effacer) et Affectation Groupe Solidarité (Ajouter, Annuler, Enregistrer, Retirer, Action)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "PCCI, compte 1031 : parts sociales des groupements solidaires effectifs"]} />
      </section>
      <Fiche titre="Clients" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setClient(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
