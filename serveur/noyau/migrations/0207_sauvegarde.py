from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0207_sauvegarde.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0206_mots_de_passe")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
