/* Kantong email/password sign-in and account registration. */
(() => {
  'use strict';
  const screen = document.getElementById('auth-screen');
  const $ = selector => screen.querySelector(selector);
  let mode = window.location.hash.includes('type=recovery') ? 'recovery' : 'login';
  let busy = false;

  function message(text, kind) {
    const box = $('#auth-message');
    if (!box) return;
    box.textContent = text || '';
    box.className = 'auth-message' + (kind ? ' ' + kind : '');
    box.hidden = !text;
  }

  function renderSetup() {
    screen.innerHTML = '';
    const card = document.createElement('section');
    card.className = 'auth-card';
    const heading = document.createElement('h1');
    heading.textContent = 'Hubungkan Kantong ke Supabase';
    const p = document.createElement('p');
    p.textContent = window.KantongCloud && window.KantongCloud.setupMessage
      ? window.KantongCloud.setupMessage
      : 'Isi konfigurasi Supabase sebelum akun dapat digunakan.';
    const ol = document.createElement('ol');
    [
      'Buka Supabase Dashboard untuk project Kantong.',
      'Salin Project URL dan Publishable key dari Project Settings → API Keys.',
      'Buka file supabase-config.js di GitHub, lalu isi publishableKey. Jangan gunakan service_role key.',
      'Jalankan supabase-schema.sql di SQL Editor.'
    ].forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      ol.append(li);
    });
    card.append(heading, p, ol);
    screen.append(card);
  }

  function renderAuth() {
    screen.innerHTML = '';
    const card = document.createElement('section');
    card.className = 'auth-card';
    const brand = document.createElement('div');
    brand.className = 'auth-brand';
    const mark = document.createElement('span');
    mark.className = 'auth-brand-mark';
    mark.textContent = 'K';
    const brandText = document.createElement('span');
    brandText.textContent = 'Kantong';
    brand.append(mark, brandText);

    const title = document.createElement('h1');
    title.textContent = mode === 'signup' ? 'Buat akun Kantong' : mode === 'reset' ? 'Atur ulang kata sandi' : mode === 'recovery' ? 'Buat kata sandi baru' : 'Selamat datang kembali';
    const intro = document.createElement('p');
    intro.className = 'auth-intro';
    intro.textContent = mode === 'signup'
      ? 'Buat akun gratis untuk menyimpan data dan membukanya dari HP maupun komputer.'
      : mode === 'reset'
        ? 'Masukkan email akunmu. Kami akan mengirim tautan untuk mengatur ulang kata sandi.'
        : mode === 'recovery'
          ? 'Buat kata sandi baru untuk melindungi akun Kantongmu.'
          : 'Masuk untuk melanjutkan catatan keuangan dan ruang belajarmu.';

    const form = document.createElement('form');
    form.className = 'auth-form';
    form.noValidate = true;

    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'Email';
    const email = document.createElement('input');
    email.type = 'email';
    email.autocomplete = 'email';
    email.required = true;
    email.maxLength = 254;
    email.placeholder = 'nama@email.com';
    emailLabel.append(email);

    let password = null;
    let passwordLabel = null;
    if (mode !== 'reset') {
      passwordLabel = document.createElement('label');
      passwordLabel.textContent = 'Kata sandi';
      password = document.createElement('input');
      password.type = 'password';
      password.autocomplete = mode === 'signup' || mode === 'recovery' ? 'new-password' : 'current-password';
      password.minLength = 8;
      password.required = true;
      password.placeholder = mode === 'signup' || mode === 'recovery' ? 'Minimal 8 karakter' : 'Masukkan kata sandi';
      passwordLabel.append(password);
    }

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn auth-submit';
    submit.textContent = mode === 'signup' ? 'Buat akun' : mode === 'reset' ? 'Kirim tautan reset' : mode === 'recovery' ? 'Simpan kata sandi baru' : 'Masuk';

    form.append(emailLabel);
    if (passwordLabel) form.append(passwordLabel);
    form.append(submit);

    const links = document.createElement('div');
    links.className = 'auth-links';
    if (mode === 'login') {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.textContent = 'Lupa kata sandi?';
      reset.addEventListener('click', () => { mode = 'reset'; renderAuth(); });
      const signup = document.createElement('button');
      signup.type = 'button';
      signup.textContent = 'Belum punya akun? Daftar';
      signup.addEventListener('click', () => { mode = 'signup'; renderAuth(); });
      links.append(reset, signup);
    } else {
      const back = document.createElement('button');
      back.type = 'button';
      back.textContent = 'Kembali ke masuk';
      back.addEventListener('click', () => { mode = 'login'; renderAuth(); });
      links.append(back);
    }

    const note = document.createElement('p');
    note.className = 'auth-note';
    note.textContent = 'Gunakan akun pribadi. Data keuangan setiap akun dipisahkan dan tidak dapat dilihat pengguna lain.';
    const status = document.createElement('p');
    status.id = 'auth-message';
    status.className = 'auth-message';
    status.hidden = true;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      if ((mode !== 'recovery' && (!email.value.trim() || !email.validity.valid)) || (password && password.value.length < 8)) {
        status.textContent = mode === 'recovery' ? 'Kata sandi harus memiliki minimal 8 karakter.' : password ? 'Masukkan email yang benar dan kata sandi minimal 8 karakter.' : 'Masukkan alamat email yang benar.';
        status.className = 'auth-message error';
        status.hidden = false;
        return;
      }
      busy = true;
      submit.disabled = true;
      submit.textContent = 'Memproses...';
      try {
        const client = window.KantongCloud.client;
        let result;
        if (mode === 'signup') {
          result = await client.auth.signUp({
            email: email.value.trim(),
            password: password.value,
            options: { emailRedirectTo: window.location.origin }
          });
          if (result.error) throw result.error;
          if (!result.data.session) {
            status.textContent = 'Akun berhasil dibuat. Periksa email untuk konfirmasi, lalu kembali ke sini dan masuk.';
            status.className = 'auth-message success';
            status.hidden = false;
          } else {
            status.textContent = 'Akun berhasil dibuat.';
            status.className = 'auth-message success';
            status.hidden = false;
          }
        } else if (mode === 'reset') {
          result = await client.auth.resetPasswordForEmail(email.value.trim(), {
            redirectTo: window.location.origin
          });
          if (result.error) throw result.error;
          status.textContent = 'Jika email terdaftar, tautan reset akan dikirim ke kotak masukmu.';
          status.className = 'auth-message success';
          status.hidden = false;
        } else if (mode === 'recovery') {
          result = await client.auth.updateUser({ password: password.value });
          if (result.error) throw result.error;
          const { error: signOutError } = await client.auth.signOut();
          if (signOutError) throw signOutError;
          mode = 'login';
          renderAuth();
          message('Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.', 'success');
        } else {
          result = await client.auth.signInWithPassword({
            email: email.value.trim(),
            password: password.value
          });
          if (result.error) throw result.error;
          status.textContent = 'Berhasil masuk.';
          status.className = 'auth-message success';
          status.hidden = false;
        }
      } catch (error) {
        status.textContent = error.message || 'Permintaan gagal. Coba lagi.';
        status.className = 'auth-message error';
        status.hidden = false;
      } finally {
        busy = false;
        submit.disabled = false;
        submit.textContent = mode === 'signup' ? 'Buat akun' : mode === 'reset' ? 'Kirim tautan reset' : mode === 'recovery' ? 'Simpan kata sandi baru' : 'Masuk';
      }
    });

    card.append(brand, title, intro, form, links, note, status);
    screen.append(card);
  }

  function showSignedIn(session) {
    window.KANTONG_CURRENT_USER = session && session.user ? session.user : null;
    const signedIn = !!window.KANTONG_CURRENT_USER;
    screen.hidden = signedIn;
    document.body.classList.toggle('auth-signed-out', !signedIn);
    document.body.classList.toggle('auth-booting', false);

    const buildUserBar = (id, className) => {
      let bar = document.getElementById(id);
      if (!bar) {
        bar = document.createElement('div');
        bar.id = id;
        bar.className = className;
      }
      bar.replaceChildren();
      if (signedIn) {
        const label = document.createElement('span');
        label.className = 'kantong-user-email';
        label.textContent = window.KANTONG_CURRENT_USER.email || 'Akun Kantong';
        const logout = document.createElement('button');
        logout.type = 'button';
        logout.className = 'kantong-logout';
        logout.textContent = 'Keluar';
        logout.addEventListener('click', async () => {
          logout.disabled = true;
          const { error } = await window.KantongCloud.client.auth.signOut();
          if (error) {
            logout.disabled = false;
            window.alert(error.message);
          }
        });
        bar.append(label, logout);
      }
      return bar;
    };
    const aside = document.querySelector('aside');
    if (aside) aside.append(buildUserBar('kantong-user-bar', 'kantong-user-bar'));
    const mobileBrand = document.querySelector('.mobile-brand');
    if (mobileBrand) {
      let mobileBar = document.getElementById('kantong-mobile-user-bar');
      if (!mobileBar) {
        mobileBar = document.createElement('div');
        mobileBar.id = 'kantong-mobile-user-bar';
        mobileBar.className = 'kantong-mobile-user-bar';
        mobileBrand.insertAdjacentElement('afterend', mobileBar);
      }
      mobileBar.replaceChildren(buildUserBar('kantong-mobile-user-inner', 'kantong-mobile-user-inner'));
    }

    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('kantong-auth-change', {
        detail: { session: mode === 'recovery' ? null : session || null }
      }));
    }, 0);
  }

  async function start() {
    document.body.classList.add('auth-booting');
    if (!window.KantongCloud || !window.KantongCloud.configured) {
      document.body.classList.add('auth-signed-out');
      renderSetup();
      return;
    }
    renderAuth();
    window.KantongCloud.client.auth.onAuthStateChange((_event, session) => {
      showSignedIn(session);
    });
    const { data, error } = await window.KantongCloud.client.auth.getSession();
    if (error) {
      message(error.message, 'error');
      showSignedIn(null);
      return;
    }
    showSignedIn(data.session);
  }

  start().catch(error => {
    document.body.classList.remove('auth-booting');
    renderSetup();
    console.error(error);
  });
})();
