from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0074_depot_terme.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0073_journal_securite")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
