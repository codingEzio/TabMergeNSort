// Reproducible Chrome packaging; no live browser, receiver or signing action.
import { join } from "./paths.ts";
import { root, sha256, verify } from "./verify.ts";
const source = await verify();
// Retained Safari-generation inputs are not referenced by the Chrome runtime.
const excluded = new Set([
  "browser-emoji.js",
  "ui-interactions.js",
  "ui-typography.js",
]);
const receipt = {
  ...source,
  files: source.files.filter((file) =>
    !file.path.startsWith("ui-fonts/") && !excluded.has(file.path)
  ),
};
const seal = await sha256(
  new TextEncoder().encode(JSON.stringify(receipt.files)),
);
const parent = join(root, "Local/candidates");
const output = join(parent, seal.slice(0, 16));
const receiptBytes = new TextEncoder().encode(
  JSON.stringify({ ...receipt, seal, output }, null, 2) + "\n",
);
const expectedFiles = new Set([
  "receipt.json",
  ...receipt.files.map((file) => `extension_chrome/${file.path}`),
]);
const expectedDirs = new Set<string>();
for (const path of expectedFiles) {
  const parts = path.split("/");
  parts.pop();
  while (parts.length) {
    expectedDirs.add(parts.join("/"));
    parts.pop();
  }
}

async function readback() {
  const actualFiles = new Set<string>();
  const actualDirs = new Set<string>();
  async function visit(dir: string, prefix = "") {
    for await (const entry of Deno.readDir(dir)) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymlink) throw Error(`Candidate has symlink: ${path}`);
      if (entry.isDirectory) {
        actualDirs.add(path);
        await visit(join(dir, entry.name), path);
      } else if (entry.isFile) actualFiles.add(path);
      else throw Error(`Candidate has unsupported entry: ${path}`);
    }
  }
  const info = await Deno.lstat(output);
  if (!info.isDirectory || info.isSymlink) {
    throw Error("Candidate is not a directory");
  }
  await visit(output);
  const same = (a: Set<string>, b: Set<string>) =>
    a.size === b.size && [...a].every((path) => b.has(path));
  if (!same(actualFiles, expectedFiles) || !same(actualDirs, expectedDirs)) {
    throw Error("Candidate is incomplete or contains unexpected entries");
  }
  const existingReceipt = await Deno.readFile(join(output, "receipt.json"));
  if (await sha256(existingReceipt) !== await sha256(receiptBytes)) {
    throw Error("Candidate receipt differs");
  }
  for (const file of receipt.files) {
    const bytes = await Deno.readFile(
      join(output, "extension_chrome", file.path),
    );
    if (bytes.length !== file.bytes || await sha256(bytes) !== file.sha256) {
      throw Error(`Candidate file differs: ${file.path}`);
    }
  }
}

await Deno.mkdir(parent, { recursive: true });
let created = false;
try {
  // Exclusive directory creation prevents concurrent writers from sharing a candidate.
  await Deno.mkdir(output);
  created = true;
} catch (error) {
  if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
}
if (created) {
  for (const file of receipt.files) {
    const bytes = await Deno.readFile(
      join(root, "extension_chrome", file.path),
    );
    if (bytes.length !== file.bytes || await sha256(bytes) !== file.sha256) {
      throw Error(`Source changed while packaging: ${file.path}`);
    }
    const to = join(output, "extension_chrome", file.path);
    await Deno.mkdir(to.slice(0, to.lastIndexOf("/")), { recursive: true });
    await Deno.writeFile(to, bytes, { createNew: true });
  }
  // Write the receipt last. Interrupted candidates remain intact and fail readback.
  await Deno.writeFile(join(output, "receipt.json"), receiptBytes, {
    createNew: true,
  });
}
await readback();
console.log(JSON.stringify({
  project: receipt.project,
  output,
  files: receipt.files.length,
  readback: "exact",
  reused: !created,
  chromeId: receipt.chromeId,
}));
