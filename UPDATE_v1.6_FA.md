# آپدیت BlueGate Platform به v1.6.0

1. محتویات این Release را روی branch `main` رپوی BlueGate-Platform جایگزین و Push کنید.
2. روی VPS اجرا کنید:

```bash
sudo bluegate --update
```

3. سلامت سرویس را بررسی کنید:

```bash
sudo bluegate --health
```

4. برای Website یک Hard Refresh انجام دهید (`Ctrl + Shift + R`).

این Release migration دیتابیس جدیدی نیاز ندارد.
