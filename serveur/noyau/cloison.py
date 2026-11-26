"""Cloisonnement par agence (décision du porteur du 26/11/2026, registre T213) : l'utilisateur rattaché à une agence ne voit que les membres
de son agence, et n'agit que sur eux. L'utilisateur que l'administrateur sécurité laisse sans agence voit toutes les agences : c'est la place
de l'audit interne et de la conformité, qui ont accès à toute l'information de l'institution (Instr. BCC 008, art. 33, 52 et 54 ;
Instr. BCC 15, art. 85).

Deux gardes : chaque identifiant de membre ou d'objet de membre reçu par une requête (chemin, paramètres, corps) est vérifié ici ;
chaque liste de membres est filtrée dans sa requête par `clause`.

Seule voie vers le membre d'une autre agence : l'opération déplacée de Microfina++ (manuel p. 94 et 135), où l'agent tape le numéro et le nom
donnés par le client ; rien de l'autre agence ne lui est montré."""
import json
import re

from .bd import ErreurMetier, valeur
from .bd import lignes as _lignes

MESSAGE = "Ce membre relève d'une autre agence."

# Agence du membre auquel appartient l'objet ; aucune ligne : l'écran dira lui-même que l'objet n'existe pas
AGENCE_DE = {
    "tiers": "select agence_id from tiers where id = %s",
    "compte": "select t.agence_id from compte_depot c join tiers t on t.id = c.tiers_id where c.id = %s",
    "credit": "select t.agence_id from credit c join tiers t on t.id = c.tiers_id where c.id = %s",
    "dossier": "select t.agence_id from demande_credit d join tiers t on t.id = d.tiers_id where d.id = %s",
    "dat": "select t.agence_id from depot_terme d join tiers t on t.id = d.tiers_id where d.id = %s",
    "plan": "select t.agence_id from plan_epargne p join tiers t on t.id = p.tiers_id where p.id = %s",
    "operation": "select coalesce(t.agence_id, o.agence_id) from operation o left join tiers t on t.id = o.tiers_id where o.id = %s",
    "groupe": "select coalesce(t.agence_id, g.agence_id) from groupe_solidaire g left join tiers t on t.id = g.tiers_id where g.id = %s",
    "analyse": "select t.agence_id from analyse_financiere a join tiers t on t.id = a.tiers_id where a.id = %s",
    "plainte": "select coalesce(t.agence_id, p.agence_id) from plainte p left join tiers t on t.id = p.tiers_id where p.id = %s",
    "cheque": "select t.agence_id from cheque_client c join tiers t on t.id = c.tiers_id where c.id = %s",
    "garantie": "select t.agence_id from garantie g join credit c on c.id = g.credit_id join tiers t on t.id = c.tiers_id where g.id = %s",
    "blocage": "select t.agence_id from blocage b join compte_depot c on c.id = b.compte_id join tiers t on t.id = c.tiers_id where b.id = %s",
    "procuration": "select t.agence_id from procuration p join tiers t on t.id = p.mandant_id where p.id = %s",
    "examen": "select t.agence_id from examen_renforce x join tiers t on t.id = x.tiers_id where x.id = %s",
    "journee": "select agence_id from journee_comptable where id = %s",
    "caisse": "select g.agence_id from session_caisse s join guichet g on g.id = s.guichet_id where s.id = %s",
    "engagement": "select t.agence_id from engagement_signature e join tiers t on t.id = e.tiers_id where e.id = %s",
    "releve": "select t.agence_id from releve_edition r join compte_depot c on c.id = r.compte_depot_id join tiers t on t.id = c.tiers_id where r.id = %s",
}

# Chemins qui désignent un membre ou un de ses objets par son identifiant (le premier nombre du chemin)
CHEMINS = [(re.compile(m), k) for m, k in [
    (r"/tiers/(\d+)(/.*)?", "tiers"),
    (r"/prospects/(\d+)", "tiers"),
    (r"/guichet/procurations/(\d+)", "tiers"),
    (r"/conformite/(?:apparentes|ppe|profils|cip/icu)/(\d+)(/.*)?", "tiers"),
    (r"/credit/(?:consultation|litigieux|remboursement|garanties)/clients/(\d+)", "tiers"),
    (r"/credit/remboursement/comptes/(\d+)", "tiers"),
    (r"/credit/engagements/beneficiaire/(\d+)", "tiers"),
    (r"/comptabilite/operations/comptes/(\d+)", "tiers"),
    (r"/credit/credits/(\d+)(/.*)?", "credit"),
    (r"/credit/(?:consultation|litigieux|deblocage|remboursement|garanties|garanties-materiel)/(\d+)(/.*)?", "credit"),
    (r"/credit/visas/(\d+)/\w+", "credit"),
    (r"/credit/visas-appel/(\d+)", "credit"),
    (r"/credit/provisions/radies/(\d+)/rentree", "credit"),
    (r"/(?:banque|guichet)/(?:deblocage|remboursement)/(\d+)", "credit"),
    (r"/credit/dossiers/(\d+)/\w+", "dossier"),
    (r"/credit/mise-en-place/(\d+)(/apercu)?", "dossier"),
    (r"/credit/analyses/(\d+)", "analyse"),
    (r"/credit/garanties/liberation/(\d+)", "garantie"),
    (r"/epargne/comptes/(\d+)(/.*)?", "compte"),
    (r"/epargne/inactifs/(\d+)/lettre", "compte"),
    (r"/epargne/dat/(\d+)(/.*)?", "dat"),
    (r"/epargne/plans/(\d+)(/.*)?", "plan"),
    (r"/epargne/blocages/(\d+)/deblocage", "blocage"),
    (r"/operations/(\d+)(/.*)?", "operation"),
    (r"/groupes-solidaires/(\d+)(/.*)?", "groupe"),
    (r"/procurations/(\d+)/fin", "procuration"),
    (r"/plaintes/(\d+)/reponse", "plainte"),
    (r"/banque/cheques/(\d+)/\w+", "cheque"),
    (r"/conformite/examens/(\d+)(/.*)?", "examen"),
    (r"/journees/(\d+)(/.*)?", "journee"),                       # la journée d'une autre agence, ses opérations et ses caisses
    (r"/comptabilite/comptabilisation/(\d+)", "journee"),
    (r"/caisses/(\d+)/(?:theorique|billetages|solde-comptable)", "caisse"),   # la caisse d'une autre agence
    (r"/credit/engagements/(\d+)/fin", "engagement"),
]]

# Clés des paramètres et du corps qui désignent un membre ou un de ses comptes, où qu'elles soient dans le corps (listes comprises)
CLES = {"tiersId": "tiers", "tiersIds": "tiers", "prospectId": "tiers", "mandantId": "tiers", "cautionId": "tiers",
        "compteId": "compte", "compteDepotId": "compte", "compteEpargneId": "compte", "compteGarantiId": "compte", "compteDatId": "compte",
        "emetteurId": "compte", "recepteurId": "compte", "procurationId": "procuration", "analyseId": "analyse", "credits": "credit"}   # operationId : une opération diverse paramétrée (ed_guichet), pas celle d'un membre


def agence(u: dict) -> int | None:
    """L'agence dont l'utilisateur voit les membres ; aucune : toutes (audit interne, conformité)"""
    return u.get("agence_id")


def clause(u: dict, colonne: str = "t.agence_id") -> tuple[str, tuple]:
    """Condition SQL à ajouter à une liste de membres : `and <colonne> = agence`, ou rien pour qui voit toutes les agences"""
    a = agence(u)
    return ("", ()) if a is None else (f" and {colonne} = %s", (a,))


def voit(u: dict, agence_id) -> bool:
    a = agence(u)
    return a is None or agence_id is None or int(agence_id) == int(a)


def visibles(u: dict, lignes_: list, cle: str = "tiers_id") -> list:
    """Lignes dont le membre (`cle`) est de son agence : pour les requêtes qui assemblent plusieurs sources (déclarations, opérations atypiques)"""
    a = agence(u)
    if a is None:
        return lignes_
    siens = {r["id"] for r in _lignes("select id from tiers where agence_id = %s", (a,))}
    return [r for r in lignes_ if r.get(cle) is None or r.get(cle) in siens]


def exiger(u: dict, sorte: str, ident) -> None:
    """Refuse l'objet d'un membre d'une autre agence"""
    if agence(u) is None or ident in (None, ""):
        return
    try:
        n = int(ident)
    except (TypeError, ValueError):
        return
    if not voit(u, valeur(AGENCE_DE[sorte], (n,))):
        raise ErreurMetier(MESSAGE, 403)


def _parcourir(u: dict, v) -> None:
    if isinstance(v, dict):
        for k, x in v.items():
            if k in CLES:
                for i in (x if isinstance(x, list) else [x]):
                    if not isinstance(i, (dict, list)):
                        exiger(u, CLES[k], i)
            else:
                _parcourir(u, x)
    elif isinstance(v, list):
        for x in v:
            _parcourir(u, x)


def verifier(u: dict, request) -> None:
    """Toute requête d'un utilisateur rattaché à une agence : les identifiants de membres qu'elle porte sont de son agence"""
    if agence(u) is None:
        return
    chemin = request.path.removeprefix("/api")
    for motif, sorte in CHEMINS:
        m = motif.fullmatch(chemin)
        if m:
            exiger(u, sorte, m.group(1))
            break
    for k, v in request.GET.items():
        if k in CLES:
            exiger(u, CLES[k], v)
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.body:
        try:
            corps = json.loads(request.body)
        except (ValueError, UnicodeDecodeError):
            return
        _parcourir(u, corps)
