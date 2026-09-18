# BlueGate Platform 4.0 — Direct Upgrade Compatibility

This release is designed to upgrade an existing BlueGate Platform 3.x installation in place.

Preserved from the existing installation:
- `/etc/bluegate-platform.env`
- `/var/www/bluegate-platform/config.php`
- MariaDB database (default: `bluegate_platform`)
- users, balances, products, catalog, orders, transactions, inventory, uploads, and settings
- existing domain, Telegram bot, webhook, and payment configuration

Added by the migration:
- Service Engine / VPN provider tables
- 3x-ui, Marzban and Remnawave integration
- provisioning, renewal, monitoring, routing, subscriptions, trials and tickets

The schema migration is additive and contains upgrade guards for existing BlueGate tables.

## First update from BlueGate 3.x

Push this release over the existing BlueGate Git repository and run the normal updater:

```bash
sudo bluegate update
```

The legacy one-minute BlueGate cron is able to run Service Engine provisioning and monitoring through a compatibility bridge, so the first update does not leave VPN automation stopped even though the updater process itself started from the older CLI.

After the first update, running this once is recommended so the dedicated 4.x cron entries and current manager command are installed immediately:

```bash
sudo bluegate repair
```

This is not a database restore and does not replace existing BlueGate commerce data.
