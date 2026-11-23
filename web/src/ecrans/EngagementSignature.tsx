// S100 : Crédit > Engagement par signature (manuel Microfina++, p. 121, capture « Création engagement par signature ») : cadres Bénéficiaire et Détails,
// Enregistrer, Annuler, Imprimer ; grille des engagements (gabarit liste). Registre S100-1 à S100-7, CR-22, CR-14 ; PCCI hors bilan 00 et 090, compte 727 ;
// Instr. BCC 002, art. 23, 25 à 29.
import { enClair } from "../lib/enclair";
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { lireMontant, montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, LigneFiltres, Paginee, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

type Benef = Awaited<ReturnType<typeof api.engagements.beneficiaire>>;
type Engagement = Awaited<ReturnType<typeof api.engagements.lister>>[number];
const VIDE = { reference: "", type: "", description: "", dateDebut: "", montant: "", duree: "", pourcentage: "", forfait: "", garantie: "", compteEpargneId: "", compteGarantiId: "",
  banque: "", compteBancaireId: "", observation: "" };

function plusMois(d: string, n: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !n) return "";
  const [a, m, j] = d.split("-").map(Number) as [number, number, number];
  const t = m - 1 + n, aa = a + Math.floor(t / 12), mm = t % 12 + 1, fin = new Date(Date.UTC(aa, mm, 0)).getUTCDate();
  return `${aa}-${String(mm).padStart(2, "0")}-${String(Math.min(j, fin)).padStart(2, "0")}`;
}

export default function EngagementSignature() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => ({ ctx: await api.engagements.contexte(), liste: await api.engagements.lister() }), [relu]);
  const [b, setB] = useState<Benef | null>(null);
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<Engagement | null>(null);
  const [doc, setDoc] = useState(false);
  const [fin, setFin] = useState<{ motif: string; montant: string } | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { ctx, liste } = donnees;
  const maj = (x: Partial<typeof VIDE>) => setF({ ...f, ...x });
  const ce = b?.comptes.find((k) => String(k.id) === f.compteEpargneId);
  const dv = (ce?.devise ?? "CDF") as Devise;
  const m = lireMontant(f.montant) ?? 0, forfait = lireMontant(f.forfait) ?? 0, pct = Number(f.pourcentage.replace(",", ".")) || 0;
  const frais = Math.round(m * pct / 100) + forfait;
  const debut = f.dateDebut || ctx.date;
  const banques = [...new Set(ctx.banques.map((x) => x.banque))];
  async function choisir(t: Tiers) {
    setB(null); setF({ ...VIDE }); setChoisi(null);                      // vidé tout de suite : la réponse n'efface pas ce que l'agent tape ensuite
    try { setB(await api.engagements.beneficiaire(t.id)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer cet engagement ?", oui: async () => {
      try {
        const e = await api.engagements.enregistrer({ tiersId: b?.tiersId ?? null, reference: f.reference, type: f.type, description: f.description, dateDebut: debut,
          montant: f.montant.trim() ? lireMontant(f.montant) : null, duree: f.duree ? Number(f.duree) : null, pourcentage: f.pourcentage, forfait: f.forfait.trim() ? lireMontant(f.forfait) : null,
          garantie: f.garantie.trim() ? lireMontant(f.garantie) : null, compteEpargneId: f.compteEpargneId ? Number(f.compteEpargneId) : null,
          compteGarantiId: f.compteGarantiId ? Number(f.compteGarantiId) : null, compteBancaireId: f.compteBancaireId ? Number(f.compteBancaireId) : null, observation: f.observation });
        setChoisi(e); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Opération effectuée avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const comptes = (b?.comptes ?? []).map((k) => <option key={k.id} value={k.id}>{k.numero} ({k.devise})</option>);
  return (
    <>
      <h2>Création engagement par signature</h2>
      <section className="bloc pile" aria-label="Création engagement par signature">
        <fieldset className="cadre-champs formulaire"><legend>Bénéficiaire</legend>
          <div className="ligne-champ"><Champ libelle="N° Client">{(p) => <input {...p} className="saisie code" readOnly value={b?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button></div>
          <Champ libelle="Référence *">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.reference} onChange={(e) => maj({ reference: e.target.value })} />}</Champ>
          <Champ libelle="Nom Prénoms">{(p) => <Lecture {...p} value={b?.nom ?? ""} />}</Champ>
          <Champ libelle="Profession">{(p) => <Lecture {...p} value={b?.profession ?? ""} />}</Champ>
          <Champ libelle="Solde">{(p) => <Lecture {...p} value={ce ? montant(ce.solde, dv) : ""} />}</Champ>
          <Champ libelle="Sexe">{(p) => <Lecture {...p} value={b?.sexe ?? ""} />}</Champ>
          <Champ libelle="Contacts">{(p) => <Lecture {...p} value={b?.contacts ?? ""} />}</Champ>
          <Champ libelle="Adresse">{(p) => <Lecture {...p} value={b?.adresse ?? ""} />}</Champ>
        </fieldset>
        {/* Plan d'allègement, point 6.14 : les champs regroupés par sens (engagement, coût, garantie, banque) */}
        <fieldset className="cadre-champs formulaire"><legend>Engagement</legend>
          <Champ libelle="Type engagement *">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => maj({ type: e.target.value })}>
            <option value=""></option>{ctx.types.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
          <Champ libelle="Description *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.description} onChange={(e) => maj({ description: e.target.value })} />}</Champ>
          <ChampDate libelle="Date Début" valeur={debut} onChange={(x) => maj({ dateDebut: x })} />
          <Champ libelle="Date Fin">{(p) => <Lecture {...p} value={fr(plusMois(debut, Number(f.duree)))} />}</Champ>
          <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
          <Champ libelle="Durée(mois) *">{(p) => <input {...p} className="saisie montant" inputMode="numeric" value={f.duree} onChange={(e) => maj({ duree: e.target.value.replace(/\D/g, "") })} />}</Champ>
        </fieldset>
        <fieldset className="cadre-champs formulaire"><legend>Coût</legend>
          <Champ libelle="Pourcentage %">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.pourcentage} onChange={(e) => maj({ pourcentage: e.target.value })} />}</Champ>
          <Champ libelle="Forfait">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.forfait} onChange={(e) => maj({ forfait: e.target.value })} />}</Champ>
          <Champ libelle="Frais à payer">{(p) => <Lecture {...p} value={montant(frais, dv)} />}</Champ>
        </fieldset>
        <fieldset className="cadre-champs formulaire"><legend>Garantie</legend>
          <Champ libelle="Garantie">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.garantie} onChange={(e) => maj({ garantie: e.target.value })} />}</Champ>
          <Champ libelle="Compte Epargne *">{(p) => <select {...p} className="saisie" value={f.compteEpargneId} onChange={(e) => maj({ compteEpargneId: e.target.value })}><option value=""></option>{comptes}</select>}</Champ>
          <Champ libelle="Compte Garanti *">{(p) => <select {...p} className="saisie" value={f.compteGarantiId} onChange={(e) => maj({ compteGarantiId: e.target.value })}><option value=""></option>{comptes}</select>}</Champ>
        </fieldset>
        <fieldset className="cadre-champs formulaire"><legend>Banque</legend>
          <Champ libelle="Banque">{(p) => <select {...p} className="saisie" value={f.banque} onChange={(e) => maj({ banque: e.target.value, compteBancaireId: "" })}><option value=""></option>
            {banques.map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
          <Champ libelle="Compte Banque">{(p) => <select {...p} className="saisie" value={f.compteBancaireId} onChange={(e) => maj({ compteBancaireId: e.target.value })}><option value=""></option>
            {ctx.banques.filter((x) => x.banque === f.banque).map((x) => <option key={x.id} value={x.id}>{x.numero} ({x.devise})</option>)}</select>}</Champ>
          <Champ libelle="Observation">{(p) => <textarea {...p} className="saisie" rows={2} value={f.observation} onChange={(e) => maj({ observation: e.target.value })} />}</Champ>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={() => { setB(null); setF(VIDE); setChoisi(null); }}>Annuler</button>
          <button className="bouton secondaire" type="button" disabled={!choisi} onClick={() => setDoc(true)}>Imprimer</button>
          <button className="bouton secondaire" type="button" disabled={!choisi || !!choisi.clotureLe} onClick={() => setFin({ motif: "", montant: "" })}>Fin de l'engagement</button>
        </div>
        <Paginee lignes={liste} colonnes={(x) => [x.reference, x.membre, x.client, x.typeLibelle, null, null, null, null, null, null]}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Référence</th><th scope="col">N° Client</th><th scope="col">Client</th><th scope="col">Type engagement</th><th scope="col" className="num">Montant</th>
            <th scope="col">Date Début</th><th scope="col">Date Fin</th><th scope="col" className="num">Frais</th><th scope="col" className="num">Garantie</th><th scope="col">Fin</th></tr>
            <LigneFiltres titres={["Référence", "N° Client", "Client", "Type engagement", null, null, null, null, null, null]} /></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={10}>Aucune ligne.</td></tr>}
            {v.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.id === choisi?.id} onClick={() => setChoisi(x)}>
              <td className="code">{x.reference}</td><td className="code">{x.membre}</td><td>{x.client}</td><td>{x.typeLibelle}</td>
              <td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="chiffres">{fr(x.dateDebut)}</td><td className="chiffres">{fr(x.dateFin)}</td>
              <td className="num chiffres">{montant(x.frais, x.devise as Devise)}</td><td className="num chiffres">{montant(x.garantie, x.devise as Devise)}</td>
              <td>{x.clotureLe ? `${x.motifFin} le ${fr(x.clotureLe)}` : x.utilise ? `Payé : ${montant(x.utilise, x.devise as Devise)}` : ""}</td></tr>)}</tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 121 : 11-Engagement par signature, N° Client recherché, champs (*) renseignés, Enregistrer, puis Imprimer, ou Annuler en cas d'erreur ; capture",
          "Registre S100-1 à S100-7 : fin de l'engagement à l'échéance, à la mainlevée ou par mise en jeu de la garantie (le hors bilan est soldé, la garantie libérée ou utilisée) ; hors bilan 0001 (financement) ou 0012 (aval, caution) contre 090 ; frais = montant × pourcentage + forfait, prélevés sur le compte épargne au profit du compte 727 ; garantie saisie, bloquée sur le compte garanti ; liste rouge et gel des avoirs",
          "Instr. BCC 002, art. 23, 25 à 29 ; loi 002/2002, art. 59 et 60 : l'engagement par signature compte dans les risques et les plafonds par client avec les crédits (CR-14, CR-22)",
          "PCCI : comptes d'engagements donnés 00 (0001, 0012) et compte général 090 ; 727 Autres commissions"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (x) => (x ? await api.tiers.rechercher(x) : [])} choisir={(x) => { void choisir(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Fiche titre="Engagement par signature" ouverte={doc && !!choisi} fermer={() => setDoc(false)}>
        {choisi && <ActeEngagement e={choisi} entete={ctx.entete} coopec={ctx.coopec} fermer={() => setDoc(false)} />}
      </Fiche>
      <Fiche titre="Fin de l'engagement" ouverte={!!fin && !!choisi} fermer={() => setFin(null)}>
        {fin && choisi && <div className="pile">
          <p>{choisi.typeLibelle} {choisi.reference}, {choisi.client} : {montant(choisi.montant - choisi.utilise, choisi.devise as Devise)} restant.</p>
          <Champ libelle="Motif de fin : *">{(p) => <select {...p} className="saisie" value={fin.motif} onChange={(e) => setFin({ ...fin, motif: e.target.value })}>
            <option value=""></option><option value="echeance">Échéance</option><option value="mainlevee">Mainlevée</option><option value="mise_en_jeu">Mise en jeu de la garantie</option></select>}</Champ>
          {fin.motif === "mise_en_jeu" && <Champ libelle="Montant payé : *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={fin.montant} onChange={(e) => setFin({ ...fin, montant: e.target.value })} />}</Champ>}
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => setBoite({ type: "confirmation", message: "Voulez-vous vraiment mettre fin à cet engagement ?", oui: async () => {
              try { const e = await api.engagements.finir(choisi.id, { motif: fin.motif, montant: fin.montant.trim() ? lireMontant(fin.montant) : null }); setChoisi(e); setFin(null); setRelu((x) => x + 1);
                setBoite({ type: "succes", message: "Opération effectuée avec succès !" }); }
              catch (x) { setBoite({ type: "erreur", message: message(x) }); }
            } })}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setFin(null)}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Document imprimé (non montré par le manuel, registre S100-6) : l'acte d'engagement par signature, sur le modèle du contrat de prêt (CR-12) */
function ActeEngagement({ e, entete: t, coopec, fermer }: { e: Engagement; entete: Awaited<ReturnType<typeof api.engagements.contexte>>["entete"]; coopec: boolean; fermer: () => void }) {
  const dv = e.devise as Devise;
  return (
    <div className="pile">
      <article className="releve-std contrat-dat a-imprimer" id="acte-engagement" aria-label="Engagement par signature">
        <header className="releve-tete">
          <p className="releve-num">Réf. <span className="chiffres">{e.reference}</span></p>
          <h2 className="releve-titre">ENGAGEMENT PAR SIGNATURE</h2>
          <div className="releve-logo">{t.logo ? <img src={t.logo} alt={t.nom} /> : <strong>{t.sigle || t.nom}</strong>}<span>{t.nom}</span></div>
        </header>
        <p>{t.nom} donne, en faveur de {e.client}, {coopec ? "membre" : "client"} n° {e.membre}, l'engagement suivant : {e.typeLibelle.toLowerCase()}, {e.description}.</p>
        <p><strong>Montant :</strong> {montant(e.montant, dv)} ({montantEnLettres(e.montant, dv)}). <strong>Durée :</strong> {e.duree} mois, du {fr(e.dateDebut)} au {fr(e.dateFin)}.</p>
        <p><strong>Frais :</strong> {montant(e.frais, dv)}{e.pourcentage !== "0" ? ` (${e.pourcentage} % du montant` : " ("}{e.forfait ? `${e.pourcentage !== "0" ? ", " : ""}forfait ${montant(e.forfait, dv)})` : ")"}, prélevés sur le compte {e.compteEpargne}.
          {e.garantie ? ` Garantie : ${montant(e.garantie, dv)}, bloquée sur le compte ${e.compteGaranti} pendant la durée de l'engagement.` : ""}</p>
        {e.banque && <p><strong>Banque :</strong> {e.banque}.</p>}
        {e.observation && <p><strong>Observation :</strong> {e.observation}</p>}
        <div className="releve-haut">
          <div><strong>{coopec ? "Le membre" : "Le client"}</strong><br /><br /><br />{e.client}</div>
          <div style={{ textAlign: "right" }}><strong>Pour {t.nom}</strong><br /><br /><br />Fait à {t.ville}, le {fr(e.dateDebut)}</div>
        </div>
        <footer className="releve-pied">
          <strong>{t.nom.toUpperCase()}</strong>
          <span>{[t.adresse, t.commune, t.ville, t.pays].filter(Boolean).join(", ")}</span>
          <span>{[t.agrement && `Agrément BCC n° ${t.agrement}`, t.ifu && `N° impôt : ${t.ifu}`, t.bp && `B.P. ${t.bp}`].filter(Boolean).join(" · ")}</span>
        </footer>
      </article>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={() => imprimer("#acte-engagement")}>Imprimer</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
    </div>
  );
}
