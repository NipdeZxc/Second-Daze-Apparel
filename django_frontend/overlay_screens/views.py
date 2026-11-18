from django.http import Http404
from django.shortcuts import redirect, render

from .catalog import OVERLAY_SCREEN_BY_SLUG, OVERLAY_SCREENS


def index(request):
    return redirect(
        "overlays:screen",
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
        },
    )
