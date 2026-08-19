# 🥘 Potluck

**Everyone brings a time. The meeting appears.**

Nobody plans a potluck. Everyone shows up with whatever they've got, and dinner happens anyway. Scheduling works the same way when you stop trying to control it — put the times on the table, send one link, and let the meeting cook itself.

Potluck does one thing: group polls for meetings. Pick a length, pick your times, share a link, watch the ticks land. No accounts, no sign-ups, no paywall on the fourth time option.

---

## What it does

Pick a meeting length (15, 30, 60, 90 minutes, or type your own). Tap days on a calendar. Add as many times to each day as you want — genuinely unlimited, that's the whole point. Hit create and you get a link.

Anyone with that link types their name and ticks the times that work. No login, ever. They can mark a slot as *works*, *if need be*, or *can't do it*, and leave a short note. The leading time floats to the top automatically, and anyone can change their answer later from the same browser.

---

## Setting it up

Two halves: the website (GitHub) and the place answers get stored (Supabase). Both free. Budget about twenty minutes and you never have to touch it again.

### Step 1 — Try it first, no setup

Double-click `index.html` on your computer. It opens in your browser and everything works — you can build a poll and vote on it. The only catch is that in this mode answers save only in *your* browser, so share links won't reach anyone else. It's there so you can feel the thing before committing to setup.

### Step 2 — Make a Supabase project

Supabase is the free database that lets other people's answers actually save somewhere.

Go to [supabase.com](https://supabase.com), sign up, and click **New project**. Give it a name (Potluck works), let it pick a password for you, choose the region closest to you, and create it. It takes a minute or two to spin up.

Once it's ready, find **SQL Editor** in the left sidebar. Open the file `supabase-setup.sql` from this folder in any text editor, copy everything in it, paste it into the SQL Editor, and click **Run**. You should see "Success. No rows returned." That's it — your tables exist.

### Step 3 — Connect the two

You need two values, and Supabase keeps them on two different pages. It renamed both of these in 2025, so older guides send you to the wrong place.

**The key** lives at **Settings → API Keys** (its own sidebar item — *not* Settings → API). What you see there depends on how old your project is:

- Newer projects show a **Publishable key** starting with `sb_publishable_…` — use that one.
- Older projects show an **anon public** key, a long `xxxxx.yyyyy.zzzzz` string — use that one.

Either works. If the page shows tabs, the one you want is *Publishable and secret API keys*. Ignore anything labelled **secret** or **service_role** — those must never go in this file.

**The URL** lives at **Settings → Data API**, listed as *Project URL*. It looks like `https://abcdefgh.supabase.co`. Faster route: click the green **Connect** button at the top of the dashboard and both values are shown together.

Open `config.js` in a text editor and paste them between the quote marks. Save.

The publishable/anon key is *meant* to be public — it's built to sit in a browser. The database rules in `supabase-setup.sql` are what actually keep things safe: anyone can create a poll and add an answer, but nobody can edit or delete your polls.

### Step 4 — Put it on GitHub

Go to [github.com](https://github.com) and make a new repository. Call it `potluck`. Make it **Public** (GitHub Pages is only free for public repos). Don't tick any of the "initialize with" boxes.

On the next screen, click **uploading an existing file**. Drag in every file from this folder: `index.html`, `styles.css`, `app.js`, `config.js`, `supabase-setup.sql`, `README.md`, and `.nojekyll`. Click **Commit changes**.

> If `.nojekyll` doesn't appear when you drag — your computer hides files starting with a dot. On Mac press `Cmd + Shift + .` in Finder to show them. It's a tiny empty file that tells GitHub not to get clever with your files.

### Step 5 — Turn the website on

In your repository, go to **Settings → Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, branch to **main**, folder to **/ (root)**, and Save.

Wait two or three minutes, refresh, and GitHub shows you your live address: `https://yourusername.github.io/potluck/`

Open it. Make a poll. Send the link to your own phone and vote from there. If the answer shows up on both screens, everything's wired correctly.

---

## Making changes later

Every file is editable straight in GitHub — click the file, click the pencil icon, edit, commit. The site updates itself in a minute or two.

- **Colours and fonts** live at the very top of `styles.css`, in the block starting `:root{`. Change `--accent` to change the orange everywhere.
- **The words** are all in `app.js` — searchable in plain English.
- **The quick-add time buttons** (9am, 10am, and so on) are the `QUICK` list near the top of `app.js`.
- **The duration presets** are the `preset` list inside `renderDurations` in `app.js`.

### Using your own domain

Buy a domain, then in **Settings → Pages** put it in the "Custom domain" box. GitHub tells you the DNS records to add at your registrar. `potluck.dinner` is available-sounding and would be a genuinely excellent use of money.

---

## Troubleshooting

**"Couldn't save that" when creating a poll.** Your `config.js` values are probably wrong, or the SQL didn't run. Re-copy the key from Settings → API Keys and the URL from Settings → Data API, then re-run `supabase-setup.sql`.

**Can't find the anon key anywhere.** Supabase renamed the page. It's **Settings → API Keys** now, and on newer projects the key is called **Publishable key** and starts with `sb_publishable_` instead of being a long dotted string. Same thing, same slot in `config.js`.

**Still says "Demo mode" at the bottom.** `config.js` is still blank, or the changes weren't saved and committed. Check the file on GitHub itself to confirm your values are actually in there.

**Share link says "Nothing here".** If the badge says demo mode, that's expected — demo polls only exist in the browser that made them. Once Supabase is connected, links work anywhere.

**Page loads blank.** Confirm `.nojekyll` made it into the repo, and that all files sit at the top level rather than inside a subfolder.

---

## What's deliberately not here

No accounts. No email notifications. No calendar sync. No time zones. No "upgrade to add a fifth option."

Potluck answers one question — *when can this group meet* — and then gets out of the way. If it ever needs a pricing page, something has gone wrong.

---

Free to use, change, and rename. It's yours.
