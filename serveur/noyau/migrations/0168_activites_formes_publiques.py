from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0168_activites_formes_publiques.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0167_formes_juridiques")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
