from django.db import migrations


SUBJECTS = [
    ("Mathematics", "8-12", 1),
    ("Mathematical Literacy", "10-12", 2),
    ("Physical Sciences", "10-12", 3),
    ("Life Sciences", "10-12", 4),
    ("Geography", "10-12", 5),
    ("Accounting", "10-12", 6),
    ("English", "8-12", 7),
    ("Afrikaans (FAL)", "8-12", 8),
    ("Natural Sciences", "8-9", 9),
]


def add_subjects(apps, schema_editor):
    Subject = apps.get_model("enrolment", "Subject")
    for name, grade_range, order in SUBJECTS:
        Subject.objects.get_or_create(
            name=name,
            defaults={"grade_range": grade_range, "order": order, "active": True},
        )


def remove_subjects(apps, schema_editor):
    Subject = apps.get_model("enrolment", "Subject")
    Subject.objects.filter(name__in=[s[0] for s in SUBJECTS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("enrolment", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(add_subjects, remove_subjects),
    ]