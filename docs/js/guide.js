/**
 * Efficiency Guide JavaScript
 * Populates the guide page with calculated efficiency data
 * @module guide
 */

import {
  CONFIG,
  PROFIT_THRESHOLDS,
  WAIT_TIMES,
  BIKE_MODELS,
} from "./config.js";
import { calculateFareBreakdown } from "./services/profitability.js";

/**
 * Calculate net value from additional stop fare
 */
function calculateNetFromGross(grossAmount) {
  const { commissionRate, vatRate, platformFeeOffset } = CONFIG.fareDeductions;
  // Additional stop fare is part of gross, so deductions apply
  // But platform fee offset is fixed $0.50, not per-stop
  // So for additional stops, we only deduct commission + VAT
  const baseFare = grossAmount;
  const commission = baseFare * commissionRate;
  const vat = baseFare * vatRate;
  return grossAmount - commission - vat;
}

/**
 * Calculate effective hourly rate for additional stop
 */
function calculateStopHourlyRate(netAdded, waitMinutes) {
  const hours = waitMinutes / 60;
  return hours > 0 ? netAdded / hours : 0;
}

/**
 * Populate the efficiency table
 */
function populateEfficiencyTable() {
  const tbody = document.querySelector("#efficiency-table tbody");
  if (!tbody) return;

  const additionalStopFare = CONFIG.multiStop.additionalStopFare;
  const waitTimes = [3, 5, 7, 10]; // Different wait scenarios

  // Generate rows for 1-4 additional stops
  const rows = [];

  for (let stops = 1; stops <= 4; stops++) {
    const addedFare = stops * additionalStopFare;
    const netAdded = calculateNetFromGross(addedFare);

    // Use average wait time (5 min)
    const avgWaitMinutes = 5 * stops;
    const hourlyRate = calculateStopHourlyRate(netAdded, avgWaitMinutes);

    rows.push(`
      <tr>
        <td>+${stops}</td>
        <td class="fare">+$${addedFare.toFixed(2)}</td>
        <td class="net">+$${netAdded.toFixed(2)}</td>
        <td class="time">~${avgWaitMinutes} min</td>
        <td class="rate ${
          hourlyRate >= 20 ? "excellent" : hourlyRate >= 15 ? "good" : "okay"
        }">
          $${hourlyRate.toFixed(0)}/hr
        </td>
      </tr>
    `);
  }

  tbody.innerHTML = rows.join("");
}

/**
 * Populate scenario comparison grid
 */
function populateScenariosGrid() {
  const grid = document.getElementById("scenarios-grid");
  if (!grid) return;

  // Get default bike efficiency
  const defaultBike = BIKE_MODELS.find((b) => b.id === "ybr125");
  const efficiency = defaultBike?.efficiency || 45;
  const petrolPrice = CONFIG.defaults.petrolPrice;

  // Scenario definitions
  const scenarios = [
    {
      name: "Short Single",
      icon: "📍",
      distance: 3,
      fare: 7,
      stops: 1,
      waitPerStop: 5,
      travelTime: 8,
    },
    {
      name: "Short Multi (2 stops)",
      icon: "📍📍",
      distance: 4,
      fare: 10,
      stops: 2,
      waitPerStop: 5,
      travelTime: 12,
    },
    {
      name: "Short Multi (3 stops)",
      icon: "📍📍📍",
      distance: 5,
      fare: 13,
      stops: 3,
      waitPerStop: 5,
      travelTime: 15,
    },
    {
      name: "Medium Single",
      icon: "🗺️",
      distance: 8,
      fare: 10,
      stops: 1,
      waitPerStop: 5,
      travelTime: 20,
    },
    {
      name: "Long Single",
      icon: "🌏",
      distance: 15,
      fare: 15,
      stops: 1,
      waitPerStop: 5,
      travelTime: 35,
    },
    {
      name: "Long Multi (2 stops)",
      icon: "🌏📍",
      distance: 18,
      fare: 18,
      stops: 2,
      waitPerStop: 5,
      travelTime: 45,
    },
  ];

  const cards = scenarios.map((s) => {
    // Calculate fuel cost
    const fuelCost = (s.distance / efficiency) * petrolPrice;

    // Calculate total time
    const totalTime =
      s.travelTime +
      s.waitPerStop * s.stops +
      CONFIG.defaults.pickupWaitMinutes;

    // Calculate fare breakdown
    const breakdown = calculateFareBreakdown(s.fare);
    const netProfit = breakdown.netFare - fuelCost;
    const hourlyRate = (netProfit / totalTime) * 60;

    // Determine rating
    let ratingClass = "poor";
    let ratingEmoji = "❌";
    if (hourlyRate >= 20) {
      ratingClass = "excellent";
      ratingEmoji = "🔥";
    } else if (hourlyRate >= 15) {
      ratingClass = "good";
      ratingEmoji = "✅";
    } else if (hourlyRate >= 10) {
      ratingClass = "okay";
      ratingEmoji = "⚠️";
    }

    return `
      <div class="scenario-card ${ratingClass}">
        <div class="scenario-header">
          <span class="scenario-icon">${s.icon}</span>
          <h3>${s.name}</h3>
        </div>
        <div class="scenario-details">
          <div class="detail-row">
            <span class="label">Distance:</span>
            <span class="value">${s.distance} km</span>
          </div>
          <div class="detail-row">
            <span class="label">Offered Fare:</span>
            <span class="value">$${s.fare.toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Net Fare:</span>
            <span class="value">$${breakdown.netFare.toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Fuel Cost:</span>
            <span class="value">$${fuelCost.toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Total Time:</span>
            <span class="value">${totalTime} min</span>
          </div>
        </div>
        <div class="scenario-result ${ratingClass}">
          <span class="result-emoji">${ratingEmoji}</span>
          <span class="result-rate">$${hourlyRate.toFixed(0)}/hr</span>
        </div>
      </div>
    `;
  });

  grid.innerHTML = cards.join("");
}

/**
 * Populate rating scale
 */
function populateRatingScale() {
  const container = document.getElementById("rating-scale");
  if (!container) return;

  const ratings = Object.entries(PROFIT_THRESHOLDS).map(([key, data]) => {
    const max =
      key === "excellent"
        ? "+"
        : key === "good"
          ? PROFIT_THRESHOLDS.excellent.min - 1
          : key === "okay"
            ? PROFIT_THRESHOLDS.good.min - 1
            : PROFIT_THRESHOLDS.okay.min - 1;

    return `
      <div class="rating-item ${key}">
        <span class="rating-emoji">${data.emoji}</span>
        <span class="rating-label">${data.label.replace(
          data.emoji + " ",
          "",
        )}</span>
        <span class="rating-range">$${data.min}${
          max === "+" ? "+" : "-" + max
        }/hr</span>
      </div>
    `;
  });

  container.innerHTML = ratings.join("");
}

/**
 * Populate wait times grid
 */
function populateWaitTimesGrid() {
  const grid = document.getElementById("wait-times-grid");
  if (!grid) return;

  const items = Object.entries(WAIT_TIMES)
    .filter(([key]) => key !== "default")
    .map(([key, data]) => {
      const speedClass =
        data.minutes <= 3 ? "fast" : data.minutes >= 8 ? "slow" : "medium";

      return `
      <div class="wait-time-item ${speedClass}">
        <div class="wait-type">${data.label}</div>
        <div class="wait-minutes">${data.minutes} min</div>
        <div class="wait-desc">${data.description}</div>
      </div>
    `;
    });

  grid.innerHTML = items.join("");
}

/**
 * Initialize guide page
 */
function init() {
  populateEfficiencyTable();
  populateScenariosGrid();
  populateRatingScale();
  populateWaitTimesGrid();
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
