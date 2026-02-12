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
export function formatReverseGeocodeAddress(result) {
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
 * Building type keywords for detection
 * Centralized to avoid duplication
 */
const BUILDING_KEYWORDS = {
  hdb: ["HDB", "BLK", "BLOCK"],
  condo: [
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
  ],
  office: [
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
  ],
  mall: [
    "MALL",
    "SHOPPING",
    "RETAIL",
    "CITY",
    "JUNCTION",
    "POINT",
    "MARKET",
    "MART",
  ],
  industrial: [
    "INDUSTRIAL",
    "FACTORY",
    "WAREHOUSE",
    "LOGISTICS",
    "TECHPARK",
    "TECH PARK",
    "BIZPARK",
    "BIZ HUB",
    "IND PARK",
  ],
  landed: [
    "TERRACE",
    "DRIVE",
    "AVENUE",
    "ROAD",
    "STREET",
    "LANE",
    "CLOSE",
    "CRESCENT",
    "WALK",
  ],
};

/**
 * Detect building type from text content
 * Used by both address search and reverse geocode results
 *
 * @param {string} text - Combined text to search in (uppercase)
 * @param {Object} [options] - Additional detection options
 * @param {boolean} [options.hasBlock] - Whether location has a block number
 * @param {boolean} [options.hasBuilding] - Whether location has a building name
 * @returns {string} Building type key matching WAIT_TIMES config
 */
function detectBuildingTypeFromText(text, options = {}) {
  const { hasBlock = false, hasBuilding = true } = options;

  // HDB detection - most common in Singapore
  if (
    BUILDING_KEYWORDS.hdb.some((kw) => text.includes(kw)) ||
    hasBlock ||
    /BLK\s*\d+/.test(text)
  ) {
    return "hdb";
  }

  // Condo/Private residential detection
  if (BUILDING_KEYWORDS.condo.some((kw) => text.includes(kw))) {
    return "condo";
  }

  // Office/Commercial building detection
  if (BUILDING_KEYWORDS.office.some((kw) => text.includes(kw))) {
    return "office";
  }

  // Mall/Retail detection
  if (BUILDING_KEYWORDS.mall.some((kw) => text.includes(kw))) {
    return "mall";
  }

  // Industrial detection
  if (BUILDING_KEYWORDS.industrial.some((kw) => text.includes(kw))) {
    return "industrial";
  }

  // Landed property detection
  if (
    !text.includes("BLK") &&
    !text.includes("#") &&
    !hasBuilding &&
    BUILDING_KEYWORDS.landed.some((kw) => text.includes(kw))
  ) {
    return "landed";
  }

  return "default";
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

  return detectBuildingTypeFromText(combined, {
    hasBlock: !!result.BLOCK,
    hasBuilding: building.length > 2,
  });
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

  return detectBuildingTypeFromText(combined, {
    hasBlock: /BLK\s*\d+/.test(combined),
    hasBuilding: building.length >= 3,
  });
}
