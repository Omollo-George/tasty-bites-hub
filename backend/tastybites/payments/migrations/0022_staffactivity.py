from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0021_order_waiter_metadata'),
    ]

    operations = [
        migrations.CreateModel(
            name='StaffActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=255)),
                ('details', models.JSONField(blank=True, default=dict, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('employee', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='activities', to='payments.employee')),
                ('order', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='staff_activities', to='payments.order')),
            ],
        ),
    ]
