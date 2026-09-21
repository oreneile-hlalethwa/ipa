from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import LearnerProfile

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    """Handles learner sign-up: creates a User + their LearnerProfile."""

    # account
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)

    # learner details
    name = serializers.CharField(max_length=150)
    date_of_birth = serializers.DateField()
    grade = serializers.CharField(max_length=20)
    school = serializers.CharField(max_length=200)
    province = serializers.CharField(max_length=40)
    whatsapp = serializers.CharField(max_length=30)

    # guardian details
    guardian_name = serializers.CharField(max_length=150)
    guardian_whatsapp = serializers.CharField(max_length=30)
    guardian_email = serializers.EmailField()

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["name"],
        )
        LearnerProfile.objects.create(
            user=user,
            name=validated_data["name"],
            date_of_birth=validated_data["date_of_birth"],
            grade=validated_data["grade"],
            school=validated_data["school"],
            province=validated_data["province"],
            whatsapp=validated_data["whatsapp"],
            guardian_name=validated_data["guardian_name"],
            guardian_whatsapp=validated_data["guardian_whatsapp"],
            guardian_email=validated_data["guardian_email"],
        )
        return user


class LoginSerializer(serializers.Serializer):
    """Validates email + password and authenticates the user."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        from django.contrib.auth import authenticate

        user = authenticate(
            username=data["email"].lower(),  # USERNAME_FIELD is email
            password=data["password"],
        )
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is disabled.")
        data["user"] = user
        return data


class LearnerProfileSerializer(serializers.ModelSerializer):
    """Read + update the logged-in learner's editable details."""

    email = serializers.EmailField(source="user.email", read_only=True)
    registration_paid = serializers.SerializerMethodField()

    class Meta:
        model = LearnerProfile
        fields = [
            "email", "name", "date_of_birth", "grade", "school", "province", "whatsapp",
            "guardian_name", "guardian_whatsapp", "guardian_email", "registration_paid",
        ]

    def get_registration_paid(self, obj):
        # True once the learner has any APPROVED enrolment (fee no longer applies)
        return obj.user.enrolments.filter(status="approved").exists()
        # name/date_of_birth/grade/school/province are edited from the portal's Edit info panel;
        # the rest are read-only there
        read_only_fields = ["whatsapp", "guardian_name", "guardian_whatsapp", "guardian_email"]