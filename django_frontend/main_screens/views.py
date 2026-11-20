from django.shortcuts import redirect, render
from django.urls import reverse

from mobile_screens.catalog import MOBILE_COPY, MOBILE_SCREENS
from overlay_screens.catalog import OVERLAY_COPY, OVERLAY_SCREENS
from .catalog import (
    ACCESS_SCREENS,
    MAIN_SCREENS,
    MAIN_NAVIGATION,
    MAIN_SCREEN_BY_SLUG,
    SCREEN_COLUMNS,
    SCREEN_FIELDS,
)


def sign_in(request):
    if request.method == "POST":
        username = request.POST.get("username", "").strip().lower()
        password = request.POST.get("password", "")
        if username == "admin" and password == "admin":
            return redirect(
                "main:screen",
                screen_slug="2-admin-dashboard",
            )
        if username == "pending@demo.local" and password:
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


def screen_directory(request):
    groups = [
        {
            "title": "Account access",
            "screens": [
                {"number": "1", "label": "Staff sign-in", "url": reverse("main:sign-in")},
                {"number": "1.1", "label": "Sign-in error", "url": reverse("main:sign-in-error")},
                {"number": "1.2", "label": "Access awaiting approval", "url": reverse("main:access-awaiting-approval")},
                {"number": "1.3", "label": "Forgot password", "url": reverse("main:forgot-password")},
            ],
        },
        {
            "title": "Main system · Sections 1–7",
            "screens": [
                {
                    "number": slug.split("-")[0],
                    "label": MAIN_SCREEN_BY_SLUG[slug]["title"],
                    "url": reverse("main:screen", kwargs={"screen_slug": slug}),
                }
                for slug, _, _ in MAIN_SCREENS
            ],
        },
        {
            "title": "Mobile companion · Section 8",
            "screens": [
                {
                    "number": slug.split("-")[0],
                    "label": MOBILE_COPY[slug][0],
                    "url": reverse("mobile:screen", kwargs={"screen_slug": slug}),
                }
                for slug, _ in MOBILE_SCREENS
            ],
        },
        {
            "title": "Mobile overlays · Section 9",
            "screens": [
                {
                    "number": slug.split("-")[0],
                    "label": OVERLAY_COPY[slug][0],
                    "url": reverse(
                        "mobile:overlays:screen",
                        kwargs={"screen_slug": slug},
                    ),
                }
                for slug, _ in OVERLAY_SCREENS
            ],
        },
    ]
    return render(request, "screen_directory.html", {"directory_groups": groups})


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
                        "label": MAIN_SCREEN_BY_SLUG[slug]["label"],
                    }
                    for slug, _, _ in group["screens"]
                ],
            }
        )

    fields = SCREEN_FIELDS.get(
        screen_slug,
        ("Name", "Reference", "Status", "Date", "Notes"),
    )
    screen_copy = {
        "2-admin-dashboard": ("Gross sales", "Total cost", "Profit", "Orders placed"),
        "2.6-reports": ("Gross sales", "Total cost", "Profit", "Orders placed"),
        "6-sales-inventory-reports": ("Total sales", "Total cost", "Total profit", "Profit margin"),
        "6.1-sales-inventory-reports-v2": ("Revenue", "Cost", "Profit", "Margin"),
    }
    metric_labels = screen_copy.get(screen_slug, ())
    columns = SCREEN_COLUMNS.get(screen_slug, ("Record", "Reference", "Status", "Updated", "Action"))
    action_labels = {
        "2.1-subaccounts": "Create subaccount",
        "2.3-sales-documents": "Create sales document",
        "2.5-reservations": "Create reservation",
        "3-sales-catalog": "View orders",
        "3.3-sales-documents": "Create document",
        "3.11-customers": "New customer",
        "3.13-create-purchase-order": "Submit for approval",
        "4-inventory-workspace": "Add item",
        "4.2-low-stock-alerts": "Record restock",
        "5-reservations": "New reservation",
        "7-staff-accounts": "Create subaccount",
    }

    context = {
        "screen": current,
        "nav_groups": nav_groups,
        "metric_labels": metric_labels,
        "columns": columns,
        "fields": fields,
        "records_label": current["title"].lower(),
        "action_label": action_labels.get(screen_slug, ""),
        "submitted": request.method == "POST",
    }
    return render(request, "section_1_7/screen.html", context)
