"""Monthly billing rules: reminder, late fee, auto-disable."""
import calendar
import logging
from datetime import date, timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

from .models import LearnerBilling

log = logging.getLogger(__name__)

REMINDER_DAYS_BEFORE = 3
LATE_FEE_DAYS_AFTER = 3
DISABLE_DAYS_AFTER = 7


def due_date_for(year, month, cycle_day):
    """Cycle day in a given month; days 29-31 fall back to the month's last day."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(cycle_day, last_day))


def next_due_date(billing):
    """The due date in the month after the learner's last payment."""
    paid = timezone.localtime(billing.last_paid_at).date()
    year, month = (paid.year + 1, 1) if paid.month == 12 else (paid.year, paid.month + 1)
    return due_date_for(year, month, billing.cycle_day)


def fmt(d):
    return f"{d.day} {d:%B %Y}"


def reminder_recipients(billing, profile):
    """Guardian + learner email (login), without duplicates or blanks."""
    recipients = []
    for address in (profile.guardian_email, billing.learner.email):
        if address and address.lower() not in [r.lower() for r in recipients]:
            recipients.append(address)
    return recipients


def send_reminder(billing, due):
    """Email the guardian and the learner. Returns False if there's nobody to email."""
    profile = getattr(billing.learner, "learner_profile", None)
    if profile is None:
        return False
    recipients = reminder_recipients(billing, profile)
    if not recipients:
        return False

    late_from = due + timedelta(days=LATE_FEE_DAYS_AFTER)
    optout_url = f"{settings.FRONTEND_URL}/user/optout.html?token={billing.optout_token}"
    portal_url = f"{settings.FRONTEND_URL}/user/loginregistration.html#login"

    context = {
        "guardian_name": profile.guardian_name,
        "learner_name": profile.name,
        "due_text": fmt(due),
        "late_from_text": fmt(late_from),
        "late_fee": settings.LATE_FEE,
        "optout_url": optout_url,
        "portal_url": portal_url,
        "logo_url": f"{settings.FRONTEND_URL}/user/images/logo.png",
    }

    subject = f"Payment reminder for {profile.name} - due {fmt(due)}"

    # plain-text version (shown by email apps that can't display HTML)
    text_body = (
        f"Dear {profile.guardian_name} and {profile.name},\n\n"
        f"This is a friendly reminder that {profile.name}'s monthly payment for "
        f"Ignite Potential Academy is due on {fmt(due)}.\n\n"
        f"Please pay by EFT (ABSA, Mr L Chivambo, account 4124 9754 48, reference: {profile.name}) "
        f"then log in to the learner portal, choose this month's package and upload "
        f"your proof of payment:\n{portal_url}\n\n"
        f"If payment is not received by {fmt(late_from)}, a late fee of "
        f"R{settings.LATE_FEE} will be added.\n\n"
        f"Not continuing next month? Let us know here and you won't receive further "
        f"reminders or be charged a late fee:\n{optout_url}\n\n"
        f"Kind regards,\nIgnite Potential Academy"
    )
    html_body = render_to_string("enrolment/emails/payment_reminder.html", context)

    send_mail(
        subject, text_body, settings.DEFAULT_FROM_EMAIL, recipients,
        html_message=html_body,
    )
    return True


def process_billing(today=None, dry_run=False):
    """
    Run all billing rules for one day. Safe to run several times a day:
    the *_for markers stop any action from repeating for the same due date.
    """
    today = today or timezone.localdate()
    report = {
        "date": today.isoformat(), "dry_run": dry_run,
        "reminders": [], "late_fees": [], "disabled": [], "errors": [],
    }

    learners = LearnerBilling.objects.filter(
        status=LearnerBilling.STATUS_ACTIVE,
        cycle_day__isnull=False,
        last_paid_at__isnull=False,
    ).select_related("learner", "learner__learner_profile")

    for b in learners:
        due = next_due_date(b)
        who = b.learner.email
        changed = []

        # 1. reminder: from 3 days before up to the due date, once per due date
        if due - timedelta(days=REMINDER_DAYS_BEFORE) <= today <= due and b.reminder_sent_for != due:
            if dry_run:
                report["reminders"].append(who)
            else:
                try:
                    if send_reminder(b, due):
                        b.reminder_sent_for = due
                        changed.append("reminder_sent_for")
                        report["reminders"].append(who)
                    else:
                        report["errors"].append(f"{who}: no email address")
                except Exception as exc:   # don't let one bad email stop the run
                    log.exception("Reminder failed for %s", who)
                    report["errors"].append(f"{who}: {exc}")

        # 2. late fee: 3+ days after the due date, once per due date
        if today >= due + timedelta(days=LATE_FEE_DAYS_AFTER) and b.late_fee_applied_for != due:
            b.late_fee_owed = settings.LATE_FEE
            b.late_fee_applied_for = due
            changed += ["late_fee_owed", "late_fee_applied_for"]
            report["late_fees"].append(who)

        # 3. disable: 7+ days after the due date (late fee stays owed)
        if today >= due + timedelta(days=DISABLE_DAYS_AFTER):
            b.status = LearnerBilling.STATUS_DISABLED
            b.status_changed_at = timezone.now()
            changed += ["status", "status_changed_at"]
            report["disabled"].append(who)

        if changed and not dry_run:
            b.save(update_fields=changed + ["updated_at"])

    return report