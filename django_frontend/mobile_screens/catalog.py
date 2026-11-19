MOBILE_SCREENS = [
    ("8-mobile-sign-in", "mobile-login"),
    ("8.1-mobile-admin-dashboard", "mobile-dashboard"),
    ("8.2-mobile-approvals", "mobile-list"),
    ("8.3-mobile-checkout-gcash", "mobile-form"),
    ("8.4-mobile-orders", "mobile-list"),
    ("8.5-mobile-low-stock", "mobile-stock"),
    ("8.6-mobile-new-reservation", "mobile-form"),
]

MOBILE_COPY = {
    "8-mobile-sign-in": ("Sign in", "Apparel access portal"),
    "8.1-mobile-admin-dashboard": ("Dashboard", "Admin workspace"),
    "8.2-mobile-approvals": ("Approvals", "Review access, payment, refund, and reservation requests."),
    "8.3-mobile-checkout-gcash": ("Checkout", "Record GCash payment for Admin verification."),
    "8.4-mobile-orders": ("Orders", "Track customer orders and fulfillment status."),
    "8.5-mobile-low-stock": ("Low stock", "Items at or below their restock threshold."),
    "8.6-mobile-new-reservation": ("New reservation", "Prepare a hold request for Admin approval."),
}

MOBILE_SCREEN_BY_SLUG = {
    slug: {
        "slug": slug,
        "kind": kind,
        "title": MOBILE_COPY[slug][0],
        "description": MOBILE_COPY[slug][1],
    }
    for slug, kind in MOBILE_SCREENS
}

MOBILE_NAVIGATION = [
    ("8.1-mobile-admin-dashboard", "Home"),
    ("8.2-mobile-approvals", "Approvals"),
    ("8.4-mobile-orders", "Orders"),
    ("8.5-mobile-low-stock", "Reports"),
]

MOBILE_NOTIFICATION_SCREENS = {
    "8.1-mobile-admin-dashboard": "9-overlay-notifications-admin",
    "8.2-mobile-approvals": "9-overlay-notifications-admin",
    "8.3-mobile-checkout-gcash": "9.1-overlay-notifications-sales",
    "8.4-mobile-orders": "9.1-overlay-notifications-sales",
    "8.5-mobile-low-stock": "9.2-overlay-notifications-inventory",
    "8.6-mobile-new-reservation": "9-overlay-notifications-admin",
}
