// Point bloquant B12 (audit du 21/11/2026) : documents remis au client. Un en-tête et un pied communs (l'institution cliente, registre D01-7),
// la mention de l'exemplaire (original, puis duplicata numéroté, registre T215) et l'impression qui note l'exemplaire avant d'imprimer.
// Forme : DESIGN § 2.8 (« le papier est un écran comme un autre ») ; contenu : décision T11.
import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { api } from "../donnees/api";
import { fr, jourDe } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { message } from "../lib/useDonnees";

export type EnteteDoc = { nom: string; sigle: string; adresse: string; telephone: string; bp: string; ville: string; commune: string; pays: string; email: string;
  agrement: string; ifu: string; logo: string | null; plaintes?: string };
export type Exemplaire = { exemplaire: number; duplicata: number; le: string; par: string };
export type DocumentImprime = "recu" | "contrat_pret" | "reconnaissance_dette" | "convention" | "contrat_dat" | "avis_rupture" | "acte_engagement"
  | "lettre_inactivite" | "accuse_plainte" | "releve" | "demande_adhesion";

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

/** En-tête d'un document A4 : son numéro, son titre, le logo et le nom de l'institution */
export function TeteA4({ e, num, titre }: { e: EnteteDoc; num?: ReactNode; titre: string }) {
  return (
    <header className="releve-tete">
      {num ? <p className="releve-num">{num}</p> : <span />}
      <h2 className="releve-titre">{titre}</h2>
      <div className="releve-logo">{e.logo ? <img src={e.logo} alt={e.nom} /> : <strong>{e.sigle || e.nom}</strong>}<span>{e.nom}</span></div>
    </header>
  );
}

/** Pied d'un document A4 : l'institution, son adresse, ses contacts, son numéro d'agrément (loi 22/069, art. 31, al. 3 : sur toute correspondance ou publication) */
export function PiedDocument({ e, children }: { e: EnteteDoc; children?: ReactNode }) {
  const contacts = [e.telephone && `Téléphone : ${e.telephone}`, e.email && `Courriel : ${e.email}`].filter(Boolean).join(" · ");
  return (
    <footer className="releve-pied">
      <strong>{e.nom.toUpperCase()}</strong>
      <span>{[e.adresse, e.commune, e.ville, e.pays].filter(Boolean).join(", ")}</span>
      {contacts ? <span>{contacts}</span> : null}
      <span>{[e.agrement && `Agrément BCC n° ${e.agrement}`, e.ifu && `N° impôt : ${e.ifu}`, e.bp && `B.P. ${e.bp}`].filter(Boolean).join(" · ")}</span>
      {children}
    </footer>
  );
}

let enteteLu: Promise<EnteteDoc> | null = null;
/** L'en-tête de l'institution pour les documents dont la lecture ne l'apporte pas ; lu une fois par session */
export function useEntete(): EnteteDoc | null {
  const [e, setE] = useState<EnteteDoc | null>(null);
  useEffect(() => {
    let vivant = true;
    (enteteLu ??= api.impressions.entete().catch((x) => { enteteLu = null; throw x; })).then((x) => { if (vivant) setE(x); }, () => undefined);
    return () => { vivant = false; };
  }, []);
  return e;
}

/** Document A4 dont la lecture n'apporte pas l'en-tête (échéanciers) : en-tête et pied de l'institution autour du corps, 12 points à l'impression */
export function FeuilleA4({ id, titre, num, label, children }: { id: string; titre: string; num?: ReactNode; label: string; children: ReactNode }) {
  const e = useEntete();
  if (!e) return null;
  return (
    <article className="releve-std contrat-dat a-imprimer" id={id} aria-label={label}>
      <TeteA4 e={e} num={num} titre={titre} />
      {children}
      <PiedDocument e={e} />
    </article>
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
