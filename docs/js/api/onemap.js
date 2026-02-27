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

    // Validate that secrets are actually configured (not empty placeholders)
    const hasEmail =
      secrets?.onemap?.email &&
      secrets.onemap.email.length > 0 &&
      !secrets.onemap.email.includes("${{");
    const hasPassword =
      secrets?.onemap?.password &&
      secrets.onemap.password.length > 0 &&
      !secrets.onemap.password.includes("${{");

    if (hasEmail && hasPassword) {
      console.log("✅ Local secrets loaded (email:", secrets.onemap.email, ")");
      return secrets;
    } else {
      console.warn("⚠️ secrets.js found but credentials are empty or invalid");
      console.log("   Email configured:", hasEmail);
      console.log("   Password configured:", hasPassword);
      console.log("");
      console.log("   If deployed via GitHub Pages, ensure you have set:");
      console.log("   - Repository Settings → Secrets → ONEMAP_EMAIL");
      console.log("   - Repository Settings → Secrets → ONEMAP_PASSWORD");
      secrets = false;
      return null;
    }
  } catch (e) {
    // secrets.js doesn't exist - that's fine, user will input token manually
    console.log("ℹ️ No secrets.js found - manual token entry required");
    console.log("   Error:", e.message);
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
    console.log("🔑 Fetching new OneMap token...");

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
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = "(could not read response body)";
      }

      console.group("❌ Failed to fetch OneMap token");
      console.log("Status:", response.status, response.statusText);
      console.log("Response:", errorBody);
      console.log("");
      console.log("Email used:", secretsData.onemap.email);
      console.log("Password length:", secretsData.onemap.password?.length || 0);
      console.log("");
      if (response.status === 401) {
        console.log("This usually means:");
        console.log("- Incorrect email or password in secrets.js");
        console.log("- Account doesn't exist or is not verified");
      }
      console.groupEnd();

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
    console.log("✅ Using stored OneMap token (not expired)");
    return storedToken;
  }

  if (storedToken && isTokenExpired()) {
    console.log("⚠️ Stored token is expired, fetching new one...");
  } else if (!storedToken) {
    console.log("ℹ️ No stored token found, fetching new one...");
  }

  // Try to fetch a new token using credentials
  const newToken = await fetchTokenWithCredentials();
  if (newToken) {
    return newToken;
  }

  // Fall back to stored token even if expired (might still work)
  if (storedToken) {
    console.warn(
      "⚠️ Could not fetch new token, using expired token as fallback",
    );
  }
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
        // Debug: show detailed info about the 401 error
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch (e) {
          errorBody = "(could not read response body)";
        }

        console.group("❌ Routing API Unauthorized (401)");
        console.log("Response body:", errorBody);
        console.log("");
        console.log(
          "Token used (first 50 chars):",
          authToken?.substring(0, 50) + "...",
        );
        console.log("Token length:", authToken?.length || 0);
        console.log("");

        // Check common issues
        if (!authToken) {
          console.log("❌ Issue: No token provided");
        } else if (authToken.length < 100) {
          console.log("⚠️ Issue: Token seems too short - might be incomplete");
        } else if (!authToken.includes(".")) {
          console.log("⚠️ Issue: Token doesn't look like a JWT (no dots)");
        } else {
          // Try to decode and show token info
          debugToken(authToken);

          // Check if token is expired
          const claims = decodeJWT(authToken);
          if (claims?.exp) {
            const expDate = new Date(claims.exp * 1000);
            const now = new Date();
            if (now > expDate) {
              console.log("❌ Issue: Token is EXPIRED");
              console.log("   Expired at:", expDate.toLocaleString());
              console.log("   Current time:", now.toLocaleString());
            } else {
              console.log(
                "✓ Token is not expired (expires:",
                expDate.toLocaleString() + ")",
              );
            }
          }
        }

        console.log("");
        console.log("To fix this:");
        console.log(
          "1. Check if your token in secrets.js is correct and complete",
        );
        console.log(
          "2. Try refreshing your token at https://www.onemap.gov.sg/apidocs/",
        );
        console.log(
          "3. Make sure the token hasn't been truncated when copying",
        );
        console.log("4. Check your secrets.js has the correct format:");
        console.log("   export const SECRETS = {");
        console.log("     onemap: {");
        console.log("       email: 'your@email.com',");
        console.log("       password: 'yourpassword'");
        console.log("     }");
        console.log("   };");
        console.groupEnd();

        throw new OneMapError(
          "Invalid or expired API token. Check browser console for details.",
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
