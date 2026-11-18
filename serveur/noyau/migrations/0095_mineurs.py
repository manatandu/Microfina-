from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0095_mineurs.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0094_journal_securite_ecran")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
