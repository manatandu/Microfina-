from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0219_auditeur_journal_activite.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0218_journal_activite")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
