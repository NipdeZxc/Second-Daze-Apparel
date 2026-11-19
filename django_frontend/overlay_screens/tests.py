from django.test import TestCase
from django.urls import reverse

from .catalog import OVERLAY_SCREENS


class OverlayScreenTests(TestCase):
    def test_overlay_screens_render_in_their_own_namespace(self):
        for slug, _ in OVERLAY_SCREENS:
            with self.subTest(slug=slug):
                response = self.client.get(
                    reverse(
                        "mobile:overlays:screen",
                        kwargs={"screen_slug": slug},
                    )
                )
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, 'role="dialog"')
                self.assertNotContains(response, 'href="/2-admin-dashboard/')
                self.assertContains(response, 'href="/mobile/')

    def test_overlay_root_redirects_to_notifications(self):
        response = self.client.get(reverse("mobile:overlays:index"))

        self.assertRedirects(
            response,
            reverse(
                "mobile:overlays:screen",
                kwargs={"screen_slug": "9-overlay-notifications-admin"},
            ),
        )

    def test_overlay_root_is_nested_under_mobile_companion(self):
        self.assertEqual(reverse("mobile:overlays:index"), "/mobile/overlays/")

    def test_unknown_overlay_screen_returns_not_found(self):
        response = self.client.get("/mobile/overlays/2-admin-dashboard/")

        self.assertEqual(response.status_code, 404)

    def test_overlay_close_returns_to_mobile_companion(self):
        response = self.client.get(
            reverse(
                "mobile:overlays:screen",
                kwargs={"screen_slug": "9.1-overlay-notifications-sales"},
            )
        )

        self.assertContains(response, 'href="/mobile/8.4-mobile-orders/"')

    def test_overlay_renders_over_its_mobile_workflow(self):
        response = self.client.get(
            reverse(
                "mobile:overlays:screen",
                kwargs={"screen_slug": "9.3-overlay-confirm-approve"},
            )
        )

        self.assertContains(response, "mobile-app--underlay")
        self.assertContains(response, "Approval queue")
        self.assertContains(response, 'aria-modal="true"')
        self.assertNotContains(response, "The requester is notified")

    def test_confirmation_does_not_claim_to_save_an_approval(self):
        response = self.client.post(
            reverse(
                "mobile:overlays:screen",
                kwargs={"screen_slug": "9.3-overlay-confirm-approve"},
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "No approval was saved")
