from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0133_localite_nature.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0132_declarations_soupcon")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
