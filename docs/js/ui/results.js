/**
 * Results Display Module
 * Renders calculation results and insights
 * @module ui/results
 */

import {
  createRouteLeg,
  createMetricCard,
  createInsightItem,
  createLoader,
  createErrorMessage,
} from "./components.js";
import {
  formatCurrency,
  formatDistance,
  formatDuration,
  formatProfitPerHour,
  formatPercentage,
  formatLitres,
} from "../utils/format.js";
import { getInsights } from "../services/profitability.js";
import { PROFIT_THRESHOLDS, CONFIG } from "../config.js";
import { $, toggleHidden, createElement } from "../utils/dom.js";
import {
  isSheetsEnabled,
  saveToSheets,
  showToast,
  initSheetsService,
} from "../services/sheets.js";

// Store the last result and form data for saving
let lastResultData = null;
let lastFormData = null;

/**
 * Initialize sheets service (called from main.js)
 */
export async function initResultsModule() {
  await initSheetsService();
}

/**
 * Store form data for later use when saving
 * @param {Object} formData
 */
export function setFormData(formData) {
  lastFormData = formData;
}

/**
 * Create a Google Maps directions URL from coordinates
 * @param {Array<{lat: number, lng: number}>} coordinates
 * @returns {string}
 */
function buildGoogleMapsUrl(coordinates) {
  if (coordinates.length < 2) return "";

  const origin = `${coordinates[0].lat},${coordinates[0].lng}`;
  const destination = `${coordinates[coordinates.length - 1].lat},${
    coordinates[coordinates.length - 1].lng
  }`;

  // Waypoints are all points between origin and destination
  const waypoints = coordinates
    .slice(1, -1)
    .map((c) => `${c.lat},${c.lng}`)
    .join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }

  return url;
}

/**
 * Create Google Maps link element
 * @param {Array<{lat: number, lng: number}>} coordinates
 * @returns {HTMLElement}
 */
function createGoogleMapsLink(coordinates) {
  const link = createElement("a", {
    className: "maps-link",
    innerHTML: `<span class="maps-icon">🗺️</span> Open in Google Maps`,
  });
  link.href = buildGoogleMapsUrl(coordinates);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

/**
 * Render full calculation results
 *
 * @param {Object} result - Complete calculation result
 */
export function renderResults(result) {
  const container = $("results-container");
  if (!container) return;

  // Store result for saving later
  lastResultData = result;

  container.innerHTML = "";
  toggleHidden(container, true);

  // Rating header
  const ratingHeader = createRatingHeader(result.profitability);
  container.appendChild(ratingHeader);

  // Main metrics grid
  const metricsGrid = createMetricsGrid(result);
  container.appendChild(metricsGrid);

  // Fare breakdown (Lalamove deductions)
  const fareSection = createFareBreakdown(result.profitability);
  container.appendChild(fareSection);

  // Route breakdown
  const routeSection = createRouteSection(result.route);
  container.appendChild(routeSection);

  // Time breakdown
  const timeSection = createTimeBreakdown(result);
  container.appendChild(timeSection);

  // Insights and recommendations
  const insightsSection = createInsightsSection(result.profitability);
  container.appendChild(insightsSection);

  // Save to Sheets button (if configured)
  if (isSheetsEnabled()) {
    const saveButton = createSaveButton();
    container.appendChild(saveButton);
  }

  // Scroll results into view
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Create the rating header with profit/hour
 *
 * @param {Object} profitability
 * @returns {HTMLElement}
 */
function createRatingHeader(profitability) {
  const header = document.createElement("div");
  header.className = `rating-header rating-${profitability.rating}`;

  const threshold = PROFIT_THRESHOLDS[profitability.rating];

  header.innerHTML = `
    <div class="rating-emoji">${threshold.emoji}</div>
    <div class="rating-content">
      <div class="rating-label">${threshold.label
        .replace(threshold.emoji, "")
        .trim()}</div>
      <div class="rating-value">${formatProfitPerHour(
        profitability.profitPerHour,
      )}</div>
    </div>
  `;

  header.style.borderLeftColor = threshold.color;

  return header;
}

/**
 * Create main metrics grid
 *
 * @param {Object} result
 * @returns {HTMLElement}
 */
function createMetricsGrid(result) {
  const grid = document.createElement("div");
  grid.className = "metrics-grid";

  const metrics = [
    {
      label: "Net Profit",
      value: formatCurrency(result.profitability.netProfit),
      icon: "💰",
      className: result.profitability.netProfit >= 0 ? "positive" : "negative",
    },
    {
      label: "Fuel Cost",
      value: formatCurrency(result.fuel.cost),
      subtext: formatLitres(result.fuel.litresUsed),
      icon: "⛽",
    },
    {
      label: "Total Distance",
      value: formatDistance(result.route.totalDistanceKm),
      subtext: `${result.route.legs.length} leg${
        result.route.legs.length > 1 ? "s" : ""
      }`,
      icon: "📍",
    },
    {
      label: "Total Time",
      value: formatDuration(result.profitability.totalTimeMinutes),
      subtext: `Travel: ${formatDuration(
        result.profitability.breakdown.travelMinutes,
      )}`,
      icon: "⏱️",
    },
  ];

  metrics.forEach((metric) => {
    grid.appendChild(createMetricCard(metric));
  });

  return grid;
}

/**
 * Create route breakdown section
 *
 * @param {Object} route
 * @returns {HTMLElement}
 */
function createRouteSection(route) {
  const section = document.createElement("div");
  section.className = "results-section route-section";

  const headerRow = document.createElement("div");
  headerRow.className = "section-header-row";

  const header = document.createElement("h3");
  header.textContent = "🗺️ Route Breakdown";
  headerRow.appendChild(header);

  // Add Google Maps link if coordinates available
  if (route.coordinates && route.coordinates.length >= 2) {
    const mapsLink = createGoogleMapsLink(route.coordinates);
    headerRow.appendChild(mapsLink);
  }

  section.appendChild(headerRow);

  // Show traffic condition badge
  if (route.trafficCondition) {
    const trafficInfo = CONFIG.traffic.conditions[route.trafficCondition];
    const trafficBadge = document.createElement("div");
    trafficBadge.className = `traffic-badge traffic-${route.trafficCondition}`;
    trafficBadge.innerHTML = `
      <span class="traffic-icon">${trafficInfo.icon}</span>
      <span class="traffic-label">${trafficInfo.label}</span>
      <span class="traffic-speed">(~${trafficInfo.speedKmH} km/h avg)</span>
    `;
    section.appendChild(trafficBadge);
  }

  const routeList = document.createElement("div");
  routeList.className = "route-list";

  route.legs.forEach((leg, index) => {
    const legEl = createRouteLeg(leg, index, index === 0);
    routeList.appendChild(legEl);
  });

  section.appendChild(routeList);

  // Show warning if using estimates
  if (route.hasEstimates) {
    const warning = document.createElement("div");
    warning.className = "estimate-warning";
    warning.innerHTML = `
      <span class="warning-icon">⚠️</span>
      Some distances are estimated (routing API unavailable). Add your OneMap API token in settings for accurate results.
    `;
    section.appendChild(warning);
  }

  return section;
}

/**
 * Create fare breakdown section showing Lalamove deductions
 *
 * @param {Object} profitability
 * @returns {HTMLElement}
 */
function createFareBreakdown(profitability) {
  const section = document.createElement("div");
  section.className = "results-section fare-section";

  const { fareBreakdown, fuelCost, netProfit } = profitability;

  section.innerHTML = `
    <h3>💵 Fare Breakdown</h3>
    <div class="fare-breakdown">
      <div class="fare-row gross">
        <span class="fare-label">Offered Fare</span>
        <span class="fare-value">${formatCurrency(
          fareBreakdown.grossFare,
        )}</span>
      </div>
      <div class="fare-row base-info">
        <span class="fare-label">Base Fare (excl. platform fee)</span>
        <span class="fare-value">${formatCurrency(
          fareBreakdown.baseFare,
        )}</span>
      </div>
      <div class="fare-row deduction">
        <span class="fare-label">− Commission (15% of base)</span>
        <span class="fare-value">-${formatCurrency(
          fareBreakdown.commission,
        )}</span>
      </div>
      <div class="fare-row deduction">
        <span class="fare-label">− VAT/GST (9% of base)</span>
        <span class="fare-value">-${formatCurrency(fareBreakdown.vat)}</span>
      </div>
      ${
        fareBreakdown.cpfWithholding > 0
          ? `
      <div class="fare-row deduction">
        <span class="fare-label">− CPF Withholding</span>
        <span class="fare-value">-${formatCurrency(
          fareBreakdown.cpfWithholding,
        )}</span>
      </div>
      `
          : ""
      }
      <div class="fare-row deduction">
        <span class="fare-label">− Platform Fee Offset</span>
        <span class="fare-value">-${formatCurrency(
          fareBreakdown.platformFee,
        )}</span>
      </div>
      <div class="fare-row subtotal">
        <span class="fare-label">Net Fare (after deductions)</span>
        <span class="fare-value">${formatCurrency(fareBreakdown.netFare)}</span>
      </div>
      <div class="fare-row deduction">
        <span class="fare-label">− Fuel Cost</span>
        <span class="fare-value">-${formatCurrency(fuelCost)}</span>
      </div>
      <div class="fare-row total ${netProfit >= 0 ? "positive" : "negative"}">
        <span class="fare-label">Your Net Profit</span>
        <span class="fare-value">${formatCurrency(netProfit)}</span>
      </div>
    </div>
    <div class="fare-note">
      <span class="note-icon">ℹ️</span>
      <span>Deductions are estimates based on typical Lalamove rates. Actual amounts may vary.</span>
    </div>
  `;

  return section;
}

/**
 * Create time breakdown section
 *
 * @param {Object} result
 * @returns {HTMLElement}
 */
function createTimeBreakdown(result) {
  const section = document.createElement("div");
  section.className = "results-section time-section";

  const { breakdown } = result.profitability;
  const { waitTime } = result;

  section.innerHTML = `
    <h3>⏱️ Time Breakdown</h3>
    <div class="time-breakdown">
      <div class="time-row">
        <span class="time-label">Travel time</span>
        <span class="time-value">${formatDuration(
          breakdown.travelMinutes,
        )}</span>
      </div>
      <div class="time-row">
        <span class="time-label">Pickup wait</span>
        <span class="time-value">${formatDuration(
          breakdown.pickupWaitMinutes,
        )}</span>
      </div>
      <div class="time-row">
        <span class="time-label">Delivery waits</span>
        <span class="time-value">${formatDuration(breakdown.waitMinutes)}</span>
      </div>
      <div class="time-row total">
        <span class="time-label">Total</span>
        <span class="time-value">${formatDuration(
          result.profitability.totalTimeMinutes,
        )}</span>
      </div>
    </div>
  `;

  // Add wait time breakdown per stop
  if (waitTime && waitTime.breakdown && waitTime.breakdown.length > 0) {
    const waitDetails = document.createElement("div");
    waitDetails.className = "wait-details";
    waitDetails.innerHTML = "<h4>Wait time per stop:</h4>";

    const waitList = document.createElement("ul");
    waitTime.breakdown.forEach((wait, index) => {
      const li = document.createElement("li");
      li.innerHTML = `
        Stop ${index + 1}: ${wait.minutes} min
        <span class="wait-type">(${wait.label}${
          wait.isOverride ? " - manual" : ""
        })</span>
      `;
      waitList.appendChild(li);
    });

    waitDetails.appendChild(waitList);
    section.appendChild(waitDetails);
  }

  return section;
}

/**
 * Create insights and recommendations section
 *
 * @param {Object} profitability
 * @returns {HTMLElement}
 */
function createInsightsSection(profitability) {
  const section = document.createElement("div");
  section.className = "results-section insights-section";

  const insights = getInsights(profitability);

  section.innerHTML = "<h3>💡 Insights</h3>";

  // Insights
  if (insights.insights.length > 0) {
    const insightsList = document.createElement("div");
    insightsList.className = "insights-list";

    insights.insights.forEach((insight) => {
      insightsList.appendChild(createInsightItem(insight));
    });

    section.appendChild(insightsList);
  }

  // Recommendations
  if (insights.recommendations.length > 0) {
    const recsHeader = document.createElement("h4");
    recsHeader.textContent = "Recommendations:";
    section.appendChild(recsHeader);

    const recsList = document.createElement("ul");
    recsList.className = "recommendations-list";

    insights.recommendations.forEach((rec) => {
      const li = document.createElement("li");
      li.textContent = rec;
      recsList.appendChild(li);
    });

    section.appendChild(recsList);
  }

  // Minimum fare for good rating
  const minFareInfo = document.createElement("div");
  minFareInfo.className = "min-fare-info";
  minFareInfo.innerHTML = `
    <span class="info-label">Minimum fare for "Good" rating:</span>
    <span class="info-value">${formatCurrency(
      insights.minimumFareForGood,
    )}</span>
  `;
  section.appendChild(minFareInfo);

  return section;
}

/**
 * Show loading state in results area
 *
 * @param {string} [message='Calculating...']
 */
export function showLoading(message = "Calculating routes...") {
  const container = $("results-container");
  if (!container) return;

  container.innerHTML = "";
  toggleHidden(container, true);
  container.appendChild(createLoader(message));
}

/**
 * Render an error message
 *
 * @param {Error|string} error
 */
export function renderError(error) {
  const container = $("results-container");
  if (!container) return;

  container.innerHTML = "";
  toggleHidden(container, true);

  const message = error instanceof Error ? error.message : String(error);
  const details = error instanceof Error ? error.stack : null;

  container.appendChild(createErrorMessage(message, details));

  // Add retry hint
  const hint = createElement("div", {
    className: "error-hint",
    innerHTML: `
    <p>Tips:</p>
    <ul>
      <li>Check that all addresses are valid Singapore addresses or postal codes</li>
      <li>Make sure you have an internet connection</li>
      <li>Try adding your OneMap API token in settings for better accuracy</li>
    </ul>
  `,
  });
  container.appendChild(hint);
}

/**
 * Clear results container
 */
export function clearResults() {
  const container = $("results-container");
  if (container) {
    container.innerHTML = "";
    toggleHidden(container, false);
  }
}

/**
 * Create the Save to Sheets button
 * @returns {HTMLElement}
 */
function createSaveButton() {
  const button = createElement("button", {
    className: "save-results-btn",
    innerHTML: `
      <span class="btn-icon">📊</span>
      <span>Save to Google Sheets</span>
    `,
  });
  button.type = "button";
  button.addEventListener("click", openSaveModal);
  return button;
}

/**
 * Open the save modal
 */
function openSaveModal() {
  const modal = $("save-modal");
  if (!modal) return;

  // Set default time to now
  const timeInput = $("job-posted-time");
  if (timeInput) {
    const now = new Date();
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const localISOTime = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);
    timeInput.value = localISOTime;
  }

  // Reset fare type to regular
  const fareTypeInput = $("fare-type");
  if (fareTypeInput) {
    fareTypeInput.value = "regular";
  }

  // Reset priority fee to 0
  const priorityFeeInput = $("priority-fee");
  if (priorityFeeInput) {
    priorityFeeInput.value = "0";
  }

  // Reset surcharge to 0
  const surchargeInput = $("surcharge-amount");
  if (surchargeInput) {
    surchargeInput.value = "0";
  }

  // Clear notes
  const notesInput = $("save-notes");
  if (notesInput) {
    notesInput.value = "";
  }

  // Show modal
  toggleHidden(modal, true);

  // Set up event listeners
  setupModalListeners();
}

/**
 * Close the save modal
 */
function closeSaveModal() {
  const modal = $("save-modal");
  if (modal) {
    toggleHidden(modal, false);
  }
}

/**
 * Set up modal event listeners
 */
function setupModalListeners() {
  const cancelBtn = $("cancel-save-btn");
  const saveForm = $("save-form");
  const backdrop = document.querySelector("#save-modal .modal-backdrop");

  // Cancel button
  if (cancelBtn) {
    cancelBtn.onclick = closeSaveModal;
  }

  // Click on backdrop to close
  if (backdrop) {
    backdrop.onclick = closeSaveModal;
  }

  // Form submission
  if (saveForm) {
    saveForm.onsubmit = handleSaveSubmit;
  }

  // Escape key to close
  document.addEventListener("keydown", handleEscapeKey);
}

/**
 * Handle escape key press
 * @param {KeyboardEvent} e
 */
function handleEscapeKey(e) {
  if (e.key === "Escape") {
    closeSaveModal();
    document.removeEventListener("keydown", handleEscapeKey);
  }
}

/**
 * Handle save form submission
 * @param {Event} e
 */
async function handleSaveSubmit(e) {
  e.preventDefault();

  if (!lastResultData) {
    showToast("No calculation data to save", "error");
    return;
  }

  const jobPostedTime = $("job-posted-time")?.value;
  const fareType = $("fare-type")?.value || "regular";
  const priorityFee = parseFloat($("priority-fee")?.value) || 0;
  const surchargeAmount = parseFloat($("surcharge-amount")?.value) || 0;
  const notes = $("save-notes")?.value || "";

  if (!jobPostedTime) {
    showToast("Please enter when the job was posted", "error");
    return;
  }

  // Disable submit button while saving
  const submitBtn = $("confirm-save-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = "⏳ Saving...";
  }

  const result = await saveToSheets({
    result: lastResultData,
    formData: lastFormData || {},
    jobPostedTime,
    fareType,
    priorityFee,
    surchargeAmount,
    notes,
  });

  // Re-enable button
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = "📊 Save to Sheets";
  }

  if (result.success) {
    showToast("Order data saved successfully!", "success");
    closeSaveModal();
  } else {
    showToast(result.error || "Failed to save data", "error");
  }
}
