// S52 : Banque > Opération (manuel Microfina++, p. 60 et 61, trois captures) : Encaissement / Décaissement, V. Banque vers caisse, V. Banque vers Banque.
// L'opération est saisie ici ; elle est visée puis validée (S57) et comptabilisée (S111) : le numéro de pièce vient à la comptabilisation (registre S52-2).
import { useState } from "react";
import { api, type SaisieOperationBanque } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite } from "../composants";
import { lireMontant, montant, type Devise } from "@design/montant.js";

const ONGLETS = ["Encaissement / Décaissement", "V. Banque vers caisse", "V. Banque vers Banque"] as const;
type Lu = Awaited<ReturnType<typeof api.banqueOperations.lire>>;
type CompteB = Lu["comptes"][number];

/** Banque puis Compte Banque, la liste des comptes suit la banque choisie */
export function ChoixBanque({ lu, libelleBanque, libelleCompte, banque, compte, onBanque, onCompte }: {
  lu: Lu; libelleBanque: string; libelleCompte: string; banque: string; compte: string; onBanque: (v: string) => void; onCompte: (v: string) => void;
}) {
  const comptes = lu.comptes.filter((c) => String(c.banqueId) === banque);
  return (
    <>
      <Champ libelle={libelleBanque}>{(p) => <select {...p} className="saisie" value={banque} onChange={(e) => { onBanque(e.target.value); onCompte(""); }}>
        <option value=""></option>{lu.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
      <Champ libelle={libelleCompte}>{(p) => <select {...p} className="saisie" value={compte} onChange={(e) => onCompte(e.target.value)}>
        <option value=""></option>{comptes.map((c) => <option key={c.id} value={c.id}>{c.numero} ({c.devise})</option>)}</select>}</Champ>
    </>
  );
}

export function OperationsBanque() {
  const { donnees: lu } = useDonnees(() => api.banqueOperations.lire());
  const [onglet, setOnglet] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  // Saisie commune aux trois onglets ; vidée à chaque changement d'onglet et après Enregistrer
  const vide = { date: "", type: "encaissement" as "encaissement" | "decaissement", banque: "", compte: "", cheque: "", contrepartie: "", libelle: "", montant: "",
    typeBudget: "", ligneBudget: "", caisse: "", banqueDest: "", compteDest: "" };
  const [f, setF] = useState(vide);
  const [cle, setCle] = useState(nouvelleCle);
  if (!lu) return <Chargement />;
  const maj = (p: Partial<typeof vide>) => setF({ ...f, ...p });
  const date = f.date || lu.date;
  const compteDe = (id: string): CompteB | undefined => lu.comptes.find((c) => String(c.id) === id);
  const origine = compteDe(f.compte), destination = compteDe(f.compteDest);
  const solde = (c: CompteB | undefined) => (c ? montant(c.solde, c.devise as Devise) : "0");
  const caisse = lu.guichets.find((g) => String(g.id) === f.caisse);
  const changerOnglet = (i: number) => { setOnglet(i); setF(vide); setCle(nouvelleCle()); };
  const montantSaisi = (p: { id: string }) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />;

  function enregistrer() {
    const m = lireMontant(f.montant);
    const commun = { cle, date, montant: m ?? 0, compteBancaireId: f.compte ? Number(f.compte) : undefined };
    const d: SaisieOperationBanque = onglet === 0
      ? { ...commun, type: f.type, compte: f.contrepartie, libelle: f.libelle, cheque: f.cheque,
          typeBudgetId: f.typeBudget ? Number(f.typeBudget) : null, ligneBudgetId: f.ligneBudget ? Number(f.ligneBudget) : null }
      : onglet === 1 ? { ...commun, type: "banque_caisse", cheque: f.cheque, guichetId: f.caisse ? Number(f.caisse) : undefined }
      : { ...commun, type: "banque_banque", compteBancaireDestId: f.compteDest ? Number(f.compteDest) : undefined };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.banqueOperations.enregistrer(d); setF(vide); setCle(nouvelleCle()); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const annuler = () => { setF(vide); setCle(nouvelleCle()); };
  // N° de chèque : chèques des chéquiers de l'institution (S60, pas encore construit) ; la liste reste vide (registre S52-5)
  const chequeVide = (actif: boolean) => <Champ libelle="N° de chèque">{(p) => <select {...p} className="saisie" disabled={!actif} value={f.cheque} onChange={(e) => maj({ cheque: e.target.value })}>
    <option value=""></option></select>}</Champ>;

  return (
    <>
      <h1>Opérations de banque</h1>
      <div className="onglets" role="tablist" aria-label="Opérations de banque">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => changerOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        <div className="entete-ecran">
          <p>Numéro de pièce : <strong className="chiffres"></strong></p>
          <ChampDate libelle={onglet === 0 ? "Date operation" : "Date Operation : *"} valeur={date} onChange={(v) => maj({ date: v })} requis={onglet !== 0} />
        </div>

        {onglet === 0 && (
          <fieldset className="cadre-champs pile">
            <legend>Operations de banque</legend>
            <label className="case" title="À confirmer : le manuel ne montre pas cette case cochée (registre S52-1)"><input type="checkbox" disabled /><span>Type écriture Multiligne</span></label>
            <div className="formulaire">
              <Champ libelle="Type operation">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => maj({ type: e.target.value as typeof f.type, cheque: "" })}>
                <option value="encaissement">Encaissement divers</option><option value="decaissement">Décaissement divers</option></select>}</Champ>
              <ChoixBanque lu={lu} libelleBanque="Banque *" libelleCompte="Compte Banque *" banque={f.banque} compte={f.compte}
                onBanque={(v) => maj({ banque: v, compte: "" })} onCompte={(v) => setF((x) => ({ ...x, compte: v }))} />
              {chequeVide(f.type === "decaissement")}
              <Champ libelle="Solde banque">{(p) => <input {...p} className="saisie montant" readOnly value={solde(origine)} />}</Champ>
              <Champ libelle="Compte *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={f.contrepartie} onChange={(e) => maj({ contrepartie: e.target.value })} />}</Champ>
              <Champ libelle="Libelle">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.libelle} onChange={(e) => maj({ libelle: e.target.value })} />}</Champ>
              <Champ libelle="Montant *">{montantSaisi}</Champ>
              <Champ libelle="Type budget">{(p) => <select {...p} className="saisie" value={f.typeBudget} onChange={(e) => maj({ typeBudget: e.target.value })}>
                <option value="">Choisissez un budget</option>{lu.typesBudget.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
              <Champ libelle="Ligne budgétaire :">{(p) => <select {...p} className="saisie" value={f.ligneBudget} onChange={(e) => maj({ ligneBudget: e.target.value })}>
                <option value="">Choisissez un financement</option>{lu.lignesBudget.map((l) => <option key={l.id} value={l.id}>{l.numero} {l.libelle}</option>)}</select>}</Champ>
              <p>Bailleur :</p>{/* nom du bailleur de la ligne : liste des bailleurs S126, pas encore construite (registre S19-7) */}
            </div>
          </fieldset>
        )}

        {onglet === 1 && (
          <fieldset className="cadre-champs pile">
            <legend>Virement de banque vers caisse</legend>
            <div className="formulaire">
              <Champ libelle="Type d'opération">{(p) => <select {...p} className="saisie" disabled><option>Decaissement Especes</option></select>}</Champ>
              <ChoixBanque lu={lu} libelleBanque="Banque *" libelleCompte="Compte Banque *" banque={f.banque} compte={f.compte}
                onBanque={(v) => maj({ banque: v, compte: "" })} onCompte={(v) => setF((x) => ({ ...x, compte: v }))} />
              {chequeVide(true)}
              <Champ libelle="Montant *">{montantSaisi}</Champ>
              <Champ libelle="Caisse *">{(p) => <select {...p} className="saisie" value={f.caisse} onChange={(e) => maj({ caisse: e.target.value })}>
                <option value=""></option>{lu.guichets.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}</select>}</Champ>
            </div>
            <div className="entete-ecran">
              <p>Solde Banque : <strong className="chiffres">{solde(origine)}</strong></p>
              <p>Solde Caisse : <strong className="chiffres">{caisse && origine ? montant(caisse.soldes[origine.devise as "CDF" | "USD"] ?? 0, origine.devise as Devise) : "0"}</strong></p>
            </div>
          </fieldset>
        )}

        {onglet === 2 && (
          <fieldset className="cadre-champs pile">
            <legend>Virement de banque à banque</legend>
            <div className="formulaire">
              <ChoixBanque lu={lu} libelleBanque="Banque d'origine *" libelleCompte="Compte Banque d'origine *" banque={f.banque} compte={f.compte}
                onBanque={(v) => maj({ banque: v, compte: "" })} onCompte={(v) => setF((x) => ({ ...x, compte: v }))} />
              <Champ libelle="Montant *">{montantSaisi}</Champ>
              <ChoixBanque lu={lu} libelleBanque="Banque destination *" libelleCompte="Compte Banque destination *" banque={f.banqueDest} compte={f.compteDest}
                onBanque={(v) => maj({ banqueDest: v, compteDest: "" })} onCompte={(v) => setF((x) => ({ ...x, compteDest: v }))} />
            </div>
            <div className="entete-ecran">
              <p>Solde du compte d'origine : <strong className="chiffres">{solde(origine)}</strong></p>
              <p>Solde du compte de destination : <strong className="chiffres">{solde(destination)}</strong></p>
            </div>
          </fieldset>
        )}

        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 60 et 61 : onglets Encaissement / Décaissement, V. Banque vers caisse, V. Banque vers Banque (trois captures), Enregistrer, Annuler",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Chaîne de l'opération : saisie ici, visée puis validée (Banque > Visa, Validation, S57), comptabilisée (S111) ; numéro de pièce donné à la comptabilisation (PCCI § 3.3 et 3.4)",
          "PCCI, comptes 560 (NOSTRI) pour les comptes bancaires, 57 pour la caisse : ils ont leurs onglets de virement, ils ne sont pas une contrepartie"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
