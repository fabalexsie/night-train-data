/**
 * Search for station groups by name or country with smart sorting
 * @param {Array} groups - Array of station groups
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum number of results (default: 20)
 * @returns {Array} Filtered, sorted, and limited array of groups
 */
export function searchStationGroups(groups, searchTerm, limit = 20) {
  if (!searchTerm) {
    return [];
  }

  const lowerSearch = searchTerm.toLowerCase();

  return groups
    .filter((group) => {
      // Search in group name
      if (group.groupName.toLowerCase().includes(lowerSearch)) {
        return true;
      }

      // Search in display name
      if (group.displayName.toLowerCase().includes(lowerSearch)) {
        return true;
      }

      // Search in country
      if (
        group.stop_country &&
        group.stop_country.toLowerCase().includes(lowerSearch)
      ) {
        return true;
      }

      // Search in individual station names within the group
      return group.stations.some((station) =>
        station.stop_name.toLowerCase().includes(lowerSearch)
      );
    })
    .sort((a, b) => {
      const aName = a.groupName.toLowerCase();
      const bName = b.groupName.toLowerCase();
      const aDisplay = a.displayName.toLowerCase();
      const bDisplay = b.displayName.toLowerCase();

      // Prioritize exact matches on group name
      const aExactGroup = aName === lowerSearch;
      const bExactGroup = bName === lowerSearch;
      if (aExactGroup && !bExactGroup) return -1;
      if (!aExactGroup && bExactGroup) return 1;

      // Prioritize exact matches on display name
      const aExactDisplay = aDisplay === lowerSearch;
      const bExactDisplay = bDisplay === lowerSearch;
      if (aExactDisplay && !bExactDisplay) return -1;
      if (!aExactDisplay && bExactDisplay) return 1;

      // Prioritize starts with on group name
      const aStartsGroup = aName.startsWith(lowerSearch);
      const bStartsGroup = bName.startsWith(lowerSearch);
      if (aStartsGroup && !bStartsGroup) return -1;
      if (!aStartsGroup && bStartsGroup) return 1;

      // Prioritize starts with on display name
      const aStartsDisplay = aDisplay.startsWith(lowerSearch);
      const bStartsDisplay = bDisplay.startsWith(lowerSearch);
      if (aStartsDisplay && !bStartsDisplay) return -1;
      if (!aStartsDisplay && bStartsDisplay) return 1;

      // NEW: Prioritize grouped stations (isGroup=true) over individual stations
      if (a.isGroup && b.isGroup) {
        // Both are groups - sort by amount of stations (more stations first)
        if (b.stations.length !== a.stations.length) {
          return b.stations.length - a.stations.length;
        }
      }
      if (a.isGroup && !b.isGroup) return -1;
      if (!a.isGroup && b.isGroup) return 1;

      // Otherwise sort alphabetically by display name
      return aDisplay.localeCompare(bDisplay);
    })
    .slice(0, limit);
}
