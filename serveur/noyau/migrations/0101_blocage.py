from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0101_blocage.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0100_cloture_compte")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
