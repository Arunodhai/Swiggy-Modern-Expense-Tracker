const ORDER_PATH_HINTS = ["/my-account/orders", "/checkout/order"]; 

function shouldAttemptExtraction() {
  return ORDER_PATH_HINTS.some((path) => location.pathname.includes(path));
}

function parseAmount(text) {
  if (!text) return null;
  const clean = text.replace(/[,\u00a0]/g, "");
  const match = clean.match(/(?:₹|Rs\.?|INR)\s*(\d+(?:\.\d{1,2})?)/i);
  return match ? Number(match[1]) : null;
}

function parseDate(text) {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  const dt = new Date(normalized);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toISOString();
  }

  const match = normalized.match(/(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})?/);
  if (!match) return null;
  const day = Number(match[1]);
  const mon = match[2];
  const year = match[3] ? Number(match[3]) : new Date().getFullYear();
  const fallback = new Date(`${day} ${mon} ${year}`);
  if (Number.isNaN(fallback.getTime())) return null;
  return fallback.toISOString();
}

function safeText(el) {
  return el?.textContent?.trim() || "";
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function getRenderedLines(el) {
  const text = (el?.innerText || safeText(el)).replace(/\u00a0/g, " ");
  return unique(
    text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l.length < 140)
  );
}

function hasOrderSignals(text) {
  return /ORDER\s*#/i.test(text) && /Total\s*Paid/i.test(text);
}

function isNoiseLine(line) {
  return /^(view details|reorder|help|track order)$/i.test(line);
}

function isMetaLine(line) {
  return /^(order\s*#|delivered on|cancelled on|total paid|payment mode|items?)/i.test(line);
}

function looksLikeLocation(line) {
  const text = line.trim();
  if (!text) return false;
  if (/\d/.test(text)) return false;
  if (text.length < 4 || text.length > 35) return false;
  const singleToken = text.split(/\s+/).length === 1;
  if (!singleToken) return false;
  return /^[A-Za-z.'-]+$/.test(text);
}

function pickRestaurant(card, lines) {
  const heading = card.querySelector("h1,h2,h3,h4,[role='heading'],strong");
  const headingText = heading?.textContent?.trim();
  if (headingText && !isMetaLine(headingText) && !isNoiseLine(headingText)) {
    return headingText;
  }

  const orderIdx = lines.findIndex((line) => /ORDER\s*#/i.test(line));
  if (orderIdx > 0) {
    if (orderIdx > 1) {
      const twoAbove = lines[orderIdx - 2];
      if (
        twoAbove &&
        twoAbove.length >= 3 &&
        twoAbove.length <= 60 &&
        !isMetaLine(twoAbove) &&
        !isNoiseLine(twoAbove) &&
        !looksLikeLocation(twoAbove)
      ) {
        return twoAbove;
      }
    }

    for (let i = orderIdx - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (line.length < 3 || line.length > 60) continue;
      if (isMetaLine(line) || isNoiseLine(line)) continue;
      if (looksLikeLocation(line) && i === orderIdx - 1) continue;
      return line;
    }
  }

  for (const line of lines) {
    if (line.length < 3 || line.length > 60) continue;
    if (isMetaLine(line) || isNoiseLine(line)) continue;
    return line;
  }
  return "Unknown";
}

function parseOrderFromCard(card) {
  const text = safeText(card);
  if (!text || text.length < 80 || text.length > 2000) return null;

  const lines = getRenderedLines(card);
  const amountMatch = text.match(/Total\s*Paid\s*:\s*(?:₹|Rs\.?|INR)?\s*([0-9,\u00a0]+(?:\.\d{1,2})?)/i);
  const amount = amountMatch
    ? Number(amountMatch[1].replace(/[,\u00a0]/g, ""))
    : parseAmount(text) || 0;

  const idMatch = text.match(/ORDER\s*#\s*([A-Z0-9]+)/i);
  const orderId = idMatch ? idMatch[1] : null;

  const orderLine = lines.find((line) => /ORDER\s*#/i.test(line)) || "";
  const deliveredLine = lines.find((line) => /Delivered on|Cancelled on/i.test(line)) || "";
  const dateFromOrderLine = orderLine.includes("|") ? orderLine.split("|").slice(1).join("|").trim() : "";
  const dateFromDelivered = deliveredLine.replace(/^(Delivered on|Cancelled on)\s*/i, "").trim();
  const dateISO = parseDate(dateFromOrderLine || dateFromDelivered || text);

  const restaurant = pickRestaurant(card, lines);

  const status = /cancel/i.test(text)
    ? "cancelled"
    : /deliver/i.test(text)
    ? "delivered"
    : /prepar|on the way|arriv/i.test(text)
    ? "in-progress"
    : "unknown";

  const items = lines
    .filter((line) => /\bx\s*\d+\b/i.test(line) || /\d+\s*x\b/i.test(line))
    .slice(0, 4);

  if (!orderId && !amount) return null;

  return {
    source: "swiggy",
    orderId,
    restaurant: restaurant || "Unknown",
    amount: Number.isFinite(amount) ? amount : 0,
    dateISO,
    status,
    items,
    rawSnippet: text.slice(0, 250)
  };
}

function extractOrdersFromCards() {
  const potential = Array.from(document.querySelectorAll("div, article, section, li")).filter((el) => {
    const text = safeText(el);
    return hasOrderSignals(text);
  });

  const cards = potential.filter((el) => {
    const nested = Array.from(el.querySelectorAll("div, article, section, li")).some((child) => {
      if (child === el) return false;
      return hasOrderSignals(safeText(child));
    });
    return !nested;
  });

  const orders = [];

  for (const card of cards) {
    const parsed = parseOrderFromCard(card);
    if (parsed) orders.push(parsed);
  }

  return dedupeLikelyDuplicates(orders);
}

function dedupeLikelyDuplicates(orders) {
  const map = new Map();
  for (const order of orders) {
    const key = order.orderId || `${order.dateISO || "na"}-${order.restaurant}-${order.amount}`;
    if (!map.has(key)) map.set(key, order);
  }
  return Array.from(map.values());
}

function extractProfileFromPage() {
  const phoneRegex = /(?:\+?91[\s-]?)?[6-9]\d{9}/;
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const blockedNames =
    /^(edit profile|my account|profile|swiggy corporate|swiggy one|offers|help|search|cart)$/i;
  const isValidName = (v) => {
    const s = String(v || "").trim();
    if (!s || s.length < 3 || s.length > 60) return false;
    if (/\d/.test(s)) return false;
    if (s.includes("@")) return false;
    if (blockedNames.test(s)) return false;
    return true;
  };

  // 1) Strong signal: profile contact row has both phone + email, name is usually a heading nearby.
  const contactEl = Array.from(document.querySelectorAll("div, p, span")).find((el) => {
    const t = safeText(el);
    return emailRegex.test(t) && phoneRegex.test(t.replace(/\s+/g, ""));
  });
  if (contactEl) {
    let cursor = contactEl;
    for (let i = 0; i < 4 && cursor; i += 1) {
      const heading = cursor.querySelector("h1, h2, h3, [role='heading']");
      const candidate = heading?.textContent?.trim();
      if (isValidName(candidate)) {
        const phoneMatch = safeText(contactEl).replace(/\s+/g, "").match(phoneRegex);
        return { name: candidate, phone: phoneMatch ? phoneMatch[0] : "" };
      }
      cursor = cursor.parentElement;
    }
  }

  const sections = Array.from(document.querySelectorAll("div, section, header"));
  for (const section of sections) {
    const text = safeText(section);
    if (!text || text.length < 20 || text.length > 1200) continue;
    if (!emailRegex.test(text)) continue;
    const phoneMatch = text.replace(/\s+/g, "").match(phoneRegex);
    if (!phoneMatch) continue;

    const heading = section.querySelector("h1, h2, h3, [role='heading']");
    const candidate = heading?.textContent?.trim() || "";
    if (isValidName(candidate)) {
      return { name: candidate, phone: phoneMatch[0] };
    }
  }

  const lines = getRenderedLines(document.body).slice(0, 180);
  let phone = "";
  let name = "";
  let phoneIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].replace(/\s+/g, "").match(phoneRegex);
    if (match) {
      phone = match[0];
      phoneIndex = i;
      break;
    }
  }

  if (phoneIndex > 0) {
    for (let i = phoneIndex - 1; i >= Math.max(0, phoneIndex - 5); i -= 1) {
      const candidate = lines[i].trim();
      if (!isValidName(candidate)) continue;
      name = candidate;
      break;
    }
  }

  if (!name) {
    const heading = document.querySelector("h1, h2, h3, [role='heading']");
    const headingText = heading?.textContent?.trim() || "";
    if (isValidName(headingText)) {
      name = headingText;
    }
  }

  return { name, phone };
}

async function extractAndStore() {
  const profile = extractProfileFromPage();
  await chrome.runtime.sendMessage({ type: "UPSERT_PROFILE", profile });

  const orders = extractOrdersFromCards();
  if (!orders.length) {
    return { ok: true, extracted: 0, message: "No orders found on this page.", profile };
  }

  const withAmount = orders.filter((o) => Number(o.amount) > 0).length;
  const response = await chrome.runtime.sendMessage({ type: "UPSERT_ORDERS", orders });
  return {
    ok: true,
    extracted: orders.length,
    withAmount,
    totalStored: response?.count || null,
    profile
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "EXTRACT_ORDERS_NOW") {
    extractAndStore().then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }
  return false;
});

if (shouldAttemptExtraction()) {
  window.setTimeout(() => {
    extractAndStore().catch(() => {});
  }, 2500);
}
