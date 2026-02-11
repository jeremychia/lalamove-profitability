/**
 * Geocoding Service
 * Converts addresses to coordinates with building type detection
 * @module services/geocoding
 */

import { searchAddress } from "../api/onemap.js";

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
 * Geocode an address to coordinates with building type detection
 *
 * @param {string} addressInput - Address, postal code, or building name
 * @returns {Promise<GeocodedLocation>}
 */
export async function geocodeAddress(addressInput) {
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
