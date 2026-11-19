from django.http import Http404
from django.shortcuts import redirect, render

from .catalog import (
    MOBILE_NAVIGATION,
    MOBILE_NOTIFICATION_SCREENS,
    MOBILE_SCREEN_BY_SLUG,
    MOBILE_SCREENS,
)


def index(request):
    return redirect(
        "mobile:screen",
        screen_slug=MOBILE_SCREENS[0][0],
    )


def screen(request, screen_slug):
    current = MOBILE_SCREEN_BY_SLUG.get(screen_slug)
    if current is None:
        raise Http404("Mobile screen not found.")
    if request.method == "POST" and current["kind"] == "mobile-login":
        return redirect(
            "mobile:screen",
            screen_slug="8.1-mobile-admin-dashboard",
        )
    context = {
        "screen": current,
        "notification_screen": MOBILE_NOTIFICATION_SCREENS.get(screen_slug),
        "mobile_navigation": [
            {"slug": slug, "label": label, "active": slug == screen_slug}
            for slug, label in MOBILE_NAVIGATION
        ],
        "submitted": request.method == "POST",
    }
    return render(request, "section_8_mobile/screen.html", context)
