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
  const command = await new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write=Local",
      "scripts/package_chrome.ts",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!command.success) {
    throw new Error(new TextDecoder().decode(command.stderr));
  }
  const result = JSON.parse(new TextDecoder().decode(command.stdout).trim());
  const packageRoot = join(result.output, "extension_chrome");
  const receipt = JSON.parse(
    await Deno.readTextFile(join(result.output, "receipt.json")),
  );
  const files = new Set<string>(
    receipt.files.map((file: { path: string }) => file.path),
  );
  assertEquals(result.chromeId, "ghblmligghdjladgiknambpkkmpdobml");
  assertEquals([...files].some((path) => path.startsWith("ui-fonts/")), false);
  for (
    const path of ["browser-emoji.js", "ui-interactions.js", "ui-typography.js"]
  ) {
    assertEquals(files.has(path), false);
  }
  for (const file of receipt.files as { path: string; bytes: number }[]) {
    const bytes = await Deno.readFile(join(packageRoot, file.path));
    assertEquals(bytes.length, file.bytes);
    assertEquals(
      bytes,
      await Deno.readFile(join("extension_chrome", file.path)),
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
  for (const locale of ["en", "es", "ja", "ko", "ru", "uk", "zh_CN", "zh_TW"]) {
    assertEquals(files.has(`_locales/${locale}/messages.json`), true);
  }
  console.log(
    `Chrome package: ${files.size} files, ${
      receipt.files.reduce((sum: number, file: { bytes: number }) =>
        sum + file.bytes, 0)
    } bytes`,
  );
});
