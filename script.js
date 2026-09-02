/* =========================================================
   ANNOTATED READER (MemoReader)
   Frontend with Per-Story Dynamic Color Theme Generator
   ========================================================= */

import {
  applyStoryTheme,
  updateLoadingScreenTheme,
  getThemedAnimationData,
  saveStoryTheme
} from './theme.js';

import {
  _supabase,
  autoLogin,
  uid,
  createDemoStory,
  loadState,
  saveState,
  loadStateFromDB,
  saveStateToDB,
  compressImageFile,
  restoreNavigationState,
  saveNavigationState,
  clearNavigationState,
  getSynchronousStartupTheme,
  fetchStoriesFromSupabase,
  embedThemeInDescription,
  extractThemeAndCleanDescription,
  syncStoryThemeToSupabase,
  THEME_KEY,
  ACTIVE_COLOR_KEY
} from './state.js';

import {
  escapeHTML,
  toast,
  showConfirmDialog,
  showPromptDialog,
  openThemeCustomizerModal
} from './modal.js';

// ================= SYNC INITIAL STARTUP THEME =================
// Crucial: Set the story theme immediately on line 1 before progress or async calls
const startup = getSynchronousStartupTheme();
let currentTheme = startup.isDark ? "dark" : "light";
document.documentElement.setAttribute("data-theme", currentTheme);
applyStoryTheme(startup.themeColor || '#7654d8');

const player = document.getElementById('bookAnim');
if (player) {
  try {
    const initialAnim = getThemedAnimationData(startup.themeColor, startup.isDark);
    player.load(initialAnim);
  } catch (e) {
    console.warn('Lottie startup error:', e);
  }
}

autoLogin();

// ================= STATE =================
let state = { stories: [] };
let currentStoryId = null;
let currentChapterId = null;
let currentView = startup.isLibrary ? "libraryView" : "storyView";
let selectedRange = null;
let selectedText = "";
let pendingNoteType = "chapter";
let pendingImages = [];

const readingProgressBar = document.getElementById('readingProgressBar');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const loadingScreen = document.getElementById('loading-screen');
const mainContent = document.getElementById('main-content');

let progress = 0;
let progressInterval = null;

function applyTheme(theme, save = true) {
  currentTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  if (save) {
    try {
      localStorage.setItem(THEME_KEY, currentTheme);
    } catch (e) {}
  }
  updateThemeToggleUI();

  const story = getStory();
  const currentActiveColor = (story && story.themeColor) ? story.themeColor : (localStorage.getItem(ACTIVE_COLOR_KEY) || '#7654d8');
  updateLoadingScreenTheme(currentActiveColor, currentTheme === 'dark');
}

function updateThemeToggleUI() {
  const isDark = currentTheme === "dark";
  const labelText = isDark ? "Dark" : "Light";
  document.querySelectorAll(".theme-toggle").forEach(btn => {
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

function updateProgress(value) {
  const clamped = Math.min(value, 100);
  if (progressBar) progressBar.style.width = clamped + '%';
  if (progressText) progressText.innerText = Math.floor(clamped) + '%';
}

function startProgress() {
  progress = 0;
  if (progressInterval) clearInterval(progressInterval);
  updateProgress(0);
  progressInterval = setInterval(() => {
    if (progress < 99) {
      progress += 2;
      updateProgress(progress);
    } else {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }, 35);
}

function completeLoading() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  updateProgress(100);
  setTimeout(finishLoading, 200);
}

function finishLoading() {
  if (loadingScreen) loadingScreen.classList.add('fade-out');
  setTimeout(() => {
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (mainContent) mainContent.classList.remove('hidden');
  }, 500);
}

// ================= INITIALIZE =================
async function initApp() {
  startProgress();

  try {
    const dbState = await loadStateFromDB();
    if (dbState && dbState.stories && dbState.stories.length > 0) {
      state = dbState;
    } else {
      state = loadState();
    }

    const supabaseStories = await fetchStoriesFromSupabase();
    if (supabaseStories && supabaseStories.length > 0) {
      state.stories = supabaseStories;
      saveState(state);
    }
  } catch (err) {
    console.warn("Using local state:", err?.message || err);
    state = (await loadStateFromDB()) || loadState();
  }

  if (!state.stories || !state.stories.length) {
    state.stories = [createDemoStory()];
    saveState(state);
  }

  const savedNav = restoreNavigationState();
  if (savedNav && savedNav.storyId) {
    const story = state.stories.find(s => s.id === savedNav.storyId);
    if (story) {
      currentStoryId = story.id;
      const themeColor = story.themeColor || '#7654d8';
      applyStoryTheme(themeColor);
      try { localStorage.setItem(ACTIVE_COLOR_KEY, themeColor); } catch (e) {}
      updateLoadingScreenTheme(themeColor, currentTheme === 'dark');

      if (savedNav.view === 'readerView' && savedNav.chapterId) {
        currentChapterId = savedNav.chapterId;
        renderReader();
        showView('readerView');
        if (readingProgressBar) {
          readingProgressBar.classList.remove('reading-progress-hidden');
          setTimeout(updateReadingProgress, 100);
        }
        setTimeout(() => window.scrollTo(0, savedNav.scrollPos || 0), 100);
        completeLoading();
        return;
      } else if (savedNav.view === 'overviewView') {
        document.getElementById("overviewStoryTitle").textContent = story.title;
        renderOverview();
        showView('overviewView');
        completeLoading();
        return;
      } else {
        renderStory();
        showView('storyView');
        completeLoading();
        return;
      }
    }
  }

  const initialColor = localStorage.getItem(ACTIVE_COLOR_KEY) || '#7654d8';
  applyStoryTheme(initialColor);
  updateLoadingScreenTheme(initialColor, currentTheme === 'dark');
  renderLibrary();
  showView('libraryView');
  clearNavigationState();
  completeLoading();
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
  closePopup();
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const viewEl = document.getElementById(id);
  if (viewEl) viewEl.classList.add("active");
  currentView = id;

  const savedTheme = localStorage.getItem(THEME_KEY) || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  currentTheme = savedTheme;
  updateThemeToggleUI();

  if (id === 'libraryView') {
    const activeColor = localStorage.getItem(ACTIVE_COLOR_KEY) || '#7654d8';
    applyStoryTheme(activeColor);
    updateLoadingScreenTheme(activeColor, currentTheme === 'dark');
  } else {
    const story = getStory();
    if (story && story.themeColor) {
      applyStoryTheme(story.themeColor);
      try { localStorage.setItem(ACTIVE_COLOR_KEY, story.themeColor); } catch (e) {}
      updateLoadingScreenTheme(story.themeColor, currentTheme === 'dark');
    }
  }

  saveNavigationState({
    view: currentView,
    storyId: currentStoryId,
    chapterId: currentChapterId,
    scrollPos: window.scrollY || 0
  });

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

  let percent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
  percent = Math.min(100, Math.max(0, percent));
  readingProgressBar.style.width = percent + '%';
}

window.addEventListener('scroll', () => {
  if (currentView === 'readerView') {
    saveNavigationState({
      view: currentView,
      storyId: currentStoryId,
      chapterId: currentChapterId,
      scrollPos: window.scrollY || 0
    });
    updateReadingProgress();
  }
});

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
    const themeHex = story.themeColor || '#7654d8';
    const card = document.createElement("div");
    card.className = "story-card";
    card.innerHTML = `
      <div class="story-card-cover">
        ${story.cover ? `<img src="${story.cover}" alt="">` : `<div class="cover-empty" style="color:${themeHex};">✦</div>`}
      </div>
      <div class="story-card-info">
        <h3 style="margin:0 0 6px 0; word-break: break-word;">${escapeHTML(story.title || "Untitled Story")}</h3>
        <div class="story-card-meta">
          <span class="story-theme-dot" style="background-color: ${themeHex};" title="Theme color: ${themeHex}"></span>
          <p>${story.chapters.length} ${story.chapters.length === 1 ? "Chapter" : "Chapters"}</p>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openStory(story.id));
    grid.appendChild(card);
  });
}

function openStory(storyId) {
  currentStoryId = storyId;
  currentChapterId = null;
  const story = getStory();
  if (story) {
    const themeColor = story.themeColor || '#7654d8';
    saveStoryTheme(story.id, themeColor);
    applyStoryTheme(themeColor);
    try { localStorage.setItem(ACTIVE_COLOR_KEY, themeColor); } catch (e) {}
    updateLoadingScreenTheme(themeColor, currentTheme === 'dark');
  }
  renderStory();
  showView("storyView");
}

function renderStory() {
  const story = getStory();
  if (!story) return;
  applyStoryTheme(story.themeColor);
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
    list.innerHTML = `<p class="muted" style="padding: 10px 0;">No chapters yet. Click ＋ above to add a chapter.</p>`;
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

// ================= ADD / SAVE / DELETE STORY =================
document.getElementById("addStoryBtn")?.addEventListener("click", async () => {
  const story = {
    id: uid(),
    title: "Untitled Story",
    description: "",
    cover: "",
    themeColor: "#7654d8",
    chapters: [],
    globalNotes: []
  };
  state.stories.push(story);
  currentStoryId = story.id;
  saveState(state);
  renderLibrary();
  openStory(story.id);

  try {
    if (_supabase) {
      await autoLogin();
      const descWithTag = embedThemeInDescription(story.description, story.themeColor);
      const { error } = await _supabase.from('stories').insert({
        id: story.id,
        title: story.title,
        description: descWithTag,
        cover_url: story.cover || null,
        theme_color: story.themeColor,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      if (error) {
        await _supabase.from('stories').insert({
          id: story.id,
          title: story.title,
          description: descWithTag,
          cover_url: story.cover || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn("Supabase insert story err:", err);
  }
  toast("New story created");
});

document.getElementById("saveStoryBtn")?.addEventListener("click", async () => {
  const story = getStory();
  if (!story) return;
  story.title = document.getElementById("storyTitleInput").value.trim() || "Untitled Story";
  story.description = document.getElementById("storyDescriptionInput").value;

  try {
    if (_supabase) {
      await autoLogin();
      const descWithTag = embedThemeInDescription(story.description, story.themeColor);
      const { error } = await _supabase.from('stories').upsert({
        id: story.id,
        title: story.title,
        description: descWithTag,
        cover_url: story.cover || null,
        theme_color: story.themeColor || '#7654d8',
        updated_at: new Date().toISOString()
      });
      if (error) {
        await _supabase.from('stories').upsert({
          id: story.id,
          title: story.title,
          description: descWithTag,
          cover_url: story.cover || null,
          updated_at: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn("Supabase save err:", err);
  }
  saveState(state);
  toast("Story saved");
  renderStory();
  renderLibrary();
});

document.getElementById("deleteStoryBtn")?.addEventListener("click", async () => {
  const story = getStory();
  if (!story) return;
  const ok = await showConfirmDialog({
    title: "Delete Story",
    message: `Are you sure you want to delete "${story.title || 'Untitled Story'}"?\n\nAll ${story.chapters?.length || 0} chapters and annotations will be removed.`,
    confirmText: "Delete Story",
    cancelText: "Cancel",
    danger: true
  });
  if (!ok) return;

  const storyId = story.id;
  state.stories = state.stories.filter(s => s.id !== storyId);
  currentStoryId = null;
  currentChapterId = null;
  saveState(state);
  clearNavigationState();
  renderLibrary();
  showView('libraryView');
  toast("Story deleted");

  try {
    if (_supabase) {
      await _supabase.from('notes').delete().eq('story_id', storyId);
      await _supabase.from('chapters').delete().eq('story_id', storyId);
      await _supabase.from('stories').delete().eq('id', storyId);
    }
  } catch (err) {
    console.warn("Supabase delete err:", err);
  }
});

// Cover handler
document.getElementById("coverPlaceholder")?.addEventListener("click", () => document.getElementById("coverInput")?.click());
document.getElementById("storyCover")?.addEventListener("click", () => document.getElementById("coverInput")?.click());
document.getElementById("coverInput")?.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const story = getStory();
  if (!story) return;

  try {
    const compressed = await compressImageFile(file, 1000, 1000, 0.82);
    story.cover = compressed || '';
    saveState(state);
    renderStory();
    renderLibrary();
    toast('Cover updated');

    if (_supabase) {
      try {
        const filePath = `covers/${Date.now()}_${file.name}`;
        await _supabase.storage.from('reader-images').upload(filePath, file);
        const { data } = _supabase.storage.from('reader-images').getPublicUrl(filePath);
        if (data?.publicUrl) {
          story.cover = data.publicUrl;
          await _supabase.from('stories').update({ cover_url: data.publicUrl, updated_at: new Date().toISOString() }).eq('id', story.id);
          saveState(state);
        }
      } catch (err) {
        console.warn('Storage upload error:', err);
      }
    }
  } catch (err) {
    console.error("Cover compression failed:", err);
  }
});

// ================= CHAPTERS =================
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
  saveState(state);
  renderChapterList();
  openChapter(chapter.id);
  toast(`Chapter ${nextNumber} created`);

  try {
    if (_supabase) {
      await _supabase.from('chapters').insert({
        id: chapter.id,
        story_id: story.id,
        title: chapter.title,
        content: chapter.content,
        chapter_order: chapter.number,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn("Supabase insert chapter err:", err);
  }
});

async function deleteChapter(chapterId) {
  const story = getStory();
  if (!story) return;
  const chapter = story.chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  const ok = await showConfirmDialog({
    title: "Delete Chapter",
    message: `Are you sure you want to delete Chapter ${chapter.number} ("${chapter.title || 'Untitled'}")?`,
    confirmText: "Delete Chapter",
    cancelText: "Cancel",
    danger: true
  });
  if (!ok) return;

  story.chapters = story.chapters.filter(c => c.id !== chapterId);
  story.chapters.sort((a,b) => a.number - b.number).forEach((ch, idx) => { ch.number = idx + 1; });
  if (currentChapterId === chapterId) {
    currentChapterId = null;
    renderStory();
    showView('storyView');
  }
  saveState(state);
  renderChapterList();
  toast(`Chapter deleted`);

  try {
    if (_supabase) {
      await _supabase.from('notes').delete().eq('chapter_id', chapterId);
      await _supabase.from('chapters').delete().eq('id', chapterId);
    }
  } catch (err) {
    console.warn("Supabase delete chapter err:", err);
  }
}

// ================= OPEN CHAPTER / READER =================
function findChapterForNote(story, note) {
  if (!story || !story.chapters || story.chapters.length === 0) return null;
  if (note.chapterId) {
    const ch = story.chapters.find(c => c.id === note.chapterId);
    if (ch) return ch;
  }
  for (const ch of story.chapters) {
    if (ch.content && ch.content.includes(note.id)) {
      return ch;
    }
  }
  const term = (note.selectedText || note.title || '').trim().toLowerCase();
  if (term) {
    for (const ch of story.chapters) {
      if (ch.content && ch.content.toLowerCase().includes(term)) {
        return ch;
      }
    }
  }
  return story.chapters[0] || null;
}

function openChapter(chapterId, noteId, keyword) {
  closePopup();
  currentChapterId = chapterId;
  const story = getStory();
  if (story) applyStoryTheme(story.themeColor);
  renderReader();
  showView("readerView");
  closeEditor();

  if (noteId || keyword) {
    setTimeout(() => {
      const target = noteId ? document.querySelector(`#readerContent [data-note-id="${noteId}"]`) : null;
      if (target) {
        smoothScrollTo(target, 400);
        target.classList.add('highlight-chapter');
        setTimeout(() => target.classList.remove('highlight-chapter'), 2000);
      } else {
        const chapter = getChapter();
        const note = (chapter?.notes?.find(n => n.id === noteId)) || (story?.globalNotes?.find(n => n.id === noteId));
        const searchTerm = (note?.selectedText || note?.title || keyword || '').trim().toLowerCase();
        if (searchTerm) {
          const readerContent = document.getElementById("readerContent");
          if (readerContent) {
            const walker = document.createTreeWalker(readerContent, NodeFilter.SHOW_TEXT, null);
            let node;
            while ((node = walker.nextNode())) {
              if (node.textContent && node.textContent.toLowerCase().includes(searchTerm)) {
                if (node.parentElement) {
                  smoothScrollTo(node.parentElement, 400);
                  node.parentElement.classList.add('highlight-chapter');
                  setTimeout(() => node.parentElement.classList.remove('highlight-chapter'), 2000);
                  return;
                }
              }
            }
          }
        }
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
  applyStoryTheme(story.themeColor);
  document.getElementById("readerStoryName").textContent = story.title;
  document.getElementById("readerChapterName").textContent = `Chapter ${chapter.number}: ${chapter.title || "Untitled"}`;
  const reader = document.getElementById("readerContent");
  reader.innerHTML = chapter.content;

  // Clean up any stale annotations whose notes were deleted
  const allNoteIds = new Set([
    ...((story.globalNotes || []).map(n => n.id)),
    ...((chapter.notes || []).map(n => n.id))
  ]);

  let contentChanged = false;
  reader.querySelectorAll('.editor-annotation, .annotation').forEach(el => {
    const noteId = el.dataset.noteId;
    if (!noteId || !allNoteIds.has(noteId)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        contentChanged = true;
      }
    } else {
      el.addEventListener("click", event => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) return;
        event.stopPropagation();
        const note = (chapter.notes || []).find(n => n.id === noteId) || (story.globalNotes || []).find(n => n.id === noteId);
        if (note) showNotePopup(note, el);
      });
    }
  });

  if (contentChanged) {
    chapter.content = reader.innerHTML;
    saveState(state);
  }
}

// ================= POPUP & NOTES =================
function positionPopup(popup, anchor) {
  if (!popup) return;
  if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const popupWidth = popup.offsetWidth || 340;
  const popupHeight = popup.offsetHeight || 260;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 14;

  let left = Math.min(Math.max(margin, rect.left), viewportWidth - popupWidth - margin);
  let top = rect.bottom + 8;
  if (top + popupHeight > viewportHeight - margin && rect.top - margin > popupHeight) {
    top = Math.max(margin, rect.top - popupHeight - 8);
  }
  popup.style.transform = 'none';
  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;
}

function openPopup(html, anchor) {
  const popup = document.getElementById('notePopup');
  if (!popup) return;
  popup.innerHTML = html;
  popup.style.display = 'block';
  popup.style.visibility = 'visible';
  positionPopup(popup, anchor);
  popup.classList.add('open');

  const handler = (e) => {
    if (!popup.classList.contains('open') || popup.contains(e.target)) return;
    if (popup.querySelector('#newNoteContent') || popup.querySelector('#editNoteContent')) return;
    closePopup();
    document.removeEventListener('click', handler, true);
  };
  setTimeout(() => document.addEventListener('click', handler, true), 120);
}

function closePopup() {
  const popup = document.getElementById('notePopup');
  if (popup) {
    popup.classList.remove('open');
    popup.style.display = 'none';
    popup.style.visibility = 'hidden';
  }
}

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
        <button id="editNoteBtnTrigger" type="button" class="icon-action-btn" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
        <button id="deleteNoteBtnTrigger" type="button" class="icon-action-btn delete" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
        <button id="closeNotePopupBtn" type="button" class="icon-action-btn" title="Close">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
    <div class="popup-selected"><span>"${escapeHTML(displayText || "")}"</span></div>
    <div class="popup-content">
      <div>${escapeHTML(note.content || "").replace(/\n/g, "<br>")}</div>
      ${note.images?.length ? `<div style="display:flex; flex-wrap:wrap; gap:8px; margin:10px 0;">${note.images.map(img => `<img src="${img}" style="max-width:100%; max-height:200px; border-radius:8px; object-fit:cover;">`).join("")}</div>` : ""}
      ${note.caption ? `<div style="font-size:12px; color:var(--muted); margin-top:6px;">${escapeHTML(note.caption)}</div>` : ""}
      ${note.source ? `<div style="font-size:12px; color:var(--muted); margin-top:4px;">📎 ${escapeHTML(note.source)}</div>` : ""}
    </div>
  `;
  openPopup(html, anchor);

  document.getElementById("closeNotePopupBtn")?.addEventListener("click", closePopup);
  document.getElementById("editNoteBtnTrigger")?.addEventListener("click", () => editNote(note.id, isGlobal ? 'global' : 'chapter', anchor));
  document.getElementById("deleteNoteBtnTrigger")?.addEventListener("click", () => deleteNote(note.id, isGlobal ? 'global' : 'chapter'));
}

function renderImageSlotsHelper(containerId, imagesArray, onImagesChanged) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  imagesArray.forEach((imgSrc, idx) => {
    const slot = document.createElement("div");
    slot.className = "image-slot";
    slot.innerHTML = `
      <img src="${imgSrc}" alt="Illustration ${idx + 1}" />
      <button class="image-remove" type="button" title="Remove image">×</button>
    `;
    slot.querySelector(".image-remove")?.addEventListener("click", (e) => {
      e.stopPropagation();
      imagesArray.splice(idx, 1);
      renderImageSlotsHelper(containerId, imagesArray, onImagesChanged);
      if (onImagesChanged) onImagesChanged(imagesArray);
      toast("Image removed");
    });
    container.appendChild(slot);
  });

  if (imagesArray.length < 4) {
    const addBtn = document.createElement("button");
    addBtn.className = "add-image-btn";
    addBtn.type = "button";
    addBtn.title = "Add Image";
    addBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
    addBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          try {
            const compressed = await compressImageFile(file, 1200, 1200, 0.82);
            if (compressed) {
              imagesArray.push(compressed);
              renderImageSlotsHelper(containerId, imagesArray, onImagesChanged);
              if (onImagesChanged) onImagesChanged(imagesArray);
              toast("Image attached");
            }
          } catch (err) {
            console.error("Image loading error:", err);
            toast("Failed to attach image");
          }
        }
      };
      input.click();
    });
    container.appendChild(addBtn);
  }
}

function editNote(noteId, type, anchor) {
  const story = getStory();
  if (!story) return;
  const note = type === 'global' ? story.globalNotes.find(n => n.id === noteId) : story.chapters.flatMap(c => c.notes).find(n => n.id === noteId);
  if (!note) return;

  const isGlobal = note.type === "global";
  const editingImages = Array.isArray(note.images) ? [...note.images] : [];
  const html = `
    <div class="popup-header">
      <strong class="popup-tag ${isGlobal ? 'global' : 'chapter'}">
        <span>${isGlobal ? '🪐' : '🌙'}</span> Edit ${isGlobal ? 'Global Note' : 'Chapter Note'}
      </strong>
      <button id="closeEditNoteBtn" type="button" class="icon-action-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>
    <label class="popup-section-label">Note</label>
    <textarea id="editNoteContent" class="note-textarea">${escapeHTML(note.content || '')}</textarea>
    <div class="illustration-label-wrapper"><label class="illustration-label">Illustration</label></div>
    <div class="illustration-container-row">
      <div id="editImageSlots" class="image-slots-container"></div>
      <div class="source-fields-column">
        <input id="editCaption" class="source-field-input" placeholder="Caption (optional)" value="${escapeHTML(note.caption || '')}">
        <input id="editSource" class="source-field-input" placeholder="Source (optional)" value="${escapeHTML(note.source || '')}">
      </div>
    </div>
    <button class="btn primary full save-note-btn" id="saveEditNoteBtn" type="button">Save Changes</button>
  `;
  openPopup(html, anchor);
  renderImageSlotsHelper("editImageSlots", editingImages, (imgs) => {
    // Synchronize images on change
  });

  document.getElementById("closeEditNoteBtn")?.addEventListener("click", closePopup);
  document.getElementById('saveEditNoteBtn')?.addEventListener('click', async () => {
    const newContent = document.getElementById('editNoteContent').value.trim();
    if (!newContent) return toast("Content cannot be empty");
    note.content = newContent;
    note.images = editingImages;
    note.caption = document.getElementById('editCaption').value.trim();
    note.source = document.getElementById('editSource').value.trim();
    saveState(state);
    closePopup();
    renderOverview();
    if (currentView === 'readerView') renderReader();
    toast("Note updated");

    try {
      if (_supabase) {
        await _supabase.from('notes').update({
          note_text: newContent,
          caption: note.caption,
          source: note.source,
          updated_at: new Date().toISOString()
        }).eq('id', note.id);
      }
    } catch (err) {
      console.warn("Supabase update note err:", err);
    }
  });
}

async function deleteNote(noteId, type) {
  const story = getStory();
  if (!story) return;
  const ok = await showConfirmDialog({
    title: "Delete Note",
    message: "Are you sure you want to delete this note?",
    confirmText: "Delete Note",
    cancelText: "Cancel",
    danger: true
  });
  if (!ok) return;

  closePopup();

  // 1. Remove note from globalNotes and all chapters' notes unconditionally
  story.globalNotes = (story.globalNotes || []).filter(n => n.id !== noteId);
  (story.chapters || []).forEach(ch => {
    ch.notes = (ch.notes || []).filter(n => n.id !== noteId);
  });

  // 2. Cleanly unwrap annotation markup from stored chapter contents
  (story.chapters || []).forEach(ch => {
    if (ch.content && ch.content.includes(noteId)) {
      const temp = document.createElement('div');
      temp.innerHTML = ch.content;
      temp.querySelectorAll(`[data-note-id="${noteId}"]`).forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
      });
      ch.content = temp.innerHTML;
    }
  });

  // 3. Update chapterEditor DOM if present
  const editor = document.getElementById("chapterEditor");
  if (editor) {
    editor.querySelectorAll(`[data-note-id="${noteId}"]`).forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    });
  }

  // 4. Update readerContent DOM if present
  const reader = document.getElementById("readerContent");
  if (reader) {
    reader.querySelectorAll(`[data-note-id="${noteId}"]`).forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    });
  }

  saveState(state);
  renderOverview();
  if (currentView === 'readerView') renderReader();
  toast("Note deleted");

  try {
    if (_supabase) {
      await _supabase.from('notes').delete().eq('id', noteId);
      for (const ch of story.chapters) {
        await _supabase.from('chapters').update({
          content: ch.content,
          updated_at: new Date().toISOString()
        }).eq('id', ch.id);
      }
    }
  } catch (err) {
    console.warn("Supabase delete note err:", err);
  }
}

// ================= EDITOR PANEL =================
document.getElementById("toggleEditBtn")?.addEventListener("click", openEditor);
document.getElementById("closeEditorBtn")?.addEventListener("click", closeEditor);

function openEditor() {
  const chapter = getChapter();
  const story = getStory();
  if (!chapter || !story) return;
  document.getElementById("chapterTitleInput").value = chapter.title || "";
  const editor = document.getElementById("chapterEditor");
  if (editor) {
    editor.innerHTML = chapter.content;
    const allNoteIds = new Set([
      ...((story.globalNotes || []).map(n => n.id)),
      ...((chapter.notes || []).map(n => n.id))
    ]);
    let editorChanged = false;
    editor.querySelectorAll('.editor-annotation, .annotation').forEach(el => {
      const noteId = el.dataset.noteId;
      if (!noteId || !allNoteIds.has(noteId)) {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          editorChanged = true;
        }
      }
    });
    if (editorChanged) {
      chapter.content = editor.innerHTML;
      saveState(state);
    }
  }
  document.getElementById("editorPanel")?.classList.add("open");
}
function closeEditor() {
  document.getElementById("editorPanel")?.classList.remove("open");
  closePopup();
}

document.getElementById("saveChapterBtn")?.addEventListener("click", async () => {
  const chapter = getChapter();
  if (!chapter) return;
  chapter.title = document.getElementById("chapterTitleInput").value.trim();
  chapter.content = document.getElementById("chapterEditor").innerHTML;
  saveState(state);
  toast("Chapter saved");
  renderReader();
  renderChapterList();

  try {
    if (_supabase) {
      await _supabase.from('chapters').upsert({
        id: chapter.id,
        story_id: currentStoryId,
        title: chapter.title,
        content: chapter.content,
        chapter_order: chapter.number,
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn("Supabase save chapter err:", err);
  }
});

// Text selection and annotation click in reader & editor
const chapterEditorEl = document.getElementById("chapterEditor");
chapterEditorEl?.addEventListener("mouseup", handleTextSelection);
chapterEditorEl?.addEventListener("touchend", () => {
  setTimeout(handleTextSelection, 120);
});
chapterEditorEl?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const annotationEl = e.target.closest('.editor-annotation, .annotation');
  if (annotationEl) {
    const noteId = annotationEl.dataset.noteId;
    const story = getStory();
    const chapter = getChapter();
    if (story && chapter && noteId) {
      const note = chapter.notes.find(n => n.id === noteId) || story.globalNotes.find(n => n.id === noteId);
      if (note) return showNotePopup(note, annotationEl);
    }
  }
  handleTextSelection();
});

const readerContentEl = document.getElementById("readerContent");
readerContentEl?.addEventListener("mouseup", handleTextSelection);
readerContentEl?.addEventListener("touchend", () => {
  setTimeout(handleTextSelection, 120);
});
readerContentEl?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const annotationEl = e.target.closest('.editor-annotation, .annotation');
  if (annotationEl) {
    const noteId = annotationEl.dataset.noteId;
    const story = getStory();
    const chapter = getChapter();
    if (story && chapter && noteId) {
      const note = chapter.notes.find(n => n.id === noteId) || story.globalNotes.find(n => n.id === noteId);
      if (note) return showNotePopup(note, annotationEl);
    }
  }
  handleTextSelection();
});

document.getElementById("chapterEditor")?.addEventListener("click", handleEditorAnnotationClick);

function handleEditorAnnotationClick(event) {
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) return;

  const annotationEl = event.target.closest('.editor-annotation, .annotation');
  if (!annotationEl) return;

  event.stopPropagation();
  const noteId = annotationEl.dataset.noteId;
  const story = getStory();
  const chapter = getChapter();
  if (!story || !chapter || !noteId) return;

  const note = chapter.notes.find(n => n.id === noteId) || story.globalNotes.find(n => n.id === noteId);
  if (note) {
    showNotePopup(note, annotationEl);
  }
}

function handleTextSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const text = selection.toString().trim();
  if (!text || text.length === 0) return;

  const range = selection.getRangeAt(0);
  const editor = document.getElementById("chapterEditor");
  const reader = document.getElementById("readerContent");

  const isEditor = editor && editor.contains(range.commonAncestorContainer);
  const isReader = reader && reader.contains(range.commonAncestorContainer);
  if (!isEditor && !isReader) return;

  selectedRange = range.cloneRange();
  selectedText = text;

  const rect = range.getBoundingClientRect();
  const anchor = { getBoundingClientRect: () => rect };
  showCreateNotePopup(anchor);
}

function showCreateNotePopup(anchor) {
  pendingImages = [];
  pendingNoteType = "chapter"; // Always reset to chapter note by default

  const html = `
    <div class="popup-header">
      <strong id="createPopupTag" class="popup-tag chapter"><span>🌙</span> Add Note</strong>
      <button id="closeCreateBtn" type="button" class="icon-action-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>
    <div class="popup-selected"><span>"${escapeHTML(selectedText)}"</span></div>
    <div class="note-type-row">
      <button class="type-btn active" data-type="chapter" id="typeBtnChapter" type="button"><span class="type-icon">🌙</span><span class="type-label">Chapter Note</span></button>
      <button class="type-btn" data-type="global" id="typeBtnGlobal" type="button"><span class="type-icon">🪐</span><span class="type-label">Global Note</span></button>
    </div>
    <button class="btn primary full" id="confirmSelectionBtn" type="button">Confirm</button>
  `;
  openPopup(html, anchor);

  const popup = document.getElementById('notePopup');
  const tag = popup?.querySelector("#createPopupTag");

  popup?.querySelectorAll(".type-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const chosenType = btn.getAttribute("data-type") || "chapter";
      pendingNoteType = chosenType;
      popup.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (tag) {
        if (chosenType === 'global') {
          tag.className = 'popup-tag global';
          tag.innerHTML = '<span>🪐</span> Global Note';
        } else {
          tag.className = 'popup-tag chapter';
          tag.innerHTML = '<span>🌙</span> Chapter Note';
        }
      }
    });
  });

  document.getElementById("closeCreateBtn")?.addEventListener("click", closePopup);
  document.getElementById("confirmSelectionBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openNoteEditor(anchor);
  });
}

function openNoteEditor(anchor) {
  const isGlobal = pendingNoteType === "global";
  const html = `
    <div class="popup-header">
      <strong class="popup-tag ${isGlobal ? 'global' : 'chapter'}">
        <span>${isGlobal ? '🪐' : '🌙'}</span> ${isGlobal ? 'Global Note' : 'Chapter Note'}
      </strong>
      <button id="closeNoteEditorBtn" type="button" class="icon-action-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>
    <label class="popup-section-label">Note</label>
    <textarea id="newNoteContent" class="note-textarea" placeholder="Write your note..."></textarea>
    <div class="illustration-label-wrapper"><label class="illustration-label">Illustration</label></div>
    <div class="illustration-container-row">
      <div id="newImageSlots" class="image-slots-container"></div>
      <div class="source-fields-column">
        <input id="newCaption" class="source-field-input" placeholder="Caption (optional)">
        <input id="newSource" class="source-field-input" placeholder="Source (optional)">
      </div>
    </div>
    <button class="btn primary full save-note-btn" id="saveNewNoteBtn" type="button">Save Note</button>
  `;
  openPopup(html, anchor);

  renderImageSlotsHelper("newImageSlots", pendingImages, (imgs) => {
    pendingImages = imgs;
  });

  document.getElementById("closeNoteEditorBtn")?.addEventListener("click", closePopup);
  setTimeout(() => document.getElementById("newNoteContent")?.focus(), 80);

  document.getElementById("saveNewNoteBtn")?.addEventListener("click", async () => {
    const content = document.getElementById("newNoteContent").value.trim();
    if (!content) return toast("Please write a note first");

    const chapter = getChapter();
    const story = getStory();
    if (!chapter || !story) return;

    const noteId = uid();
    const newNote = {
      id: noteId,
      type: pendingNoteType,
      selectedText,
      content,
      images: [...pendingImages],
      caption: document.getElementById("newCaption")?.value.trim() || "",
      source: document.getElementById("newSource")?.value.trim() || "",
      chapterId: chapter.id,
      createdAt: new Date().toISOString()
    };

    if (pendingNoteType === 'chapter') {
      if (!chapter.notes) chapter.notes = [];
      chapter.notes.push(newNote);
    } else {
      if (!story.globalNotes) story.globalNotes = [];
      story.globalNotes.push({ ...newNote, title: selectedText, category: 'Term', keywords: [selectedText] });
    }

    if (selectedRange) {
      try {
        const span = document.createElement("span");
        span.className = `editor-annotation ${pendingNoteType === 'global' ? 'global-note' : 'chapter-note'}`;
        span.dataset.noteId = noteId;
        span.dataset.noteType = pendingNoteType;
        
        const fragment = selectedRange.extractContents();
        span.appendChild(fragment);
        selectedRange.insertNode(span);

        const editor = document.getElementById("chapterEditor");
        const reader = document.getElementById("readerContent");
        if (editor && editor.contains(span)) {
          editor.normalize();
          chapter.content = editor.innerHTML;
        } else if (reader && reader.contains(span)) {
          reader.normalize();
          chapter.content = reader.innerHTML;
        }
      } catch (e) {
        console.warn("Error inserting annotation:", e);
      }
    }

    try {
      window.getSelection()?.removeAllRanges();
    } catch (e) {}

    saveState(state);
    closePopup();
    toast(pendingNoteType === 'global' ? "Global note saved" : "Chapter note saved");
    renderReader();
    if (currentView === 'overviewView') renderOverview();

    try {
      if (_supabase) {
        await _supabase.from('notes').insert({
          id: noteId,
          story_id: story.id,
          chapter_id: chapter.id,
          type: pendingNoteType,
          selected_text: selectedText,
          note_text: content,
          caption: newNote.caption,
          source: newNote.source,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        await _supabase.from('chapters').update({ content: chapter.content }).eq('id', chapter.id);
      }
    } catch (err) {
      console.warn("Supabase note insert err:", err);
    }
  });
}

// ================= OVERVIEW & SEARCH =================
function renderOverview() {
  const story = getStory();
  if (!story) return;
  updateSearchModeUI();
  const globalList = document.getElementById("globalNotesList");
  if (globalList) {
    globalList.innerHTML = story.globalNotes.length ? "" : `<p class="muted">No global notes yet.</p>`;
    story.globalNotes.forEach(note => {
      const item = document.createElement("div");
      item.className = "note-list-item";
      const hasImage = Boolean(note.images && note.images.length > 0);
      const starHtml = hasImage ? `<span class="note-star-icon" title="Includes illustration">★</span>` : '';
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <span class="note-badge">GLOBAL · ${escapeHTML(note.category || "NOTE")}</span>
          <button class="delete-note-btn" title="Delete note" type="button">×</button>
        </div>
        <strong>${escapeHTML(note.title || note.selectedText || "Untitled Note")} ${starHtml}</strong>
        <p>${escapeHTML(note.content || "")}</p>
      `;

      item.querySelector(".delete-note-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteNote(note.id, 'global');
      });

      item.addEventListener("click", () => {
        const targetChapter = findChapterForNote(story, note);
        if (targetChapter) {
          openChapter(targetChapter.id, note.id);
        } else {
          showNotePopup(note, item);
        }
      });
      globalList.appendChild(item);
    });
  }

  const chapList = document.getElementById("chapterNotesList");
  if (chapList) {
    const allChapNotes = story.chapters.flatMap(c => c.notes.map(n => ({ ...n, chapterNumber: c.number, chapterId: c.id })));
    chapList.innerHTML = allChapNotes.length ? "" : `<p class="muted">No chapter notes yet.</p>`;
    allChapNotes.forEach(note => {
      const item = document.createElement("div");
      item.className = "note-list-item";
      const hasImage = Boolean(note.images && note.images.length > 0);
      const starHtml = hasImage ? `<span class="note-star-icon" title="Includes illustration">★</span>` : '';
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <span class="note-badge">CHAPTER ${note.chapterNumber}</span>
          <button class="delete-note-btn" title="Delete note" type="button">×</button>
        </div>
        <strong>${escapeHTML(note.selectedText || "Untitled Note")} ${starHtml}</strong>
        <p>${escapeHTML(note.content || "")}</p>
      `;

      item.querySelector(".delete-note-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteNote(note.id, 'chapter');
      });

      item.addEventListener("click", () => {
        openChapter(note.chapterId, note.id);
      });
      chapList.appendChild(item);
    });
  }
}

let searchMode = 'content'; // 'content' | 'chapter'

function updateSearchModeUI() {
  const btn = document.getElementById("searchModeBtn");
  const label = document.getElementById("searchModeLabel");
  const input = document.getElementById("noteSearch");
  if (!btn) return;

  if (searchMode === 'chapter') {
    if (label) label.textContent = "Chapter";
    btn.classList.add("active");
    btn.setAttribute("title", "Searching by Chapter. Click to switch to Content mode.");
    if (input) input.placeholder = "Enter chapter number (e.g. 1, 2)...";
  } else {
    if (label) label.textContent = "Content";
    btn.classList.remove("active");
    btn.setAttribute("title", "Searching by Content. Click to switch to Chapter mode.");
    if (input) input.placeholder = "Search notes, terms, characters...";
  }
}

function runOverviewSearch() {
  const input = document.getElementById("noteSearch");
  const res = document.getElementById("searchResults");
  if (!res || !input) return;
  const q = input.value.trim().toLowerCase();
  res.innerHTML = "";
  if (!q) return;

  const story = getStory();
  if (!story) return;

  const matches = [];

  if (searchMode === 'chapter') {
    // Strictly search notes by Chapter Number (e.g. "1", "ch 1", "chapter 2")
    const numMatch = q.match(/^(?:chapter|ch\.?|c)?\s*(\d+)$/i) || q.match(/(?:chapter|ch\.?|c)?\s*(\d+)/i);
    const targetChapterNum = numMatch ? parseInt(numMatch[1], 10) : null;

    if (targetChapterNum !== null) {
      const targetChapter = (story.chapters || []).find(c => c.number === targetChapterNum);
      if (targetChapter) {
        const chapterNotes = targetChapter.notes || [];
        const globalNotesForChap = (story.globalNotes || []).filter(gn => gn.chapterId === targetChapter.id);
        const combinedNotes = [...chapterNotes, ...globalNotesForChap];

        combinedNotes.forEach(n => {
          const hasImage = Boolean(n.images && n.images.length > 0);
          const starHtml = hasImage ? `<span class="note-star-icon" title="Includes illustration">★</span>` : '';
          const title = n.title || n.selectedText || "Untitled Note";
          matches.push({
            source: `CHAPTER ${targetChapter.number} NOTE`,
            titleHtml: `${escapeHTML(title)} ${starHtml}`,
            content: n.content || "",
            act: () => openChapter(targetChapter.id, n.id)
          });
        });
      }
    }
  } else {
    story.globalNotes.forEach(n => {
      const matchText = (n.title + ' ' + n.content + ' ' + (n.selectedText || '') + ' ' + (n.category || '')).toLowerCase();
      if (matchText.includes(q)) {
        const hasImage = Boolean(n.images && n.images.length > 0);
        const starHtml = hasImage ? `<span class="note-star-icon" title="Includes illustration">★</span>` : '';
        const targetCh = findChapterForNote(story, n);
        matches.push({
          source: "GLOBAL NOTE",
          titleHtml: `${escapeHTML(n.title || n.selectedText || "Untitled Note")} ${starHtml}`,
          content: n.content,
          act: () => {
            if (targetCh) openChapter(targetCh.id, n.id);
            else showNotePopup(n, res);
          }
        });
      }
    });

    story.chapters.forEach(c => {
      c.notes.forEach(n => {
        const matchText = ((n.selectedText || '') + ' ' + (n.content || '') + ' ' + (n.caption || '') + ' ' + (n.source || '')).toLowerCase();
        if (matchText.includes(q)) {
          const hasImage = Boolean(n.images && n.images.length > 0);
          const starHtml = hasImage ? `<span class="note-star-icon" title="Includes illustration">★</span>` : '';
          matches.push({
            source: `CHAPTER ${c.number}`,
            titleHtml: `${escapeHTML(n.selectedText || "Untitled Note")} ${starHtml}`,
            content: n.content,
            act: () => openChapter(c.id, n.id)
          });
        }
      });
    });
  }

  if (!matches.length) {
    res.innerHTML = `<p class="muted">No results found for "${escapeHTML(q)}".</p>`;
    return;
  }

  matches.forEach(m => {
    const div = document.createElement("div");
    div.className = "search-result";
    div.innerHTML = `<div class="source">${escapeHTML(m.source)}</div><strong style="display:flex; align-items:center; gap:6px;">${m.titleHtml}</strong><p>${escapeHTML(m.content || "")}</p>`;
    div.onclick = m.act;
    res.appendChild(div);
  });
}

document.getElementById("noteSearch")?.addEventListener("input", runOverviewSearch);

document.getElementById("searchModeBtn")?.addEventListener("click", () => {
  searchMode = searchMode === 'content' ? 'chapter' : 'content';
  updateSearchModeUI();
  runOverviewSearch();
});

document.getElementById("addGlobalNoteBtn")?.addEventListener("click", async () => {
  const story = getStory();
  if (!story) return;
  const result = await showPromptDialog({
    title: "New Global Note",
    fields: [
      { name: "title", label: "Title / Term", placeholder: "e.g. Character name, place, concept..." },
      { name: "content", label: "Note Content", type: "textarea", placeholder: "Detailed description..." },
      { name: "category", label: "Category", placeholder: "Character / Place / Concept / Term", value: "Character" }
    ]
  });
  if (!result || !result.title) return;

  const note = {
    id: uid(),
    type: "global",
    category: result.category || "Other",
    title: result.title,
    selectedText: result.title,
    content: result.content || "",
    keywords: [result.title],
    images: [],
    caption: "",
    source: "",
    chapterId: null,
    createdAt: new Date().toISOString()
  };
  story.globalNotes.push(note);
  saveState(state);
  renderOverview();
  toast("Global note added");

  try {
    if (_supabase) {
      await _supabase.from('notes').insert({
        id: note.id,
        story_id: story.id,
        type: 'global',
        selected_text: note.title,
        note_text: note.content,
        created_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn("Supabase global note err:", err);
  }
});

// ================= NAVIGATION BUTTONS =================
document.getElementById("backLibraryBtn")?.addEventListener("click", () => {
  renderLibrary();
  showView("libraryView");
});
document.getElementById("readerBackBtn")?.addEventListener("click", () => {
  closeEditor();
  renderStory();
  showView("storyView");
});
document.getElementById("chapterBackBtn")?.addEventListener("click", () => {
  const story = getStory();
  if (!story) return;
  const idx = story.chapters.findIndex(c => c.id === currentChapterId);
  if (idx > 0) openChapter(story.chapters[idx - 1].id);
  else showView("storyView");
});
document.getElementById("chapterContinueBtn")?.addEventListener("click", () => {
  const story = getStory();
  if (!story) return;
  const idx = story.chapters.findIndex(c => c.id === currentChapterId);
  if (idx < story.chapters.length - 1) openChapter(story.chapters[idx + 1].id);
  else toast("End of story reached");
});

document.getElementById("topChapterBackBtn")?.addEventListener("click", () => document.getElementById("chapterBackBtn")?.click());
document.getElementById("topChapterContinueBtn")?.addEventListener("click", () => document.getElementById("chapterContinueBtn")?.click());

// Drawer
document.getElementById("chapterListBtn")?.addEventListener("click", openChapterDrawer);
document.getElementById("topChapterListBtn")?.addEventListener("click", openChapterDrawer);
document.getElementById("closeDrawerBtn")?.addEventListener("click", () => document.getElementById("chapterDrawer")?.classList.remove("open"));

function openChapterDrawer() {
  const story = getStory();
  const list = document.getElementById("drawerChapterList");
  if (!story || !list) return;
  list.innerHTML = "";
  story.chapters.forEach(chapter => {
    const item = document.createElement("div");
    item.className = "drawer-chapter" + (chapter.id === currentChapterId ? " current" : "");
    item.textContent = `Chapter ${chapter.number}: ${chapter.title || "Untitled"}`;
    item.onclick = () => {
      document.getElementById("chapterDrawer")?.classList.remove("open");
      openChapter(chapter.id);
    };
    list.appendChild(item);
  });
  document.getElementById("chapterDrawer")?.classList.add("open");
}

// Overview triggers
document.getElementById("overviewBtn")?.addEventListener("click", () => {
  const story = getStory();
  if (story) {
    document.getElementById("overviewStoryTitle").textContent = story.title;
    renderOverview();
    showView("overviewView");
  }
});
document.getElementById("storyOverviewBtn")?.addEventListener("click", () => document.getElementById("overviewBtn")?.click());
document.getElementById("overviewBackBtn")?.addEventListener("click", () => {
  if (currentChapterId) {
    renderReader();
    showView("readerView");
  } else {
    renderStory();
    showView("storyView");
  }
});

// Story Palette modal button
document.getElementById("storyPaletteBtn")?.addEventListener("click", () => {
  const story = getStory();
  if (!story) return;
  openThemeCustomizerModal(story, async (updatedStory) => {
    const newColor = updatedStory.themeColor || '#7654d8';
    story.themeColor = newColor;
    saveStoryTheme(story.id, newColor);
    saveState(state);
    try { localStorage.setItem(ACTIVE_COLOR_KEY, newColor); } catch (e) {}
    toast(`Theme palette updated for "${updatedStory.title}"`);
    renderStory();
    if (currentView === 'readerView') renderReader();
    if (currentView === 'overviewView') renderOverview();
    renderLibrary();

    const syncOk = await syncStoryThemeToSupabase(story.id, newColor, story.description);
    if (syncOk) {
      toast(`Theme palette synced to Cloud for "${updatedStory.title}"`);
    } else {
      toast(`Theme applied locally (Check Supabase setup)`);
    }
  });
});

// Theme switches
document.querySelectorAll(".theme-toggle").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTheme();
  });
});

// Import / Export
document.getElementById("exportBtn")?.addEventListener("click", () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "annotated-reader-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exported");
});

document.getElementById("importBtn")?.addEventListener("click", () => document.getElementById("importInput")?.click());
document.getElementById("importInput")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const parsed = JSON.parse(r.result);
      if (!parsed?.stories) throw new Error();
      const ok = await showConfirmDialog({ title: "Restore Backup", message: "Replace current library with backup?", confirmText: "Restore", cancelText: "Cancel", danger: false });
      if (!ok) return;
      state = parsed;
      saveState(state);
      renderLibrary();
      showView("libraryView");
      toast("Library restored");
    } catch {
      toast("Invalid backup file");
    }
  };
  r.readAsText(file);
});

function smoothScrollTo(element, duration = 350) {
  const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - window.innerHeight / 2 + element.offsetHeight / 2;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;

  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const prog = Math.min(timeElapsed / duration, 1);
    const ease = 1 - Math.pow(1 - prog, 3);
    window.scrollTo(0, startPosition + distance * ease);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  }
  requestAnimationFrame(animation);
}

// ESC key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closePopup();
    document.getElementById("chapterDrawer")?.classList.remove("open");
    document.getElementById("storyThemeModal")?.classList.remove("active");
  }
});

// Boot app
initApp();
