import { vers } from "./registre";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { coupuresDe, DEVISES, libelleCoupure, lireMontant, montant, totalComptage, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";
import { fr } from "../lib/dates";

const enSaisie = (m: number) => (m ? String(m / 100).replace(".", ",") : "");

/** S79 : Caisse > Billetage > Enregistrer de billetage (manuel Microfina++, p. 90 et 91) */
export function BilletageCaisse() {
  const navigate = useNavigate();
  const [nombres, setNombres] = useState<Record<Devise, Record<number, string>> | null>(null);
  const [bons, setBons] = useState<Record<Devise, string> | null>(null);   // registre S79-3 : un Bon de Caisse par tableau, dans sa devise
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const [s, ctx, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.journees.courante()]);
    if (!s) return { s, ctx, j };
    const [billetages, ...th] = await Promise.all([api.caisses.billetages(s.id), ...DEVISES.map((d) => api.caisses.theorique(s.id, d))]);
    return { s, ctx, j, billetages: billetages.filter((b) => b.moment === "arret"), theorique: Object.fromEntries(DEVISES.map((d, i) => [d, th[i] ?? {}])) as Record<Devise, Comptage> };
  }, [relu]);
  if (!donnees) return <Chargement />;
  if (!donnees.s) return <><h1>Billetage</h1><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>;
  const { s, ctx, j, billetages, theorique } = donnees as Required<typeof donnees>;
  const saisis = nombres ?? Object.fromEntries(DEVISES.map((d) => {
    const b = billetages.find((x) => x.devise === d);
    return [d, Object.fromEntries(coupuresDe(d).map((v) => [v, String(b?.compte[v] ?? 0)]))];
  })) as Record<Devise, Record<number, string>>;
  const bonsSaisis = bons ?? Object.fromEntries(DEVISES.map((d) => [d, enSaisie(billetages.find((x) => x.devise === d)?.bonCaisse ?? 0)])) as Record<Devise, string>;
  const compte = (d: Devise): Comptage => Object.fromEntries(coupuresDe(d).map((v) => [v, /^\d+$/.test(saisis[d]?.[v] ?? "") ? Number(saisis[d]?.[v]) : 0]));
  const bonDe = (d: Devise) => (bonsSaisis[d]?.trim() ? lireMontant(bonsSaisis[d]!) : 0);
  const changer = (d: Devise, v: number, x: string) => { if (/^\d{0,6}$/.test(x)) { setBons(bonsSaisis); setNombres({ ...saisis, [d]: { ...saisis[d], [v]: x } }); } };
  function enregistrer() {
    const faux = DEVISES.find((d) => bonDe(d) === null);
    if (faux) { setBoite({ type: "erreur", message: `Bon de Caisse (${faux}) invalide.` }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        for (const d of DEVISES) await api.caisses.saisirBilletage(s.id, d, compte(d), bonDe(d) ?? 0);
        setNombres(null); setBons(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Arretée de : {ctx.guichets.find((g) => g.id === s.guichetId)?.nom}</h1>
      <section className="bloc pile" aria-label="Billetage">
        {/* Registre S79-2 et T12 : un tableau par devise, chacun comme la capture p. 91 */}
        {DEVISES.map((d) => (
          <fieldset key={d} className="pile cadre-champs" aria-label={`Billetage ${d}`}>
            <legend>{d}</legend>
            <div className="grille-cadres quatre">
              <Champ libelle={`Solde Caisse (${d}) :`}>{(p) => <input {...p} className="saisie montant" readOnly value={montant(totalComptage(theorique[d] ?? {}), d)} />}</Champ>
              <Champ libelle="Journées:">{(p) => <select {...p} className="saisie code" disabled value={j?.date ?? ""}><option value={j?.date ?? ""}>{j ? fr(j.date) : ""}</option></select>}</Champ>
              <Champ libelle={`Bon de Caisse (${d})`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={bonsSaisis[d] ?? ""}
                onChange={(e) => { setNombres(saisis); setBons({ ...bonsSaisis, [d]: e.target.value }); }} />}</Champ>
              <Champ libelle={`Total Caisse (${d})`}>{(p) => <input {...p} className="saisie montant" readOnly value={montant(totalComptage(compte(d)) + (bonDe(d) ?? 0), d)} />}</Champ>
            </div>
            <table className="grille colonnes-billetage">
              <thead><tr><th scope="col">Libelle</th><th scope="col">Nombre</th><th scope="col" className="num">Total</th></tr></thead>
              <tbody>
                {coupuresDe(d).map((v) => {
                  const libelle = `${libelleCoupure(d, v)} ${d}`;   // registre S79-4 : libellé du type de monnaie (S35)
                  return (
                    <tr key={`${d}-${v}`}>
                      <td>{libelle}</td>
                      <td><input className="saisie code court" inputMode="numeric" aria-label={`Nombre : ${libelle}`} value={saisis[d]?.[v] ?? ""} onChange={(e) => changer(d, v, e.target.value)} /></td>
                      <td className="num chiffres">{montant((compte(d)[v] ?? 0) * v * 100, d)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td colSpan={2} className="num">Total Montant :</td><td className="num chiffres">{montant(totalComptage(compte(d)), d)}</td></tr></tfoot>
            </table>
          </fieldset>
        ))}
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          {/* Registre S79-1 : Terminer ferme la fenêtre sans rien enregistrer de plus */}
          <button className="bouton secondaire" type="button" onClick={() => navigate(-1)}>Terminer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 90 et 91 : Arretée de, Solde Caisse, Journées, Bon de Caisse, Total Caisse, Libelle, Nombre, Total, Total Montant, Enregistrer, Terminer",
          "Registre T12 : une case par devise ; le tableau de la capture est repris pour chaque devise que tient le guichet",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Manuel Microfina++, p. 18 et 19 : ouverture du guichet sans comptage ; Solde Caisse : dernier arrêté validé et opérations de la journée"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S80 : Caisse > Billetage > Validation de billetage à la caisse (manuel Microfina++, p. 91 et 92) */
export function ValidationBilletage() {
  const [guichetId, setGuichetId] = useState(0);
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const [ctx, j] = await Promise.all([api.referentiel.contexte(), api.journees.courante()]);
    const sessions = j ? await api.caisses.delaJournee(j.id) : [];
    const s = sessions.find((x) => x.guichetId === guichetId);
    const billetages = s ? (await api.caisses.billetages(s.id)).filter((b) => b.moment === "arret") : [];
    return { ctx, j, sessions, billetages };
  }, [guichetId, relu]);
  if (!donnees) return <Chargement />;
  const { ctx, j, sessions, billetages } = donnees;
  const parDevise = (f: (d: Devise) => number) => DEVISES.map((d) => montant(f(d), d)).join("\n");
  const de = (d: Devise) => billetages.find((b) => b.devise === d);
  const bon = de("CDF")?.bonCaisse ?? 0;
  const lignes = DEVISES.flatMap((d) => coupuresDe(d).filter((v) => (de(d)?.compte[v] ?? 0) > 0).map((v) => ({ d, v, n: de(d)!.compte[v]! })));
  const guichet = ctx.guichets.find((g) => g.id === guichetId);
  function valider() {
    const a = billetages.filter((b) => !b.validePar);
    if (!a.length) { setBoite({ type: "erreur", message: billetages.length ? "Billetage déjà validé." : "Aucun billetage enregistré pour ce guichet." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { for (const b of a) await api.caisses.validerBilletage(b.id); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Validation Arretée Temporaire : {guichet?.nom ?? ""}</h1>
      <section className="bloc pile" aria-label="Validation du billetage">
        <div className="grille-cadres quatre">
          <Champ libelle="Solde Informatique">{(p) => <textarea {...p} className="saisie montant" rows={2} readOnly value={billetages.length ? parDevise((d) => totalComptage(de(d)?.theorique ?? {})) : ""} />}</Champ>
          <Champ libelle="Solde Reel">{(p) => <textarea {...p} className="saisie montant" rows={2} readOnly value={billetages.length ? parDevise((d) => totalComptage(de(d)?.compte ?? {}) + (d === "CDF" ? bon : 0)) : ""} />}</Champ>
          <Champ libelle="Compte Comptable">{(p) => <input {...p} className="saisie code" readOnly value="" />}</Champ>
        </div>
        <div className="grille-cadres quatre">
          <Champ libelle="Guichet">{(p) => (
            <select {...p} className="saisie" value={guichetId || ""} onChange={(e) => setGuichetId(Number(e.target.value))}>
              <option value="" disabled></option>
              {ctx.guichets.filter((g) => sessions.some((x) => x.guichetId === g.id)).map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
            </select>)}</Champ>
          <Champ libelle="Journées:">{(p) => <select {...p} className="saisie code" disabled value={j?.date ?? ""}><option value={j?.date ?? ""}>{j ? fr(j.date) : ""}</option></select>}</Champ>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Libelle</th><th scope="col">Nombre</th><th scope="col" className="num">Montant</th></tr></thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={3}>Aucune donnée dans la liste</td></tr>}
            {lignes.map(({ d, v, n }) => <tr key={`${d}-${v}`}><td>Billet de {v} {d}</td><td className="chiffres">{n}</td><td className="num chiffres">{montant(n * v * 100, d)}</td></tr>)}
          </tbody>
          <tfoot><tr><td>Bon Caisse ====&gt; <span className="chiffres">{montant(bon, "CDF")}</span></td><td>Total Billetage</td>
            <td className="num chiffres multi-ligne">{parDevise((d) => totalComptage(de(d)?.compte ?? {}))}</td></tr></tfoot>
        </table>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!guichetId} onClick={valider}>Valider</button>
          <button className="bouton secondaire" type="button" disabled>Imprimer</button>
          <button className="bouton secondaire" type="button" disabled>Terminer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 91 et 92 : Validation Arretée Temporaire, Solde Informatique, Solde Reel, Compte Comptable, Guichet, Journées, Libelle, Nombre, Montant, Bon Caisse, Total Billetage, Valider, Imprimer, Terminer",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
