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
const allowedEnvironmentTypes = new Map([
  ["exploration", "Exploration"],
  ["social", "Social"],
  ["traversal", "Traversal"],
  ["event", "Event"],
]);
const allowedTrapTypes = new Map([
  ["harm", "Harm"],
  ["snare", "Snare"],
  ["debilitation", "Debilitation"],
  ["hazard", "Hazard"],
  ["disruption", "Disruption"],
  ["lockdown", "Lockdown"],
]);
const requiredAdversaryFields = [
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
const requiredEnvironmentFields = ["tier", "type", "difficulty", "potentialAdversaries"];
const requiredTrapFields = ["tier", "type", "difficulty"];

if (!existsSync(sourceDir)) {
  console.error("Source directory not found:", sourceDir);
  process.exit(1);
}

rmSync(outputDir, { recursive: true, force: true });

if (shouldCleanOnly) {
  console.log("Cleaned dist/.");
  process.exit(0);
}

const markdownFiles = collectMarkdownFiles(sourceDir).filter((filePath) => {
  const fileName = relative(sourceDir, filePath).split(sep).pop() ?? "";
  return !/^EXAMPLE\b/i.test(fileName);
});
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
    kind: detectDocumentKind(parsed.frontmatter, filePath),
  };

  writeFileSync(outputMarkdownPath, renderCompiledMarkdown(document));
  manifest.push(document);
}

manifest.sort((left, right) => left.title.localeCompare(right.title));

const adversaryCount = manifest.filter((document) => document.kind === "adversary").length;
const environmentCount = manifest.filter((document) => document.kind === "environment").length;
const trapCount = manifest.filter((document) => document.kind === "trap").length;

mkdirSync(outputDir, { recursive: true });
console.log(
  `Built ${adversaryCount} adversary Markdown file(s), ${environmentCount} environment Markdown file(s), and ${trapCount} trap Markdown file(s) into dist/.`,
);

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
  const rawLines = frontmatterSource.split("\n");
  const lines = rawLines
    .map((rawLine) => ({
      raw: rawLine,
      indent: rawLine.match(/^\s*/)[0].length,
      text: rawLine.trim(),
    }))
    .filter((line) => line.text && !line.text.startsWith("#"));

  const { value, nextIndex } = parseMapping(lines, 0, 0, filePath);

  if (nextIndex !== lines.length) {
    throw new Error(`Unexpected frontmatter structure in ${filePath}`);
  }

  return value;
}

function parseMapping(lines, startIndex, indent, filePath) {
  const result = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.indent < indent) {
      break;
    }

    if (line.indent > indent) {
      throw new Error(`Unexpected indentation in ${filePath}: "${line.raw}"`);
    }

    if (line.text.startsWith("- ")) {
      break;
    }

    const separatorIndex = line.text.indexOf(":");

    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line "${line.text}" in ${filePath}`);
    }

    const key = line.text.slice(0, separatorIndex).trim();
    const valueSource = line.text.slice(separatorIndex + 1).trim();

    if (!key) {
      throw new Error(`Empty frontmatter key in ${filePath}`);
    }

    if (Object.hasOwn(result, key)) {
      throw new Error(`Duplicate frontmatter key "${key}" in ${filePath}`);
    }

    if (valueSource) {
      result[key] = parseScalar(valueSource);
      index += 1;
      continue;
    }

    const nextLine = lines[index + 1];

    if (!nextLine || nextLine.indent <= indent) {
      result[key] = "";
      index += 1;
      continue;
    }

    const nested = nextLine.text.startsWith("- ")
      ? parseList(lines, index + 1, nextLine.indent, filePath)
      : parseMapping(lines, index + 1, nextLine.indent, filePath);

    result[key] = nested.value;
    index = nested.nextIndex;
  }

  return { value: result, nextIndex: index };
}

function parseList(lines, startIndex, indent, filePath) {
  const result = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.indent < indent) {
      break;
    }

    if (line.indent > indent) {
      throw new Error(`Unexpected indentation in ${filePath}: "${line.raw}"`);
    }

    if (!line.text.startsWith("- ")) {
      break;
    }

    const itemSource = line.text.slice(2).trim();

    if (!itemSource) {
      const nextLine = lines[index + 1];

      if (!nextLine || nextLine.indent <= indent) {
        result.push("");
        index += 1;
        continue;
      }

      const nested = nextLine.text.startsWith("- ")
        ? parseList(lines, index + 1, nextLine.indent, filePath)
        : parseMapping(lines, index + 1, nextLine.indent, filePath);

      result.push(nested.value);
      index = nested.nextIndex;
      continue;
    }

    if (itemSource.includes(":")) {
      const separatorIndex = itemSource.indexOf(":");
      const key = itemSource.slice(0, separatorIndex).trim();
      const valueSource = itemSource.slice(separatorIndex + 1).trim();
      const item = {};

      item[key] = valueSource ? parseScalar(valueSource) : "";
      index += 1;

      while (index < lines.length) {
        const nestedLine = lines[index];

        if (nestedLine.indent < indent + 2) {
          break;
        }

        if (nestedLine.indent > indent + 2) {
          throw new Error(`Unexpected indentation in ${filePath}: "${nestedLine.raw}"`);
        }

        if (nestedLine.text.startsWith("- ")) {
          break;
        }

        const nestedSeparatorIndex = nestedLine.text.indexOf(":");

        if (nestedSeparatorIndex === -1) {
          throw new Error(`Invalid frontmatter line "${nestedLine.text}" in ${filePath}`);
        }

        const nestedKey = nestedLine.text.slice(0, nestedSeparatorIndex).trim();
        const nestedValueSource = nestedLine.text.slice(nestedSeparatorIndex + 1).trim();

        if (Object.hasOwn(item, nestedKey)) {
          throw new Error(`Duplicate frontmatter key "${nestedKey}" in ${filePath}`);
        }

        if (nestedValueSource) {
          item[nestedKey] = parseScalar(nestedValueSource);
          index += 1;
          continue;
        }

        const nextNestedLine = lines[index + 1];

        if (!nextNestedLine || nextNestedLine.indent <= nestedLine.indent) {
          item[nestedKey] = "";
          index += 1;
          continue;
        }

        const nested = nextNestedLine.text.startsWith("- ")
          ? parseList(lines, index + 1, nextNestedLine.indent, filePath)
          : parseMapping(lines, index + 1, nextNestedLine.indent, filePath);

        item[nestedKey] = nested.value;
        index = nested.nextIndex;
      }

      result.push(item);
      continue;
    }

    result.push(parseScalar(itemSource));
    index += 1;
  }

  return { value: result, nextIndex: index };
}

function detectDocumentKind(frontmatter, filePath) {
  const normalizedPath = filePath.split(sep).join("/").toLowerCase();

  if (normalizedPath.includes("/data/adversaries/")) {
    return "adversary";
  }

  if (normalizedPath.includes("/data/environments/")) {
    return "environment";
  }

  if (normalizedPath.includes("/data/traps/")) {
    return "trap";
  }

  if (typeof frontmatter.role === "string") {
    return "adversary";
  }

  if (typeof frontmatter.type === "string" && Array.isArray(frontmatter.potentialAdversaries)) {
    return "environment";
  }

  if (typeof frontmatter.type === "string") {
    return "trap";
  }

  throw new Error(`Could not determine document kind for ${filePath}`);
}

function validateFrontmatter(frontmatter, filePath) {
  const kind = detectDocumentKind(frontmatter, filePath);

  if (kind === "adversary") {
    validateAdversaryFrontmatter(frontmatter, filePath);
    return;
  }

  if (kind === "environment") {
    validateEnvironmentFrontmatter(frontmatter, filePath);
    return;
  }

  validateTrapFrontmatter(frontmatter, filePath);
}

function validateAdversaryFrontmatter(frontmatter, filePath) {
  const missingFields = requiredAdversaryFields.filter((field) => {
    const value = frontmatter[field];
    return value === undefined || value === null || value === "";
  });

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required frontmatter field(s) in ${filePath}: ${missingFields.join(", ")}. Only experience is optional.`,
    );
  }

  validateTier(frontmatter.tier, filePath);

  if (!allowedRoles.has(frontmatter.role)) {
    throw new Error(
      `Invalid role in ${filePath}. Expected one of ${Array.from(allowedRoles).join(", ")}, received: ${frontmatter.role}`,
    );
  }

  validateNonNegativeNumber(frontmatter.difficulty, "difficulty", filePath);
  validateNonNegativeNumber(frontmatter.healthPoints, "healthPoints", filePath);
  validateNonNegativeNumber(frontmatter.stress, "stress", filePath);

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

function validateEnvironmentFrontmatter(frontmatter, filePath) {
  const missingFields = requiredEnvironmentFields.filter((field) => {
    const value = frontmatter[field];
    return value === undefined || value === null || value === "";
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required frontmatter field(s) in ${filePath}: ${missingFields.join(", ")}.`);
  }

  validateTier(frontmatter.tier, filePath);
  validateNonNegativeNumber(frontmatter.difficulty, "difficulty", filePath);

  const normalizedType = String(frontmatter.type).toLowerCase();

  if (!allowedEnvironmentTypes.has(normalizedType)) {
    throw new Error(
      `Invalid type in ${filePath}. Expected one of ${Array.from(allowedEnvironmentTypes.values()).join(", ")}, received: ${frontmatter.type}`,
    );
  }

  if (!Array.isArray(frontmatter.potentialAdversaries) || frontmatter.potentialAdversaries.length === 0) {
    throw new Error(`Invalid potentialAdversaries in ${filePath}. Expected a non-empty array.`);
  }

  for (const adversaryGroup of frontmatter.potentialAdversaries) {
    if (typeof adversaryGroup === "string") {
      continue;
    }

    if (
      !adversaryGroup ||
      typeof adversaryGroup !== "object" ||
      typeof adversaryGroup.group !== "string" ||
      !adversaryGroup.group.trim() ||
      !Array.isArray(adversaryGroup.list) ||
      adversaryGroup.list.length === 0 ||
      adversaryGroup.list.some((entry) => typeof entry !== "string" || !entry.trim())
    ) {
      throw new Error(
        `Invalid potentialAdversaries entry in ${filePath}. Expected either a string or an object with group and a non-empty list.`,
      );
    }
  }
}

function validateTrapFrontmatter(frontmatter, filePath) {
  const missingFields = requiredTrapFields.filter((field) => {
    const value = frontmatter[field];
    return value === undefined || value === null || value === "";
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required frontmatter field(s) in ${filePath}: ${missingFields.join(", ")}.`);
  }

  validateTier(frontmatter.tier, filePath);
  validateNonNegativeNumber(frontmatter.difficulty, "difficulty", filePath);

  const normalizedType = String(frontmatter.type).toLowerCase();

  if (!allowedTrapTypes.has(normalizedType)) {
    throw new Error(
      `Invalid type in ${filePath}. Expected one of ${Array.from(allowedTrapTypes.values()).join(", ")}, received: ${frontmatter.type}`,
    );
  }
}

function validateTier(value, filePath) {
  if (!allowedTiers.has(value)) {
    throw new Error(`Invalid tier in ${filePath}. Expected one of 1, 2, 3, or 4, received: ${value}`);
  }
}

function validateNonNegativeNumber(value, fieldName, filePath) {
  if (typeof value !== "number" || value < 0) {
    throw new Error(
      `Invalid ${fieldName} in ${filePath}. Expected a number greater than or equal to 0, received: ${value}`,
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
  return part.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function renderCompiledMarkdown(document) {
  if (document.kind === "trap") {
    return renderCompiledTrapMarkdown(document);
  }

  if (document.kind === "environment") {
    return renderCompiledEnvironmentMarkdown(document);
  }

  return renderCompiledAdversaryMarkdown(document);
}

function renderCompiledAdversaryMarkdown(document) {
  const sections = extractAdversarySections(document.body);
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
  appendDesignNotes(output, sections.designNotes);

  return `${output.join("\n").trim()}\n`;
}

function renderCompiledEnvironmentMarkdown(document) {
  const sections = extractEnvironmentSections(document.body);
  const typeLabel = formatEnvironmentType(document.frontmatter.type);
  const potentialAdversaries = formatPotentialAdversaries(document.frontmatter.potentialAdversaries);
  const output = [
    `# ${document.title}`,
    "",
    `## ${typeLabel} — Tier ${document.frontmatter.tier ?? "?"}`,
    "",
    `*${sections.description || "No description provided."}*`,
    "",
    `**Impulses:** ${sections.impulses || "-"}`,
    "",
    `> **Difficulty:** ${document.frontmatter.difficulty ?? "-"}`,
    `> **Potential Adversaries:** ${potentialAdversaries || "-"}`,
    "",
    "## Environment Features",
    "",
    ...renderFeatureBlock(sections.features),
  ];

  appendDesignNotes(output, sections.designNotes);

  return `${output.join("\n").trim()}\n`;
}

function renderCompiledTrapMarkdown(document) {
  const sections = extractTrapSections(document.body);
  const typeLabel = formatTrapType(document.frontmatter.type);
  const output = [
    `# ${document.title}`,
    "",
    `## Tier ${document.frontmatter.tier ?? "?"} ${typeLabel}`.trim(),
    "",
    sections.description || "No description provided.",
  ];

  if (sections.purpose) {
    output.push("");
    output.push(`**Purpose:** ${sections.purpose}`);
  }

  output.push("");
  output.push(`> Difficulty: ${document.frontmatter.difficulty ?? "-"}`);
  output.push("");
  output.push("## Features");
  output.push("");
  output.push(...renderTrapFeatures(sections.features));
  appendDesignNotes(output, sections.designNotes);

  return `${output.join("\n").trim()}\n`;
}

function extractAdversarySections(body) {
  const lines = body.split("\n");
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  const descriptionLines = [];
  const motivesLines = [];
  const featureLines = [];
  const designNotesLines = [];
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

    if (/^##\s+Design\s+notes/i.test(line)) {
      currentSection = "designNotes";
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
    } else if (currentSection === "designNotes") {
      designNotesLines.push(line);
    }
  }

  return {
    description: collapseParagraph(descriptionLines) || "No description provided.",
    motives: collapseParagraph(motivesLines),
    features: featureLines,
    designNotes: collapseParagraph(designNotesLines),
  };
}

function extractEnvironmentSections(body) {
  const lines = body.split("\n");
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  const descriptionLines = [];
  const impulsesLines = [];
  const featureLines = [];
  const designNotesLines = [];
  let currentSection = "description";

  for (const rawLine of lines.slice(titleIndex + 1)) {
    const line = rawLine.trimEnd();

    if (/^##\s+Impulses/i.test(line)) {
      currentSection = "impulses";
      continue;
    }

    if (/^##\s+Features/i.test(line)) {
      currentSection = "features";
      continue;
    }

    if (/^##\s+Design\s+notes/i.test(line)) {
      currentSection = "designNotes";
      continue;
    }

    if (/^##\s+/.test(line)) {
      currentSection = "other";
      continue;
    }

    if (currentSection === "description") {
      descriptionLines.push(line);
    } else if (currentSection === "impulses") {
      impulsesLines.push(line);
    } else if (currentSection === "features") {
      featureLines.push(line);
    } else if (currentSection === "designNotes") {
      designNotesLines.push(line);
    }
  }

  return {
    description: collapseParagraph(descriptionLines),
    impulses: collapseParagraph(impulsesLines),
    features: featureLines,
    designNotes: collapseParagraph(designNotesLines),
  };
}

function extractTrapSections(body) {
  const lines = body.split("\n");
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  const descriptionLines = [];
  const purposeLines = [];
  const featureLines = [];
  const designNotesLines = [];
  let currentSection = "description";

  for (const rawLine of lines.slice(titleIndex + 1)) {
    const line = rawLine.trimEnd();

    if (/^##\s+Purpose/i.test(line)) {
      currentSection = "purpose";
      continue;
    }

    if (/^##\s+Features/i.test(line)) {
      currentSection = "features";
      continue;
    }

    if (/^##\s+Design\s+notes/i.test(line)) {
      currentSection = "designNotes";
      continue;
    }

    if (/^##\s+/.test(line)) {
      currentSection = "other";
      continue;
    }

    if (currentSection === "description") {
      descriptionLines.push(line);
    } else if (currentSection === "purpose") {
      purposeLines.push(line);
    } else if (currentSection === "features") {
      featureLines.push(line);
    } else if (currentSection === "designNotes") {
      designNotesLines.push(line);
    }
  }

  return {
    description: collapseParagraph(descriptionLines),
    purpose: collapseParagraph(purposeLines),
    features: featureLines,
    designNotes: collapseParagraph(designNotesLines),
  };
}

function collapseParagraph(lines) {
  return lines.join("\n").trim().replace(/\n{2,}/g, "\n\n");
}

function appendDesignNotes(output, designNotes) {
  if (!designNotes) {
    return;
  }

  output.push("");
  output.push(`> **Design notes:** ${designNotes}`);
}

function renderFeatureBlock(lines) {
  const normalizedLines = lines.map((line) => line.trimEnd());

  while (normalizedLines[0] === "") {
    normalizedLines.shift();
  }

  while (normalizedLines[normalizedLines.length - 1] === "") {
    normalizedLines.pop();
  }

  return normalizedLines.length > 0 ? normalizedLines : ["No features listed."];
}

function renderFeatures(featureLines) {
  const trimmedLines = featureLines.map((line) => line.trimEnd());
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

  return inlineFeatures.length > 0 ? interleaveFeatureParagraphs(inlineFeatures) : ["No features listed."];
}

function renderTrapFeatures(lines) {
  const features = [];
  let currentFeature = null;
  let currentField = "";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line) {
      continue;
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
        extra: [],
      };
      currentField = "";
      continue;
    }

    const fieldMatch = line.match(/^####\s+(Trigger|Effect)$/i);

    if (fieldMatch) {
      currentField = fieldMatch[1].toLowerCase();
      continue;
    }

    if (!currentFeature) {
      continue;
    }

    if (currentField === "trigger") {
      currentFeature.trigger = currentFeature.trigger ? `${currentFeature.trigger}\n\n${line.trim()}` : line.trim();
      continue;
    }

    if (currentField === "effect") {
      currentFeature.effect = currentFeature.effect ? `${currentFeature.effect}\n\n${line.trim()}` : line.trim();
      continue;
    }

    currentFeature.extra.push(line.trim());
  }

  if (currentFeature) {
    features.push(currentFeature);
  }

  if (features.length === 0) {
    return ["No features listed."];
  }

  return features.flatMap((feature, index) => {
    const block = [`### ${feature.title}`];

    if (feature.trigger) {
      block.push("");
      block.push(`**Trigger:** ${feature.trigger}`);
    }

    if (feature.effect) {
      block.push("");
      block.push(`**Effect:** ${feature.effect}`);
    }

    if (feature.extra.length > 0) {
      block.push("");
      block.push(feature.extra.join("\n\n"));
    }

    return index === 0 ? block : ["", ...block];
  });
}

function interleaveFeatureParagraphs(features) {
  return features.flatMap((feature, index) => (index === 0 ? [feature] : ["", feature]));
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
        ? `${currentFeature.description}\n\n${line.trim()}`
        : line.trim();
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

function formatEnvironmentType(type) {
  const normalized = String(type).toLowerCase();
  return allowedEnvironmentTypes.get(normalized) ?? formatRole(type);
}

function formatTrapType(type) {
  const normalized = String(type).toLowerCase();
  return allowedTrapTypes.get(normalized) ?? formatRole(type);
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

function formatPotentialAdversaries(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return "";
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      if (entry.group && Array.isArray(entry.list)) {
        return `${entry.group} (${entry.list.join(", ")})`;
      }

      return "";
    })
    .filter(Boolean)
    .join(", ");
}











