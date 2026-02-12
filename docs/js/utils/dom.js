/**
 * DOM Utility Functions
 * Common DOM manipulation helpers
 * @module utils/dom
 */

/**
 * Get element by ID with null safety
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Query selector shorthand
 * @param {string} selector - CSS selector
 * @param {HTMLElement} [parent=document] - Parent element
 * @returns {Element|null}
 */
export function $q(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query selector all shorthand
 * @param {string} selector - CSS selector
 * @param {HTMLElement} [parent=document] - Parent element
 * @returns {NodeList}
 */
export function $qa(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * Show or hide an element
 * @param {HTMLElement|string} elementOrId - Element or element ID
 * @param {boolean} show - Whether to show or hide
 */
export function toggleHidden(elementOrId, show) {
  const el = typeof elementOrId === "string" ? $(elementOrId) : elementOrId;
  if (!el) return;

  if (show) {
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

/**
 * Show a hint message with optional type styling
 * @param {HTMLElement|string} elementOrId - Hint element or ID
 * @param {string} message - Message to display
 * @param {'error'|'success'|''} [type=''] - Message type for styling
 */
export function showHint(elementOrId, message, type = "") {
  const el = typeof elementOrId === "string" ? $(elementOrId) : elementOrId;
  if (!el) return;

  el.textContent = message;
  el.classList.remove("error", "success");

  if (type === "error") {
    el.classList.add("error");
  } else if (type === "success") {
    el.classList.add("success");
  }
}

/**
 * Create an element with properties
 * @param {string} tag - HTML tag name
 * @param {Object} [props] - Properties to set
 * @param {string} [props.className] - CSS classes
 * @param {string} [props.innerHTML] - Inner HTML
 * @param {Object} [props.dataset] - Data attributes
 * @returns {HTMLElement}
 */
export function createElement(tag, props = {}) {
  const el = document.createElement(tag);

  if (props.className) el.className = props.className;
  if (props.innerHTML) el.innerHTML = props.innerHTML;
  if (props.id) el.id = props.id;

  if (props.dataset) {
    Object.entries(props.dataset).forEach(([key, value]) => {
      el.dataset[key] = value;
    });
  }

  return el;
}
