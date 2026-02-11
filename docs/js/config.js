/**
 * Configuration file - Single source of truth for all constants
 * @module config
 */

export const CONFIG = {
  api: {
    onemap: {
      baseUrl: "https://www.onemap.gov.sg/api",
      tokenKey: "onemap_token",
      tokenExpiryKey: "onemap_token_expiry",
    },
  },

  defaults: {
    petrolPrice: 2.87,
    pickupWaitMinutes: 6,
    averageSpeedKmH: 25, // Fallback if API fails
  },

  limits: {
    maxStops: 10,
    minFare: 0,
    maxFare: 500,
  },

  traffic: {
    conditions: {
      light: { label: "Light Traffic", speedKmH: 35, icon: "🟢" },
      normal: { label: "Normal Traffic", speedKmH: 25, icon: "🟡" },
      heavy: { label: "Heavy Traffic", speedKmH: 15, icon: "🔴" },
    },
    // Singapore time (UTC+8) peak hours
    peakHours: {
      morning: { start: 7, end: 10 }, // 7am-10am
      evening: { start: 17, end: 20 }, // 5pm-8pm
    },
    // Moderate traffic hours
    moderateHours: {
      midday: { start: 11, end: 14 }, // 11am-2pm (lunch)
      afternoon: { start: 14, end: 17 }, // 2pm-5pm
    },
  },
};

/**
 * Motorcycle models with fuel efficiency (km/L)
 * Curated list of popular delivery bikes in Singapore
 */
export const BIKE_MODELS = [
  { id: "ybr125", name: "Yamaha YBR125", efficiency: 45 },
  { id: "wave125", name: "Honda Wave 125", efficiency: 50 },
  { id: "cb125f", name: "Honda CB125F", efficiency: 47 },
  { id: "pcx160", name: "Honda PCX160", efficiency: 40 },
  { id: "nmax155", name: "Yamaha NMAX 155", efficiency: 38 },
  { id: "y15zr", name: "Yamaha Y15ZR", efficiency: 40 },
  { id: "raider150", name: "Suzuki Raider 150", efficiency: 38 },
  { id: "cbf150", name: "Honda CBF150", efficiency: 40 },
  { id: "kriss110", name: "Modenas Kriss 110", efficiency: 55 },
  { id: "ex5", name: "Honda EX5", efficiency: 55 },
  { id: "custom", name: "Custom / Other", efficiency: null },
];

/**
 * Wait time estimates by building type (in minutes)
 * Based on typical Singapore delivery experience:
 * - HDB: Usually meet at void deck, quick handover
 * - Condo: Security checkpoint, intercom, lift wait
 * - Office: Reception, lift, floor navigation
 * - Mall: Finding the shop, navigating crowds
 */
export const WAIT_TIMES = {
  hdb: {
    minutes: 3,
    label: "HDB",
    description: "Meet at void deck",
  },
  condo: {
    minutes: 7,
    label: "Condo",
    description: "Security + lift wait",
  },
  office: {
    minutes: 10,
    label: "Office",
    description: "Reception + lift + navigation",
  },
  mall: {
    minutes: 8,
    label: "Mall",
    description: "Navigate to unit",
  },
  landed: {
    minutes: 2,
    label: "Landed",
    description: "Direct handover",
  },
  industrial: {
    minutes: 5,
    label: "Industrial",
    description: "Loading bay access",
  },
  default: {
    minutes: 5,
    label: "Unknown",
    description: "Default estimate",
  },
};

/**
 * Links to check current petrol prices in Singapore
 */
export const PETROL_LINKS = [
  { name: "SPC", url: "https://www.spc.com.sg/" },
  { name: "Shell", url: "https://www.shell.com.sg/" },
  { name: "Esso", url: "https://www.esso.com.sg/" },
  { name: "Caltex", url: "https://www.caltex.com/sg/" },
  { name: "Sinopec", url: "https://www.sinopec.com.sg/" },
];

/**
 * Profitability rating thresholds ($/hour)
 * Based on Singapore minimum wage considerations and opportunity cost
 */
export const PROFIT_THRESHOLDS = {
  excellent: { min: 20, color: "#059669", label: "🔥 Excellent", emoji: "🔥" },
  good: { min: 15, color: "#22c55e", label: "✅ Good", emoji: "✅" },
  okay: { min: 10, color: "#eab308", label: "⚠️ Okay", emoji: "⚠️" },
  poor: { min: 0, color: "#ef4444", label: "❌ Poor", emoji: "❌" },
};

/**
 * Detect traffic condition based on current Singapore time
 * Returns 'heavy' during peak hours, 'normal' during moderate hours, 'light' otherwise
 *
 * @returns {string} Traffic condition key: 'light', 'normal', or 'heavy'
 */
export function detectTrafficCondition() {
  // Get current hour in Singapore (UTC+8)
  const now = new Date();
  const singaporeHour = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }),
  ).getHours();

  const { peakHours, moderateHours } = CONFIG.traffic;

  // Check peak hours (heavy traffic)
  if (
    (singaporeHour >= peakHours.morning.start &&
      singaporeHour < peakHours.morning.end) ||
    (singaporeHour >= peakHours.evening.start &&
      singaporeHour < peakHours.evening.end)
  ) {
    return "heavy";
  }

  // Check moderate hours (normal traffic)
  if (
    (singaporeHour >= moderateHours.midday.start &&
      singaporeHour < moderateHours.midday.end) ||
    (singaporeHour >= moderateHours.afternoon.start &&
      singaporeHour < moderateHours.afternoon.end)
  ) {
    return "normal";
  }

  // Off-peak (light traffic)
  return "light";
}

/**
 * Get traffic speed based on condition
 *
 * @param {string} condition - Traffic condition key
 * @returns {number} Speed in km/h
 */
export function getTrafficSpeed(condition) {
  return (
    CONFIG.traffic.conditions[condition]?.speedKmH ??
    CONFIG.defaults.averageSpeedKmH
  );
}
