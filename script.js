/* =========================================================
   ANNOTATED READER
   Frontend prototype - SUPABASE INTEGRATION
   ========================================================= */

// ================= SUPABASE CLIENT =================
const SUPABASE_URL = 'https://elkdtrlumfghrsykqvty.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsa2R0cmx1bWZnaHJzeWtxdnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MzA3NTksImV4cCI6MjEwMzIwNjc1OX0.mZPwCV_lE2-0HozC8xAQ58pFtkbZK91eY62wAelXo6s';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function autoLogin() {
  await _supabase.auth.signInWithPassword({
    email: 'lanvy1859@gmail.com',
    password: 'lanvy1402'
  });
}
autoLogin();

// ================= STATE =================
const STORAGE_KEY = "annotated_reader_v1";
const NAV_STATE_KEY = "annotated_reader_nav";

let state = { stories: [] };
let currentStoryId = null;
let currentChapterId = null;
let currentView = "library";
let selectedRange = null;
let selectedText = "";
let pendingNoteType = "chapter";
let pendingImages = [];

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
            source: ""
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
            source: ""
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
        chapterId: null
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
  await loadFromSupabase();

  if (!state.stories.length) {
    state.stories.push(createDemoStory());
  }

  const savedNav = restoreNavigationState();
  if (savedNav) {
    const storyExists = state.stories.some(s => s.id === savedNav.storyId);
    if (savedNav.view === 'readerView' && savedNav.chapterId && storyExists) {
      currentStoryId = savedNav.storyId;
      currentChapterId = savedNav.chapterId;
      renderReader();
      showView('readerView');
      setTimeout(() => {
        window.scrollTo(0, savedNav.scrollPos || 0);
      }, 100);
      return;
    } else if (savedNav.view === 'storyView' && savedNav.storyId && storyExists) {
      currentStoryId = savedNav.storyId;
      renderStory();
      showView('storyView');
      return;
    }
  }

  renderLibrary();
  showView('libraryView');
  clearNavigationState();
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
  document.getElementById(id).classList.add("active");
  currentView = id;
  saveNavigationState();
}
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 1800);
}

window.addEventListener('scroll', () => {
  if (currentView === 'readerView') {
    saveNavigationState();
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
    const { data: stories, error: storyErr } = await _supabase
      .from('stories')
      .select('*')
      .order('created_at', { ascending: true });
    if (storyErr) throw storyErr;

    const { data: chapters, error: chapErr } = await _supabase
      .from('chapters')
      .select('*')
      .order('chapter_order', { ascending: true });
    if (chapErr) throw chapErr;

    const { data: notes, error: noteErr } = await _supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: true });
    if (noteErr) throw noteErr;

    if (!stories || stories.length === 0) {
      state.stories = [];
      return;
    }

    state.stories = stories.map(story => {
      const storyChapters = chapters.filter(c => c.story_id === story.id);
      const storyNotes = notes.filter(n => n.story_id === story.id);

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
          source: n.source || ''
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
        chapterId: n.chapter_id || null
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
    toast('Dữ liệu đã tải từ Supabase');
  } catch (error) {
    console.error('Lỗi tải dữ liệu:', error);
    toast('Lỗi tải dữ liệu, kiểm tra kết nối');
    if (!state.stories.length) {
      state.stories.push(createDemoStory());
    }
    renderLibrary();
  }
}

// ================= LIBRARY =================
function renderLibrary() {
  const grid = document.getElementById("storyGrid");
  grid.innerHTML = "";
  state.stories.forEach(story => {
    const card = document.createElement("div");
    card.className = "story-card";
    card.innerHTML = `
      <div class="story-card-cover">
        ${story.cover ? `<img src="${story.cover}" alt="">` : `<div class="cover-empty">✦</div>`}
      </div>
      <div class="story-card-info">
        <h3>${escapeHTML(story.title || "Untitled Story")}</h3>
        <p>${story.chapters.length} ${story.chapters.length === 1 ? "Chapter" : "Chapters"}</p>
      </div>
    `;
    card.addEventListener("click", () => openStory(story.id));
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
  list.innerHTML = "";
  story.chapters.sort((a,b) => a.number - b.number).forEach(chapter => {
    const item = document.createElement("div");
    item.className = "chapter-item";
    item.innerHTML = `
      <div>
        <span class="chapter-number">CHAPTER ${chapter.number}</span>
        <span class="chapter-item-title">${escapeHTML(chapter.title || "Untitled Chapter")}</span>
      </div>
      <div class="chapter-item-actions">
        <button class="btn ghost chapter-delete" data-delete="${chapter.id}">Delete</button>
      </div>
    `;
    item.addEventListener("click", event => {
      if (event.target.dataset.delete) {
        deleteChapter(event.target.dataset.delete);
        return;
      }
      openChapter(chapter.id);
    });
    list.appendChild(item);
  });
}

// ================= ADD STORY =================
document.getElementById("addStoryBtn").addEventListener("click", async () => {
  const story = {
    id: uid(),
    title: "Untitled Story",
    description: "",
    cover: "",
    chapters: [],
    globalNotes: []
  };
  state.stories.push(story);
  try {
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
    if (error) throw error;
    saveState(false);
    renderLibrary();
    openStory(story.id);
    toast("New story created");
  } catch (err) {
    console.error(err);
    toast('Lỗi tạo story: ' + err.message);
    state.stories = state.stories.filter(s => s.id !== story.id);
    renderLibrary();
  }
});

// ================= SAVE STORY =================
document.getElementById("saveStoryBtn").addEventListener("click", async () => {
  const story = getStory();
  if (!story) return;
  story.title = document.getElementById("storyTitleInput").value.trim() || "Untitled Story";
  story.description = document.getElementById("storyDescriptionInput").value;

  try {
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
    saveState(false);
    toast("Story saved");
    renderStory();
    renderLibrary();
  } catch (err) {
    console.error(err);
    toast('Lỗi lưu story: ' + err.message);
  }
});

// ================= COVER =================
document.getElementById("coverPlaceholder").addEventListener("click", () => {
  document.getElementById("coverInput").click();
});
document.getElementById("storyCover").addEventListener("click", () => {
  document.getElementById("coverInput").click();
});
document.getElementById("coverInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const story = getStory();
  if (!story) return;

  try {
    const filePath = `covers/${Date.now()}_${file.name}`;
    const { data, error: uploadErr } = await _supabase.storage
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
    const { error: updateErr } = await _supabase
      .from('stories')
      .update({ cover_url: coverUrl, updated_at: new Date().toISOString() })
      .eq('id', story.id);
    if (updateErr) throw updateErr;

    toast('Cover updated');
    renderStory();
    renderLibrary();
  } catch (err) {
    console.error(err);
    toast('Lỗi upload cover: ' + err.message);
  }
});

// ================= DELETE STORY =================
document.getElementById("deleteStoryBtn").addEventListener("click", async () => {
  const story = getStory();
  if (!story) return;
  const ok = confirm(`Delete "${story.title}"?\n\nThis will delete all chapters, notes, and images.`);
  if (!ok) return;

  try {
    const { data: notes, error: noteErr } = await _supabase
      .from('notes')
      .select('id, source')
      .eq('story_id', story.id);
    if (noteErr) throw noteErr;

    for (const note of notes) {
      if (note.source) {
        await deleteImageFromStorage(note.source);
      }
    }

    if (story.cover) {
      await deleteImageFromStorage(story.cover);
    }

    await _supabase.from('chapters').delete().eq('story_id', story.id);
    await _supabase.from('notes').delete().eq('story_id', story.id);
    await _supabase.from('stories').delete().eq('id', story.id);

    state.stories = state.stories.filter(s => s.id !== currentStoryId);
    currentStoryId = null;
    saveState(false);
    renderLibrary();
    showView('libraryView');
    toast('Story deleted');
  } catch (err) {
    console.error(err);
    toast('Lỗi xóa story: ' + err.message);
  }
});

// ================= ADD CHAPTER =================
document.getElementById("addChapterBtn").addEventListener("click", async () => {
  const story = getStory();
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
    saveState(false);
    renderChapterList();
    openChapter(chapter.id);
    toast(`Chapter ${nextNumber} created`);
  } catch (err) {
    console.error(err);
    story.chapters = story.chapters.filter(c => c.id !== chapter.id);
    toast('Lỗi tạo chapter: ' + err.message);
  }
});

// ================= DELETE CHAPTER =================
async function deleteChapter(chapterId) {
  const story = getStory();
  const chapter = story.chapters.find(c => c.id === chapterId);
  if (!chapter) return;
  const ok = confirm(`Delete Chapter ${chapter.number}?\n\nThis will also delete all notes and images.`);
  if (!ok) return;

  try {
    const { data: notes, error } = await _supabase
      .from('notes')
      .select('id, source')
      .eq('chapter_id', chapterId);
    if (error) throw error;

    for (const note of notes) {
      if (note.source) {
        await deleteImageFromStorage(note.source);
      }
    }

    await _supabase.from('notes').delete().eq('chapter_id', chapterId);
    await _supabase.from('chapters').delete().eq('id', chapterId);

    story.chapters = story.chapters.filter(c => c.id !== chapterId);
    story.chapters.sort((a,b) => a.number - b.number).forEach((ch, idx) => {
      ch.number = idx + 1;
    });
    saveState(false);
    renderChapterList();
    toast('Chapter deleted');
  } catch (err) {
    console.error(err);
    toast('Lỗi xóa chapter: ' + err.message);
  }
}

// ================= OPEN CHAPTER =================
function openChapter(chapterId) {
  currentChapterId = chapterId;
  renderReader();
  showView("readerView");
  closeEditor();
  saveNavigationState();
}
function renderReader() {
  const story = getStory();
  const chapter = getChapter();
  if (!story || !chapter) return;
  document.getElementById("readerStoryName").textContent = story.title;
  document.getElementById("readerChapterName").textContent = `Chapter ${chapter.number}: ${chapter.title || "Untitled"}`;
  const reader = document.getElementById("readerContent");
  reader.innerHTML = chapter.content;
  activateReaderAnnotations();
}

// ================= READER ANNOTATIONS =================
function activateReaderAnnotations() {
  document.querySelectorAll("#readerContent .annotation, #readerContent .editor-annotation").forEach(el => {
    el.addEventListener("click", event => {
      event.stopPropagation();
      const noteId = el.dataset.noteId;
      const chapter = getChapter();
      const note = chapter.notes.find(n => n.id === noteId);
      if (!note) {
        const story = getStory();
        const global = story.globalNotes.find(n => n.id === noteId);
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
let isPopupOpen = false;

function openPopup(html, anchor) {
  const popup = document.getElementById('notePopup');
  popup.innerHTML = html;
  popup.style.position = 'fixed';
  popup.style.zIndex = '1000';
  popup.style.display = 'block';
  popup.style.visibility = 'visible';
  
  // Xóa handler cũ
  if (popup._outsideHandler) {
    document.removeEventListener('click', popup._outsideHandler);
  }
  
  // Chỉ gắn handler nếu không phải là popup editor (bước 2)
  // Vì bước 2 sẽ được mở bằng cách gọi openPopup khác
  // Nên handler sẽ được gắn lại mỗi lần mở popup
  
  function handler(e) {
    // Kiểm tra nếu click bên ngoài popup và không phải là nút confirm
    if (!popup.contains(e.target)) {
      // Nếu popup đang ở bước 2 (có textarea #newNoteContent), không đóng
      if (popup.querySelector('#newNoteContent')) {
        // Không đóng popup bước 2 khi click bên ngoài
        return;
      }
      closeNotePopup();
    }
  }
  
  popup._outsideHandler = handler;
  // Chỉ gắn handler sau một khoảng thời gian ngắn để tránh click ngay lập tức đóng popup
  setTimeout(() => {
    document.addEventListener('click', handler);
  }, 100);
  
  if (anchor) {
    positionPopup(popup, anchor);
  } else {
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }
  popup.classList.add('open');
  isPopupOpen = true;
}

function closePopup() {
  const popup = document.getElementById('notePopup');
  if (popup._outsideHandler) {
    document.removeEventListener('click', popup._outsideHandler);
    delete popup._outsideHandler;
  }
  popup.classList.remove('open');
  popup.style.display = 'none';
  popup.style.visibility = 'hidden';
  isPopupOpen = false;
}

function closeNotePopup() {
  closePopup();
}
window.closeNotePopup = closeNotePopup;

// ================= NOTE DISPLAY =================
function showNotePopup(note, anchor) {
  const isGlobal = note.type === "global";
  const noteLabel = isGlobal ? "Global Note" : "Chapter Note";
  const displayText = isGlobal ? note.title : note.selectedText;

  const html = `
    <div style="padding:18px; font-family: Inter, sans-serif; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); max-width: 380px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:10px;">
        <strong style="font-size:16px; color: #7654d8;">${noteLabel}</strong>
        <div>
          <button onclick="editNote('${note.id}', '${isGlobal ? 'global' : 'chapter'}')" style="margin-right:8px; border:0; background:transparent; font-size:18px; color:#7654d8; cursor:pointer;" title="Edit note">✎</button>
          <button onclick="closeNotePopup()" style="border:0; background:transparent; font-size:22px; color:#999; cursor:pointer;">×</button>
        </div>
      </div>
      <div style="background:#f5f0ff; border-radius:8px; padding:10px; margin:8px 0 14px;">
        <span style="font-size:14px; color:#555;">"${escapeHTML(displayText || "")}"</span>
      </div>
      <div style="font-size:15px; line-height:1.6; color:#333; margin-bottom:12px;">${escapeHTML(note.content || "").replace(/\n/g, "<br>")}</div>
      ${note.images?.length ? `<div style="display:flex; flex-wrap:wrap; gap:8px; margin:10px 0;">${note.images.map(img => `<img src="${img}" style="max-width:100%; max-height:200px; border-radius:6px; object-fit:cover;">`).join("")}</div>` : ""}
      ${note.caption ? `<div style="font-size:13px; color:#777; margin-top:6px;">${escapeHTML(note.caption)}</div>` : ""}
      ${note.source && !note.source.includes('reader-images') ? `<div style="font-size:13px; color:#999; margin-top:4px;">📎 ${escapeHTML(note.source)}</div>` : ""}
    </div>
  `;
  openPopup(html, anchor);
}

// ================= EDIT NOTE =================
function editNote(noteId, type) {
  closeNotePopup();
  const story = getStory();
  if (!story) {
    toast("Story not found!");
    return;
  }
  let note = null;
  let container = null;
  if (type === 'global') {
    note = story.globalNotes.find(n => n.id === noteId);
    container = story.globalNotes;
  } else {
    for (let ch of story.chapters) {
      const found = ch.notes.find(n => n.id === noteId);
      if (found) {
        note = found;
        container = ch.notes;
        break;
      }
    }
  }
  if (!note) {
    toast("Note not found!");
    return;
  }
  const isGlobal = note.type === "global";
  const noteLabel = isGlobal ? "Global Note" : "Chapter Note";
  const html = `
    <div style="padding:18px; font-family: Inter, sans-serif; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); max-width: 380px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:10px;">
        <strong style="font-size:16px; color: #7654d8;">Edit ${noteLabel}</strong>
        <button onclick="closeNotePopup()" style="border:0; background:transparent; font-size:22px; color:#999; cursor:pointer;">×</button>
      </div>
      <label style="display:block; font-size:12px; font-weight:700; margin:10px 0 6px;">Content</label>
      <textarea id="editNoteContent" style="width:100%; min-height:100px; border:1px solid #ddd; border-radius:8px; padding:10px; font-family:inherit; font-size:14px; outline:none;">${escapeHTML(note.content)}</textarea>
      <label style="display:block; font-size:12px; font-weight:700; margin:10px 0 6px;">Caption (optional)</label>
      <input id="editNoteCaption" class="field" value="${escapeHTML(note.caption || '')}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:8px;">
      <label style="display:block; font-size:12px; font-weight:700; margin:10px 0 6px;">Source (optional)</label>
      <input id="editNoteSource" class="field" value="${escapeHTML(note.source || '')}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:12px;">
      <button class="btn primary full" id="saveEditNoteBtn" style="margin-top:8px; width:100%; padding:12px; background:#7654d8; color:white; border:0; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer;">Save Changes</button>
    </div>
  `;
  openPopup(html, null);
  document.getElementById('saveEditNoteBtn').addEventListener('click', async function() {
    const newContent = document.getElementById('editNoteContent').value.trim();
    if (!newContent) {
      toast("Content cannot be empty");
      return;
    }
    note.content = newContent;
    note.caption = document.getElementById('editNoteCaption').value.trim();
    note.source = document.getElementById('editNoteSource').value.trim();

    try {
      await _supabase
        .from('notes')
        .update({
          note_text: newContent,
          caption: note.caption,
          source: note.source,
          updated_at: new Date().toISOString()
        })
        .eq('id', note.id);

      saveState(false);
      closeNotePopup();
      renderOverview();
      if (document.getElementById('readerView').classList.contains('active')) {
        renderReader();
      }
      toast("Note updated!");
    } catch (err) {
      console.error(err);
      toast('Lỗi cập nhật note: ' + err.message);
    }
  });
}
window.editNote = editNote;

// ================= POPUP POSITION =================
function positionPopup(popup, anchor) {
  const rect = anchor.getBoundingClientRect();
  popup.style.left = "0px";
  popup.style.top = "0px";
  const popupWidth = popup.offsetWidth || 380;
  const popupHeight = popup.offsetHeight || 300;
  let left = rect.left + rect.width / 2 - popupWidth / 2;
  let top = rect.bottom + 10;
  if (left + popupWidth > window.innerWidth - 15) {
    left = window.innerWidth - popupWidth - 15;
  }
  if (left < 15) {
    left = 15;
  }
  if (top + popupHeight > window.innerHeight - 15) {
    top = rect.top - popupHeight - 10;
  }
  if (top < 15) {
    top = 15;
  }
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.style.transform = 'none';
}

// ================= EDIT MODE =================
document.getElementById("toggleEditBtn").addEventListener("click", openEditor);
document.getElementById("closeEditorBtn").addEventListener("click", closeEditor);
function openEditor() {
  const chapter = getChapter();
  if (!chapter) return;
  document.getElementById("chapterTitleInput").value = chapter.title || "";
  document.getElementById("chapterEditor").innerHTML = chapter.content;
  document.getElementById("editorPanel").classList.add("open");
  activateEditorAnnotations();
}
function closeEditor() {
  document.getElementById("editorPanel").classList.remove("open");
  closeNotePopup();
}

// ================= SAVE CHAPTER =================
document.getElementById("saveChapterBtn").addEventListener("click", async () => {
  const story = getStory();
  const chapter = getChapter();
  if (!story || !chapter) return;

  chapter.title = document.getElementById("chapterTitleInput").value.trim();
  chapter.content = document.getElementById("chapterEditor").innerHTML;

  try {
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
    saveState(false);
    toast("Chapter saved");
    renderReader();
    renderChapterList();
  } catch (err) {
    console.error(err);
    toast('Lỗi lưu chapter: ' + err.message);
  }
});

// ================= EDITOR ANNOTATIONS =================
function activateEditorAnnotations() {
  document.querySelectorAll("#chapterEditor .editor-annotation, #chapterEditor .annotation").forEach(el => {
    el.addEventListener("click", event => {
      event.stopPropagation();
      const noteId = el.dataset.noteId;
      const chapter = getChapter();
      const note = chapter.notes.find(n => n.id === noteId);
      if (!note) {
        const story = getStory();
        const global = story.globalNotes.find(n => n.id === noteId);
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
document.getElementById("chapterEditor").addEventListener("mouseup", handleTextSelection);
document.getElementById("chapterEditor").addEventListener("touchend", () => {
  setTimeout(handleTextSelection, 100);
});
function handleTextSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const text = selection.toString().trim();
  if (!text) return;
  const range = selection.getRangeAt(0);
  if (!document.getElementById("chapterEditor").contains(range.commonAncestorContainer)) return;
  selectedRange = range.cloneRange();
  selectedText = text;
  showCreateNotePopup(range);
}

// ================= CREATE NOTE POPUP (BƯỚC 1: CONFIRM) =================
function showCreateNotePopup(range) {
  pendingImages = [];
  const anchor = { getBoundingClientRect: () => range.getBoundingClientRect() };

  const html = `
    <div style="padding:18px; font-family: Inter, sans-serif; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); max-width: 380px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:10px;">
        <strong style="font-size:16px; color: #7654d8;">Add Note</strong>
        <button onclick="closeCreatePopup()" style="border:0; background:transparent; font-size:22px; color:#999; cursor:pointer;">×</button>
      </div>
      <div style="background:#f5f0ff; border-radius:8px; padding:10px; margin:8px 0 14px;">
        <span style="font-size:14px; color:#555;">"${escapeHTML(selectedText)}"</span>
      </div>
      <label style="display:block; font-size:12px; font-weight:700; margin:10px 0 6px;">Note Type</label>
      <div style="display:flex; gap:6px; margin-bottom:12px;">
        <button class="type-btn active" data-type="chapter" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:8px; background:white; font-size:13px; cursor:pointer; transition:0.2s;">Chapter Note</button>
        <button class="type-btn" data-type="global" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:8px; background:white; font-size:13px; cursor:pointer; transition:0.2s;">Global Note</button>
      </div>
      <button class="btn primary full" id="confirmSelectionBtn" style="width:100%; padding:12px; background:#7654d8; color:white; border:0; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer;">Confirm</button>
    </div>
  `;

  // Mở popup bước 1
  openPopup(html, anchor);
  
  // Gắn sự kiện cho các nút type
  const popup = document.getElementById('notePopup');
  popup.querySelectorAll(".type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      popup.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      pendingNoteType = btn.dataset.type;
    });
  });
  
  // Gắn sự kiện confirm để mở bước 2
  popup.querySelector("#confirmSelectionBtn").addEventListener("click", function() {
    // Đóng popup bước 1
    closePopup();
    // Mở popup bước 2
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

// ================= NOTE EDITOR (BƯỚC 2: NHẬP NỘI DUNG - CĂN CHỈNH ĐẸP) =================
function openNoteEditor() {
  const isGlobal = pendingNoteType === "global";
  const noteLabel = isGlobal ? "Global Note" : "Chapter Note";
  
  const html = `
    <div style="padding:18px; font-family: Inter, sans-serif; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); max-width: 380px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:10px;">
        <strong style="font-size:16px; color: #7654d8;">${noteLabel}</strong>
        <button onclick="closeCreatePopup()" style="border:0; background:transparent; font-size:22px; color:#999; cursor:pointer;">×</button>
      </div>
      <label style="display:block; font-size:12px; font-weight:700; margin:10px 0 6px;">Note</label>
      <textarea id="newNoteContent" placeholder="Write your note..." style="width:100%; min-height:100px; border:1px solid #ddd; border-radius:8px; padding:10px; font-family:inherit; font-size:14px; outline:none;"></textarea>
      
      <!-- Illustration + Caption + Source căn chỉnh thẳng hàng -->
      <label style="display:block; font-size:12px; font-weight:700; margin:10px 0 6px;">Illustration</label>
      <div style="display:flex; gap:12px; align-items:stretch;">
        <!-- Cột trái: Illustration -->
        <div id="newImageSlots" class="image-slots" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; align-content:center; flex:0 0 auto;">
          <button class="add-image-btn" id="firstImageBtn" title="Add image" style="width:76px; height:76px; border:1px solid #ddd; background:white; border-radius:8px; font-size:24px; color:#7654d8; cursor:pointer;">＋</button>
        </div>
        <!-- Cột phải: Caption + Source -->
        <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; gap:8px; min-width:0;">
          <input id="newCaption" class="field" placeholder="Caption (optional)" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:13px;">
          <input id="newSource" class="field" placeholder="Source (optional)" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:13px;">
        </div>
      </div>
      
      <button class="btn primary full" id="saveNewNoteBtn" style="width:100%; padding:12px; background:#7654d8; color:white; border:0; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; margin-top:12px;">Save Note</button>
    </div>
  `;
  
  // Mở popup bước 2 với anchor là vị trí của selection
  const anchor = getAnchorFromRange(selectedRange);
  // Không gắn outside handler cho bước 2 để tránh đóng nhầm
  const popup = document.getElementById('notePopup');
  // Xóa handler cũ nếu có
  if (popup._outsideHandler) {
    document.removeEventListener('click', popup._outsideHandler);
    delete popup._outsideHandler;
  }
  
  // Hiển thị popup
  popup.innerHTML = html;
  popup.style.position = 'fixed';
  popup.style.zIndex = '1000';
  popup.style.display = 'block';
  popup.style.visibility = 'visible';
  
  // Gắn handler đóng bên ngoài nhưng KHÔNG đóng popup bước 2 khi click bên ngoài
  // Chỉ cho phép đóng bằng nút ×
  // Để tắt handler cho popup bước 2, ta không gắn handler cho click bên ngoài
  
  if (anchor) {
    positionPopup(popup, anchor);
  } else {
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }
  popup.classList.add('open');
  
  // Gắn sự kiện cho các nút
  document.getElementById("firstImageBtn").addEventListener("click", () => addImageSlot());
  document.getElementById("saveNewNoteBtn").addEventListener("click", saveNewNote);
}

function getAnchorFromRange(range) {
  if (!range) return null;
  const rect = range.getBoundingClientRect();
  return { getBoundingClientRect: () => rect };
}

// ================= IMAGE SLOT =================
function addImageSlot() {
  const wrapper = document.getElementById("newImageSlots");
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
      const filePath = `notes/${Date.now()}_${file.name}`;
      const { data, error } = await _supabase.storage
        .from('reader-images')
        .upload(filePath, file);
      if (error) throw error;

      const { data: urlData } = _supabase.storage
        .from('reader-images')
        .getPublicUrl(filePath);
      const imageUrl = urlData.publicUrl;
      pendingImages.push(imageUrl);
      renderPendingImages();
      toast('Đã upload ảnh');
    } catch (err) {
      console.error(err);
      toast('Lỗi upload ảnh: ' + err.message);
    }
  });
}

function renderPendingImages() {
  const wrapper = document.getElementById("newImageSlots");
  wrapper.innerHTML = "";
  pendingImages.forEach((imageUrl, index) => {
    const slot = document.createElement("div");
    slot.className = "image-slot";
    slot.innerHTML = `<img src="${imageUrl}" style="width:76px; height:76px; object-fit:cover; border-radius:6px;"><button class="image-remove" data-index="${index}" style="position:absolute; top:2px; right:2px; width:20px; height:20px; border:0; border-radius:50%; background:rgba(0,0,0,0.6); color:white; font-size:14px; cursor:pointer;">×</button>`;
    slot.style.position = "relative";
    wrapper.appendChild(slot);
  });
  const addBtn = document.createElement("button");
  addBtn.className = "add-image-btn";
  addBtn.textContent = "＋";
  addBtn.title = "Add another image";
  addBtn.style.width = "76px";
  addBtn.style.height = "76px";
  addBtn.style.border = "1px solid #ddd";
  addBtn.style.background = "white";
  addBtn.style.borderRadius = "8px";
  addBtn.style.fontSize = "24px";
  addBtn.style.color = "#7654d8";
  addBtn.style.cursor = "pointer";
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
    const { data, error } = await _supabase
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
      })
      .select();

    if (error) throw error;

    const newNote = {
      id: noteId,
      type: noteType,
      selectedText: selectedText,
      content: content,
      images: pendingImages,
      caption: caption,
      source: imageUrl || source,
      chapterId: chapterId
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

    await _supabase
      .from('chapters')
      .update({ content: chapter.content, updated_at: new Date().toISOString() })
      .eq('id', chapter.id);

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
    toast('Lỗi lưu note: ' + err.message);
  }
}

// ================= APPLY ANNOTATION =================
function applyAnnotationToSelection(noteId) {
  if (!selectedRange) return;
  try {
    const span = document.createElement("span");
    span.className = "editor-annotation";
    span.dataset.noteId = noteId;
    const contents = selectedRange.extractContents();
    span.appendChild(contents);
    selectedRange.insertNode(span);
    const selection = window.getSelection();
    selection.removeAllRanges();
  } catch (error) {
    console.error("Could not annotate selection", error);
  }
}

// ================= NAVIGATION =================
document.getElementById("readerBackBtn").addEventListener("click", () => {
  closeEditor();
  showView("storyView");
  renderStory();
  saveNavigationState();
});
document.getElementById("chapterBackBtn").addEventListener("click", () => {
  goPreviousChapter();
});
document.getElementById("chapterContinueBtn").addEventListener("click", () => {
  goNextChapter();
});
function goPreviousChapter() {
  const story = getStory();
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
  const index = story.chapters.findIndex(c => c.id === currentChapterId);
  if (index === story.chapters.length - 1) {
    toast("You have reached the end of this story.");
    return;
  }
  openChapter(story.chapters[index + 1].id);
}

// ================= TOP NAVIGATION =================
document.getElementById("topChapterBackBtn").addEventListener("click", () => {
  goPreviousChapter();
});
document.getElementById("topChapterContinueBtn").addEventListener("click", () => {
  goNextChapter();
});
document.getElementById("topChapterListBtn").addEventListener("click", () => {
  openChapterDrawer();
});

// ================= CHAPTER DRAWER =================
document.getElementById("chapterListBtn").addEventListener("click", openChapterDrawer);
function openChapterDrawer() {
  const story = getStory();
  const list = document.getElementById("drawerChapterList");
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
  document.getElementById("chapterDrawer").classList.add("open");
}
function closeChapterDrawer() {
  document.getElementById("chapterDrawer").classList.remove("open");
}
document.getElementById("closeDrawerBtn").addEventListener("click", closeChapterDrawer);
document.getElementById("chapterDrawer").addEventListener("click", event => {
  if (event.target.id === "chapterDrawer") {
    closeChapterDrawer();
  }
});

// ================= LIBRARY NAV =================
document.getElementById("backLibraryBtn").addEventListener("click", () => {
  renderLibrary();
  showView("libraryView");
  saveNavigationState();
});

// ================= OVERVIEW =================
document.getElementById("overviewBtn").addEventListener("click", openOverview);
document.getElementById("storyOverviewBtn").addEventListener("click", openOverview);
document.getElementById("overviewBackBtn").addEventListener("click", () => {
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
  document.getElementById("searchResults").innerHTML = "";
}

// ================= RENDER GLOBAL NOTES =================
function renderGlobalNotes() {
  const story = getStory();
  const list = document.getElementById("globalNotesList");
  list.innerHTML = "";
  if (!story.globalNotes.length) {
    list.innerHTML = `<p class="muted">No global notes yet.</p>`;
    return;
  }
  story.globalNotes.forEach((note, index) => {
    const item = document.createElement("div");
    item.className = "note-list-item";
    item.dataset.noteIndex = index;
    item.dataset.noteType = "global";
    item.innerHTML = `
      <span class="note-badge">GLOBAL · ${escapeHTML(note.category || "NOTE")}</span>
      <strong>${escapeHTML(note.title || note.selectedText)}</strong>
      <p>${escapeHTML(note.content)}</p>
      <button class="delete-note-btn" data-action="delete-note">✕</button>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".delete-note-btn")) return;
      showNotePopup(note, item);
    });
    list.appendChild(item);
  });
}

// ================= RENDER CHAPTER NOTES (ACCORDION + SORT) =================
let chapterSortOrder = localStorage.getItem('chapter_sort_order') || 'desc';

function renderChapterNotes() {
  const story = getStory();
  const list = document.getElementById("chapterNotesList");
  if (!list) return;

  // Lấy tất cả chapter notes từ tất cả chapters
  let allNotes = [];
  story.chapters.forEach(chapter => {
    chapter.notes.forEach((note, idx) => {
      allNotes.push({
        ...note,
        chapterNumber: chapter.number,
        chapterId: chapter.id,
        noteIndex: idx
      });
    });
  });

  if (allNotes.length === 0) {
    list.innerHTML = `<p class="muted">No chapter notes yet.</p>`;
    return;
  }

  // 1. Nhóm theo chapter
  const grouped = {};
  allNotes.forEach(note => {
    const key = note.chapterId;
    if (!grouped[key]) {
      grouped[key] = {
        chapterId: key,
        chapterNumber: note.chapterNumber,
        notes: []
      };
    }
    grouped[key].notes.push(note);
  });

  // 2. Chuyển thành mảng và sắp xếp theo chapter number
  const sortedChapters = Object.values(grouped).sort((a, b) => {
    if (chapterSortOrder === 'asc') {
      return a.chapterNumber - b.chapterNumber;
    } else {
      return b.chapterNumber - a.chapterNumber;
    }
  });

  // 3. Render HTML
  let html = '';
  
  // Thêm nút sắp xếp
  html += `
    <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
      <button id="sortChapterBtn" class="btn ghost" style="font-size:12px; padding:4px 10px;">
        ${chapterSortOrder === 'asc' ? '▼ Oldest first' : '▲ Newest first'}
      </button>
    </div>
  `;

  sortedChapters.forEach((group, index) => {
    const isFirst = index === 0; // Chapter đầu tiên mặc định mở
    const noteCount = group.notes.length;

    const notesHTML = group.notes.map(note => {
      return `
        <div class="note-list-item" data-chapter-id="${note.chapterId}" data-note-index="${note.noteIndex}" data-note-type="chapter">
          <span class="note-badge">CHAPTER ${note.chapterNumber}</span>
          <strong>${escapeHTML(note.selectedText)}</strong>
          <p>${escapeHTML(note.content)}</p>
          <button class="delete-note-btn" data-action="delete-note">✕</button>
        </div>
      `;
    }).join('');

    html += `
      <div class="accordion-item ${isFirst ? 'active' : ''}" data-chapter="${group.chapterId}">
        <div class="accordion-header" onclick="toggleAccordion(this)">
          <div class="accordion-title">
            <span class="chap-badge">Chap ${group.chapterNumber}</span>
            <span class="note-count">(${noteCount} note${noteCount > 1 ? 's' : ''})</span>
          </div>
          <span class="accordion-icon">${isFirst ? '▲' : '▼'}</span>
        </div>
        <div class="accordion-content" style="display: ${isFirst ? 'block' : 'none'};">
          ${notesHTML}
        </div>
      </div>
    `;
  });

  list.innerHTML = html;

  // Gắn sự kiện cho nút sắp xếp
  const sortBtn = document.getElementById('sortChapterBtn');
  if (sortBtn) {
    sortBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      // Đảo thứ tự
      chapterSortOrder = chapterSortOrder === 'asc' ? 'desc' : 'asc';
      localStorage.setItem('chapter_sort_order', chapterSortOrder);
      renderChapterNotes(); // render lại
    });
  }

  // Gắn lại sự kiện click cho các nút xóa
  list.querySelectorAll('.delete-note-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteNoteFromOverview(this);
    });
  });

  // Gắn lại sự kiện click cho các note item (mở chapter)
  list.querySelectorAll('.note-list-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (e.target.closest('.delete-note-btn')) return;
      const chapterId = this.dataset.chapterId;
      if (chapterId) {
        openChapter(chapterId);
      }
    });
  });
}

// ================= TOGGLE ACCORDION =================
function toggleAccordion(headerElement) {
  const accordionItem = headerElement.parentElement;
  const content = accordionItem.querySelector('.accordion-content');
  const icon = headerElement.querySelector('.accordion-icon');

  const isOpen = content.style.display === 'block';

  if (isOpen) {
    content.style.display = 'none';
    icon.textContent = '▼';
    accordionItem.classList.remove('active');
  } else {
    content.style.display = 'block';
    icon.textContent = '▲';
    accordionItem.classList.add('active');
  }
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
async function deleteNoteFromOverview(target) {
  const item = target.closest(".note-list-item");
  if (!item) return;
  const type = item.dataset.noteType;
  const story = getStory();
  if (!story) return;

  if (type === "global") {
    const index = parseInt(item.dataset.noteIndex, 10);
    if (isNaN(index)) return;
    const note = story.globalNotes[index];
    if (!note) return;
    if (!confirm(`Xóa global note "${note.title}"?`)) return;

    const noteCopy = { ...note };

    story.globalNotes.splice(index, 1);
    renderOverview();

    const chapterId = noteCopy.chapterId;
    if (chapterId) {
      const chapter = story.chapters.find(c => c.id === chapterId);
      if (chapter) {
        removeAnnotationFromContent(noteCopy.id, chapterId);
        try {
          const { error: updateChapErr } = await _supabase
            .from('chapters')
            .update({
              content: chapter.content,
              updated_at: new Date().toISOString()
            })
            .eq('id', chapterId);
          if (updateChapErr) throw updateChapErr;
        } catch (updateErr) {
          console.error('Không thể cập nhật chapter content:', updateErr);
          alert('Lỗi cập nhật nội dung, vui lòng thử lại!');
          await loadFromSupabase();
          renderOverview();
          if (currentChapterId) {
            renderReader();
            showView("readerView");
          } else {
            renderStory();
            showView("storyView");
          }
          return;
        }
      }
    }

    try {
      if (noteCopy.source) {
        await deleteImageFromStorage(noteCopy.source);
      }
    } catch (imgErr) {
      console.warn('Lỗi xóa ảnh global note:', imgErr);
    }

    try {
      const { error } = await _supabase
        .from('notes')
        .delete()
        .eq('id', noteCopy.id);
      if (error) throw error;
      toast("Đã xóa global note");
      if (document.getElementById('readerView').classList.contains('active')) {
        renderReader();
      }
    } catch (err) {
      console.error('Lỗi xóa global note:', err);
      alert("Xóa thất bại, vui lòng thử lại!");
      await loadFromSupabase();
      renderOverview();
      if (currentChapterId) {
        renderReader();
        showView("readerView");
      } else {
        renderStory();
        showView("storyView");
      }
    }

  } else if (type === "chapter") {
    const chapterId = item.dataset.chapterId;
    const noteIndex = parseInt(item.dataset.noteIndex, 10);
    if (!chapterId || isNaN(noteIndex)) return;
    const chapter = story.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    const note = chapter.notes[noteIndex];
    if (!note) return;
    if (!confirm(`Xóa chapter note "${note.selectedText}"?`)) return;

    const noteCopy = { ...note };

    chapter.notes.splice(noteIndex, 1);
    removeAnnotationFromContent(noteCopy.id, chapterId);
    renderOverview();
    if (document.getElementById('readerView').classList.contains('active')) {
      renderReader();
    }

    try {
      const { error: updateChapErr } = await _supabase
        .from('chapters')
        .update({
          content: chapter.content,
          updated_at: new Date().toISOString()
        })
        .eq('id', chapterId);
      if (updateChapErr) throw updateChapErr;
    } catch (updateErr) {
      console.error('Không thể cập nhật chapter content:', updateErr);
      alert('Lỗi cập nhật nội dung, vui lòng thử lại!');
      await loadFromSupabase();
      if (currentChapterId) {
        renderReader();
        showView("readerView");
      } else {
        renderStory();
        showView("storyView");
      }
      return;
    }

    try {
      if (noteCopy.source) {
        await deleteImageFromStorage(noteCopy.source);
      }
      const { error } = await _supabase.from('notes').delete().eq('id', noteCopy.id);
      if (error) throw error;
      toast("Đã xóa chapter note");
    } catch (err) {
      console.error(err);
      alert("Xóa thất bại, vui lòng thử lại!");
      await loadFromSupabase();
      if (currentChapterId) {
        renderReader();
        showView("readerView");
      } else {
        renderStory();
        showView("storyView");
      }
    }
  }
}

// ================= DELETE IMAGE FROM STORAGE =================
async function deleteImageFromStorage(imageUrl) {
  if (!imageUrl || !imageUrl.includes('reader-images')) return;
  const filePath = imageUrl.split('/reader-images/')[1];
  if (!filePath) return;
  try {
    await _supabase.storage.from('reader-images').remove([filePath]);
    console.log('Đã xóa ảnh:', filePath);
  } catch (err) {
    console.warn('Không thể xóa ảnh:', err);
  }
}

// Sự kiện click nút xóa note
document.addEventListener("click", function(e) {
  const deleteBtn = e.target.closest(".delete-note-btn");
  if (!deleteBtn) return;
  e.stopPropagation();
  deleteNoteFromOverview(deleteBtn);
});

// ================= SEARCH =================
document.getElementById("noteSearch").addEventListener("input", event => {
  searchNotes(event.target.value);
});
function searchNotes(query) {
  const story = getStory();
  const container = document.getElementById("searchResults");
  container.innerHTML = "";
  query = query.trim().toLowerCase();
  if (!query) return;
  const results = [];
  story.globalNotes.forEach(note => {
    const searchable = [note.title, note.content, ...(note.keywords || [])].join(" ").toLowerCase();
    if (searchable.includes(query)) {
      results.push({
        source: "Global Note",
        title: note.title,
        content: note.content,
        action: () => showNotePopup(note, document.getElementById("noteSearch"))
      });
    }
  });
  story.chapters.forEach(chapter => {
    chapter.notes.forEach(note => {
      const searchable = [note.selectedText, note.content].join(" ").toLowerCase();
      if (searchable.includes(query)) {
        results.push({
          source: `Chapter ${chapter.number} · Chapter Note`,
          title: note.selectedText,
          content: note.content,
          action: () => openChapter(chapter.id)
        });
      }
    });
  });
  if (!results.length) {
    container.innerHTML = `<p class="muted">No results found.</p>`;
    return;
  }
  results.forEach(result => {
    const item = document.createElement("div");
    item.className = "search-result";
    item.innerHTML = `<div class="source">${escapeHTML(result.source)}</div><strong>${escapeHTML(result.title)}</strong><p>${escapeHTML(result.content)}</p>`;
    item.addEventListener("click", result.action);
    container.appendChild(item);
  });
}

// ================= ADD GLOBAL NOTE =================
document.getElementById("addGlobalNoteBtn").addEventListener("click", async () => {
  const story = getStory();
  const title = prompt("Global Note title:");
  if (!title) return;
  const content = prompt("Global Note content:") || "";
  const category = prompt("Category: Character / Place / Concept / Term / Other", "Character") || "Other";
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
    chapterId: null
  };
  story.globalNotes.push(note);

  try {
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

    saveState(false);
    renderOverview();
    toast("Global note added");
  } catch (err) {
    console.error(err);
    story.globalNotes = story.globalNotes.filter(n => n.id !== note.id);
    toast('Lỗi thêm global note: ' + err.message);
  }
});

// ================= EXPORT =================
document.getElementById("exportBtn").addEventListener("click", exportData);
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
document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importInput").click();
});
document.getElementById("importInput").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.stories)) {
        throw new Error("Invalid data");
      }
      const ok = confirm("Import this backup and replace current data?");
      if (!ok) return;
      state = imported;
      saveState(false);
      currentStoryId = null;
      currentChapterId = null;
      renderLibrary();
      showView("libraryView");
      toast("Backup imported");
    } catch (error) {
      alert("Invalid JSON backup.");
    }
  };
  reader.readAsText(file);
});

// ================= IMAGE READER (cũ) =================
function readImage(file, callback) {
  const reader = new FileReader();
  reader.onload = event => {
    callback(event.target.result);
  };
  reader.readAsDataURL(file);
}

// ================= CLOSE POPUP =================
document.getElementById("closePopupBtn")?.addEventListener("click", closeNotePopup);

// ================= STORY EDIT =================
document.getElementById("storyEditBtn").addEventListener("click", () => {
  document.getElementById("storyTitleInput").focus();
});

// ================= ESC =================
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeNotePopup();
    closeChapterDrawer();
  }
});

// ================= BOOT =================
(async function boot() {
  try {
    await initApp();
  } catch (err) {
    console.error('Boot error:', err);
  } finally {
    const loader = document.getElementById('app-loading');
    if (loader) loader.style.display = 'none';
  }
})();
