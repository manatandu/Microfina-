// Primitives de replica/design/components.md, en React. Les classes viennent de composants.css.
import { useId, type ReactNode } from "react";
import { COUPURES, entier, lireMontant, montant, montantEnLettres, totalComptage, type Comptage, type Devise } from "../lib/montant";

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

/** Billetage : coupures, stock en caisse, nombre, montant, écart avec la cible */
export function Billetage({ devise, comptage, onChange, stock, cible, sens = "remise", idPremier, libelleStock = "En caisse" }: {
  devise: Devise; comptage: Comptage; onChange: (c: Comptage) => void; stock?: Comptage; cible?: number | null;
  sens?: "remise" | "recue" | "comptage"; idPremier?: string; libelleStock?: string;
}) {
  const total = totalComptage(comptage);
  const trop = sens === "remise" && stock ? COUPURES[devise].some((v) => (comptage[v] ?? 0) > (stock[v] ?? 0)) : false;
  const ecart = cible == null ? null : cible - total;
  const ok = cible != null && cible > 0 && ecart === 0 && !trop;
  return (
    <>
      <table className="billetage" aria-describedby={`ecart-${devise}`}>
        <thead><tr><th scope="col">Coupure</th>{stock && <th scope="col">{libelleStock}</th>}<th scope="col">Nombre</th><th scope="col">Montant</th></tr></thead>
        <tbody>
          {COUPURES[devise].map((v, i) => {
            const nb = comptage[v] ?? 0;
            const depasse = sens === "remise" && stock && nb > (stock[v] ?? 0);
            return (
              <tr key={v}>
                <td>{entier.format(v)}</td>
                {stock && <td>{entier.format(stock[v] ?? 0)}</td>}
                <td>
                  <input id={i === 0 ? idPremier : undefined} inputMode="numeric" className={depasse ? "trop" : undefined}
                    aria-label={`Nombre de coupures de ${entier.format(v)} ${devise}`} value={nb || ""}
                    onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onChange({ ...comptage, [v]: Number.isFinite(n) && n > 0 ? n : 0 }); }} />
                </td>
                <td>{nb ? entier.format(v * nb) : ""}</td>
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
