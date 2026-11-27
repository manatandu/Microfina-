"""Écart E10 (docs/reglementaire/ECARTS-2026-11-15.md) : gel des avoirs. Loi 22/068 modifiée par la loi 25/048, art. 121, 158, 158 bis, 162 ;
loi 22/069, art. 71 à 77 ; Instr. BCC 15, art. 42. Mêmes règles que web/src/donnees/api.ts (gels)."""
import re

from .bd import ErreurMetier, executer, lignes, une, valeur

SOURCES = {"onu": "Conseil de sécurité des Nations Unies", "conasafic": "Liste nationale (CONASAFIC)", "bcc": "Banque Centrale du Congo",
           "judiciaire": "Ministère public ou CENAREF"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def gel_actif(tid: int) -> dict | None:
    return une("select * from gel_avoirs where tiers_id = %s and leve_le is null", (tid,))


def controler_gel(tid: int, u: dict | None = None) -> None:
    """Aucune somme ne sort des comptes d'un client gelé (loi 22/068, art. 158 bis ; loi 22/069, art. 73).
    A14 : la tentative est gardée au journal de sécurité, hors de la transaction refusée (art. 162, al. 2)."""
    g = gel_actif(tid)
    if g:
        from .securite import noter
        numero = une("select numero from tiers where id = %s", (tid,))["numero"]
        noter("fonds_geles", login=(u or {}).get("login", ""), utilisateur_id=(u or {}).get("id"),
              detail=f"Client {numero} ; décision {g['decision_reference']} du {g['decision_le'].strftime('%d/%m/%Y')}")
        raise ErreurMetier(f"Avoirs gelés : aucune somme ne sort des comptes de ce client (décision {g['decision_reference']} du "
                           f"{g['decision_le'].strftime('%d/%m/%Y')}). Loi 22/068, art. 158 bis ; loi 22/069, art. 73.")


def controler_lignes(lignes_ecr: list[dict], u: dict | None = None) -> None:
    """Appelé par poster : un débit sur un compte de dépôt ou sur les parts d'un client gelé est refusé, d'où qu'il vienne"""
    for l in lignes_ecr:
        c = str(l.get("contrat") or "")
        if l["sens"] != "D":
            continue
        from .soupcons import controler_attente     # P9 : opération soupçonnée, en attente de la déclaration (Instr. BCC 15, art. 36, 4e tiret)
        if c.startswith("depot:"):
            t = une("select tiers_id from compte_depot where id = %s", (int(c[6:]),))
            if t:
                controler_gel(t["tiers_id"], u)
                controler_attente(t["tiers_id"])
        elif c.startswith("parts:"):
            controler_gel(int(c[6:]), u)
            controler_attente(int(c[6:]))


def vue(g: dict) -> dict:
    from .services import nom_utilisateur, titulaire
    t = une("select numero from tiers where id = %s", (g["tiers_id"],))
    return {"id": g["id"], "tiersId": g["tiers_id"], "membre": t["numero"], "client": titulaire(g["tiers_id"]), "source": g["source"], "sourceLibelle": SOURCES[g["source"]],
            "decisionReference": g["decision_reference"], "decisionLe": g["decision_le"].isoformat(), "motif": g["motif"], "gelePar": nom_utilisateur(g["gele_par"]),
            "geleLe": g["gele_le"].isoformat(), "informeLe": g["informe_le"].isoformat() if g["informe_le"] else "", "referenceInformation": g["reference_information"] or "",
            "leveLe": g["leve_le"].isoformat() if g["leve_le"] else "", "referenceLevee": g["reference_levee"] or "",
            "levePar": nom_utilisateur(g["leve_par"]) if g["leve_par"] else ""}


def lister(u: dict, statut: str = "actifs") -> list[dict]:
    from .services import exiger
    exiger(u)
    cond = {"actifs": "and leve_le is null", "leves": "and leve_le is not null"}.get(statut, "")
    return [vue(g) for g in lignes(f"select * from gel_avoirs where institution_id = %s {cond} order by gele_le desc, id desc", (u["institution_id"],))]


def geler(u: dict, d: dict) -> dict:
    """Sans délai ni notification préalable au client (art. 158 bis)"""
    from .services import exiger
    exiger(u)
    d = d if isinstance(d, dict) else {}
    numero = str(d.get("membre") or "").strip()
    source, ref, date_, motif = str(d.get("source") or ""), str(d.get("decisionReference") or "").strip(), str(d.get("decisionLe") or "").strip(), str(d.get("motif") or "").strip()
    manque = [n for v, n in ((numero, "N° client"), (source in SOURCES, "Autorité"), (ref, "Référence de la décision"), (DATE.match(date_), "Date de la décision"), (motif, "Motif")) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    t = une("select id from tiers where numero = %s and institution_id = %s for update", (numero, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if gel_actif(t["id"]):
        raise ErreurMetier("Les avoirs de ce client sont déjà gelés.")
    from .conformite import _jour
    gid = une("""insert into gel_avoirs (institution_id, tiers_id, source, decision_reference, decision_le, motif, gele_par, gele_le)
                 values (%s, %s, %s, %s, %s, %s, %s, %s) returning id""", (u["institution_id"], t["id"], source, ref, date_, motif, u["id"], _jour(u)))["id"]
    return vue(une("select * from gel_avoirs where id = %s", (gid,)))


def _gel(u: dict, gid: int) -> dict:
    g = une("select * from gel_avoirs where id = %s and institution_id = %s for update", (gid, u["institution_id"]))
    if not g:
        raise ErreurMetier("Gel introuvable.")
    return g


def informer(u: dict, gid: int, d: dict) -> dict:
    """Art. 162 : information sans délai du CONASAFIC et de la CENAREF ; loi 22/069, art. 76 : information de la BCC"""
    from .services import exiger
    exiger(u)
    d = d if isinstance(d, dict) else {}
    g = _gel(u, gid)
    if g["informe_le"]:
        raise ErreurMetier("Information déjà notée.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not DATE.match(date_) or not ref:
        raise ErreurMetier("À remplir : date et référence de l'information.")
    executer("update gel_avoirs set informe_le = %s, reference_information = %s where id = %s", (date_, ref, gid))
    return vue(_gel(u, gid))


def lever(u: dict, gid: int, d: dict) -> dict:
    """La levée suit une décision de l'autorité (radiation, mainlevée, autorisation du Ministre : art. 121, 169)"""
    from .services import exiger
    exiger(u)
    d = d if isinstance(d, dict) else {}
    g = _gel(u, gid)
    if g["leve_le"]:
        raise ErreurMetier("Gel déjà levé.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not DATE.match(date_) or not ref:
        raise ErreurMetier("À remplir : date et référence de la décision de levée.")
    executer("update gel_avoirs set leve_le = %s, reference_levee = %s, leve_par = %s where id = %s", (date_, ref, u["id"], gid))
    return vue(_gel(u, gid))


# ---------- A13 : listes de désignation et rapprochement (confrontation du 21/11/2026) ----------
# Loi 22/068 modifiée, art. 158 et 158 bis : gel sans délai dès la publication de la liste ; art. 161 bis : listes communiquées au secteur financier ;
# art. 168 bis : un nom identique ou similaire peut toucher une autre personne, d'où l'examen avant de geler. Format du fichier : registre T44 (à confirmer).
SOURCES_LISTE = {"onu": "Conseil de sécurité des Nations Unies", "conasafic": "Liste nationale (CONASAFIC)"}
COLONNES_LISTE = ["Nom", "Autres noms", "Date de naissance", "N° de pièce", "Référence de désignation", "Date de désignation"]


def normaliser(texte: str) -> list[str]:
    """Mots d'un nom, sans accents ni ponctuation, en capitales"""
    import unicodedata
    t = unicodedata.normalize("NFKD", texte or "").encode("ascii", "ignore").decode().upper()
    return [m for m in re.split(r"[^A-Z0-9]+", t) if m]


def _date_fr(v: str) -> str | None:
    v = (v or "").strip()
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", v)
    if m:
        return f"{m[3]}-{m[2]}-{m[1]}"
    return v if DATE.match(v) else None


def importer_liste(u: dict, d: dict) -> dict:
    """Une nouvelle publication remplace la précédente de la même source : les personnes radiées sortent de la liste en vigueur"""
    from .services import exiger
    exiger(u)
    d = d if isinstance(d, dict) else {}
    source, ref, le, contenu = str(d.get("source") or ""), str(d.get("reference") or "").strip(), str(d.get("publieLe") or "").strip(), str(d.get("contenu") or "")
    manque = [n for v, n in ((source in SOURCES_LISTE, "Source"), (ref, "Référence de la publication"), (DATE.match(le), "Date de publication"), (contenu.strip(), "Fichier")) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    lignes_csv = [l for l in contenu.replace("\r\n", "\n").split("\n") if l.strip()]
    sep = ";" if ";" in lignes_csv[0] else ","
    entete = [c.strip().strip('"') for c in lignes_csv[0].split(sep)]
    if [normaliser(c) for c in entete[:len(COLONNES_LISTE)]] != [normaliser(c) for c in COLONNES_LISTE]:
        raise ErreurMetier("Colonnes attendues, dans cet ordre : " + " ; ".join(COLONNES_LISTE) + ".")
    entrees = []
    for n, l in enumerate(lignes_csv[1:], start=2):
        v = [c.strip().strip('"') for c in l.split(sep)] + [""] * len(COLONNES_LISTE)
        if not v[0]:
            raise ErreurMetier(f"Ligne {n} : nom manquant.")
        nais, designe = _date_fr(v[2]) if v[2] else None, _date_fr(v[5]) if v[5] else None
        if (v[2] and not nais) or (v[5] and not designe):
            raise ErreurMetier(f"Ligne {n} : date invalide (JJ/MM/AAAA).")
        entrees.append((v[0], v[1] or None, nais, v[3] or None, v[4] or None, designe))
    if not entrees:
        raise ErreurMetier("Le fichier ne contient aucune personne.")
    iid = une("""insert into liste_gel_import (institution_id, source, reference, publie_le, lignes, importe_par) values (%s, %s, %s, %s, %s, %s) returning id""",
              (u["institution_id"], source, ref, le, len(entrees), u["id"]))["id"]
    executer("update liste_gel set actif = false where institution_id = %s and source = %s and actif", (u["institution_id"], source))
    for e in entrees:
        executer("""insert into liste_gel (import_id, institution_id, source, nom, autres_noms, naissance, piece, reference, designe_le)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)""", (iid, u["institution_id"], source, *e))
    nouvelles = rapprocher(u)
    return {"importId": iid, "lignes": len(entrees), "correspondances": nouvelles}


def _personnes(tid: int) -> list[tuple[str, str, str]]:
    """Le client, et ceux qui agissent pour lui (art. 158 bis, 4°) : dirigeant, signataires, membres du groupe, mandataires en cours.
    Rend (qui, nom complet, numéro de pièce)."""
    from .services import titulaire
    p = une("select piece_numero from tiers_personne where tiers_id = %s", (tid,))
    gens = [("Client", titulaire(tid), (p or {}).get("piece_numero") or "")]
    roles = {"dirigeant": "Dirigeant", "signataire": "Signataire", "membre": "Membre du groupe"}
    for r in lignes("select role, nom, postnom, prenom, piece_numero from representant where tiers_id = %s and retire_le is null", (tid,)):
        gens.append((roles.get(r["role"], r["role"]), " ".join(x for x in (r["nom"], r["postnom"], r["prenom"]) if x), r["piece_numero"] or ""))
    for r in lignes("""select nom, postnom, prenom, piece_numero from procuration where mandant_id = %s and fin_le is null and date_debut <= jour_agence()
                       and (date_fin is null or date_fin >= jour_agence())""", (tid,)):
        gens.append(("Mandataire", " ".join(x for x in (r["nom"], r["postnom"], r["prenom"]) if x), r["piece_numero"] or ""))
    return gens


def _correspond(nom: str, piece: str, entree: dict) -> str | None:
    """Même numéro de pièce, ou tous les mots du nom désigné (ou d'un de ses autres noms) dans le nom de la personne, ou l'inverse"""
    if piece and entree["piece"] and normaliser(piece) == normaliser(entree["piece"]):
        return "Même numéro de pièce"
    mots = set(normaliser(nom))
    for designe in [entree["nom"]] + [x for x in re.split(r"[|/]", entree["autres_noms"] or "") if x.strip()]:
        d = set(normaliser(designe))
        if d and mots and (d <= mots or mots <= d) and (min(len(d), len(mots)) >= 2 or d == mots):
            return f"Nom : {designe.strip()}"
    return None


def rapprocher(u: dict, tiers_ids: list[int] | None = None) -> int:
    """Rapproche les clients (tous, ou ceux donnés) de la liste en vigueur ; rend le nombre de correspondances nouvelles, à examiner"""
    entrees = lignes("select * from liste_gel where institution_id = %s and actif", (u["institution_id"],))
    if not entrees:
        return 0
    ids = tiers_ids if tiers_ids is not None else [r["id"] for r in lignes(
        "select id from tiers where institution_id = %s and statut not in ('resilie')", (u["institution_id"],))]
    n = 0
    for tid in ids:
        for qui, nom, piece in _personnes(tid):
            for e in entrees:
                raison = _correspond(nom, piece, e)
                if raison and une("""insert into correspondance_gel (institution_id, tiers_id, liste_id, personne, raison) values (%s, %s, %s, %s, %s)
                                     on conflict do nothing returning id""", (u["institution_id"], tid, e["id"], f"{qui} : {nom}", raison)):
                    n += 1
    return n


def vue_correspondance(c: dict) -> dict:
    from .services import nom_utilisateur, titulaire
    e = une("select * from liste_gel where id = %s", (c["liste_id"],))
    return {"id": c["id"], "tiersId": c["tiers_id"], "membre": une("select numero from tiers where id = %s", (c["tiers_id"],))["numero"], "client": titulaire(c["tiers_id"]),
            "personne": c["personne"], "raison": c["raison"], "source": SOURCES_LISTE.get(e["source"], e["source"]), "designe": e["nom"], "autresNoms": e["autres_noms"] or "",
            "naissance": e["naissance"].isoformat() if e["naissance"] else "", "piece": e["piece"] or "", "referenceDesignation": e["reference"] or "",
            "statut": c["statut"], "observation": c["observation"] or "", "traitePar": nom_utilisateur(c["traite_par"]) if c["traite_par"] else "",
            "traiteLe": c["traite_le"].date().isoformat() if c["traite_le"] else ""}


def listes(u: dict) -> dict:
    """Publications importées et correspondances, à examiner d'abord"""
    from .services import exiger, nom_utilisateur
    exiger(u)
    imports = [{"id": r["id"], "source": SOURCES_LISTE[r["source"]], "reference": r["reference"], "publieLe": r["publie_le"].isoformat(), "lignes": r["lignes"],
                "importePar": nom_utilisateur(r["importe_par"]), "importeLe": r["importe_le"].date().isoformat(),
                "enVigueur": bool(valeur("select 1 from liste_gel where import_id = %s and actif limit 1", (r["id"],)))}
               for r in lignes("select * from liste_gel_import where institution_id = %s order by importe_le desc, id desc", (u["institution_id"],))]
    corr = [vue_correspondance(c) for c in lignes("""select * from correspondance_gel where institution_id = %s
                                                      order by statut <> 'a_examiner', cree_le desc, id desc""", (u["institution_id"],))]
    return {"imports": imports, "correspondances": corr, "colonnes": COLONNES_LISTE}


def examiner(u: dict, cid: int, d: dict) -> dict:
    """Confirmer : la personne est bien la personne désignée, les avoirs du client sont gelés sans délai (art. 158 bis). Écarter : homonyme, avec
    l'observation qui le montre (art. 168 bis : date de naissance, pièce)."""
    from .services import exiger
    from .conformite import _jour
    exiger(u)
    d = d if isinstance(d, dict) else {}
    c = une("select * from correspondance_gel where id = %s and institution_id = %s for update", (cid, u["institution_id"]))
    if not c:
        raise ErreurMetier("Correspondance introuvable.")
    if c["statut"] != "a_examiner":
        raise ErreurMetier("Correspondance déjà examinée.")
    decision, obs = str(d.get("decision") or ""), str(d.get("observation") or "").strip()
    if decision not in ("confirmee", "ecartee"):
        raise ErreurMetier("Décision : confirmer ou écarter.")
    if decision == "ecartee" and not obs:
        raise ErreurMetier("Observation : ce qui montre que ce n'est pas la personne désignée (loi 22/068, art. 168 bis).")
    executer("update correspondance_gel set statut = %s, observation = %s, traite_par = %s, traite_le = now() where id = %s", (decision, obs or None, u["id"], cid))
    if decision == "confirmee" and not gel_actif(c["tiers_id"]):
        e = une("select * from liste_gel where id = %s", (c["liste_id"],))
        imp = une("select * from liste_gel_import where id = %s", (e["import_id"],))
        executer("""insert into gel_avoirs (institution_id, tiers_id, source, decision_reference, decision_le, motif, gele_par, gele_le)
                    values (%s, %s, %s, %s, %s, %s, %s, %s)""",
                 (u["institution_id"], c["tiers_id"], e["source"], e["reference"] or imp["reference"], e["designe_le"] or imp["publie_le"],
                  f"Personne désignée ({c['personne']}) : liste {SOURCES_LISTE[e['source']]}, publication {imp['reference']}", u["id"], _jour(u)))
    return vue_correspondance(une("select * from correspondance_gel where id = %s", (cid,)))


def exiger_correspondances_examinees(tid: int) -> None:
    """Pas de visa tant qu'une correspondance avec une liste de gel attend l'examen de la conformité (art. 158 bis : sans délai)"""
    if valeur("select 1 from correspondance_gel where tiers_id = %s and statut = 'a_examiner' limit 1", (tid,)):
        raise ErreurMetier("Correspondance avec une liste de gel à examiner d'abord (Client > Conformité > Examen renforcé, onglet Gel des avoirs ; "
                           "loi 22/068, art. 158 bis).")
