/**
 * Design Entitlement & Authorization Verification Suite — Phase 4
 *
 * Verifies subscription plan gates:
 * - ULTRA: Premium, iOS, Classic
 * - PRO: iOS, Classic (Premium locked)
 * - START / STANDARD: Classic (Premium and iOS locked)
 * - Platform Owner: All designs unlocked
 * - Downgrade & Spoofing Fallback: Returns "classic" if plan downgraded
 */

import {
  getAvailableDesigns,
  canUseDesign,
  getFallbackDesign,
  validateDesignSelection,
} from "../app/lib/design-entitlements.ts";

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    passed++;
    console.log(`[PASSED] ${testName} ${details ? "- " + details : ""}`);
  } else {
    failed++;
    console.error(`[FAILED] ${testName} ${details ? "- " + details : ""}`);
  }
}

console.log("==================================================================");
console.log("DESIGN SYSTEM ENTITLEMENT & AUTHORIZATION AUDIT — PHASE 4");
console.log("==================================================================");

// 1. ULTRA Plan Entitlements
const ultraDesigns = getAvailableDesigns("ultra");
assert(ultraDesigns.includes("premium"), "ultra_can_access_premium");
assert(ultraDesigns.includes("ios"), "ultra_can_access_ios");
assert(ultraDesigns.includes("classic"), "ultra_can_access_classic");
assert(canUseDesign("ultra", "premium") === true, "canUseDesign_ultra_premium_true");
assert(canUseDesign("ultra", "ios") === true, "canUseDesign_ultra_ios_true");
assert(canUseDesign("ultra", "classic") === true, "canUseDesign_ultra_classic_true");

// 2. PRO Plan Entitlements
const proDesigns = getAvailableDesigns("pro");
assert(!proDesigns.includes("premium"), "pro_cannot_access_premium");
assert(proDesigns.includes("ios"), "pro_can_access_ios");
assert(proDesigns.includes("classic"), "pro_can_access_classic");
assert(canUseDesign("pro", "premium") === false, "canUseDesign_pro_premium_false");
assert(canUseDesign("pro", "ios") === true, "canUseDesign_pro_ios_true");
assert(canUseDesign("pro", "classic") === true, "canUseDesign_pro_classic_true");

// 3. START / STANDARD Plan Entitlements
const startDesigns = getAvailableDesigns("start");
assert(!startDesigns.includes("premium"), "start_cannot_access_premium");
assert(!startDesigns.includes("ios"), "start_cannot_access_ios");
assert(startDesigns.includes("classic"), "start_can_access_classic");
assert(canUseDesign("start", "premium") === false, "canUseDesign_start_premium_false");
assert(canUseDesign("start", "ios") === false, "canUseDesign_start_ios_false");
assert(canUseDesign("start", "classic") === true, "canUseDesign_start_classic_true");

// 4. Standard alias handling
const standardDesigns = getAvailableDesigns("standard");
assert(standardDesigns.length === 1 && standardDesigns[0] === "classic", "standard_alias_resolves_to_classic_only");

// 5. Platform Owner Bypass
const ownerDesigns = getAvailableDesigns("start", true);
assert(ownerDesigns.includes("premium") && ownerDesigns.includes("ios") && ownerDesigns.includes("classic"), "platform_owner_has_all_designs");

// 6. Downgrade Fallback Protection
assert(validateDesignSelection("premium", "ultra") === "premium", "validate_ultra_premium_kept");
assert(validateDesignSelection("premium", "pro") === "classic", "downgrade_pro_premium_reverts_to_classic");
assert(validateDesignSelection("premium", "start") === "classic", "downgrade_start_premium_reverts_to_classic");
assert(validateDesignSelection("ios", "start") === "classic", "downgrade_start_ios_reverts_to_classic");

// 7. Client-side LocalStorage Spoofing Protection
assert(validateDesignSelection("hacked_design", "ultra") === "classic", "spoofed_invalid_design_reverts_to_classic");
assert(validateDesignSelection(null, "ultra") === "classic", "null_stored_design_defaults_to_classic");
assert(validateDesignSelection("premium", "start") === "classic", "spoofed_premium_on_start_plan_blocked");

console.log("==================================================================");
console.log(`ENTITLEMENT AUDIT SUMMARY: ${passed}/${passed + failed} PASSED (${failed} failed)`);
console.log("==================================================================");

if (failed > 0) {
  process.exit(1);
}
