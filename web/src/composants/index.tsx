// Primitives de replica/design/components.md, en React. Les classes viennent de composants.css.
import { useEffect, useId, useState, type ReactNode } from "react";
import { coupuresDe, entier, lireMontant, montant, montantEnLettres, totalComptage, type Comptage, type Devise } from "@design/montant.js";

export function Puce({ etat, children }: { etat?: "ouverte" | "en_cloture" | "fermee"; children: ReactNode }) {
  return <span className="puce" data-etat={etat}>{children}</span>;
}

export function Bloquant({ children, titre = "Bloqué :" }: { children: ReactNode; titre?: string }) {
  if (!children) return null;
  return <p className="bloquant" role="alert"><strong>{titre}</strong> {children}</p>;
}

export function Attention({ children }: { children: ReactNode }) {
  return <p className="attention">{children}</p>;
}

export function Textes({ sources }: { sources: string[] }) {
  return (
    <details className="textes">
      <summary>Textes</summary>
      <ul>{sources.map((s) => <li key={s}>{s}</li>)}</ul>
    </details>
  );
}

export function Touche({ children }: { children: ReactNode }) {
  return <kbd className="touche">{children}</kbd>;
}

export function Champ({ libelle, aide, erreur, children, id }: { libelle: string; aide?: string; erreur?: string; children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode; id?: string }) {
  const auto = useId();
  const cid = id ?? auto;
  const desc = [aide && `${cid}-aide`, erreur && `${cid}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="champ">
      <label htmlFor={cid}>{libelle}</label>
      {children({ id: cid, "aria-describedby": desc, "aria-invalid": erreur ? true : undefined })}
      {aide && <p className="aide" id={`${cid}-aide`}>{aide}</p>}
      {erreur && <p className="erreur" id={`${cid}-err`}>{erreur}</p>}
    </div>
  );
}

/** Montant en grand, devise, toutes lettres (DESIGN § 2.2) */
export function ChampMontant({ valeur, onChange, devise, erreur, libelle = "Montant", id }: { valeur: string; onChange: (v: string) => void; devise: Devise; erreur?: string; libelle?: string; id?: string }) {
  const auto = useId();
  const cid = id ?? auto;
  const m = lireMontant(valeur);
  return (
    <div className="champ">
      <label htmlFor={cid}>{libelle}</label>
      <div className="montant-champ" data-erreur={erreur ? "" : undefined}>
        <input id={cid} inputMode="decimal" autoComplete="off" value={valeur} onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${cid}-lettres ${cid}-err`} aria-invalid={erreur ? true : undefined} />
        <span className="devise">{devise}</span>
      </div>
      <p className="lettres" id={`${cid}-lettres`} aria-live="polite">{m ? montantEnLettres(m, devise) : ""}</p>
      <p className="erreur" id={`${cid}-err`}>{erreur}</p>
    </div>
  );
}

/** Valeur d'une coupure, centimes compris (« 0,5 ») : S35 accepte les pièces de centimes */
const valeurCoupure = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);

/** Billetage : coupures, stock en caisse, nombre, montant, écart avec la cible */
export function Billetage({ devise, comptage, onChange, stock, cible, sens = "remise", idPremier, libelleStock = "En caisse", lectureSeule = false }: {
  devise: Devise; comptage: Comptage; onChange: (c: Comptage) => void; stock?: Comptage; cible?: number | null;
  sens?: "remise" | "recue" | "comptage"; idPremier?: string; libelleStock?: string; lectureSeule?: boolean;
}) {
  const total = totalComptage(comptage);
  const trop = sens === "remise" && stock ? coupuresDe(devise).some((v) => (comptage[v] ?? 0) > (stock[v] ?? 0)) : false;
  const ecart = cible == null ? null : cible - total;
  const ok = cible != null && cible > 0 && ecart === 0 && !trop;
  return (
    <>
      <table className="billetage" aria-describedby={`ecart-${devise}`}>
        <thead><tr><th scope="col">Coupure</th>{stock && <th scope="col">{libelleStock}</th>}<th scope="col">Nombre</th><th scope="col">Montant</th></tr></thead>
        <tbody>
          {coupuresDe(devise).map((v, i) => {
            const nb = comptage[v] ?? 0;
            const depasse = sens === "remise" && stock && nb > (stock[v] ?? 0);
            return (
              <tr key={v}>
                <td>{valeurCoupure(v)}</td>
                {stock && <td>{entier.format(stock[v] ?? 0)}</td>}
                <td>
                  <input id={i === 0 ? idPremier : undefined} inputMode="numeric" readOnly={lectureSeule} className={depasse ? "trop" : undefined}
                    aria-label={`Nombre de coupures de ${valeurCoupure(v)} ${devise}`} value={nb || ""}
                    onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onChange({ ...comptage, [v]: Number.isFinite(n) && n > 0 ? n : 0 }); }} />
                </td>
                <td>{nb ? valeurCoupure(v * nb) : ""}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr><td colSpan={stock ? 3 : 2}>Total</td><td>{entier.format(total / 100)}</td></tr></tfoot>
      </table>
      <p className={`ecart ${ok ? "ok" : "ko"}`} id={`ecart-${devise}`} aria-live="polite">
        {cible == null || cible === 0 ? "" : trop ? "Pas assez de coupures en caisse." : ecart === 0 ? "Le compte est bon." : ecart! > 0 ? <>Il manque <span className="chiffres">{montant(ecart!, devise)}</span>.</> : <><span className="chiffres">{montant(-ecart!, devise)}</span> de trop.</>}
      </p>
    </>
  );
}

export function Etapes({ etapes }: { etapes: { titre: string; ok: boolean; ko?: boolean }[] }) {
  return (
    <ul className="etapes" aria-label="Avant validation">
      {etapes.map((e) => <li key={e.titre} className={e.ok ? "ok" : e.ko ? "ko" : undefined}>{e.titre}</li>)}
    </ul>
  );
}

/** Photo de remplacement : pas d'image d'un tiers, une silhouette */
export function Silhouette() {
  return (
    <svg viewBox="0 0 64 80" width="64" height="80" aria-hidden="true">
      <rect width="64" height="80" fill="var(--photo-fond)" />
      <circle cx="32" cy="30" r="13" fill="var(--photo-figure)" />
      <path d="M8 80c2-18 12-26 24-26s22 8 24 26z" fill="var(--photo-figure)" />
    </svg>
  );
}

export function Specimen() {
  return (
    <svg viewBox="0 0 200 44" width="100%" height="44" role="img" aria-label="Specimen de signature">
      <path d="M8 32c14-22 22-24 26-10s10 12 18-4 14-8 18 6 20-18 30-6 18 10 34-4" fill="none" stroke="var(--encre)" strokeWidth="1.6" />
    </svg>
  );
}

export function Chargement() {
  return <p className="muet" role="status">Chargement…</p>;
}

/** Date jj/mm/aaaa au clavier (DESIGN § 2.1, composant C06). Jamais le sélecteur du navigateur :
 * son format suit la langue du poste, et « 11/05 » peut alors vouloir dire le 5 novembre. */
export function ChampDate({ libelle, valeur, onChange, aide, requis }: { libelle: string; valeur: string; onChange: (iso: string) => void; aide?: string; requis?: boolean }) {
  const versTexte = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
  const [texte, setTexte] = useState(versTexte(valeur));
  useEffect(() => { if (lireDate(texte) !== valeur) setTexte(versTexte(valeur)); }, [valeur]);   // valeur changée de l'extérieur
  const complet = texte.length === 10, iso = lireDate(texte);
  const erreur = complet && !iso ? "Date impossible." : "";
  return (
    <Champ libelle={libelle} aide={aide ?? "jj/mm/aaaa"} erreur={erreur}>
      {(p) => <input {...p} className="saisie date" inputMode="numeric" autoComplete="off" placeholder="jj/mm/aaaa" maxLength={10} required={requis} value={texte}
        onChange={(e) => { const t = masque(e.target.value); setTexte(t); onChange(lireDate(t) ?? ""); }} />}
    </Champ>
  );
}
function masque(v: string) {
  const c = v.replace(/\D/g, "").slice(0, 8);
  return [c.slice(0, 2), c.slice(2, 4), c.slice(4, 8)].filter(Boolean).join("/");
}
/** « 05/11/2026 » -> « 2026-11-05 » ; null si incomplète ou impossible (31/02) */
export function lireDate(t: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const [, j, mo, a] = m as unknown as [string, string, string, string];
  const d = new Date(Date.UTC(Number(a), Number(mo) - 1, Number(j)));
  return d.getUTCDate() === Number(j) && d.getUTCMonth() === Number(mo) - 1 ? `${a}-${mo}-${j}` : null;
}

/** Boîtes de dialogue du manuel Microfina++ (p. 10 et 11) : confirmation Oui/Non, succès, erreur. */
export type Boite = { type: "confirmation"; message: string; oui: () => void } | { type: "succes" | "erreur"; message: string };
const TITRES = { confirmation: "Confirmation", succes: "Succès", erreur: "Erreur" };
export function Dialogue({ boite, fermer }: { boite: Boite | null; fermer: () => void }) {
  const [el, setEl] = useState<HTMLDialogElement | null>(null);
  useEffect(() => { if (el && boite && !el.open) el.showModal?.(); if (el && !boite && el.open) el.close(); }, [el, boite]);
  if (!boite) return null;
  return (
    <dialog ref={setEl} className="boite" data-type={boite.type} aria-labelledby="boite-titre" onCancel={(e) => { e.preventDefault(); fermer(); }}>
      <h2 id="boite-titre">{TITRES[boite.type]}</h2>
      <p>{boite.message}</p>
      <div className="boutons">
        {boite.type === "confirmation"
          ? <><button className="bouton" type="button" autoFocus onClick={() => { fermer(); boite.oui(); }}>Oui</button>
              <button className="bouton secondaire" type="button" onClick={fermer}>Non</button></>
          : <button className="bouton" type="button" autoFocus onClick={fermer}>Ok</button>}
      </div>
    </dialog>
  );
}

/** Fiche ouverte par-dessus l'écran (ex. fiche d'un signataire, manuel Microfina++ p. 50) */
export function Fiche({ titre, ouverte, fermer, children }: { titre: string; ouverte: boolean; fermer: () => void; children: ReactNode }) {
  const [el, setEl] = useState<HTMLDialogElement | null>(null);
  useEffect(() => { if (el && ouverte && !el.open) el.showModal?.(); if (el && !ouverte && el.open) el.close(); }, [el, ouverte]);
  if (!ouverte) return null;
  return (
    <dialog ref={setEl} className="fiche" aria-labelledby="fiche-titre" onCancel={(e) => { e.preventDefault(); fermer(); }}>
      <h2 id="fiche-titre">{titre}</h2>
      {children}
    </dialog>
  );
}
