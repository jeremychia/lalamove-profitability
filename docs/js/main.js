/**
 * Main Application Entry Point
 * Orchestrates all modules and handles the calculation flow
 * @module main
 */

import { CONFIG } from "./config.js";
import { geocodeAddress, geocodeMultiple } from "./services/geocoding.js";
import { calculateMultiStopRoute } from "./services/routing.js";
import { calculateFuelCost, getBikeEfficiency } from "./services/fuel.js";
import { calculateTotalWaitTime } from "./services/wait-time.js";
import { calculateProfitability } from "./services/profitability.js";
import {
  initForm,
  setFormLoading,
  updateStopTypeBadge,
  updatePickupTypeBadge,
} from "./ui/form.js";
import {
  renderResults,
  renderError,
  showLoading,
  clearResults,
} from "./ui/results.js";
import { getStoredToken, getValidToken, isTokenExpired } from "./api/onemap.js";
import { $, $q, toggleHidden } from "./utils/dom.js";

/**
 * Application state
 */
const state = {
  isCalculating: false,
  lastResult: null,
};

/**
 * Initialize the application
 */
export async function init() {
  console.log("🏍️ Lalamove Profitability Calculator initializing...");

  // Initialize form with submit callback
  initForm({
    onSubmit: handleCalculate,
  });

  // Try to get a valid token (will auto-fetch if secrets.js exists)
  updateApiStatus("checking");
  const token = await getValidToken();

  if (!token) {
    showTokenReminder();
    updateApiStatus("disconnected");
  } else {
    hideTokenReminder();
    updateApiStatus("connected");
    console.log("✅ Valid API token available");
  }

  console.log("✅ App initialized");
}

/**
 * Update the API status indicator
 * @param {'checking'|'connected'|'disconnected'} status
 */
function updateApiStatus(status) {
  const statusEl = $("api-status");
  if (!statusEl) return;

  const iconEl = $q(".status-icon", statusEl);
  const textEl = $q(".status-text", statusEl);

  statusEl.className = `api-status ${status}`;

  const statusConfig = {
    checking: { icon: "⏳", text: "Checking OneMap API..." },
    connected: { icon: "✅", text: "OneMap API connected" },
    disconnected: { icon: "⚠️", text: "No API token (estimates only)" },
  };

  const config = statusConfig[status];
  if (config && iconEl && textEl) {
    iconEl.textContent = config.icon;
    textEl.textContent = config.text;
  }
}

/**
 * Show a reminder to add API token
 */
function showTokenReminder() {
  toggleHidden("token-reminder", true);
}

/**
 * Hide the token reminder
 */
function hideTokenReminder() {
  toggleHidden("token-reminder", false);
}

/**
 * Handle form submission and run calculation
 *
 * @param {Object} formData - Form data from the form module
 */
async function handleCalculate(formData) {
  if (state.isCalculating) {
    console.warn("Calculation already in progress");
    return;
  }

  state.isCalculating = true;
  setFormLoading(true);
  showLoading("Geocoding addresses...");

  try {
    const result = await analyzeOrder(formData);
    state.lastResult = result;
    renderResults(result);
  } catch (error) {
    console.error("Calculation error:", error);
    renderError(error);
  } finally {
    state.isCalculating = false;
    setFormLoading(false);
  }
}

/**
 * Main analysis function - orchestrates all services
 *
 * @param {Object} formData
 * @returns {Promise<Object>} Complete analysis result
 */
async function analyzeOrder(formData) {
  const {
    currentLocation,
    pickup,
    stops,
    fare,
    bikeModel,
    customEfficiency,
    petrolPrice,
    waitOverrides,
    trafficCondition,
  } = formData;

  // Step 1: Geocode all locations
  showLoading("Looking up addresses...");

  const addressesToGeocode = [currentLocation, pickup, ...stops];
  const geocodedLocations = await geocodeMultiple(addressesToGeocode);

  const [currentCoords, pickupCoords, ...stopCoords] = geocodedLocations;

  // Update UI with detected building types
  updatePickupTypeBadge(
    pickupCoords.buildingType,
    pickupCoords.buildingType.toUpperCase(),
  );

  stopCoords.forEach((stop, index) => {
    updateStopTypeBadge(
      index + 1,
      stop.buildingType,
      stop.buildingType.toUpperCase(),
    );
  });

  // Step 2: Calculate route through all points
  showLoading("Calculating routes...");

  // Get a valid token (will auto-refresh if needed)
  const token = await getValidToken();

  const allPoints = [currentCoords, pickupCoords, ...stopCoords];
  const route = await calculateMultiStopRoute(
    allPoints,
    token,
    trafficCondition,
  );

  // Step 3: Get fuel efficiency
  const efficiency = getBikeEfficiency(bikeModel) ?? customEfficiency;

  if (!efficiency || efficiency <= 0) {
    throw new Error(
      "Invalid fuel efficiency. Please select a bike model or enter a custom value.",
    );
  }

  // Step 4: Calculate fuel cost
  const fuel = calculateFuelCost(
    route.totalDistanceKm,
    efficiency,
    petrolPrice,
  );

  // Step 5: Calculate wait times
  const waitTime = calculateTotalWaitTime(
    stopCoords,
    waitOverrides,
    CONFIG.defaults.pickupWaitMinutes,
  );

  // Step 6: Calculate profitability
  const profitability = calculateProfitability({
    fare,
    fuelCost: fuel.cost,
    travelMinutes: route.totalTravelMinutes,
    waitMinutes: waitTime.total,
    pickupWaitMinutes: waitTime.pickupWait,
  });

  return {
    locations: {
      current: currentCoords,
      pickup: pickupCoords,
      stops: stopCoords,
    },
    route,
    fuel,
    waitTime,
    profitability,
    inputs: {
      fare,
      efficiency,
      petrolPrice,
    },
  };
}

/**
 * Get the last calculation result
 * @returns {Object|null}
 */
export function getLastResult() {
  return state.lastResult;
}

/**
 * Check if currently calculating
 * @returns {boolean}
 */
export function isCalculating() {
  return state.isCalculating;
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
