"""Envoie une alerte d'exploitation par courriel aux adresses de LIKELEMBA_ALERTE_COURRIELS (registres T219, T220) :
    python manage.py alerter "Sauvegarde : ÉCHEC. pg_dump a échoué."
Sert à la tâche de sauvegarde. Le message ne porte jamais de donnée d'un membre."""
from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Alerte d'exploitation par courriel"

    def add_arguments(self, parser):
        parser.add_argument("message")

    def handle(self, *a, **o):
        if not settings.ALERTE_COURRIELS or not settings.EMAIL_HOST:
            raise CommandError("Alerte non envoyée : LIKELEMBA_ALERTE_COURRIELS ou LIKELEMBA_SMTP_HOTE absent.")
        send_mail("Exofina : alerte d'exploitation", o["message"][:2000], settings.SERVER_EMAIL, settings.ALERTE_COURRIELS, fail_silently=False)
        self.stdout.write("Alerte envoyée.")
