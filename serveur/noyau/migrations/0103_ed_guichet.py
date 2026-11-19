from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0103_ed_guichet.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0102_rapports_epargne")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
