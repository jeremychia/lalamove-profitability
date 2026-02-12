/**
 * Form Handling Module
 * Manages form state, validation, and data extraction
 * @module ui/form
 */

import {
  BIKE_MODELS,
  PETROL_LINKS,
  CONFIG,
  detectTrafficCondition,
} from "../config.js";
import { createStopInput } from "./components.js";
import { validateFormData, parseNumericInput } from "../utils/validation.js";
import { $, $q, $qa, showHint, toggleHidden } from "../utils/dom.js";
import { storeToken, getStoredToken, reverseGeocode } from "../api/onemap.js";
import { formatReverseGeocodeAddress } from "../services/geocoding.js";

let stopCount = 1;
let onSubmitCallback = null;

/**
 * Initialize the form with dynamic elements
 *
 * @param {Object} options
 * @param {Function} options.onSubmit - Callback when form is submitted
 */
export function initForm({ onSubmit }) {
  onSubmitCallback = onSubmit;

  // Initialize dynamic form elements
  initTrafficSelect();
  initBikeSelect();
  initPetrolPrice();
  initPetrolLinks();
  initStopsContainer();
  initTokenField();

  // Setup event listeners
  $("calculator-form")?.addEventListener("submit", handleFormSubmit);
  $("add-stop-btn")?.addEventListener("click", addStop);
  $("bike-model")?.addEventListener("change", handleBikeModelChange);
  $("settings-toggle")?.addEventListener("click", toggleSettings);
  $("use-my-location-btn")?.addEventListener("click", handleUseMyLocation);
}

/**
 * Initialize bike model select dropdown
 */
function initBikeSelect() {
  const select = $("bike-model");
  if (!select) return;

  select.innerHTML = BIKE_MODELS.map(
    (bike) =>
      `<option value="${bike.id}" ${bike.id === "ybr125" ? "selected" : ""}>
      ${bike.name}${bike.efficiency ? ` (${bike.efficiency} km/L)` : ""}
    </option>`,
  ).join("");

  // Show/hide custom efficiency input
  handleBikeModelChange();
}

/**
 * Initialize traffic condition selector with auto-detected default
 */
function initTrafficSelect() {
  const select = $("traffic-condition");
  const hint = $("traffic-hint");
  if (!select) return;

  const detectedCondition = detectTrafficCondition();
  const conditions = CONFIG.traffic.conditions;

  // Build options
  select.innerHTML = Object.entries(conditions)
    .map(([key, condition]) => {
      const isDetected = key === detectedCondition;
      return `<option value="${key}" ${isDetected ? "selected" : ""}>
      ${condition.icon} ${condition.label} (~${condition.speedKmH} km/h)${
        isDetected ? " ← Auto" : ""
      }
    </option>`;
    })
    .join("");

  // Update hint with current Singapore time
  if (hint) {
    const sgTime = new Date().toLocaleTimeString("en-SG", {
      timeZone: "Asia/Singapore",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    hint.innerHTML = `Auto-detected for ${sgTime} Singapore time. Override if needed.`;
  }
}

/**
 * Initialize petrol price input with default from config
 */
function initPetrolPrice() {
  const input = $("petrol-price");
  if (!input) return;

  input.value = CONFIG.defaults.petrolPrice;
}

/**
 * Initialize petrol price links
 */
function initPetrolLinks() {
  const container = $("petrol-links");
  if (!container) return;

  container.innerHTML = PETROL_LINKS.map(
    (link) =>
      `<a href="${link.url}" target="_blank" rel="noopener" class="petrol-link">${link.name}</a>`,
  ).join("");
}

/**
 * Initialize stops container with first stop
 */
function initStopsContainer() {
  const container = $("stops-container");
  if (!container) return;

  // Clear and add first stop
  container.innerHTML = "";
  addStop();
}

/**
 * Initialize API token field
 */
function initTokenField() {
  const tokenInput = $("api-token");
  if (!tokenInput) return;

  // Load saved token
  const savedToken = getStoredToken();
  if (savedToken) {
    tokenInput.value = savedToken;
  }

  // Save token on change
  tokenInput.addEventListener("change", () => {
    const token = tokenInput.value.trim();
    if (token) {
      storeToken(token);
    }
  });
}

/**
 * Handle bike model selection change
 */
function handleBikeModelChange() {
  const select = $("bike-model");
  const customGroup = $("custom-efficiency-group");

  if (!select || !customGroup) return;

  const isCustom = select.value === "custom";
  toggleHidden(customGroup, isCustom);

  const customInput = $("custom-efficiency");
  if (customInput) {
    customInput.required = isCustom;
  }
}

/**
 * Add a new stop input
 */
function addStop() {
  const container = $("stops-container");
  if (!container) return;

  if (stopCount >= CONFIG.limits.maxStops) {
    alert(`Maximum ${CONFIG.limits.maxStops} stops allowed`);
    return;
  }

  stopCount++;
  const stopInput = createStopInput(stopCount - 1, removeStop);
  container.appendChild(stopInput);

  updateStopNumbers();
  updateRemoveButtons();
}

/**
 * Remove a stop input
 *
 * @param {number} index
 */
function removeStop(index) {
  const container = $("stops-container");
  if (!container) return;

  const rows = $qa(".stop-row", container);
  if (rows.length <= 1) {
    alert("At least one delivery stop is required");
    return;
  }

  const rowToRemove = $q(`.stop-row[data-index="${index}"]`, container);
  if (rowToRemove) {
    rowToRemove.remove();
    stopCount--;
    updateStopNumbers();
    updateRemoveButtons();
  }
}

/**
 * Update stop numbers after add/remove
 */
function updateStopNumbers() {
  const container = $("stops-container");
  if (!container) return;

  const rows = $qa(".stop-row", container);
  rows.forEach((row, index) => {
    row.dataset.index = index + 1;
    const numberEl = $q(".stop-number", row);
    if (numberEl) {
      numberEl.textContent = index + 1;
    }
  });
}

/**
 * Update remove button visibility
 */
function updateRemoveButtons() {
  const container = $("stops-container");
  if (!container) return;

  const rows = $qa(".stop-row", container);
  rows.forEach((row) => {
    const btn = $q(".btn-remove", row);
    if (btn) {
      btn.style.visibility = rows.length > 1 ? "visible" : "hidden";
    }
  });
}

/**
 * Toggle settings panel visibility
 */
function toggleSettings() {
  const panel = $("settings-panel");
  const toggle = $("settings-toggle");

  if (!panel || !toggle) return;

  const isHidden = panel.classList.contains("hidden");
  toggleHidden(panel, isHidden);
  toggle.textContent = isHidden ? "⚙️ Hide Settings" : "⚙️ Settings";
}

/**
 * Handle "Use my location" button click
 * Gets current GPS position and reverse geocodes to address
 */
async function handleUseMyLocation() {
  const btn = $("use-my-location-btn");
  const input = $("current-location");
  const hint = $("current-location-hint");

  if (!btn || !input) return;

  // Check if geolocation is supported
  if (!navigator.geolocation) {
    showHint(hint, "Geolocation is not supported by your browser", "error");
    return;
  }

  // Show loading state
  btn.classList.add("loading");
  btn.textContent = "⏳";
  showHint(hint, "Getting your location...");

  try {
    // Get current position
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      });
    });

    const { latitude, longitude } = position.coords;

    // Reverse geocode to get address
    showHint(hint, "Looking up address...");

    try {
      const location = await reverseGeocode(latitude, longitude);

      // Build a readable address
      const address = formatReverseGeocodeAddress(location);
      input.value = address;

      showHint(hint, `📍 Location found: ${address}`, "success");
    } catch (geoError) {
      // If reverse geocode fails, just use coordinates
      input.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      showHint(hint, "Using GPS coordinates (address lookup unavailable)");
    }
  } catch (error) {
    let message = "Could not get your location";

    if (error.code === 1) {
      message = "Location access denied. Please enable location permissions.";
    } else if (error.code === 2) {
      message = "Location unavailable. Please try again.";
    } else if (error.code === 3) {
      message = "Location request timed out. Please try again.";
    }

    showHint(hint, message, "error");
  } finally {
    // Reset button state
    btn.classList.remove("loading");
    btn.textContent = "📍";
  }
}

/**
 * Handle form submission
 *
 * @param {Event} event
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  clearErrors();

  const formData = getFormData();
  const validation = validateFormData(formData);

  if (!validation.isValid) {
    displayErrors(validation.errors);
    return;
  }

  if (onSubmitCallback) {
    onSubmitCallback(formData);
  }
}

/**
 * Extract form data
 *
 * @returns {Object} Form data object
 */
export function getFormData() {
  const form = $("calculator-form");
  if (!form) return {};

  // Get stops
  const stopInputs = $qa(".stop-input", form);
  const stops = Array.from(stopInputs)
    .map((input) => input.value.trim())
    .filter((value) => value.length > 0);

  // Get wait time overrides
  const waitInputs = $qa(".wait-input", form);
  const waitOverrides = {};
  waitInputs.forEach((input, index) => {
    const value = input.value.trim();
    if (value !== "") {
      waitOverrides[index] = parseNumericInput(value);
    }
  });

  // Get bike efficiency
  const bikeModel = form.elements["bike-model"]?.value || "ybr125";
  const customEfficiency = parseNumericInput(
    form.elements["custom-efficiency"]?.value,
  );

  // Get traffic condition
  const trafficCondition =
    form.elements["traffic-condition"]?.value || detectTrafficCondition();

  return {
    currentLocation: form.elements["current-location"]?.value?.trim() || "",
    pickup: form.elements["pickup"]?.value?.trim() || "",
    stops,
    fare: parseNumericInput(form.elements["fare"]?.value),
    bikeModel,
    customEfficiency,
    petrolPrice: parseNumericInput(
      form.elements["petrol-price"]?.value,
      CONFIG.defaults.petrolPrice,
    ),
    waitOverrides,
    trafficCondition,
    // Note: token is now handled automatically by getValidToken() in main.js
  };
}

/**
 * Display validation errors
 *
 * @param {Object} errors
 */
function displayErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const input = $q(`[name="${field}"]`) || $(field);

    if (input) {
      input.classList.add("input-error");

      // Find or create hint element
      let hint = $(`${field}-hint`);
      if (!hint) {
        hint = document.createElement("div");
        hint.className = "input-hint error";
        hint.id = `${field}-hint`;
        input.parentNode.appendChild(hint);
      }
      hint.textContent = message;
      hint.classList.add("error");
    }
  });

  // Scroll to first error
  const firstError = $q(".input-error");
  if (firstError) {
    firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    firstError.focus();
  }
}

/**
 * Clear all validation errors
 */
function clearErrors() {
  $qa(".input-error").forEach((el) => {
    el.classList.remove("input-error");
  });

  $qa(".input-hint.error").forEach((el) => {
    el.textContent = "";
    el.classList.remove("error");
  });
}

/**
 * Update a stop's type badge based on detected building type
 *
 * @param {number} index
 * @param {string} buildingType
 * @param {string} label
 */
export function updateStopTypeBadge(index, buildingType, label) {
  const badge = $(`stop-type-${index}`);
  if (badge) {
    badge.textContent = label;
    badge.className = `stop-type-badge type-${buildingType}`;
  }
}

/**
 * Update pickup location type badge
 *
 * @param {string} buildingType
 * @param {string} label
 */
export function updatePickupTypeBadge(buildingType, label) {
  const badge = $("pickup-type-badge");
  if (badge) {
    badge.textContent = label;
    badge.className = `pickup-type-badge type-${buildingType}`;
    badge.classList.remove("hidden");
  }
}

/**
 * Set form to loading state
 *
 * @param {boolean} isLoading
 */
export function setFormLoading(isLoading) {
  const submitBtn = $("submit-btn");
  const form = $("calculator-form");

  if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading
      ? "Calculating..."
      : "Calculate Profitability";
  }

  if (form) {
    const inputs = $qa("input, select, button", form);
    inputs.forEach((input) => {
      if (input.id !== "submit-btn") {
        input.disabled = isLoading;
      }
    });
  }
}
