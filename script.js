/* =========================================================
   ANNOTATED READER (MemoReader)
   Frontend prototype - SUPABASE INTEGRATION
   ========================================================= */

import { animationData } from './animation.js';

// ================= SUPABASE CLIENT =================
const SUPABASE_URL = 'https://elkdtrlumfghrsykqvty.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsa2R0cmx1bWZnaHJzeWtxdnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MzA3NTksImV4cCI6MjEwMzIwNjc1OX0.mZPwCV_lE2-0HozC8xAQ58pFtkbZK91eY62wAelXo6s';

let _supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function autoLogin() {
  if (!_supabase) return;
  try {
    const loginPromise = _supabase.auth.signInWithPassword({
      email: 'lanvy1859@gmail.com',
      password: 'lanvy1402'
    });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Login timeout')), 3000));
    await Promise.race([loginPromise, timeoutPromise]);
  } catch (err) {
    console.warn('AutoLogin skipped or offline:', err?.message || err);
  }
}
autoLogin();

// ================= STATE =================
const STORAGE_KEY = "annotated_reader_v1";
const NAV_STATE_KEY = "annotated_reader_nav";
const THEME_KEY = "annotated_reader_theme";

let currentTheme = localStorage.getItem(THEME_KEY) || "light";
function applyTheme(theme, save = true) {
  currentTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  if (save) {
    try {
      localStorage.setItem(THEME_KEY, currentTheme);
    } catch (e) {}
  }
  updateThemeToggleUI();
}

function updateThemeToggleUI() {
  const isDark = currentTheme === "dark";
  const labelText = isDark ? "Dark" : "Light";
  const buttons = document.querySelectorAll(".theme-toggle");
  buttons.forEach(btn => {
    const label = btn.querySelector(".theme-toggle-label");
    if (label) label.textContent = labelText;
    btn.setAttribute("title", isDark ? "Switch to Light mode" : "Switch to Dark mode");
  });
}

function toggleTheme() {
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme, true);
  toast(`Switched to ${newTheme === "dark" ? "Dark" : "Light"} mode`);
}

let state = { stories: [] };
let currentStoryId = null;
let currentChapterId = null;
let currentView = "library";
let selectedRange = null;
let selectedText = "";
let pendingNoteType = "chapter";
let pendingImages = [];
let searchMode = 'content'; // 'content' hoặc 'chapter'

// === THANH TIẾN ĐỘ ĐỌC ===
const readingProgressBar = document.getElementById('readingProgressBar');

// ================= DEFAULT DATA =================
function createDemoStory() {
  const chapter1Id = uid();
  const chapter2Id = uid();
  return {
    id: uid(),
    title: "The Beginning",
    description: "A demo story for the Annotated Reader.",
    cover: "",
    chapters: [
      {
        id: chapter1Id,
        number: 1,
        title: "A Strange Beginning",
        content: `
          <p>
            Chen Liguo looked at the strange visitor standing in front of him.
            He wanted to say something, but the words did not come.
          </p>

          <p>
            The room was quiet for a moment before he finally smiled.
            This was the beginning of something he did not yet understand.
          </p>

          <p>
            The name <span
              class="editor-annotation"
              data-note-id="demo-note"
            >Zong Yan</span>
            appeared in the old document.
          </p>
        `,
        notes: [
          {
            id: "demo-note",
            type: "chapter",
            selectedText: "Zong Yan",
            content: "A character mentioned in the old document. This is a demo Chapter Note.",
            images: [],
            caption: "",
            source: "",
            createdAt: new Date().toISOString()
          }
        ]
      },
      {
        id: chapter2Id,
        number: 2,
        title: "The Old Document",
        content: `
          <p>
            Chen Liguo opened the old document carefully.
            Several unfamiliar terms had been written in the margins.
          </p>

          <p>
            One phrase caught his attention:
            <span
              class="editor-annotation"
              data-note-id="demo-global"
            >Zong Yan</span>.
          </p>
        `,
        notes: [
          {
            id: "demo-global",
            type: "chapter",
            selectedText: "Zong Yan",
            content: "The same name appears again in this chapter.",
            images: [],
            caption: "",
            source: "",
            createdAt: new Date().toISOString()
          }
        ]
      }
    ],
    globalNotes: [
      {
        id: "global-demo-character",
        type: "global",
        category: "Character",
        title: "Zong Yan",
        content: "Zong Yan is a recurring character in the story. This is an example of a Global Note.",
        keywords: ["Zong Yan"],
        images: [],
        caption: "",
        source: "",
        chapterId: null,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

// ================= NAVIGATION STATE =================
function saveNavigationState() {
  try {
    const navState = {
      view: currentView,
      storyId: currentStoryId,
      chapterId: currentChapterId,
      scrollPos: window.scrollY || 0
    };
    localStorage.setItem(NAV_STATE_KEY, JSON.stringify(navState));
  } catch (e) {}
}

function restoreNavigationState() {
  try {
    const raw = localStorage.getItem(NAV_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearNavigationState() {
  try {
    localStorage.removeItem(NAV_STATE_KEY);
  } catch (e) {}
}

// ================= INITIALIZE =================
async function initApp() {
  startProgress();

  if (_supabase) {
    await loadFromSupabase();
  } else {
    state = loadState();
  }

  if (!state.stories || !state.stories.length) {
    state.stories = [createDemoStory()];
  }

  const savedNav = restoreNavigationState();
  if (savedNav) {
    const storyExists = state.stories.some(s => s.id === savedNav.storyId);

    if (savedNav.view === 'readerView' && savedNav.chapterId && storyExists) {
      currentStoryId = savedNav.storyId;
      currentChapterId = savedNav.chapterId;
      renderReader();
      showView('readerView');

      if (readingProgressBar) {
        readingProgressBar.classList.remove('reading-progress-hidden');
        setTimeout(updateReadingProgress, 100);
      }

      setTimeout(() => {
        window.scrollTo(0, savedNav.scrollPos || 0);
      }, 100);
      completeLoading();
      return;

    } else if (savedNav.view === 'storyView' && savedNav.storyId && storyExists) {
      currentStoryId = savedNav.storyId;
      renderStory();
      showView('storyView');
      completeLoading();
      return;

    } else if (savedNav.view === 'overviewView' && savedNav.storyId && storyExists) {
      currentStoryId = savedNav.storyId;
      const story = getStory();
      if (story) {
        document.getElementById("overviewStoryTitle").textContent = story.title;
        renderOverview();
        showView('overviewView');
        completeLoading();
        return;
      }
    }
  }

  renderLibrary();
  showView('libraryView');
  clearNavigationState();
  completeLoading();
}

// ================= UTILITIES =================
function uid() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}
function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function getStory() {
  return state.stories.find(s => s.id === currentStoryId);
}
function getChapter() {
  const story = getStory();
  if (!story) return null;
  return story.chapters.find(c => c.id === currentChapterId);
}
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const viewEl = document.getElementById(id);
  if (viewEl) viewEl.classList.add("active");
  currentView = id;
  saveNavigationState();

  if (id === 'readerView') {
    if (readingProgressBar) {
      readingProgressBar.classList.remove('reading-progress-hidden');
      setTimeout(updateReadingProgress, 50);
    }
  } else {
    if (readingProgressBar) {
      readingProgressBar.classList.add('reading-progress-hidden');
      readingProgressBar.style.width = '0%';
    }
  }
}
function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 1800);
}

// ===== UPDATE READING PROGRESS =====
function updateReadingProgress() {
  if (!readingProgressBar) return;
  const readerView = document.getElementById('readerView');
  if (!readerView || !readerView.classList.contains('active')) {
    readingProgressBar.style.width = '0%';
    return;
  }

  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight;
  const winHeight = window.innerHeight;
  const maxScroll = docHeight - winHeight;

  let percent = 0;
  if (maxScroll > 0) {
    percent = (scrollTop / maxScroll) * 100;
  }
  percent = Math.min(100, Math.max(0, percent));
  readingProgressBar.style.width = percent + '%';
}

window.addEventListener('scroll', () => {
  if (currentView === 'readerView') {
    saveNavigationState();
    updateReadingProgress();
  }
});

window.addEventListener('resize', () => {
  if (currentView === 'readerView') {
    updateReadingProgress();
  }
});

// ================= LOCAL STORAGE =================
function saveState(showMessage = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (showMessage) {
    toast("✓ Saved locally");
  }
}
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.stories)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error(error);
  }
  return { stories: [] };
}

// ================= LOAD FROM SUPABASE =================
async function loadFromSupabase() {
  try {
    const fetchWithTimeout = async (promise, ms = 3000) => {
      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Supabase request timed out")), ms);
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        clearTimeout(timer);
      }
    };

    const storiesRes = await fetchWithTimeout(
      _supabase
        .from('stories')
        .select('*')
        .order('created_at', { ascending: true })
    );
    const stories = storiesRes?.data;
    const storyErr = storiesRes?.error;
    if (storyErr) throw storyErr;

    const chaptersRes = await fetchWithTimeout(
      _supabase
        .from('chapters')
        .select('*')
        .order('chapter_order', { ascending: true })
    );
    const chapters = chaptersRes?.data;
    const chapErr = chaptersRes?.error;
    if (chapErr) throw chapErr;

    const notesRes = await fetchWithTimeout(
      _supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: true })
    );
    const notes = notesRes?.data;
    const noteErr = notesRes?.error;
    if (noteErr) throw noteErr;

    if (!stories || stories.length === 0) {
      const localState = loadState();
      if (localState.stories && localState.stories.length) {
        state = localState;
      } else {
        state.stories = [];
      }
      return;
    }

    state.stories = stories.map(story => {
      const storyChapters = (chapters || []).filter(c => c.story_id === story.id);
      const storyNotes = (notes || []).filter(n => n.story_id === story.id);

      const globalNotes = storyNotes.filter(n => n.type === 'global');

      const chapterNotesMap = {};
      storyChapters.forEach(ch => {
        chapterNotesMap[ch.id] = storyNotes.filter(n => n.chapter_id === ch.id && n.type !== 'global');
      });

      const chapterObjects = storyChapters.map(ch => ({
        id: ch.id,
        number: ch.chapter_order,
        title: ch.title,
        content: ch.content,
        notes: chapterNotesMap[ch.id] ? chapterNotesMap[ch.id].map(n => ({
          id: n.id,
          type: n.type || 'chapter',
          selectedText: n.selected_text || '',
          content: n.note_text || '',
          images: n.source ? [n.source] : [],
          caption: n.caption || '',
          source: n.source || '',
          createdAt: n.created_at || new Date().toISOString()
        })) : []
      }));

      const globalNoteObjects = globalNotes.map(n => ({
        id: n.id,
        type: 'global',
        category: 'Term',
        title: n.selected_text || '',
        content: n.note_text || '',
        selectedText: n.selected_text || '',
        images: n.source ? [n.source] : [],
        caption: n.caption || '',
        source: n.source || '',
        keywords: [n.selected_text || ''],
        chapterId: n.chapter_id || null,
        createdAt: n.created_at || new Date().toISOString()
      }));

      return {
        id: story.id,
        title: story.title,
        description: story.description || '',
        cover: story.cover_url || '',
        chapters: chapterObjects,
        globalNotes: globalNoteObjects
      };
    });

    saveState(false);
  } catch (error) {
    console.warn('Lưu trữ đám mây tạm thời không khả dụng, sử dụng bộ nhớ cục bộ:', error?.message || error);
    state = loadState();
    if (!state.stories || !state.stories.length) {
      state.stories = [createDemoStory()];
    }
  }
}

// ================= LOADING SCREEN =================
let progress = 0;
let progressInterval = null;

const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const loadingScreen = document.getElementById('loading-screen');
const mainContent = document.getElementById('main-content');
const player = document.getElementById('bookAnim');

if (player && animationData) {
  try {
    player.load(animationData);
  } catch (e) {
    console.warn('Lottie load error', e);
  }
}

function updateProgress(value) {
  const clamped = Math.min(value, 100);
  if (progressBar) progressBar.style.width = clamped + '%';
  if (progressText) progressText.innerText = Math.floor(clamped) + '%';
}

function startProgress() {
  progress = 0;
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  updateProgress(0);

  progressInterval = setInterval(() => {
    if (progress < 99) {
      progress += 2;
      if (progress > 99) progress = 99;
      updateProgress(progress);
    } else {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }, 40);
}

function completeLoading() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (progress < 100) {
    progress = 100;
    updateProgress(progress);
  }
  setTimeout(() => {
    finishLoading();
  }, 200);
}

function finishLoading() {
  if (loadingScreen) loadingScreen.classList.add('fade-out');
  setTimeout(() => {
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (mainContent) mainContent.classList.remove('hidden');
  }, 500);
}

// ================= CONFIRM DIALOG =================
function showConfirmDialog({
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

// ================= LIBRARY =================
function renderLibrary() {
  const grid = document.getElementById("storyGrid");
  if (!grid) return;
  grid.innerHTML = "";
  
  if (!state.stories || state.stories.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--muted);">
        <p style="font-size: 18px; margin-bottom: 15px;">No stories in your library yet.</p>
        <button class="btn primary" id="emptyAddStoryBtn">＋ Add New Story</button>
      </div>
    `;
    document.getElementById("emptyAddStoryBtn")?.addEventListener("click", () => {
      document.getElementById("addStoryBtn")?.click();
    });
    return;
  }

  state.stories.forEach(story => {
    const card = document.createElement("div");
    card.className = "story-card";
    card.innerHTML = `
      <div class="story-card-cover">
        ${story.cover ? `<img src="${story.cover}" alt="">` : `<div class="cover-empty">✦</div>`}
      </div>
      <div class="story-card-info">
        <h3 style="margin:0 0 6px 0; word-break: break-word;">${escapeHTML(story.title || "Untitled Story")}</h3>
        <p>${story.chapters.length} ${story.chapters.length === 1 ? "Chapter" : "Chapters"}</p>
      </div>
    `;
    
    card.addEventListener("click", () => {
      openStory(story.id);
    });
    grid.appendChild(card);
  });
}

// ================= STORY =================
function openStory(storyId) {
  currentStoryId = storyId;
  currentChapterId = null;
  renderStory();
  showView("storyView");
  saveNavigationState();
}
function renderStory() {
  const story = getStory();
  if (!story) return;
  document.getElementById("storyHeaderTitle").textContent = story.title;
  document.getElementById("storyTitleInput").value = story.title;
  document.getElementById("storyDescriptionInput").value = story.description || "";
  const cover = document.getElementById("storyCover");
  const placeholder = document.getElementById("coverPlaceholder");
  if (story.cover) {
    cover.src = story.cover;
    cover.style.display = "block";
    placeholder.style.display = "none";
  } else {
    cover.style.display = "none";
    placeholder.style.display = "flex";
  }
  renderChapterList();
}
function renderChapterList() {
  const story = getStory();
  const list = document.getElementById("chapterList");
  if (!list || !story) return;
  list.innerHTML = "";
  if (!story.chapters || story.chapters.length === 0) {
    list.innerHTML = `<p class="muted" style="padding: 10px 0;">Chưa có chương nào. Nhấn nút ＋ phía trên để thêm chương.</p>`;
    return;
  }
  story.chapters.sort((a,b) => a.number - b.number).forEach(chapter => {
    const item = document.createElement("div");
    item.className = "chapter-item";
    item.innerHTML = `
      <div style="flex:1; min-width:0; padding-right:12px;">
        <span class="chapter-number">CHAPTER ${chapter.number}</span>
        <span class="chapter-item-title">${escapeHTML(chapter.title || "Untitled Chapter")}</span>
      </div>
      <div class="chapter-item-actions">
        <button class="btn ghost chapter-delete" data-delete-chapter="${chapter.id}">Delete</button>
      </div>
    `;
    item.addEventListener("click", event => {
      const delBtn = event.target.closest("[data-delete-chapter]");
      if (delBtn) {
        event.stopPropagation();
        deleteChapter(delBtn.getAttribute("data-delete-chapter"));
        return;
      }
      openChapter(chapter.id);
    });
    list.appendChild(item);
  });
}

// ================= ADD STORY =================
document.getElementById("addStoryBtn")?.addEventListener("click", async () => {
  const newId = uid();
  const story = {
    id: newId,
    title: "Untitled Story",
    description: "",
    cover: "",
    chapters: [],
    globalNotes: []
  };
  state.stories.push(story);
  currentStoryId = story.id;
  
  saveState(false);
  renderLibrary();
  openStory(story.id);

  try {
    if (_supabase) {
      const { data, error } = await _supabase
        .from('stories')
        .insert({
          id: story.id,
          title: story.title,
          description: story.description,
          cover_url: story.cover,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      if (error) {
        console.warn('Supabase story insert warning:', error);
      } else if (data && data[0] && data[0].id) {
        const originalId = story.id;
        story.id = data[0].id;
        if (currentStoryId === originalId) {
          currentStoryId = story.id;
        }
        saveState(false);
      }
    }
    toast("New story created");
  } catch (err) {
    console.warn("Supabase addStory err:", err);
    toast("New story created");
  }
});

// ================= SAVE STORY =================
document.getElementById("saveStoryBtn")?.addEventListener("click", async () => {
  const story = getStory();
  if (!story) return;
  story.title = document.getElementById("storyTitleInput").value.trim() || "Untitled Story";
  story.description = document.getElementById("storyDescriptionInput").value;

  try {
    if (_supabase) {
      const { data, error } = await _supabase
        .from('stories')
        .upsert({
          id: story.id,
          title: story.title,
          description: story.description,
          cover_url: story.cover || null,
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;
      if (data && data[0]) {
        story.id = data[0].id;
        story.cover = data[0].cover_url || '';
      }
    }
    saveState(false);
    toast("Story saved");
    renderStory();
    renderLibrary();
  } catch (err) {
    console.error(err);
    saveState(false);
    toast("Story saved locally");
    renderStory();
    renderLibrary();
  }
});

// ================= COVER =================
document.getElementById("coverPlaceholder")?.addEventListener("click", () => {
  document.getElementById("coverInput")?.click();
});
document.getElementById("storyCover")?.addEventListener("click", () => {
  document.getElementById("coverInput")?.click();
});
document.getElementById("coverInput")?.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const story = getStory();
  if (!story) return;

  try {
    if (_supabase) {
      const filePath = `covers/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await _supabase.storage
        .from('reader-images')
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = _supabase.storage
        .from('reader-images')
        .getPublicUrl(filePath);
      const coverUrl = urlData.publicUrl;

      if (story.cover && story.cover.includes('reader-images')) {
        const oldPath = story.cover.split('/reader-images/')[1];
        if (oldPath) {
          await _supabase.storage.from('reader-images').remove([oldPath]);
        }
      }

      story.cover = coverUrl;
      await _supabase
        .from('stories')
        .update({ cover_url: coverUrl, updated_at: new Date().toISOString() })
        .eq('id', story.id);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        story.cover = e.target.result;
        saveState(false);
        renderStory();
        renderLibrary();
      };
      reader.readAsDataURL(file);
      return;
    }

    toast('Cover updated');
    renderStory();
    renderLibrary();
  } catch (err) {
    console.error(err);
    const reader = new FileReader();
    reader.onload = (e) => {
      story.cover = e.target.result;
      saveState(false);
      renderStory();
      renderLibrary();
    };
    reader.readAsDataURL(file);
    toast('Cover saved locally');
  }
});

// ================= DELETE STORY =================
async function deleteStory(storyId) {
  if (!storyId) return;
  const story = state.stories.find(s => s.id === storyId);
  if (!story) return;

  const ok = await showConfirmDialog({
    title: "Delete Story",
    message: `Are you sure you want to delete "${story.title || 'Untitled Story'}"?\n\nAll ${story.chapters?.length || 0} chapters, notes, and illustrations will be permanently removed.`,
    confirmText: "Delete Story",
    cancelText: "Cancel",
    danger: true
  });
  if (!ok) return;

  const storyCopy = { ...story };
  state.stories = state.stories.filter(s => s.id !== storyId);
  if (currentStoryId === storyId) {
    currentStoryId = null;
    currentChapterId = null;
  }
  saveState(false);
  clearNavigationState();
  renderLibrary();
  showView('libraryView');
  toast(`Story "${storyCopy.title || 'Untitled Story'}" deleted`);

  (async () => {
    try {
      if (_supabase) {
        if (storyCopy.cover) {
          await deleteImageFromStorage(storyCopy.cover);
        }
        const { data: notes } = await _supabase
          .from('notes')
          .select('id, source')
          .eq('story_id', storyId);

        if (notes) {
          for (const note of notes) {
            if (note.source) {
              await deleteImageFromStorage(note.source);
            }
          }
        }

        await _supabase.from('notes').delete().eq('story_id', storyId);
        await _supabase.from('chapters').delete().eq('story_id', storyId);
        await _supabase.from('stories').delete().eq('id', storyId);
      }
    } catch (err) {
      console.warn("Supabase delete story error:", err);
    }
  })();
}

document.getElementById("deleteStoryBtn")?.addEventListener("click", () => {
  const story = getStory();
  if (story) {
    deleteStory(story.id);
  }
});

// ================= ADD CHAPTER =================
document.getElementById("addChapterBtn")?.addEventListener("click", async () => {
  const story = getStory();
  if (!story) return;
  const nextNumber = story.chapters.length ? Math.max(...story.chapters.map(c => c.number)) + 1 : 1;
  const chapter = {
    id: uid(),
    number: nextNumber,
    title: "",
    content: `<p>Start writing your chapter here...</p>`,
    notes: []
  };
  story.chapters.push(chapter);

  try {
    if (_supabase) {
      const { data, error } = await _supabase
        .from('chapters')
        .insert({
          id: chapter.id,
          story_id: story.id,
          title: chapter.title,
          content: chapter.content,
          chapter_order: chapter.number,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;
      if (data && data[0]) {
        chapter.id = data[0].id;
      }
    }
    saveState(false);
    renderChapterList();
    openChapter(chapter.id);
    toast(`Chapter ${nextNumber} created`);
  } catch (err) {
    console.error(err);
    saveState(false);
    renderChapterList();
    openChapter(chapter.id);
    toast(`Chapter ${nextNumber} created locally`);
  }
});

// ================= DELETE CHAPTER =================
async function deleteChapter(chapterId) {
  const story = getStory();
  if (!story) return;
  const chapter = story.chapters.find(c => c.id === chapterId);
  if (!chapter) return;
  const chapterNumber = chapter.number;
  const chapterTitle = chapter.title || `Chapter ${chapterNumber}`;

  const ok = await showConfirmDialog({
    title: "Delete Chapter",
    message: `Are you sure you want to delete Chapter ${chapterNumber} ("${chapterTitle}")?\n\nAll notes and annotations in this chapter will be deleted.`,
    confirmText: "Delete Chapter",
    cancelText: "Cancel",
    danger: true
  });
  if (!ok) return;

  story.chapters = story.chapters.filter(c => c.id !== chapterId);
  story.chapters.sort((a,b) => a.number - b.number).forEach((ch, idx) => {
    ch.number = idx + 1;
  });
  if (currentChapterId === chapterId) {
    currentChapterId = null;
    renderStory();
    showView('storyView');
  }
  saveState(false);
  renderChapterList();
  toast(`Chapter ${chapterNumber} deleted`);

  (async () => {
    try {
      if (_supabase) {
        const { data: notes } = await _supabase
          .from('notes')
          .select('id, source')
          .eq('chapter_id', chapterId);

        if (notes) {
          for (const note of notes) {
            if (note.source) {
              await deleteImageFromStorage(note.source);
            }
          }
        }

        await _supabase.from('notes').delete().eq('chapter_id', chapterId);
        await _supabase.from('chapters').delete().eq('id', chapterId);
      }
    } catch (err) {
      console.warn("Supabase delete chapter error:", err);
    }
  })();
}

// ================= OPEN CHAPTER =================
function openChapter(chapterId, noteId, keyword) {
  currentChapterId = chapterId;
  renderReader();
  showView("readerView");
  closeEditor();
  saveNavigationState();
  
  const highlightTarget = (target, type = 'chapter') => {
    if (!target) return;
    smoothScrollTo(target, 400);
    target.classList.remove('highlight-chapter', 'highlight-global');
    if (type === 'global') {
      target.classList.add('highlight-global');
    } else {
      target.classList.add('highlight-chapter');
    }
    setTimeout(() => {
      target.classList.remove('highlight-chapter', 'highlight-global');
    }, 2000);
  };

  if (noteId) {
    setTimeout(() => {
      const target = document.querySelector(`#readerContent [data-note-id="${noteId}"]`);
      if (target) {
        highlightTarget(target, 'chapter');
      } else {
        window.scrollTo(0, 0);
      }
    }, 300);
  } else if (keyword) {
    setTimeout(() => {
      const reader = document.getElementById('readerContent');
      if (!reader) {
        window.scrollTo(0, 0);
        return;
      }
      
      const walker = document.createTreeWalker(
        reader,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            return node.textContent.toLowerCase().includes(keyword.toLowerCase()) 
              ? NodeFilter.FILTER_ACCEPT 
              : NodeFilter.FILTER_REJECT;
          }
        }
      );
      
      let found = false;
      let nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        nodes.push(node);
      }
      
      if (nodes.length > 0) {
        const firstNode = nodes[0];
        const text = firstNode.textContent;
        const index = text.toLowerCase().indexOf(keyword.toLowerCase());
        if (index !== -1) {
          const range = document.createRange();
          range.setStart(firstNode, index);
          range.setEnd(firstNode, index + keyword.length);
          
          const rect = range.getBoundingClientRect();
          const dummy = document.createElement('span');
          dummy.style.position = 'absolute';
          dummy.style.top = (rect.top + window.pageYOffset - 50) + 'px';
          dummy.style.left = '0';
          dummy.style.width = '1px';
          dummy.style.height = '1px';
          document.body.appendChild(dummy);
          smoothScrollTo(dummy, 400);
          setTimeout(() => {
            if (dummy.parentNode) document.body.removeChild(dummy);
          }, 500);
          
          try {
            const highlightSpan = document.createElement('span');
            range.surroundContents(highlightSpan);
            highlightSpan.classList.add('highlight-global');
            setTimeout(() => {
              highlightSpan.classList.remove('highlight-global');
            }, 2000);
          } catch (e) {
            const parent = firstNode.parentNode;
            const textNode = firstNode;
            const beforeText = text.substring(0, index);
            const matchText = text.substring(index, index + keyword.length);
            const afterText = text.substring(index + keyword.length);
            
            const span = document.createElement('span');
            span.classList.add('highlight-global');
            span.textContent = matchText;
            setTimeout(() => {
              span.classList.remove('highlight-global');
            }, 2000);
            
            const fragment = document.createDocumentFragment();
            if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
            fragment.appendChild(span);
            if (afterText) fragment.appendChild(document.createTextNode(afterText));
            parent.replaceChild(fragment, textNode);
          }
          found = true;
        }
      }
      
      if (!found) {
        toast(`Không tìm thấy từ "${keyword}" trong chapter này.`);
        window.scrollTo(0, 0);
      }
    }, 300);
  } else {
    window.scrollTo(0, 0);
  }
}
function renderReader() {
  const story = getStory();
  const chapter = getChapter();
  if (!story || !chapter) return;
  document.getElementById("readerStoryName").textContent = story.title;
  document.getElementById("readerChapterName").textContent = `Chapter ${chapter.number}: ${chapter.title || "Untitled"}`;
  const reader = document.getElementById("readerContent");
  reader.innerHTML = chapter.content;
  
  const annotations = reader.querySelectorAll('.editor-annotation, .annotation');
  annotations.forEach(el => {
    const noteId = el.dataset.noteId;
    let note = chapter.notes.find(n => n.id === noteId);
    if (note) {
      el.classList.add('chapter-note');
      el.dataset.noteType = 'chapter';
    } else {
      const globalNote = story.globalNotes.find(n => n.id === noteId);
      if (globalNote) {
        el.classList.add('global-note');
        el.dataset.noteType = 'global';
      }
    }
  });
  
  activateReaderAnnotations();
}

// ================= READER ANNOTATIONS =================
function activateReaderAnnotations() {
  document.querySelectorAll("#readerContent .annotation, #readerContent .editor-annotation").forEach(el => {
    el.addEventListener("click", event => {
      event.stopPropagation();
      const noteId = el.dataset.noteId;
      const chapter = getChapter();
      if (!chapter) return;
      const note = chapter.notes.find(n => n.id === noteId);
      if (!note) {
        const story = getStory();
        const global = story?.globalNotes.find(n => n.id === noteId);
        if (global) {
          showNotePopup(global, el);
        }
        return;
      }
      showNotePopup(note, el);
    });
  });
}

// ================= POPUP MANAGEMENT =================
function positionPopup(popup, anchor) {
  if (!popup) return;
  if (!anchor) {
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    return;
  }

  let rect = null;
  try {
    if (typeof anchor.getBoundingClientRect === 'function') {
      rect = anchor.getBoundingClientRect();
    } else if (anchor instanceof Element) {
      rect = anchor.getBoundingClientRect();
    } else if (anchor.clientX !== undefined && anchor.clientY !== undefined) {
      rect = { top: anchor.clientY, bottom: anchor.clientY, left: anchor.clientX, right: anchor.clientX, width: 0, height: 0 };
    }
  } catch (e) {
    rect = null;
  }

  if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    return;
  }

  popup.style.transform = 'none';

  const popupWidth = popup.offsetWidth || 340;
  const popupHeight = popup.offsetHeight || 260;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const margin = 14;

  let left = rect.left;
  if (left + popupWidth > viewportWidth - margin) {
    left = viewportWidth - popupWidth - margin;
  }
  if (left < margin) {
    left = margin;
  }

  let top = rect.bottom + 8;
  const spaceBelow = viewportHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;

  if (popupHeight > spaceBelow && spaceAbove > spaceBelow) {
    top = Math.max(margin, rect.top - popupHeight - 8);
  } else {
    if (top + popupHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - popupHeight - margin);
    }
  }

  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;
}

function openPopup(html, anchor) {
  const popup = document.getElementById('notePopup');
  if (!popup) return;
  
  if (popup._outsideHandler) {
    document.removeEventListener('click', popup._outsideHandler, true);
    delete popup._outsideHandler;
  }

  popup.innerHTML = html;
  popup.style.position = 'fixed';
  popup.style.zIndex = '1000';
  popup.style.display = 'block';
  popup.style.visibility = 'visible';
  
  if (anchor) {
    positionPopup(popup, anchor);
  } else {
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }
  popup.classList.add('open');

  function handler(e) {
    if (!popup.classList.contains('open')) return;
    if (popup.contains(e.target)) return;
    if (e.target && !document.body.contains(e.target)) return;
    if (popup.querySelector('#newNoteContent') || popup.querySelector('#editNoteContent')) {
      return;
    }
    closeNotePopup();
  }
  
  popup._outsideHandler = handler;
  setTimeout(() => {
    if (popup.classList.contains('open')) {
      document.addEventListener('click', handler, true);
    }
  }, 120);
}

function closePopup() {
  const popup = document.getElementById('notePopup');
  if (!popup) return;
  if (popup._outsideHandler) {
    document.removeEventListener('click', popup._outsideHandler, true);
    delete popup._outsideHandler;
  }
  popup.classList.remove('open');
  popup.style.display = 'none';
  popup.style.visibility = 'hidden';
}

function closeNotePopup() {
  closePopup();
}
window.closeNotePopup = closeNotePopup;

// ================= NOTE DISPLAY =================
function showNotePopup(note, anchor) {
  const isGlobal = note.type === "global";
  const noteLabel = isGlobal ? "Global Note" : "Chapter Note";
  const icon = isGlobal ? "🪐" : "🌙";
  const displayText = isGlobal ? (note.title || note.selectedText) : note.selectedText;

  const html = `
    <div class="popup-header">
      <strong class="popup-tag ${isGlobal ? 'global' : 'chapter'}">
        <span>${icon}</span> ${noteLabel}
      </strong>
      <div class="popup-actions">
        <button id="editNoteBtnTrigger" type="button" class="icon-action-btn" title="Edit note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
        <button id="deleteNoteBtnTrigger" type="button" class="icon-action-btn delete" title="Delete note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
        <button id="closeNotePopupBtn" type="button" class="icon-action-btn" title="Close">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
    <div class="popup-selected">
      <span>"${escapeHTML(displayText || "")}"</span>
    </div>
    <div class="popup-content">
      <div>${escapeHTML(note.content || "").replace(/\n/g, "<br>")}</div>
      ${note.images?.length ? `<div style="display:flex; flex-wrap:wrap; gap:8px; margin:10px 0;">${note.images.map(img => `<img src="${img}" style="max-width:100%; max-height:200px; border-radius:8px; object-fit:cover; border:1px solid var(--border);">`).join("")}</div>` : ""}
      ${note.caption ? `<div style="font-size:12px; color:var(--muted); margin-top:6px;">${escapeHTML(note.caption)}</div>` : ""}
      ${note.source && !note.source.includes('reader-images') ? `<div style="font-size:12px; color:var(--muted); margin-top:4px;">📎 ${escapeHTML(note.source)}</div>` : ""}
    </div>
  `;
  openPopup(html, anchor);

  document.getElementById("closeNotePopupBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeNotePopup();
  });

  const editBtn = document.getElementById("editNoteBtnTrigger");
  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      editNote(note.id, isGlobal ? 'global' : 'chapter', anchor);
    });
  }

  const deleteBtn = document.getElementById("deleteNoteBtnTrigger");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      deleteNote(note.id, isGlobal ? 'global' : 'chapter');
    });
  }
}

// ================= EDIT NOTE (BẢNG EDIT CỦA CHAPTER NOTE, GLOBAL NOTE & KHI NHẤP DẤU MŨI TÊN/EDIT) =================
function editNote(noteId, type, anchor = null) {
  const story = getStory();
  if (!story) {
    toast("Story not found");
    return;
  }
  let note = null;
  if (type === 'global') {
    note = story.globalNotes.find(n => n.id === noteId);
  } else {
    for (let ch of story.chapters) {
      const found = ch.notes.find(n => n.id === noteId);
      if (found) {
        note = found;
        break;
      }
    }
  }
  if (!note) {
    toast("Note not found");
    return;
  }

  let effectiveAnchor = anchor;
  if (!effectiveAnchor) {
    effectiveAnchor = document.querySelector(`#readerContent [data-note-id="${note.id}"], #chapterEditor [data-note-id="${note.id}"]`);
  }

  const isGlobal = note.type === "global";
  const noteLabel = isGlobal ? "Global Note" : "Chapter Note";
  const icon = isGlobal ? "🪐" : "🌙";

  const html = `
    <div class="popup-header">
      <strong class="popup-tag ${isGlobal ? 'global' : 'chapter'}">
        <span>${icon}</span> Edit ${noteLabel}
      </strong>
      <button id="closeEditNoteBtn" type="button" class="icon-action-btn" title="Close">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <label class="popup-section-label">Note</label>
    <textarea id="editNoteContent" class="note-textarea" placeholder="Write your note...">${escapeHTML(note.content || '')}</textarea>
    
    <div class="illustration-label-wrapper">
      <label class="illustration-label">Illustration</label>
    </div>
    
    <div class="illustration-container-row">
      <div id="editImageSlots" class="image-slots-container"></div>
      <div class="source-fields-column">
        <input id="editCaption" class="source-field-input" placeholder="Caption (optional)" value="${escapeHTML(note.caption || '')}">
        <input id="editSource" class="source-field-input" placeholder="Source (optional)" value="${escapeHTML(note.source || '')}">
      </div>
    </div>
    
    <button class="btn primary full save-note-btn" id="saveEditNoteBtn" type="button">Save Changes</button>
  `;

  openPopup(html, effectiveAnchor);

  document.getElementById("closeEditNoteBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeNotePopup();
  });

  function renderEditImages(targetNote) {
    const container = document.getElementById('editImageSlots');
    if (!container) return;
    container.innerHTML = '';
    if (targetNote.images && targetNote.images.length > 0) {
      targetNote.images.forEach(img => {
        const slot = document.createElement('div');
        slot.className = 'image-slot';
        slot.innerHTML = `
          <img src="${img}">
          <button class="image-remove" data-image="${img}">×</button>
        `;
        container.appendChild(slot);
      });
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'add-image-btn';
    addBtn.id = 'editAddImageBtn';
    addBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    addBtn.title = 'Add image';
    addBtn.type = 'button';
    container.appendChild(addBtn);
    addBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      triggerImageUpload(targetNote, renderEditImages);
    });
  }

  function triggerImageUpload(targetNote, rerender) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    fileInput.click();
    fileInput.addEventListener('change', async function(e) {
      const file = e.target.files[0];
      if (!file) {
        if (fileInput.parentNode) document.body.removeChild(fileInput);
        return;
      }
      try {
        if (_supabase) {
          const filePath = `notes/${Date.now()}_${file.name}`;
          const { error } = await _supabase.storage
            .from('reader-images')
            .upload(filePath, file);
          if (error) throw error;
          const { data: urlData } = _supabase.storage.from('reader-images').getPublicUrl(filePath);
          const imageUrl = urlData.publicUrl;
          if (!targetNote.images) targetNote.images = [];
          targetNote.images.push(imageUrl);
        } else {
          const reader = new FileReader();
          reader.onload = (re) => {
            if (!targetNote.images) targetNote.images = [];
            targetNote.images.push(re.target.result);
            rerender(targetNote);
          };
          reader.readAsDataURL(file);
          if (fileInput.parentNode) document.body.removeChild(fileInput);
          return;
        }
        rerender(targetNote);
        toast('Image uploaded');
      } catch (err) {
        console.error(err);
        const reader = new FileReader();
        reader.onload = (re) => {
          if (!targetNote.images) targetNote.images = [];
          targetNote.images.push(re.target.result);
          rerender(targetNote);
        };
        reader.readAsDataURL(file);
      }
      if (fileInput.parentNode) document.body.removeChild(fileInput);
    });
  }

  renderEditImages(note);

  document.getElementById('editImageSlots')?.addEventListener('click', function(e) {
    const removeBtn = e.target.closest('.image-remove');
    if (!removeBtn) return;
    e.stopPropagation();
    const imgUrl = removeBtn.dataset.image;
    if (!imgUrl) return;
    if (!note.images) note.images = [];
    const index = note.images.indexOf(imgUrl);
    if (index !== -1) {
      note.images.splice(index, 1);
      renderEditImages(note);
    }
  });

  document.getElementById('saveEditNoteBtn')?.addEventListener('click', function(e) {
    e.stopPropagation();
    const newContent = document.getElementById('editNoteContent').value.trim();
    if (!newContent) {
      toast("Content cannot be empty");
      return;
    }
    note.content = newContent;
    note.caption = document.getElementById('editCaption').value.trim();
    note.source = document.getElementById('editSource').value.trim();

    saveState(false);
    closeNotePopup();
    renderOverview();
    if (document.getElementById('readerView')?.classList.contains('active')) {
      renderReader();
    }
    toast("Note updated");

    (async () => {
      try {
        if (_supabase) {
          await _supabase
            .from('notes')
            .update({
              note_text: newContent,
              caption: note.caption,
              source: note.source,
              updated_at: new Date().toISOString()
            })
            .eq('id', note.id);
        }
      } catch (err) {
        console.warn("Background update note error:", err);
      }
    })();
  });
}
window.editNote = editNote;

// ================= EDIT MODE =================
document.getElementById("toggleEditBtn")?.addEventListener("click", openEditor);
document.getElementById("closeEditorBtn")?.addEventListener("click", closeEditor);
function openEditor() {
  const chapter = getChapter();
  if (!chapter) return;
  document.getElementById("chapterTitleInput").value = chapter.title || "";
  document.getElementById("chapterEditor").innerHTML = chapter.content;
  document.getElementById("editorPanel")?.classList.add("open");
  activateEditorAnnotations();
}
function closeEditor() {
  document.getElementById("editorPanel")?.classList.remove("open");
  closeNotePopup();
}

// ================= SAVE CHAPTER =================
document.getElementById("saveChapterBtn")?.addEventListener("click", async () => {
  const story = getStory();
  const chapter = getChapter();
  if (!story || !chapter) return;

  chapter.title = document.getElementById("chapterTitleInput").value.trim();
  chapter.content = document.getElementById("chapterEditor").innerHTML;

  try {
    if (_supabase) {
      const { data, error } = await _supabase
        .from('chapters')
        .upsert({
          id: chapter.id,
          story_id: story.id,
          title: chapter.title,
          content: chapter.content,
          chapter_order: chapter.number,
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;
      if (data && data[0]) {
        chapter.id = data[0].id;
      }
    }
    saveState(false);
    toast("Chapter saved");
    renderReader();
    renderChapterList();
  } catch (err) {
    console.error(err);
    saveState(false);
    toast("Chapter saved locally");
    renderReader();
    renderChapterList();
  }
});

// ================= EDITOR ANNOTATIONS =================
function activateEditorAnnotations() {
  document.querySelectorAll("#chapterEditor .editor-annotation, #chapterEditor .annotation").forEach(el => {
    el.addEventListener("click", event => {
      event.stopPropagation();
      const noteId = el.dataset.noteId;
      const chapter = getChapter();
      if (!chapter) return;
      const note = chapter.notes.find(n => n.id === noteId);
      if (!note) {
        const story = getStory();
        const global = story?.globalNotes.find(n => n.id === noteId);
        if (global) {
          showNotePopup(global, el);
        }
        return;
      }
      showNotePopup(note, el);
    });
  });
}

// ================= TEXT SELECTION =================
document.getElementById("chapterEditor")?.addEventListener("mouseup", handleTextSelection);
document.getElementById("chapterEditor")?.addEventListener("touchend", () => {
  setTimeout(handleTextSelection, 100);
});
function handleTextSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const text = selection.toString().trim();
  if (!text) return;
  const range = selection.getRangeAt(0);
  const editor = document.getElementById("chapterEditor");
  if (!editor || !editor.contains(range.commonAncestorContainer)) return;
  selectedRange = range.cloneRange();
  selectedText = text;
  showCreateNotePopup(range);
}

// ================= CREATE NOTE POPUP (BƯỚC 1: CONFIRM) =================
function showCreateNotePopup(range) {
  pendingImages = [];
  const anchor = { getBoundingClientRect: () => range.getBoundingClientRect() };

  const html = `
    <div class="popup-header">
      <strong class="popup-tag chapter">
        <span>✨</span> Add Note
      </strong>
      <button onclick="closeCreatePopup()" type="button" class="icon-action-btn" title="Close">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="popup-selected">
      <span>"${escapeHTML(selectedText)}"</span>
    </div>
    <label class="popup-section-label">Note Type</label>
    <div class="note-type-row">
      <button class="type-btn active" data-type="chapter" type="button">
        <span class="type-icon">🌙</span><span class="type-label">Chapter Note</span>
      </button>
      <button class="type-btn" data-type="global" type="button">
        <span class="type-icon">🪐</span><span class="type-label">Global Note</span>
      </button>
    </div>
    <button class="btn primary full" id="confirmSelectionBtn" type="button">Confirm</button>
  `;

  openPopup(html, anchor);
  
  const popup = document.getElementById('notePopup');
  if (!popup) return;
  popup.querySelectorAll(".type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      popup.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      pendingNoteType = btn.dataset.type;
    });
  });
  
  popup.querySelector("#confirmSelectionBtn")?.addEventListener("click", function() {
    closePopup();
    openNoteEditor();
  });
}

function closeCreatePopup() {
  closeNotePopup();
  selectedRange = null;
  selectedText = "";
  pendingImages = [];
}
window.closeCreatePopup = closeCreatePopup;

// ================= NOTE EDITOR (BƯỚC 2: SAU CONFIRM) =================
function openNoteEditor() {
  const isGlobal = pendingNoteType === "global";
  const noteLabel = isGlobal ? "Global Note" : "Chapter Note";
  const icon = isGlobal ? "🪐" : "🌙";
  
  const html = `
    <div class="popup-header">
      <strong class="popup-tag ${isGlobal ? 'global' : 'chapter'}">
        <span>${icon}</span> ${noteLabel}
      </strong>
      <button onclick="closeCreatePopup()" type="button" class="icon-action-btn" title="Close">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <label class="popup-section-label">Note</label>
    <textarea id="newNoteContent" class="note-textarea" placeholder="Write your note..."></textarea>
    
    <div class="illustration-label-wrapper">
      <label class="illustration-label">Illustration</label>
    </div>
    
    <div class="illustration-container-row">
      <div id="newImageSlots" class="image-slots-container">
        <button class="add-image-btn" id="firstImageBtn" title="Add image" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>
      <div class="source-fields-column">
        <input id="newCaption" class="source-field-input" placeholder="Caption (optional)">
        <input id="newSource" class="source-field-input" placeholder="Source (optional)">
      </div>
    </div>
    
    <button class="btn primary full save-note-btn" id="saveNewNoteBtn" type="button">Save Note</button>
  `;
  
  const anchor = getAnchorFromRange(selectedRange);
  const popup = document.getElementById('notePopup');
  if (!popup) return;
  if (popup._outsideHandler) {
    document.removeEventListener('click', popup._outsideHandler);
    delete popup._outsideHandler;
  }
  
  popup.innerHTML = html;
  popup.style.position = 'fixed';
  popup.style.zIndex = '1000';
  popup.style.display = 'block';
  popup.style.visibility = 'visible';
  
  if (anchor) {
    positionPopup(popup, anchor);
  } else {
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }
  popup.classList.add('open');
  
  document.getElementById("firstImageBtn")?.addEventListener("click", () => addImageSlot());
  document.getElementById("saveNewNoteBtn")?.addEventListener("click", saveNewNote);
}

function getAnchorFromRange(range) {
  if (!range) return null;
  const rect = range.getBoundingClientRect();
  return { getBoundingClientRect: () => rect };
}

// ================= IMAGE SLOT =================
function addImageSlot() {
  const wrapper = document.getElementById("newImageSlots");
  if (!wrapper) return;
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  wrapper.appendChild(fileInput);
  fileInput.click();

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      if (_supabase) {
        const filePath = `notes/${Date.now()}_${file.name}`;
        const { error } = await _supabase.storage
          .from('reader-images')
          .upload(filePath, file);
        if (error) throw error;

        const { data: urlData } = _supabase.storage
          .from('reader-images')
          .getPublicUrl(filePath);
        const imageUrl = urlData.publicUrl;
        pendingImages.push(imageUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          pendingImages.push(e.target.result);
          renderPendingImages();
        };
        reader.readAsDataURL(file);
        return;
      }
      renderPendingImages();
      toast('Đã upload ảnh');
    } catch (err) {
      console.error(err);
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingImages.push(e.target.result);
        renderPendingImages();
      };
      reader.readAsDataURL(file);
    }
  });
}

function renderPendingImages() {
  const wrapper = document.getElementById("newImageSlots");
  if (!wrapper) return;
  wrapper.innerHTML = "";
  pendingImages.forEach((imageUrl, index) => {
    const slot = document.createElement("div");
    slot.className = "image-slot";
    slot.innerHTML = `<img src="${imageUrl}"><button class="image-remove" data-index="${index}">×</button>`;
    wrapper.appendChild(slot);
  });
  const addBtn = document.createElement("button");
  addBtn.className = "add-image-btn";
  addBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  addBtn.title = "Add another image";
  addBtn.type = "button";
  addBtn.addEventListener("click", addImageSlot);
  wrapper.appendChild(addBtn);
  wrapper.querySelectorAll(".image-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      pendingImages.splice(Number(btn.dataset.index), 1);
      renderPendingImages();
    });
  });
}

// ================= SAVE NOTE =================
async function saveNewNote() {
  const chapter = getChapter();
  const story = getStory();
  if (!chapter || !story) return;

  const content = document.getElementById("newNoteContent").value.trim();
  const caption = document.getElementById("newCaption").value.trim();
  const source = document.getElementById("newSource").value.trim();
  if (!content) {
    toast("Please write a note first");
    return;
  }

  const noteId = uid();
  const imageUrl = pendingImages.length > 0 ? pendingImages[0] : '';
  const noteType = pendingNoteType;
  const chapterId = chapter.id;

  try {
    if (_supabase) {
      await _supabase
        .from('notes')
        .insert({
          id: noteId,
          story_id: story.id,
          chapter_id: chapterId,
          type: noteType,
          selected_text: selectedText,
          note_text: content,
          caption: caption,
          source: imageUrl || source,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    const newNote = {
      id: noteId,
      type: noteType,
      selectedText: selectedText,
      content: content,
      images: pendingImages,
      caption: caption,
      source: imageUrl || source,
      chapterId: chapterId,
      createdAt: new Date().toISOString()
    };

    if (noteType === 'chapter') {
      chapter.notes.push(newNote);
    } else {
      story.globalNotes.push({
        ...newNote,
        title: selectedText,
        category: 'Term',
        keywords: [selectedText]
      });
    }

    applyAnnotationToSelection(noteId);
    chapter.content = document.getElementById("chapterEditor").innerHTML;

    if (_supabase) {
      await _supabase
        .from('chapters')
        .update({ content: chapter.content, updated_at: new Date().toISOString() })
        .eq('id', chapter.id);
    }

    saveState(false);
    toast("Note saved");
    closeNotePopup();
    selectedRange = null;
    selectedText = "";
    pendingImages = [];
    renderReader();
    openEditor();
    activateEditorAnnotations();
  } catch (err) {
    console.error(err);
    saveState(false);
    toast("Note saved locally");
    closeNotePopup();
    selectedRange = null;
    selectedText = "";
    pendingImages = [];
    renderReader();
    openEditor();
    activateEditorAnnotations();
  }
}

// ================= APPLY ANNOTATION =================
function applyAnnotationToSelection(noteId) {
  if (!selectedRange) return;
  try {
    const span = document.createElement("span");
    const noteType = pendingNoteType || 'chapter';
    span.className = `editor-annotation ${noteType === 'global' ? 'global-note' : 'chapter-note'}`;
    span.dataset.noteId = noteId;
    span.dataset.noteType = noteType;
    const contents = selectedRange.extractContents();
    span.appendChild(contents);
    selectedRange.insertNode(span);
    const selection = window.getSelection();
    selection?.removeAllRanges();
  } catch (error) {
    console.error("Could not annotate selection", error);
  }
}

// ================= NAVIGATION =================
document.getElementById("readerBackBtn")?.addEventListener("click", () => {
  closeEditor();
  showView("storyView");
  renderStory();
  saveNavigationState();
});
document.getElementById("chapterBackBtn")?.addEventListener("click", () => {
  goPreviousChapter();
});
document.getElementById("chapterContinueBtn")?.addEventListener("click", () => {
  goNextChapter();
});
function goPreviousChapter() {
  const story = getStory();
  if (!story) return;
  const index = story.chapters.findIndex(c => c.id === currentChapterId);
  if (index <= 0) {
    showView("storyView");
    renderStory();
    saveNavigationState();
    return;
  }
  openChapter(story.chapters[index - 1].id);
}
function goNextChapter() {
  const story = getStory();
  if (!story) return;
  const index = story.chapters.findIndex(c => c.id === currentChapterId);
  if (index === story.chapters.length - 1) {
    toast("You have reached the end of this story.");
    return;
  }
  openChapter(story.chapters[index + 1].id);
}

// ================= TOP NAVIGATION =================
document.getElementById("topChapterBackBtn")?.addEventListener("click", () => {
  goPreviousChapter();
});
document.getElementById("topChapterContinueBtn")?.addEventListener("click", () => {
  goNextChapter();
});
document.getElementById("topChapterListBtn")?.addEventListener("click", () => {
  openChapterDrawer();
});

// ================= CHAPTER DRAWER =================
document.getElementById("chapterListBtn")?.addEventListener("click", openChapterDrawer);
function openChapterDrawer() {
  const story = getStory();
  const list = document.getElementById("drawerChapterList");
  if (!story || !list) return;
  list.innerHTML = "";
  story.chapters.forEach(chapter => {
    const item = document.createElement("div");
    item.className = "drawer-chapter" + (chapter.id === currentChapterId ? " current" : "");
    item.textContent = `Chapter ${chapter.number}: ${chapter.title || "Untitled"}`;
    item.addEventListener("click", () => {
      closeChapterDrawer();
      openChapter(chapter.id);
    });
    list.appendChild(item);
  });
  document.getElementById("chapterDrawer")?.classList.add("open");
}
function closeChapterDrawer() {
  document.getElementById("chapterDrawer")?.classList.remove("open");
}
document.getElementById("closeDrawerBtn")?.addEventListener("click", closeChapterDrawer);
document.getElementById("chapterDrawer")?.addEventListener("click", event => {
  if (event.target.id === "chapterDrawer") {
    closeChapterDrawer();
  }
});

// ================= LIBRARY NAV =================
document.getElementById("backLibraryBtn")?.addEventListener("click", () => {
  renderLibrary();
  showView("libraryView");
  saveNavigationState();
});

// ================= OVERVIEW =================
document.getElementById("overviewBtn")?.addEventListener("click", openOverview);
document.getElementById("storyOverviewBtn")?.addEventListener("click", openOverview);
document.getElementById("overviewBackBtn")?.addEventListener("click", () => {
  if (currentChapterId) {
    renderReader();
    showView("readerView");
  } else {
    renderStory();
    showView("storyView");
  }
  saveNavigationState();
});
function openOverview() {
  const story = getStory();
  if (!story) return;
  document.getElementById("overviewStoryTitle").textContent = story.title;
  renderOverview();
  showView("overviewView");
  saveNavigationState();
}
function renderOverview() {
  const story = getStory();
  if (!story) return;
  renderGlobalNotes();
  renderChapterNotes();
  const searchResultsEl = document.getElementById("searchResults");
  if (searchResultsEl) searchResultsEl.innerHTML = "";
}

// ================= RENDER GLOBAL NOTES =================
function renderGlobalNotes() {
  const story = getStory();
  const list = document.getElementById("globalNotesList");
  if (!list || !story) return;
  list.innerHTML = "";

  if (!story.globalNotes.length) {
    list.innerHTML = `<p class="muted">No global notes yet.</p>`;
    return;
  }

  story.globalNotes.forEach((note, index) => {
    const item = document.createElement("div");
    item.className = "note-list-item";
    item.dataset.noteIndex = index;
    item.dataset.noteId = note.id;
    item.dataset.noteType = "global";

    const hasImage = note.images && note.images.length > 0;
    const imageBadge = hasImage ? `<span class="note-image-badge">✦</span>` : '';

    item.innerHTML = `
      <span class="note-badge">GLOBAL · ${escapeHTML(note.category || "NOTE")}</span>
      <strong>${escapeHTML(note.title || note.selectedText)} ${imageBadge}</strong>
      <p>${escapeHTML(note.content)}</p>
      <button class="delete-note-btn" data-action="delete-note">✕</button>
    `;

    item.addEventListener("click", (e) => {
      if (e.target.closest(".delete-note-btn")) return;

      const targetTerm = (note.selectedText || note.title || '').trim();

      if (note.chapterId) {
        const chapter = story.chapters.find(c => c.id === note.chapterId);
        if (chapter) {
          openChapter(chapter.id, note.id, targetTerm);
          return;
        }
      }

      if (targetTerm) {
        for (const ch of story.chapters) {
          if (ch.content && (ch.content.includes(`data-note-id="${note.id}"`) || ch.content.toLowerCase().includes(targetTerm.toLowerCase()))) {
            openChapter(ch.id, note.id, targetTerm);
            return;
          }
        }
      }

      showNotePopup(note, item);
    });

    list.appendChild(item);
  });

  list.querySelectorAll('.delete-note-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteNoteFromOverview(this);
    });
  });
}

// ================= RENDER CHAPTER NOTES =================
function renderChapterNotes() {
  const story = getStory();
  const list = document.getElementById("chapterNotesList");

  if (!story || !list) return;

  let allNotes = [];

  story.chapters.forEach(chapter => {
    chapter.notes.forEach((note, idx) => {
      allNotes.push({
        ...note,
        chapterNumber: chapter.number,
        chapterId: chapter.id,
        noteIndex: idx,
        createdAt: note.createdAt || new Date(0).toISOString()
      });
    });
  });

  if (allNotes.length === 0) {
    list.innerHTML = `<p class="muted">No chapter notes yet.</p>`;
    return;
  }

  allNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let html = '';
  allNotes.forEach(note => {
    const hasImage = note.images && note.images.length > 0;
    const imageBadge = hasImage ? `<span class="note-image-badge">✦</span>` : '';

    html += `
      <div class="note-list-item" data-chapter-id="${note.chapterId}" data-note-id="${note.id}" data-note-type="chapter">
        <span class="note-badge">CHAPTER ${note.chapterNumber}</span>
        <strong>${escapeHTML(note.selectedText)} ${imageBadge}</strong>
        <p>${escapeHTML(note.content)}</p>
        <button class="delete-note-btn" data-action="delete-note">✕</button>
      </div>
    `;
  });

  list.innerHTML = html;

  list.querySelectorAll('.delete-note-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteNoteFromOverview(this);
    });
  });

  list.querySelectorAll('.note-list-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (e.target.closest('.delete-note-btn')) return;
      const chapterId = this.dataset.chapterId;
      const noteId = this.dataset.noteId;
      if (chapterId) {
        openChapter(chapterId, noteId);
      }
    });
  });
}

// ================= REMOVE ANNOTATION =================
function removeAnnotationFromContent(noteId, chapterId) {
  const story = getStory();
  if (!story) return;
  const chapter = story.chapters.find(c => c.id === chapterId);
  if (!chapter) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(chapter.content, 'text/html');
  const annotations = doc.querySelectorAll(`[data-note-id="${noteId}"]`);
  annotations.forEach(span => {
    const textContent = span.textContent;
    span.replaceWith(textContent);
  });
  chapter.content = doc.body.innerHTML;
  const editorEl = document.getElementById('chapterEditor');
  if (editorEl && editorEl.closest('.open')) {
    editorEl.innerHTML = chapter.content;
  }
}

// ================= DELETE NOTE =================
async function deleteNote(noteId, type = "chapter") {
  const story = getStory();
  if (!story) return;
  
  let noteTitle = "";
  let chapterId = null;
  let targetNote = null;
  
  if (type === "global") {
    targetNote = story.globalNotes.find(n => n.id === noteId);
    if (!targetNote) return;
    noteTitle = targetNote.title || targetNote.selectedText || "Global Note";
    chapterId = targetNote.chapterId;
  } else {
    for (const ch of story.chapters) {
      const found = ch.notes.find(n => n.id === noteId);
      if (found) {
        targetNote = found;
        chapterId = ch.id;
        noteTitle = found.selectedText || found.content || "Chapter Note";
        break;
      }
    }
    if (!targetNote) return;
  }

  const ok = await showConfirmDialog({
    title: "Delete Note",
    message: `Are you sure you want to delete this note ("${noteTitle}")?`,
    confirmText: "Delete Note",
    cancelText: "Cancel",
    danger: true
  });
  if (!ok) return;

  closeNotePopup();

  const noteCopy = { ...targetNote };
  if (type === "global") {
    story.globalNotes = story.globalNotes.filter(n => n.id !== noteId);
    story.chapters.forEach(ch => {
      removeAnnotationFromContent(noteId, ch.id);
    });
  } else {
    const ch = story.chapters.find(c => c.id === chapterId);
    if (ch) {
      ch.notes = ch.notes.filter(n => n.id !== noteId);
      removeAnnotationFromContent(noteId, chapterId);
    }
  }

  saveState(false);
  renderOverview();
  if (document.getElementById('readerView')?.classList.contains('active')) {
    renderReader();
  }
  toast(`Note deleted`);

  (async () => {
    try {
      if (noteCopy.source) {
        await deleteImageFromStorage(noteCopy.source);
      }
      if (noteCopy.images && Array.isArray(noteCopy.images)) {
        for (const img of noteCopy.images) {
          await deleteImageFromStorage(img);
        }
      }
      if (_supabase) {
        if (chapterId) {
          const ch = story.chapters.find(c => c.id === chapterId);
          if (ch) {
            await _supabase
              .from('chapters')
              .update({ content: ch.content, updated_at: new Date().toISOString() })
              .eq('id', chapterId);
          }
        }
        await _supabase.from('notes').delete().eq('id', noteId);
      }
    } catch (err) {
      console.warn("Supabase delete note error:", err);
    }
  })();
}

async function deleteNoteFromOverview(target) {
  const item = target.closest(".note-list-item");
  if (!item) return;
  const type = item.dataset.noteType;
  const story = getStory();
  if (!story) return;

  if (type === "global") {
    const noteId = item.dataset.noteId;
    if (noteId) {
      deleteNote(noteId, "global");
      return;
    }
    const index = parseInt(item.dataset.noteIndex, 10);
    if (isNaN(index)) return;
    const note = story.globalNotes[index];
    if (!note) return;
    deleteNote(note.id, "global");
  } else if (type === "chapter") {
    const noteId = item.dataset.noteId;
    if (!noteId) return;
    deleteNote(noteId, "chapter");
  }
}

// ================= DELETE IMAGE FROM STORAGE =================
async function deleteImageFromStorage(imageUrl) {
  if (!imageUrl || !imageUrl.includes('reader-images') || !_supabase) return;
  const filePath = imageUrl.split('/reader-images/')[1];
  if (!filePath) return;
  try {
    await _supabase.storage.from('reader-images').remove([filePath]);
  } catch (err) {
    console.warn('Cannot delete image from storage:', err);
  }
}

// ================= SEARCH =================
document.getElementById("noteSearch")?.addEventListener("input", event => {
  searchNotes(event.target.value);
});
function searchNotes(query) {
  const story = getStory();
  const container = document.getElementById("searchResults");
  if (!container || !story) return;
  container.innerHTML = "";
  query = query.trim();
  if (!query) return;

  const results = [];

  if (searchMode === 'chapter') {
    const chapterNumber = parseInt(query, 10);
    if (isNaN(chapterNumber) || chapterNumber <= 0) {
      container.innerHTML = `<p class="muted">Please enter a valid chapter number (e.g. 1, 2, 3...).</p>`;
      return;
    }
    const targetChapter = story.chapters.find(c => c.number === chapterNumber);
    if (!targetChapter) {
      container.innerHTML = `<p class="muted">Chapter ${chapterNumber} not found.</p>`;
      return;
    }

    if (targetChapter.notes.length === 0) {
      container.innerHTML = `<p class="muted">No notes in this chapter.</p>`;
      return;
    }

    targetChapter.notes.forEach(note => {
      results.push({
        source: `Chapter ${targetChapter.number} · Chapter Note`,
        title: note.selectedText,
        content: note.content,
        action: () => openChapter(targetChapter.id, note.id, note.selectedText)
      });
    });
  } else {
    story.globalNotes.forEach(note => {
      const searchable = [note.title, note.content, ...(note.keywords || [])].join(" ").toLowerCase();
      if (searchable.includes(query.toLowerCase())) {
        const targetTerm = (note.selectedText || note.title || '').trim();
        let targetChapter = null;
        if (note.chapterId) {
          targetChapter = story.chapters.find(c => c.id === note.chapterId);
        }
        if (!targetChapter && targetTerm) {
          targetChapter = story.chapters.find(c => c.content && (c.content.includes(`data-note-id="${note.id}"`) || c.content.toLowerCase().includes(targetTerm.toLowerCase())));
        }

        results.push({
          source: targetChapter ? `Chapter ${targetChapter.number} · Global Note` : "Global Note",
          title: note.title || note.selectedText,
          content: note.content,
          action: () => {
            if (targetChapter) {
              openChapter(targetChapter.id, note.id, targetTerm);
            } else {
              showNotePopup(note, document.getElementById("noteSearch"));
            }
          }
        });
      }
    });
    story.chapters.forEach(chapter => {
      chapter.notes.forEach(note => {
        const searchable = [note.selectedText, note.content].join(" ").toLowerCase();
        if (searchable.includes(query.toLowerCase())) {
          results.push({
            source: `Chapter ${chapter.number} · Chapter Note`,
            title: note.selectedText,
            content: note.content,
            action: () => openChapter(chapter.id, note.id, note.selectedText)
          });
        }
      });
    });
  }

  if (!results.length) {
    container.innerHTML = `<p class="muted">No results found.</p>`;
    return;
  }

  results.forEach(result => {
    const item = document.createElement("div");
    item.className = "search-result";
    item.innerHTML = `
      <div class="source">${escapeHTML(result.source)}</div>
      <strong>${escapeHTML(result.title)}</strong>
      <p>${escapeHTML(result.content)}</p>
    `;
    item.addEventListener("click", result.action);
    container.appendChild(item);
  });
}

// ================= CUSTOM PROMPT MODAL =================
function showPromptDialog({ title = "Add Global Note", fields = [] }) {
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
        <label style="display:block; font-size:12px; font-weight:700; color:var(--text); margin-bottom:4px;">${escapeHTML(f.label)}</label>
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

// ================= ADD GLOBAL NOTE =================
document.getElementById("addGlobalNoteBtn")?.addEventListener("click", async () => {
  const story = getStory();
  if (!story) return;

  const result = await showPromptDialog({
    title: "New Global Note",
    fields: [
      { name: "title", label: "Title / Term", placeholder: "e.g., Character name, place, concept..." },
      { name: "content", label: "Note Content", type: "textarea", placeholder: "Detailed description..." },
      { name: "category", label: "Category", placeholder: "Character / Place / Concept / Term / Other", value: "Character" }
    ]
  });

  if (!result || !result.title) return;

  const title = result.title;
  const content = result.content || "";
  const category = result.category || "Other";

  const note = {
    id: uid(),
    type: "global",
    category,
    title,
    selectedText: title,
    content,
    keywords: [title],
    images: [],
    caption: "",
    source: "",
    chapterId: null,
    createdAt: new Date().toISOString()
  };
  story.globalNotes.push(note);

  saveState(false);
  renderOverview();
  toast("Global note added");

  (async () => {
    try {
      if (_supabase) {
        await _supabase
          .from('notes')
          .insert({
            id: note.id,
            story_id: story.id,
            chapter_id: null,
            type: 'global',
            selected_text: title,
            note_text: content,
            caption: '',
            source: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    } catch (err) {
      console.warn("Supabase insert note error:", err);
    }
  })();
});

// ================= EXPORT =================
document.getElementById("exportBtn")?.addEventListener("click", exportData);
function exportData() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "annotated-reader-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exported");
}

// ================= IMPORT =================
document.getElementById("importBtn")?.addEventListener("click", () => {
  document.getElementById("importInput")?.click();
});
document.getElementById("importInput")?.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.stories)) {
        throw new Error("Invalid data");
      }
      const ok = await showConfirmDialog({
        title: "Restore Backup",
        message: "Are you sure you want to restore this backup? Current library data will be replaced.",
        confirmText: "Restore",
        cancelText: "Cancel",
        danger: false
      });
      if (!ok) return;
      state = imported;
      saveState(false);
      currentStoryId = null;
      currentChapterId = null;
      renderLibrary();
      showView("libraryView");
      toast("Library restored from backup");
    } catch (error) {
      toast("Invalid backup file.");
    }
  };
  reader.readAsText(file);
});

// ================= CLOSE POPUP =================
document.getElementById("closePopupBtn")?.addEventListener("click", closeNotePopup);

// ================= STORY EDIT =================
document.getElementById("storyEditBtn")?.addEventListener("click", () => {
  document.getElementById("storyTitleInput")?.focus();
});

// ================= ESC =================
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeNotePopup();
    closeChapterDrawer();
  }
});

function smoothScrollTo(element, duration = 350) {
  const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - window.innerHeight / 2 + element.offsetHeight / 2;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;

  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    window.scrollTo(0, startPosition + distance * ease);
    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    }
  }
  requestAnimationFrame(animation);
}

// ===== SEARCH MODE TOGGLE =====
document.getElementById('searchModeBtn')?.addEventListener('click', function() {
  if (searchMode === 'content') {
    searchMode = 'chapter';
    this.textContent = 'Content';
    this.classList.add('active');
    const input = document.getElementById('noteSearch');
    if (input) input.placeholder = 'Enter chapter number (e.g. 12)';
  } else {
    searchMode = 'content';
    this.textContent = 'Chapter';
    this.classList.remove('active');
    const input = document.getElementById('noteSearch');
    if (input) input.placeholder = 'Search notes, terms, characters...';
  }
  const query = document.getElementById('noteSearch')?.value;
  if (query && query.trim()) searchNotes(query);
});

// ===== THEME SWITCH EVENT LISTENERS =====
document.querySelectorAll(".theme-toggle").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTheme();
  });
});

// ================= BOOT =================
(async function boot() {
  try {
    applyTheme(currentTheme, false);
    await initApp();
  } catch (err) {
    console.error('Boot error:', err);
  }
})();
