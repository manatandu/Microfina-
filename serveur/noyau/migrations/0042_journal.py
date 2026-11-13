from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0042_journal.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0041_numero_piece")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
