from datetime import date

from django.contrib.sitemaps import Sitemap
from django.urls import reverse

# Bump on each content release so search engines prioritise recrawl.
CONTENT_LASTMOD = date(2026, 6, 14)


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
        return CONTENT_LASTMOD


class FeaturePageSitemap(Sitemap):
    priority = 0.8
    changefreq = 'monthly'
    protocol = 'https'
    i18n = True
    languages = ['en', 'no', 'tr', 'ar']
    alternates = True
    x_default = 'en'

    def lastmod(self, item):
        return CONTENT_LASTMOD

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
