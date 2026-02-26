const subtitleEl = document.getElementById("subtitle");
const totalEl = document.getElementById("kpiTotal");
const ordersEl = document.getElementById("kpiOrders");
const avgEl = document.getElementById("kpiAvg");
const monthsEl = document.getElementById("kpiMonths");
const totalMetaEl = document.getElementById("kpiTotalMeta");
const ordersMetaEl = document.getElementById("kpiOrdersMeta");
const avgMetaEl = document.getElementById("kpiAvgMeta");
const monthsMetaEl = document.getElementById("kpiMonthsMeta");
const topRestaurantEl = document.getElementById("kpiTopRestaurant");
const topRestaurantMetaEl = document.getElementById("kpiTopRestaurantMeta");
const topItemEl = document.getElementById("kpiTopItem");
const topItemMetaEl = document.getElementById("kpiTopItemMeta");
const profilePhoneTextEl = document.getElementById("profilePhoneText");
const monthLabelsEl = document.getElementById("monthLabels");
const orderCalendarGridEl = document.getElementById("orderCalendarGrid");
const calendarInsightEl = document.getElementById("calendarInsight");
const totalOrderDaysEl = document.getElementById("totalOrderDays");
const longestStreakEl = document.getElementById("longestStreak");
const currentStreakEl = document.getElementById("currentStreak");
const refreshBtn = document.getElementById("refreshBtn");
const yearSelectEl = document.getElementById("globalYearSelect");

const monthlyCanvas = document.getElementById("monthlyChart");
const restaurantCanvas = document.getElementById("restaurantChart");
const heatmapCanvas = document.getElementById("heatmapChart");
const itemCountCanvas = document.getElementById("itemCountChart");
const trendCanvas = document.getElementById("trendChart");

const chartTooltipEl = document.createElement("div");
chartTooltipEl.id = "chartTooltip";
document.body.appendChild(chartTooltipEl);

let donutSegments = [];
let monthlyBarRegions = [];
let heatmapRegions = [];
let itemBarRegions = [];
let trendPointRegions = [];
let latestOrders = [];
let selectedYear = "all";

function currency(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(n || 0);
}

function monthKey(dateISO) {
  const dt = dateISO ? new Date(dateISO) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "Unknown";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  if (key === "Unknown") return key;
  const [year, month] = key.split("-").map(Number);
  const dt = new Date(year, month - 1, 1);
  return dt.toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

function orderYear(dateISO) {
  const dt = dateISO ? new Date(dateISO) : null;
  if (!dt || Number.isNaN(dt.getTime())) return null;
  return String(dt.getFullYear());
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function groupBy(arr, keyFn, valueFn = (x) => x) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    const val = valueFn(item);
    map.set(key, (map.get(key) || 0) + val);
  }
  return map;
}

function cleanRestaurantLabel(name) {
  return String(name || "Unknown").replace(/\s+restaurant$/i, "").trim();
}

function cleanProfileName(name) {
  const text = String(name || "").trim();
  if (!text) return "";
  if (/edit profile/i.test(text)) return "";
  return text;
}

function topEntry(map) {
  const entries = Array.from(map.entries());
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0];
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function normalizeItemName(name) {
  return name.replace(/\s+/g, " ").replace(/[|]/g, "").trim();
}

function parseItemLine(line) {
  const parts = line.split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return [];

  const parsed = [];
  for (const part of parts) {
    let match = part.match(/^(.*?)\s*x\s*(\d+)$/i);
    if (match) {
      parsed.push({ name: normalizeItemName(match[1]), qty: Number(match[2]) });
      continue;
    }

    match = part.match(/^(\d+)\s*x\s*(.*?)$/i);
    if (match) {
      parsed.push({ name: normalizeItemName(match[2]), qty: Number(match[1]) });
      continue;
    }

    parsed.push({ name: normalizeItemName(part), qty: 1 });
  }
  return parsed.filter((it) => it.name);
}

function inferCuisine(itemName) {
  const n = itemName.toLowerCase();
  if (/(biryani|tandoori|paneer|roti|naan|parotta|porotta|masala|curry|thali|chicken curry)/.test(n)) {
    return "Indian";
  }
  if (/(noodle|noodles|fried rice|manchurian|chilli|schezwan|hakka|momo|dimsum|wok)/.test(n)) {
    return "Chinese";
  }
  if (/(pizza|pasta|lasagna|garlic bread)/.test(n)) return "Italian";
  if (/(burger|fries|sandwich|wrap|hot dog)/.test(n)) return "Fast Food";
  if (/(shawarma|kebab|al\s*faham|alfaham|mandi|hummus|falafel|arabic|khubz|kuboos)/.test(n)) {
    return "Arabic";
  }
  if (/(dosa|idli|sambar|uttapam|upma|vada)/.test(n)) return "South Indian";
  if (/(cake|brownie|ice cream|dessert|sweet|kunafa|pastry)/.test(n)) return "Desserts";
  if (/(juice|shake|tea|coffee|mojito|drink)/.test(n)) return "Beverages";
  return "Other";
}

function aggregateItems(orders) {
  const itemCount = new Map();
  for (const order of orders) {
    const lines = Array.isArray(order.items) ? order.items : [];
    for (const line of lines) {
      for (const item of parseItemLine(line)) {
        itemCount.set(item.name, (itemCount.get(item.name) || 0) + item.qty);
      }
    }
  }
  return itemCount;
}

function computeStreaks(orders) {
  const uniqueDays = new Set();
  for (const o of orders) {
    const dt = o.dateISO ? new Date(o.dateISO) : null;
    if (!dt || Number.isNaN(dt.getTime())) continue;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    uniqueDays.add(`${y}-${m}-${d}`);
  }

  const dayList = Array.from(uniqueDays)
    .map((s) => new Date(`${s}T00:00:00`))
    .sort((a, b) => a - b);

  if (!dayList.length) return { longest: 0, recent: 0 };

  let longest = 1;
  let running = 1;
  for (let i = 1; i < dayList.length; i += 1) {
    const diff = (dayList[i] - dayList[i - 1]) / (1000 * 60 * 60 * 24);
    if (diff === 1) running += 1;
    else running = 1;
    if (running > longest) longest = running;
  }

  let recent = 1;
  for (let i = dayList.length - 1; i > 0; i -= 1) {
    const diff = (dayList[i] - dayList[i - 1]) / (1000 * 60 * 60 * 24);
    if (diff === 1) recent += 1;
    else break;
  }

  return { longest, recent };
}

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function showTooltip(text, clientX, clientY) {
  chartTooltipEl.textContent = text;
  chartTooltipEl.style.left = `${clientX + 12}px`;
  chartTooltipEl.style.top = `${clientY - 24}px`;
  chartTooltipEl.style.opacity = "1";
}

function renderActivityCalendar(orders) {
  monthLabelsEl.innerHTML = "";
  orderCalendarGridEl.innerHTML = "";

  const dayCounts = new Map();
  for (const order of orders) {
    const dt = order.dateISO ? new Date(order.dateISO) : null;
    if (!dt || Number.isNaN(dt.getTime())) continue;
    const key = ymd(dt);
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  const endDow = end.getDay();
  end.setDate(end.getDate() + (6 - endDow));

  const start = new Date(today);
  start.setDate(today.getDate() - 364);
  const startDow = start.getDay();
  start.setDate(start.getDate() - startDow);

  const weeks = [];
  const totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const totalWeeks = Math.ceil(totalDays / 7);
  for (let w = 0; w < totalWeeks; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      week.push(date);
    }
    weeks.push(week);
  }

  const sampleCell = document.createElement("div");
  sampleCell.className = "day-cell";
  sampleCell.style.visibility = "hidden";
  sampleCell.style.position = "absolute";
  document.body.appendChild(sampleCell);
  const cellSize = sampleCell.getBoundingClientRect().width || 13;
  document.body.removeChild(sampleCell);
  const cellGap = 3;
  const colStep = cellSize + cellGap;

  const calendarWidth = totalWeeks * colStep;
  monthLabelsEl.style.minWidth = `${calendarWidth}px`;
  orderCalendarGridEl.style.minWidth = `${calendarWidth}px`;
  weeks.forEach((week, i) => {
    const monthStart = week.find((d) => d.getDate() === 1 && d <= today);
    if (!monthStart && i !== 0) return;

    const label = document.createElement("span");
    label.className = "month-label";
    const labelMonth = monthStart || week[0];
    label.textContent = labelMonth.toLocaleString("en-IN", { month: "short" }).toUpperCase();
    label.style.left = `${i * colStep}px`;
    monthLabelsEl.appendChild(label);
  });

  weeks.forEach((week) => {
    const col = document.createElement("div");
    col.className = "week-col";
    week.forEach((date) => {
      const key = ymd(date);
      const count = dayCounts.get(key) || 0;
      const isFuture = date > today;
      const level = count >= 4 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0;
      const cell = document.createElement("div");
      cell.className = `day-cell ${isFuture ? "lvl-0" : `lvl-${level}`}`;
      cell.addEventListener("mouseenter", (e) => {
        showTooltip(
          `${count} order${count === 1 ? "" : "s"} - ${date.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
          })}`,
          e.clientX,
          e.clientY
        );
      });
      cell.addEventListener("mousemove", (e) => showTooltip(chartTooltipEl.textContent, e.clientX, e.clientY));
      cell.addEventListener("mouseleave", hideTooltip);
      col.appendChild(cell);
    });
    orderCalendarGridEl.appendChild(col);
  });

  const orderedDays = Array.from(dayCounts.entries()).filter(([, c]) => c > 0).length;
  const streaks = computeStreaks(orders);
  totalOrderDaysEl.textContent = String(orderedDays);
  longestStreakEl.textContent = `${streaks.longest}d`;
  currentStreakEl.textContent = `${streaks.recent}d`;

  const monthActiveDays = new Map();
  for (const week of weeks) {
    for (const d of week) {
      if (d > today) continue;
      const key = ymd(d);
      if ((dayCounts.get(key) || 0) <= 0) continue;
      const mk = `${d.getFullYear()}-${d.getMonth()}`;
      monthActiveDays.set(mk, (monthActiveDays.get(mk) || 0) + 1);
    }
  }
  const topMonth = Array.from(monthActiveDays.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topMonth) {
    const [yearMonth, c] = topMonth;
    const [y, m] = yearMonth.split("-").map(Number);
    const label = new Date(y, m, 1).toLocaleString("en-IN", { month: "short" });
    calendarInsightEl.textContent = `You ordered most in ${label} with ${c} active days.`;
  } else {
    calendarInsightEl.textContent = "No order activity yet.";
  }

  const shell = orderCalendarGridEl.closest(".calendar-shell");
  if (shell) shell.scrollLeft = shell.scrollWidth;
}

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawBarChart(canvas, labels, values, color) {
  const { ctx, w, h } = setupCanvas(canvas);
  clearCanvas(ctx, canvas);
  monthlyBarRegions = [];
  const max = Math.max(...values, 1);
  const left = 24;
  const right = 16;
  const chartHeight = Math.max(90, h * 0.72);
  const chartTop = (h - chartHeight) / 2;
  const chartBottom = chartTop + chartHeight;
  const band = (w - left - right) / Math.max(labels.length, 1);

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.moveTo(left, chartBottom);
  ctx.lineTo(w - right, chartBottom);
  ctx.stroke();

  labels.forEach((label, i) => {
    const x = left + i * band + band * 0.15;
    const bw = band * 0.7;
    const vh = (chartHeight * values[i]) / max;
    const y = chartBottom - vh;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, bw, vh);

    ctx.fillStyle = "#4b5563";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + bw / 2, chartBottom + 14);

    if (canvas === monthlyCanvas) {
      monthlyBarRegions.push({
        x,
        y,
        w: bw,
        h: vh,
        label,
        value: values[i]
      });
    }
  });
}

function drawLineChart(canvas, labels, values, color) {
  const { ctx, w, h } = setupCanvas(canvas);
  clearCanvas(ctx, canvas);
  if (canvas === trendCanvas) trendPointRegions = [];
  const left = 24;
  const right = 16;
  const chartHeight = Math.max(95, h * 0.74);
  const chartTop = (h - chartHeight) / 2;
  const chartBottom = chartTop + chartHeight;
  const max = Math.max(...values, 1);

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.moveTo(left, chartBottom);
  ctx.lineTo(w - right, chartBottom);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  labels.forEach((label, i) => {
    const x = left + (i * (w - left - right)) / Math.max(labels.length - 1, 1);
    const y = chartBottom - (chartHeight * values[i]) / max;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);

    if (canvas === trendCanvas) {
      trendPointRegions.push({ x, y, label, value: values[i] });
    }
  });
  ctx.stroke();

  labels.forEach((label, i) => {
    if (i % Math.ceil(labels.length / 6) !== 0 && i !== labels.length - 1) return;
    const x = left + (i * (w - left - right)) / Math.max(labels.length - 1, 1);
    ctx.fillStyle = "#4b5563";
    ctx.font = "11px sans-serif";
    if (i === 0) {
      ctx.textAlign = "left";
      ctx.fillText(label, Math.max(2, x), chartBottom + 14);
    } else if (i === labels.length - 1) {
      ctx.textAlign = "right";
      ctx.fillText(label, w - right, chartBottom + 14);
    } else {
      ctx.textAlign = "center";
      ctx.fillText(label, x, chartBottom + 14);
    }
  });
}

function handleTrendHover(event) {
  const rect = trendCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  let best = null;
  let bestDist = Infinity;
  for (const pt of trendPointRegions) {
    const dx = x - pt.x;
    const dy = y - pt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = pt;
    }
  }

  if (!best || bestDist > 18) {
    hideTooltip();
    return;
  }

  chartTooltipEl.textContent = `${best.label}: ${best.value} orders`;
  chartTooltipEl.style.left = `${event.clientX + 12}px`;
  chartTooltipEl.style.top = `${event.clientY - 24}px`;
  chartTooltipEl.style.opacity = "1";
}

function drawDonutChart(canvas, values, colors, labels) {
  const { ctx, w, h } = setupCanvas(canvas);
  clearCanvas(ctx, canvas);
  const cx = w * 0.3;
  const cy = h * 0.5;
  const radius = Math.max(48, Math.min(82, h * 0.36));
  const thickness = Math.max(18, radius * 0.36);
  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;
  const sum = values.reduce((a, b) => a + b, 0) || 1;

  donutSegments = [];
  let start = -Math.PI / 2;
  values.forEach((v, i) => {
    const sweep = (v / sum) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + sweep);
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = thickness;
    ctx.stroke();
    donutSegments.push({
      start,
      end: start + sweep,
      value: v,
      label: labels[i],
      cx,
      cy,
      inner,
      outer
    });
    start += sweep;
  });

  labels.forEach((label, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(w * 0.58, 20 + i * 18, 8, 8);
    ctx.fillStyle = "#334155";
    ctx.font = "11px sans-serif";
    const short = label.length > 16 ? `${label.slice(0, 16)}...` : label;
    ctx.fillText(short, w * 0.58 + 13, 27 + i * 18);
  });
}

function drawHorizontalBarChart(canvas, labels, values, color, extraLabels = []) {
  const { ctx, w, h } = setupCanvas(canvas);
  clearCanvas(ctx, canvas);
  itemBarRegions = [];
  const left = 120;
  const right = 16;
  const valueGutter = 44;
  const max = Math.max(...values, 1);
  const rows = Math.max(labels.length, 1);
  const verticalPad = 6;
  const rowH = Math.max(14, Math.min(24, (h - verticalPad * 2) / rows));
  const contentHeight = rowH * rows;
  const top = Math.max(2, (h - contentHeight) / 2);

  labels.forEach((label, i) => {
    const y = top + i * rowH + rowH * 0.2;
    const bh = rowH * 0.6;
    const barArea = w - left - right - valueGutter;
    const bw = (barArea * values[i]) / max;

    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(left, y, barArea, bh);

    ctx.fillStyle = color;
    ctx.fillRect(left, y, bw, bh);

    ctx.fillStyle = "#374151";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    const short = label.length > 16 ? `${label.slice(0, 16)}...` : label;
    ctx.fillText(short, left - 8, y + bh * 0.72);

    ctx.textAlign = "left";
    const suffix = extraLabels[i] ? `  ${extraLabels[i]}` : "";
    const tx = left + barArea + 6;
    ctx.fillText(`${values[i]}${suffix}`, tx, y + bh * 0.72);

    if (canvas === itemCountCanvas) {
      itemBarRegions.push({
        x: 0,
        y: y - 3,
        w,
        h: bh + 6,
        fullLabel: label,
        value: values[i]
      });
    }
  });
}

function hideTooltip() {
  chartTooltipEl.style.opacity = "0";
}

function handleRestaurantHover(event) {
  const rect = restaurantCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  let found = null;
  for (const seg of donutSegments) {
    const dx = x - seg.cx;
    const dy = y - seg.cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < seg.inner || r > seg.outer) continue;

    let angle = Math.atan2(dy, dx);
    if (angle < -Math.PI / 2) angle += Math.PI * 2;
    if (angle >= seg.start && angle <= seg.end) {
      found = seg;
      break;
    }
  }

  if (!found) {
    hideTooltip();
    return;
  }

  chartTooltipEl.textContent = `${cleanRestaurantLabel(found.label)}: ${currency(found.value)}`;
  chartTooltipEl.style.left = `${event.clientX + 12}px`;
  chartTooltipEl.style.top = `${event.clientY - 24}px`;
  chartTooltipEl.style.opacity = "1";
}

function drawHeatmap(canvas, matrix, dayLabels, slotLabels) {
  const { ctx, w, h } = setupCanvas(canvas);
  clearCanvas(ctx, canvas);
  heatmapRegions = [];

  const left = 54;
  const top = 6;
  const right = 12;
  const bottom = 20;
  const cols = slotLabels.length;
  const rows = dayLabels.length;
  const cellW = (w - left - right) / cols;
  const cellH = (h - top - bottom) / rows;
  const max = Math.max(1, ...matrix.flat());

  for (let r = 0; r < rows; r += 1) {
    ctx.fillStyle = "#000000";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(dayLabels[r], left - 6, top + r * cellH + cellH * 0.62);
    for (let c = 0; c < cols; c += 1) {
      const val = matrix[r][c];
      const intensity = val / max;
      const lightness = 96 - intensity * 44;
      const fill = `hsl(145 58% ${lightness}%)`;
      ctx.fillStyle = fill;
      const rx = left + c * cellW + 1;
      const ry = top + r * cellH + 0.5;
      const rw = cellW - 2;
      const rh = cellH - 1;
      ctx.fillRect(rx, ry, rw, rh);
      heatmapRegions.push({
        x: rx,
        y: ry,
        w: rw,
        h: rh,
        day: dayLabels[r],
        slot: slotLabels[c],
        count: val
      });
    }
  }

  ctx.fillStyle = "#000000";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  for (let c = 0; c < cols; c += 1) {
    ctx.fillText(slotLabels[c], left + c * cellW + cellW / 2, h - 6);
  }
}

function handleHeatmapHover(event) {
  const rect = heatmapCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = heatmapRegions.find((cell) => x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h);
  if (!hit) {
    hideTooltip();
    return;
  }
  chartTooltipEl.textContent = `${hit.day} ${hit.slot}: ${hit.count} orders`;
  chartTooltipEl.style.left = `${event.clientX + 12}px`;
  chartTooltipEl.style.top = `${event.clientY - 24}px`;
  chartTooltipEl.style.opacity = "1";
}

function handleItemHover(event) {
  const rect = itemCountCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = itemBarRegions.find((row) => x >= row.x && x <= row.x + row.w && y >= row.y && y <= row.y + row.h);
  if (!hit) {
    hideTooltip();
    return;
  }
  chartTooltipEl.textContent = `${hit.fullLabel}: ${hit.value}`;
  chartTooltipEl.style.left = `${event.clientX + 12}px`;
  chartTooltipEl.style.top = `${event.clientY - 24}px`;
  chartTooltipEl.style.opacity = "1";
}

function handleMonthlyBarHover(event) {
  const rect = monthlyCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = monthlyBarRegions.find((bar) => {
    return x >= bar.x && x <= bar.x + bar.w && y >= bar.y && y <= bar.y + bar.h;
  });

  if (!hit) {
    hideTooltip();
    return;
  }

  chartTooltipEl.textContent = `${hit.label}: ${currency(hit.value)}`;
  chartTooltipEl.style.left = `${event.clientX + 12}px`;
  chartTooltipEl.style.top = `${event.clientY - 24}px`;
  chartTooltipEl.style.opacity = "1";
}

function render(orders) {
  latestOrders = orders;
  const filteredOrders =
    selectedYear === "all"
      ? orders
      : orders.filter((o) => orderYear(o.dateISO) === selectedYear);

  const totalSpend = filteredOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgValue = totalOrders ? totalSpend / totalOrders : 0;

  const byMonth = groupBy(filteredOrders, (o) => monthKey(o.dateISO), (o) => Number(o.amount) || 0);
  const monthlyCount = groupBy(filteredOrders, (o) => monthKey(o.dateISO), () => 1);
  const monthEntries = Array.from(byMonth.entries())
    .filter(([k]) => k !== "Unknown")
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12);
  const monthLabels = monthEntries.map(([k]) => monthLabel(k));
  const monthValues = monthEntries.map(([, v]) => v);

  const activeMonths = new Set(filteredOrders.map((o) => monthKey(o.dateISO)).filter((k) => k !== "Unknown")).size;
  const topSpendMonth = topEntry(new Map(monthEntries));
  const currentMonth = currentMonthKey();
  const thisMonthSpend = byMonth.get(currentMonth) || 0;

  const weekendOrders = filteredOrders.filter((o) => {
    const dt = o.dateISO ? new Date(o.dateISO) : null;
    if (!dt || Number.isNaN(dt.getTime())) return false;
    const day = dt.getDay();
    return day === 0 || day === 6;
  }).length;
  const weekdayOrders = Math.max(0, totalOrders - weekendOrders);

  const amounts = filteredOrders.map((o) => Number(o.amount) || 0);
  const medianOrderValue = median(amounts);

  const restaurantOrderCount = groupBy(filteredOrders, (o) => o.restaurant || "Unknown", () => 1);
  const byRestaurantSpend = groupBy(
    filteredOrders,
    (o) => o.restaurant || "Unknown",
    (o) => Number(o.amount) || 0
  );

  const topRestaurantByCount = topEntry(restaurantOrderCount);
  const restSpendEntries = Array.from(byRestaurantSpend.entries()).sort((a, b) => b[1] - a[1]);

  const itemCounts = aggregateItems(filteredOrders);
  const topItemByCount = topEntry(itemCounts);
  const itemEntries = Array.from(itemCounts.entries()).sort((a, b) => b[1] - a[1]);

  totalEl.textContent = currency(totalSpend);
  ordersEl.textContent = String(totalOrders);
  avgEl.textContent = currency(avgValue);
  monthsEl.textContent = String(activeMonths);
  totalMetaEl.textContent =
    selectedYear === "all"
      ? `This month: ${currency(thisMonthSpend)}`
      : `${selectedYear} spend: ${currency(totalSpend)}`;
  ordersMetaEl.textContent = `Weekend ${weekendOrders} / Weekday ${weekdayOrders}`;
  avgMetaEl.textContent = `Median: ${currency(medianOrderValue)}`;
  monthsMetaEl.textContent = topSpendMonth
    ? `Highest: ${monthLabel(topSpendMonth[0])} (${currency(topSpendMonth[1])})`
    : "Highest month: NA";

  topRestaurantEl.textContent = topRestaurantByCount ? cleanRestaurantLabel(topRestaurantByCount[0]) : "NA";
  topRestaurantMetaEl.textContent = topRestaurantByCount
    ? `${topRestaurantByCount[1]} orders`
    : "0 orders";

  topItemEl.textContent = topItemByCount ? topItemByCount[0] : "NA";
  topItemMetaEl.textContent = topItemByCount ? `${topItemByCount[1]} qty` : "0 qty";

  subtitleEl.textContent = "";

  drawBarChart(monthlyCanvas, monthLabels, monthValues, "#111111");

  const spendTop6 = restSpendEntries.slice(0, 6);
  drawDonutChart(
    restaurantCanvas,
    spendTop6.map((e) => e[1]),
    ["#111111", "#ff6a2b", "#1d6eff", "#10b981", "#f59e0b", "#ef4444"],
    spendTop6.map((e) => cleanRestaurantLabel(e[0]))
  );

  const heatmapDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmapSlots = ["00-06", "06-12", "12-18", "18-24"];
  const heatMatrix = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  for (const order of filteredOrders) {
    const dt = order.dateISO ? new Date(order.dateISO) : null;
    if (!dt || Number.isNaN(dt.getTime())) continue;
    const day = (dt.getDay() + 6) % 7;
    const hour = dt.getHours();
    let slot = 0;
    if (hour >= 6 && hour < 12) slot = 1;
    else if (hour >= 12 && hour < 18) slot = 2;
    else if (hour >= 18) slot = 3;
    heatMatrix[day][slot] += 1;
  }
  drawHeatmap(heatmapCanvas, heatMatrix, heatmapDays, heatmapSlots);
  let peak = { d: "NA", s: "NA", c: 0 };
  heatMatrix.forEach((row, d) => {
    row.forEach((count, s) => {
      if (count > peak.c) peak = { d: heatmapDays[d], s: heatmapSlots[s], c: count };
    });
  });

  const itemsTop7 = itemEntries.slice(0, 7);
  drawHorizontalBarChart(
    itemCountCanvas,
    itemsTop7.map((e) => e[0]),
    itemsTop7.map((e) => e[1]),
    "#ff6a2b"
  );

  const trendEntries = Array.from(monthlyCount.entries())
    .filter(([k]) => k !== "Unknown")
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12);
  drawLineChart(
    trendCanvas,
    trendEntries.map(([k]) => monthLabel(k)),
    trendEntries.map(([, v]) => v),
    "#111111"
  );

  renderActivityCalendar(filteredOrders);
}

function updateYearOptions(orders) {
  const years = Array.from(new Set(orders.map((o) => orderYear(o.dateISO)).filter(Boolean))).sort().reverse();
  yearSelectEl.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All Time";
  yearSelectEl.appendChild(allOpt);
  years.forEach((year) => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    yearSelectEl.appendChild(opt);
  });
  if (!years.length) selectedYear = "all";
  if (!years.includes(selectedYear) && selectedYear !== "all") selectedYear = "all";
  yearSelectEl.value = selectedYear;
}

async function refreshFromStorage() {
  const [ordersRes, profileRes] = await Promise.all([
    chrome.runtime.sendMessage({ type: "GET_ORDERS" }),
    chrome.runtime.sendMessage({ type: "GET_PROFILE" })
  ]);
  const orders = ordersRes?.orders || [];
  const profile = profileRes?.profile || {};
  const phone = (profile.phone || "").replace(/\s+/g, "");
  profilePhoneTextEl.textContent = phone || "—";
  updateYearOptions(orders);
  render(orders);
}

refreshBtn.addEventListener("click", async () => {
  subtitleEl.textContent = "Refreshing from active tab...";
  await chrome.runtime.sendMessage({ type: "TRIGGER_SYNC_ACTIVE_TAB" });
  await refreshFromStorage();
});

window.addEventListener("resize", () => {
  refreshFromStorage().catch(() => {});
});

restaurantCanvas.addEventListener("mousemove", handleRestaurantHover);
restaurantCanvas.addEventListener("mouseleave", hideTooltip);
monthlyCanvas.addEventListener("mousemove", handleMonthlyBarHover);
monthlyCanvas.addEventListener("mouseleave", hideTooltip);
heatmapCanvas.addEventListener("mousemove", handleHeatmapHover);
heatmapCanvas.addEventListener("mouseleave", hideTooltip);
itemCountCanvas.addEventListener("mousemove", handleItemHover);
itemCountCanvas.addEventListener("mouseleave", hideTooltip);
trendCanvas.addEventListener("mousemove", handleTrendHover);
trendCanvas.addEventListener("mouseleave", hideTooltip);
yearSelectEl.addEventListener("change", () => {
  selectedYear = yearSelectEl.value || "all";
  render(latestOrders);
});

refreshFromStorage().catch(() => {
  subtitleEl.textContent = "Failed to load data from extension storage.";
});
