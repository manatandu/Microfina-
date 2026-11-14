from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0062_operation_banque.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0061_libelles_membres")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
