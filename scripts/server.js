import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { listMarkdownFiles } from "../lib/content.js";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../data");
const MECHANICS_DIR = path.join(__dirname, "../public/mechanics");
const PUBLIC_DIR = path.join(__dirname, "../public");

app.use(express.static(PUBLIC_DIR));

function slugifySegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

app.get("/api/list", (req, res) => {
  const files = listMarkdownFiles(DATA_DIR);
  res.json(files);
});

app.get("/api/mechanics", (req, res) => {
  const files = listMarkdownFiles(MECHANICS_DIR)
    .filter((file) => !file.includes("/"))
    .sort((left, right) => left.localeCompare(right))
    .map(buildMechanicPage);

  res.json(files);
});

app.get("/api/file", (req, res) => {
  const relPath = req.query.path;
  if (!relPath || relPath.includes("..")) {
    return res.status(400).send("Invalid path");
  }

  const filePath = path.join(DATA_DIR, relPath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Not found");
  }

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Error reading file");
    }

    res.send(data);
  });
});

app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
