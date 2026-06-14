"""
URL configuration for suderrawebsite project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
"""

from django.contrib import admin
from django.urls import path, include
from django.conf.urls.i18n import i18n_patterns
from django.views.generic import TemplateView
from django.contrib.sitemaps.views import sitemap
from webapp.sitemaps import StaticViewSitemap, FeaturePageSitemap


sitemaps = {
    'static': StaticViewSitemap,
    'features': FeaturePageSitemap,
}

# Non-i18n URL patterns (language-switching endpoint, admin)
urlpatterns = [
    path('suderradmin/', admin.site.urls),
    path('i18n/', include('django.conf.urls.i18n')),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
    path('robots.txt', TemplateView.as_view(template_name='robots.txt', content_type='text/plain'), name='robots_txt'),
]

# i18n URL patterns (language-prefixed)
urlpatterns += i18n_patterns(
    path('', include('webapp.urls')),
    prefix_default_language=True,
)
