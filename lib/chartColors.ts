/**
 * Single source of truth for chart/series colors (Recharts can't read Tailwind
 * classes). Keep in sync with the `colors` block in tailwind.config.ts.
 */
export const C = {
  // brand
  coros: "#ff5a1f",
  coros400: "#ff7a47",
  coros600: "#d93c06",

  // recovery semaphore
  high: "#18c29c",
  mid: "#ffb020",
  low: "#ff4d5e",

  // metrics
  strain: "#33b1ff",
  fitness: "#18c29c",
  fatigue: "#ffb020",
  form: "#8b6dff",

  // sleep stage ramp
  deep: "#3730a3",
  rem: "#7c6bff",
  light: "#b3a6ff",
  awake: "#3a3f52",
  sleep: "#8b6dff",

  // training-load intensity ramp (dark → bright orange)
  loadLow: "#8a5a2b",
  loadMed: "#e8480f",
  loadHigh: "#ff7a47",

  // chart chrome
  grid: "#1e212a",
  axis: "#5e6675",
  tooltipBg: "#131419",
  tooltipBorder: "#2a2e38",
} as const;

export const tooltipStyle = {
  contentStyle: {
    background: C.tooltipBg,
    border: `1px solid ${C.tooltipBorder}`,
    borderRadius: 10,
    fontSize: 12,
  },
  labelStyle: { color: "#9aa3b2" },
  itemStyle: { color: "#eceff4" },
} as const;
