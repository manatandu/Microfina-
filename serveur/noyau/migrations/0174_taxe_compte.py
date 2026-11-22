from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0174_taxe_compte.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0173_agent_allege")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
