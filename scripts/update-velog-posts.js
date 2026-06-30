// scripts/update-velog-posts.js
// Velog RSS를 읽어서 README.md의 velog-posts 영역을 최신 글 목록으로 교체합니다.
// 실행: node scripts/update-velog-posts.js

const fs = require("fs");
const https = require("https");

const VELOG_USERNAME = "rodaka123";
const RSS_URL = `https://v2.velog.io/rss/${VELOG_USERNAME}`;
const README_PATH = "README.md";
const MAX_POSTS = 5;

const START_TAG = "<!-- velog-posts-start -->";
const END_TAG = "<!-- velog-posts-end -->";

function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        // 리다이렉트 처리
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchRSS(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function parseItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    if (title && link) {
      items.push({ title: decodeHTML(title), link: link.trim(), pubDate });
    }
  }
  return items;
}

function extractTag(block, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const m = block.match(regex);
  if (!m) return null;
  return m[1].replace("<![CDATA[", "").replace("]]>", "").trim();
}

function decodeHTML(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatDate(pubDate) {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function buildMarkdown(items) {
  if (items.length === 0) {
    return "_아직 게시된 포스트가 없습니다._";
  }
  return items
    .slice(0, MAX_POSTS)
    .map((item) => {
      const date = formatDate(item.pubDate);
      return `- [${item.title}](${item.link})${date ? `  \`${date}\`` : ""}`;
    })
    .join("\n");
}

async function main() {
  console.log(`Fetching RSS: ${RSS_URL}`);
  const xml = await fetchRSS(RSS_URL);
  const items = parseItems(xml);
  console.log(`Found ${items.length} posts`);

  const markdown = buildMarkdown(items);

  let readme = fs.readFileSync(README_PATH, "utf-8");

  const startIdx = readme.indexOf(START_TAG);
  const endIdx = readme.indexOf(END_TAG);

  if (startIdx === -1 || endIdx === -1) {
    console.error("README.md에 velog-posts-start / velog-posts-end 마커가 없습니다.");
    process.exit(1);
  }

  const before = readme.slice(0, startIdx + START_TAG.length);
  const after = readme.slice(endIdx);

  const updated = `${before}\n${markdown}\n${after}`;

  fs.writeFileSync(README_PATH, updated, "utf-8");
  console.log("README.md updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});