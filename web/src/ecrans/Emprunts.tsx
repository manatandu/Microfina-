// S61 : Banque > Emprunts bancaires (manuel Microfina++, p. 70) : « Mise en place d'emprunt » et « Remboursement emprunt », deux captures sans texte.
// PCCI : capital au compte 533, intérêts 6020 ou 6021 selon la durée, commissions 60702 ; écritures et N° de pièce à la comptabilisation (S111).
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Lecture, Textes, type Boite } from "../composants";

type Vue = Awaited<ReturnType<typeof api.emprunts.lire>>;
const ONGLETS = ["Mise en place", "Remboursement"] as const;
const VIDE = { banque: "", reference: "", montant: "", duree: "", date: "", taux: "", interet: "", commission: "", frais: "", commentaire: "", compte: "533", decision: "", autorisation: "" };
const VIDE_R = { numero: "", date: "", amortissement: "", interet: "", commission: "" };
const m0 = (v: string) => (v.trim() ? lireMontant(v) : 0);

export function Emprunts() {
  const { donnees: lu } = useDonnees(() => api.banqueOperations.lire());
  const [onglet, setOnglet] = useState(0);
  const [f, setF] = useState(VIDE);
  const [r, setR] = useState(VIDE_R);
  const [fait, setFait] = useState<Vue | null>(null);
  const [emp, setEmp] = useState<Vue | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!lu) return <Chargement />;
  const maj = (p: Partial<typeof VIDE>) => setF((x) => ({ ...x, ...p }));
  const majR = (p: Partial<typeof VIDE_R>) => setR((x) => ({ ...x, ...p }));
  const changer = (i: number) => { setOnglet(i); setF(VIDE); setR(VIDE_R); setFait(null); setEmp(null); setCle(nouvelleCle()); };
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const montantSaisi = (v: string, k: (s: string) => void) => (p: { id: string }) =>
    <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={v} onChange={(e) => k(e.target.value)} />;

  function enregistrer() {
    const valeurs = [m0(f.montant), m0(f.interet), m0(f.commission), m0(f.frais)];
    if (valeurs.some((v) => v === null)) { erreur(new Error("Montant invalide.")); return; }
    const [mt, it, co, fr] = valeurs as [number, number, number, number];
    const d = { cle, compteBancaireId: f.banque ? Number(f.banque) : undefined, reference: f.reference, montant: mt, duree: Number(f.duree) || 0, dateEmprunt: f.date, taux: f.taux,
      totalInteret: it, totalCommission: co, totalFrais: fr, commentaire: f.commentaire, compteEmprunt: f.compte,
      decisionConseil: f.decision, autorisationBcc: f.autorisation };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { setFait(await api.emprunts.mettreEnPlace(d)); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { erreur(x); }
    } });
  }
  async function chercher() {
    if (!/^\d+$/.test(r.numero.trim())) { setEmp(null); return; }
    try { setEmp(await api.emprunts.lire(Number(r.numero))); } catch (x) { setEmp(null); erreur(x); }
  }
  function rembourser() {
    if (!emp) { erreur(new Error("À remplir : N°Compte (numéro de l'emprunt).")); return; }
    const valeurs = [m0(r.amortissement), m0(r.interet), m0(r.commission)];
    if (valeurs.some((v) => v === null)) { erreur(new Error("Montant invalide.")); return; }
    const [am, it, co] = valeurs as [number, number, number];
    const jour = r.date || lu!.date;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { setEmp(await api.emprunts.rembourser(emp.id, { cle, date: jour, amortissement: am, interet: it, commission: co }));
        setR((x) => ({ ...x, amortissement: "", interet: "", commission: "" })); setCle(nouvelleCle()); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { erreur(x); }
    } });
  }

  return (
    <>
      <h2>{onglet === 0 ? "Mise en place d'emprunt" : "Remboursement emprunt"}</h2>
      <div className="onglets" role="tablist" aria-label="Emprunts bancaires">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => changer(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {onglet === 0 && (
          <>
            <div className="formulaire">
              <Champ libelle="Banque">{(p) => <select {...p} className="saisie" value={f.banque} onChange={(e) => maj({ banque: e.target.value })}>
                <option value=""></option>{lu.comptes.map((c) => <option key={c.id} value={c.id}>{c.banque} {c.numero} ({c.devise})</option>)}</select>}</Champ>
              <Champ libelle="Réf.Emprunt">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.reference} onChange={(e) => maj({ reference: e.target.value })} />}</Champ>
              <Champ libelle="Montant">{montantSaisi(f.montant, (v) => maj({ montant: v }))}</Champ>
              <Champ libelle="Durée">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" aria-describedby="duree-mois" value={f.duree}
                onChange={(e) => { if (/^\d{0,3}$/.test(e.target.value)) maj({ duree: e.target.value }); }} />}</Champ>
              <ChampDate libelle="Date Emprunt" valeur={f.date} onChange={(v) => maj({ date: v })} />
              <Champ libelle="Taux annuel">{(p) => <input {...p} className="saisie code" inputMode="decimal" autoComplete="off" value={f.taux} onChange={(e) => maj({ taux: e.target.value })} />}</Champ>
              <Champ libelle="Total Intérêt">{montantSaisi(f.interet, (v) => maj({ interet: v }))}</Champ>
              <Champ libelle="Total Commis.">{montantSaisi(f.commission, (v) => maj({ commission: v }))}</Champ>
              <Champ libelle="Total Frais">{montantSaisi(f.frais, (v) => maj({ frais: v }))}</Champ>
              <Champ libelle="Date saisie">{(p) => <input {...p} className="saisie code" readOnly value={lu.date ? lu.date.split("-").reverse().join("/") : ""} />}</Champ>
              <Champ libelle="Commentaire">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.commentaire} onChange={(e) => maj({ commentaire: e.target.value })} />}</Champ>
              <Champ libelle="Compte Emprunt">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={f.compte} onChange={(e) => maj({ compte: e.target.value.trim() })} />}</Champ>
              <Champ libelle="Décision du Conseil d'administration *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.decision} onChange={(e) => maj({ decision: e.target.value })} />}</Champ>
              <Champ libelle="Autorisation BCC (emprunt subordonné)">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.autorisation} onChange={(e) => maj({ autorisation: e.target.value })} />}</Champ>
              <Champ libelle="N°Emprunt">{(p) => <input {...p} className="saisie code" readOnly value={fait ? String(fait.numero) : ""} />}</Champ>
              <div className="ligne-champ">
                <Champ libelle="N°Piece">{(p) => <input {...p} className="saisie code" readOnly value={fait?.piece ?? ""} />}</Champ>
                <button className="bouton secondaire" type="button" disabled title="À confirmer : la capture ne dit pas ce que cherche ce bouton (registre S61-6)">Rechercher</button>
                <label className="case"><input type="checkbox" disabled title="À confirmer (registre S61-6)" /><span className="sr-only">Case sans libellé</span></label>
              </div>
            </div>
            <p className="aide" id="duree-mois">Durée en mois. Intérêts au compte {Number(f.duree) > 12 ? "6020 (emprunt à plus d'un an)" : "6021 (emprunt à moins d'un an)"}, commissions au 60702.</p>
            <div className="actions-onglets">
              <button className="bouton secondaire" type="button" onClick={() => changer(0)}>Annuler</button>
              <button className="bouton" type="button" disabled={!!fait} onClick={enregistrer}>Enregistrer</button>
            </div>
          </>
        )}
        {onglet === 1 && (
          <>
            <div className="formulaire">
              <Champ libelle="N°Compte">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={r.numero}
                onChange={(e) => { majR({ numero: e.target.value }); setEmp(null); }} onBlur={chercher} onKeyDown={(e) => { if (e.key === "Enter") chercher(); }} />}</Champ>
              <Champ libelle="Banque">{(p) => <Lecture {...p} value={emp ? `${emp.banque} · ${emp.reference}` : ""} />}</Champ>
              <Champ libelle="Capital Restant">{(p) => <input {...p} className="saisie montant" readOnly value={emp ? montant(emp.capitalRestant, emp.devise as Devise) : ""} />}</Champ>
              <ChampDate libelle="Date" valeur={r.date || lu.date} onChange={(v) => majR({ date: v })} />
              <Champ libelle="Amortissement">{montantSaisi(r.amortissement, (v) => majR({ amortissement: v }))}</Champ>
              <Champ libelle="Intérêt">{montantSaisi(r.interet, (v) => majR({ interet: v }))}</Champ>
              <Champ libelle="Commission">{montantSaisi(r.commission, (v) => majR({ commission: v }))}</Champ>
              <div className="ligne-champ">
                
                <button className="bouton secondaire" type="button" disabled title="La pièce vient avec la comptabilisation (registre S61-4)">Imprimer</button>
              </div>
            </div>
            <div className="actions-onglets">
              <button className="bouton" type="button" onClick={rembourser}>Enregistrer</button>
              <button className="bouton secondaire" type="button" onClick={() => changer(1)}>Annuler</button>
            </div>
          </>
        )}
        <Textes sources={["Manuel Microfina++, p. 70 : captures « Mise en place d'emprunt » (Banque, Réf.Emprunt, Montant, Durée, Date Emprunt, Taux annuel, Total Intérêt, Total Commis., Total Frais, Date saisie, Commentaire, Compte Emprunt, N°Emprunt, N°Piece, Annuler, Enregistrer) et « Remboursement emprunt » (N°Compte, Banque, Capital Restant, Date, Amortissement, Intérêt, Commission, N°Pièce, Enregistrer, Annuler) ; aucun texte",
          "PCCI, compte 53 : emprunts contractés auprès des banques (533 Emprunts à terme) ; le compte 16 les exclut ; compte 602 : 6020 intérêts sur emprunts à plus d'un an, 6021 à moins d'un an ; 60702 commissions dues aux autres intermédiaires financiers",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur ; écritures et N° de pièce à la comptabilisation (S111, PCCI § 3.3 et 3.4)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
