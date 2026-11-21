from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0156_normes_prudentielles.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0155_retrait_report_parts")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
