import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api } from "../donnees/api";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { montant, totalComptage, type Comptage } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
import { OngletsGuichet, Recu } from "./Guichet";
import { RechercheClient } from "./Visa";

const fr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

/** S77 : Caisse > Opération > Part sociale (Achat/Retrait) (manuel Microfina++, p. 88 et 89) */
export function PartsSociales() {
  const [t, setT] = useState<Tiers | null>(null);
  const [compteId, setCompteId] = useState(0);
  const [sens, setSens] = useState<"achat" | "retrait">("achat");
  const [nombre, setNombre] = useState("");
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [billetage, setBilletage] = useState(false);
  const [recu, setRecu] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const [s, ctx, u, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.session.courante(), api.journees.courante()]);
    const stock = s ? await api.caisses.theorique(s.id, "CDF") : {};
    const comptes = t ? await api.tiers.comptes(t.id) : [];
    const parts = t ? await api.tiers.parts(t.id) : 0;
    const piece = fait ? (await api.operations.recu(fait.id)).piece : "";
    return { s, ctx, u, j, stock, comptes, parts, piece };
  }, [t?.id, fait?.id]);
  if (!donnees) return <Chargement />;
  const { s, ctx, u, j, stock, comptes, parts, piece } = donnees;
  if (!s || s.statut !== "ouverte") return (
    <><h1>Guichet</h1><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>
  );
  const c = comptes.find((x) => x.id === compteId);
  const n = /^\d+$/.test(nombre.trim()) ? Number(nombre.trim()) : 0;
  const aPayer = n * ctx.valeurPart;
  const achat = sens === "achat";
  const effacer = () => { setT(null); setCompteId(0); setNombre(""); setCoupures({}); setCle(nouvelleCle()); setFait(null); };
  function enregistrer() {
    if (!t || !c) { setBoite({ type: "erreur", message: "À remplir : numéro client, N° Compte." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { setFait(await api.guichet.parts({ cle, tiersId: t.id, sens, nombre: n, coupures })); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Guichet</h1>
      <OngletsGuichet />
      <section className="bloc pile" aria-label="Part sociale (Achat/Retrait)">
        <div className="entete-ecran">
          <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p>
          <p>Date Opération : <strong className="chiffres">{fr(j?.date ?? "")}</strong></p>
        </div>
        <div className="grille-cadres">
          <fieldset className="pile cadre-champs">
            <legend>Client</legend>
            <div className="ligne-champ">
              <Champ libelle="Numéro client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={!!fait} onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé">{(p) => <input {...p} className="saisie" readOnly value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="N° Compte *">{(p) => <select {...p} className="saisie" required disabled={!!fait} value={compteId} onChange={(e) => setCompteId(Number(e.target.value))}>
              <option value={0}></option>{comptes.map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}</select>}</Champ>
            <Champ libelle="N° Comptable">{(p) => <input {...p} className="saisie code" readOnly value={c?.pcci ?? ""} />}</Champ>
            <Champ libelle="Produit">{(p) => <input {...p} className="saisie" readOnly value={c ? `${c.intitule} ${c.devise}` : ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Info compte</legend>
            <p>Solde du compte</p>
            <p className="chiffres"><strong>{c ? montant(c.solde, c.devise) : ""}</strong></p>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Info guichet</legend>
            <dl className="infos">
              <div className="info-ligne"><dt>Agence</dt><dd>{ctx.agence.nom}</dd></div>
              <div className="info-ligne"><dt>Nom</dt><dd>{ctx.guichets.find((g) => g.id === s.guichetId)?.nom ?? ""}</dd></div>
              <div className="info-ligne"><dt>Caissier</dt><dd>{u?.nom ?? ""}</dd></div>
              <div className="info-ligne"><dt>Solde</dt><dd className="chiffres">{montant(totalComptage(stock), "CDF")}</dd></div>
            </dl>
          </fieldset>
        </div>
        <div className="onglets" role="tablist" aria-label="Achat ou retrait">
          {(["achat", "retrait"] as const).map((x, i) => (
            <button key={x} type="button" role="tab" id={`sens-${i}`} aria-controls="volet-parts" aria-selected={sens === x} disabled={!!fait}
              onClick={() => { setSens(x); setCoupures({}); setCle(nouvelleCle()); }}>{x === "achat" ? "Achat Part sociale" : "Retrait Part sociale"}</button>
          ))}
        </div>
        <fieldset className="cadre-champs formulaire" id="volet-parts" role="tabpanel" aria-labelledby={`sens-${achat ? 0 : 1}`}>
          <legend>Part social et Montant</legend>
          <Champ libelle="Part social total">{(p) => <input {...p} className="saisie code court" readOnly value={t ? String(parts) : ""} />}</Champ>
          <Champ libelle={achat ? "Part social à achèter *" : "Part social à retirer *"}>{(p) => <input {...p} className="saisie code" inputMode="numeric" required readOnly={!!fait}
            autoComplete="off" value={nombre} onChange={(e) => { if (/^\d{0,6}$/.test(e.target.value)) { setNombre(e.target.value); setCle(nouvelleCle()); } }} />}</Champ>
          <Champ libelle={achat ? "Montant à payer" : "Montant à remettre"}>{(p) => <input {...p} className="saisie montant" readOnly value={montant(aPayer, "CDF")} />}</Champ>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!t || !c || n < 1 || !!fait} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled={!t || n < 1 || !!fait} onClick={() => setBilletage(true)}>Billetage</button>
          <button className="bouton secondaire" type="button" disabled={!fait} onClick={() => setRecu(true)}>Imprimer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <p className="a-confirmer">Complété par nous (registre <code>docs/architecture/DECISIONS.md</code>) : S77-1 le N° Compte identifie le client, le paiement est en espèces avec billetage ; S77-2 une part au minimum. À appliquer avec S16 : S16-11 la valeur de la part vient des statuts, saisie dans Paramétrage frais Adhésion (aujourd'hui une valeur d'exemple ; loi 002/2002, art. 20).</p>
        <Textes sources={["Manuel Microfina++, p. 88 et 89 : Part sociale (Achat/Retrait), client, nombre de parts, Enregistrer, Billetage, Imprimer, Effacer",
          "Loi 002/2002, art. 20 et 21 : valeur fixée par les statuts, parts intégralement libérées ; art. 22 : au moins une part ; art. 27 : apurement au départ",
          "PCCI, compte 103 : 1030 personnes physiques, 1031 groupements solidaires, 1032 personnes morales ; débité au retrait ou à la démission",
          "Instr. BCC 15 bis : examen renforcé à 10 000 USD en espèces dans la journée"]} />
      </section>
      <Fiche titre="Billetage" ouverte={billetage} fermer={() => setBilletage(false)}>
        <div className="pile">
          <Billetage devise="CDF" comptage={coupures} onChange={setCoupures} cible={aPayer} sens={achat ? "recue" : "remise"} stock={achat ? undefined : stock} />
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setBilletage(false)}>Fermer</button></div>
        </div>
      </Fiche>
      <Fiche titre="Reçu" ouverte={recu} fermer={() => setRecu(false)}>
        {fait && <Recu id={fait.id} onNouveau={() => { setRecu(false); effacer(); }} />}
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif" || x.statut === "resilie") : [])}
          choisir={(x) => { setT(x); setCompteId(0); setNombre(""); setCoupures({}); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
