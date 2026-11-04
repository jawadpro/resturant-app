# MFD Books

Nightly bookkeeping for a bar and restaurant. Staff close the night on a phone, the manager checks and approves it, and the owner sees the numbers, approves payroll and downloads any report as CSV.

Built with Laravel 12 and MySQL. Runs on ordinary shared hosting (Hostinger Premium and up), no Node.js or command line needed on the server.

## What it does

| Role | Can do |
|---|---|
| **Staff** | Fill in tonight's form (sales, QR/card, expenses with receipt photos, cash count) and send it. See their own past nights. |
| **Manager** | Everything staff can, plus: dashboard, review and approve nights (or send them back), add or close missing nights, prepare payroll. |
| **Owner** | Everything, plus: approve payroll, reopen approved nights, download reports, create and manage user logins. |

- One sign-in screen for everyone (username and password). Passwords are stored with bcrypt; 5 wrong tries pause sign-in for 30 seconds.
- Every permission is checked on the server, not just hidden in the page.
- The form autosaves as staff type. A night counts until 06:00 the next morning (Bangkok time), so closing after midnight still lands on the right date.
- Commission is filled in automatically (37.5% of staff drink sales). Expenses of ฿500+ without a receipt are flagged.
- Reports (CSV, opens in Excel with Thai text intact): daily summary, sales by category, expenses list, monthly profit and loss, cash counts, payroll, and a full export.
- English and Thai for the staff screens.

Business rules (categories, commission rate, cut-off hour) live in `config/books.php` and `.env`.

## Client data stays out of git

The repository holds code only. History from the old spreadsheet goes in `storage/app/import/` (git-ignored) as `nights.json` and `staff.json`, and receipt photos are stored in `storage/app/private/receipts/` (git-ignored, served only to signed-in users allowed to see that night). Never commit `.env`, import files or database dumps.

## Run it locally

Requirements: PHP 8.2+ with pdo_mysql, Composer, MySQL or MariaDB.

```bash
composer install
cp .env.example .env          # set DB_*, APP_URL=http://127.0.0.1:8000, APP_ENV=local, SESSION_SECURE_COOKIE=false
php artisan key:generate
php artisan migrate
php artisan books:import      # optional: imports storage/app/import/*.json
php artisan books:owner owner "Owner name"   # asks for a password
php artisan serve
```

## Deploy to Hostinger (shared hosting)

1. **Build the upload** on your computer: `scripts/build-deploy.sh` (add `--with-import` for the first deploy to include the history files). This creates `deploy/mfd-books.zip` with `vendor/` included.
2. In hPanel, **create a website** (a temporary `*.hostingersite.com` domain is fine) and a **MySQL database**. Set PHP to 8.2 or newer.
3. **Upload and extract** the zip into the site's `public_html`. The root `.htaccess` sends every request into `public/`, so code and `.env` are never reachable from the web.
4. **Create `.env`** in `public_html` from `.env.example`: database details (host `127.0.0.1`), `APP_URL`, a new `APP_KEY` (`php artisan key:generate --show` locally), and a long random `INSTALL_TOKEN`.
5. Open **`https://your-domain/install`**, enter the token, create the owner login and tick the import boxes.
6. **Remove `INSTALL_TOKEN`** from `.env` (leave it empty). The setup page then returns 404.

### Updating

Build a new zip, upload and extract it over the old files (keep `.env` and `storage/app/private/`). If the update includes database changes, put `INSTALL_TOKEN` back temporarily, open `/install`, click **Run updates**, then remove the token again.

### Backups

Turn on Hostinger's daily backups, and download the **Everything** report now and then as an extra copy.
