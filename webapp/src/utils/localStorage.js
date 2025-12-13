/**
 * Utility functions for managing localStorage operations
 */

const STORAGE_KEY = 'selectedStationGroups';

/**
 * Save selected station groups to localStorage
 * @param {Array} stationGroups - Array of selected station group objects
 */
export function saveSelectedStationGroups(stationGroups) {
  try {
    const serialized = JSON.stringify(stationGroups);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Error saving station groups to localStorage:', error);
  }
}

/**
 * Load selected station groups from localStorage
 * @returns {Array} Array of station group objects, or empty array if none found
 */
export function loadSelectedStationGroups() {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized === null) {
      return [];
    }
    return JSON.parse(serialized);
  } catch (error) {
    console.error('Error loading station groups from localStorage:', error);
    return [];
  }
}

/**
 * Clear selected station groups from localStorage
 */
export function clearSelectedStationGroups() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing station groups from localStorage:', error);
  }
}
