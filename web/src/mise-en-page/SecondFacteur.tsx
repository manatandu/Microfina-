// Audit du 21/11/2026, point bloquant B9, fin (registre T218) : le profil exige un second facteur ; l'utilisateur le met en place avant toute
// autre action. Un code à six chiffres, donné par l'application d'authentification de son téléphone (RFC 6238), sans réseau ni SMS.
// Champ du code : guide « forms/sms-otp-form » (une seule case, texte, clavier numérique, autocomplete one-time-code).
import { useEffect, useRef, useState } from "react";
import { api } from "../donnees/api";
import { message } from "../lib/useDonnees";
import { Attention, Champ, Formulaire } from "../composants";

export default function SecondFacteur({ fait }: { fait: () => void }) {
  const [cle, setCle] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const demande = useRef(false);
  useEffect(() => {
    if (demande.current) return;                              // une seule clé : une seconde demande remplacerait celle qui est affichée
    demande.current = true;
    api.session.preparerSecondFacteur().then((x) => setCle((x as { cle: string }).cle), (x) => setErreur(message(x)));
  }, []);
  const envoyer = async () => {
    try { await api.session.confirmerSecondFacteur(code.trim()); setCode(""); setErreur(""); fait(); }
    catch (x) { setCode(""); setErreur(message(x)); }
  };
  return (
    <Formulaire className="pile champs-a-gauche" label="Second facteur" envoyer={() => void envoyer()}>
      <Attention>Votre profil exige un second facteur : il se met en place avant toute autre action.</Attention>
      <p>Clé à saisir dans l'application d'authentification de votre téléphone :</p>
      <p className="cle-second-facteur" translate="no">{cle.match(/.{1,4}/g)?.join(" ") ?? ""}</p>
      <Champ libelle="Code à 6 chiffres *">{(p) => <input {...p} className="saisie code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
        value={code} onChange={(e) => setCode(e.target.value)} />}</Champ>
      {erreur && <p className="attention" role="alert">{erreur}</p>}
      <div className="actions-onglets"><button className="bouton" type="submit" disabled={!cle || code.trim().length !== 6}>Enregistrer</button></div>
    </Formulaire>
  );
}
