"""Première migration : le schéma de replica/schema.sql, seule copie du schéma (testé par replica/schema-test.sql)."""
from django.conf import settings
from django.db import migrations


def lire_schema():
    texte = (settings.RACINE_DEPOT / "replica" / "schema.sql").read_text(encoding="utf-8")
    # La migration est déjà dans une transaction : on retire le begin/commit du fichier
    lignes = [l for l in texte.splitlines() if l.strip().lower() not in ("begin;", "commit;")]
    return "\n".join(lignes)


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [migrations.RunSQL(lire_schema(), reverse_sql=migrations.RunSQL.noop)]
