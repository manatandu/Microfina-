import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, lendemain } from "../lib/dates";
import { montant, totalComptage } from "@design/montant.js";
import { Bloquant, Chargement, Textes, ChampDate } from "../composants";
import { mots } from "../lib/vocabulaire";

/** S12 : ouverture de journée (Administration > Ouverture de journée), et sa fermeture */
export function EcranJournee() {
  const { donnees: u } = useDonnees(() => api.session.courante());
  return (
    <>
      <h1>Ouverture de journée</h1>
      {u?.roles.includes("chef_agence") ? <Journee /> : <p>Réservé au chef d'agence.</p>}
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

function Journee() {
  const { donnees } = useDonnees(async () => {
    const j = await api.journees.courante();
    return { j, controles: j?.statut === "ouverte" ? await api.journees.controles(j.id) : [] };
  });
  const [date, setDate] = useState<string | null>(null);   // null : la date proposée
  const [erreur, setErreur] = useState("");
  if (!donnees) return <Chargement />;
  const { j, controles } = donnees;
  const proposee = j ? lendemain(j.date) : "2026-11-05";
  const act = async (f: () => Promise<unknown>) => { setErreur(""); try { await f(); } catch (x) { setErreur(message(x)); } };

  if (!j || j.statut === "fermee") return (
    <section className="bloc pile" aria-labelledby="t-ouvrir">
      <h2 id="t-ouvrir">Ouvrir la journée</h2>
      <ChampDate libelle="Date comptable" valeur={date ?? proposee} onChange={setDate} aide="jj/mm/aaaa. La date des opérations vient d'ici, jamais de l'horloge du poste." />
      <Bloquant>{erreur}</Bloquant>
      <div><button className="bouton" type="button" disabled={!(date ?? proposee)} onClick={() => act(() => api.journees.ouvrir(date ?? proposee))}>
        {(date ?? proposee) ? `Ouvrir la journée du ${fr(date ?? proposee)}` : "Saisir une date complète"}</button></div>
      <Textes sources={["ARCHITECTURE § 6 : une seule journée ouverte par agence", "ARCHITECTURE P3 : trois dates, la date comptable vient de la journée"]} />
    </section>
  );

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
