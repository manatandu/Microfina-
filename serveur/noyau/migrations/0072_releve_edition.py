from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0072_releve_edition.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0071_ouverture_compte")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
