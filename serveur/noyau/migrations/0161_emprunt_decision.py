from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0161_emprunt_decision.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0160_interets_courus_credit")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
