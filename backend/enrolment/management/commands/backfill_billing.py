from django.core.management.base import BaseCommand
from django.utils import timezone

from enrolment.models import Enrolment, LearnerBilling


class Command(BaseCommand):
    help = "Create billing records for learners who enrolled before billing existed."

    def handle(self, *args, **options):
        created = skipped = 0
        learner_ids = (
            Enrolment.objects.filter(learner__is_staff=False)
            .values_list("learner_id", flat=True)
            .distinct()
        )
        for learner_id in learner_ids:
            latest = (
                Enrolment.objects.filter(learner_id=learner_id)
                .order_by("-created_at")
                .first()
            )
            billing, _ = LearnerBilling.objects.get_or_create(learner_id=learner_id)
            if billing.cycle_day is not None:
                skipped += 1          # already set up, leave it alone
                continue
            billing.cycle_day = timezone.localtime(latest.created_at).day
            billing.last_paid_at = latest.created_at
            billing.save()
            created += 1
        self.stdout.write(self.style.SUCCESS(f"Set up {created} learner(s), skipped {skipped}."))