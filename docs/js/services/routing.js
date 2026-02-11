/**
 * Routing Service
 * Calculates routes and distances between multiple points
 * @module services/routing
 */

import { getRoute, calculateStraightLineDistance } from "../api/onemap.js";
import { CONFIG, getTrafficSpeed, detectTrafficCondition } from "../config.js";

/**
 * @typedef {Object} RouteLeg
 * @property {string} from - Starting address
 * @property {string} to - Ending address
 * @property {number} distanceKm - Distance in kilometers
 * @property {number} timeMinutes - Estimated travel time in minutes
 * @property {boolean} isEstimate - True if using fallback calculation
 */

/**
 * @typedef {Object} FullRoute
 * @property {RouteLeg[]} legs - Individual route segments
 * @property {number} totalDistanceKm - Total distance
 * @property {number} totalTravelMinutes - Total travel time
 * @property {boolean} hasEstimates - True if any leg used fallback
 */

/**
 * Calculate route through multiple points
 * Handles API failures gracefully with fallback calculations
 *
 * @param {Array<GeocodedLocation>} points - Array of geocoded locations in order
 * @param {string} [token] - Optional API token
 * @param {string} [trafficCondition] - Traffic condition: 'light', 'normal', or 'heavy'
 * @returns {Promise<FullRoute>}
 */
export async function calculateMultiStopRoute(
  points,
  token = null,
  trafficCondition = null,
) {
  if (points.length < 2) {
    throw new Error("Need at least 2 points for a route");
  }

  // Use provided traffic condition or auto-detect
  const traffic = trafficCondition || detectTrafficCondition();

  const legs = [];
  let hasEstimates = false;

  // Calculate each leg sequentially to respect API rate limits
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];

    try {
      const leg = await calculateRouteLeg(start, end, token, traffic);
      legs.push(leg);
      if (leg.isEstimate) hasEstimates = true;
    } catch (error) {
      // Fallback to estimate if API fails
      console.warn(
        `Route API failed for leg ${i + 1}, using estimate:`,
        error.message,
      );
      const leg = estimateRouteLeg(start, end, traffic);
      legs.push(leg);
      hasEstimates = true;
    }
  }

  return {
    legs,
    totalDistanceKm: sumBy(legs, "distanceKm"),
    totalTravelMinutes: sumBy(legs, "timeMinutes"),
    hasEstimates,
    trafficCondition: traffic,
  };
}

/**
 * Calculate a single route leg using the API
 *
 * @param {GeocodedLocation} start
 * @param {GeocodedLocation} end
 * @param {string} [token]
 * @param {string} [trafficCondition]
 * @returns {Promise<RouteLeg>}
 */
async function calculateRouteLeg(start, end, token, trafficCondition) {
  const routeData = await getRoute(
    { lat: start.lat, lng: start.lng },
    { lat: end.lat, lng: end.lng },
    token,
  );

  const distanceKm = routeData.route_summary.total_distance / 1000;

  // API returns typical time, but we adjust based on traffic condition
  // API time assumes average conditions, so we scale it
  const apiTimeMinutes = routeData.route_summary.total_time / 60;
  const trafficSpeed = getTrafficSpeed(trafficCondition);
  const normalSpeed = CONFIG.defaults.averageSpeedKmH;

  // Scale time based on traffic: slower speed = more time
  const adjustedTimeMinutes = apiTimeMinutes * (normalSpeed / trafficSpeed);

  return {
    from: start.address,
    to: end.address,
    distanceKm,
    timeMinutes: adjustedTimeMinutes,
    isEstimate: false,
  };
}

/**
 * Estimate a route leg using straight-line distance
 * Applies a 1.4x multiplier for road vs straight-line distance
 *
 * @param {GeocodedLocation} start
 * @param {GeocodedLocation} end
 * @param {string} [trafficCondition]
 * @returns {RouteLeg}
 */
function estimateRouteLeg(start, end, trafficCondition) {
  const straightLineKm = calculateStraightLineDistance(
    { lat: start.lat, lng: start.lng },
    { lat: end.lat, lng: end.lng },
  );

  // Road distance is typically 1.3-1.5x straight line in urban areas
  const estimatedDistanceKm = straightLineKm * 1.4;

  // Use traffic-adjusted speed
  const speed = getTrafficSpeed(trafficCondition);
  const estimatedTimeMinutes = (estimatedDistanceKm / speed) * 60;

  return {
    from: start.address,
    to: end.address,
    distanceKm: estimatedDistanceKm,
    timeMinutes: estimatedTimeMinutes,
    isEstimate: true,
  };
}

/**
 * Calculate distance from current location to pickup only
 * Useful for quick "should I take this order" decisions
 *
 * @param {GeocodedLocation} currentLocation
 * @param {GeocodedLocation} pickup
 * @param {string} [token]
 * @returns {Promise<RouteLeg>}
 */
export async function calculateDistanceToPickup(
  currentLocation,
  pickup,
  token = null,
) {
  try {
    return await calculateRouteLeg(currentLocation, pickup, token);
  } catch {
    return estimateRouteLeg(currentLocation, pickup);
  }
}

/**
 * Analyze route efficiency
 * Compares total route distance vs point-to-point distance
 *
 * @param {FullRoute} route
 * @param {GeocodedLocation} start - First point
 * @param {GeocodedLocation} end - Last point
 * @returns {Object} Efficiency analysis
 */
export function analyzeRouteEfficiency(route, start, end) {
  const directDistance = calculateStraightLineDistance(
    { lat: start.lat, lng: start.lng },
    { lat: end.lat, lng: end.lng },
  );

  const efficiencyRatio = directDistance / route.totalDistanceKm;

  return {
    directDistanceKm: directDistance,
    actualDistanceKm: route.totalDistanceKm,
    efficiencyRatio,
    isEfficient: efficiencyRatio > 0.6, // Route is reasonably direct
    analysis:
      efficiencyRatio > 0.8
        ? "Very efficient route"
        : efficiencyRatio > 0.6
          ? "Reasonably efficient"
          : efficiencyRatio > 0.4
            ? "Some backtracking"
            : "Significant detours - consider if worth it",
  };
}

/**
 * Sum a numeric property across an array of objects
 * @param {Array} arr
 * @param {string} key
 * @returns {number}
 */
function sumBy(arr, key) {
  return arr.reduce((sum, item) => sum + (item[key] || 0), 0);
}
