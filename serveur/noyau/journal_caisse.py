"""S83 : Caisse > Rapport > Journal des opérations de caisse (manuel Microfina++, p. 95 ; doublon p. 109). Mêmes règles que web/src/donnees/api.ts (journalCaisse).
Élément de Recherche (Guichet, Rapport, Du, Au), Rechercher (Rechercher par, Valeur), Rechercher, Exporter ; grille Date, N° Client, N° pièce, Libellé,
Débit, Crédit. Les lignes sont celles du compte du guichet : débit à l'entrée d'espèces, crédit à la sortie (PCCI, compte 57). Registre S83-1 à S83-5."""
from datetime import date

from .bd import ErreurMetier, lignes, une, valeur
from .services import exiger


def _date(v: str, nom: str) -> date:
    try:
        return date.fromisoformat(v)
    except (TypeError, ValueError):
        raise ErreurMetier(f"À remplir : {nom}.")


def contexte(u) -> dict:
    """Le guichet de l'utilisateur (affectation, S10) ; sans guichet, il choisit parmi ceux de l'agence (registre S83-2)"""
    exiger(u)
    g = valeur("select guichet_id from affectation_guichet where utilisateur_id = %s and fin is null order by id desc limit 1", (u["id"],))
    return {"guichetId": g, "guichets": lignes("select id, code, nom from guichet where agence_id = %s order by code", (u["agence_id"],)),
            "rapports": ["Journal de caisse"]}


def client_de(ecriture_id: int) -> str:
    """N° Client : le membre dont un compte (dépôt, parts) figure dans la même écriture"""
    r = une("""select l.contrat_ref from ligne_ecriture l where l.ecriture_id = %s and (l.contrat_ref like 'depot:%%' or l.contrat_ref like 'parts:%%')
               order by l.rang limit 1""", (ecriture_id,))
    if not r:
        return ""
    k, i = r["contrat_ref"].split(":")
    tid = int(i) if k == "parts" else valeur("select tiers_id from compte_depot where id = %s", (int(i),))
    return valeur("select numero from tiers where id = %s", (tid,)) or ""


def journal(u, guichet_id: int, du: str, au: str) -> list[dict]:
    exiger(u)
    if not une("select 1 from guichet where id = %s and agence_id = %s", (guichet_id, u["agence_id"])):
        raise ErreurMetier("À remplir : Guichet.")
    d1, d2 = _date(du, "Du"), _date(au, "Au")
    if d1 > d2:
        raise ErreurMetier("Du : une date avant Au.")
    return [{"date": l["jour"].isoformat(), "client": client_de(l["ecriture_id"]), "piece": l["piece"] or "", "libelle": l["libelle"], "devise": l["devise"].strip(),
             "debit": l["montant_devise"] if l["sens"] == "D" else 0, "credit": l["montant_devise"] if l["sens"] == "C" else 0}
            for l in lignes("""select l.*, e.libelle, jc.date_comptable as jour, p.numero as piece
                               from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                               left join piece p on p.id = e.piece_id
                               where e.institution_id = %s and l.contrat_ref = %s and jc.date_comptable between %s and %s
                               order by jc.date_comptable, l.ecriture_id, l.rang""", (u["institution_id"], f"guichet:{guichet_id}", d1, d2))]
