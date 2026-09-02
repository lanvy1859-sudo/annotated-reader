// ================= COLOR THEME SYSTEM =================
import { animationData } from './animation.js';

export const COLOR_PRESETS = [
  { id: 'purple', name: 'Amethyst Purple', hex: '#7654d8', desc: 'Default Violet' },
  { id: 'olive', name: 'Deep Moss Green', hex: '#3b5323', desc: 'Deep Classic Olive' },
  { id: 'forest', name: 'Bamboo Forest', hex: '#1b6b45', desc: 'Forest Emerald' },
  { id: 'emerald', name: 'Emerald Jade', hex: '#0f766e', desc: 'Deep Jade' },
  { id: 'ocean', name: 'Deep Ocean Blue', hex: '#1d4ed8', desc: 'Ocean Deep Blue' },
  { id: 'amber', name: 'Warm Amber & Tea', hex: '#b45309', desc: 'Warm Amber & Tea' },
  { id: 'terracotta', name: 'Terracotta Rust', hex: '#c2410c', desc: 'Terracotta & Rust' },
  { id: 'rose', name: 'Rose & Wine', hex: '#be185d', desc: 'Rose & Wine' },
  { id: 'slate', name: 'Smoky Slate', hex: '#334155', desc: 'Slate & Mist' }
];

export function hexToHsl(hex) {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) {
    cleanHex = '7654d8';
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

export function hslToRgbNorm(h, s, l) {
  s = s / 100;
  l = l / 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(f(0) * 100) / 100,
    Math.round(f(8) * 100) / 100,
    Math.round(f(4) * 100) / 100
  ];
}

const STORY_THEMES_KEY = "annotated_reader_story_themes";
export function getSavedStoryThemes() {
  try {
    const raw = localStorage.getItem(STORY_THEMES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveStoryTheme(storyId, hex) {
  if (!storyId || !hex) return;
  try {
    const map = getSavedStoryThemes();
    map[storyId] = hex;
    localStorage.setItem(STORY_THEMES_KEY, JSON.stringify(map));
  } catch (e) {}
}

// Generate complete palette for Light & Dark mode
export function generateStoryPalette(baseHex) {
  if (!baseHex) return null;
  const normalizedHex = baseHex.toLowerCase();

  if (normalizedHex === '#7654d8') {
    return {
      baseHex: '#7654d8',
      h: 256, s: 63, l: 59,
      light: {
        '--purple': '#7654d8',
        '--purple-solid': '#7654d8',
        '--purple-dark': '#6040c5',
        '--purple-soft': '#f0ebff',
        '--purple-light': '#faf8ff',
        '--purple-text': '#ffffff',
        '--text': '#272331',
        '--muted': '#777181',
        '--border': '#e8e4ed',
        '--bg': '#f8f7fa',
        '--card-bg': '#ffffff',
        '--paper-bg': '#ffffff',
        '--paper-text': '#38343d',
        '--topbar-bg': 'rgba(255, 255, 255, 0.94)',
        '--input-bg': '#f8f7fb',
        '--input-border': '#dcd8e4',
        '--drawer-bg': '#ffffff',
        '--modal-bg': '#ffffff',
        '--annotation-box-bg': '#faf8ff',
        '--annotation-selected': '#F5F3FF',
        '--annotation-selected-text': '#374151',
        '--annotation-selected-border': 'rgba(118, 84, 216, 0.16)',
        '--highlight-bg': '#f0ebff',
        '--progress-gradient': 'linear-gradient(90deg, #c4b5fd, #8b5cf6)',
        '--toggle-track-bg': 'rgba(255, 255, 255, 0.55)',
        '--toggle-border': '#e8e4ed',
        '--toggle-knob-bg': 'radial-gradient(circle at 35% 35%, #ffb347 0%, #ff8c00 100%)',
        '--toggle-knob-shadow': '0 2px 8px rgba(255, 140, 0, 0.5)'
      },
      dark: {
        '--purple': '#9d7df9',
        '--purple-solid': '#7654d8',
        '--purple-dark': '#b89dfd',
        '--purple-soft': '#2d2449',
        '--purple-light': '#201a35',
        '--purple-text': '#0d0818',
        '--text': '#f0ecf9',
        '--muted': '#a69ebd',
        '--border': '#362e4c',
        '--bg': '#141021',
        '--card-bg': '#1d182e',
        '--paper-bg': '#1c172c',
        '--paper-text': '#ece7f7',
        '--topbar-bg': 'rgba(23, 18, 38, 0.94)',
        '--input-bg': '#231d37',
        '--input-border': '#3c3452',
        '--drawer-bg': '#1a1529',
        '--modal-bg': '#1f1933',
        '--annotation-box-bg': '#231b3d',
        '--annotation-selected': '#251d3b',
        '--annotation-selected-text': '#e2dcf2',
        '--annotation-selected-border': 'rgba(157, 125, 249, 0.22)',
        '--highlight-bg': '#372a5a',
        '--progress-gradient': 'linear-gradient(90deg, #9d7df9, #c4b5fd)',
        '--toggle-track-bg': 'rgba(30, 23, 48, 0.75)',
        '--toggle-border': 'rgba(157, 125, 249, 0.32)',
        '--toggle-knob-bg': 'radial-gradient(circle at 35% 35%, #5975fe 0%, #2938b8 100%)',
        '--toggle-knob-shadow': '0 2px 10px rgba(78, 115, 248, 0.6)'
      }
    };
  }

  const { h, s, l } = hexToHsl(baseHex);
  const isGreenish = (h >= 65 && h <= 185);

  // Light Mode Variables (deeper & richer for greens, luminous for purples)
  const lightPrimarySat = isGreenish ? Math.max(60, Math.min(s + 10, 85)) : Math.max(45, Math.min(s, 78));
  const lightPrimaryLight = isGreenish ? Math.min(Math.max(l, 24), 30) : Math.min(Math.max(l, 36), 46);
  const lightPrimary = `hsl(${h}, ${lightPrimarySat}%, ${lightPrimaryLight}%)`;
  const lightPrimaryDark = `hsl(${h}, ${Math.min(lightPrimarySat + 8, 90)}%, ${Math.max(lightPrimaryLight - 8, 16)}%)`;
  const lightSoft = `hsl(${h}, ${Math.min(lightPrimarySat, 38)}%, 93.5%)`;
  const lightSuperSoft = `hsl(${h}, ${Math.min(lightPrimarySat, 26)}%, 97%)`;
  const lightBg = `hsl(${h}, 10%, 97.5%)`;
  const lightBorder = `hsl(${h}, 16%, 88.5%)`;
  const lightText = `hsl(${h}, 22%, 14%)`;
  const lightMuted = `hsl(${h}, 12%, 44%)`;
  const lightPaperText = `hsl(${h}, 15%, 20%)`;
  const lightHighlight = `hsl(${h}, 50%, 86%)`;
  const lightAnnotationBox = `hsl(${h}, 32%, 96%)`;
  const lightAnnotationSelected = `hsl(${h}, 36%, 95%)`;
  const lightAnnotationBorder = `hsla(${h}, ${lightPrimarySat}%, ${lightPrimaryLight}%, 0.25)`;
  const lightProgressGrad = `linear-gradient(90deg, hsl(${h}, ${Math.max(s, 50)}%, ${isGreenish ? 54 : 70}%), hsl(${h}, ${Math.max(s, 65)}%, ${isGreenish ? 28 : 46}%))`;
  const lightToggleTrackBg = `hsla(${h}, 25%, 94%, 0.85)`;
  const lightToggleKnobBg = `radial-gradient(circle at 35% 35%, hsl(${h}, 85%, 55%) 0%, hsl(${h}, 90%, 36%) 100%)`;
  const lightToggleKnobShadow = `0 2px 8px hsla(${h}, 85%, 38%, 0.45)`;

  // Dark Mode Variables (rich deep green and radiant purple accents)
  const darkPrimarySat = isGreenish ? Math.max(70, Math.min(s + 20, 92)) : Math.max(65, Math.min(s + 15, 88));
  const darkPrimaryLight = isGreenish ? 54 : 72;
  const darkPrimary = `hsl(${h}, ${darkPrimarySat}%, ${darkPrimaryLight}%)`;
  const darkPrimarySolid = `hsl(${h}, ${Math.max(60, Math.min(s, 85))}%, ${isGreenish ? 28 : 40}%)`;
  const darkPrimaryDark = isGreenish 
    ? `hsl(${h}, ${Math.min(darkPrimarySat - 5, 78)}%, 35%)`
    : `hsl(${h}, ${Math.min(darkPrimarySat + 5, 95)}%, 76%)`;
  const darkSoft = `hsl(${h}, 32%, 18%)`;
  const darkSuperSoft = `hsl(${h}, 26%, 13%)`;
  const darkBg = `hsl(${h}, 25%, 8.5%)`;
  const darkCardBg = `hsl(${h}, 22%, 12.5%)`;
  const darkPaperBg = `hsl(${h}, 20%, 11.5%)`;
  const darkPaperText = `hsl(${h}, 12%, 92%)`;
  const darkTopBar = `hsla(${h}, 24%, 10.5%, 0.94)`;
  const darkBorder = `hsl(${h}, 20%, 22%)`;
  const darkText = `hsl(${h}, 15%, 94%)`;
  const darkMuted = `hsl(${h}, 12%, 67%)`;
  const darkHighlight = `hsl(${h}, 40%, 22%)`;
  const darkAnnotationBox = `hsl(${h}, 28%, 15.5%)`;
  const darkAnnotationSelected = `hsl(${h}, 28%, 17%)`;
  const darkAnnotationBorder = `hsla(${h}, ${darkPrimarySat}%, 55%, 0.32)`;
  const darkProgressGrad = `linear-gradient(90deg, hsl(${h}, ${darkPrimarySat}%, ${isGreenish ? 38 : 55}%), hsl(${h}, ${Math.min(darkPrimarySat + 10, 95)}%, ${isGreenish ? 54 : 68}%))`;
  const darkToggleTrackBg = `hsla(${h}, 30%, 16%, 0.85)`;
  const darkToggleBorder = `hsla(${h}, 50%, 45%, 0.35)`;
  const darkToggleKnobBg = `radial-gradient(circle at 35% 35%, hsl(${h}, 80%, 64%) 0%, hsl(${h}, 70%, 38%) 100%)`;
  const darkToggleKnobShadow = `0 2px 10px hsla(${h}, 75%, 45%, 0.55)`;

  return {
    baseHex,
    h, s, l,
    light: {
      '--purple': lightPrimary,
      '--purple-solid': lightPrimary,
      '--purple-dark': lightPrimaryDark,
      '--purple-soft': lightSoft,
      '--purple-light': lightSuperSoft,
      '--purple-text': '#ffffff',
      '--text': lightText,
      '--muted': lightMuted,
      '--border': lightBorder,
      '--bg': lightBg,
      '--card-bg': '#ffffff',
      '--paper-bg': '#ffffff',
      '--paper-text': lightPaperText,
      '--topbar-bg': `hsla(${h}, 25%, 99%, 0.94)`,
      '--input-bg': `hsl(${h}, 22%, 97.2%)`,
      '--input-border': `hsl(${h}, 18%, 86%)`,
      '--drawer-bg': '#ffffff',
      '--modal-bg': '#ffffff',
      '--annotation-box-bg': lightAnnotationBox,
      '--annotation-selected': lightAnnotationSelected,
      '--annotation-selected-text': '#2a3026',
      '--annotation-selected-border': lightAnnotationBorder,
      '--highlight-bg': lightHighlight,
      '--progress-gradient': lightProgressGrad,
      '--toggle-track-bg': lightToggleTrackBg,
      '--toggle-border': lightBorder,
      '--toggle-knob-bg': lightToggleKnobBg,
      '--toggle-knob-shadow': lightToggleKnobShadow
    },
    dark: {
      '--purple': darkPrimary,
      '--purple-solid': darkPrimarySolid,
      '--purple-dark': darkPrimaryDark,
      '--purple-soft': darkSoft,
      '--purple-light': darkSuperSoft,
      '--purple-text': '#0d0818',
      '--text': darkText,
      '--muted': darkMuted,
      '--border': darkBorder,
      '--bg': darkBg,
      '--card-bg': darkCardBg,
      '--paper-bg': darkPaperBg,
      '--paper-text': darkPaperText,
      '--topbar-bg': darkTopBar,
      '--input-bg': `hsl(${h}, 22%, 15%)`,
      '--input-border': `hsl(${h}, 20%, 25%)`,
      '--drawer-bg': `hsl(${h}, 24%, 10%)`,
      '--modal-bg': `hsl(${h}, 22%, 13.5%)`,
      '--annotation-box-bg': darkAnnotationBox,
      '--annotation-selected': darkAnnotationSelected,
      '--annotation-selected-text': '#f0ecf9',
      '--annotation-selected-border': darkAnnotationBorder,
      '--highlight-bg': darkHighlight,
      '--progress-gradient': darkProgressGrad,
      '--toggle-track-bg': darkToggleTrackBg,
      '--toggle-border': darkToggleBorder,
      '--toggle-knob-bg': darkToggleKnobBg,
      '--toggle-knob-shadow': darkToggleKnobShadow
    }
  };
}

export function applyStoryTheme(baseHex) {
  let styleEl = document.getElementById('dynamic-story-theme');
  if (!baseHex) {
    if (styleEl) styleEl.remove();
    return;
  }
  const palette = generateStoryPalette(baseHex);
  if (!palette) {
    if (styleEl) styleEl.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-story-theme';
    document.head.appendChild(styleEl);
  }

  const lightCss = Object.entries(palette.light).map(([k, v]) => `${k}: ${v} !important;`).join('\n    ');
  const darkCss = Object.entries(palette.dark).map(([k, v]) => `${k}: ${v} !important;`).join('\n    ');

  styleEl.innerHTML = `
  :root:not([data-theme="dark"]), [data-theme="light"] {
    ${lightCss}
  }
  [data-theme="dark"] {
    ${darkCss}
  }
  `;
}

// Generate Book Animation Data with White Book Pages in both Light & Dark Mode, vivid purple and refined dark green
export function getThemedAnimationData(baseHex, isDark = false) {
  const pal = generateStoryPalette(baseHex || '#7654d8');
  const h = pal ? pal.h : 256;
  const isGreen = (h >= 65 && h <= 185);

  let strokeRgb;
  let coverFillRgb;

  if (isGreen) {
    // Green tone: deep, rich, classic forest/emerald tone (not washed out or overly bright)
    strokeRgb = isDark ? hslToRgbNorm(h, 75, 38) : hslToRgbNorm(h, 80, 24);
    coverFillRgb = isDark ? hslToRgbNorm(h, 70, 26) : hslToRgbNorm(h, 75, 28);
  } else if (pal) {
    // Purple / non-green tones: luminous, vibrant, rich violet (not dark or muddy)
    strokeRgb = isDark ? hslToRgbNorm(h, 78, 68) : hslToRgbNorm(h, 68, 56);
    coverFillRgb = isDark ? hslToRgbNorm(h, 72, 58) : hslToRgbNorm(h, 68, 62);
  } else {
    // Default fallback purple
    strokeRgb = isDark ? [0.62, 0.49, 0.98] : [0.46, 0.33, 0.85];
    coverFillRgb = isDark ? [0.55, 0.42, 0.94] : [0.58, 0.45, 0.92];
  }

  // Requirement: In dark mode, book face/pages must remain WHITE as before!
  const pageFillRgb = [0.99, 0.99, 1.0];

  const cloned = JSON.parse(JSON.stringify(animationData));

  function updateShapeColors(item) {
    if (!item) return;
    if (item.ty === 'st' && item.c && item.c.k && Array.isArray(item.c.k) && item.c.k.length >= 3) {
      item.c.k = [strokeRgb[0], strokeRgb[1], strokeRgb[2], item.c.k[3] !== undefined ? item.c.k[3] : 1];
    }
    if (item.ty === 'fl' && item.c && item.c.k && Array.isArray(item.c.k) && item.c.k.length >= 3) {
      const isCover = item.nm && (item.nm.toLowerCase().includes('cover') || (item.nm === 'Fill 1' && item.c.k[0] < 0.8));
      if (isCover) {
        item.c.k = [coverFillRgb[0], coverFillRgb[1], coverFillRgb[2], item.c.k[3] !== undefined ? item.c.k[3] : 1];
      } else {
        item.c.k = [pageFillRgb[0], pageFillRgb[1], pageFillRgb[2], item.c.k[3] !== undefined ? item.c.k[3] : 1];
      }
    }
    if (item.shapes && Array.isArray(item.shapes)) {
      item.shapes.forEach(updateShapeColors);
    }
    if (item.it && Array.isArray(item.it)) {
      item.it.forEach(updateShapeColors);
    }
  }

  if (cloned.layers && Array.isArray(cloned.layers)) {
    cloned.layers.forEach(layer => {
      if (layer.shapes) layer.shapes.forEach(updateShapeColors);
    });
  }
  if (cloned.assets && Array.isArray(cloned.assets)) {
    cloned.assets.forEach(asset => {
      if (asset.layers) {
        asset.layers.forEach(layer => {
          if (layer.shapes) layer.shapes.forEach(updateShapeColors);
        });
      }
    });
  }

  return cloned;
}

export function updateLoadingScreenTheme(themeColor, isDark = false) {
  const player = document.getElementById('bookAnim');
  const currentLottieData = getThemedAnimationData(themeColor, isDark);
  if (player && typeof player.load === 'function') {
    try {
      player.load(currentLottieData);
    } catch (e) {
      console.warn('Lottie player reload error', e);
    }
  }
}

export async function extractDominantColor(imgUrl) {
  return new Promise((resolve, reject) => {
    if (!imgUrl) return reject('No image URL');
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const width = (canvas.width = 64);
        const height = (canvas.height = 64);
        ctx.drawImage(img, 0, 0, width, height);

        const data = ctx.getImageData(0, 0, width, height).data;
        let colorCounts = {};
        let bestColor = null;
        let bestScore = -1;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;

          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness < 30 || brightness > 235) continue;

          const qr = Math.round(r / 16) * 16;
          const qg = Math.round(g / 16) * 16;
          const qb = Math.round(b / 16) * 16;
          const key = `${qr},${qg},${qb}`;

          colorCounts[key] = (colorCounts[key] || 0) + 1;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const score = colorCounts[key] * (sat * 1.5 + 0.5);

          if (score > bestScore) {
            bestScore = score;
            const toHex = n => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
            bestColor = `#${toHex(qr)}${toHex(qg)}${toHex(qb)}`;
          }
        }

        resolve(bestColor || '#3b5323');
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
  });
}
