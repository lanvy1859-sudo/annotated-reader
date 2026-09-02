import { COLOR_PRESETS, generateStoryPalette, applyStoryTheme, saveStoryTheme, extractDominantColor } from './theme.js';

export function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 1800);
}

export function showConfirmDialog({
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Delete",
  cancelText = "Cancel",
  danger = true
} = {}) {
  return new Promise(resolve => {
    let modal = document.getElementById("customConfirmModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "customConfirmModal";
      modal.className = "custom-modal-overlay";
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="custom-modal-dialog">
        <div class="custom-modal-header">
          <h3>${escapeHTML(title)}</h3>
          <button class="custom-modal-close" id="modalCloseBtn" type="button">×</button>
        </div>
        <div class="custom-modal-body">
          <p style="margin:0;">${escapeHTML(message).replace(/\n/g, '<br>')}</p>
        </div>
        <div class="custom-modal-footer">
          <button class="btn ghost" id="modalCancelBtn" type="button">${escapeHTML(cancelText)}</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" id="modalConfirmBtn" type="button">${escapeHTML(confirmText)}</button>
        </div>
      </div>
    `;

    modal.classList.add("active");

    const cleanup = (confirmed) => {
      modal.classList.remove("active");
      resolve(confirmed);
    };

    document.getElementById("modalCloseBtn")?.addEventListener("click", () => cleanup(false));
    document.getElementById("modalCancelBtn")?.addEventListener("click", () => cleanup(false));
    document.getElementById("modalConfirmBtn")?.addEventListener("click", () => cleanup(true));
    
    modal.onclick = (e) => {
      if (e.target === modal) cleanup(false);
    };
  });
}

export function showPromptDialog({ title = "Add Global Note", fields = [] }) {
  return new Promise(resolve => {
    let modal = document.getElementById("customPromptModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "customPromptModal";
      modal.className = "custom-modal-overlay";
      document.body.appendChild(modal);
    }

    const fieldsHtml = fields.map((f, i) => `
      <div style="margin-bottom: 12px;">
        <label style="display:block; font-size:12px; font-weight:750; color:var(--text); margin-bottom:4px;">${escapeHTML(f.label)}</label>
        ${f.type === 'textarea'
          ? `<textarea id="prompt_field_${i}" class="field" style="min-height:80px; font-family:inherit; font-size:14px;" placeholder="${escapeHTML(f.placeholder || '')}">${escapeHTML(f.value || '')}</textarea>`
          : `<input id="prompt_field_${i}" class="field" type="text" style="font-family:inherit; font-size:14px;" placeholder="${escapeHTML(f.placeholder || '')}" value="${escapeHTML(f.value || '')}">`
        }
      </div>
    `).join('');

    modal.innerHTML = `
      <div class="custom-modal-dialog">
        <div class="custom-modal-header">
          <h3>${escapeHTML(title)}</h3>
          <button class="custom-modal-close" id="promptCloseBtn" type="button">×</button>
        </div>
        <div class="custom-modal-body">
          ${fieldsHtml}
        </div>
        <div class="custom-modal-footer">
          <button class="btn ghost" id="promptCancelBtn" type="button">Cancel</button>
          <button class="btn primary" id="promptSubmitBtn" type="button">Save Note</button>
        </div>
      </div>
    `;

    modal.classList.add("active");

    const cleanup = (values) => {
      modal.classList.remove("active");
      resolve(values);
    };

    document.getElementById("promptCloseBtn")?.addEventListener("click", () => cleanup(null));
    document.getElementById("promptCancelBtn")?.addEventListener("click", () => cleanup(null));
    document.getElementById("promptSubmitBtn")?.addEventListener("click", () => {
      const results = {};
      fields.forEach((f, i) => {
        const el = document.getElementById(`prompt_field_${i}`);
        results[f.name] = el ? el.value.trim() : '';
      });
      cleanup(results);
    });

    modal.onclick = (e) => {
      if (e.target === modal) cleanup(null);
    };
  });
}

export function openThemeCustomizerModal(story, onApply) {
  if (!story) {
    toast("No story selected");
    return;
  }

  const currentStoryColor = story.themeColor || '#7654d8';
  let tempColor = currentStoryColor;

  let modal = document.getElementById("storyThemeModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "storyThemeModal";
    modal.className = "custom-modal-overlay";
    document.body.appendChild(modal);
  }

  const hasCover = !!story.cover;

  modal.innerHTML = `
    <div class="custom-modal-dialog theme-modal-dialog">
      <div class="custom-modal-header">
        <h3>Color Theme for "${escapeHTML(story.title || 'Story')}"</h3>
        <button class="custom-modal-close" id="themeModalCloseBtn" type="button">×</button>
      </div>
      <div class="custom-modal-body">
        <p style="margin:0 0 12px; font-size:13px; color:var(--muted);">
          Choose or enter a primary theme color. The system automatically generates a synchronized palette for both <strong>Dark Mode</strong> and <strong>Light Mode</strong> for this story.
        </p>

        <!-- Presets -->
        <label class="popup-section-label">Preset Palettes</label>
        <div class="theme-presets-grid" id="presetChipsContainer">
          ${COLOR_PRESETS.map(p => `
            <div class="preset-chip ${p.hex.toLowerCase() === currentStoryColor.toLowerCase() ? 'active' : ''}" data-hex="${p.hex}">
              <span class="preset-chip-swatch" style="background-color: ${p.hex};"></span>
              <span class="preset-chip-name">${escapeHTML(p.name)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Custom Color Picker & Extraction -->
        <div class="color-input-section">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <label class="popup-section-label" style="margin:0;">Custom Color / HEX Code</label>
            ${hasCover ? `
              <button class="extract-cover-btn" id="extractCoverColorBtn" type="button" title="Automatically extract dominant color from the story cover">
                <span>🪄</span> Extract from Cover
              </button>
            ` : ''}
          </div>
          <div class="color-input-row">
            <div class="color-picker-wrapper" title="Click to open color picker">
              <input type="color" id="modalColorPicker" value="${tempColor}">
              <div class="color-picker-preview" id="modalColorPickerPreview" style="background-color: ${tempColor};"></div>
            </div>
            <div class="hex-input-wrapper">
              <span class="hex-input-prefix">#</span>
              <input type="text" id="modalHexInput" class="hex-input" value="${tempColor.replace('#', '')}" maxlength="6" placeholder="7654D8">
            </div>
          </div>
        </div>

        <!-- Real-time Palette Live Preview -->
        <label class="popup-section-label">Preview Generated Palette (Dual-Mode)</label>
        <div class="palette-preview-container" id="paletteLivePreview"></div>
      </div>
      <div class="custom-modal-footer">
        <button class="btn ghost" id="resetDefaultThemeBtn" type="button">Default Purple</button>
        <button class="btn ghost" id="themeModalCancelBtn" type="button">Cancel</button>
        <button class="btn primary" id="applyThemeBtn" type="button">Apply Theme</button>
      </div>
    </div>
  `;

  modal.classList.add("active");

  const picker = document.getElementById("modalColorPicker");
  const pickerPreview = document.getElementById("modalColorPickerPreview");
  const hexInput = document.getElementById("modalHexInput");
  const previewContainer = document.getElementById("paletteLivePreview");

  function updateModalPreview(hex) {
    if (!hex) hex = '#7654d8';
    if (!hex.startsWith('#')) hex = '#' + hex;
    tempColor = hex;
    if (picker) picker.value = hex;
    if (pickerPreview) pickerPreview.style.backgroundColor = hex;
    if (hexInput && document.activeElement !== hexInput) {
      hexInput.value = hex.replace('#', '').toUpperCase();
    }

    document.querySelectorAll('#presetChipsContainer .preset-chip').forEach(chip => {
      if (chip.dataset.hex.toLowerCase() === hex.toLowerCase()) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    const pal = generateStoryPalette(hex);
    if (!pal || !previewContainer) return;

    previewContainer.innerHTML = `
      <div class="palette-preview-header">
        <span>Generated palette for Story</span>
        <span style="font-family:monospace; font-size:11px; color:var(--muted);">${hex.toUpperCase()}</span>
      </div>
      <div class="preview-dual-grid">
        <div class="preview-box light-box" style="background:${pal.light['--bg']}; color:${pal.light['--text']};">
          <div class="preview-box-label" style="color:${pal.light['--purple']};">☀ Light Mode</div>
          <div class="preview-swatches-strip">
            <span class="preview-swatch-item" style="background:${pal.light['--purple']};"></span>
            <span class="preview-swatch-item" style="background:${pal.light['--purple-dark']};"></span>
            <span class="preview-swatch-item" style="background:${pal.light['--purple-soft']};"></span>
            <span class="preview-swatch-item" style="background:${pal.light['--highlight-bg']};"></span>
          </div>
          <div class="preview-mock-ui" style="background:${pal.light['--card-bg']}; border-color:${pal.light['--border']};">
            <div class="preview-mock-title">
              <span>Chapter 1</span>
              <span class="preview-mock-tag" style="background:${pal.light['--purple-soft']}; color:${pal.light['--purple']};">Active</span>
            </div>
            <div class="preview-mock-text" style="color:${pal.light['--paper-text']};">
              Sample text with <span style="text-decoration:underline; text-decoration-color:${pal.light['--purple']}; font-weight:600;">noted keyword</span>.
            </div>
            <span class="preview-mock-btn" style="background:${pal.light['--purple']}; color:${pal.light['--purple-text']};">Button</span>
          </div>
        </div>

        <div class="preview-box dark-box" style="background:${pal.dark['--bg']}; color:${pal.dark['--text']};">
          <div class="preview-box-label" style="color:${pal.dark['--purple']};">🌙 Dark Mode</div>
          <div class="preview-swatches-strip">
            <span class="preview-swatch-item" style="background:${pal.dark['--purple']};"></span>
            <span class="preview-swatch-item" style="background:${pal.dark['--purple-dark']};"></span>
            <span class="preview-swatch-item" style="background:${pal.dark['--purple-soft']};"></span>
            <span class="preview-swatch-item" style="background:${pal.dark['--highlight-bg']};"></span>
          </div>
          <div class="preview-mock-ui" style="background:${pal.dark['--card-bg']}; border-color:${pal.dark['--border']};">
            <div class="preview-mock-title" style="color:${pal.dark['--text']};">
              <span>Chapter 1</span>
              <span class="preview-mock-tag" style="background:${pal.dark['--purple-soft']}; color:${pal.dark['--purple']};">Active</span>
            </div>
            <div class="preview-mock-text" style="color:${pal.dark['--paper-text']};">
              Luminous page with highlighted <span style="text-decoration:underline; text-decoration-color:${pal.dark['--purple']}; font-weight:600;">keyword</span>.
            </div>
            <span class="preview-mock-btn" style="background:${pal.dark['--purple']}; color:${pal.dark['--purple-text']};">Button</span>
          </div>
        </div>
      </div>
    `;
  }

  updateModalPreview(tempColor);

  picker?.addEventListener("input", (e) => updateModalPreview(e.target.value));
  hexInput?.addEventListener("input", (e) => {
    let val = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
    if (val.length === 6 || val.length === 3) updateModalPreview('#' + val);
  });

  document.querySelectorAll('#presetChipsContainer .preset-chip').forEach(chip => {
    chip.addEventListener('click', () => updateModalPreview(chip.dataset.hex));
  });

  document.getElementById("extractCoverColorBtn")?.addEventListener("click", async () => {
    if (!story.cover) return;
    toast("Extracting color from cover...");
    try {
      const extractedHex = await extractDominantColor(story.cover);
      updateModalPreview(extractedHex);
      toast(`Extracted theme color: ${extractedHex}`);
    } catch (err) {
      toast("Could not extract color. Please select manually.");
    }
  });

  document.getElementById("resetDefaultThemeBtn")?.addEventListener("click", () => {
    updateModalPreview('#7654d8');
  });

  const cleanup = () => {
    modal.classList.remove("active");
  };

  document.getElementById("themeModalCloseBtn")?.addEventListener("click", cleanup);
  document.getElementById("themeModalCancelBtn")?.addEventListener("click", cleanup);

  document.getElementById("applyThemeBtn")?.addEventListener("click", () => {
    story.themeColor = tempColor;
    saveStoryTheme(story.id, story.themeColor);
    applyStoryTheme(story.themeColor);
    cleanup();
    if (onApply) onApply(story);
  });

  modal.onclick = (e) => {
    if (e.target === modal) cleanup();
  };
}
