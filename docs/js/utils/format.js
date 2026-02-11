/**
 * Formatting Utilities
 * Consistent formatting for currency, distance, time, etc.
 * @module utils/format
 */

/**
 * Format currency in SGD
 *
 * @param {number} amount
 * @param {boolean} [showCents=true] - Whether to show cents
 * @returns {string}
 */
export function formatCurrency(amount, showCents = true) {
  if (typeof amount !== "number" || isNaN(amount)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount);
}

/**
 * Format distance in km
 *
 * @param {number} km
 * @param {number} [decimals=1] - Decimal places
 * @returns {string}
 */
export function formatDistance(km, decimals = 1) {
  if (typeof km !== "number" || isNaN(km)) {
    return "0 km";
  }

  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }

  return `${km.toFixed(decimals)} km`;
}

/**
 * Format duration in minutes/hours
 *
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (typeof minutes !== "number" || isNaN(minutes)) {
    return "0 min";
  }

  minutes = Math.round(minutes);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

/**
 * Format profit per hour
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatProfitPerHour(amount) {
  return `${formatCurrency(amount)}/hr`;
}

/**
 * Format percentage
 *
 * @param {number} value - Value as percentage (e.g., 15.5 for 15.5%)
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatPercentage(value, decimals = 1) {
  if (typeof value !== "number" || isNaN(value)) {
    return "0%";
  }

  return `${value.toFixed(decimals)}%`;
}

/**
 * Format fuel efficiency
 *
 * @param {number} kmPerL
 * @returns {string}
 */
export function formatEfficiency(kmPerL) {
  return `${kmPerL} km/L`;
}

/**
 * Format litres
 *
 * @param {number} litres
 * @param {number} [decimals=2]
 * @returns {string}
 */
export function formatLitres(litres, decimals = 2) {
  return `${litres.toFixed(decimals)} L`;
}

/**
 * Truncate text with ellipsis
 *
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Format address for display (shorter version)
 *
 * @param {string} address
 * @param {number} [maxLength=40]
 * @returns {string}
 */
export function formatAddress(address, maxLength = 40) {
  if (!address) return "";

  // Remove common prefixes
  let formatted = address
    .replace(/^SINGAPORE\s*/i, "")
    .replace(/\s+SINGAPORE\s*\d*$/i, "");

  return truncateText(formatted, maxLength);
}

/**
 * Format a number with thousand separators
 *
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  return new Intl.NumberFormat("en-SG").format(num);
}
