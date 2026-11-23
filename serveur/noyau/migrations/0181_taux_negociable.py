from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0181_taux_negociable.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0180_part_effet")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
