from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('payments', '0027_repair_admin_auth_tables'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='mpesa_receipt',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
    ]
