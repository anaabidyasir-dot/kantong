/* Kantong MySpace — materi dan catatan tersimpan lokal melalui IndexedDB. */
(() => {
  'use strict';
  const DB_NAME = 'kantong-myspace-v1';
  const STORE = 'items';
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  let dbPromise = null;

  function el(tag, attrs, ...children) {
    const element = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'className') element.className = value;
      else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'value' || key === 'checked' || key === 'disabled') element[key] = value;
      else element.setAttribute(key, String(value));
    });
    children.flat(Infinity).forEach(child => {
      if (child === null || child === undefined || child === false) return;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return element;
  }

  function openDB() {
    if (!window.indexedDB) return Promise.reject(new Error('Browser ini tidak mendukung IndexedDB.'));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Penyimpanan MySpace tidak dapat dibuka.'));
        request.onblocked = () => reject(new Error('Tutup tab Kantong lain, lalu coba lagi.'));
      }).catch(error => { dbPromise = null; throw error; });
    }
    return dbPromise;
  }

  async function getAllLocal() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Gagal membaca MySpace.'));
    });
  }

  async function saveLocalItem(item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Gagal menyimpan cadangan MySpace lokal.'));
      tx.onabort = () => reject(tx.error || new Error('Penyimpanan dibatalkan.'));
    });
  }

  async function removeLocalItem(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Gagal menghapus item lokal.'));
    });
  }

  function cloudEnabled() {
    return !!(window.KantongCloud && window.KantongCloud.configured && window.KantongCloud.isAuthenticated());
  }

  async function getAll() {
    if (cloudEnabled()) {
      let cloudItems = await window.KantongCloud.listMySpace();
      if (!cloudItems.length) {
        const localItems = await getAllLocal();
        if (localItems.length && window.confirm(
          'Ditemukan ' + localItems.length + ' item MySpace lama di browser ini. Pindahkan ke akun yang sedang login?\n\nPilih "Batal" jika file/catatan ini bukan milik akun tersebut.'
        )) {
          for (const item of localItems) await window.KantongCloud.saveMySpace(item);
          cloudItems = await window.KantongCloud.listMySpace();
          notify('MySpace lama berhasil dipindahkan ke akun cloud. Salinan lokal tetap disimpan sebagai cadangan.');
        }
      }
      return cloudItems;
    }
    return getAllLocal();
  }

  async function saveItem(item) {
    if (cloudEnabled()) {
      const saved = await window.KantongCloud.saveMySpace(item);
      try { await saveLocalItem(item); }
      catch (error) { console.warn('MySpace local backup was not updated:', error); }
      return saved;
    }
    await saveLocalItem(item);
    return item;
  }

  async function removeItem(id, item) {
    if (cloudEnabled()) await window.KantongCloud.deleteMySpace(item || id);
    await removeLocalItem(id);
  }

  const uid = () => window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'ms-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const dateText = value => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const sizeText = bytes => bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB';
  const notify = message => {
    const toast = document.querySelector('#toast');
    if (!toast) { window.alert(message); return; }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => { toast.hidden = true; }, 3000);
  };
  const field = (label, input, hint) => el('label', { className: 'ms-field' }, el('span', {}, label), input, hint ? el('small', { className: 'ms-hint' }, hint) : null);
  const button = (label, cls, onClick) => el('button', { type: 'button', className: cls, onClick: onClick }, label);

  async function openRecord(item, refresh) {
    const dialog = el('dialog', { className: 'ms-dialog' });
    let objectUrl = null;
    const close = () => { if (dialog.open) dialog.close(); else dialog.remove(); };
    const header = title => el('div', { className: 'ms-dialog-head' }, el('h2', {}, title), button('×', 'ms-close', close));
    const actions = (...items) => el('div', { className: 'ms-dialog-actions' }, ...items);

    function showNote() {
      const details = 'Dibuat ' + dateText(item.createdAt) + (item.updatedAt !== item.createdAt ? ' · Diedit ' + dateText(item.updatedAt) : '');
      dialog.replaceChildren(
        header(item.title),
        el('div', { className: 'ms-dialog-body' },
          el('p', { className: 'ms-dialog-meta' }, (item.subject ? item.subject + ' · ' : '') + details),
          el('div', { className: 'ms-note-content' }, item.content)
        ),
        actions(button('Tutup', 'btn ghost', close), button('Edit catatan', 'btn', editNote))
      );
    }

    function editNote() {
      const title = el('input', { required: true, maxlength: 120, value: item.title });
      const subject = el('input', { maxlength: 80, value: item.subject || '', placeholder: 'Contoh: Pemrograman Dasar' });
      const content = el('textarea', { rows: 14, required: true, placeholder: 'Tulis catatanmu di sini...' });
      content.value = item.content || '';
      let form;
      form = el('form', { className: 'ms-note-editor', onSubmit: async event => {
        event.preventDefault();
        if (!title.value.trim() || !content.value.trim()) return notify('Judul dan isi catatan tidak boleh kosong.');
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        item.title = title.value.trim();
        item.subject = subject.value.trim();
        item.content = content.value;
        item.updatedAt = Date.now();
        try {
          await saveItem(item);
          close();
          await refresh();
          notify('Catatan berhasil diperbarui.');
        } catch (error) {
          submit.disabled = false;
          notify(error.message || 'Catatan gagal disimpan.');
        }
      }},
        field('Judul catatan', title),
        field('Mata kuliah (opsional)', subject),
        field('Isi catatan', content, 'Catatan panjang tetap tersimpan. Gunakan paragraf agar mudah dibaca.'),
        actions(button('Batal', 'btn ghost', showNote), el('button', { type: 'submit', className: 'btn' }, 'Simpan perubahan'))
      );
      dialog.replaceChildren(header('Edit catatan'), form);
    }

    if (item.type === 'note') showNote();
    else {
      try {
        if (item.blob) objectUrl = URL.createObjectURL(item.blob);
        else if (item.filePath && cloudEnabled()) objectUrl = await window.KantongCloud.createMySpaceSignedUrl(item.filePath);
        else throw new Error('File tidak ditemukan. Coba unggah ulang dari perangkat asal.');
        let preview;
        if (item.mime.startsWith('image/')) preview = el('img', { className: 'ms-preview-image', src: objectUrl, alt: item.title });
        else if (item.mime.startsWith('video/')) preview = el('video', { className: 'ms-preview-video', src: objectUrl, controls: true, playsinline: true });
        else preview = el('iframe', { className: 'ms-preview-pdf', src: objectUrl, title: 'Pratinjau ' + item.title });
        dialog.replaceChildren(
          header(item.title),
          el('div', { className: 'ms-preview-wrap' }, preview),
          el('p', { className: 'ms-dialog-meta' }, item.fileName + ' · ' + sizeText(item.size) + ' · Ditambahkan ' + dateText(item.createdAt)),
          actions(el('a', { className: 'btn ghost', href: objectUrl, download: item.fileName }, 'Unduh file'), button('Tutup', 'btn', close))
        );
      } catch (error) {
        dialog.replaceChildren(header(item.title), el('p', { className: 'ms-error' }, error.message || 'File tidak dapat dibuka.'), actions(button('Tutup', 'btn', close)));
        notify(error.message || 'File tidak dapat dibuka.');
      }
    }
    dialog.addEventListener('close', () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      dialog.remove();
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
  }

  function acceptedMime(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    const extensions = {
      pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm',
      mov: 'video/quicktime'
    };
    const mime = file.type || extensions[ext] || '';
    if (mime === 'application/pdf' || ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'].includes(mime)) return mime;
    return '';
  }

  window.renderMySpace = function renderMySpace() {
    const page = el('div', { className: 'myspace-page' });
    const tabs = el('div', { className: 'ms-tabs', role: 'tablist', 'aria-label': 'Jenis konten MySpace' });
    const search = el('input', { type: 'search', placeholder: 'Cari judul atau mata kuliah...', 'aria-label': 'Cari materi atau catatan' });
    const panel = el('div', { className: 'ms-panel' });
    const info = el('p', { className: 'ms-local-note' }, cloudEnabled()
      ? 'MySpace tersinkron ke akun Kantong. File disimpan privat dan hanya dapat dibuka oleh akunmu. Salinan lokal pada browser ini dipertahankan sebagai cadangan.'
      : 'Penyimpanan lokal: file dan catatan tersimpan di browser serta perangkat ini. Data belum tersinkron ke perangkat lain.');
    let active = 'material';
    let records = [];

    function filtered(type) {
      const query = search.value.trim().toLocaleLowerCase('id-ID');
      return records.filter(item => item.type === type && (!query || (item.title + ' ' + (item.subject || '')).toLocaleLowerCase('id-ID').includes(query))).sort((a, b) => b.updatedAt - a.updatedAt);
    }
    async function refresh() {
      try {
        records = await getAll();
        info.textContent = cloudEnabled()
          ? 'MySpace tersinkron ke akun Kantong. File disimpan privat dan hanya dapat dibuka oleh akunmu. Salinan lokal pada browser ini dipertahankan sebagai cadangan.'
          : 'Penyimpanan lokal: file dan catatan tersimpan di browser serta perangkat ini. Data belum tersinkron ke perangkat lain.';
        renderPanel();
      } catch (error) {
        panel.replaceChildren(el('div', { className: 'ms-error' }, el('b', {}, 'MySpace belum bisa dibuka'), el('p', {}, error.message), button('Coba lagi', 'btn', refresh)));
      }
    }
    async function deleteRecord(item) {
      if (!window.confirm('Hapus "' + item.title + '"?')) return;
      try { await removeItem(item.id, item); await refresh(); notify('Item berhasil dihapus.'); }
      catch (error) { notify(error.message || 'Item gagal dihapus.'); }
    }
    const empty = (title, description) => el('div', { className: 'ms-empty' }, el('span', { className: 'ms-empty-icon' }, '✦'), el('b', {}, title), el('p', {}, description));

    function materialCard(item) {
      const type = item.mime === 'application/pdf' ? 'pdf' : item.mime.startsWith('video/') ? 'video' : 'gambar';
      const icon = type === 'pdf' ? 'PDF' : type === 'video' ? '▶' : '▧';
      return el('article', { className: 'ms-item-card' },
        el('div', { className: 'ms-file-icon ' + type }, icon),
        el('div', { className: 'ms-item-main' },
          el('button', { type: 'button', className: 'ms-item-title', onClick: () => openRecord(item, refresh) }, item.title),
          item.subject ? el('span', { className: 'ms-subject' }, item.subject) : null,
          el('small', { className: 'ms-item-meta' }, item.fileName + ' · ' + sizeText(item.size)),
          el('small', { className: 'ms-item-date' }, 'Ditambahkan ' + dateText(item.createdAt))
        ),
        el('div', { className: 'ms-item-actions' }, button('Buka', 'btn ghost', () => openRecord(item, refresh)), button('Hapus', 'ms-delete', () => deleteRecord(item)))
      );
    }

    function noteCard(item) {
      const dates = 'Dibuat ' + dateText(item.createdAt) + (item.updatedAt !== item.createdAt ? ' · Diedit ' + dateText(item.updatedAt) : '');
      return el('article', { className: 'ms-note-card' },
        el('button', { type: 'button', className: 'ms-note-open', onClick: () => openRecord(item, refresh) },
          el('span', { className: 'ms-note-symbol', 'aria-hidden': 'true' }, '✎'),
          el('span', { className: 'ms-note-text' }, el('b', {}, item.title), item.subject ? el('small', {}, item.subject) : null, el('small', { className: 'ms-item-date' }, dates)),
          el('span', { className: 'ms-note-arrow', 'aria-hidden': 'true' }, '›')
        ),
        button('Hapus', 'ms-delete', () => deleteRecord(item))
      );
    }

    function materialPanel() {
      const title = el('input', { required: true, maxlength: 120, placeholder: 'Contoh: Materi Pengantar Algoritma' });
      const subject = el('input', { maxlength: 80, placeholder: 'Contoh: Pemrograman Dasar' });
      const file = el('input', { type: 'file', required: true, accept: '.pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,application/pdf,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime' });
      let form;
      form = el('form', { className: 'ms-form-card', onSubmit: async event => {
        event.preventDefault();
        const selected = file.files && file.files[0];
        if (!selected) return notify('Pilih file PDF, gambar, atau video terlebih dahulu.');
        const mime = acceptedMime(selected);
        if (!mime) return notify('Format belum didukung. Gunakan PDF, JPG, PNG, GIF, WEBP, MP4, WEBM, atau MOV.');
        if (selected.size > MAX_FILE_SIZE) return notify('Ukuran file maksimal 100 MB per file.');
        if (!title.value.trim()) return notify('Judul materi wajib diisi.');
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        const now = Date.now();
        try {
          await saveItem({ id: uid(), type: 'material', title: title.value.trim(), subject: subject.value.trim(), fileName: selected.name, mime: mime, size: selected.size, blob: selected, createdAt: now, updatedAt: now });
          await refresh();
          notify('Materi berhasil disimpan.');
        } catch (error) {
          submit.disabled = false;
          notify(error.name === 'QuotaExceededError' ? 'Penyimpanan browser hampir penuh. Hapus file lama atau pilih file lebih kecil.' : (error.message || 'File gagal disimpan.'));
        }
      }},
        el('div', { className: 'ms-form-title' }, el('h2', {}, 'Tambah materi'), el('p', { className: 'mute sm' }, 'Unggah bahan kuliah dalam format PDF, gambar, atau video.')),
        field('Nama materi', title), field('Mata kuliah / kategori', subject), field('Pilih file', file, 'Maksimal 50 MB per file.'),
        el('button', { type: 'submit', className: 'btn' }, 'Simpan materi')
      );
      const list = filtered('material');
      return el('div', { className: 'ms-section-stack' }, form,
        el('section', { className: 'ms-list-section' },
          el('div', { className: 'ms-list-heading' }, el('h2', {}, 'Materi tersimpan'), el('span', { className: 'ms-count' }, list.length + ' file')),
          list.length ? el('div', { className: 'ms-grid' }, list.map(materialCard)) : empty('Belum ada materi', 'File yang kamu unggah akan tersusun rapi di sini.')
        )
      );
    }

    function notePanel() {
      const title = el('input', { required: true, maxlength: 120, placeholder: 'Contoh: Ringkasan Pertemuan 1' });
      const subject = el('input', { maxlength: 80, placeholder: 'Contoh: Pengantar Manajemen' });
      const content = el('textarea', { rows: 7, required: true, placeholder: 'Mulai tulis catatanmu di sini. Kamu bisa menulis panjang dan mengeditnya lagi nanti...' });
      let form;
      form = el('form', { className: 'ms-form-card', onSubmit: async event => {
        event.preventDefault();
        if (!title.value.trim() || !content.value.trim()) return notify('Judul dan isi catatan wajib diisi.');
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        const now = Date.now();
        try {
          await saveItem({ id: uid(), type: 'note', title: title.value.trim(), subject: subject.value.trim(), content: content.value, createdAt: now, updatedAt: now });
          form.reset();
          await refresh();
          notify('Catatan berhasil disimpan.');
        } catch (error) {
          submit.disabled = false;
          notify(error.name === 'QuotaExceededError' ? 'Penyimpanan browser penuh. Coba kurangi isi catatan atau kosongkan ruang penyimpanan.' : (error.message || 'Catatan gagal disimpan.'));
        }
      }},
        el('div', { className: 'ms-form-title' }, el('h2', {}, 'Tulis catatan'), el('p', { className: 'mute sm' }, 'Daftar hanya menampilkan judul agar halaman tetap ringkas.')),
        field('Judul catatan', title), field('Mata kuliah / kategori', subject), field('Isi catatan', content, 'Klik judul catatan untuk membaca dan mengedit isinya.'),
        el('button', { type: 'submit', className: 'btn' }, 'Simpan catatan')
      );
      const list = filtered('note');
      return el('div', { className: 'ms-section-stack' }, form,
        el('section', { className: 'ms-list-section' },
          el('div', { className: 'ms-list-heading' }, el('h2', {}, 'Catatanmu'), el('span', { className: 'ms-count' }, list.length + ' catatan')),
          list.length ? el('div', { className: 'ms-note-list' }, list.map(noteCard)) : empty('Belum ada catatan', 'Catatan yang kamu buat akan tampil berdasarkan judulnya.')
        )
      );
    }

    function renderTabs() {
      tabs.replaceChildren(
        el('button', { type: 'button', className: 'ms-tab' + (active === 'material' ? ' active' : ''), role: 'tab', 'aria-selected': String(active === 'material'), onClick: () => { active = 'material'; search.value = ''; renderTabs(); renderPanel(); } }, 'Materi kuliah'),
        el('button', { type: 'button', className: 'ms-tab' + (active === 'note' ? ' active' : ''), role: 'tab', 'aria-selected': String(active === 'note'), onClick: () => { active = 'note'; search.value = ''; renderTabs(); renderPanel(); } }, 'Catatan')
      );
    }
    function renderPanel() { panel.replaceChildren(active === 'material' ? materialPanel() : notePanel()); }

    search.addEventListener('input', renderPanel);
    page.append(
      el('header', { className: 'ms-heading' }, el('div', {}, el('p', { className: 'ms-eyebrow' }, 'RUANG BELAJAR PRIBADI'), el('h1', {}, 'MySpace'), el('p', { className: 'mute' }, 'Simpan materi kuliah dan catatanmu dalam satu tempat.'))),
      tabs, el('div', { className: 'ms-search-wrap' }, search), info, panel
    );
    renderTabs();
    refresh();
    if (cloudEnabled() && typeof window.KantongCloud.subscribeMySpace === 'function') {
      const channel = window.KantongCloud.subscribeMySpace(() => refresh());
      window.cleanupMySpace = () => {
        if (channel) window.KantongCloud.client.removeChannel(channel).catch(() => {});
      };
    }
    return page;
  };
})();
