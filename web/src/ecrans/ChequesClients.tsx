// S59 : Banque > Gestion Chèque Client (manuel Microfina++, p. 68 et 69) : Dépôt chèque ; Liste des chèques (Encaisser et Historique réunis, plan d'allègement 7.16).
// Le dépôt est enregistré en attente ; l'encaissement ou le retour se fait sur le compte bancaire choisi ; la comptabilisation vient en S111 (registre S59-4).
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { lireMontant, montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Lecture, Formulaire } from "../composants";
import { RechercheClient } from "./Visa";
import { ChoixBanque } from "./OperationsBanque";

const ONGLETS = ["Dépôt chèque", "Liste des chèques"] as const;   // plan d'allègement 7.16 : un onglet avec un filtre Statut au lieu de « Encaisser » et « Historique »
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const VIDE = { date: "", compte: "", numero: "", tireur: "", banqueTireur: "", montant: "", banque: "", compteBanque: "", deposant: "", pieceNumero: "", pieceType: "", etabliA: "", expire: "" };

export function ChequesClients() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), lu: await api.banqueOperations.lire() }));
  const [onglet, setOnglet] = useState(0);
  const [f, setF] = useState(VIDE);
  const [t, setT] = useState<Tiers | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [dateEnc, setDateEnc] = useState("");
  const [relu, setRelu] = useState(0);
  const [statut, setStatut] = useState<"depose" | "encaisse" | "retourne" | "">("depose");
  const [parTitulaire, setParTitulaire] = useState(true);   // Instr. BCC 15, art. 11 : le déposant qui n'est pas le titulaire est identifié
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  const cb = Number(f.compteBanque) || 0;
  const { donnees: cheques } = useDonnees(() => (onglet > 0 && cb ? api.chequesClients.lister(cb, statut) : Promise.resolve([])), [onglet, cb, statut, relu]);
  if (!donnees) return <Chargement />;
  const { ctx, lu } = donnees;
  const maj = (p: Partial<typeof VIDE>) => setF({ ...f, ...p });
  const date = f.date || lu.date;
  // Une seule valeur possible : prise d'office (plan d'allègement, point 1.11)
  const compteF = f.compte || (comptes?.length === 1 ? String(comptes[0]!.id) : "");
  const cc = (comptes ?? []).find((c) => String(c.id) === compteF);
  const m = lireMontant(f.montant);
  const vider = () => { setF(VIDE); setT(null); setCle(nouvelleCle()); setChoisi(null); setDateEnc(""); setParTitulaire(true); };
  const changerOnglet = (i: number) => { setOnglet(i); vider(); };

  function enregistrer() {
    const d = { cle, date, compteDepotId: compteF ? Number(compteF) : undefined, compteBancaireId: cb || undefined, numeroCheque: f.numero, tireur: f.tireur, banqueTireur: f.banqueTireur,
      montant: m ?? 0, ...(parTitulaire ? { deposant: t ? nomComplet(t) : "", pieceType: "", pieceNumero: "", etabliA: "", dateExpiration: "" }
        : { deposant: f.deposant, pieceType: f.pieceType, pieceNumero: f.pieceNumero, etabliA: f.etabliA, dateExpiration: f.expire }) };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.chequesClients.deposer(d); vider(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  function traiter(action: "encaisser" | "retourner") {
    if (choisi === null) { setBoite({ type: "erreur", message: "Cliquez d'abord sur la ligne du chèque." }); return; }
    setBoite({ type: "confirmation", message: action === "encaisser" ? "Voulez-vous vraiment encaisser ?" : "Voulez-vous vraiment retourner ?", oui: async () => {
      try { await api.chequesClients.traiter(choisi, action, { dateEncaissement: dateEnc }); setChoisi(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const lu_ = (libelle: string, v: string) => <Champ libelle={libelle}>{(p) => <Lecture {...p} value={v} />}</Champ>;
  const bancaire = (
    <ChoixBanque lu={lu} libelleBanque="Banque *" libelleCompte="Compte Bancaire *" banque={f.banque} compte={f.compteBanque}
      onBanque={(v) => setF((x) => ({ ...x, banque: v, compteBanque: "" }))} onCompte={(v) => setF((x) => ({ ...x, compteBanque: v }))} />
  );
  const liste = (cliquable: boolean) => (
    <table className="grille">
      <thead><tr><th scope="col">Date opération</th><th scope="col">Client</th><th scope="col">N° Chèque</th><th scope="col">Tireur</th><th scope="col">Banque Tireur</th>
        <th scope="col" className="montant">Montant</th><th scope="col">Statut</th><th scope="col">Date Encaissement</th></tr></thead>
      <tbody>
        {(cheques ?? []).length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
        {(cheques ?? []).map((c) => (
          <tr key={c.id} aria-selected={cliquable ? c.id === choisi : undefined} onClick={cliquable ? () => setChoisi(c.id) : undefined}>
            <td className="chiffres">{fr(c.date)}</td><td>{c.client}</td><td className="chiffres">{c.numeroCheque}</td><td>{c.tireur}</td><td>{c.banqueTireur}</td>
            <td className="montant chiffres">{montant(c.montant, c.devise)}</td><td>{c.statutLibelle}</td><td className="chiffres">{c.dateEncaissement ? fr(c.dateEncaissement) : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <h2>{onglet === 0 ? "Enregistrement Dépôt de Chèque" : "Liste des chèques"}</h2>
      <div className="onglets" role="tablist" aria-label="Gestion Chèque Client">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => changerOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}><Formulaire className="pile" envoyer={() => (onglet === 0 ? enregistrer() : statut === "depose" ? traiter("encaisser") : undefined)}>
        {(onglet === 0 || statut === "depose") && (
          <div className="entete-ecran">
            <ChampDate libelle="Date Opération : *" valeur={date} onChange={(v) => maj({ date: v })} requis />
            {onglet === 1 && <ChampDate libelle="Date Encaissement *" valeur={dateEnc} onChange={setDateEnc} requis />}
          </div>
        )}

        {onglet === 0 && (
          <>
            <div className="grille-cadres">
              <fieldset className="pile cadre-champs">
                <legend>Infos Client</legend>
                <div className="ligne-champ">
                  <Champ libelle="N° Client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
                  <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
                </div>
                {lu_("Intitulé", t ? nomComplet(t) : "")}
                <Champ libelle="Compte *">{(p) => <select {...p} className="saisie" value={compteF} disabled={!t} onChange={(e) => maj({ compte: e.target.value })}>
                  <option value="">{t ? "" : "Choisir d'abord le client"}</option>{(comptes ?? []).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
                {lu_("Intitulé Compte", cc?.intitule ?? "")}
              </fieldset>
              <fieldset className="pile cadre-champs">
                <legend>Infos Chèque</legend>
                <Champ libelle="N° Chèque *">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.numero} onChange={(e) => maj({ numero: e.target.value })} />}</Champ>
                <Champ libelle="Nom et prénoms Tireur *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.tireur} onChange={(e) => maj({ tireur: e.target.value })} />}</Champ>
                <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" placeholder="0" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
                <Champ libelle="Banque Tireur">{(p) => <select {...p} className="saisie" value={f.banqueTireur} onChange={(e) => maj({ banqueTireur: e.target.value })}>
                  <option value=""></option>{lu.banques.map((b) => <option key={b.id} value={b.libelle}>{b.libelle}</option>)}</select>}</Champ>
              </fieldset>
            </div>
            <fieldset className="pile cadre-champs">
              <legend>Info Banque Institution</legend>
              <div className="formulaire">
                <ChoixBanque lu={lu} libelleBanque="Banque" libelleCompte="Compte Banque *" banque={f.banque} compte={f.compteBanque}
                  onBanque={(v) => setF((x) => ({ ...x, banque: v, compteBanque: "" }))} onCompte={(v) => setF((x) => ({ ...x, compteBanque: v }))} />
              </div>
            </fieldset>
            <label className="case"><input type="checkbox" checked={parTitulaire} onChange={(e) => setParTitulaire(e.target.checked)} /><span>Déposé par le titulaire du compte</span></label>
            {!parTitulaire && <fieldset className="pile cadre-champs">
              <legend>Déposant</legend>
              <div className="formulaire">
                <Champ libelle="Nom et Prénoms Déposant *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.deposant} onChange={(e) => maj({ deposant: e.target.value })} />}</Champ>
                <Champ libelle="N° Pièce">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.pieceNumero} onChange={(e) => maj({ pieceNumero: e.target.value })} />}</Champ>
                <Champ libelle="Pièce d'identité">{(p) => <select {...p} className="saisie" value={f.pieceType} onChange={(e) => maj({ pieceType: e.target.value })}>
                  <option value=""></option>{ctx.pieces.map((x: string) => <option key={x}>{x}</option>)}</select>}</Champ>
                <Champ libelle="Etablie à">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.etabliA} onChange={(e) => maj({ etabliA: e.target.value })} />}</Champ>
                <ChampDate libelle="Date d'expiration" valeur={f.expire} onChange={(v) => maj({ expire: v })} />
              </div>
            </fieldset>}
            <div className="actions-onglets">
              <button className="bouton" type="submit">Enregistrer</button>
              <button className="bouton secondaire" type="button" onClick={vider}>Annuler</button>
              <button className="bouton secondaire" type="button" disabled title="La pièce vient avec la comptabilisation (registre S59-4)">Imprimer</button>
            </div>
            <p className="montant-lettres">{m ? montantEnLettres(m, (cc?.devise ?? "CDF") as Devise) : "zéro"}</p>
          </>
        )}

        {onglet === 1 && (
          <>
            <fieldset className="pile cadre-champs"><legend>Infos Chèque</legend><div className="formulaire">{bancaire}
              <Champ libelle="Statut">{(p) => <select {...p} className="saisie" value={statut} onChange={(e) => { setStatut(e.target.value as typeof statut); setChoisi(null); }}>
                <option value="depose">Déposé</option><option value="encaisse">Encaissé</option><option value="retourne">Retourné</option><option value="">Tous</option></select>}</Champ></div></fieldset>
            {liste(statut === "depose")}
            {statut === "depose" && <div className="actions-onglets">
              <button className="bouton" type="submit">Encaisser</button>
              <button className="bouton secondaire" type="button" onClick={() => traiter("retourner")}>Retourner</button>
              <button className="bouton secondaire" type="button" disabled title="La pièce vient avec la comptabilisation (registre S59-4)">Imprimer</button>
            </div>}
          </>
        )}
        <Textes sources={["Manuel Microfina++, p. 68 : Enregistrement Dépôt de Chèque (Infos Client, Infos Chèque, Info Banque Institution, Autre info, Enregistrer, Annuler, Imprimer, montant en lettres)",
          "Manuel Microfina++, p. 68 et 69 : Encaissement de Chèque (Date Opération, Date Encaissement, Infos Chèque, Encaisser, Retourner, Imprimer) ; Historique chèque : texte seul, la liste est complétée (registre S59-1)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 52 (incidents de paiement) : le chèque impayé relève du banquier tiré ; ici le retour est seulement noté",
          "Plan d'allègement 7.16 : un onglet « Liste des chèques » avec un filtre Statut ; le cadre Déposant ne paraît que si le déposant n'est pas le titulaire (Instr. BCC 15, art. 11 : le représentant est identifié et son habilitation vérifiée)"]} />
      </Formulaire></section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); maj({ compte: "" }); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
