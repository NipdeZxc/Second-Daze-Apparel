OVERLAY_SCREENS = [
    ("9-overlay-notifications-admin", "notifications"),
    ("9.1-overlay-notifications-sales", "notifications"),
    ("9.2-overlay-notifications-inventory", "notifications"),
    ("9.3-overlay-confirm-approve", "confirm"),
]

OVERLAY_COPY = {
    "9-overlay-notifications-admin": ("Admin notifications", "Admin workspace"),
    "9.1-overlay-notifications-sales": ("Sales notifications", "Sales Management"),
    "9.2-overlay-notifications-inventory": ("Inventory notifications", "Inventory Management"),
    "9.3-overlay-confirm-approve": ("Confirm this approval?", "Review the selected access request before confirming."),
}

OVERLAY_SCREEN_BY_SLUG = {
    slug: {
        "slug": slug,
        "kind": kind,
        "title": OVERLAY_COPY[slug][0],
        "description": OVERLAY_COPY[slug][1],
    }
    for slug, kind in OVERLAY_SCREENS
}
