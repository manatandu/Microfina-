// S94 : Crédit > Ajout/libération caution et nantissement (manuel Microfina++, p. 116 à 118, six captures) : Ajout caution, Libération de caution,
// Ajout de dépôt de garantie, Libération de nantissement, Rapport (onglets Nantissement et Caution). Registre S94-1 à S94-7, CR-21.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Paginee, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

const ONGLETS = [["ajout_caution", "Ajout caution"], ["liberation_caution", "Libérer caution"], ["ajout_depot", "Ajout de dépôt de garantie"],
  ["liberation_depot", "Libérer dépôt de garantie"], ["rapport", "Rapport"]] as const;
type Page = (typeof ONGLETS)[number][0];
type Situation = Awaited<ReturnType<typeof api.garanties.situation>>;
const nom = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const source = async (x: string) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : []);

export default function Garanties() {
  const [params, setParams] = useSearchParams();
  const page = (ONGLETS.some(([k]) => k === params.get("page")) ? params.get("page") : "ajout_caution") as Page;
  return (
    <>
      <div className="onglets" role="tablist" aria-label="Caution et nantissement">
        {ONGLETS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => setParams({ page: k })}>{l}</button>)}
      </div>
      {page === "rapport" ? <Rapport /> : <Operation key={page} page={page} />}
    </>
  );
}

/** Infos crédit des quatre captures : N° crédit, N° Client, Intitulé ; Montant crédit, garantie calculée, total, libérée */
function Operation({ page }: { page: Exclude<Page, "rapport"> }) {
  const type = page.endsWith("caution") ? "caution" : "depot_garantie";
  const ajout = page.startsWith("ajout");
  const [client, setClient] = useState<Tiers | null>(null);
  const [cid, setCid] = useState<number | null>(null);
  const [caution, setCaution] = useState<Tiers | null>(null);
  const [f, setF] = useState({ date: "", compte: "", montant: "", garantie: "", filtre: "tout" });
  const [recherche, setRecherche] = useState<"" | "client" | "caution">("");
  const [piece, setPiece] = useState("");
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const j = await api.journees.courante();
    const credits = client ? await api.garanties.credits(client.id) : [];
    const id = cid ?? credits[0]?.id ?? null;
    const s: Situation | null = id ? await api.garanties.situation(id, type) : null;
    const titulaire = type === "caution" ? caution : client;
    const comptes = titulaire ? await api.tiers.comptes(titulaire.id) : [];
    return { j, credits, s, comptes };
  }, [client?.id, cid, caution?.id, relu]);
  if (!donnees) return <Chargement />;
  const { j, credits, s, comptes } = donnees;
  const dv = (s?.credit.devise ?? "CDF") as Devise;
  const titre = { ajout_caution: "Ajout caution", liberation_caution: "Libération de caution", ajout_depot: "Ajout de dépôt de garantie", liberation_depot: "Libération de nantissement" }[page];
  const mot = type === "caution" ? "Caution" : page === "liberation_depot" ? "Nantissement" : "Dépôt de garantie";
  const enCours = (s?.garanties ?? []).filter((g) => f.filtre === "tout" || g.reste > 0);
  const k = comptes.find((x) => String(x.id) === f.compte);
  const effacer = () => { setClient(null); setCid(null); setCaution(null); setF({ date: "", compte: "", montant: "", garantie: "", filtre: "tout" }); setPiece(""); };
  function enregistrer() {
    const m = f.montant.trim() ? lireMontant(f.montant) : null;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const r = ajout
          ? await api.garanties.ajouter(s?.credit.id ?? 0, { type, cautionId: caution?.id ?? null, compteId: f.compte ? Number(f.compte) : null, montant: m, dateOperation: f.date || undefined })
          : await api.garanties.liberer(Number(f.garantie) || 0, { montant: m, dateOperation: f.date || undefined });
        setPiece(r.piece); setF({ ...f, montant: "" }); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const liste = (
    <div className="pile">
      <div className="entete-ecran"><strong>Liste {mot === "Dépôt de garantie" ? "dépôt de garantie" : mot.toLowerCase()}</strong>
        {page === "liberation_caution" && <div className="actions-onglets">
          <button className={f.filtre === "tout" ? "bouton" : "bouton secondaire"} type="button" onClick={() => setF({ ...f, filtre: "tout" })}>Tout</button>
          <button className={f.filtre === "non" ? "bouton" : "bouton secondaire"} type="button" onClick={() => setF({ ...f, filtre: "non" })}>Non libéré</button></div>}</div>
      <div className="defile-x"><table className="grille">
        <thead><tr><th scope="col" className="num">{mot} ajouté{type === "caution" ? "e" : ""}</th><th scope="col" className="num">{mot} libéré{type === "caution" ? "e" : ""}</th>
          <th scope="col">{type === "caution" ? "Membre caution" : "Date"}</th></tr></thead>
        <tbody>{enCours.length === 0 && <tr><td colSpan={3}>Aucune donnée dans la liste pour le moment</td></tr>}
          {enCours.map((g) => <tr key={g.id} aria-selected={String(g.id) === f.garantie} onClick={() => !ajout && g.reste > 0 && setF({ ...f, garantie: String(g.id) })}>
            <td className="num chiffres">{montant(g.ajoute, dv)}</td><td className="num chiffres">{montant(g.libere, dv)}</td>
            <td>{type === "caution" ? `${g.membre} (${g.compte})` : fr(g.date)}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
  return (
    <>
      <h1>{titre}</h1>
      <section className="bloc pile" aria-label={titre}>
        <div className="entete-ecran"><p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p>
          <ChampDate libelle="Date opération : *" valeur={f.date || j?.date || ""} onChange={(v) => setF({ ...f, date: v })} /></div>
        <div className="grille-deux">
          <fieldset className="pile cadre-champs"><legend>Infos crédit</legend>
            <Champ libelle="N° crédit:">{(p) => <select {...p} className="saisie code" disabled={credits.length < 2} value={s?.credit.id ?? ""} onChange={(e) => setCid(Number(e.target.value))}>
              {credits.length === 0 && <option value=""></option>}{credits.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            <div className="ligne-champ"><Champ libelle="N° Client :">{(p) => <input {...p} className="saisie code" readOnly value={client?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher le client du crédit" onClick={() => setRecherche("client")}>Rechercher</button></div>
            <Champ libelle="Intitulé:">{(p) => <Lecture {...p} value={client ? nom(client) : ""} />}</Champ>
            <dl className="infos">
              <div className="info-ligne"><dt>Montant crédit:</dt><dd className="chiffres">{s ? montant(s.credit.montant, dv) : ""}</dd></div>
              <div className="info-ligne"><dt>{mot} calculé{type === "caution" ? "e" : ""}:</dt><dd className="chiffres">{s ? montant(s.calcule, dv) : ""}</dd></div>
              <div className="info-ligne"><dt>Total {mot.toLowerCase()}:</dt><dd className="chiffres">{s ? montant(s.total, dv) : ""}</dd></div>
              <div className="info-ligne"><dt>{mot} libéré{type === "caution" ? "e" : ""}:</dt><dd className="chiffres">{s ? montant(s.totalLibere, dv) : ""}</dd></div>
            </dl>
          </fieldset>
          {page === "liberation_caution" ? <div className="pile">{liste}
            <Champ libelle="Montant à libérer: *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ></div>
            : <fieldset className="pile cadre-champs formulaire"><legend>Infos {type === "caution" ? "caution" : page === "liberation_depot" ? "Nantissement" : "dépôt de garantie"}</legend>
              {type === "caution" && <><Champ libelle="N° Client:">{(p) => <input {...p} className="saisie code" readOnly value={caution?.numero ?? ""} />}</Champ>
                <div className="ligne-champ"><button className="bouton secondaire" type="button" aria-label="Rechercher la caution" onClick={() => setRecherche("caution")}>Rechercher</button></div></>}
              <Champ libelle="Intitulé:">{(p) => <Lecture {...p} value={type === "caution" ? (caution ? nom(caution) : "") : (client ? nom(client) : "")} />}</Champ>
              {ajout ? <Champ libelle="Compte: *">{(p) => <select {...p} className="saisie code" value={f.compte} onChange={(e) => setF({ ...f, compte: e.target.value })}><option value=""></option>
                {comptes.filter((x) => x.devise === dv).map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}</select>}</Champ>
                : <Champ libelle="Compte: *">{(p) => <select {...p} className="saisie code" value={f.garantie} onChange={(e) => setF({ ...f, garantie: e.target.value })}><option value=""></option>
                  {(s?.garanties ?? []).filter((g) => g.reste > 0).map((g) => <option key={g.id} value={g.id}>{`${g.compte} (${montant(g.reste, dv)})`}</option>)}</select>}</Champ>}
              {ajout && <Champ libelle="Solde:">{(p) => <Lecture {...p} value={k ? (k.masque ? "" : montant(k.disponible, k.devise as Devise)) : ""} />}</Champ>}
              <Champ libelle={ajout ? `Montant ${type === "caution" ? "caution" : "dépôt de garantie"} *` : "Montant à libérer *"}>{(p) => <input {...p} className="saisie montant" inputMode="decimal"
                value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
            </fieldset>}
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!s} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        {page !== "liberation_caution" && liste}
        <Textes sources={["Manuel Microfina++, p. 116 et 117 : 5-1 Ajout caution, 5-2 Libérer caution, 5-3 Ajout de dépôt de garantie, 5-4 Libérer dépôt de garantie ; captures p. 116 à 118",
          "Registre CR-21 : la caution est bloquée sur le compte de la caution, le dépôt de garantie sur le compte du client, liés au crédit (S71) ; libération par cet écran seulement (loi 11/020, art. 43 et 48 ; Instr. BCC 38, art. 9)",
          "PCCI, comptes hors bilan 01 et 09 : caution reçue au crédit de 0112 « Garanties reçues de la clientèle » par le débit de 091, extournée à la libération"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={!!recherche} fermer={() => setRecherche("")}>
        <RechercheClient source={source} choisir={(x) => { if (recherche === "client") { setClient(x); setCid(null); } else setCaution(x); setF({ ...f, compte: "", garantie: "" }); setRecherche(""); }}
          fermer={() => setRecherche("")} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** 5-5 Rapport (p. 118) : onglets Nantissement et Caution, du … au …, Exécuter */
function Rapport() {
  const [onglet, setOnglet] = useState<"depot_garantie" | "caution">("depot_garantie");
  const [f, setF] = useState({ du: `${new Date().getFullYear()}-01-01`, au: new Date().toISOString().slice(0, 10) });
  const [l, setL] = useState<Awaited<ReturnType<typeof api.garanties.rapport>>>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  const mot = onglet === "caution" ? "Caution" : "Nantissement";
  async function executer() { try { setL(await api.garanties.rapport(onglet, f.du, f.au)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  return (
    <>
      <h1>Rapport caution et nantissement</h1>
      <section className="bloc pile" aria-label="Rapport caution et nantissement">
        <div className="onglets" role="tablist" aria-label="Rapport">
          {([["depot_garantie", "Nantissement"], ["caution", "Caution"]] as const).map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={onglet === k}
            onClick={() => { setOnglet(k); setL([]); }}>{t}</button>)}
        </div>
        <div className="ligne-champ">
          <ChampDate libelle={`${mot} du`} valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
          <ChampDate libelle="Au" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
          <button className="bouton" type="button" onClick={executer}>Exécuter</button>
        </div>
        <Paginee lignes={l} colonnes={() => []}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr>{["N°Membre", "N°Compte", "N°credit", "Date", "Client", onglet === "caution" ? "Caution et Ajout" : "Nantissement", "Libéré", "Restant"].map((t, i) =>
            <th key={t} scope="col" className={i >= 5 ? "num" : undefined}>{t}</th>)}</tr></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={8}>No records found.</td></tr>}
            {v.map((x) => <tr key={x.id}><td className="code">{x.numeroMembre}</td><td className="code">{x.compte}</td><td className="code">{x.numeroCredit}</td>
              <td className="chiffres">{fr(x.date)}</td><td>{x.client}</td><td className="num chiffres">{montant(x.ajoute, x.devise as Devise)}</td>
              <td className="num chiffres">{montant(x.libere, x.devise as Devise)}</td><td className="num chiffres">{montant(x.reste, x.devise as Devise)}</td></tr>)}</tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 118 : 5-5 Rapport, pour le nantissement ou la caution, rentrer les dates puis Exécuter ; deux captures",
          "Registre S94-6 : dernière colonne coupée sur les captures (« R… ») : le restant engagé"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
