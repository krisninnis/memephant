/**
 * Memephant app bridge
 *
 * Runs only on Memephant app pages. It queues prepared Compress/Split drafts
 * into extension storage so the popup can insert them into an AI composer later.
 */

'use strict';

const BRIDGE_EVENT = 'MEMEPHANT_QUEUE_COMPOSER_DRAFT';
const MAX_DRAFT_LENGTH = 24000;
const allowedOrigins = new Set([
  'http://localhost:1420',
  'http://127.0.0.1:1420',
  'https://memephant.com',
  'https://www.memephant.com',
]);

console.log('Memephant bridge: app-bridge.js injected on', location.href);

function isAllowedBridgeOrigin() {
  return allowedOrigins.has(window.location.origin);
}

window.addEventListener('MEMEPHANT_APP_BRIDGE_PING', (event) => {
  if (!isAllowedBridgeOrigin()) return;

  window.dispatchEvent(new CustomEvent('MEMEPHANT_APP_BRIDGE_PING_RESPONSE', {
    detail: {
      success: true,
      href: location.href,
      received: event.detail,
      at: new Date().toISOString(),
    },
  }));
});

function redactBridgeText(value) {
  return String(value || '')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[REDACTED]')
    .replace(/\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'\s]+/gi, '[REDACTED]')
    .replace(/\b[A-Z]:[\\/][^\s"'<>]+/g, '[local-path]')
    .replace(/(^|\s)\/Users\/[^\s"'<>]+/g, '$1[local-path]')
    .replace(/(^|\s)\/home\/[^\s"'<>]+/g, '$1[local-path]');
}

function validateBridgePayload(detail) {
  if (!detail || typeof detail !== 'object') {
    return { valid: false, message: 'Missing bridge payload.' };
  }

  if (detail.source !== 'memephant-app' || detail.type !== BRIDGE_EVENT) {
    return { valid: false, message: 'Invalid bridge source.' };
  }

  const payload = detail.payload;
  if (!payload || typeof payload !== 'object') {
    return { valid: false, message: 'Missing bridge payload body.' };
  }

  if (payload.mode !== 'compress' && payload.mode !== 'split') {
    return { valid: false, message: 'Invalid draft mode.' };
  }

  if (typeof payload.text !== 'string' || !payload.text.trim()) {
    return { valid: false, message: 'Draft text is empty.' };
  }

  if (/\bmemphant_update\b/i.test(payload.text) || /\bmemphant_update\b/i.test(payload.part2 || '')) {
    return { valid: false, message: 'memphant_update blocks cannot be queued as composer drafts.' };
  }

  return { valid: true, payload };
}

function queueComposerDraft(payload) {
  if (
    typeof chrome === 'undefined' ||
    !chrome.storage ||
    !chrome.storage.local
  ) {
    return;
  }

  const text = redactBridgeText(payload.text).trim().slice(0, MAX_DRAFT_LENGTH);
  const createdAt = typeof payload.createdAt === 'string'
    ? payload.createdAt
    : new Date().toISOString();

  const pendingDraft = {
    mode: payload.mode,
    text,
    createdAt,
    source: 'memephant-app',
  };

  if (typeof payload.part2 === 'string' && payload.part2.trim()) {
    pendingDraft.part2 = redactBridgeText(payload.part2)
      .trim()
      .slice(0, MAX_DRAFT_LENGTH);
  }

  const values = {
    memephantPendingComposerDraft: pendingDraft,
  };

  chrome.storage.local.set(values, () => {
    const error = chrome.runtime?.lastError;
    if (error) {
      console.warn('Memephant bridge: could not queue draft', error);
      return;
    }

    window.dispatchEvent(new CustomEvent('MEMEPHANT_COMPOSER_DRAFT_QUEUED', {
      detail: {
        success: true,
        mode: payload.mode,
      },
    }));
  });
}

window.addEventListener(BRIDGE_EVENT, (event) => {
  if (!isAllowedBridgeOrigin()) {
    console.warn('Memephant bridge: rejected draft from unsupported origin', window.location.origin);
    return;
  }

  const result = validateBridgePayload(event.detail);

  if (!result.valid) {
    console.warn('Memephant bridge: rejected draft', result.message);
    window.dispatchEvent(new CustomEvent('MEMEPHANT_COMPOSER_DRAFT_QUEUED', {
      detail: {
        success: false,
        message: result.message,
      },
    }));
    return;
  }

  queueComposerDraft(result.payload);
});
