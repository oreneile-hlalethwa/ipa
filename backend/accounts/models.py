from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Manager for a User that logs in with email instead of username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom user: logs in with email.
    Admins/owners are superusers created in the backend.
    Learners are ordinary users (they'll get a LearnerProfile next).
    """

    username = None
    email = models.EmailField("email address", unique=True)
    full_name = models.CharField(max_length=150, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # only email + password required

    objects = UserManager()

    def __str__(self):
        return self.email



class LearnerProfile(models.Model):
    """Learner details, editable from the portal's 'Edit info' panel."""

    GRADE_CHOICES = [
        ("8", "Grade 8"),
        ("9", "Grade 9"),
        ("10", "Grade 10"),
        ("11", "Grade 11"),
        ("12", "Grade 12"),
        ("matric-rewrite", "Matric Rewrite"),
    ]

    PROVINCE_CHOICES = [
        ("Eastern Cape", "Eastern Cape"),
        ("Free State", "Free State"),
        ("Gauteng", "Gauteng"),
        ("KwaZulu-Natal", "KwaZulu-Natal"),
        ("Limpopo", "Limpopo"),
        ("Mpumalanga", "Mpumalanga"),
        ("Northern Cape", "Northern Cape"),
        ("North West", "North West"),
        ("Western Cape", "Western Cape"),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="learner_profile"
    )

    # learner details
    name = models.CharField(max_length=150)
    date_of_birth = models.DateField(null=True, blank=True)
    grade = models.CharField(max_length=20, choices=GRADE_CHOICES)
    school = models.CharField(max_length=200)
    province = models.CharField(max_length=40, choices=PROVINCE_CHOICES)
    whatsapp = models.CharField(max_length=30)

    # guardian details
    guardian_name = models.CharField(max_length=150)
    guardian_whatsapp = models.CharField(max_length=30)
    guardian_email = models.EmailField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.grade})"