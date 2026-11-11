from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0023_numerotation.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0022_secteurs")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
