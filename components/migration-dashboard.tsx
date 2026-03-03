"use client";

import { ChangeEvent, CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  clearStoredDashboardData,
  computeDashboardSnapshot,
  getStoredOrders,
  getStoredProfile,
  getStoredTheme,
  importOrdersFromCsvText,
  Order,
  Profile,
  setStoredOrders,
  setStoredProfile,
  setStoredTheme
} from "@/lib/dashboard-data";
import { DashboardChartGrid, DashboardExtraPanels } from "@/components/dashboard-chart-grid";
import { computeChartData, KPI_ORDER, orderYear, ThemeMode } from "@/lib/dashboard-view";
import {
  computeLocalChartInsights,
  computeInsightAggregates,
  computeLocalKpiInsights,
  KpiInsightKey,
  KpiInsightPack
} from "@/lib/kpi-insights";

type ViewTransition = {
  finished: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransition;
};

function ProfileMeta({ name, phone }: { name: string; phone: string }) {
  if (!name && !phone) {
    return null;
  }

  return (
    <span className="profile-meta">
      {name ? (
        <span className="profile-chip">
          <svg className="profile-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="8" r="4" />
          </svg>
          <span>{name}</span>
        </span>
      ) : null}
      {phone ? (
        <span className="profile-chip">
          <svg className="profile-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.6a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.48-1.29a2 2 0 0 1 2.11-.45c.83.3 1.7.51 2.6.63A2 2 0 0 1 22 16.92z" />
          </svg>
          <span>{phone}</span>
        </span>
      ) : null}
    </span>
  );
}

export function MigrationDashboard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Profile>({ name: "", phone: "" });
  const [selectedYear, setSelectedYear] = useState("all");
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.dataset.theme === "light" ? "light" : "dark";
    }
    return "dark";
  });
  const [themeReady, setThemeReady] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeInsight, setActiveInsight] = useState<KpiInsightKey | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [themeSwitching, setThemeSwitching] = useState(false);
  const themeSwitchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    return () => {
      if (themeSwitchTimeoutRef.current !== null) {
        window.clearTimeout(themeSwitchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const delay = prefersReducedMotion ? 0 : 760;
    const timeoutId = window.setTimeout(() => setPageReady(true), delay);

    return () => window.clearTimeout(timeoutId);
  }, [prefersReducedMotion]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    if (themeReady) {
      setStoredTheme(theme);
      document.cookie = `swiggy_theme_v1=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [theme, themeReady]);

  useEffect(() => {
    const onStorage = () => {
      const nextOrders = getStoredOrders();
      setOrders(nextOrders);
      setProfile(getStoredProfile());
      setTheme(getStoredTheme() === "light" ? "light" : "dark");
      setThemeReady(true);
      setStatusText(
        nextOrders.length ? "" : "Upload your Swiggy orders CSV to see insights."
      );
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".settings-wrap")) {
        return;
      }
      if (!target?.closest(".kpi-insight")) {
        setActiveInsight(null);
      }
      setMenuOpen(false);
    }

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  useEffect(() => {
    const nextOrders = getStoredOrders();
    setOrders(nextOrders);
    setProfile(getStoredProfile());
    setTheme(getStoredTheme() === "light" ? "light" : "dark");
    setThemeReady(true);
    setStatusText(
      nextOrders.length ? "" : "Upload your Swiggy orders CSV to see insights."
    );
  }, []);

  const snapshot = useMemo(
    () => computeDashboardSnapshot(orders, profile, selectedYear),
    [orders, profile, selectedYear]
  );

  useEffect(() => {
    setSelectedYear(snapshot.selectedYear);
  }, [snapshot.selectedYear]);

  const filteredOrders = useMemo(
    () =>
      snapshot.selectedYear === "all"
        ? orders
        : orders.filter((order) => orderYear(order.dateISO) === snapshot.selectedYear),
    [orders, snapshot.selectedYear]
  );

  const chartData = useMemo(
    () => computeChartData(filteredOrders, snapshot.selectedYear, theme),
    [filteredOrders, snapshot.selectedYear, theme]
  );
  const insightAggregates = useMemo(
    () => computeInsightAggregates(filteredOrders, snapshot.selectedYear),
    [filteredOrders, snapshot.selectedYear]
  );
  const localInsights = useMemo(
    () => computeLocalKpiInsights(insightAggregates),
    [insightAggregates]
  );
  const localChartInsights = useMemo(
    () => computeLocalChartInsights(insightAggregates),
    [insightAggregates]
  );
  const insightPack = localInsights;
  const chartInsightPack = localChartInsights;

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setStatusText("Importing...");
    try {
      const text = await file.text();
      const imported = importOrdersFromCsvText(text);
      setStoredOrders(imported.orders);
      setStoredProfile(imported.profile);
      setOrders(imported.orders);
      setProfile(imported.profile);
      setStatusText("");
      setSelectedYear("all");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Import failed.");
    } finally {
      event.target.value = "";
    }
  }

  function openFilePicker() {
    setMenuOpen(false);
    fileInputRef.current?.click();
  }

  function clearData() {
    setMenuOpen(false);
    clearStoredDashboardData();
    setOrders([]);
    setProfile({ name: "", phone: "" });
    setSelectedYear("all");
    setStatusText("Upload your Swiggy orders CSV to see insights.");
  }

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    const transitionDocument = document as ViewTransitionDocument;

    if (themeSwitchTimeoutRef.current !== null) {
      window.clearTimeout(themeSwitchTimeoutRef.current);
    }

    const finishTransition = () => {
      themeSwitchTimeoutRef.current = window.setTimeout(() => {
        setThemeSwitching(false);
        themeSwitchTimeoutRef.current = null;
      }, prefersReducedMotion ? 0 : 220);
    };

    setThemeSwitching(true);

    if (!prefersReducedMotion && transitionDocument.startViewTransition) {
      const transition = transitionDocument.startViewTransition(() => {
        flushSync(() => {
          setTheme(nextTheme);
        });
      });

      transition.finished.finally(() => finishTransition());
      return;
    }

    setTheme(nextTheme);
    finishTransition();
  }

  function stageStyle(delay: number): CSSProperties {
    return { "--stage-delay": `${delay}ms` } as CSSProperties;
  }

  return (
    <>
      <main
        className={`migration-shell ${pageReady ? "is-ready" : "is-booting"} ${
          themeSwitching ? "theme-switching" : ""
        }`}
        aria-busy={!pageReady}
      >
        <div className={`page-loader ${pageReady ? "is-hidden" : "is-visible"}`} aria-hidden={pageReady}>
          <div className="page-loader-panel">
            <div className="page-loader-mark" />
            <p className="page-loader-kicker">Expense Intelligence</p>
            <strong>Loading your dashboard</strong>
            <span className="page-loader-copy">Preparing insights, charts, and activity patterns.</span>
            <div className="page-loader-bar">
              <span />
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
        />

        <header className="migration-header">
          <div className="stage-item" style={stageStyle(120)}>
            <p className="eyebrow">Expense Intelligence</p>
            <h1>Swiggy Spending Dashboard</h1>
            <p className="lede">{statusText}</p>
          </div>

          <div className="header-controls stage-item" style={stageStyle(220)}>
            <ProfileMeta name={snapshot.profile.name} phone={snapshot.profile.phone} />

            <button className="icon-button theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle theme">
              <svg className="theme-icon sun" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
              </svg>
              <svg className="theme-icon moon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8z" />
              </svg>
            </button>
            <div className="settings-wrap">
              <button
                className="icon-button settings-button"
                type="button"
                aria-label="Open settings menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
              >
                <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.54V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.95 4.6a1.7 1.7 0 0 0 1-1.54V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.63.8 1.04 1.46 1.04H21a2 2 0 0 1 0 4h-.14c-.66 0-1.26.41-1.46 1.04z" />
                </svg>
              </button>
              <div className={`settings-menu ${menuOpen ? "open" : ""}`} role="menu">
                <button className="settings-item" type="button" role="menuitem" onClick={openFilePicker}>
                  Upload CSV
                </button>
                <button className="settings-item" type="button" role="menuitem" onClick={clearData}>
                  Clear Data
                </button>
              </div>
            </div>
            <select
              className="year-select"
              aria-label="Filter dashboard by year"
              value={snapshot.selectedYear}
              onChange={(event) => setSelectedYear(event.target.value || "all")}
            >
              <option value="all">All Time</option>
              {snapshot.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="kpi-grid" aria-label="Key metrics">
          {KPI_ORDER.map((key, index) => {
            const card = snapshot.kpis[key];
            const insight = insightPack[key];
            const isOpen = activeInsight === key;
            return (
              <article
                className={`kpi-card stage-item ${isOpen ? "insight-open" : ""}`}
                key={key}
                style={stageStyle(300 + index * 70)}
              >
                <div className="kpi-card-top">
                  <h2>{card.value}</h2>
                  <div
                    className="kpi-insight"
                    onMouseEnter={() => setActiveInsight(key)}
                    onMouseLeave={() => setActiveInsight((value) => (value === key ? null : value))}
                  >
                    <button
                      className="kpi-insight-button"
                      type="button"
                      aria-label={`Show insights for ${card.label}`}
                      aria-expanded={isOpen}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveInsight((value) => (value === key ? null : key));
                      }}
                      onFocus={() => setActiveInsight(key)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 10v6" />
                        <circle cx="12" cy="7" r="0.9" fill="currentColor" stroke="none" />
                      </svg>
                    </button>

                    <div className={`kpi-insight-popover ${isOpen ? "open" : ""}`} role="tooltip">
                      <div className="kpi-insight-popover-inner">
                        <strong>{card.label}</strong>
                        <ul className="kpi-insight-list">
                          {insight.bullets.slice(0, 3).map((bullet, index) => (
                            <li key={`${key}-${index}`}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <p>{card.label}</p>
                <small className={card.delta ? "kpi-meta has-delta" : "kpi-meta"}>
                  <span className="kpi-meta-text">{card.meta}</span>
                  {card.delta ? <span className={`kpi-delta ${card.delta.cls}`}>{card.delta.txt}</span> : null}
                </small>
              </article>
            );
          })}
        </section>

        <DashboardChartGrid
          orders={filteredOrders}
          selectedYear={snapshot.selectedYear}
          theme={theme}
          chartData={chartData}
          chartInsights={chartInsightPack}
          pageReady={pageReady}
          reducedMotion={prefersReducedMotion}
        />
      </main>

      {pageReady ? <DashboardExtraPanels orders={filteredOrders} theme={theme} /> : null}
    </>
  );
}
