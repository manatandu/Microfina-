"""Donne un mot de passe à un compte existant (registre S01-2). Le mot de passe se tape à l'invite, ou vient de la variable
LIKELEMBA_MOT_DE_PASSE ; jamais en argument de la commande, pour ne pas rester dans l'historique du terminal.
    python manage.py definir_mot_de_passe jpmukendi
    python manage.py definir_mot_de_passe jpmukendi --si-absent    (au déploiement : ne touche pas un compte qui a déjà un mot de passe)
Seule l'empreinte est gardée (S05-3). Aucune règle de longueur : l'institution édicte ses règles internes (Instr. BCC 008, art. 16)."""
import getpass
import os

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

from noyau.bd import executer, valeur


class Command(BaseCommand):
    help = "Définit le mot de passe d'un compte utilisateur"

    def add_arguments(self, parser):
        parser.add_argument("login")
        parser.add_argument("--si-absent", action="store_true", help="ne rien faire si le compte a déjà un mot de passe")

    def handle(self, *args, **o):
        login = o["login"].strip()
        if not valeur("select 1 from utilisateur where login = %s and actif", (login,)):
            raise CommandError("Identifiant inconnu.")
        if o["si_absent"] and valeur("select mot_de_passe_hash from utilisateur where login = %s", (login,)):
            self.stdout.write(f"{login} a déjà un mot de passe : inchangé.")
            return
        mdp = os.environ.get("LIKELEMBA_MOT_DE_PASSE") or getpass.getpass("Mot de passe : ")
        if not mdp or (not os.environ.get("LIKELEMBA_MOT_DE_PASSE") and mdp != getpass.getpass("Confirmation : ")):
            raise CommandError("Mot de passe vide ou différent de la confirmation.")
        executer("update utilisateur set mot_de_passe_hash = %s where login = %s", (make_password(mdp), login))
        self.stdout.write(f"Mot de passe défini pour {login}.")
