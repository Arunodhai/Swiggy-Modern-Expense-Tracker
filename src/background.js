const STORAGE_KEY = "swiggy_orders_v1";
const PROFILE_KEY = "swiggy_profile_v1";

function sanitizeProfile(profile) {
  const rawName = String(profile?.name || "").trim();
  const rawPhone = String(profile?.phone || "").trim();
  const cleanedName =
    /^(edit profile|my account|profile|swiggy corporate|swiggy one|offers|help|search|cart)$/i.test(rawName) ||
    rawName.length < 3
      ? ""
      : rawName;
  const digits = rawPhone.replace(/\D/g, "");
  const cleanedPhone = digits.length >= 10 ? digits.slice(-10) : "";
  return { name: cleanedName, phone: cleanedPhone };
}

async function getOrders() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || [];
}

async function setOrders(orders) {
  await chrome.storage.local.set({ [STORAGE_KEY]: orders });
}

async function getProfile() {
  const data = await chrome.storage.local.get(PROFILE_KEY);
  return data[PROFILE_KEY] || {};
}

async function setProfile(profile) {
  await chrome.storage.local.set({ [PROFILE_KEY]: profile });
}

function orderFingerprint(order) {
  if (order.orderId) {
    return `id:${order.orderId}`;
  }
  return [
    order.dateISO || "",
    order.restaurant || "",
    String(order.amount || 0),
    (order.items || []).join("|")
  ].join("::");
}

function mergeOrders(existing, incoming) {
  const map = new Map();
  for (const order of existing) {
    map.set(orderFingerprint(order), order);
  }
  for (const order of incoming) {
    const key = orderFingerprint(order);
    const prev = map.get(key);
    map.set(key, {
      ...prev,
      ...order,
      syncedAt: new Date().toISOString()
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    const bt = new Date(b.dateISO || 0).getTime();
    const at = new Date(a.dateISO || 0).getTime();
    return bt - at;
  });
}

function isSwiggyUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "www.swiggy.com";
  } catch (_err) {
    return false;
  }
}

function sendExtractMessage(tabId, sendResponse) {
  chrome.tabs.sendMessage(tabId, { type: "EXTRACT_ORDERS_NOW" }, (res) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    sendResponse(res || { ok: false, error: "No response from content script" });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "UPSERT_ORDERS") {
    (async () => {
      const existing = await getOrders();
      const merged = mergeOrders(existing, message.orders || []);
      await setOrders(merged);
      sendResponse({ ok: true, count: merged.length });
    })();
    return true;
  }

  if (message?.type === "GET_ORDERS") {
    (async () => {
      const orders = await getOrders();
      sendResponse({ ok: true, orders });
    })();
    return true;
  }

  if (message?.type === "UPSERT_PROFILE") {
    (async () => {
      const existing = sanitizeProfile(await getProfile());
      const incoming = sanitizeProfile(message.profile || {});
      const merged = {
        name: incoming.name || existing.name || "",
        phone: incoming.phone || existing.phone || "",
        syncedAt: new Date().toISOString()
      };
      await setProfile(merged);
      sendResponse({ ok: true, profile: merged });
    })();
    return true;
  }

  if (message?.type === "GET_PROFILE") {
    (async () => {
      const profile = await getProfile();
      sendResponse({ ok: true, profile });
    })();
    return true;
  }

  if (message?.type === "OPEN_DASHBOARD") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard.html") });
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "TRIGGER_SYNC_ACTIVE_TAB") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }

      if (!isSwiggyUrl(tab.url)) {
        sendResponse({
          ok: false,
          error: "Open a Swiggy tab (https://www.swiggy.com) and try again."
        });
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_ORDERS_NOW" }, async (res) => {
        if (!chrome.runtime.lastError) {
          sendResponse(res || { ok: false, error: "No response from content script" });
          return;
        }

        const message = chrome.runtime.lastError.message || "";
        if (!message.includes("Receiving end does not exist")) {
          sendResponse({ ok: false, error: message });
          return;
        }

        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["src/content.js"]
          });
          sendExtractMessage(tab.id, sendResponse);
        } catch (err) {
          sendResponse({
            ok: false,
            error: err?.message || "Failed to inject content script."
          });
        }
      });
    })();
    return true;
  }

  return false;
});
