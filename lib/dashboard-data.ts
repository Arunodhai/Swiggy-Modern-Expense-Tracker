"use client";

export type Order = {
  source: string;
  orderId: string | null;
  restaurant: string;
  amount: number;
  dateISO: string | null;
  status: string;
  items: string[];
  syncedAt: string;
};

export type Profile = {
  name: string;
  phone: string;
};

export type DeltaInfo = {
  cls: "up" | "down" | "flat";
  txt: string;
};

export type KpiCard = {
  value: string;
  label: string;
  meta: string;
  delta?: DeltaInfo;
};

export type DashboardSnapshot = {
  orders: Order[];
  profile: Profile;
  years: string[];
  selectedYear: string;
  subtitle: string;
  kpis: {
    total: KpiCard;
    orders: KpiCard;
    avg: KpiCard;
    months: KpiCard;
    topRestaurant: KpiCard;
    topItem: KpiCard;
  };
};

export const THEME_KEY = "swiggy_theme_v1";
export const CARD_KEY = "swiggy_cards_v1";
export const CSV_KEY = "swiggy_orders_v1";
export const PROFILE_KEY = "swiggy_profile_v1";

const ALIASES: Record<string, string> = {
  "nool paratha": "Nool Porotta",
  "nool porotta": "Nool Porotta",
  "nool poratta": "Nool Porotta",
  porotta: "Porotta",
  parotta: "Porotta",
  paratha: "Porotta",
  "kerala parota": "Porotta",
  "kerala parotta": "Porotta",
  kuboos: "Kuboos",
  khubz: "Kuboos",
  khuboos: "Kuboos",
  "chicken shawarma": "Chicken Shawarma",
  "beef shawarma": "Beef Shawarma",
  "al faham": "Al Faham",
  alfaham: "Al Faham",
  "al-faham": "Al Faham"
};

function inBrowser() {
  return typeof window !== "undefined";
}

function monthKey(iso: string | null) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  if (key === "Unknown") {
    return key;
  }

  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-IN", {
    month: "short",
    year: "2-digit"
  });
}

function orderYear(iso: string | null) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return String(date.getFullYear());
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => number
) {
  const map = new Map<string, number>();

  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + valueFn(item));
  }

  return map;
}

function topOf(map: Map<string, number>) {
  const entries = [...map.entries()];
  if (!entries.length) {
    return null;
  }

  return entries.sort((a, b) => b[1] - a[1])[0];
}

function median(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function previousNonZero(
  current: string,
  keys: string[],
  valueFn: (key: string) => number
) {
  const all = [...new Set([...keys, current])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  let index = all.indexOf(current);

  if (index < 0) {
    const firstIndex = all.findIndex((key) => key > current);
    index = firstIndex < 0 ? all.length : firstIndex;
  }

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (Number(valueFn(all[cursor]) || 0) > 0) {
      return all[cursor];
    }
  }

  return null;
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function cleanRestaurant(name: string) {
  return String(name || "?").replace(/\s+restaurant$/i, "").trim();
}

function delta(current: number, previous: number): DeltaInfo {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { cls: "flat", txt: "→ 0%" };
  }

  if (previous === 0) {
    return current === 0 ? { cls: "flat", txt: "→ 0%" } : { cls: "up", txt: "↑ 100%+" };
  }

  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.1) {
    return { cls: "flat", txt: "→ 0%" };
  }

  const rounded = Math.round(Math.abs(percent));
  return percent >= 0
    ? { cls: "up", txt: `↑ ${rounded}%` }
    : { cls: "down", txt: `↓ ${rounded}%` };
}

function normalizeItem(raw: string) {
  const base = raw.replace(/\s+/g, " ").replace(/[|]/g, "").trim();
  return ALIASES[base.toLowerCase()] || base;
}

function parseItem(line: string) {
  const value = line.trim();
  if (!value) {
    return null;
  }

  let match = value.match(/^(.*?)\s+x\s*(\d+)$/i);
  if (match) {
    return { name: normalizeItem(match[1].trim()), qty: Number(match[2]) };
  }

  match = value.match(/^(\d+)\s*x\s+(.*?)$/i);
  if (match) {
    return { name: normalizeItem(match[2].trim()), qty: Number(match[1]) };
  }

  return { name: normalizeItem(value), qty: 1 };
}

function aggregateItems(orders: Order[]) {
  const map = new Map<string, number>();

  for (const order of orders) {
    for (const line of order.items || []) {
      const item = parseItem(line);
      if (item) {
        map.set(item.name, (map.get(item.name) ?? 0) + item.qty);
      }
    }
  }

  return map;
}

function splitCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  out.push(current);
  return out;
}

function parseAmount(value: string) {
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(dateValue: string, timeValue: string) {
  const date = String(dateValue || "").trim();
  if (!date) {
    return null;
  }

  const time = String(timeValue || "").trim();
  const normalizedTime = /^\d{1,2}:\d{2}$/.test(time) ? time : "00:00";
  const value = new Date(`${date}T${normalizedTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function normalizeItems(raw: string) {
  return String(raw || "")
    .trim()
    .split("|")
    .map((part) => part.replace(/\s*\(₹[^)]*\)\s*/g, "").trim())
    .filter(Boolean);
}

function rowToOrder(row: Record<string, string>): Order | null {
  const id = row["order no"] || row["order #"] || row["order id"] || "";
  const restaurant = row.restaurant || "Unknown";
  const amount = parseAmount(row["order total"] || row["total paid"] || row.amount || "");
  const iso = toIso(row.date, row.time);

  if (!restaurant && !iso && !id) {
    return null;
  }

  return {
    source: "csv",
    orderId: String(id).trim() || null,
    restaurant: String(restaurant).trim() || "Unknown",
    amount,
    dateISO: iso,
    status: String(row.status || "delivered").toLowerCase(),
    items: normalizeItems(row.items),
    syncedAt: new Date().toISOString()
  };
}

export function normalizeOrders(orders: Order[]) {
  const map = new Map<string, Order>();

  for (const order of orders) {
    const key = order.orderId
      ? `id:${order.orderId}`
      : `${order.dateISO || "na"}::${order.restaurant}::${order.amount}`;
    map.set(key, order);
  }

  return [...map.values()].sort(
    (left, right) => new Date(right.dateISO || 0).getTime() - new Date(left.dateISO || 0).getTime()
  );
}

export function parseCsvText(text: string) {
  const normalized = String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error("CSV needs a header + data rows.");
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  const profile: Profile = { name: "", phone: "" };

  for (const line of lines.slice(1)) {
    const columns = splitCsvLine(line).map((value) => String(value || "").trim());
    const first = (columns[0] || "").toLowerCase();

    if (first === "name") {
      profile.name = columns[1] || "";
      continue;
    }

    if (first === "phone") {
      profile.phone = columns[1] || "";
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = columns[index] || "";
    });
    rows.push(row);
  }

  return { rows, profile };
}

export function importOrdersFromCsvText(text: string) {
  const parsed = parseCsvText(text);
  const orders = normalizeOrders(parsed.rows.map(rowToOrder).filter(Boolean) as Order[]);
  if (!orders.length) {
    throw new Error("No valid orders found.");
  }

  return {
    orders,
    profile: parsed.profile
  };
}

export function getStoredOrders() {
  if (!inBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CSV_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

export function setStoredOrders(orders: Order[]) {
  if (!inBrowser()) {
    return;
  }

  window.localStorage.setItem(CSV_KEY, JSON.stringify(normalizeOrders(orders)));
}

export function getStoredProfile(): Profile {
  if (!inBrowser()) {
    return { name: "", phone: "" };
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : { name: "", phone: "" };
  } catch {
    return { name: "", phone: "" };
  }
}

export function setStoredProfile(profile: Profile) {
  if (!inBrowser()) {
    return;
  }

  window.localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      name: String(profile?.name || "").trim(),
      phone: String(profile?.phone || "").trim()
    })
  );
}

export function clearStoredDashboardData() {
  if (!inBrowser()) {
    return;
  }

  window.localStorage.removeItem(CARD_KEY);
  window.localStorage.removeItem(CSV_KEY);
  window.localStorage.removeItem(PROFILE_KEY);
}

export function getStoredTheme() {
  if (!inBrowser()) {
    return "dark";
  }

  return window.localStorage.getItem(THEME_KEY) || "dark";
}

export function setStoredTheme(theme: string) {
  if (!inBrowser()) {
    return;
  }

  window.localStorage.setItem(THEME_KEY, theme === "dark" ? "dark" : "light");
}

export function getStoredCardOrder() {
  if (!inBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CARD_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function setStoredCardOrder(order: string[]) {
  if (!inBrowser()) {
    return;
  }

  window.localStorage.setItem(CARD_KEY, JSON.stringify(order));
}

export function computeDashboardSnapshot(
  orders: Order[],
  profile: Profile,
  selectedYear: string
): DashboardSnapshot {
  const years = [...new Set(orders.map((order) => orderYear(order.dateISO)).filter(Boolean) as string[])]
    .sort()
    .reverse();
  const safeSelectedYear = years.includes(selectedYear) || selectedYear === "all" ? selectedYear : "all";
  const filtered =
    safeSelectedYear === "all"
      ? orders
      : orders.filter((order) => orderYear(order.dateISO) === safeSelectedYear);

  const total = filtered.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
  const orderCount = filtered.length;
  const average = orderCount ? total / orderCount : 0;
  const amounts = filtered.map((order) => Number(order.amount) || 0);

  const byMonth = groupBy(filtered, (order) => monthKey(order.dateISO), (order) => Number(order.amount) || 0);
  const byMonthCount = groupBy(filtered, (order) => monthKey(order.dateISO), () => 1);
  const monthEntries = [...byMonth.entries()]
    .filter(([key]) => key !== "Unknown")
    .sort(([left], [right]) => left.localeCompare(right));

  const activeMonths = new Set(filtered.map((order) => monthKey(order.dateISO)).filter((key) => key !== "Unknown"))
    .size;
  const topSpendMonth = topOf(new Map(monthEntries));
  const currentCalendarMonth = currentMonthKey();
  const thisMonthSpend = byMonth.get(currentCalendarMonth) || 0;
  const weekendOrders = filtered.filter((order) => {
    const date = order.dateISO ? new Date(order.dateISO) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return false;
    }

    return date.getDay() === 0 || date.getDay() === 6;
  }).length;

  const sortedMonthKeys = [...byMonth.keys()]
    .filter((key) => key !== "Unknown")
    .sort((left, right) => left.localeCompare(right));
  const currentComparisonMonth =
    safeSelectedYear === "all" ? currentCalendarMonth : sortedMonthKeys[sortedMonthKeys.length - 1] || currentCalendarMonth;
  const previousSpendMonth = previousNonZero(currentComparisonMonth, sortedMonthKeys, (key) => byMonth.get(key) || 0);
  const previousCountMonth = previousNonZero(
    currentComparisonMonth,
    sortedMonthKeys,
    (key) => byMonthCount.get(key) || 0
  );
  const previousAverageMonth = previousNonZero(currentComparisonMonth, sortedMonthKeys, (key) => {
    const count = byMonthCount.get(key) || 0;
    return count ? (byMonth.get(key) || 0) / count : 0;
  });

  const currentSpend = byMonth.get(currentComparisonMonth) || 0;
  const previousSpend = previousSpendMonth ? byMonth.get(previousSpendMonth) || 0 : 0;
  const currentCount = byMonthCount.get(currentComparisonMonth) || 0;
  const previousCount = previousCountMonth ? byMonthCount.get(previousCountMonth) || 0 : 0;
  const currentAverage = currentCount ? currentSpend / currentCount : 0;
  const previousAverage = previousAverageMonth
    ? (byMonth.get(previousAverageMonth) || 0) / Math.max(1, byMonthCount.get(previousAverageMonth) || 0)
    : 0;

  const restaurantCounts = groupBy(filtered, (order) => order.restaurant || "?", () => 1);
  const topRestaurant = topOf(restaurantCounts);

  const items = aggregateItems(filtered);
  const topItem = topOf(items);

  return {
    orders,
    profile,
    years,
    selectedYear: safeSelectedYear,
    subtitle: orders.length ? "Loaded from browser storage." : "Upload your Swiggy orders CSV to see insights.",
    kpis: {
      total: {
        value: formatInr(total),
        label: "Total spend",
        meta:
          safeSelectedYear === "all"
            ? `This month: ${formatInr(thisMonthSpend)}`
            : `${safeSelectedYear} spend: ${formatInr(total)}`,
        delta: delta(currentSpend, previousSpend)
      },
      orders: {
        value: String(orderCount),
        label: "Total orders",
        meta: `Wknd ${weekendOrders} / Wkdy ${Math.max(0, orderCount - weekendOrders)}`,
        delta: delta(currentCount, previousCount)
      },
      avg: {
        value: formatInr(average),
        label: "Avg order value",
        meta: `Median: ${formatInr(median(amounts))}`,
        delta: delta(currentAverage, previousAverage)
      },
      months: {
        value: String(activeMonths),
        label: "Active months",
        meta: topSpendMonth
          ? `Highest: ${monthLabel(topSpendMonth[0])} (${formatInr(topSpendMonth[1])})`
          : "Highest month: NA"
      },
      topRestaurant: {
        value: topRestaurant ? cleanRestaurant(topRestaurant[0]) : "NA",
        label: "Most used restaurant",
        meta: topRestaurant ? `${topRestaurant[1]} orders` : "0 orders"
      },
      topItem: {
        value: topItem ? topItem[0] : "NA",
        label: "Most ordered item",
        meta: topItem ? `${topItem[1]} qty` : "0 qty"
      }
    }
  };
}
