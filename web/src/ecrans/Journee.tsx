import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, heureDe, jourDe } from "../lib/dates";
import { montant, totalComptage } from "@design/montant.js";
import { Bloquant, Champ, Chargement, ChampDate, Dialogue, Textes, type Boite, Formulaire } from "../composants";
import { TableFiltree } from "./Groupes";
import { mots } from "../lib/vocabulaire";
import { OuvertureFermetureGuichets } from "./Guichets";

/** Jour ouvré suivant d'après le calendrier de l'agence (S34) : ni férié, ni jour non coché ; aucun jour coché : tous ouvrés (registre S34-4) */
function jourOuvreSuivant(apres: string, jours: boolean[], feries: string[]): string {
  let x = apres;
  for (let i = 0; i < 31; i++) {
    x = new Date(Date.parse(`${x}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    if (!feries.includes(x) && !(jours.some(Boolean) && !jours[new Date(`${x}T00:00:00Z`).getUTCDay()])) return x;
  }
  return x;
}

/** S12 : Administration > Journée > Journée du jour (plan d'allègement, point 8.5). Trois étapes sur un écran : ouvrir la journée (manuel p. 21 ; le jour ouvré
 *  suivant est proposé), cours du jour de chaque devise (le dernier cours est proposé ; PCCI § 7.1), ouvrir les guichets (S09, p. 19). Chaque étape avec son droit. */
export function EcranJournee() {
  const [date, setDate] = useState("");
  const [cours, setCours] = useState<Record<string, string>>({});
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const [liste, ctx, u, cal] = await Promise.all([api.journees.liste(), api.referentiel.contexte(), api.session.courante(), api.jours.lire()]);
    const droits = new Set((u as { droits?: string[] } | null)?.droits ?? []);
    return { liste, ctx, cal, droits, dv: droits.has("S35") ? await api.devises.lire() : null };
  }, [relu]);
  if (!donnees) return <Chargement />;
  const { liste, ctx, cal, droits, dv } = donnees;
  const nom = (id?: number) => ctx.utilisateurs.find((u) => u.id === id)?.nom ?? "";
  const quand = (iso?: string) => (iso ? `${fr(jourDe(iso))} ${heureDe(iso)}` : "");   // jour et heure de l'agence (point 11.4)
  const derniere = liste[0];
  const jours = cal.agences.find((a) => a.id === cal.agenceDefaut)?.jours ?? [];
  const proposee = derniere ? jourOuvreSuivant(derniere.date, jours, cal.feries.map((f) => f.date)) : "";
  const ouverte = derniere && derniere.statut !== "fermee" ? derniere : null;
  const etrangeres = (dv?.devises ?? []).filter((d) => d.code !== "CDF");
  const veille = (code: string) => [...(dv?.cours ?? [])].filter((c) => c.devise === code).sort((a, b) => b.jour.localeCompare(a.jour))[0];
  const valeurCours = (code: string) => cours[code] ?? (veille(code) ? String(veille(code)!.cours).replace(".", ",") : "");
  const agir = (faire: () => Promise<unknown>, apres: () => void) => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await faire(); apres(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  function ouvrir() {
    const d = date || proposee;
    if (!d) { setBoite({ type: "erreur", message: "À remplir : date à ouvrir." }); return; }
    agir(() => api.journees.ouvrir(d), () => setDate(""));
  }
  function enregistrerCours() {
    if (!ouverte) return;
    agir(async () => { for (const d of etrangeres) await api.devises.enregistrerCours({ devise: d.code, jour: ouverte.date, cours: valeurCours(d.code) }); }, () => setCours({}));
  }
  return (
    <>
      <Formulaire className="bloc pile" label="Ouvrir la journée" envoyer={ouvrir}>
        <h2>Ouvrir la journée</h2>
        <div className="grille-cadres quatre">
          <Champ libelle="Dernière journée ouverte">{(p) => <input {...p} className="saisie date" readOnly value={derniere ? fr(derniere.date) : ""} />}</Champ>
          <ChampDate libelle="Date à ouvrir" valeur={date || proposee} onChange={setDate} aide="" />
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="submit">Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={() => setDate("")}>Annuler</button>
        </div>
      </Formulaire>
      {dv && ouverte && etrangeres.length > 0 && <Formulaire className="bloc pile" label="Cours du jour" envoyer={enregistrerCours}>
        <h2>Cours du jour : {fr(ouverte.date)}</h2>
        <div className="grille-cadres quatre">
          {etrangeres.map((d) => <Champ key={d.code} libelle={`Cours ${d.code} (CDF pour une unité) *`}>{(p) => <input {...p} className="saisie code" inputMode="decimal" autoComplete="off"
            value={valeurCours(d.code)} onChange={(e) => setCours({ ...cours, [d.code]: e.target.value })} />}</Champ>)}
        </div>
        <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer les cours</button></div>
      </Formulaire>}
      {droits.has("S09") && <OuvertureFermetureGuichets dansJournee />}
      <section className="bloc pile" aria-label="Journées">
        <TableFiltree sansFiltres lignes={liste} cle={(j) => j.id} colonnes={[
          { titre: "Journée", valeur: (j) => fr(j.date), classe: "chiffres" },
          { titre: "Ouverte le", valeur: (j) => quand(j.ouverteLe), classe: "chiffres" },
          { titre: "Ouverte par", valeur: (j) => nom(j.ouvertePar) },
          { titre: "Fermée le", valeur: (j) => quand(j.fermeeLe), classe: "chiffres" },
          { titre: "Fermée par", valeur: (j) => nom(j.fermeePar) },
          { titre: "État", valeur: (j) => (j.statut === "fermee" ? "Fermée" : "Ouverte") },
        ]} />
        <Textes sources={["Manuel Microfina++, p. 21 : Ouverture de journée ; p. 19 : Ouverture/Fermeture de guichets ; p. 45 et 46 : cours ; plan d'allègement, point 8.5",
          "PCCI § 7.1 : opérations en devises converties au cours du jour de la transaction ; calendrier de l'agence (S34 ; loi 22/069, art. 186)"]} />
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
      <h2>Comptabilisation</h2>
      {u?.roles.includes("chef_agence") ? <Fermeture /> : <p>Réservé au chef d'agence.</p>}
    </>
  );
}

/** Écrans de validation : S80 (billetage), S40 (visa du client), S113 (visas des opérations) */
export function EcranValidation({ titre, seulement }: { titre: string; seulement: "billetages" | "tiers" | "operations" }) {
  const { donnees: u } = useDonnees(() => api.session.courante());
  return (
    <>
      <h2>{titre}</h2>
      {u?.roles.includes("chef_agence") ? <AValider seulement={seulement} /> : <p>Réservé au chef d'agence.</p>}
    </>
  );
}

/** S111 : comptabilisation de la journée. « Journée non comptabilisée » (manuel p. 130) : les journées en attente, la plus ancienne d'abord,
 *  comptabilisées dans l'ordre des dates (registre T14, S12-2). */
function Fermeture() {
  const [choisie, setChoisie] = useState<number | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const attente = (await api.journees.liste()).filter((x) => x.statut !== "fermee").sort((a, b) => a.date.localeCompare(b.date));
    const j = attente.find((x) => x.id === choisie) ?? attente[0] ?? null;
    return { attente, j, controles: j ? await api.journees.controles(j.id) : [] };
  }, [choisie, relu]);
  const [erreur, setErreur] = useState("");
  if (!donnees) return <Chargement />;
  const { attente, j, controles } = donnees;
  const act = async (f: () => Promise<unknown>) => { setErreur(""); try { await f(); setChoisie(null); setRelu((v) => v + 1); } catch (x) { setErreur(message(x)); } };
  if (!j) return <p>Aucune journée ouverte.</p>;
  const bloquants = controles.filter((c) => c.etat === "ko").length;
  return (
    <section className="bloc pile" aria-labelledby="t-fermer">
      <Champ libelle="Journée non comptabilisée :">{(p) => <select {...p} className="saisie code" value={j.id} onChange={(e) => setChoisie(Number(e.target.value))}>
        {attente.map((x) => <option key={x.id} value={x.id}>{fr(x.date)}</option>)}</select>}</Champ>
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
