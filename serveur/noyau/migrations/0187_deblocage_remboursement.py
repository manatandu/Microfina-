from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0187_deblocage_remboursement.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0186_balance_provisions")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
