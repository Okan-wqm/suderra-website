# Suderra Website

Marketing site for **Suderra AS** — a Norwegian **recirculating aquaculture (RAS)** partner.
Suderra **designs**, **audits**, **finances**, **builds** and **runs** RAS facilities (the
octagonal *Single Tank Design*), and operates them on the **Suderra Edge / Suderra OS**
platform with real-time, AI-assisted water-quality intelligence.

Django 5.1 · vanilla JS + raw WebGL (no frontend framework) · 4 languages (en/no/tr/ar, with RTL).

---

## Quick start (local)

```bash
# 1. Activate the virtualenv (.venv is the real one; venv/ is the prod Linux venv)
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # *nix

# 2. Install deps
pip install -r requirements.txt

# 3. Create your .env from the template and fill it in
copy .env.example .env            # Windows  (cp on *nix)

# 4. Run (DEBUG/ALLOWED_HOSTS overridden so localhost works — see note below)
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

> **Why override DEBUG locally?** `.env` ships with `DEBUG=False` (production-safe),
> which forces an HTTPS redirect and rejects `localhost`. `python-decouple` reads
> **environment variables before `.env`**, so run with the overrides instead of
> editing `.env`:
>
> ```bash
> # Windows (bash):  DEBUG=True ALLOWED_HOSTS=127.0.0.1,localhost python manage.py runserver
> # PowerShell:      $env:DEBUG="True"; $env:ALLOWED_HOSTS="127.0.0.1,localhost"; python manage.py runserver
> ```
>
> The dev server is started with `--noreload` in this repo's workflow; **restart it
> after editing templates** (the iCloud-synced working copy can serve stale templates
> from a long-running process).

Open <http://127.0.0.1:8000/> → redirects to `/en/`.

---

## Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Django secret. Generate: `python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"` |
| `DEBUG` | `False` in production. |
| `ALLOWED_HOSTS` | Comma-separated hosts. |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Gmail SMTP sender + **app password**. |
| `DEFAULT_FROM_EMAIL` / `CONTACT_RECIPIENT` | From + where contact mail is delivered. |
| `BREVO_API_KEY` / `BREVO_LIST_ID` | Optional newsletter sync (Brevo). |

**Never commit `.env`** — it is git-ignored. See `.env.example` for the shape.

---

## Architecture

```
suderrawebsite/        project (settings, urls, wsgi/asgi, static/)
  static/webapp/
    css/clarity.css     redesign design system + page styles
    css/style.css       legacy styles (feature pages)
    js/clarity.js       WebGL water + 3D octagon, scroll-clarity, ticker, tilt, forms
    js/main.js          legacy JS (feature pages)
    images/             logo5.png, oktagon.jpeg, partner logos, media
webapp/                 app: views, urls, models, admin, middleware, sitemaps, tests
templates/
  base_clarity.html     NEW base for the redesigned homepage (head plumbing + chrome)
  base.html             legacy base (feature pages, 404/500)
  partials/ico.html     inline icon set
  partials/flag_no.html Norwegian flag SVG
webapp/templates/
  index.html            redesigned homepage (extends base_clarity.html)
  features/*.html       feature pages (extend base.html, legacy design)
locale/{no,tr,ar}/      translations (.po / .mo)
```

### Key behaviours
- **i18n**: `i18n_patterns(prefix_default_language=True)` → every URL is language-prefixed
  (`/en/…`). `GeoLanguageMiddleware` picks a language on first visit from CDN country
  headers (Cloudflare `CF-IPCountry`, etc.) by injecting the language cookie — no
  thread-local leakage. Arabic renders `dir="rtl"` + `rtl.css`/RTL overrides.
- **Security headers + CSP nonce**: `SecurityHeadersMiddleware` sets a strict CSP with a
  **per-request nonce** (`request.csp_nonce`); every inline `<script>` carries the nonce
  and there are **no inline event handlers**, so `script-src` does not use `'unsafe-inline'`.
  Also sets Permissions-Policy, HSTS (prod), `X-Frame-Options: DENY`, nosniff, COOP,
  Referrer-Policy.
- **Contact / newsletter (AJAX)**: bot protection (honeypot `company_url`, server-side
  timing, per-IP rate limiting that counts **every** attempt), server-side validation,
  email-header-injection stripping, `Reply-To` set to the submitter, newsletter
  reactivation of unsubscribed addresses, optional Brevo sync **off the request thread**.
- **Client IP**: `_get_client_ip` only trusts Cloudflare's `CF-Connecting-IP` when the TCP
  peer is within `CLOUDFLARE_IP_RANGES` (anti-spoofing).
- **Static files**: served by **WhiteNoise** (`CompressedStaticFilesStorage`) in production.

---

## The "Clarity" redesign (homepage)

Concept: as you scroll, dark/murky water **clarifies** into the bright editorial brand —
*turbidity → clarity = chaos → insight*, mirroring what RAS does to water.

- **Signature visual**: raw-WebGL water caustics + a rotating **3D octagonal tank-in-tank**
  with bioluminescent particles (`clarity.js`, library-free → CSP-safe). Fades out past the hero.
- **3D motion**: scroll-driven CSS perspective reveals + cursor-following 3D card tilt.
- **Sections**: hero (live sensor ticker) → Single Tank product (octagon + real metrics &
  specs) → capabilities → multi-tenant **Platform** (isolated DB per tenant, unlimited
  sensors, mobile ops, scientific charts, Mattilsynet-format reports, live AI dashboard) →
  end-to-end loop (Design · Audit · Finance · Build · Run · Sense & decide) → partners →
  sectors → about → contact.
- **Type**: Fraunces (display/serif), Hanken Grotesk (body), JetBrains Mono (data).
- **Accessibility**: skip link, ARIA on forms/feedback, sequential headings, and a full
  `prefers-reduced-motion` path (no WebGL animation loop, no tilt, instant reveals). A
  no-WebGL fallback paints a gradient.

Feature pages (`/…/aquaculture-software/` etc.) still use the legacy `base.html` and are
slated to migrate to `base_clarity.html` in a later pass.

---

## Tests

```bash
python manage.py test
```

36 tests in `webapp/tests.py` cover routing/i18n, security headers + CSP nonce,
contact/newsletter (bot protection, validation, rate limiting, email, Reply-To, reactivation),
Cloudflare-aware client IP, geo-language detection, the admin CSV export action, and the
redesigned homepage / form contract. Email is captured in-memory (no real mail sent).

---

## Deployment

```bash
pip install -r requirements.txt
python manage.py collectstatic --noinput      # WhiteNoise compresses assets
python manage.py migrate
gunicorn suderrawebsite.wsgi:application
```

Production checklist:
- Set real `.env` values; `DEBUG=False`; `ALLOWED_HOSTS` to your domain(s).
- **Restart gunicorn** after deploy (a `SECRET_KEY` change invalidates existing sessions).
- Terminate TLS at Cloudflare/nginx and **firewall the origin to Cloudflare IP ranges**
  so `SECURE_PROXY_SSL_HEADER` / `CF-Connecting-IP` can't be spoofed.
- For reliable rate limiting under multiple gunicorn workers, switch the cache from
  `FileBasedCache` to Redis/Memcached (see `settings.CACHES`).

### Translations
Reused copy keeps its `no/tr/ar` translations; **new redesign copy currently falls back to
English** on non-English pages. To complete it:
```bash
python manage.py makemessages -l no -l tr -l ar   # needs GNU gettext (xgettext)
#  …translate the new msgids in locale/*/LC_MESSAGES/django.po…
python manage.py compilemessages                  # needs msgfmt
```
(`msgfmt`/`xgettext` are not installed in this dev environment — install GNU gettext-tools.)

---

## Rollback

The pre-redesign baseline is committed; the redesign lives on a branch.

```bash
git checkout master            # return to the audited, pre-redesign site
# or hard reset working tree:   git reset --hard <baseline-commit>
```

---

## Notes / follow-ups
- Rotate the Gmail **app password** that was previously exposed in plaintext (account action).
- Missing asset `webapp/svg/dashboard.svg` is referenced by a legacy feature section
  (`<object>` falls back to text) — supply the SVG or remove the reference.
- Migrate feature pages to the Clarity base and finish the `no/tr/ar` translation pass.
