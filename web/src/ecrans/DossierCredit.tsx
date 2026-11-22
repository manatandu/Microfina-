// S86 à S88 : Crédit > Dossier de crédit : Analyse (demande), Contrôle, Approbation (manuel Microfina++, p. 113 et 114, texte 2.1 à 2.15).
// Registre S86-1 à S86-6, S87-1 à S87-3, S88-1 à S88-6, CR-3, CR-8, CR-14, CR-25.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Paginee, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

type Demande = Awaited<ReturnType<typeof api.dossiers.lister>>[number];
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const EFFECTIFS = [["nbHommes", "Effectif hommes", "n"], ["nbFemmes", "Effectif femmes", "n"], ["montantHommes", "Montant hommes", "m"], ["montantFemmes", "Montant femmes", "m"],
  ["nbGroupes", "Nombre de groupes solidaires", "n"]] as const;
type Effectifs = Record<(typeof EFFECTIFS)[number][0], string>;
const VIDES: Effectifs = { nbHommes: "", nbFemmes: "", montantHommes: "", montantFemmes: "", nbGroupes: "" };
const entier = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : v.trim() ? NaN : 0);
const somme = (v: string) => (v.trim() ? lireMontant(v) ?? NaN : 0);
const valeurs = (e: Effectifs) => Object.fromEntries(EFFECTIFS.map(([k, , s]) => [k, s === "m" ? somme(e[k]) : entier(e[k])]));

function Effectifs({ e, maj, prefixe }: { e: Effectifs; maj: (x: Effectifs) => void; prefixe: string }) {
  return <>{EFFECTIFS.map(([k, l, s]) => <Champ key={k} libelle={`${prefixe}${l}`}>{(p) => <input {...p} className={s === "m" ? "saisie montant" : "saisie code"}
    inputMode={s === "m" ? "decimal" : "numeric"} autoComplete="off" value={e[k]} onChange={(ev) => maj({ ...e, [k]: ev.target.value })} />}</Champ>)}</>;
}

/** S86 : 2.1 à 2.8 (p. 113) : produit, client, cycle, effectifs ; Suivant ; région (province), préfecture (ville), effectifs ressaisis ; Enregistrer */
export function DemandeCredit() {
  const { donnees: ctx } = useDonnees(() => api.dossiers.contexte());
  const [t, setT] = useState<Tiers | null>(null);
  const [f, setF] = useState({ produit: "", cycle: "", analyse: "", duree: "", province: "", ville: "", commune: "" });
  const [e, setE] = useState<Effectifs>(VIDES);
  const [r, setR] = useState<Effectifs>(VIDES);
  const [parts, setParts] = useState<string[]>([]);
  const [page, setPage] = useState<1 | 2>(1);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: h } = useDonnees(() => (t ? api.analyses.historique(t.id) : Promise.resolve(null)), [t?.id]);
  if (!ctx) return <Chargement />;
  const analyses = (h?.analyses ?? []).filter((a) => String(a.produitId) === f.produit);
  const maj = (x: Partial<typeof f>) => setF({ ...f, ...x });
  const effacer = () => { setT(null); setF({ produit: "", cycle: "", analyse: "", duree: "", province: "", ville: "", commune: "" }); setE(VIDES); setR(VIDES); setParts([]); setPage(1); };
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const x = await api.dossiers.demander({ produitId: Number(f.produit), tiersId: t?.id, cycleId: f.cycle ? Number(f.cycle) : null, analyseId: f.analyse ? Number(f.analyse) : null,
          ...valeurs(e), duree: entier(f.duree), provinceId: Number(f.province) || null, villeId: Number(f.ville) || null, communeId: Number(f.commune) || null, ressaisie: valeurs(r),
          parts: t?.type === "groupe" ? parts.map((m) => ({ montant: somme(m) })) : [] });
        effacer(); setBoite({ type: "succes", message: `Enregistré avec succès ! Demande N° ${x.numero}.` });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Dossier de crédit : analyse de la demande</h1>
      <section className="bloc pile" aria-label="Demande de crédit">
        {page === 1 ? <>
          <fieldset className="cadre-champs formulaire">
            <legend>Demande</legend>
            <Champ libelle="Produit crédit *">{(pp) => <select {...pp} className="saisie" value={f.produit} onChange={(ev) => maj({ produit: ev.target.value, analyse: "" })}>
              <option value=""></option>{ctx.produits.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
            <div className="ligne-champ">
              <Champ libelle="Numéro client">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Cycle">{(pp) => <select {...pp} className="saisie" value={f.cycle} onChange={(ev) => maj({ cycle: ev.target.value })}>
              <option value=""></option>{ctx.cycles.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</select>}</Champ>
            <Champ libelle="N° analyse">{(pp) => <select {...pp} className="saisie" value={f.analyse} onChange={(ev) => maj({ analyse: ev.target.value })}>
              <option value=""></option>{analyses.map((a) => <option key={a.id} value={a.id}>{`${a.numero} du ${fr(a.date)}`}</option>)}</select>}</Champ>
            <Champ libelle="Durée (mois) *">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.duree} onChange={(ev) => maj({ duree: ev.target.value })} />}</Champ>
            <Effectifs e={e} maj={setE} prefixe="" />
          </fieldset>
          <div className="actions-onglets">
            <button className="bouton" type="button" disabled={!f.produit || !t} onClick={() => { setPage(2); setParts((t?.membres ?? []).map(() => "")); }}>Suivant</button>
            <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
          </div>
        </> : <>
          <fieldset className="cadre-champs formulaire">
            <legend>Détail de la demande</legend>
            <Champ libelle="Région (province) *">{(pp) => <select {...pp} className="saisie" value={f.province} onChange={(ev) => maj({ province: ev.target.value, ville: "", commune: "" })}>
              <option value=""></option>{ctx.provinces.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
            <Champ libelle="Préfecture (ville ou territoire) *">{(pp) => <select {...pp} className="saisie" value={f.ville} onChange={(ev) => maj({ ville: ev.target.value, commune: "" })}>
              <option value=""></option>
              {(["Ville", "Territoire"] as const).map((nat) => <optgroup key={nat} label={nat === "Ville" ? "Villes" : "Territoires"}>   {/* registre S20-8 */}
                {ctx.villes.filter((v) => String(v.provinceId) === f.province && (v.nature || "Ville") === nat).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</optgroup>)}</select>}</Champ>
            {/* lieu de l'activité jusqu'à la commune, au secteur ou à la chefferie (registre T41) */}
            <Champ libelle="Commune, secteur ou chefferie">{(pp) => <select {...pp} className="saisie" value={f.commune} disabled={!f.ville} onChange={(ev) => maj({ commune: ev.target.value })}>
              <option value=""></option>
              {(["Commune", "Secteur", "Chefferie"] as const).map((nat) => <optgroup key={nat} label={nat === "Chefferie" ? "Chefferies" : `${nat}s`}>
                {ctx.communes.filter((c) => String(c.villeId) === f.ville && (c.nature || "Commune") === nat).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</optgroup>)}</select>}</Champ>
            <Effectifs e={r} maj={setR} prefixe="Ressaisir : " />
          </fieldset>
          {t?.type === "groupe" && <fieldset className="cadre-champs formulaire">
            <legend>Part de chaque membre du groupe</legend>
            {t.membres.map((m, i) => <Champ key={i} libelle={[m.nom, m.prenom].filter(Boolean).join(" ")}>{(pp) => <input {...pp} className="saisie montant" inputMode="decimal"
              autoComplete="off" value={parts[i] ?? ""} onChange={(ev) => setParts(parts.map((x, j) => (j === i ? ev.target.value : x)))} />}</Champ>)}
          </fieldset>}
          <div className="actions-onglets">
            <button className="bouton secondaire" type="button" onClick={() => setPage(1)}>Précédent</button>
            <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          </div>
        </>}
        <Textes sources={["Manuel Microfina++, p. 113, 2.1 à 2.8 : produit, client, cycle, effectifs et montants hommes et femmes, groupes solidaires ; Suivant ; région, préfecture, effectifs ressaisis ; Enregistrer",
          "Registre S86-1 à S86-6 : région et préfecture lues comme province et ville ou territoire (S20-1) ; durée ; analyse financière (S85) ; groupe : part de chaque membre (CR-8, loi 11/020, art. 44)"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])} choisir={(x) => { setT(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

function Grille({ lignes, choisir, choisie }: { lignes: Demande[]; choisir: (d: Demande) => void; choisie?: number }) {
  return (
    <Paginee lignes={lignes}>{(v) => (<div className="defile-x"><table className="grille">
      <thead><tr><th scope="col">N° demande</th><th scope="col">Date</th><th scope="col">N° client</th><th scope="col">Intitulé</th><th scope="col">Produit</th>
        <th scope="col" className="num">Montant</th><th scope="col" className="num">Durée (mois)</th><th scope="col">Saisi par</th></tr></thead>
      <tbody>{v.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
        {v.map((x) => <tr key={x.id} aria-selected={x.id === choisie} onClick={() => choisir(x)}>
          <td className="code">{x.numero}</td><td className="chiffres">{fr(x.date)}</td><td className="code">{x.membre}</td><td>{x.client}</td><td>{x.produit}</td>
          <td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="num chiffres">{x.duree}</td><td>{x.saisiPar}</td></tr>)}</tbody>
    </table></div>)}</Paginee>
  );
}

/** S87 : 2.9 à 2.12 : bouton Contrôle, double clic sur la demande, effectif, groupes et montant ressaisis, Terminer, OK */
export function ControleDemande() {
  const [relu, setRelu] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const { donnees } = useDonnees(() => (ouvert ? api.dossiers.lister("saisie") : Promise.resolve([] as Demande[])), [ouvert, relu]);
  const [d, setD] = useState<Demande | null>(null);
  const [f, setF] = useState({ effectif: "", nbGroupes: "", montant: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  function terminer() {
    if (!d) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment terminer le contrôle ?", oui: async () => {
      try { await api.dossiers.controler(d.id, { effectif: entier(f.effectif), nbGroupes: entier(f.nbGroupes), montant: somme(f.montant) });
        setD(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Contrôle terminé avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Dossier de crédit : contrôle de la demande</h1>
      <section className="bloc pile" aria-label="Contrôle de la demande">
        <div className="actions-onglets"><button className="bouton" type="button" onClick={() => { setOuvert(true); setRelu((v) => v + 1); }}>Contrôle</button></div>
        {ouvert && (donnees ? <Grille lignes={donnees} choisir={(x) => { setD(x); setF({ effectif: "", nbGroupes: "", montant: "" }); }} /> : <Chargement />)}
        <Textes sources={["Manuel Microfina++, p. 113, 2.9 à 2.12 : bouton contrôle, double clic sur la demande, effectif, nombre de groupes solidaires et montant ressaisis, Terminer, OK",
          "Registre S87-1 à S87-3 : les valeurs ressaisies doivent égaler la demande ; contrôle par un autre utilisateur que celui qui a saisi"]} />
      </section>
      <Fiche titre={`Contrôle de la demande ${d?.numero ?? ""}`} ouverte={!!d} fermer={() => setD(null)}>
        {d && <div className="pile">
          <p>{d.client} · {d.produit} · {d.duree} mois</p>
          <Champ libelle="Effectif *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={f.effectif} onChange={(e) => setF({ ...f, effectif: e.target.value })} />}</Champ>
          <Champ libelle="Nombre de groupes solidaires *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={f.nbGroupes} onChange={(e) => setF({ ...f, nbGroupes: e.target.value })} />}</Champ>
          <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={terminer}>Terminer</button>
            <button className="bouton secondaire" type="button" onClick={() => setD(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S88 : 2.13 à 2.15 : choisir la demande, Approuver, montant approuvé ressaisi, Approuver, OK ; Centrale des risques, plafonds, apparentés (registre S88) */
export function ApprobationDemande() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => Promise.all([api.dossiers.lister("controlee"), api.dossiers.contexte(), api.journees.courante()]), [relu]);
  const [choisie, setChoisie] = useState<Demande | null>(null);
  const [ouverte, setOuverte] = useState(false);
  const [f, setF] = useState({ montant: "", crLe: "", crRef: "", conseil: "", bcc: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const [liste, ctx, j] = donnees;
  function approuver() {
    if (!choisie) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment approuver ce crédit ?", oui: async () => {
      try { await api.dossiers.approuver(choisie.id, { montantApprouve: somme(f.montant), consultationCrLe: f.crLe, consultationCrRef: f.crRef, accordConseilRef: f.conseil, accordBccRef: f.bcc });
        setOuverte(false); setChoisie(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Approuvé avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Dossier de crédit : approbation</h1>
      <section className="bloc pile" aria-label="Approbation">
        <p>Fonds propres prudentiels : <strong className="chiffres">{ctx.fondsPropres ? `${montant(ctx.fondsPropres.montant, "CDF")} au ${fr(ctx.fondsPropres.dateArrete)}` : "non saisis (Paramétrage > Info société)"}</strong></p>
        <Grille lignes={liste} choisir={setChoisie} choisie={choisie?.id} />
        <div className="actions-onglets"><button className="bouton" type="button" disabled={!choisie}
          onClick={() => { setF({ montant: "", crLe: j?.date ?? "", crRef: "", conseil: "", bcc: "" }); setOuverte(true); }}>Approuver</button></div>
        <Textes sources={["Manuel Microfina++, p. 113 et 114, 2.13 à 2.15 : choisir la demande, Approuver, montant approuvé ressaisi, Approuver, OK",
          "Instr. BCC 05, art. 4 et 13 : consentement écrit et consultation de la Centrale des risques avant l'octroi (registre S88-1)",
          "Instr. BCC 002, art. 25 à 29 ; loi 002/2002, art. 59 à 61 : plafonds par emprunteur et pour les apparentés ; Instr. BCC 51 : accord du Conseil (registre CR-2, CR-3, CR-14)"]} />
      </section>
      <Fiche titre={`Approbation de la demande ${choisie?.numero ?? ""}`} ouverte={ouverte} fermer={() => setOuverte(false)}>
        {choisie && <div className="pile">
          <p>{choisie.client} · {choisie.produit} · demandé {montant(choisie.montant, choisie.devise as Devise)} sur {choisie.duree} mois</p>
          <Champ libelle="Montant approuvé *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
          <ChampDate libelle="Consultation de la Centrale des risques le *" valeur={f.crLe} onChange={(v) => setF({ ...f, crLe: v })} />
          <Champ libelle="Référence du rapport de la Centrale *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.crRef} onChange={(e) => setF({ ...f, crRef: e.target.value })} />}</Champ>
          <Champ libelle="Accord du Conseil d'administration (personne apparentée)">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.conseil} onChange={(e) => setF({ ...f, conseil: e.target.value })} />}</Champ>
          <Champ libelle="Accord ou dérogation de la BCC (au-delà du plafond)">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.bcc} onChange={(e) => setF({ ...f, bcc: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={approuver}>Approuver</button>
            <button className="bouton secondaire" type="button" onClick={() => setOuverte(false)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
