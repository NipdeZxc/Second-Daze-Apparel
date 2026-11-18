from django.http import Http404
from django.shortcuts import redirect, render

from .catalog import MOBILE_SCREEN_BY_SLUG, MOBILE_SCREENS


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
        "mobile_screens": [
            {"slug": slug, "kind": kind, "active": slug == screen_slug}
            for slug, kind in MOBILE_SCREENS
        ],
        "rows": range(4),
        "stats": range(4),
        "fields": range(4),
        "submitted": request.method == "POST",
    }
    return render(request, "section_8_mobile/screen.html", context)
