// Point bloquant B12 (audit du 21/11/2026) : documents remis au client. Un en-tête et un pied communs (l'institution cliente, registre D01-7),
// la mention de l'exemplaire (original, puis duplicata numéroté, registre T215) et l'impression qui note l'exemplaire avant d'imprimer.
// Forme : DESIGN § 2.8 (« le papier est un écran comme un autre ») ; contenu : décision T11.
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { api } from "../donnees/api";
import { fr, jourDe } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { message } from "../lib/useDonnees";

export type EnteteDoc = { nom: string; sigle: string; adresse: string; telephone: string; bp: string; ville: string; commune: string; pays: string; email: string;
  agrement: string; ifu: string; logo: string | null; plaintes?: string };
export type Exemplaire = { exemplaire: number; duplicata: number; le: string; par: string };
export type DocumentImprime = "recu" | "contrat_pret" | "reconnaissance_dette" | "convention" | "contrat_dat";

/** L'institution qui remet le document : logo, nom, agence, adresse, agrément de la BCC */
export function EnTeteDocument({ e, agence }: { e: EnteteDoc; agence?: string }) {
  return (
    <header className="doc-tete">
      {e.logo ? <img src={e.logo} alt="" /> : null}
      <strong>{e.nom}</strong>
      {agence ? <span>Agence de {agence}</span> : null}
      <span>{[e.adresse, e.commune, e.ville].filter(Boolean).join(", ")}</span>
      <span>{[e.bp && `B.P. ${e.bp}`, e.telephone && `Tél. ${e.telephone}`].filter(Boolean).join(" · ")}</span>
      {e.agrement ? <span>Agrément BCC n° {e.agrement}</span> : null}
    </header>
  );
}

/** Original ou duplicata, avec la date et l'auteur de l'impression ; rien tant que le document n'est pas imprimé.
 *  Un contrat se fait en autant d'originaux que de parties (Code civil, livre III, art. 207) : au-delà, chaque impression est une copie. */
export function MentionExemplaire({ x, originaux = 1, suite = "DUPLICATA" }: { x: Exemplaire | null; originaux?: number; suite?: "DUPLICATA" | "COPIE" }) {
  if (!x) return null;
  const quand = `${fr(jourDe(x.le))} à ${new Date(x.le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  const n = x.exemplaire;
  const quoi = n <= originaux ? (originaux > 1 ? `ORIGINAL ${n} sur ${originaux}` : "ORIGINAL") : `${suite} n° ${n - originaux}`;
  return <p className="doc-exemplaire"><strong>{quoi}</strong> · imprimé le {quand} par {x.par}</p>;
}

/** Imprimer un document remis au client : l'exemplaire est noté au journal (serveur ou démonstration), sa mention s'écrit sur le document, puis il s'imprime */
export function useImpression(document: DocumentImprime, objet: number | null | undefined, selecteur: string) {
  const [exemplaire, setExemplaire] = useState<Exemplaire | null>(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => { setExemplaire(null); setErreur(""); }, [document, objet]);   // un autre document : pas de mention tant qu'il n'est pas imprimé
  const lancer = async () => {
    if (!objet) return;
    try {
      const x = await api.impressions.noter({ document, objet });
      flushSync(() => { setExemplaire(x); setErreur(""); });
      imprimer(selecteur);
    } catch (e) { setErreur(message(e)); }
  };
  return { exemplaire, erreur, imprimer: lancer };
}
