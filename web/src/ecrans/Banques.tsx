import { useState } from "react";
import { api, type SaisieBanque, type SaisieCompteBancaire } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
import { TableFiltree } from "./Groupes";

type Donnees = Awaited<ReturnType<typeof api.banques.lire>>;
type Props = { d: Donnees; confirmer: (texte: string, faire: () => Promise<unknown>, apres?: () => void) => void };
const NOSTRI: Record<string, string> = { "5600": "Organe faîtier", "5601": "Banque et autres intermédiaires financiers", "5602": "Coopérative d'Epargne et de Crédit", "5603": "Institution de Micro Finance" };

/** S58 : Banque > Création banque (manuel Microfina++, p. 67) : Banque Client et Banque Institution */
export function CreationBanque() {
  const { donnees } = useDonnees(() => api.banques.lire());
  const [onglet, setOnglet] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const confirmer = (texte: string, faire: () => Promise<unknown>, apres?: () => void) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); apres?.(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <h1>Création banque</h1>
      <div className="onglets" role="tablist" aria-label="Création banque">
        {["Banque Client", "Banque Institution"].map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {onglet === 0 ? <BanqueClient d={donnees} confirmer={confirmer} /> : <BanqueInstitution d={donnees} confirmer={confirmer} />}
        <Textes sources={["Manuel Microfina++, p. 67 : 8.1 Banque Client (Code Banque*, Libellé*, Compte Liaison*, Adresse) ; 8.2 Banque Institution (Banque*, Compte*, Libellé, N° Compte Bancaire*, journal*, Intitulé, Infos Contact)",
          "PCCI, compte 56 : 560 « Comptes NOSTRI disponible », 5601 « Banque et autres intermédiaires financiers »",
          "PCCI § 10 : monnaie utilisée, d'où la devise du compte",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

const BANQUE_VIDE: SaisieBanque = { code: "", libelle: "", compteLiaison: "", adresse: "" };

/** 8.1 Banque Client : Info Banque Client, Enregistrer, Supprimer, Annuler, Liste Banque Client */
function BanqueClient({ d, confirmer }: Props) {
  const [f, setF] = useState(BANQUE_VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const annuler = () => { setF(BANQUE_VIDE); setChoisi(null); };
  const t = (k: keyof SaisieBanque) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }) });
  return (
    <>
      <fieldset className="cadre-champs formulaire">
        <legend>Info Banque Client</legend>
        <Champ libelle="Code Banque: *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...t("code")} />}</Champ>
        <Champ libelle="Libelle : *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...t("libelle")} />}</Champ>
        <Champ libelle="Compte Liaison *">{(p) => <input {...p} className="saisie code" required inputMode="numeric" autoComplete="off" {...t("compteLiaison")} />}</Champ>
        <Champ libelle="Adresse :">{(p) => <textarea {...p} className="saisie" rows={2} {...t("adresse")} />}</Champ>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.banques.enregistrerBanque(f, choisi ?? undefined), annuler)}>Enregistrer</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.banques.supprimerBanque(choisi), annuler)}>Supprimer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
      </div>
      <fieldset className="pile cadre-champs">
        <legend>Liste Banque Client</legend>
        <TableFiltree lignes={d.banques} cle={(b) => b.id} choisi={choisi}
          choisir={(b) => { setChoisi(b.id); setF({ code: b.code, libelle: b.libelle, compteLiaison: b.compteLiaison, adresse: b.adresse }); }}
          colonnes={[{ titre: "Code Banque", valeur: (b) => b.code, classe: "chiffres" }, { titre: "Compte Liaison", valeur: (b) => b.compteLiaison, classe: "chiffres" },
            { titre: "Désignation", valeur: (b) => b.libelle }, { titre: "Adresse", valeur: (b) => b.adresse }]} />
      </fieldset>
      <p className="a-confirmer">À confirmer : compte liaison d'une banque client (l'exemple du manuel, 114101, n'est pas un compte du PCCI).</p>
    </>
  );
}

const COMPTE_VIDE: SaisieCompteBancaire = { banqueId: 0, compte: "", numeroBancaire: "", devise: "", journalId: 0, contactNom: "", contactNomComplet: "", contactTelephone: "" };

/** 8.2 Banque Institution : Infos Banques Institutions à valider, Infos Contact, Enregistrer, Supprimer, Annuler, Imprimer, Imprimer tous les comptes */
function BanqueInstitution({ d, confirmer }: Props) {
  const [f, setF] = useState<SaisieCompteBancaire>({ ...COMPTE_VIDE, journalId: d.journaux[0]?.id ?? 0 });
  const [choisi, setChoisi] = useState<number | null>(null);
  const [impression, setImpression] = useState<"un" | "tous" | null>(null);
  const annuler = () => { setF({ ...COMPTE_VIDE, journalId: d.journaux[0]?.id ?? 0 }); setChoisi(null); };
  const t = (k: "compte" | "numeroBancaire" | "contactNom" | "contactNomComplet" | "contactTelephone") => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });
  const banque = d.banques.find((b) => b.id === f.banqueId);
  const nomBanque = (id: number) => d.banques.find((b) => b.id === id)?.libelle ?? "";
  const nomJournal = (id: number) => d.journaux.find((j) => j.id === id)?.libelle ?? "";
  const aImprimer = impression === "un" ? d.comptes.filter((c) => c.id === choisi) : d.comptes;
  return (
    <>
      <fieldset className="cadre-champs formulaire">
        <legend>Infos Banques Institutions à valider</legend>
        <Champ libelle="Banque *">{(p) => <select {...p} className="saisie" required value={f.banqueId} onChange={(e) => setF({ ...f, banqueId: Number(e.target.value) })}>
          <option value={0}></option>{d.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Compte *">{(p) => <input {...p} className="saisie code" required inputMode="numeric" autoComplete="off" {...t("compte")} />}</Champ>
        <Champ libelle="Libelle : *">{(p) => <input {...p} className="saisie" readOnly value={banque && f.devise ? `${banque.libelle} ${f.devise}` : ""} />}</Champ>
        <Champ libelle="N° Compte Bancaire : *">{(p) => <input {...p} className="saisie code" required autoComplete="off" {...t("numeroBancaire")} />}</Champ>
        <Champ libelle="Devise *">{(p) => <select {...p} className="saisie" required value={f.devise} onChange={(e) => setF({ ...f, devise: e.target.value })}>
          <option value=""></option><option>CDF</option><option>USD</option></select>}</Champ>
        <Champ libelle="journal *">{(p) => <select {...p} className="saisie" required value={f.journalId} onChange={(e) => setF({ ...f, journalId: Number(e.target.value) })}>
          {d.journaux.map((j) => <option key={j.id} value={j.id}>{j.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Intitulé">{(p) => <input {...p} className="saisie" readOnly value={NOSTRI[f.compte.trim().slice(0, 4)] ?? ""} />}</Champ>
      </fieldset>
      <fieldset className="cadre-champs formulaire">
        <legend>Infos Contact</legend>
        <Champ libelle="Nom *">{(p) => <input {...p} className="saisie" required autoComplete="off" {...t("contactNom")} />}</Champ>
        <Champ libelle="Nom Complet :">{(p) => <input {...p} className="saisie" autoComplete="off" {...t("contactNomComplet")} />}</Champ>
        <Champ libelle="Téléphone :">{(p) => <input {...p} className="saisie code" type="tel" inputMode="tel" autoComplete="off" {...t("contactTelephone")} />}</Champ>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.banques.enregistrerCompte(f, choisi ?? undefined), annuler)}>Enregistrer</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.banques.supprimerCompte(choisi), annuler)}>Supprimer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => setImpression("un")}>Imprimer</button>
        <button className="bouton secondaire" type="button" disabled={d.comptes.length === 0} onClick={() => setImpression("tous")}>Imprimer tous les comptes</button>
      </div>
      <p className="a-confirmer">À confirmer : la liste des comptes n'est pas montrée par la capture (p. 67) ; la devise est ajoutée (PCCI § 10) ; validation des comptes « à valider » non décrite ; compte de pénalité et gestionnaire cités par le texte, absents de la capture.</p>
      <TableFiltree lignes={d.comptes} cle={(c) => c.id} choisi={choisi}
        choisir={(c) => { setChoisi(c.id); setF({ banqueId: c.banqueId, compte: c.compte, numeroBancaire: c.numeroBancaire, devise: c.devise, journalId: c.journalId,
          contactNom: c.contactNom, contactNomComplet: c.contactNomComplet, contactTelephone: c.contactTelephone }); }}
        colonnes={[{ titre: "Banque", valeur: (c) => nomBanque(c.banqueId) }, { titre: "Compte", valeur: (c) => c.compte, classe: "chiffres" },
          { titre: "N° Compte Bancaire", valeur: (c) => c.numeroBancaire, classe: "chiffres" }, { titre: "Devise", valeur: (c) => c.devise },
          { titre: "Journal", valeur: (c) => nomJournal(c.journalId) }, { titre: "Contact", valeur: (c) => c.contactNom }]} />
      <Fiche titre={impression === "un" ? "Compte bancaire" : "Comptes bancaires de l'institution"} ouverte={!!impression} fermer={() => setImpression(null)}>
        <div className="pile a-imprimer">
          <table className="grille">
            <thead><tr><th scope="col">Banque</th><th scope="col">Compte</th><th scope="col">Libellé</th><th scope="col">N° Compte Bancaire</th><th scope="col">Devise</th><th scope="col">Journal</th><th scope="col">Contact</th><th scope="col">Téléphone</th></tr></thead>
            <tbody>{aImprimer.map((c) => <tr key={c.id}><td>{nomBanque(c.banqueId)}</td><td className="chiffres">{c.compte}</td><td>{c.libelle}</td><td className="chiffres">{c.numeroBancaire}</td>
              <td>{c.devise}</td><td>{nomJournal(c.journalId)}</td><td>{[c.contactNom, c.contactNomComplet].filter(Boolean).join(", ")}</td><td className="chiffres">{c.contactTelephone}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setImpression(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => window.print()}>Imprimer</button>
        </div>
      </Fiche>
    </>
  );
}
