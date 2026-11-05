import { vers } from "./registre";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, lendemain } from "../lib/dates";
import { montant, totalComptage } from "@design/montant.js";
import { Bloquant, Chargement, Champ, Textes, Touche } from "../composants";
import { mots } from "../lib/vocabulaire";

/** Accueil : ce que la personne connectée a à faire aujourd'hui. Porte S12 (journée) pour le chef d'agence. */
export default function MaJournee() {
  const { donnees } = useDonnees(async () => {
    const [u, j, ctx] = await Promise.all([api.session.courante(), api.journees.courante(), api.referentiel.contexte()]);
    return { u, j, ctx };
  });
  if (!donnees?.u) return <Chargement />;
  const { u, j, ctx } = donnees;
  const m = mots(ctx.institution);
  return (
    <>
      <h1>Ma journée</h1>
      <p className="chapeau">{u.nom}. {j ? `Dernière journée : ${fr(j.date)}, ${j.statut === "ouverte" ? "ouverte" : "fermée"}.` : "Aucune journée encore."}</p>
      {u.roles.includes("chef_agence") && j?.statut === "ouverte" && <AValider />}
      {u.roles.includes("chef_agence") && <Journee />}
      {u.roles.includes("caissier") && <Caissier />}
      {u.roles.includes("agent_credit") && (
        <section className="bloc pile" aria-labelledby="t-agent">
          <h2 id="t-agent">Enrôlement</h2>
          <p><Link to={vers("S37")}>Enrôler un nouveau {m.membre}</Link>. Le chef d'agence le vise ensuite ; l'adhésion se fait au guichet.</p>
        </section>
      )}
      {u.roles.includes("comptable") && (
        <section className="bloc pile" aria-labelledby="t-compta">
          <h2 id="t-compta">Comptabilité</h2>
          <p><Link to={vers("S121")}>Balance des comptes</Link>, à jour à chaque opération : il n'y a pas d'étape « comptabiliser ».</p>
        </section>
      )}
    </>
  );
}

function Journee() {
  const { donnees } = useDonnees(async () => {
    const j = await api.journees.courante();
    return { j, controles: j?.statut === "ouverte" ? await api.journees.controles(j.id) : [] };
  });
  const [date, setDate] = useState("");
  const [erreur, setErreur] = useState("");
  if (!donnees) return <Chargement />;
  const { j, controles } = donnees;
  const proposee = j ? lendemain(j.date) : "2026-11-05";
  const act = async (f: () => Promise<unknown>) => { setErreur(""); try { await f(); } catch (x) { setErreur(message(x)); } };

  if (!j || j.statut === "fermee") return (
    <section className="bloc pile" aria-labelledby="t-ouvrir">
      <h2 id="t-ouvrir">Ouvrir la journée</h2>
      <Champ libelle="Date comptable" aide="La date des opérations vient d'ici, jamais de l'horloge du poste.">
        {(p) => <input {...p} className="saisie num" type="date" value={date || proposee} onChange={(e) => setDate(e.target.value)} />}
      </Champ>
      <Bloquant>{erreur}</Bloquant>
      <div><button className="bouton" type="button" onClick={() => act(() => api.journees.ouvrir(date || proposee))}>Ouvrir la journée du {fr(date || proposee)}</button></div>
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

export function AValider() {
  const { donnees } = useDonnees(async () => {
    const [billetages, tiers, ops, ctx] = await Promise.all([api.caisses.aValider(), api.tiers.aViser(), api.operations.enAttente(), api.referentiel.contexte()]);
    return { billetages, tiers, ops, ctx };
  });
  const [erreur, setErreur] = useState("");
  if (!donnees) return <Chargement />;
  const { billetages, tiers, ops, ctx } = donnees;
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

function Caissier() {
  const { donnees } = useDonnees(async () => {
    const [j, s, ctx] = await Promise.all([api.journees.courante(), api.caisses.duCaissier(), api.referentiel.contexte()]);
    const billetages = s ? await api.caisses.billetages(s.id) : [];
    return { j, s, ctx, billetages };
  });
  if (!donnees) return <Chargement />;
  const { j, s, ctx, billetages } = donnees;
  const ouvertureOk = (["CDF", "USD"] as const).every((d) => billetages.some((b) => b.moment === "ouverture" && b.devise === d && b.validePar));
  const m = mots(ctx.institution);
  return (
    <section className="bloc pile" aria-labelledby="t-caisse">
      <h2 id="t-caisse">Ma caisse</h2>
      {!j || j.statut !== "ouverte" ? <p>La journée n'est pas ouverte. Le chef d'agence l'ouvre d'abord.</p>
        : !s ? <p><Link to={vers("S09")}>Ouvrir une caisse</Link>.</p>
        : s.statut === "arretee" ? <p>Caisse arrêtée et validée. Bonne fin de journée.</p>
        : !ouvertureOk ? <p><Link to={vers("S79")}>Compter le fonds de caisse</Link>, puis le chef d'agence valide le billetage.</p>
        : <ul className="liste-taches">
            <li><Link to={vers("S74")}>Dépôt ou retrait</Link><span className="muet"><Touche>F2</Touche> rechercher, <Touche>F9</Touche> valider</span></li>
            <li><Link to={vers("S73")}>Adhésion d'un nouveau {m.membre}</Link></li>
            <li><Link to={vers("S79")}>Arrêter la caisse</Link><span className="muet">billetage de fin de journée</span></li>
          </ul>}
    </section>
  );
}
