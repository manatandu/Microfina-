from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0149_exclusion.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0148_objet_souscription")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
