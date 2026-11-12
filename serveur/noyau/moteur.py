"""Moteur des référentiels décrits par un catalogue (docs/architecture/COMPLEMENTS.md § 7.2) : budget (S19) et crédit (S21).
Une page = une table ; chaque champ a un type. Mêmes règles que web/src/donnees/moteur.ts."""
import re

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

JJMM = re.compile(r"^(\d\d)/(\d\d)$")
JOURS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
TEXTES = ("texte", "texteLong", "jjmm", "compte", "compteSimple", "operation", "email")


def ch(cle, col, libelle, type="texte", obligatoire=True, ref=None, aide=None, colonne=None, defaut=None, cadre=None, grille=True):
    return {"cle": cle, "col": col, "libelle": libelle, "type": type, "obligatoire": obligatoire, "ref": ref, "aide": aide,
            "colonne": colonne, "defaut": defaut, "cadre": cadre, "grille": grille}


def sans_deux(t: str) -> str:
    return t.rstrip(" :*").rstrip(" :")


def jour_mois(t: str) -> tuple[int, int] | None:
    m = JJMM.match(t)
    if not m:
        return None
    j, mo = int(m.group(1)), int(m.group(2))
    return (mo, j) if 1 <= mo <= 12 and 1 <= j <= JOURS[mo - 1] else None


def compte_existe(u, motif: str) -> bool:
    return bool(valeur("select 1 from compte where numero like %s and (institution_id is null or institution_id = %s) limit 1", (motif, u["institution_id"])))


def param_compte(u, t: str) -> str:
    """Param Compte (p. 28) : comptes ou racines suivies d'une étoile, séparés par des virgules ; chacun existe au plan (T16, registre S19-3)"""
    elements = [e.strip() for e in t.split(",")]
    for e in elements:
        if not re.fullmatch(r"\d+\*?", e):
            raise ErreurMetier(f"Param Compte : « {e} » n'est pas un compte ni une racine suivie de * (Ex1 : 6*,712*).")
        if not compte_existe(u, e[:-1] + "%" if e.endswith("*") else e):
            raise ErreurMetier(f"Param Compte : {e} ne correspond à aucun compte du plan de comptes.")
    return ",".join(elements)


class Referentiel:
    """catalogue : liste de fiches {page, table, menu, entete, champs, unique?, etiquette?, fixe?} ;
    choix_extra : listes qui ne sont pas des pages du catalogue ; verifier(u, fiche, valeurs, lid) : contrôles propres à une page ;
    utilise_par : page -> [(table, colonne, nom de la page)] qui empêchent la suppression"""

    def __init__(self, catalogue, choix_extra=None, verifier=None, utilise_par=None, droit="chef_agence"):
        self.catalogue = catalogue
        self.par_page = {c["page"]: c for c in catalogue}
        self.choix_extra = choix_extra or {}
        self.verifier = verifier
        self.utilise_par = utilise_par or {}
        self.role = droit

    def fiche(self, page: str) -> dict:
        c = self.par_page.get(page)
        if not c:
            raise ErreurMetier("Page inconnue.", 404)
        return c

    @staticmethod
    def ref_de(f) -> str | None:
        return {"choix": f["ref"], "annee": "annees", "operation": "operations"}.get(f["type"])

    def choix(self, u, ref: str) -> list[dict]:
        if ref in self.choix_extra:
            return self.choix_extra[ref](u)
        c = self.par_page[ref]
        return lignes(f"select id, {c.get('etiquette', 'libelle')} as libelle from {c['table']} where institution_id = %s and actif order by id", (u["institution_id"],))

    def lire(self, u, page: str) -> dict:
        exiger(u)
        c = self.fiche(page)
        entete = {"catalogue": [{k: x[k] for k in ("page", "menu")} for x in self.catalogue], "fiche": {k: v for k, v in c.items() if k not in ("table", "fixe")}}
        if "fixe" in c:                       # page en lecture seule : valeurs fixées par un texte ou par le logiciel
            return {**entete, "options": {}, "lignes": [{"id": n + 1, **r, "affichage": {k: str(v) for k, v in r.items()}} for n, r in enumerate(c["fixe"])]}
        i = u["institution_id"]
        options = {f["cle"]: self.choix(u, self.ref_de(f)) for f in c["champs"] if self.ref_de(f)}
        cols = ", ".join(f'{f["col"]} as "{f["cle"]}"' for f in c["champs"])
        brutes = lignes(f"select id, {cols} from {c['table']} where institution_id = %s and actif order by id", (i,))   # ordre de saisie (S19-2)
        noms = {k: {o["id"]: o["libelle"] for o in v} for k, v in options.items()}
        if c.get("parentMemeTable"):          # un parent se lit même s'il vient d'être retiré de la liste (registre S19-1)
            noms["parentId"] = {r["id"]: r["libelle"] for r in lignes(f"select id, libelle from {c['table']} where institution_id = %s", (i,))}
        def montrer(f, x):
            if f["cle"] in noms:
                return noms[f["cle"]].get(x, "")
            if f["type"] == "ouiNon":
                return "OUI" if x else "NON"
            return "" if x is None else str(x)
        for r in brutes:
            r["affichage"] = {f["cle"]: montrer(f, r[f["cle"]]) for f in c["champs"]}
        return {**entete, "options": options, "lignes": brutes}

    def valider(self, u, c, d, lid) -> dict:
        v, manque = {}, []
        for f in c["champs"]:
            x = d.get(f["cle"])
            if f["type"] in TEXTES:
                x = x.strip() if isinstance(x, str) else ""
                vide = not x
            elif f["type"] == "entier":
                vide = x in (None, "")
                if vide:
                    x = f["defaut"]
                elif not (isinstance(x, int) and not isinstance(x, bool) or (isinstance(x, str) and x.strip().isdigit())) or int(x) < 0:
                    raise ErreurMetier(f"{sans_deux(f['libelle'])} : nombre entier positif ou nul.")
                else:
                    x = int(x)
            elif f["type"] == "ouiNon":
                vide = not isinstance(x, bool)
                x = x if isinstance(x, bool) else f["defaut"]
            else:                             # choix, annee : identifiant
                x = x if isinstance(x, int) and not isinstance(x, bool) and x > 0 else None
                vide = x is None
            if vide and f["obligatoire"]:
                manque.append(sans_deux(f["libelle"]))
            v[f["cle"]] = x
        if manque:
            raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
        for f in c["champs"]:
            x = v[f["cle"]]
            if x in (None, "") or f["type"] in ("texte", "texteLong", "entier", "ouiNon"):
                continue
            if f["type"] == "jjmm" and not jour_mois(x):
                raise ErreurMetier(f"{sans_deux(f['libelle'])} : date au format JJ/MM.")
            if f["type"] == "email" and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", x):
                raise ErreurMetier(f"{sans_deux(f['libelle'])} invalide.")
            if f["type"] == "compte":
                v[f["cle"]] = param_compte(u, x)
            if f["type"] == "compteSimple" and not compte_existe(u, x):      # T16
                raise ErreurMetier(f"{sans_deux(f['libelle'])} : {x} n'existe pas au plan de comptes.")
            if self.ref_de(f) and x not in {o["id"] for o in self.choix(u, self.ref_de(f))}:
                raise ErreurMetier(f"{sans_deux(f['libelle'])} inconnu.")
        if self.verifier:
            self.verifier(u, c, v, lid)
        return v

    def enregistrer(self, u, page: str, d, lid: int | None = None) -> dict:
        """Enregistrer (sans lid) ou modifier la ligne choisie (manuel p. 12, T01). Tous les contrôles avant d'écrire."""
        exiger(u, self.role)                  # profil habilité : registre T07, en attendant S03 à S06
        c = self.fiche(page)
        if "fixe" in c:
            raise ErreurMetier("Cette liste ne se modifie pas.")
        i = u["institution_id"]
        d = d if isinstance(d, dict) else {}
        if lid is not None and not une(f"select 1 from {c['table']} where id = %s and institution_id = %s and actif for update", (lid, i)):
            raise ErreurMetier("Ligne introuvable.")
        v = self.valider(u, c, d, lid)
        champs = {f["cle"]: f for f in c["champs"]}
        cles = c.get("unique", ["code"])
        egal = lambda k: f"lower({champs[k]['col']}) = lower(%s)" if champs[k]["type"] in TEXTES else f"{champs[k]['col']} = %s"
        if une(f"select 1 from {c['table']} where institution_id = %s and actif and id is distinct from %s and " + " and ".join(egal(k) for k in cles),
               (i, lid, *[v[k] for k in cles])) or \
                (cles == ["code"] and une(f"select 1 from {c['table']} where institution_id = %s and code = %s and id is distinct from %s", (i, v["code"], lid))):
            raise ErreurMetier(f"Ce {sans_deux(champs[cles[-1]]['libelle'])} existe déjà.")      # T08
        cols = [f["col"] for f in c["champs"]]
        vals = [v[f["cle"]] for f in c["champs"]]
        if lid is None:
            executer(f"insert into {c['table']} (institution_id, {', '.join(cols)}) values (%s, {', '.join(['%s'] * len(cols))})", (i, *vals))
        else:
            executer(f"update {c['table']} set {', '.join(f'{k} = %s' for k in cols)} where id = %s", (*vals, lid))
        return self.lire(u, page)

    def supprimer(self, u, page: str, lid: int) -> dict:
        """Supprimer (manuel p. 12) : suppression logique (registre T02) ; une ligne qui sert à une ligne active ne se supprime pas"""
        exiger(u, self.role)
        c = self.fiche(page)
        if "fixe" in c:
            raise ErreurMetier("Cette liste ne se modifie pas.")
        if not une(f"select 1 from {c['table']} where id = %s and institution_id = %s and actif for update", (lid, u["institution_id"])):
            raise ErreurMetier("Ligne introuvable.")
        for table, col, nom in self.utilise_par.get(page, []):
            if une(f"select 1 from {table} where {col} = %s and actif limit 1", (lid,)):
                raise ErreurMetier(f"Cette valeur est utilisée par la page {nom} : la retirer d'abord.")
        executer(f"update {c['table']} set actif = false where id = %s", (lid,))
        return self.lire(u, page)
