import path from "path";
import { fileURLToPath } from "url";

import { listMarkdownFiles } from "../lib/content.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "../data");

export default function handler(req, res) {
  const files = listMarkdownFiles(dataDir);
  res.status(200).json(files);
}
