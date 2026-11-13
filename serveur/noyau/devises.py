"""S35 : Préférences > Devise, Type sous, Sous (manuel Microfina++, p. 45 et 46). Pages « Enregistrement des devises »,
« Enregistrer un type de monnaies », « Enregistrement de monnaies » : « renseigner les champs relatifs puis [Enregistrer] ».
Mêmes règles que web/src/donnees/api.ts (devises)."""
import re
from decimal import Decimal, InvalidOperation

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

DIVISEURS = {0, 1, 2, 4, 5, 10, 20, 25, 50, 100}     # montants tenus en centièmes (ARCHITECTURE P4) : registre S35-1


def texte(d, k) -> str:
    return d.get(k).strip() if isinstance(d.get(k), str) else ""


def lire(u) -> dict:
    exiger(u)
    return {"devises": lignes("select code, libelle, unite, subdivision from devise order by code"),
            "cours": [{"devise": r["devise"].strip(), "jour": r["jour"].isoformat(), "cours": float(r["cours"])}
                      for r in lignes("select devise, jour, cours from cours_change where institution_id = %s order by jour desc, devise", (u["institution_id"],))],
            "types": lignes("select id, libelle from type_monnaie order by id"),
            "monnaies": [{**r, "valeur": r["valeur"] / 100 if r["valeur"] % 100 else r["valeur"] // 100}
                         for r in lignes("""select c.devise, c.valeur, c.type_id as "typeId", coalesce(t.libelle, '') as libelle
                                            from coupure c left join type_monnaie t on t.id = c.type_id
                                            order by c.devise, c.valeur""")]}


def enregistrer_devise(u, d, code_actuel: str | None = None) -> dict:
    """Enregistrement des devises : Devise, Code, Unité, Subdivision (registre S35-1). Tous les contrôles avant d'écrire."""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    libelle, code, unite = texte(d, "libelle"), texte(d, "code").upper(), texte(d, "unite")
    manque = [n for n, v in (("Devise", libelle), ("Code", code)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    s = d.get("subdivision")
    s = 0 if s in (None, "") else s
    if not (isinstance(s, int) and not isinstance(s, bool) or isinstance(s, str) and s.strip().isdigit()):
        raise ErreurMetier("Subdivision : nombre entier positif ou nul.")
    s = int(s)
    if s not in DIVISEURS:
        raise ErreurMetier("Subdivision : 0, ou un nombre qui divise 100 (100 pour les centimes).")
    if not re.fullmatch(r"[A-Z]{3}", code):
        raise ErreurMetier("Code : trois lettres (CDF, USD, EUR).")
    if code == "CDF" and (unite != "FC" or s != 100):
        raise ErreurMetier("Franc congolais : symbole FC et cent centimes (D.-L. 080/1998, art. 1 et 2).")
    if code_actuel is not None:
        if not une("select 1 from devise where code = %s for update", (code_actuel,)):
            raise ErreurMetier("Devise introuvable.")
        if code != code_actuel:
            raise ErreurMetier("Le code d'une devise ne se modifie pas.")
    elif une("select 1 from devise where code = %s", (code,)):
        raise ErreurMetier("Ce Code existe déjà.")
    if une("select 1 from devise where lower(libelle) = lower(%s) and code is distinct from %s", (libelle, code_actuel)):
        raise ErreurMetier("Cette Devise existe déjà.")
    if code_actuel is None:
        executer("insert into devise (code, libelle, unite, subdivision) values (%s, %s, %s, %s)", (code, libelle, unite, s))
    else:
        executer("update devise set libelle = %s, unite = %s, subdivision = %s where code = %s", (libelle, unite, s, code))
    return lire(u)


def enregistrer_type(u, d, tid: int | None = None) -> dict:
    """Enregistrer un type de monnaies : Type de Monnaie (registre S35-2)"""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    libelle = texte(d, "libelle")
    if not libelle:
        raise ErreurMetier("À remplir : Type de Monnaie.")
    if tid is not None and not une("select 1 from type_monnaie where id = %s for update", (tid,)):
        raise ErreurMetier("Type de monnaie introuvable.")
    if une("select 1 from type_monnaie where lower(libelle) = lower(%s) and id is distinct from %s", (libelle, tid)):
        raise ErreurMetier("Ce Type de Monnaie existe déjà.")
    nature = "piece" if libelle.lower().startswith(("pièce", "piece")) else "billet"
    if tid is None:
        executer("insert into type_monnaie (libelle) values (%s)", (libelle,))
    else:
        executer("update type_monnaie set libelle = %s where id = %s", (libelle, tid))
        executer("update coupure set nature = %s where type_id = %s", (nature, tid))
    return lire(u)


def enregistrer_monnaie(u, d, actuelle: tuple[str, int] | None = None) -> dict:
    """Enregistrement de monnaies : Valeur fiduciaire, Type de Monnaie, Devise (registre S35-3). Une coupure qui a servi
    garde sa valeur et sa devise ; son type se change."""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    brute, devise, tid = d.get("valeur"), texte(d, "devise"), d.get("typeId")
    brute = str(brute).strip().replace(",", ".") if brute not in (None, "") and not isinstance(brute, bool) else ""
    tid = tid if isinstance(tid, int) and not isinstance(tid, bool) else None
    manque = [n for n, v in (("Valeur fiduciaire", brute), ("Type de Monnaie", tid), ("Devise", devise)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    dv = une("select code, subdivision from devise where code = %s", (devise,))
    if not dv:
        raise ErreurMetier("Devise inconnue.")
    t = une("select libelle from type_monnaie where id = %s", (tid,))
    if not t:
        raise ErreurMetier("Type de Monnaie inconnu.")
    try:
        v = Decimal(brute)
    except InvalidOperation:
        v = Decimal(-1)
    centiemes = v * 100
    if v <= 0 or centiemes != centiemes.to_integral_value():
        raise ErreurMetier("Valeur fiduciaire : nombre positif, deux décimales au plus.")
    if dv["subdivision"] == 0 and v != v.to_integral_value():
        raise ErreurMetier(f"Valeur fiduciaire : {devise} n'a pas de subdivision, valeur entière.")
    if dv["subdivision"] and (centiemes * dv["subdivision"]) % 100:
        raise ErreurMetier(f"Valeur fiduciaire : pas un multiple de la plus petite subdivision du {devise}.")
    cle = (devise, int(centiemes))
    nature = "piece" if t["libelle"].lower().startswith(("pièce", "piece")) else "billet"
    if actuelle is not None:
        if not une("select 1 from coupure where devise = %s and valeur = %s for update", actuelle):
            raise ErreurMetier("Monnaie introuvable.")
        if cle != actuelle and valeur("select 1 from operation_coupure where devise = %s and valeur = %s limit 1", actuelle):
            raise ErreurMetier("Cette monnaie a servi aux guichets : sa valeur et sa devise ne se modifient pas.")
    if cle != actuelle and une("select 1 from coupure where devise = %s and valeur = %s", cle):
        raise ErreurMetier("Cette monnaie existe déjà dans cette devise.")
    if actuelle is None:
        executer("insert into coupure (devise, valeur, nature, type_id) values (%s, %s, %s, %s)", (*cle, nature, tid))
    else:
        executer("update coupure set devise = %s, valeur = %s, nature = %s, type_id = %s where devise = %s and valeur = %s", (*cle, nature, tid, *actuelle))
    return lire(u)


def enregistrer_cours(u, d) -> dict:
    """Page Cours : Devise, Date, Cours (francs congolais pour une unité de la devise). La comptabilité est tenue en monnaie nationale et
    chaque opération en devise est convertie au cours du jour de la transaction (PCCI § 3.2 et § 7.1) ; registre S35-6.
    Un cours déjà saisi pour cette devise et cette date est remplacé, tant qu'aucune écriture ne l'a utilisé."""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    devise, jour, brut = texte(d, "devise"), texte(d, "jour"), d.get("cours")
    brut = str(brut).strip().replace(",", ".") if brut not in (None, "") and not isinstance(brut, bool) else ""
    manque = [n for n, v in (("Devise", devise), ("Date", jour), ("Cours", brut)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if devise == "CDF":
        raise ErreurMetier("Le franc congolais est la monnaie de tenue : il n'a pas de cours.")
    if not une("select 1 from devise where code = %s", (devise,)):
        raise ErreurMetier("Devise inconnue.")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", jour):
        raise ErreurMetier("Date invalide.")
    try:
        c = Decimal(brut)
    except InvalidOperation:
        c = Decimal(0)
    if c <= 0 or c != round(c, 6):
        raise ErreurMetier("Cours : nombre positif, six décimales au plus.")
    i = u["institution_id"]
    deja = une("select id from cours_change where institution_id = %s and devise = %s and jour = %s for update", (i, devise, jour))
    if deja and valeur("select 1 from ligne_ecriture where cours_id = %s limit 1", (deja["id"],)):
        raise ErreurMetier("Ce cours a servi à des écritures : il ne se modifie plus.")
    if deja:
        executer("update cours_change set cours = %s where id = %s", (c, deja["id"]))
    else:
        executer("insert into cours_change (institution_id, devise, jour, cours) values (%s, %s, %s, %s)", (i, devise, jour, c))
    return lire(u)
