from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0197_chef_comptable.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0196_operations_differees")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
