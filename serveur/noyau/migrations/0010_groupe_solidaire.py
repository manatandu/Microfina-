from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0010_groupe_solidaire.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0009_modification")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
