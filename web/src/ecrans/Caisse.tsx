import { vers } from "./registre";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { DEVISES, montant, totalComptage, type Comptage, type Devise } from "../lib/montant";
import { Attention, Billetage, Bloquant, Champ, Chargement, Textes } from "../composants";

/** S09 : ouvrir une caisse pour la journée */
export function OuvertureCaisse() {
  const nav = useNavigate();
  const { donnees } = useDonnees(async () => {
    const [ctx, j, s] = await Promise.all([api.referentiel.contexte(), api.journees.courante(), api.caisses.duCaissier()]);
    const prises = j ? await api.caisses.delaJournee(j.id) : [];
    return { ctx, j, s, prises };
  });
  const [guichet, setGuichet] = useState(0);
  const [erreur, setErreur] = useState("");
  if (!donnees) return <Chargement />;
  const { ctx, j, s, prises } = donnees;
  return (
    <>
      <h1>Ouvrir une caisse</h1>
      {s ? <p>Vous tenez déjà {ctx.guichets.find((g) => g.id === s.guichetId)?.nom} aujourd'hui. <Link to={vers("S79")}>Billetage</Link>.</p> : (
        <form className="bloc pile" onSubmit={async (e) => { e.preventDefault(); setErreur(""); try { await api.caisses.ouvrir(guichet); nav(vers("S79")); } catch (x) { setErreur(message(x)); } }}>
          {j?.statut !== "ouverte" && <Attention>La journée n'est pas ouverte : le chef d'agence l'ouvre d'abord.</Attention>}
          <fieldset className="choix">
            <legend>Guichet</legend>
            {ctx.guichets.map((g) => {
              const prise = prises.find((p) => p.guichetId === g.id);
              return (
                <label key={g.id} className="case">
                  <input type="radio" name="guichet" checked={guichet === g.id} disabled={!!prise} onChange={() => setGuichet(g.id)} />
                  <span>{g.nom}{prise ? <span className="muet"> : déjà ouverte par {ctx.utilisateurs.find((u) => u.id === prise.caissierId)?.nom}</span> : ""}</span>
                </label>
              );
            })}
          </fieldset>
          <Bloquant>{erreur}</Bloquant>
          <div><button className="bouton" type="submit" disabled={!guichet}>Ouvrir et compter le fonds</button></div>
        </form>
      )}
    </>
  );
}

/** S79 : billetage d'ouverture puis d'arrêt, par devise. Le chef d'agence valide (S80). */
export function BilletageCaisse() {
  const { donnees } = useDonnees(async () => {
    const s = await api.caisses.duCaissier();
    if (!s) return { s };
    const [billetages, CDF, USD, ctx, attente] = await Promise.all([api.caisses.billetages(s.id), api.caisses.theorique(s.id, "CDF"), api.caisses.theorique(s.id, "USD"), api.referentiel.contexte(), api.operations.enAttente()]);
    return { s, billetages, theorique: { CDF, USD }, ctx, attente: attente.filter((o) => o.sessionId === s.id) };
  });
  if (!donnees) return <Chargement />;
  if (!donnees.s) return <><h1>Billetage</h1><p>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</p></>;
  const { s, billetages, theorique, ctx, attente } = donnees as Required<typeof donnees>;
  const ouvertureFaite = DEVISES.every((d) => billetages.some((b) => b.moment === "ouverture" && b.devise === d && b.validePar));
  const moment = ouvertureFaite ? "arret" : "ouverture";
  const g = ctx.guichets.find((x) => x.id === s.guichetId);
  return (
    <>
      <h1>{moment === "ouverture" ? "Fonds de caisse à l'ouverture" : "Arrêté de caisse"} · {g?.nom}</h1>
      <p className="chapeau">{moment === "ouverture"
        ? "Comptez les coupures réellement présentes. La colonne « attendu » vient du dernier arrêté."
        : "Comptez ce qui reste en caisse. L'attendu tient compte de toutes les opérations validées aujourd'hui."}</p>
      {s.statut === "arretee" && <p className="resultat-ok">Caisse arrêtée et validée.</p>}
      {moment === "arret" && attente.length > 0 && <Bloquant>{attente.length} opération en attente de visa : la faire viser ou refuser avant l'arrêté.</Bloquant>}
      <div className="deux-colonnes">
        {DEVISES.map((d) => <CompteDevise key={`${moment}-${d}`} sessionId={s.id} moment={moment} devise={d} theorique={theorique[d]}
          existant={billetages.find((b) => b.moment === moment && b.devise === d)} nomValideur={(id) => ctx.utilisateurs.find((u) => u.id === id)?.nom ?? ""} />)}
      </div>
      <Textes sources={["ARCHITECTURE § 6 : billetage d'ouverture et de clôture par devise, écart constaté et justifié", "ARCHITECTURE P8 : le billetage n'est pas une option", "Compte de l'écart de caisse : à confirmer"]} />
    </>
  );
}

function CompteDevise({ sessionId, moment, devise, theorique, existant, nomValideur }: {
  sessionId: number; moment: "ouverture" | "arret"; devise: Devise; theorique: Comptage;
  existant?: { compte: Comptage; justification?: string; validePar?: number }; nomValideur: (id: number) => string;
}) {
  const [compte, setCompte] = useState<Comptage>(existant?.compte ?? {});
  const [justif, setJustif] = useState(existant?.justification ?? "");
  const [erreur, setErreur] = useState("");
  const [envoye, setEnvoye] = useState(!!existant);
  const attendu = totalComptage(theorique), compte_ = totalComptage(compte), ecart = compte_ - attendu;
  if (existant?.validePar) return (
    <section className="bloc pile" aria-label={`Billetage ${devise}`}>
      <h3>{devise}</h3>
      <p className="resultat-ok">Validé par {nomValideur(existant.validePar)} : <span className="chiffres">{montant(totalComptage(existant.compte), devise)}</span>.</p>
    </section>
  );
  return (
    <form className="bloc pile" aria-label={`Billetage ${devise}`} onSubmit={async (e) => {
      e.preventDefault(); setErreur("");
      try { await api.caisses.saisirBilletage(sessionId, moment, devise, compte, justif); setEnvoye(true); } catch (x) { setErreur(message(x)); }
    }}>
      <h3>{devise}</h3>
      <Billetage devise={devise} comptage={compte} onChange={(c) => { setCompte(c); setEnvoye(false); }} stock={theorique} sens="comptage" libelleStock="Attendu" />
      <p className="dense">Attendu <span className="chiffres">{montant(attendu, devise)}</span> · compté <span className="chiffres">{montant(compte_, devise)}</span>
        {ecart !== 0 && <> · <strong className="erreur">écart <span className="chiffres">{montant(ecart, devise)}</span></strong></>}</p>
      {ecart !== 0 && (
        <Champ libelle="Justification de l'écart" aide="Obligatoire. Le chef d'agence la lit avant de valider.">
          {(p) => <textarea {...p} className="saisie" rows={2} value={justif} onChange={(e) => { setJustif(e.target.value); setEnvoye(false); }} />}
        </Champ>
      )}
      <Bloquant>{erreur}</Bloquant>
      <div className="rangee">
        <button className="bouton" type="submit" disabled={compte_ === 0 && attendu !== 0}>Envoyer au chef d'agence</button>
        {envoye && <span className="muet" role="status">Envoyé. En attente de validation.</span>}
      </div>
    </form>
  );
}
