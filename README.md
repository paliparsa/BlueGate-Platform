# BlueGate Platform

> **Current release:** v3.0.3 — Core Stability. Money-flow, concurrency and Catalog/Legacy consistency fixes. See `RELEASE-NOTES-v3.0.3.md`.

BlueGate Platform is the main commerce stack behind BlueGate: a PHP/MySQL storefront, customer account area, administration panel, Telegram Mini App and Telegram Bot running on one catalog, one order system and one source of truth.

**Current build: v3.0.2.1**

This repository is intended to be deployed as a complete application. The Website and Telegram Mini App use the same backend and catalog data, so a product edited in Admin is not maintained separately for each client.

---

## What is included

- Storefront Website
- Customer account and authentication
- Order lifecycle and delivery flow
- BlueGate Credit
- Referral system
- Web Admin
- Telegram Mini App
- Telegram Bot/Webhook
- Catalog Studio
- Payment configuration
- Coupon and inventory tools
- Backup/restore and activity logging

The backend is PHP with MySQL/MariaDB. `api.php` is the central application API used by the web clients and Mini App.

---

## Catalog Studio

The catalog hierarchy is:

```text
Category
└── Service
    └── Group / Sub-service
        └── Plan / Product
```

Catalog Studio is the supported place for day-to-day catalog management. Legacy product/variant tables are still maintained where required for checkout compatibility, but they should not be treated as a second catalog to edit manually.

### Service controls

Administrators can manage:

- title
- slug
- description
- image
- theme
- badge
- featured state
- active state
- display order

### Group / sub-service controls

Administrators can manage:

- title
- slug
- description
- image
- active state
- display order

### Plan / product controls

Administrators can manage:

- title
- description
- image
- active state
- display order
- duration
- discount
- delivery type
- commission type and value
- price currency
- toman price
- USD price

The same catalog controls are available from both **Web Admin** and **Telegram Mini App Admin**.

---

## USD pricing

Plans can be priced directly in toman or entered in USD.

When `USD` is selected, BlueGate uses the existing USDT/toman rate pipeline to calculate the payable toman value. The catalog keeps the original USD value together with the conversion metadata instead of replacing it with an unexplained fixed number.

Relevant plan fields include:

```text
price
price_currency
price_usd
price_rate_toman
price_rate_source
price_rate_updated_at
```

This allows an administrator to keep a product defined in USD while the storefront continues to operate with the local toman amount expected by the checkout flow.

---

## Catalog images

Images can be entered as an existing URL or uploaded directly from Admin.

Supported formats:

```text
JPG
JPEG
PNG
WEBP
```

Maximum upload size: **6 MB**

Uploaded files are stored under:

```text
public/uploads/catalog/YYYYMM/
```

Image upload is available for:

- services
- groups / sub-services
- plans / products

The upload endpoint validates the file type on the server and is restricted to authenticated Admin use.

> Make sure the web server user can write to `public/uploads/catalog/`.

---

## Main routes

For a deployment on `https://example.com`:

```text
/                 Storefront
/account          Customer account
/orders           Orders
/wallet           BlueGate Credit
/referral         Referral
/profile          Profile
/admin             Web Admin
/miniapp/          Telegram Mini App
/api.php           Main API
/bot.php           Telegram Bot webhook
/portal/           Compatibility redirect
```

---

## Server requirements

Recommended baseline:

- Ubuntu or Debian VPS
- Nginx
- PHP-FPM
- PHP CLI
- MySQL or MariaDB
- HTTPS-enabled domain/subdomain
- at least 1 GB RAM; 2 GB+ recommended

Typical PHP packages used by the project:

```text
php-fpm
php-cli
php-mysql
php-curl
php-mbstring
php-xml
```

The installer can provision the common system dependencies on a clean supported server.

---

## Fresh install

Upload or clone the repository to the server, then run the installer as a privileged user:

```bash
chmod +x install.sh
sudo ./install.sh
```

The installer will ask for the values it needs for the deployment, including database/application settings and public host information.

A sample configuration is available in:

```text
config.example.php
```

Do not commit a production configuration containing passwords, API keys or bot tokens.

---

## Updating an existing installation

Before updating a production instance, create a database backup and keep a copy of the current application configuration.

Then use the project update script:

```bash
chmod +x update.sh
sudo ./update.sh
```

The update path applies required database migrations. In this build that includes catalog changes such as support for plan images on installations created before the field existed.

Do not replace the database manually with `schema.sql` on an existing production installation.

---

## Telegram Mini App

The Mini App uses Telegram `initData` for Telegram-side authentication and talks to the same API/database as the Website.

For a production Mini App:

1. deploy BlueGate over HTTPS;
2. configure the bot token in the application configuration;
3. point the Telegram Mini App URL to `/miniapp/`;
4. configure the bot webhook to the deployed `bot.php` endpoint where applicable.

If the Mini App opens as a blank page, first check the browser console/network log and the API response rather than treating it as a Telegram UI problem. Authentication failures, stale frontend assets and API errors can all surface as a failed Mini App boot.

---

## Permissions for image uploads

If product image upload fails with a permission error, verify the upload directory exists and is writable by the PHP/Nginx runtime user.

Example on a typical Debian/Ubuntu deployment:

```bash
sudo mkdir -p public/uploads/catalog
sudo chown -R www-data:www-data public/uploads
sudo find public/uploads -type d -exec chmod 755 {} \;
sudo find public/uploads -type f -exec chmod 644 {} \;
```

Avoid making the directory globally writable with `chmod 777`.

---

## Database and compatibility layer

MySQL/MariaDB is the source of truth.

Catalog Studio writes to the current service/group/plan model. Where the checkout still relies on legacy product/variant records, BlueGate mirrors the required pricing/product metadata internally. This compatibility layer exists so the storefront can evolve without forcing a destructive catalog migration.

In normal operation:

- edit catalog data through Catalog Studio;
- do not independently edit mirrored legacy rows;
- let migrations add new fields to existing installations.

---

## Useful files

```text
api.php                 Main backend API
bot.php                 Telegram webhook/bot entry point
schema.sql              Fresh-install database schema
config.example.php      Configuration example
install.sh              Fresh installation
update.sh               Existing-install update path
uninstall.sh            Removal helper
public/                  Public/static assets and uploads
miniapp/                 Telegram Mini App frontend
```

The exact frontend/admin implementation may be split into additional files under the project tree; use the routes above as the public interface rather than assuming every page maps one-to-one to a directory.

---

## Troubleshooting

### "A plan with this title already exists in this sub-service"

On edit, the current plan must keep its original plan ID. v3.0.2.1 includes a compatibility fix for existing Catalog Studio drafts where that ID was missing: the backend can resolve the existing plan inside the same group before deciding that the title is a real duplicate.

A genuine second plan with the same title in the same sub-service is still rejected.

### USD price does not convert

Check that:

- the plan currency is set to `USD`;
- a valid USD value is supplied;
- the USDT/toman rate source is returning a usable rate;
- the API request completes successfully.

The stored rate metadata can be used to see which conversion rate was applied.

### Image upload fails

Check:

- file size is 6 MB or less;
- format is JPG/JPEG/PNG/WEBP;
- PHP upload limits are not lower than the application limit;
- `public/uploads/catalog/` is writable;
- the request is authenticated as Admin.

Useful PHP settings to inspect:

```ini
upload_max_filesize
post_max_size
```

### Web Admin works but Mini App Admin looks outdated

Clear or invalidate cached versioned assets and reopen the Mini App. The two admin surfaces use the same backend, but Telegram's webview can retain older frontend assets longer than a normal browser session.

---

## Production checklist

Before putting a build live:

- HTTPS is valid
- database is backed up
- production config is outside public exposure
- Admin credentials are changed from installation defaults
- Telegram bot token is configured correctly
- upload directory is writable but not globally writable
- Web Admin can create and edit a test plan
- Mini App Admin can edit the same plan
- IRT checkout works
- USD conversion works
- image upload works from both admin surfaces
- an end-to-end test order can reach the intended delivery state

---

## Release notes

Release-specific changes are kept in the `RELEASE-NOTES-v*.md` files. For this build see:

```text
RELEASE-NOTES-v3.0.2.1.md
```

---

BlueGate Platform is an application repository, not a reusable public framework. Keep production secrets out of source control, deploy updates through the migration path, and treat the database as persistent state rather than something to recreate on every release.

---

## v3.0.3.1 — Catalog identity repair

This release hardens Catalog Studio edits against stale browser drafts. Group and plan IDs are now validated against their actual parent records before saving, and incompatible older Web/Mini App drafts are discarded automatically. This specifically fixes false “duplicate plan title” errors when editing existing catalog entries.


## Web routes (v3.0.5)

The website uses real browser paths instead of hash-only member navigation. Useful routes include:

```text
/account
/orders
/wallet
/referral
/profile
/admin
/admin/orders
/admin/catalog
/admin/inventory
/admin/users
/admin/settings
/admin/activity
/admin/roles
/admin/backups
```

Nginx installations created by BlueGate already use an `index.php` fallback. Apache uses the rules in `public/.htaccess`. Old hash links are migrated by the browser router.
