import { vers } from "./registre";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../donnees/api";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { useTouches } from "../lib/useTouches";
import { nouvelleCle } from "../lib/cle";
import { lireMontant, montant, totalComptage, type Comptage } from "@design/montant.js";
import { Attention, Billetage, Bloquant, Chargement, ChampMontant, Etapes, Textes, Touche } from "../composants";
import { mots } from "../lib/vocabulaire";
import { OngletsGuichet, PanneauMembre, Recu } from "./Guichet";

/** S73 : adhésion au guichet. Parts sociales payées en entier, premier dépôt facultatif. */
export default function Adhesion() {
  const recherche = useRef<HTMLInputElement>(null);
  const [tiers, setTiers] = useState<Tiers | null>(null);
  const [parts, setParts] = useState("1");
  const [depot, setDepot] = useState("");
  const [usd, setUsd] = useState(false);
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState<Operation | null>(null);

  const { donnees } = useDonnees(async () => {
    const [s, ctx] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte()]);
    const comptes = tiers ? await api.tiers.comptes(tiers.id) : [];
    return { s, ctx, dejaMembre: comptes.length > 0 };
  }, [tiers?.id, resultat?.id]);

  const nParts = /^\d+$/.test(parts) ? Number(parts) : NaN;
  const mDepot = depot ? lireMontant(depot) : 0;
  const valeurPart = donnees?.ctx.valeurPart ?? 0;
  const total = Number.isFinite(nParts) && mDepot !== null ? nParts * valeurPart + mDepot : 0;
  const etapes = [
    { titre: "Visé", ok: tiers?.statut === "actif", ko: !!tiers && tiers.statut !== "actif" },
    { titre: "Parts", ok: Number.isInteger(nParts) && nParts >= 1 },
    { titre: "Billetage", ok: total > 0 && totalComptage(coupures) === total },
  ];
  const pret = etapes.every((e) => e.ok) && !donnees?.dejaMembre && !resultat;
  const vider = () => { setTiers(null); setParts("1"); setDepot(""); setUsd(false); setCoupures({}); setErreur(""); setResultat(null); setCle(nouvelleCle()); recherche.current?.focus(); };

  async function valider() {
    if (!pret || !tiers || mDepot === null) return;
    setErreur("");
    try { setResultat(await api.guichet.adhesion({ cle, tiersId: tiers.id, parts: nParts, depot: mDepot, compteUsd: usd, coupures })); } catch (x) { setErreur(message(x)); }
  }
  useTouches({ F2: () => recherche.current?.focus(), F4: () => document.getElementById("coupure-adhesion")?.focus(), F9: () => { void valider(); }, Escape: vider });

  if (!donnees) return <Chargement />;
  if (!donnees.s || donnees.s.statut !== "ouverte") return <><h1>Adhésion</h1><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>;
  const m = mots(donnees.ctx.institution);

  return (
    <>
      <h1 className="sr-only">Adhésion</h1>
      <OngletsGuichet />
      <div className="guichet">
        <PanneauMembre tiers={tiers} onChoisir={(t) => { setTiers(t); setResultat(null); }} refRecherche={recherche}
          enfants={donnees.dejaMembre && !resultat ? <Bloquant>déjà {m.membre} : passer par Dépôt.</Bloquant> : null} />
        <section className="bloc bordereau" aria-labelledby="t-adh">
          <h2 id="t-adh">Adhésion d'un {m.membre}</h2>
          {resultat ? <Recu id={resultat.id} onNouveau={vider} /> : (
            <>
              {!tiers && <p className="muet">Chercher la personne enrôlée (<Link to={vers("S37")}>enrôler</Link> si elle n'existe pas encore).</p>}
              <div className="champ">
                <label htmlFor="parts">Nombre de parts sociales</label>
                <input id="parts" className="saisie num" inputMode="numeric" value={parts} onChange={(e) => setParts(e.target.value.replace(/\D/g, ""))} aria-describedby="aide-parts" />
                <p className="aide" id="aide-parts">× <span className="chiffres">{montant(valeurPart, "CDF")}</span> = <strong className="chiffres">{Number.isFinite(nParts) ? montant(nParts * valeurPart, "CDF") : ""}</strong>
                  <span className="exemple"> Valeur d'exemple (Microfina++), à remplacer par celle des statuts.</span></p>
              </div>
              <ChampMontant libelle="Premier dépôt sur l'épargne en francs (facultatif)" valeur={depot} onChange={setDepot} devise="CDF" erreur={depot && mDepot === null ? "Montant illisible." : ""} />
              <label className="case"><input type="checkbox" checked={usd} onChange={(e) => setUsd(e.target.checked)} /><span>Ouvrir aussi un compte d'épargne en dollars</span></label>
              <p className="dense">À encaisser : <strong className="chiffres">{montant(total, "CDF")}</strong>. Frais d'adhésion : aucun pour l'instant, <span className="exemple">montant à confirmer</span>.</p>
              <Bloquant>{erreur}</Bloquant>
              <div className="pied-guichet">
                <Etapes etapes={etapes} />
                <button type="button" className="bouton grand" disabled={!pret} aria-keyshortcuts="F9" onClick={() => void valider()}>Valider l'adhésion <Touche>F9</Touche></button>
              </div>
              <Textes sources={["Loi 002/2002, art. 20 et 21 : parts sociales, payées en entier", "PCCI, compte 1030 : parts sociales « personnes physiques effectives »", "PCCI, compte 330 : épargnes", "Nombre minimum de parts et frais d'adhésion : statuts de la COOPEC, à confirmer"]} />
            </>
          )}
        </section>
        <section className="bloc" aria-labelledby="t-bill-adh">
          <h2 id="t-bill-adh">Billets reçus CDF <Touche>F4</Touche></h2>
          <Billetage devise="CDF" comptage={coupures} onChange={setCoupures} cible={total} sens="recue" idPremier="coupure-adhesion" />
        </section>
      </div>
    </>
  );
}
