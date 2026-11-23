from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0179_plafond_cycle.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0178_types_procuration")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
