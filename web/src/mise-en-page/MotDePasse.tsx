// Audit du 21/11/2026, point bloquant B9 : chacun change son mot de passe ; celui que l'administrateur a donné se remplace à la première connexion,
// avant toute autre action (Instr. BCC 008, art. 16 ; Instr. BCC 05, annexe : le préposé gère son mot de passe ; registre T207).
import { useState } from "react";
import { api } from "../donnees/api";
import { message } from "../lib/useDonnees";
import { Attention, Champ, Formulaire } from "../composants";

export default function ChangerMotDePasse({ force, fait }: { force?: boolean; fait: () => void }) {
  const [f, setF] = useState({ ancien: "", nouveau: "", confirmation: "" });
  const [erreur, setErreur] = useState("");
  const envoyer = async () => {
    try { await api.session.changerMotDePasse(f); setF({ ancien: "", nouveau: "", confirmation: "" }); setErreur(""); fait(); }
    catch (x) { setErreur(message(x)); }
  };
  const zone = (cle: keyof typeof f, libelle: string, auto: string) => (
    <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" type="password" autoComplete={auto} value={f[cle]} onChange={(e) => setF({ ...f, [cle]: e.target.value })} />}</Champ>);
  return (
    <Formulaire className="pile champs-a-gauche" label="Changer mon mot de passe" envoyer={() => void envoyer()}>
      {force && <Attention>Le mot de passe donné par l'administrateur se remplace avant toute autre action.</Attention>}
      {zone("ancien", "Mot de passe actuel *", "current-password")}
      {zone("nouveau", "Nouveau mot de passe *", "new-password")}
      {zone("confirmation", "Confirmation *", "new-password")}
      {erreur && <p className="attention" role="alert">{erreur}</p>}
      <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button></div>
    </Formulaire>
  );
}
