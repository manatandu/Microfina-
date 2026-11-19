from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0098_dat_echeance.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0097_suppression_logique")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
