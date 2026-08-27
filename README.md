# SocialCare – Multi-User Student Responsibility Platform

## Features
- Student Register/Login with separate scores, alerts and history for every account.
- Admin Dashboard with every student's total and five module scores.
- Mobile Usage target: 60 minutes. Backend stores minutes; the UI converts minutes to hours when needed. Crossing 60 minutes loses the 20 mobile points and creates an alert.
- Cyber message analyser with risk score, simple meaning and safety advice.
- Daily changing Health, Food and Environment checklists.
- Plastic photo reuse/craft suggestions using the browser Hugging Face model when available, with server-side/local fallback.
- Browser Back navigation and logout.

## Run locally
From the `socialcare` folder:

```bash
npm run install-all
```

Terminal 1:
```bash
npm run server
```

Terminal 2:
```bash
npm run client
```

Open `http://localhost:5173`.

## Admin credentials
Admin credentials are **not displayed in the student UI**. Put your own values in `server/.env`:

```env
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-private-password
```

For a fresh local demo, if these variables are omitted the backend uses a demo fallback account. Change the values before sharing/deploying.

## Important security note
This project is designed as a college/demo application. For production deployment, use a real database, HTTPS, secure session/JWT storage, rate limiting and a managed secret store. Never commit `server/.env` or any real password/API token to GitHub.
