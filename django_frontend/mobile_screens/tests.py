from django.test import TestCase
from django.urls import reverse

from .catalog import MOBILE_SCREENS


class MobileScreenTests(TestCase):
    def test_mobile_routes_render_in_their_own_namespace(self):
        for slug, _ in MOBILE_SCREENS:
            with self.subTest(slug=slug):
                response = self.client.get(
                    reverse("mobile:screen", kwargs={"screen_slug": slug})
                )
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, "mobile-app")
                self.assertNotContains(response, 'href="/1.3-forgot-password/')
                if slug == "8.1-mobile-admin-dashboard":
                    self.assertContains(response, 'href="/mobile/overlays/9-overlay-notifications-admin/')
                if slug == "8.4-mobile-orders":
                    self.assertContains(response, 'href="/mobile/overlays/9.1-overlay-notifications-sales/')
                if slug == "8.5-mobile-low-stock":
                    self.assertContains(response, 'href="/mobile/overlays/9.2-overlay-notifications-inventory/')
                self.assertNotContains(response, 'href="/overlays/')

    def test_mobile_root_redirects_to_mobile_sign_in(self):
        response = self.client.get(reverse("mobile:index"))

        self.assertRedirects(
            response,
            reverse(
                "mobile:screen",
                kwargs={"screen_slug": "8-mobile-sign-in"},
            ),
        )

    def test_mobile_companion_opens_role_relevant_notifications(self):
        response = self.client.get(
            reverse(
                "mobile:screen",
                kwargs={"screen_slug": "8.1-mobile-admin-dashboard"},
            )
        )

        self.assertContains(response, 'href="/mobile/overlays/9-overlay-notifications-admin/')

    def test_mobile_demo_sign_in_stays_in_mobile_app(self):
        response = self.client.post(
            reverse(
                "mobile:screen",
                kwargs={"screen_slug": "8-mobile-sign-in"},
            ),
            {"username": "admin", "password": "admin"},
        )

        self.assertRedirects(
            response,
            reverse(
                "mobile:screen",
                kwargs={"screen_slug": "8.1-mobile-admin-dashboard"},
            ),
        )

    def test_mobile_sign_in_rejects_other_credentials(self):
        response = self.client.post(
            reverse(
                "mobile:screen",
                kwargs={"screen_slug": "8-mobile-sign-in"},
            ),
            {"username": "admin", "password": "wrong"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Username or password was not recognized.")

    def test_mobile_dashboard_shows_work_queues_and_actions(self):
        response = self.client.get(
            reverse(
                "mobile:screen",
                kwargs={"screen_slug": "8.1-mobile-admin-dashboard"},
            )
        )

        self.assertContains(response, "Needs attention")
        self.assertContains(response, "Quick actions")
        self.assertContains(response, "Request reservation")
        self.assertNotContains(response, "Good morning")

    def test_mobile_form_shows_local_confirmation(self):
        route = reverse(
            "mobile:screen",
            kwargs={"screen_slug": "8.3-mobile-checkout-gcash"},
        )
        response = self.client.get(route)
        self.assertNotContains(response, '<div class="notice-box">')

        response = self.client.post(
            route,
            {"placeholder": "placeholder"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div class="notice-box">')

    def test_unknown_mobile_screen_returns_not_found(self):
        response = self.client.get("/mobile/2-admin-dashboard/")

        self.assertEqual(response.status_code, 404)
