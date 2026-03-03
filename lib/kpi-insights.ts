"use client";

import { Order } from "@/lib/dashboard-data";
import { aggregateItems, cleanRestaurant, inr } from "@/lib/dashboard-view";

export type KpiInsightKey =
  | "total"
  | "orders"
  | "avg"
  | "months"
  | "topRestaurant"
  | "topItem";

export type ChartInsightKey =
  | "monthlySpend"
  | "spendByRestaurant"
  | "busiestOrdering"
  | "foodItemCount"
  | "orderTrend"
  | "activityStreak";

export type ExtendedCardInsightKey = ChartInsightKey | "milestones" | "cuisineRadar";

export type InsightLevel = "good" | "warn" | "info";

export type Insight = {
  id: string;
  title: string;
  message: string;
  level: InsightLevel;
  metricRefs: string[];
  confidence: 0 | 1;
  priority: number;
  cta?: {
    label: string;
    action: "filterYear" | "openCard" | "showMore" | "scrollTo";
    value?: string;
  };
};

export type FiredRule = {
  id: string;
  scope: "global" | "kpi" | "card";
  target: string;
  priority: number;
};

export type InsightsBundle = {
  global: Insight[];
  kpis: Record<KpiInsightKey, Insight[]>;
  cards: Record<ExtendedCardInsightKey, Insight[]>;
  debug?: { firedRules: FiredRule[] };
};

export type KpiInsightCard = {
  bullets: string[];
  source: "local";
};

export type KpiInsightPack = Record<KpiInsightKey, KpiInsightCard> & {
  weeklyNarrative?: string;
};

export type ChartInsightPack = Record<ChartInsightKey, KpiInsightCard>;

export type InsightAggregates = {
  schemaVersion: 2;
  selectedYear: string;
  totalSpend: number;
  totalOrders: number;
  avgOrderValue: number;
  medianOrderValue: number;
  activeMonths: number;
  monthsInRange: number;
  orderedDays: number;
  weekendOrders: number;
  weekdayOrders: number;
  weekendSpend: number;
  weekdaySpend: number;
  weekendShare: number;
  lateNightOrders: number;
  lateNightShare: number;
  uniqueRestaurantsCount: number;
  uniqueItemsCount: number;
  daysSinceLastOrder: number | null;
  monthsSinceLastOrder: number | null;
  longestStreak: number;
  currentStreak: number;
  longestGapDays: number;
  highestOrderValue: number;
  highestOrderDate: string | null;
  highestOrderRestaurant: string | null;
  ordersPerWeek: number;
  topDay: { label: string; count: number; share: number } | null;
  topHour: { label: string; count: number; share: number } | null;
  monthlySpend: Array<{ key: string; label: string; spend: number; orders: number }>;
  monthlySpendByMonthOfYear: Array<{ key: string; label: string; spend: number; orders: number }>;
  highestMonthSpend: number;
  highestMonthKey: string | null;
  highestMonthLabel: string | null;
  currentMonthDeltaPercent: number | null;
  currentOrderDeltaPercent: number | null;
  currentAverageDeltaPercent: number | null;
  topRestaurant:
    | {
        name: string;
        orders: number;
        spend: number;
        orderShare: number;
        spendShare: number;
      }
    | null;
  topRestaurants: Array<{ name: string; orders: number; spend: number; orderShare: number; spendShare: number }>;
  topTwoRestaurantSpendShare: number;
  topItem:
    | {
        name: string;
        count: number;
        share: number;
        weekendShare: number;
        topPairing: string | null;
      }
    | null;
  topItems: Array<{ name: string; count: number; share: number }>;
  topThreeItemShare: number;
  orderValueBuckets: Array<{ label: string; count: number }>;
  firstOrderDate: string | null;
  firstOrderRestaurant: string | null;
  orderNumberMilestones: Array<{ count: number; date: string | null; restaurant: string | null }>;
  spendMilestones: Array<{ threshold: number; date: string | null; restaurant: string | null }>;
  cuisineSpend: Array<{ cuisine: string; spend: number; share: number }>;
  topCuisine: { cuisine: string; spend: number; share: number } | null;
  cuisineDiversityIndex: number;
  recentOrderTrendRatio: number | null;
};

type ParsedItem = {
  name: string;
  qty: number;
};

type RuleTarget = "global" | KpiInsightKey | ExtendedCardInsightKey;

type Rule = {
  id: string;
  scope: "global" | "kpi" | "card";
  target: RuleTarget;
  priority: number;
  when: (metrics: InsightAggregates) => boolean;
  build: (metrics: InsightAggregates) => Insight | Insight[];
};

const KPI_KEYS: KpiInsightKey[] = ["total", "orders", "avg", "months", "topRestaurant", "topItem"];
const CHART_KEYS: ChartInsightKey[] = [
  "monthlySpend",
  "spendByRestaurant",
  "busiestOrdering",
  "foodItemCount",
  "orderTrend",
  "activityStreak"
];
const EXTENDED_CARD_KEYS: ExtendedCardInsightKey[] = [...CHART_KEYS, "milestones", "cuisineRadar"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const ITEM_ALIASES: Record<string, string> = {
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

const restaurantCuisineMap: Record<string, string> = {
  "nalla bhoomi": "South Indian",
  "arabian grill hub": "Arabic",
  "arabian grill": "Arabic",
  "al arabia": "Arabic",
  "le arabia": "Arabic",
  shawarmania: "Arabic",
  "al faham": "Arabic",
  "pizza yard": "Italian",
  domino: "Italian",
  "pizza hut": "Italian",
  "pulp cafe": "Cafe",
  starbucks: "Cafe",
  kfc: "Fast Food",
  mcdonald: "Fast Food",
  "burger king": "Fast Food",
  subway: "Fast Food",
  behrouz: "North Indian",
  "biryani blues": "North Indian",
  "paradise biryani": "North Indian"
};

const itemCuisineRules = [
  { re: /(dosa|idli|sambar|uttapam|vada|porotta|parotta|malabar|puttu|appam)/i, cat: "South Indian" },
  { re: /(shawarma|kebab|alfaham|al\s*faham|mandi|hummus|falafel|khubz|kuboos|grill)/i, cat: "Arabic" },
  { re: /(pizza|pasta|lasagna|garlic bread)/i, cat: "Italian" },
  { re: /(burger|fries|sandwich|wrap|nugget)/i, cat: "Fast Food" },
  { re: /(noodle|fried rice|manchurian|schezwan|hakka|momo|wok)/i, cat: "Chinese" },
  { re: /(cake|brownie|ice cream|dessert|sweet|kunafa|pastry|waffle)/i, cat: "Desserts" },
  { re: /(juice|shake|tea|coffee|mojito|smoothie)/i, cat: "Beverages" },
  { re: /(cafe|latte|espresso|cappuccino)/i, cat: "Cafe" }
] as const;

const insightCache = new Map<string, InsightsBundle>();

function normalizeItem(raw: string) {
  const base = raw.replace(/\s+/g, " ").replace(/[|]/g, "").trim();
  return ITEM_ALIASES[base.toLowerCase()] || base;
}

function parseItem(line: string): ParsedItem | null {
  const value = line.trim();
  if (!value) return null;

  let match = value.match(/^(.*?)\s+x\s*(\d+)$/i);
  if (match) return { name: normalizeItem(match[1].trim()), qty: Number(match[2]) };

  match = value.match(/^(\d+)\s*x\s+(.*?)$/i);
  if (match) return { name: normalizeItem(match[2].trim()), qty: Number(match[1]) };

  return { name: normalizeItem(value), qty: 1 };
}

function parseDate(iso: string | null) {
  const date = iso ? new Date(iso) : null;
  return !date || Number.isNaN(date.getTime()) ? null : date;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentDelta(current: number, previous: number) {
  if (!previous) return current ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function previousNonZero(
  current: string,
  keys: string[],
  valueFn: (key: string) => number
) {
  const all = [...new Set([...keys, current])].filter(Boolean).sort((left, right) => left.localeCompare(right));
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

function inclusiveMonthSpan(start: Date | null, end: Date | null) {
  if (!start || !end) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

function topOf(map: Map<string, number>) {
  const entries = [...map.entries()];
  return entries.length ? entries.sort((left, right) => right[1] - left[1])[0] : null;
}

function streaks(orders: Order[]) {
  const days = [...new Set(orders
    .map((order) => parseDate(order.dateISO))
    .filter(Boolean)
    .map((date) => ymd(date as Date)))]
    .map((value) => new Date(`${value}T00:00:00`))
    .sort((left, right) => left.getTime() - right.getTime());

  if (!days.length) return { longest: 0, current: 0, longestGapDays: 0 };

  let longest = 1;
  let currentRun = 1;
  let longestGapDays = 0;

  for (let index = 1; index < days.length; index += 1) {
    const diff = Math.round((days[index].getTime() - days[index - 1].getTime()) / 86400000);
    if (diff === 1) {
      currentRun += 1;
      longest = Math.max(longest, currentRun);
    } else {
      longestGapDays = Math.max(longestGapDays, diff - 1);
      currentRun = 1;
    }
  }

  let current = 1;
  for (let index = days.length - 1; index > 0; index -= 1) {
    const diff = Math.round((days[index].getTime() - days[index - 1].getTime()) / 86400000);
    if (diff === 1) current += 1;
    else break;
  }

  return { longest, current, longestGapDays };
}

function computeOrdersPerWeek(orders: Order[]) {
  const dates = orders.map((order) => parseDate(order.dateISO)).filter(Boolean) as Date[];
  if (!dates.length) return 0;
  const sorted = [...dates].sort((left, right) => left.getTime() - right.getTime());
  const spanDays = Math.max(1, Math.ceil((sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / 86400000) + 1);
  return orders.length / Math.max(1, spanDays / 7);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatMonthGap(value: number) {
  return `${value} month${value === 1 ? "" : "s"}`;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function inferCuisine(order: Order) {
  const restaurant = cleanRestaurant(order.restaurant || "").toLowerCase().trim();
  for (const [needle, cuisine] of Object.entries(restaurantCuisineMap)) {
    if (restaurant.includes(needle)) return cuisine;
  }

  for (const line of order.items || []) {
    for (const rule of itemCuisineRules) {
      if (rule.re.test(line)) return rule.cat;
    }
  }

  return "Other";
}

function makeInsight(
  id: string,
  title: string,
  message: string,
  level: InsightLevel,
  priority: number,
  metricRefs: string[],
  cta?: Insight["cta"]
): Insight {
  return { id, title, message, level, metricRefs, confidence: 1, priority, cta };
}

export function computeInsightAggregates(orders: Order[], selectedYear: string): InsightAggregates {
  const datedOrders = orders
    .map((order) => ({ order, date: parseDate(order.dateISO) }))
    .filter((value): value is { order: Order; date: Date } => Boolean(value.date));
  const sortedByDate = [...datedOrders].sort((left, right) => left.date.getTime() - right.date.getTime());

  const totalSpend = orders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders ? totalSpend / totalOrders : 0;
  const medianOrderValue = median(orders.map((order) => Number(order.amount) || 0));

  const uniqueDays = new Set(datedOrders.map(({ date }) => ymd(date)));
  const activeMonthKeys = new Set(datedOrders.map(({ date }) => monthKey(date)));
  const orderedDays = uniqueDays.size;
  const activeMonths = activeMonthKeys.size;
  const earliestDate = sortedByDate[0]?.date || null;
  const latestDate = sortedByDate[sortedByDate.length - 1]?.date || null;
  const monthsInRange = inclusiveMonthSpan(earliestDate, latestDate);

  const weekendOrdersList = datedOrders.filter(({ date }) => date.getDay() === 0 || date.getDay() === 6);
  const weekendOrders = weekendOrdersList.length;
  const weekdayOrders = Math.max(0, totalOrders - weekendOrders);
  const weekendSpend = weekendOrdersList.reduce((sum, { order }) => sum + (Number(order.amount) || 0), 0);
  const weekdaySpend = Math.max(0, totalSpend - weekendSpend);
  const weekendShare = totalOrders ? weekendOrders / totalOrders : 0;

  const lateNightOrders = datedOrders.filter(({ date }) => date.getHours() >= 21 || date.getHours() <= 1).length;
  const lateNightShare = totalOrders ? lateNightOrders / totalOrders : 0;

  const monthlySpendMap = new Map<string, number>();
  const monthlyOrdersMap = new Map<string, number>();
  const weekdayMap = new Map<string, number>();
  const hourMap = new Map<string, number>();
  let highestOrderValue = 0;
  let highestOrderDate: string | null = null;
  let highestOrderRestaurant: string | null = null;

  for (const { order, date } of datedOrders) {
    const key = monthKey(date);
    monthlySpendMap.set(key, (monthlySpendMap.get(key) || 0) + (Number(order.amount) || 0));
    monthlyOrdersMap.set(key, (monthlyOrdersMap.get(key) || 0) + 1);
    weekdayMap.set(DAY_LABELS[date.getDay()], (weekdayMap.get(DAY_LABELS[date.getDay()]) || 0) + 1);
    const hourLabel = `${String(date.getHours()).padStart(2, "0")}:00`;
    hourMap.set(hourLabel, (hourMap.get(hourLabel) || 0) + 1);

    const amount = Number(order.amount) || 0;
    if (amount > highestOrderValue) {
      highestOrderValue = amount;
      highestOrderDate = order.dateISO;
      highestOrderRestaurant = cleanRestaurant(order.restaurant || "?");
    }
  }

  const monthlyKeys = [...monthlySpendMap.keys()].sort((left, right) => left.localeCompare(right));
  const monthlySpend = monthlyKeys.map((key) => ({
    key,
    label: monthLabel(key),
    spend: monthlySpendMap.get(key) || 0,
    orders: monthlyOrdersMap.get(key) || 0
  }));
  const totalsByMonthOfYear = Array.from({ length: 12 }, (_, index) => ({
    key: String(index),
    label: new Date(2000, index, 1).toLocaleString("en-IN", { month: "short" }),
    spend: 0,
    orders: 0
  }));
  for (const { order, date } of datedOrders) {
    totalsByMonthOfYear[date.getMonth()].spend += Number(order.amount) || 0;
    totalsByMonthOfYear[date.getMonth()].orders += 1;
  }
  const highestMonth = [...monthlySpend].sort((left, right) => right.spend - left.spend)[0] || null;
  const currentComparisonMonth =
    selectedYear === "all" ? currentMonthKey() : monthlyKeys[monthlyKeys.length - 1] || currentMonthKey();
  const previousSpendMonth = previousNonZero(currentComparisonMonth, monthlyKeys, (key) => monthlySpendMap.get(key) || 0);
  const previousCountMonth = previousNonZero(currentComparisonMonth, monthlyKeys, (key) => monthlyOrdersMap.get(key) || 0);
  const previousAverageMonth = previousNonZero(currentComparisonMonth, monthlyKeys, (key) => {
    const count = monthlyOrdersMap.get(key) || 0;
    return count ? (monthlySpendMap.get(key) || 0) / count : 0;
  });
  const currentMonth = currentComparisonMonth
    ? {
        key: currentComparisonMonth,
        spend: monthlySpendMap.get(currentComparisonMonth) || 0,
        orders: monthlyOrdersMap.get(currentComparisonMonth) || 0
      }
    : null;
  const previousMonth = previousSpendMonth
    ? {
        key: previousSpendMonth,
        spend: monthlySpendMap.get(previousSpendMonth) || 0,
        orders: monthlyOrdersMap.get(previousSpendMonth) || 0
      }
    : null;
  const currentAverage = currentMonth ? currentMonth.spend / Math.max(1, currentMonth.orders) : 0;
  const previousAverage = previousAverageMonth
    ? (monthlySpendMap.get(previousAverageMonth) || 0) / Math.max(1, monthlyOrdersMap.get(previousAverageMonth) || 0)
    : 0;

  const now = new Date();
  const daysSinceLastOrder = latestDate ? Math.floor((now.getTime() - latestDate.getTime()) / 86400000) : null;
  const monthsSinceLastOrder = latestDate
    ? Math.max(0, (now.getFullYear() - latestDate.getFullYear()) * 12 + (now.getMonth() - latestDate.getMonth()))
    : null;

  const restaurantOrders = new Map<string, number>();
  const restaurantSpend = new Map<string, number>();
  for (const order of orders) {
    const key = cleanRestaurant(order.restaurant || "?");
    restaurantOrders.set(key, (restaurantOrders.get(key) || 0) + 1);
    restaurantSpend.set(key, (restaurantSpend.get(key) || 0) + (Number(order.amount) || 0));
  }

  const topRestaurants = [...restaurantOrders.entries()]
    .sort((left, right) => (restaurantSpend.get(right[0]) || 0) - (restaurantSpend.get(left[0]) || 0))
    .slice(0, 8)
    .map(([name, count]) => {
      const spend = restaurantSpend.get(name) || 0;
      return {
        name,
        orders: count,
        spend,
        orderShare: totalOrders ? count / totalOrders : 0,
        spendShare: totalSpend ? spend / totalSpend : 0
      };
    });

  const items = aggregateItems(orders);
  const totalItemCount = [...items.values()].reduce((sum, value) => sum + value, 0);
  const parsedItemsByOrder = orders.map((order) => ({
    order,
    items: (order.items || []).map(parseItem).filter(Boolean) as ParsedItem[]
  }));
  const topItems = [...items.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([name, count]) => ({
      name,
      count,
      share: totalItemCount ? count / totalItemCount : 0
    }));

  const topItemName = topItems[0]?.name || null;
  let topItemWeekendCount = 0;
  const pairingMap = new Map<string, number>();
  if (topItemName) {
    for (const { order, items: parsed } of parsedItemsByOrder) {
      const names = new Set(parsed.map((item) => item.name));
      if (!names.has(topItemName)) continue;

      const date = parseDate(order.dateISO);
      if (date && (date.getDay() === 0 || date.getDay() === 6)) {
        topItemWeekendCount += parsed
          .filter((item) => item.name === topItemName)
          .reduce((sum, item) => sum + item.qty, 0);
      }

      for (const name of names) {
        if (name === topItemName) continue;
        pairingMap.set(name, (pairingMap.get(name) || 0) + 1);
      }
    }
  }

  const orderValueBuckets = [
    { label: "< ₹200", count: 0 },
    { label: "₹200–₹300", count: 0 },
    { label: "₹301–₹500", count: 0 },
    { label: "> ₹500", count: 0 }
  ];
  for (const order of orders) {
    const amount = Number(order.amount) || 0;
    if (amount < 200) orderValueBuckets[0].count += 1;
    else if (amount <= 300) orderValueBuckets[1].count += 1;
    else if (amount <= 500) orderValueBuckets[2].count += 1;
    else orderValueBuckets[3].count += 1;
  }

  const cuisineSpendMap = new Map<string, number>();
  for (const order of orders) {
    const cuisine = inferCuisine(order);
    cuisineSpendMap.set(cuisine, (cuisineSpendMap.get(cuisine) || 0) + (Number(order.amount) || 0));
  }
  const cuisineSpend = [...cuisineSpendMap.entries()]
    .map(([cuisine, spend]) => ({
      cuisine,
      spend,
      share: totalSpend ? spend / totalSpend : 0
    }))
    .filter((entry) => entry.spend > 0)
    .sort((left, right) => right.spend - left.spend)
    .slice(0, 8);
  const cuisineDiversityIndex = cuisineSpend.length
    ? 1 - cuisineSpend.reduce((sum, entry) => sum + entry.share * entry.share, 0)
    : 0;

  const orderNumberMilestones = [10, 25, 50, 100, 150, 200, 300, 500]
    .filter((count) => sortedByDate.length >= count)
    .map((count) => ({
      count,
      date: sortedByDate[count - 1]?.order.dateISO || null,
      restaurant: sortedByDate[count - 1] ? cleanRestaurant(sortedByDate[count - 1].order.restaurant || "?") : null
    }));

  let runningSpend = 0;
  const spendMilestones: Array<{ threshold: number; date: string | null; restaurant: string | null }> = [];
  for (const { order } of sortedByDate) {
    const previous = runningSpend;
    runningSpend += Number(order.amount) || 0;
    for (const threshold of [1000, 5000, 10000, 25000, 50000, 100000]) {
      if (previous < threshold && runningSpend >= threshold) {
        spendMilestones.push({
          threshold,
          date: order.dateISO,
          restaurant: cleanRestaurant(order.restaurant || "?")
        });
      }
    }
  }

  const recentSeries = monthlySpend.slice(-5);
  const recentOrderTrendRatio =
    recentSeries.length >= 5
      ? (() => {
          const recent = (recentSeries[3].orders + recentSeries[4].orders) / 2;
          const baseline = (recentSeries[0].orders + recentSeries[1].orders + recentSeries[2].orders) / 3;
          return baseline ? recent / baseline : null;
        })()
      : null;

  const streakSummary = streaks(orders);
  const topDayRaw = topOf(weekdayMap);
  const topHourRaw = topOf(hourMap);

  return {
    schemaVersion: 2,
    selectedYear,
    totalSpend,
    totalOrders,
    avgOrderValue,
    medianOrderValue,
    activeMonths,
    monthsInRange,
    orderedDays,
    weekendOrders,
    weekdayOrders,
    weekendSpend,
    weekdaySpend,
    weekendShare,
    lateNightOrders,
    lateNightShare,
    uniqueRestaurantsCount: restaurantOrders.size,
    uniqueItemsCount: items.size,
    daysSinceLastOrder,
    monthsSinceLastOrder,
    longestStreak: streakSummary.longest,
    currentStreak: streakSummary.current,
    longestGapDays: streakSummary.longestGapDays,
    highestOrderValue,
    highestOrderDate,
    highestOrderRestaurant,
    ordersPerWeek: computeOrdersPerWeek(orders),
    topDay: topDayRaw ? { label: topDayRaw[0], count: topDayRaw[1], share: totalOrders ? topDayRaw[1] / totalOrders : 0 } : null,
    topHour: topHourRaw ? { label: topHourRaw[0], count: topHourRaw[1], share: totalOrders ? topHourRaw[1] / totalOrders : 0 } : null,
    monthlySpend,
    monthlySpendByMonthOfYear: totalsByMonthOfYear,
    highestMonthSpend: highestMonth?.spend || 0,
    highestMonthKey: highestMonth?.key || null,
    highestMonthLabel: highestMonth?.label || null,
    currentMonthDeltaPercent: currentMonth && previousMonth ? percentDelta(currentMonth.spend, previousMonth.spend) : null,
    currentOrderDeltaPercent: currentMonth && previousMonth ? percentDelta(currentMonth.orders, previousMonth.orders) : null,
    currentAverageDeltaPercent: currentMonth && previousMonth ? percentDelta(currentAverage, previousAverage) : null,
    topRestaurant: topRestaurants[0] || null,
    topRestaurants,
    topTwoRestaurantSpendShare: topRestaurants.slice(0, 2).reduce((sum, entry) => sum + entry.spendShare, 0),
    topItem: topItems[0]
      ? {
          ...topItems[0],
          weekendShare: topItems[0].count ? topItemWeekendCount / topItems[0].count : 0,
          topPairing: topOf(pairingMap)?.[0] || null
        }
      : null,
    topItems,
    topThreeItemShare: topItems.slice(0, 3).reduce((sum, entry) => sum + entry.share, 0),
    orderValueBuckets,
    firstOrderDate: sortedByDate[0]?.order.dateISO || null,
    firstOrderRestaurant: sortedByDate[0] ? cleanRestaurant(sortedByDate[0].order.restaurant || "?") : null,
    orderNumberMilestones,
    spendMilestones,
    cuisineSpend,
    topCuisine: cuisineSpend[0] || null,
    cuisineDiversityIndex,
    recentOrderTrendRatio
  };
}

function createEmptyBundle(): InsightsBundle {
  const kpis = KPI_KEYS.reduce((accumulator, key) => {
    accumulator[key] = [];
    return accumulator;
  }, {} as Record<KpiInsightKey, Insight[]>);
  const cards = EXTENDED_CARD_KEYS.reduce((accumulator, key) => {
    accumulator[key] = [];
    return accumulator;
  }, {} as Record<ExtendedCardInsightKey, Insight[]>);

  return {
    global: [],
    kpis,
    cards,
    debug: { firedRules: [] }
  };
}

function buildNarrative(metrics: InsightAggregates) {
  if (!metrics.totalOrders) return "Upload orders to unlock your spending story.";

  const rhythm = metrics.topDay ? `${metrics.topDay.label} drives the rhythm` : "your ordering rhythm is still forming";
  const anchor = metrics.topRestaurant ? `${metrics.topRestaurant.name} remains your strongest repeat` : "restaurant loyalty is still spreading out";
  const habit =
    metrics.weekendShare >= 0.6
      ? "weekends carry most of the momentum"
      : metrics.lateNightShare >= 0.3
        ? "late-night ordering is clearly part of the pattern"
        : "your behavior looks fairly balanced across the week";

  return `${rhythm}, ${anchor}, and ${habit}.`;
}

function cacheKey(metrics: InsightAggregates) {
  return JSON.stringify({
    selectedYear: metrics.selectedYear,
    totalSpend: metrics.totalSpend,
    totalOrders: metrics.totalOrders,
    orderedDays: metrics.orderedDays,
    activeMonths: metrics.activeMonths,
    highestOrderValue: metrics.highestOrderValue,
    topRestaurant: metrics.topRestaurant?.name || null,
    topItem: metrics.topItem?.name || null,
    highestMonthKey: metrics.highestMonthKey,
    recentOrderTrendRatio: metrics.recentOrderTrendRatio
  });
}

const RULES: Rule[] = [
  {
    id: "global-habit-balance",
    scope: "global",
    target: "global",
    priority: 92,
    when: (m) => m.totalOrders > 0,
    build: (m) =>
      makeInsight(
        "global-habit-balance",
        m.weekendShare >= 0.6 ? "Weekend-led habit" : "Balanced rhythm",
        m.weekendShare >= 0.6
          ? `${formatPercent(m.weekendShare * 100)} of your orders land on weekends, so that is where the money moves.`
          : `Your orders stay fairly balanced, with weekends contributing ${formatPercent(m.weekendShare * 100)} of the total.`,
        "info",
        92,
        ["weekendShare", "weekendOrders"]
      )
  },
  {
    id: "global-restaurant-anchor",
    scope: "global",
    target: "global",
    priority: 88,
    when: (m) => Boolean(m.topRestaurant),
    build: (m) =>
      makeInsight(
        "global-restaurant-anchor",
        "Strong repeat anchor",
        `${m.topRestaurant?.name} holds ${formatPercent((m.topRestaurant?.orderShare || 0) * 100)} of your orders.`,
        (m.topRestaurant?.orderShare || 0) > 0.5 ? "warn" : "good",
        88,
        ["topRestaurant.orderShare", "topRestaurant.orders"]
      )
  },
  {
    id: "global-night-pattern",
    scope: "global",
    target: "global",
    priority: 84,
    when: (m) => m.lateNightShare >= 0.25,
    build: (m) =>
      makeInsight(
        "global-night-pattern",
        "Late-night pattern",
        `${formatPercent(m.lateNightShare * 100)} of your orders happen after 9 PM, so cravings skew late.`,
        "info",
        84,
        ["lateNightShare", "lateNightOrders"]
      )
  },
  {
    id: "kpi-total-monthly-average",
    scope: "kpi",
    target: "total",
    priority: 96,
    when: (m) => m.totalSpend > 0,
    build: (m) =>
      makeInsight(
        "kpi-total-monthly-average",
        "Monthly pace",
        `You spend about ${inr(m.totalSpend / Math.max(1, m.activeMonths))} per active month.`,
        "info",
        96,
        ["totalSpend", "activeMonths"]
      )
  },
  {
    id: "kpi-total-monthly-delta",
    scope: "kpi",
    target: "total",
    priority: 94,
    when: (m) => m.currentMonthDeltaPercent !== null,
    build: (m) =>
      makeInsight(
        "kpi-total-monthly-delta",
        m.currentMonthDeltaPercent && m.currentMonthDeltaPercent > 0 ? "Spending is up" : "Spending cooled off",
        `This month is ${m.currentMonthDeltaPercent && m.currentMonthDeltaPercent > 0 ? "up" : "down"} ${formatPercent(
          Math.abs(m.currentMonthDeltaPercent || 0)
        )} versus the previous month.`,
        m.currentMonthDeltaPercent && m.currentMonthDeltaPercent > 30 ? "warn" : "info",
        94,
        ["currentMonthDeltaPercent"]
      )
  },
  {
    id: "kpi-total-weekend-driver",
    scope: "kpi",
    target: "total",
    priority: 90,
    when: (m) => m.totalSpend > 0,
    build: (m) =>
      makeInsight(
        "kpi-total-weekend-driver",
        m.weekendShare >= 0.6 ? "Weekend spender" : "Weekday-led spend",
        `${formatPercent((m.weekendSpend / Math.max(1, m.totalSpend)) * 100)} of your spend comes from weekend orders.`,
        m.weekendShare >= 0.6 ? "warn" : "info",
        90,
        ["weekendSpend", "totalSpend", "weekendShare"]
      )
  },
  {
    id: "kpi-orders-frequency",
    scope: "kpi",
    target: "orders",
    priority: 96,
    when: (m) => m.totalOrders > 0,
    build: (m) =>
      makeInsight(
        "kpi-orders-frequency",
        "Order frequency",
        `You order ${m.ordersPerWeek.toFixed(1)} times per week on average.`,
        m.ordersPerWeek > 3 ? "warn" : "info",
        96,
        ["ordersPerWeek", "totalOrders"]
      )
  },
  {
    id: "kpi-orders-peak-day",
    scope: "kpi",
    target: "orders",
    priority: 93,
    when: (m) => Boolean(m.topDay),
    build: (m) =>
      makeInsight(
        "kpi-orders-peak-day",
        "Favored day",
        `${m.topDay?.label} is your most frequent order day with ${m.topDay?.count} orders.`,
        "info",
        93,
        ["topDay"]
      )
  },
  {
    id: "kpi-orders-gap",
    scope: "kpi",
    target: "orders",
    priority: 89,
    when: (m) => m.totalOrders > 0,
    build: (m) =>
      makeInsight(
        "kpi-orders-gap",
        m.longestGapDays >= 5 ? "Cooling-off stretch" : "Steady habit",
        m.longestGapDays >= 5
          ? `You once skipped ordering for ${m.longestGapDays} consecutive days.`
          : `Your longest quiet stretch is only ${Math.max(0, m.longestGapDays)} days.`,
        m.longestGapDays >= 5 ? "warn" : "good",
        89,
        ["longestGapDays"]
      )
  },
  {
    id: "kpi-avg-skew",
    scope: "kpi",
    target: "avg",
    priority: 96,
    when: (m) => m.avgOrderValue > 0 && m.medianOrderValue > 0,
    build: (m) => {
      const skewRatio = m.avgOrderValue / Math.max(1, m.medianOrderValue);
      return makeInsight(
        "kpi-avg-skew",
        skewRatio > 1.25 ? "Big orders are skewing it" : "Spend looks consistent",
        skewRatio > 1.25
          ? `Your average sits well above the median, so a few heavy bills pull it up.`
          : `Your average and median stay close, which means your order value is steady.`,
        skewRatio > 1.25 ? "warn" : "good",
        96,
        ["avgOrderValue", "medianOrderValue"]
      );
    }
  },
  {
    id: "kpi-avg-highest",
    scope: "kpi",
    target: "avg",
    priority: 92,
    when: (m) => m.highestOrderValue > 0,
    build: (m) =>
      makeInsight(
        "kpi-avg-highest",
        "Highest ticket",
        `Your biggest single order was ${inr(m.highestOrderValue)}${m.highestOrderRestaurant ? ` at ${m.highestOrderRestaurant}` : ""}.`,
        "info",
        92,
        ["highestOrderValue", "highestOrderRestaurant"]
      )
  },
  {
    id: "kpi-avg-bucket",
    scope: "kpi",
    target: "avg",
    priority: 88,
    when: (m) => m.orderValueBuckets.some((bucket) => bucket.count > 0),
    build: (m) => {
      const bucket = [...m.orderValueBuckets].sort((left, right) => right.count - left.count)[0];
      return makeInsight(
        "kpi-avg-bucket",
        "Common bill size",
        `Most of your orders fall in the ${bucket.label} range.`,
        "info",
        88,
        ["orderValueBuckets"]
      );
    }
  },
  {
    id: "kpi-months-consistency",
    scope: "kpi",
    target: "months",
    priority: 95,
    when: (m) => m.activeMonths > 0,
    build: (m) => {
      const ratio = m.activeMonths / Math.max(1, m.monthsInRange);
      return makeInsight(
        "kpi-months-consistency",
        ratio >= 0.75 ? "Consistent run" : "Stop-start pattern",
        ratio >= 0.75
          ? `You stayed active in ${m.activeMonths} of the last ${m.monthsInRange} months.`
          : `You were active in ${m.activeMonths} of ${m.monthsInRange} months, so the pattern is patchier.`,
        ratio >= 0.75 ? "good" : "info",
        95,
        ["activeMonths", "monthsInRange"]
      );
    }
  },
  {
    id: "kpi-months-top-month",
    scope: "kpi",
    target: "months",
    priority: 92,
    when: (m) => Boolean(m.highestMonthLabel),
    build: (m) =>
      makeInsight(
        "kpi-months-top-month",
        "Peak month",
        `${m.highestMonthLabel} was your biggest month at ${inr(m.highestMonthSpend)}.`,
        "info",
        92,
        ["highestMonthLabel", "highestMonthSpend"]
      )
  },
  {
    id: "kpi-months-gap",
    scope: "kpi",
    target: "months",
    priority: 88,
    when: (m) => m.monthsSinceLastOrder !== null,
    build: (m) =>
      makeInsight(
        "kpi-months-gap",
        m.monthsSinceLastOrder && m.monthsSinceLastOrder > 1 ? "Recent break" : "Still active",
        m.monthsSinceLastOrder && m.monthsSinceLastOrder > 1
          ? `You have not ordered in ${formatMonthGap(m.monthsSinceLastOrder)}.`
          : "You are still active in the recent cycle.",
        m.monthsSinceLastOrder && m.monthsSinceLastOrder > 1 ? "warn" : "good",
        88,
        ["monthsSinceLastOrder"]
      )
  },
  {
    id: "kpi-top-restaurant-loyalty",
    scope: "kpi",
    target: "topRestaurant",
    priority: 96,
    when: (m) => Boolean(m.topRestaurant),
    build: (m) =>
      makeInsight(
        "kpi-top-restaurant-loyalty",
        (m.topRestaurant?.orderShare || 0) > 0.5 ? "Heavy dependence" : "Strong loyalty",
        `You ordered from ${m.topRestaurant?.name} ${m.topRestaurant?.orders} times, or ${formatPercent(
          (m.topRestaurant?.orderShare || 0) * 100
        )} of all orders.`,
        (m.topRestaurant?.orderShare || 0) > 0.5 ? "warn" : "good",
        96,
        ["topRestaurant.orders", "topRestaurant.orderShare"]
      )
  },
  {
    id: "kpi-top-restaurant-spend-share",
    scope: "kpi",
    target: "topRestaurant",
    priority: 90,
    when: (m) => Boolean(m.topRestaurant),
    build: (m) =>
      makeInsight(
        "kpi-top-restaurant-spend-share",
        "Spend concentration",
        `${m.topRestaurant?.name} accounts for ${formatPercent((m.topRestaurant?.spendShare || 0) * 100)} of your spend.`,
        (m.topRestaurant?.spendShare || 0) > 0.35 ? "warn" : "info",
        90,
        ["topRestaurant.spendShare"]
      )
  },
  {
    id: "kpi-top-restaurant-variety",
    scope: "kpi",
    target: "topRestaurant",
    priority: 86,
    when: (m) => m.uniqueRestaurantsCount > 0,
    build: (m) =>
      makeInsight(
        "kpi-top-restaurant-variety",
        m.uniqueRestaurantsCount >= 12 ? "You still explore" : "Tight repeat loop",
        m.uniqueRestaurantsCount >= 12
          ? `You ordered from ${m.uniqueRestaurantsCount} restaurants, so one favorite has not killed variety.`
          : `Only ${m.uniqueRestaurantsCount} restaurants make up your order history, so repeat behavior is strong.`,
        m.uniqueRestaurantsCount >= 12 ? "good" : "info",
        86,
        ["uniqueRestaurantsCount"]
      )
  },
  {
    id: "kpi-top-item-staple",
    scope: "kpi",
    target: "topItem",
    priority: 96,
    when: (m) => Boolean(m.topItem),
    build: (m) =>
      makeInsight(
        "kpi-top-item-staple",
        "Staple item",
        `${m.topItem?.name} makes up ${formatPercent((m.topItem?.share || 0) * 100)} of all item volume.`,
        (m.topItem?.share || 0) > 0.2 ? "info" : "good",
        96,
        ["topItem.share", "topItem.count"]
      )
  },
  {
    id: "kpi-top-item-weekend",
    scope: "kpi",
    target: "topItem",
    priority: 90,
    when: (m) => Boolean(m.topItem),
    build: (m) =>
      makeInsight(
        "kpi-top-item-weekend",
        (m.topItem?.weekendShare || 0) >= 0.5 ? "Weekend craving" : "Weekday regular",
        `${m.topItem?.name} shows up ${(m.topItem?.weekendShare || 0) >= 0.5 ? "mostly on weekends" : "more on weekdays"}.`,
        "info",
        90,
        ["topItem.weekendShare"]
      )
  },
  {
    id: "kpi-top-item-pairing",
    scope: "kpi",
    target: "topItem",
    priority: 86,
    when: (m) => Boolean(m.topItem),
    build: (m) =>
      makeInsight(
        "kpi-top-item-pairing",
        m.topItem?.topPairing ? "Common pairing" : "No fixed sidekick",
        m.topItem?.topPairing
          ? `${m.topItem.name} most often appears with ${m.topItem.topPairing}.`
          : `${m.topItem?.name} moves around enough that no single pairing dominates.`,
        "info",
        86,
        ["topItem.topPairing"]
      )
  },
  {
    id: "card-monthly-peak",
    scope: "card",
    target: "monthlySpend",
    priority: 96,
    when: (m) => Boolean(m.highestMonthLabel),
    build: (m) => {
      const average = m.monthlySpend.length
        ? m.monthlySpend.reduce((sum, entry) => sum + entry.spend, 0) / m.monthlySpend.length
        : 0;
      const lift = average ? ((m.highestMonthSpend - average) / average) * 100 : 0;
      return makeInsight(
        "card-monthly-peak",
        "Peak month",
        `${m.highestMonthLabel} came in at ${inr(m.highestMonthSpend)}, about ${formatPercent(Math.max(0, lift))} above your baseline.`,
        lift > 30 ? "warn" : "info",
        96,
        ["highestMonthLabel", "highestMonthSpend", "monthlySpend"]
      );
    }
  },
  {
    id: "card-monthly-quiet",
    scope: "card",
    target: "monthlySpend",
    priority: 90,
    when: (m) => m.monthlySpend.some((entry) => entry.spend > 0),
    build: (m) => {
      const quiet = [...m.monthlySpend].filter((entry) => entry.spend > 0).sort((left, right) => left.spend - right.spend)[0];
      return makeInsight(
        "card-monthly-quiet",
        "Quiet patch",
        `${quiet.label} was your softest month at ${inr(quiet.spend)}.`,
        "info",
        90,
        ["monthlySpend"]
      );
    }
  },
  {
    id: "card-monthly-aggregation",
    scope: "card",
    target: "monthlySpend",
    priority: 82,
    when: (m) => m.selectedYear === "all" && m.monthlySpend.length > 0,
    build: () =>
      makeInsight(
        "card-monthly-aggregation",
        "All-time view",
        "These bars combine the same month across every year, so peaks show seasonality more than one-off spikes.",
        "info",
        82,
        ["selectedYear", "monthlySpend"]
      )
  },
  {
    id: "card-restaurant-top-two",
    scope: "card",
    target: "spendByRestaurant",
    priority: 96,
    when: (m) => m.topRestaurants.length >= 2,
    build: (m) =>
      makeInsight(
        "card-restaurant-top-two",
        m.topTwoRestaurantSpendShare > 0.6 ? "Spend is concentrated" : "Spend is spread out",
        `Your top two restaurants absorb ${formatPercent(m.topTwoRestaurantSpendShare * 100)} of total spend.`,
        m.topTwoRestaurantSpendShare > 0.6 ? "warn" : "good",
        96,
        ["topTwoRestaurantSpendShare", "topRestaurants"]
      )
  },
  {
    id: "card-restaurant-gap",
    scope: "card",
    target: "spendByRestaurant",
    priority: 90,
    when: (m) => m.topRestaurants.length >= 2,
    build: (m) =>
      makeInsight(
        "card-restaurant-gap",
        "Clear leader",
        `${m.topRestaurants[0].name} stays ahead of ${m.topRestaurants[1].name} by ${inr(
          m.topRestaurants[0].spend - m.topRestaurants[1].spend
        )}.`,
        "info",
        90,
        ["topRestaurants"]
      )
  },
  {
    id: "card-restaurant-discovery",
    scope: "card",
    target: "spendByRestaurant",
    priority: 84,
    when: (m) => m.uniqueRestaurantsCount > 0,
    build: (m) =>
      makeInsight(
        "card-restaurant-discovery",
        m.uniqueRestaurantsCount >= 12 ? "Explorer mode" : "Repeat mode",
        m.uniqueRestaurantsCount >= 12
          ? `You rotated through ${m.uniqueRestaurantsCount} restaurants, so variety is still alive.`
          : `Only ${m.uniqueRestaurantsCount} restaurants show up here, so repeat ordering dominates.`,
        m.uniqueRestaurantsCount >= 12 ? "good" : "info",
        84,
        ["uniqueRestaurantsCount"]
      )
  },
  {
    id: "card-busiest-peak-hour",
    scope: "card",
    target: "busiestOrdering",
    priority: 96,
    when: (m) => Boolean(m.topHour),
    build: (m) =>
      makeInsight(
        "card-busiest-peak-hour",
        "Peak hour",
        `${m.topHour?.label} is the busiest slot, carrying ${formatPercent((m.topHour?.share || 0) * 100)} of all orders.`,
        "info",
        96,
        ["topHour"]
      )
  },
  {
    id: "card-busiest-late-night",
    scope: "card",
    target: "busiestOrdering",
    priority: 90,
    when: (m) => m.lateNightShare > 0,
    build: (m) =>
      makeInsight(
        "card-busiest-late-night",
        m.lateNightShare >= 0.35 ? "Late-night cravings" : "Night orders stay contained",
        `${formatPercent(m.lateNightShare * 100)} of your orders happen after 9 PM.`,
        m.lateNightShare >= 0.35 ? "warn" : "info",
        90,
        ["lateNightShare", "lateNightOrders"]
      )
  },
  {
    id: "card-busiest-weekend-peak",
    scope: "card",
    target: "busiestOrdering",
    priority: 84,
    when: (m) => Boolean(m.topDay),
    build: (m) =>
      makeInsight(
        "card-busiest-weekend-peak",
        m.topDay?.label === "Sat" || m.topDay?.label === "Sun" ? "Weekend surge" : "Weekday anchor",
        `${m.topDay?.label} leads the week with ${m.topDay?.count} orders.`,
        "info",
        84,
        ["topDay"]
      )
  },
  {
    id: "card-items-leader",
    scope: "card",
    target: "foodItemCount",
    priority: 96,
    when: (m) => Boolean(m.topItem),
    build: (m) =>
      makeInsight(
        "card-items-leader",
        "Most repeated plate",
        `${m.topItem?.name} leads with ${m.topItem?.count} total item orders.`,
        "info",
        96,
        ["topItem.count", "topItem.name"]
      )
  },
  {
    id: "card-items-concentration",
    scope: "card",
    target: "foodItemCount",
    priority: 90,
    when: (m) => m.topThreeItemShare > 0,
    build: (m) =>
      makeInsight(
        "card-items-concentration",
        m.topThreeItemShare > 0.45 ? "Repeat-heavy menu" : "Varied plate",
        `Your top 3 items make up ${formatPercent(m.topThreeItemShare * 100)} of total item volume.`,
        m.topThreeItemShare > 0.45 ? "warn" : "good",
        90,
        ["topThreeItemShare", "topItems"]
      )
  },
  {
    id: "card-items-playful-porotta",
    scope: "card",
    target: "foodItemCount",
    priority: 84,
    when: (m) => (m.topItem?.name || "").toLowerCase().includes("porotta"),
    build: (m) =>
      makeInsight(
        "card-items-playful-porotta",
        "Porotta era",
        `${m.topItem?.name} is not a cameo here. It is a real pattern in your ordering history.`,
        "info",
        84,
        ["topItem.name", "topItem.share"]
      )
  },
  {
    id: "card-trend-surge",
    scope: "card",
    target: "orderTrend",
    priority: 96,
    when: (m) => m.recentOrderTrendRatio !== null,
    build: (m) =>
      makeInsight(
        "card-trend-surge",
        (m.recentOrderTrendRatio || 0) >= 1.3 ? "Recent surge" : (m.recentOrderTrendRatio || 0) <= 0.7 ? "Cooling off" : "Holding steady",
        (m.recentOrderTrendRatio || 0) >= 1.3
          ? `The last two months are running about ${formatPercent(((m.recentOrderTrendRatio || 1) - 1) * 100)} above the prior baseline.`
          : (m.recentOrderTrendRatio || 0) <= 0.7
            ? `Recent order volume is roughly ${formatPercent((1 - (m.recentOrderTrendRatio || 0)) * 100)} below the earlier baseline.`
            : "Recent order volume is moving close to your usual monthly baseline.",
        (m.recentOrderTrendRatio || 0) >= 1.3 ? "warn" : "info",
        96,
        ["recentOrderTrendRatio", "monthlySpend"]
      )
  },
  {
    id: "card-trend-peak-month",
    scope: "card",
    target: "orderTrend",
    priority: 90,
    when: (m) => m.monthlySpend.length > 0,
    build: (m) => {
      const peak = [...m.monthlySpend].sort((left, right) => right.orders - left.orders)[0];
      return makeInsight(
        "card-trend-peak-month",
        "Busiest month",
        `${peak.label} produced your highest order count at ${peak.orders} orders.`,
        "info",
        90,
        ["monthlySpend"]
      );
    }
  },
  {
    id: "card-trend-pace",
    scope: "card",
    target: "orderTrend",
    priority: 84,
    when: (m) => m.activeMonths > 0,
    build: (m) =>
      makeInsight(
        "card-trend-pace",
        "Active-month pace",
        `You average ${Math.max(1, Math.round(m.totalOrders / Math.max(1, m.activeMonths)))} orders in an active month.`,
        "info",
        84,
        ["totalOrders", "activeMonths"]
      )
  },
  {
    id: "card-activity-days",
    scope: "card",
    target: "activityStreak",
    priority: 96,
    when: (m) => m.orderedDays > 0,
    build: (m) =>
      makeInsight(
        "card-activity-days",
        "Active footprint",
        `You placed orders on ${m.orderedDays} distinct days.`,
        "info",
        96,
        ["orderedDays"]
      )
  },
  {
    id: "card-activity-streak",
    scope: "card",
    target: "activityStreak",
    priority: 92,
    when: (m) => m.longestStreak > 0,
    build: (m) =>
      makeInsight(
        "card-activity-streak",
        m.longestStreak >= 4 ? "Real streak energy" : "Short-burst habit",
        `Your longest streak lasted ${m.longestStreak} day${m.longestStreak === 1 ? "" : "s"} in a row.`,
        m.longestStreak >= 4 ? "good" : "info",
        92,
        ["longestStreak"]
      )
  },
  {
    id: "card-activity-gap",
    scope: "card",
    target: "activityStreak",
    priority: 86,
    when: (m) => m.totalOrders > 0,
    build: (m) =>
      makeInsight(
        "card-activity-gap",
        m.longestGapDays >= 7 ? "Clear reset window" : "Few long breaks",
        m.longestGapDays >= 7
          ? `You stepped away for ${m.longestGapDays} days at your longest gap.`
          : `Long breaks are rare here. Your longest gap is ${Math.max(0, m.longestGapDays)} days.`,
        m.longestGapDays >= 7 ? "warn" : "good",
        86,
        ["longestGapDays"]
      )
  },
  {
    id: "card-milestones-first-order",
    scope: "card",
    target: "milestones",
    priority: 96,
    when: (m) => Boolean(m.firstOrderDate),
    build: (m) =>
      makeInsight(
        "card-milestones-first-order",
        "Starting point",
        `Your first recorded order was on ${formatDate(m.firstOrderDate)}${m.firstOrderRestaurant ? ` at ${m.firstOrderRestaurant}` : ""}.`,
        "info",
        96,
        ["firstOrderDate", "firstOrderRestaurant"]
      )
  },
  {
    id: "card-milestones-spend",
    scope: "card",
    target: "milestones",
    priority: 90,
    when: (m) => m.spendMilestones.some((milestone) => milestone.threshold >= 25000),
    build: (m) => {
      const milestone = m.spendMilestones.find((entry) => entry.threshold >= 25000) || m.spendMilestones[m.spendMilestones.length - 1];
      return makeInsight(
        "card-milestones-spend",
        "Spend landmark",
        `You crossed ₹${Math.round(milestone.threshold / 1000)}K on ${formatDate(milestone.date)}.`,
        "info",
        90,
        ["spendMilestones"]
      );
    }
  },
  {
    id: "card-milestones-largest-order",
    scope: "card",
    target: "milestones",
    priority: 86,
    when: (m) => m.highestOrderValue > 0,
    build: (m) =>
      makeInsight(
        "card-milestones-largest-order",
        "Personal best",
        `Your biggest order hit ${inr(m.highestOrderValue)}${m.highestOrderRestaurant ? ` at ${m.highestOrderRestaurant}` : ""}.`,
        "info",
        86,
        ["highestOrderValue", "highestOrderRestaurant"]
      )
  },
  {
    id: "card-cuisine-top",
    scope: "card",
    target: "cuisineRadar",
    priority: 96,
    when: (m) => Boolean(m.topCuisine),
    build: (m) =>
      makeInsight(
        "card-cuisine-top",
        "Cuisine leader",
        `${m.topCuisine?.cuisine} leads your spend mix with ${formatPercent((m.topCuisine?.share || 0) * 100)} share.`,
        (m.topCuisine?.share || 0) > 0.5 ? "warn" : "info",
        96,
        ["topCuisine"]
      )
  },
  {
    id: "card-cuisine-diversity",
    scope: "card",
    target: "cuisineRadar",
    priority: 90,
    when: (m) => m.cuisineSpend.length > 0,
    build: (m) =>
      makeInsight(
        "card-cuisine-diversity",
        m.topCuisine && m.topCuisine.share < 0.3 ? "Explorer palate" : "Cuisine comfort zone",
        m.topCuisine && m.topCuisine.share < 0.3
          ? "No single cuisine dominates, so your ordering stays fairly exploratory."
          : "One cuisine clearly anchors your spend, so variety drops after the leader.",
        m.topCuisine && m.topCuisine.share < 0.3 ? "good" : "info",
        90,
        ["topCuisine.share", "cuisineSpend"]
      )
  }
];

export function computeInsightsBundle(aggregates: InsightAggregates): InsightsBundle {
  const key = cacheKey(aggregates);
  const cached = insightCache.get(key);
  if (cached) return cached;

  const bundle = createEmptyBundle();

  for (const rule of RULES) {
    if (!rule.when(aggregates)) continue;

    const result = rule.build(aggregates);
    const built = Array.isArray(result) ? result : [result];
    for (const insight of built) {
      if (rule.scope === "global") {
        bundle.global.push(insight);
      } else if (rule.scope === "kpi") {
        bundle.kpis[rule.target as KpiInsightKey].push(insight);
      } else {
        bundle.cards[rule.target as ExtendedCardInsightKey].push(insight);
      }
    }

    bundle.debug?.firedRules.push({
      id: rule.id,
      scope: rule.scope,
      target: String(rule.target),
      priority: rule.priority
    });
  }

  bundle.global = bundle.global
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 6);

  for (const key of KPI_KEYS) {
    bundle.kpis[key] = bundle.kpis[key]
      .sort((left, right) => right.priority - left.priority)
      .slice(0, 4);
  }

  for (const key of EXTENDED_CARD_KEYS) {
    bundle.cards[key] = bundle.cards[key]
      .sort((left, right) => right.priority - left.priority)
      .slice(0, 5);
  }

  insightCache.set(key, bundle);
  return bundle;
}

function toCard(insights: Insight[]): KpiInsightCard {
  const bullets = insights.slice(0, 3).map((insight) => insight.message);
  return {
    bullets: bullets.length ? bullets : ["Import orders to unlock this insight."],
    source: "local"
  };
}

export function computeLocalKpiInsights(aggregates: InsightAggregates): KpiInsightPack {
  const bundle = computeInsightsBundle(aggregates);
  return {
    total: toCard(bundle.kpis.total),
    orders: toCard(bundle.kpis.orders),
    avg: toCard(bundle.kpis.avg),
    months: toCard(bundle.kpis.months),
    topRestaurant: toCard(bundle.kpis.topRestaurant),
    topItem: toCard(bundle.kpis.topItem),
    weeklyNarrative: buildNarrative(aggregates)
  };
}

export function computeLocalChartInsights(aggregates: InsightAggregates): ChartInsightPack {
  const bundle = computeInsightsBundle(aggregates);
  const monthlyInsightCard = toCard(bundle.cards.monthlySpend);
  const monthlySeries =
    aggregates.selectedYear === "all" ? aggregates.monthlySpendByMonthOfYear : aggregates.monthlySpend;
  const nonZeroMonthlySeries = monthlySeries.filter((entry) => entry.spend > 0);
  const peakMonthlyEntry =
    [...monthlySeries].sort((left, right) => right.spend - left.spend)[0] || null;
  const quietMonthlyEntry =
    [...nonZeroMonthlySeries].sort((left, right) => left.spend - right.spend)[0] || null;
  const monthlyAverage = monthlySeries.length
    ? monthlySeries.reduce((sum, entry) => sum + entry.spend, 0) / monthlySeries.length
    : 0;

  if (peakMonthlyEntry) {
    const lift = monthlyAverage ? ((peakMonthlyEntry.spend - monthlyAverage) / monthlyAverage) * 100 : 0;
    monthlyInsightCard.bullets[0] = `${peakMonthlyEntry.label} came in at ${inr(peakMonthlyEntry.spend)}, about ${formatPercent(
      Math.max(0, lift)
    )} above your baseline.`;
  }

  if (quietMonthlyEntry) {
    monthlyInsightCard.bullets[1] = `${quietMonthlyEntry.label} was your softest month at ${inr(quietMonthlyEntry.spend)}.`;
  }

  const visibleTrendSeries =
    aggregates.selectedYear !== "all"
      ? aggregates.monthlySpend.slice(-24)
      : aggregates.monthlySpend.filter((entry) => entry.key !== currentMonthKey()).slice(-24);
  const trendSeries = visibleTrendSeries.length ? visibleTrendSeries : aggregates.monthlySpend;
  const peakTrendOrders = trendSeries.length ? Math.max(...trendSeries.map((entry) => entry.orders)) : 0;
  const peakTrendMonths = trendSeries.filter((entry) => entry.orders === peakTrendOrders);
  const orderTrendCard = toCard(bundle.cards.orderTrend);

  if (peakTrendMonths.length > 0) {
    orderTrendCard.bullets[1] =
      peakTrendMonths.length === 1
        ? `${peakTrendMonths[0].label} produced your highest order count at ${peakTrendMonths[0].orders} orders.`
        : `${peakTrendMonths.map((entry) => entry.label).join(" and ")} share the highest order count at ${peakTrendOrders} orders.`;
  }

  return {
    monthlySpend: monthlyInsightCard,
    spendByRestaurant: toCard(bundle.cards.spendByRestaurant),
    busiestOrdering: toCard(bundle.cards.busiestOrdering),
    foodItemCount: toCard(bundle.cards.foodItemCount),
    orderTrend: orderTrendCard,
    activityStreak: toCard(bundle.cards.activityStreak)
  };
}
