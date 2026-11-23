// S78 : Caisse > ED Divers (manuel Microfina++, p. 89 et 90 ; doublons p. 97 et 98) : Type operation, Operations, Compte, Libelle, Montant ;
// Enregistrer, Annuler ; Billetage (décision du porteur du 19/11/2026). Registre S78-1 à S78-6.
import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api } from "../donnees/api";
import type { Operation } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { DEVISES, lireMontant, montant, montantEnLettres, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { billetageBon, OngletsGuichet, recapitulatif, Recu } from "./Guichet";

type TypeOp = "ENCAISSEMENT" | "DECAISSEMENT";
const SENS: Record<TypeOp, "PRODUIT" | "CHARGE"> = { ENCAISSEMENT: "PRODUIT", DECAISSEMENT: "CHARGE" };
const VIDE = () => ({ type: "ENCAISSEMENT" as TypeOp, operation: "", libelle: "", montants: {} as Partial<Record<Devise, string>> });

export default function EdDivers() {
  const [f, setF] = useState(VIDE);
  const [coupures, setCoupures] = useState<Partial<Record<Devise, Comptage>>>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [recu, setRecu] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const [s, ctx, u, j, ed] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.session.courante(), api.journees.courante(), api.edDivers.lire()]);
    const stocks = s ? Object.fromEntries(await Promise.all(DEVISES.map(async (d) => [d, await api.caisses.theorique(s.id, d)] as const))) as Record<Devise, Comptage> : null;
    const piece = fait ? (await api.operations.recu(fait.id)).piece : "";
    return { s, ctx, u, j, ed, stocks, piece };
  }, [fait?.id]);
  if (!donnees) return <Chargement />;
  const { s, j, ed, stocks, piece } = donnees;
  if (!s || s.statut !== "ouverte" || !stocks) return (
    <><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>
  );
  const proposees = ed.operations.filter((o) => o.statut === "ACTIF" && o.sens === SENS[f.type]);   // registre S31-1
  const od = proposees.find((o) => String(o.id) === f.operation);
  const lu = (d: Devise) => { const t = f.montants[d]?.trim(); return t ? lireMontant(t) : 0; };
  const saisies = DEVISES.filter((d) => (lu(d) ?? 0) > 0);
  const encaissement = f.type === "ENCAISSEMENT";
  const nouveau = () => { setCle(nouvelleCle()); setFait(null); };
  const annuler = () => { setF(VIDE()); setCoupures({}); nouveau(); };
  function enregistrer() {
    if (!od || saisies.length === 0) { setBoite({ type: "erreur", message: "À remplir : Opérations, Compte, Montant." }); return; }
    if (DEVISES.some((d) => lu(d) === null)) { setBoite({ type: "erreur", message: "Montant invalide." }); return; }
    setBoite({ type: "confirmation", message: recapitulatif(encaissement ? "Encaissement divers" : "Décaissement divers", [["Opération", od.libelle], ["Libellé", f.libelle.trim()],
      ["Montant", saisies.map((d) => montant(lu(d) ?? 0, d)).join(" et ")], ["En lettres", saisies.map((d) => montantEnLettres(lu(d) ?? 0, d)).join(" ; ")]]), oui: async () => {
      try {
        const o = await api.guichet.edDivers({ cle, typeOperation: f.type, operationId: od.id, libelle: f.libelle,
          montants: Object.fromEntries(saisies.map((d) => [d, lu(d) ?? 0])), coupures: Object.fromEntries(saisies.map((d) => [d, coupures[d] ?? {}])) });
        setFait(o); setRecu(true); if (o.avertissement) setBoite({ type: "succes", message: o.avertissement });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      
      <OngletsGuichet version={fait?.id} />
      <section className="bloc pile" aria-label="Autres encaissements et décaissements">
        <div className="entete-ecran">
          {(piece) ? <p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p> : null}
          <p>Date opération : <strong className="chiffres">{fr(j?.date ?? "")}</strong></p>
        </div>
        <fieldset className="cadre-champs formulaire">
          <legend>Opérations diverses</legend>
          <Champ libelle="Type operation">{(p) => <select {...p} className="saisie" disabled={!!fait} value={f.type}
            onChange={(e) => { setF({ ...f, type: e.target.value as TypeOp, operation: "", libelle: "" }); setCoupures({}); nouveau(); }}>
            <option value="ENCAISSEMENT">Encaissement</option><option value="DECAISSEMENT">Décaissement</option></select>}</Champ>
          <Champ libelle="Opérations">{(p) => <select {...p} className="saisie" disabled={!!fait} value={f.operation}
            onChange={(e) => { const x = proposees.find((o) => String(o.id) === e.target.value); setF({ ...f, operation: e.target.value, libelle: x?.libelle ?? "" }); nouveau(); }}>
            <option value=""></option>{proposees.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}</select>}</Champ>
          <Champ libelle="Compte">{(p) => <Lecture {...p} value={od?.compte ?? ""} />}</Champ>
          <Champ libelle="Libellé">{(p) => <input {...p} className="saisie" autoComplete="off" readOnly={!!fait} value={f.libelle} onChange={(e) => { setF({ ...f, libelle: e.target.value }); nouveau(); }} />}</Champ>
          {DEVISES.map((d) => <Champ key={d} libelle={`Montant (${d})${d === DEVISES[0] ? " *" : ""}`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off"
            readOnly={!!fait} value={f.montants[d] ?? ""} onChange={(e) => { setF({ ...f, montants: { ...f.montants, [d]: e.target.value } }); setCoupures({ ...coupures, [d]: {} }); nouveau(); }} />}</Champ>)}
        </fieldset>
        {saisies.length > 0 && !fait && <fieldset className="pile cadre-champs"><legend>Billetage</legend>
          {saisies.map((d) => <Billetage key={d} devise={d} comptage={coupures[d] ?? {}} onChange={(c) => { setCoupures({ ...coupures, [d]: c }); nouveau(); }}
            cible={lu(d) ?? 0} sens={encaissement ? "recue" : "remise"} stock={encaissement ? undefined : stocks[d]} />)}</fieldset>}
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!od || saisies.length === 0 || !!fait || !saisies.every((d) => billetageBon(coupures[d] ?? {}, lu(d)))} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 89 et 90 : ED Divers, Type operation Encaissement ou Décaissement, le compte, le montant, Enregistrer ou Annuler (deux captures)",
          "Manuel Microfina++, p. 97 : le compte comptable de l'opération s'affiche automatiquement avec son libellé ; le libellé est modifiable",
          "Paramétrage > ED divers (S31, registre S31-1) : opérations PRODUIT proposées en encaissement, CHARGE en décaissement ; seules les ACTIF",
          "Registre T12 : un montant par devise tenue ; billetage de chaque devise (décision du porteur du 19/11/2026, registre S78-3)"]} />
      </section>
      <Fiche titre="Reçu" ouverte={recu} fermer={() => setRecu(false)}>
        {fait && <Recu id={fait.id} onNouveau={() => { setRecu(false); annuler(); }} />}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
