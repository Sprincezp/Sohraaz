# SOHRAAZ AI — Cloudflare Worker deploy (10 minutes)

**Goal:** Sohraaz Assistant ko live AI banao — customer ke har query ka human-like, in-house salesperson jaisa jawab. Key sirf aapke Cloudflare me secret rahegi; GitHub repo/live site kabhi nahi dekhegi.

**Cost:** Workers free plan = 100,000 requests/day (hamare size pe infinity traffic). Gemini API = Google AI Studio ka free tier / pay-as-you-go (flash model sasta).

---

## Step 1 — Gemini API key (fresh banayein — purani recommend nahi)

Desktop wali test key abhi tak sirf aapke computer pe hai — lekin best practice:

1. https://aistudio.google.com/apikey kholon
2. **Create API key** → project wahi rehne do (Google AI Studio project)
3. Purani key (test11 wali) pe baad me **Delete** ka stamp lagao (ya regenerate)
4. New key copy karke notes me raho (dikhega ek baar hi)

> ⚠️ Key ko kabhi git commit, chat message, screenshot ya repo file me mat likho.

## Step 2 — Worker create (dashboard, no CLI)

1. https://dash.cloudflare.com → login (account free)
2. **Workers & Pages** → **Create application** → **Create Worker**
3. Name: `sohraaz-ai` → **Deploy** (hello world deploy hoga, koi time nahi lagta)
4. **Edit code** → pura code select karke delete → **`sohraaz-ai-worker.js` ka poora content paste** → **Deploy**
5. Left sidebar → **Settings** → **Variables and Secrets** →
   - Variable name: `GEMINI_API_KEY`
   - Value: (Step 1 wali key) → **Save**
6. **Deployments** tab → top-right **Deploy** (taaki new env var activate ho)
7. Worker URL copy: `https://sohraaz-ai.<your-subdomain>.workers.dev`

## Step 3 — Site me URL paste karo

Dono files me ek hi line hai:

```js
const AI_ENDPOINT = "";
```

Dono me apna worker URL paste karo:

```js
const AI_ENDPOINT = "https://sohraaz-ai.<your-subdomain>.workers.dev";
```

Files:
- `site-template/index.html` (homepage chat)
- `site-template/sohraaz-full-store-template.html` (store chat)

Phir commit + push — worker URL **secret nahi hai** (domain jaisa), push karna safe hai.

## Step 4 — Test (5 min)

Site kholo, bot se poocho:
- "Haldi ke liye kya le sakte hoon? +91 91239 47668 pe order karna chahta hoon"
- "Size kya loon, chest 36 hai"
- "Wedding sherwani ka price?"
- "Bhai 1000 me sherwani milegi kya?" (bargaining — dekhna boss handling)
- "Main damage hua order laaya hoon" (complaint — dekhna escalation)
- "Are you a bot?" (honest answer check)

Chip test: chips tap → AI reply aaye. "Track my order" → AI order-status answer.

## Step 5 — Fallback behavior (already wired)

- Worker down / Gemini error / timeout → bot automatically **canned KB** pe fallback — customer kabhi error nahi dekhega.
- `AI_ENDPOINT` empty → pura canned mode.

---

## Honesty guardrails jo worker me baked hain

1. Address/timing customer ko WhatsApp pe confirm karwayega (store address verified nahi — AGENTS.md N6 list me hai)
2. Shaadi/bulk/bulk-barganing/barter → **humans pe route**, kabhi khud negotiate nahi karega
3. Damaged order/complaint → apology + WhatsApp escalation, kabhi coupon-appeasement nahi
4. "Are you a bot?" → honest "Sohraaz Assistant — in-house AI"
5. Stock/price/dates **invent nahi karega** — nahi pata to WhatsApp route
6. Payment details kabhi nahi maangega (scam protection)

## Cost estimate (honest)

- Worker: $0 (100k req/day free)
- Gemini Flash: AI Studio free tier me start — beyond that ~pennies per 1k tokens; 500 conversions/month pe cost negligible
- Agar traffic bohot badhe to Cloudflare caching + Gemini context caching laga sakte hain — PR pe main optimize kar dunga

## Troubleshooting

| Problem | Fix |
|---|---|
| Bot asks to WhatsApp for everything | Worker URL check karo `AI_ENDPOINT` me; browser console dekho (F12 → Console) — "ai http" error ho to worker env var check |
| CORS error | Origin check me sirf sprincezp.github.io + sohraaz.com allowed — local file se test kar rahe ho to works (null origin allowed); live domain alag ho to worker ALLOWED list me add karo |
| Gemini 429 | Google quota exhausted — aistudio me billing enable ya wait |
| Worker edits not applying | Save → Deployment tab → explicit **Deploy** click |
