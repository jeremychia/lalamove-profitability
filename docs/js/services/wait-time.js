/**
 * Wait Time Estimation Service
 * Smart estimation of wait times based on building types
 * @module services/wait-time
 */

import { WAIT_TIMES } from "../config.js";

/**
 * @typedef {Object} WaitEstimate
 * @property {number} minutes - Estimated wait time
 * @property {string} buildingType - Building type key
 * @property {string} label - Human-readable building type
 * @property {string} description - Explanation of the estimate
 * @property {boolean} isOverride - True if manually overridden
 */

/**
 * @typedef {Object} TotalWaitTime
 * @property {number} total - Total wait time in minutes
 * @property {WaitEstimate[]} breakdown - Per-stop breakdown
 * @property {number} pickupWait - Wait time at pickup
 */

/**
 * Estimate wait time for a single location based on building type
 *
 * @param {string} buildingType - Building type key from geocoding
 * @returns {WaitEstimate}
 */
export function estimateWaitTime(buildingType) {
  const config = WAIT_TIMES[buildingType] || WAIT_TIMES.default;

  return {
    minutes: config.minutes,
    buildingType,
    label: config.label,
    description: config.description,
    isOverride: false,
  };
}

/**
 * Calculate total wait time for multiple stops
 * Supports manual overrides for individual stops
 *
 * @param {Array<GeocodedLocation>} stops - Array of stop locations
 * @param {Object} [overrides={}] - Manual overrides { [stopIndex]: minutes }
 * @param {number} [pickupWaitMinutes=5] - Wait time at pickup point
 * @returns {TotalWaitTime}
 */
export function calculateTotalWaitTime(
  stops,
  overrides = {},
  pickupWaitMinutes = 5,
) {
  const breakdown = stops.map((stop, index) => {
    // Check for manual override
    if (overrides[index] !== undefined && overrides[index] !== null) {
      const config = WAIT_TIMES[stop.buildingType] || WAIT_TIMES.default;
      return {
        minutes: overrides[index],
        buildingType: stop.buildingType,
        label: config.label,
        description: "Manual override",
        isOverride: true,
      };
    }

    return estimateWaitTime(stop.buildingType);
  });

  const total = breakdown.reduce((sum, item) => sum + item.minutes, 0);

  return {
    total,
    breakdown,
    pickupWait: pickupWaitMinutes,
  };
}

/**
 * Get wait time configuration for a building type
 *
 * @param {string} buildingType
 * @returns {Object}
 */
export function getWaitTimeConfig(buildingType) {
  return WAIT_TIMES[buildingType] || WAIT_TIMES.default;
}

/**
 * Get all wait time configurations
 * @returns {Object}
 */
export function getAllWaitTimes() {
  return { ...WAIT_TIMES };
}

/**
 * Suggest wait time adjustments based on time of day
 * Peak hours typically mean longer waits
 *
 * @param {WaitEstimate} estimate - Base estimate
 * @param {Date} [datetime=new Date()] - Time of delivery
 * @returns {WaitEstimate} Adjusted estimate
 */
export function adjustForTimeOfDay(estimate, datetime = new Date()) {
  const hour = datetime.getHours();

  // Lunch rush (11:30 - 13:30)
  const isLunchRush = hour >= 11 && hour <= 13;

  // Dinner rush (17:30 - 20:00)
  const isDinnerRush = hour >= 17 && hour <= 20;

  // Office hours end (17:00 - 18:30) - lifts are busy
  const isOfficeRush = hour >= 17 && hour <= 18;

  let adjustment = 0;
  let reason = "";

  if (estimate.buildingType === "office" && isOfficeRush) {
    adjustment = 3;
    reason = "Office rush hour - busy lifts";
  } else if (
    estimate.buildingType === "mall" &&
    (isLunchRush || isDinnerRush)
  ) {
    adjustment = 2;
    reason = "Peak dining hours";
  } else if (estimate.buildingType === "condo" && isDinnerRush) {
    adjustment = 2;
    reason = "Residents returning home";
  }

  if (adjustment === 0) {
    return estimate;
  }

  return {
    ...estimate,
    minutes: estimate.minutes + adjustment,
    description: `${estimate.description} (+${adjustment} min: ${reason})`,
  };
}

/**
 * Calculate confidence level for wait time estimate
 * Based on building type reliability
 *
 * @param {string} buildingType
 * @returns {Object} Confidence info
 */
export function getEstimateConfidence(buildingType) {
  const confidenceLevels = {
    hdb: {
      level: "high",
      percentage: 85,
      reason: "HDB void deck handovers are predictable",
    },
    landed: {
      level: "high",
      percentage: 90,
      reason: "Direct handover at gate",
    },
    condo: {
      level: "medium",
      percentage: 70,
      reason: "Security procedures vary",
    },
    office: {
      level: "low",
      percentage: 55,
      reason: "Highly variable - depends on floor, security",
    },
    mall: {
      level: "low",
      percentage: 50,
      reason: "Navigation time varies greatly",
    },
    industrial: {
      level: "medium",
      percentage: 65,
      reason: "Loading bay access varies",
    },
    default: { level: "low", percentage: 50, reason: "Unknown location type" },
  };

  return confidenceLevels[buildingType] || confidenceLevels.default;
}
