from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0151_report_parts.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0150_qualite_ppe")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
