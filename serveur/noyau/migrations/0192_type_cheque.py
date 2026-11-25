from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0192_type_cheque.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0191_reversement_taxe")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
