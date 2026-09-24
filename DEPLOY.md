# Deploying

Everything below has been verified against the current build except the parts
marked **you**, which need your account or your domain.

---

## 1. Push to GitHub

The repo already points at `https://github.com/YoussefElshafei/portfolio` on
`main`. Vercel deploys from there.

```
git add -A
git commit -m "..."
git push origin main
```

## 2. Create the Vercel project

**Dashboard route** (simplest, and sets up automatic deploys):

1. Go to `vercel.com/new`.
2. **You:** sign in with the GitHub account that owns the repo and grant Vercel
   access to it.
3. Pick `YoussefElshafei/portfolio`.
4. Leave every build setting alone. Vercel detects Next.js and uses
   `next build`; there is no custom output directory and no install flags.
5. Deploy.

**CLI route**, if you prefer:

```
npm i -g vercel
vercel login
vercel          # preview deployment
vercel --prod   # production
```

First run asks which scope and whether to link to an existing project. Answer
no to "override settings".

Nothing needs a Node version pin. The build runs `next build`, which type-checks
and lints as part of the build, so a type error fails the deploy rather than
shipping.

## 3. Environment variables

Only one, and only once you have a domain:

| Name | Value | Where |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | Vercel → Settings → Environment Variables → Production |

This sets `metadataBase`, which makes the Open Graph and canonical URLs
absolute. Without it the site falls back to Vercel's own production hostname,
which is correct but means link previews cite `*.vercel.app` rather than your
domain. Redeploy after adding it — environment variables are baked in at build
time for `NEXT_PUBLIC_*`.

## 4. Custom domain

**You:** buy the domain first. Any registrar works — Namecheap, Cloudflare,
Porkbun. Vercel also sells domains, which skips the DNS step entirely and is
worth the small premium if you would rather not touch records.

Then:

1. Vercel → your project → **Settings → Domains → Add**.
2. Enter the apex (`yourdomain.com`). Add `www.yourdomain.com` too; Vercel will
   offer to redirect one to the other. Redirecting `www` → apex is the usual
   choice.
3. Vercel shows you the exact DNS records to create. **Use the values it shows
   you**, not values from a tutorial — they occasionally differ by account and
   region. At the time of writing the standard pair is:

   | Type | Name | Value |
   |---|---|---|
   | `A` | `@` | `76.76.21.21` |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

4. **You:** add those records at your registrar's DNS panel.
5. Wait for propagation — usually minutes, occasionally up to a few hours.
   Vercel's domain page shows a live status and issues the TLS certificate
   automatically once the records resolve. You do not need to configure HTTPS.

If your registrar is Cloudflare, set the records to **DNS only** (grey cloud),
not proxied. Cloudflare's proxy in front of Vercel causes certificate issuance
to fail.

## 5. Résumé PDF

**You:** supply the file. Then:

1. Put it at `public/youssef-elshafei-resume.pdf`.
2. In `src/config/site.ts`, set:

   ```ts
   export const RESUME_PATH = "/youssef-elshafei-resume.pdf";
   ```

3. Commit and push.

A "Download résumé" link then appears in the Contact section. While
`RESUME_PATH` is `""` no link renders at all — deliberately, because a résumé
button that 404s is one of the anti-patterns in `DESIGN_BRIEF.md` §1c. Anything
in `public/` is served from the site root, so the path is the filename with a
leading slash.

## 6. After the first production deploy

Worth doing once, in this order:

- Open the deployment on a phone, not just a narrow browser window.
- Paste the URL into Slack, iMessage or LinkedIn and confirm the preview card
  renders — that exercises `/opengraph-image`, which is generated at build time.
- Run Lighthouse from Chrome DevTools against the **production** URL, mobile
  preset. Dev-mode numbers are meaningless; the dev overlay alone adds a tab
  stop and a chunk of JavaScript that never ships.
- Check both themes, and check with the OS set to reduce motion.

## What is already handled

- HTTPS, certificate renewal, CDN and compression — Vercel does all of it.
- `next/image` optimisation — works on Vercel with no configuration.
- Caching — every route is static (`○` in the build output), so pages are
  served from the edge.
- No database, no API keys, no server runtime, no secrets to rotate.
