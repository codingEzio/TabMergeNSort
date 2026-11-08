// Pure tab merge/sort policy. No browser APIs, no network, no storage.
// The background service worker and the Deno policy tests share this module.

export const SORT_BY_VALUES = ["url", "title"];

const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

export function normalizeSortBy(value) {
  return value === "title" ? "title" : "url";
}

// Serialize quick successive choices and confirm each storage write before
// reporting it as saved. A resolved set() alone is not durable readback.
export function createSortPreference(storage) {
  let queue = Promise.resolve();
  return {
    async load() {
      const stored = await storage.get("sortBy");
      return normalizeSortBy(stored?.sortBy);
    },
    save(value) {
      const sortBy = normalizeSortBy(value);
      const result = queue.then(async () => {
        await storage.set({ sortBy });
        const stored = await storage.get("sortBy");
        if (stored?.sortBy !== sortBy) {
          throw new Error("Sort choice readback differs from the saved value");
        }
        return sortBy;
      });
      queue = result.catch(() => undefined);
      return result;
    },
  };
}

function compareTabs(sortBy) {
  return (left, right) => {
    const comparison = collator.compare(
      String(left[sortBy] ?? ""),
      String(right[sortBy] ?? ""),
    );
    return comparison ||
      (Number(left.index) - Number(right.index)) ||
      (Number(left.id) - Number(right.id));
  };
}

// Pinned tabs keep their pinned state and come first. Equal keys keep the
// source (index, id) order so sorting is stable.
export function orderedTabIds(tabs, sortBy) {
  const ordered = compareTabs(normalizeSortBy(sortBy));
  const pinned = tabs.filter((tab) => tab?.pinned === true).sort(ordered);
  const ordinary = tabs.filter((tab) => tab?.pinned !== true).sort(ordered);
  return [...pinned, ...ordinary].map((tab) => tab.id);
}

// Tabs already in the destination window are not moved. The remaining tabs keep
// a deterministic window/index/id order so the merge itself is reproducible.
export function mergeTabIds(tabs, targetWindowId) {
  return tabs
    .filter((tab) => tab.incognito !== true && tab.windowId !== targetWindowId)
    .sort((left, right) =>
      (Number(left.windowId) - Number(right.windowId)) ||
      (Number(left.index) - Number(right.index)) ||
      (Number(left.id) - Number(right.id))
    )
    .map((tab) => tab.id);
}

// Sort All keeps every tab in its existing window. Only regular, non-private
// windows with usable IDs are targets; the browser bridge sorts each one
// independently.
export function sortableWindowIds(windows) {
  return windows
    .filter((window) =>
      window?.id !== undefined && window.type === "normal" &&
      window.incognito === false
    )
    .map((window) => window.id);
}

// A tab that is gone must not make a successful-looking operation: the caller
// retries without it and reports it. Returns ids that are no longer present.
export function missingIds(planned, presentIds) {
  const present = new Set(presentIds);
  return planned.filter((id) => !present.has(id));
}

// True when the destination window already holds the planned order for the
// ids that still exist. Extra tabs (for example a tab opened mid-operation)
// are appended at the end, which the caller reports but does not reshuffle.
export function orderMatches(planned, actualIds) {
  return planned.every((id, position) => actualIds[position] === id);
}
