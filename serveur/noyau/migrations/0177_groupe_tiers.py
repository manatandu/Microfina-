from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0177_groupe_tiers.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0176_agents_roles")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
