import { join } from "../scripts/paths.ts";

function assertEquals(
  actual: unknown,
  expected: unknown,
  message = "value differs",
) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message);
  }
}

Deno.test("Chrome package retains its reachable resources without unused font inputs", async () => {
  await Deno.mkdir("Local", { recursive: true });
  const fixture = await Deno.makeTempDir({
    dir: "Local",
    prefix: "package-test-",
  });
  async function copyTree(from: string, to: string) {
    await Deno.mkdir(to, { recursive: true });
    for await (const entry of Deno.readDir(from)) {
      const source = join(from, entry.name);
      const target = join(to, entry.name);
      if (entry.isDirectory) await copyTree(source, target);
      else if (entry.isFile) await Deno.copyFile(source, target);
      else throw Error("Unexpected fixture input");
    }
  }
  let completed = false;
  try {
    for (const dir of ["extension_chrome", "scripts", "shared", "vendor"]) {
      await copyTree(dir, join(fixture, dir));
    }
    for (const file of ["product.json", "dependencies.lock.json"]) {
      await Deno.copyFile(file, join(fixture, file));
    }
    const runPackage = () =>
      new Deno.Command("deno", {
        cwd: fixture,
        args: [
          "run",
          "--allow-read",
          "--allow-write=Local",
          "scripts/package_chrome.ts",
        ],
        stdout: "piped",
        stderr: "piped",
      }).output();
    const attempts = await Promise.all([runPackage(), runPackage()]);
    const created = attempts.filter((attempt) => attempt.success).map((
      attempt,
    ) => JSON.parse(new TextDecoder().decode(attempt.stdout).trim()));
    assertEquals(
      created.filter((attempt) => !attempt.reused).length,
      1,
      "exactly one creator",
    );
    for (const attempt of attempts.filter((attempt) => !attempt.success)) {
      assertEquals(
        new TextDecoder().decode(attempt.stderr).includes(
          "Candidate is incomplete",
        ),
        true,
      );
    }
    const result = created.find((attempt) => !attempt.reused);
    const packageRoot = join(result.output, "extension_chrome");
    const receipt = JSON.parse(
      await Deno.readTextFile(join(result.output, "receipt.json")),
    );
    const files = new Set<string>(
      receipt.files.map((file: { path: string }) => file.path),
    );
    assertEquals(result.chromeId, "ghblmligghdjladgiknambpkkmpdobml");
    assertEquals(
      [...files].some((path) => path.startsWith("ui-fonts/")),
      false,
    );
    for (
      const path of [
        "browser-emoji.js",
        "ui-interactions.js",
        "ui-typography.js",
      ]
    ) {
      assertEquals(files.has(path), false);
    }
    for (const file of receipt.files as { path: string; bytes: number }[]) {
      const bytes = await Deno.readFile(join(packageRoot, file.path));
      assertEquals(bytes.length, file.bytes);
      assertEquals(
        bytes,
        await Deno.readFile(join(fixture, "extension_chrome", file.path)),
      );
    }
    const manifest = JSON.parse(
      await Deno.readTextFile(join(packageRoot, "manifest.json")),
    );
    const html = await Deno.readTextFile(
      join(packageRoot, manifest.action.default_popup),
    );
    const roots = [
      manifest.background.service_worker,
      manifest.action.default_popup,
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon),
      ...Array.from(
        html.matchAll(/(?:src|href)="([^"]+)"/g),
        (match) => match[1],
      ),
    ];
    for (const path of roots) {
      assertEquals(files.has(path as string), true, `missing ${path}`);
    }
    for (
      const path of [
        manifest.background.service_worker,
        "popup.js",
        "src/policy.js",
        "src/version.js",
      ]
    ) {
      const code = await Deno.readTextFile(join(packageRoot, path));
      for (
        const match of code.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g)
      ) {
        const resolved = join(
          path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".",
          match[1],
        ).replace(/^\.\//, "");
        assertEquals(files.has(resolved), true, `missing import ${resolved}`);
      }
    }
    const css = await Deno.readTextFile(join(packageRoot, "popup.css"));
    if (/@import\b|url\s*\(/i.test(css)) {
      throw new Error("Review CSS resource access");
    }
    for (
      const locale of ["en", "es", "ja", "ko", "ru", "uk", "zh_CN", "zh_TW"]
    ) {
      assertEquals(files.has(`_locales/${locale}/messages.json`), true);
    }
    const receiptPath = join(result.output, "receipt.json");
    const originalReceipt = await Deno.readFile(receiptPath);
    const rerun = await runPackage();
    if (!rerun.success) throw Error(new TextDecoder().decode(rerun.stderr));
    assertEquals(
      JSON.parse(new TextDecoder().decode(rerun.stdout)).reused,
      true,
    );
    assertEquals(await Deno.readFile(receiptPath), originalReceipt);

    const snapshot = async (dir: string): Promise<string[]> => {
      const result: string[] = [];
      async function visit(path: string, prefix = "") {
        for await (const entry of Deno.readDir(path)) {
          const name = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory) {
            result.push(`dir:${name}`);
            await visit(join(path, entry.name), name);
          } else if (entry.isFile) {
            result.push(
              `file:${name}:${
                Array.from(await Deno.readFile(join(path, entry.name))).join(
                  ",",
                )
              }`,
            );
          } else throw Error("Unexpected candidate entry");
        }
      }
      await visit(dir);
      return result.sort();
    };
    await Deno.writeTextFile(receiptPath, "conflicting receipt");
    let before = await snapshot(result.output);
    let conflict = await runPackage();
    assertEquals(conflict.success, false);
    assertEquals(
      new TextDecoder().decode(conflict.stderr).includes(
        "Candidate receipt differs",
      ),
      true,
    );
    assertEquals(
      await snapshot(result.output),
      before,
      "conflicting candidate changed",
    );
    await Deno.writeFile(receiptPath, originalReceipt);
    const manifestPath = join(packageRoot, "manifest.json");
    const originalManifest = await Deno.readFile(manifestPath);
    await Deno.writeTextFile(manifestPath, "changed candidate");
    before = await snapshot(result.output);
    conflict = await runPackage();
    assertEquals(conflict.success, false);
    assertEquals(
      new TextDecoder().decode(conflict.stderr).includes(
        "Candidate file differs",
      ),
      true,
    );
    assertEquals(
      await snapshot(result.output),
      before,
      "changed file was overwritten",
    );
    await Deno.writeFile(manifestPath, originalManifest);
    await Deno.remove(manifestPath);
    before = await snapshot(result.output);
    conflict = await runPackage();
    assertEquals(conflict.success, false);
    assertEquals(
      new TextDecoder().decode(conflict.stderr).includes(
        "Candidate is incomplete",
      ),
      true,
    );
    assertEquals(
      await snapshot(result.output),
      before,
      "incomplete candidate changed",
    );
    completed = true;
    console.log(
      `Chrome package: ${files.size} files, ${
        receipt.files.reduce((sum: number, file: { bytes: number }) =>
          sum + file.bytes, 0)
      } bytes`,
    );
  } finally {
    if (completed) await Deno.remove(fixture, { recursive: true });
    else console.error(`Failed package test fixture retained: ${fixture}`);
  }
});
