from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0067_droit_s59_chef.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0066_cheque_client")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
