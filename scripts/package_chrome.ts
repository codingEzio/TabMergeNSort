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

async function matches(
  output: string,
  receiptBytes: Uint8Array,
): Promise<boolean> {
  const actualFiles = new Set<string>();
  const actualDirs = new Set<string>();
  async function visit(dir: string, prefix = ""): Promise<boolean> {
    for await (const entry of Deno.readDir(dir)) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymlink) return false;
      if (entry.isDirectory) {
        actualDirs.add(path);
        if (!await visit(join(dir, entry.name), path)) return false;
      } else if (entry.isFile) actualFiles.add(path);
      else return false;
    }
    return true;
  }
  try {
    const info = await Deno.lstat(output);
    if (!info.isDirectory || info.isSymlink || !await visit(output)) {
      return false;
    }
    const same = (a: Set<string>, b: Set<string>) =>
      a.size === b.size && [...a].every((path) => b.has(path));
    if (!same(actualFiles, expectedFiles) || !same(actualDirs, expectedDirs)) {
      return false;
    }
    const existingReceipt = await Deno.readFile(join(output, "receipt.json"));
    if (await sha256(existingReceipt) !== await sha256(receiptBytes)) {
      return false;
    }
    for (const file of receipt.files) {
      const bytes = await Deno.readFile(
        join(output, "extension_chrome", file.path),
      );
      if (bytes.length !== file.bytes || await sha256(bytes) !== file.sha256) {
        return false;
      }
    }
    return true;
  } catch (error) {
    // A concurrent creator may not have finished; never alter its directory.
    if (
      error instanceof Deno.errors.NotFound ||
      error instanceof Deno.errors.NotADirectory
    ) return false;
    throw error;
  }
}

async function ensureDirectory(path: string) {
  try {
    await Deno.mkdir(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
  }
  const info = await Deno.lstat(path);
  if (!info.isDirectory || info.isSymlink) {
    throw Error(`Candidate parent must be a real directory: ${path}`);
  }
}
const local = join(root, "Local");
async function checkParents() {
  for (const path of [local, parent]) {
    const info = await Deno.lstat(path);
    if (!info.isDirectory || info.isSymlink) {
      throw Error(`Candidate parent must be a real directory: ${path}`);
    }
  }
}
await ensureDirectory(local);
await ensureDirectory(parent);
const maxCandidates = 32;
let selected: { output: string; reused: boolean } | undefined;
for (let index = 0; index < maxCandidates; index++) {
  const suffix = index === 0 ? "" : `-${String(index).padStart(2, "0")}`;
  const output = join(parent, seal.slice(0, 16) + suffix);
  const receiptBytes = new TextEncoder().encode(
    JSON.stringify({ ...receipt, seal, output }, null, 2) + "\n",
  );
  await checkParents();
  let created = false;
  try {
    // Exclusive creation prevents concurrent writers from sharing a candidate.
    await Deno.mkdir(output);
    created = true;
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
  }
  if (!created) {
    if (await matches(output, receiptBytes)) {
      selected = { output, reused: true };
      break;
    }
    continue;
  }
  for (const file of receipt.files) {
    const bytes = await Deno.readFile(
      join(root, "extension_chrome", file.path),
    );
    if (bytes.length !== file.bytes || await sha256(bytes) !== file.sha256) {
      throw Error(`Source changed while packaging: ${file.path}`);
    }
    const to = join(output, "extension_chrome", file.path);
    await checkParents();
    await ensureDirectory(output);
    const components = [
      "extension_chrome",
      ...file.path.split("/").slice(0, -1),
    ];
    let directory = output;
    for (const component of components) {
      directory = join(directory, component);
      await ensureDirectory(directory);
    }
    await checkParents();
    await Deno.writeFile(to, bytes, { createNew: true });
  }
  // Write the receipt last. Interrupted candidates are preserved and skipped.
  await checkParents();
  await ensureDirectory(output);
  await Deno.writeFile(join(output, "receipt.json"), receiptBytes, {
    createNew: true,
  });
  if (!await matches(output, receiptBytes)) {
    throw Error("New candidate failed readback");
  }
  selected = { output, reused: false };
  break;
}
if (!selected) {
  throw Error(
    `All ${maxCandidates} candidate slots are occupied or differ; existing candidates were preserved`,
  );
}
console.log(JSON.stringify({
  project: receipt.project,
  output: selected.output,
  files: receipt.files.length,
  readback: "exact",
  reused: selected.reused,
  chromeId: receipt.chromeId,
}));
