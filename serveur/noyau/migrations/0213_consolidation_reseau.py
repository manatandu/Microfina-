from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0213_consolidation_reseau.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0212_type_guichet_libre")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
