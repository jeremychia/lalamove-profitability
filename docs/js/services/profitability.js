/**
 * Profitability Calculation Service
 * Core business logic for determining order profitability
 * @module services/profitability
 */

import { CONFIG, PROFIT_THRESHOLDS } from "../config.js";

/**
 * @typedef {Object} FareBreakdown
 * @property {number} grossFare - Original offered fare
 * @property {number} commission - Commission deducted
 * @property {number} vat - VAT/GST deducted
 * @property {number} cpfWithholding - CPF withholding deducted
 * @property {number} platformFee - Platform fee offset deducted
 * @property {number} totalDeductions - Sum of all deductions
 * @property {number} netFare - Fare after all deductions
 */

/**
 * @typedef {Object} ProfitabilityResult
 * @property {number} fare - Offered fare (gross)
 * @property {number} netFare - Fare after Lalamove deductions
 * @property {FareBreakdown} fareBreakdown - Detailed fare breakdown
 * @property {number} fuelCost - Calculated fuel cost
 * @property {number} netProfit - Profit after fuel and deductions
 * @property {number} totalTimeMinutes - Total time for the order
 * @property {number} profitPerHour - Hourly profit rate
 * @property {string} rating - Rating key (excellent/good/okay/poor)
 * @property {Object} ratingDetails - Full rating information
 * @property {Object} breakdown - Detailed time/cost breakdown
 */

/**
 * Calculate fare breakdown after Lalamove deductions
 *
 * @param {number} grossFare - Original offered fare (includes platform fee offset)
 * @returns {FareBreakdown}
 */
export function calculateFareBreakdown(grossFare) {
  const { commissionRate, vatRate, cpfWithholdingRate, platformFeeOffset } =
    CONFIG.fareDeductions;

  // The gross fare includes the platform fee offset
  // Commission and VAT are calculated on the base fare (before platform fee was added)
  const baseFare = grossFare - platformFeeOffset;

  // Calculate each deduction on the base fare
  const commission = baseFare * commissionRate;
  const vat = baseFare * vatRate;
  const cpfWithholding = baseFare * cpfWithholdingRate;
  const platformFee = platformFeeOffset;

  const totalDeductions = commission + vat + cpfWithholding + platformFee;
  const netFare = grossFare - totalDeductions;

  return {
    grossFare,
    baseFare,
    commission,
    vat,
    cpfWithholding,
    platformFee,
    totalDeductions,
    netFare,
  };
}

/**
 * Calculate overall profitability of an order
 *
 * @param {Object} params
 * @param {number} params.fare - Offered fare in SGD
 * @param {number} params.fuelCost - Calculated fuel cost in SGD
 * @param {number} params.travelMinutes - Total travel time
 * @param {number} params.waitMinutes - Total wait time at delivery stops
 * @param {number} [params.pickupWaitMinutes] - Wait time at pickup
 * @returns {ProfitabilityResult}
 */
export function calculateProfitability({
  fare,
  fuelCost,
  travelMinutes,
  waitMinutes,
  pickupWaitMinutes = CONFIG.defaults.pickupWaitMinutes,
}) {
  // Calculate fare breakdown after Lalamove deductions
  const fareBreakdown = calculateFareBreakdown(fare);
  const netFare = fareBreakdown.netFare;

  // Calculate net profit (after deductions AND fuel)
  const netProfit = netFare - fuelCost;

  // Calculate total time
  const totalTimeMinutes = travelMinutes + waitMinutes + pickupWaitMinutes;
  const totalTimeHours = totalTimeMinutes / 60;

  // Calculate hourly rate
  const profitPerHour = totalTimeHours > 0 ? netProfit / totalTimeHours : 0;

  // Determine rating
  const rating = getRating(profitPerHour);
  const ratingDetails = PROFIT_THRESHOLDS[rating];

  return {
    fare,
    netFare,
    fareBreakdown,
    fuelCost,
    netProfit,
    totalTimeMinutes,
    profitPerHour,
    rating,
    ratingDetails,
    breakdown: {
      travelMinutes,
      waitMinutes,
      pickupWaitMinutes,
      fuelCostPercentage: netFare > 0 ? (fuelCost / netFare) * 100 : 0,
    },
  };
}

/**
 * Determine profitability rating based on hourly rate
 *
 * @param {number} profitPerHour
 * @returns {string} Rating key
 */
function getRating(profitPerHour) {
  if (profitPerHour >= PROFIT_THRESHOLDS.excellent.min) return "excellent";
  if (profitPerHour >= PROFIT_THRESHOLDS.good.min) return "good";
  if (profitPerHour >= PROFIT_THRESHOLDS.okay.min) return "okay";
  return "poor";
}

/**
 * Compare profitability of two orders
 * Useful for deciding between multiple available orders
 *
 * @param {ProfitabilityResult} order1
 * @param {ProfitabilityResult} order2
 * @returns {Object} Comparison result
 */
export function compareOrders(order1, order2) {
  const profitDiff = order1.profitPerHour - order2.profitPerHour;
  const timeDiff = order1.totalTimeMinutes - order2.totalTimeMinutes;

  return {
    betterOrder: profitDiff >= 0 ? 1 : 2,
    profitPerHourDifference: Math.abs(profitDiff),
    timeDifference: timeDiff,
    recommendation:
      profitDiff > 5
        ? "Strong preference for order 1"
        : profitDiff > 2
          ? "Slight preference for order 1"
          : profitDiff > -2
            ? "Similar profitability"
            : profitDiff > -5
              ? "Slight preference for order 2"
              : "Strong preference for order 2",
  };
}

/**
 * Calculate minimum acceptable fare for a route
 * Based on target hourly rate
 *
 * @param {number} fuelCost - Estimated fuel cost
 * @param {number} totalTimeMinutes - Estimated total time
 * @param {number} targetHourlyRate - Desired $/hour
 * @returns {number} Minimum fare
 */
export function calculateMinimumFare(
  fuelCost,
  totalTimeMinutes,
  targetHourlyRate,
) {
  const timeHours = totalTimeMinutes / 60;
  const desiredProfit = targetHourlyRate * timeHours;
  return fuelCost + desiredProfit;
}

/**
 * Analyze what-if scenarios for different fares
 *
 * @param {Object} baseParams - Base calculation parameters (without fare)
 * @param {number[]} fareOptions - Array of fare options to analyze
 * @returns {Array} Array of profitability results
 */
export function analyzeFareScenarios(baseParams, fareOptions) {
  return fareOptions.map((fare) => ({
    fare,
    result: calculateProfitability({ ...baseParams, fare }),
  }));
}

/**
 * Get profitability insights and recommendations
 *
 * @param {ProfitabilityResult} result
 * @returns {Object} Insights object
 */
export function getInsights(result) {
  const insights = [];
  const recommendations = [];

  // Fuel cost analysis
  if (result.breakdown.fuelCostPercentage > 20) {
    insights.push({
      type: "warning",
      message: `Fuel cost is ${result.breakdown.fuelCostPercentage.toFixed(
        1,
      )}% of fare - quite high`,
    });
    recommendations.push("Consider avoiding long-distance, low-fare orders");
  }

  // Time analysis
  if (result.breakdown.waitMinutes > result.breakdown.travelMinutes) {
    insights.push({
      type: "info",
      message:
        "Wait time exceeds travel time - multiple stops or slow handovers",
    });
    recommendations.push("Wait times are eating into your earnings");
  }

  // Profitability analysis
  if (result.rating === "poor") {
    insights.push({
      type: "warning",
      message: `At $${result.profitPerHour.toFixed(
        2,
      )}/hr, this is below minimum wage`,
    });
    recommendations.push(
      "Consider declining unless it positions you well for better orders",
    );
  } else if (result.rating === "excellent") {
    insights.push({
      type: "success",
      message: "Excellent hourly rate - prioritize this order",
    });
  }

  // Minimum fare for "good" rating
  const minFareForGood = calculateMinimumFare(
    result.fuelCost,
    result.totalTimeMinutes,
    PROFIT_THRESHOLDS.good.min,
  );

  if (
    result.fare < minFareForGood &&
    result.rating !== "excellent" &&
    result.rating !== "good"
  ) {
    recommendations.push(
      `Fare would need to be $${minFareForGood.toFixed(2)} for a "Good" rating`,
    );
  }

  return {
    insights,
    recommendations,
    minimumFareForGood: minFareForGood,
  };
}

/**
 * Get all profit thresholds
 * @returns {Object}
 */
export function getProfitThresholds() {
  return { ...PROFIT_THRESHOLDS };
}
