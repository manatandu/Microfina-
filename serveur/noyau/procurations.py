"""S47 : types de procuration (manuel Microfina++, p. 56). Mêmes règles que web/src/donnees/api.ts (procurations)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger


def lire(u) -> list[dict]:
    exiger(u)
    return lignes("select id, libelle from type_procuration where institution_id = %s and supprime_le is null order by libelle", (u["institution_id"],))


def creer(u, d) -> dict:
    exiger(u)
    l = (d.get("libelle") if isinstance(d, dict) and isinstance(d.get("libelle"), str) else "").strip()
    if not l:
        raise ErreurMetier("À remplir : libellé.")
    if valeur("select 1 from type_procuration where institution_id = %s and lower(libelle) = lower(%s) and supprime_le is null", (u["institution_id"], l)):
        raise ErreurMetier("Ce type de procuration existe déjà.")
    tid = valeur("insert into type_procuration (institution_id, libelle) values (%s, %s) returning id", (u["institution_id"], l))
    return {"id": tid, "libelle": l}


def supprimer(u, tid: int):
    exiger(u)
    if not une("select 1 from type_procuration where id = %s and institution_id = %s and supprime_le is null for update", (tid, u["institution_id"])):
        raise ErreurMetier("Type de procuration introuvable.")
    if valeur("select 1 from procuration where type_id = %s", (tid,)):
        raise ErreurMetier("Ce type est utilisé par une procuration.")
    executer("update type_procuration set supprime_le = now(), supprime_par = %s where id = %s", (u["id"], tid))   # registre T02 : suppression logique


# ---------- Procurations (confrontation du 21/11/2026, E2) ----------
# Le mandat (Code civil, art. 526 à 548) ; le mandataire identifié comme un client et habilité (loi 22/068, art. 31, al. 3 et art. 33 ;
# Instr. BCC 15, art. 11, 12, 13 et 16) ; copies de la pièce et du pouvoir (art. 33, al. 2 ; Instr. BCC 15, art. 12 et 29) ;
# informations centralisées (loi 22/068, art. 44, 2°).
MOTIFS_FIN = ("Révocation par le mandant", "Renonciation du mandataire", "Décès du mandant", "Décès du mandataire", "Déconfiture")   # art. 544


def _vue(r: dict) -> dict:
    from .services import iso, vue_representant
    v = vue_representant({**r, "role": "mandataire", "piece_validite": r["piece_validite"], "photo": None, "signature": None})
    jour = valeur("select current_date")
    en_cours = not r["fin_le"] and r["date_debut"] <= jour and (r["date_fin"] is None or r["date_fin"] >= jour)
    return {**{k: v[k] for k in v if k not in ("photo", "specimen", "qualite", "personneExposee")},
            "id": r["id"], "mandantId": r["mandant_id"], "typeId": r["type_id"], "type": r.get("type_libelle") or "", "reference": r["reference"] or "",
            "telephone": r["telephone"] or "", "dateDebut": iso(r["date_debut"]), "dateFin": iso(r["date_fin"]), "copieActe": bool(r["copie_acte"]),
            "copiePiece": bool(r["copie_piece"]), "finLe": iso(r["fin_le"]), "finMotif": r["fin_motif"] or "", "enCours": en_cours,
            "ayantDroit": bool(r.get("ayant_droit"))}   # A16 : ayant droit d'un titulaire décédé


SQL_VUE = "select p.*, t.libelle as type_libelle from procuration p left join type_procuration t on t.id = p.type_id"


def lister_client(u, tid: int) -> list[dict]:
    """Procurations données par un client, en cours puis terminées"""
    exiger(u)
    if not une("select 1 from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])):
        raise ErreurMetier("Client introuvable.")
    return [_vue(r) for r in lignes(SQL_VUE + " where p.mandant_id = %s order by p.fin_le nulls first, p.date_debut desc, p.id desc", (tid,))]


def en_cours(u, tid: int) -> list[dict]:
    """Au guichet : les procurations en cours du titulaire, pour choisir le mandataire qui retire"""
    return [x for x in lister_client(u, tid) if x["enCours"]]


def enregistrer(u, d) -> dict:
    import re
    from .services import controler_image, controler_representant, journee_courante, texte_de, ADRESSE_REP
    from . import adresse
    exiger(u)
    d = d if isinstance(d, dict) else {}
    texte = texte_de(d)
    tid = d.get("mandantId")
    t = une("select id, statut, deces_le from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])) if isinstance(tid, int) else None
    if not t:
        raise ErreurMetier("Mandant : client introuvable.")
    if t["statut"] in ("prospect", "resilie"):
        raise ErreurMetier("Mandant prospect ou résilié : pas de procuration.")
    # A16 : après le décès, plus de mandat (Code civil, art. 544) ; seul un ayant droit s'enregistre, sur la pièce de succession
    ayant_droit = d.get("ayantDroit") is True
    if t["deces_le"] and not ayant_droit:
        raise ErreurMetier("Titulaire décédé : le mandat a pris fin (Code civil, art. 544). Enregistrer un ayant droit, sur la pièce de succession.")
    if ayant_droit and not t["deces_le"]:
        raise ErreurMetier("Ayant droit : seulement pour un titulaire dont le décès est déclaré (Client > Résilier un client).")
    type_id = d.get("typeId")
    if not isinstance(type_id, int) or not une("select 1 from type_procuration where id = %s and institution_id = %s and supprime_le is null",
                                               (type_id, u["institution_id"])):
        raise ErreurMetier("Type de procuration : à choisir (Gestion des procurations, Nouveau type procuration).")
    # le mandataire, identifié comme un client (mêmes mentions et mêmes contrôles qu'un représentant)
    controler_representant(d, "Mandataire", journee_courante(u))
    debut, fin = texte("dateDebut"), texte("dateFin")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", debut):
        raise ErreurMetier("Date de début : à remplir.")
    if fin and (not re.match(r"^\d{4}-\d{2}-\d{2}$", fin) or fin < debut):
        raise ErreurMetier("Date de fin : date invalide ou avant le début.")
    for k, n in (("copieActe", "copie de la pièce de succession" if ayant_droit else "copie de la procuration"), ("copiePiece", "copie de la pièce du mandataire")):
        if not d.get(k):
            raise ErreurMetier(f"À déposer : {n} (loi 22/068, art. 33, al. 2 ; Instr. BCC 15, art. 12 et 29).")
        controler_image(d.get(k), n.capitalize())
    pid = valeur("""insert into procuration (mandant_id, type_id, date_debut, date_fin, reference, nom, postnom, prenom, date_naissance, lieu_naissance, piece_type,
                                             piece_numero, piece_delivree_le, piece_lieu, piece_autorite, piece_validite, piece_pays, telephone, pays, province, ville,
                                             commune, quartier, rue, numero_rue, adresse, copie_acte, copie_piece, cree_par, ayant_droit)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (tid, type_id, debut, fin or None, texte("reference") or None, texte("nom"), texte("postnom") or None, texte("prenom"), texte("naissance"),
                  texte("lieuNaissance"), texte("pieceType"), texte("pieceNumero"), texte("pieceDelivreeLe"), texte("pieceLieu"), texte("pieceAutorite"),
                  texte("pieceExpire"), texte("piecePays") or None, texte("telephone") or None, *[texte(k) or None for k in ADRESSE_REP],
                  adresse.composer(texte) or None, d["copieActe"], d["copiePiece"], u["id"], ayant_droit))
    from .gel import rapprocher
    rapprocher(u, [tid])                                  # A13 : le mandataire aussi (loi 22/068, art. 158 bis, 4°)
    return _vue(une(SQL_VUE + " where p.id = %s", (pid,)))


def mettre_fin(u, pid: int, d) -> dict:
    """Fin du mandat : révocation, renonciation, décès ou déconfiture (Code civil, art. 544 à 548). La fiche reste, avec la date, le motif et l'auteur."""
    import re
    exiger(u)
    d = d if isinstance(d, dict) else {}
    r = une(SQL_VUE + " join tiers m on m.id = p.mandant_id where p.id = %s and m.institution_id = %s for update of p", (pid, u["institution_id"]))
    if not r:
        raise ErreurMetier("Procuration introuvable.")
    if r["fin_le"]:
        raise ErreurMetier("Cette procuration a déjà pris fin.")
    motif, le = str(d.get("motif") or "").strip(), str(d.get("date") or "").strip()
    if motif not in MOTIFS_FIN:
        raise ErreurMetier("Motif de fin : à choisir (Code civil, art. 544).")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", le) or le < r["date_debut"].isoformat():
        raise ErreurMetier("Date de fin : date invalide ou avant le début.")
    executer("update procuration set fin_le = %s, fin_motif = %s, fin_par = %s, fin_saisie_le = now() where id = %s", (le, motif, u["id"], pid))
    return _vue(une(SQL_VUE + " where p.id = %s", (pid,)))


def mandataire_du_retrait(u, tiers_id: int, p: dict) -> tuple[str | None, int | None]:
    """Retrait au guichet (S74) : le titulaire lui-même, ou un mandataire choisi parmi ses procurations en cours (loi 22/068, art. 31, al. 3 ;
    Instr. BCC 15, art. 11 et 16). Rend le nom de celui qui retire et la procuration."""
    pid = p.get("procurationId")
    deces = valeur("select deces_le from tiers where id = %s", (tiers_id,))
    if deces and (pid is None or pid == ""):
        raise ErreurMetier(f"Titulaire décédé le {deces.strftime('%d/%m/%Y')} : retrait seulement par un ayant droit enregistré sur la pièce de succession "
                           "(Client > Gestion des procurations).")
    if pid is None or pid == "":
        if str(p.get("mandataire") or "").strip():
            raise ErreurMetier("Retrait par un mandataire : choisir sa procuration en cours (Client > Gestion des procurations ; loi 22/068, art. 31, al. 3).")
        return None, None
    x = next((x for x in en_cours(u, tiers_id) if x["id"] == pid), None)
    if not x:
        raise ErreurMetier("Procuration inconnue, terminée ou pas encore en vigueur pour ce titulaire.")
    if deces and not x["ayantDroit"]:
        raise ErreurMetier("Titulaire décédé : le mandat a pris fin (Code civil, art. 544) ; retrait seulement par un ayant droit.")
    if x["ayantDroit"]:
        return " ".join(v for v in (x["nom"], x["postnom"], x["prenom"]) if v) + " (ayant droit)", pid
    return " ".join(v for v in (x["nom"], x["postnom"], x["prenom"]) if v) + " (mandataire)", pid


def declarer_deces(u, tid: int, d) -> dict:
    """A16 : décès du titulaire, sur l'acte de décès. Les procurations en cours prennent fin (Code civil, art. 544) ; les retraits ne se font plus qu'à un
    ayant droit enregistré sur la pièce de succession."""
    import re
    from .services import lire_tiers
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    t = une("select id, statut, deces_le from tiers where id = %s and institution_id = %s and type = 'physique' for update", (tid, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client physique introuvable.")
    if t["deces_le"]:
        raise ErreurMetier("Décès déjà déclaré.")
    le, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", le) or le > valeur("select current_date").isoformat() or not ref:
        raise ErreurMetier("À remplir : date du décès (pas dans le futur) et référence de l'acte de décès.")
    executer("update tiers set deces_le = %s, deces_reference = %s, deces_par = %s where id = %s", (le, ref, u["id"], tid))
    executer("""update procuration set fin_le = greatest(%s::date, date_debut), fin_motif = 'Décès du mandant', fin_par = %s, fin_saisie_le = now()
                where mandant_id = %s and fin_le is null""", (le, u["id"], tid))
    return lire_tiers(tid)
