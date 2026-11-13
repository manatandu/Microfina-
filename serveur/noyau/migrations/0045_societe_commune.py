from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0045_societe_commune.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0044_societe")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
