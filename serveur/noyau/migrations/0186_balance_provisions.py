from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0186_balance_provisions.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0185_portefeuille_credit")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
