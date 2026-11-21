"""Une seule adresse, la même partout (décision du porteur du 21/11/2026, registre T41) : Pays, Province, Ville ou territoire, Commune, secteur ou chefferie,
Quartier ou groupement, lus dans Localisation (S20), puis Avenue (clé « rue ») et N° (clé « numeroRue »). Instr. BCC 15, art. 12 et 13 : adresse du client.
Mêmes règles que web/src/donnees/api.ts (adresse)."""
from .bd import ErreurMetier, lignes, une, valeur
from .services import exiger

CHAMPS = ("pays", "province", "ville", "commune", "quartier", "rue", "numeroRue")
COLONNES = {"pays": "pays", "province": "province", "ville": "ville", "commune": "commune", "quartier": "quartier", "rue": "rue", "numeroRue": "numero_rue"}
ORDRE = {"Ville": 0, "Territoire": 1, "Commune": 2, "Secteur": 3, "Chefferie": 4}


def arbre() -> list[dict]:
    """Pays > provinces > villes ou territoires > communes, secteurs ou chefferies > quartiers ou groupements, lieux actifs.
    Une ville et un territoire du même nom (Buta), une commune et un secteur du même nom (Businga) font une seule entrée : l'adresse garde le nom."""
    rows = lignes("select id, parent_id, niveau, nom, nature from localite where actif")
    enfants: dict = {}
    for r in rows:
        enfants.setdefault(r["parent_id"], []).append(r)

    def sous(ids, niveau):
        groupes: dict = {}
        for i in ids:
            for r in enfants.get(i, []):
                if r["niveau"] == niveau:
                    g = groupes.setdefault(r["nom"], {"nom": r["nom"], "natures": [], "ids": []})
                    g["ids"].append(r["id"])
                    if r["nature"] and r["nature"] not in g["natures"]:
                        g["natures"].append(r["nature"])
        return sorted(groupes.values(), key=lambda g: (min((ORDRE.get(n, 9) for n in g["natures"]), default=9), g["nom"].lower()))

    def quartiers(ids):
        return sorted({r["nom"] for i in ids for r in enfants.get(i, []) if r["niveau"] == "quartier"}, key=str.lower)

    # seuls les pays découpés dans la Localisation servent à l'adresse ; les autres servent aux nationalités (registre T42)
    return [x for x in [{"pays": p["nom"], "provinces": [
        {"province": pr["nom"], "villes": [
            {"ville": v["nom"], "natures": v["natures"], "communes": [
                {"commune": c["nom"], "natures": c["natures"], "quartiers": quartiers(c["ids"])} for c in sous(v["ids"], "commune")]}
            for v in sous(pr["ids"], "ville")]}
        for pr in sous([p["id"]], "province")]}
        for p in sorted((r for r in rows if r["niveau"] == "pays" and r["parent_id"] is None), key=lambda r: r["nom"])] if x["provinces"]]


def ids_lieu(pays: str, province: str = "", ville: str = "", commune: str = "") -> list[int]:
    """Identifiants des lieux du dernier niveau donné (plusieurs quand une ville et un territoire, ou une commune et un secteur, portent le même nom)"""
    ids = [r["id"] for r in lignes("select id from localite where niveau = 'pays' and nom = %s and actif", (pays,))]
    for niveau, nom in (("province", province), ("ville", ville), ("commune", commune)):
        if not nom:
            break
        ids = [r["id"] for r in lignes("select id from localite where niveau = %s and nom = %s and parent_id = any(%s) and actif", (niveau, nom, ids))]
    return ids


def controler(texte, requis: bool = False, quoi: str = "Adresse"):
    """Cohérence de l'adresse avec la Localisation. requis : province, ville ou territoire, commune, secteur ou chefferie, quartier ou groupement.
    Une adresse sans province (fiches d'avant le 21/11/2026) se contrôle sur toutes les provinces du pays."""
    v = {k: texte(k) for k in CHAMPS}
    if requis:
        manque = [n for n, k in (("province", "province"), ("ville ou territoire", "ville"), ("commune, secteur ou chefferie", "commune"),
                                 ("quartier ou groupement", "quartier")) if not v[k]]
        if manque:
            raise ErreurMetier(f"{quoi} : à remplir : " + ", ".join(manque) + ".")
    if not any(v[k] for k in ("pays", "province", "ville", "commune", "quartier")):
        return
    pays = next((p for p in arbre() if p["pays"] == (v["pays"] or "République démocratique du Congo")), None)
    provinces = [x for x in (pays or {}).get("provinces", []) if not v["province"] or x["province"] == v["province"]]
    villes = [x for pr in provinces for x in pr["villes"] if x["ville"] == v["ville"]] if v["ville"] else []
    communes = [x for vi in villes for x in vi["communes"] if not v["commune"] or x["commune"] == v["commune"]]
    ok = pays is not None and (not v["province"] or provinces) and (not v["ville"] or villes) and (not v["commune"] or (v["ville"] and communes)) and \
        (not v["quartier"] or any(v["quartier"] in c["quartiers"] for c in communes))
    if not ok:
        raise ErreurMetier(f"{quoi} : province, ville ou territoire, commune ou quartier inconnu (Paramétrage > Localisation).")


def composer(texte) -> str:
    """L'adresse écrite, lue par les contrats et les documents : « N° 12, avenue Kasa-Vubu, quartier Kinsaku, Matete, Kinshasa »"""
    v = {k: texte(k) for k in CHAMPS}
    morceaux = [f"N° {v['numeroRue']}" if v["numeroRue"] else "", f"avenue {v['rue']}" if v["rue"] else "", f"quartier {v['quartier']}" if v["quartier"] else "",
                v["commune"], v["ville"] if v["ville"] != v["commune"] else ""]
    return ", ".join(m for m in morceaux if m)


def ajouter_quartier(u, d) -> dict:
    """Un quartier (ou un groupement) absent de la liste, ajouté depuis la fiche du membre (décision du porteur du 21/11/2026, registre T41) :
    il rejoint la Localisation. Pas de doublon sous la même commune, le même secteur ou la même chefferie."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    texte = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    nom = texte("nom")
    if not nom:
        raise ErreurMetier("À remplir : nom du quartier ou du groupement.")
    parents = ids_lieu(texte("pays") or "République démocratique du Congo", texte("province"), texte("ville"), texte("commune"))
    if not (texte("province") and texte("ville") and texte("commune")) or not parents:
        raise ErreurMetier("Choisissez d'abord la province, la ville ou le territoire, et la commune, le secteur ou la chefferie.")
    if une("select 1 from localite where niveau = 'quartier' and parent_id = any(%s) and lower(nom) = lower(%s) and actif", (parents, nom)):
        raise ErreurMetier("Ce quartier ou ce groupement existe déjà.")
    # une commune et un secteur du même nom : le quartier va sous la commune, le groupement sous le secteur ou la chefferie
    parent = valeur("""select id from localite where id = any(%s) order by case nature when 'Commune' then 0 else 1 end, id limit 1""", (parents,))
    from .bd import executer
    executer("insert into localite (parent_id, niveau, nom, nature) values (%s, 'quartier', %s, '')", (parent, nom))
    return {"arbre": arbre()}
