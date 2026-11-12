import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { montant, totalComptage } from "@design/montant.js";
import { Bloquant, Champ, Chargement, ChampDate, Dialogue, Textes, type Boite } from "../composants";
import { TableFiltree } from "./Groupes";
import { mots } from "../lib/vocabulaire";

/** S12 : Administration > Ouverture de journée (manuel Microfina++, p. 21) */
export function EcranJournee() {
  const [date, setDate] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => ({ liste: await api.journees.liste(), ctx: await api.referentiel.contexte() }), [relu]);
  if (!donnees) return <Chargement />;
  const { liste, ctx } = donnees;
  const nom = (id?: number) => ctx.utilisateurs.find((u) => u.id === id)?.nom ?? "";
  const heure = (iso?: string) => (iso ? new Date(iso).toTimeString().slice(0, 8) : "");
  const jour = (iso?: string) => (iso ? fr(new Date(iso).toLocaleDateString("sv-SE")) : "");
  function enregistrer() {
    if (!date) { setBoite({ type: "erreur", message: "À remplir : date à ouvrir." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.journees.ouvrir(date); setDate(""); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Ouverture de journée</h1>
      <section className="bloc pile" aria-label="Ouverture de journée">
        <div className="grille-cadres quatre">
          <Champ libelle="Dernière journée ouverte">{(p) => <input {...p} className="saisie code" readOnly value={liste[0] ? fr(liste[0].date) : ""} />}</Champ>
          <ChampDate libelle="Date à ouvrir" valeur={date} onChange={setDate} aide="" />
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={() => setDate("")}>Annuler</button>
        </div>
        <TableFiltree sansFiltres lignes={liste} cle={(j) => j.id} colonnes={[
          { titre: "Journée", valeur: (j) => fr(j.date), classe: "chiffres" },
          { titre: "Ouverte par", valeur: (j) => nom(j.ouvertePar) },
          { titre: "Heure ouverture", valeur: (j) => heure(j.ouverteLe), classe: "chiffres" },
          { titre: "Date fermeture", valeur: (j) => jour(j.fermeeLe), classe: "chiffres" },
          { titre: "Fermée par", valeur: (j) => nom(j.fermeePar) },
        ]} />
        <Textes sources={["Manuel Microfina++, p. 21 : Ouverture de journée, Dernière journée ouverte, Date à ouvrir, Enregistrer, Annuler, liste Journée, Ouverte par, Heure ouverture, Date fermeture, Fermée par ; « Renseigner le champ de la date à ouvrir avant d'enregistrer »",
          "Manuel Microfina++, chapitre Comptabilité : « la comptabilisation ou clôture des journées »",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S111 : Comptabilité > Comptabilisation. Écran pas encore réaligné : reprend en attendant la fermeture de journée, retirée de S12
 * (dans Microfina++, « la comptabilisation ou clôture des journées » est au menu Comptabilité). */
export function FermetureJournee() {
  const { donnees: u } = useDonnees(() => api.session.courante());
  return (
    <>
      <h1>Comptabilisation</h1>
      {u?.roles.includes("chef_agence") ? <Fermeture /> : <p>Réservé au chef d'agence.</p>}
    </>
  );
}

/** Écrans de validation : S80 (billetage), S40 (visa du client), S113 (visas des opérations) */
export function EcranValidation({ titre, seulement }: { titre: string; seulement: "billetages" | "tiers" | "operations" }) {
  const { donnees: u } = useDonnees(() => api.session.courante());
  return (
    <>
      <h1>{titre}</h1>
      {u?.roles.includes("chef_agence") ? <AValider seulement={seulement} /> : <p>Réservé au chef d'agence.</p>}
    </>
  );
}

function Fermeture() {
  const { donnees } = useDonnees(async () => {
    const j = await api.journees.courante();
    return { j, controles: j?.statut === "ouverte" ? await api.journees.controles(j.id) : [] };
  });
  const [erreur, setErreur] = useState("");
  if (!donnees) return <Chargement />;
  const { j, controles } = donnees;
  const act = async (f: () => Promise<unknown>) => { setErreur(""); try { await f(); } catch (x) { setErreur(message(x)); } };
  if (!j || j.statut === "fermee") return <p>Aucune journée ouverte.</p>;
  const bloquants = controles.filter((c) => c.etat === "ko").length;
  return (
    <section className="bloc pile" aria-labelledby="t-fermer">
      <h2 id="t-fermer">Fermer la journée du {fr(j.date)}</h2>
      <div role="list">
        {controles.map((c) => (
          <div key={c.titre} className="controle" data-etat={c.etat} role="listitem">
            <span className="marque" aria-hidden="true">{c.etat === "ok" ? "✓" : c.etat === "ko" ? "✗" : "·"}</span>
            <p><strong>{c.titre}</strong>{c.etat === "ko" ? " : bloque la fermeture" : ""}</p>
            <p className="detail">{c.detail}{c.source ? ` (${c.source})` : ""}</p>
          </div>
        ))}
      </div>
      <Bloquant>{erreur}</Bloquant>
      <div><button className="bouton" type="button" disabled={bloquants > 0} onClick={() => act(() => api.journees.fermer(j.id))}>Fermer la journée</button></div>
    </section>
  );
}

export function AValider({ seulement }: { seulement?: "billetages" | "tiers" | "operations" } = {}) {
  const { donnees } = useDonnees(async () => {
    const [billetages, tiers, ops, ctx] = await Promise.all([api.caisses.aValider(), api.tiers.aViser(), api.operations.enAttente(), api.referentiel.contexte()]);
    return { billetages, tiers, ops, ctx };
  });
  const [erreur, setErreur] = useState("");
  if (!donnees) return <Chargement />;
  const { ctx } = donnees;
  const billetages = !seulement || seulement === "billetages" ? donnees.billetages : [];
  const tiers = !seulement || seulement === "tiers" ? donnees.tiers : [];
  const ops = !seulement || seulement === "operations" ? donnees.ops : [];
  const act = async (f: () => Promise<unknown>) => { setErreur(""); try { await f(); } catch (x) { setErreur(message(x)); } };
  const nom = (id: number) => ctx.utilisateurs.find((x) => x.id === id)?.nom ?? "";
  const m = mots(ctx.institution);
  const rien = !billetages.length && !tiers.length && !ops.length;
  return (
    <section className="bloc pile" aria-labelledby="t-valider">
      <h2 id="t-valider">À valider</h2>
      {rien && <p className="muet">Rien à valider pour l'instant.</p>}
      <Bloquant>{erreur}</Bloquant>
      {billetages.length > 0 && (
        <ul className="liste-taches" aria-label="Billetages">
          {billetages.map((b) => {
            const ecart = totalComptage(b.compte) - totalComptage(b.theorique);
            return (
              <li key={b.id}>
                <span>Billetage {b.moment === "ouverture" ? "d'ouverture" : "d'arrêt"} {b.devise}, compté par {nom(b.saisiPar)} : <span className="chiffres">{montant(totalComptage(b.compte), b.devise)}</span>
                  {ecart !== 0 ? <> · <strong className="erreur">écart {montant(ecart, b.devise)}</strong> · « {b.justification} »</> : " · sans écart"}</span>
                <button className="bouton secondaire" type="button" onClick={() => act(() => api.caisses.validerBilletage(b.id))}>Valider</button>
              </li>
            );
          })}
        </ul>
      )}
      {tiers.length > 0 && (
        <ul className="liste-taches" aria-label={`${m.membres} à viser`}>
          {tiers.map((t) => (
            <li key={t.id}>
              <span>{m.Membre} à viser : <strong>{[t.nom, t.postnom, t.prenom].filter(Boolean).join(" ")}</strong> <span className="chiffres muet">{t.numero}</span>, {t.pieceType} <span className="chiffres">{t.pieceNumero}</span>, enrôlé par {nom(t.creePar)}</span>
              <button className="bouton secondaire" type="button" onClick={() => act(() => api.tiers.viser(t.id))}>Viser</button>
            </li>
          ))}
        </ul>
      )}
      {ops.length > 0 && (
        <ul className="liste-taches" aria-label="Opérations à viser">
          {ops.map((o) => (
            <li key={o.id}>
              <span>Retrait de <span className="chiffres">{montant(o.montant, o.devise)}</span> pour {o.remisPar}, demandé par {nom(o.saisiPar)} à {o.heure}</span>
              <span className="rangee">
                <button className="bouton secondaire" type="button" onClick={() => act(() => api.operations.viser(o.id))}>Viser</button>
                <button className="bouton discret" type="button" onClick={() => act(() => api.operations.refuser(o.id))}>Refuser</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
