import {
  mergeTabIds,
  missingIds,
  normalizeSortBy,
  orderedTabIds,
  orderMatches,
  sortableWindowIds,
} from "./src/policy.js";

const api = globalThis.chrome;
const ACTIONS = ["merge", "sort", "sortall", "both"];

class OperationError extends Error {
  constructor(code, detail = "") {
    super(detail || code);
    this.code = code;
  }
}

async function invocationWindow(windowId) {
  if (!Number.isInteger(windowId) || windowId < 0) {
    throw new OperationError("window");
  }
  let window;
  try {
    window = await api.windows.get(windowId);
  } catch {
    throw new OperationError("window");
  }
  if (window?.id !== windowId) throw new OperationError("window");
  if (window.type !== "normal" || window.incognito !== false) {
    throw new OperationError("windowType");
  }
  return window;
}

async function allTabIds() {
  return (await api.tabs.query({})).map((tab) => tab.id);
}

// Move exactly the tabs that still exist. A vanished tab is returned to the
// caller instead of silently shrinking the operation.
async function movePresent(planned, destination) {
  const presentIds = await allTabIds();
  const missing = missingIds(planned, presentIds);
  const movable = planned.filter((id) => !missing.includes(id));
  if (movable.length > 0) await api.tabs.move(movable, destination);
  return { moved: movable.length, missing };
}

async function mergeInto(windowId) {
  const tabs = await api.tabs.query({ windowType: "normal" });
  const planned = mergeTabIds(tabs, windowId);
  const result = await movePresent(planned, { windowId, index: -1 });
  return result;
}

async function sortWindow(windowId, sortBy) {
  const tabs = await api.tabs.query({ windowId });
  const planned = orderedTabIds(tabs, sortBy);
  if (planned.length > 1) {
    const result = await movePresent(planned, { windowId, index: 0 });
    const actual = (await api.tabs.query({ windowId })).map((tab) => tab.id);
    const expected = planned.filter((id) => !result.missing.includes(id));
    if (!orderMatches(expected, actual)) {
      throw new OperationError("order");
    }
    return result;
  }
  return { moved: planned.length, missing: [] };
}

async function sortAllWindows(sortBy) {
  const windows = await api.windows.getAll({ windowTypes: ["normal"] });
  const windowIds = sortableWindowIds(windows);
  const results = [];
  for (const windowId of windowIds) {
    results.push(await sortWindow(windowId, sortBy));
  }
  return {
    windows: windowIds.length,
    moved: results.reduce((total, result) => total + result.moved, 0),
    missing: [...new Set(results.flatMap((result) => result.missing))],
  };
}

async function run(message) {
  const action = ACTIONS.includes(message?.action) ? message.action : undefined;
  if (!action) throw new OperationError("action");
  const sortBy = normalizeSortBy(message.sortBy);
  const window = await invocationWindow(message.windowId);
  if (typeof api.tabs.move !== "function") {
    throw new OperationError("unsupported");
  }

  if (action === "merge") {
    const { moved, missing } = await mergeInto(window.id);
    return { action, sortBy, merged: moved, sorted: 0, missing };
  }
  if (action === "sort") {
    const { moved, missing } = await sortWindow(window.id, sortBy);
    return { action, sortBy, merged: 0, sorted: moved, missing };
  }
  if (action === "sortall") {
    const { windows, moved, missing } = await sortAllWindows(sortBy);
    return {
      action,
      sortBy,
      merged: 0,
      sorted: moved,
      windows,
      missing,
    };
  }
  const merge = await mergeInto(window.id);
  const sort = await sortWindow(window.id, sortBy);
  return {
    action,
    sortBy,
    merged: merge.moved,
    sorted: sort.moved,
    missing: [...new Set([...merge.missing, ...sort.missing])],
  };
}

let queue = Promise.resolve();

api.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== api.runtime.id || message?.type !== "run") return false;
  queue = queue.then(async () => {
    try {
      reply({ ok: true, result: await run(message) });
    } catch (error) {
      reply({
        ok: false,
        code: error instanceof OperationError ? error.code : "runtime",
        detail: String(error?.message ?? error),
      });
    }
  });
  return true;
});
