// S59 : Banque > Gestion Chèque Client (manuel Microfina++, p. 68 et 69) : Dépôt chèque, Encaisser chèque, Historique chèque.
// Le dépôt est enregistré en attente ; l'encaissement ou le retour se fait sur le compte bancaire choisi ; la comptabilisation vient en S111 (registre S59-4).
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { lireMontant, montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Lecture } from "../composants";
import { RechercheClient } from "./Visa";
import { ChoixBanque } from "./OperationsBanque";

const ONGLETS = ["Dépôt chèque", "Encaisser chèque", "Historique chèque"] as const;
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
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  const cb = Number(f.compteBanque) || 0;
  const { donnees: cheques } = useDonnees(() => (onglet > 0 && cb ? api.chequesClients.lister(cb, onglet === 1 ? "depose" : "") : Promise.resolve([])), [onglet, cb, relu]);
  if (!donnees) return <Chargement />;
  const { ctx, lu } = donnees;
  const maj = (p: Partial<typeof VIDE>) => setF({ ...f, ...p });
  const date = f.date || lu.date;
  const cc = (comptes ?? []).find((c) => String(c.id) === f.compte);
  const m = lireMontant(f.montant);
  const vider = () => { setF(VIDE); setT(null); setCle(nouvelleCle()); setChoisi(null); setDateEnc(""); };
  const changerOnglet = (i: number) => { setOnglet(i); vider(); };

  function enregistrer() {
    const d = { cle, date, compteDepotId: f.compte ? Number(f.compte) : undefined, compteBancaireId: cb || undefined, numeroCheque: f.numero, tireur: f.tireur, banqueTireur: f.banqueTireur,
      montant: m ?? 0, deposant: f.deposant, pieceType: f.pieceType, pieceNumero: f.pieceNumero, etabliA: f.etabliA, dateExpiration: f.expire };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.chequesClients.deposer(d); vider(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  function traiter(action: "encaisser" | "retourner") {
    if (choisi === null) { setBoite({ type: "erreur", message: "Double-cliquez d'abord sur la ligne du chèque." }); return; }
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
      <thead><tr><th scope="col">Date operation</th><th scope="col">Client</th><th scope="col">N° Chèque</th><th scope="col">Tireur</th><th scope="col">Banque Tireur</th>
        <th scope="col" className="montant">Montant</th><th scope="col">Statut</th><th scope="col">Date Encaissement</th></tr></thead>
      <tbody>
        {(cheques ?? []).length === 0 && <tr><td colSpan={8}>Aucune donnée</td></tr>}
        {(cheques ?? []).map((c) => (
          <tr key={c.id} aria-selected={cliquable ? c.id === choisi : undefined} onDoubleClick={cliquable ? () => setChoisi(c.id) : undefined}>
            <td className="chiffres">{fr(c.date)}</td><td>{c.client}</td><td className="chiffres">{c.numeroCheque}</td><td>{c.tireur}</td><td>{c.banqueTireur}</td>
            <td className="montant chiffres">{montant(c.montant, c.devise)}</td><td>{c.statutLibelle}</td><td className="chiffres">{c.dateEncaissement ? fr(c.dateEncaissement) : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <h1>{onglet === 0 ? "Enregistrement Dépôt de Chèque" : onglet === 1 ? "Encaissement de Chèque" : "Historique chèque"}</h1>
      <div className="onglets" role="tablist" aria-label="Gestion Chèque Client">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => changerOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {onglet < 2 && (
          <div className="entete-ecran">
            <p>Numéro de pièce : <strong className="chiffres"></strong></p>
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
                <Champ libelle="Compte *">{(p) => <select {...p} className="saisie" value={f.compte} onChange={(e) => maj({ compte: e.target.value })}>
                  <option value=""></option>{(comptes ?? []).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
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
                <Champ libelle="Nom et Prénoms Déposant *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.deposant} onChange={(e) => maj({ deposant: e.target.value })} />}</Champ>
              </div>
            </fieldset>
            <fieldset className="pile cadre-champs">
              <legend>Autre info</legend>
              <div className="formulaire">
                <Champ libelle="N° Pièce">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.pieceNumero} onChange={(e) => maj({ pieceNumero: e.target.value })} />}</Champ>
                <Champ libelle="Type Pièce">{(p) => <select {...p} className="saisie" value={f.pieceType} onChange={(e) => maj({ pieceType: e.target.value })}>
                  <option value=""></option>{ctx.pieces.map((x: string) => <option key={x}>{x}</option>)}</select>}</Champ>
                <Champ libelle="Etablie à">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.etabliA} onChange={(e) => maj({ etabliA: e.target.value })} />}</Champ>
                <ChampDate libelle="Date d'expiration" valeur={f.expire} onChange={(v) => maj({ expire: v })} />
              </div>
            </fieldset>
            <div className="actions-onglets">
              <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
              <button className="bouton secondaire" type="button" onClick={vider}>Annuler</button>
              <button className="bouton secondaire" type="button" disabled title="La pièce vient avec la comptabilisation (registre S59-4)">Imprimer</button>
            </div>
            <p className="montant-lettres">{m ? montantEnLettres(m, (cc?.devise ?? "CDF") as Devise) : "zéro"}</p>
          </>
        )}

        {onglet === 1 && (
          <>
            <fieldset className="pile cadre-champs"><legend>Infos Chèque</legend><div className="formulaire">{bancaire}</div></fieldset>
            {liste(true)}
            <div className="actions-onglets">
              <button className="bouton" type="button" onClick={() => traiter("encaisser")}>Encaisser</button>
              <button className="bouton secondaire" type="button" onClick={() => traiter("retourner")}>Retourner</button>
              <button className="bouton secondaire" type="button" disabled title="La pièce vient avec la comptabilisation (registre S59-4)">Imprimer</button>
            </div>
          </>
        )}

        {onglet === 2 && (
          <>
            <fieldset className="pile cadre-champs"><legend>Banque</legend><div className="formulaire">
              <ChoixBanque lu={lu} libelleBanque="Banque" libelleCompte="Compte" banque={f.banque} compte={f.compteBanque}
                onBanque={(v) => setF((x) => ({ ...x, banque: v, compteBanque: "" }))} onCompte={(v) => setF((x) => ({ ...x, compteBanque: v }))} /></div></fieldset>
            {liste(false)}
          </>
        )}
        <Textes sources={["Manuel Microfina++, p. 68 : Enregistrement Dépôt de Chèque (Infos Client, Infos Chèque, Info Banque Institution, Autre info, Enregistrer, Annuler, Imprimer, montant en lettres)",
          "Manuel Microfina++, p. 68 et 69 : Encaissement de Chèque (Date Opération, Date Encaissement, Infos Chèque, Encaisser, Retourner, Imprimer) ; Historique chèque : texte seul, la liste est complétée (registre S59-1)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 52 (incidents de paiement) : le chèque impayé relève du banquier tiré ; ici le retour est seulement noté"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); maj({ compte: "" }); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
