from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0080_examen_renforce.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0079_dat_annulation")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
