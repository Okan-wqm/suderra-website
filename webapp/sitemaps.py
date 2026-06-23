import os
from datetime import date

from django.contrib.sitemaps import Sitemap
from django.template.loader import get_template
from django.urls import reverse

# Fallback when a template path can't be resolved (e.g. cached loaders without origin).
CONTENT_LASTMOD = date(2026, 6, 23)

# Map each named view to the template whose mtime drives its <lastmod>.
TEMPLATE_FOR = {
    'index': 'index.html',
    'feature_aquaculture': 'features/aquaculture_software.html',
    'feature_regulatory': 'features/regulatory_compliance.html',
    'feature_automation': 'features/automation.html',
    'feature_soilless': 'features/soilless_culture.html',
    'feature_waste_water': 'features/waste_water.html',
}


def _tpl_mtime(item):
    """lastmod from the page template's file mtime so it self-advances on each release."""
    try:
        path = get_template(TEMPLATE_FOR[item]).origin.name
        return date.fromtimestamp(os.path.getmtime(path))
    except Exception:
        return CONTENT_LASTMOD


class StaticViewSitemap(Sitemap):
    priority = 1.0
    changefreq = 'weekly'
    protocol = 'https'
    i18n = True
    languages = ['en', 'no', 'tr', 'ar']
    alternates = True
    x_default = 'en'

    def items(self):
        return ['index']

    def location(self, item):
        return reverse(item)

    def lastmod(self, item):
        return _tpl_mtime(item)


class FeaturePageSitemap(Sitemap):
    priority = 0.8
    changefreq = 'monthly'
    protocol = 'https'
    i18n = True
    languages = ['en', 'no', 'tr', 'ar']
    alternates = True
    x_default = 'en'

    def items(self):
        return [
            'feature_aquaculture',
            'feature_regulatory',
            'feature_automation',
            'feature_soilless',
            'feature_waste_water',
        ]

    def location(self, item):
        return reverse(item)

    def lastmod(self, item):
        return _tpl_mtime(item)
