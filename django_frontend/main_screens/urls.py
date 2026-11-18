from django.urls import path

from . import views


app_name = "main"

urlpatterns = [
    path("", views.sign_in, name="sign-in"),
    path("1.1-sign-in-error/", views.sign_in_error, name="sign-in-error"),
    path(
        "1.2-access-awaiting-approval/",
        views.access_awaiting_approval,
        name="access-awaiting-approval",
    ),
    path("1.3-forgot-password/", views.forgot_password, name="forgot-password"),
    path("<str:screen_slug>/", views.screen, name="screen"),
]
