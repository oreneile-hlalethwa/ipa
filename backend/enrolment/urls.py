from django.urls import path
from .views import (
    SubjectListView,
    EnrolmentCreateView,
    MyEnrolmentsView,
    AdminStudentsView,
    AdminStudentDeleteView,
    AdminEnrolmentListView,
    AdminEnrolmentApproveView,
    AdminEnrolmentRejectView,
    AdminLearnerDeleteView,
    OptOutView,
    RunBillingView,
)

urlpatterns = [
    path("subjects", SubjectListView.as_view(), name="subjects"),
    path("enrolments", EnrolmentCreateView.as_view(), name="enrolments"),
    path("my/enrolments", MyEnrolmentsView.as_view(), name="my-enrolments"),

    # admin
    path("admin/students", AdminStudentsView.as_view(), name="admin-students"),
    path("admin/students/<int:pk>/deregister", AdminStudentDeleteView.as_view(), name="admin-student-deregister"),
    path("admin/enrolments", AdminEnrolmentListView.as_view(), name="admin-enrolments"),
    path("admin/enrolments/<int:pk>/approve", AdminEnrolmentApproveView.as_view(), name="admin-approve"),
    path("admin/enrolments/<int:pk>/reject", AdminEnrolmentRejectView.as_view(), name="admin-reject"),
    path("admin/enrolments/<int:pk>/deregister", AdminLearnerDeleteView.as_view(), name="admin-deregister"),

    # billing (public: email opt-out link + daily cron trigger)
    path("billing/optout/<str:token>", OptOutView.as_view(), name="billing-optout"),
    path("billing/run", RunBillingView.as_view(), name="billing-run"),
]