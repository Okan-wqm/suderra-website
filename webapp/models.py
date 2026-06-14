from django.db import models


class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True)
    subscribed_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    source = models.CharField(max_length=50, default='website')

    class Meta:
        ordering = ['-subscribed_at']

    def __str__(self):
        return self.email


class VisitCounter(models.Model):
    """Single-row site visit counter (unique visits per session)."""
    count = models.BigIntegerField(default=0)

    def __str__(self):
        return f'{self.count} visits'
