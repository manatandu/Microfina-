from pathlib import Path
from django.db import migrations

SQL = (Path(__file__).resolve().parent.parent / "sql" / "0170_utilisateur_activation.sql").read_text(encoding="utf-8")


class Migration(migrations.Migration):
    dependencies = [("noyau", "0169_sortie_cession")]
    operations = [migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop)]
