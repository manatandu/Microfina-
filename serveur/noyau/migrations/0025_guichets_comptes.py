from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0025_guichets_comptes.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0024_affectation_guichets")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
