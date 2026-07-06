(function () {
  function makeChatBoxDraggable(selector) {
    var el = document.querySelector(selector);
    if (!el || el.dataset.draggableChatReady === 'true') return;

    var isPointerDown = false;
    var isDragging = false;
    var wasDragged = false;
    var activePointerId = null;
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;
    var threshold = 8;
    var margin = 16;
    var expandedActive = false;
    var lastCompactStyles = null;
    var resetWasDraggedTimer = null;

    el.dataset.draggableChatReady = 'true';

    function isExpanded() {
      var rect = el.getBoundingClientRect();
      return rect.height > 180;
    }

    function hasPositionValue(value) {
      return value && value !== 'auto';
    }

    function normalizeCompactPosition() {
      var hasLeft = hasPositionValue(el.style.left);
      var hasRight = hasPositionValue(el.style.right);
      var hasTop = hasPositionValue(el.style.top);
      var hasBottom = hasPositionValue(el.style.bottom);

      if (hasLeft && hasRight) {
        el.style.left = '';
        el.style.right = margin + 'px';
      }

      if (hasTop && hasBottom) {
        el.style.top = '';
        el.style.bottom = '96px';
      }
    }

    function rememberCompactStyles() {
      if (isExpanded()) return;

      lastCompactStyles = {
        left: el.style.left,
        top: el.style.top,
        right: el.style.right,
        bottom: el.style.bottom
      };
    }

    function applyCompactStyles() {
      el.style.position = 'fixed';
      normalizeCompactPosition();

      if (!lastCompactStyles && !hasPositionValue(el.style.left) && !hasPositionValue(el.style.top)) {
        el.style.right = margin + 'px';
        el.style.bottom = '96px';
      } else {
        el.style.right = el.style.right || margin + 'px';
        el.style.bottom = el.style.bottom || '96px';
      }

      el.style.touchAction = 'none';
      el.style.userSelect = 'none';
      el.style.zIndex = '999999';
      rememberCompactStyles();
    }

    function restoreCompactStyles() {
      expandedActive = false;

      if (lastCompactStyles) {
        el.style.left = lastCompactStyles.left;
        el.style.top = lastCompactStyles.top;
        el.style.right = lastCompactStyles.right;
        el.style.bottom = lastCompactStyles.bottom;
      } else {
        el.style.left = '';
        el.style.top = '';
        el.style.right = margin + 'px';
        el.style.bottom = '96px';
      }

      applyCompactStyles();
    }

    function applyExpandedStyles() {
      var expandedMargin = window.innerWidth <= 480 ? 0 : margin;

      expandedActive = true;
      el.style.left = '';
      el.style.top = '';
      el.style.right = expandedMargin + 'px';
      el.style.bottom = expandedMargin + 'px';
      el.style.touchAction = 'auto';
      el.style.userSelect = 'auto';
      el.style.zIndex = '999999';
    }

    function syncChatState() {
      if (isPointerDown || isDragging) return;

      if (isExpanded()) {
        applyExpandedStyles();
      } else if (expandedActive) {
        restoreCompactStyles();
      } else {
        applyCompactStyles();
      }
    }

    function releasePointer(event) {
      if (el.hasPointerCapture && event.pointerId !== undefined && el.hasPointerCapture(event.pointerId)) {
        try {
          el.releasePointerCapture(event.pointerId);
        } catch (error) {}
      }
    }

    function clearDragState() {
      isPointerDown = false;
      isDragging = false;
      activePointerId = null;
      el.classList.remove('is-dragging');
    }

    function scheduleWasDraggedReset() {
      window.clearTimeout(resetWasDraggedTimer);
      resetWasDraggedTimer = window.setTimeout(function () {
        wasDragged = false;
      }, 500);
    }

    el.addEventListener('pointerdown', function (event) {
      if (isExpanded()) return;

      var rect = el.getBoundingClientRect();

      isDragging = false;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      isPointerDown = true;
      activePointerId = event.pointerId;
      wasDragged = false;
      window.clearTimeout(resetWasDraggedTimer);
      applyCompactStyles();

      if (el.setPointerCapture && event.pointerId !== undefined) {
        try {
          el.setPointerCapture(event.pointerId);
        } catch (error) {}
      }
    });

    document.addEventListener('pointermove', function (event) {
      if (!isPointerDown || event.pointerId !== activePointerId) return;
      if (isExpanded()) return;

      var dx = event.clientX - startX;
      var dy = event.clientY - startY;

      if (!isDragging && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        isDragging = true;
        wasDragged = true;
        el.classList.add('is-dragging');
      }

      if (!isDragging) return;

      event.preventDefault();

      var nextLeft = startLeft + dx;
      var nextTop = startTop + dy;
      var maxLeft = Math.max(margin, window.innerWidth - el.offsetWidth - margin);
      var maxTop = Math.max(margin, window.innerHeight - el.offsetHeight - margin);

      nextLeft = Math.max(margin, Math.min(nextLeft, maxLeft));
      nextTop = Math.max(margin, Math.min(nextTop, maxTop));

      el.style.left = nextLeft + 'px';
      el.style.top = nextTop + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }, { passive: false });

    document.addEventListener('pointerup', function (event) {
      if (!isPointerDown || event.pointerId !== activePointerId) return;

      releasePointer(event);

      if (isDragging) {
        var rect = el.getBoundingClientRect();
        var snapLeft = rect.left + rect.width / 2 < window.innerWidth / 2;

        el.style.left = snapLeft ? margin + 'px' : 'auto';
        el.style.right = snapLeft ? 'auto' : margin + 'px';
        rememberCompactStyles();
        scheduleWasDraggedReset();
      }

      clearDragState();
    });

    document.addEventListener('pointercancel', function (event) {
      if (!isPointerDown || event.pointerId !== activePointerId) return;

      releasePointer(event);
      clearDragState();
    });

    el.addEventListener(
      'click',
      function (event) {
        if (wasDragged) {
          event.preventDefault();
          event.stopImmediatePropagation();
          wasDragged = false;
        }
      },
      true
    );

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        window.requestAnimationFrame(function () {
          syncChatState();
        });
      }).observe(el);
    }

    syncChatState();
  }

  function initDraggableChat() {
    makeChatBoxDraggable('#ShopifyChat');
  }

  var observer = new MutationObserver(initDraggableChat);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDraggableChat);
  } else {
    initDraggableChat();
  }
})();
