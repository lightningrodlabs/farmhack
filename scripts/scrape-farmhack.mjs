#!/usr/bin/env node
/**
 * Scrape tool data from farmhack.org and output JSON compatible
 * with the FarmHack Holochain app's admin import format.
 *
 * Usage:
 *   cd scripts && npm install && node scrape-farmhack.mjs
 *   node scrape-farmhack.mjs --dev      # scrape 10 tools (default)
 *   node scrape-farmhack.mjs --dev 50   # scrape 50 tools
 *
 * Output: farmhack-scraped.json (or farmhack-scraped-dev.json in dev mode)
 */

import cheerio from "cheerio";
import TurndownService from "turndown";
import { writeFileSync } from "fs";
import { Buffer } from "buffer";

const devIndex = process.argv.indexOf("--dev");
const DEV_MODE = devIndex !== -1;
const DEV_LIMIT = DEV_MODE && process.argv[devIndex + 1] && !process.argv[devIndex + 1].startsWith("-")
  ? parseInt(process.argv[devIndex + 1], 10)
  : 10;

const BASE_URL = "https://farmhack.org";
const TOOLS_URL = `${BASE_URL}/tools`;
const DELAY_MS = 500;

// Set up turndown for HTML -> markdown conversion
const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  console.log(`  Fetching: ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }
  return resp.text();
}

/**
 * Convert a Drupal image style URL to the original full-size URL.
 * e.g. /sites/default/files/styles/medium/public/tools/image-gallery/foo.jpg.webp
 *   -> /sites/default/files/tools/image-gallery/foo.jpg
 */
function toFullSizeImageUrl(src) {
  let url = src;
  // Strip Drupal image style path: styles/STYLENAME/public/
  url = url.replace(/\/styles\/[^/]+\/public\//, "/");
  // Strip .webp suffix added by Drupal's WebP conversion
  url = url.replace(/\.webp(\?.*)?$/, "$1");
  // Strip query params (itok tokens, etc.)
  url = url.replace(/\?.*$/, "");
  return url;
}

/**
 * Extract the actual embed URL from a Drupal oEmbed proxy URL or raw video URL.
 * Input:  /media/oembed?url=https%3A//www.youtube.com/watch%3Fv%3DabcXYZ&...
 * Output: https://www.youtube.com/embed/abcXYZ
 */
function extractVideoEmbedUrl(rawUrl) {
  if (!rawUrl) return null;

  let videoUrl = rawUrl;

  // Handle Drupal oEmbed proxy URLs
  if (videoUrl.includes("/media/oembed")) {
    try {
      const parsed = new URL(videoUrl, BASE_URL);
      const innerUrl = parsed.searchParams.get("url");
      if (innerUrl) videoUrl = innerUrl;
    } catch {
      return null;
    }
  }

  // YouTube watch URL -> embed
  const ytWatch = videoUrl.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;

  // YouTube shorts -> embed
  const ytShorts = videoUrl.match(/youtube\.com\/shorts\/([^?&]+)/);
  if (ytShorts) return `https://www.youtube.com/embed/${ytShorts[1]}`;

  // youtu.be short URL -> embed
  const ytShort = videoUrl.match(/youtu\.be\/([^?&]+)/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;

  // Already an embed URL
  if (videoUrl.includes("youtube.com/embed/")) return videoUrl;

  // Vimeo -> embed
  const vimeo = videoUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  // Unknown format, return as-is
  return videoUrl;
}

async function fetchFileAsBase64(url, defaultName = "file", defaultType = "application/octet-stream") {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get("content-type") || defaultType;
    return {
      data: buf.toString("base64"),
      file: {
        name: decodeURIComponent(url.split("/").pop().split("?")[0] || defaultName),
        size: buf.length,
        file_type: contentType,
        last_modified: Date.now(),
      },
    };
  } catch (e) {
    console.warn(`  Warning: could not fetch file ${url}: ${e.message}`);
    return null;
  }
}

async function fetchImageAsBase64(url) {
  return fetchFileAsBase64(url, "image.jpg", "image/jpeg");
}

let hashCounter = 0;
function placeholderHash() {
  hashCounter++;
  const buf = new Uint8Array(39);
  buf[0] = 0x84;
  buf[1] = 0x29;
  buf[2] = 0x24;
  const str = String(hashCounter).padStart(36, "0");
  for (let i = 0; i < 36; i++) {
    buf[3 + i] = str.charCodeAt(i);
  }
  return Buffer.from(buf).toString("base64");
}

/**
 * Remove "Attached files" sections from markdown when the listed files
 * match files we've already captured separately as attachments.
 */
function stripAttachedFilesSection(markdown, attachedFileNames) {
  if (!markdown || attachedFileNames.length === 0) return markdown;

  const normalizedNames = new Set(attachedFileNames.map(n => n.toLowerCase().trim()));
  const lines = markdown.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const stripped = lines[i].replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim().toLowerCase();
    if (stripped === "attached files" || stripped === "attached file") {
      const sectionStart = i;
      i++;
      // Collect link texts, skipping blank lines and short Drupal label remnants (e.g. "File")
      const linkNames = [];
      while (i < lines.length) {
        const line = lines[i].trim();
        if (line === "") { i++; continue; }
        const linkMatch = line.match(/^\[([^\]]+)\]\(.+\)$/);
        if (linkMatch) {
          // Unescape markdown characters (turndown escapes underscores, etc.)
          linkNames.push(linkMatch[1].replace(/\\(.)/g, "$1").toLowerCase().trim());
          i++;
          continue;
        }
        // Skip short non-link text (Drupal field labels like "File")
        if (line.length <= 20 && !/^#{1,6}\s/.test(line)) { i++; continue; }
        break;
      }
      // Skip trailing blank lines
      while (i < lines.length && lines[i].trim() === "") i++;

      // If all link texts match our captured file names, drop the section
      if (linkNames.length > 0 && linkNames.every(n => normalizedNames.has(n))) {
        continue;
      }
      // Otherwise keep it
      for (let j = sectionStart; j < i; j++) result.push(lines[j]);
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join("\n").trim();
}

/**
 * Convert HTML to markdown, cleaning up Drupal artifacts.
 */
function htmlToMarkdown(html) {
  if (!html) return "";
  // Clean up Drupal field wrappers before conversion
  const $ = cheerio.load(html, null, false);
  // Remove Drupal field wrapper divs but keep their content
  $(".field__item, .field__items, .field--name-body").each((_, el) => {
    $(el).replaceWith($(el).html());
  });
  const cleaned = $.html();
  if (!cleaned || !cleaned.trim()) return "";
  return turndown.turndown(cleaned).trim();
}

/**
 * Scrape the listing pages to get all tool URLs.
 */
async function scrapeToolUrls() {
  const urls = [];
  let page = 0;

  while (true) {
    const html = await fetchPage(`${TOOLS_URL}?page=${page}`);
    const $ = cheerio.load(html);

    const links = [];
    $("article.node--type-tool h3 a, article[class*='node--type-tool'] h3 a").each(
      (_, el) => {
        const href = $(el).attr("href");
        if (href) {
          links.push(href.startsWith("http") ? href : `${BASE_URL}${href}`);
        }
      }
    );

    if (links.length === 0) {
      $("h3 a[href*='/tools/']").each((_, el) => {
        const href = $(el).attr("href");
        if (href && !href.includes("?") && href.includes("/tools/")) {
          links.push(href.startsWith("http") ? href : `${BASE_URL}${href}`);
        }
      });
    }

    if (links.length === 0) {
      console.log(`  No tools found on page ${page}, stopping.`);
      break;
    }

    urls.push(...links);
    console.log(`  Page ${page}: found ${links.length} tools (total: ${urls.length})`);

    if (DEV_MODE && urls.length >= DEV_LIMIT) break;

    const hasNext = $('a:contains("Next page"), a[rel="next"]').length > 0;
    if (!hasNext) break;

    page++;
    await sleep(DELAY_MS);
  }

  const deduped = [...new Set(urls)];
  return DEV_MODE ? deduped.slice(0, DEV_LIMIT) : deduped;
}

/**
 * Scrape a single tool detail page.
 */
async function scrapeTool(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Title
  const title = $("h1").first().text().trim() || $("title").text().split("|")[0].trim();

  // Tool Concept section
  const conceptSection = $("#farmhack-tool-concept .accordion-body");

  // Stage/status
  let status = "Concept";
  const stageBadge =
    conceptSection.find(".badge.text-bg-secondary").text().trim() ||
    $(".badge.text-bg-secondary").first().text().trim();
  if (stageBadge) {
    status = stageBadge;
  } else {
    $('a[href*="/stages/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) status = text;
    });
  }

  // License
  let license = "";
  const licenseBadge =
    conceptSection.find(".badge.text-bg-tertiary").text().trim() ||
    $(".badge.text-bg-tertiary").first().text().trim();
  if (licenseBadge) {
    license = licenseBadge;
  } else {
    $('a[href*="/tool-licenses/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) license = text;
    });
  }

  // Description
  let description = "";
  const descField = conceptSection.find(".field--name-field-tool-description");
  if (descField.length) {
    description = descField.text().trim();
  } else {
    $(".field--name-field-tool-description").each((_, el) => {
      description = $(el).text().trim();
    });
  }

  // Tags
  const tags = [];
  $('a[href*="/tags/"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !tags.includes(text)) {
      tags.push(text);
    }
  });

  // Author
  let author = "";
  const submitted = $("article .node__submitted, .node__submitted-by, .node__meta").text();
  const byMatch = submitted.match(/[Bb]y\s+(\S+)/);
  if (byMatch) {
    author = byMatch[1].trim();
  }
  if (!author) {
    $('a[href*="/users/"], a[href*="/user/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !author) author = text;
    });
  }

  // Main image - get full-size original, not Drupal thumbnail
  let mainImage = null;
  const firstImg =
    $("#farmhack-tool-concept img").first().attr("src") ||
    $(".field--name-field-images img").first().attr("src") ||
    $("article img").first().attr("src");
  if (firstImg) {
    const fullSizePath = toFullSizeImageUrl(firstImg);
    let imgUrl = fullSizePath.startsWith("http") ? fullSizePath : `${BASE_URL}${fullSizePath}`;
    mainImage = await fetchImageAsBase64(imgUrl);
  }

  // Gallery images from documentation section (beyond the main image)
  const galleryImages = [];
  const mainImgFullSize = firstImg ? toFullSizeImageUrl(firstImg) : null;
  const seenImgPaths = new Set();
  if (mainImgFullSize) seenImgPaths.add(mainImgFullSize);

  const docImgEls = $("#farmhack-tool-documentation img, .field--name-field-images img");
  for (const el of docImgEls.toArray()) {
    const src = $(el).attr("src");
    if (!src) continue;
    const fullSize = toFullSizeImageUrl(src);
    if (seenImgPaths.has(fullSize)) continue;
    seenImgPaths.add(fullSize);
    const imgUrl = fullSize.startsWith("http") ? fullSize : `${BASE_URL}${fullSize}`;
    const imgData = await fetchImageAsBase64(imgUrl);
    if (imgData) galleryImages.push(imgData);
  }

  // Documentation section - convert to markdown
  let wiki = "";
  const docsSection = $("#farmhack-tool-documentation .accordion-body");
  if (docsSection.length) {
    const wikiField = docsSection.find(".field--name-field-wiki");
    const wikiHtml = wikiField.length ? wikiField.html() : docsSection.html();
    wiki = htmlToMarkdown(wikiHtml || "");
  }

  // Video URL - extract actual embed URL from Drupal oEmbed proxy
  let videoUrl = null;
  const iframe = docsSection.find("iframe").first().length
    ? docsSection.find("iframe").first()
    : $("iframe").first();
  if (iframe.length) {
    videoUrl = extractVideoEmbedUrl(iframe.attr("src"));
  }
  if (!videoUrl) {
    $(".field--name-field-video iframe, .media--type-remote-video iframe").each(
      (_, el) => {
        if (!videoUrl) videoUrl = extractVideoEmbedUrl($(el).attr("src"));
      }
    );
  }

  // User Manual section - convert to markdown
  let wiki2 = "";
  const manualSection = $("#farmhack-tool-manual .accordion-body");
  if (manualSection.length) {
    const wiki2Field = manualSection.find(".field--name-field-wiki2");
    const wiki2Html = wiki2Field.length ? wiki2Field.html() : manualSection.html();
    wiki2 = htmlToMarkdown(wiki2Html || "");
  }

  // Attached files from User Manual section (PDFs, documents)
  // Drupal renders both field_user_manual_files and field_documentation_files here
  const attachedFiles = [];
  const fileEls = manualSection.find('a[href*="/sites/default/files/"]').toArray();
  for (const el of fileEls) {
    const href = $(el).attr("href");
    if (!href) continue;
    // Skip image files - those are handled separately
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(href)) continue;
    const fileUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const linkText = $(el).text().trim();
    console.log(`    Attached file: ${linkText || href}`);
    const fileData = await fetchFileAsBase64(fileUrl, linkText || undefined);
    if (fileData) {
      attachedFiles.push(fileData);
    }
  }

  // Strip redundant "Attached files" listing from wiki2 since we captured them separately
  const attachedFileNames = attachedFiles.map(af => af.file.name);
  wiki2 = stripAttachedFilesSection(wiki2, attachedFileNames);

  // Skills section - convert to markdown
  let wiki3 = "";
  const skillsSection = $("#farmhack-tool-skills .accordion-body");
  if (skillsSection.length) {
    const wiki3Field = skillsSection.find(".field--name-field-wiki3");
    const wiki3Html = wiki3Field.length ? wiki3Field.html() : skillsSection.html();
    wiki3 = htmlToMarkdown(wiki3Html || "");
  }

  // Related tools
  const relatedTools = {
    component: [],
    assembly: [],
    branch: [],
    merge: [],
  };
  const relatedSection = $("#farmhack-tool-related .accordion-body");
  if (relatedSection.length) {
    const parseRelField = (fieldName) => {
      const items = [];
      relatedSection.find(`.field--name-field-tools-${fieldName} a[href*="/tools/"]`).each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim();
        if (href && text) {
          items.push({
            title: text,
            url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
          });
        }
      });
      return items;
    };
    relatedTools.component = parseRelField("component");
    relatedTools.assembly = parseRelField("assembly");
    relatedTools.branch = parseRelField("branch");
    relatedTools.merge = parseRelField("merge");

    if (Object.values(relatedTools).every((arr) => arr.length === 0)) {
      relatedSection.find("a[href*='/tools/']").each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim();
        if (href && text) {
          relatedTools.component.push({
            title: text,
            url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
          });
        }
      });
    }
  }

  // Comments
  const comments = [];
  $(
    "#farmhack-tool-comments .comment, .comment-wrapper .comment, .field--name-comment-node-tool .comment"
  ).each((_, el) => {
    const commentAuthor =
      $(el).find(".comment__author, .username").first().text().trim() || "Anonymous";
    const commentText =
      $(el).find(".comment__content, .field--name-comment-body").text().trim() || "";
    if (commentText) {
      comments.push({ author: commentAuthor, text: commentText });
    }
  });

  return {
    url,
    title,
    description,
    status,
    license,
    tags,
    author,
    mainImage,
    galleryImages,
    attachedFiles,
    wiki,
    wiki2,
    wiki3,
    videoUrl,
    relatedTools,
    comments,
  };
}

/**
 * Build the import JSON format from scraped data.
 */
function buildImportData(tools) {
  const authorsMap = new Map();
  // In dev mode, only collect authors for scraped tools
  const relevantAuthors = new Set();
  for (const t of tools) {
    if (t.author) relevantAuthors.add(t.author);
    for (const c of t.comments) {
      if (c.author) relevantAuthors.add(c.author);
    }
  }
  for (const name of relevantAuthors) {
    authorsMap.set(name, placeholderHash());
  }

  const proxyAgents = [...authorsMap.entries()].map(([name, hash]) => ({
    original_hash: hash,
    entry: {
      nickname: name,
      bio: "",
      location: "",
    },
    relations: [],
  }));

  const toolUrlToHash = new Map();
  const toolEntries = [];
  for (const t of tools) {
    const hash = placeholderHash();
    toolUrlToHash.set(t.url, hash);
    toolEntries.push({ ...t, hash });
  }

  const importTools = [];
  const importNotes = [];

  for (const t of toolEntries) {
    const relations = [];

    // Author relation
    if (t.author && authorsMap.has(t.author)) {
      relations.push({
        timestamp: Date.now() * 1000,
        src: t.hash,
        dst: authorsMap.get(t.author),
        content: { path: "tool.author", data: t.author },
      });
    }

    // Tag relations
    for (const tag of t.tags) {
      relations.push({
        timestamp: Date.now() * 1000,
        src: t.hash,
        dst: t.hash,
        content: { path: "tool.tag", data: tag },
      });
    }

    // Related tool relations
    for (const relType of ["component", "assembly", "branch", "merge"]) {
      for (const rel of t.relatedTools[relType]) {
        const dstHash = toolUrlToHash.get(rel.url);
        if (dstHash) {
          relations.push({
            timestamp: Date.now() * 1000,
            src: t.hash,
            dst: dstHash,
            content: { path: `tool.${relType}`, data: rel.title },
          });
        }
      }
    }

    const entry = {
      title: t.title,
      description: t.description,
      status: t.status,
      tags: t.tags,
      trashed: false,
      license: t.license,
      wiki: t.wiki,
      wiki2: t.wiki2,
      wiki3: t.wiki3,
      video_url: t.videoUrl || null,
      images_data: t.galleryImages || [],
    };

    if (t.mainImage) {
      entry.pic_data = t.mainImage.data;
      entry.pic_hash = placeholderHash();
      entry.pic_file = t.mainImage.file;
    }

    // File attachment relations
    for (const af of (t.attachedFiles || [])) {
      relations.push({
        timestamp: Date.now() * 1000,
        src: t.hash,
        dst: t.hash, // placeholder - replaced during import with actual file hash
        content: {
          path: "tool.file.manual",
          data: JSON.stringify({
            name: af.file.name,
            file_type: af.file.file_type,
            size: af.file.size,
          }),
        },
        file_data: af.data,
        file_info: af.file,
      });
    }

    importTools.push({
      original_hash: t.hash,
      entry,
      relations,
    });

    // Comments become notes
    for (const c of t.comments) {
      importNotes.push({
        original_hash: placeholderHash(),
        entry: {
          text: `${c.author}: ${c.text}`,
          tool: t.hash,
          tags: [],
          trashed: false,
        },
        relations: [],
      });
    }
  }

  return {
    tools: importTools,
    notes: importNotes,
    proxyAgents,
    agents: [],
  };
}

async function main() {
  console.log(`FarmHack Scraper${DEV_MODE ? " (DEV MODE - 10 tools)" : ""}`);
  console.log("================");
  console.log("");

  console.log("Step 1: Discovering tool URLs...");
  const urls = await scrapeToolUrls();
  console.log(`  Found ${urls.length} unique tool URLs.`);
  console.log("");

  console.log("Step 2: Scraping individual tool pages...");
  const tools = [];
  for (let i = 0; i < urls.length; i++) {
    console.log(`  [${i + 1}/${urls.length}] ${urls[i]}`);
    try {
      const tool = await scrapeTool(urls[i]);
      tools.push(tool);
    } catch (e) {
      console.error(`  Error scraping ${urls[i]}: ${e.message}`);
    }
    if (i < urls.length - 1) await sleep(DELAY_MS);
  }
  console.log(`  Successfully scraped ${tools.length} tools.`);
  console.log("");

  console.log("Step 3: Building import JSON...");
  const importData = buildImportData(tools);
  console.log(`  Tools: ${importData.tools.length}`);
  console.log(`  Notes (comments): ${importData.notes.length}`);
  console.log(`  Proxy Agents (authors): ${importData.proxyAgents.length}`);
  console.log("");

  const outName = DEV_MODE ? "farmhack-scraped-dev.json" : "farmhack-scraped.json";
  const outFile = new URL(`./${outName}`, import.meta.url).pathname;
  writeFileSync(outFile, JSON.stringify(importData, null, 2));
  console.log(`Output written to: ${outFile}`);
  console.log("Done.");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
