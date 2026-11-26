"""Contrôle du matin (registre T220) : la dernière sauvegarde réussie a moins de 26 heures. Sinon : alerte par courriel et code 1.
    python manage.py controler_sauvegarde [--heures 26]
Il rattrape le cas où la tâche du soir n'a pas tourné du tout (machine arrêtée, planification perdue) : Instr. BCC 36, art. 34."""
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from noyau.sauvegardes import derniere


class Command(BaseCommand):
    help = "Vérifie qu'une sauvegarde récente existe"

    def add_arguments(self, parser):
        parser.add_argument("--heures", type=int, default=26)

    def handle(self, *a, **o):
        d = derniere()
        if d and d["heures"] <= o["heures"]:
            self.stdout.write(f"Dernière sauvegarde : {d['fichier']}, il y a {d['heures']:.0f} h.")
            return
        message = (f"Dernière sauvegarde réussie il y a {d['heures']:.0f} heures ({d['fichier']})." if d else "Aucune sauvegarde au registre.")
        try:
            call_command("alerter", f"Sauvegarde en retard. {message}")
        except CommandError as e:
            self.stderr.write(str(e))
        raise CommandError(message)
