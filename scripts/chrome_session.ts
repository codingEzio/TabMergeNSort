// Minimal Chrome DevTools Protocol session for isolated extension checks.
// Deno-only: uses Deno.Command, fetch and WebSocket. No npm packages.

// Branded Google Chrome 137+ refuses --load-extension, so the check needs a
// Chromium-family binary that still honors it: Chrome for Testing, Chromium,
// or Playwright's bundled Chromium.
function chromiumCandidates(): string[] {
  const home = Deno.env.get("HOME") ?? "";
  const candidates: string[] = [];
  const override = Deno.env.get("EXTENSION_CHECK_CHROME");
  if (override) candidates.push(override);
  const appPaths = [
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    `${home}/Applications/Chromium.app/Contents/MacOS/Chromium`,
    `${home}/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  ];
  candidates.push(...appPaths);
  const playwright = `${home}/Library/Caches/ms-playwright`;
  try {
    for (const entry of Deno.readDirSync(playwright)) {
      if (entry.isDirectory && entry.name.startsWith("chromium-")) {
        candidates.push(
          `${playwright}/${entry.name}/chrome-mac/Chromium.app/Contents/MacOS/Chromium`,
        );
      }
    }
  } catch {
    // No Playwright cache on this machine.
  }
  return candidates.reverse();
}

export function findChrome(): string {
  for (const candidate of chromiumCandidates()) {
    try {
      Deno.statSync(candidate);
      return candidate;
    } catch {
      // Try the next known location.
    }
  }
  throw new Error(
    "No Chromium binary that accepts --load-extension was found. " +
      "Install Chrome for Testing or set EXTENSION_CHECK_CHROME.",
  );
}

// Chrome derives a keyed extension ID from SHA-256 of its decoded DER public
// key. An unkeyed unpacked extension instead uses its absolute path. In both
// cases the first 16 digest bytes map each nibble onto a-p.
export async function extensionIdForDirectory(
  directory: URL,
): Promise<string> {
  const path = Deno.realPathSync(
    decodeURIComponent(directory.pathname).replace(/\/$/, ""),
  );
  const manifest = JSON.parse(
    await Deno.readTextFile(`${path}/manifest.json`),
  );
  let identity: Uint8Array<ArrayBuffer>;
  if (manifest.key === undefined) {
    identity = new TextEncoder().encode(path);
  } else if (typeof manifest.key === "string" && manifest.key.length > 0) {
    identity = Uint8Array.from(
      atob(manifest.key),
      (character) => character.charCodeAt(0),
    );
  } else {
    throw new Error("Extension manifest key must be a base64 DER public key");
  }
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", identity),
  );
  return [...hash.slice(0, 16)].map((byte) =>
    String.fromCharCode(97 + (byte >> 4)) +
    String.fromCharCode(97 + (byte & 15))
  ).join("");
}

export class CdpClient {
  onEvent?: (message: { method?: string; params?: unknown }) => void;
  #socket: WebSocket;
  #nextId = 1;
  #pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (typeof message.id !== "number") {
        this.onEvent?.(message);
        return;
      }
      const entry = this.#pending.get(message.id);
      if (!entry) return;
      this.#pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    };
  }

  static async connect(url: string): Promise<CdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error(`CDP connect failed: ${url}`));
    });
    return new CdpClient(socket);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.#nextId++;
    this.#socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.#pending.delete(id)) {
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15_000);
    });
  }

  close() {
    try {
      this.#socket.close();
    } catch {
      // Already closed.
    }
  }
}

export interface TargetInfo {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

async function exitedWithin(process: Deno.ChildProcess, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      process.status.then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function stopChromium(process: Deno.ChildProcess, port: number) {
  if (await exitedWithin(process, 20)) return true;

  // Ask the browser to quit first. A forced kill of its app process can leave
  // macOS showing an unexpected-quit report after a successful test.
  let socket: WebSocket | undefined;
  let closeRequested = false;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1200),
    });
    const info = await response.json() as { webSocketDebuggerUrl?: string };
    if (info.webSocketDebuggerUrl) {
      socket = new WebSocket(info.webSocketDebuggerUrl);
      const connection = socket;
      const connected = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 1200);
        connection.onopen = () => {
          clearTimeout(timer);
          resolve(true);
        };
        connection.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
      });
      if (connected) {
        connection.send(JSON.stringify({ id: 1, method: "Browser.close" }));
        closeRequested = true;
      }
    }
  } catch {
    // A startup failure may leave no DevTools endpoint to close.
  }
  if (closeRequested && await exitedWithin(process, 4000)) {
    try {
      socket?.close();
    } catch {
      // The browser may have closed the socket first.
    }
    return true;
  }
  try {
    socket?.close();
  } catch {
    // The browser may have closed the socket first.
  }

  try {
    process.kill("SIGTERM");
  } catch {
    // It may have exited between the status check and signal.
  }
  return await exitedWithin(process, 4000);
}

export class ChromeSession {
  #process: Deno.ChildProcess;
  #profile: string;
  #port: number;
  #extensionDir: string;

  private constructor(
    process: Deno.ChildProcess,
    profile: string,
    port: number,
    extensionDir: string,
  ) {
    this.#process = process;
    this.#profile = profile;
    this.#port = port;
    this.#extensionDir = extensionDir;
  }

  static async launch(
    extensionDir: URL,
    port = 9223,
    extraArgs: string[] = [],
  ): Promise<ChromeSession> {
    if (
      Deno.build.os === "darwin" && Deno.env.get("CODEX_SANDBOX") === "seatbelt"
    ) {
      throw new Error(
        "Isolated Chromium is blocked in the macOS sandbox because it can " +
          "abort at startup and show a crash dialog. Run this check outside " +
          "the sandbox; no browser was launched.",
      );
    }
    const profile = await Deno.makeTempDir({ prefix: "extension-check-" });
    const path = decodeURIComponent(extensionDir.pathname).replace(/\/$/, "");
    const process = new Deno.Command(findChrome(), {
      args: [
        "--headless=new",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        // Chrome 137+ gates --load-extension behind this feature switch.
        "--disable-features=Translate,DisableLoadExtensionCommandLineSwitch",
        `--user-data-dir=${profile}`,
        `--load-extension=${path}`,
        `--disable-extensions-except=${path}`,
        `--remote-debugging-port=${port}`,
        ...extraArgs,
        "about:blank",
      ],
      stdout: "null",
      stderr: "null",
    }).spawn();

    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) {
          await response.body?.cancel();
          return new ChromeSession(process, profile, port, path);
        }
      } catch {
        // Not listening yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const stopped = await stopChromium(process, port);
    if (stopped) {
      await Deno.remove(profile, { recursive: true }).catch(() => {});
    }
    if (!stopped) {
      throw new Error(
        "Chromium did not start or exit cleanly; its temporary profile was " +
          "retained for diagnosis.",
      );
    }
    throw new Error("Chrome did not expose a DevTools endpoint in time.");
  }

  async targets(): Promise<TargetInfo[]> {
    const response = await fetch(`http://127.0.0.1:${this.#port}/json/list`);
    const list = await response.json() as TargetInfo[];
    return list;
  }

  async extensionId(): Promise<string> {
    return await extensionIdForDirectory(
      new URL(`file://${this.#extensionDir}/`),
    );
  }

  async openUrl(url: string): Promise<TargetInfo> {
    const response = await fetch(
      `http://127.0.0.1:${this.#port}/json/new?${encodeURIComponent(url)}`,
      { method: "PUT" },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Could not open ${url}: HTTP ${response.status}`);
    }
    const target = await response.json() as TargetInfo;
    if (!target.webSocketDebuggerUrl) {
      throw new Error(`No DevTools websocket for ${url}`);
    }
    return target;
  }

  // Opening an extension page both proves the manifest loaded and gives a page
  // context with the full extension API for UI-driven checks.
  async openExtensionPage(
    extensionId: string,
    file: string,
  ): Promise<TargetInfo> {
    return await this.openUrl(`chrome-extension://${extensionId}/${file}`);
  }

  async evaluate<T>(
    target: TargetInfo,
    expression: string,
  ): Promise<T> {
    if (!target.webSocketDebuggerUrl) throw new Error("Target is not devtools");
    const client = await CdpClient.connect(target.webSocketDebuggerUrl);
    try {
      const result = await client.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      }) as {
        result?: { value?: T };
        exceptionDetails?: {
          text?: string;
          exception?: { description: string };
        };
      };
      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description ??
            result.exceptionDetails.text ?? "Evaluation failed",
        );
      }
      return result.result?.value as T;
    } finally {
      client.close();
    }
  }

  async close() {
    const stopped = await stopChromium(this.#process, this.#port);
    if (!stopped) {
      throw new Error(
        "Disposable Chromium did not exit after Browser.close and SIGTERM; " +
          "its temporary profile was retained.",
      );
    }
    try {
      await Deno.remove(this.#profile, { recursive: true });
    } catch {
      // Best effort; the profile is disposable.
    }
  }
}
