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

async function init() {
  const repoInfo = getRepoFromUrl();
  if (!repoInfo) {
    console.log("Repo Health Panel: not a repo page");
    return;
  }
  try {
    const data = await fetchRepoInfo(repoInfo);
    console.log(
      "Repo:", data.full_name,
      "| license:", data.license?.spdx_id ?? "none",
      "| homepage:", data.homepage || "none",
      "| default branch:", data.default_branch
    );
  } catch (err) {
    console.log("Repo Health Panel error:", err.message);
  }
}

init();