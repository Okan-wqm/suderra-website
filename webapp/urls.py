# webapp/urls.py
from django.urls import path
from .views import (
    index, ajax_contact, ajax_newsletter,
    feature_aquaculture, feature_regulatory, feature_automation,
    feature_soilless, feature_waste_water,
)

urlpatterns = [
    path('', index, name='index'),
    path('ajax/contact/', ajax_contact, name='ajax_contact'),
    path('ajax/newsletter/', ajax_newsletter, name='ajax_newsletter'),
    path('aquaculture-software/', feature_aquaculture, name='feature_aquaculture'),
    path('regulatory-compliance/', feature_regulatory, name='feature_regulatory'),
    path('automation/', feature_automation, name='feature_automation'),
    path('soilless-culture/', feature_soilless, name='feature_soilless'),
    path('waste-water/', feature_waste_water, name='feature_waste_water'),
]
