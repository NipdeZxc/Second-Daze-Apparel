MOBILE_SCREENS = [
    ("8-mobile-sign-in", "mobile-login"),
    ("8.1-mobile-admin-dashboard", "mobile-dashboard"),
    ("8.2-mobile-approvals", "mobile-list"),
    ("8.3-mobile-checkout-gcash", "mobile-form"),
    ("8.4-mobile-orders", "mobile-list"),
    ("8.5-mobile-low-stock", "mobile-stock"),
    ("8.6-mobile-new-reservation", "mobile-form"),
]

MOBILE_SCREEN_BY_SLUG = {
    slug: {"slug": slug, "kind": kind}
    for slug, kind in MOBILE_SCREENS
}
