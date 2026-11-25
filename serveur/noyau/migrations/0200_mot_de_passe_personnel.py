from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0200_mot_de_passe_personnel.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0199_recouvrement")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
