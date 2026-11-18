from django.urls import path

from . import views


app_name = "mobile"

urlpatterns = [
    path("", views.index, name="index"),
    path("<str:screen_slug>/", views.screen, name="screen"),
]
