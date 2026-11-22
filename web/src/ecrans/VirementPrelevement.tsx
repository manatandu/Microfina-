// S53 : Banque > Virement prélèvement (manuel Microfina++, p. 61) : entre le compte d'un client et un compte bancaire de l'institution.
// Saisi ici, visé puis validé (S57), comptabilisé (S111). Sens (registre S53-1) : virement = la banque crédite le compte du client ;
// prélèvement = le compte du client est débité au profit de la banque.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Lecture } from "../composants";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { PartiesVirement, PARTIES_VIDES, type Parties } from "../composants/PartiesVirement";
import { RechercheClient } from "./Visa";
import { ChoixBanque } from "./OperationsBanque";

const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

export function VirementPrelevement() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), lu: await api.banqueOperations.lire() }));
  const [parties, setParties] = useState<Parties>(PARTIES_VIDES);   // A12
  const vide = { date: "", type: "" as "" | "virement_client" | "prelevement_client", compteClient: "", banque: "", compte: "", libelle: "", montant: "" };
  const [f, setF] = useState(vide);
  const [t, setT] = useState<Tiers | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  if (!donnees) return <Chargement />;
  const { ctx, lu } = donnees;
  const maj = (p: Partial<typeof vide>) => setF({ ...f, ...p });
  const date = f.date || lu.date;
  const cc = (comptes ?? []).find((c) => String(c.id) === f.compteClient);
  const cb = lu.comptes.find((c) => String(c.id) === f.compte);
  const lu_ = (libelle: string, v: string) => <Champ libelle={libelle}>{(p) => <Lecture {...p} value={v} />}</Champ>;
  const vider = () => { setF(vide); setT(null); setCle(nouvelleCle()); setParties(PARTIES_VIDES); };

  function enregistrer() {
    if (!f.type) { setBoite({ type: "erreur", message: "À remplir : type opération." }); return; }
    const d = { cle, date, type: f.type, compteDepotId: f.compteClient ? Number(f.compteClient) : undefined, compteBancaireId: f.compte ? Number(f.compte) : undefined,
      libelle: f.libelle, montant: lireMontant(f.montant) ?? 0, ...parties };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.banqueOperations.enregistrerVirement(d); vider(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <h1>Virement prélèvement</h1>
      <section className="bloc pile" aria-label="Virement prélèvement">
        <div className="grille-cadres">
          <fieldset className="pile cadre-champs">
            <legend>Agence</legend>
            {lu_("Agence *", ctx.agence.nom)}
            <ChampDate libelle="Date opération" valeur={date} onChange={(v) => maj({ date: v })} />
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Identifiant Client</legend>
            <div className="ligne-champ">
              <Champ libelle="N° Client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            {lu_("Intitule", t ? nomComplet(t) : "")}
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Type operation</legend>
            <div className="ligne-champ" role="radiogroup" aria-label="Type opération *">
              <span>Type opération *</span>
              <label className="case"><input type="radio" name="type-virement" checked={f.type === "virement_client"} onChange={() => maj({ type: "virement_client" })} /><span>Virement</span></label>
              <label className="case"><input type="radio" name="type-virement" checked={f.type === "prelevement_client"} onChange={() => maj({ type: "prelevement_client" })} /><span>Prélèvement</span></label>
            </div>
            <label className="case" title="À confirmer : le manuel ne montre pas cette case cochée (registre S52-1)"><input type="checkbox" disabled /><span>Type écriture Multiligne</span></label>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Compte Client</legend>
            <Champ libelle="N° Compte *">{(p) => <select {...p} className="saisie" value={f.compteClient} onChange={(e) => maj({ compteClient: e.target.value })}>
              <option value=""></option>{(comptes ?? []).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            {lu_("N° Comptable", cc?.pcci ?? "")}
            {lu_("Produit", cc?.intitule ?? "")}
            {lu_("Solde", cc ? montant(cc.solde, cc.devise as Devise) : "")}
          </fieldset>
        </div>
        <fieldset className="cadre-champs pile">
          <legend>Banque</legend>
          <div className="formulaire">
            <ChoixBanque lu={lu} libelleBanque="Banque *" libelleCompte="Compte Banque *" banque={f.banque} compte={f.compte}
              onBanque={(v) => maj({ banque: v, compte: "" })} onCompte={(v) => setF((x) => ({ ...x, compte: v }))} />
            <Champ libelle="Libellé opération *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.libelle} onChange={(e) => maj({ libelle: e.target.value })} />}</Champ>
            <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
          </div>
          <p>Solde Banque : <strong className="chiffres">{cb ? montant(cb.solde, cb.devise as Devise) : "0"}</strong></p>
        </fieldset>
        <PartiesVirement valeur={parties} maj={setParties} recu={f.type === "virement_client"} sortant={f.type === "prelevement_client"} />
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={vider}>Annuler</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 61 : écran Virement prélèvement (Agence, Identifiant Client, Type operation, Compte Client, Banque), Enregistrer, Annuler",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Chaîne de l'opération : saisie ici, visée puis validée (Banque > Visa, Validation, S57), comptabilisée (S111)",
          "Prélèvement : sur le solde disponible du compte, comme un retrait (S74) ; prélèvements déjà saisis déduits"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); maj({ compteClient: "" }); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
