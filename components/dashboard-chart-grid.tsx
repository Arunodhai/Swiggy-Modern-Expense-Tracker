"use client";

import {
  CSSProperties,
  DragEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { getStoredCardOrder, Order, setStoredCardOrder } from "@/lib/dashboard-data";
import { ChartInsightKey, ChartInsightPack, KpiInsightCard } from "@/lib/kpi-insights";
import {
  aggregateItems,
  CalendarSummary,
  CARD_ORDER_DEFAULT,
  CardKey,
  ChartData,
  cleanRestaurant,
  computeCalendarSummary,
  DayFilter,
  DAY_OPTIONS,
  DonutRegion,
  HeatmapRegion,
  inr,
  PointRegion,
  RectRegion,
  setupCanvas,
  themeColors,
  ThemeMode
} from "@/lib/dashboard-view";

type TooltipState = {
  text: string;
  x: number;
  y: number;
} | null;

type DayDetailsState = {
  key: string;
  label: string;
  orders: Order[];
  total: number;
} | null;

type ItemDetailsState = {
  items: Array<[string, number]>;
} | null;

type Milestone = {
  tier: 1 | 2 | 3;
  icon: string;
  title: string;
  desc: string;
  date: string;
  badge: string;
};

type CuisineRadarPoint = {
  x: number;
  y: number;
  cuisine: string;
  spend: number;
  pct: number;
};

type Props = {
  orders: Order[];
  selectedYear: string;
  theme: ThemeMode;
  chartData: ChartData;
  chartInsights: ChartInsightPack;
  pageReady: boolean;
  reducedMotion: boolean;
};

export function DashboardChartGrid({
  orders,
  selectedYear,
  theme,
  chartData,
  chartInsights,
  pageReady,
  reducedMotion
}: Props) {
  const monthlyCanvasRef = useRef<HTMLCanvasElement>(null);
  const restaurantCanvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const itemCountCanvasRef = useRef<HTMLCanvasElement>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement>(null);
  const cuisineCanvasRef = useRef<HTMLCanvasElement>(null);

  const monthlyRegionsRef = useRef<RectRegion[]>([]);
  const restaurantRegionsRef = useRef<DonutRegion[]>([]);
  const heatmapRegionsRef = useRef<HeatmapRegion[]>([]);
  const itemRegionsRef = useRef<RectRegion[]>([]);
  const trendRegionsRef = useRef<PointRegion[]>([]);
  const cuisineRegionsRef = useRef<CuisineRadarPoint[]>([]);

  const [dayFilter, setDayFilter] = useState<DayFilter>("All");
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [draggedCard, setDraggedCard] = useState<CardKey | null>(null);
  const [dragOverCard, setDragOverCard] = useState<CardKey | null>(null);
  const [cardOrder, setCardOrder] = useState<CardKey[]>(CARD_ORDER_DEFAULT);
  const [dayDetails, setDayDetails] = useState<DayDetailsState>(null);
  const [itemDetails, setItemDetails] = useState<ItemDetailsState>(null);
  const [activeChartInsight, setActiveChartInsight] = useState<ChartInsightKey | null>(null);
  const chartAnimationPrimedRef = useRef(false);
  const calendar: CalendarSummary = useMemo(
    () => computeCalendarSummary(orders, selectedYear),
    [orders, selectedYear]
  );

  const visibleMonthLabels = useMemo(() => {
    const minGap = 44;
    return calendar.monthLabels.filter((label, index, labels) => {
      if (index === 0) {
        return true;
      }
      return label.left - labels[index - 1].left >= minGap;
    });
  }, [calendar.monthLabels]);

  const ordersByDay = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of orders) {
      const date = order.dateISO ? new Date(order.dateISO) : null;
      if (!date || Number.isNaN(date.getTime())) {
        continue;
      }

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;
      const list = map.get(key) || [];
      list.push(order);
      map.set(key, list);
    }

    for (const [key, list] of map) {
      map.set(
        key,
        [...list].sort((left, right) => {
          const leftTime = left.dateISO ? new Date(left.dateISO).getTime() : 0;
          const rightTime = right.dateISO ? new Date(right.dateISO).getTime() : 0;
          return rightTime - leftTime;
        })
      );
    }

    return map;
  }, [orders]);

  const allItemEntries = useMemo(
    () => [...aggregateItems(orders).entries()].sort((left, right) => right[1] - left[1]),
    [orders]
  );
  const busiestOrderingInsight = useMemo(() => {
    if (dayFilter === "All") {
      return chartInsights.busiestOrdering;
    }

    const series = chartData.heatmap[dayFilter] || [];
    const peakCount = Math.max(...series, 0);
    const peakHour = series.findIndex((value) => value === peakCount);
    const total = series.reduce((sum, value) => sum + value, 0);
    const lateNightCount = series.reduce((sum, value, hour) => {
      if (hour >= 21 || hour <= 1) {
        return sum + value;
      }
      return sum;
    }, 0);

    return {
      source: "local" as const,
      bullets: [
        total
          ? `${dayFilter} peaks around ${String(Math.max(0, peakHour)).padStart(2, "0")}:00 with ${peakCount} orders.`
          : `No ${dayFilter} ordering pattern has formed yet.`,
        total
          ? `${dayFilter} contributes ${Math.round((total / Math.max(1, chartData.heatmap.All.reduce((sum, value) => sum + value, 0))) * 100)}% of all weekly orders.`
          : `There are no ${dayFilter} orders in this period.`,
        total
          ? `${Math.round((lateNightCount / Math.max(1, total)) * 100)}% of ${dayFilter} orders happen after 9 PM.`
          : `${dayFilter} has no late-night ordering pattern to show yet.`
      ]
    };
  }, [chartData.heatmap, chartInsights.busiestOrdering, dayFilter]);

  const cuisineRadarData = useMemo(() => {
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
    ];

    function inferCuisine(order: Order) {
      const restaurant = cleanRestaurant(order.restaurant || "").toLowerCase().trim();
      for (const [needle, cuisine] of Object.entries(restaurantCuisineMap)) {
        if (restaurant.includes(needle)) {
          return cuisine;
        }
      }

      for (const line of order.items || []) {
        for (const rule of itemCuisineRules) {
          if (rule.re.test(line)) {
            return rule.cat;
          }
        }
      }

      return "Other";
    }

    const spendByCuisine = new Map<string, number>();
    for (const order of orders) {
      const cuisine = inferCuisine(order);
      spendByCuisine.set(cuisine, (spendByCuisine.get(cuisine) || 0) + (Number(order.amount) || 0));
    }

    const totalSpend = [...spendByCuisine.values()].reduce((sum, value) => sum + value, 0);
    return [...spendByCuisine.entries()]
      .map(([cuisine, spend]) => ({
        cuisine,
        spend,
        pct: totalSpend ? Math.round((spend / totalSpend) * 100) : 0
      }))
      .filter((entry) => entry.spend > 0)
      .sort((left, right) => right.spend - left.spend)
      .slice(0, 8);
  }, [orders]);

  const milestones = useMemo(() => {
    if (!orders.length) {
      return [] as Milestone[];
    }

    const sorted = [...orders]
      .filter((order) => order.dateISO)
      .sort((left, right) => new Date(left.dateISO as string).getTime() - new Date(right.dateISO as string).getTime());

    const fmtDate = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

    const output: Milestone[] = [];

    if (sorted[0]) {
      output.push({
        tier: 1,
        icon: "🚀",
        title: "First Order",
        desc: cleanRestaurant(sorted[0].restaurant || "?"),
        date: fmtDate(sorted[0].dateISO),
        badge: "FIRST"
      });
    }

    for (const count of [10, 25, 50, 100, 150, 200, 300, 500]) {
      if (sorted.length >= count) {
        const order = sorted[count - 1];
        output.push({
          tier: count >= 100 ? 1 : 2,
          icon: "📦",
          title: `${count}th Order`,
          desc: cleanRestaurant(order.restaurant || "?"),
          date: fmtDate(order.dateISO),
          badge: `#${count}`
        });
      }
    }

    let runningSpend = 0;
    for (const order of sorted) {
      const previous = runningSpend;
      runningSpend += Number(order.amount) || 0;
      for (const threshold of [1000, 5000, 10000, 25000, 50000]) {
        if (previous < threshold && runningSpend >= threshold) {
          output.push({
            tier: threshold >= 25000 ? 1 : 2,
            icon: "💰",
            title: `₹${threshold >= 1000 ? `${threshold / 1000}K` : threshold} Spent`,
            desc: `at ${cleanRestaurant(order.restaurant || "?")}`,
            date: fmtDate(order.dateISO),
            badge: "SPEND"
          });
        }
      }
    }

    const biggestOrder = sorted.reduce(
      (best, current) => ((Number(current.amount) || 0) > (Number(best.amount) || 0) ? current : best),
      sorted[0]
    );
    if (biggestOrder) {
      output.push({
        tier: 1,
        icon: "🔥",
        title: "Biggest Order",
        desc: `${inr(Number(biggestOrder.amount) || 0)} at ${cleanRestaurant(biggestOrder.restaurant || "?")}`,
        date: fmtDate(biggestOrder.dateISO),
        badge: "RECORD"
      });
    }

    const restCounts = new Map<string, number>();
    for (const order of orders) {
      const name = cleanRestaurant(order.restaurant || "?");
      restCounts.set(name, (restCounts.get(name) || 0) + 1);
    }
    const loyal = [...restCounts.entries()].sort((left, right) => right[1] - left[1])[0];
    if (loyal && loyal[1] >= 5) {
      output.push({
        tier: 2,
        icon: "❤️",
        title: "Most Loyal",
        desc: `${loyal[0]} · ${loyal[1]} orders`,
        date: "",
        badge: "FAVE"
      });
    }

    return output.sort((left, right) => left.tier - right.tier);
  }, [orders]);

  useEffect(() => {
    const stored = getStoredCardOrder().filter((key): key is CardKey =>
      CARD_ORDER_DEFAULT.includes(key as CardKey)
    );
    if (!stored.length) {
      return;
    }

    setCardOrder([...stored, ...CARD_ORDER_DEFAULT.filter((key) => !stored.includes(key))]);
  }, []);

  useEffect(() => {
    setStoredCardOrder(cardOrder);
  }, [cardOrder]);

  useEffect(() => {
    setDayFilter("All");
    setHoverHour(null);
    setTooltip(null);
  }, [orders, selectedYear]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".chart-insight")) {
        setActiveChartInsight(null);
      }
    }

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  function renderChartInsightButton(key: ChartInsightKey, label: string, insightOverride?: KpiInsightCard) {
    const insight = insightOverride ?? chartInsights[key];
    const isOpen = activeChartInsight === key;

    return (
      <div
        className="chart-insight"
        onMouseEnter={() => setActiveChartInsight(key)}
        onMouseLeave={() => setActiveChartInsight((value) => (value === key ? null : value))}
      >
        <button
          className="chart-insight-button"
          type="button"
          aria-label={`Show insights for ${label}`}
          aria-expanded={isOpen}
          onClick={(event) => {
            event.stopPropagation();
            setActiveChartInsight((value) => (value === key ? null : key));
          }}
          onFocus={() => setActiveChartInsight(key)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 10v6" />
            <circle cx="12" cy="7" r="0.9" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <div className={`chart-insight-popover ${isOpen ? "open" : ""}`} role="tooltip">
          <div className="chart-insight-popover-inner">
            <strong>{label}</strong>
            <ul className="chart-insight-list">
              {insight.bullets.slice(0, 3).map((bullet, index) => (
                <li key={`${key}-${index}`}>{bullet}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const canvas = cuisineCanvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;

    const { ctx, w, h } = setup;
    const dark = theme === "dark";
    const accent = dark ? "#39d353" : "#ff6a2b";
    const accentFill = dark ? "rgba(57,211,83,0.16)" : "rgba(255,106,43,0.15)";
    const gridColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
    const axisColor = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)";
    const labelColor = dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.58)";

    cuisineRegionsRef.current = [];
    ctx.clearRect(0, 0, w, h);

    const items = cuisineRadarData;
    const count = items.length;
    if (!count) {
      ctx.fillStyle = themeColors(theme).label;
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No cuisine data", w / 2, h / 2);
      return;
    }

    const pad = Math.max(36, Math.min(52, w * 0.14));
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) - pad;
    const maxSpend = Math.max(...items.map((item) => item.spend), 1);

    for (let level = 1; level <= 4; level += 1) {
      const r = (maxR / 4) * level;
      ctx.beginPath();
      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const points: CuisineRadarPoint[] = [];
    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      const ex = cx + Math.cos(angle) * maxR;
      const ey = cy + Math.sin(angle) * maxR;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      const scale = items[i].spend / maxSpend;
      const x = cx + Math.cos(angle) * maxR * scale;
      const y = cy + Math.sin(angle) * maxR * scale;
      points.push({ x, y, cuisine: items[i].cuisine, spend: items[i].spend, pct: items[i].pct });
    }

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = accentFill;
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    points.forEach((point, index) => {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#000000" : "#ffffff";
      ctx.fill();

      const lx = cx + Math.cos(angle) * (maxR + 14);
      const ly = cy + Math.sin(angle) * (maxR + 14);
      const cos = Math.cos(angle);
      ctx.textAlign = cos > 0.3 ? "left" : cos < -0.3 ? "right" : "center";
      const textY = Math.sin(angle) > 0.1 ? ly + 11 : Math.sin(angle) < -0.1 ? ly - 4 : ly + 4;

      ctx.font = "600 10px sans-serif";
      ctx.fillStyle = labelColor;
      ctx.fillText(point.cuisine, lx, textY);
      ctx.font = "700 10px sans-serif";
      ctx.fillStyle = accent;
      ctx.fillText(`${point.pct}%`, lx, textY + 13);
    });

    cuisineRegionsRef.current = points;
  }, [cuisineRadarData, theme]);

  useEffect(() => {
    function drawHeatmap(progress: number) {
      const canvas = heatmapCanvasRef.current;
      if (!canvas) return;
      const setup = setupCanvas(canvas);
      if (!setup) return;

      const { ctx, w, h } = setup;
      const colors = themeColors(theme);
      const series = chartData.heatmap[dayFilter] || chartData.heatmap.All;
      const max = Math.max(1, ...series);
      const cx = w * 0.5;
      const cy = h * 0.49;
      const innerRadius = Math.max(40, Math.min(w, h) * 0.19);
      const outerRadius = Math.max(innerRadius + 52, Math.min(w, h) * 0.41);
      const step = (Math.PI * 2) / 24;
      const gap = step * 0.08;
      heatmapRegionsRef.current = [];
      ctx.clearRect(0, 0, w, h);

      [0.25, 0.5, 0.75, 1].forEach((tick) => {
        ctx.beginPath();
        ctx.arc(cx, cy, innerRadius + (outerRadius - innerRadius) * tick, 0, Math.PI * 2);
        ctx.strokeStyle = theme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 5]);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      for (let hour = 0; hour < 24; hour += 1) {
        const angle = -Math.PI / 2 + hour * step;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * (outerRadius + 8), cy + Math.sin(angle) * (outerRadius + 8));
        ctx.lineTo(cx + Math.cos(angle) * (outerRadius + (hour % 6 === 0 ? 18 : 13)), cy + Math.sin(angle) * (outerRadius + (hour % 6 === 0 ? 18 : 13)));
        ctx.strokeStyle =
          theme === "dark"
            ? hour % 6 === 0
              ? "rgba(255,255,255,0.65)"
              : "rgba(255,255,255,0.24)"
            : hour % 6 === 0
              ? "rgba(0,0,0,0.5)"
              : "rgba(0,0,0,0.22)";
        ctx.lineWidth = hour % 6 === 0 ? 2.4 : 1.2;
        ctx.stroke();
      }

      for (let hour = 0; hour < 24; hour += 1) {
        const value = series[hour] || 0;
        const scale = Math.max(0.08, (value / max) * progress);
        const start = -Math.PI / 2 + hour * step + gap / 2;
        const end = start + step - gap;
        const outer = innerRadius + (outerRadius - innerRadius) * scale + (hoverHour === hour ? 6 : 0);
        const dark = theme === "dark" ? { r: 16, g: 38, b: 0 } : { r: 243, g: 255, b: 232 };
        const light = theme === "dark" ? { r: 109, g: 255, b: 0 } : { r: 109, g: 255, b: 0 };
        const color = `rgb(${Math.round(dark.r + (light.r - dark.r) * scale)},${Math.round(
          dark.g + (light.g - dark.g) * scale
        )},${Math.round(dark.b + (light.b - dark.b) * scale)})`;

        ctx.beginPath();
        ctx.arc(cx, cy, outer, start, end);
        ctx.arc(cx, cy, innerRadius, end, start, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        heatmapRegionsRef.current.push({ cx, cy, inner: innerRadius, outer, start, end, hour, day: dayFilter, count: value });
      }

      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius - 1, 0, Math.PI * 2);
      ctx.fillStyle = theme === "dark" ? "#000000" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = theme === "dark" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1.1;
      ctx.stroke();

      ctx.fillStyle = colors.heatText;
      ctx.textAlign = "center";
      ctx.font = "700 18px sans-serif";
      if (hoverHour !== null) {
        ctx.fillText(`${String(hoverHour).padStart(2, "0")}:00`, cx, cy - 2);
        ctx.font = "600 12px sans-serif";
        ctx.fillText(`${series[hoverHour]} orders`, cx, cy + 16);
      } else {
        ctx.fillText(dayFilter === "All" ? "All Days" : dayFilter, cx, cy - 2);
        ctx.font = "500 8px sans-serif";
        ctx.fillStyle = theme === "dark" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
        ctx.fillText("HOVER TO EXPLORE", cx, cy + 16);
      }

      [
        { hour: 0, label: "0" }, { hour: 3, label: "3" }, { hour: 6, label: "6" }, { hour: 9, label: "9" },
        { hour: 12, label: "12" }, { hour: 15, label: "15" }, { hour: 18, label: "18" }, { hour: 21, label: "21" }
      ].forEach((tick) => {
        const angle = -Math.PI / 2 + tick.hour * step;
        ctx.fillStyle = colors.heatText;
        ctx.font = "10px sans-serif";
        ctx.fillText(tick.label, cx + Math.cos(angle) * (outerRadius + 32), cy + Math.sin(angle) * (outerRadius + 32) + 3);
      });
    }

    function drawMonthlyBars(progress: number) {
      const canvas = monthlyCanvasRef.current;
      if (!canvas) return;
      const setup = setupCanvas(canvas);
      if (!setup) return;

      const { ctx, w, h } = setup;
      const colors = themeColors(theme);
      ctx.clearRect(0, 0, w, h);
      monthlyRegionsRef.current = [];

      const labels = chartData.monthlyLabels;
      const values = chartData.monthlyValues;
      const left = 24;
      const right = 16;
      const chartHeight = Math.max(90, h * 0.72);
      const top = (h - chartHeight) / 2;
      const bottom = top + chartHeight;
      const max = Math.max(...values, 1);
      const band = (w - left - right) / Math.max(labels.length, 1);
      const depthX = Math.min(8, Math.max(4, band * 0.12));
      const depthY = Math.min(6, Math.max(3, band * 0.09));
      const visibleLabelIndexes = labels.length <= 1
        ? new Set([0])
        : new Set(labels.map((_, index) => index).filter((index) => index % 2 === 0 || index === labels.length - 1));

      ctx.strokeStyle = colors.axis;
      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(w - right, bottom);
      ctx.stroke();

      labels.forEach((label, index) => {
        const x = left + index * band + band * 0.15;
        const barWidth = band * 0.7;
        const barHeight = ((chartHeight * values[index]) / max) * progress;
        const y = bottom - barHeight;

        if (theme === "dark") {
          const gradient = ctx.createLinearGradient(x, y + barHeight, x, y);
          if (index % 2) {
            gradient.addColorStop(0, "#000000");
            gradient.addColorStop(1, "#fe5300");
          } else {
            gradient.addColorStop(0, "#000000");
            gradient.addColorStop(0.45, "#ffffff");
            gradient.addColorStop(1, "#ffffff");
          }
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, barWidth, barHeight);
        } else {
          ctx.fillStyle = index % 2 ? "#fe5300" : "#111111";
          ctx.fillRect(x, y, barWidth, barHeight);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - depthX, y - depthY);
          ctx.lineTo(x + barWidth - depthX, y - depthY);
          ctx.lineTo(x + barWidth, y);
          ctx.closePath();
          ctx.fillStyle = index % 2 ? "#ff864e" : "#333333";
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - depthX, y - depthY);
          ctx.lineTo(x - depthX, y + barHeight - depthY);
          ctx.lineTo(x, y + barHeight);
          ctx.closePath();
          ctx.fillStyle = index % 2 ? "#d84c0c" : "#000000";
          ctx.fill();
        }

        if (visibleLabelIndexes.has(index)) {
          ctx.fillStyle = colors.label;
          ctx.font = "11px sans-serif";
          ctx.textAlign = index === labels.length - 1 ? "right" : "center";
          ctx.fillText(label, index === labels.length - 1 ? w - right : x + barWidth / 2, bottom + 14);
        }
        monthlyRegionsRef.current.push({ x, y, w: barWidth, h: barHeight, label, value: values[index] });
      });
    }

    function drawDonut(progress: number) {
      const canvas = restaurantCanvasRef.current;
      if (!canvas) return;
      const setup = setupCanvas(canvas);
      if (!setup) return;

      const { ctx, w, h } = setup;
      const colors = themeColors(theme);
      const values = chartData.restaurantValues;
      const labels = chartData.restaurantLabels;
      const palette = chartData.restaurantColors;
      ctx.clearRect(0, 0, w, h);
      restaurantRegionsRef.current = [];

      const cx = w * 0.3;
      const cy = h * 0.5;
      const radius = Math.max(48, Math.min(82, h * 0.36));
      const thick = Math.max(18, radius * 0.36);
      const inner = radius - thick / 2;
      const outer = radius + thick / 2;
      const sum = values.reduce((acc, value) => acc + value, 0) || 1;
      const single = values.length === 1;
      let start = -Math.PI / 2;

      values.forEach((value, index) => {
        const sweep = (value / sum) * Math.PI * 2 * progress;
        const end = start + sweep;
        const epsilon = 0.0015;
        const segStart = index === 0 ? start : start - epsilon;
        const segEnd = index === values.length - 1 ? end : end + epsilon;
        const gradientRadius = (inner + outer) / 2;
        let fill: string | CanvasGradient = palette[index];
        if (theme === "dark") {
          const gradient = single
            ? ctx.createLinearGradient(cx - outer, cy, cx + outer, cy)
            : ctx.createLinearGradient(
                cx + Math.cos(segStart) * gradientRadius,
                cy + Math.sin(segStart) * gradientRadius,
                cx + Math.cos(segEnd) * gradientRadius,
                cy + Math.sin(segEnd) * gradientRadius
              );
          gradient.addColorStop(0, "#111111");
          gradient.addColorStop(1, single ? "#ff6a2b" : palette[index]);
          fill = gradient;
        }

        ctx.beginPath();
        ctx.arc(cx, cy, outer, segStart, segEnd);
        ctx.arc(cx, cy, inner, segEnd, segStart, true);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        restaurantRegionsRef.current.push({ start, end, value, label: labels[index], cx, cy, inner, outer });
        start = end;
      });

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx.stroke();

      labels.forEach((label, index) => {
        if (theme === "dark" && single) {
          const gradient = ctx.createLinearGradient(w * 0.58, 0, w * 0.58 + 8, 0);
          gradient.addColorStop(0, "#111111");
          gradient.addColorStop(1, "#ff6a2b");
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = palette[index] || "#fe5300";
        }
        ctx.fillRect(w * 0.58, 20 + index * 18, 8, 8);
        if (theme !== "dark") {
          ctx.strokeStyle = "rgba(0,0,0,0.2)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(w * 0.58, 20 + index * 18, 8, 8);
        }
        ctx.fillStyle = colors.donutLabel;
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(label.length > 18 ? `${label.slice(0, 17)}…` : label, w * 0.58 + 13, 27 + index * 18);
      });
    }

    function drawHorizontalBars(progress: number) {
      const canvas = itemCountCanvasRef.current;
      if (!canvas) return;
      const setup = setupCanvas(canvas);
      if (!setup) return;

      const { ctx, w, h } = setup;
      const colors = themeColors(theme);
      const labels = chartData.itemLabels;
      const values = chartData.itemValues;
      const left = 120;
      const right = 16;
      const valueGutter = 44;
      const max = Math.max(...values, 1);
      const rows = Math.max(labels.length, 1);
      const rowHeight = Math.max(14, Math.min(24, (h - 12) / rows));
      const top = Math.max(2, (h - rowHeight * rows) / 2);
      const barArea = w - left - right - valueGutter;
      itemRegionsRef.current = [];
      ctx.clearRect(0, 0, w, h);

      labels.forEach((label, index) => {
        const y = top + index * rowHeight + rowHeight * 0.2;
        const barHeight = rowHeight * 0.6;
        const barWidth = ((barArea * values[index]) / max) * progress;
        if (theme === "dark") {
          if (index % 2 === 0) {
            ctx.fillStyle = "#ffffff";
          } else {
            const gradient = ctx.createLinearGradient(left, y, left + Math.max(1, barWidth), y);
            gradient.addColorStop(0, "#111111");
            gradient.addColorStop(1, "#fe5300");
            ctx.fillStyle = gradient;
          }
        } else {
          ctx.fillStyle = index % 2 ? "#ff5202" : "#111111";
        }
        ctx.fillRect(left, y, barWidth, barHeight);
        ctx.fillStyle = colors.itemLabel;
        ctx.font = "12px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(label.length > 16 ? `${label.slice(0, 15)}…` : label, left - 8, y + barHeight * 0.72);
        ctx.fillStyle = colors.valueLabel;
        ctx.textAlign = "left";
        ctx.fillText(String(values[index]), Math.min(left + barWidth + 6, left + barArea + 6), y + barHeight * 0.72);
        itemRegionsRef.current.push({ x: 0, y: y - 3, w, h: barHeight + 6, label, value: values[index] });
      });
    }

    function drawTrend(progress: number) {
      const canvas = trendCanvasRef.current;
      if (!canvas) return;
      const setup = setupCanvas(canvas);
      if (!setup) return;

      const { ctx, w, h } = setup;
      const colors = themeColors(theme);
      const labels = chartData.trendLabels;
      const values = chartData.trendValues;
      const left = 24;
      const right = 16;
      const chartHeight = Math.max(95, h * 0.74);
      const top = (h - chartHeight) / 2;
      const bottom = top + chartHeight;
      const max = Math.max(...values, 1);
      trendRegionsRef.current = [];
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = colors.axis;
      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(w - right, bottom);
      ctx.stroke();

      const points = labels.map((label, index) => ({
        x: left + (index * (w - left - right)) / Math.max(labels.length - 1, 1),
        y: bottom - ((chartHeight * values[index]) / max) * progress,
        label,
        value: values[index]
      }));
      trendRegionsRef.current = points;

      if (points.length) {
        const gradient = ctx.createLinearGradient(0, top, 0, bottom);
        gradient.addColorStop(0, "rgba(254,83,0,0.34)");
        gradient.addColorStop(1, "rgba(254,83,0,0)");
        ctx.beginPath();
        ctx.moveTo(points[0].x, bottom);
        points.forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points[points.length - 1].x, bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle = "#fe5300";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }

      const step = Math.max(1, Math.ceil(labels.length / 6));
      const visibleIndexes: number[] = [];
      for (let index = 0; index < labels.length; index += step) visibleIndexes.push(index);
      if (!visibleIndexes.includes(labels.length - 1)) visibleIndexes.push(labels.length - 1);
      if (visibleIndexes.length >= 2) {
        const lastIndex = visibleIndexes[visibleIndexes.length - 1];
        const previousIndex = visibleIndexes[visibleIndexes.length - 2];
        const lastX = left + (lastIndex * (w - left - right)) / Math.max(labels.length - 1, 1);
        const previousX = left + (previousIndex * (w - left - right)) / Math.max(labels.length - 1, 1);
        if (lastX - previousX < 74) {
          visibleIndexes.splice(visibleIndexes.length - 2, 1);
        }
      }

      visibleIndexes.forEach((index) => {
        const x = left + (index * (w - left - right)) / Math.max(labels.length - 1, 1);
        ctx.fillStyle = colors.label;
        ctx.font = "11px sans-serif";
        ctx.textAlign = index === 0 ? "left" : index === labels.length - 1 ? "right" : "center";
        ctx.fillText(labels[index], index === labels.length - 1 ? w - right : x, bottom + 14);
      });
    }

    const drawFrame = (progress: number) => {
      drawMonthlyBars(progress);
      drawDonut(progress);
      drawHeatmap(progress);
      drawHorizontalBars(progress);
      drawTrend(progress);
    };

    if (!pageReady) {
      drawFrame(0);
      return;
    }

    if (reducedMotion) {
      drawFrame(1);
      chartAnimationPrimedRef.current = true;
      return;
    }

    let frameId = 0;
    let startTime = 0;
    const duration = chartAnimationPrimedRef.current ? 560 : 920;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const linearProgress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - linearProgress, 3);
      drawFrame(easedProgress);

      if (linearProgress < 1) {
        frameId = window.requestAnimationFrame(animate);
        return;
      }

      chartAnimationPrimedRef.current = true;
    };

    frameId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(frameId);
  }, [chartData, dayFilter, pageReady, reducedMotion, theme]);

  useEffect(() => {
    const canvas = heatmapCanvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;

    const { ctx, w, h } = setup;
    const colors = themeColors(theme);
    const series = chartData.heatmap[dayFilter] || chartData.heatmap.All;
    const max = Math.max(1, ...series);
    const cx = w * 0.5;
    const cy = h * 0.49;
    const innerRadius = Math.max(40, Math.min(w, h) * 0.19);
    const outerRadius = Math.max(innerRadius + 52, Math.min(w, h) * 0.41);
    const step = (Math.PI * 2) / 24;
    const gap = step * 0.08;
    heatmapRegionsRef.current = [];
    ctx.clearRect(0, 0, w, h);

    [0.25, 0.5, 0.75, 1].forEach((tick) => {
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius + (outerRadius - innerRadius) * tick, 0, Math.PI * 2);
      ctx.strokeStyle = theme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 5]);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    for (let hour = 0; hour < 24; hour += 1) {
      const angle = -Math.PI / 2 + hour * step;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * (outerRadius + 8), cy + Math.sin(angle) * (outerRadius + 8));
      ctx.lineTo(cx + Math.cos(angle) * (outerRadius + (hour % 6 === 0 ? 18 : 13)), cy + Math.sin(angle) * (outerRadius + (hour % 6 === 0 ? 18 : 13)));
      ctx.strokeStyle =
        theme === "dark"
          ? hour % 6 === 0
            ? "rgba(255,255,255,0.65)"
            : "rgba(255,255,255,0.24)"
          : hour % 6 === 0
            ? "rgba(0,0,0,0.5)"
            : "rgba(0,0,0,0.22)";
      ctx.lineWidth = hour % 6 === 0 ? 2.4 : 1.2;
      ctx.stroke();
    }

    for (let hour = 0; hour < 24; hour += 1) {
      const value = series[hour] || 0;
      const scale = Math.max(0.08, value / max);
      const start = -Math.PI / 2 + hour * step + gap / 2;
      const end = start + step - gap;
      const outer = innerRadius + (outerRadius - innerRadius) * scale + (hoverHour === hour ? 6 : 0);
      const dark = theme === "dark" ? { r: 16, g: 38, b: 0 } : { r: 243, g: 255, b: 232 };
      const light = theme === "dark" ? { r: 109, g: 255, b: 0 } : { r: 109, g: 255, b: 0 };
      const color = `rgb(${Math.round(dark.r + (light.r - dark.r) * scale)},${Math.round(
        dark.g + (light.g - dark.g) * scale
      )},${Math.round(dark.b + (light.b - dark.b) * scale)})`;

      ctx.beginPath();
      ctx.arc(cx, cy, outer, start, end);
      ctx.arc(cx, cy, innerRadius, end, start, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      heatmapRegionsRef.current.push({ cx, cy, inner: innerRadius, outer, start, end, hour, day: dayFilter, count: value });
    }

    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius - 1, 0, Math.PI * 2);
    ctx.fillStyle = theme === "dark" ? "#000000" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = theme === "dark" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = colors.heatText;
    ctx.textAlign = "center";
    ctx.font = "700 18px sans-serif";
    if (hoverHour !== null) {
      ctx.fillText(`${String(hoverHour).padStart(2, "0")}:00`, cx, cy - 2);
      ctx.font = "600 12px sans-serif";
      ctx.fillText(`${series[hoverHour]} orders`, cx, cy + 16);
    } else {
      ctx.fillText(dayFilter === "All" ? "All Days" : dayFilter, cx, cy - 2);
      ctx.font = "500 8px sans-serif";
      ctx.fillStyle = theme === "dark" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
      ctx.fillText("HOVER TO EXPLORE", cx, cy + 16);
    }

    [
      { hour: 0, label: "0" }, { hour: 3, label: "3" }, { hour: 6, label: "6" }, { hour: 9, label: "9" },
      { hour: 12, label: "12" }, { hour: 15, label: "15" }, { hour: 18, label: "18" }, { hour: 21, label: "21" }
    ].forEach((tick) => {
      const angle = -Math.PI / 2 + tick.hour * step;
      ctx.fillStyle = colors.heatText;
      ctx.font = "10px sans-serif";
      ctx.fillText(tick.label, cx + Math.cos(angle) * (outerRadius + 32), cy + Math.sin(angle) * (outerRadius + 32) + 3);
    });
  }, [chartData, dayFilter, hoverHour, theme]);

  function moveTooltip(event: ReactMouseEvent, text: string) {
    setTooltip({ text, x: event.clientX, y: event.clientY });
  }

  function clearTooltip() {
    setTooltip(null);
  }

  function onMonthlyMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = monthlyCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = monthlyRegionsRef.current.find((bar) => x >= bar.x && x <= bar.x + bar.w && y >= bar.y && y <= bar.y + bar.h);
    if (!hit) return clearTooltip();
    moveTooltip(event, `${hit.label}: ${inr(hit.value)}`);
  }

  function onItemMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = itemCountCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = itemRegionsRef.current.find((bar) => x >= bar.x && x <= bar.x + bar.w && y >= bar.y && y <= bar.y + bar.h);
    if (!hit) return clearTooltip();
    moveTooltip(event, `${hit.label}: ${hit.value}`);
  }

  function onTrendMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = trendCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let bestPoint: PointRegion | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    trendRegionsRef.current.forEach((point) => {
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance < bestDistance) {
        bestPoint = point;
        bestDistance = distance;
      }
    });
    if (!bestPoint || bestDistance > 18) return clearTooltip();
    const point: PointRegion = bestPoint;
    moveTooltip(event, `${point.label}: ${point.value} orders`);
  }

  function onRestaurantMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = restaurantCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    for (const segment of restaurantRegionsRef.current) {
      const dx = x - segment.cx;
      const dy = y - segment.cy;
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius < segment.inner || radius > segment.outer) continue;
      let angle = Math.atan2(dy, dx);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;
      if (angle >= segment.start && angle <= segment.end) {
        moveTooltip(event, `${segment.label}: ${inr(segment.value)}`);
        return;
      }
    }
    clearTooltip();
  }

  function onHeatmapMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = heatmapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = heatmapRegionsRef.current.find((region) => {
      const dx = x - region.cx;
      const dy = y - region.cy;
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius < region.inner || radius > region.outer) return false;
      let angle = Math.atan2(dy, dx);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;
      return angle >= region.start && angle <= region.end;
    });

    if (!hit) {
      clearTooltip();
      if (hoverHour !== null) setHoverHour(null);
      return;
    }

    if (hoverHour !== hit.hour) setHoverHour(hit.hour);
    moveTooltip(
      event,
      `${hit.day} ${String(hit.hour).padStart(2, "0")}:00-${String((hit.hour + 1) % 24).padStart(2, "0")}:00 • ${hit.count} orders`
    );
  }

  function onHeatmapLeave() {
    setHoverHour(null);
    clearTooltip();
  }

  function onCuisineMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = cuisineCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best: CuisineRadarPoint | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const point of cuisineRegionsRef.current) {
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    if (!best || bestDistance > 18) {
      clearTooltip();
      return;
    }
    moveTooltip(event, `${best.cuisine}: ${inr(best.spend)} (${best.pct}%)`);
  }

  function openDayDetails(cell: CalendarSummary["weeks"][number][number]) {
    const dayOrders = ordersByDay.get(cell.key) || [];
    if (!dayOrders.length) {
      return;
    }

    setDayDetails({
      key: cell.key,
      label: cell.label,
      orders: dayOrders,
      total: dayOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0)
    });
  }

  function onDragStart(card: CardKey) {
    setDraggedCard(card);
  }

  function onDrop(event: DragEvent<HTMLElement>, target: CardKey) {
    event.preventDefault();
    if (!draggedCard || draggedCard === target) {
      setDragOverCard(null);
      return;
    }

    setCardOrder((current) => {
      const next = current.filter((key) => key !== draggedCard);
      next.splice(next.indexOf(target), 0, draggedCard);
      return next;
    });
    setDraggedCard(null);
    setDragOverCard(null);
  }

  function stageStyle(delay: number): CSSProperties {
    return { "--stage-delay": `${delay}ms` } as CSSProperties;
  }

  function renderPanel(card: CardKey) {
    const dragProps = {
      draggable: true,
      onDragStart: () => onDragStart(card),
      onDragEnd: () => {
        setDraggedCard(null);
        setDragOverCard(null);
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDragOverCard(card);
      },
      onDrop: (event: DragEvent<HTMLElement>) => onDrop(event, card)
    };

    switch (card) {
      case "monthly-spend":
        return (
          <article
            key={card}
            className={`panel viz-panel stage-item ${dragOverCard === card ? "drag-over" : ""}`}
            style={stageStyle(0)}
            {...dragProps}
          >
            <div className="panel-heading">
              <h3>Monthly Spend</h3>
              {renderChartInsightButton("monthlySpend", "Monthly Spend")}
            </div>
            <p className="panel-note">{chartData.monthlyChartNote}</p>
            <canvas ref={monthlyCanvasRef} onMouseMove={onMonthlyMove} onMouseLeave={clearTooltip} />
          </article>
        );
      case "spend-by-restaurant":
        return (
          <article
            key={card}
            className={`panel viz-panel stage-item ${dragOverCard === card ? "drag-over" : ""}`}
            style={stageStyle(70)}
            {...dragProps}
          >
            <div className="panel-heading">
              <h3>Spend by Restaurant</h3>
              {renderChartInsightButton("spendByRestaurant", "Spend by Restaurant")}
            </div>
            <canvas ref={restaurantCanvasRef} onMouseMove={onRestaurantMove} onMouseLeave={clearTooltip} />
          </article>
        );
      case "busiest-days-times":
        return (
          <article
            key={card}
            className={`panel heatmap-panel viz-panel stage-item ${dragOverCard === card ? "drag-over" : ""}`}
            style={stageStyle(140)}
            {...dragProps}
          >
            <div className="heatmap-header">
              <div className="panel-heading">
                <h3>Busiest Ordering Days/Times</h3>
                {renderChartInsightButton("busiestOrdering", "Busiest Ordering Days/Times", busiestOrderingInsight)}
              </div>
              <select
                className="radial-day-select"
                value={dayFilter}
                onChange={(event) => {
                  setDayFilter(event.target.value as DayFilter);
                  setHoverHour(null);
                }}
              >
                {DAY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <canvas ref={heatmapCanvasRef} onMouseMove={onHeatmapMove} onMouseLeave={onHeatmapLeave} />
          </article>
        );
      case "food-item-count":
        return (
          <article
            key={card}
            className={`panel viz-panel panel-with-action stage-item ${dragOverCard === card ? "drag-over" : ""}`}
            style={stageStyle(210)}
            {...dragProps}
          >
            <div className="panel-heading">
              <h3>Food Item Count</h3>
              {renderChartInsightButton("foodItemCount", "Food Item Count")}
            </div>
            <canvas ref={itemCountCanvasRef} onMouseMove={onItemMove} onMouseLeave={clearTooltip} />
            {allItemEntries.length > 7 ? (
              <button className="panel-link-button" type="button" onClick={() => setItemDetails({ items: allItemEntries })}>
                <span>Show more</span>
              </button>
            ) : null}
          </article>
        );
      case "activity-streak":
        return (
          <article
            key={card}
            className={`panel activity-panel viz-panel stage-item ${dragOverCard === card ? "drag-over" : ""}`}
            style={stageStyle(280)}
            {...dragProps}
          >
            <div className="panel-heading">
              <h3>Order Activity &amp; Streak</h3>
              {renderChartInsightButton("activityStreak", "Order Activity & Streak")}
            </div>
            <div className="calendar-layout">
              <div className="weekday-labels">
                {["", "Mon", "", "Wed", "", "Fri", ""].map((label, index) => (
                  <div key={`${label}-${index}`} className="weekday-label">
                    {label}
                  </div>
                ))}
              </div>
              <div className="calendar-shell">
                <div className="month-labels" style={{ width: `${Math.max(calendar.weeks.length, 1) * 16}px` }}>
                  {visibleMonthLabels.map((label) => (
                    <span key={`${label.label}-${label.left}`} className="month-label-el" style={{ left: `${label.left}px` }}>
                      {label.label}
                    </span>
                  ))}
                </div>
                <div className="calendar-week-grid" style={{ width: `${Math.max(calendar.weeks.length, 1) * 16}px` }}>
                  {calendar.weeks.map((week, index) => (
                    <div key={`week-${index}`} className="week-col">
                      {week.map((cell) => (
                        <div
                          key={cell.key}
                          className={`day-cell lvl-${cell.level} cell-enter`}
                          style={{ animationDelay: `${Math.min(index * 8, 220)}ms` }}
                          onMouseMove={(event) => moveTooltip(event, cell.label)}
                          onMouseLeave={clearTooltip}
                          onClick={() => openDayDetails(cell)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="calendar-insight">{calendar.insight}</p>
            <div className="calendar-footer">
              <div className="legend">
                <span>Less</span>
                <div className="legend-cells"><span className="lg l0" /><span className="lg l1" /><span className="lg l2" /><span className="lg l3" /><span className="lg l4" /></div>
                <span>More</span>
              </div>
              <div className="stats-row">
                <div className="stat"><strong>{calendar.totalOrderDays}</strong><small>Days Ordered</small></div>
                <div className="stat"><strong>{calendar.longestStreak}d</strong><small>Longest Streak</small></div>
                <div className="stat"><strong>{calendar.currentStreak}d</strong><small>Current Streak</small></div>
              </div>
            </div>
          </article>
        );
      case "order-trend":
        return (
          <article
            key={card}
            className={`panel viz-panel stage-item ${dragOverCard === card ? "drag-over" : ""}`}
            style={stageStyle(350)}
            {...dragProps}
          >
            <div className="panel-heading">
              <h3>Order Trend</h3>
              {renderChartInsightButton("orderTrend", "Order Trend")}
            </div>
            <canvas ref={trendCanvasRef} onMouseMove={onTrendMove} onMouseLeave={clearTooltip} />
          </article>
        );
      case "milestones":
        return (
          <article
            key={card}
            className={`panel milestones-panel panel-span-2 viz-panel stage-item ${dragOverCard === card ? "drag-over" : ""}`}
            style={stageStyle(420)}
            {...dragProps}
          >
            <div className="panel-heading">
              <h3>Milestones</h3>
            </div>
            <div className="milestones-scroll">
              <div className="milestones-track">
                {milestones.length ? milestones.map((milestone, index) => (
                  <div key={`${milestone.title}-${milestone.badge}-${index}`} className="milestone-item">
                    <div className="milestone-dot-wrap">
                      <div className={`milestone-dot tier-${milestone.tier}`} />
                    </div>
                    <div className="milestone-body">
                      <div className="milestone-emoji">{milestone.icon}</div>
                      <p className="milestone-title">{milestone.title}</p>
                      <p className="milestone-meta">{milestone.desc}</p>
                      {milestone.date ? <p className="milestone-date">{milestone.date}</p> : null}
                      <span className="milestone-badge">{milestone.badge}</span>
                    </div>
                  </div>
                )) : (
                  <p className="milestones-empty">No milestones yet.</p>
                )}
              </div>
            </div>
          </article>
        );
      case "cuisine-radar":
        return (
          <article
            key={card}
            className={`panel viz-panel stage-item ${dragOverCard === card ? "drag-over" : ""}`}
            style={stageStyle(490)}
            {...dragProps}
          >
            <div className="panel-heading">
              <h3>Cuisine Radar</h3>
            </div>
            <canvas ref={cuisineCanvasRef} onMouseMove={onCuisineMove} onMouseLeave={clearTooltip} />
          </article>
        );
    }
  }

  const primaryCards = cardOrder.filter((card) => card !== "milestones" && card !== "cuisine-radar");

  return (
    <>
      <section className="grid" aria-label="Dashboard charts">
        {primaryCards.map((card) => renderPanel(card))}
      </section>

      {tooltip ? (() => {
        const tooltipWidth = tooltipRef.current?.offsetWidth ?? 220;
        const tooltipHeight = tooltipRef.current?.offsetHeight ?? 34;
        const viewportWidth = typeof window !== "undefined" ? window.innerWidth : tooltip.x + tooltipWidth + 24;
        const viewportHeight = typeof window !== "undefined" ? window.innerHeight : tooltip.y + tooltipHeight + 24;
        const left = Math.max(12, Math.min(tooltip.x + 12, viewportWidth - tooltipWidth - 12));
        const top = Math.max(12, Math.min(tooltip.y - 24, viewportHeight - tooltipHeight - 12));

        return (
          <div ref={tooltipRef} className="chart-tooltip" style={{ left, top }}>
            {tooltip.text}
          </div>
        );
      })() : null}

      {dayDetails ? (
        <div className="day-modal-backdrop" onClick={() => setDayDetails(null)}>
          <div
            className="day-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-modal-title"
          >
            <div className="day-modal-header">
              <div>
                <h4 id="day-modal-title">Order Details</h4>
                <p>{dayDetails.label}</p>
              </div>
              <button className="day-modal-close" type="button" onClick={() => setDayDetails(null)} aria-label="Close order details">
                x
              </button>
            </div>
            <div className="day-modal-summary">
              <span>{dayDetails.orders.length} order{dayDetails.orders.length === 1 ? "" : "s"}</span>
              <strong>{inr(dayDetails.total)}</strong>
            </div>
            <div className="day-modal-list">
              {dayDetails.orders.map((order, index) => {
                const date = order.dateISO ? new Date(order.dateISO) : null;
                return (
                  <article key={`${order.orderId ?? order.dateISO ?? "order"}-${index}`} className="day-order-card">
                    <div className="day-order-top">
                      <strong>{cleanRestaurant(order.restaurant)}</strong>
                      <span>{inr(Number(order.amount) || 0)}</span>
                    </div>
                    <div className="day-order-meta">
                      <span>{date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "Unknown time"}</span>
                      <span>{order.status}</span>
                      {order.orderId ? <span>#{order.orderId}</span> : null}
                    </div>
                    {order.items.length ? <p>{order.items.join(", ")}</p> : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {itemDetails ? (
        <div className="day-modal-backdrop" onClick={() => setItemDetails(null)}>
          <div
            className="day-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-modal-title"
          >
            <div className="day-modal-header">
              <div>
                <h4 id="item-modal-title">Food Item Count</h4>
                <p>Full ranked list of ordered items</p>
              </div>
              <button className="day-modal-close" type="button" onClick={() => setItemDetails(null)} aria-label="Close food item list">
                x
              </button>
            </div>
            <div className="day-modal-list">
              {itemDetails.items.map(([name, value], index) => (
                <article key={`${name}-${index}`} className="day-order-card">
                  <div className="day-order-top">
                    <strong>{name}</strong>
                    <span>{value}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function DashboardExtraPanels({ orders, theme }: { orders: Order[]; theme: ThemeMode }) {
  const cuisineCanvasRef = useRef<HTMLCanvasElement>(null);
  const cuisineRegionsRef = useRef<CuisineRadarPoint[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const cuisineRadarData = useMemo(() => {
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
    ];

    function inferCuisine(order: Order) {
      const restaurant = cleanRestaurant(order.restaurant || "").toLowerCase().trim();
      for (const [needle, cuisine] of Object.entries(restaurantCuisineMap)) {
        if (restaurant.includes(needle)) {
          return cuisine;
        }
      }

      for (const line of order.items || []) {
        for (const rule of itemCuisineRules) {
          if (rule.re.test(line)) {
            return rule.cat;
          }
        }
      }

      return "Other";
    }

    const spendByCuisine = new Map<string, number>();
    for (const order of orders) {
      const cuisine = inferCuisine(order);
      spendByCuisine.set(cuisine, (spendByCuisine.get(cuisine) || 0) + (Number(order.amount) || 0));
    }

    const totalSpend = [...spendByCuisine.values()].reduce((sum, value) => sum + value, 0);
    return [...spendByCuisine.entries()]
      .map(([cuisine, spend]) => ({
        cuisine,
        spend,
        pct: totalSpend ? Math.round((spend / totalSpend) * 100) : 0
      }))
      .filter((entry) => entry.spend > 0)
      .sort((left, right) => right.spend - left.spend)
      .slice(0, 8);
  }, [orders]);

  const milestones = useMemo(() => {
    if (!orders.length) {
      return [] as Milestone[];
    }

    const sorted = [...orders]
      .filter((order) => order.dateISO)
      .sort((left, right) => new Date(left.dateISO as string).getTime() - new Date(right.dateISO as string).getTime());

    const fmtDate = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

    const output: Milestone[] = [];

    if (sorted[0]) {
      output.push({
        tier: 1,
        icon: "🚀",
        title: "First Order",
        desc: cleanRestaurant(sorted[0].restaurant || "?"),
        date: fmtDate(sorted[0].dateISO),
        badge: "FIRST"
      });
    }

    for (const count of [10, 25, 50, 100, 150, 200, 300, 500]) {
      if (sorted.length >= count) {
        const order = sorted[count - 1];
        output.push({
          tier: count >= 100 ? 1 : 2,
          icon: "📦",
          title: `${count}th Order`,
          desc: cleanRestaurant(order.restaurant || "?"),
          date: fmtDate(order.dateISO),
          badge: `#${count}`
        });
      }
    }

    let runningSpend = 0;
    for (const order of sorted) {
      const previous = runningSpend;
      runningSpend += Number(order.amount) || 0;
      for (const threshold of [1000, 5000, 10000, 25000, 50000]) {
        if (previous < threshold && runningSpend >= threshold) {
          output.push({
            tier: threshold >= 25000 ? 1 : 2,
            icon: "💰",
            title: `₹${threshold >= 1000 ? `${threshold / 1000}K` : threshold} Spent`,
            desc: `at ${cleanRestaurant(order.restaurant || "?")}`,
            date: fmtDate(order.dateISO),
            badge: "SPEND"
          });
        }
      }
    }

    const biggestOrder = sorted.reduce(
      (best, current) => ((Number(current.amount) || 0) > (Number(best.amount) || 0) ? current : best),
      sorted[0]
    );
    if (biggestOrder) {
      output.push({
        tier: 1,
        icon: "🔥",
        title: "Biggest Order",
        desc: `${inr(Number(biggestOrder.amount) || 0)} at ${cleanRestaurant(biggestOrder.restaurant || "?")}`,
        date: fmtDate(biggestOrder.dateISO),
        badge: "RECORD"
      });
    }

    const restCounts = new Map<string, number>();
    for (const order of orders) {
      const name = cleanRestaurant(order.restaurant || "?");
      restCounts.set(name, (restCounts.get(name) || 0) + 1);
    }
    const loyal = [...restCounts.entries()].sort((left, right) => right[1] - left[1])[0];
    if (loyal && loyal[1] >= 5) {
      output.push({
        tier: 2,
        icon: "❤️",
        title: "Most Loyal",
        desc: `${loyal[0]} · ${loyal[1]} orders`,
        date: "",
        badge: "FAVE"
      });
    }

    return output.sort((left, right) => left.tier - right.tier);
  }, [orders]);

  useEffect(() => {
    const canvas = cuisineCanvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;

    const { ctx, w, h } = setup;
    const dark = theme === "dark";
    const accent = dark ? "#39d353" : "#ff6a2b";
    const accentFill = dark ? "rgba(57,211,83,0.16)" : "rgba(255,106,43,0.15)";
    const gridColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
    const axisColor = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)";
    const labelColor = dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.58)";

    cuisineRegionsRef.current = [];
    ctx.clearRect(0, 0, w, h);

    const items = cuisineRadarData;
    const count = items.length;
    if (!count) {
      ctx.fillStyle = themeColors(theme).label;
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No cuisine data", w / 2, h / 2);
      return;
    }

    const pad = Math.max(36, Math.min(52, w * 0.14));
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) - pad;
    const maxSpend = Math.max(...items.map((item) => item.spend), 1);

    for (let level = 1; level <= 4; level += 1) {
      const r = (maxR / 4) * level;
      ctx.beginPath();
      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const points: CuisineRadarPoint[] = [];
    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      const ex = cx + Math.cos(angle) * maxR;
      const ey = cy + Math.sin(angle) * maxR;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      const scale = items[i].spend / maxSpend;
      const x = cx + Math.cos(angle) * maxR * scale;
      const y = cy + Math.sin(angle) * maxR * scale;
      points.push({ x, y, cuisine: items[i].cuisine, spend: items[i].spend, pct: items[i].pct });
    }

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = accentFill;
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    points.forEach((point, index) => {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#000000" : "#ffffff";
      ctx.fill();

      const lx = cx + Math.cos(angle) * (maxR + 14);
      const ly = cy + Math.sin(angle) * (maxR + 14);
      const cos = Math.cos(angle);
      ctx.textAlign = cos > 0.3 ? "left" : cos < -0.3 ? "right" : "center";
      const textY = Math.sin(angle) > 0.1 ? ly + 11 : Math.sin(angle) < -0.1 ? ly - 4 : ly + 4;

      ctx.font = "600 10px sans-serif";
      ctx.fillStyle = labelColor;
      ctx.fillText(point.cuisine, lx, textY);
      ctx.font = "700 10px sans-serif";
      ctx.fillStyle = accent;
      ctx.fillText(`${point.pct}%`, lx, textY + 13);
    });

    cuisineRegionsRef.current = points;
  }, [cuisineRadarData, theme]);

  function moveTooltip(event: ReactMouseEvent, text: string) {
    setTooltip({ text, x: event.clientX, y: event.clientY });
  }

  function clearTooltip() {
    setTooltip(null);
  }

  function onCuisineMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = cuisineCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best: CuisineRadarPoint | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const point of cuisineRegionsRef.current) {
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    if (!best || bestDistance > 18) {
      clearTooltip();
      return;
    }
    moveTooltip(event, `${best.cuisine}: ${inr(best.spend)} (${best.pct}%)`);
  }

  return (
    <>
      <section className="dashboard-secondary-section" aria-label="Extended dashboard visuals">
        <div className="dashboard-secondary-inner">
          <div className="grid-extra">
            <article className="panel milestones-panel panel-span-2">
              <div className="panel-heading">
                <h3>Milestones</h3>
              </div>
              <div className="milestones-scroll">
                <div className="milestones-track">
                  {milestones.length ? milestones.map((milestone, index) => (
                    <div key={`${milestone.title}-${milestone.badge}-${index}`} className="milestone-item">
                      <div className="milestone-dot-wrap">
                        <div className={`milestone-dot tier-${milestone.tier}`} />
                      </div>
                      <div className="milestone-body">
                        <div className="milestone-emoji">{milestone.icon}</div>
                        <p className="milestone-title">{milestone.title}</p>
                        <p className="milestone-meta">{milestone.desc}</p>
                        {milestone.date ? <p className="milestone-date">{milestone.date}</p> : null}
                        <span className="milestone-badge">{milestone.badge}</span>
                      </div>
                    </div>
                  )) : (
                    <p className="milestones-empty">No milestones yet.</p>
                  )}
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <h3>Cuisine Radar</h3>
              </div>
              <canvas ref={cuisineCanvasRef} onMouseMove={onCuisineMove} onMouseLeave={clearTooltip} />
            </article>
          </div>
        </div>
      </section>

      {tooltip ? (() => {
        const tooltipWidth = tooltipRef.current?.offsetWidth ?? 220;
        const tooltipHeight = tooltipRef.current?.offsetHeight ?? 34;
        const viewportWidth = typeof window !== "undefined" ? window.innerWidth : tooltip.x + tooltipWidth + 24;
        const viewportHeight = typeof window !== "undefined" ? window.innerHeight : tooltip.y + tooltipHeight + 24;
        const left = Math.max(12, Math.min(tooltip.x + 12, viewportWidth - tooltipWidth - 12));
        const top = Math.max(12, Math.min(tooltip.y - 24, viewportHeight - tooltipHeight - 12));

        return (
          <div ref={tooltipRef} className="chart-tooltip" style={{ left, top }}>
            {tooltip.text}
          </div>
        );
      })() : null}
    </>
  );
}
