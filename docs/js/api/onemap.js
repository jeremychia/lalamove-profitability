/**
 * OneMap API Client
 * Handles all interactions with Singapore's OneMap API
 * @module api/onemap
 */

import { CONFIG } from "../config.js";

const { baseUrl, tokenKey, tokenExpiryKey } = CONFIG.api.onemap;

// Will be populated if secrets.js exists
let secrets = null;

/**
 * Decode and log JWT token claims for debugging
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Decode base64url payload (second part)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (e) {
    console.warn("Failed to decode JWT:", e.message);
    return null;
  }
}

/**
 * Log token details for debugging
 * @param {string} token
 */
function debugToken(token) {
  const claims = decodeJWT(token);
  if (!claims) {
    console.warn("🔍 Could not decode token");
    return;
  }

  console.group("🔍 OneMap Token Debug Info");
  console.log("User ID:", claims.user_id);
  console.log("Issuer:", claims.iss);
  console.log("Issued At:", new Date(claims.iat * 1000).toLocaleString());
  console.log("Expires:", new Date(claims.exp * 1000).toLocaleString());
  console.log("Token ID (jti):", claims.jti);
  console.log("Forever token:", claims.forever);

  // Check for any permission-related claims
  const permissionKeys = Object.keys(claims).filter(
    (k) =>
      k.includes("scope") ||
      k.includes("permission") ||
      k.includes("role") ||
      k.includes("access"),
  );
  if (permissionKeys.length > 0) {
    console.log(
      "Permission claims:",
      permissionKeys.map((k) => `${k}: ${claims[k]}`),
    );
  } else {
    console.log("⚠️ No explicit permission claims found in token");
    console.log("   (Permissions may be server-side based on user_id)");
  }

  console.log("Full claims:", claims);
  console.groupEnd();
}

/**
 * Attempt to load secrets from local file
 * This file should be gitignored and contain personal credentials
 */
async function loadSecrets() {
  if (secrets !== null) return secrets;

  try {
    const module = await import("../secrets.js");
    secrets = module.SECRETS;
    console.log("✅ Local secrets loaded");
    return secrets;
  } catch (e) {
    // secrets.js doesn't exist - that's fine, user will input token manually
    secrets = false;
    return null;
  }
}

/**
 * Custom error class for OneMap API errors
 */
export class OneMapError extends Error {
  constructor(message, statusCode = null, details = null) {
    super(message);
    this.name = "OneMapError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Get stored API token from localStorage
 * @returns {string|null}
 */
export function getStoredToken() {
  return localStorage.getItem(tokenKey);
}

/**
 * Store API token in localStorage with expiry
 * @param {string} token
 * @param {string} [expiry] - Expiry datetime string from API
 */
export function storeToken(token, expiry = null) {
  localStorage.setItem(tokenKey, token);
  if (expiry) {
    localStorage.setItem(tokenExpiryKey, expiry);
  }
}

/**
 * Check if stored token is expired
 * @returns {boolean}
 */
export function isTokenExpired() {
  const expiry = localStorage.getItem(tokenExpiryKey);
  if (!expiry) return true;

  try {
    const expiryDate = new Date(expiry);
    return new Date() >= expiryDate;
  } catch {
    return true;
  }
}

/**
 * Fetch a new token using credentials from secrets.js
 * @returns {Promise<string|null>} Token or null if failed
 */
export async function fetchTokenWithCredentials() {
  const secretsData = await loadSecrets();

  if (!secretsData?.onemap?.email || !secretsData?.onemap?.password) {
    return null;
  }

  const url = `${baseUrl}/auth/post/getToken`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: secretsData.onemap.email,
        password: secretsData.onemap.password,
      }),
    });

    if (!response.ok) {
      console.warn("Failed to fetch token:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.access_token) {
      storeToken(data.access_token, data.expiry_timestamp);
      console.log(
        "✅ Token fetched and stored (expires:",
        data.expiry_timestamp,
        ")",
      );

      // Debug: show token details
      debugToken(data.access_token);

      return data.access_token;
    }

    return null;
  } catch (error) {
    console.warn("Error fetching token:", error.message);
    return null;
  }
}

/**
 * Get a valid token - fetches new one if needed
 * @returns {Promise<string|null>}
 */
export async function getValidToken() {
  // Check if we have a non-expired token
  const storedToken = getStoredToken();
  if (storedToken && !isTokenExpired()) {
    return storedToken;
  }

  // Try to fetch a new token using credentials
  const newToken = await fetchTokenWithCredentials();
  if (newToken) {
    return newToken;
  }

  // Fall back to stored token even if expired (might still work)
  return storedToken;
}

/**
 * Clear stored API token
 */
export function clearToken() {
  localStorage.removeItem(tokenKey);
}

/**
 * Search for an address and return location data
 * This endpoint doesn't require authentication
 *
 * @param {string} searchTerm - Address, postal code, or building name
 * @returns {Promise<Array>} Array of location results
 * @throws {OneMapError} If search fails or no results found
 */
export async function searchAddress(searchTerm) {
  const url = new URL(`${baseUrl}/common/elastic/search`);
  url.searchParams.set("searchVal", searchTerm);
  url.searchParams.set("returnGeom", "Y");
  url.searchParams.set("getAddrDetails", "Y");

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new OneMapError(
        `Search request failed: ${response.statusText}`,
        response.status,
      );
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new OneMapError(`No results found for "${searchTerm}"`, 404);
    }

    return data.results;
  } catch (error) {
    if (error instanceof OneMapError) throw error;
    throw new OneMapError(`Network error: ${error.message}`);
  }
}

/**
 * Get route between two points
 * Requires authentication token
 *
 * @param {Object} start - Starting point { lat, lng }
 * @param {Object} end - Ending point { lat, lng }
 * @param {string} [token] - OneMap API token (optional, will use stored token)
 * @returns {Promise<Object>} Route data including distance and time
 * @throws {OneMapError} If routing fails
 */
export async function getRoute(start, end, token = null) {
  const authToken = token || getStoredToken();

  if (!authToken) {
    throw new OneMapError("No API token available for routing", 401);
  }

  const url = new URL(`${baseUrl}/public/routingsvc/route`);
  url.searchParams.set("start", `${start.lat},${start.lng}`);
  url.searchParams.set("end", `${end.lat},${end.lng}`);
  url.searchParams.set("routeType", "drive");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authToken,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new OneMapError(
          "Invalid or expired API token. Please update your token.",
          401,
        );
      }
      if (response.status === 403) {
        // Debug: show what we know about the token
        console.group("❌ Routing API Access Denied (403)");
        console.log(
          "This error means your OneMap account does not have routing API permissions.",
        );
        console.log("");
        console.log("Your account details:");
        debugToken(authToken);
        console.log("");
        console.log("To fix this:");
        console.log("1. Go to https://www.onemap.gov.sg/apidocs/contactus");
        console.log("2. Request routing API access for your account");
        console.log(
          "3. Or register a new account and request routing access during signup",
        );
        console.groupEnd();

        throw new OneMapError(
          "Routing API access denied. Your OneMap account (see console for details) does not have routing permissions. Contact OneMap support to enable routing API access.",
          403,
        );
      }
      throw new OneMapError(
        `Routing request failed: ${response.statusText}`,
        response.status,
      );
    }

    const data = await response.json();

    if (!data.route_summary) {
      throw new OneMapError("Invalid routing response", null, data);
    }

    return data;
  } catch (error) {
    if (error instanceof OneMapError) throw error;
    throw new OneMapError(`Network error: ${error.message}`);
  }
}

/**
 * Calculate straight-line distance between two points (Haversine formula)
 * Used as fallback when routing API is unavailable
 *
 * @param {Object} start - { lat, lng }
 * @param {Object} end - { lat, lng }
 * @returns {number} Distance in kilometers
 */
export function calculateStraightLineDistance(start, end) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(end.lat - start.lat);
  const dLng = toRad(end.lng - start.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(start.lat)) *
      Math.cos(toRad(end.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Convert degrees to radians
 * @param {number} deg
 * @returns {number}
 */
function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Check if token is likely valid (basic format check)
 * @param {string} token
 * @returns {boolean}
 */
export function isTokenFormatValid(token) {
  return typeof token === "string" && token.length > 20;
}

/**
 * Reverse geocode coordinates to get address
 * Uses OneMap's reverse geocoding endpoint
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Location data with address
 * @throws {OneMapError} If reverse geocoding fails
 */
export async function reverseGeocode(lat, lng) {
  const url = new URL(`${baseUrl}/public/revgeocodexy`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("buffer", "50"); // 50m buffer for nearby addresses
  url.searchParams.set("addressType", "all");
  url.searchParams.set("otherFeatures", "Y");

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new OneMapError(
        `Reverse geocode failed: ${response.statusText}`,
        response.status,
      );
    }

    const data = await response.json();

    if (!data.GeocodeInfo || data.GeocodeInfo.length === 0) {
      throw new OneMapError("No address found for this location", 404);
    }

    // Return the first (closest) result
    return data.GeocodeInfo[0];
  } catch (error) {
    if (error instanceof OneMapError) throw error;
    throw new OneMapError(`Network error: ${error.message}`);
  }
}
