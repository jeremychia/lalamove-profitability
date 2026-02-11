/**
 * UI Components
 * Reusable UI component builders
 * @module ui/components
 */

/**
 * Create an address input group with label
 *
 * @param {Object} options
 * @param {string} options.id - Input ID
 * @param {string} options.label - Label text
 * @param {string} options.placeholder - Placeholder text
 * @param {boolean} [options.required=true]
 * @param {string} [options.icon] - Optional icon emoji
 * @returns {HTMLElement}
 */
export function createAddressInput({
  id,
  label,
  placeholder,
  required = true,
  icon = "📍",
}) {
  const group = document.createElement("div");
  group.className = "form-group";

  group.innerHTML = `
    <label for="${id}">
      <span class="icon">${icon}</span>
      ${label}
      ${required ? '<span class="required">*</span>' : ""}
    </label>
    <input
      type="text"
      id="${id}"
      name="${id}"
      placeholder="${placeholder}"
      ${required ? "required" : ""}
      autocomplete="off"
    >
    <div class="input-hint" id="${id}-hint"></div>
  `;

  return group;
}

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
 * Create a select dropdown
 *
 * @param {Object} options
 * @param {string} options.id
 * @param {string} options.label
 * @param {Array} options.options - Array of { value, label }
 * @param {string} [options.selected]
 * @returns {HTMLElement}
 */
export function createSelect({ id, label, options, selected }) {
  const group = document.createElement("div");
  group.className = "form-group";

  const optionsHtml = options
    .map(
      (opt) =>
        `<option value="${opt.value}" ${
          opt.value === selected ? "selected" : ""
        }>${opt.label}</option>`,
    )
    .join("");

  group.innerHTML = `
    <label for="${id}">${label}</label>
    <select id="${id}" name="${id}">
      ${optionsHtml}
    </select>
  `;

  return group;
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

/**
 * Show/hide an element with animation
 *
 * @param {HTMLElement} element
 * @param {boolean} show
 */
export function toggleVisibility(element, show) {
  if (show) {
    element.classList.remove("hidden");
    element.classList.add("visible");
  } else {
    element.classList.remove("visible");
    element.classList.add("hidden");
  }
}
