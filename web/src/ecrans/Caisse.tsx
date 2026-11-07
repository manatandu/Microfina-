import { vers } from "./registre";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { COUPURES, DEVISES, lireMontant, montant, totalComptage, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Bloquant, Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";
import { fr } from "../lib/dates";

const enSaisie = (m: number) => (m ? String(m / 100).replace(".", ",") : "");

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
        <form className="bloc pile" onSubmit={async (e) => { e.preventDefault(); setErreur(""); try { await api.caisses.ouvrir(guichet); nav(vers("S74")); } catch (x) { setErreur(message(x)); } }}>
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
          <div><button className="bouton" type="submit" disabled={!guichet}>Ouvrir</button></div>
        </form>
      )}
    </>
  );
}

/** S79 : Caisse > Billetage > Enregistrer de billetage (manuel Microfina++, p. 90 et 91) */
export function BilletageCaisse() {
  const [nombres, setNombres] = useState<Record<Devise, Record<number, string>> | null>(null);
  const [bon, setBon] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const [s, ctx, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.journees.courante()]);
    if (!s) return { s, ctx, j };
    const [billetages, CDF, USD] = await Promise.all([api.caisses.billetages(s.id), api.caisses.theorique(s.id, "CDF"), api.caisses.theorique(s.id, "USD")]);
    return { s, ctx, j, billetages: billetages.filter((b) => b.moment === "arret"), theorique: { CDF, USD } };
  }, [relu]);
  if (!donnees) return <Chargement />;
  if (!donnees.s) return <><h1>Billetage</h1><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>;
  const { s, ctx, j, billetages, theorique } = donnees as Required<typeof donnees>;
  const saisis = nombres ?? Object.fromEntries(DEVISES.map((d) => {
    const b = billetages.find((x) => x.devise === d);
    return [d, Object.fromEntries(COUPURES[d].map((v) => [v, String(b?.compte[v] ?? 0)]))];
  })) as Record<Devise, Record<number, string>>;
  const bonSaisi = nombres ? bon : enSaisie(billetages.find((x) => x.devise === "CDF")?.bonCaisse ?? 0);
  const compte = (d: Devise): Comptage => Object.fromEntries(COUPURES[d].map((v) => [v, /^\d+$/.test(saisis[d][v] ?? "") ? Number(saisis[d][v]) : 0]));
  const mBon = bonSaisi.trim() ? lireMontant(bonSaisi) : 0;
  const changer = (d: Devise, v: number, x: string) => { if (/^\d{0,6}$/.test(x)) { setBon(bonSaisi); setNombres({ ...saisis, [d]: { ...saisis[d], [v]: x } }); } };
  const deux = (f: (d: Devise) => number) => DEVISES.map((d) => montant(f(d), d)).join(" ; ");
  function enregistrer() {
    if (mBon === null) { setBoite({ type: "erreur", message: "Bon de Caisse invalide." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        for (const d of DEVISES) await api.caisses.saisirBilletage(s.id, d, compte(d), d === "CDF" ? mBon : 0);
        setNombres(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Arretée de : {ctx.guichets.find((g) => g.id === s.guichetId)?.nom}</h1>
      <section className="bloc pile" aria-label="Billetage">
        <div className="grille-cadres quatre">
          <Champ libelle="Solde Caisse :">{(p) => <input {...p} className="saisie montant" readOnly value={deux((d) => totalComptage(theorique[d]))} />}</Champ>
          <Champ libelle="Journées:">{(p) => <select {...p} className="saisie code" disabled value={j?.date ?? ""}><option value={j?.date ?? ""}>{j ? fr(j.date) : ""}</option></select>}</Champ>
          <Champ libelle="Bon de Caisse">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={bonSaisi}
            onChange={(e) => { setNombres(saisis); setBon(e.target.value); }} />}</Champ>
          <Champ libelle="Total Caisse">{(p) => <input {...p} className="saisie montant" readOnly value={deux((d) => totalComptage(compte(d)) + (d === "CDF" ? mBon ?? 0 : 0))} />}</Champ>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Libelle</th><th scope="col">Nombre</th><th scope="col" className="num">Total</th></tr></thead>
          <tbody>
            {DEVISES.flatMap((d) => COUPURES[d].map((v) => {
              const libelle = `Billet de ${v} ${d}`;
              return (
                <tr key={`${d}-${v}`}>
                  <td>{libelle}</td>
                  <td><input className="saisie code court" inputMode="numeric" aria-label={`Nombre : ${libelle}`} value={saisis[d][v]} onChange={(e) => changer(d, v, e.target.value)} /></td>
                  <td className="num chiffres">{montant((compte(d)[v] ?? 0) * v * 100, d)}</td>
                </tr>
              );
            }))}
          </tbody>
          <tfoot><tr><td colSpan={2} className="num">Total Montant :</td><td className="num chiffres">{deux((d) => totalComptage(compte(d)))}</td></tr></tfoot>
        </table>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled>Terminer</button>
        </div>
        <p className="a-confirmer">À confirmer : bouton Terminer (le manuel ne dit pas ce qu'il fait) ; deux devises dans un même arrêté (la capture n'en montre qu'une) ; devise et sens du Bon de Caisse (ici : en CDF, ajouté au Total Caisse) ; billets et pièces (les coupures du CDF et de l'USD sont toutes des billets) ; case « billetage » du guichet (p. 18), qui rendrait le billetage facultatif.</p>
        <Textes sources={["Manuel Microfina++, p. 90 et 91 : Arretée de, Solde Caisse, Journées, Bon de Caisse, Total Caisse, Libelle, Nombre, Total, Total Montant, Enregistrer, Terminer",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Manuel Microfina++, p. 18 et 19 : ouverture du guichet sans comptage ; Solde Caisse : dernier arrêté validé et opérations de la journée"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
