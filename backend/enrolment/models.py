from django.conf import settings
from django.db import models


class Subject(models.Model):
    """The subjects IPA offers, seeded once."""

    name = models.CharField(max_length=100, unique=True)
    grade_range = models.CharField(max_length=20, help_text="e.g. 8-12, 10-12")
    order = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Enrolment(models.Model):
    """A learner's enrolment: package + subjects, a total, and a status."""

    TYPE_GROUP = "group"
    TYPE_ONE_ON_ONE = "oneonone"
    TYPE_CHOICES = [
        (TYPE_GROUP, "Group"),
        (TYPE_ONE_ON_ONE, "One-on-One"),
    ]

    STATUS_NO_PROOF = "noproof"
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_NO_PROOF, "No proof uploaded"),
        (STATUS_PENDING, "Pending approval"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    ONE_ON_ONE_RATE = 250       # R per hour
    REGISTRATION_FEE = 100      # once-off

    learner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrolments"
    )
    package_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    monthly_fee = models.PositiveIntegerField(null=True, blank=True)
    registration_fee = models.PositiveIntegerField(default=0)  # snapshot at submit: 100 or 0
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NO_PROOF)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_enrolments",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.learner} - {self.get_package_type_display()} ({self.status})"

    @property
    def total(self):
        """Monthly total (excludes the once-off registration fee)."""
        if self.package_type == self.TYPE_ONE_ON_ONE:
            return sum(line.hours * self.ONE_ON_ONE_RATE for line in self.subject_lines.all())
        return self.monthly_fee or 0

    @property
    def subject_count(self):
        return self.subject_lines.count()


class EnrolmentSubject(models.Model):
    """A subject chosen within an enrolment (hours matters for one-on-one)."""

    enrolment = models.ForeignKey(
        Enrolment, on_delete=models.CASCADE, related_name="subject_lines"
    )
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT)
    hours = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("enrolment", "subject")

    def __str__(self):
        return f"{self.subject.name} x{self.hours}h"

    @property
    def line_total(self):
        if self.enrolment.package_type == Enrolment.TYPE_ONE_ON_ONE:
            return self.hours * Enrolment.ONE_ON_ONE_RATE
        return None


class ProofOfPayment(models.Model):
    """Uploaded proof-of-payment file for an enrolment."""

    enrolment = models.OneToOneField(
        Enrolment, on_delete=models.CASCADE, related_name="proof"
    )
    file = models.FileField(upload_to="proofs/")
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Proof for enrolment {self.enrolment_id}"