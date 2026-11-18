OVERLAY_SCREENS = [
    ("9-overlay-notifications-admin", "notifications"),
    ("9.1-overlay-notifications-sales", "notifications"),
    ("9.2-overlay-notifications-inventory", "notifications"),
    ("9.3-overlay-confirm-approve", "confirm"),
]

OVERLAY_SCREEN_BY_SLUG = {
    slug: {"slug": slug, "kind": kind}
    for slug, kind in OVERLAY_SCREENS
}
