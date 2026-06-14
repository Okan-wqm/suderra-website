from django.contrib.sitemaps import Sitemap
from django.urls import reverse


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
