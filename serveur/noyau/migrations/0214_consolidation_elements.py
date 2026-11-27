from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0214_consolidation_elements.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0213_consolidation_reseau")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
