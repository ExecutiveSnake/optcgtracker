# OPTCG Manager

One Piece TCG Collection & Deck Manager — React + Vite PWA

## Deploy to GitHub + Vercel (Free)

### Step 1 — GitHub
1. Go to github.com and sign in (or create a free account)
2. Click **+ New repository** — name it `optcg-manager`, set to Public, click Create
3. Upload all these files by clicking **uploading an existing file**
4. Drag the entire project folder contents in and click **Commit changes**

### Step 2 — Vercel
1. Go to vercel.com and sign in with your GitHub account
2. Click **Add New → Project**
3. Find `optcg-manager` and click **Import**
4. Leave all settings as default — Vercel auto-detects Vite
5. Click **Deploy**
6. You get a live URL like `optcg-manager.vercel.app`

### Step 3 — Install on phone
1. Open the Vercel URL in Safari (iPhone) or Chrome (Android)
2. Tap Share → **Add to Home Screen**
3. Done — it's installed as a PWA

## First Use
- Open the app → go to **Settings → Clear Cache & Re-sync**
- Wait for all cards to load (first time takes ~30-60 seconds)
- The card count will show in Settings when complete

## Local Development
```bash
npm install
npm run dev
```
Then open http://localhost:5173

## Build
```bash
npm run build
# Output goes to /dist — drag this to Netlify Drop if preferred
```
