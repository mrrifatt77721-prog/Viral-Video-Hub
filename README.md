# Telegram Viral Video Hub — Mini App starter

This project includes:
- Telegram bot `/start` button that opens the Mini App
- Mobile-first user app with video categories/search, saved list, recently opened list, and Telegram profile display
- Separate admin panel at `/admin.html`
- Add videos by URL or upload a video file (up to 100 MB); edit details and delete videos
- Manually managed ad banner with destination link and click count
- JSON file storage in `data/db.json`

## Run locally
1. Install Node.js 18 or newer.
2. Extract this ZIP and open a terminal in the project folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and set `BOT_TOKEN`, `ADMIN_PASSWORD`, `WEBAPP_URL`, and `PORT`.
5. Run `npm start`.
6. Open `http://localhost:3000` for the user app and `http://localhost:3000/admin.html` for admin.

Telegram Mini Apps require a publicly reachable **HTTPS** URL. Deploy this app to a Node.js host, set `WEBAPP_URL` to the HTTPS home URL, then restart the app. Create a bot with Telegram's official BotFather and use its token in the host's environment variables. Never publish your bot token or admin password.

## Important production notes
- This is a working starter project, not a deployed live service. It cannot run inside Telegram until you deploy it and configure the bot.
- Admin API is password-protected; change the default password and use HTTPS. For production, add rate limiting, stronger admin authentication, backups, and a database.
- Telegram profile name/ID is displayed from Telegram WebApp client data for convenience. Client-supplied profile data is **not verified** by this starter. Implement Telegram `initData` signature verification on the server before relying on user identity for sensitive features.
- The ad panel is a manual banner/link and counts clicks. It does not automatically earn money. For paid ad revenue, integrate a legitimate ad network that supports your use case and Telegram Mini Apps.
- URL-based video playback depends on the URL being a direct playable video or a page that allows opening. This project does not bypass platform restrictions. Upload or link only content you own or are authorized to share.
- Uploaded videos are stored on the server disk; on some hosting plans files may be ephemeral. Use persistent storage for production.
