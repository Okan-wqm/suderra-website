"""
Test suite for the Suderra website.

Covers routing/i18n, security headers + CSP nonce, the AJAX contact and
newsletter endpoints (bot protection, validation, rate limiting, email),
Cloudflare-aware client IP resolution, geo-language detection, the admin
CSV export action, and the redesigned homepage.

Run:  python manage.py test
Email is captured in-memory by Django's test runner — no real mail is sent.
"""
import time

from django.test import TestCase, Client, RequestFactory, override_settings
from django.urls import reverse
from django.core import mail
from django.core.cache import cache

from webapp.models import NewsletterSubscriber
from webapp import views


# Test-safe overrides: no HTTPS redirect, isolated in-memory cache for rate limits.
TEST_SETTINGS = dict(
    SECURE_SSL_REDIRECT=False,
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    CLOUDFLARE_IP_RANGES=['104.16.0.0/13', '2400:cb00::/32'],
)


@override_settings(**TEST_SETTINGS)
class RoutingI18nTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_root_redirects_to_default_language(self):
        r = self.client.get('/')
        self.assertEqual(r.status_code, 302)
        self.assertEqual(r['Location'], '/en/')

    def test_homepage_all_languages(self):
        for lang in ('en', 'no', 'tr', 'ar'):
            with self.subTest(lang=lang):
                self.assertEqual(self.client.get(f'/{lang}/').status_code, 200)

    def test_feature_pages_all_languages(self):
        slugs = ['aquaculture-software', 'regulatory-compliance', 'automation', 'soilless-culture', 'waste-water']
        for lang in ('en', 'no', 'tr', 'ar'):
            for slug in slugs:
                with self.subTest(lang=lang, slug=slug):
                    self.assertEqual(self.client.get(f'/{lang}/{slug}/').status_code, 200)

    def test_sitemap(self):
        r = self.client.get('/sitemap.xml')
        self.assertEqual(r.status_code, 200)
        self.assertIn(b'aquaculture-software', r.content)

    def test_robots(self):
        r = self.client.get('/robots.txt')
        self.assertEqual(r.status_code, 200)
        self.assertIn(b'Disallow: /suderradmin/', r.content)

    def test_404(self):
        self.assertEqual(self.client.get('/en/does-not-exist/').status_code, 404)

    def test_admin_requires_login(self):
        r = self.client.get('/suderradmin/')
        self.assertEqual(r.status_code, 302)
        self.assertIn('/login', r['Location'])

    def test_arabic_is_rtl(self):
        html = self.client.get('/ar/').content.decode()
        self.assertIn('dir="rtl"', html)


@override_settings(**TEST_SETTINGS)
class SecurityHeaderTests(TestCase):
    def test_security_headers_present(self):
        r = self.client.get('/en/')
        self.assertIn('Content-Security-Policy', r)
        self.assertEqual(r['X-Frame-Options'], 'DENY')
        self.assertEqual(r['X-Content-Type-Options'], 'nosniff')
        self.assertIn('Permissions-Policy', r)
        self.assertIn('strict-origin', r['Referrer-Policy'])

    def test_csp_uses_nonce_not_unsafe_inline_scripts(self):
        csp = self.client.get('/en/')['Content-Security-Policy']
        self.assertIn("'nonce-", csp)
        script_src = [d for d in csp.split(';') if d.strip().startswith('script-src')][0]
        self.assertNotIn("'unsafe-inline'", script_src)

    def test_nonce_is_per_request(self):
        a = self.client.get('/en/')['Content-Security-Policy']
        b = self.client.get('/en/')['Content-Security-Policy']
        self.assertNotEqual(a, b)

    def test_inline_scripts_carry_matching_nonce(self):
        import re
        r = self.client.get('/en/')
        nonce = re.search(r"'nonce-([\w-]+)'", r['Content-Security-Policy']).group(1)
        html = r.content.decode()
        inline = [s for s in re.findall(r'<script\b[^>]*>', html) if 'src=' not in s]
        self.assertTrue(inline)
        for tag in inline:
            self.assertIn('nonce="%s"' % nonce, tag)


@override_settings(**TEST_SETTINGS)
class ContactFormTests(TestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse('ajax_contact')

    def _human_session(self):
        """A client whose form timestamp is old enough to pass the bot timing check."""
        self.client.get('/en/')  # sets session _form_ts
        s = self.client.session
        s['_form_ts'] = int(time.time()) - 10
        s.save()

    def _payload(self, **kw):
        data = {'name': 'Ada', 'company': 'Acme', 'email': 'ada@example.com', 'message': 'Hello there team'}
        data.update(kw)
        return data

    def test_get_not_allowed(self):
        self.assertEqual(self.client.get(self.url).status_code, 405)

    def test_csrf_required(self):
        c = Client(enforce_csrf_checks=True)
        c.get('/en/')
        self.assertEqual(c.post(self.url, self._payload()).status_code, 403)

    def test_honeypot_silently_succeeds_without_email(self):
        self._human_session()
        mail.outbox.clear()
        r = self.client.post(self.url, self._payload(company_url='http://spam'))
        self.assertEqual(r.json()['status'], 'success')
        self.assertEqual(len(mail.outbox), 0)

    def test_too_fast_submission_blocked(self):
        self.client.get('/en/')  # recent _form_ts (<3s)
        mail.outbox.clear()
        self.client.post(self.url, self._payload())
        self.assertEqual(len(mail.outbox), 0)

    def test_valid_submission_sends_mail_with_reply_to(self):
        self._human_session()
        mail.outbox.clear()
        r = self.client.post(self.url, self._payload())
        self.assertEqual(r.json()['status'], 'success')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, 'Contact Form: Ada')
        self.assertEqual(mail.outbox[0].reply_to, ['ada@example.com'])

    def test_missing_fields(self):
        self._human_session()
        mail.outbox.clear()
        r = self.client.post(self.url, self._payload(message=''))
        self.assertEqual(r.json()['status'], 'error')
        self.assertEqual(len(mail.outbox), 0)

    def test_invalid_email(self):
        self._human_session()
        r = self.client.post(self.url, self._payload(email='not-an-email'))
        self.assertEqual(r.json()['status'], 'error')

    def test_header_injection_stripped(self):
        # Newlines are stripped, so no header can be injected via the name field.
        self._human_session()
        mail.outbox.clear()
        self.client.post(self.url, self._payload(name='Ada\r\nBcc: evil@x.com'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertNotIn('\n', mail.outbox[0].subject)
        self.assertNotIn('\r', mail.outbox[0].subject)

    def test_rate_limit(self):
        # All attempts count; the limit blocks beyond CONTACT_RATE_LIMIT.
        codes = []
        for i in range(views.CONTACT_RATE_LIMIT + 1):
            self.client.get('/en/')
            s = self.client.session; s['_form_ts'] = int(time.time()) - 10; s.save()
            codes.append(self.client.post(self.url, self._payload(email=f'u{i}@example.com')).status_code)
        self.assertEqual(codes[-1], 429)


@override_settings(**TEST_SETTINGS)
class NewsletterTests(TestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse('ajax_newsletter')

    def test_empty_and_invalid(self):
        self.assertEqual(self.client.post(self.url, {'email': ''}).json()['status'], 'error')
        self.assertEqual(self.client.post(self.url, {'email': 'bad'}).json()['status'], 'error')

    def test_subscribe_creates_row(self):
        r = self.client.post(self.url, {'email': 'new@example.com'})
        self.assertEqual(r.json()['status'], 'success')
        self.assertTrue(NewsletterSubscriber.objects.filter(email='new@example.com').exists())

    def test_duplicate_active(self):
        NewsletterSubscriber.objects.create(email='dup@example.com', is_active=True)
        r = self.client.post(self.url, {'email': 'dup@example.com'})
        self.assertEqual(r.json()['status'], 'success')
        self.assertEqual(NewsletterSubscriber.objects.filter(email='dup@example.com').count(), 1)

    def test_reactivates_inactive(self):
        NewsletterSubscriber.objects.create(email='back@example.com', is_active=False)
        self.client.post(self.url, {'email': 'back@example.com'})
        self.assertTrue(NewsletterSubscriber.objects.get(email='back@example.com').is_active)

    def test_rate_limit(self):
        codes = []
        for i in range(views.NEWSLETTER_RATE_LIMIT + 1):
            codes.append(self.client.post(self.url, {'email': f's{i}@example.com'}).status_code)
        self.assertEqual(codes[-1], 429)


@override_settings(**TEST_SETTINGS)
class ClientIPTests(TestCase):
    def setUp(self):
        self.rf = RequestFactory()

    def test_spoofed_cf_header_from_non_cf_peer_ignored(self):
        req = self.rf.post('/')
        req.META['REMOTE_ADDR'] = '8.8.8.8'
        req.META['HTTP_CF_CONNECTING_IP'] = '1.2.3.4'
        self.assertEqual(views._get_client_ip(req), '8.8.8.8')

    def test_cf_header_trusted_from_cf_peer(self):
        req = self.rf.post('/')
        req.META['REMOTE_ADDR'] = '104.16.0.1'  # within 104.16.0.0/13
        req.META['HTTP_CF_CONNECTING_IP'] = '1.2.3.4'
        self.assertEqual(views._get_client_ip(req), '1.2.3.4')

    def test_fallback_to_remote_addr(self):
        req = self.rf.post('/')
        req.META['REMOTE_ADDR'] = '203.0.113.7'
        self.assertEqual(views._get_client_ip(req), '203.0.113.7')


@override_settings(**TEST_SETTINGS)
class GeoLanguageTests(TestCase):
    def test_cf_country_sets_language_cookie(self):
        from django.conf import settings as dj
        r = self.client.get('/', HTTP_CF_IPCOUNTRY='TR')
        self.assertEqual(r['Location'], '/tr/')
        self.assertEqual(self.client.cookies[dj.LANGUAGE_COOKIE_NAME].value, 'tr')

    def test_existing_cookie_not_overridden(self):
        from django.conf import settings as dj
        self.client.cookies[dj.LANGUAGE_COOKIE_NAME] = 'en'
        r = self.client.get('/', HTTP_CF_IPCOUNTRY='TR')
        self.assertEqual(r['Location'], '/en/')


@override_settings(**TEST_SETTINGS)
class AdminActionTests(TestCase):
    def test_export_emails_csv(self):
        from django.contrib import admin
        from webapp.admin import NewsletterSubscriberAdmin
        NewsletterSubscriber.objects.create(email='a@example.com')
        ma = NewsletterSubscriberAdmin(NewsletterSubscriber, admin.site)
        resp = ma.export_emails(RequestFactory().get('/'), NewsletterSubscriber.objects.all())
        self.assertEqual(resp['Content-Type'], 'text/csv')
        self.assertIn(b'a@example.com', resp.content)

    def test_export_action_is_registered(self):
        from django.contrib import admin
        from django.contrib.auth.models import User
        from webapp.admin import NewsletterSubscriberAdmin
        ma = NewsletterSubscriberAdmin(NewsletterSubscriber, admin.site)
        req = RequestFactory().get('/')
        req.user = User(is_superuser=True, is_staff=True, is_active=True)
        self.assertIn('export_emails', ma.get_actions(req))


@override_settings(**TEST_SETTINGS)
class RedesignTests(TestCase):
    def test_homepage_uses_clarity_design(self):
        html = self.client.get('/en/').content.decode()
        self.assertIn('clarity.css', html)
        self.assertIn('id="waterCanvas"', html)
        self.assertIn('oktagon.jpeg', html)

    def test_homepage_shows_product_and_financing(self):
        html = self.client.get('/en/').content.decode()
        self.assertIn('Single Tank', html)
        self.assertIn('Eksfin', html)

    def test_contact_form_contract_intact(self):
        # JS depends on these ids/fields; views depend on the honeypot + field names.
        html = self.client.get('/en/').content.decode()
        for token in ('id="contactForm"', 'id="name"', 'id="email"', 'id="message"',
                      'name="company_url"', 'id="form_loaded"', 'data-ajax-url'):
            self.assertIn(token, html)


@override_settings(**TEST_SETTINGS)
class VisitCounterTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_counts_once_per_session(self):
        from webapp.models import VisitCounter
        self.client.get('/en/')
        self.client.get('/en/')  # same session → not double-counted
        self.assertEqual(VisitCounter.objects.get(pk=1).count, 1)

    def test_new_session_counts_again(self):
        from webapp.models import VisitCounter
        self.client.get('/en/')
        Client().get('/en/')  # fresh session
        self.assertEqual(VisitCounter.objects.get(pk=1).count, 2)

    def test_count_rendered_in_footer(self):
        self.client.get('/en/')
        cache.clear()
        self.assertIn('visits', self.client.get('/en/').content.decode().lower())


@override_settings(**TEST_SETTINGS)
class FeaturePageRedesignTests(TestCase):
    def test_feature_pages_use_clarity_base(self):
        html = self.client.get('/en/automation/').content.decode()
        self.assertIn('clarity.css', html)
        self.assertNotIn('webapp/css/style.css', html)  # legacy CSS gone

    def test_language_switch_preserves_page(self):
        # the hidden lang forms must point back to the SAME page in the target language
        html = self.client.get('/en/automation/').content.decode()
        self.assertIn('value="/tr/automation/"', html)


@override_settings(**TEST_SETTINGS)
class HardeningTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_newsletter_email_lowercased_and_deduped(self):
        self.client.post(reverse('ajax_newsletter'), {'email': 'A@Example.com'})
        self.client.post(reverse('ajax_newsletter'), {'email': 'a@example.com'})
        self.assertEqual(NewsletterSubscriber.objects.filter(email='a@example.com').count(), 1)
        self.assertFalse(NewsletterSubscriber.objects.filter(email='A@Example.com').exists())

    def test_newsletter_honeypot_silently_succeeds(self):
        r = self.client.post(reverse('ajax_newsletter'), {'email': 'bot@example.com', 'company_url': 'http://x'})
        self.assertEqual(r.json()['status'], 'success')
        self.assertFalse(NewsletterSubscriber.objects.filter(email='bot@example.com').exists())

    def test_contact_email_failure_returns_error(self):
        from unittest.mock import patch
        self.client.get('/en/')
        s = self.client.session; s['_form_ts'] = int(time.time()) - 10; s.save()
        with patch('webapp.views.EmailMessage.send', side_effect=Exception('smtp down')):
            r = self.client.post(reverse('ajax_contact'),
                                 {'name': 'A', 'company': 'B', 'email': 'a@b.com', 'message': 'hello there'})
        self.assertEqual(r.json()['status'], 'error')

    def test_rate_limiter_survives_corrupt_cache(self):
        from webapp import views
        cache.set('contact_rate_9.9.9.9', 'corrupt-not-a-tuple', 60)
        self.assertFalse(views._rate_limit_exceeded('contact_rate_9.9.9.9', 5))  # no TypeError

    def test_cf_connecting_ip_must_be_valid(self):
        from webapp import views
        req = RequestFactory().post('/')
        req.META['REMOTE_ADDR'] = '104.16.0.1'           # a Cloudflare peer
        req.META['HTTP_CF_CONNECTING_IP'] = 'not-an-ip'  # malformed → must be ignored
        self.assertEqual(views._get_client_ip(req), '104.16.0.1')
