from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0040_parametrage_epargne.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0039_produit_epargne")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
