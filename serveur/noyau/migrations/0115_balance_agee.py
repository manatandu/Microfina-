from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0115_balance_agee.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0114_liste_rouge")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
