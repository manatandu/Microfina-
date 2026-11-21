from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0147_refus_client.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0146_attente_soupcon")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
