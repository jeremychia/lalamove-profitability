/**
 * Google Sheets Integration Service
 * Saves order data to a Google Sheets backend via Apps Script Web App
 * @module services/sheets
 */

// Default to empty - will be loaded from secrets.js if available
let GOOGLE_SHEETS_URL = "";

/**
 * Initialize sheets service with URL from secrets
 */
export async function initSheetsService() {
  try {
    const { SECRETS } = await import("../secrets.js");
    if (SECRETS?.googleSheets?.webAppUrl) {
      GOOGLE_SHEETS_URL = SECRETS.googleSheets.webAppUrl;
      console.log("✅ Google Sheets integration configured");
      return true;
    }
  } catch (e) {
    console.log(
      "ℹ️ Google Sheets not configured (no secrets.js or missing webAppUrl)",
    );
  }
  return false;
}

/**
 * Check if Google Sheets integration is available
 * @returns {boolean}
 */
export function isSheetsEnabled() {
  return GOOGLE_SHEETS_URL.length > 0;
}

/**
 * Set the Google Sheets Web App URL programmatically
 * @param {string} url - The deployed Google Apps Script Web App URL
 */
export function setSheetsUrl(url) {
  GOOGLE_SHEETS_URL = url;
}

/**
 * Get the current sheets URL (for debugging)
 * @returns {string}
 */
export function getSheetsUrl() {
  return GOOGLE_SHEETS_URL;
}

/**
 * Save order data to Google Sheets
 * @param {Object} options - Save options
 * @param {Object} options.result - The calculation result from main.js
 * @param {Object} options.formData - Original form data
 * @param {string} options.jobPostedTime - When the job was posted (ISO string)
 * @param {number} options.surchargeAmount - Surcharge amount in SGD
 * @param {string} [options.notes] - Optional notes
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveToSheets({
  result,
  formData,
  jobPostedTime,
  surchargeAmount,
  notes = "",
}) {
  if (!GOOGLE_SHEETS_URL) {
    return {
      success: false,
      error: "Google Sheets URL not configured. Add it to secrets.js",
    };
  }

  const dataToSave = buildSaveData({
    result,
    formData,
    jobPostedTime,
    surchargeAmount,
    notes,
  });

  try {
    // For Google Apps Script, we need to use redirect: 'follow' and handle the response
    // Apps Script returns a redirect, so we use 'follow' mode
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(dataToSave),
    });

    // Check if request was successful
    if (response.ok) {
      try {
        const result = await response.json();
        if (result.success) {
          return { success: true };
        } else {
          return { success: false, error: result.error || "Unknown error" };
        }
      } catch {
        // If we can't parse JSON but got a 200, assume success
        return { success: true };
      }
    } else {
      return { success: false, error: `Server returned ${response.status}` };
    }
  } catch (error) {
    console.error("Failed to save to Google Sheets:", error);
    return {
      success: false,
      error: error.message || "Network error. Please try again.",
    };
  }
}

/**
 * Build the data object to save
 * @private
 */
function buildSaveData({
  result,
  formData,
  jobPostedTime,
  surchargeAmount,
  notes,
}) {
  const { profitability, route, fuel, waitTime, locations, inputs } = result;

  // Build stops string
  const stopsDisplay = locations.stops
    .map((s, i) => `${i + 1}. ${s.address || s.searchTerm}`)
    .join(" | ");

  return {
    // Identifiers
    id: generateId(),
    savedAt: new Date().toISOString(),

    // Job timing
    jobPostedTime: jobPostedTime,

    // Locations
    currentLocation: locations.current.address || locations.current.searchTerm,
    pickupAddress: locations.pickup.address || locations.pickup.searchTerm,
    pickupBuildingType: locations.pickup.buildingType || "unknown",
    deliveryStops: stopsDisplay,
    stopsCount: locations.stops.length,

    // Financial - Base
    baseFare: inputs.fare,
    surchargeAmount: surchargeAmount,
    totalFare: inputs.fare + surchargeAmount,

    // Financial - Deductions (from profitability)
    grossFare: profitability.grossFare,
    commission: profitability.commission,
    vat: profitability.vat,
    netFare: profitability.netFare,

    // Costs
    fuelCost: fuel.cost,
    fuelLitres: fuel.litres,

    // Distance & Time
    totalDistanceKm: route.totalDistanceKm,
    totalTravelMinutes: route.totalTravelMinutes,
    totalWaitMinutes: waitTime.total,
    totalTimeMinutes: profitability.totalMinutes,

    // Profitability
    netProfit: profitability.netProfit + surchargeAmount, // Add surcharge to net
    profitPerHour:
      ((profitability.netProfit + surchargeAmount) /
        profitability.totalMinutes) *
      60,
    rating: profitability.rating,

    // Settings used
    fuelEfficiency: inputs.efficiency,
    petrolPrice: inputs.petrolPrice,
    trafficCondition: formData.trafficCondition || "normal",
    bikeModel: formData.bikeModel || "unknown",

    // Optional
    notes: notes,
  };
}

/**
 * Generate a unique ID for the record
 * @private
 */
function generateId() {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Simple fallback
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
export function showToast(message, type = "info") {
  // Remove any existing toasts
  const existing = document.querySelector(".toast-notification");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${
      type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"
    }</span>
    <span class="toast-message">${message}</span>
  `;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
  });

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
