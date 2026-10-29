// ⭐ Pages that look like /owner/repo but are not repos
const RESERVED = [
  "settings", "topics", "orgs", "marketplace", "explore", "notifications",
  "pulls", "issues", "search", "login", "sponsors", "features", "about",
  "pricing", "new"
];

// ⭐ Folders that hold test data, not real project secrets
const SAFE_DIRS = ["fixtures", "__fixtures__", "test", "tests", "__tests__", "example", "examples", "sample", "samples"];

// ---------- Reading the page ----------

function getRepoFromUrl() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo] = parts;
  if (RESERVED.includes(owner)) return null;
  return { owner, repo };
}

// ---------- GitHub API ----------

async function fetchRepoInfo({ owner, repo }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (res.status === 403 || res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (!res.ok) throw new Error("HTTP_" + res.status);
  return res.json();
}

async function fetchTree({ owner, repo }, branch) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  );
  if (res.status === 403 || res.status === 429) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error("HTTP_" + res.status);
  return res.json();
}

// ---------- Checks ----------

function inSafeDir(path) {
  const folders = path.toLowerCase().split("/").slice(0, -1);
  return folders.some((d) => SAFE_DIRS.includes(d));
}

// ⭐ Every check returns { check, pass, found }
function runFileChecks(paths) {
  const rootFiles = paths.filter((p) => !p.includes("/")).map((p) => p.toLowerCase());
  const fileName = (p) => p.split("/").pop().toLowerCase();

  const sensitive = paths.filter((p) => {
    if (inSafeDir(p)) return false;
    const f = fileName(p);
    const isEnv = f === ".env" || (f.startsWith(".env.") && !/\.(example|sample|template)$/.test(f));
    return isEnv || /\.(pem|p12|pfx)$/.test(f) || f === "id_rsa";
  });

  const junk = paths.filter((p) => {
    const parts = p.split("/");
    return parts.includes("node_modules") || fileName(p) === ".ds_store" || fileName(p) === "thumbs.db";
  });

  return [
    { check: "README exists", pass: rootFiles.some((f) => f.startsWith("readme")) },
    { check: "LICENSE exists", pass: rootFiles.some((f) => /^(license|licence|copying)/.test(f)) },
    { check: ".gitignore exists", pass: rootFiles.includes(".gitignore") },
    { check: "No sensitive files committed", pass: sensitive.length === 0, found: sensitive.slice(0, 5).join(", ") },
    { check: "No junk files committed", pass: junk.length === 0, found: junk.slice(0, 5).join(", ") },
  ];
}

// ⭐ Checks that use the repo info we already fetched (no extra API call)
function runInfoChecks(data) {
  const daysSincePush = (Date.now() - new Date(data.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
  return [
    { check: "Active in the last 90 days", pass: daysSincePush <= 90 },
    { check: "Live demo / website link set", pass: Boolean(data.homepage && data.homepage.trim()) },
  ];
}


// ⭐ One short "how to fix" tip per check (shown only when the check fails)
const FIXES = {
  "README exists": "Add a README.md that explains what the project does and how to run it.",
  "LICENSE exists": "Add a LICENSE file. choosealicense.com helps you pick one.",
  ".gitignore exists": "Add a .gitignore so build and editor files stay out of the repo.",
  "No sensitive files committed": "Remove these files, add them to .gitignore, and replace any real keys, because they stay in git history.",
  "No junk files committed": "Remove these files and add them to .gitignore (for example node_modules/ and .DS_Store).",
  "Active in the last 90 days": "Push a small update, or say in the README that the project is complete.",
  "Live demo / website link set": "Add your live link in the repo's About section, in the Website field.",
};

// ---------- The panel ----------

// ⭐ Small helper: creates an element and sets its text safely (no innerHTML)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function removePanel() {
  const old = document.getElementById("rhp-panel");
  if (old) old.remove();
}

// ⭐ Builds the empty panel shell and returns its body to fill
function createPanel() {
  removePanel();
  const panel = el("div", "rhp-panel");
  panel.id = "rhp-panel";

  const header = el("div", "rhp-header");
  header.appendChild(el("span", "rhp-title", "Repo Health"));
  const close = el("button", "rhp-close", "×");
  close.addEventListener("click", removePanel);
  header.appendChild(close);

  const body = el("div", "rhp-body");
  panel.appendChild(header);
  panel.appendChild(body);
  document.documentElement.appendChild(panel);
  return body;
}

function showMessage(text) {
  const body = createPanel();
  body.appendChild(el("p", "rhp-message", text));
}

function showResults(checks) {
  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);
  const level = score >= 80 ? "rhp-good" : score >= 50 ? "rhp-ok" : "rhp-bad";

  const body = createPanel();
  body.appendChild(el("div", "rhp-score " + level, score + "/100"));

  const list = el("ul", "rhp-list");
  for (const c of checks) {
    const item = el("li", "rhp-item");
    item.appendChild(el("span", "rhp-icon", c.pass ? "✅" : "❌"));
    item.appendChild(el("span", "rhp-label", c.check));
    if (!c.pass && c.found) item.appendChild(el("div", "rhp-found", c.found));
    if (!c.pass && FIXES[c.check]) item.appendChild(el("div", "rhp-fix", "💡 " + FIXES[c.check]));
    list.appendChild(item);
  }
  body.appendChild(list);
}

// ⭐ Turn error codes into friendly messages
function errorText(code) {
  if (code === "RATE_LIMIT") return "GitHub's request limit was reached. Please try again in a few minutes.";
  if (code === "NOT_FOUND") return "This repo is private or doesn't exist, so it can't be checked.";
  return "Something went wrong while checking this repo (" + code + ").";
}

// ---------- Start ----------

const CACHE_MINUTES = 10;
const cache = new Map(); // "owner/repo" -> { time, checks }
let currentKey = null;

// ⭐ Return cached results if fresh, otherwise call the API
async function getChecks(repoInfo) {
  const key = repoInfo.owner + "/" + repoInfo.repo;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_MINUTES * 60 * 1000) return hit.checks;

  const data = await fetchRepoInfo(repoInfo);
  const tree = await fetchTree(repoInfo, data.default_branch);
  const paths = tree.tree.filter((t) => t.type === "blob").map((t) => t.path);
  const checks = [...runFileChecks(paths), ...runInfoChecks(data)];

  cache.set(key, { time: Date.now(), checks });
  return checks;
}

// ⭐ Runs whenever the page might have changed to a different repo
async function update() {
  const repoInfo = getRepoFromUrl();
  const key = repoInfo ? repoInfo.owner + "/" + repoInfo.repo : null;

  if (key === currentKey) return; // same repo, nothing to do
  currentKey = key;

  if (!repoInfo) {
    removePanel(); // left the repo (e.g. went to a profile page)
    return;
  }

  showMessage("Checking repository…");
  try {
    const checks = await getChecks(repoInfo);
    if (key !== currentKey) return; // user already moved on, ignore this result
    showResults(checks);
  } catch (err) {
    if (key !== currentKey) return;
    showMessage(errorText(err.message));
  }
}

update();
setInterval(update, 500); // ⭐ GitHub changes pages without reloading, so we check the URL twice a second