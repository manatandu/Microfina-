from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0026_listes.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0025_guichets_comptes")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
