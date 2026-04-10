let isMobileMenuOpen = false;
let activeMobileSidebarPanel = "primary";
let dataFiles = [];
let mechanicPages = [];
let organizedContent = {
  adversaries: {},
  environments: {},
  traps: {},
  allies: {},
  ancestries: {},
};
const filePathToRoute = new Map();
const routeToFilePath = new Map();
const CATEGORY_CONFIG = {
  adversaries: { groupedByTier: true },
  environments: { groupedByTier: true },
  traps: { groupedByTier: true },
  allies: { groupedByTier: false },
  ancestries: { groupedByTier: false },
};
const CATEGORY_ORDER = ["adversaries", "allies", "ancestries", "environments", "traps"];
const MECHANIC_DATA_PAGE_SLUGS = new Set(["conditions"]);
const STATIC_PAGE_HOME = "/";
const STATIC_PAGE_CHANGELOG = "/changelog/";
const STATIC_PAGE_FILES = {
  [STATIC_PAGE_HOME]: "/content/index.md",
  [STATIC_PAGE_CHANGELOG]: "/content/changelog.md",
};

function withExternalTargets(html) {
  return html.replace(/<a\b([^>]*)>/gi, (match, attributes) => {
    if (/\btarget=/i.test(attributes)) {
      return match;
    }

    const hrefMatch = attributes.match(/\bhref=(["'])(.*?)\1/i);

    if (!hrefMatch || !isExternalHref(hrefMatch[2])) {
      return match;
    }

    return `<a${attributes} target="_blank" rel="noopener noreferrer">`;
  });
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

function parseInline(markdown) {
  return marked.parseInline(markdown || "");
}

function isExternalHref(href) {
  if (/^(mailto|tel):/i.test(href)) {
    return true;
  }

  if (/^(https?:)?\/\//i.test(href)) {
    try {
      const url = new URL(href, window.location.origin);
      return url.origin !== window.location.origin;
    } catch (error) {
      return true;
    }
  }

  return false;
}

function slugifySegment(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeAppRoute(route) {
  const value = String(route || "/")
    .split(/[?#]/)[0]
    .replace(/\/{2,}/g, "/");

  if (!value || value === "/") {
    return "/";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/g, "") || "/";
}

function parseContentFilePath(filePath) {
  const parts = String(filePath).split("/").filter(Boolean);
  const [category, ...rest] = parts;

  if (!category || rest.length === 0 || !CATEGORY_CONFIG[category]) {
    return null;
  }

  if (CATEGORY_CONFIG[category].groupedByTier) {
    const [group, fileName] = rest;

    if (!group || !fileName) {
      return null;
    }

    return { category, group, fileName };
  }

  const [fileName] = rest;

  if (!fileName) {
    return null;
  }

  return { category, group: "", fileName };
}

function getDataFileRoute(filePath) {
  const parsedPath = parseContentFilePath(filePath);

  if (!parsedPath) {
    return STATIC_PAGE_HOME;
  }

  if (!parsedPath.group) {
    return `/${slugifySegment(parsedPath.category)}/${slugifySegment(stripMarkdownExtension(parsedPath.fileName))}/`;
  }

  return `/${slugifySegment(parsedPath.category)}/${slugifySegment(parsedPath.group)}/${slugifySegment(stripMarkdownExtension(parsedPath.fileName))}/`;
}

function getCategoryLandingRoute(category) {
  return `/${slugifySegment(category)}/`;
}

function getCanonicalRoute(route) {
  if (route === STATIC_PAGE_HOME) {
    return STATIC_PAGE_HOME;
  }

  return `${normalizeAppRoute(route)}/`;
}

function updateRouteMaps() {
  filePathToRoute.clear();
  routeToFilePath.clear();

  dataFiles.forEach((file) => {
    const route = getDataFileRoute(file);
    filePathToRoute.set(file, route);
    routeToFilePath.set(normalizeAppRoute(route), file);
  });

  mechanicPages = mechanicPages.map((page) => ({
    ...page,
    route: getMechanicRoute(page.slug),
  }));
}

function buildOrganizedContent() {
  organizedContent = {
    adversaries: {},
    environments: {},
    traps: {},
    allies: {},
    ancestries: {},
  };

  dataFiles.forEach((file) => {
    const parsedPath = parseContentFilePath(file);

    if (!parsedPath) {
      return;
    }

    const { category, group, fileName } = parsedPath;

    if (!organizedContent[category]) {
      return;
    }

    if (!organizedContent[category][group]) {
      organizedContent[category][group] = [];
    }

    organizedContent[category][group].push({
      name: fileName.replace(/\.md$/i, ""),
      path: file,
      route: filePathToRoute.get(file),
    });
  });
}

function getFileCategory(filePath) {
  return String(filePath).split("/")[0] || "";
}

function getCategoryEntries(category) {
  return organizedContent[category] || {};
}

function getFirstCategoryFile(category) {
  const entries = getCategoryEntries(category);
  const groups = getSortedCategoryGroups(category);
  const firstGroup = groups[0];

  if (firstGroup === undefined) {
    return null;
  }

  const files = [...entries[firstGroup]].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  return files[0] || null;
}

function hasDetailSidebarContent(category) {
  return Boolean(
    category && Object.keys(getCategoryEntries(category)).length > 0,
  );
}

function getSortedCategoryGroups(category) {
  const groups = Object.keys(getCategoryEntries(category));

  if (!CATEGORY_CONFIG[category]?.groupedByTier) {
    return groups.sort((left, right) => left.localeCompare(right));
  }

  return groups.sort(compareTierLabels);
}

function pushBrowserRoute(route) {
  window.history.pushState(null, "", getCanonicalRoute(route));
}

function replaceBrowserRoute(route) {
  window.history.replaceState(null, "", getCanonicalRoute(route));
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

function isMobileViewport() {
  return window.matchMedia("(max-width: 56rem)").matches;
}

function setMobileMenuState(isOpen) {
  isMobileMenuOpen = isOpen;

  const primarySidebar = document.getElementById("sidebar");
  const detailSidebar = document.getElementById("detail-sidebar");
  const toggle = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("sidebar-backdrop");

  if (!primarySidebar || !detailSidebar || !toggle || !backdrop) {
    return;
  }

  primarySidebar.classList.toggle(
    "is-open",
    isOpen && activeMobileSidebarPanel === "primary",
  );
  detailSidebar.classList.toggle(
    "is-open",
    isOpen && activeMobileSidebarPanel === "detail",
  );
  backdrop.hidden = !isOpen;
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  document.body.classList.toggle("menu-open", isOpen);
  setMenuIcon(isOpen ? "x" : "menu");
}

function setActiveMobileSidebarPanel(panel) {
  activeMobileSidebarPanel = panel;
  document.body.classList.toggle("mobile-detail-panel", panel === "detail");

  if (isMobileMenuOpen) {
    setMobileMenuState(true);
  }
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

  updateRouteMaps();
  buildOrganizedContent();
  renderPrimarySidebar();

  await loadInitialRoute();
}

async function selectFile(file, link, options = {}) {
  const { history = "replace" } = options;
  const category = getFileCategory(file);
  clearSidebarSelection();
  renderDetailSidebar(category, file);
  setActiveMobileSidebarPanel("detail");

  const categoryLink = document.querySelector(
    `#sidebar a[data-category-link="${category}"]`,
  );

  if (categoryLink) {
    categoryLink.classList.add("selected");
    categoryLink.setAttribute("aria-current", "page");
  }

  if (link) {
    link.classList.add("selected");
    link.setAttribute("aria-current", "page");
  }

  if (history === "push") {
    pushBrowserRoute(filePathToRoute.get(file));
  } else if (history === "replace") {
    replaceBrowserRoute(filePathToRoute.get(file));
  }

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

  if (file.includes("allies/")) {
    content.innerHTML = renderAllyCard(md);
    syncFeatherIcons();
    return;
  }

  if (file.includes("ancestries/")) {
    content.innerHTML = renderAncestryCard(md);
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
      "Rules & Mechanics",
      mechanics.map((page) => ({
        label: page.title,
        route: getMechanicRoute(page.slug),
      })),
    );
  }
}

function renderPrimarySidebar() {
  const sidebar = document.getElementById("sidebar");

  if (!sidebar) {
    return;
  }

  const mainTitle = document.createElement("div");
  mainTitle.className = "site-brand";
  mainTitle.setAttribute("aria-hidden", "true");
  mainTitle.innerHTML = `Julia's Arsenal for <span>Daggerheart</span>`;
  sidebar.innerHTML = "";
  sidebar.appendChild(mainTitle);
  appendStaticNavigation(sidebar, mechanicPages);
  appendContentOverviewSections(sidebar);
}

function appendContentOverviewSections(sidebar) {
  CATEGORY_ORDER.forEach((category) => {
    if (!hasDetailSidebarContent(category)) {
      return;
    }

    const section = createSidebarSection(
      formatCategoryLabel(category),
      category,
    );
    const categoryHeader = document.createElement("h2");
    categoryHeader.className = `category-header ${category}`;
    categoryHeader.textContent = formatCategoryLabel(category);
    section.appendChild(categoryHeader);

    const list = document.createElement("ul");
    list.className = "file-sublist static-pages";

    const item = document.createElement("li");
    const link = document.createElement("a");
    const firstFile = getFirstCategoryFile(category);
    const route = getCategoryLandingRoute(category);

    link.href = route;
    link.textContent = "View all";
    link.dataset.categoryLink = category;
    link.dataset.route = route;
    link.addEventListener("click", (event) => {
      event.preventDefault();

      if (!firstFile) {
        return;
      }

      if (isMobileViewport()) {
        clearSidebarSelection();
        link.classList.add("selected");
        link.setAttribute("aria-current", "page");
        renderDetailSidebar(category);
        setActiveMobileSidebarPanel("detail");
        return;
      }

      setActiveMobileSidebarPanel("detail");
      selectFile(firstFile.path, null, { history: "push" });
    });

    item.appendChild(link);
    list.appendChild(item);
    section.appendChild(list);
    sidebar.appendChild(section);
  });
}

function renderDetailSidebar(category, activeFilePath) {
  const detailSidebar = document.getElementById("detail-sidebar");

  if (!detailSidebar) {
    return;
  }

  detailSidebar.innerHTML = "";
  document.body.classList.toggle(
    "has-detail-sidebar",
    hasDetailSidebarContent(category),
  );

  if (!hasDetailSidebarContent(category)) {
    detailSidebar.setAttribute("aria-hidden", "true");
    setActiveMobileSidebarPanel("primary");
    return;
  }

  detailSidebar.setAttribute("aria-hidden", "false");

  const mobileBackButton = document.createElement("button");
  mobileBackButton.type = "button";
  mobileBackButton.className = "detail-sidebar-back";
  mobileBackButton.innerHTML = `${window.feather?.icons?.chevronLeft?.toSvg() || ""}<span>← Back to sections</span>`;
  mobileBackButton.addEventListener("click", () => {
    setActiveMobileSidebarPanel("primary");
  });
  detailSidebar.appendChild(mobileBackButton);

  const section = createSidebarSection(formatCategoryLabel(category), category);
  const categoryHeader = document.createElement("h2");
  categoryHeader.className = `category-header ${category}`;
  categoryHeader.textContent = formatCategoryLabel(category);
  section.appendChild(categoryHeader);

  getSortedCategoryGroups(category).forEach((group) => {
    const tierGroup = document.createElement("div");
    tierGroup.className = "tier-group";

    if (group) {
      const tierHeader = document.createElement("h3");
      tierHeader.className = "tier-header";
      tierHeader.textContent = capitalizeWords(group);
      tierGroup.appendChild(tierHeader);
    }

    const ul = document.createElement("ul");
    ul.className = "file-sublist";

    [...getCategoryEntries(category)[group]]
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((file) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = file.route;
        link.textContent = file.name;
        link.dataset.route = file.route;
        if (file.path === activeFilePath) {
          link.classList.add("selected");
          link.setAttribute("aria-current", "page");
        }
        link.addEventListener("click", (event) => {
          event.preventDefault();
          selectFile(file.path, link, { history: "push" });
        });
        li.appendChild(link);
        ul.appendChild(li);
      });

    tierGroup.appendChild(ul);
    section.appendChild(tierGroup);
  });

  detailSidebar.appendChild(section);
  syncFeatherIcons();
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
    link.href = page.route;
    link.textContent = page.label;
    link.dataset.page = page.route;
    link.dataset.route = page.route;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      selectStaticPage(page.route, link, { history: "push" });
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
  document.querySelectorAll("#sidebar a, #detail-sidebar a").forEach((el) => {
    el.classList.remove("selected");
    el.removeAttribute("aria-current");
  });
}

function selectStaticPage(page, link, options = {}) {
  const { history = "replace" } = options;
  clearSidebarSelection();
  renderDetailSidebar(null);
  setActiveMobileSidebarPanel("primary");

  if (page !== STATIC_PAGE_HOME && link) {
    link.classList.add("selected");
    link.setAttribute("aria-current", "page");
  }

  if (history === "push") {
    pushBrowserRoute(page);
  } else if (history === "replace") {
    replaceBrowserRoute(page);
  }

  closeMobileMenuIfNeeded();
  renderStaticPage(page);
}

async function loadInitialRoute() {
  const resolvedRoute = resolveCurrentRoute();

  if (!resolvedRoute) {
    selectStaticPage(STATIC_PAGE_HOME, null, { history: "replace" });
    return;
  }

  if (resolvedRoute.redirect) {
    replaceBrowserRoute(resolvedRoute.route);
  }

  if (resolvedRoute.kind === "static") {
    const pageLink = document.querySelector(
      `#sidebar a[data-route="${resolvedRoute.route}"]`,
    );
    selectStaticPage(resolvedRoute.route, pageLink, { history: "none" });
    return;
  }

  renderDetailSidebar(getFileCategory(resolvedRoute.file), resolvedRoute.file);
  const fileLink = document.querySelector(
    `#detail-sidebar a[data-route="${resolvedRoute.route}"]`,
  );

  if (fileLink) {
    await selectFile(resolvedRoute.file, fileLink, { history: "none" });
    return;
  }

  selectStaticPage(STATIC_PAGE_HOME, null, { history: "replace" });
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
  const page = mechanicPages.find(
    (entry) => normalizeAppRoute(entry.route) === normalizeAppRoute(route),
  );

  if (!page) {
    return renderStaticMarkdown("# Page not found");
  }

  const introResponse = await fetch(page.filePath);

  if (!introResponse.ok) {
    throw new Error(`Unable to load ${page.filePath}`);
  }

  const introMarkdown = await introResponse.text();
  const { body: introBody } = parseFrontmatter(introMarkdown);
  const matchingDataFiles = MECHANIC_DATA_PAGE_SLUGS.has(page.slug)
    ? dataFiles
        .filter(
          (file) => file.startsWith(`${page.slug}/`) && file.endsWith(".md"),
        )
        .sort((left, right) => left.localeCompare(right))
    : [];

  const mechanicEntries = await Promise.all(
    matchingDataFiles.map(async (file) => {
      const response = await fetch(
        `/api/file?path=${encodeURIComponent(file)}`,
      );

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

function renderAllyCard(md) {
  const { meta, body } = parseFrontmatter(md);
  const title = matchOrEmpty(body, /^# (.+)$/m) || meta.name || "";
  const summary = extractSummary(body);
  const features = extractSection(body, /## Features/i);
  const designNotes = extractSection(body, /## Design notes/i);
  const processedFeatures = renderStandardFeatureMarkup(features);
  const blockTable = `
    <div class="block-table">
      <div class="block-content">
        <strong>Ancestry:</strong> ${formatAllyMetaValue(meta.ancestry)}
        &nbsp;|&nbsp;<strong>Community:</strong> ${capitalizeWords(meta.community || "-")}
        &nbsp;|&nbsp;<strong>Role:</strong> ${formatAllyMetaValue(meta.role)}
      </div>
    </div>
  `;

  return `
    <div class="card-stack">
      <div class="ally-card">
        <h2>${title}</h2>
        <div class="summary">${parseInlineWithExternalTargets(summary)}</div>
        ${blockTable}
        <h3>Features</h3>
        <div class="feature-copy">${processedFeatures}</div>
      </div>
      ${renderDesignNotes(designNotes)}
    </div>
  `;
}

function renderAncestryCard(md) {
  const { body } = parseFrontmatter(md);
  const title = matchOrEmpty(body, /^# (.+)$/m);
  const summary = extractSummary(body);
  const features = extractSection(body, /## Features/i);
  const designNotes = extractSection(body, /## Design notes/i);
  const processedFeatures = renderStandardFeatureMarkup(features);

  return `
    <div class="card-stack">
      <div class="ancestry-card">
        <h2>${title}</h2>
        <div class="summary">${parseInlineWithExternalTargets(summary)}</div>
        <h3>Features</h3>
        <div class="feature-copy">${processedFeatures}</div>
      </div>
      ${renderDesignNotes(designNotes)}
    </div>
  `;
}

function renderMechanicSection(entry) {
  const title =
    extractMarkdownHeading(entry.body) || stripMarkdownExtension(entry.file);
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

function renderStandardFeatureMarkup(features, options = {}) {
  const { flavorParagraphs = false } = options;
  let processedFeatures = features
    ? features.replace(/### (.+?)\r?\n\r?\n/g, "### $1: ")
    : "";
  processedFeatures = processedFeatures.replace(
    /### (.+?):\s*(.+)/g,
    "**_$1:_** $2",
  );

  let rendered = demoteHtmlHeadings(
    withExternalTargets(marked.parse(processedFeatures || "")),
  );

  if (flavorParagraphs) {
    rendered = applyFlavorParagraphs(rendered);
  }

  return markFeatureLeadParagraphs(rendered);
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

function formatAllyMetaValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => capitalizeWords(entry)).join(" / ");
  }

  if (
    typeof value === "string" &&
    value.startsWith("[") &&
    value.endsWith("]")
  ) {
    return value
      .slice(1, -1)
      .split(",")
      .map((entry) => capitalizeWords(entry.trim()))
      .filter(Boolean)
      .join(" / ");
  }

  return capitalizeWords(value || "-");
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
        groups.push(
          formatPotentialAdversaryGroup(currentGroup, currentEntries),
        );
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
    groups.push(formatPotentialAdversaryGroup(currentGroup, currentEntries));
  }

  return groups.map((group) => parseInline(group)).join(", ");
}

function formatPotentialAdversaryGroup(group, entries) {
  return `${group} (${entries.join(", ")})`;
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

  const leftTitle =
    extractMarkdownHeading(left.body) || stripMarkdownExtension(left.file);
  const rightTitle =
    extractMarkdownHeading(right.body) || stripMarkdownExtension(right.file);
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
  return `/mechanics/${slug}/`;
}

function isMechanicRoute(route) {
  return normalizeAppRoute(route).startsWith("/mechanics/");
}

function resolveCurrentRoute() {
  const legacyHashRoute = decodeURIComponent(
    window.location.hash.replace(/^#/, ""),
  );

  if (legacyHashRoute) {
    return resolveLegacyHashRoute(legacyHashRoute);
  }

  return resolveAppRoute(window.location.pathname);
}

function resolveLegacyHashRoute(route) {
  if (!route || route === "home") {
    return {
      kind: "static",
      route: STATIC_PAGE_HOME,
      redirect: true,
    };
  }

  if (route === "changelog") {
    return {
      kind: "static",
      route: STATIC_PAGE_CHANGELOG,
      redirect: true,
    };
  }

  if (route.startsWith("mechanic/")) {
    const slug = route.slice("mechanic/".length);
    const mechanicRoute = getMechanicRoute(slug);

    return {
      kind: "static",
      route: mechanicRoute,
      redirect: true,
    };
  }

  const canonicalRoute = filePathToRoute.get(route);

  if (!canonicalRoute) {
    return null;
  }

  return {
    kind: "file",
    file: route,
    route: canonicalRoute,
    redirect: true,
  };
}

function resolveAppRoute(route) {
  const normalizedRoute = normalizeAppRoute(route);

  if (normalizedRoute === normalizeAppRoute(STATIC_PAGE_HOME)) {
    return {
      kind: "static",
      route: STATIC_PAGE_HOME,
      redirect: route !== STATIC_PAGE_HOME,
    };
  }

  if (normalizedRoute === normalizeAppRoute(STATIC_PAGE_CHANGELOG)) {
    return {
      kind: "static",
      route: STATIC_PAGE_CHANGELOG,
      redirect: route !== STATIC_PAGE_CHANGELOG,
    };
  }

  if (isMechanicRoute(normalizedRoute)) {
    const page = mechanicPages.find(
      (entry) => normalizeAppRoute(entry.route) === normalizedRoute,
    );

    if (!page) {
      return null;
    }

    return {
      kind: "static",
      route: page.route,
      redirect: route !== page.route,
    };
  }

  const matchingCategory = CATEGORY_ORDER.find(
    (category) =>
      normalizeAppRoute(getCategoryLandingRoute(category)) === normalizedRoute,
  );

  if (matchingCategory) {
    const firstFile = getFirstCategoryFile(matchingCategory);

    if (!firstFile) {
      return null;
    }

    return {
      kind: "file",
      file: firstFile.path,
      route: firstFile.route,
      redirect: true,
    };
  }

  const file = routeToFilePath.get(normalizedRoute);

  if (!file) {
    return null;
  }

  const canonicalRoute = filePathToRoute.get(file);
  return {
    kind: "file",
    file,
    route: canonicalRoute,
    redirect: route !== canonicalRoute,
  };
}

function handleDocumentNavigation(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const link = event.target.closest("a");

  if (!link || link.target === "_blank" || link.hasAttribute("download")) {
    return;
  }

  const url = new URL(link.href, window.location.origin);

  if (url.origin !== window.location.origin) {
    return;
  }

  const resolvedRoute = url.hash
    ? resolveLegacyHashRoute(decodeURIComponent(url.hash.replace(/^#/, "")))
    : resolveAppRoute(url.pathname);

  if (!resolvedRoute) {
    return;
  }

  event.preventDefault();

  if (resolvedRoute.kind === "file") {
    renderDetailSidebar(
      getFileCategory(resolvedRoute.file),
      resolvedRoute.file,
    );
    const fileLink = document.querySelector(
      `#detail-sidebar a[data-route="${resolvedRoute.route}"]`,
    );
    selectFile(resolvedRoute.file, fileLink, { history: "push" });
    return;
  }

  const pageLink = document.querySelector(
    `#sidebar a[data-route="${resolvedRoute.route}"]`,
  );
  selectStaticPage(resolvedRoute.route, pageLink, { history: "push" });
}

window.onload = () => {
  initializeMobileMenu();
  document.addEventListener("click", handleDocumentNavigation);
  window.addEventListener("popstate", () => {
    loadInitialRoute();
  });
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
