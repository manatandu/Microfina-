from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0120_referentiels_compta.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0119_credits_litigieux")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
