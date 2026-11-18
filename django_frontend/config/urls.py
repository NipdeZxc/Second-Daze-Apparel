from django.urls import include, path


urlpatterns = [
    path("mobile/", include("mobile_screens.urls")),
    path("", include("main_screens.urls")),
]
