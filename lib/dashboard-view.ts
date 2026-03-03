"use client";

import { Order } from "@/lib/dashboard-data";

export type ThemeMode = "light" | "dark";
export type DayFilter = "All" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type CardKey =
  | "monthly-spend"
  | "spend-by-restaurant"
  | "busiest-days-times"
  | "food-item-count"
  | "activity-streak"
  | "order-trend"
  | "milestones"
  | "cuisine-radar";

export type RectRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  value: number;
};

export type DonutRegion = {
  start: number;
  end: number;
  value: number;
  label: string;
  cx: number;
  cy: number;
  inner: number;
  outer: number;
};

export type HeatmapRegion = {
  cx: number;
  cy: number;
  inner: number;
  outer: number;
  start: number;
  end: number;
  hour: number;
  day: DayFilter;
  count: number;
};

export type PointRegion = {
  x: number;
  y: number;
  label: string;
  value: number;
};

export type ThemeColors = {
  axis: string;
  label: string;
  donutLabel: string;
  itemLabel: string;
  valueLabel: string;
  heatText: string;
};

export type CalendarCell = {
  key: string;
  count: number;
  isFuture: boolean;
  level: number;
  label: string;
};

export type CalendarWeek = CalendarCell[];

export type CalendarSummary = {
  monthLabels: { label: string; left: number }[];
  weeks: CalendarWeek[];
  insight: string;
  totalOrderDays: number;
  longestStreak: number;
  currentStreak: number;
};

export type ChartData = {
  monthlyLabels: string[];
  monthlyValues: number[];
  monthlyChartNote: string;
  restaurantLabels: string[];
  restaurantValues: number[];
  restaurantColors: string[];
  itemLabels: string[];
  itemValues: number[];
  trendLabels: string[];
  trendValues: number[];
  heatmap: Record<DayFilter, number[]>;
};

export const CARD_ORDER_DEFAULT: CardKey[] = [
  "monthly-spend",
  "spend-by-restaurant",
  "busiest-days-times",
  "food-item-count",
  "activity-streak",
  "order-trend",
  "milestones",
  "cuisine-radar"
];

export const KPI_ORDER = [
  "total",
  "orders",
  "avg",
  "months",
  "topRestaurant",
  "topItem"
] as const;

export const DAY_OPTIONS: DayFilter[] = ["All", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DONUT_LIGHT = ["#111111", "#fe5300", "#ff8a00", "#ffe005", "#ffec00", "#f7f700"];
const DONUT_DARK = ["#fe5300", "#c90000", "#4eff00", "#f8fafc", "#ffe005", "#00f7ce"];

export function inr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

export function orderYear(iso: string | null) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return String(date.getFullYear());
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

function shortMonthLabel(index: number) {
  return new Date(2000, index, 1).toLocaleString("en-IN", { month: "short" });
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function cleanRestaurant(name: string) {
  return String(name || "?").replace(/\s+restaurant$/i, "").trim();
}

export function aggregateItems(orders: Order[]) {
  const aliases: Record<string, string> = {
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

  function normalizeItem(raw: string) {
    const base = raw.replace(/\s+/g, " ").replace(/[|]/g, "").trim();
    return aliases[base.toLowerCase()] || base;
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

  const map = new Map<string, number>();
  for (const order of orders) {
    for (const line of order.items || []) {
      const item = parseItem(line);
      if (item) {
        map.set(item.name, (map.get(item.name) || 0) + item.qty);
      }
    }
  }

  return map;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string, valueFn: (item: T) => number) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + valueFn(item));
  }
  return map;
}

function streaks(orders: Order[]) {
  const days = new Set<string>();
  for (const order of orders) {
    const date = order.dateISO ? new Date(order.dateISO) : null;
    if (!date || Number.isNaN(date.getTime())) {
      continue;
    }
    days.add(ymd(date));
  }

  const list = [...days]
    .map((value) => new Date(`${value}T00:00:00`))
    .sort((left, right) => left.getTime() - right.getTime());
  if (!list.length) {
    return { longest: 0, recent: 0 };
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < list.length; index += 1) {
    const diff = (list[index].getTime() - list[index - 1].getTime()) / 86400000;
    run = diff === 1 ? run + 1 : 1;
    if (run > longest) {
      longest = run;
    }
  }

  let recent = 1;
  for (let index = list.length - 1; index > 0; index -= 1) {
    const diff = (list[index].getTime() - list[index - 1].getTime()) / 86400000;
    if (diff === 1) {
      recent += 1;
    } else {
      break;
    }
  }

  return { longest, recent };
}

export function themeColors(theme: ThemeMode): ThemeColors {
  return theme === "dark"
    ? {
        axis: "rgba(255,255,255,0.18)",
        label: "#cbd5e1",
        donutLabel: "#dbe3ee",
        itemLabel: "#d2dae6",
        valueLabel: "#d2dae6",
        heatText: "#f2f5f8"
      }
    : {
        axis: "rgba(0,0,0,0.08)",
        label: "#4b5563",
        donutLabel: "#334155",
        itemLabel: "#374151",
        valueLabel: "#374151",
        heatText: "#000000"
      };
}

export function setupCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

export function computeCalendarSummary(orders: Order[], selectedYear: string): CalendarSummary {
  const dayCounts = new Map<string, number>();
  const dayAmounts = new Map<string, number>();
  for (const order of orders) {
    const date = order.dateISO ? new Date(order.dateISO) : null;
    if (!date || Number.isNaN(date.getTime())) {
      continue;
    }
    const key = ymd(date);
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    dayAmounts.set(key, (dayAmounts.get(key) || 0) + (Number(order.amount) || 0));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let start: Date;
  let end: Date;

  if (selectedYear === "all") {
    const orderedDates = [...dayCounts.keys()].sort();
    if (orderedDates.length) {
      const first = new Date(`${orderedDates[0]}T00:00:00`);
      const last = new Date(`${orderedDates[orderedDates.length - 1]}T00:00:00`);
      start = new Date(first.getFullYear(), first.getMonth(), 1);
      start.setDate(start.getDate() - start.getDay());
      end = new Date(last.getFullYear(), last.getMonth() + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
    } else {
      start = new Date(today);
      end = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      end.setDate(end.getDate() + (6 - end.getDay()));
    }
  } else {
    const year = Number(selectedYear);
    start = new Date(year, 0, 1);
    start.setDate(start.getDate() - start.getDay());
    end = new Date(year, 11, 31);
    end.setDate(end.getDate() + (6 - end.getDay()));
  }

  const cellStep = 16;
  const weeksCount = Math.ceil(((end.getTime() - start.getTime()) / 86400000 + 1) / 7);
  const monthLabels: { label: string; left: number }[] = [];
  const weeks: CalendarWeek[] = [];
  let lastMonth = -1;

  for (let week = 0; week < weeksCount; week += 1) {
    const cells: CalendarCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const value = new Date(start);
      value.setDate(start.getDate() + week * 7 + day);
      if (value.getDate() === 1 || (week === 0 && day === 0)) {
        const month = value.getMonth();
        if (month !== lastMonth) {
          lastMonth = month;
          monthLabels.push({
            label: value.toLocaleString("en-IN", { month: "short" }).toUpperCase(),
            left: week * cellStep
          });
        }
      }

      const key = ymd(value);
      const count = dayCounts.get(key) || 0;
      const amount = dayAmounts.get(key) || 0;
      const isFuture = value.getTime() > today.getTime();
      const level = isFuture ? 0 : count >= 4 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0;
      cells.push({
        key,
        count,
        isFuture,
        level,
        label:
          count > 0
            ? `${count} order${count === 1 ? "" : "s"} • ${inr(amount)} • ${value.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
              })}`
            : `No orders • ${value.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
              })}`
      });
    }
    weeks.push(cells);
  }

  const totalOrderDays = [...dayCounts.values()].filter((count) => count > 0).length;
  const streakSummary = streaks(orders);
  const activeMonths = new Map<string, number>();
  for (const [key, count] of dayCounts) {
    if (!count) {
      continue;
    }

    const value = new Date(`${key}T00:00:00`);
    if (value.getTime() > today.getTime()) {
      continue;
    }

    const month = `${value.getFullYear()}-${value.getMonth()}`;
    activeMonths.set(month, (activeMonths.get(month) || 0) + 1);
  }

  const topMonth = [...activeMonths.entries()].sort((left, right) => right[1] - left[1])[0];
  const insight = topMonth
    ? (() => {
        const [ym, count] = topMonth;
        const [year, month] = ym.split("-").map(Number);
        return `You ordered most in ${new Date(year, month, 1).toLocaleString("en-IN", {
          month: "long"
        })} ${year} with ${count} active days.`;
      })()
    : "No order activity in this period.";

  return {
    monthLabels,
    weeks,
    insight,
    totalOrderDays,
    longestStreak: streakSummary.longest,
    currentStreak: streakSummary.recent
  };
}

export function computeChartData(orders: Order[], selectedYear: string, theme: ThemeMode): ChartData {
  const monthlySpendMap = groupBy(orders, (order) => monthKey(order.dateISO), (order) => Number(order.amount) || 0);
  const monthlyCountMap = groupBy(orders, (order) => monthKey(order.dateISO), () => 1);
  const monthEntries = [...monthlySpendMap.entries()]
    .filter(([key]) => key !== "Unknown")
    .sort(([left], [right]) => left.localeCompare(right));

  let monthlyLabels: string[];
  let monthlyValues: number[];
  if (selectedYear === "all") {
    const totals = Array(12).fill(0);
    for (const order of orders) {
      const date = order.dateISO ? new Date(order.dateISO) : null;
      if (!date || Number.isNaN(date.getTime())) {
        continue;
      }
      totals[date.getMonth()] += Number(order.amount) || 0;
    }
    monthlyLabels = totals.map((_, index) => shortMonthLabel(index));
    monthlyValues = totals;
  } else {
    monthlyLabels = monthEntries.map(([key]) => monthLabel(key));
    monthlyValues = monthEntries.map(([, value]) => value);
  }

  const restaurantSpend = groupBy(orders, (order) => order.restaurant || "?", (order) => Number(order.amount) || 0);
  const topRestaurants = [...restaurantSpend.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);

  const items = aggregateItems(orders);
  const topItems = [...items.entries()].sort((left, right) => right[1] - left[1]).slice(0, 7);

  const trendSeries = [...monthlyCountMap.entries()]
    .filter(([key]) => key !== "Unknown")
    .sort(([left], [right]) => left.localeCompare(right));
  const trend =
    selectedYear !== "all"
      ? trendSeries.slice(-24)
      : trendSeries.filter(([key]) => key !== currentMonthKey()).slice(-24);

  const heatmap: Record<DayFilter, number[]> = {
    All: Array(24).fill(0),
    Mon: Array(24).fill(0),
    Tue: Array(24).fill(0),
    Wed: Array(24).fill(0),
    Thu: Array(24).fill(0),
    Fri: Array(24).fill(0),
    Sat: Array(24).fill(0),
    Sun: Array(24).fill(0)
  };

  for (const order of orders) {
    const date = order.dateISO ? new Date(order.dateISO) : null;
    if (!date || Number.isNaN(date.getTime())) {
      continue;
    }
    const day = DAY_OPTIONS[(date.getDay() + 6) % 7 + 1];
    heatmap.All[date.getHours()] += 1;
    heatmap[day][date.getHours()] += 1;
  }

  return {
    monthlyLabels,
    monthlyValues,
    monthlyChartNote: selectedYear === "all" ? "Aggregated across all years" : "",
    restaurantLabels: topRestaurants.map(([name]) => cleanRestaurant(name)),
    restaurantValues: topRestaurants.map(([, value]) => value),
    restaurantColors: (theme === "dark" ? DONUT_DARK : DONUT_LIGHT).slice(0, topRestaurants.length),
    itemLabels: topItems.map(([name]) => name),
    itemValues: topItems.map(([, value]) => value),
    trendLabels: (trend.length ? trend : trendSeries).map(([key]) => monthLabel(key)),
    trendValues: (trend.length ? trend : trendSeries).map(([, value]) => value),
    heatmap
  };
}
