// S53 : Banque > Virement et prélèvement (plan d'allègement, point 7.3). S53 (contrepartie bancaire, manuel Microfina++, p. 61) et l'onglet Virement/Prélèvement
// de S116 (autre compte du plan, p. 134 ; texte p. 161) en un écran : la contrepartie se choisit dedans, selon les droits (S53, S116). Saisi ici, puis visé et
// validé dans « Opérations en attente ». Sens : virement = le compte du client est crédité ; prélèvement = il est débité, sur l'ordre du client.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite, Formulaire } from "../composants";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { PartiesVirement, PARTIES_VIDES, type Parties } from "../composants/PartiesVirement";
import { ChoixBanque } from "./OperationsBanque";
import { CadreCompte, ChampsLignes, Identifiant, Recherche, useClient, useLignes } from "./AutresOperations";

const CONTREPARTIES = [["banque", "Compte bancaire de l'institution", "S53"], ["compte", "Autre compte comptable", "S116"]] as const;
type Contrepartie = (typeof CONTREPARTIES)[number][0];

export function VirementPrelevement() {
  const { donnees } = useDonnees(async () => {
    const u = await api.session.courante();
    const droits = new Set((u as { droits?: string[] } | null)?.droits ?? []);
    const [ref, lu, ctx] = await Promise.all([api.referentiel.contexte(), droits.has("S53") ? api.banqueOperations.lire() : null, droits.has("S116") ? api.operationsCompta.lire() : null]);
    return { droits, agence: ref.agence.nom, lu, ctx };
  });
  const k = useClient(), g = useLignes();
  const [parties, setParties] = useState<Parties>(PARTIES_VIDES);   // A12
  const vide = { date: "", type: "" as "" | "virement" | "prelevement", contrepartie: "" as "" | Contrepartie, banque: "", compte: "", libelle: "", montant: "", ordre: "" };
  const [f, setF] = useState(vide);
  const [cle, setCle] = useState(nouvelleCle);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { droits, agence, lu, ctx } = donnees;
  const maj = (p: Partial<typeof vide>) => setF((x) => ({ ...x, ...p }));
  const choix = CONTREPARTIES.filter(([, , dr]) => droits.has(dr));
  const cp = f.contrepartie || choix[0]?.[0] || "";
  const date = f.date || lu?.date || ctx?.date || "";
  const cb = lu?.comptes.find((c) => String(c.id) === f.compte);
  // A12 : une contrepartie bancaire (PCCI, compte 56) fait un virement entre institutions (loi 22/068, art. 57 et 61)
  const bancaire = cp === "banque" || [g.s.compte, ...g.l.map((x) => x.compte)].some((c) => (c ?? "").trim().startsWith("56"));
  const vider = () => { setF(vide); k.choisir(null); g.vider(); setCle(nouvelleCle()); setParties(PARTIES_VIDES); };

  function enregistrer() {
    if (!f.type) { setBoite({ type: "erreur", message: "À remplir : type opération." }); return; }
    const ordreClient = f.type === "prelevement" ? f.ordre : undefined;
    const envoi = cp === "banque"
      ? () => api.banqueOperations.enregistrerVirement({ cle, date, type: f.type === "virement" ? "virement_client" : "prelevement_client", compteDepotId: k.c?.id,
        compteBancaireId: f.compte ? Number(f.compte) : undefined, libelle: f.libelle, montant: lireMontant(f.montant) ?? 0, ordreClient, ...parties })
      : () => api.operationsCompta.enregistrerVirement({ cle, type: f.type, date, compteDepotId: k.c?.id ?? null, multiligne: g.multi, lignes: g.envoi(), ordreClient, ...parties });
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await envoi(); vider(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }

  return (
    <>
      <Formulaire className="bloc pile" label="Virement et prélèvement" envoyer={enregistrer}>
        <div className="grille-cadres">
          <fieldset className="pile cadre-champs">
            <legend>Agence</legend>
            <ChampDate libelle="Date opération" valeur={date} onChange={(v) => maj({ date: v })} />
          </fieldset>
          <Identifiant titre="Identifiant Client" agence={agence} k={k} chercher={() => setRecherche(true)} />
          <fieldset className="pile cadre-champs">
            <legend>Type operation</legend>
            <div className="ligne-champ" role="radiogroup" aria-label="Type opération *">
              <span>Type opération *</span>
              <label className="case"><input type="radio" name="type-virement" checked={f.type === "virement"} onChange={() => maj({ type: "virement" })} /><span>Virement</span></label>
              <label className="case"><input type="radio" name="type-virement" checked={f.type === "prelevement"} onChange={() => maj({ type: "prelevement" })} /><span>Prélèvement</span></label>
            </div>
            {f.type === "prelevement" && <Champ libelle="Ordre du client : *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.ordre} onChange={(e) => maj({ ordre: e.target.value })} />}</Champ>}
            <label className="case"><input type="checkbox" disabled={cp !== "compte"} checked={cp === "compte" && g.multi} onChange={(e) => g.setMulti(e.target.checked)} /><span>Type écriture Multiligne</span></label>
          </fieldset>
          <CadreCompte titre="Compte Client" k={k} />
        </div>
        <fieldset className="cadre-champs pile">
          <legend>Contrepartie</legend>
          <div className="ligne-champ" role="radiogroup" aria-label="Contrepartie *">
            {choix.map(([v, l]) => <label key={v} className="case"><input type="radio" name="contrepartie" checked={cp === v} onChange={() => { maj({ contrepartie: v }); g.vider(); }} /><span>{l}</span></label>)}
          </div>
          {cp === "banque" && lu && <>
            <div className="formulaire">
              <ChoixBanque lu={lu} libelleBanque="Banque *" libelleCompte="Compte Banque *" banque={f.banque} compte={f.compte}
                onBanque={(v) => maj({ banque: v, compte: "" })} onCompte={(v) => maj({ compte: v })} />
              <Champ libelle="Libellé opération *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.libelle} onChange={(e) => maj({ libelle: e.target.value })} />}</Champ>
              <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
            </div>
            <p>Solde Banque : <strong className="chiffres">{cb ? montant(cb.solde, cb.devise as Devise) : "0"}</strong></p>
          </>}
          {cp === "compte" && ctx && <ChampsLignes g={g} ctx={ctx} devise={(k.c?.devise ?? "CDF") as Devise} />}
        </fieldset>
        <PartiesVirement valeur={parties} maj={setParties} recu={bancaire && f.type === "virement"} sortant={bancaire && f.type === "prelevement"} />
        <div className="actions-onglets">
          <button className="bouton" type="submit">Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={vider}>Annuler</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 61 (Virement prélèvement, contrepartie bancaire) et p. 134 (onglet Virement/Prélèvement, autre compte) ; plan d'allègement, point 7.3",
          "Prélèvement : sur le solde disponible du compte, sur l'ordre du client (Code civil, livre III, art. 185, 2° ; loi 11/020, art. 48)",
          "Donneur d'ordre et bénéficiaire d'un virement entre institutions : loi 22/068, art. 57 et 61"]} />
      </Formulaire>
      <Recherche ouverte={recherche} fermer={() => setRecherche(false)} choisir={k.choisir} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
