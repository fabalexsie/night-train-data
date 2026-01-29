#!/usr/bin/env node
/**
 * Test suite for the similarity-based route matching in combine-routes.js
 */

// Import the similarity calculation function (copy for testing)
function calculateReverseSimilarity(stops1, stops2) {
  const stops2Rev = [...stops2].reverse();
  const m = stops1.length;
  const n = stops2Rev.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (stops1[i - 1] === stops2Rev[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  const lcsLength = dp[m][n];
  const maxLength = Math.max(m, n);
  return maxLength > 0 ? lcsLength / maxLength : 0;
}

function areStopsSimilarlyReversed(stops1, stops2, threshold = 0.70) {
  if (stops1.length === 0 || stops2.length === 0) {
    return false;
  }
  
  if (stops1[0] !== stops2[stops2.length - 1] || stops1[stops1.length - 1] !== stops2[0]) {
    return false;
  }
  
  const similarity = calculateReverseSimilarity(stops1, stops2);
  return similarity >= threshold;
}

// Test cases
const tests = [
  {
    name: 'Exact reverse match',
    route1: ['A', 'B', 'C', 'D'],
    route2: ['D', 'C', 'B', 'A'],
    expectedSimilarity: 1.0,
    shouldMatch: true
  },
  {
    name: 'Amsterdam-Wien case (real data)',
    route1: ['Amsterdam', 'Amersfoort', 'Deventer', 'Hannover', 'Kassel', 'Würzburg', 'Nürnberg', 'Wien'],
    route2: ['Wien', 'Nürnberg', 'Würzburg', 'Kassel', 'Hamm', 'Münster', 'Deventer', 'Amersfoort', 'Amsterdam'],
    expectedSimilarity: 0.777, // 7 matching out of 9
    shouldMatch: true
  },
  {
    name: 'One extra stop in middle',
    route1: ['A', 'B', 'C', 'D'],
    route2: ['D', 'C', 'X', 'B', 'A'],
    expectedSimilarity: 0.8, // 4 matching out of 5
    shouldMatch: true
  },
  {
    name: 'Different endpoints - should not match',
    route1: ['A', 'B', 'C', 'D'],
    route2: ['E', 'C', 'B', 'A'],
    expectedSimilarity: 0.75, // Only 3 out of 4 match
    shouldMatch: false // Endpoints don't match
  },
  {
    name: 'Completely different routes',
    route1: ['A', 'B', 'C', 'D'],
    route2: ['X', 'Y', 'Z', 'W'],
    expectedSimilarity: 0.0,
    shouldMatch: false
  },
  {
    name: 'Two stops below threshold',
    route1: ['A', 'B', 'C', 'D', 'E'],
    route2: ['E', 'X', 'Y', 'Z', 'A'],
    expectedSimilarity: 0.4, // Only 2 out of 5 match
    shouldMatch: false
  },
  {
    name: 'Empty routes',
    route1: [],
    route2: [],
    expectedSimilarity: 0.0,
    shouldMatch: false
  }
];

console.log('Running similarity algorithm tests...\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  const similarity = calculateReverseSimilarity(test.route1, test.route2);
  const matches = areStopsSimilarlyReversed(test.route1, test.route2);
  
  const similarityMatch = Math.abs(similarity - test.expectedSimilarity) < 0.05;
  const matchResult = matches === test.shouldMatch;
  
  const status = similarityMatch && matchResult ? '✓ PASS' : '✗ FAIL';
  
  if (similarityMatch && matchResult) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status}: ${test.name}`);
  console.log(`  Similarity: ${similarity.toFixed(3)} (expected: ${test.expectedSimilarity.toFixed(3)})`);
  console.log(`  Matches: ${matches} (expected: ${test.shouldMatch})`);
  
  if (!similarityMatch || !matchResult) {
    console.log(`  Route 1: [${test.route1.join(', ')}]`);
    console.log(`  Route 2: [${test.route2.join(', ')}]`);
  }
  console.log();
}

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
