from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0009_modification.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0008_frais_client")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
