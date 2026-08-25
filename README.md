# SocialCare – Updated Browser Tracking + AI Plastic Reuse

## What changed

### Mobile Usage Control
- No manual usage-minute input.
- Tracking starts automatically when the SocialCare website opens.
- Moving between Home, Mobile, Health, Food, Cyber and Environment does not reset the timer because the tracker lives in the top-level React app.
- Today's browser-visible SocialCare session time is saved in `localStorage` and synced to the Express backend.
- If the tab becomes hidden, the browser timer pauses and resumes when the user returns.
- At 0 minutes the daily mobile score remains 0/20. Once real usage is recorded and the total is still within 30 minutes, it becomes 20/20. Above 30 minutes it becomes 0/20 and an alert is created.
- Browser notifications are requested when the target is crossed.
- **Limitation:** a normal website cannot read the full phone's screen-on time or usage of other apps. Device-wide tracking requires Android system access.

### Plastic Reduction
- Removed the item-name textbox.
- Student uploads a photo only.
- The browser uses the Hugging Face Transformers.js `Xenova/clip-vit-base-patch32` zero-shot image model to identify common plastic items directly from the uploaded photo.
- No item-name textbox is required.
- The detected item is sent to the backend, which returns item-specific craft/reuse ideas.
- An optional server-side Hugging Face Inference API remains available, but the main browser AI path does not require an HF token.

## Run

### Install
```bash
npm run install-all
```

### Terminal 1
```bash
npm run server
```

### Terminal 2
```bash
npm run client
```

Open the Vite URL shown by Terminal 2.

## Hugging Face setup

1. Create a Hugging Face access token with Inference Providers permission.
2. Copy `.env.example` to `.env` inside `server`.
3. Put the token in:
```env
HF_TOKEN=hf_your_token_here
```
4. Restart the server.

The API uses the Hugging Face Inference Providers image-classification task. See the official docs for the supported task and model examples.
