from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0172_activite_objet.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0171_assurance_tresorerie")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
