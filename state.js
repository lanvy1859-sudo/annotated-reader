import { getSavedStoryThemes, saveStoryTheme } from './theme.js';

const SUPABASE_URL = 'https://elkdtrlumfghrsykqvty.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsa2R0cmx1bWZnaHJzeWtxdnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MzA3NTksImV4cCI6MjEwMzIwNjc1OX0.mZPwCV_lE2-0HozC8xAQ58pFtkbZK91eY62wAelXo6s';

export let _supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

let _authPromise = null;
export async function autoLogin() {
  if (!_supabase) return false;
  try {
    const { data: sessionData } = await _supabase.auth.getSession();
    if (sessionData?.session) {
      return true;
    }
  } catch (e) {}

  if (!_authPromise) {
    _authPromise = (async () => {
      try {
        const { error } = await _supabase.auth.signInWithPassword({
          email: 'lanvy1859@gmail.com',
          password: 'lanvy1402'
        });
        if (error) {
          console.warn('AutoLogin signIn error:', error.message);
          return false;
        }
        return true;
      } catch (err) {
        console.warn('AutoLogin exception:', err?.message || err);
        return false;
      } finally {
        setTimeout(() => { _authPromise = null; }, 5000);
      }
    })();
  }
  return await _authPromise;
}

export const STORAGE_KEY = "annotated_reader_v1";
export const NAV_STATE_KEY = "annotated_reader_nav";
export const THEME_KEY = "annotated_reader_theme";
export const ACTIVE_COLOR_KEY = "annotated_reader_active_color";
export const DELETED_NOTES_KEY = "annotated_reader_deleted_notes";

// ================= DELETED NOTE TOMBSTONES =================
export function getDeletedNoteIds() {
  try {
    const raw = localStorage.getItem(DELETED_NOTES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

export function addDeletedNoteId(id) {
  if (!id) return;
  try {
    const set = getDeletedNoteIds();
    set.add(id);
    localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify([...set]));
  } catch (e) {}
}

export function removeDeletedNoteId(id) {
  if (!id) return;
  try {
    const set = getDeletedNoteIds();
    set.delete(id);
    localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify([...set]));
  } catch (e) {}
}

// ================= ANNOTATION CLEANER =================
export function cleanStaleAnnotations(htmlContent, validNoteIds) {
  if (!htmlContent) return '';
  if (!htmlContent.includes('editor-annotation') && !htmlContent.includes('annotation') && !htmlContent.includes('data-note-id')) {
    return htmlContent;
  }
  const validSet = validNoteIds instanceof Set ? validNoteIds : new Set(validNoteIds || []);
  if (typeof document === 'undefined') return htmlContent;
  const temp = document.createElement('div');
  temp.innerHTML = htmlContent;
  let changed = false;
  temp.querySelectorAll('.editor-annotation, .annotation, [data-note-id]').forEach(el => {
    const noteId = el.dataset.noteId || el.getAttribute('data-note-id');
    if (!noteId || !validSet.has(noteId)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
        changed = true;
      }
    }
  });
  return changed ? temp.innerHTML : htmlContent;
}

// ================= IMAGE SYNC SERIALIZATION =================
export function embedImagesInCaption(caption, images) {
  const cleanCaption = (caption || '').replace(/<!--images:[\s\S]*?-->/g, '').trim();
  const imgs = Array.isArray(images) ? images : [];
  // Explicitly embed tag so all devices know whether images exist or are empty []
  const tag = `<!--images:${JSON.stringify(imgs)}-->`;
  return cleanCaption ? `${cleanCaption}\n${tag}` : tag;
}

export function extractImagesFromCaption(rawCaption, existingImages = []) {
  if (!rawCaption || typeof rawCaption !== 'string') {
    return { caption: rawCaption || '', images: [] };
  }
  const cleanCaption = rawCaption.replace(/<!--images:[\s\S]*?-->/g, '').trim();
  const match = rawCaption.match(/<!--images:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        return { caption: cleanCaption, images: parsed };
      }
    } catch (e) {}
  }
  // If no tag is found in the remote caption, there are no images on Supabase
  return { caption: cleanCaption, images: [] };
}

// ================= INDEXEDDB PERSISTENCE =================
const IDB_NAME = 'AnnotatedReaderDB';
const IDB_VERSION = 1;
const IDB_STORE = 'reader_state';

function openDB() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) return resolve(null);
    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

export async function saveStateToDB(state) {
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(state, 'current_state');
  } catch (e) {
    console.warn('IndexedDB save error:', e);
  }
}

export async function loadStateFromDB() {
  try {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get('current_state');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  } catch (e) {
    return null;
  }
}

// Image compression utility ensuring photos fit in storage without losing quality
export function compressImageFile(file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (!result || typeof result !== 'string') return resolve('');
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(result);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function dataURLToBlob(dataURL) {
  try {
    const parts = dataURL.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const b64 = parts[1].replace(/\s/g, '');
    const raw = window.atob(b64);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (e) {
    console.warn('dataURLToBlob error:', e);
    return null;
  }
}

export async function uploadImageToStorage(fileOrDataUrl, folder = 'notes', originalName = '') {
  if (!fileOrDataUrl) return '';
  // If it's already an HTTP / HTTPS link, return directly
  if (typeof fileOrDataUrl === 'string' && (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://'))) {
    return fileOrDataUrl;
  }

  try {
    let blob = null;
    let mime = 'image/jpeg';
    let ext = 'jpg';

    if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')) {
      try {
        const fetchRes = await fetch(fileOrDataUrl);
        blob = await fetchRes.blob();
        mime = blob.type || 'image/jpeg';
      } catch (fErr) {
        blob = dataURLToBlob(fileOrDataUrl);
        if (blob) mime = blob.type || 'image/jpeg';
      }
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
      blob = fileOrDataUrl;
      mime = blob.type || 'image/jpeg';
    }

    if (!blob) {
      console.warn('uploadImageToStorage: unable to create blob from input');
      return '';
    }

    if (mime.includes('png')) ext = 'png';
    else if (mime.includes('webp')) ext = 'webp';
    else if (mime.includes('gif')) ext = 'gif';
    else ext = 'jpg';

    const cleanBaseName = (originalName || 'img')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .slice(0, 30);
    const fileName = `${Date.now()}_${cleanBaseName || 'image'}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    // Upload directly using Supabase Storage REST endpoint with public anon key (SUPABASE_KEY)
    // The bucket 'reader-images' has public anon upload policy; passing anon Bearer avoids 403 RLS violation.
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/reader-images/${filePath}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': mime,
        'x-upsert': 'true'
      },
      body: blob
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Supabase storage upload error (HTTP ${res.status}):`, errText);
      return '';
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/reader-images/${filePath}`;
    return publicUrl;
  } catch (err) {
    console.warn('uploadImageToStorage exception:', err?.message || err);
    return '';
  }
}

export async function deleteImageFromStorage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return;
  try {
    if (imageUrl.includes('/storage/v1/object/public/reader-images/')) {
      const path = imageUrl.split('/storage/v1/object/public/reader-images/')[1];
      if (path) {
        const decodedPath = decodeURIComponent(path);
        await fetch(`${SUPABASE_URL}/storage/v1/object/reader-images`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prefixes: [decodedPath] })
        });
      }
    }
  } catch (err) {
    console.warn('deleteImageFromStorage error:', err);
  }
}

export function uid() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function createDemoStory() {
  const chapter1Id = uid();
  const chapter2Id = uid();
  return {
    id: uid(),
    title: "The Beginning",
    description: "A demo story with custom color theme support.",
    cover: "",
    themeColor: "#7654d8",
    chapters: [
      {
        id: chapter1Id,
        number: 1,
        title: "A Strange Beginning",
        content: `
          <p>Chen Liguo looked at the strange visitor standing in front of him. He wanted to say something, but the words did not come.</p>
          <p>The room was quiet for a moment before he finally smiled. This was the beginning of something he did not yet understand.</p>
          <p>The name <span class="editor-annotation chapter-note" data-note-id="demo-note" data-note-type="chapter">Zong Yan</span> appeared in the old document.</p>
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
          <p>Chen Liguo opened the old document carefully. Several unfamiliar terms had been written in the margins.</p>
          <p>One phrase caught his attention: <span class="editor-annotation chapter-note" data-note-id="demo-global" data-note-type="chapter">Zong Yan</span>.</p>
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

export function loadState() {
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

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("localStorage quota exceeded, saving to IndexedDB fallback:", e);
  }
  saveStateToDB(state);
}

export function restoreNavigationState() {
  try {
    const raw = localStorage.getItem(NAV_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function saveNavigationState(navState) {
  try {
    localStorage.setItem(NAV_STATE_KEY, JSON.stringify(navState));
  } catch (e) {}
}

export function clearNavigationState() {
  try {
    localStorage.removeItem(NAV_STATE_KEY);
  } catch (e) {}
}

// Synchronously determine the active startup theme before any async requests
export function getSynchronousStartupTheme() {
  try {
    const nav = restoreNavigationState();
    const savedThemeMode = localStorage.getItem(THEME_KEY) || "light";
    const isDark = savedThemeMode === "dark";
    const activeColor = localStorage.getItem(ACTIVE_COLOR_KEY) || '#7654d8';

    if (!nav || nav.view === 'libraryView' || !nav.storyId) {
      return {
        themeColor: activeColor,
        isDark,
        isLibrary: true
      };
    }

    const themeMap = getSavedStoryThemes();
    if (themeMap[nav.storyId]) {
      return {
        themeColor: themeMap[nav.storyId],
        isDark,
        isLibrary: false
      };
    }

    const localState = loadState();
    const story = (localState.stories || []).find(s => s.id === nav.storyId);
    if (story && story.themeColor) {
      return {
        themeColor: story.themeColor,
        isDark,
        isLibrary: false
      };
    }

    return {
      themeColor: activeColor,
      isDark,
      isLibrary: false
    };
  } catch (e) {
    return { themeColor: '#7654d8', isDark: false, isLibrary: true };
  }
}

export function embedThemeInDescription(description, themeColor) {
  const clean = (description || '').replace(/<!--theme:#[0-9a-fA-F]{3,8}-->/g, '').trim();
  if (!themeColor) return clean;
  return clean ? `${clean}\n<!--theme:${themeColor}-->` : `<!--theme:${themeColor}-->`;
}

export function extractThemeAndCleanDescription(rawDescription) {
  if (!rawDescription) return { description: '', themeColor: null };
  const match = rawDescription.match(/<!--theme:(#[0-9a-fA-F]{3,8})-->/);
  const themeColor = match ? match[1] : null;
  const description = rawDescription.replace(/<!--theme:#[0-9a-fA-F]{3,8}-->/g, '').trim();
  return { description, themeColor };
}

export async function syncStoryThemeToSupabase(storyId, themeColor, rawDescription = '') {
  if (!_supabase) return false;
  try {
    await autoLogin();
    const { description } = extractThemeAndCleanDescription(rawDescription);
    const descWithTag = embedThemeInDescription(description, themeColor);

    const { error } = await _supabase.from('stories').update({
      theme_color: themeColor,
      description: descWithTag,
      updated_at: new Date().toISOString()
    }).eq('id', storyId);

    if (error) {
      console.warn("Falling back to description-embedded theme sync:", error.message);
      const res = await _supabase.from('stories').update({
        description: descWithTag,
        updated_at: new Date().toISOString()
      }).eq('id', storyId);
      return !res.error;
    }
    return true;
  } catch (err) {
    console.warn("syncStoryThemeToSupabase exception:", err);
    return false;
  }
}

export async function syncNoteToSupabase(note, storyId, chapterId = null) {
  if (!_supabase || !note || !storyId) return false;
  try {
    await autoLogin();
    removeDeletedNoteId(note.id);
    const effectiveChapterId = (note.type === 'global') ? (note.chapterId || null) : (chapterId || note.chapterId || null);

    // Auto-convert any base64 images to Supabase Storage links
    if (note.images && Array.isArray(note.images)) {
      let imagesUpdated = false;
      for (let i = 0; i < note.images.length; i++) {
        const img = note.images[i];
        if (typeof img === 'string' && img.startsWith('data:image/')) {
          const uploadedUrl = await uploadImageToStorage(img, 'notes', `note_${note.id}_${i}`);
          if (uploadedUrl && (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://'))) {
            note.images[i] = uploadedUrl;
            imagesUpdated = true;
          }
        }
      }
      if (imagesUpdated) {
        try {
          const localState = loadState();
          let matched = false;
          (localState.stories || []).forEach(s => {
            (s.globalNotes || []).forEach(gn => {
              if (gn.id === note.id) { gn.images = [...note.images]; matched = true; }
            });
            (s.chapters || []).forEach(ch => {
              (ch.notes || []).forEach(cn => {
                if (cn.id === note.id) { cn.images = [...note.images]; matched = true; }
              });
            });
          });
          if (matched) saveState(localState);
        } catch (e) {}
      }
    }

    const rawCaption = embedImagesInCaption(note.caption, note.images);
    const payload = {
      id: note.id,
      story_id: storyId,
      chapter_id: effectiveChapterId,
      type: note.type || 'chapter',
      selected_text: note.selectedText || note.title || '',
      note_text: note.content || '',
      caption: rawCaption,
      source: note.source || '',
      updated_at: new Date().toISOString()
    };
    if (note.createdAt) {
      payload.created_at = note.createdAt;
    }

    const { error } = await _supabase.from('notes').upsert(payload);
    if (error) {
      console.warn('syncNoteToSupabase upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('syncNoteToSupabase exception:', err?.message || err);
    return false;
  }
}

export async function syncChapterToSupabase(chapter, storyId) {
  if (!_supabase || !chapter || !storyId) return false;
  try {
    await autoLogin();
    const { error } = await _supabase.from('chapters').upsert({
      id: chapter.id,
      story_id: storyId,
      title: chapter.title || '',
      content: chapter.content || '',
      chapter_order: chapter.number,
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.warn('syncChapterToSupabase error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('syncChapterToSupabase exception:', err?.message || err);
    return false;
  }
}

export async function deleteNoteFromSupabase(noteId, storyId = null, images = []) {
  if (!_supabase || !noteId) return false;
  addDeletedNoteId(noteId);
  try {
    await autoLogin();
    const query = _supabase.from('notes').delete().eq('id', noteId);
    if (storyId) query.eq('story_id', storyId);
    const { error } = await query;
    if (error) {
      console.warn('deleteNoteFromSupabase error:', error.message);
      return false;
    }
    if (Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (typeof img === 'string' && img.includes('/reader-images/notes/')) {
          deleteImageFromStorage(img);
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('deleteNoteFromSupabase exception:', err?.message || err);
    return false;
  }
}

export async function syncPendingLocalDataToSupabase(currentState) {
  if (!_supabase || !currentState || !Array.isArray(currentState.stories)) return;
  try {
    await autoLogin();
    const deletedIds = getDeletedNoteIds();
    for (const story of currentState.stories) {
      if (story.globalNotes && Array.isArray(story.globalNotes)) {
        for (const gn of story.globalNotes) {
          if (gn._isOfflinePending && !deletedIds.has(gn.id)) {
            const ok = await syncNoteToSupabase(gn, story.id, null);
            if (ok) delete gn._isOfflinePending;
          }
        }
      }
      if (story.chapters && Array.isArray(story.chapters)) {
        for (const ch of story.chapters) {
          if (ch._isOfflinePending) {
            const ok = await syncChapterToSupabase(ch, story.id);
            if (ok) delete ch._isOfflinePending;
          }
          if (ch.notes && Array.isArray(ch.notes)) {
            for (const cn of ch.notes) {
              if (cn._isOfflinePending && !deletedIds.has(cn.id)) {
                const ok = await syncNoteToSupabase(cn, story.id, ch.id);
                if (ok) delete cn._isOfflinePending;
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('syncPendingLocalDataToSupabase error:', e?.message || e);
  }
}

export async function fetchStoriesFromSupabase() {
  if (!_supabase) return null;
  try {
    await autoLogin();
  } catch (e) {}
  const fetchWithTimeout = async (promise, ms = 8000) => {
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

  let storiesRes, chaptersRes, notesRes;
  try {
    storiesRes = await fetchWithTimeout(
      _supabase.from('stories').select('*').order('created_at', { ascending: true })
    );
    if (storiesRes?.error) throw storiesRes.error;
    if (!storiesRes?.data || storiesRes.data.length === 0) return null;

    chaptersRes = await fetchWithTimeout(
      _supabase.from('chapters').select('*').order('chapter_order', { ascending: true })
    );
    notesRes = await fetchWithTimeout(
      _supabase.from('notes').select('*').order('created_at', { ascending: true })
    );
  } catch (err) {
    console.warn("Supabase fetch failed, fallback to local:", err?.message || err);
    return null;
  }

  const stories = storiesRes.data;
  const chapters = chaptersRes?.data || [];
  let notes = notesRes?.data || [];

  const deletedIds = getDeletedNoteIds();
  // Filter out any tombstoned notes that might still exist on server
  if (deletedIds.size > 0) {
    const toDeleteRemote = notes.filter(n => deletedIds.has(n.id));
    if (toDeleteRemote.length > 0) {
      notes = notes.filter(n => !deletedIds.has(n.id));
      for (const n of toDeleteRemote) {
        _supabase.from('notes').delete().eq('id', n.id).then();
      }
    }
  }

  const savedThemeMap = getSavedStoryThemes();
  const localFallbackState = (await loadStateFromDB()) || loadState();

  const mergedStories = stories.map(story => {
    const storyChapters = chapters.filter(c => c.story_id === story.id);
    const storyNotes = notes.filter(n => n.story_id === story.id);
    const globalNotes = storyNotes.filter(n => n.type === 'global');

    const chapterNotesMap = {};
    storyChapters.forEach(ch => {
      chapterNotesMap[ch.id] = storyNotes.filter(n => n.chapter_id === ch.id && n.type !== 'global');
    });

    const localStoryMatch = (localFallbackState.stories || []).find(s => s.id === story.id);
    const validStoryNoteIds = new Set(storyNotes.map(n => n.id));

    const chapterObjects = storyChapters.map(ch => {
      const localChap = (localStoryMatch?.chapters || []).find(c => c.id === ch.id);
      const remoteChapterNotes = (chapterNotesMap[ch.id] || []).map(n => {
        const { caption: cleanCaption, images: extractedImages } = extractImagesFromCaption(n.caption);

        return {
          id: n.id,
          type: n.type || 'chapter',
          selectedText: n.selected_text || '',
          content: n.note_text || '',
          images: extractedImages,
          caption: cleanCaption || '',
          source: n.source || '',
          chapterId: ch.id,
          createdAt: n.created_at || new Date().toISOString()
        };
      });

      const rawContent = ch.content || localChap?.content || '';
      const cleanedContent = cleanStaleAnnotations(rawContent, validStoryNoteIds);

      // If chapter content on Supabase had stale annotations that were cleaned, sync cleaned content back to Supabase
      if (ch.content && rawContent !== cleanedContent) {
        ch.content = cleanedContent;
        syncChapterToSupabase({ id: ch.id, title: ch.title, content: cleanedContent, number: ch.chapter_order }, story.id).catch(e => console.warn('Sync cleaned chapter content error:', e));
      }

      return {
        id: ch.id,
        number: ch.chapter_order,
        title: ch.title,
        content: cleanedContent,
        notes: remoteChapterNotes
      };
    });

    // Also preserve any locally created chapters
    if (localStoryMatch?.chapters && Array.isArray(localStoryMatch.chapters)) {
      localStoryMatch.chapters.forEach(lch => {
        if (!chapterObjects.some(co => co.id === lch.id)) {
          chapterObjects.push(lch);
        }
      });
    }

    const globalNoteObjects = globalNotes.map(n => {
      const { caption: cleanCaption, images: extractedImages } = extractImagesFromCaption(n.caption);

      return {
        id: n.id,
        type: 'global',
        category: n.category || 'Term',
        title: n.selected_text || '',
        content: n.note_text || '',
        selectedText: n.selected_text || '',
        images: extractedImages,
        caption: cleanCaption || '',
        source: n.source || '',
        keywords: [n.selected_text || ''],
        chapterId: n.chapter_id || null,
        createdAt: n.created_at || new Date().toISOString()
      };
    });

    const { description: cleanDesc, themeColor: embeddedTheme } = extractThemeAndCleanDescription(story.description);
    const persistentTheme = story.theme_color || embeddedTheme || savedThemeMap[story.id] || localStoryMatch?.themeColor || '#7654d8';
    saveStoryTheme(story.id, persistentTheme);

    return {
      id: story.id,
      title: story.title,
      description: cleanDesc || localStoryMatch?.description || '',
      cover: story.cover_url || localStoryMatch?.cover || '',
      themeColor: persistentTheme,
      chapters: chapterObjects,
      globalNotes: globalNoteObjects
    };
  });

  // Preserve local-only stories if any
  if (localFallbackState?.stories && Array.isArray(localFallbackState.stories)) {
    localFallbackState.stories.forEach(ls => {
      if (!mergedStories.some(ms => ms.id === ls.id)) {
        mergedStories.push(ls);
      }
    });
  }

  // Trigger background migration for any lingering Base64 images to Supabase Storage links
  setTimeout(() => {
    migrateAllBase64ImagesToStorage(mergedStories).catch(e => console.warn('Background migration error:', e));
  }, 200);

  return mergedStories;
}

export async function migrateAllBase64ImagesToStorage(stories) {
  if (!_supabase || !Array.isArray(stories)) return;
  try {
    let hasChanges = false;
    for (const story of stories) {
      if (story.cover && typeof story.cover === 'string' && story.cover.startsWith('data:image/')) {
        const publicUrl = await uploadImageToStorage(story.cover, 'covers', `cover_${story.id}`);
        if (publicUrl && (publicUrl.startsWith('http://') || publicUrl.startsWith('https://'))) {
          story.cover = publicUrl;
          await _supabase.from('stories').update({ cover_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', story.id);
          hasChanges = true;
        }
      }

      for (const gn of (story.globalNotes || [])) {
        if (gn.images && Array.isArray(gn.images)) {
          let noteChanged = false;
          for (let i = 0; i < gn.images.length; i++) {
            if (typeof gn.images[i] === 'string' && gn.images[i].startsWith('data:image/')) {
              const publicUrl = await uploadImageToStorage(gn.images[i], 'notes', `gn_${gn.id}_${i}`);
              if (publicUrl && (publicUrl.startsWith('http://') || publicUrl.startsWith('https://'))) {
                gn.images[i] = publicUrl;
                noteChanged = true;
                hasChanges = true;
              }
            }
          }
          if (noteChanged) {
            await syncNoteToSupabase(gn, story.id, null);
          }
        }
      }

      for (const ch of (story.chapters || [])) {
        for (const cn of (ch.notes || [])) {
          if (cn.images && Array.isArray(cn.images)) {
            let noteChanged = false;
            for (let i = 0; i < cn.images.length; i++) {
              if (typeof cn.images[i] === 'string' && cn.images[i].startsWith('data:image/')) {
                const publicUrl = await uploadImageToStorage(cn.images[i], 'notes', `cn_${cn.id}_${i}`);
                if (publicUrl && (publicUrl.startsWith('http://') || publicUrl.startsWith('https://'))) {
                  cn.images[i] = publicUrl;
                  noteChanged = true;
                  hasChanges = true;
                }
              }
            }
            if (noteChanged) {
              await syncNoteToSupabase(cn, story.id, ch.id);
            }
          }
        }
      }
    }

    if (hasChanges) {
      try {
        const localState = loadState();
        localState.stories = stories;
        saveState(localState);
      } catch (e) {}
    }
  } catch (err) {
    console.warn('migrateAllBase64ImagesToStorage error:', err);
  }
}
