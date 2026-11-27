import { useState, type InputHTMLAttributes } from "react";

/** Champ de mot de passe avec un bouton pour afficher ou masquer ce qui est tapé (demande du porteur, 27/11/2026 ; registre T257) */
export function Secret(props: InputHTMLAttributes<HTMLInputElement>) {
  const [voir, setVoir] = useState(false);
  return (
    <span className="avec-unite">
      <input {...props} type={voir ? "text" : "password"} />
      <button className="bouton secondaire" type="button" aria-pressed={voir} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        onClick={() => setVoir(!voir)}>{voir ? "Masquer" : "Afficher"}</button>
    </span>
  );
}
