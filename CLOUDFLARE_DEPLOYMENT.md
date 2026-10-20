# Deploying ComboPads to Cloudflare Pages (Free Tier)

ComboPads is structured for deployment on Cloudflare's free infrastructure.

## Method 1: Cloudflare Pages Direct Upload (Fastest & 100% Free)

### Step 1: Install Wrangler CLI (if not already installed)
```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare
```bash
npx wrangler login
```

### Step 3: Deploy the Static Frontend to Cloudflare Pages
```bash
npx wrangler pages deploy public --project-name combopads
```

---

## Method 2: GitHub Repository Connection (Automatic Continuous Deployment)

1. Push your project to GitHub:
   ```bash
   git add .
   git commit -m "Upgrade ComboPads Titan V9.1 Engine"
   git push origin main
   ```
2. Log into [Cloudflare Dashboard](https://dash.cloudflare.com) -> **Workers & Pages** -> **Create Application** -> **Pages** -> **Connect to Git**.
3. Select your repository `combopads`.
4. Configure Build Settings:
   - **Framework Preset**: None / Static
   - **Build output directory**: `public`
5. Click **Save and Deploy**. Your site will be live at `https://combopads.pages.dev`!

---

## Free Node.js Engine Host (Render / Railway / Fly.io)

For full server-side dynamic capabilities with SQLite database:
1. Go to [Render.com](https://render.com) (Free Tier)
2. Click **New Web Service** -> Connect GitHub repo.
3. Set **Start Command**: `npm start`
4. Environment Variables:
   - `SETUP_KEY`: `baraka-setup-2026`
   - `PORT`: `5001`
5. Deploy service.
