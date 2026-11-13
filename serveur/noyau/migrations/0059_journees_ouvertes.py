from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0059_journees_ouvertes.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0058_professions")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
