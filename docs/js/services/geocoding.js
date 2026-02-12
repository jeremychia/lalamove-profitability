/**
 * Geocoding Service
 * Converts addresses to coordinates with building type detection
 * @module services/geocoding
 */

import { searchAddress, reverseGeocode } from "../api/onemap.js";

/**
 * @typedef {Object} GeocodedLocation
 * @property {number} lat - Latitude
 * @property {number} lng - Longitude
 * @property {string} address - Full formatted address
 * @property {string} postalCode - Postal code if available
 * @property {string} buildingType - Detected building type key
 * @property {string} buildingName - Building name if available
 * @property {Object} raw - Original API response for debugging
 */

/**
 * Check if input looks like coordinates (lat, lng format)
 * @param {string} input
 * @returns {{isCoordinates: boolean, lat?: number, lng?: number}}
 */
function parseCoordinates(input) {
  const trimmed = input.trim();

  // Match patterns like "1.288336, 103.807802" or "1.288336,103.807802"
  const coordPattern = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;
  const match = trimmed.match(coordPattern);

  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    // Validate Singapore bounds (roughly)
    if (lat >= 1.1 && lat <= 1.5 && lng >= 103.6 && lng <= 104.1) {
      return { isCoordinates: true, lat, lng };
    }
  }

  return { isCoordinates: false };
}

/**
 * Geocode an address to coordinates with building type detection
 * Handles both address strings and coordinate input
 *
 * @param {string} addressInput - Address, postal code, building name, or coordinates
 * @returns {Promise<GeocodedLocation>}
 */
export async function geocodeAddress(addressInput) {
  const coordCheck = parseCoordinates(addressInput);

  // If input is coordinates, use reverse geocoding
  if (coordCheck.isCoordinates) {
    try {
      const reverseResult = await reverseGeocode(
        coordCheck.lat,
        coordCheck.lng,
      );

      return {
        lat: coordCheck.lat,
        lng: coordCheck.lng,
        address: formatReverseGeocodeAddress(reverseResult),
        postalCode: reverseResult.POSTALCODE || "",
        buildingType: detectBuildingTypeFromReverse(reverseResult),
        buildingName: reverseResult.BUILDINGNAME || "",
        raw: reverseResult,
      };
    } catch (error) {
      // If reverse geocode fails, return coordinates with defaults
      console.warn("Reverse geocode failed, using coordinates:", error.message);
      return {
        lat: coordCheck.lat,
        lng: coordCheck.lng,
        address: `${coordCheck.lat.toFixed(6)}, ${coordCheck.lng.toFixed(6)}`,
        postalCode: "",
        buildingType: "default",
        buildingName: "",
        raw: null,
      };
    }
  }

  // Standard address search
  const results = await searchAddress(addressInput.trim());
  const best = results[0];

  return {
    lat: parseFloat(best.LATITUDE),
    lng: parseFloat(best.LONGITUDE),
    address: best.ADDRESS || best.SEARCHVAL,
    postalCode: best.POSTAL || "",
    buildingType: detectBuildingType(best),
    buildingName: best.BUILDING || "",
    raw: best,
  };
}

/**
 * Format reverse geocode result into readable address
 * @param {Object} result - OneMap reverse geocode result
 * @returns {string}
 */
function formatReverseGeocodeAddress(result) {
  const parts = [];

  if (result.BUILDINGNAME && result.BUILDINGNAME !== "NIL") {
    parts.push(result.BUILDINGNAME);
  }
  if (result.BLOCK && result.BLOCK !== "NIL") {
    parts.push(`Blk ${result.BLOCK}`);
  }
  if (result.ROAD && result.ROAD !== "NIL") {
    parts.push(result.ROAD);
  }
  if (result.POSTALCODE && result.POSTALCODE !== "NIL") {
    parts.push(`Singapore ${result.POSTALCODE}`);
  }

  return parts.length > 0
    ? parts.join(", ")
    : result.ADDRESS || "Unknown Location";
}

/**
 * Detect building type from reverse geocode result
 * @param {Object} result - OneMap reverse geocode result
 * @returns {string}
 */
function detectBuildingTypeFromReverse(result) {
  const building = (result.BUILDINGNAME || "").toUpperCase();
  const road = (result.ROAD || "").toUpperCase();
  const combined = `${building} ${road}`;

  // HDB detection
  if (combined.includes("HDB") || result.BLOCK) {
    return "hdb";
  }

  // Condo detection
  if (
    combined.includes("CONDO") ||
    combined.includes("RESIDENCE") ||
    combined.includes("TOWER") ||
    combined.includes("HEIGHTS")
  ) {
    return "condo";
  }

  // Mall detection
  if (
    combined.includes("MALL") ||
    combined.includes("SHOPPING") ||
    combined.includes("PLAZA")
  ) {
    return "mall";
  }

  // Office detection
  if (
    combined.includes("OFFICE") ||
    combined.includes("BUILDING") ||
    combined.includes("CENTRE") ||
    combined.includes("CENTER")
  ) {
    return "office";
  }

  // Industrial detection
  if (
    combined.includes("INDUSTRIAL") ||
    combined.includes("TECHPARK") ||
    combined.includes("WAREHOUSE")
  ) {
    return "industrial";
  }

  return "default";
}

/**
 * Geocode multiple addresses in parallel
 *
 * @param {string[]} addresses - Array of address strings
 * @returns {Promise<GeocodedLocation[]>}
 */
export async function geocodeMultiple(addresses) {
  const results = await Promise.all(
    addresses.map((addr) => geocodeAddress(addr)),
  );
  return results;
}

/**
 * Detect building type from OneMap result data
 * Uses multiple signals: building name, search value, address patterns
 *
 * @param {Object} locationData - OneMap search result
 * @returns {string} Building type key matching WAIT_TIMES config
 */
function detectBuildingType(locationData) {
  const building = (locationData.BUILDING || "").toUpperCase();
  const searchVal = (locationData.SEARCHVAL || "").toUpperCase();
  const address = (locationData.ADDRESS || "").toUpperCase();
  const combined = `${building} ${searchVal} ${address}`;

  // HDB detection - most common in Singapore
  if (
    combined.includes("HDB") ||
    /BLK\s*\d+/.test(combined) ||
    combined.includes("BLOCK")
  ) {
    return "hdb";
  }

  // Condo/Private residential detection
  const condoKeywords = [
    "CONDO",
    "CONDOMINIUM",
    "RESIDENCE",
    "RESIDENCES",
    "APARTMENT",
    "SUITES",
    "LODGE",
    "MANSIONS",
    "HEIGHTS",
    "GARDENS",
    "VILLA",
    "VILLAS",
    "COURT",
  ];
  if (condoKeywords.some((kw) => combined.includes(kw))) {
    return "condo";
  }

  // Office/Commercial building detection
  const officeKeywords = [
    "TOWER",
    "TOWERS",
    "BUILDING",
    "CENTRE",
    "CENTER",
    "PLAZA",
    "COMPLEX",
    "HOUSE",
    "PLACE",
    "SQUARE",
    "OFFICE",
    "CORPORATE",
    "BUSINESS",
  ];
  if (officeKeywords.some((kw) => combined.includes(kw))) {
    return "office";
  }

  // Mall/Retail detection
  const mallKeywords = [
    "MALL",
    "SHOPPING",
    "RETAIL",
    "CITY",
    "JUNCTION",
    "POINT",
    "MARKET",
    "MART",
  ];
  if (mallKeywords.some((kw) => combined.includes(kw))) {
    return "mall";
  }

  // Industrial detection
  const industrialKeywords = [
    "INDUSTRIAL",
    "FACTORY",
    "WAREHOUSE",
    "LOGISTICS",
    "TECHPARK",
    "TECH PARK",
    "BIZPARK",
    "BIZ HUB",
    "INDUSTRIAL PARK",
    "IND PARK",
  ];
  if (industrialKeywords.some((kw) => combined.includes(kw))) {
    return "industrial";
  }

  // Landed property detection (specific road patterns)
  const landedKeywords = [
    "TERRACE",
    "DRIVE",
    "AVENUE",
    "ROAD",
    "STREET",
    "LANE",
    "CLOSE",
    "CRESCENT",
    "WALK",
  ];
  // Check if it looks like a landed address (number + road name, no block)
  if (
    !combined.includes("BLK") &&
    !combined.includes("#") &&
    landedKeywords.some((kw) => combined.includes(kw))
  ) {
    // Additional check: if no building name, likely landed
    if (!building || building.length < 3) {
      return "landed";
    }
  }

  return "default";
}

/**
 * Get suggestions for an address input (autocomplete)
 *
 * @param {string} partialAddress - Partial address input
 * @param {number} limit - Max number of suggestions
 * @returns {Promise<Array>} Array of suggestion objects
 */
export async function getAddressSuggestions(partialAddress, limit = 5) {
  if (!partialAddress || partialAddress.length < 2) {
    return [];
  }

  try {
    const results = await searchAddress(partialAddress);
    return results.slice(0, limit).map((r) => ({
      address: r.ADDRESS || r.SEARCHVAL,
      postalCode: r.POSTAL,
      building: r.BUILDING,
    }));
  } catch {
    return [];
  }
}
