"""
Custom middleware for Suderra website.

- GeoLanguageMiddleware: Auto-detects visitor country for language selection
- SecurityHeadersMiddleware: Adds CSP (with per-request nonce), Permissions-Policy
"""
import secrets

from django.conf import settings
from django.core.cache import cache
from django.db.models import F


class VisitCounterMiddleware:
    """Counts unique visits (once per session) on successful HTML page loads.

    Must be placed AFTER SessionMiddleware. Uses an atomic F()+1 update; failures
    never affect the response.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            if (request.method == 'GET'
                    and response.status_code == 200
                    and not request.session.get('_counted')
                    and 'text/html' in response.headers.get('Content-Type', '')):
                from webapp.models import VisitCounter
                if not VisitCounter.objects.filter(pk=1).update(count=F('count') + 1):
                    VisitCounter.objects.get_or_create(pk=1, defaults={'count': 1})
                request.session['_counted'] = True
                cache.delete('visit_count')
        except Exception:
            pass
        return response


class SecurityHeadersMiddleware:
    """
    Adds Content-Security-Policy and Permissions-Policy headers to all responses.
    Must be placed right after SecurityMiddleware in settings.MIDDLEWARE.

    A fresh per-request nonce is generated and exposed as ``request.csp_nonce``.
    Templates add ``nonce="{{ request.csp_nonce }}"`` to every inline <script>,
    which lets us drop the insecure 'unsafe-inline' from script-src.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Per-request nonce for inline <script> tags (read in templates before render).
        nonce = secrets.token_urlsafe(16)
        request.csp_nonce = nonce

        response = self.get_response(request)

        # Content-Security-Policy. script-src uses a nonce instead of 'unsafe-inline'
        # so injected/inline scripts without the nonce are blocked. (Inline styles are
        # pervasive in markup, so style-src keeps 'unsafe-inline' as a pragmatic trade-off.)
        csp_directives = [
            "default-src 'self'",
            f"script-src 'self' 'nonce-{nonce}' https://www.googletagmanager.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response['Content-Security-Policy'] = '; '.join(csp_directives)

        # Permissions-Policy — restrict unused browser features
        response['Permissions-Policy'] = (
            'camera=(), microphone=(), geolocation=(), payment=(), '
            'usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
        )

        return response


class GeoLanguageMiddleware:
    """
    Detects the visitor's country from CDN/proxy headers and selects the matching
    language on the first visit (when no language cookie is set yet).

    Works with:
    - Cloudflare: CF-IPCountry header
    - AWS CloudFront: CloudFront-Viewer-Country header
    - Generic proxy: X-Country-Code header

    Must be placed AFTER SessionMiddleware and BEFORE LocaleMiddleware.

    Instead of calling translation.activate() (which leaks language state across
    pooled worker threads and is overridden by LocaleMiddleware anyway), this
    injects the detected language into request.COOKIES so the LocaleMiddleware that
    runs next honours it for the URL-prefix redirect, and persists it as a real
    cookie on the response.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.geo_map = getattr(settings, 'GEO_LANGUAGE_MAP', {})

    def __call__(self, request):
        lang = None
        # Only auto-detect if the user hasn't already chosen a language.
        if not request.COOKIES.get(settings.LANGUAGE_COOKIE_NAME):
            country_code = self._get_country_code(request)
            if country_code and country_code in self.geo_map:
                lang = self.geo_map[country_code]
                # Make LocaleMiddleware (runs next) use this language for this request.
                request.COOKIES[settings.LANGUAGE_COOKIE_NAME] = lang

        response = self.get_response(request)

        # Persist the choice so subsequent requests skip detection.
        if lang:
            response.set_cookie(
                settings.LANGUAGE_COOKIE_NAME, lang,
                max_age=settings.LANGUAGE_COOKIE_AGE,
                path=settings.LANGUAGE_COOKIE_PATH,
                domain=settings.LANGUAGE_COOKIE_DOMAIN,
                secure=settings.LANGUAGE_COOKIE_SECURE,
                httponly=settings.LANGUAGE_COOKIE_HTTPONLY,
                samesite=settings.LANGUAGE_COOKIE_SAMESITE,
            )
        return response

    def _get_country_code(self, request):
        """Extract country code from various CDN/proxy headers."""
        # Cloudflare
        country = request.META.get('HTTP_CF_IPCOUNTRY')
        if country and country != 'XX':
            return country.upper()

        # AWS CloudFront
        country = request.META.get('HTTP_CLOUDFRONT_VIEWER_COUNTRY')
        if country:
            return country.upper()

        # Generic proxy header
        country = request.META.get('HTTP_X_COUNTRY_CODE')
        if country:
            return country.upper()

        return None
