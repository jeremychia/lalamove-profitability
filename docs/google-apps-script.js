/**
 * Google Apps Script - Web App for Lalamove Calculator Data Collection
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click "Deploy" → "New deployment"
 * 5. Select type: "Web app"
 * 6. Set "Execute as": "Me"
 * 7. Set "Who has access": "Anyone"
 * 8. Click "Deploy" and authorize when prompted
 * 9. Copy the Web App URL
 * 10. Add the URL to your secrets.js file:
 *     googleSheets: { webAppUrl: 'YOUR_URL_HERE' }
 *
 * Note: After any changes, you need to create a NEW deployment
 * (don't edit existing one) for changes to take effect.
 */

/**
 * Handle POST requests from the calculator
 */
function doPost(e) {
  try {
    // Validate that we received POST data
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error(
        "No POST data received. Make sure to send a POST request with JSON body.",
      );
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);

    // Add headers if this is the first row
    if (sheet.getLastRow() === 0) {
      const headers = [
        "ID",
        "Saved At",
        "Job Posted Time",
        "Current Location",
        "Pickup Address",
        "Pickup Type",
        "Delivery Stops",
        "Delivery Stops Metadata",
        "Stops Count",
        "Fare Type",
        "Base Fare ($)",
        "Additional Stop Fee ($)",
        "Priority Fee ($)",
        "Other Surcharges ($)",
        "Total Surcharges ($)",
        "Total Fare ($)",
        "Gross Fare ($)",
        "Commission ($)",
        "VAT ($)",
        "CPF Withholding ($)",
        "Platform Fee ($)",
        "Total Deductions ($)",
        "Net Fare ($)",
        "Fuel Cost ($)",
        "Fuel (L)",
        "Distance to Pickup (km)",
        "Job Distance (km)",
        "Total Distance (km)",
        "Travel to Pickup (min)",
        "Job Travel Time (min)",
        "Total Travel Time (min)",
        "Wait Time (min)",
        "Total Time (min)",
        "Net Profit ($)",
        "Profit/Hour ($)",
        "Rating",
        "Job-Only Fuel Cost ($)",
        "Job-Only Net Profit ($)",
        "Job-Only Time (min)",
        "Job-Only Profit/Hour ($)",
        "Fuel Efficiency (km/L)",
        "Petrol Price ($)",
        "Traffic",
        "Bike Model",
        "Notes",
      ];
      sheet.appendRow(headers);

      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f97316");
      headerRange.setFontColor("#ffffff");
    }

    // Append the data row
    const row = [
      data.id || "",
      formatDateTime(data.savedAt),
      formatDateTime(data.jobPostedTime),
      data.currentLocation || "",
      data.pickupAddress || "",
      data.pickupBuildingType || "",
      data.deliveryStops || "",
      JSON.stringify(data.deliveryStopsMetadata || []),
      data.stopsCount || 1,
      data.fareType || "regular",
      formatNumber(data.baseFare),
      formatNumber(data.additionalStopFee),
      formatNumber(data.priorityFee),
      formatNumber(data.surchargeAmount),
      formatNumber(data.totalSurcharges),
      formatNumber(data.totalFare),
      formatNumber(data.grossFare),
      formatNumber(data.commission),
      formatNumber(data.vat),
      formatNumber(data.cpfWithholding),
      formatNumber(data.platformFee),
      formatNumber(data.totalDeductions),
      formatNumber(data.netFare),
      formatNumber(data.fuelCost),
      formatNumber(data.fuelLitres, 3),
      formatNumber(data.distanceToPickupKm),
      formatNumber(data.jobDistanceKm),
      formatNumber(data.totalDistanceKm),
      formatNumber(data.travelToPickupMinutes, 0),
      formatNumber(data.jobTravelMinutes, 0),
      formatNumber(data.totalTravelMinutes, 0),
      formatNumber(data.totalWaitMinutes, 0),
      formatNumber(data.totalTimeMinutes, 0),
      formatNumber(data.netProfit),
      formatNumber(data.profitPerHour),
      data.rating || "",
      formatNumber(data.jobOnlyFuelCost),
      formatNumber(data.jobOnlyNetProfit),
      formatNumber(data.jobOnlyTimeMinutes, 0),
      formatNumber(data.jobOnlyProfitPerHour),
      formatNumber(data.fuelEfficiency, 0),
      formatNumber(data.petrolPrice),
      data.trafficCondition || "",
      data.bikeModel || "",
      data.notes || "",
    ];

    sheet.appendRow(row);

    // Apply conditional formatting to rating column (column 24)
    applyRatingFormatting(sheet);

    // Return success response
    return createJsonResponse({
      success: true,
      message: "Data saved successfully",
      rowNumber: sheet.getLastRow(),
    });
  } catch (error) {
    console.error("Error saving data:", error);
    return createJsonResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return createJsonResponse({
    status: "ok",
    message: "Lalamove Calculator Data Collection API is running",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create a JSON response with proper content type
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/**
 * Format a number for display
 */
function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || value === "") return "";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toFixed(decimals);
}

/**
 * Format ISO datetime to readable format
 */
function formatDateTime(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return Utilities.formatDate(date, "Asia/Singapore", "yyyy-MM-dd HH:mm");
  } catch (e) {
    return isoString;
  }
}

/**
 * Apply conditional formatting to the rating column
 */
function applyRatingFormatting(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const ratingCol = 24; // Column X (Rating)
  const range = sheet.getRange(2, ratingCol, lastRow - 1, 1);

  // Clear existing rules for this range
  const rules = sheet.getConditionalFormatRules();
  const filteredRules = rules.filter((rule) => {
    const ranges = rule.getRanges();
    return !ranges.some((r) => r.getColumn() === ratingCol);
  });

  // Add new rules
  const newRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("excellent")
      .setBackground("#bbf7d0")
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("good")
      .setBackground("#d9f99d")
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("fair")
      .setBackground("#fef08a")
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("poor")
      .setBackground("#fecaca")
      .setRanges([range])
      .build(),
  ];

  sheet.setConditionalFormatRules([...filteredRules, ...newRules]);
}

/**
 * Test function - run this to verify the script works
 */
function testPost() {
  const testData = {
    id: "test-123",
    savedAt: new Date().toISOString(),
    jobPostedTime: new Date().toISOString(),
    currentLocation: "639798",
    pickupAddress: "018956",
    pickupBuildingType: "office",
    deliveryStops: "1. 530123",
    stopsCount: 1,
    baseFare: 8.0,
    surchargeAmount: 2.0,
    totalFare: 10.0,
    grossFare: 8.0,
    commission: 1.2,
    vat: 0.72,
    netFare: 6.08,
    fuelCost: 0.45,
    fuelLitres: 0.16,
    totalDistanceKm: 5.2,
    totalTravelMinutes: 15,
    totalWaitMinutes: 10,
    totalTimeMinutes: 25,
    netProfit: 5.63,
    profitPerHour: 13.51,
    rating: "fair",
    fuelEfficiency: 45,
    petrolPrice: 2.87,
    trafficCondition: "normal",
    bikeModel: "Honda Wave 125",
    notes: "Test entry",
  };

  const e = {
    postData: {
      contents: JSON.stringify(testData),
    },
  };

  const result = doPost(e);
  console.log(result.getContent());
}
