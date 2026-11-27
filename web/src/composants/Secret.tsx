import { useState, type InputHTMLAttributes } from "react";

/** Champ de mot de passe avec un œil dans le coin droit pour afficher ou masquer ce qui est tapé (demande du porteur, 27/11/2026 ; registre T257) */
export function Secret(props: InputHTMLAttributes<HTMLInputElement>) {
  const [voir, setVoir] = useState(false);
  return (
    <span className="champ-secret">
      <input {...props} type={voir ? "text" : "password"} />
      <button className="oeil" type="button" aria-pressed={voir} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        title={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setVoir(!voir)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
          {voir && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  );
}
