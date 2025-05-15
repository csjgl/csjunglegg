// Utility functions for crash game logic (expand as needed)

// Generate a provably fair crash point (simple version)
export function generateCrashPoint() {
  // You can replace this with a provably fair algorithm
  return Math.floor((Math.random() * 100) + 10) / 100; // 1.10x - 2.00x
}
