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
  if (!images || !Array.isArray(images) || images.length === 0) {
    return cleanCaption;
  }
  const tag = `<!--images:${JSON.stringify(images)}-->`;
  return cleanCaption ? `${cleanCaption}\n${tag}` : tag;
}

export function extractImagesFromCaption(rawCaption, existingImages = []) {
  if (!rawCaption || typeof rawCaption !== 'string') {
    return { caption: rawCaption || '', images: Array.isArray(existingImages) ? existingImages : [] };
  }
  const match = rawCaption.match(/<!--images:([\s\S]*?)-->/);
  let extractedImages = [];
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        extractedImages = parsed;
      }
    } catch (e) {}
  }
  const cleanCaption = rawCaption.replace(/<!--images:[\s\S]*?-->/g, '').trim();
  const finalImages = (extractedImages.length > 0)
    ? extractedImages
    : (Array.isArray(existingImages) ? existingImages : []);
  return { caption: cleanCaption, images: finalImages };
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

export async function deleteNoteFromSupabase(noteId, storyId = null) {
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
          if (!deletedIds.has(gn.id)) {
            await syncNoteToSupabase(gn, story.id, null);
          }
        }
      }
      if (story.chapters && Array.isArray(story.chapters)) {
        for (const ch of story.chapters) {
          await syncChapterToSupabase(ch, story.id);
          if (ch.notes && Array.isArray(ch.notes)) {
            for (const cn of ch.notes) {
              if (!deletedIds.has(cn.id)) {
                await syncNoteToSupabase(cn, story.id, ch.id);
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
        const localNote = (localChap?.notes || []).find(ln => ln.id === n.id);
        const { caption: cleanCaption, images: extractedImages } = extractImagesFromCaption(n.caption, localNote?.images || n.images);

        return {
          id: n.id,
          type: n.type || 'chapter',
          selectedText: n.selected_text || localNote?.selectedText || '',
          content: n.note_text || localNote?.content || '',
          images: extractedImages,
          caption: cleanCaption || localNote?.caption || '',
          source: n.source || localNote?.source || '',
          chapterId: ch.id,
          createdAt: n.created_at || localNote?.createdAt || new Date().toISOString()
        };
      });

      const rawContent = ch.content || localChap?.content || '';
      const cleanedContent = cleanStaleAnnotations(rawContent, validStoryNoteIds);

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
      const localNote = (localStoryMatch?.globalNotes || []).find(ln => ln.id === n.id);
      const { caption: cleanCaption, images: extractedImages } = extractImagesFromCaption(n.caption, localNote?.images || n.images);

      return {
        id: n.id,
        type: 'global',
        category: n.category || localNote?.category || 'Term',
        title: n.selected_text || localNote?.title || localNote?.selectedText || '',
        content: n.note_text || localNote?.content || '',
        selectedText: n.selected_text || localNote?.selectedText || localNote?.title || '',
        images: extractedImages,
        caption: cleanCaption || localNote?.caption || '',
        source: n.source || localNote?.source || '',
        keywords: [n.selected_text || localNote?.title || ''],
        chapterId: n.chapter_id || localNote?.chapterId || null,
        createdAt: n.created_at || localNote?.createdAt || new Date().toISOString()
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

  return mergedStories;
}
