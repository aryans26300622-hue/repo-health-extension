// ⭐ Pages that look like /owner/repo but are not repos
const RESERVED = [
  "settings", "topics", "orgs", "marketplace", "explore", "notifications",
  "pulls", "issues", "search", "login", "sponsors", "features", "about",
  "pricing", "new"
];

// ⭐ Read owner and repo name from the URL: /facebook/react -> facebook, react
function getRepoFromUrl() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo] = parts;
  if (RESERVED.includes(owner)) return null;
  return { owner, repo };
}

// ⭐ One public API call for the basic repo info (no login, no key)
async function fetchRepoInfo({ owner, repo }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (res.status === 403 || res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (!res.ok) throw new Error("HTTP_" + res.status);
  return res.json();
}

// ⭐ One API call returns every file path in the repo
async function fetchTree({ owner, repo }, branch) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  );
  if (res.status === 403 || res.status === 429) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error("HTTP_" + res.status);
  return res.json();
}

// ⭐ Every check returns { check, pass }
// ⭐ Folders that hold test data, not real project secrets
const SAFE_DIRS = ["fixtures", "__fixtures__", "test", "tests", "__tests__", "example", "examples", "sample", "samples"];

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
async function init() {
  const repoInfo = getRepoFromUrl();
  if (!repoInfo) {
    console.log("Repo Health Panel: not a repo page");
    return;
  }
  try {
    const data = await fetchRepoInfo(repoInfo);
    const tree = await fetchTree(repoInfo, data.default_branch);
    const paths = tree.tree.filter((t) => t.type === "blob").map((t) => t.path);

    if (tree.truncated) console.log("Repo Health Panel: file list was truncated (very large repo)");
    console.table(runFileChecks(paths));
  } catch (err) {
    console.log("Repo Health Panel error:", err.message);
  }
}

init();