from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0119_credits_litigieux.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0118_centrale_risques")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
