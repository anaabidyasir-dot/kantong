/* Kantong Supabase client and per-user cloud data access. */
(() => {
  'use strict';
  const config = window.KANTONG_SUPABASE_CONFIG || {};
  const url = String(config.url || '').trim();
  const key = String(config.publishableKey || '').trim();
  const ready = !!url && /^https:\/\//.test(url) &&
    !!key && !key.includes('PASTE_YOUR_') &&
    window.supabase && typeof window.supabase.createClient === 'function';

  if (!ready) {
    window.KantongCloud = {
      configured: false,
      isAuthenticated: () => false,
      setupMessage: 'Konfigurasi Supabase belum lengkap. Isi Project URL dan Publishable key di supabase-config.js.'
    };
    return;
  }

  const client = window.supabase.createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    realtime: { params: { eventsPerSecond: 5 } }
  });

  const getUser = async () => {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
    return data.user;
  };

  const parseJSON = value => {
    try { return JSON.parse(value); } catch (_) { return null; }
  };
  const localFinanceKey = userId => 'kantong.v1.user.' + userId;
  const hasFinance = value => !!value && typeof value === 'object' &&
    ['tx', 'bud', 'goals', 'debts', 'tasks'].some(k =>
      Array.isArray(value[k]) ? value[k].length > 0 :
      value[k] && typeof value[k] === 'object' ? Object.keys(value[k]).length > 0 : false
    ) || !!(value && value.next);

  let saveTimer = null;
  let pendingFinance = null;
  let saveWaiters = [];

  async function flushFinance() {
    if (!pendingFinance) return;
    const snapshot = pendingFinance;
    const waiters = saveWaiters.slice();
    pendingFinance = null;
    saveWaiters = [];
    try {
      const user = await getUser();
      const { error } = await client.from('user_data').upsert({
        user_id: user.id,
        data: snapshot,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) throw error;
      waiters.forEach(w => w.resolve());
    } catch (error) {
      if (!pendingFinance) pendingFinance = snapshot;
      waiters.forEach(w => w.reject(error));
      throw error;
    }
  }

  async function loadFinance(initialData) {
    const user = await getUser();
    const keyName = localFinanceKey(user.id);
    const cached = parseJSON(localStorage.getItem(keyName));
    const { data, error } = await client
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;

    if (data && data.data) {
      localStorage.setItem(keyName, JSON.stringify(data.data));
      return data.data;
    }

    let initial = cached || null;
    if (!initial) {
      const legacy = parseJSON(localStorage.getItem('kantong.v1')) || initialData;
      if (hasFinance(legacy)) {
        const shouldImport = window.confirm(
          'Ditemukan data Kantong lama di browser ini. Pindahkan data lama ke akun yang sedang digunakan?\n\nPilih "Batal" bila data tersebut bukan milik akun ini.'
        );
        if (shouldImport) initial = legacy;
      }
    }

    if (!initial) initial = { tx: [], bud: {}, goals: [], debts: [], tasks: [], next: '' };
    const { error: insertError } = await client.from('user_data').upsert({
      user_id: user.id,
      data: initial,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (insertError) throw insertError;
    localStorage.setItem(keyName, JSON.stringify(initial));
    return initial;
  }

  function saveFinance(data) {
    const userId = window.KANTONG_CURRENT_USER && window.KANTONG_CURRENT_USER.id;
    if (!userId) return Promise.reject(new Error('Tidak ada pengguna yang sedang login.'));
    const snapshot = JSON.parse(JSON.stringify(data));
    localStorage.setItem(localFinanceKey(userId), JSON.stringify(snapshot));
    pendingFinance = snapshot;
    if (saveTimer) clearTimeout(saveTimer);
    const promise = new Promise((resolve, reject) => saveWaiters.push({ resolve, reject }));
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flushFinance().catch(error => {
        console.error('Kantong cloud save failed:', error);
        window.dispatchEvent(new CustomEvent('kantong-cloud-error', { detail: { message: error.message } }));
      });
    }, 300);
    return promise;
  }

  function subscribeFinance(onChange) {
    const userId = window.KANTONG_CURRENT_USER && window.KANTONG_CURRENT_USER.id;
    if (!userId) return null;
    return client.channel('kantong-finance-' + userId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_data',
        filter: 'user_id=eq.' + userId
      }, payload => {
        if (payload.new && payload.new.data) onChange(payload.new.data, payload.new.updated_at);
      })
      .subscribe();
  }

  const dateToMs = value => value ? new Date(value).getTime() : Date.now();
  function mapMySpace(row) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      subject: row.subject || '',
      content: row.content || '',
      filePath: row.file_path || '',
      fileName: row.file_name || '',
      mime: row.mime || '',
      size: Number(row.size || 0),
      createdAt: dateToMs(row.created_at),
      updatedAt: dateToMs(row.updated_at),
      blob: null
    };
  }

  async function listMySpace() {
    const user = await getUser();
    const { data, error } = await client.from('myspace_items')
      .select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapMySpace);
  }

  const safeFileName = value => String(value || 'file')
    .normalize('NFKD').replace(/[^a-zA-Z0-9._()-]+/g, '_').slice(-100) || 'file';

  async function saveMySpace(item) {
    const user = await getUser();
    let filePath = item.filePath || null;
    if (item.type === 'material' && item.blob) {
      filePath = user.id + '/' + item.id + '/' + safeFileName(item.fileName);
      const { error: uploadError } = await client.storage.from('myspace').upload(
        filePath, item.blob, {
          upsert: true,
          contentType: item.mime,
          cacheControl: '3600'
        }
      );
      if (uploadError) throw uploadError;
    }

    const row = {
      user_id: user.id,
      id: String(item.id),
      type: item.type,
      title: String(item.title).slice(0, 120),
      subject: String(item.subject || '').slice(0, 80),
      content: item.type === 'note' ? String(item.content || '') : null,
      file_path: item.type === 'material' ? filePath : null,
      file_name: item.type === 'material' ? String(item.fileName || '') : null,
      mime: item.type === 'material' ? String(item.mime || '') : null,
      size: item.type === 'material' ? Number(item.size || 0) : 0,
      created_at: new Date(item.createdAt || Date.now()).toISOString(),
      updated_at: new Date(item.updatedAt || Date.now()).toISOString()
    };
    const { error } = await client.from('myspace_items')
      .upsert(row, { onConflict: 'user_id,id' });
    if (error) throw error;
    return Object.assign({}, item, { filePath, blob: null });
  }

  async function deleteMySpace(item) {
    const user = await getUser();
    const id = typeof item === 'string' ? item : item.id;
    const path = typeof item === 'object' && item ? item.filePath : null;
    if (path) {
      const { error: storageError } = await client.storage.from('myspace').remove([path]);
      if (storageError) throw storageError;
    }
    const { error } = await client.from('myspace_items')
      .delete().eq('user_id', user.id).eq('id', id);
    if (error) throw error;
  }

  async function createMySpaceSignedUrl(path) {
    const { data, error } = await client.storage.from('myspace').createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }

  window.KantongCloud = {
    configured: true,
    client,
    isAuthenticated: () => !!window.KANTONG_CURRENT_USER,
    getUser,
    loadFinance,
    saveFinance,
    subscribeFinance,
    flushFinance,
    listMySpace,
    saveMySpace,
    deleteMySpace,
    createMySpaceSignedUrl
  };

  window.addEventListener('online', () => {
    if (pendingFinance) flushFinance().catch(error => console.error(error));
  });
})();
