const summaryEl = document.getElementById("summary");
const statusEl = document.getElementById("status");
const syncBtn = document.getElementById("syncBtn");
const dashboardBtn = document.getElementById("dashboardBtn");

function currency(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(n || 0);
}

async function loadSummary() {
  const data = await chrome.runtime.sendMessage({ type: "GET_ORDERS" });
  const orders = data?.orders || [];
  const total = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  summaryEl.textContent = `${orders.length} orders tracked • ${currency(total)} spent`;
}

syncBtn.addEventListener("click", async () => {
  statusEl.textContent = "Syncing...";
  const res = await chrome.runtime.sendMessage({ type: "TRIGGER_SYNC_ACTIVE_TAB" });
  if (!res?.ok) {
    statusEl.textContent = res?.error || "Sync failed. Open Swiggy orders page and retry.";
    return;
  }
  statusEl.textContent = `Synced ${res.extracted || 0} orders (${res.withAmount || 0} with amount).`;
  await loadSummary();
});

dashboardBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
});

loadSummary().catch(() => {
  summaryEl.textContent = "Could not load stats.";
});
