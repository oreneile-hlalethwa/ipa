import json

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Subject, Enrolment, EnrolmentSubject, ProofOfPayment
from .serializers import (
    SubjectSerializer,
    EnrolmentSerializer,
    AdminEnrolmentSerializer,
    AdminStudentSerializer,
)


class SubjectListView(APIView):
    """GET /api/subjects - the list of subjects for the portal picker."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        subjects = Subject.objects.filter(active=True)
        return Response(SubjectSerializer(subjects, many=True).data)


class EnrolmentCreateView(APIView):
    """
    POST /api/enrolments
    Multipart body: package_type, monthly_fee (group only),
    subjects (JSON string: [{"name": "...", "hours": n}, ...]),
    proof (uploaded file).
    Creates the enrolment + its subjects + proof, tied to the logged-in learner.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        package_type = request.data.get("package_type")
        if package_type not in (Enrolment.TYPE_GROUP, Enrolment.TYPE_ONE_ON_ONE):
            return Response({"detail": "Invalid package type."}, status=400)

        try:
            subjects = json.loads(request.data.get("subjects", "[]"))
        except json.JSONDecodeError:
            return Response({"detail": "Subjects must be valid JSON."}, status=400)

        if not subjects:
            return Response({"detail": "Select at least one subject."}, status=400)

        proof_file = request.FILES.get("proof")
        if not proof_file:
            return Response({"detail": "Proof of payment is required."}, status=400)

        monthly_fee = None
        if package_type == Enrolment.TYPE_GROUP:
            try:
                monthly_fee = int(request.data.get("monthly_fee", 0))
            except (TypeError, ValueError):
                return Response({"detail": "Invalid monthly fee."}, status=400)

        # registration fee is once-off: charge unless the learner already has an
        # APPROVED enrolment (pending/rejected don't count as paid yet)
        has_approved = Enrolment.objects.filter(
            learner=request.user, status=Enrolment.STATUS_APPROVED
        ).exists()
        reg_fee = 0 if has_approved else Enrolment.REGISTRATION_FEE

        # create the enrolment
        enrolment = Enrolment.objects.create(
            learner=request.user,
            package_type=package_type,
            monthly_fee=monthly_fee,
            registration_fee=reg_fee,
            status=Enrolment.STATUS_PENDING,  # proof is attached, so it's pending review
        )

        for item in subjects:
            name = item.get("name")
            hours = int(item.get("hours", 1) or 1)
            subject = Subject.objects.filter(name=name).first()
            if subject:
                EnrolmentSubject.objects.create(
                    enrolment=enrolment, subject=subject, hours=hours
                )

        ProofOfPayment.objects.create(
            enrolment=enrolment,
            file=proof_file,
            original_name=getattr(proof_file, "name", ""),
        )

        return Response(
            EnrolmentSerializer(enrolment).data, status=status.HTTP_201_CREATED
        )


class MyEnrolmentsView(APIView):
    """GET /api/my/enrolments - the logged-in learner's own submissions, newest first."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Enrolment.objects.filter(learner=request.user)
            .prefetch_related("subject_lines__subject", "proof")
            .order_by("-created_at")
        )
        return Response(EnrolmentSerializer(qs, many=True).data)


class AdminStudentsView(APIView):
    """GET /api/admin/students - one entry per learner with nested enrolments."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        learners = (
            User.objects.filter(is_staff=False, is_superuser=False)
            .select_related("learner_profile")
            .prefetch_related("enrolments__subject_lines__subject", "enrolments__proof")
        )
        grade = request.query_params.get("grade")
        if grade and grade != "all":
            learners = learners.filter(learner_profile__grade=grade)
        data = AdminStudentSerializer(learners, many=True, context={"request": request}).data
        data = [d for d in data if d.get("name")]  # only real registrations
        return Response(data)



class AdminEnrolmentListView(APIView):
    """GET /api/admin/enrolments?grade=10 - all enrolments for the dashboard."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Enrolment.objects.select_related("learner").prefetch_related(
            "subject_lines__subject", "proof"
        )
        grade = request.query_params.get("grade")
        if grade and grade != "all":
            qs = qs.filter(learner__learner_profile__grade=grade)

        data = AdminEnrolmentSerializer(qs, many=True, context={"request": request}).data
        return Response(data)


class AdminEnrolmentApproveView(APIView):
    """POST /api/admin/enrolments/<id>/approve"""

    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            enrolment = Enrolment.objects.get(pk=pk)
        except Enrolment.DoesNotExist:
            return Response({"detail": "Enrolment not found."}, status=404)

        if not hasattr(enrolment, "proof"):
            return Response(
                {"detail": "Cannot approve - no proof of payment uploaded."},
                status=400,
            )

        enrolment.status = Enrolment.STATUS_APPROVED
        enrolment.approved_by = request.user
        enrolment.approved_at = timezone.now()
        enrolment.save()
        return Response(
            AdminEnrolmentSerializer(enrolment, context={"request": request}).data
        )


class AdminEnrolmentRejectView(APIView):
    """POST /api/admin/enrolments/<id>/reject"""

    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            enrolment = Enrolment.objects.get(pk=pk)
        except Enrolment.DoesNotExist:
            return Response({"detail": "Enrolment not found."}, status=404)

        enrolment.status = Enrolment.STATUS_REJECTED
        enrolment.approved_by = None
        enrolment.approved_at = None
        enrolment.save()
        return Response(
            AdminEnrolmentSerializer(enrolment, context={"request": request}).data
        )


class AdminLearnerDeleteView(APIView):
    """DELETE /api/admin/enrolments/<id>/deregister - remove learner by enrolment id."""

    permission_classes = [IsAdminUser]

    def delete(self, request, pk):
        try:
            enrolment = Enrolment.objects.select_related("learner").get(pk=pk)
        except Enrolment.DoesNotExist:
            return Response({"detail": "Enrolment not found."}, status=404)

        learner = enrolment.learner
        if learner.is_staff or learner.is_superuser:
            return Response({"detail": "Cannot deregister an admin account."}, status=400)

        learner.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminStudentDeleteView(APIView):
    """DELETE /api/admin/students/<learner_id>/deregister - remove a whole student."""

    permission_classes = [IsAdminUser]

    def delete(self, request, pk):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            learner = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Student not found."}, status=404)
        if learner.is_staff or learner.is_superuser:
            return Response({"detail": "Cannot deregister an admin account."}, status=400)
        learner.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)