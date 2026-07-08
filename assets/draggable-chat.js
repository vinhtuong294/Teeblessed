(function () {
  var rootSelectors = [
    'shopify-chat',
    'shopify-agent',
    '#ShopifyChat',
    'inbox-online-store-chat',
    '#shopify-chat',
    '[id*="ShopifyChat" i]',
    '[id*="shopify-chat" i]',
    '[id*="inbox" i]',
    '[class*="shopify-chat" i]',
    '[class*="shopify-inbox" i]'
  ];
  var controlSelectors = [
    'button',
    '[role="button"]',
    'a',
    'iframe',
    '[tabindex]',
    'div'
  ];
  var threshold = 8;
  var margin = 16;
  var agentRight = margin;
  var defaultBottom = 96;
  var mobileBackToTopGap = 10;
  var activeDrag = null;
  var boundTarget = null;
  var syncFrame = null;

  function isCartPanelOpen() {
    var cartPanel = document.getElementById('cart');

    return !!(cartPanel && cartPanel.classList.contains('toggle') && cartPanel.getAttribute('aria-hidden') === 'false');
  }

  function setChatHiddenForCart(el, hidden) {
    if (!el || !el.style) return;

    if (hidden) {
      if (el.dataset.tbCartPanelHidden !== 'true') {
        el.dataset.tbCartPanelHidden = 'true';
        el.dataset.tbCartPanelDisplay = el.style.getPropertyValue('display');
        el.dataset.tbCartPanelDisplayPriority = el.style.getPropertyPriority('display');
        el.dataset.tbCartPanelVisibility = el.style.getPropertyValue('visibility');
        el.dataset.tbCartPanelVisibilityPriority = el.style.getPropertyPriority('visibility');
        el.dataset.tbCartPanelOpacity = el.style.getPropertyValue('opacity');
        el.dataset.tbCartPanelOpacityPriority = el.style.getPropertyPriority('opacity');
        el.dataset.tbCartPanelPointerEvents = el.style.getPropertyValue('pointer-events');
        el.dataset.tbCartPanelPointerEventsPriority = el.style.getPropertyPriority('pointer-events');
      }
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      return;
    }

    if (el.dataset.tbCartPanelHidden === 'true') {
      el.style.setProperty('display', el.dataset.tbCartPanelDisplay || '', el.dataset.tbCartPanelDisplayPriority || '');
      el.style.setProperty('visibility', el.dataset.tbCartPanelVisibility || '', el.dataset.tbCartPanelVisibilityPriority || '');
      el.style.setProperty('opacity', el.dataset.tbCartPanelOpacity || '', el.dataset.tbCartPanelOpacityPriority || '');
      el.style.setProperty('pointer-events', el.dataset.tbCartPanelPointerEvents || '', el.dataset.tbCartPanelPointerEventsPriority || '');
      delete el.dataset.tbCartPanelHidden;
      delete el.dataset.tbCartPanelDisplay;
      delete el.dataset.tbCartPanelDisplayPriority;
      delete el.dataset.tbCartPanelVisibility;
      delete el.dataset.tbCartPanelVisibilityPriority;
      delete el.dataset.tbCartPanelOpacity;
      delete el.dataset.tbCartPanelOpacityPriority;
      delete el.dataset.tbCartPanelPointerEvents;
      delete el.dataset.tbCartPanelPointerEventsPriority;
    }
  }

  function getTextValue(el) {
    return [
      el.tagName,
      el.id,
      el.className,
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('name'),
      el.getAttribute('src')
    ].join(' ').toLowerCase();
  }

  function isExcluded(el) {
    var value = getTextValue(el);

    return value.indexOf('jdgm') !== -1 || value.indexOf('judge') !== -1 || value.indexOf('review') !== -1 || value.indexOf('tb-chat') !== -1;
  }

  function looksLikeChat(el) {
    var value = getTextValue(el);

    return value.indexOf('chat') !== -1 || value.indexOf('inbox') !== -1 || value.indexOf('message') !== -1 || value.indexOf('support') !== -1 || value.indexOf('agent') !== -1;
  }

  function hasChatIcon(el) {
    if (!el || !el.querySelectorAll) return false;

    return !!el.querySelector('svg, path, [class*="chat" i], [class*="message" i], [class*="bubble" i]');
  }

  function rectOf(el) {
    var rect = el.getBoundingClientRect();

    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;

    var rect = el.getBoundingClientRect();
    var style = window.getComputedStyle(el);

    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function isCompactLauncher(el) {
    if (!isVisible(el) || isExcluded(el)) return false;

    var rect = el.getBoundingClientRect();

    return rect.width >= 36 && rect.height >= 36 && rect.width <= 120 && rect.height <= 120 && rect.bottom > window.innerHeight * 0.45;
  }

  function isLikelyWhiteLauncher(el) {
    var style = window.getComputedStyle(el);
    var radius = parseFloat(style.borderTopLeftRadius) || 0;
    var background = style.backgroundColor || '';

    return radius >= 8 && (background.indexOf('255, 255, 255') !== -1 || background === 'white' || background === '#fff');
  }

  function queryAll(selector, root) {
    try {
      return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function getShadowCandidates(root) {
    if (!root || !root.shadowRoot) return [];

    var candidates = [];

    controlSelectors.forEach(function (selector) {
      candidates = candidates.concat(queryAll(selector, root.shadowRoot));
    });

    return candidates.filter(function (el) {
      if (!isCompactLauncher(el)) return false;
      return looksLikeChat(el) || hasChatIcon(el) || isLikelyWhiteLauncher(el);
    });
  }

  function getRootCandidates() {
    var candidates = [];

    rootSelectors.forEach(function (selector) {
      candidates = candidates.concat(queryAll(selector));
    });

    return candidates.filter(function (el) {
      return !isExcluded(el);
    });
  }

  function getFallbackCandidates() {
    return queryAll('body *').filter(function (el) {
      if (!isCompactLauncher(el)) return false;

      var style = window.getComputedStyle(el);
      var zIndex = parseInt(style.zIndex, 10) || 0;
      var positioned = style.position === 'fixed' || style.position === 'sticky' || zIndex >= 1000;

      if (!positioned) return false;
      if (looksLikeChat(el) || hasChatIcon(el)) return true;

      return isLikelyWhiteLauncher(el) && el.getBoundingClientRect().right > window.innerWidth * 0.65;
    });
  }

  function pickBest(candidates) {
    candidates = candidates.filter(isCompactLauncher);

    if (!candidates.length) return null;

    candidates.sort(function (a, b) {
      var aRect = a.getBoundingClientRect();
      var bRect = b.getBoundingClientRect();
      var aScore = 0;
      var bScore = 0;

      if (looksLikeChat(a)) aScore += 100;
      if (looksLikeChat(b)) bScore += 100;
      if (hasChatIcon(a)) aScore += 50;
      if (hasChatIcon(b)) bScore += 50;
      if (isLikelyWhiteLauncher(a)) aScore += 20;
      if (isLikelyWhiteLauncher(b)) bScore += 20;

      aScore += aRect.right + aRect.bottom;
      bScore += bRect.right + bRect.bottom;

      return bScore - aScore;
    });

    return candidates[0];
  }

  function findChatLauncher() {
    var roots = getRootCandidates();

    for (var i = 0; i < roots.length; i += 1) {
      if (isCompactLauncher(roots[i])) return roots[i];

      var shadowTarget = pickBest(getShadowCandidates(roots[i]));
      if (shadowTarget) return shadowTarget;
    }

    return pickBest(getFallbackCandidates());
  }

  function setLauncherBase(el) {
    var moveMode = getMoveMode(el);
    var rightOffset = getRightOffset(el);
    var bottomOffset = getDefaultBottomOffset();

    el.dataset.tbChatMoveMode = moveMode;
    el.style.position = 'fixed';
    el.style.zIndex = '1000000';
    el.style.touchAction = 'none';
    el.style.userSelect = 'none';
    el.style.cursor = 'grab';

    if (moveMode === 'translate') {
      el.style.left = '';
      el.style.top = '';
      if (!hasSafeOffset(el.style.right, rightOffset)) el.style.right = rightOffset + 'px';
      if (!hasSafeOffset(el.style.bottom, bottomOffset)) el.style.bottom = bottomOffset + 'px';
    }

    if (moveMode !== 'translate' && !el.style.left && !el.style.top) {
      if (!hasSafeOffset(el.style.right, margin)) el.style.right = margin + 'px';
      if (!hasSafeOffset(el.style.bottom, bottomOffset)) el.style.bottom = bottomOffset + 'px';
    }

    keepLauncherInViewport(el, moveMode);
  }

  function getMoveMode(el) {
    var root = el.getRootNode && el.getRootNode();
    var host = root && root.host;

    if (!host) return 'position';
    if ((host.tagName || '').toLowerCase() === 'shopify-agent') return 'translate';

    var hostRect = host.getBoundingClientRect();

    if (hostRect.width > window.innerWidth * 0.8 && hostRect.height > window.innerHeight * 0.8) return 'translate';

    return 'position';
  }

  function getRightOffset(el) {
    var root = el.getRootNode && el.getRootNode();
    var host = root && root.host;

    if (host && (host.tagName || '').toLowerCase() === 'shopify-agent') return agentRight;

    return margin;
  }

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  }

  function getDefaultBottomOffset() {
    if (!isMobileViewport()) return defaultBottom;

    var backToTopLink = document.querySelector('#totop a');

    if (!backToTopLink) return defaultBottom;

    var rect = backToTopLink.getBoundingClientRect();

    if (!rect.height) return defaultBottom;

    return Math.max(defaultBottom, Math.ceil(window.innerHeight - rect.top + mobileBackToTopGap));
  }

  function getTranslate(el) {
    return {
      x: parseFloat(el.dataset.tbChatTranslateX || '0') || 0,
      y: parseFloat(el.dataset.tbChatTranslateY || '0') || 0
    };
  }

  function setTranslate(el, x, y) {
    el.dataset.tbChatTranslateX = x;
    el.dataset.tbChatTranslateY = y;
    el.style.translate = Math.round(x) + 'px ' + Math.round(y) + 'px';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function hasSafeOffset(value, minValue) {
    var parsed = parseFloat(value);

    return value && value !== 'auto' && !isNaN(parsed) && parsed >= minValue;
  }

  function keepLauncherInViewport(el, moveMode) {
    var rect = rectOf(el);
    var maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    var maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    var nextLeft = clamp(rect.left, margin, maxLeft);
    var nextTop = clamp(rect.top, margin, maxTop);

    if (!rect.width || !rect.height) return;
    if (Math.abs(nextLeft - rect.left) < 1 && Math.abs(nextTop - rect.top) < 1) return;

    if (moveMode === 'translate') {
      var translate = getTranslate(el);

      setTranslate(el, translate.x + nextLeft - rect.left, translate.y + nextTop - rect.top);
    } else {
      el.style.left = Math.round(nextLeft) + 'px';
      el.style.top = Math.round(nextTop) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }
  }

  function startDrag(el, event) {
    setLauncherBase(el);

    var rect = rectOf(el);
    var translate = getTranslate(el);

    activeDrag = {
      el: el,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
      moveMode: getMoveMode(el),
      startTranslateX: translate.x,
      startTranslateY: translate.y,
      dragging: false,
      dragged: false
    };

    if (el.setPointerCapture && event.pointerId !== undefined) {
      try {
        el.setPointerCapture(event.pointerId);
      } catch (error) {}
    }
  }

  function moveDrag(event) {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;

    var dx = event.clientX - activeDrag.startX;
    var dy = event.clientY - activeDrag.startY;

    if (!activeDrag.dragging && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
      activeDrag.dragging = true;
      activeDrag.dragged = true;
      activeDrag.el.classList.add('is-dragging');
      activeDrag.el.style.cursor = 'grabbing';
    }

    if (!activeDrag.dragging) return;

    event.preventDefault();

    var nextLeft = clamp(activeDrag.startLeft + dx, margin, window.innerWidth - activeDrag.width - margin);
    var nextTop = clamp(activeDrag.startTop + dy, margin, window.innerHeight - activeDrag.height - margin);

    if (activeDrag.moveMode === 'translate') {
      setTranslate(
        activeDrag.el,
        activeDrag.startTranslateX + nextLeft - activeDrag.startLeft,
        activeDrag.startTranslateY + nextTop - activeDrag.startTop
      );
    } else {
      activeDrag.el.style.left = Math.round(nextLeft) + 'px';
      activeDrag.el.style.top = Math.round(nextTop) + 'px';
      activeDrag.el.style.right = 'auto';
      activeDrag.el.style.bottom = 'auto';
    }
  }

  function endDrag(event) {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;

    var el = activeDrag.el;
    var dragged = activeDrag.dragged;

    if (el.releasePointerCapture && event.pointerId !== undefined) {
      try {
        el.releasePointerCapture(event.pointerId);
      } catch (error) {}
    }

    if (dragged) {
      var rect = rectOf(el);
      var snapLeft = rect.left + rect.width / 2 < window.innerWidth / 2;
      var targetLeft = snapLeft ? margin : window.innerWidth - rect.width - margin;

      if (activeDrag.moveMode === 'translate') {
        var translate = getTranslate(el);
        setTranslate(el, translate.x + targetLeft - rect.left, translate.y);
      } else {
        el.style.left = snapLeft ? margin + 'px' : 'auto';
        el.style.right = snapLeft ? 'auto' : margin + 'px';
      }
      el.dataset.tbChatJustDragged = 'true';
      window.setTimeout(function () {
        delete el.dataset.tbChatJustDragged;
      }, 500);
    }

    el.classList.remove('is-dragging');
    el.style.cursor = 'grab';
    activeDrag = null;
  }

  function bindLauncher(el) {
    if (!el || boundTarget === el || el.dataset.tbChatDraggable === 'true') return;

    if (boundTarget) {
      boundTarget.dataset.tbChatDraggable = '';
    }

    boundTarget = el;
    el.dataset.tbChatDraggable = 'true';
    setLauncherBase(el);

    el.addEventListener('pointerdown', function (event) {
      startDrag(el, event);
    });

    el.addEventListener(
      'click',
      function (event) {
        if (el.dataset.tbChatJustDragged === 'true') {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true
    );
  }

  function syncLauncher() {
    if (syncFrame) return;

    syncFrame = window.requestAnimationFrame(function () {
      syncFrame = null;

      if (activeDrag) return;

      if (boundTarget && boundTarget.dataset.tbCartPanelHidden === 'true' && !isCartPanelOpen()) {
        setChatHiddenForCart(boundTarget, false);
      }

      var launcher = findChatLauncher();

      if (launcher) {
        bindLauncher(launcher);
        if (isCartPanelOpen()) {
          setChatHiddenForCart(launcher, true);
          return;
        }
        setChatHiddenForCart(launcher, false);
        setLauncherBase(launcher);
      }
    });
  }

  document.addEventListener('pointermove', moveDrag, { passive: false });
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', syncLauncher);

  new MutationObserver(syncLauncher).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-hidden', 'class'],
    childList: true,
    subtree: true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncLauncher);
  } else {
    syncLauncher();
  }
})();
