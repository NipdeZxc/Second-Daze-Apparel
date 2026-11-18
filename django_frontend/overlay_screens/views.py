from django.http import Http404
from django.shortcuts import redirect, render

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
    return render(
        request,
        "section_9_overlays/screen.html",
        {
            "screen": current,
            "is_confirmation": current["kind"] == "confirm",
            "return_screen": MOBILE_RETURN_SCREENS[screen_slug],
        },
    )
