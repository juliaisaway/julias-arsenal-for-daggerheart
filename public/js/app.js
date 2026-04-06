let isMobileMenuOpen = false;
let dataFiles = [];
let mechanicPages = [];
const STATIC_PAGE_HOME = "home";
const STATIC_PAGE_CHANGELOG = "changelog";
const STATIC_PAGE_FILES = {
  [STATIC_PAGE_HOME]: "/content/index.md",
  [STATIC_PAGE_CHANGELOG]: "/content/changelog.md",
};

function withExternalTargets(html) {
  return html.replace(
    /<a\b(?![^>]*\btarget=)([^>]*)>/gi,
    '<a$1 target="_blank" rel="noopener noreferrer">',
  );
}

function demoteHtmlHeadings(html) {
  return html.replace(
    /<(\/?)h([1-6])(\b[^>]*)>/gi,
    (_, slash, level, suffix) => {
      const nextLevel = Math.min(Number(level) + 1, 6);
      return `<${slash}h${nextLevel}${suffix}>`;
    },
  );
}

function parseInlineWithExternalTargets(markdown) {
  return withExternalTargets(marked.parseInline(markdown || ""));
}

function setMenuIcon(name) {
  const toggle = document.getElementById("menu-toggle");

  if (!toggle || !window.feather?.icons?.[name]) {
    return;
  }

  toggle.innerHTML = window.feather.icons[name].toSvg();
}

function syncFeatherIcons() {
  if (window.feather) {
    window.feather.replace();
  }
}

function setMobileMenuState(isOpen) {
  isMobileMenuOpen = isOpen;

  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("sidebar-backdrop");

  if (!sidebar || !toggle || !backdrop) {
    return;
  }

  sidebar.classList.toggle("is-open", isOpen);
  backdrop.hidden = !isOpen;
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  document.body.classList.toggle("menu-open", isOpen);
  setMenuIcon(isOpen ? "x" : "menu");
}

function closeMobileMenuIfNeeded() {
  if (window.matchMedia("(max-width: 56rem)").matches) {
    setMobileMenuState(false);
  }
}

function initializeMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("sidebar-backdrop");

  toggle?.addEventListener("click", () => {
    setMobileMenuState(!isMobileMenuOpen);
  });

  backdrop?.addEventListener("click", () => {
    setMobileMenuState(false);
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 56rem)").matches) {
      setMobileMenuState(false);
    }
  });

  setMenuIcon("menu");
}

async function loadFileList() {
  try {
    [dataFiles, mechanicPages] = await Promise.all([
      fetchJson("/api/list"),
      fetchJson("/api/mechanics", []),
    ]);
  } catch (error) {
    console.error("Failed to load site content", error);
    const content = document.getElementById("md-content");
    if (content) {
      content.innerHTML = renderStaticMarkdown(
        "# Content unavailable\n\nThere was a problem loading the site content.",
      );
      syncFeatherIcons();
    }
    return;
  }

  const sidebar = document.getElementById("sidebar");
  const mainTitle = sidebar.querySelector("h1");
  sidebar.innerHTML = "";
  sidebar.appendChild(mainTitle);
  appendStaticNavigation(sidebar, mechanicPages);

  const organized = {
    adversaries: {},
    environments: {},
    traps: {},
  };

  dataFiles.forEach((file) => {
    const parts = file.split("/");

    if (parts.length < 3) {
      return;
    }

    const [category, tier, fileName] = parts;

    if (!organized[category]) {
      return;
    }

    if (!organized[category][tier]) {
      organized[category][tier] = [];
    }

    organized[category][tier].push({
      name: fileName.replace(/\.md$/i, ""),
      path: file,
    });
  });

  Object.keys(organized).forEach((category) => {
    const categoryEntries = organized[category];

    if (Object.keys(categoryEntries).length === 0) {
      return;
    }

    const section = createSidebarSection(formatCategoryLabel(category), category);
    const categoryHeader = document.createElement("h2");
    categoryHeader.className = `category-header ${category}`;
    categoryHeader.textContent = formatCategoryLabel(category);
    section.appendChild(categoryHeader);

    Object.keys(categoryEntries)
      .sort(compareTierLabels)
      .forEach((tier) => {
        const tierGroup = document.createElement("div");
        tierGroup.className = "tier-group";

        const tierHeader = document.createElement("h3");
        tierHeader.className = "tier-header";
        tierHeader.textContent = capitalizeWords(tier);
        tierGroup.appendChild(tierHeader);

        const ul = document.createElement("ul");
        ul.className = "file-sublist";

        categoryEntries[tier]
          .sort((left, right) => left.name.localeCompare(right.name))
          .forEach((file) => {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.href = `#${encodeURIComponent(file.path)}`;
            link.textContent = file.name;
            link.addEventListener("click", (event) => {
              event.preventDefault();
              selectFile(file.path, link);
            });
            li.appendChild(link);
            ul.appendChild(li);
          });

        tierGroup.appendChild(ul);
        section.appendChild(tierGroup);
      });

    sidebar.appendChild(section);
  });

  await loadInitialRoute();
}

async function selectFile(file, link) {
  clearSidebarSelection();

  link.classList.add("selected");
  link.setAttribute("aria-current", "page");
  window.history.replaceState(null, "", `#${encodeURIComponent(file)}`);
  closeMobileMenuIfNeeded();

  const res = await fetch(`/api/file?path=${encodeURIComponent(file)}`);
  const md = await res.text();
  const content = document.getElementById("md-content");

  if (file.includes("adversaries/")) {
    content.innerHTML = renderAdversaryCard(md);
    syncFeatherIcons();
    return;
  }

  if (file.includes("environments/")) {
    content.innerHTML = renderEnvironmentCard(md);
    syncFeatherIcons();
    return;
  }

  if (file.includes("traps/")) {
    content.innerHTML = renderTrapCard(md);
    syncFeatherIcons();
    return;
  }

  content.innerHTML = demoteHtmlHeadings(withExternalTargets(marked.parse(md)));
  syncFeatherIcons();
}

function appendStaticNavigation(sidebar, mechanics) {
  appendNavigationSection(sidebar, "Pages", [
    { label: "Home", route: STATIC_PAGE_HOME },
    { label: "Changelog", route: STATIC_PAGE_CHANGELOG },
  ]);

  if (mechanics.length > 0) {
    appendNavigationSection(
      sidebar,
      "Mechanics",
      mechanics.map((page) => ({
        label: page.title,
        route: getMechanicRoute(page.slug),
      })),
    );
  }
}

function appendNavigationSection(sidebar, title, pages) {
  const section = createSidebarSection(title, title.toLowerCase());
  const categoryHeader = document.createElement("h2");
  categoryHeader.className = `category-header ${title.toLowerCase()}`;
  categoryHeader.textContent = title;
  section.appendChild(categoryHeader);

  const ul = document.createElement("ul");
  ul.className = "file-sublist static-pages";

  pages.forEach((page) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${page.route}`;
    link.textContent = page.label;
    link.dataset.page = page.route;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      selectStaticPage(page.route, link);
    });
    li.appendChild(link);
    ul.appendChild(li);
  });

  section.appendChild(ul);
  sidebar.appendChild(section);
}

function createSidebarSection(title, className) {
  const section = document.createElement("section");
  section.className = `sidebar-section ${className}`;
  section.setAttribute("aria-label", title);
  return section;
}

function clearSidebarSelection() {
  document.querySelectorAll("#sidebar a").forEach((el) => {
    el.classList.remove("selected");
    el.removeAttribute("aria-current");
  });
}

function selectStaticPage(page, link) {
  clearSidebarSelection();

  if (page !== STATIC_PAGE_HOME && link) {
    link.classList.add("selected");
    link.setAttribute("aria-current", "page");
  }

  window.history.replaceState(null, "", `#${page}`);
  closeMobileMenuIfNeeded();
  renderStaticPage(page);
}

async function loadInitialRoute() {
  const route = decodeURIComponent(window.location.hash.replace(/^#/, ""));

  if (!route || route === STATIC_PAGE_HOME) {
    selectStaticPage(STATIC_PAGE_HOME);
    return;
  }

  if (route === STATIC_PAGE_CHANGELOG || isMechanicRoute(route)) {
    const pageLink = document.querySelector(`#sidebar a[data-page="${route}"]`);
    selectStaticPage(route, pageLink);
    return;
  }

  const fileLink = Array.from(
    document.querySelectorAll(".file-sublist a"),
  ).find(
    (link) =>
      !link.dataset.page &&
      decodeURIComponent(link.getAttribute("href").slice(1)) === route,
  );

  if (fileLink) {
    await selectFile(route, fileLink);
    return;
  }

  selectStaticPage(STATIC_PAGE_HOME);
}

async function renderStaticPage(page) {
  const content = document.getElementById("md-content");

  if (isMechanicRoute(page)) {
    try {
      content.innerHTML = await renderMechanicPage(page);
    } catch (error) {
      content.innerHTML = renderStaticMarkdown(
        `# Content unavailable\n\nThere was a problem loading this page.`,
      );
    }

    syncFeatherIcons();
    return;
  }

  const filePath = STATIC_PAGE_FILES[page];

  if (!filePath) {
    content.innerHTML = renderStaticMarkdown("# Page not found");
    syncFeatherIcons();
    return;
  }

  try {
    const res = await fetch(filePath);

    if (!res.ok) {
      throw new Error(`Unable to load ${filePath}`);
    }

    const md = await res.text();
    content.innerHTML = renderStaticMarkdown(md);
  } catch (error) {
    content.innerHTML = renderStaticMarkdown(
      `# Content unavailable\n\nThere was a problem loading this page.`,
    );
  }

  syncFeatherIcons();
}

async function renderMechanicPage(route) {
  const page = mechanicPages.find((entry) => getMechanicRoute(entry.slug) === route);

  if (!page) {
    return renderStaticMarkdown("# Page not found");
  }

  const introResponse = await fetch(page.filePath);

  if (!introResponse.ok) {
    throw new Error(`Unable to load ${page.filePath}`);
  }

  const introMarkdown = await introResponse.text();
  const { body: introBody } = parseFrontmatter(introMarkdown);
  const matchingDataFiles = dataFiles
    .filter((file) => file.startsWith(`${page.slug}/`) && file.endsWith(".md"))
    .sort((left, right) => left.localeCompare(right));

  const mechanicEntries = await Promise.all(
    matchingDataFiles.map(async (file) => {
      const response = await fetch(`/api/file?path=${encodeURIComponent(file)}`);

      if (!response.ok) {
        throw new Error(`Unable to load ${file}`);
      }

      const markdown = await response.text();
      const { meta, body } = parseFrontmatter(markdown);

      return {
        file,
        meta,
        body,
      };
    }),
  );

  const sortedEntries = mechanicEntries.sort(compareMechanicEntries);

  return `
    <div class="mechanic-page">
      <div class="card-stack">
        <div class="mechanic-card">
          <div class="mechanic-copy">
            <div class="mechanic-intro">${demoteHtmlHeadings(withExternalTargets(marked.parse(introBody)))}</div>
            ${sortedEntries.map((entry) => renderMechanicSection(entry)).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStaticMarkdown(md) {
  return `
    <div class="card-stack">
      <div class="welcome">
        ${demoteHtmlHeadings(withExternalTargets(marked.parse(md)))}
      </div>
    </div>
  `;
}

function renderAdversaryCard(md) {
  const { meta, body } = parseFrontmatter(md);
  const title = matchOrEmpty(body, /^# (.+)$/m);
  const subtitle =
    `Tier ${meta.tier || "?"} ${meta.role ? capitalizeWords(meta.role) : ""}`.trim();
  const summary = extractSummary(body);
  const motives = extractSection(body, /## Motives & Tactics/i);
  const features = extractSection(body, /## Features/i);
  const designNotes = extractSection(body, /## Design notes/i);
  let processedFeatures = features
    ? features.replace(/### (.+?)\r?\n\r?\n/g, "### $1: ")
    : "";
  processedFeatures = processedFeatures.replace(
    /### (.+?):\s*(.+)/g,
    "**_$1:_** $2",
  );
  processedFeatures = markFeatureLeadParagraphs(
    demoteHtmlHeadings(
      withExternalTargets(marked.parse(processedFeatures || "")),
    ),
  );

  let blockTable = `<div class="block-table">`;
  blockTable += `<div class="block-content">`;
  blockTable += `<strong>Difficulty:</strong> ${meta.difficulty || "-"}
      &nbsp;|&nbsp;<strong>Thresholds:</strong> ${formatThresholds(meta.thresholds)}
      &nbsp;|&nbsp;<strong>HP:</strong> ${meta.healthPoints || "-"}
      &nbsp;|&nbsp;<strong>Stress:</strong> ${meta.stress || "-"}<br>
      <strong>ATK:</strong> ${meta.attack || "-"}
      &nbsp;|&nbsp;<strong>${meta.weapon || "Weapon"}:</strong> ${meta.range || ""} | ${meta.damage || ""} ${meta.damageType || ""}`;
  blockTable += `</div>`;

  if (meta.experience) {
    blockTable += `<hr>`;
    blockTable += `<div class="block-content">`;
    blockTable += `<strong>Experience:</strong> ${formatInlineList(meta.experience)}`;
    blockTable += `</div>`;
  }

  blockTable += `</div>`;

  return `
    <div class="card-stack">
      <div class="adversary-card">
        <h2>${title}</h2>
        <div class="subtitle">${subtitle}</div>
        <div class="summary">${parseInlineWithExternalTargets(summary)}</div>
        <div>${motives ? `<strong>Motives & Tactics:</strong> ${parseInlineWithExternalTargets(motives)}` : ""}</div>
        ${blockTable}
        <h3>Features</h3>
        <div class="feature-copy">${processedFeatures}</div>
      </div>
      ${renderDesignNotes(designNotes)}
    </div>
  `;
}

function renderEnvironmentCard(md) {
  const { meta, body } = parseFrontmatter(md);
  const title = matchOrEmpty(body, /^# (.+)$/m);
  const subtitle =
    `Tier ${meta.tier || "?"} ${meta.type ? capitalizeWords(meta.type) : ""}`.trim();
  const summary = extractSummary(body);
  const impulses = extractSection(body, /## Impulses/i);
  const features = extractSection(body, /## Features/i);
  const designNotes = extractSection(body, /## Design notes/i);
  let processedFeatures = features
    ? features.replace(/### (.+?)\r?\n\r?\n/g, "### $1: ")
    : "";
  processedFeatures = processedFeatures.replace(
    /### (.+?):\s*(.+)/g,
    "**_$1:_** $2",
  );
  processedFeatures = applyFlavorParagraphs(
    demoteHtmlHeadings(
      withExternalTargets(marked.parse(processedFeatures || "")),
    ),
  );
  processedFeatures = markFeatureLeadParagraphs(processedFeatures);

  const blockTable = `
    <div class="block-table">
      <div class="block-content">
        <strong>Difficulty:</strong> ${meta.difficulty || "-"}
        ${meta.potentialAdversaries ? `<br><strong>Potential Adversaries:</strong> ${formatPotentialAdversaries(meta.potentialAdversaries)}` : ""}
      </div>
    </div>
  `;

  return `
    <div class="card-stack">
      <div class="environment-card">
        <div class="env-header">
          <h2>${title}</h2>
          <div class="subtitle">${subtitle}</div>
          <div class="summary">${parseInlineWithExternalTargets(summary)}</div>
          <div>${impulses ? `<strong>Impulses:</strong> ${parseInlineWithExternalTargets(impulses)}` : ""}</div>
        </div>
        ${blockTable}
        <h3>Features</h3>
        <div class="feature-copy environment-features">${processedFeatures}</div>
      </div>
      ${renderDesignNotes(designNotes)}
    </div>
  `;
}

function renderTrapCard(md) {
  const { meta, body } = parseFrontmatter(md);
  const title = matchOrEmpty(body, /^# (.+)$/m);
  const subtitle =
    `Tier ${meta.tier || "?"} ${capitalizeWords(meta.type || "")}`.trim();
  const summary = extractSummary(body);
  const purpose = extractSection(body, /## Purpose/i);
  const designNotes = extractSection(body, /## Design notes/i);
  const features = extractTrapFeatures(body);

  const blockTable = `
    <div class="block-table">
      <div class="block-content">
        <strong>Difficulty:</strong> ${meta.difficulty || "-"}
      </div>
    </div>
  `;

  return `
    <div class="card-stack">
      <div class="trap-card">
        <h2>${title}</h2>
        <div class="subtitle">${subtitle}</div>
        <div class="summary">${parseInlineWithExternalTargets(summary)}</div>
        <div>${purpose ? `<strong>Purpose:</strong> ${parseInlineWithExternalTargets(purpose)}` : ""}</div>
        ${blockTable}
        <h3>Features</h3>
        <div class="feature-copy">${withExternalTargets(features || "<p>No features listed.</p>")}</div>
      </div>
      ${renderDesignNotes(designNotes)}
    </div>
  `;
}

function renderMechanicSection(entry) {
  const title = extractMarkdownHeading(entry.body) || stripMarkdownExtension(entry.file);
  const body = removeMarkdownHeading(entry.body).trim();
  const renderedBody = body
    ? demoteHtmlHeadings(withExternalTargets(marked.parse(body)))
    : "<p>No description provided.</p>";

  return `
    <section class="mechanic-entry">
      <h3>${title}</h3>
      <div>${renderedBody}</div>
    </section>
  `;
}

function parseFrontmatter(md) {
  const frontmatterMatch = md.match(/^---([\s\S]*?)---/);
  let meta = {};
  let body = md;

  if (!frontmatterMatch) {
    return { meta, body };
  }

  const yaml = frontmatterMatch[1];
  body = md.slice(frontmatterMatch[0].length).trim();
  meta = parseSimpleYaml(yaml);
  return { meta, body };
}

function parseSimpleYaml(yaml) {
  const meta = {};
  const lines = yaml.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([^:]+):(.*)$/);

    if (!match) {
      continue;
    }

    const key = match[1].trim();
    const value = match[2].trim();

    if (!value) {
      const nestedLines = [];
      let cursor = index + 1;

      while (cursor < lines.length && /^\s+/.test(lines[cursor])) {
        nestedLines.push(lines[cursor]);
        cursor += 1;
      }

      if (nestedLines.length > 0) {
        meta[key] = nestedLines.join("\n").trim();
        index = cursor - 1;
      } else {
        meta[key] = "";
      }

      continue;
    }

    meta[key] = value.replace(/^['"]|['"]$/g, "");
  }

  return meta;
}

function extractSummary(body) {
  const titleMatch = body.match(/^#\s+.+$/m);

  if (!titleMatch) {
    return "";
  }

  const afterTitle = body
    .slice(titleMatch.index + titleMatch[0].length)
    .trimStart();
  const summaryMatch = afterTitle.match(/^([^#\n][^\n]*)/m);
  return summaryMatch ? summaryMatch[1].trim() : "";
}

function extractSection(body, headingPattern) {
  const lines = body.split(/\r?\n/);
  const sectionLines = [];
  let collecting = false;

  for (const line of lines) {
    if (headingPattern.test(line)) {
      collecting = true;
      continue;
    }

    if (collecting && /^##\s+/.test(line)) {
      break;
    }

    if (collecting) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join("\n").trim();
}

function extractTrapFeatures(body) {
  const lines = body.split(/\r?\n/);
  const features = [];
  let currentFeature = null;
  let currentField = "";
  let insideFeatures = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line) {
      continue;
    }

    if (/^##\s+Features/i.test(line)) {
      insideFeatures = true;
      continue;
    }

    if (!insideFeatures) {
      continue;
    }

    if (/^##\s+/.test(line)) {
      break;
    }

    const featureMatch = line.match(/^###\s+(.+)$/);

    if (featureMatch) {
      if (currentFeature) {
        features.push(currentFeature);
      }

      currentFeature = {
        title: featureMatch[1].trim(),
        trigger: "",
        effect: "",
      };
      currentField = "";
      continue;
    }

    const fieldMatch = line.match(/^####\s+(Trigger|Effect)$/i);

    if (fieldMatch) {
      currentField = fieldMatch[1].toLowerCase();
      continue;
    }

    if (!currentFeature || !currentField) {
      continue;
    }

    currentFeature[currentField] = currentFeature[currentField]
      ? `${currentFeature[currentField]}\n\n${line.trim()}`
      : line.trim();
  }

  if (currentFeature) {
    features.push(currentFeature);
  }

  return features
    .map((feature) => {
      const parts = [`<h4>${feature.title}</h4>`];

      if (feature.trigger) {
        parts.push(
          `<p><strong>Trigger:</strong> ${marked.parseInline(feature.trigger)}</p>`,
        );
      }

      if (feature.effect) {
        parts.push(
          `<p><strong>Effect:</strong> ${marked.parseInline(feature.effect)}</p>`,
        );
      }

      return `<div class="trap-feature">${parts.join("")}</div>`;
    })
    .join("");
}

function renderDesignNotes(designNotes) {
  if (!designNotes) {
    return "";
  }

  return `<div class="design-notes"><strong>Design notes:</strong> ${parseInlineWithExternalTargets(designNotes)}</div>`;
}

function applyFlavorParagraphs(html) {
  return html.replace(
    /<p><em>([\s\S]*?)<\/em><\/p>/g,
    '<p class="flavor"><em>$1</em></p>',
  );
}

function markFeatureLeadParagraphs(html) {
  return html.replace(/<p><strong>/g, '<p class="feature-lead"><strong>');
}

function formatCategoryLabel(category) {
  return capitalizeWords(category);
}

function compareTierLabels(left, right) {
  return (
    extractTierNumber(left) - extractTierNumber(right) ||
    left.localeCompare(right)
  );
}

function extractTierNumber(label) {
  const match = label.match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function capitalizeWords(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function matchOrEmpty(value, pattern) {
  const match = value.match(pattern);
  return match ? match[1] : "";
}

function formatThresholds(value) {
  return String(value || "-")
    .replace(/^\[|\]$/g, "")
    .replace(/,/g, " / ");
}

function formatInlineList(value) {
  return String(value || "")
    .replace(/^\[|\]$/g, "")
    .replace(/,/g, ", ");
}

function formatPotentialAdversaries(potentialAdversaries) {
  if (!potentialAdversaries) {
    return "";
  }

  const lines = String(potentialAdversaries)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const groups = [];
  let currentGroup = null;
  let currentEntries = [];
  let readingList = false;

  for (const line of lines) {
    if (line.startsWith("- group:")) {
      if (currentGroup) {
        groups.push(`${currentGroup} (${currentEntries.join(", ")})`);
      }

      currentGroup = line.replace("- group:", "").trim();
      currentEntries = [];
      readingList = false;
      continue;
    }

    if (line.startsWith("list:")) {
      readingList = true;
      continue;
    }

    if (line.startsWith("-") && currentGroup && readingList) {
      currentEntries.push(line.replace(/^\-\s*/, "").trim());
      continue;
    }

    if (line.startsWith("- ") && !currentGroup) {
      groups.push(line.replace(/^\-\s*/, "").trim());
    }
  }

  if (currentGroup) {
    groups.push(`${currentGroup} (${currentEntries.join(", ")})`);
  }

  return groups.join(", ");
}

function extractMarkdownHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function removeMarkdownHeading(markdown) {
  return markdown.replace(/^#\s+.+$\r?\n?/m, "").trimStart();
}

function stripMarkdownExtension(value) {
  return String(value).replace(/\.md$/i, "");
}

function compareMechanicEntries(left, right) {
  const leftOrder = normalizeOrderValue(left.meta?.order);
  const rightOrder = normalizeOrderValue(right.meta?.order);

  if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  if (leftOrder !== null && rightOrder === null) {
    return -1;
  }

  if (leftOrder === null && rightOrder !== null) {
    return 1;
  }

  const leftTitle = extractMarkdownHeading(left.body) || stripMarkdownExtension(left.file);
  const rightTitle = extractMarkdownHeading(right.body) || stripMarkdownExtension(right.file);
  return leftTitle.localeCompare(rightTitle);
}

function normalizeOrderValue(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getMechanicRoute(slug) {
  return `mechanic/${slug}`;
}

function isMechanicRoute(route) {
  return route.startsWith("mechanic/");
}

window.onload = () => {
  initializeMobileMenu();
  loadFileList();
};

async function fetchJson(url, fallbackValue) {
  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    if (fallbackValue !== undefined) {
      console.warn(`Request failed for ${url}; using fallback.`, error);
      return fallbackValue;
    }

    throw error;
  }

  const text = await response.text();

  if (!response.ok) {
    if (fallbackValue !== undefined) {
      console.warn(`Request failed for ${url}; using fallback.`, {
        status: response.status,
        body: text,
      });
      return fallbackValue;
    }

    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (fallbackValue !== undefined) {
      console.warn(`Invalid JSON returned by ${url}; using fallback.`, text);
      return fallbackValue;
    }

    throw new Error(`Invalid JSON returned by ${url}`);
  }
}
