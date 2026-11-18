from django.urls import include, path

from . import views


app_name = "mobile"

urlpatterns = [
    path("overlays/", include("overlay_screens.urls")),
    path("", views.index, name="index"),
    path("<str:screen_slug>/", views.screen, name="screen"),
]
