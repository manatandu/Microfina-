from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0216_libelles_pcci_24.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0215_saisie_arret")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
