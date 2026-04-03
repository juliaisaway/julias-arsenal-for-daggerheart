import fs from "fs";
import path from "path";

export function listMarkdownFiles(dir, base = "") {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const relPath = path.join(base, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(listMarkdownFiles(filePath, relPath));
      return;
    }

    if (file.endsWith(".md")) {
      results.push(relPath.replace(/\\/g, "/"));
    }
  });

  return results;
}

export function resolveMarkdownPath(rootDir, relativePath) {
  if (!relativePath || relativePath.includes("..")) {
    return null;
  }

  const normalizedPath = String(relativePath).replace(/\//g, path.sep);
  const resolvedPath = path.join(rootDir, normalizedPath);

  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  return resolvedPath;
}
