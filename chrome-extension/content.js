/**
 * Memephant — Content Script
 *
 * Runs on ChatGPT, Claude, Grok, Perplexity, and Gemini pages.
 *
 * Two jobs:
 *  1. DETECT — Watch AI responses for memphant_update JSON blocks,
 *              show a floating "Apply to Memephant" button when manual mode is active.
 *  2. INJECT — Add a small "🐘 Copy for Memephant" button to every AI
 *              message so users can grab the full response easily.
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
   * auto (default):
   *   Hide the "Copy for Memephant" inject buttons and the floater.
   *   Automatic Memory Bridge handles updates silently.
   *
   * manual:
   *   Show the bottom-right "Memphant update detected" floater and
   *   inject "Copy for Memephant" buttons on AI responses.
   *   Only active when the user has explicitly selected Manual mode
   *   in the extension popup.
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
    extensionSettings.memephantMemoryMode === 'automatic' ||
    extensionSettings.memephantMemoryMode === 'auto' ||
    extensionSettings.memephantAutomaticMode === true ||
    extensionSettings.memoryBridgeMode === 'automatic' ||
    extensionSettings.memoryBridgeMode === 'auto'
  );
}

/** Remove all previously injected "Copy for Memephant" buttons from the page. */
function removeAllInjectedButtons() {
  document.querySelectorAll('.mph-inject-btn').forEach((btn) => btn.remove());
  document.querySelectorAll('[data-mph-injected]').forEach((node) => {
    delete node.dataset.mphInjected;
  });
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

// ─── Floating banner ──────────────────────────────────────────────────────────

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
      target.closest('textarea') ||
      target.closest('div[contenteditable="true"]'),
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

function injectAllButtons() {
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

    if (!isAutomaticMemoryMode()) {
      injectAllButtons();
    }
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


// ─── Prompt Compress/Split — Composer interaction ──────────────────────────────
//
// mphCompressPrompt and mphSplitPrompt are pure-JS copies of the logic in
// src/utils/promptUtils.ts.  Extension content scripts cannot import ES-module
// TypeScript files, so the functions are intentionally duplicated here with a
// "mph" prefix to avoid global-scope collisions.

const _MPH_LEADING_FILLERS = [
  /^please\s+/i, /^can you\s+/i, /^could you\s+/i, /^would you\s+/i,
  /^i want you to\s+/i, /^i need you to\s+/i, /^i'd like you to\s+/i,
  /^i would like you to\s+/i, /^help me\s+/i,
  /^can you please\s+/i, /^could you please\s+/i,
];
const _MPH_TRAILING_FILLERS = [
  /[,\s]+please\.?$/i, /[,\s]+thanks\.?$/i, /[,\s]+thank you\.?$/i,
];

function mphCompressPrompt(text) {
  if (!text.trim()) return text;
  let out = text.trim();
  let prevOut;
  do {
    prevOut = out;
    for (const p of _MPH_LEADING_FILLERS) { out = out.replace(p, '').trimStart(); }
  } while (out !== prevOut);
  for (const p of _MPH_TRAILING_FILLERS) { out = out.replace(p, '').trimEnd(); }
  out = out.replace(/\s{2,}/g, ' ').trim();
  const changed = out !== text.trim();
  if (changed && out.length > 0) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out.length > 0 ? out : text.trim();
}

function mphSplitPrompt(text) {
  if (!text.trim()) return [text, ''];
  const trimmed = text.trim();
  if (trimmed.split(/\s+/).length < 4) return [trimmed, ''];
  const midpoint = Math.floor(trimmed.length / 2);
  { const re = /[.!?]\s+/g; let best = -1, m;
    while ((m = re.exec(trimmed)) !== null) {
      const end = m.index + m[0].length;
      if (end - 1 <= midpoint + 20) best = end; else break;
    }
    if (best > 0 && best < trimmed.length)
      return [trimmed.slice(0, best).trim(), trimmed.slice(best).trim()]; }
  { const re = /[,;]\s+/g; let best = -1, m;
    while ((m = re.exec(trimmed)) !== null) {
      const end = m.index + m[0].length;
      if (end - 1 <= midpoint + 20) best = end; else break;
    }
    if (best > 0 && best < trimmed.length)
      return [trimmed.slice(0, best).trim(), trimmed.slice(best).trim()]; }
  { const words = trimmed.split(' ');
    let chars = 0, splitAt = Math.ceil(words.length / 2);
    for (let i = 0; i < words.length; i++) {
      chars += words[i].length + 1;
      if (chars > midpoint) { splitAt = i + 1; break; }
    }
    const p1 = words.slice(0, splitAt).join(' ').trim();
    const p2 = words.slice(splitAt).join(' ').trim();
    return p2 ? [p1, p2] : [p1, '']; }
}

// ─── Composer selectors (tried in order, first match wins) ────────────────────

const COMPOSER_SELECTORS = {
  chatgpt: [
    '#prompt-textarea',
    'textarea[data-id="root"]',
    'textarea[placeholder]',
  ],
  claude: [
    '.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder]',
    'div[contenteditable="true"]',
  ],
  perplexity: [
    'textarea[placeholder]',
    'div[contenteditable="true"]',
  ],
  gemini: [
    '.ql-editor[contenteditable="true"]',
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"]',
  ],
  grok: [
    'textarea[placeholder]',
    'div[contenteditable="true"]',
  ],
  unknown: ['textarea', 'div[contenteditable="true"]'],
};

function getActiveComposer() {
  const selectors = COMPOSER_SELECTORS[PLATFORM] || COMPOSER_SELECTORS.unknown;
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      // ignore invalid selectors on unexpected page shapes
    }
  }
  return null;
}

function readComposerText(el) {
  if (!el) return '';
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value || '';
  return el.innerText || el.textContent || '';
}

function dispatchComposerInputEvents(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  // Synthetic InputEvent so React controlled inputs pick up the value change
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: null, inputType: 'insertText' }));
}

/**
 * Write text into a composer element, handling both textarea and
 * contenteditable (ProseMirror / Quill) styles, and firing the events
 * that React/Vue-managed inputs need to track state correctly.
 * Never submits — only updates the text field.
 */
function writeComposerText(el, text) {
  el.focus();

  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    // React wraps the native setter; calling it directly bypasses the controlled-
    // input guard so the synthetic 'input' event updates React's state correctly.
    const nativeSetter =
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ??
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }
    dispatchComposerInputEvents(el);

  } else if (el.isContentEditable) {
    // ProseMirror (ChatGPT, Claude) and Quill (Gemini):
    // selectAll + insertText is the most reliable trigger for editor state updates.
    el.focus();
    const selected = document.execCommand('selectAll', false, undefined);
    const inserted = selected && document.execCommand('insertText', false, text);

    if (!inserted || (el.textContent || '').trim() !== text.trim()) {
      // execCommand unavailable or silently failed — fall back to direct DOM write
      el.textContent = text;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      dispatchComposerInputEvents(el);
    }
  }

  el.focus();
}

/**
 * Show a small status notice in the floater.
 * Always shows regardless of memory mode (unlike showToast which is
 * suppressed in Automatic mode for the update-detection flow).
 */
let _mphStatusTimeout = null;

function showSmallStatus(message, isError = false) {
  const floater = getOrCreateFloater();
  floater.innerHTML = `
    <div class="mph-floater__inner mph-floater__inner--toast${isError ? ' mph-floater__inner--error' : ''}">
      <span class="mph-floater__icon">${isError ? '⚠️' : '✅'}</span>
      <span class="mph-floater__toast-msg">${message}</span>
    </div>`;
  floater.classList.add('mph-floater--visible');
  clearTimeout(_mphStatusTimeout);
  _mphStatusTimeout = setTimeout(() => {
    floater.classList.remove('mph-floater--visible');
  }, 3500);
}

// ─── Compress handler ─────────────────────────────────────────────────────────

async function handleCompressComposer() {
  const el = getActiveComposer();

  if (!el) {
    showSmallStatus('No text input found on this page.', true);
    return;
  }

  const original = readComposerText(el);

  if (!original.trim()) {
    showSmallStatus('Nothing to compress — the composer is empty.');
    return;
  }

  const compressed = mphCompressPrompt(original);

  if (compressed === original.trim()) {
    showSmallStatus('Nothing to compress.');
    return;
  }

  writeComposerText(el, compressed);

  try {
    await navigator.clipboard.writeText(compressed);
    showSmallStatus('Prompt compressed. Clipboard updated as backup.');
  } catch {
    showSmallStatus('Prompt compressed. (Clipboard unavailable — text updated in composer.)');
  }
}

// ─── Split handler ────────────────────────────────────────────────────────────

async function handleSplitComposer() {
  const el = getActiveComposer();

  if (!el) {
    showSmallStatus('No text input found on this page.', true);
    return;
  }

  const original = readComposerText(el);

  if (!original.trim()) {
    showSmallStatus('Nothing to split — the composer is empty.');
    return;
  }

  const [part1, part2] = mphSplitPrompt(original);

  if (!part2) {
    showSmallStatus('Prompt is too short to split.');
    return;
  }

  writeComposerText(el, part1);

  // Persist Part 2 as backup — survives clipboard permission errors
  if (canUseChromeStorage()) {
    chrome.storage.local.set({ memephantPendingSplitPart2: part2 }, () => {
      void chrome.runtime?.lastError;
    });
  }

  try {
    await navigator.clipboard.writeText(part2);
    showSmallStatus('Part 1 is ready. Part 2 copied to clipboard.');
  } catch {
    showSmallStatus('Part 1 is ready. Part 2 saved — use "Paste Part 2" in the popup.', true);
  }
}

// ─── Paste Part 2 handler ─────────────────────────────────────────────────────

async function handlePastePart2Composer() {
  if (!canUseChromeStorage()) {
    showSmallStatus('Storage unavailable.', true);
    return;
  }

  chrome.storage.local.get({ memephantPendingSplitPart2: '' }, async (items) => {
    void chrome.runtime?.lastError;
    const part2 = items.memephantPendingSplitPart2;

    if (!part2) {
      showSmallStatus('No pending Part 2 found.');
      return;
    }

    const el = getActiveComposer();
    if (!el) {
      showSmallStatus('No text input found on this page.', true);
      return;
    }

    writeComposerText(el, part2);

    // Clear the stored Part 2 after a successful paste
    chrome.storage.local.remove('memephantPendingSplitPart2', () => {
      void chrome.runtime?.lastError;
    });

    try {
      await navigator.clipboard.writeText(part2);
    } catch {
      // Text is already in the composer — clipboard is a bonus
    }

    showSmallStatus('Part 2 pasted into composer.');
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GET_CURRENT_UPDATE') {
    return Promise.resolve({ update: lastDetectedJson });
  }

  if (msg.type === 'COPY_UPDATE') {
    void handleCopy();
  }

  if (msg.type === 'HIDE_MEMEPHANT_FLOATER') {
    dismissFloater();
  }

  if (msg.type === 'COMPRESS_COMPOSER') {
    void handleCompressComposer();
  }

  if (msg.type === 'SPLIT_COMPOSER') {
    void handleSplitComposer();
  }

  if (msg.type === 'PASTE_PART_2') {
    void handlePastePart2Composer();
  }
});
