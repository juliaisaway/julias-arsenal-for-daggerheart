import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { resolveMarkdownPath } from "../lib/content.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "../data");

export default function handler(req, res) {
  const relativePath = Array.isArray(req.query.path)
    ? req.query.path[0]
    : req.query.path;
  const filePath = resolveMarkdownPath(dataDir, relativePath);

  if (!filePath) {
    res.status(404).send("Not found");
    return;
  }

  fs.readFile(filePath, "utf8", (error, data) => {
    if (error) {
      res.status(500).send("Error reading file");
      return;
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.status(200).send(data);
  });
}
