from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0070_banque_institution_complements.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0069_emprunt")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
