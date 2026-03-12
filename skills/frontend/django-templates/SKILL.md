---
name: django-templates
description: >
  Django template system best practices for server-rendered HTML applications.
  Use this skill when building template hierarchies, custom tags and filters,
  integrating HTMX with Django views, or managing static assets. Covers
  template inheritance, context processors, form rendering, and security.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: django, templates, jinja, html, python
---

# Django Template Best Practices

## Template Inheritance

Use a three-level hierarchy: base layout, section layout, page template. Do not duplicate shared markup.

```html
<!-- templates/base.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <title>{% block title %}My Site{% endblock %}</title>
  {% block extra_css %}{% endblock %}
</head>
<body>
  {% include "partials/navbar.html" %}
  <main>{% block content %}{% endblock %}</main>
  {% block extra_js %}{% endblock %}
</body>
</html>
```

```html
<!-- templates/dashboard/analytics.html -->
{% extends "dashboard/base.html" %}
{% block title %}Analytics{% endblock %}
{% block dashboard_content %}
  {% for metric in metrics %}
    <div class="metric-card">
      <h2>{{ metric.label }}</h2>
      <p>{{ metric.value|intcomma }}</p>
    </div>
  {% empty %}
    <p>No metrics available.</p>
  {% endfor %}
{% endblock %}
```

## Custom Template Tags and Filters

Place custom filters in `templatetags/` inside the app for presentation logic that repeats across templates.

```python
# myapp/templatetags/myapp_filters.py
from django import template
register = template.Library()

@register.filter
def time_ago(value):
    diff = (datetime.now(value.tzinfo) - value).total_seconds()
    if diff < 60: return "just now"
    if diff < 3600: return f"{int(diff // 60)} minutes ago"
    if diff < 86400: return f"{int(diff // 3600)} hours ago"
    return f"{int(diff // 86400)} days ago"

@register.inclusion_tag('partials/pagination.html')
def pagination(page_obj):
    return {'page_obj': page_obj, 'has_prev': page_obj.has_previous(), 'has_next': page_obj.has_next()}
```

```html
{% load myapp_filters %}
<span>{{ comment.created_at|time_ago }}</span>
```

## Static Files

Use `{% static %}` for all asset references. Do not hardcode `/static/` paths. Use WhiteNoise for production serving.

```html
{% load static %}
<link rel="stylesheet" href="{% static 'css/main.css' %}">
```

```python
# settings.py
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware', ...]
STORAGES = {"staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"}}
```

## Form Rendering

Render forms with explicit control over markup. Do not use `{{ form.as_p }}` in production because it limits styling.

```html
<form method="post" novalidate>
  {% csrf_token %}
  {% for field in form %}
    <div class="form-group {% if field.errors %}has-error{% endif %}">
      <label for="{{ field.id_for_label }}">{{ field.label }}</label>
      {{ field }}
      {% for error in field.errors %}<span class="error">{{ error }}</span>{% endfor %}
    </div>
  {% endfor %}
  <button type="submit">Submit</button>
</form>
```

## HTMX Integration

Return HTML fragments for HTMX requests. Check the `HX-Request` header to differentiate.

```python
def contact_list(request):
    contacts = Contact.objects.all()
    if request.headers.get('HX-Request'):
        return render(request, 'partials/contact_list.html', {'contacts': contacts})
    return render(request, 'contacts/index.html', {'contacts': contacts})
```

```html
<input type="search" name="q"
       hx-get="{% url 'contact_search' %}"
       hx-trigger="input changed delay:300ms"
       hx-target="#contact-list">
<div id="contact-list">{% include "partials/contact_list.html" %}</div>
```

## Context Processors

Use context processors for data needed on every page. Do not put expensive queries here because they run on every request.

```python
def site_settings(request):
    return {'SITE_NAME': 'My App', 'SUPPORT_EMAIL': 'support@example.com'}
```

```python
TEMPLATES = [{'OPTIONS': {'context_processors': [..., 'myapp.context_processors.site_settings']}}]
```

## Template Fragments

Use partials with `{% include %}` for reusable fragments that can be targeted by HTMX.

```html
<div id="order-status">{% include "orders/_status_badge.html" %}</div>
<button hx-post="{% url 'order_refresh' order.pk %}" hx-target="#order-status">Refresh</button>
```

## Security

Django auto-escapes all template variables. Only use `mark_safe` after sanitizing with a library like `bleach`:

```python
from django.utils.safestring import mark_safe
import bleach

def render_markdown(text):
    html = markdown.convert(text)
    clean = bleach.clean(html, tags=['p', 'strong', 'em', 'a', 'code'])
    return mark_safe(clean)
```

Always include `{% csrf_token %}` in POST forms. Do not use `@csrf_exempt` unless building token-authenticated API endpoints.

## Common Pitfalls

Do not put business logic in templates. Compute values in views or model methods:

```python
# Good: computed in the view
context['is_loyal_customer'] = user.is_loyal_customer()
```

Do not use `{% include %}` in tight loops with complex templates. Use cached template fragments instead:

```html
{% load cache %}
{% cache 300 sidebar request.user.id %}
  {% include "partials/sidebar.html" %}
{% endcache %}
```
