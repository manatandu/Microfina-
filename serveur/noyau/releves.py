"""S64 : Épargne > Relevé de compte (manuel Microfina++, p. 73 et 74, trois captures) : relevé d'un compte sur une période et situation du client.
Mêmes règles que web/src/donnees/api.ts (releves). Registre S64-1 à S64-6."""
import re

from .bd import ErreurMetier, lignes, une, valeur
from .services import exiger, lire_tiers, soldes_masques, solde_contrat

CHAMPS_CLIENT = ("numero", "type", "intitule", "nom", "postnom", "prenom", "sexe", "naissance", "lieuNaissance", "profession", "nationalite", "zone", "quartier",
                 "adresse", "telephone", "email", "bp", "commune", "ville", "pays")


def entete(i: int) -> dict:
    """En-tête des documents imprimés : l'institution cliente (Information société, S32 ; registre D01)"""
    s = une("select nom, sigle, adresse, telephone_fixe, bp, ville, commune, pays, email, numero_agrement, ifu, logo from institution where id = %s", (i,))
    return {"nom": s["nom"], "sigle": s["sigle"] or "", "adresse": s["adresse"] or "", "telephone": s["telephone_fixe"] or "", "bp": s["bp"] or "",
            "ville": s["ville"] or "", "commune": s["commune"] or "", "pays": s["pays"] or "", "email": s["email"] or "", "agrement": s["numero_agrement"] or "",
            "ifu": s["ifu"] or "", "logo": s["logo"]}


def client(tid: int) -> dict:
    t = lire_tiers(tid) or {}
    return {k: t.get(k) or "" for k in CHAMPS_CLIENT}


def controler(u, d: str, nom: str):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", d or ""):
        raise ErreurMetier(f"À remplir : {nom}.")


def masques(u):
    if soldes_masques(u):                                      # registre S10-1 : le caissier sans « Voir solde client » ne voit pas les soldes
        raise ErreurMetier("Soldes des clients masqués pour vous au guichet (Administration > Guichets : case « Voir solde client »).")


def releve(u, compte_id: int, du: str, au: str) -> dict:
    """Bouton Relever Compte : report à la date de début, mouvements de la période (date de la journée comptable), totaux, montant bloqué"""
    exiger(u)
    masques(u)
    controler(u, du, "date début"); controler(u, au, "date fin")
    if du > au:
        raise ErreurMetier("La date de début dépasse la date de fin.")
    c = une("""select c.*, trim(c.devise) as dv, p.libelle as produit, a.nom as agence from compte_depot c join produit_epargne p on p.id = c.produit_id
               join agence a on a.id = c.agence_id where c.id = %s and c.institution_id = %s""", (compte_id, u["institution_id"]))
    if not c:
        raise ErreurMetier("À remplir : numéro de compte.")
    mouvements = lignes("""select j.date_comptable as date, coalesce(e.date_valeur, j.date_comptable) as valeur, coalesce(p.numero, '') as piece, e.libelle, l.sens, l.montant_devise as montant
                           from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable j on j.id = e.journee_id
                           left join piece p on p.id = e.piece_id
                           where l.contrat_ref = %s and l.devise = %s order by j.date_comptable, e.id, l.rang""", (f"depot:{c['id']}", c["dv"]))
    report = sum((m["montant"] if m["sens"] == "C" else -m["montant"]) for m in mouvements if m["date"].isoformat() < du)
    solde, td, tc, sortie = report, 0, 0, []
    for m in mouvements:
        d = m["date"].isoformat()
        if du <= d <= au:
            debit, credit = (m["montant"], 0) if m["sens"] == "D" else (0, m["montant"])
            solde += credit - debit; td += debit; tc += credit
            sortie.append({"date": d, "dateValeur": m["valeur"].isoformat(), "piece": m["piece"], "libelle": m["libelle"], "debit": debit, "credit": credit, "solde": solde})
    bloque = int(valeur("select coalesce(sum(montant), 0) from blocage where compte_id = %s and (fin is null or fin > now())", (c["id"],)))
    comptable = solde_contrat(f"depot:{c['id']}", c["dv"], "C")
    attente = int(valeur("""select coalesce(sum(case type when 'virement_client' then montant else -montant end), 0) from operation_banque
                            where compte_depot_id = %s and type in ('virement_client', 'prelevement_client') and statut in ('saisie', 'visee', 'validee')""", (c["id"],)))
    attente -= int(valeur("select coalesce(sum(montant), 0) from depot_terme where compte_emetteur_id = %s and statut = 'saisie'", (c["id"],)))   # DAT en attente de validation (S64-2)
    effets = int(valeur("select coalesce(sum(montant), 0) from cheque_client where compte_depot_id = %s and statut = 'depose'", (c["id"],)))   # registre S64-7
    return {"entete": entete(u["institution_id"]), "client": client(c["tiers_id"]), "compte": {"id": c["id"], "numero": c["numero"], "produit": c["produit"],
            "devise": c["dv"], "agence": c["agence"]}, "du": du, "au": au, "report": report, "lignes": sortie, "totalDebit": td, "totalCredit": tc,
            "soldeFin": solde, "montantBloque": bloque, "soldeDisponible": solde - bloque, "effetsEnInstance": effets,
            "soldeComptable": comptable, "soldeIndicatif": comptable + attente}


def editer(u, compte_id: int, du: str, au: str) -> dict:
    """Bouton Relever Compte : le relevé au modèle standard (registre S64-7), avec son numéro d'édition, gardé pour la trace des relevés remis"""
    r = releve(u, compte_id, du, au)
    i = u["institution_id"]
    numero = int(valeur("select coalesce(max(numero), 0) + 1 from releve_edition where institution_id = %s", (i,)))
    valeur("""insert into releve_edition (institution_id, numero, compte_depot_id, du, au, edite_par) values (%s, %s, %s, %s, %s, %s) returning id""",
           (i, numero, compte_id, du, au, u["id"]))
    return r | {"numeroReleve": numero}


def situation(u, tid: int, date: str) -> dict:
    """Situation du client à une date (p. 74) : sa fiche et le solde de chacun de ses comptes, au débit ou au crédit"""
    exiger(u)
    masques(u)
    controler(u, date, "date")
    t = une("select id from tiers where id = %s and institution_id = %s", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("À remplir : Numéro Client.")
    comptes = []
    for c in lignes("""select c.id, c.numero, trim(c.devise) as devise, p.libelle from compte_depot c join produit_epargne p on p.id = c.produit_id
                       where c.tiers_id = %s order by c.numero""", (tid,)):
        s = int(valeur("""select coalesce(sum(case l.sens when 'C' then l.montant_devise else -l.montant_devise end), 0)
                          from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable j on j.id = e.journee_id
                          where l.contrat_ref = %s and l.devise = %s and j.date_comptable <= %s""", (f"depot:{c['id']}", c["devise"], date)))
        comptes.append({"compte": c["numero"], "intitule": f"{c['libelle']} {c['devise']}", "devise": c["devise"], "debit": -s if s < 0 else 0, "credit": s if s > 0 else 0})
    parts = int(valeur("""select coalesce(sum(case l.sens when 'C' then l.montant_devise else -l.montant_devise end), 0)
                          from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable j on j.id = e.journee_id
                          where l.contrat_ref = %s and l.devise = 'CDF' and j.date_comptable <= %s""", (f"parts:{tid}", date)))
    if parts:                                                  # registre S64-4 : les parts sociales du membre
        comptes.append({"compte": "Parts sociales", "intitule": "Parts sociales CDF", "devise": "CDF", "debit": -parts if parts < 0 else 0, "credit": parts if parts > 0 else 0})
    return {"entete": entete(u["institution_id"]), "client": client(tid), "date": date, "comptes": comptes}
