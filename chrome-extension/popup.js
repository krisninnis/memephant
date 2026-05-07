/**
 * Memephant — Popup Script
 * Queries the active tab's content script for any detected update,
 * renders the appropriate panel, manages Memory Mode, and manages
 * Prompt Guard settings.
 */

'use strict';

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

const ARRAY_FIELDS = [
  'goals',
  'rules',
  'decisions',
  'nextSteps',
  'openQuestions',
  'importantAssets',
];

const HINT_PROMPT =
  'Please end your reply with a memphant_update JSON block summarising ' +
  'any new goals, decisions, next steps, or changes to current state. ' +
  'Format: memphant_update\n{ "goals": [], "decisions": [], "nextSteps": [] }';

const DEFAULT_MEMORY_MODE_SETTINGS = {
  memephantMemoryMode: 'auto',
};

const DEFAULT_PROMPT_GUARD_SETTINGS = {
  promptGuardEnabled: true,
  promptGuardChatgptEnabled: true,
  promptGuardThreshold: 'medium_and_high',
};

// Helpers

function describeUpdate(update) {
  const itemCount = ARRAY_FIELDS.reduce((sum, field) => {
    const value = update[field];
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);

  const fieldCount = PROJECT_FIELDS.filter((field) => update[field] !== undefined).length;

  if (itemCount > 0) {
    return `${itemCount} item${itemCount !== 1 ? 's' : ''} across ${fieldCount} field${fieldCount !== 1 ? 's' : ''}`;
  }

  return `${fieldCount} field${fieldCount !== 1 ? 's' : ''} updated`;
}

function showConfirmation(message) {
  const el = document.getElementById('confirmation');
  if (!el) return;

  el.textContent = message;
  el.hidden = false;

  setTimeout(() => {
    el.hidden = true;
  }, 3000);
}

function storageGet(defaults) {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, (items) => {
      resolve(items || defaults);
    });
  });
}

function storageSet(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getPromptGuardControls() {
  return {
    enabled: document.getElementById('pg-enabled'),
    chatgptEnabled: document.getElementById('pg-chatgpt-enabled'),
    threshold: document.getElementById('pg-threshold'),
  };
}

function updatePromptGuardControlState(settings) {
  const controls = getPromptGuardControls();

  if (!controls.enabled || !controls.chatgptEnabled || !controls.threshold) {
    return;
  }

  controls.enabled.checked = Boolean(settings.promptGuardEnabled);
  controls.chatgptEnabled.checked = Boolean(settings.promptGuardChatgptEnabled);
  controls.threshold.value =
    settings.promptGuardThreshold === 'high_only'
      ? 'high_only'
      : 'medium_and_high';

  const disabled = !controls.enabled.checked;
  controls.chatgptEnabled.disabled = disabled;
  controls.threshold.disabled = disabled;
}

async function savePromptGuardSettings(partialSettings) {
  const currentSettings = await storageGet(DEFAULT_PROMPT_GUARD_SETTINGS);
  const nextSettings = {
    ...DEFAULT_PROMPT_GUARD_SETTINGS,
    ...currentSettings,
    ...partialSettings,
  };

  await storageSet(nextSettings);
  updatePromptGuardControlState(nextSettings);

  return nextSettings;
}

async function initPromptGuardSettings() {
  const controls = getPromptGuardControls();

  if (!controls.enabled || !controls.chatgptEnabled || !controls.threshold) {
    return;
  }

  const settings = await storageGet(DEFAULT_PROMPT_GUARD_SETTINGS);
  updatePromptGuardControlState(settings);

  controls.enabled.addEventListener('change', async () => {
    try {
      await savePromptGuardSettings({
        promptGuardEnabled: controls.enabled.checked,
      });
    } catch (err) {
      console.error('[Memephant] Could not save Prompt Guard enabled setting:', err);
      showConfirmation('⚠️ Could not save Prompt Guard setting.');
    }
  });

  controls.chatgptEnabled.addEventListener('change', async () => {
    try {
      await savePromptGuardSettings({
        promptGuardChatgptEnabled: controls.chatgptEnabled.checked,
      });
    } catch (err) {
      console.error('[Memephant] Could not save Prompt Guard ChatGPT setting:', err);
      showConfirmation('⚠️ Could not save ChatGPT setting.');
    }
  });

  controls.threshold.addEventListener('change', async () => {
    try {
      await savePromptGuardSettings({
        promptGuardThreshold:
          controls.threshold.value === 'high_only'
            ? 'high_only'
            : 'medium_and_high',
      });
    } catch (err) {
      console.error('[Memephant] Could not save Prompt Guard threshold:', err);
      showConfirmation('⚠️ Could not save threshold setting.');
    }
  });
}

// ─── Memory mode toggle ───────────────────────────────────────────────────────

/**
 * Reads memephantMemoryMode from storage and wires the popup toggle.
 * Unchecked = Auto (default, silent). Checked = Manual (inject buttons).
 * Writing to storage fires chrome.storage.onChanged in the content script,
 * which immediately hides/shows manual helpers without a page reload.
 */
async function initMemoryModeToggle() {
  const toggle = document.getElementById('memory-mode-manual');
  const subtitle = document.getElementById('memory-mode-subtitle');

  if (!toggle) return;

  const settings = await storageGet(DEFAULT_MEMORY_MODE_SETTINGS);
  const isManual = settings.memephantMemoryMode === 'manual';

  toggle.checked = isManual;
  if (subtitle) {
    subtitle.textContent = isManual
      ? 'Manual — copy buttons shown on AI pages'
      : 'Auto — silent background updates';
  }

  toggle.addEventListener('change', async () => {
    const newMode = toggle.checked ? 'manual' : 'auto';

    if (subtitle) {
      subtitle.textContent = newMode === 'manual'
        ? 'Manual — copy buttons shown on AI pages'
        : 'Auto — silent background updates';
    }

    try {
      await storageSet({ memephantMemoryMode: newMode });
    } catch (err) {
      console.error('[Memephant] Could not save memory mode:', err);
      showConfirmation('⚠️ Could not save memory mode setting.');

      // Revert visual state on failure.
      toggle.checked = !toggle.checked;
      if (subtitle) {
        subtitle.textContent = toggle.checked
          ? 'Manual — copy buttons shown on AI pages'
          : 'Auto — silent background updates';
      }
    }
  });
}

function isSupportedAiPage(tabUrl) {
  const supportedHosts = [
    'chat.openai.com',
    'chatgpt.com',
    'claude.ai',
    'x.com',
    'grok.com',
    'www.perplexity.ai',
    'gemini.google.com',
  ];

  try {
    const url = new URL(tabUrl || '');
    return supportedHosts.some((host) => url.hostname === host);
  } catch {
    return false;
  }
}

/**
 * Send a message to the content script running in the active tab.
 * Returns null if the content script is not reachable.
 * Returns the content script's response object on success.
 */
async function sendToActiveTab(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type });
    return response ?? { success: true };
  } catch {
    return null;
  }
}

/**
 * Show/hide the "Paste Part 2" button based on whether a pending
 * Part 2 is stored in chrome.storage.local.
 */
async function refreshPastePart2Button() {
  const btn = document.getElementById('paste-part2-btn');
  if (!btn) return;

  try {
    const items = await storageGet({ memephantPendingSplitPart2: '' });
    btn.hidden = !items.memephantPendingSplitPart2;
  } catch {
    btn.hidden = true;
  }
}

async function refreshPendingDraftButton() {
  const btn = document.getElementById('insert-pending-draft-btn');
  if (!btn) return;

  try {
    const items = await storageGet({ memephantPendingComposerDraft: null });
    const pendingDraft = items.memephantPendingComposerDraft;
    btn.hidden = !(
      pendingDraft?.source === 'memephant-app' &&
      typeof pendingDraft.text === 'string' &&
      pendingDraft.text.trim()
    );
  } catch {
    btn.hidden = true;
  }
}

/**
 * Show/hide the Undo button based on whether a prompt-tool undo entry exists.
 * The button label reflects the action that can be undone.
 */
async function refreshUndoButton() {
  const btn = document.getElementById('undo-btn');
  if (!btn) return;

  try {
    const items = await storageGet({ memephantPromptToolUndo: null });
    const undoEntry = items.memephantPromptToolUndo;

    if (undoEntry && typeof undoEntry.originalText === 'string') {
      const actionLabel =
        undoEntry.action === 'compress'
          ? 'Compress'
          : undoEntry.action === 'split'
            ? 'Split'
            : 'Insert draft';
      btn.textContent = `↩️ Undo ${actionLabel}`;
      btn.hidden = false;
    } else {
      btn.hidden = true;
    }
  } catch {
    btn.hidden = true;
  }
}

async function initPromptTools() {
  await refreshPendingDraftButton();
  await refreshPastePart2Button();
  await refreshUndoButton();

  document.getElementById('compress-btn')?.addEventListener('click', async () => {
    const result = await sendToActiveTab('COMPRESS_COMPOSER');
    if (!result) {
      showConfirmation('⚠️ Open a supported AI page first.');
      return;
    }

    if (result.success) {
      showConfirmation('✅ Prompt compressed. Undo available.');
      setTimeout(refreshUndoButton, 500);
    } else {
      showConfirmation('⚠️ ' + (result.message || 'Could not compress prompt.'));
    }
  });

  document.getElementById('split-btn')?.addEventListener('click', async () => {
    const result = await sendToActiveTab('SPLIT_COMPOSER');
    if (!result) {
      showConfirmation('⚠️ Open a supported AI page first.');
      return;
    }

    if (result.success) {
      showConfirmation('✅ Part 1 inserted. Part 2 copied. Undo available.');
      setTimeout(() => {
        refreshPastePart2Button();
        refreshUndoButton();
      }, 500);
    } else {
      showConfirmation('⚠️ ' + (result.message || 'Could not split prompt.'));
    }
  });

  document.getElementById('paste-part2-btn')?.addEventListener('click', async () => {
    const result = await sendToActiveTab('PASTE_PART_2');
    if (!result) {
      showConfirmation('⚠️ Open a supported AI page first.');
      return;
    }

    if (result.success) {
      showConfirmation('✅ Part 2 pasted.');
      setTimeout(refreshPastePart2Button, 500);
    } else {
      showConfirmation('⚠️ ' + (result.message || 'Could not paste Part 2.'));
    }
  });

  document.getElementById('insert-pending-draft-btn')?.addEventListener('click', async () => {
    const result = await sendToActiveTab('INSERT_PENDING_DRAFT');
    if (!result) {
      showConfirmation('⚠️ Open a supported AI page first.');
      return;
    }

    if (result.success) {
      showConfirmation('✅ Pending draft inserted. Nothing was sent.');
      setTimeout(() => {
        refreshPendingDraftButton();
        refreshUndoButton();
        refreshPastePart2Button();
      }, 500);
    } else {
      showConfirmation('⚠️ ' + (result.message || 'Could not insert pending draft.'));
    }
  });

  document.getElementById('undo-btn')?.addEventListener('click', async () => {
    const result = await sendToActiveTab('UNDO_COMPOSER');
    if (!result) {
      showConfirmation('⚠️ Open a supported AI page first.');
      return;
    }

    if (result.success) {
      showConfirmation('✅ Original prompt restored.');
      setTimeout(() => {
        refreshUndoButton();
        refreshPastePart2Button();
        refreshPendingDraftButton();
      }, 500);
    } else {
      showConfirmation('⚠️ ' + (result.message || 'Nothing to undo.'));
    }
  });
}

// Init

async function init() {
  await initMemoryModeToggle();
  await initPromptGuardSettings();
  await initPromptTools();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isSupported = isSupportedAiPage(tab?.url);

  let currentUpdate = null;

  if (isSupported && tab?.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_UPDATE' });
      currentUpdate = response?.update ?? null;
    } catch {
      // Content script may not be injected yet or page may still be loading.
      currentUpdate = null;
    }
  }

  // Render update/idle panels

  const updatePanel = document.getElementById('update-panel');
  const idlePanel = document.getElementById('idle-panel');
  const updateSummary = document.getElementById('update-summary');

  if (currentUpdate) {
    updatePanel.hidden = false;
    idlePanel.hidden = true;
    updateSummary.textContent = describeUpdate(currentUpdate);
  } else {
    updatePanel.hidden = true;
    idlePanel.hidden = false;
  }

  // Buttons

  document.getElementById('copy-btn')?.addEventListener('click', async () => {
    if (!currentUpdate || !tab?.id) return;

    const jsonStr = JSON.stringify(currentUpdate, null, 2);
    const payload = `memphant_update\n${jsonStr}`;

    try {
      await navigator.clipboard.writeText(payload);
      showConfirmation('✅ Copied! Open Memephant and paste.');
      chrome.runtime.sendMessage({ type: 'UPDATE_COPIED' });
    } catch {
      // Clipboard may need focus — fall back to messaging content script.
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'COPY_UPDATE' });
        showConfirmation('✅ Copied! Open Memephant and paste.');
      } catch {
        showConfirmation('⚠️ Could not copy — try the page button instead.');
      }
    }
  });

  document.getElementById('hint-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(HINT_PROMPT);
      showConfirmation('✅ Hint copied — paste into your AI chat.');
    } catch {
      showConfirmation('⚠️ Could not copy automatically.');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    console.error('[Memephant] Popup failed to initialise:', err);
  });
});
