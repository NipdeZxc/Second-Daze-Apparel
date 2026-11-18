from django.shortcuts import redirect, render

from .catalog import (
    ACCESS_SCREENS,
    MAIN_NAVIGATION,
    MAIN_SCREEN_BY_SLUG,
)


def sign_in(request):
    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()
        if email == "pending@demo.local":
            return redirect("main:access-awaiting-approval")
        return redirect("main:sign-in-error")
    return render_auth(request, "sign-in")


def sign_in_error(request):
    return render_auth(request, "sign-in-error")


def access_awaiting_approval(request):
    return render_auth(request, "access-awaiting-approval")


def forgot_password(request):
    submitted = request.method == "POST"
    return render_auth(request, "forgot-password", submitted=submitted)


def render_auth(request, page, submitted=False):
    screen = ACCESS_SCREENS.get(page, {"kind": "sign-in", "error": False})
    return render(
        request,
        "section_1_7/auth.html",
        {
            "page": page,
            "screen": screen,
            "submitted": submitted,
        },
    )


def screen(request, screen_slug):
    screen_data = MAIN_SCREEN_BY_SLUG.get(screen_slug)
    if screen_data is None:
        return render(request, "section_1_7/not_found.html", status=404)
    current = {
        **screen_data,
        "template": f"section_1_7/screens/{screen_data['kind']}.html",
    }

    nav_groups = []
    for group in MAIN_NAVIGATION:
        nav_groups.append(
            {
                "label": group["label"],
                "screens": [
                    {
                        "slug": slug,
                        "active": slug == screen_slug,
                    }
                    for slug, _, _ in group["screens"]
                ],
            }
        )

    context = {
        "screen": current,
        "nav_groups": nav_groups,
        "stats": range(4 if current["kind"] not in {"form", "detail"} else 3),
        "rows": range(5),
        "table_rows": range(6),
        "table_columns": range(6),
        "chart_bars": (44, 68, 51, 82, 62, 92, 75),
        "steps": range(5),
        "fields": range(6),
        "submitted": request.method == "POST",
    }
    return render(request, "section_1_7/screen.html", context)
