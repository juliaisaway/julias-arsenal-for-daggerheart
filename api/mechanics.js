import path from "path";
import { fileURLToPath } from "url";

import { listMarkdownFiles } from "../lib/content.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mechanicsDir = path.join(__dirname, "../public/mechanics");

function buildMechanicPage(file) {
  const title = file.replace(/\.md$/i, "");
  const slug = slugifySegment(title);

  return {
    file,
    filePath: `/mechanics/${encodeURIComponent(file)}`,
    slug,
    title,
  };
}

function slugifySegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function handler(req, res) {
  const files = listMarkdownFiles(mechanicsDir)
    .filter((file) => !file.includes("/"))
    .sort((left, right) => left.localeCompare(right))
    .map(buildMechanicPage);

  res.status(200).json(files);
}
