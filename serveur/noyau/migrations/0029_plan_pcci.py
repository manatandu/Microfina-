"""Plan comptable PCCI complet (604 comptes, § 13 « Liste des comptes »), lu dans replica/pcci.json, seule copie du plan.
Le PCCI est obligatoire pour les COOPEC et les IMF (Instruction BCC n° 006). Les comptes déjà chargés reçoivent le libellé du PCCI."""
import json

from django.conf import settings
from django.db import migrations

NATURE = "check (nature in ('actif', 'passif', 'charge', 'produit', 'hors_bilan', 'gestion', 'mixte'))"


def charger(apps, schema_editor):
    plan = json.loads((settings.RACINE_DEPOT / "replica" / "pcci.json").read_text(encoding="utf-8"))
    with schema_editor.connection.cursor() as c:
        for x in plan["comptes"]:
            c.execute("""insert into compte (numero, libelle, classe, nature) values (%s, %s, %s, %s)
                         on conflict (institution_id, numero) do update set libelle = excluded.libelle, classe = excluded.classe, nature = excluded.nature""",
                      (x["numero"], x["libelle"], x["classe"], x["nature"]))


class Migration(migrations.Migration):
    dependencies = [("noyau", "0028_frais_reprise")]
    operations = [
        # Classes 3, 4 et 5 : certains comptes sont tantôt débiteurs, tantôt créditeurs (clientèle, tiers, liaison, virements internes)
        migrations.RunSQL(f"alter table compte drop constraint compte_nature_check; alter table compte add constraint compte_nature_check {NATURE}",
                          reverse_sql=migrations.RunSQL.noop),
        migrations.RunPython(charger, migrations.RunPython.noop),
    ]
