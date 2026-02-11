/**
 * Fuel Cost Calculation Service
 * Handles fuel efficiency lookups and cost calculations
 * @module services/fuel
 */

import { BIKE_MODELS } from "../config.js";

/**
 * @typedef {Object} FuelCost
 * @property {number} litresUsed - Amount of fuel consumed
 * @property {number} cost - Total cost in SGD
 * @property {number} costPerKm - Cost per kilometer
 */

/**
 * Calculate fuel cost for a given distance
 *
 * @param {number} distanceKm - Total distance in kilometers
 * @param {number} efficiencyKmPerL - Fuel efficiency in km/L
 * @param {number} pricePerLitre - Petrol price in $/L
 * @returns {FuelCost}
 */
export function calculateFuelCost(distanceKm, efficiencyKmPerL, pricePerLitre) {
  if (!isValidEfficiency(efficiencyKmPerL)) {
    throw new Error(`Invalid fuel efficiency: ${efficiencyKmPerL}`);
  }

  if (pricePerLitre <= 0) {
    throw new Error(`Invalid petrol price: ${pricePerLitre}`);
  }

  const litresUsed = distanceKm / efficiencyKmPerL;
  const cost = litresUsed * pricePerLitre;
  const costPerKm = cost / distanceKm;

  return {
    litresUsed,
    cost,
    costPerKm,
  };
}

/**
 * Get fuel efficiency for a bike model by ID
 *
 * @param {string} bikeId - Bike model ID
 * @returns {number|null} Efficiency in km/L, or null if custom
 */
export function getBikeEfficiency(bikeId) {
  const bike = BIKE_MODELS.find((b) => b.id === bikeId);
  return bike?.efficiency ?? null;
}

/**
 * Get bike model details by ID
 *
 * @param {string} bikeId
 * @returns {Object|null}
 */
export function getBikeModel(bikeId) {
  return BIKE_MODELS.find((b) => b.id === bikeId) || null;
}

/**
 * Validate fuel efficiency value
 * Reasonable range for motorcycles: 20-70 km/L
 *
 * @param {number} efficiency
 * @returns {boolean}
 */
export function isValidEfficiency(efficiency) {
  return typeof efficiency === "number" && efficiency > 0 && efficiency <= 100;
}

/**
 * Calculate break-even fare for a trip
 * The minimum fare needed to cover fuel costs
 *
 * @param {number} distanceKm
 * @param {number} efficiencyKmPerL
 * @param {number} pricePerLitre
 * @param {number} [marginPercent=0] - Desired profit margin
 * @returns {number} Minimum fare in SGD
 */
export function calculateBreakEvenFare(
  distanceKm,
  efficiencyKmPerL,
  pricePerLitre,
  marginPercent = 0,
) {
  const { cost } = calculateFuelCost(
    distanceKm,
    efficiencyKmPerL,
    pricePerLitre,
  );
  return cost * (1 + marginPercent / 100);
}

/**
 * Estimate fuel cost for common distances
 * Useful for quick reference
 *
 * @param {number} efficiencyKmPerL
 * @param {number} pricePerLitre
 * @returns {Object} Cost estimates for various distances
 */
export function getFuelCostEstimates(efficiencyKmPerL, pricePerLitre) {
  const distances = [5, 10, 15, 20, 30, 50];

  return distances.reduce((acc, km) => {
    acc[`${km}km`] = calculateFuelCost(
      km,
      efficiencyKmPerL,
      pricePerLitre,
    ).cost;
    return acc;
  }, {});
}

/**
 * Get all available bike models
 * @returns {Array}
 */
export function getAllBikeModels() {
  return [...BIKE_MODELS];
}
