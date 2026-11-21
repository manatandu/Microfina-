from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0154_nantissement_materiel.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0153_ordre_prelevement")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
