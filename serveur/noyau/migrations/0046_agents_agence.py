from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0046_agents_agence.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0045_societe_commune")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
