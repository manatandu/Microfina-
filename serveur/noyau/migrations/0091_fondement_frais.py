from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0091_fondement_frais.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0090_registre_membres")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
