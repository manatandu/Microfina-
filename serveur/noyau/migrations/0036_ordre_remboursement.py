from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0036_ordre_remboursement.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0035_credit_general")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
