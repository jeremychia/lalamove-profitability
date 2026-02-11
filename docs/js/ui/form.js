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
import { storeToken, getStoredToken } from "../api/onemap.js";

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

  // Initialize traffic condition selector
  initTrafficSelect();

  // Initialize bike model dropdown
  initBikeSelect();

  // Initialize petrol price links
  initPetrolLinks();

  // Initialize stops container
  initStopsContainer();

  // Initialize token field
  initTokenField();

  // Setup form submission
  const form = document.getElementById("calculator-form");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }

  // Setup add stop button
  const addStopBtn = document.getElementById("add-stop-btn");
  if (addStopBtn) {
    addStopBtn.addEventListener("click", addStop);
  }

  // Setup bike model change handler
  const bikeSelect = document.getElementById("bike-model");
  if (bikeSelect) {
    bikeSelect.addEventListener("change", handleBikeModelChange);
  }

  // Setup settings toggle
  const settingsToggle = document.getElementById("settings-toggle");
  if (settingsToggle) {
    settingsToggle.addEventListener("click", toggleSettings);
  }
}

/**
 * Initialize bike model select dropdown
 */
function initBikeSelect() {
  const select = document.getElementById("bike-model");
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
  const select = document.getElementById("traffic-condition");
  const hint = document.getElementById("traffic-hint");
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
 * Initialize petrol price links
 */
function initPetrolLinks() {
  const container = document.getElementById("petrol-links");
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
  const container = document.getElementById("stops-container");
  if (!container) return;

  // Clear and add first stop
  container.innerHTML = "";
  addStop();
}

/**
 * Initialize API token field
 */
function initTokenField() {
  const tokenInput = document.getElementById("api-token");
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
  const select = document.getElementById("bike-model");
  const customGroup = document.getElementById("custom-efficiency-group");

  if (!select || !customGroup) return;

  const isCustom = select.value === "custom";
  customGroup.style.display = isCustom ? "block" : "none";

  const customInput = document.getElementById("custom-efficiency");
  if (customInput) {
    customInput.required = isCustom;
  }
}

/**
 * Add a new stop input
 */
function addStop() {
  const container = document.getElementById("stops-container");
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
  const container = document.getElementById("stops-container");
  if (!container) return;

  const rows = container.querySelectorAll(".stop-row");
  if (rows.length <= 1) {
    alert("At least one delivery stop is required");
    return;
  }

  const rowToRemove = container.querySelector(
    `.stop-row[data-index="${index}"]`,
  );
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
  const container = document.getElementById("stops-container");
  if (!container) return;

  const rows = container.querySelectorAll(".stop-row");
  rows.forEach((row, index) => {
    row.dataset.index = index + 1;
    const numberEl = row.querySelector(".stop-number");
    if (numberEl) {
      numberEl.textContent = index + 1;
    }
  });
}

/**
 * Update remove button visibility
 */
function updateRemoveButtons() {
  const container = document.getElementById("stops-container");
  if (!container) return;

  const rows = container.querySelectorAll(".stop-row");
  rows.forEach((row) => {
    const btn = row.querySelector(".btn-remove");
    if (btn) {
      btn.style.visibility = rows.length > 1 ? "visible" : "hidden";
    }
  });
}

/**
 * Toggle settings panel visibility
 */
function toggleSettings() {
  const panel = document.getElementById("settings-panel");
  const toggle = document.getElementById("settings-toggle");

  if (!panel || !toggle) return;

  const isHidden = panel.classList.contains("hidden");
  panel.classList.toggle("hidden");
  toggle.textContent = isHidden ? "⚙️ Hide Settings" : "⚙️ Settings";
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
  const form = document.getElementById("calculator-form");
  if (!form) return {};

  // Get stops
  const stopInputs = form.querySelectorAll(".stop-input");
  const stops = Array.from(stopInputs)
    .map((input) => input.value.trim())
    .filter((value) => value.length > 0);

  // Get wait time overrides
  const waitInputs = form.querySelectorAll(".wait-input");
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
    const input =
      document.querySelector(`[name="${field}"]`) ||
      document.getElementById(field);

    if (input) {
      input.classList.add("input-error");

      // Find or create hint element
      let hint = document.getElementById(`${field}-hint`);
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
  const firstError = document.querySelector(".input-error");
  if (firstError) {
    firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    firstError.focus();
  }
}

/**
 * Clear all validation errors
 */
function clearErrors() {
  document.querySelectorAll(".input-error").forEach((el) => {
    el.classList.remove("input-error");
  });

  document.querySelectorAll(".input-hint.error").forEach((el) => {
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
  const badge = document.getElementById(`stop-type-${index}`);
  if (badge) {
    badge.textContent = label;
    badge.className = `stop-type-badge type-${buildingType}`;
  }
}

/**
 * Set form to loading state
 *
 * @param {boolean} isLoading
 */
export function setFormLoading(isLoading) {
  const submitBtn = document.getElementById("submit-btn");
  const form = document.getElementById("calculator-form");

  if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading
      ? "Calculating..."
      : "Calculate Profitability";
  }

  if (form) {
    const inputs = form.querySelectorAll("input, select, button");
    inputs.forEach((input) => {
      if (input.id !== "submit-btn") {
        input.disabled = isLoading;
      }
    });
  }
}
