from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0206_mots_de_passe.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0205_impression")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
