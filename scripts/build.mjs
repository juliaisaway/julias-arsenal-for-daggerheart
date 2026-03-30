import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const rootDir = process.cwd();
const sourceDir = resolve(rootDir, "data");
const outputDir = resolve(rootDir, "dist");
const shouldCleanOnly = process.argv.includes("--clean");
const allowedRoles = new Set([
  "bruiser",
  "horde",
  "leader",
  "minion",
  "ranged",
  "skulk",
  "social",
  "solo",
  "standard",
  "support",
]);
const allowedTiers = new Set([1, 2, 3, 4]);
const allowedDamageTypes = new Set(["physical", "magic"]);
const allowedRanges = new Set(["Melee", "Very Close", "Close", "Far", "Very Far"]);
const requiredFields = [
  "tier",
  "role",
  "difficulty",
  "thresholds",
  "healthPoints",
  "stress",
  "attack",
  "weapon",
  "range",
  "damage",
  "damageType",
];

if (!existsSync(sourceDir)) {
  console.error("Source directory not found:", sourceDir);
  process.exit(1);
}

rmSync(outputDir, { recursive: true, force: true });

if (shouldCleanOnly) {
  console.log("Cleaned dist/.");
  process.exit(0);
}

const markdownFiles = collectMarkdownFiles(sourceDir)
  .filter((filePath) => !filePath.endsWith(`${sep}EXAMPLE.md`));
const manifest = [];

for (const filePath of markdownFiles) {
  const source = readFileSync(filePath, "utf8");
  const parsed = parseMarkdownDocument(source, filePath);
  const relativePath = relative(sourceDir, filePath);
  const slug = buildSlug(relativePath);
  const outputMarkdownPath = join(outputDir, "markdown", relativePath);

  mkdirSync(dirname(outputMarkdownPath), { recursive: true });

  const document = {
    slug,
    source: relativePath.split(sep).join("/"),
    title: parsed.title,
    frontmatter: parsed.frontmatter,
    body: parsed.body.trim(),
  };

  writeFileSync(outputMarkdownPath, renderCompiledMarkdown(document));
  manifest.push(document);
}

manifest.sort((left, right) => left.title.localeCompare(right.title));

mkdirSync(outputDir, { recursive: true });
console.log(`Built ${manifest.length} adversary Markdown file(s) into dist/.`);

function collectMarkdownFiles(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      files.push(fullPath);
    }
  }

  return files;
}

function parseMarkdownDocument(source, filePath) {
  const normalizedSource = source.replace(/\r\n/g, "\n");

  if (!normalizedSource.startsWith("---\n")) {
    throw new Error(`Missing frontmatter block in ${filePath}`);
  }

  const closingMarkerIndex = normalizedSource.indexOf("\n---\n", 4);

  if (closingMarkerIndex === -1) {
    throw new Error(`Unclosed frontmatter block in ${filePath}`);
  }

  const frontmatterSource = normalizedSource.slice(4, closingMarkerIndex).trim();
  const body = normalizedSource.slice(closingMarkerIndex + 5).trimStart();
  const frontmatter = parseFrontmatter(frontmatterSource, filePath);
  validateFrontmatter(frontmatter, filePath);
  const titleMatch = body.match(/^#\s+(.+)$/m);

  if (!titleMatch) {
    throw new Error(`Missing H1 title in ${filePath}`);
  }

  return {
    title: titleMatch[1].trim(),
    frontmatter,
    body,
  };
}

function parseFrontmatter(frontmatterSource, filePath) {
  const result = {};

  for (const rawLine of frontmatterSource.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line "${line}" in ${filePath}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const valueSource = line.slice(separatorIndex + 1).trim();

    if (!key) {
      throw new Error(`Empty frontmatter key in ${filePath}`);
    }

    if (Object.hasOwn(result, key)) {
      throw new Error(`Duplicate frontmatter key "${key}" in ${filePath}`);
    }

    result[key] = parseScalar(valueSource);
  }

  return result;
}

function validateFrontmatter(frontmatter, filePath) {
  const missingFields = requiredFields.filter((field) => {
    const value = frontmatter[field];
    return value === undefined || value === null || value === "";
  });

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required frontmatter field(s) in ${filePath}: ${missingFields.join(", ")}. Only experience is optional.`,
    );
  }

  if (!allowedTiers.has(frontmatter.tier)) {
    throw new Error(
      `Invalid tier in ${filePath}. Expected one of 1, 2, 3, or 4, received: ${frontmatter.tier}`,
    );
  }

  if (!allowedRoles.has(frontmatter.role)) {
    throw new Error(
      `Invalid role in ${filePath}. Expected one of ${Array.from(allowedRoles).join(", ")}, received: ${frontmatter.role}`,
    );
  }

  if (typeof frontmatter.difficulty !== "number" || frontmatter.difficulty < 0) {
    throw new Error(
      `Invalid difficulty in ${filePath}. Expected a number greater than or equal to 0, received: ${frontmatter.difficulty}`,
    );
  }

  if (typeof frontmatter.healthPoints !== "number" || frontmatter.healthPoints < 0) {
    throw new Error(
      `Invalid healthPoints in ${filePath}. Expected a number greater than or equal to 0, received: ${frontmatter.healthPoints}`,
    );
  }

  if (typeof frontmatter.stress !== "number" || frontmatter.stress < 0) {
    throw new Error(
      `Invalid stress in ${filePath}. Expected a number greater than or equal to 0, received: ${frontmatter.stress}`,
    );
  }

  if (typeof frontmatter.attack !== "string" || !/^[+-]\d+$/.test(frontmatter.attack)) {
    throw new Error(
      `Invalid attack in ${filePath}. Expected a signed integer like +1 or -2, received: ${frontmatter.attack}`,
    );
  }

  if (
    !Array.isArray(frontmatter.thresholds) ||
    frontmatter.thresholds.length !== 2 ||
    frontmatter.thresholds.some((value) => typeof value !== "number") ||
    frontmatter.thresholds[0] >= frontmatter.thresholds[1]
  ) {
    throw new Error(
      `Invalid thresholds in ${filePath}. Expected an array of exactly two numbers where the first is less than the second.`,
    );
  }

  if (!allowedDamageTypes.has(frontmatter.damageType)) {
    throw new Error(
      `Invalid damageType in ${filePath}. Expected "physical" or "magic", received: ${frontmatter.damageType}`,
    );
  }

  if (!allowedRanges.has(frontmatter.range)) {
    throw new Error(
      `Invalid range in ${filePath}. Expected one of ${Array.from(allowedRanges).join(", ")}, received: ${frontmatter.range}`,
    );
  }
}

function parseScalar(valueSource) {
  if (valueSource.startsWith("[") && valueSource.endsWith("]")) {
    const inner = valueSource.slice(1, -1).trim();

    if (!inner) {
      return [];
    }

    return inner.split(",").map((part) => parseScalar(part.trim()));
  }

  if (
    (valueSource.startsWith('"') && valueSource.endsWith('"')) ||
    (valueSource.startsWith("'") && valueSource.endsWith("'"))
  ) {
    return valueSource.slice(1, -1);
  }

  if (/^-?\d+(\.\d+)?$/.test(valueSource)) {
    return Number(valueSource);
  }

  if (valueSource === "true") {
    return true;
  }

  if (valueSource === "false") {
    return false;
  }

  return valueSource;
}

function buildSlug(relativePath) {
  return relativePath
    .replace(/\.md$/i, "")
    .split(sep)
    .map((part) => normalizeSlugPart(part))
    .join("/");
}

function normalizeSlugPart(part) {
  return part
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderCompiledMarkdown(document) {
  const sections = extractSections(document.body);
  const roleLabel = formatRole(document.frontmatter.role);
  const tier = document.frontmatter.tier ?? "?";
  const thresholds = formatThresholds(document.frontmatter.thresholds);
  const damageType = formatDamageType(document.frontmatter.damageType);
  const statsLine = [
    `Difficulty: ${document.frontmatter.difficulty ?? "-"}`,
    `Thresholds: ${thresholds}`,
    `HP: ${document.frontmatter.healthPoints ?? "-"}`,
    `Stress ${document.frontmatter.stress ?? "-"}`,
  ].join(" | ");
  const attackLine = [
    `ATK: ${document.frontmatter.attack ?? "-"}`,
    `${document.frontmatter.weapon ?? "Weapon"}: ${document.frontmatter.range ?? "-"}`,
    [document.frontmatter.damage ?? "-", damageType].filter(Boolean).join(" "),
  ].join(" | ");
  const output = [
    `# ${document.title}`,
    "",
    `## Tier ${tier} ${roleLabel}`.trim(),
    "",
    sections.description,
    "",
    `**Motives & Tactics:** ${sections.motives || "-"}`,
    "",
    `> ${statsLine}`,
    `> ${attackLine}`,
  ];

  const experience = formatExperience(document.frontmatter.experience);
  if (experience) {
    output.push(`> Experience: ${experience}`);
  }

  output.push("");
  output.push("## Features");
  output.push("");
  output.push(...renderFeatures(sections.features));

  return `${output.join("\n").trim()}\n`;
}

function extractSections(body) {
  const lines = body.split("\n");
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  const descriptionLines = [];
  const motivesLines = [];
  const featureLines = [];
  let currentSection = "description";

  for (const rawLine of lines.slice(titleIndex + 1)) {
    const line = rawLine.trimEnd();

    if (/^##\s+Motives\s*&\s*Tactics/i.test(line)) {
      currentSection = "motives";
      continue;
    }

    if (/^##\s+Features/i.test(line)) {
      currentSection = "features";
      continue;
    }

    if (/^##\s+/.test(line) && currentSection !== "features") {
      currentSection = "other";
      continue;
    }

    if (currentSection === "description") {
      descriptionLines.push(line);
    } else if (currentSection === "motives") {
      motivesLines.push(line);
    } else if (currentSection === "features") {
      featureLines.push(line);
    }
  }

  return {
    description: collapseParagraph(descriptionLines) || "No description provided.",
    motives: collapseParagraph(motivesLines),
    features: featureLines,
  };
}

function collapseParagraph(lines) {
  return lines
    .join("\n")
    .trim()
    .replace(/\n{2,}/g, "\n\n");
}

function renderFeatures(featureLines) {
  const trimmedLines = featureLines.map((line) => line.trim());
  const headingFeatures = parseHeadingFeatures(trimmedLines);

  if (headingFeatures.length > 0) {
    return interleaveFeatureParagraphs(
      headingFeatures.map((feature) => `**${feature.title}:** ${feature.description}`),
    );
  }

  const inlineFeatures = trimmedLines.filter(Boolean).map((line) => {
    const match = line.match(/^(.+?)\s*:\s*(.+)$/);

    if (!match) {
      return line;
    }

    return `**${match[1].trim()}:** ${match[2].trim()}`;
  });

  return inlineFeatures.length > 0
    ? interleaveFeatureParagraphs(inlineFeatures)
    : ["No features listed."];
}

function interleaveFeatureParagraphs(features) {
  return features.flatMap((feature, index) => index === 0 ? [feature] : ["", feature]);
}

function parseHeadingFeatures(lines) {
  const features = [];
  let currentFeature = null;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^##+#\s+(.+)$/);

    if (headingMatch) {
      if (currentFeature) {
        features.push(currentFeature);
      }

      currentFeature = {
        title: headingMatch[1].trim(),
        description: "",
      };
      continue;
    }

    if (currentFeature) {
      currentFeature.description = currentFeature.description
        ? `${currentFeature.description} ${line}`
        : line;
    }
  }

  if (currentFeature) {
    features.push(currentFeature);
  }

  return features.filter((feature) => feature.title && feature.description);
}

function formatRole(role) {
  if (!role) {
    return "";
  }

  return String(role)
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatThresholds(thresholds) {
  if (Array.isArray(thresholds)) {
    return thresholds.join("/");
  }

  return thresholds ?? "-";
}

function formatDamageType(value) {
  if (!value) {
    return "";
  }

  const normalized = String(value).toLowerCase();
  const abbreviations = {
    physical: "phy",
    magic: "mag",
  };

  return abbreviations[normalized] ?? normalized.slice(0, 3);
}

function formatExperience(value) {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

