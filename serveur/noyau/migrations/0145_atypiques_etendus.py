from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0145_atypiques_etendus.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0144_virements_parties")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
