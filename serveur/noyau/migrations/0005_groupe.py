from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0005_groupe.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0004_entreprise")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
