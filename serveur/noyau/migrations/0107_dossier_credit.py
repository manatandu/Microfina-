from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0107_dossier_credit.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0106_analyse_financiere")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
