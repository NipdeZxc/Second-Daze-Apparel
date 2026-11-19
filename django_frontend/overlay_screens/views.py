from django.http import Http404
from django.shortcuts import redirect, render

from mobile_screens.catalog import (
    MOBILE_NAVIGATION,
    MOBILE_NOTIFICATION_SCREENS,
    MOBILE_SCREEN_BY_SLUG,
)
from .catalog import OVERLAY_SCREEN_BY_SLUG, OVERLAY_SCREENS

MOBILE_RETURN_SCREENS = {
    "9-overlay-notifications-admin": "8.1-mobile-admin-dashboard",
    "9.1-overlay-notifications-sales": "8.4-mobile-orders",
    "9.2-overlay-notifications-inventory": "8.5-mobile-low-stock",
    "9.3-overlay-confirm-approve": "8.2-mobile-approvals",
}


def index(request):
    return redirect(
        "mobile:overlays:screen",
        screen_slug=OVERLAY_SCREENS[0][0],
    )


def screen(request, screen_slug):
    current = OVERLAY_SCREEN_BY_SLUG.get(screen_slug)
    if current is None:
        raise Http404("Overlay screen not found.")
    return_screen = MOBILE_RETURN_SCREENS[screen_slug]
    return render(
        request,
        "section_9_overlays/screen.html",
        {
            "screen": current,
            "is_confirmation": current["kind"] == "confirm",
            "return_screen": return_screen,
            "underlay_screen": MOBILE_SCREEN_BY_SLUG[return_screen],
            "notification_screen": MOBILE_NOTIFICATION_SCREENS[return_screen],
            "mobile_navigation": [
                {"slug": slug, "label": label, "active": slug == return_screen}
                for slug, label in MOBILE_NAVIGATION
            ],
            "submitted": request.method == "POST" and current["kind"] == "confirm",
        },
    )
