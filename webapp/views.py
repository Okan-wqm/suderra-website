# views.py
import re
import time
import json
import logging
import ipaddress
import threading
import urllib.request
import urllib.error

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.core.mail import EmailMessage
from django.conf import settings
from django.core.cache import cache
from django.shortcuts import render

logger = logging.getLogger('webapp')

# Input length limits
MAX_NAME_LENGTH = 150
MAX_COMPANY_LENGTH = 200
MAX_EMAIL_LENGTH = 254  # RFC 5321
MAX_MESSAGE_LENGTH = 5000

# Rate limits (attempts per IP per hour). Every attempt is counted, including
# bot/validation/error paths, so the limits are a little more generous than the
# old "successes only" counters to leave room for genuine user mistakes.
CONTACT_RATE_LIMIT = 5
NEWSLETTER_RATE_LIMIT = 5
RATE_LIMIT_WINDOW = 3600  # seconds

# Parse Cloudflare CIDR ranges once at import time.
_CF_NETWORKS = []
for _cidr in getattr(settings, 'CLOUDFLARE_IP_RANGES', []):
    try:
        _CF_NETWORKS.append(ipaddress.ip_network(_cidr))
    except ValueError:
        logger.warning('Invalid Cloudflare CIDR in settings: %s', _cidr)


def _remote_addr_is_cloudflare(remote_addr):
    """True if the TCP peer is within a published Cloudflare range."""
    try:
        ip = ipaddress.ip_address(remote_addr)
    except ValueError:
        return False
    return any(ip in net for net in _CF_NETWORKS)


def _get_client_ip(request):
    """Get the real client IP.

    Only trust Cloudflare's CF-Connecting-IP header when the request's TCP peer
    (REMOTE_ADDR) is actually a Cloudflare edge IP — otherwise an attacker hitting
    the origin directly could spoof the header to bypass/poison rate limits.
    """
    remote_addr = request.META.get('REMOTE_ADDR', '0.0.0.0')
    if _remote_addr_is_cloudflare(remote_addr):
        cf_ip = request.META.get('HTTP_CF_CONNECTING_IP', '').strip()
        if cf_ip:
            return cf_ip
    return remote_addr


def _rate_limit_exceeded(cache_key, limit, window=RATE_LIMIT_WINDOW):
    """Count this attempt and return True if the IP is over ``limit``.

    Uses add+incr so the counter increments on EVERY attempt (not only on
    success). FileBasedCache is not perfectly atomic across workers — see the
    note in settings.CACHES — but this is sufficient for basic abuse control.
    """
    if cache.add(cache_key, 1, window):
        return 1 > limit  # first attempt in the window
    try:
        current = cache.incr(cache_key)
    except ValueError:
        # Key expired between add and incr — start a fresh window.
        cache.add(cache_key, 1, window)
        current = 1
    return current > limit


def index(request):
    # Set server-side timestamp for bot protection timing check
    request.session['_form_ts'] = int(time.time())
    return render(request, 'index.html')


def feature_aquaculture(request):
    return render(request, 'features/aquaculture_software.html')


def feature_regulatory(request):
    return render(request, 'features/regulatory_compliance.html')


def feature_automation(request):
    return render(request, 'features/automation.html')


def feature_soilless(request):
    return render(request, 'features/soilless_culture.html')


def feature_waste_water(request):
    return render(request, 'features/waste_water.html')


@require_POST
def ajax_contact(request):
    """Handle AJAX contact form submissions with bot protection."""

    ip = _get_client_ip(request)

    # Layer 3: Rate limiting first — count EVERY attempt (bots, failures, successes).
    if _rate_limit_exceeded(f'contact_rate_{ip}', CONTACT_RATE_LIMIT):
        return JsonResponse({'status': 'error', 'message': 'Too many submissions. Please try again later.'}, status=429)

    # Layer 1: Honeypot check — bots auto-fill hidden fields, humans never see them
    if request.POST.get('company_url', ''):
        return JsonResponse({'status': 'success', 'message': 'Your message was sent successfully.'})

    # Layer 2: Time-based check — server-side timestamp (not spoofable)
    form_ts = request.session.get('_form_ts')
    if form_ts:
        elapsed = time.time() - form_ts
        if elapsed < 3:
            # Submitted faster than 3 seconds — likely a bot
            return JsonResponse({'status': 'success', 'message': 'Your message was sent successfully.'})
    else:
        # No server-side timestamp — form page was never loaded through our view
        # Fall back to client-side timestamp check
        form_loaded = request.POST.get('form_loaded', '')
        if form_loaded:
            try:
                elapsed_ms = time.time() * 1000 - int(form_loaded)
                if elapsed_ms < 3000:
                    return JsonResponse({'status': 'success', 'message': 'Your message was sent successfully.'})
            except (ValueError, TypeError):
                pass

    # Sanitize inputs — strip newlines to prevent email header injection + enforce length limits
    name = re.sub(r'[\r\n]', '', request.POST.get('name', '').strip())[:MAX_NAME_LENGTH]
    company = re.sub(r'[\r\n]', '', request.POST.get('company', '').strip())[:MAX_COMPANY_LENGTH]
    email = re.sub(r'[\r\n]', '', request.POST.get('email', '').strip())[:MAX_EMAIL_LENGTH]
    message = request.POST.get('message', '').strip()[:MAX_MESSAGE_LENGTH]

    if not (name and company and email and message):
        return JsonResponse({'status': 'error', 'message': 'Must fill all the required areas.'})

    # Server-side email validation
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({'status': 'error', 'message': 'Please enter a valid email address.'})

    subject = f"Contact Form: {name[:100]}"
    mail_body = (
        f"Name: {name}\n"
        f"Company: {company}\n"
        f"Email: {email}\n\n"
        f"Message:\n{message}"
    )

    try:
        # Send from our own address but set Reply-To to the submitter so replies
        # go to the person who filled in the form, not the no-reply mailbox.
        EmailMessage(
            subject=subject,
            body=mail_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[getattr(settings, 'CONTACT_RECIPIENT', 'okan@suderra.com')],
            reply_to=[email],
        ).send(fail_silently=False)
        logger.info('Contact form submitted by %s <%s> from IP %s', name, email, ip)
        return JsonResponse({'status': 'success', 'message': 'Your message was sent successfully.'})
    except Exception:
        logger.exception('Failed to send contact form email from %s', email)
        return JsonResponse({'status': 'error', 'message': 'An error occurred. Please try again later.'})


@require_POST
def ajax_newsletter(request):
    """Handle newsletter subscription via AJAX."""
    ip = _get_client_ip(request)

    # Rate limit first — count every attempt.
    if _rate_limit_exceeded(f'newsletter_rate_{ip}', NEWSLETTER_RATE_LIMIT):
        return JsonResponse({'status': 'error', 'message': 'Too many attempts. Please try again later.'}, status=429)

    email = re.sub(r'[\r\n]', '', request.POST.get('email', '').strip())[:MAX_EMAIL_LENGTH]

    if not email:
        return JsonResponse({'status': 'error', 'message': 'Please enter your email address.'})

    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({'status': 'error', 'message': 'Please enter a valid email address.'})

    # Save to local database (reactivating a previously unsubscribed address).
    from webapp.models import NewsletterSubscriber
    subscriber, created = NewsletterSubscriber.objects.get_or_create(email=email)
    if not created:
        if subscriber.is_active:
            return JsonResponse({'status': 'success', 'message': 'You are already subscribed!'})
        # Re-subscribe a previously deactivated address.
        subscriber.is_active = True
        subscriber.save(update_fields=['is_active'])

    # Sync to Brevo (Sendinblue) if configured — off the request thread so a slow
    # or failing Brevo API never blocks the user's response.
    brevo_key = getattr(settings, 'BREVO_API_KEY', '')
    brevo_list = getattr(settings, 'BREVO_LIST_ID', None)
    if brevo_key and brevo_list:
        threading.Thread(
            target=_sync_to_brevo, args=(email, brevo_key, brevo_list), daemon=True
        ).start()

    logger.info('Newsletter subscription: %s from IP %s', email, ip)
    return JsonResponse({'status': 'success', 'message': 'Successfully subscribed!'})


def _sync_to_brevo(email, api_key, list_id):
    """Add a contact to Brevo (Sendinblue) mailing list."""
    try:
        data = json.dumps({
            'email': email,
            'listIds': [int(list_id)],
            'updateEnabled': True,
        }).encode('utf-8')

        req = urllib.request.Request(
            'https://api.brevo.com/v3/contacts',
            data=data,
            headers={
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': api_key,
            },
            method='POST',
        )
        urllib.request.urlopen(req, timeout=5)
    except urllib.error.HTTPError as e:
        if e.code == 400:
            # Contact already exists — not an error
            pass
        else:
            logger.warning('Brevo API error %d for %s', e.code, email)
    except Exception:
        logger.warning('Brevo sync failed for %s', email, exc_info=True)
