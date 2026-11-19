# Menyiapkan akun dan sinkronisasi cloud Kantong

Panduan ini ditujukan untuk pemula. Perubahan kode sudah disiapkan di branch `feat/supabase-account-sync`; lakukan langkah berikut setelah branch digabungkan ke `main`.

## 1. Isi konfigurasi Supabase

1. Buka project Supabase Kantong.
2. Masuk ke **Project Settings → API Keys**.
3. Salin **Project URL** dan **Publishable key** (atau legacy **anon public** key).
4. Buka file `supabase-config.js` di GitHub.
5. Pastikan Project URL sesuai project milikmu, lalu ganti teks `PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE` dengan key tadi.
6. Simpan perubahan. Key publishable/anon memang dipakai di browser; **jangan pernah** menaruh `service_role`, secret key, password database, atau access token pribadi di file frontend.

Project URL yang sudah dipakai di konfigurasi awal adalah `https://bfzmexooierkbwhhnexv.supabase.co`. Ganti bila project Supabase milikmu berbeda.

## 2. Buat tabel dan aturan keamanan

1. Di Supabase, buka **SQL Editor**.
2. Pilih **New query**.
3. Buka file `supabase-schema.sql` di repo, salin seluruh isinya.
4. Tempel ke SQL Editor, lalu tekan **Run**.
5. Pastikan query selesai tanpa pesan error. File ini membuat tabel data keuangan, tabel MySpace, bucket file privat, dan Row Level Security (RLS) untuk memisahkan data tiap akun.

Jangan menghapus atau melemahkan policy RLS. Jangan membuat bucket MySpace menjadi public.

## 3. Atur alamat konfirmasi email

1. Buka **Authentication → URL Configuration** di Supabase.
2. Isi **Site URL** dengan alamat website Kantong, misalnya `https://kantongme.netlify.app`.
3. Tambahkan alamat website tersebut ke **Redirect URLs**. Tambahkan juga alamat lokal untuk pengujian, misalnya `http://localhost:8000/**`.
4. Jika konfirmasi email aktif, pengguna harus menekan tautan konfirmasi yang dikirim ke email sebelum login.

## 4. Deploy ke Netlify

Jika Netlify sudah terhubung ke GitHub, gabungkan pull request ini ke `main`; Netlify akan melakukan deploy otomatis sesuai pengaturan situsmu. Jika deploy tidak otomatis, buka Netlify dan jalankan **Trigger deploy**.

## 5. Uji login dan sinkronisasi

1. Buka website Kantong.
2. Daftar menggunakan email milikmu dan kata sandi yang kuat (minimal 8 karakter).
3. Jika diminta, konfirmasi email.
4. Masuk ke Kantong, lalu buat satu transaksi uji.
5. Buka website dari HP dan masuk memakai akun yang sama.
6. Pastikan transaksi yang sama muncul. Coba tambah transaksi dari HP dan periksa apakah perubahan muncul di PC.
7. Buat satu catatan MySpace atau unggah file kecil untuk memastikan penyimpanan privat berjalan.

Setiap pengguna memiliki baris data sendiri. Pengguna lain tidak dapat membaca data tersebut melalui API karena kebijakan RLS, selama schema dan policy dijalankan seperti file SQL ini.

## 6. Batas paket gratis dan backup

- Paket gratis Supabase mencakup penyimpanan database dan file dengan kuota terbatas. MySpace berbagi kuota file 1 GB.
- Ukuran unggahan MySpace dibatasi maksimal 50 MB per file pada paket Free.
- Project Free dapat dijeda ketika aktivitasnya sangat rendah selama sekitar satu minggu; project dapat diaktifkan kembali dari dashboard.
- Paket Free tidak menyediakan backup database otomatis harian. Gunakan **Data → Unduh cadangan** secara berkala dan simpan file di tempat aman.
- File cadangan JSON memuat informasi keuangan. Jangan unggah ke repositori publik atau membagikannya ke orang lain.

## 7. Cara aman memakai Kantong

- Gunakan akun pribadi, terutama pada perangkat bersama.
- Jangan gunakan kata sandi yang sama dengan akun penting lainnya.
- Selalu keluar dari akun pada perangkat bersama.
- Jangan pernah menyalin Supabase service role key ke website, GitHub, atau chat.
- Hindari mengedit data yang sama bersamaan di dua perangkat. Sinkronisasi realtime akan memperbarui tampilan, tetapi bukan sistem pengeditan kolaboratif dengan penggabungan konflik.
