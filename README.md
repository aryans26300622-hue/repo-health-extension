# Repo Health Panel

A Chrome extension that shows a quick health score for any public GitHub repository, right on the repo page.

Open a repo like github.com/facebook/react and a small panel appears in the bottom-right corner with a score out of 100 and a checklist of what is good and what is missing.

## What it checks (7 checks)

- README exists
- LICENSE exists
- .gitignore exists
- No sensitive files committed (.env files, .pem / .p12 / .pfx keys, id_rsa)
- No junk files committed (node_modules, .DS_Store, Thumbs.db)
- Active in the last 90 days
- Live demo / website link set

The score is the share of checks that pass. Failed checks for sensitive and junk files also list the first few files that were found.

## Install (unpacked)

1. Download or clone this repo.
2. Open chrome://extensions and turn on Developer mode.
3. Click Load unpacked and select the repo folder.
4. Open any public repo on github.com.

## Privacy and permissions

- Only one permission: access to api.github.com, to read public repo data.
- The extension runs only on github.com pages.
- No login, no API key, no tracking. Results are cached in memory for 10 minutes and nothing is stored on disk.
- Repo file names are shown using textContent, never innerHTML, so a repo cannot inject HTML into the panel.

## How it works

1. Reads the owner and repo name from the page URL.
2. Calls the public GitHub API: one call for repo info and one call for the full file list.
3. Runs the checks and draws the panel.
4. Watches for GitHub's in-page navigation and updates the panel when you open another repo.

## Known limitations

- Public repos only. Private repos show a friendly message.
- GitHub allows about 60 unauthenticated API requests per hour. Each new repo uses 2 requests, and the in-memory cache avoids repeats. When the limit is hit, the panel says so.
- Files inside test, fixture and example folders are ignored by the sensitive-file check to avoid false alarms, so a real secret hidden there would be missed.
- Some flagged files may be harmless (for example, development certificates), because the checker only looks at file names, not contents.
- Very large repos can have a truncated file list from GitHub.

## Ideas for later

- Checks for tests, CI and releases
- Optional GitHub token for higher rate limits
- Auto-fix suggestions

## License

MIT