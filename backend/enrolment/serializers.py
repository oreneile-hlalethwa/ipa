from rest_framework import serializers
from .models import Subject, Enrolment, EnrolmentSubject, ProofOfPayment


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "grade_range", "order"]


class EnrolmentSubjectSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = EnrolmentSubject
        fields = ["subject", "subject_name", "hours"]


class EnrolmentSerializer(serializers.ModelSerializer):
    """Read view of an enrolment (learner's own list, confirmation, receipt)."""

    subject_lines = EnrolmentSubjectSerializer(many=True, read_only=True)
    total = serializers.IntegerField(read_only=True)
    has_proof = serializers.SerializerMethodField()
    package_label = serializers.SerializerMethodField()
    approved_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Enrolment
        fields = [
            "id", "package_type", "package_label", "monthly_fee", "registration_fee",
            "status", "subject_lines", "total", "has_proof", "created_at", "approved_at",
        ]

    def get_has_proof(self, obj):
        return hasattr(obj, "proof")

    def get_package_label(self, obj):
        if obj.package_type == Enrolment.TYPE_ONE_ON_ONE:
            return "One-on-One"
        n = obj.subject_lines.count()
        return "Group \u00b7 " + str(n) + (" Subject" if n == 1 else " Subjects")


class AdminEnrolmentSerializer(serializers.ModelSerializer):
    """Full enrolment detail (used inside the student folder)."""

    subject_lines = EnrolmentSubjectSerializer(many=True, read_only=True)
    total = serializers.IntegerField(read_only=True)
    package_label = serializers.SerializerMethodField()
    proof_url = serializers.SerializerMethodField()
    approved_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Enrolment
        fields = [
            "id", "package_type", "package_label", "monthly_fee", "registration_fee",
            "status", "total", "subject_lines", "proof_url", "created_at", "approved_at",
        ]

    def get_package_label(self, obj):
        if obj.package_type == Enrolment.TYPE_ONE_ON_ONE:
            return "One-on-One"
        n = obj.subject_lines.count()
        return "Group \u00b7 " + str(n) + (" Subject" if n == 1 else " Subjects")

    def get_proof_url(self, obj):
        proof = getattr(obj, "proof", None)
        if not proof or not proof.file:
            return None
        request = self.context.get("request")
        url = proof.file.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class AdminStudentSerializer(serializers.Serializer):
    """One student (learner User) with profile + all their enrolments nested."""

    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(read_only=True)
    name = serializers.SerializerMethodField()
    date_of_birth = serializers.SerializerMethodField()
    grade = serializers.SerializerMethodField()
    school = serializers.SerializerMethodField()
    province = serializers.SerializerMethodField()
    whatsapp = serializers.SerializerMethodField()
    guardian_name = serializers.SerializerMethodField()
    guardian_whatsapp = serializers.SerializerMethodField()
    guardian_email = serializers.SerializerMethodField()
    enrolments = serializers.SerializerMethodField()
    payment_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()
    approved_count = serializers.SerializerMethodField()

    def _p(self, obj):
        return getattr(obj, "learner_profile", None)

    def get_name(self, obj):
        p = self._p(obj); return p.name if p else ""
    def get_date_of_birth(self, obj):
        p = self._p(obj); return p.date_of_birth if p else None
    def get_grade(self, obj):
        p = self._p(obj); return p.grade if p else ""
    def get_school(self, obj):
        p = self._p(obj); return p.school if p else ""
    def get_province(self, obj):
        p = self._p(obj); return p.province if p else ""
    def get_whatsapp(self, obj):
        p = self._p(obj); return p.whatsapp if p else ""
    def get_guardian_name(self, obj):
        p = self._p(obj); return p.guardian_name if p else ""
    def get_guardian_whatsapp(self, obj):
        p = self._p(obj); return p.guardian_whatsapp if p else ""
    def get_guardian_email(self, obj):
        p = self._p(obj); return p.guardian_email if p else ""

    def _enrolments(self, obj):
        return list(obj.enrolments.all())

    def get_enrolments(self, obj):
        return AdminEnrolmentSerializer(
            self._enrolments(obj), many=True, context=self.context
        ).data

    def get_payment_count(self, obj):
        return len(self._enrolments(obj))

    def get_pending_count(self, obj):
        return sum(1 for e in self._enrolments(obj) if e.status == Enrolment.STATUS_PENDING)

    def get_approved_count(self, obj):
        return sum(1 for e in self._enrolments(obj) if e.status == Enrolment.STATUS_APPROVED)