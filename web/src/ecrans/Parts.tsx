import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api } from "../donnees/api";
import { boiteOperation } from "../lib/examen";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { montant, montantEnLettres, type Comptage } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Textes, type Boite, Lecture, Formulaire } from "../composants";
import { billetageBon, ChampClient, OngletsGuichet, recapitulatif, Recu } from "./Guichet";
import { RechercheClient } from "./Visa";

const fr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

/** S77 : Caisse > Opération > Part sociale (Achat/Retrait) (manuel Microfina++, p. 88 et 89) */
export function PartsSociales() {
  const [t, setT] = useState<Tiers | null>(null);
  const [sens, setSens] = useState<"achat" | "retrait">("achat");
  const [nombre, setNombre] = useState("");
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [recu, setRecu] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const [s, ctx, u, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.session.courante(), api.journees.courante()]);
    const stock = s ? await api.caisses.theorique(s.id, "CDF") : {};
    const parts = t ? await api.tiers.parts(t.id) : 0;
    const piece = fait ? (await api.operations.recu(fait.id)).piece : "";
    return { s, ctx, u, j, stock, parts, piece };
  }, [t?.id, fait?.id]);
  if (!donnees) return <Chargement />;
  const { s, ctx, j, stock, parts, piece } = donnees;
  if (!s || s.statut !== "ouverte") return (
    <><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>
  );
  const n = /^\d+$/.test(nombre.trim()) ? Number(nombre.trim()) : 0;
  const aPayer = n * (ctx.valeurPart ?? 0);   // valeur de la ligne de part des frais d'adhésion (registre S16-11)
  const achat = sens === "achat";
  const effacer = () => { setT(null); setNombre(""); setCoupures({}); setCle(nouvelleCle()); setFait(null); };
  function enregistrer() {
    if (!t) { setBoite({ type: "erreur", message: "À remplir : numéro client." }); return; }
    setBoite({ type: "confirmation", message: recapitulatif(`${achat ? "Achat" : "Retrait"} de parts sociales`, [["Client", `${nomComplet(t)} (${t.numero})`], ["Parts", String(n)],
      ["Montant", montant(aPayer, "CDF")], ["En lettres", montantEnLettres(aPayer, "CDF")], [achat ? "Versé par" : "Remis à", "Le titulaire"]]), oui: async () => {
      try { const o = await api.guichet.parts({ cle, tiersId: t.id, sens, nombre: n, coupures }); setFait(o); setRecu(true); if (o.avertissement) setBoite({ type: "succes", message: o.avertissement }); }
      catch (x) { setBoite(boiteOperation(x, { type: sens === "retrait" ? "retrait_parts" : "achat_parts", tiersId: t.id, montant: aPayer, devise: "CDF" }, setBoite)); }
    } });
  }
  return (
    <>
      
      <OngletsGuichet version={fait?.id} />
      <Formulaire className="bloc pile" label="Part sociale (Achat/Retrait)" envoyer={enregistrer}>
        <div className="entete-ecran">
          {(piece) ? <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p> : null}
          <p>Date Opération : <strong className="chiffres">{fr(j?.date ?? "")}</strong></p>
        </div>
        <div className="grille-cadres">
          <fieldset className="pile cadre-champs">
            <legend>Client</legend>
            <div className="ligne-champ">
              <ChampClient libelle="Numéro client" client={t} desactive={!!fait} choisir={(x) => { setT(x); setNombre(""); setCoupures({}); }} />
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={!!fait} onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé">{(p) => <Lecture {...p} value={t ? nomComplet(t) : ""} />}</Champ>
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
        {t && n > 0 && !fait && <fieldset className="pile cadre-champs"><legend>Billetage</legend>
          <Billetage devise="CDF" comptage={coupures} onChange={(x) => { setCoupures(x); setCle(nouvelleCle()); }} cible={aPayer} sens={achat ? "recue" : "remise"} stock={achat ? undefined : stock} /></fieldset>}
        <div className="actions-onglets">
          <button className="bouton" type="submit" disabled={!t || n < 1 || !!fait} aria-disabled={!billetageBon(coupures, aPayer) || undefined} aria-describedby={!billetageBon(coupures, aPayer) ? "ecart-CDF" : undefined}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled={!fait} onClick={() => setRecu(true)}>Imprimer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 88 et 89 : Part sociale (Achat/Retrait), client, nombre de parts, Enregistrer, Billetage, Imprimer, Effacer",
          "Loi 002/2002, art. 20 et 21 : valeur fixée par les statuts, parts intégralement libérées ; art. 22 : au moins une part ; art. 27 : apurement au départ",
          "PCCI, compte 103 : 1030 personnes physiques, 1031 groupements solidaires, 1032 personnes morales ; débité au retrait ou à la démission",
          "Instr. BCC 15 bis : examen renforcé à 10 000 USD en espèces dans la journée"]} />
      </Formulaire>
      <Fiche titre="Reçu" ouverte={recu} fermer={() => setRecu(false)}>
        {fait && <Recu id={fait.id} onNouveau={() => { setRecu(false); effacer(); }} />}
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif" || x.statut === "resilie") : [])}
          choisir={(x) => { setT(x); setNombre(""); setCoupures({}); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
