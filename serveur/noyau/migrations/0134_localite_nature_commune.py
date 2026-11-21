from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0134_localite_nature_commune.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0133_localite_nature")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
