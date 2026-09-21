from django.contrib import admin
from .models import Subject, Enrolment, EnrolmentSubject, ProofOfPayment


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name", "grade_range", "order", "active")
    list_editable = ("order", "active")


class EnrolmentSubjectInline(admin.TabularInline):
    """Show the chosen subjects inside the enrolment page."""
    model = EnrolmentSubject
    extra = 0


class ProofOfPaymentInline(admin.StackedInline):
    """Show the uploaded proof inside the enrolment page."""
    model = ProofOfPayment
    extra = 0


@admin.register(Enrolment)
class EnrolmentAdmin(admin.ModelAdmin):
    list_display = ("learner", "package_type", "status", "total", "created_at")
    list_filter = ("status", "package_type")
    search_fields = ("learner__email",)
    inlines = [EnrolmentSubjectInline, ProofOfPaymentInline]


@admin.register(ProofOfPayment)
class ProofOfPaymentAdmin(admin.ModelAdmin):
    list_display = ("enrolment", "original_name", "uploaded_at")