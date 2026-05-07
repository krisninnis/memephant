/**
 * Memephant — Content Script
 *
 * Runs on ChatGPT, Claude, Grok, Perplexity, and Gemini pages.
 *
 * Jobs:
 *  1. DETECT — Watch AI responses for memphant_update JSON blocks.
 *  2. INJECT — Add manual "🐘 Copy for Memphant" buttons when Manual mode is active.
 *  3. PROMPT TOOLS — Compress, Split, Paste Part 2, and Undo directly in the AI composer.
 */

'use strict';

// ─── Platform detection ────────────────────────────────────────────────────────

const PLATFORM = (() => {
  const h = location.hostname;
  if (h.includes('chatgpt.com') || h.includes('chat.openai.com')) return 'chatgpt';
  if (h.includes('claude.ai')) return 'claude';
  if (h.includes('grok.com') || h.includes('x.com')) return 'grok';
  if (h.includes('perplexity.ai')) return 'perplexity';
  if (h.includes('gemini.google')) return 'gemini';
  return 'unknown';
})();

const PLATFORM_LABEL = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  grok: 'Grok',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  unknown: 'AI',
}[PLATFORM];

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  /**
   * auto:
   *   Hide the bottom-right update floater and manual injected buttons.
   *
   * manual:
   *   Show the bottom-right "Memphant update detected" floater and
   *   inject "🐘 Copy for Memphant" buttons on AI responses.
   */
  memephantMemoryMode: 'auto',
};

let extensionSettings = { ...DEFAULT_SETTINGS };

function canUseChromeStorage() {
  return Boolean(
    typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.local,
  );
}

function isAutomaticMemoryMode() {
  return (
    extensionSettings.memephantMemoryMode === 'auto' ||
    extensionSettings.memephantMemoryMode === 'automatic' ||
    extensionSettings.memephantAutomaticMode === true ||
    extensionSettings.memoryBridgeMode === 'automatic'
  );
}

function loadSettings() {
  return new Promise((resolve) => {
    if (!canUseChromeStorage()) {
      resolve({ ...DEFAULT_SETTINGS });
      return;
    }

    chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
      const error = chrome.runtime?.lastError;

      if (error) {
        console.warn('Memephant: could not load extension settings', error);
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }

      resolve({
        ...DEFAULT_SETTINGS,
        ...(items || {}),
      });
    });
  });
}

function listenForSettingsChanges() {
  if (
    typeof chrome === 'undefined' ||
    !chrome.storage ||
    !chrome.storage.onChanged
  ) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const relevantKeys = [
      'memephantMemoryMode',
      'memephantAutomaticMode',
      'memoryBridgeMode',
    ];

    const hasRelevantChange = relevantKeys.some((key) => changes[key]);
    if (!hasRelevantChange) return;

    for (const key of relevantKeys) {
      if (changes[key]) {
        extensionSettings[key] = changes[key].newValue;
      }
    }

    extensionSettings = {
      ...DEFAULT_SETTINGS,
      ...extensionSettings,
    };

    if (isAutomaticMemoryMode()) {
      dismissFloater();
      removeAllInjectedButtons();
    } else {
      injectAllButtons();
    }

    console.log('Memephant: extension settings updated', extensionSettings);
  });
}

// ─── State ────────────────────────────────────────────────────────────────────

let lastDetectedJson = null;
let toastTimeout = null;
let observerActive = false;

// ─── Detection logic ──────────────────────────────────────────────────────────

const PROJECT_FIELDS = [
  'summary',
  'currentState',
  'goals',
  'rules',
  'decisions',
  'nextSteps',
  'openQuestions',
  'importantAssets',
];

function hasProjectFields(obj) {
  return typeof obj === 'object' && obj !== null &&
    PROJECT_FIELDS.some((f) => f in obj);
}

function tryParseJson(str) {
  try {
    const parsed = JSON.parse(str.trim());
    return hasProjectFields(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractUpdateFromText(text) {
  if (!text || text.length < 20) return null;

  const m1 = text.match(/memphant_update\s*[\r\n]*(\{[\s\S]*?\})/i);
  if (m1) {
    const parsed = tryParseJson(m1[1]);
    if (parsed) return parsed;
  }

  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const parsed = tryParseJson(m[1]);
    if (parsed) return parsed;
  }

  const m3 = text.match(
    /\{[\s\S]*?"(?:summary|goals|decisions|currentState|nextSteps|openQuestions)"[\s\S]*?\}/,
  );
  if (m3) {
    const parsed = tryParseJson(m3[0]);
    if (parsed) return parsed;
  }

  return null;
}

// ─── DOM selectors per platform ───────────────────────────────────────────────

const RESPONSE_SELECTORS = {
  chatgpt: '[data-message-author-role="assistant"], .markdown.prose',
  claude: '[data-testid="assistant-message"], .font-claude-message',
  grok: '[class*="ModelResponse"], [class*="message-bubble"]',
  perplexity: '[class*="AnswerBody"], [class*="prose"]',
  gemini: 'model-response, [class*="model-response"]',
  unknown: 'article, main',
};

const COMPOSER_SELECTORS = {
  chatgpt: [
    '#prompt-textarea',
    '[data-testid="prompt-textarea"]',
    'textarea[data-testid="prompt-textarea"]',
    'div[contenteditable="true"][data-testid="prompt-textarea"]',
    'div[contenteditable="true"]',
    '.ProseMirror',
    'textarea',
  ],
  claude: [
    'div[contenteditable="true"]',
    '.ProseMirror',
    'textarea',
  ],
  grok: [
    'textarea',
    'div[contenteditable="true"]',
    '.ProseMirror',
  ],
  perplexity: [
    'textarea',
    'div[contenteditable="true"]',
    '.ProseMirror',
  ],
  gemini: [
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"]',
    'textarea',
  ],
  unknown: [
    'textarea',
    'input[type="text"]',
    'div[contenteditable="true"]',
    '.ProseMirror',
  ],
};

function getPageText() {
  const seen = new Set();
  let combined = '';
  const selector = `${RESPONSE_SELECTORS[PLATFORM] || ''}, article, main`;

  try {
    document.querySelectorAll(selector).forEach((node) => {
      if (!seen.has(node)) {
        seen.add(node);
        combined += `\n${node.innerText}`;
      }
    });
  } catch {
    // Ignore selector/runtime issues on unsupported page shapes.
  }

  return combined;
}

// ─── Floating banner / status ─────────────────────────────────────────────────

function getOrCreateFloater() {
  let el = document.getElementById('mph-floater');

  if (!el) {
    el = document.createElement('div');
    el.id = 'mph-floater';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }

  return el;
}

function showFloater(updateJson) {
  lastDetectedJson = updateJson;

  if (isAutomaticMemoryMode()) {
    dismissFloater();
    console.log('Memephant: update floater suppressed in automatic memory mode');
    return;
  }

  const floater = getOrCreateFloater();
  const fieldCount = PROJECT_FIELDS.filter((f) => updateJson[f] !== undefined).length;
  const arrayFields = ['goals', 'rules', 'decisions', 'nextSteps', 'openQuestions', 'importantAssets'];
  const itemCount = arrayFields.reduce(
    (sum, field) => sum + (Array.isArray(updateJson[field]) ? updateJson[field].length : 0),
    0,
  );

  const summary = itemCount > 0
    ? `${itemCount} item${itemCount !== 1 ? 's' : ''} across ${fieldCount} field${fieldCount !== 1 ? 's' : ''}`
    : `${fieldCount} field${fieldCount !== 1 ? 's' : ''} updated`;

  floater.innerHTML = `
    <div class="mph-floater__inner">
      <span class="mph-floater__icon">🐘</span>
      <div class="mph-floater__body">
        <span class="mph-floater__title">Memephant update detected</span>
        <span class="mph-floater__summary">${summary}</span>
      </div>
      <button class="mph-floater__btn" id="mph-copy-btn">Copy &amp; apply</button>
      <button class="mph-floater__dismiss" id="mph-dismiss-btn" aria-label="Dismiss">✕</button>
    </div>`;

  floater.classList.add('mph-floater--visible');

  document.getElementById('mph-copy-btn')?.addEventListener('click', handleCopy);
  document.getElementById('mph-dismiss-btn')?.addEventListener('click', dismissFloater);
}

function dismissFloater() {
  const el = document.getElementById('mph-floater');
  if (el) el.classList.remove('mph-floater--visible');
}

function showToast(message, isError = false) {
  if (isAutomaticMemoryMode()) {
    dismissFloater();
    return;
  }

  const floater = getOrCreateFloater();

  floater.innerHTML = `
    <div class="mph-floater__inner mph-floater__inner--toast${isError ? ' mph-floater__inner--error' : ''}">
      <span class="mph-floater__icon">${isError ? '⚠️' : '✅'}</span>
      <span class="mph-floater__toast-msg">${message}</span>
    </div>`;

  floater.classList.add('mph-floater--visible');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(dismissFloater, 3000);
}

function showSmallStatus(message, isError = false) {
  const id = 'mph-small-status';
  let el = document.getElementById(id);

  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.position = 'fixed';
    el.style.right = '16px';
    el.style.bottom = '16px';
    el.style.zIndex = '2147483647';
    el.style.maxWidth = '340px';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '10px';
    el.style.fontFamily = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    el.style.fontSize = '13px';
    el.style.lineHeight = '1.35';
    el.style.boxShadow = '0 10px 24px rgba(0,0,0,0.3)';
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.style.background = isError ? '#3a1515' : '#102a1c';
  el.style.border = isError ? '1px solid #7f1d1d' : '1px solid #166534';
  el.style.color = isError ? '#fecaca' : '#bbf7d0';
  el.hidden = false;

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.hidden = true;
  }, 3000);
}

async function handleCopy() {
  if (!lastDetectedJson) return;

  const payload = `memphant_update\n${JSON.stringify(lastDetectedJson, null, 2)}`;

  try {
    await navigator.clipboard.writeText(payload);
    showToast('Copied! Switch to Memphant and paste.');
    sendRuntimeMessageSafely({ type: 'UPDATE_COPIED' });
  } catch {
    showToast('Could not copy — try again.', true);
  }
}

// ─── Hide floater after prompt submit ─────────────────────────────────────────

function isComposerElement(target) {
  if (!target || !(target instanceof Element)) return false;

  return Boolean(
    target.closest('#prompt-textarea') ||
      target.closest('[data-testid="prompt-textarea"]') ||
      target.closest('textarea') ||
      target.closest('input[type="text"]') ||
      target.closest('div[contenteditable="true"]') ||
      target.closest('.ProseMirror'),
  );
}

function isSendButton(target) {
  if (!target || !(target instanceof Element)) return false;

  const button = target.closest('button');
  if (!button) return false;

  const label = [
    button.getAttribute('aria-label') || '',
    button.getAttribute('data-testid') || '',
    button.title || '',
    button.textContent || '',
  ].join(' ').toLowerCase();

  return (
    label.includes('send') ||
    label.includes('submit') ||
    label.includes('stop streaming')
  );
}

function attachSubmitDismissWatcher() {
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter') return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      if (!isComposerElement(event.target)) return;

      setTimeout(dismissFloater, 0);
      setTimeout(dismissFloater, 300);
      setTimeout(dismissFloater, 1200);
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      if (!isSendButton(event.target)) return;

      setTimeout(dismissFloater, 0);
      setTimeout(dismissFloater, 300);
      setTimeout(dismissFloater, 1200);
    },
    true,
  );
}

// ─── Inject "Copy for Memphant" buttons ───────────────────────────────────────

function injectCopyButton(node) {
  if (!node || node.dataset.mphInjected) return;

  node.dataset.mphInjected = 'true';

  const btn = document.createElement('button');
  btn.className = 'mph-inject-btn';
  btn.title = `Copy this ${PLATFORM_LABEL} response into Memphant`;
  btn.innerHTML = '🐘 Copy for Memphant';

  btn.addEventListener('click', async (event) => {
    event.stopPropagation();

    const text = node.innerText || '';
    const payload = `--- ${PLATFORM_LABEL} response (paste into Memphant) ---\n\n${text}`;

    try {
      await navigator.clipboard.writeText(payload);
      btn.textContent = '✅ Copied!';
      setTimeout(() => {
        btn.innerHTML = '🐘 Copy for Memphant';
      }, 2000);
    } catch {
      btn.textContent = '⚠️ Failed';
    }
  });

  const anchor =
    node.querySelector('[class*="action"], [class*="footer"], [class*="toolbar"]') || node;

  anchor.appendChild(btn);
}

function removeAllInjectedButtons() {
  document.querySelectorAll('.mph-inject-btn').forEach((btn) => {
    const parent = btn.parentElement;
    btn.remove();

    if (parent?.dataset?.mphInjected) {
      delete parent.dataset.mphInjected;
    }
  });

  document.querySelectorAll('[data-mph-injected="true"], [data-mphInjected="true"]').forEach((node) => {
    delete node.dataset.mphInjected;
  });
}

function injectAllButtons() {
  if (isAutomaticMemoryMode()) {
    removeAllInjectedButtons();
    return;
  }

  const selectorMap = {
    chatgpt: '[data-message-author-role="assistant"]',
    claude: '[data-testid="assistant-message"]',
    grok: '[class*="ModelResponse"]',
    perplexity: '[class*="AnswerBody"]',
    gemini: 'model-response',
  };

  const selector = selectorMap[PLATFORM];

  if (selector) {
    document.querySelectorAll(selector).forEach(injectCopyButton);
  }
}

// ─── Prompt Tools: composer helpers ───────────────────────────────────────────

function isElementVisible(el) {
  if (!el || !(el instanceof Element)) return false;

  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  );
}

function getActiveComposer() {
  const active = document.activeElement;

  if (
    active &&
    isComposerElement(active) &&
    isElementVisible(active) &&
    !active.disabled &&
    !active.readOnly
  ) {
    return active.closest('#prompt-textarea, [data-testid="prompt-textarea"], textarea, input[type="text"], div[contenteditable="true"], .ProseMirror') || active;
  }

  const selectors = COMPOSER_SELECTORS[PLATFORM] || COMPOSER_SELECTORS.unknown;

  for (const selector of selectors) {
    const candidates = Array.from(document.querySelectorAll(selector));

    for (const candidate of candidates) {
      if (!isElementVisible(candidate)) continue;
      if (candidate.disabled || candidate.readOnly) continue;

      const ariaHidden = candidate.getAttribute('aria-hidden');
      if (ariaHidden === 'true') continue;

      return candidate;
    }
  }

  return null;
}

function readComposerText(el) {
  if (!el) return '';

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value || '';
  }

  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    return el.innerText || el.textContent || '';
  }

  const nestedTextarea = el.querySelector?.('textarea, input[type="text"]');
  if (nestedTextarea) {
    return readComposerText(nestedTextarea);
  }

  const nestedEditable = el.querySelector?.('div[contenteditable="true"], .ProseMirror');
  if (nestedEditable) {
    return readComposerText(nestedEditable);
  }

  return el.innerText || el.textContent || '';
}

function dispatchComposerInputEvents(el, text) {
  try {
    el.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    }));
  } catch {
    // Some pages/browsers do not allow constructing InputEvent here.
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  try {
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text,
    }));
  } catch {
    // Synthetic Event fallback above is enough for textarea/input.
  }
}

function setNativeValue(el, value) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : null;

  const descriptor = proto
    ? Object.getOwnPropertyDescriptor(proto, 'value')
    : null;

  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
}

function writeComposerText(el, text) {
  if (!el) return false;

  const nestedTextarea = !(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)
    ? el.querySelector?.('textarea, input[type="text"]')
    : null;

  if (nestedTextarea) {
    return writeComposerText(nestedTextarea, text);
  }

  const nestedEditable = !el.isContentEditable && el.getAttribute('contenteditable') !== 'true'
    ? el.querySelector?.('div[contenteditable="true"], .ProseMirror')
    : null;

  if (nestedEditable) {
    return writeComposerText(nestedEditable, text);
  }

  el.focus();

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    setNativeValue(el, text);
    dispatchComposerInputEvents(el, text);
    el.focus();
    return readComposerText(el).trim() === text.trim();
  }

  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.classList.contains('ProseMirror')) {
    try {
      const selection = window.getSelection();
      const range = document.createRange();

      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);

      const inserted = document.execCommand('insertText', false, text);
      dispatchComposerInputEvents(el, text);
      el.focus();

      if (inserted && readComposerText(el).trim() === text.trim()) {
        return true;
      }
    } catch {
      // Fall back below.
    }

    el.textContent = text;
    dispatchComposerInputEvents(el, text);
    el.focus();
    return readComposerText(el).trim() === text.trim();
  }

  el.textContent = text;
  dispatchComposerInputEvents(el, text);
  el.focus();
  return readComposerText(el).trim() === text.trim();
}

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

function hasBlockedUpdatePayload(value) {
  return /\bmemphant_update\b/i.test(String(value || ''));
}

function storageSetLocal(values) {
  return new Promise((resolve, reject) => {
    if (!canUseChromeStorage()) {
      resolve();
      return;
    }

    chrome.storage.local.set(values, () => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function storageRemoveLocal(keys) {
  return new Promise((resolve, reject) => {
    if (!canUseChromeStorage()) {
      resolve();
      return;
    }

    chrome.storage.local.remove(keys, () => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function mphCompressPrompt(input) {
  let text = String(input || '').trim();

  if (!text) return text;

  const replacements = [
    [/\bcould you please\b/gi, ''],
    [/\bcan you please\b/gi, ''],
    [/\bplease\b/gi, ''],
    [/\bhelp me to\b/gi, ''],
    [/\bhelp me\b/gi, ''],
    [/\bso that it becomes\b/gi, 'to be'],
    [/\bin order to\b/gi, 'to'],
    [/\balso adds?\b/gi, 'add'],
    [/\band also\b/gi, 'and'],
    [/\bjust\b/gi, ''],
    [/\breally\b/gi, ''],
    [/\bbasically\b/gi, ''],
    [/\bi would like you to\b/gi, ''],
    [/\bi want you to\b/gi, ''],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  text = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();

  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}

function mphSplitPrompt(input) {
  const text = String(input || '').trim();

  if (text.length < 180) {
    return [text, ''];
  }

  const midpoint = Math.floor(text.length / 2);
  const searchWindow = text.slice(
    Math.max(0, midpoint - 120),
    Math.min(text.length, midpoint + 120),
  );

  const breakMatches = Array.from(searchWindow.matchAll(/[.!?]\s+|\n\n|\n/g));
  let splitIndex = -1;

  if (breakMatches.length > 0) {
    const best = breakMatches.reduce((closest, match) => {
      const absoluteIndex = Math.max(0, midpoint - 120) + match.index + match[0].length;
      const distance = Math.abs(absoluteIndex - midpoint);

      if (!closest || distance < closest.distance) {
        return { absoluteIndex, distance };
      }

      return closest;
    }, null);

    splitIndex = best.absoluteIndex;
  }

  if (splitIndex < 0) {
    const before = text.lastIndexOf(' ', midpoint);
    const after = text.indexOf(' ', midpoint);
    splitIndex = before > 80 ? before : after;
  }

  if (splitIndex <= 0 || splitIndex >= text.length - 1) {
    return [text, ''];
  }

  const part1 = text.slice(0, splitIndex).trim();
  const part2 = text.slice(splitIndex).trim();

  if (!part1 || !part2) {
    return [text, ''];
  }

  return [part1, part2];
}

// ─── Prompt Tools: handlers ───────────────────────────────────────────────────

async function handleCompressComposer() {
  const el = getActiveComposer();

  if (!el) {
    showSmallStatus('No text input found on this page.', true);
    return { success: false, message: 'No text input found.' };
  }

  const original = readComposerText(el);

  if (!original.trim()) {
    showSmallStatus('Nothing to compress — the composer is empty.');
    return { success: false, message: 'Composer is empty.' };
  }

  const compressed = redactBridgeText(mphCompressPrompt(original));

  if (compressed === original.trim()) {
    showSmallStatus('Nothing to compress.');
    return { success: false, message: 'Nothing to compress.' };
  }

  if (hasBlockedUpdatePayload(compressed)) {
    showSmallStatus('Composer draft contains a blocked update payload.', true);
    return { success: false, message: 'Composer draft contains a blocked update payload.' };
  }

  const wrote = writeComposerText(el, compressed);

  if (!wrote) {
    showSmallStatus('Could not write compressed prompt.', true);
    return { success: false, message: 'Could not write compressed prompt.' };
  }

  await storageSetLocal({
    memephantPromptToolUndo: {
      action: 'compress',
      originalText: original,
      replacementText: compressed,
      createdAt: new Date().toISOString(),
      platform: PLATFORM,
    },
  });

  try {
    await navigator.clipboard.writeText(compressed);
  } catch {
    // Clipboard is a backup only. The composer has already been updated.
  }

  showSmallStatus('Prompt compressed. Undo available.');
  return { success: true, action: 'compress' };
}

async function handleSplitComposer() {
  const el = getActiveComposer();

  if (!el) {
    showSmallStatus('No text input found on this page.', true);
    return { success: false, message: 'No text input found.' };
  }

  const original = readComposerText(el);

  if (!original.trim()) {
    showSmallStatus('Nothing to split — the composer is empty.');
    return { success: false, message: 'Composer is empty.' };
  }

  const [rawPart1, rawPart2] = mphSplitPrompt(original);
  const part1 = redactBridgeText(rawPart1);
  const part2 = redactBridgeText(rawPart2);

  if (!part2) {
    showSmallStatus('Prompt is too short to split.');
    return { success: false, message: 'Prompt is too short to split.' };
  }

  if (hasBlockedUpdatePayload(part1) || hasBlockedUpdatePayload(part2)) {
    showSmallStatus('Composer draft contains a blocked update payload.', true);
    return { success: false, message: 'Composer draft contains a blocked update payload.' };
  }

  const wrote = writeComposerText(el, part1);

  if (!wrote) {
    showSmallStatus('Could not write split prompt.', true);
    return { success: false, message: 'Could not write split prompt.' };
  }

  await storageSetLocal({
    memephantPromptToolUndo: {
      action: 'split',
      originalText: original,
      replacementText: part1,
      createdAt: new Date().toISOString(),
      platform: PLATFORM,
    },
    memephantPendingSplitPart2: part2,
  });

  try {
    await navigator.clipboard.writeText(part2);
    showSmallStatus('Part 1 inserted. Part 2 copied. Undo available.');
  } catch {
    showSmallStatus('Part 1 inserted. Part 2 saved. Undo available.');
  }

  return { success: true, action: 'split' };
}

function handlePastePart2Composer() {
  return new Promise((resolve) => {
    if (!canUseChromeStorage()) {
      showSmallStatus('Storage unavailable.', true);
      resolve({ success: false, message: 'Storage unavailable.' });
      return;
    }

    chrome.storage.local.get({ memephantPendingSplitPart2: '' }, async (items) => {
      void chrome.runtime?.lastError;

      const part2 = items.memephantPendingSplitPart2;

      if (!part2) {
        showSmallStatus('No pending Part 2 found.');
        resolve({ success: false, message: 'No pending Part 2 found.' });
        return;
      }

      const el = getActiveComposer();

      if (!el) {
        showSmallStatus('No text input found on this page.', true);
        resolve({ success: false, message: 'No text input found.' });
        return;
      }

      const wrote = writeComposerText(el, part2);

      if (!wrote) {
        showSmallStatus('Could not paste Part 2.', true);
        resolve({ success: false, message: 'Could not paste Part 2.' });
        return;
      }

      try {
        await storageRemoveLocal('memephantPendingSplitPart2');
      } catch {
        showSmallStatus('Part 2 pasted, but could not clear pending Part 2.', true);
      }

      try {
        await navigator.clipboard.writeText(part2);
      } catch {
        // Composer update succeeded; clipboard is only a backup.
      }

      showSmallStatus('Part 2 pasted into composer.');
      resolve({ success: true, action: 'paste_part2' });
    });
  });
}

function handleUndoComposer() {
  return new Promise((resolve) => {
    if (!canUseChromeStorage()) {
      showSmallStatus('Nothing to undo.', true);
      resolve({ success: false, message: 'Nothing to undo.' });
      return;
    }

    chrome.storage.local.get({ memephantPromptToolUndo: null }, (items) => {
      void chrome.runtime?.lastError;

      const undoEntry = items.memephantPromptToolUndo;

      if (!undoEntry || typeof undoEntry.originalText !== 'string') {
        showSmallStatus('Nothing to undo.');
        resolve({ success: false, message: 'Nothing to undo.' });
        return;
      }

      const el = getActiveComposer();

      if (!el) {
        showSmallStatus('Could not restore prompt.', true);
        resolve({ success: false, message: 'Could not restore prompt.' });
        return;
      }

      const wrote = writeComposerText(el, undoEntry.originalText);

      if (!wrote) {
        showSmallStatus('Could not restore prompt.', true);
        resolve({ success: false, message: 'Could not restore prompt.' });
        return;
      }

      const keysToRemove = ['memephantPromptToolUndo'];
      if (undoEntry.action === 'split' || undoEntry.pendingPart2 === true) {
        keysToRemove.push('memephantPendingSplitPart2');
      }

      chrome.storage.local.remove(keysToRemove, () => {
        void chrome.runtime?.lastError;
      });

      showSmallStatus('Original prompt restored.');
      resolve({ success: true, action: 'undo', undoAction: undoEntry.action });
    });
  });
}

function handleInsertPendingDraft() {
  return new Promise((resolve) => {
    if (!canUseChromeStorage()) {
      showSmallStatus('Storage unavailable.', true);
      resolve({ success: false, message: 'Storage unavailable.' });
      return;
    }

    chrome.storage.local.get({ memephantPendingComposerDraft: null }, async (items) => {
      void chrome.runtime?.lastError;

      const pendingDraft = items.memephantPendingComposerDraft;

      if (
        !pendingDraft ||
        pendingDraft.source !== 'memephant-app' ||
        typeof pendingDraft.text !== 'string' ||
        !pendingDraft.text.trim()
      ) {
        showSmallStatus('No pending draft found.');
        resolve({ success: false, message: 'No pending draft found.' });
        return;
      }

      const el = getActiveComposer();

      if (!el) {
        showSmallStatus('No text input found on this page.', true);
        resolve({ success: false, message: 'No text input found.' });
        return;
      }

      const original = readComposerText(el);
      if (pendingDraft.mode !== 'compress' && pendingDraft.mode !== 'split') {
        showSmallStatus('Pending draft has an invalid mode.', true);
        resolve({ success: false, message: 'Pending draft has an invalid mode.' });
        return;
      }

      if (hasBlockedUpdatePayload(pendingDraft.text) || hasBlockedUpdatePayload(pendingDraft.part2)) {
        showSmallStatus('Pending draft contains a blocked update payload.', true);
        resolve({ success: false, message: 'Pending draft contains a blocked update payload.' });
        return;
      }

      const replacement = redactBridgeText(pendingDraft.text).trim();
      const part2 =
        pendingDraft.mode === 'split' && typeof pendingDraft.part2 === 'string'
          ? redactBridgeText(pendingDraft.part2).trim()
          : '';

      if (!replacement) {
        showSmallStatus('Pending draft is empty after sanitising.', true);
        resolve({ success: false, message: 'Pending draft is empty after sanitising.' });
        return;
      }

      const wrote = writeComposerText(el, replacement);

      if (!wrote) {
        showSmallStatus('Could not insert pending draft.', true);
        resolve({ success: false, message: 'Could not insert pending draft.' });
        return;
      }

      const values = {
        memephantPromptToolUndo: {
          action: 'insert_pending_draft',
          originalText: original,
          replacementText: replacement,
          createdAt: new Date().toISOString(),
          platform: PLATFORM,
          pendingPart2: Boolean(part2),
        },
      };

      if (part2) {
        values.memephantPendingSplitPart2 = part2;
      }

      try {
        await storageSetLocal(values);
        await storageRemoveLocal('memephantPendingComposerDraft');
      } catch {
        showSmallStatus('Draft inserted, but extension storage could not be updated.', true);
        resolve({ success: false, message: 'Draft inserted, but extension storage could not be updated.' });
        return;
      }

      showSmallStatus('Pending draft inserted. Nothing was sent.');
      resolve({ success: true, action: 'insert_pending_draft' });
    });
  });
}

// ─── Observer ─────────────────────────────────────────────────────────────────

let scanDebounce = null;

function sendRuntimeMessageSafely(message) {
  try {
    if (
      typeof chrome === 'undefined' ||
      !chrome.runtime ||
      !chrome.runtime.id ||
      typeof chrome.runtime.sendMessage !== 'function'
    ) {
      return;
    }

    chrome.runtime.sendMessage(message, () => {
      // Swallow lastError so stale tabs do not throw after extension reloads.
      void chrome.runtime.lastError;
    });
  } catch {
    // Extension may have reloaded while this page still had an old content script.
  }
}

function scheduleScan() {
  clearTimeout(scanDebounce);

  scanDebounce = setTimeout(() => {
    const text = getPageText();
    const update = extractUpdateFromText(text);

    if (update && JSON.stringify(update) !== JSON.stringify(lastDetectedJson)) {
      lastDetectedJson = update;

      if (isAutomaticMemoryMode()) {
        dismissFloater();
      } else {
        showFloater(update);
        sendRuntimeMessageSafely({ type: 'UPDATE_FOUND', data: update });
      }
    }

    injectAllButtons();
  }, 700);
}

async function startObserver() {
  if (observerActive) return;

  extensionSettings = await loadSettings();
  listenForSettingsChanges();
  attachSubmitDismissWatcher();

  observerActive = true;

  new MutationObserver(scheduleScan).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  scheduleScan();

  console.log('Memephant: content script started', {
    platform: PLATFORM,
    settings: extensionSettings,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    startObserver().catch((error) => {
      console.error('Memephant: content script failed to start', error);
    });
  });
} else {
  startObserver().catch((error) => {
    console.error('Memephant: content script failed to start', error);
  });
}

// ─── Runtime messages ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_CURRENT_UPDATE') {
    sendResponse({ update: lastDetectedJson });
    return false;
  }

  if (msg.type === 'COPY_UPDATE') {
    void handleCopy();
    sendResponse({ success: true });
    return false;
  }

  if (msg.type === 'HIDE_MEMEPHANT_FLOATER') {
    dismissFloater();
    sendResponse({ success: true });
    return false;
  }

  if (msg.type === 'COMPRESS_COMPOSER') {
    handleCompressComposer()
      .then(sendResponse)
      .catch(() => sendResponse({ success: false, message: 'Could not compress prompt.' }));
    return true;
  }

  if (msg.type === 'SPLIT_COMPOSER') {
    handleSplitComposer()
      .then(sendResponse)
      .catch(() => sendResponse({ success: false, message: 'Could not split prompt.' }));
    return true;
  }

  if (msg.type === 'PASTE_PART_2') {
    handlePastePart2Composer()
      .then(sendResponse)
      .catch(() => sendResponse({ success: false, message: 'Could not paste Part 2.' }));
    return true;
  }

  if (msg.type === 'UNDO_COMPOSER') {
    handleUndoComposer()
      .then(sendResponse)
      .catch(() => sendResponse({ success: false, message: 'Could not restore prompt.' }));
    return true;
  }

  if (msg.type === 'INSERT_PENDING_DRAFT') {
    handleInsertPendingDraft()
      .then(sendResponse)
      .catch(() => sendResponse({ success: false, message: 'Could not insert pending draft.' }));
    return true;
  }

  return false;
});
