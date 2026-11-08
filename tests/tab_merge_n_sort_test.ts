import {
  mergeTabIds,
  missingIds,
  normalizeSortBy,
  orderedTabIds,
  orderMatches,
  sortableWindowIds,
} from "../extension_chrome/src/policy.js";
import { VERSION } from "../extension_chrome/src/version.js";

const policyModule = await import(
  "../extension_chrome/src/policy.js"
) as unknown as Record<string, unknown>;

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    throw new Error(`${message ?? "assertEquals"}: ${left} !== ${right}`);
  }
}

Deno.test("sort choice accepts only the two documented values", () => {
  assertEquals(normalizeSortBy("title"), "title");
  assertEquals(normalizeSortBy("url"), "url");
  assertEquals(normalizeSortBy(undefined), "url");
  assertEquals(normalizeSortBy("bogus"), "url");
});

Deno.test("saved sort choices load and require durable readback", async () => {
  const createSortPreference = policyModule.createSortPreference as (
    storage: {
      get(key: string): Promise<{ sortBy?: string }>;
      set(value: { sortBy: string }): Promise<void>;
    },
  ) => { load(): Promise<string>; save(value: string): Promise<string> };
  if (typeof createSortPreference !== "function") {
    throw new Error("createSortPreference is not implemented");
  }

  let stored = "title";
  let skipNextWrite = false;
  const preference = createSortPreference({
    get: () => Promise.resolve({ sortBy: stored }),
    set: ({ sortBy }) => {
      if (skipNextWrite) {
        skipNextWrite = false;
        return Promise.resolve();
      }
      stored = sortBy;
      return Promise.resolve();
    },
  });
  assertEquals(await preference.load(), "title");
  assertEquals(await preference.save("url"), "url");
  assertEquals(stored, "url");

  skipNextWrite = true;
  let failed = false;
  try {
    await preference.save("title");
  } catch {
    failed = true;
  }
  assertEquals(failed, true, "a write without matching readback must fail");
});

Deno.test("sort keeps pinned tabs first and is stable for equal keys", () => {
  const tabs = [
    { id: 1, index: 0, pinned: false, url: "b.com", title: "B" },
    { id: 2, index: 1, pinned: false, url: "a.com", title: "A" },
    { id: 3, index: 2, pinned: true, url: "c.com", title: "C" },
    { id: 4, index: 3, pinned: false, url: "a.com", title: "A" },
    { id: 5, index: 4, pinned: true, url: "a.com", title: "A" },
  ];
  assertEquals(orderedTabIds(tabs, "url"), [5, 3, 2, 4, 1]);
});

Deno.test("sort is case-insensitive and numeric", () => {
  const tabs = [
    { id: 1, index: 0, pinned: false, url: "site10.com", title: "b" },
    { id: 2, index: 1, pinned: false, url: "site2.com", title: "A" },
    { id: 3, index: 2, pinned: false, url: "SITE1.com", title: "a" },
  ];
  assertEquals(orderedTabIds(tabs, "url"), [3, 2, 1]);
  assertEquals(orderedTabIds(tabs, "title"), [2, 3, 1]);
});

Deno.test("missing url or title sorts as an empty string and keeps source order", () => {
  const tabs = [
    { id: 1, index: 0, pinned: false, title: "Zed" },
    { id: 2, index: 1, pinned: false, url: "", title: undefined },
    { id: 3, index: 2, pinned: false, url: "alpha", title: "" },
  ];
  assertEquals(orderedTabIds(tabs, "url"), [1, 2, 3]);
  assertEquals(orderedTabIds(tabs, "title"), [2, 3, 1]);
});

Deno.test("merge excludes the destination window and keeps a deterministic order", () => {
  const tabs = [
    { id: 1, windowId: 3, index: 1 },
    { id: 2, windowId: 2, index: 2 },
    { id: 3, windowId: 3, index: 0 },
    { id: 4, windowId: 2, index: 0 },
    { id: 5, windowId: 2, index: 1 },
  ];
  assertEquals(mergeTabIds(tabs, 2), [3, 1]);
  assertEquals(mergeTabIds(tabs, 3), [4, 5, 2]);
  assertEquals(mergeTabIds([{ id: 9, windowId: 2, index: 0 }], 2), []);
});

Deno.test("merge never imports incognito tabs into a regular window", () => {
  const tabs = [
    { id: 1, windowId: 2, index: 0, incognito: false },
    { id: 2, windowId: 3, index: 0, incognito: false },
    { id: 3, windowId: 4, index: 0, incognito: true },
  ];
  assertEquals(mergeTabIds(tabs, 2), [2]);
});

Deno.test("sort all targets every regular normal window without merging", () => {
  const windows = [
    { id: 4, type: "normal", incognito: false },
    { id: 8, type: "popup", incognito: false },
    { id: 2, type: "normal", incognito: false },
    { id: 9, type: "normal", incognito: true },
    { id: undefined, type: "normal", incognito: false },
  ];
  assertEquals(sortableWindowIds(windows), [4, 2]);
});

Deno.test("a vanished tab is reported, never silently dropped", () => {
  assertEquals(missingIds([1, 2, 3], [1, 3]), [2]);
  assertEquals(missingIds([1, 2], [1, 2, 4]), []);
});

Deno.test("order readback accepts appended extras but rejects reshuffles", () => {
  assertEquals(orderMatches([1, 2, 3], [1, 2, 3, 4]), true);
  assertEquals(orderMatches([1, 2, 3], [1, 3, 2]), false);
  assertEquals(orderMatches([], [1]), true);
});

Deno.test("background targets the invocation window even when another window has focus", async () => {
  type Tab = {
    id: number;
    windowId: number;
    index: number;
    incognito: boolean;
    url: string;
  };
  type Response = { ok: boolean; code?: string };
  type Listener = (
    message: { type: string; action: string; windowId?: number },
    sender: { id: string },
    reply: (response: Response) => void,
  ) => boolean;
  const scope = globalThis as typeof globalThis & { chrome?: unknown };
  const previous = scope.chrome;
  let listener: Listener | undefined;
  let focusLookups = 0;
  let tabs: Tab[] = [];
  const moves: { ids: number[]; windowId: number }[] = [];
  const windows = [1, 2, 3, 4, 5].map((id) => ({
    id,
    type: id === 5 ? "popup" : "normal",
    incognito: id === 4,
  }));
  const resetTabs = () => {
    tabs = windows.map((window) => ({
      id: window.id * 10,
      windowId: window.id,
      index: 0,
      incognito: window.incognito,
      url: `https://example.com/${6 - window.id}`,
    }));
    moves.length = 0;
  };
  scope.chrome = {
    runtime: {
      id: "tab-test",
      onMessage: {
        addListener(value: Listener) {
          listener = value;
        },
      },
    },
    windows: {
      get(id: number) {
        const window = windows.find((window) => window.id === id);
        if (!window) return Promise.reject(new Error("window closed"));
        return Promise.resolve(window);
      },
      getCurrent() {
        focusLookups++;
        return Promise.resolve(windows[0]);
      },
      getLastFocused() {
        focusLookups++;
        return Promise.resolve(windows[0]);
      },
      getAll() {
        return Promise.resolve(windows);
      },
    },
    tabs: {
      query(query: { windowId?: number; windowType?: string }) {
        return Promise.resolve(
          tabs.filter((tab) =>
            (query.windowId === undefined || tab.windowId === query.windowId) &&
            (query.windowType === undefined ||
              windows.find((window) => window.id === tab.windowId)?.type ===
                query.windowType)
          ).sort((left, right) => left.index - right.index),
        );
      },
      move(ids: number[], destination: { windowId: number; index: number }) {
        moves.push({ ids: [...ids], windowId: destination.windowId });
        const moved = ids.map((id) => tabs.find((tab) => tab.id === id)!);
        const remaining = tabs.filter((tab) => !ids.includes(tab.id));
        const target = remaining.filter((tab) =>
          tab.windowId === destination.windowId
        );
        target.splice(
          destination.index < 0 ? target.length : destination.index,
          0,
          ...moved,
        );
        target.forEach((tab, index) => {
          tab.windowId = destination.windowId;
          tab.index = index;
        });
        tabs = [
          ...remaining.filter((tab) => tab.windowId !== destination.windowId),
          ...target,
        ];
        return Promise.resolve(moved);
      },
    },
  };
  try {
    await import(
      "../extension_chrome/background.js?invocation-test"
    );
    const invoke = (action: string, windowId?: number) =>
      new Promise<Response>((resolve) => {
        if (!listener) throw new Error("background listener not registered");
        listener(
          { type: "run", action, windowId },
          { id: "tab-test" },
          resolve,
        );
      });
    for (const action of ["merge", "both"]) {
      resetTabs();
      assertEquals((await invoke(action, 2)).ok, true, action);
      assertEquals(moves.every((move) => move.windowId === 2), true, action);
      assertEquals(
        tabs.filter((tab) => tab.windowId === 2).map((tab) => tab.id).sort(),
        [10, 20, 30],
      );
      assertEquals(
        tabs.filter((tab) => tab.windowId === 4 || tab.windowId === 5).map((
          tab,
        ) => tab.id),
        [40, 50],
      );
    }
    for (
      const [windowId, code] of [[undefined, "window"], [99, "window"], [
        4,
        "windowType",
      ], [5, "windowType"]] as const
    ) {
      resetTabs();
      const response = await invoke("merge", windowId);
      assertEquals(response.ok, false);
      assertEquals(response.code, code);
      assertEquals(moves.length, 0, "invalid destination must never move tabs");
    }
    const mockTabs = (scope.chrome as { tabs: { move?: unknown } }).tabs;
    const supportedMove = mockTabs.move;
    delete mockTabs.move;
    for (const action of ["merge", "sort", "sortall", "both"]) {
      resetTabs();
      const before = JSON.stringify(tabs);
      const response = await invoke(action, 2);
      assertEquals(response.ok, false, action);
      assertEquals(response.code, "unsupported", action);
      assertEquals(moves.length, 0, "unsupported browser must not move tabs");
      assertEquals(JSON.stringify(tabs), before, "tabs remain intact");
    }
    mockTabs.move = supportedMove;
    resetTabs();
    assertEquals(
      (await invoke("merge", 2)).ok,
      true,
      "supported API still works",
    );
    assertEquals(
      focusLookups,
      0,
      "background must not choose a focused window",
    );
  } finally {
    if (previous === undefined) delete scope.chrome;
    else scope.chrome = previous;
  }
});

Deno.test("manifest version matches the popup version authority", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile(
      new URL(
        "../extension_chrome/manifest.json",
        import.meta.url,
      ),
    ),
  );
  assertEquals(manifest.version, VERSION);
});

Deno.test("manifest and popup messages cover all eight locales", async () => {
  const extensionRoot = new URL(
    "../extension_chrome/",
    import.meta.url,
  );
  const manifest = JSON.parse(
    await Deno.readTextFile(new URL("manifest.json", extensionRoot)),
  );
  assertEquals(manifest.default_locale, "en");
  assertEquals(manifest.name, "__MSG_extName__");
  assertEquals(manifest.description, "__MSG_extDescription__");

  const expected = [
    "en",
    "es",
    "ja",
    "ko",
    "ru",
    "uk",
    "zh_CN",
    "zh_TW",
  ];
  const localesRoot = new URL("_locales/", extensionRoot);
  const found: string[] = [];
  for await (const entry of Deno.readDir(localesRoot)) {
    if (entry.isDirectory) found.push(entry.name);
  }
  assertEquals(found.sort(), expected);

  let englishKeys: string[] | undefined;
  let englishMessages: Record<string, unknown> | undefined;
  for (const locale of expected) {
    const messages = JSON.parse(
      await Deno.readTextFile(
        new URL(`${locale}/messages.json`, localesRoot),
      ),
    );
    const keys = Object.keys(messages).sort();
    if (englishKeys === undefined) {
      englishKeys = keys;
      englishMessages = messages;
    } else assertEquals(keys, englishKeys, `${locale} key set`);
    for (const [key, value] of Object.entries(messages)) {
      assertEquals(
        typeof value === "object" && value !== null &&
          typeof (value as { message?: unknown }).message === "string" &&
          Boolean((value as { message: string }).message.trim()),
        true,
        `${locale} has no message for ${key}`,
      );
      assertEquals(
        JSON.stringify((value as { placeholders?: unknown }).placeholders),
        JSON.stringify(
          (englishMessages?.[key] as { placeholders?: unknown })?.placeholders,
        ),
        `${locale} placeholder contract for ${key}`,
      );
    }
  }

  const english = JSON.parse(
    await Deno.readTextFile(new URL("en/messages.json", localesRoot)),
  );
  const keys = new Set<string>();
  for (const file of ["popup.html", "popup.js"]) {
    const source = await Deno.readTextFile(new URL(file, extensionRoot));
    for (
      const match of source.matchAll(/data-i18n(?:-[\w-]+)?="([A-Za-z]+)"/g)
    ) {
      keys.add(match[1]);
    }
    for (const match of source.matchAll(/t\("([A-Za-z]+)"/g)) {
      keys.add(match[1]);
    }
  }
  for (const key of [manifest.name, manifest.description]) {
    const messageKey = String(key).match(/^__MSG_([A-Za-z]+)__$/)?.[1];
    if (messageKey) keys.add(messageKey);
  }
  for (const key of keys) {
    assertEquals(key in english, true, `missing message key ${key}`);
  }
});

Deno.test("VIA requires a configured Mac origin and preserves saved routes", async () => {
  await import("../shared/via/transfer-source.js");
  const via = (globalThis as any).PrometheusViaTransfer;
  let saved: string | undefined;
  const store = via.createStore(
    () => Promise.resolve(saved),
    (value: string) => {
      saved = value;
      return Promise.resolve();
    },
  );
  const initial = await store.load();
  assertEquals(initial.profiles.mac.origin, "");
  initial.selected = "mac";
  saved = JSON.stringify(initial);
  let failure = "";
  try {
    await store.enqueue({
      source: "via-bookmark",
      kind: "bookmark",
      payload: {},
    });
  } catch (e) {
    failure = String(e);
  }
  if (!failure.includes("Configure target origin first")) {
    throw new Error("Missing Mac origin must fail explicitly");
  }
  const origin = "http://10.0.0.1:10012";
  initial.profiles.mac.origin = origin;
  saved = JSON.stringify(initial);
  assertEquals((await store.load()).profiles.mac.origin, origin);
});
