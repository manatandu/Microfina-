from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0016_banques.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0015_consentement")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
