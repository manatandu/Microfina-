from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0184_parcours_credit.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0183_virement_entre_comptes")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
