// Plesk/Passenger entry point: delegate to the Next.js standalone server.
// The standalone server reads .next/standalone/.env, a copy taken at build time.
// Load the live .env next to this file first; variables already set (e.g. in the
// Plesk Node.js panel) win, and Next never overrides values that are already set.
const fs = require("fs");
const path = require("path");

try {
  const text = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0])) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
} catch (error) {
  console.error(`[closingdesk] could not read ${path.join(__dirname, ".env")}: ${error.message}`);
}

// Encrypted files and the matter database. In production set CLOSINGDESK_DATA_DIR
// to an absolute path outside any web-served folder.
if (!process.env.CLOSINGDESK_DATA_DIR?.trim()) {
  process.env.CLOSINGDESK_DATA_DIR = path.join(__dirname, "data");
}
const dataDir = path.resolve(process.env.CLOSINGDESK_DATA_DIR.trim());
process.env.CLOSINGDESK_DATA_DIR = dataDir;

function writable(dir) {
  const probe = path.join(dir, `.write-test-${process.pid}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

if (!writable(dataDir)) console.error(`[closingdesk] data folder is not writable: ${dataDir}`);

// server.js chdirs into .next/standalone. That folder may belong to another user.
// Keep the process in the data folder's parent and let Next use its own directory.
const standalone = path.join(__dirname, ".next", "standalone");
if (!writable(path.join(standalone, "data"))) {
  const home = path.basename(dataDir) === "data" ? path.dirname(dataDir) : __dirname;
  const chdir = process.chdir.bind(process);
  process.chdir = (dir) => {
    if (path.resolve(dir) === standalone) return;
    chdir(dir);
  };
  chdir(home);
}

require("./.next/standalone/server.js");
