// S97 : Crédit > Liste rouge (manuel Microfina++, p. 119 et 120, captures « Gestion de la liste rouge ») : Infos client (N° Client, Intitulé, Motif),
// Ajouter, Retirer, chacun après confirmation ; grille des inscrits. Registre S97-1 à S97-4, CR-9 ; Instr. BCC 13, art. 7.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Champ, Chargement, Dialogue, Fiche, Lecture, LigneFiltres, Paginee, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

export default function ListeRouge() {
  const [t, setT] = useState<{ id: number; numero: string; nom: string } | null>(null);
  const [motif, setMotif] = useState("");
  const [reference, setReference] = useState("");
  const [visees, setVisees] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: l } = useDonnees(() => api.listeRouge.lister(), [relu]);
  if (!l) return <Chargement />;
  const choisir = (x: Tiers) => setT({ id: x.id, numero: x.numero, nom: x.intitule || [x.nom, x.postnom, x.prenom].filter(Boolean).join(" ") });
  function agir(sens: "ajouter" | "retirer") {
    setBoite({ type: "confirmation", message: sens === "ajouter" ? "Voulez-vous ajouter ce client à la liste rouge ?" : "Voulez-vous retirer ce client de la liste rouge ?", oui: async () => {
      try {
        if (sens === "ajouter") await api.listeRouge.ajouter({ tiersId: t?.id ?? null, motif, referenceBcc: reference,
          personnesVisees: visees.split("\n").map((x) => x.split(";")).map(([nom, piece]) => ({ nom: (nom ?? "").trim(), piece: (piece ?? "").trim() })) });
        else await api.listeRouge.retirer({ tiersId: t?.id ?? null, motif });
        setMotif(""); setReference(""); setVisees(""); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Opération effectuée avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h2>Gestion de la liste rouge</h2>
      <section className="bloc pile" aria-label="Gestion de la liste rouge">
        <fieldset className="cadre-champs formulaire"><legend>Infos client</legend>
          <div className="ligne-champ"><Champ libelle="N° Client:">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button></div>
          <Champ libelle="Intitulé:">{(p) => <Lecture {...p} value={t?.nom ?? ""} />}</Champ>
          <Champ libelle="Motif: *">{(p) => <textarea {...p} className="saisie" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />}</Champ>
          <Champ libelle="Réf. décision BCC (mise à l'index)">{(p) => <input {...p} className="saisie code" autoComplete="off" value={reference} onChange={(e) => setReference(e.target.value)} />}</Champ>
          <Champ libelle="Dirigeants et associés visés" aide="Pour une société mise à l'index : un par ligne, nom ; n° de pièce">{(p) => <textarea {...p} className="saisie" rows={2} value={visees} onChange={(e) => setVisees(e.target.value)} />}</Champ>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => agir("ajouter")}>Ajouter</button>
          <button className="bouton secondaire" type="button" onClick={() => agir("retirer")}>Retirer</button>
        </div>
        <Paginee lignes={l} colonnes={(x) => [x.membre, x.client, fr(x.date), null]}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">N° client</th><th scope="col">Intitulé</th><th scope="col">Date</th><th scope="col">Motif</th></tr>
            <LigneFiltres titres={["N° client", "Intitulé", "Date", null]} /></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
            {v.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.tiersId === t?.id} onClick={() => setT({ id: x.tiersId, numero: x.membre, nom: x.client })}>
              <td className="code">{x.membre}</td><td>{x.client}</td><td className="chiffres">{fr(x.date)}</td>
              <td>{x.motif}{x.referenceBcc ? ` (décision BCC ${x.referenceBcc})` : ""}{x.personnesVisees.length ? ` ; visés : ${x.personnesVisees.map((y) => y.nom).join(", ")}` : ""}</td></tr>)}</tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 119 et 120 : 8-Liste rouge, N° Client, motif, Ajouter ou Retirer pour confirmer l'opération ; deux captures (confirmations)",
          "Registre CR-9 : un client inscrit ne peut ni déposer une demande, ni être approuvé, ni recevoir une mise en place ; une mise à l'index de la BCC s'inscrit avec la référence de la décision",
          "Instr. BCC 13, art. 7 : la mise à l'index suspend ou interdit les services et facilités ; celle d'une personne morale touche ses dirigeants et associés, reconnus par leur pièce d'identité (dirigeants de la fiche de l'entreprise, personnes visées notées ici ; registre S97-4)"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (x) => (x ? await api.tiers.rechercher(x) : [])} choisir={(x) => { choisir(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
