from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0178_types_procuration.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0177_groupe_tiers")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
