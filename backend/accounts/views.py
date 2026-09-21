from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import RegisterSerializer, LoginSerializer, LearnerProfileSerializer


class RegisterView(APIView):
    """POST /api/auth/register - create a learner account, return a token."""

    permission_classes = [AllowAny]  # anyone can register

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "email": user.email,
                "name": user.full_name,
            },
            status=status.HTTP_201_CREATED,
        )

    

class LoginView(APIView):
    """POST /api/auth/login - email + password, returns a token."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "email": user.email,
                "name": user.full_name,
                "is_admin": user.is_staff,
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    """GET/PATCH /api/me - the logged-in learner's own profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "learner_profile", None)
        if profile is None:
            return Response(
                {"detail": "No learner profile for this account."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(LearnerProfileSerializer(profile).data)

    def patch(self, request):
        profile = getattr(request.user, "learner_profile", None)
        if profile is None:
            return Response(
                {"detail": "No learner profile for this account."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = LearnerProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)