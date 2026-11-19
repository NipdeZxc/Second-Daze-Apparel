from django.test import TestCase
from django.urls import reverse

from .catalog import MAIN_SCREENS


class MainScreenTests(TestCase):
    def test_all_section_one_to_seven_screens_render(self):
        routes = [reverse("main:sign-in")]
        routes.extend(
            reverse("main:screen", kwargs={"screen_slug": slug})
            for slug, _, _ in MAIN_SCREENS
        )
        routes.extend(
            [
                reverse("main:sign-in-error"),
                reverse("main:access-awaiting-approval"),
                reverse("main:forgot-password"),
            ]
        )

        for route in routes:
            with self.subTest(route=route):
                response = self.client.get(route)
                self.assertEqual(response.status_code, 200)

    def test_demo_sign_in_routes_to_pending_screen(self):
        response = self.client.post(
            reverse("main:sign-in"),
            {"email": "pending@demo.local", "password": "placeholder"},
        )

        self.assertRedirects(response, reverse("main:access-awaiting-approval"))

    def test_other_sign_in_routes_to_error_screen(self):
        response = self.client.post(
            reverse("main:sign-in"),
            {"email": "placeholder@example.com", "password": "placeholder"},
        )

        self.assertRedirects(response, reverse("main:sign-in-error"))

    def test_password_reset_displays_local_confirmation(self):
        response = self.client.get(reverse("main:forgot-password"))
        self.assertNotContains(response, '<div class="notice-box">')

        response = self.client.post(
            reverse("main:forgot-password"),
            {"email": "placeholder@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div class="notice-box">')

    def test_mobile_routes_are_not_in_main_screen_app(self):
        response = self.client.get("/8-mobile-sign-in/")

        self.assertEqual(response.status_code, 404)

    def test_main_navigation_does_not_link_to_mobile_or_overlay_apps(self):
        response = self.client.get(
            reverse("main:screen", kwargs={"screen_slug": "2-admin-dashboard"})
        )

        self.assertNotContains(response, 'href="/mobile/')
        self.assertNotContains(response, 'href="/mobile/overlays/')
        self.assertNotContains(response, 'href="/overlays/')

    def test_dashboard_links_to_operational_queues_and_common_actions(self):
        response = self.client.get(
            reverse("main:screen", kwargs={"screen_slug": "2-admin-dashboard"})
        )

        self.assertContains(response, "Quick actions")
        self.assertContains(response, "Work queues")
        self.assertContains(
            response,
            f'href="{reverse("main:screen", kwargs={"screen_slug": "2.2-access-approvals"})}"',
        )
        self.assertContains(response, "Queue data will appear when connected.")
        self.assertNotContains(response, "Sales overview")
