"""Première installation d'une institution réelle, sur une base vide (audit du 21/11/2026, point bloquant B5 ; registre T227).
    python manage.py migrate
    python manage.py installer --nom "…" --sigle "…" --type coopec --agence-code 01 --agence-nom "Siège" --exercice 2027 \\
        --admin-login … --admin-nom "…"
    python manage.py definir_mot_de_passe <identifiant de l'administrateur>
Ne se lance qu'une fois : une installation par institution. La graine et les exemples, eux, ne servent qu'à la démonstration."""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from noyau.bd import ErreurMetier
from noyau.fuseau import FUSEAUX, PAR_DEFAUT
from noyau.installation import installer
from noyau.societe import PROFILS


class Command(BaseCommand):
    help = "Crée une institution réelle, vide, avec son premier administrateur"

    def add_arguments(self, parser):
        parser.add_argument("--nom", required=True, help="dénomination de l'institution, celle de l'agrément")
        parser.add_argument("--sigle", default="")
        parser.add_argument("--type", required=True, choices=list(PROFILS), help="catégorie de l'agrément")
        parser.add_argument("--agence-code", required=True)
        parser.add_argument("--agence-nom", required=True)
        parser.add_argument("--fuseau", default=PAR_DEFAUT, choices=list(FUSEAUX), help="fuseau de la première agence")
        parser.add_argument("--exercice", required=True, type=int, help="année du premier exercice tenu dans le logiciel")
        parser.add_argument("--admin-login", required=True, help="identifiant du premier administrateur (gestion des accès)")
        parser.add_argument("--admin-nom", required=True, help="nom et prénoms du premier administrateur")

    def handle(self, *args, **o):
        try:
            with transaction.atomic():
                r = installer({"nom": o["nom"], "sigle": o["sigle"], "profil": o["type"], "agenceCode": o["agence_code"], "agenceNom": o["agence_nom"],
                               "fuseau": o["fuseau"], "annee": o["exercice"], "adminLogin": o["admin_login"], "adminNom": o["admin_nom"]})
        except ErreurMetier as e:
            raise CommandError(str(e))
        self.stdout.write(self.style.SUCCESS(f"{r['institution']} installée : agence {r['agence']}, exercice {r['exercice']}, {r['profils']} profils."))
        self.stdout.write(f"Reste à faire : python manage.py definir_mot_de_passe {r['administrateur']}")
