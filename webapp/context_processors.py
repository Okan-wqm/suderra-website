"""Template context processors for the Suderra site."""
from django.core.cache import cache


def visit_count(request):
    """Expose the cached site visit count to all templates as `visit_count`."""
    n = cache.get('visit_count')
    if n is None:
        from webapp.models import VisitCounter
        obj = VisitCounter.objects.first()
        n = obj.count if obj else 0
        cache.set('visit_count', n, 60)
    return {'visit_count': n}
