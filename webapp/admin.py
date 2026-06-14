import csv

from django.contrib import admin
from django.http import HttpResponse

from .models import NewsletterSubscriber


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ('email', 'subscribed_at', 'is_active', 'source')
    list_filter = ('is_active', 'source', 'subscribed_at')
    search_fields = ('email',)
    readonly_fields = ('subscribed_at',)
    actions = ['export_emails', 'deactivate_selected']

    @admin.action(description="Export selected subscribers to CSV")
    def export_emails(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="newsletter_subscribers.csv"'
        writer = csv.writer(response)
        writer.writerow(['email', 'subscribed_at', 'is_active', 'source'])
        for sub in queryset:
            writer.writerow([sub.email, sub.subscribed_at.isoformat(), sub.is_active, sub.source])
        return response

    @admin.action(description="Deactivate selected subscribers")
    def deactivate_selected(self, request, queryset):
        queryset.update(is_active=False)
