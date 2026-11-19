# Menyiapkan akun dan sinkronisasi cloud Kantong

Panduan ini ditujukan untuk pemula. Perbaikan skema MySpace sudah tersedia di branch `main`.

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

**Penting untuk database yang sudah pernah dipakai:** menjalankan `CREATE TABLE IF NOT EXISTS` saja tidak menambahkan kolom baru ke tabel lama. Karena itu, jalankan migrasi lengkap `supabase-migrations/20261119_repair_myspace_schema.sql` melalui **SQL Editor → New query → Run**. Migrasi ini memastikan seluruh kolom yang dipakai aplikasi tersedia, termasuk `file_path`, `file_name`, dan `mime`. Migrasi aman dijalankan berulang kali dan tidak menghapus baris data maupun file yang sudah tersimpan. Migrasi juga membuat kolom warisan `item_type` menjadi opsional bila kolom tersebut ada, karena aplikasi saat ini menggunakan `type`.

**Catatan:** aplikasi memperbarui item dengan pasangan `user_id` dan `id`. Migrasi juga menyiapkan indeks unik untuk pasangan tersebut. Jika pembuatan indeks gagal karena ada duplikasi data lama, jangan hapus baris apa pun; kirim pesan error SQL-nya agar duplikat dapat diperiksa dengan aman.

Setelah selesai, periksa kolom dengan query berikut:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'myspace_items'
ORDER BY ordinal_position;
```

Jangan menghapus tabel `myspace_items`, jangan membuat ulang database, dan jangan melemahkan policy RLS. Jangan membuat bucket MySpace menjadi public.

## 3. Aktifkan metode login

### Email dan kata sandi
1. Buka **Authentication → Sign In / Providers**.
2. Pastikan provider **Email** aktif.
3. Pastikan pendaftaran pengguna baru diizinkan (Allow new users to sign up).
4. Bila konfirmasi email aktif, pengguna harus menekan tautan konfirmasi sebelum login.

### Google
1. Di Supabase, buka **Authentication → Sign In / Providers → Google**, lalu aktifkan provider Google.
2. Buat OAuth Client ID jenis **Web application** pada Google Cloud / Google Auth Platform.
3. Pada bagian **Authorized JavaScript origins**, masukkan alamat domain Netlify Kantong, misalnya `https://kantongme.netlify.app` (gunakan domain situsmu yang sebenarnya).
4. Pada bagian **Authorized redirect URIs**, masukkan callback Supabase berikut:

   `https://bfzmexooierkbwhhnexv.supabase.co/auth/v1/callback`

   Callback ini khusus project Supabase yang URL-nya tercantum di konfigurasi awal. Jika project-mu berbeda, salin callback yang ditampilkan di pengaturan Google provider pada Supabase.
5. Salin **Client ID** dan **Client Secret** dari Google ke kolom provider Google pada Supabase, lalu simpan. Jangan menaruh Client Secret ke GitHub, JavaScript frontend, atau file konfigurasi website.

### URL aplikasi
1. Buka **Authentication → URL Configuration** di Supabase.
2. Isi **Site URL** dengan alamat website Kantong yang sebenarnya.
3. Tambahkan alamat website tersebut ke **Redirect URLs**. Tambahkan juga alamat lokal untuk pengujian, misalnya `http://localhost:8000/**`.

## 4. Deploy ke Netlify

Untuk error `file_path`, kamu tidak perlu melakukan deploy ulang ke Netlify karena perbaikannya ada pada skema database Supabase. Setelah menjalankan migrasi SQL pada langkah 2, muat ulang website Kantong dengan `Ctrl + Shift + R`. Deploy Netlify hanya diperlukan bila ada perubahan kode frontend.

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
