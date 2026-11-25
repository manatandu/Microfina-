import { Fragment, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { enClair } from "../lib/enclair";
import { api, IMAGE_MAX, ageAu, MAJORITE } from "../donnees/api";
import type { Representant, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { vers } from "./registre";
import { jourOuvert } from "../lib/dates";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Lecture, Paginee } from "../composants";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { aDesParts, mots } from "../lib/vocabulaire";

type Ctx = Awaited<ReturnType<typeof api.referentiel.contexte>>;
const nomComplet = (t: { nom: string; postnom: string; prenom: string }) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const fr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const deviseDe = (ctx: Ctx, t: Tiers) => ctx.produits.find((p) => p.code === t.produitCode)?.devise ?? "CDF";

/** S40 : Membre > Membres à viser. Une file qui montre ce qui attend : nouveaux membres (visa, frais d'adhésion, contrat ; anciens S40 et S41) et
 *  fiches modifiées (avant et après ; ancien S42), avec l'auteur et la date (plan d'allègement, point 3.6 ; Instr. BCC 15, art. 33 ; Instr. BCC 008, art. 66) */
export function MembresAViser() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const [ctx, nouveaux, modifies] = await Promise.all([api.referentiel.contexte(), api.tiers.aViser(), api.tiers.aRevalider()]);
    const modifs = await Promise.all(modifies.map((t) => api.tiers.modifications(t.id)));
    return { ctx, nouveaux, modifies: modifies.map((t, i) => ({ t, m: [...modifs[i]!].reverse().find((x) => !x.validePar) })) };
  }, [relu]);
  const [choix, setChoix] = useState<{ t: Tiers; genre: "nouveau" | "modifie" } | null>(null);
  if (!donnees) return <Chargement />;
  const nom = (id?: number) => ((donnees.ctx as { utilisateurs?: { id: number; nom: string }[] }).utilisateurs ?? []).find((x) => x.id === id)?.nom ?? "";
  const lignes = [...donnees.nouveaux.map((t) => ({ t, genre: "nouveau" as const, quoi: "Nouveau membre", par: nom(t.creePar), le: t.creeLe })),
    ...donnees.modifies.map(({ t, m }) => ({ t, genre: "modifie" as const, quoi: "Fiche modifiée", par: nom(m?.modifiePar), le: m?.modifieLe?.slice(0, 10) ?? "" }))];
  const fait = () => setRelu((x) => x + 1);
  return (
    <>
      <h2>Membres à viser</h2>
      <section className="bloc pile" aria-label="Membres à viser">
        <table className="grille" aria-label="Ce qui attend">
          <thead><tr><th scope="col">Attente</th><th scope="col">N°</th><th scope="col">Membre</th><th scope="col">Par</th><th scope="col">Le</th></tr></thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
            {lignes.map((l) => (
              <tr key={`${l.genre}-${l.t.id}`} className="ligne-choix" tabIndex={0} aria-selected={choix?.t.id === l.t.id} onClick={() => setChoix({ t: l.t, genre: l.genre })}
                onKeyDown={(e) => { if (e.key === "Enter") setChoix({ t: l.t, genre: l.genre }); }}>
                <td>{l.quoi}</td><td className="chiffres">{l.t.numero}</td><td>{l.t.intitule || nomComplet(l.t)}</td><td>{l.par}</td><td className="chiffres">{fr(l.le)}</td></tr>))}
          </tbody>
        </table>
      </section>
      {choix?.genre === "nouveau" && <>
        <VisaClient key={`v-${choix.t.id}`} initial={choix.t} fait={fait} />
        <ModificationFrais key={`f-${choix.t.id}-${relu}`} initial={choix.t} />
      </>}
      {choix?.genre === "modifie" && <ValidationClientModifie key={`m-${choix.t.id}`} initial={choix.t} fait={fait} />}
    </>
  );
}

/** S40 : Client > Visa > Viser un client (manuel Microfina++, p. 52). Admission du membre : loi 002/2002, art. 22, 6°. */
export function VisaClient({ initial, fait }: { initial?: Tiers; fait?: () => void } = {}) {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), attente: await api.tiers.aViser() }));
  const [t, setT] = useState<Tiers | null>(initial ?? null);
  const [intitule, setIntitule] = useState("");
  const [dateVisa, setDateVisa] = useState("");
  const [admission, setAdmission] = useState({ le: "", reference: "" });   // écart E05
  const [mineur, setMineur] = useState({ emancipationReference: "", representantLegal: "" });   // écart E18
  const [auxiliaire, setAuxiliaire] = useState(false);   // écart E20
  const [refus, setRefus] = useState<string | null>(null);   // A5
  const [recherche, setRecherche] = useState(false);
  const [contrat, setContrat] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: lies } = useDonnees(() => (t ? api.parametrage.fraisLies(t.id) : Promise.resolve([])), [t?.id]);
  const frais = lies ?? [];
  const { donnees: copies } = useDonnees(() => (t ? api.tiers.images(t.id) : Promise.resolve(null)), [t?.id]);
  useEffect(() => { if (initial) void choisir(initial); }, [initial?.id]);   // ouvert depuis « Membres à viser » (plan 3.6)   // eslint-disable-line react-hooks/exhaustive-deps
  if (!donnees) return <Chargement />;
  const { ctx, attente } = donnees;
  const vise = t?.statut === "actif";
  // Écart E03 : le visa montre si la copie de la pièce et le justificatif d'adresse sont déposés (Instr. BCC 15, art. 12 et 29)
  // E1 : pour une personne morale, copie des statuts et du registre aux mêmes emplacements (loi 22/068, art. 34 ; Instr. BCC 15, art. 17 et 29 ; registre T43)
  const libellesCopies = t?.type === "morale" ? ["copie des statuts", "copie du registre (acte de constitution)"] : ["copie de la pièce d'identité", "justificatif d'adresse"];
  const manquantes = copies ? [!copies.copiePiece && libellesCopies[0], !copies.justificatifAdresse && libellesCopies[1],
    t?.type === "physique" && t.secteurActivite && !copies.copieHabilitation && "pièce d'habilitation professionnelle"].filter(Boolean) : [];   // A7

  async function choisir(x: Tiers) {
    const j = await api.journees.courante();
    setT(x); setIntitule(x.intitule || nomComplet(x));
    setDateVisa(j?.statut === "ouverte" ? j.date : ""); setRecherche(false);
  }
  function annuler() { setT(null); setIntitule(""); setDateVisa(""); setAdmission({ le: "", reference: "" }); setMineur({ emancipationReference: "", representantLegal: "" }); setAuxiliaire(false); }
  function viser() {
    if (!t) { setBoite({ type: "erreur", message: "Rechercher d'abord le client." }); return; }
    const m = t.premierDepot ?? 0;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        setT(await api.tiers.viser(t.id, { dateVisa, intitule, premierDepot: m, ...(admission.le || admission.reference ? { admissionLe: admission.le, admissionReference: admission.reference } : {}), ...mineur, ...(auxiliaire ? { auxiliaire } : {}) }));
        fait?.();
        setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <h2>Visa client</h2>
      <section className="bloc pile" aria-label="Visa">
        <div className="deux-colonnes">
          <fieldset className="pile cadre-champs">
            <legend>Informations du client</legend>
            <div className="ligne-champ">
              <Champ libelle="Numéro Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              {!initial && <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={vise} onClick={() => setRecherche(true)}>Rechercher</button>}
            </div>
            <Champ libelle="Intitulé : *">{(p) => <input {...p} className="saisie" required readOnly={!t || vise} autoComplete="off" value={intitule} onChange={(e) => setIntitule(e.target.value)} />}</Champ>
            {/* Le premier dépôt se saisit à l'enrôlement et se lit au visa ; au guichet, le montant versé fait foi (plan d'allègement, point 3.7) */}
            <Champ libelle={`Premier dépôt :${t ? ` (${deviseDe(ctx, t)})` : ""}`}>{(p) => <input {...p} className="saisie montant" readOnly value={t ? montant(t.premierDepot, deviseDe(ctx, t)) : ""} />}</Champ>
            <Champ libelle="Date Demande">{(p) => <input {...p} className="saisie date" readOnly value={t ? fr(t.dateDemande) : ""} />}</Champ>
            {/* Plan d'allègement, point 0.22 : la journée ouverte, en lecture seule (PCCI § 3.4 ; registre T131) */}
            <Champ libelle="Date Visa">{(p) => <input {...p} className="saisie date" readOnly value={fr(dateVisa || jourOuvert())} />}</Champ>
            {t && aDesParts(ctx.institution) && (vise
              ? <p className="aide">Admis le {fr(t.admissionLe ?? "")} : {t.admissionReference}</p>
              : ctx.institution.delegationAdmission
                ? <p className="aide">Admission par délégation du Conseil d'Administration : {ctx.institution.delegationAdmission}</p>
                : <div className="grille-deux">
                    <ChampDate libelle="Décision du CA, date : *" valeur={admission.le} onChange={(x) => setAdmission({ ...admission, le: x })} />
                    <Champ libelle="Décision du CA, référence : *">{(p) => <input {...p} className="saisie code" value={admission.reference} onChange={(e) => setAdmission({ ...admission, reference: e.target.value })} />}</Champ>
                  </div>)}
            {t && !vise && aDesParts(ctx.institution) && ctx.institution.membresAuxiliaires && <label className="case"><input type="checkbox" checked={auxiliaire} onChange={(e) => setAuxiliaire(e.target.checked)} />
              <span>Membre auxiliaire</span></label>}
            {t && vise && t.auxiliaire && <p className="aide">Membre auxiliaire</p>}
            {t && !vise && t.type === "physique" && t.naissance && ageAu(t.naissance, dateVisa || jourOuvert()) < MAJORITE && <fieldset className="pile cadre-champs">
              <legend>Client mineur</legend>
              {(!aDesParts(ctx.institution) || auxiliaire) && <Champ libelle="Représentant légal : nom, qualité (père, mère ou tuteur), pièce">{(p) => <input {...p} className="saisie" value={mineur.representantLegal} onChange={(e) => setMineur({ ...mineur, representantLegal: e.target.value })} />}</Champ>}
              <Champ libelle="Émancipation : référence de la décision du Tribunal pour enfants">{(p) => <input {...p} className="saisie code" value={mineur.emancipationReference} onChange={(e) => setMineur({ ...mineur, emancipationReference: e.target.value })} />}</Champ>
            </fieldset>}
            {t && vise && (t.representantLegal || t.emancipationReference) && <p className="aide">{t.emancipationReference ? `Émancipé : ${t.emancipationReference}` : `Représentant légal : ${t.representantLegal}`}</p>}
            {refus !== null && <fieldset className="pile cadre-champs">
              <legend>Refus de la demande</legend>
              <Champ libelle="Motif du refus : *">{(p) => <input {...p} className="saisie" value={refus} onChange={(e) => setRefus(e.target.value)} />}</Champ>
              <div className="actions-onglets">
                <button className="bouton" type="button" onClick={() => t && setBoite({ type: "confirmation", message: "Voulez-vous vraiment refuser cette demande ?", oui: async () => {
                  try { setT(await api.tiers.refuser(t.id, { motif: refus })); setRefus(null); fait?.(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
                  catch (x) { setBoite({ type: "erreur", message: message(x) }); } } })}>Confirmer le refus</button>
                <button className="bouton secondaire" type="button" onClick={() => setRefus(null)}>Annuler</button>
              </div>
            </fieldset>}
            {t?.statut === "refuse" && <p className="aide" role="status">Demande refusée le {fr(t.refuseLe ?? "")} : {t.refusMotif}</p>}
            {t && !vise && manquantes.length > 0 && <p className="aide" role="status">Pas encore déposé : {manquantes.join(", ")}.</p>}
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Liste des Frais liés</legend>
            <table className="grille">
              <thead><tr><th scope="col">Libellé Frais</th><th scope="col">Compte</th><th scope="col">Nbre</th><th scope="col">Montant</th></tr></thead>
              <tbody>
                {(!t || frais.length === 0) && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
                {/* Registre S40-1 : Nbre = 1, ou le nombre de parts pour la part sociale (au moins une, loi 002/2002, art. 22, 2°) ; Montant = Nbre × valeur */}
                {t && frais.map((f, i) => <tr key={i}><td>{f.libelle}</td><td className="chiffres">{f.compte}</td><td className="chiffres">1</td>
                  <td className="chiffres">{f.montant === null ? "" : montant(f.montant, "CDF")}</td></tr>)}
              </tbody>
            </table>
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={vise} onClick={viser}>Viser</button>
          {/* A5 (confrontation du 21/11/2026) : un refus se motive et se garde (loi 22/069, titre III, chap. Ier) */}
          <button className="bouton secondaire" type="button" disabled={!t || t.statut !== "a_viser"} onClick={() => setRefus("")}>Refuser</button>
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
        {t && <Contrat t={t} ctx={ctx} frais={frais} />}
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
    onChange={(e) => { const n = { ...f, [k]: e.target.value }; setF(n); setCherche(n); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setCherche(f); } }} />}</Champ>;
  return (
    <div className="pile">
      <fieldset className="cadre-champs">
        <legend>Filtre</legend>
        <div className="ligne-champ">
          {champ("numero", "Numéro:")}{champ("nom", "Nom:")}{champ("prenom", "Prénom:")}
          <button className="bouton secondaire" type="button" onClick={() => setCherche(f)}>Rechercher</button>
        </div>
      </fieldset>
      <fieldset className="cadre-champs">
        <legend>Resultat</legend>
        <Paginee lignes={liste}>{(visibles) => (<table className="grille">
          <thead><tr><th scope="col">Numéro</th><th scope="col">Nom prénom/raison s.</th><th scope="col">Agence</th></tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
            {visibles.map((t) => (
              <tr key={t.id} className="ligne-choix" tabIndex={0} onClick={() => choisir(t)} onKeyDown={(e) => { if (e.key === "Enter") choisir(t); }}>
                <td className="chiffres">{t.numero}</td><td>{nomComplet(t)}</td><td>{donnees?.ctx.agence.nom ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>)}</Paginee>
      </fieldset>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
    </div>
  );
}

/** S41 : Client > Visa > Modifier frais (manuel Microfina++, p. 53) */
export function ModificationFrais({ initial }: { initial?: Tiers } = {}) {
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [t, setT] = useState<Tiers | null>(initial ?? null);
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
    // La ligne de part garde la valeur des statuts (registre S16-11 ; loi 002/2002, art. 20) : elle ne se modifie pas ici
    const lignes = frais.filter((f) => !f.part).map((f) => ({ fraisId: f.fraisId, montant: saisie(f).trim() ? lireMontant(saisie(f)) : 0 }));
    if (lignes.some((l) => l.montant === null || l.montant < 0)) { setBoite({ type: "erreur", message: "Montant invalide." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.parametrage.modifierFraisClient(t.id, lignes as { fraisId: number; montant: number }[]); setSaisies({}); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h2>Modification de Frais</h2>
      <section className="bloc pile" aria-label="Modification de Frais">
        <div className="deux-colonnes">
          <fieldset className="pile cadre-champs">
            <legend>Informations du membre</legend>
            <div className="ligne-champ">
              <Champ libelle="Numéro du Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              {!initial && <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>}
            </div>
            <Champ libelle="Date Visa">{(p) => <input {...p} className="saisie date" readOnly value={t ? fr(t.dateVisa) : ""} />}</Champ>
            <Champ libelle="Nom ou Raison sociale :">{(p) => <Lecture {...p} value={t ? t.intitule || nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Premier dépôt:">{(p) => <input {...p} className="saisie montant" readOnly value={t ? montant(t.premierDepot, deviseDe(ctx, t)) : ""} />}</Champ>
            <Champ libelle="Date Demande">{(p) => <input {...p} className="saisie date" readOnly value={t ? fr(t.dateDemande) : ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Liste des Frais liés</legend>
            <table className="grille">
              <thead><tr><th scope="col">Libellé</th><th scope="col">Compte</th><th scope="col">Nombre</th><th scope="col">Montant (CDF)</th></tr></thead>
              <tbody>
                {(!t || frais.length === 0) && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
                {t && frais.map((f) => (
                  <tr key={f.fraisId}><td>{f.libelle}</td><td className="chiffres">{f.compte}</td><td></td>
                    <td><input className="saisie montant" inputMode="decimal" autoComplete="off" aria-label={`Montant de ${f.libelle}`} value={saisie(f)} readOnly={f.part}
                      onChange={(e) => setSaisies({ ...saisies, [f.fraisId]: e.target.value })} /></td></tr>
                ))}
              </tbody>
            </table>
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" onClick={modifier}>Modifier</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 53 : écran Modification de Frais, recherche par numéro, nom ou prénoms, montant modifié dans la Liste des frais liés, boutons Modifier et Annuler",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Loi 002/2002, art. 22, 5° : droit d'adhésion fixé, le cas échéant, par l'Assemblée générale",
          "PCCI, § 3.4 : irréversibilité des traitements, aucune modification ultérieure d'un enregistrement validé (frais figés après l'adhésion)"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); setSaisies({}); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Nom d'un agent (S33) d'après son identifiant : la fiche montre la personne choisie, plus une case vide écrite en dur (plan d'allègement, point 0.16 ; registre S40-3) */
type Agents = { gestionnaires?: { id: number; nom: string }[]; sensibilisateurs?: { id: number; nom: string }[]; commerciaux?: { id: number; nom: string }[] } | undefined;
const agent = (l: { id: number; nom: string }[] | undefined, id?: number | null) => (id ? l?.find((a) => a.id === id)?.nom ?? "" : "");

/** Onglets en lecture du bas de l'écran (p. 52) : Info de base, Info Généraux, Autre Info, Personnes Liées, Bénéficiaires */
function DetailClient({ t }: { t: Tiers }) {
  const onglets = ["Info de base", "Info Généraux", "Autre Info", "Personnes Liées", "Héritiers désignés",
    ...(t.type === "morale" ? ["Dirigeant", "Signataires"] : t.type === "groupe" ? ["Membres Groupe"] : [])];
  const [o, setO] = useState(0);
  const { donnees: liees } = useDonnees(() => Promise.all(t.liees.map((id) => api.tiers.lire(id))), [t.id]);
  const { donnees: cx } = useDonnees(() => api.referentiel.contexte() as Promise<Agents>);
  const lu = (libelle: string, v: string) => <Champ libelle={libelle}>{(p) => <Lecture {...p} value={v} />}</Champ>;
  const coche = (libelle: string, v: boolean) => <label className="case"><input type="checkbox" checked={v} disabled /><span>{libelle}</span></label>;
  const reps = (l: Representant[]) => l.length === 0 ? <p>Aucune ligne.</p> : (
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
            <div className="pile">{lu("Sensibilisateur :", agent(cx?.sensibilisateurs, t.sensibilisateurId))}{lu("Gestionnaire :", agent(cx?.gestionnaires, t.gestionnaireId))}{lu("Commercial :", agent(cx?.commerciaux, t.commercialId))}
              {coche("Résident", t.resident)}</div>
          </div>
        )}
        {o === 1 && (
          <div className="formulaire">
            {t.type === "physique" ? <>
              {lu("Nom :", t.nom)}{lu("Post-nom :", t.postnom)}{lu("Prénom :", t.prenom)}{lu("Sexe :", t.sexe === "F" ? "Féminin" : t.sexe === "M" ? "Masculin" : "")}
              {lu("Date de naissance :", fr(t.naissance))}{lu("Lieu de naissance :", t.lieuNaissance)}{lu("Adresse :", t.adresse)}{lu("Téléphone :", t.telephone)}
              {lu("Pièce d'identité :", t.pieceType)}{lu("N° de pièce :", t.pieceNumero)}{lu("Valide jusqu'au :", fr(t.pieceExpire))}
            </> : <>
              {lu("Dénomination :", t.nom)}{lu("Forme juridique :", t.formeJuridique)}{lu(t.type === "groupe" ? "N° du registre ou de l'acte :" : "N° du registre :", t.registre)}
              {lu(t.type === "groupe" ? "Adresse :" : "Adresse du siège :", t.adresse)}{lu("Nature de l'activité :", t.activite)}
              {t.type === "groupe" && <>{lu("Nombre d'Homme :", String(t.nbHommes))}{lu("Nombre de Femme :", String(t.nbFemmes))}</>}
            </>}
          </div>
        )}
        {o === 2 && <div className="formulaire">
          {lu("Activité :", t.typeActivite ?? "")}{lu("Secteur :", enClair(t.secteurActivite ?? ""))}{t.type === "physique" && lu("Profession :", t.profession)}
          {lu("Adresse :", t.adresse)}{lu("BP :", t.bp)}{coche("Personne politiquement exposée", t.personneExposee)}</div>}
        {o === 3 && (!liees || liees.length === 0 ? <p>Aucune ligne.</p> : (
          <table className="grille"><thead><tr><th scope="col">N° du Client</th><th scope="col">Nom</th></tr></thead>
            <tbody>{liees.filter((x): x is Tiers => !!x).map((x) => <tr key={x.id}><td className="chiffres">{x.numero}</td><td>{nomComplet(x)}</td></tr>)}</tbody></table>
        ))}
        {o === 4 && ((t.beneficiaires ?? []).length === 0 ? <p>Aucune ligne.</p> : (
          <table className="grille"><thead><tr><th scope="col">Nom</th><th scope="col">Lien de parenté</th><th scope="col">Téléphone</th></tr></thead>
            <tbody>{(t.beneficiaires ?? []).map((b, i) => <tr key={i}><td>{[b.nom, b.postnom, b.prenom].filter(Boolean).join(" ")}</td><td>{b.filiation}</td><td>{b.telephone}</td></tr>)}</tbody></table>))}
        {onglets[o] === "Dirigeant" && (t.dirigeant ? reps([t.dirigeant]) : <p>Aucune ligne.</p>)}
        {onglets[o] === "Signataires" && reps(t.signataires)}
        {onglets[o] === "Membres Groupe" && reps(t.membres)}
      </div>
    </section>
  );
}

/** Contrat d'adhésion imprimé après le visa (p. 52) : versements initiaux détaillés et héritiers désignés sous leur rubrique (plan d'allègement, point 3.7). */
function Contrat({ t, ctx, frais }: { t: Tiers; ctx: Ctx; frais: { montant: number | null; part: boolean }[] }) {
  const inst = ctx.institution.nom, m = mots(ctx.institution);   // registre S40-2 : membre pour une COOPEC, client pour une IMF
  const devise = deviseDe(ctx, t), partSociale = frais.filter((x) => x.part).reduce((a, x) => a + (x.montant ?? 0), 0), droits = frais.filter((x) => !x.part).reduce((a, x) => a + (x.montant ?? 0), 0);
  const ligne = (a: string, b: string) => <p className="contrat-ligne"><span>{a}</span><strong>{b}</strong></p>;
  return (
    <article className="contrat">
      <h3>DEMANDE D'ADHÉSION</h3>
      <div className="contrat-deux">
        {ligne("Je soussigné(e) :", t.intitule || nomComplet(t))}{ligne("N°", t.numero)}
        {ligne("Profession :", t.profession)}{ligne("Né(e)", fr(t.naissance))}
        {ligne("Fils de :", t.pere ?? "")}{ligne("et de", t.mere ?? "")}
        {ligne("Adresse :", t.adresse)}{ligne("Téléphone :", t.telephone)}
      </div>
      {ligne("Sollicite mon adhésion à", inst)}
      <p>Je m'engage à respecter ses statuts, ses règlements et les décisions des organes d'administration, à défendre les intérêts de {inst} et à être loyal(e) envers elle.</p>
      <h4>VERSEMENTS INITIAUX</h4>
      {/* Part sociale, droit d'adhésion, premier dépôt, puis le total par devise (loi 002/2002, art. 22 ; plan d'allègement, point 3.7) */}
      <div className="contrat-deux">
        {ligne("Part sociale", montant(partSociale, "CDF"))}{ligne("Droit d'adhésion", montant(droits, "CDF"))}
        {ligne("Premier dépôt", montant(t.premierDepot, devise))}
        {devise === "CDF" ? ligne("Total", montant(partSociale + droits + t.premierDepot, "CDF"))
          : <>{ligne("Total (CDF)", montant(partSociale + droits, "CDF"))}{ligne(`Total (${devise})`, montant(t.premierDepot, devise))}</>}
      </div>
      {(t.beneficiaires ?? []).length > 0 && <>
        <h4>HÉRITIERS DÉSIGNÉS</h4>
        <div className="contrat-deux">{(t.beneficiaires ?? []).map((b, i) => <Fragment key={i}>{ligne(`${[b.nom, b.postnom, b.prenom].filter(Boolean).join(" ")}`, b.filiation)}</Fragment>)}</div>
      </>}
      <div className="contrat-deux">{ligne("Fait à", ctx.agence.nom)}{ligne("le", fr(t.dateVisa))}</div>
      <p className="contrat-signature">Signature</p>
      <h4>DÉCISION DU CONSEIL D'ADMINISTRATION</h4>
      {t.admissionReference
        ? <p>Admission approuvée le {fr(t.admissionLe ?? "")} : {t.admissionReference}.</p>
        : <p>Le Conseil d'Administration de {inst}, réuni le {fr(t.dateVisa)}, « approuve, met en instance, rejette » la présente.</p>}
      <p>« Rayer les mentions inutiles et préciser les raisons de la mise en instance et du rejet sur la ligne en dessous »</p>
      {ligne(`Le nouveau ${m.membre} est inscrit au registre des ${m.membres.toLowerCase()}`, t.numero)}
      <h4>HÉRITIER DÉSIGNÉ</h4>
      <p>En cas de décès, j'autorise {inst} à déduire de mes avoirs ce que je lui dois.</p>
      <p>Par ailleurs, je lui ordonne de verser le reste de mes avoirs à</p>
    </article>
  );
}

/** S42 : Client > Visa > Valider client modifié (manuel Microfina++, p. 54) : Numéro du Client*, Intitulé, Catégorie, activer client, Annuler, comptes du membre */
export function ValidationClientModifie({ initial, fait }: { initial?: Tiers; fait?: () => void } = {}) {
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [t, setT] = useState<Tiers | null>(initial ?? null);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  // Ce que la personne qui valide doit voir : la modification en attente, champ par champ, avec son auteur et sa date (Instr. BCC 008, art. 66 ;
  // Instr. BCC 15, art. 10 ; plan d'allègement, point 0.16 ; registre S42-1)
  const { donnees: modifs } = useDonnees(() => (t ? api.tiers.modifications(t.id) : Promise.resolve([])), [t?.id]);
  if (!ctx) return <Chargement />;
  const attente = [...(modifs ?? [])].reverse().find((m) => !m.validePar);
  const changes = attente ? CHAMPS_SUIVIS.filter(([k]) => enTexte(attente.avant[k]) !== enTexte(attente.apres[k])) : [];
  const auteur = attente ? ((ctx as { utilisateurs?: { id: number; nom: string }[] }).utilisateurs ?? []).find((x) => x.id === attente.modifiePar)?.nom ?? "" : "";
  function activer() {
    if (!t) { setBoite({ type: "erreur", message: "À remplir : numéro du client." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.tiers.activer(t.id); setT(null); fait?.(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h2>Validation d'un client modifié</h2>
      <section className="bloc pile" aria-label="Validation d'un client modifié">
        <fieldset className="pile cadre-champs">
          <legend>Informations sur le Client</legend>
          <div className="ligne-champ">
            <Champ libelle="Numéro du Client :">{(p) => <input {...p} className="saisie code" readOnly required value={t?.numero ?? ""} />}</Champ>
            {!initial && <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>}
          </div>
          <Champ libelle="Intitulé :">{(p) => <Lecture {...p} value={t ? t.intitule || nomComplet(t) : ""} />}</Champ>
          <Champ libelle="Nature :">{(p) => <Lecture {...p} value={t ? ({ physique: "Personne physique", morale: "Entreprise", groupe: "Groupe" } as const)[t.type] : ""} />}</Champ>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={activer}>activer client</button>
          <button className="bouton secondaire" type="button" onClick={() => setT(null)}>Annuler</button>
        </div>
        {t && <fieldset className="pile cadre-champs">
          <legend>Modification à valider</legend>
          {!attente ? <p>Aucune modification en attente pour ce client.</p> : <>
            <p>Modifiée le {fr(attente.modifieLe.slice(0, 10))}{auteur ? ` par ${auteur}` : ""}.</p>
            <table className="grille" aria-label="Modification à valider">
              <thead><tr><th scope="col">Champ</th><th scope="col">Avant</th><th scope="col">Après</th></tr></thead>
              <tbody>{changes.length === 0 ? <tr><td colSpan={3}>Aucun champ suivi n'a changé.</td></tr>
                : changes.map(([k, l]) => <tr key={k}><td>{l}</td><td>{enTexte(attente.avant[k])}</td><td>{enTexte(attente.apres[k])}</td></tr>)}</tbody>
            </table></>}
        </fieldset>}
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
  ["lieuNaissance", "Lieu de naissance"], ["adresse", "Adresse"], ["telephone", "Téléphone"], ["pieceType", "Pièce d'identité"], ["pieceNumero", "N° de pièce"],
  ["pieceExpire", "Valide jusqu'au"], ["typeClient", "Type Client"], ["zone", "Zone"], ["resident", "Résident"],
  ["personneExposee", "Personne politiquement exposée"], ["liees", "Personnes liées"]];
const enTexte = (v: unknown) => (typeof v === "boolean" ? (v ? "Oui" : "Non") : Array.isArray(v) ? v.join(", ") : /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? fr(String(v)) : String(v ?? ""));

/** S43 : Client > Consulter client (manuel Microfina++, p. 54) : informations initiales et actuelles du client */
/** Un écran ouvert depuis la fiche du membre reçoit le membre par « ?tiers= » et n'a plus besoin de sa propre recherche (plan d'allègement, point 3.8) */
export function useTiersDeLAdresse(choisir: (t: Tiers) => void) {
  const [params] = useSearchParams();
  const id = Number(params.get("tiers")) || null;
  useEffect(() => { if (id) api.tiers.lire(id).then((t) => { if (t) choisir(t); }, () => undefined); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
}

/** S43 : Membre > Fiche du membre (manuel Microfina++, p. 54). La porte d'entrée : on cherche le membre une fois, on voit ses onglets, on agit par des boutons
 *  (plan d'allègement, point 3.8) */
export function InformationsClient() {
  const nav = useNavigate();
  const { donnees: ctx } = useDonnees(() => api.referentiel.contexte());
  const [t, setT] = useState<Tiers | null>(null);
  const [onglet, setOnglet] = useState(0);
  const [recherche, setRecherche] = useState(false);
  useTiersDeLAdresse((x) => { setT(x); setOnglet(0); });
  const { donnees: detail } = useDonnees(async () => t
    ? { images: await api.tiers.images(t.id), modifications: await api.tiers.modifications(t.id), comptes: await api.tiers.comptes(t.id), parts: await api.tiers.parts(t.id), adhesion: await api.tiers.adhesion(t.id),
        credits: await api.tiers.credits(t.id), procurations: await api.procurations.duClient(t.id).catch(() => []),
        solidaires: t.type === "groupe" ? await api.groupes.duTiers(t.id) : [],   // plan 3.12
        noms: Object.fromEntries(await Promise.all([...(t.liees ?? []), ...(t.beneficiairesEffectifs ?? [])].map(async (id) => [id, await api.tiers.lire(id).then((x) => (x ? `${x.numero} ${x.intitule || nomComplet(x)}` : String(id)), () => String(id))] as const))) as Record<number, string> }
    : null, [t?.id]);
  if (!ctx) return <Chargement />;
  const onglets = ["Identité", "Adresse et activité", "Personnes", "Photos et pièces", "Comptes", "Crédits", "Parts", "Procurations", "Historique"];
  const lu = (libelle: string, v: string) => <Champ libelle={libelle}>{(p) => <Lecture {...p} value={v} />}</Champ>;
  const initial = detail?.modifications[0]?.avant;
  const ecarts = t && initial ? CHAMPS_SUIVIS.filter(([k]) => enTexte(initial[k]) !== enTexte(t[k])) : [];
  const nomUtil = (id?: number) => ((ctx as { utilisateurs?: { id: number; nom: string }[] }).utilisateurs ?? []).find((x) => x.id === id)?.nom ?? "";
  const ouvrir = (ecranId: string) => t && nav(vers(ecranId, `?tiers=${t.id}`));
  const personne = (r: { nom: string; postnom?: string; prenom?: string }) => [r.nom, r.postnom, r.prenom].filter(Boolean).join(" ");
  const liste = (titre: string, noms: string[]) => noms.length > 0 && <><h3>{titre}</h3><ul>{noms.map((n, i) => <li key={i}>{n}</li>)}</ul></>;
  const image = (titre: string, src: string | null | undefined) => <figure className="apercu"><figcaption>{titre}</figcaption>{src ? <img src={src} alt={titre} /> : <span className="muet">Aucun document</span>}</figure>;
  return (
    <>
      <h2>Fiche du membre</h2>
      <section className="bloc pile" aria-label="Client">
        <div className="formulaire">
          <div className="ligne-champ">
            <Champ libelle="N° Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          {lu("Intitulé :", t ? t.intitule || nomComplet(t) : "")}
          {lu("Date d'adhésion :", detail?.adhesion ? fr(detail.adhesion) : "")}
        </div>
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!t || t.statut === "resilie"} onClick={() => ouvrir("S46")}>Modifier</button>
          <button className="bouton secondaire" type="button" disabled={!t || t.statut !== "actif"} onClick={() => ouvrir("S47")}>Procurations</button>
          <button className="bouton secondaire" type="button" disabled={!t || t.statut !== "actif"} onClick={() => ouvrir("S48")}>Résilier</button>
        </div>
      </section>
      <div className="onglets" role="tablist" aria-label="Fiche du membre">
        {onglets.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {t && onglet === 0 && <div className="formulaire">
          {t.type === "physique" ? <>
            {lu("Nom :", t.nom)}{lu("Post-nom :", t.postnom)}{lu("Prénom :", t.prenom)}{lu("Sexe :", t.sexe === "F" ? "Féminin" : t.sexe === "M" ? "Masculin" : "")}
            {lu("Date de naissance :", fr(t.naissance))}{lu("Lieu de naissance :", t.lieuNaissance)}
            {lu("Pièce d'identité :", t.pieceType)}{lu("N° de pièce :", t.pieceNumero)}{lu("Valide jusqu'au :", fr(t.pieceExpire))}
            {lu("Personne politiquement exposée :", enTexte(t.personneExposee))}
          </> : <>
            {lu("Dénomination :", t.nom)}{lu("Forme juridique :", t.formeJuridique)}{lu("N° du registre :", t.registre)}
          </>}
          {lu("Date demande :", fr(t.dateDemande))}{lu("Date Visa :", fr(t.dateVisa))}{lu("ICU (BCC) :", t.icu ?? "")}
        </div>}
        {t && onglet === 1 && <>
          <div className="formulaire">
            {lu("Adresse :", t.adresse)}{lu("Téléphone :", t.telephone)}{lu("Résident :", enTexte(t.resident))}
            {lu("Activité :", t.typeActivite || t.activite)}{lu("Secteur :", enClair(t.secteurActivite ?? ""))}{t.type === "physique" && lu("Profession :", t.profession)}
            {lu("Zone :", t.zone)}{lu("Gestionnaire :", agent((ctx as Agents)?.gestionnaires, t.gestionnaireId))}
            {lu("Commercial :", agent((ctx as Agents)?.commerciaux, t.commercialId))}{lu("Sensibilisateur :", agent((ctx as Agents)?.sensibilisateurs, t.sensibilisateurId))}
          </div>
          {/* Un membre qui déménage : chaque ancienne adresse reste, avec la date du changement (registre T41 ; loi 22/068, art. 48 : conservation) */}
          <h3>Adresses successives</h3>
          <table className="grille" aria-label="Adresses successives">
            <thead><tr><th scope="col">Adresse</th><th scope="col">Jusqu'au</th><th scope="col">Changement validé</th></tr></thead>
            <tbody>
              {(detail?.modifications ?? []).filter((m) => (m.avant.adresse ?? "") !== (m.apres.adresse ?? "")).map((m) =>
                <tr key={m.modifieLe}><td>{m.avant.adresse}</td><td>{fr(m.modifieLe.slice(0, 10))}</td><td>{m.validePar ? "Oui" : "En attente"}</td></tr>)}
              <tr><td>{t.adresse}</td><td>Adresse actuelle</td><td></td></tr>
            </tbody>
          </table>
        </>}
        {t && onglet === 2 && <>
          {t.dirigeant && liste("Dirigeant", [personne(t.dirigeant)])}
          {liste("Signataires", (t.signataires ?? []).map(personne))}
          {liste("Membres du groupe", [...(t.membres ?? []).map(personne), ...(detail?.solidaires ?? []).map((m) => `${m.numero} ${m.membre}`)])}
          {liste("Héritiers désignés", (t.beneficiaires ?? []).map((b) => `${personne(b)}${b.filiation ? ` (${b.filiation})` : ""}`))}
          {liste("Personnes liées", (t.liees ?? []).map((x) => detail?.noms[x] ?? ""))}
          {liste("Bénéficiaires effectifs", (t.beneficiairesEffectifs ?? []).map((x) => detail?.noms[x] ?? ""))}
          {t.apparente && liste("Apparenté à l'institution", [({ actionnaire: "Actionnaire ou membre fondateur", administrateur: "Administrateur", dirigeant: "Dirigeant", personnel: "Personnel",
            famille: "Famille au premier degré", societe_liee: "Société liée", contrat: "Lié par un contrat" } as Record<string, string>)[t.apparente] ?? t.apparente])}
        </>}
        {t && onglet === 3 && <div className="formulaire">
          {t.type === "morale" ? <>{image("Copie des statuts", detail?.images.copiePiece)}{image("Copie du registre", detail?.images.justificatifAdresse)}</> : <>
            {image("Photo", detail?.images.photo)}{image("Signature", detail?.images.signature)}{image("Copie de la pièce d'identité", detail?.images.copiePiece)}
            {image("Justificatif d'adresse", detail?.images.justificatifAdresse)}{t.type === "physique" && image("Pièce d'habilitation professionnelle", detail?.images.copieHabilitation)}</>}
        </div>}
        {t && onglet === 4 && (
          <table className="grille" aria-label="Comptes du membre">
            <thead><tr><th scope="col">N° Compte</th><th scope="col">Produit</th><th scope="col">Solde</th><th scope="col">Bloqué</th><th scope="col">Disponible</th></tr></thead>
            <tbody>
              {(!detail || detail.comptes.length === 0) && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
              {detail?.comptes.map((c) => <tr key={c.id}><td className="chiffres">{c.numero}</td><td>{c.intitule} {c.devise}</td>
                <td className="chiffres">{montant(c.solde, c.devise)}</td><td className="chiffres">{montant(c.bloque, c.devise)}</td><td className="chiffres">{montant(c.disponible, c.devise)}</td></tr>)}
            </tbody>
          </table>
        )}
        {t && onglet === 5 && ((detail?.credits ?? []).length === 0 ? <p>Aucune ligne.</p> : (
          <table className="grille" aria-label="Crédits du membre"><thead><tr><th scope="col">N° crédit</th><th scope="col">Produit</th><th scope="col" className="num">Montant</th>
            <th scope="col">Débloqué le</th><th scope="col">État</th></tr></thead>
            <tbody>{detail!.credits.map((c) => <tr key={c.numero}><td className="code">{c.numero}</td><td>{c.produit}</td><td className="num chiffres">{montant(c.montant, c.devise as Devise)}</td>
              <td className="chiffres">{c.debloqueLe ? fr(c.debloqueLe) : ""}</td><td>{c.etat}</td></tr>)}</tbody></table>))}
        {t && onglet === 6 && <div className="formulaire">
          {lu("Nombre de parts :", String(detail?.parts ?? 0))}{lu("Valeur des parts :", montant((detail?.parts ?? 0) * (ctx.valeurPart ?? 0), "CDF"))}
        </div>}
        {t && onglet === 7 && (
          <table className="grille" aria-label="Procurations du membre">
            <thead><tr><th scope="col">Mandataire</th><th scope="col">Type</th><th scope="col">Du</th><th scope="col">Au</th><th scope="col">État</th></tr></thead>
            <tbody>
              {(detail?.procurations ?? []).length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
              {(detail?.procurations ?? []).map((x) => <tr key={x.id}><td>{personne(x)}</td><td>{x.type}</td><td className="chiffres">{fr(x.dateDebut)}</td>
                <td className="chiffres">{fr(x.dateFin)}</td><td>{x.enCours ? "En cours" : x.finLe ? `Fin le ${fr(x.finLe)}` : "Terminée"}</td></tr>)}
            </tbody>
          </table>
        )}
        {t && onglet === 8 && <>
          <h3>Informations initiales et actuelles</h3>
          {ecarts.length === 0 ? <p>Aucune modification.</p> : (
            <table className="grille" aria-label="Informations initiales et actuelles">
              <thead><tr><th scope="col">Champ</th><th scope="col">Initial</th><th scope="col">Actuel</th></tr></thead>
              <tbody>{ecarts.map(([k, l]) => <tr key={k}><td>{l}</td><td>{enTexte(initial![k])}</td><td>{enTexte(t[k])}</td></tr>)}</tbody>
            </table>
          )}
          <h3>Modifications</h3>
          <table className="grille" aria-label="Modifications de la fiche">
            <thead><tr><th scope="col">Le</th><th scope="col">Par</th><th scope="col">Validée</th></tr></thead>
            <tbody>
              {(detail?.modifications ?? []).length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
              {(detail?.modifications ?? []).map((m) => <tr key={m.modifieLe}><td className="chiffres">{fr(m.modifieLe.slice(0, 10))}</td><td>{nomUtil(m.modifiePar)}</td>
                <td>{m.validePar ? `Oui, par ${nomUtil(m.validePar)}` : "En attente"}</td></tr>)}
            </tbody>
          </table>
        </>}
        {!t && <p className="muet">Rechercher d'abord le membre.</p>}
        <Textes sources={["Manuel Microfina++, p. 54 : écran Informations client, recherche par le bouton du champ Numéro client, informations initiales et actuelles ; la fiche devient la porte d'entrée (plan d'allègement, point 3.8)",
          "Loi 002/2002, art. 22, 2° et 5° : part sociale libérée et droit d'adhésion acquitté ; la Date d'adhésion est celle de l'encaissement en caisse"]} />
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
  useTiersDeLAdresse(setT);   // ouvert depuis la fiche du membre (plan 3.8)
  const [motif, setMotif] = useState("");
  const [deces, setDeces] = useState({ date: "", reference: "" });   // A16
  const [exclusion, setExclusion] = useState({ reference: "", date: "" });   // P1
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  const { donnees: j } = useDonnees(() => api.journees.courante());
  if (!ctx) return <Chargement />;
  const lu = (libelle: string, v: string) => <Champ libelle={libelle}>{(p) => <Lecture {...p} value={v} />}</Champ>;
  const resilie = t?.statut === "resilie";
  const jour = resilie ? t!.resilieLe : j?.statut === "ouverte" ? j.date : "";
  const devises = [...new Set((comptes ?? []).map((c) => c.devise))];
  function resilier() {
    if (!t) { setBoite({ type: "erreur", message: "Rechercher d'abord le client." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment résilier ce client ?", oui: async () => {
      try {
        // Une seule liste de motifs ; le décès se déclare avec la résiliation (plan d'allègement, point 3.13)
        if (motif === "Décès" && !t.decesLe) await api.tiers.declarerDeces(t.id, deces);
        setT(await api.tiers.resilier(t.id, { motif, ...(motif.startsWith("Exclusion") ? { exclusion } : {}) }));
        setExclusion({ reference: "", date: "" }); setDeces({ date: "", reference: "" }); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h2>Résiliation du contrat client</h2>
      <section className="bloc pile a-imprimer" aria-label="Résiliation du contrat client">
        <div className="formulaire">
          <div className="ligne-champ">
            <Champ libelle="N° Client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire sans-impression" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          {lu("Intitulé", t ? t.intitule || nomComplet(t) : "")}{lu("Nature", t ? ({ physique: "Personne physique", morale: "Entreprise", groupe: "Groupe" } as Record<string, string>)[t.type] ?? "" : "")}
        </div>
        <fieldset className="cadre-champs formulaire">
          <legend>Informations générales du client</legend>
          {lu("Activité :", t?.typeActivite ?? "")}{lu("Secteur :", enClair(t?.secteurActivite ?? ""))}
          {lu(t?.type === "physique" ? "Nom :" : "Raison sociale :", t ? nomComplet(t) : "")}{t?.type !== "physique" && lu("RCCM :", t?.registre ?? "")}
          {lu("Créé le :", t ? fr(t.creeLe) : "")}{t?.type === "physique" && lu("Nationalité :", t?.nationalite ?? "")}
          {lu("Pièce d'identité :", t?.pieceType ?? "")}{lu("Numéro de pièce :", t?.pieceNumero ?? "")}
          {lu("Établie à :", t?.pieceLieu ?? "")}{lu("Date d'expiration :", t ? fr(t.pieceExpire) : "")}
          {t?.type === "groupe" && <>{lu("Type de Groupement :", t.typeClient)}{lu("Nombre d'Homme :", String(t.nbHommes))}{lu("Nombre de Femme :", String(t.nbFemmes))}</>}
        </fieldset>
        <div className="deux-colonnes">
          <div className="formulaire">
            {lu("Résilié le", fr(jour))}
            <Champ libelle="Motif *">{(p) => resilie
              ? <Lecture {...p} value={t!.motifDepart} />
              : <select {...p} className="saisie" required value={motif} onChange={(e) => setMotif(e.target.value)}><option value=""></option>
                  {ctx.motifsDepart.filter((m) => m !== "Décès" || t?.type === "physique").map((m) => <option key={m} value={m}>{enClair(m)}</option>)}</select>}</Champ>
            {/* Chaque motif ouvre les champs qu'il exige : décision du Conseil d'administration (loi 002/2002, art. 25), acte de décès (plan 3.13) */}
            {resilie && t?.exclusionReference && <p>Exclusion : décision {t.exclusionReference} du {fr(t.exclusionLe ?? "")}</p>}
            {resilie && t?.decesLe && <p>Décédé le <strong className="chiffres">{fr(t.decesLe)}</strong>, acte {t.decesReference}.</p>}
            {!resilie && motif.startsWith("Exclusion") && <>
              <Champ libelle="Référence de la décision : *">{(p) => <input {...p} className="saisie" value={exclusion.reference} onChange={(e) => setExclusion({ ...exclusion, reference: e.target.value })} />}</Champ>
              <ChampDate libelle="Date de la décision : *" valeur={exclusion.date} onChange={(v) => setExclusion({ ...exclusion, date: v })} requis />
            </>}
            {!resilie && motif === "Décès" && t && (t.decesLe ? <p>Décédé le <strong className="chiffres">{fr(t.decesLe)}</strong>, acte {t.decesReference}.</p> : <>
              <ChampDate libelle="Date du décès : *" valeur={deces.date} onChange={(v) => setDeces({ ...deces, date: v })} requis />
              <Champ libelle="Référence de l'acte de décès : *">{(p) => <input {...p} className="saisie" value={deces.reference} onChange={(e) => setDeces({ ...deces, reference: e.target.value })} />}</Champ>
            </>)}
          </div>
          {/* Aucun frais de résiliation : la clôture de compte est gratuite (Instr. BCC 37, annexe, point 1 ; plan d'allègement, point 0.15) */}
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
            {(!t || !comptes || comptes.length === 0) && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
            {t && comptes?.map((c) => <tr key={c.id}><td>{c.intitule} {c.devise}</td><td className="chiffres">{montant(Math.max(0, -c.solde), c.devise)}</td><td className="chiffres">{montant(Math.max(0, c.solde), c.devise)}</td></tr>)}
            {t && devises.map((d) => {
              const l = comptes!.filter((c) => c.devise === d);
              return <tr key={d}><th scope="row">Total {d}</th><td className="chiffres">{montant(l.reduce((s, c) => s + Math.max(0, -c.solde), 0), d)}</td><td className="chiffres">{montant(l.reduce((s, c) => s + Math.max(0, c.solde), 0), d)}</td></tr>;
            })}
          </tbody>
        </table>
        {t && devises.map((d) => <p key={d}>Solde Créditeur {d} : <strong className="chiffres">{montant(comptes!.filter((c) => c.devise === d).reduce((s, c) => s + c.solde, 0), d)}</strong></p>)}
        <Textes sources={["Manuel Microfina++, p. 57 : écran Résiliation du contrat client (N° Client, Informations générales, Résilié le, Motif*, Frais de résiliation, Résilier, Imprimer, soldes)",
          "Loi 002/2002, art. 24 : un membre emprunteur ou endosseur d'un prêt ne peut pas se retirer ; art. 27 : apurement à la perte de la qualité de membre, comptes soldés avant la résiliation",
          "Loi 002/2002, art. 22 : au moins une part pour rester membre ; les parts sont remboursées après la résiliation (Caisse > Part sociale)",
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
export function lireImage(f: File): Promise<string> {
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
  useTiersDeLAdresse((x) => setT(x));   // ouvert depuis la fiche du membre (plan 3.8)
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [piece, setPiece] = useState<string | null>(null);
  const [adresse, setAdresse] = useState<string | null>(null);
  const [habilitation, setHabilitation] = useState<string | null>(null);   // A7
  const [recherche, setRecherche] = useState(false);
  const [capture, setCapture] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: actuelles } = useDonnees(() => (t ? api.tiers.images(t.id) : Promise.resolve({ photo: null, signature: null, copiePiece: null, justificatifAdresse: null, copieHabilitation: null })), [t?.id]);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const choisir = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]; e.target.value = "";
    if (fichier) lireImage(fichier).then(f, erreur);
  };
  const annuler = () => { setT(null); setPhoto(null); setSignature(null); setPiece(null); setAdresse(null); setHabilitation(null); };
  const genre = t?.type === "morale" ? "Personne morale" : t?.type === "groupe" ? "Groupe" : "Membre physique";
  const signataires = t?.type === "morale" ? t.signataires : t?.type === "groupe" ? t.membres : [];
  const apercuPhoto = photo ?? actuelles?.photo ?? null, apercuSignature = signature ?? actuelles?.signature ?? null;
  const apercuPiece = piece ?? actuelles?.copiePiece ?? null, apercuAdresse = adresse ?? actuelles?.justificatifAdresse ?? null;
  /** Écart E03 : copie de la pièce d'identité et justificatif d'adresse (Instr. BCC 15, art. 12 et 29), sur le modèle du cadre Signature */
  const cadreImage = (titre: string, apercu: string | null, poser: (v: string) => void) => (
    <fieldset className="pile cadre-champs">
      <legend>{titre}</legend>
      <div className="actions-ligne">
        <label className={`bouton secondaire${t ? "" : " inactif"}`}>Choisir un fichier<input className="sr-only" type="file" accept="image/png,image/jpeg" aria-label={`Choisir : ${titre}`} disabled={!t} onChange={choisir(poser)} /></label>
      </div>
      <div className="cadre-signature apercu-grand">{apercu ? <img src={apercu} alt={`Aperçu : ${titre}`} /> : t && <p className="muet">Aucune image déposée</p>}</div>
    </fieldset>);
  return (
    <>
      <h2>Modification ou Ajout (Photo/Signature) : {genre}</h2>
      <section className="bloc pile" aria-label="Client">
        <div className="formulaire">
          <div className="ligne-champ">
            <Champ libelle="N° client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          <Champ libelle="Intitulé">{(p) => <Lecture {...p} value={t ? t.intitule || nomComplet(t) : ""} />}</Champ>
          <Champ libelle="Nature">{(p) => <Lecture {...p} value={t ? ({ physique: "Personne physique", morale: "Entreprise", groupe: "Groupe" } as const)[t.type] : ""} />}</Champ>
        </div>
      </section>
      <section className="bloc pile" aria-label="Photo et signature">
        <div className="photos-signataires">
          <div className="pile">
            <fieldset className="pile cadre-champs">
              <legend>Photo client</legend>
              <div className="actions-ligne">
                <button className="bouton secondaire" type="button" disabled={!t} onClick={() => setCapture(true)}>Capturer</button>
                <label className={`bouton secondaire${t ? "" : " inactif"}`}>Choisir un fichier<input className="sr-only" type="file" accept="image/png,image/jpeg" disabled={!t} onChange={choisir(setPhoto)} /></label>
              </div>
              <p className="muet">APERCU PHOTO</p>
              <div className="cadre-signature apercu-grand">{apercuPhoto && <img src={apercuPhoto} alt="Aperçu de la photo" />}</div>
            </fieldset>
            <fieldset className="pile cadre-champs">
              <legend>Signature client</legend>
              <div className="actions-ligne">
                <label className={`bouton secondaire${t ? "" : " inactif"}`}>Choisir un fichier<input className="sr-only" type="file" accept="image/png,image/jpeg" disabled={!t} onChange={choisir(setSignature)} /></label>
              </div>
              <p className="muet">APERCU SIGNATURE</p>
              <div className="cadre-signature apercu-grand">{apercuSignature && <img src={apercuSignature} alt="Aperçu de la signature" />}</div>
            </fieldset>
            {cadreImage(t?.type === "morale" ? "Copie des statuts" : "Copie de la pièce d'identité", apercuPiece, setPiece)}
            {cadreImage(t?.type === "morale" ? "Copie du registre (acte de constitution)" : "Justificatif d'adresse", apercuAdresse, setAdresse)}
            {/* A7 : loi 22/068, art. 33, al. 4 ; Instr. BCC 15, art. 13, al. 2 et 29 */}
            {t?.type === "physique" && cadreImage("Pièce d'habilitation professionnelle", habilitation ?? actuelles?.copieHabilitation ?? null, setHabilitation)}
          </div>
          <div className="pile">
            <fieldset className="pile cadre-champs">
              <legend>Liste des Signataires</legend>
              <table className="grille">
                <thead><tr><th scope="col">Nom</th><th scope="col">Prénom</th><th scope="col">Actif</th><th scope="col">Adresse</th><th scope="col">Action</th></tr></thead>
                <tbody>
                  {signataires.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
                  {signataires.map((r, i) => <tr key={i}><td>{r.nom}</td><td>{r.prenom}</td><td>Oui</td><td>{r.adresse}</td><td></td></tr>)}
                </tbody>
              </table>
            </fieldset>
            <div className="actions-onglets">
              <button className="bouton" type="button" disabled={!t || (!photo && !signature && !piece && !adresse && !habilitation)} onClick={() => t && setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
                try { await api.tiers.changerSpecimen(t.id, { ...(photo ? { photo } : {}), ...(signature ? { signature } : {}), ...(piece ? { copiePiece: piece } : {}), ...(adresse ? { justificatifAdresse: adresse } : {}), ...(habilitation ? { copieHabilitation: habilitation } : {}) }); annuler(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
                catch (x) { erreur(x); }
              } })}>Valider les Modifications</button>
              <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
            </div>
          </div>
        </div>
        <Textes sources={["Manuel Microfina++, p. 58 : écran Modification ou Ajout (Photo/Signature), Capturer, Choisir, aperçus, Liste des Signataires, Valider les Modifications, Annuler",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Chaque dépôt garde son auteur et sa date ; le dernier dépôt fait foi au guichet",
          "Instr. BCC 15, art. 12 et 29 : copie de la pièce d'identité et document prouvant l'adresse, gardés dix ans (art. 48)",
          "Personne morale : loi 22/068, art. 34 ; Instr. BCC 15, art. 17 a et 29 : copie des statuts et du registre"]} />
      </section>
      <Capture ouverte={capture} fermer={() => setCapture(false)} prise={(v) => (v.length > IMAGE_MAX ? erreur(new Error("Image trop lourde : 300 Ko au plus.")) : setPhoto(v))} />
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut !== "prospect" && x.statut !== "resilie") : [])}
          choisir={(x) => { setT(x); setPhoto(null); setSignature(null); setPiece(null); setAdresse(null); setHabilitation(null); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

