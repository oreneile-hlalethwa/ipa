from datetime import date

from django.core.management.base import BaseCommand

from enrolment.billing import process_billing


class Command(BaseCommand):
    help = "Send payment reminders, apply late fees and disable unpaid learners."

    def add_arguments(self, parser):
        parser.add_argument("--date", help="Pretend today is YYYY-MM-DD (for testing).")
        parser.add_argument("--dry-run", action="store_true", help="Show what would happen, change nothing.")

    def handle(self, *args, **options):
        today = date.fromisoformat(options["date"]) if options["date"] else None
        r = process_billing(today=today, dry_run=options["dry_run"])
        self.stdout.write(f"Billing run for {r['date']}{' (DRY RUN)' if r['dry_run'] else ''}")
        for key in ("reminders", "late_fees", "disabled", "errors"):
            self.stdout.write(f"  {key}: {len(r[key])} {r[key] if r[key] else ''}")