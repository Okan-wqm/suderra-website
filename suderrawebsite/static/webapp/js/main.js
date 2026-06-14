/**
 * SUDERRA - Main JavaScript
 * Complete Redesign - Modern Production Grade
 *
 * Handles:
 * - Smooth scrolling (no snap)
 * - Intersection Observer animations
 * - Parallax effects
 * - Header scroll behavior
 * - Contact form AJAX with improved UX
 * - Mobile menu toggle
 * - Back to top button
 * - Active nav link highlighting
 * - Counter animation for stats
 * - Technology tabs
 * - Before/After comparison slider
 */

document.addEventListener('DOMContentLoaded', function () {

  // =============================================
  // 1. Mobile Menu Toggle
  // =============================================
  const nav = document.querySelector('.navbar');
  const toggleBtn = document.querySelector('.menu-toggle');

  if (toggleBtn && nav) {
    toggleBtn.addEventListener('click', function () {
      nav.classList.toggle('open');
    });

    // Close menu when a link is clicked
    const navLinks = nav.querySelectorAll('a');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !toggleBtn.contains(e.target)) {
        nav.classList.remove('open');
      }
    });
  }

  // =============================================
  // 2. Header Scroll Effect
  // =============================================
  // Shared scroll dispatcher: coalesce all scroll-driven layout work into a
  // single requestAnimationFrame per frame to avoid layout thrash.
  var scrollHandlers = [];
  var scrollTicking = false;

  function runScrollHandlers() {
    for (var i = 0; i < scrollHandlers.length; i++) {
      scrollHandlers[i]();
    }
    scrollTicking = false;
  }

  function onSharedScroll() {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(runScrollHandlers);
    }
  }

  window.addEventListener('scroll', onSharedScroll, { passive: true });

  const header = document.querySelector('header');
  let lastScrollY = 0;

  function handleHeaderScroll() {
    const scrollY = window.scrollY;
    if (header) {
      if (scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
    lastScrollY = scrollY;
  }

  scrollHandlers.push(handleHeaderScroll);
  handleHeaderScroll();

  // =============================================
  // 3. Active Nav Link Highlighting
  // =============================================
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.navbar li a');

  function highlightNavOnScroll() {
    var scrollY = window.scrollY + 100;

    sections.forEach(function (section) {
      var sectionTop = section.offsetTop - 100;
      var sectionHeight = section.offsetHeight;
      var sectionId = section.getAttribute('id');

      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        navItems.forEach(function (item) {
          item.classList.remove('nav-active');
          if (item.getAttribute('href') === '#' + sectionId) {
            item.classList.add('nav-active');
          }
        });
      }
    });
  }

  scrollHandlers.push(highlightNavOnScroll);
  highlightNavOnScroll();

  // =============================================
  // 4. Scroll Reveal Animations
  // =============================================
  var revealElements = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');

  if (revealElements.length > 0) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  // =============================================
  // 5. Counter Animation for Stats
  // =============================================
  var statNumbers = document.querySelectorAll('.stat-number[data-target]');
  var statsAnimated = false;

  function animateCounters() {
    if (statsAnimated) return;
    statsAnimated = true;

    statNumbers.forEach(function (counter) {
      var target = parseInt(counter.getAttribute('data-target'), 10) || 0;
      var duration = 2000;
      var start = 0;
      var startTime = null;

      function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
      }

      function updateCounter(timestamp) {
        if (!startTime) startTime = timestamp;
        var elapsed = timestamp - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var easedProgress = easeOutCubic(progress);
        var current = Math.round(easedProgress * target);

        counter.textContent = current;

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          counter.textContent = target;
        }
      }

      requestAnimationFrame(updateCounter);
    });
  }

  if (statNumbers.length > 0) {
    var statsObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounters();
          statsObserver.disconnect();
        }
      });
    }, { threshold: 0.5 });

    var statsBar = document.querySelector('.hero-stats');
    if (statsBar) {
      statsObserver.observe(statsBar);
    }
  }

  // =============================================
  // 6. Technology Tabs
  // =============================================
  var tabButtons = document.querySelectorAll('.tech-tab-btn');
  var tabPanels = document.querySelectorAll('.tech-tab-panel');

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetTab = btn.getAttribute('data-tab');

      // Remove active from all
      tabButtons.forEach(function (b) { b.classList.remove('active'); });
      tabPanels.forEach(function (p) { p.classList.remove('active'); });

      // Add active to clicked
      btn.classList.add('active');
      var targetPanel = document.getElementById(targetTab);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });

  // =============================================
  // 7. Before/After Comparison Slider
  // =============================================
  var comparisonSlider = document.getElementById('comparisonSlider');
  var comparisonHandle = document.getElementById('comparisonHandle');

  if (comparisonSlider && comparisonHandle) {
    var isDragging = false;

    var isRTL = (document.documentElement.getAttribute('dir') === 'rtl');

    function updateSliderPosition(clientX) {
      var rect = comparisonSlider.getBoundingClientRect();
      var beforeImage = comparisonSlider.querySelector('.comparison-before');

      if (isRTL) {
        var xFromRight = rect.right - clientX;
        var percentage = Math.max(0, Math.min(100, (xFromRight / rect.width) * 100));
        if (beforeImage) {
          beforeImage.style.clipPath = 'inset(0 0 0 ' + (100 - percentage) + '%)';
        }
        comparisonHandle.style.left = '';
        comparisonHandle.style.right = percentage + '%';
      } else {
        var x = clientX - rect.left;
        var percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        if (beforeImage) {
          beforeImage.style.clipPath = 'inset(0 ' + (100 - percentage) + '% 0 0)';
        }
        comparisonHandle.style.right = '';
        comparisonHandle.style.left = percentage + '%';
      }
    }

    comparisonSlider.addEventListener('mousedown', function (e) {
      isDragging = true;
      updateSliderPosition(e.clientX);
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (isDragging) {
        updateSliderPosition(e.clientX);
      }
    });

    document.addEventListener('mouseup', function () {
      isDragging = false;
    });

    // Touch support
    comparisonSlider.addEventListener('touchstart', function (e) {
      isDragging = true;
      updateSliderPosition(e.touches[0].clientX);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
      if (isDragging) {
        e.preventDefault();
        updateSliderPosition(e.touches[0].clientX);
      }
    }, { passive: false });

    document.addEventListener('touchend', function () {
      isDragging = false;
    });
  }

  // =============================================
  // 8. Back to Top Button
  // =============================================
  var backToTopBtn = document.getElementById('backToTop');

  if (backToTopBtn) {
    scrollHandlers.push(function () {
      if (window.scrollY > 600) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });

    backToTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // =============================================
  // 9. Smooth Scroll for Anchor Links
  // =============================================
  var anchorLinks = document.querySelectorAll('a[href^="#"]');

  anchorLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;

      var targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        var headerOffset = 64;
        var elementPosition = targetElement.getBoundingClientRect().top;
        var offsetPosition = elementPosition + window.scrollY - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // =============================================
  // 10. Parallax Effect
  // =============================================
  var heroVideo = document.querySelector('.hero-video');

  function handleParallax() {
    var scrollY = window.scrollY;

    if (heroVideo && scrollY < window.innerHeight) {
      heroVideo.style.transform = 'translateY(' + (scrollY * 0.3) + 'px) scale(1.1)';
    }
  }

  scrollHandlers.push(handleParallax);

  // =============================================
  // 11. Contact Form - Validation + CSRF + AJAX
  // =============================================
  // Set form load timestamp for bot protection
  var formLoadedField = document.getElementById('form_loaded');
  if (formLoadedField) {
    formLoadedField.value = Date.now();
  }

  var contactForm = document.getElementById('contactForm');
  var formFeedback = document.getElementById('formFeedback');

  /**
   * Read a cookie value by name (needed for Django CSRF token).
   */
  function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  function showFormFeedback(type, message) {
    if (!formFeedback) return;
    formFeedback.className = 'form-feedback ' + type;
    var iconSpan = formFeedback.querySelector('.form-feedback-icon');
    var textSpan = formFeedback.querySelector('.form-feedback-text');

    if (type === 'success') {
      if (iconSpan) iconSpan.textContent = '\u2713';
    } else {
      if (iconSpan) iconSpan.textContent = '!';
    }
    if (textSpan) textSpan.textContent = message;
    formFeedback.style.display = 'flex';
  }

  function hideFormFeedback() {
    if (formFeedback) {
      formFeedback.style.display = 'none';
    }
  }

  if (contactForm) {
    var submitBtn = contactForm.querySelector('.btn-submit');
    var btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
    var btnLoader = submitBtn ? submitBtn.querySelector('.btn-loader') : null;
    var btnIcon = submitBtn ? submitBtn.querySelector('.btn-icon') : null;

    // i18n: read translated strings from data attributes
    var MSG_REQUIRED   = contactForm.getAttribute('data-msg-required')      || 'Please fill in all required fields.';
    var MSG_EMAIL      = contactForm.getAttribute('data-msg-email')         || 'Please enter a valid email address.';
    var MSG_SENDING    = contactForm.getAttribute('data-msg-sending')       || 'Sending...';
    var MSG_SUCCESS    = contactForm.getAttribute('data-msg-success')       || 'Message sent successfully! We will get back to you soon.';
    var MSG_ERROR      = contactForm.getAttribute('data-msg-error')         || 'Something went wrong. Please try again.';
    var MSG_NET_ERROR  = contactForm.getAttribute('data-msg-network-error') || 'An error occurred. Please try again later.';
    var MSG_SUBMIT     = contactForm.getAttribute('data-msg-submit')        || 'Send Message';

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideFormFeedback();

      // Basic validation
      var nameEl = document.getElementById('name');
      var companyEl = document.getElementById('company');
      var emailEl = document.getElementById('email');
      var messageEl = document.getElementById('message');
      var name = nameEl ? nameEl.value.trim() : '';
      var company = companyEl ? companyEl.value.trim() : '';
      var email = emailEl ? emailEl.value.trim() : '';
      var message = messageEl ? messageEl.value.trim() : '';

      if (!name || !company || !email || !message) {
        showFormFeedback('error', MSG_REQUIRED);
        return;
      }

      // Email validation
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showFormFeedback('error', MSG_EMAIL);
        return;
      }

      // Show loading state
      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.textContent = MSG_SENDING;
      if (btnLoader) btnLoader.style.display = 'inline-flex';
      if (btnIcon) btnIcon.style.display = 'none';

      // AJAX request via Fetch API
      var formData = new FormData(contactForm);
      var ajaxUrl = contactForm.getAttribute('data-ajax-url') || '/ajax/contact/';
      // Read CSRF token fresh at submit time (cookie may have rotated since load)
      var csrftoken = getCookie('csrftoken');

      fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrftoken
        },
        body: formData
      })
        .then(function (response) {
          return response.json().catch(function () {
            return { status: response.ok ? 'success' : 'error' };
          });
        })
        .then(function (data) {
          if (data.status === 'success') {
            showFormFeedback('success', data.message || MSG_SUCCESS);
            contactForm.reset();
          } else {
            showFormFeedback('error', data.message || MSG_ERROR);
          }
        })
        .catch(function (error) {
          console.error('Error:', error);
          showFormFeedback('error', MSG_NET_ERROR);
        })
        .finally(function () {
          // Reset button state
          if (submitBtn) submitBtn.disabled = false;
          if (btnText) btnText.textContent = MSG_SUBMIT;
          if (btnLoader) btnLoader.style.display = 'none';
          if (btnIcon) btnIcon.style.display = '';
        });
    });
  }

  // =============================================
  // 12. Newsletter Form AJAX
  // =============================================
  var newsletterForm = document.getElementById('newsletterForm');
  var newsletterFeedback = document.getElementById('newsletterFeedback');

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var emailInput = newsletterForm.querySelector('input[name="email"]');
      var submitBtn = newsletterForm.querySelector('.newsletter-btn');
      var email = emailInput ? emailInput.value.trim() : '';

      if (!email) return;

      if (submitBtn) submitBtn.disabled = true;
      if (newsletterFeedback) newsletterFeedback.style.display = 'none';

      var formData = new FormData(newsletterForm);
      var ajaxUrl = newsletterForm.getAttribute('data-ajax-url') || '/ajax/newsletter/';

      fetch(ajaxUrl, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
        body: formData
      })
        .then(function (response) {
          return response.json().catch(function () {
            return { status: response.ok ? 'success' : 'error' };
          });
        })
        .then(function (data) {
          if (newsletterFeedback) {
            newsletterFeedback.textContent = data.message || '';
            newsletterFeedback.className = 'newsletter-feedback ' + (data.status === 'success' ? 'success' : 'error');
            newsletterFeedback.style.display = 'block';
          }
          if (data.status === 'success' && emailInput) {
            emailInput.value = '';
          }
        })
        .catch(function () {
          if (newsletterFeedback) {
            newsletterFeedback.textContent = 'An error occurred. Please try again.';
            newsletterFeedback.className = 'newsletter-feedback error';
            newsletterFeedback.style.display = 'block';
          }
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  // =============================================
  // 13. Section-by-Section Keyboard Navigation
  // =============================================
  (function() {
    var sections = document.querySelectorAll('.hero-section, .section, .site-footer');
    if (sections.length === 0) return;

    var headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 80;
    var isScrolling = false;
    var scrollTimeout;

    // Find current section index based on scroll position
    function getCurrentSectionIndex() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var current = 0;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= headerHeight + 10) {
          current = i;
        }
      }
      return current;
    }

    // Scroll to a specific section
    function scrollToSection(index) {
      if (index < 0) index = 0;
      if (index >= sections.length) index = sections.length - 1;

      var target = sections[index];
      var targetTop = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

      window.scrollTo({
        top: targetTop,
        behavior: 'smooth'
      });
    }

    // Keyboard navigation (Arrow Up/Down, Page Up/Down)
    document.addEventListener('keydown', function(e) {
      // Don't interfere with form inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      var currentIndex = getCurrentSectionIndex();

      if (e.key === 'PageDown' || (e.key === 'ArrowDown' && e.altKey)) {
        e.preventDefault();
        scrollToSection(currentIndex + 1);
      } else if (e.key === 'PageUp' || (e.key === 'ArrowUp' && e.altKey)) {
        e.preventDefault();
        scrollToSection(currentIndex - 1);
      } else if (e.key === 'Home' && e.ctrlKey) {
        e.preventDefault();
        scrollToSection(0);
      } else if (e.key === 'End' && e.ctrlKey) {
        e.preventDefault();
        scrollToSection(sections.length - 1);
      }
    });
  })();

  // =============================================
  // 14. Section Navigation Dots
  // =============================================
  (function() {
    var sections = document.querySelectorAll('.hero-section, .section');
    if (sections.length === 0) return;

    // Create dots container
    var dotsContainer = document.createElement('nav');
    dotsContainer.className = 'section-dots';
    dotsContainer.setAttribute('aria-label', 'Section navigation');

    var headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 80;

    sections.forEach(function(section, i) {
      var dot = document.createElement('button');
      dot.className = 'section-dot';
      dot.setAttribute('aria-label', section.id || 'Section ' + (i + 1));
      dot.addEventListener('click', function() {
        var targetTop = section.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      });
      dotsContainer.appendChild(dot);
    });

    document.body.appendChild(dotsContainer);

    // Update active dot on scroll
    function updateDots() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var current = 0;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= headerHeight + 100) {
          current = i;
        }
      }
      var dots = dotsContainer.querySelectorAll('.section-dot');
      dots.forEach(function(d, idx) {
        d.classList.toggle('active', idx === current);
      });
    }

    // Throttle scroll-driven dot updates to one layout read per frame.
    var dotsTicking = false;
    window.addEventListener('scroll', function () {
      if (!dotsTicking) {
        dotsTicking = true;
        requestAnimationFrame(function () {
          updateDots();
          dotsTicking = false;
        });
      }
    }, { passive: true });
    updateDots();
  })();

});
