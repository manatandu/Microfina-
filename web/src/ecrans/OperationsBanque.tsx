// Choix d'un compte bancaire de l'institution : Banque puis Compte Banque. Les onglets de S52 sont répartis par le plan d'allègement : Encaissement / Décaissement
// dans Comptabilité > Autres opérations (point 7.4), les virements de banque dans Virements internes de trésorerie (point 7.5).
import { api } from "../donnees/api";
import { Champ } from "../composants";

type Lu = Awaited<ReturnType<typeof api.banqueOperations.lire>>;

/** Banque puis Compte Banque, la liste des comptes suit la banque choisie */
export function ChoixBanque({ lu, libelleBanque, libelleCompte, banque, compte, onBanque, onCompte }: {
  lu: Lu; libelleBanque: string; libelleCompte: string; banque: string; compte: string; onBanque: (v: string) => void; onCompte: (v: string) => void;
}) {
  const comptes = lu.comptes.filter((c) => String(c.banqueId) === banque);
  return (
    <>
      <Champ libelle={libelleBanque}>{(p) => <select {...p} className="saisie" value={banque} onChange={(e) => { onBanque(e.target.value); onCompte(""); }}>
        <option value=""></option>{lu.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
      <Champ libelle={libelleCompte}>{(p) => <select {...p} className="saisie" value={compte} onChange={(e) => onCompte(e.target.value)}>
        <option value=""></option>{comptes.map((c) => <option key={c.id} value={c.id}>{c.numero} ({c.devise})</option>)}</select>}</Champ>
    </>
  );
}
