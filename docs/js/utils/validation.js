/**
 * Input Validation Utilities
 * @module utils/validation
 */

import { CONFIG } from "../config.js";

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid
 * @property {string|null} error - Error message if invalid
 */

/**
 * Validate an address input (postal code or address string)
 *
 * @param {string} input
 * @returns {ValidationResult}
 */
export function validateAddressInput(input) {
  if (!input || typeof input !== "string") {
    return { isValid: false, error: "Address is required" };
  }

  const cleaned = input.trim();

  if (cleaned.length < 2) {
    return { isValid: false, error: "Address is too short" };
  }

  if (cleaned.length > 200) {
    return { isValid: false, error: "Address is too long" };
  }

  return { isValid: true, error: null };
}

/**
 * Validate fare amount
 *
 * @param {number|string} fare
 * @returns {ValidationResult}
 */
export function validateFare(fare) {
  const numFare = typeof fare === "string" ? parseFloat(fare) : fare;

  if (isNaN(numFare)) {
    return { isValid: false, error: "Fare must be a number" };
  }

  if (numFare < CONFIG.limits.minFare) {
    return { isValid: false, error: `Fare cannot be negative` };
  }

  if (numFare > CONFIG.limits.maxFare) {
    return {
      isValid: false,
      error: `Fare seems too high (max ${CONFIG.limits.maxFare})`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate petrol price
 *
 * @param {number|string} price
 * @returns {ValidationResult}
 */
export function validatePetrolPrice(price) {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;

  if (isNaN(numPrice)) {
    return { isValid: false, error: "Price must be a number" };
  }

  if (numPrice <= 0) {
    return { isValid: false, error: "Price must be positive" };
  }

  if (numPrice > 10) {
    return { isValid: false, error: "Price seems unrealistic (max $10/L)" };
  }

  return { isValid: true, error: null };
}

/**
 * Validate fuel efficiency
 *
 * @param {number|string} efficiency
 * @returns {ValidationResult}
 */
export function validateEfficiency(efficiency) {
  const numEff =
    typeof efficiency === "string" ? parseFloat(efficiency) : efficiency;

  if (isNaN(numEff)) {
    return { isValid: false, error: "Efficiency must be a number" };
  }

  if (numEff <= 0) {
    return { isValid: false, error: "Efficiency must be positive" };
  }

  if (numEff > 100) {
    return {
      isValid: false,
      error: "Efficiency seems unrealistic (max 100 km/L)",
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate wait time
 *
 * @param {number|string} minutes
 * @returns {ValidationResult}
 */
export function validateWaitTime(minutes) {
  const numMins = typeof minutes === "string" ? parseFloat(minutes) : minutes;

  if (isNaN(numMins)) {
    return { isValid: false, error: "Wait time must be a number" };
  }

  if (numMins < 0) {
    return { isValid: false, error: "Wait time cannot be negative" };
  }

  if (numMins > 60) {
    return { isValid: false, error: "Wait time seems too long (max 60 min)" };
  }

  return { isValid: true, error: null };
}

/**
 * Validate entire form data
 *
 * @param {Object} formData
 * @returns {Object} { isValid, errors }
 */
export function validateFormData(formData) {
  const errors = {};

  // Current location
  const currentValidation = validateAddressInput(formData.currentLocation);
  if (!currentValidation.isValid) {
    errors.currentLocation = currentValidation.error;
  }

  // Pickup
  const pickupValidation = validateAddressInput(formData.pickup);
  if (!pickupValidation.isValid) {
    errors.pickup = pickupValidation.error;
  }

  // At least one stop
  if (!formData.stops || formData.stops.length === 0) {
    errors.stops = "At least one delivery stop is required";
  } else {
    // Validate each stop
    formData.stops.forEach((stop, index) => {
      const stopValidation = validateAddressInput(stop);
      if (!stopValidation.isValid) {
        errors[`stop_${index}`] = stopValidation.error;
      }
    });
  }

  // Fare
  const fareValidation = validateFare(formData.fare);
  if (!fareValidation.isValid) {
    errors.fare = fareValidation.error;
  }

  // Petrol price
  const petrolValidation = validatePetrolPrice(formData.petrolPrice);
  if (!petrolValidation.isValid) {
    errors.petrolPrice = petrolValidation.error;
  }

  // Efficiency (only if custom)
  if (formData.bikeModel === "custom") {
    const effValidation = validateEfficiency(formData.customEfficiency);
    if (!effValidation.isValid) {
      errors.customEfficiency = effValidation.error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Parse numeric input safely
 *
 * @param {string|number} value
 * @param {number} defaultValue
 * @returns {number}
 */
export function parseNumericInput(value, defaultValue = 0) {
  if (typeof value === "number" && !isNaN(value)) {
    return value;
  }

  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}
