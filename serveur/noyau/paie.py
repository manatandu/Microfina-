"""Module Paie (manuel Microfina++, chap. 6, p. 276 à 278 ; captures du module GRH, p. 201 à 209).
S133 : Personnel > Nouvel employé : onglets Informations générales, Classification, Affectation, Contrat (le texte p. 276 en cite quatre ; l'onglet Formation
de la capture GRH relève du module GRH, non repris). S134 : Maquette de paie, Liste des employés (capture « Liste du Personnel », p. 209).
S135 : Traitement retenues : Mise en place retenue, Liste des retenues sur salaire, Visa de retenue.
Textes lus : code du travail (loi 015/2002 modifiée), art. 39 à 41 (contrat à durée déterminée ou indéterminée ; durée déterminée : deux ans au plus),
art. 112 (retenues permises), art. 114 (quotité cessible, non contrôlée : le manuel ne calcule pas le salaire net).
Mêmes règles que web/src/donnees/api.ts (paie). Registre S133-1 à S133-8, S134-1 à S134-5, S135-1 à S135-5."""
import re
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .listes import valeurs as valeurs_liste
from .services import exiger, nom_utilisateur

SEXES = ["Masculin", "Féminin"]
CIVILITES = ["Monsieur", "Madame"]                 # sans « Mademoiselle » : décision du porteur, 21/11/2026 (registre S14-4)
GROUPES_SANGUINS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
TYPES_CONTRAT = ["Contrat à durée déterminée", "Contrat à durée indéterminée"]          # code du travail, art. 39 et 40
REGIMES = ["Régime catégoriel", "Régime indiciaire"]                                       # capture p. 206 ; grille salariale p. 273 (Salaire ou Point)
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SESSION = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
COLONNES = {"agenceId": "agence_id", "matricule": "matricule", "numeroSecuriteSociale": "numero_securite_sociale", "sexe": "sexe", "civilite": "civilite",
            "nom": "nom", "prenoms": "prenoms", "nomJeuneFille": "nom_jeune_fille", "situationMatrimoniale": "situation_matrimoniale", "dateNaissance": "date_naissance",
            "lieuNaissance": "lieu_naissance", "nationalite": "nationalite", "groupeSanguin": "groupe_sanguin", "contact1": "contact1", "contact2": "contact2",
            "adresse": "adresse", "email": "email", "bp": "bp", "profession": "profession", "personneAPrevenir": "personne_a_prevenir",
            "dateDebutCarriere": "date_debut_carriere", "dateEmbauche": "date_embauche", "personnesACharge": "personnes_a_charge",
            "categorieId": "categorie_id", "classeId": "classe_id", "echelonId": "echelon_id", "salairePredefini": "salaire_predefini", "salaireBase": "salaire_base",
            "surSalaire": "sur_salaire", "dateReferenceAnciennete": "date_reference_anciennete", "tauxAnciennete": "taux_anciennete",
            "dureeAnciennete": "duree_anciennete", "montantAnciennete": "montant_anciennete", "congesDus": "conges_dus", "centreId": "centre_id",
            "poste": "poste", "fonction": "fonction", "typeContrat": "type_contrat", "typeEmploye": "type_employe", "dateDebutContrat": "date_debut_contrat",
            "dateFinContrat": "date_fin_contrat", "modeleContrat": "modele_contrat"}
DATES = {"dateNaissance", "dateDebutCarriere", "dateEmbauche", "dateReferenceAnciennete", "dateDebutContrat", "dateFinContrat"}
ENTIERS = {"personnesACharge", "salaireBase", "surSalaire", "dureeAnciennete", "montantAnciennete", "congesDus"}
IDS = {"agenceId", "categorieId", "classeId", "echelonId", "centreId"}
OBLIGATOIRES = {"matricule": "Matricule", "sexe": "Sexe", "nom": "Nom", "prenoms": "Prénom(s)", "dateNaissance": "Date de naissance",
                "dateEmbauche": "Date d'embauche"}


def options(u, table: str, champ: str = "libelle") -> list[dict]:
    return [{"id": r["id"], "libelle": r[champ]} for r in lignes(f"select id, {champ} from {table} where institution_id = %s and actif order by id", (u["institution_id"],))]


def contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"sexes": SEXES, "civilites": CIVILITES, "groupesSanguins": GROUPES_SANGUINS, "typesContrat": TYPES_CONTRAT, "regimes": REGIMES,
            "situations": [r["libelle"] for r in valeurs_liste(u, "situation_matrimoniale")], "professions": [r["libelle"] for r in valeurs_liste(u, "profession")],
            "categories": options(u, "paie_categorie"), "classes": options(u, "paie_classe"), "echelons": options(u, "paie_echelon"),
            "grillesSalariales": lignes("""select categorie_id as "categorieId", classe_id as "classeId", echelon_id as "echelonId", salaire, points
                                           from paie_grille_salariale where institution_id = %s and actif""", (i,)),
            "grilles": lignes("""select g.id, g.libelle, t.libelle as type from paie_grille g join paie_type_grille t on t.id = g.type_grille_id
                                 where g.institution_id = %s and g.actif order by g.id""", (i,)),
            "agences": lignes("select id, nom from agence where institution_id = %s and not supprime order by code", (i,)),
            "centres": [{"id": r["id"], "libelle": r["libelle"]} for r in lignes("select id, libelle from budget_centre where institution_id = %s and actif order by id", (i,))],
            "typesRetenue": options(u, "paie_type_retenue"),
            "rubriques": [{"id": r["id"], "libelle": f"{r['code']} {r['libelle']}"} for r in lignes(
                "select id, code, libelle from paie_rubrique where institution_id = %s and actif order by code", (i,))]}


def texte(d, k) -> str:
    v = d.get(k)
    return v.strip() if isinstance(v, str) else ""


def valider(u, d: dict, eid: int | None) -> tuple[dict, list[dict], list[int]]:
    d = d if isinstance(d, dict) else {}
    ctx = contexte(u)
    v: dict = {}
    for k in COLONNES:
        x = d.get(k)
        if k in IDS:
            v[k] = x if isinstance(x, int) and not isinstance(x, bool) and x > 0 else None
        elif k in ENTIERS:
            if x in (None, ""):
                v[k] = 0 if k == "personnesACharge" else None
            elif isinstance(x, bool) or not (isinstance(x, int) or (isinstance(x, str) and x.strip().isdigit())) or int(x) < 0:
                raise ErreurMetier(f"{k} : nombre entier positif ou nul.")
            else:
                v[k] = int(x)
        else:
            v[k] = texte(d, k)
    manque = [n for k, n in OBLIGATOIRES.items() if not v[k]]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    for k in DATES:
        if v[k] and not DATE.match(v[k]):
            raise ErreurMetier("Date invalide.")
        v[k] = v[k] or None
    if v["sexe"] not in SEXES or (v["civilite"] and v["civilite"] not in CIVILITES):
        raise ErreurMetier("Sexe ou civilité inconnu.")
    if v["groupeSanguin"] and v["groupeSanguin"] not in GROUPES_SANGUINS:
        raise ErreurMetier("Groupe sanguin inconnu.")
    if v["situationMatrimoniale"] and v["situationMatrimoniale"] not in ctx["situations"]:
        raise ErreurMetier("Situation matrimoniale inconnue.")
    if v["email"] and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v["email"]):
        raise ErreurMetier("Email invalide.")
    if v["dateEmbauche"] <= v["dateNaissance"]:
        raise ErreurMetier("Date d'embauche : après la date de naissance.")
    if v["salairePredefini"] and v["salairePredefini"] not in REGIMES:
        raise ErreurMetier("Salaire de base prédéfini inconnu.")
    for k, cle in (("categorieId", "categories"), ("classeId", "classes"), ("echelonId", "echelons"), ("agenceId", "agences"), ("centreId", "centres")):
        if v[k] is not None and v[k] not in {o["id"] for o in ctx[cle]}:
            raise ErreurMetier(f"{k} inconnu.")
    if v["tauxAnciennete"]:
        if not re.fullmatch(r"\d{1,3}([.,]\d{1,2})?", v["tauxAnciennete"]) or float(v["tauxAnciennete"].replace(",", ".")) > 100:
            raise ErreurMetier("Taux de prime d'ancienneté : un pourcentage, 100 au plus.")
        v["tauxAnciennete"] = f"{float(v['tauxAnciennete'].replace(',', '.')):.2f}".replace(".", ",")
    if (v["dateReferenceAnciennete"] is None) != (not v["tauxAnciennete"]):
        raise ErreurMetier("Ancienneté acquise : Date référence de prime d'ancienneté et Taux de prime d'ancienneté vont ensemble.")
    if v["typeContrat"]:
        if v["typeContrat"] not in TYPES_CONTRAT:
            raise ErreurMetier("Type de contrat inconnu.")
        if not v["dateDebutContrat"]:
            raise ErreurMetier("À remplir : Date début du contrat.")
        if v["typeContrat"] == TYPES_CONTRAT[0]:
            if not v["dateFinContrat"]:
                raise ErreurMetier("À remplir : Date fin du contrat (contrat à durée déterminée).")
            d0, d1 = date.fromisoformat(v["dateDebutContrat"]), date.fromisoformat(v["dateFinContrat"])
            if d1 < d0:
                raise ErreurMetier("Date fin du contrat : après la date début.")
            limite = d0.replace(year=d0.year + 2) if not (d0.month == 2 and d0.day == 29) else date(d0.year + 2, 2, 28)
            if d1 > limite:
                raise ErreurMetier("Un contrat à durée déterminée ne dépasse pas deux ans (code du travail, art. 41).")
        elif v["dateFinContrat"]:
            raise ErreurMetier("Un contrat à durée indéterminée n'a pas de date fin (code du travail, art. 39).")
    if une("select 1 from paie_employe where institution_id = %s and lower(matricule) = lower(%s) and id is distinct from %s", (u["institution_id"], v["matricule"], eid)):
        raise ErreurMetier("Ce Matricule existe déjà.")
    personnes = []
    for p in d.get("personnes") or []:
        p = p if isinstance(p, dict) else {}
        if not texte(p, "nom") or not texte(p, "prenoms") or not all(isinstance(p.get(k), bool) for k in ("conjoint", "employe", "enfantPropre")):
            raise ErreurMetier("Personne à charge : à remplir : Nom, Prénom(s), Conjoint, Employé, Enfant propre.")
        if texte(p, "dateNaissance") and not DATE.match(texte(p, "dateNaissance")):
            raise ErreurMetier("Personne à charge : date de naissance invalide.")
        personnes.append({"nom": texte(p, "nom"), "prenoms": texte(p, "prenoms"), "dateNaissance": texte(p, "dateNaissance") or None,
                          "conjoint": p["conjoint"], "employe": p["employe"], "enfantPropre": p["enfantPropre"]})
    grilles = d.get("grilles") or []
    if not isinstance(grilles, list) or any(g not in {x["id"] for x in ctx["grilles"]} for g in grilles):
        raise ErreurMetier("Grille inconnue.")
    return v, personnes, sorted(set(grilles))


def vue(eid: int) -> dict:
    e = une("select * from paie_employe where id = %s", (eid,))
    out = {k: (e[c].isoformat() if hasattr(e[c], "isoformat") else e[c]) for k, c in COLONNES.items()}
    for k in DATES:
        out[k] = out[k] or ""
    out.update(id=e["id"], creePar=nom_utilisateur(e["cree_par"]),
               personnes=[{"id": r["id"], "nom": r["nom"], "prenoms": r["prenoms"], "dateNaissance": r["date_naissance"].isoformat() if r["date_naissance"] else "",
                           "conjoint": r["conjoint"], "employe": r["employe"], "enfantPropre": r["enfant_propre"]}
                          for r in lignes("select * from paie_personne_charge where employe_id = %s order by id", (eid,))],
               grilles=[r["grille_id"] for r in lignes("select grille_id from paie_employe_grille where employe_id = %s order by grille_id", (eid,))])
    return out


def enregistrer(u, d, eid: int | None = None) -> dict:
    """Enregistrer : la fiche entière (les quatre onglets) ; à la création, l'employé reçoit l'agence de l'utilisateur si aucune n'est choisie"""
    exiger(u)
    i = u["institution_id"]
    if eid is not None and not une("select 1 from paie_employe where id = %s and institution_id = %s for update", (eid, i)):
        raise ErreurMetier("Employé introuvable.")
    v, personnes, grilles = valider(u, d, eid)
    v["agenceId"] = v["agenceId"] or u["agence_id"]
    cols = list(COLONNES.values())
    vals = [v[k] for k in COLONNES]
    if eid is None:
        eid = valeur(f"insert into paie_employe (institution_id, cree_par, {', '.join(cols)}) values (%s, %s, {', '.join(['%s'] * len(cols))}) returning id",
                     (i, u["id"], *vals))
    else:
        executer(f"update paie_employe set {', '.join(f'{c} = %s' for c in cols)} where id = %s", (*vals, eid))
    executer("delete from paie_personne_charge where employe_id = %s", (eid,))
    for p in personnes:
        executer("insert into paie_personne_charge (employe_id, nom, prenoms, date_naissance, conjoint, employe, enfant_propre) values (%s, %s, %s, %s, %s, %s, %s)",
                 (eid, p["nom"], p["prenoms"], p["dateNaissance"], p["conjoint"], p["employe"], p["enfantPropre"]))
    executer("delete from paie_employe_grille where employe_id = %s", (eid,))
    for g in grilles:
        executer("insert into paie_employe_grille (employe_id, grille_id) values (%s, %s)", (eid, g))
    return vue(eid)


def fiche(u, eid: int) -> dict:
    exiger(u)
    if not une("select 1 from paie_employe where id = %s and institution_id = %s", (eid, u["institution_id"])):
        raise ErreurMetier("Employé introuvable.")
    return vue(eid)


def liste(u, p: dict | None = None) -> list[dict]:
    """« Recherche d'un employé » (p. 202 : Matricule, Nom, Prénom(s), N° CNSS) et « Liste du Personnel » (p. 209 : Matricule, Nom et Prénoms,
    Catégorie salariale, Date d'embauche, Poste, Fonction). Critères : Sexe, Type de contrat, embauche du … au …"""
    exiger(u)
    p = p or {}
    sql, args = ["e.institution_id = %s"], [u["institution_id"]]
    for k, c in (("sexe", "e.sexe"), ("typeContrat", "e.type_contrat")):
        if p.get(k):
            sql.append(f"{c} = %s"); args.append(p[k])
    for k, op in (("du", ">="), ("au", "<=")):
        if p.get(k):
            if not DATE.match(str(p[k])):
                raise ErreurMetier("Date invalide.")
            sql.append(f"e.date_embauche {op} %s"); args.append(p[k])
    return [{"id": r["id"], "matricule": r["matricule"], "nom": r["nom"], "prenoms": r["prenoms"], "nomPrenoms": f"{r['nom']} {r['prenoms']}",
             "numeroSecuriteSociale": r["numero_securite_sociale"], "sexe": r["sexe"],
             "categorieSalariale": " - ".join([r["cat"] or "", r["cla"] or "", r["ech"] or ""]), "dateEmbauche": r["date_embauche"].isoformat(),
             "poste": r["poste"], "fonction": r["fonction"], "typeContrat": r["type_contrat"]}
            for r in lignes(f"""select e.*, c.libelle as cat, k.libelle as cla, h.libelle as ech from paie_employe e left join paie_categorie c on c.id = e.categorie_id
                               left join paie_classe k on k.id = e.classe_id left join paie_echelon h on h.id = e.echelon_id
                               where {' and '.join(sql)} order by e.matricule""", tuple(args))]


# ---------- S134 : Maquette de paie ----------
def maquette(u, employe_id: int) -> list[dict]:
    exiger(u)
    return [{"id": r["id"], "rubriqueId": r["rubrique_id"], "rubrique": f"{r['code']} {r['libelle']}", "montant": r["montant"], "session": r["session"] or "",
             "active": r["active"], "intersession": r["intersession"], "permanente": r["permanente"]}
            for r in lignes("""select m.*, r.code, r.libelle from paie_maquette m join paie_rubrique r on r.id = m.rubrique_id join paie_employe e on e.id = m.employe_id
                               where m.employe_id = %s and e.institution_id = %s order by m.id""", (employe_id, u["institution_id"]))]


def ajouter_maquette(u, d) -> list[dict]:
    """« Maquette de paie » (p. 277) : Employé, Rubrique, montant, session ; état sur le bulletin : Active, Intersession, Permanente"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    eid, rid, m = d.get("employeId"), d.get("rubriqueId"), d.get("montant")
    manque = [n for n, x in (("Employé", eid), ("Rubrique", rid), ("Montant", m)) if x in (None, "")]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if not une("select 1 from paie_employe where id = %s and institution_id = %s", (eid, u["institution_id"])):
        raise ErreurMetier("Employé introuvable.")
    if not une("select 1 from paie_rubrique where id = %s and institution_id = %s and actif", (rid, u["institution_id"])):
        raise ErreurMetier("Rubrique inconnue.")
    if isinstance(m, bool) or not isinstance(m, int) or m < 0:
        raise ErreurMetier("Montant : nombre entier positif ou nul.")
    flags = {k: bool(d.get(k)) for k in ("active", "intersession", "permanente")}
    session = texte(d, "session")
    if not flags["permanente"] and not SESSION.match(session):
        raise ErreurMetier("À remplir : Session (AAAA-MM), ou cocher Permanente.")
    if session and not SESSION.match(session):
        raise ErreurMetier("Session : AAAA-MM.")
    if une("select 1 from paie_maquette where employe_id = %s and rubrique_id = %s and coalesce(session, '') = %s", (eid, rid, session if not flags["permanente"] else "")):
        raise ErreurMetier("Cette rubrique est déjà dans la maquette de l'employé pour cette session.")
    executer("""insert into paie_maquette (employe_id, rubrique_id, montant, session, active, intersession, permanente, saisi_par)
                values (%s, %s, %s, %s, %s, %s, %s, %s)""", (eid, rid, m, None if flags["permanente"] else session, flags["active"], flags["intersession"], flags["permanente"], u["id"]))
    return maquette(u, eid)


def retirer_maquette(u, mid: int) -> list[dict]:
    exiger(u)
    r = une("select m.employe_id from paie_maquette m join paie_employe e on e.id = m.employe_id where m.id = %s and e.institution_id = %s", (mid, u["institution_id"]))
    if not r:
        raise ErreurMetier("Ligne introuvable.")
    executer("delete from paie_maquette where id = %s", (mid,))
    return maquette(u, r["employe_id"])


# ---------- S135 : Retenues sur salaire ----------
def vue_retenue(r: dict) -> dict:
    return {"id": r["id"], "employeId": r["employe_id"], "matricule": r["matricule"], "employe": f"{r['nom']} {r['prenoms']}", "typeId": r["type_id"], "type": r["type"],
            "session": r["session"], "montant": r["montant"], "duree": r["duree"], "mensualite": -(-r["montant"] // r["duree"]), "statut": r["statut"],
            "saisiPar": nom_utilisateur(r["saisi_par"]), "visePar": nom_utilisateur(r["vise_par"]) if r["vise_par"] else ""}


def retenues(u, p: dict | None = None) -> list[dict]:
    """« Liste des retenues sur salaire » ; pour le visa : celles d'un employé, à viser"""
    exiger(u)
    p = p or {}
    sql, args = ["r.institution_id = %s"], [u["institution_id"]]
    if str(p.get("employeId") or "").isdigit():
        sql.append("r.employe_id = %s"); args.append(int(p["employeId"]))
    if p.get("statut") in ("saisie", "visee"):
        sql.append("r.statut = %s"); args.append(p["statut"])
    return [vue_retenue(r) for r in lignes(f"""select r.*, e.matricule, e.nom, e.prenoms, t.libelle as type from paie_retenue r join paie_employe e on e.id = r.employe_id
                                                join paie_type_retenue t on t.id = r.type_id where {' and '.join(sql)} order by r.id""", tuple(args))]


def mettre_en_place(u, d) -> dict:
    """« Mise en place retenue » (p. 277) : Matricule, type de retenue, session, montant de la retenue, durée du prélèvement. La retenue attend le visa."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    eid, tid, m, n, s = d.get("employeId"), d.get("typeId"), d.get("montant"), d.get("duree"), texte(d, "session")
    manque = [x for x, v in (("Matricule", eid), ("Type de retenue", tid), ("Session", s), ("Montant", m), ("Durée", n)) if v in (None, "")]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if not une("select 1 from paie_employe where id = %s and institution_id = %s", (eid, u["institution_id"])):
        raise ErreurMetier("Employé introuvable.")
    if not une("select 1 from paie_type_retenue where id = %s and institution_id = %s and actif", (tid, u["institution_id"])):
        raise ErreurMetier("Type de retenue inconnu.")
    if not SESSION.match(s):
        raise ErreurMetier("Session : AAAA-MM.")
    if isinstance(m, bool) or not isinstance(m, int) or m <= 0:
        raise ErreurMetier("Montant : nombre entier positif.")
    if isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= 120:
        raise ErreurMetier("Durée : de 1 à 120 sessions.")
    rid = valeur("""insert into paie_retenue (institution_id, employe_id, type_id, session, montant, duree, saisi_par) values (%s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], eid, tid, s, m, n, u["id"]))
    return next(r for r in retenues(u) if r["id"] == rid)


def viser(u, rid: int) -> dict:
    """« Visa de retenue » (p. 278) : par une autre personne que celle qui l'a mise en place (Instr. BCC 008, art. 66 ; registre S135-3)"""
    exiger(u)
    r = une("select * from paie_retenue where id = %s and institution_id = %s for update", (rid, u["institution_id"]))
    if not r:
        raise ErreurMetier("Retenue introuvable.")
    if r["statut"] != "saisie":
        raise ErreurMetier("Retenue déjà visée.")
    if r["saisi_par"] == u["id"]:
        raise ErreurMetier("Visa : une autre personne que celle qui a mis la retenue en place (Instr. BCC 008, art. 66).")
    executer("update paie_retenue set statut = 'visee', vise_par = %s, vise_le = now() where id = %s", (u["id"], rid))
    return next(x for x in retenues(u) if x["id"] == rid)
