from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0164_appel_credit.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0163_faitiere_affiliation")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
