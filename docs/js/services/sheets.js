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
 * @param {string} options.fareType - Type of fare (regular, pooling, priority)
 * @param {number} options.priorityFee - Priority fee amount in SGD
 * @param {number} options.surchargeAmount - Other surcharge amount in SGD
 * @param {string} [options.notes] - Optional notes
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveToSheets({
  result,
  formData,
  jobPostedTime,
  fareType,
  priorityFee,
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
    fareType,
    priorityFee,
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
  fareType,
  priorityFee,
  surchargeAmount,
  notes,
}) {
  const { profitability, route, fuel, waitTime, locations, inputs } = result;

  // Build stops string (simple display format)
  const stopsDisplay = locations.stops
    .map((s, i) => `${i + 1}. ${s.address || s.searchTerm}`)
    .join(" | ");

  // Build detailed stops metadata as JSON
  const stopsMetadata = locations.stops.map((stop, index) => {
    // Find the corresponding route leg (legs 1+ are delivery legs)
    const legIndex = index + 1; // Leg 0 is to pickup, so stop 0 = leg 1
    const routeLeg = route.legs[legIndex] || {};

    // Find the corresponding wait time breakdown
    const waitBreakdown = waitTime.breakdown?.[index] || {};

    return {
      stopNumber: index + 1,
      address: stop.address || stop.searchTerm || "",
      searchTerm: stop.searchTerm || "",
      buildingType: stop.buildingType || "unknown",
      lat: stop.lat || null,
      lng: stop.lng || null,
      distanceFromPreviousKm: routeLeg.distanceKm || 0,
      travelFromPreviousMinutes: routeLeg.timeMinutes || 0,
      waitTimeMinutes: waitBreakdown.minutes || 0,
      waitTimeLabel: waitBreakdown.label || "",
      isWaitOverride: waitBreakdown.isOverride || false,
    };
  });

  // Calculate additional stop fee ($3 per additional stop beyond the first)
  const additionalStops = Math.max(0, locations.stops.length - 1);
  const additionalStopFee = additionalStops * 3;

  // The fare entered by user is the total price (including all surcharges)
  // Base fare = total fare - additional stop fee - priority fee - other surcharges
  const totalFare = inputs.fare;
  const baseFare =
    totalFare - additionalStopFee - priorityFee - surchargeAmount;

  // Recalculate deductions based on base fare (without surcharges)
  const { fareBreakdown } = profitability;

  // Total surcharges = additional stop fee + priority fee + other surcharges
  const totalSurcharges = additionalStopFee + priorityFee + surchargeAmount;

  // Split distance and time between pickup leg and job legs
  // Leg 0 = current location to pickup
  // Legs 1+ = pickup to delivery stops (the actual job)
  const pickupLeg = route.legs[0] || { distanceKm: 0, timeMinutes: 0 };
  const jobLegs = route.legs.slice(1);

  const distanceToPickupKm = pickupLeg.distanceKm;
  const travelToPickupMinutes = pickupLeg.timeMinutes;

  const jobDistanceKm = jobLegs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const jobTravelMinutes = jobLegs.reduce(
    (sum, leg) => sum + leg.timeMinutes,
    0,
  );

  // Job-only calculations (as if you were already at the pickup location)
  // Job-only fuel cost = proportional to job distance only
  const totalDistanceKm = route.totalDistanceKm || 1; // Avoid division by zero
  const jobFuelCost =
    totalDistanceKm > 0
      ? (jobDistanceKm / totalDistanceKm) * fuel.cost
      : fuel.cost;

  // Job-only net profit = net fare minus job-only fuel cost
  const jobOnlyNetProfit = fareBreakdown.netFare - jobFuelCost;

  // Job-only time = job travel time + pickup wait + delivery waits (excludes travel to pickup)
  const jobOnlyTimeMinutes =
    jobTravelMinutes + waitTime.pickupWait + waitTime.total;

  // Job-only profit per hour (if you were already at the pickup location)
  // This will equal profitPerHour when distanceToPickup = 0 and travelToPickup = 0
  const jobOnlyProfitPerHour =
    jobOnlyTimeMinutes > 0 ? (jobOnlyNetProfit / jobOnlyTimeMinutes) * 60 : 0;

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
    deliveryStopsMetadata: stopsMetadata,
    stopsCount: locations.stops.length,

    // Fare type
    fareType: fareType,

    // Financial - Fares
    baseFare: baseFare,
    additionalStopFee: additionalStopFee,
    priorityFee: priorityFee,
    surchargeAmount: surchargeAmount,
    totalSurcharges: totalSurcharges,
    totalFare: totalFare,

    // Financial - Deductions (from profitability fareBreakdown)
    grossFare: fareBreakdown.grossFare,
    commission: fareBreakdown.commission,
    vat: fareBreakdown.vat,
    cpfWithholding: fareBreakdown.cpfWithholding,
    platformFee: fareBreakdown.platformFee,
    totalDeductions: fareBreakdown.totalDeductions,
    netFare: fareBreakdown.netFare,

    // Costs
    fuelCost: fuel.cost,
    fuelLitres: fuel.litresUsed,

    // Distance - Split between pickup and job
    distanceToPickupKm: distanceToPickupKm,
    jobDistanceKm: jobDistanceKm,
    totalDistanceKm: route.totalDistanceKm,

    // Time - Split between pickup travel and job
    travelToPickupMinutes: travelToPickupMinutes,
    jobTravelMinutes: jobTravelMinutes,
    totalTravelMinutes: route.totalTravelMinutes,
    totalWaitMinutes: waitTime.total,
    totalTimeMinutes: profitability.totalTimeMinutes,

    // Profitability - Overall
    netProfit: profitability.netProfit,
    profitPerHour: profitability.profitPerHour,
    rating: profitability.rating,

    // Profitability - Job only (excluding travel to pickup)
    jobOnlyFuelCost: jobFuelCost,
    jobOnlyNetProfit: jobOnlyNetProfit,
    jobOnlyTimeMinutes: jobOnlyTimeMinutes,
    jobOnlyProfitPerHour: jobOnlyProfitPerHour,

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
