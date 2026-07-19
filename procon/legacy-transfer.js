import {
  LEGACY_STORAGE_KEY,
  TARGET_ORIGIN,
  TARGET_URL,
  createHandoffEnvelope,
  parseLegacyStorage,
  parseReadyMessage,
} from "./legacy-handoff.js?v=7";

const button = document.getElementById("copy-to-standalone");
const status = document.getElementById("legacy-transfer-status");

if (button && status) bindLegacyTransfer(button, status);

export function bindLegacyTransfer(control, statusOutput) {
  let targetWindow = null;
  let pendingPayload = null;

  const updateAvailability = () => {
    try {
      parseLegacyStorage(localStorage.getItem(LEGACY_STORAGE_KEY));
      control.disabled = false;
      statusOutput.textContent = "Saved prototype data is available to copy.";
    } catch {
      control.disabled = true;
      statusOutput.textContent = "No compatible saved prototype data was found on this device.";
    }
  };

  control.addEventListener("click", () => {
    try {
      pendingPayload = parseLegacyStorage(localStorage.getItem(LEGACY_STORAGE_KEY));
    } catch (error) {
      control.disabled = true;
      statusOutput.textContent = error instanceof Error
        ? error.message
        : "The saved prototype data could not be read.";
      return;
    }

    // This window relationship is intentional: the exact-origin, nonce-bound
    // postMessage exchange is the transfer channel.
    targetWindow = window.open(TARGET_URL, "procon-standalone-transfer");
    if (!targetWindow) {
      statusOutput.textContent = "The new window was blocked. Allow popups here, then try again.";
      return;
    }
    targetWindow.focus();
    statusOutput.textContent = "Waiting for the standalone app to request this copy…";
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== TARGET_ORIGIN || event.source !== targetWindow || !pendingPayload) return;
    const nonce = parseReadyMessage(event.data);
    if (!nonce) return;
    targetWindow.postMessage(createHandoffEnvelope(pendingPayload, nonce), TARGET_ORIGIN);
    pendingPayload = null;
    statusOutput.textContent = "Copy offered. In the new ProCon, choose Add or Replace to finish.";
  });

  const appStorageStatus = document.getElementById("storage-status");
  if (appStorageStatus) {
    new MutationObserver(updateAvailability).observe(appStorageStatus, {
      attributes: true,
      attributeFilter: ["data-state"],
      childList: true,
    });
  }

  updateAvailability();
}
