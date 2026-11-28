/**
 * EAM Academy — Password-free Learner Profiles & Isolated Progress Store
 * Exclusive learners: Sainath, Bhavana, Bhargavi.
 * Supports isolated localStorage + optional Supabase REST sync (zero external SDKs).
 */
(function (global) {
  'use strict';

  const LEARNERS = [
    { id: 'sainath', name: 'Sainath', initials: 'SA', role: 'EAM Learner' },
    { id: 'bhavana', name: 'Bhavana', initials: 'BH', role: 'EAM Learner' },
    { id: 'bhargavi', name: 'Bhargavi', initials: 'BG', role: 'EAM Learner' },
  ];

  const ACTIVE_KEY = 'eam3:activeProfile';
  const PROFILE_KEYS = [
    'done', 'marks', 'notes', 'quiz', 'sqlhist', 'activity',
    'lastLesson', 'recentLessons', 'activePath', 'practiceSolved', 'realSolved',
    'practiceDrafts', 'lastExercise', 'dbBookmarks', 'dbLast', 'missedOnly',
    'resumeTask', 'workspaceDrafts', 'readingPositions'
  ];

  function getSupabaseConfig() {
    if (global.EAM_SUPABASE && global.EAM_SUPABASE.url && global.EAM_SUPABASE.anonKey) {
      return global.EAM_SUPABASE;
    }
    const urlMeta = document.querySelector('meta[name="supabase-url"]')?.content?.trim();
    const keyMeta = document.querySelector('meta[name="supabase-anon-key"]')?.content?.trim();
    if (urlMeta && keyMeta) return { url: urlMeta, anonKey: keyMeta };
    return null;
  }

  function validProfileId(id) {
    return LEARNERS.some(p => p.id === id) ? id : '';
  }

  function getActiveProfileId() {
    try {
      return validProfileId(localStorage.getItem(ACTIVE_KEY) || '');
    } catch {
      return '';
    }
  }

  function setActiveProfileId(id) {
    try {
      if (validProfileId(id)) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {}
  }

  function getActiveProfile() {
    const id = getActiveProfileId();
    return LEARNERS.find(p => p.id === id) || null;
  }

  function storageKey(profileId, key) {
    return `eam3:p:${profileId}:${key}`;
  }

  function readFor(profileId, key, fallback) {
    if (!profileId) return fallback;
    try {
      const raw = localStorage.getItem(storageKey(profileId, key));
      return raw === null ? fallback : (JSON.parse(raw) ?? fallback);
    } catch {
      return fallback;
    }
  }

  function writeFor(profileId, key, val) {
    if (!profileId) return;
    try {
      localStorage.setItem(storageKey(profileId, key), JSON.stringify(val));
      localStorage.setItem(storageKey(profileId, '_updatedAt'), new Date().toISOString());
    } catch {}
    scheduleSync(profileId);
  }

  function exportProfileSnapshot(profileId) {
    const state = {};
    for (const k of PROFILE_KEYS) {
      const v = readFor(profileId, k, undefined);
      if (v !== undefined) state[k] = v;
    }
    let updatedAt = '';
    try { updatedAt = localStorage.getItem(storageKey(profileId, '_updatedAt')) || ''; } catch {}
    return { profile_id: profileId, state, updated_at: updatedAt || new Date().toISOString() };
  }

  function importProfileSnapshot(profileId, state, updatedAt) {
    if (!profileId || !state || typeof state !== 'object') return;
    for (const k of PROFILE_KEYS) {
      if (k in state) {
        try { localStorage.setItem(storageKey(profileId, k), JSON.stringify(state[k])); } catch {}
      }
    }
    if (updatedAt) {
      try { localStorage.setItem(storageKey(profileId, '_updatedAt'), updatedAt); } catch {}
    }
  }

  function getProfileSummary(profileId, totalLessons) {
    const done = readFor(profileId, 'done', []);
    const act = new Set(readFor(profileId, 'activity', []));
    const quiz = readFor(profileId, 'quiz', {});
    const solved = readFor(profileId, 'practiceSolved', []);
    const realSolved = readFor(profileId, 'realSolved', []);
    const lastId = readFor(profileId, 'lastLesson', '');
    const d = new Date();
    const dayStr = dt => [dt.getFullYear(), String(dt.getMonth() + 1).padStart(2, '0'), String(dt.getDate()).padStart(2, '0')].join('-');
    if (!act.has(dayStr(d))) d.setDate(d.getDate() - 1);
    let streak = 0;
    while (act.has(dayStr(d))) { streak++; d.setDate(d.getDate() - 1); }
    const count = Array.isArray(done) ? done.length : 0;
    const pct = totalLessons ? Math.round((count / totalLessons) * 100) : 0;
    const quizCorrect = Object.values(quiz || {}).filter(v => v === true).length;
    return {
      completed: count,
      pct,
      streak,
      quizCorrect,
      solvedCount: Array.isArray(solved) ? solved.length : 0,
      realSolvedCount: Array.isArray(realSolved) ? realSolved.length : 0,
      lastLessonId: typeof lastId === 'string' ? lastId : '',
    };
  }

  // Optional Supabase REST sync (requires learner_profiles table)
  // SQL: create table learner_profiles (profile_id text primary key, state jsonb not null default '{}', updated_at timestamptz not null default now());
  const syncTimers = new Map();
  let syncStatus = getSupabaseConfig() ? 'Supabase ready' : 'Local profile storage';

  function scheduleSync(profileId) {
    const cfg = getSupabaseConfig();
    if (!cfg || !profileId) return;
    clearTimeout(syncTimers.get(profileId));
    syncTimers.set(profileId,setTimeout(()=>{syncTimers.delete(profileId);pushToSupabase(profileId,cfg);},600));
  }

  async function pushToSupabase(profileId, cfg = getSupabaseConfig()) {
    if (!cfg || !profileId) return;
    try {
      const payload = exportProfileSnapshot(profileId);
      const res = await fetch(`${cfg.url.replace(/\/$/, '')}/rest/v1/learner_profiles`, {
        method: 'POST',
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      });
      syncStatus = res.ok ? 'Synced via Supabase' : 'Local fallback (sync error)';
    } catch {
      syncStatus = 'Local fallback (offline)';
    }
  }

  async function pullFromSupabase(profileId, onHydrated) {
    const cfg = getSupabaseConfig();
    if (!cfg || !profileId) return false;
    try {
      const res = await fetch(
        `${cfg.url.replace(/\/$/, '')}/rest/v1/learner_profiles?profile_id=eq.${encodeURIComponent(profileId)}&select=state,updated_at`,
        {
          headers: {
            apikey: cfg.anonKey,
            Authorization: `Bearer ${cfg.anonKey}`,
          },
        }
      );
      if (!res.ok) return false;
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0] && rows[0].state) {
        let localUpdated = '';
        try { localUpdated = localStorage.getItem(storageKey(profileId, '_updatedAt')) || ''; } catch {}
        if (!localUpdated || (rows[0].updated_at && rows[0].updated_at > localUpdated)) {
          importProfileSnapshot(profileId, rows[0].state, rows[0].updated_at);
          syncStatus = 'Synced via Supabase';
          if (getActiveProfileId()===profileId && typeof onHydrated === 'function') onHydrated();
          return true;
        }
      }
      syncStatus = 'Synced via Supabase';
    } catch {
      syncStatus = 'Local fallback (offline)';
    }
    return false;
  }

  global.EAMProfiles = {
    LEARNERS,
    PROFILE_KEYS,
    getActiveProfileId,
    setActiveProfileId,
    getActiveProfile,
    readFor,
    writeFor,
    getProfileSummary,
    exportProfileSnapshot,
    importProfileSnapshot,
    pullFromSupabase,
    pushToSupabase,
    getSyncStatus: () => syncStatus,
  };
})(window);
