/**
 * UI Components
 * Reusable UI component builders
 * @module ui/components
 */

/**
 * Create a stop input row with remove button
 *
 * @param {number} index - Stop number (1-based)
 * @param {Function} onRemove - Callback when remove is clicked
 * @returns {HTMLElement}
 */
export function createStopInput(index, onRemove) {
  const row = document.createElement("div");
  row.className = "stop-row";
  row.dataset.index = index;

  row.innerHTML = `
    <div class="stop-number">${index}</div>
    <div class="stop-input-wrapper">
      <input
        type="text"
        class="stop-input"
        name="stop-${index}"
        placeholder="Enter address or postal code"
        autocomplete="off"
      >
      <div class="stop-type-badge" id="stop-type-${index}"></div>
    </div>
    <div class="stop-wait">
      <input
        type="number"
        class="wait-input"
        name="wait-${index}"
        placeholder="Auto"
        min="0"
        max="60"
        title="Wait time in minutes (leave empty for auto)"
      >
      <span class="wait-suffix">min</span>
    </div>
    <button type="button" class="btn-remove" title="Remove stop">×</button>
  `;

  const removeBtn = row.querySelector(".btn-remove");
  removeBtn.addEventListener("click", () => onRemove(index));

  return row;
}

/**
 * Create a route leg display
 *
 * @param {Object} leg - Route leg data
 * @param {number} index - Leg index
 * @param {boolean} isFirst - Is this the first leg
 * @returns {HTMLElement}
 */
export function createRouteLeg(leg, index, isFirst) {
  const div = document.createElement("div");
  div.className = "route-leg";

  const icon = isFirst ? "🏍️" : "📦";
  const label = isFirst ? "To Pickup" : `Delivery ${index}`;

  div.innerHTML = `
    <div class="leg-icon">${icon}</div>
    <div class="leg-details">
      <div class="leg-label">${label}</div>
      <div class="leg-address">${leg.to}</div>
    </div>
    <div class="leg-stats">
      <span class="leg-distance">${leg.distanceKm.toFixed(1)} km</span>
      <span class="leg-time">${Math.round(leg.timeMinutes)} min</span>
    </div>
    ${
      leg.isEstimate
        ? '<span class="estimate-badge" title="Estimated (API unavailable)">~</span>'
        : ""
    }
  `;

  return div;
}

/**
 * Create a metric card for results display
 *
 * @param {Object} options
 * @param {string} options.label
 * @param {string} options.value
 * @param {string} [options.subtext]
 * @param {string} [options.icon]
 * @param {string} [options.className]
 * @returns {HTMLElement}
 */
export function createMetricCard({
  label,
  value,
  subtext,
  icon,
  className = "",
}) {
  const card = document.createElement("div");
  card.className = `metric-card ${className}`;

  card.innerHTML = `
    ${icon ? `<div class="metric-icon">${icon}</div>` : ""}
    <div class="metric-content">
      <div class="metric-value">${value}</div>
      <div class="metric-label">${label}</div>
      ${subtext ? `<div class="metric-subtext">${subtext}</div>` : ""}
    </div>
  `;

  return card;
}

/**
 * Create an insight/recommendation item
 *
 * @param {Object} insight
 * @param {string} insight.type - 'success', 'warning', 'info'
 * @param {string} insight.message
 * @returns {HTMLElement}
 */
export function createInsightItem(insight) {
  const div = document.createElement("div");
  div.className = `insight-item insight-${insight.type}`;

  const icons = {
    success: "✅",
    warning: "⚠️",
    info: "ℹ️",
  };

  div.innerHTML = `
    <span class="insight-icon">${icons[insight.type] || "ℹ️"}</span>
    <span class="insight-message">${insight.message}</span>
  `;

  return div;
}

/**
 * Create a loading spinner
 *
 * @param {string} [message='Calculating...']
 * @returns {HTMLElement}
 */
export function createLoader(message = "Calculating...") {
  const div = document.createElement("div");
  div.className = "loader";
  div.innerHTML = `
    <div class="spinner"></div>
    <div class="loader-message">${message}</div>
  `;
  return div;
}

/**
 * Create an error message display
 *
 * @param {string} message
 * @param {string} [details]
 * @returns {HTMLElement}
 */
export function createErrorMessage(message, details) {
  const div = document.createElement("div");
  div.className = "error-message";
  div.innerHTML = `
    <div class="error-icon">❌</div>
    <div class="error-content">
      <div class="error-title">${message}</div>
      ${details ? `<div class="error-details">${details}</div>` : ""}
    </div>
  `;
  return div;
}
