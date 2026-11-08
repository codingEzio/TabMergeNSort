import { VERSION } from "./src/version.js";
import { createSortPreference } from "./src/policy.js";

const api = globalThis.chrome;
// Only the popup has the invocation window context. Capture it before storage
// reads or user actions; the background must not infer it from later focus.
const invocationWindowId = api.windows.getCurrent().then(
  (window) => window?.id,
  () => undefined,
);
const sortPreference = createSortPreference(api.storage.local);
const language = api.i18n.getUILanguage();
const numbers = new Intl.NumberFormat(language.replace("_", "-"));
const sortBy = document.querySelector("#sort-by");
const status = document.querySelector("#status");
const buttons = [...document.querySelectorAll("button[data-action]")];

document.querySelector("#version").textContent = `v${VERSION}`;

function t(key, ...substitutions) {
  return api.i18n.getMessage(key, substitutions) || key;
}

function localize() {
  document.documentElement.lang = language;
  document.title = t("extName");
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.getAttribute("data-i18n") ?? "");
  }
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
    node.setAttribute(
      "aria-label",
      t(node.getAttribute("data-i18n-aria-label") ?? ""),
    );
  }
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function setBusy(busy) {
  for (const button of buttons) button.disabled = busy;
  sortBy.disabled = busy;
}

function missingNote(missing) {
  return Array.isArray(missing) && missing.length
    ? ` ${t("closedDuringOperation", numbers.format(missing.length))}`
    : "";
}

function actionMessage(result) {
  const missing = missingNote(result.missing);
  if (result.action === "merge") {
    return (result.merged
      ? t("mergeDone", numbers.format(result.merged))
      : t("mergeNothing")) + missing;
  }
  if (result.action === "sort") {
    return t(
      "sortDone",
      numbers.format(result.sorted),
      t(result.sortBy),
    ) + missing;
  }
  if (result.action === "sortall") {
    return t(
      "sortAllDone",
      numbers.format(result.sorted),
      numbers.format(result.windows),
      t(result.sortBy),
    ) + missing;
  }
  return t(
    "bothDone",
    numbers.format(result.merged),
    numbers.format(result.sorted),
    t(result.sortBy),
  ) + missing;
}

const ERROR_MESSAGE = {
  window: "errorWindow",
  windowType: "errorWindowType",
  order: "errorOrder",
  action: "errorAction",
  runtime: "errorRuntime",
  unsupported: "errorUnsupported",
};

async function loadSortBy() {
  setBusy(true);
  try {
    sortBy.value = await sortPreference.load();
  } catch {
    sortBy.value = "url";
    setStatus(t("sortReadFailed"), true);
  } finally {
    setBusy(false);
  }
}

sortBy.addEventListener("change", () => {
  setBusy(true);
  setStatus(t("savingSort"));
  void sortPreference.save(sortBy.value).then(
    () => setStatus(t("sortSaved")),
    () => setStatus(t("sortSaveFailed"), true),
  ).finally(() => setBusy(false));
});

for (const button of buttons) {
  button.addEventListener("click", async () => {
    setBusy(true);
    button.setAttribute("aria-busy", "true");
    setStatus(t("working"));
    try {
      const windowId = await invocationWindowId;
      if (!Number.isInteger(windowId) || windowId < 0) {
        throw Object.assign(new Error(t("errorWindow")), { code: "window" });
      }
      const response = await api.runtime.sendMessage({
        type: "run",
        action: button.dataset.action,
        sortBy: sortBy.value,
        windowId,
      });
      if (!response?.ok) {
        const code = response?.code ?? "runtime";
        throw Object.assign(
          new Error(t(ERROR_MESSAGE[code] ?? "errorRuntime")),
          { code },
        );
      }
      setStatus(actionMessage(response.result));
    } catch (error) {
      setStatus(error?.code ? error.message : t("errorRuntime"), true);
    } finally {
      button.setAttribute("aria-busy", "false");
      setBusy(false);
    }
  });
}

localize();
void loadSortBy();
