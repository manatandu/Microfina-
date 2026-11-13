from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0047_jours_travail.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0046_agents_agence")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
