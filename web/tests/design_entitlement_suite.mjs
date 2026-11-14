/**
 * Phase 4.1 Exhaustive Design Entitlement & Authorization Verification Suite
 *
 * Covers:
 * 1. 3 Subscription Plans (ULTRA, PRO, START/STANDARD) x 3 Design Choices (Premium, iOS, Classic)
 * 2. Valid Design Selections
 * 3. Unauthorized Selections & Downgrade Fallbacks
 * 4. Tampered / Spoofed Storage Attacks
 * 5. Subscription Loading State (Zero Elevated Flash)
 * 6. Subscription API Failure State
 * 7. Subscription Downgrade Sequences (ULTRA -> PRO -> START)
 * 8. Organization Switching Simulation
 * 9. Browser Refresh State Restoration
 * 10. Platform Owner Explicit Verified Override Boundaries
 */

import {
  getAvailableDesigns,
  canUseDesign,
  getFallbackDesign,
  validateDesignSelection,
  normalizePlanCode,
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
console.log("DESIGN SYSTEM ENTITLEMENT & SECURITY AUDIT — PHASE 4.1");
console.log("==================================================================");

// --- 1. PLAN NORMALIZATION ---
assert(normalizePlanCode("ULTRA") === "ultra", "normalize_ultra_uppercase");
assert(normalizePlanCode("pro") === "pro", "normalize_pro_lowercase");
assert(normalizePlanCode("standard") === "start", "normalize_standard_alias_to_start");
assert(normalizePlanCode("START") === "start", "normalize_start_uppercase");
assert(normalizePlanCode(null) === "start", "normalize_null_to_start");
assert(normalizePlanCode("") === "start", "normalize_empty_to_start");

// --- 2. 3 PLANS x 3 DESIGNS COMBINATIONS ---
// 2.1 ULTRA Plan
assert(canUseDesign("ultra", "premium") === true, "matrix_ultra_premium_allowed");
assert(canUseDesign("ultra", "ios") === true, "matrix_ultra_ios_allowed");
assert(canUseDesign("ultra", "classic") === true, "matrix_ultra_classic_allowed");
assert(validateDesignSelection("premium", "ultra") === "premium", "ultra_select_premium_valid");
assert(validateDesignSelection("ios", "ultra") === "ios", "ultra_select_ios_valid");
assert(validateDesignSelection("classic", "ultra") === "classic", "ultra_select_classic_valid");

// 2.2 PRO Plan
assert(canUseDesign("pro", "premium") === false, "matrix_pro_premium_blocked");
assert(canUseDesign("pro", "ios") === true, "matrix_pro_ios_allowed");
assert(canUseDesign("pro", "classic") === true, "matrix_pro_classic_allowed");
assert(validateDesignSelection("premium", "pro") === "classic", "pro_select_premium_falls_back_to_classic");
assert(validateDesignSelection("ios", "pro") === "ios", "pro_select_ios_valid");
assert(validateDesignSelection("classic", "pro") === "classic", "pro_select_classic_valid");

// 2.3 START / STANDARD Plan
assert(canUseDesign("start", "premium") === false, "matrix_start_premium_blocked");
assert(canUseDesign("start", "ios") === false, "matrix_start_ios_blocked");
assert(canUseDesign("start", "classic") === true, "matrix_start_classic_allowed");
assert(validateDesignSelection("premium", "start") === "classic", "start_select_premium_falls_back_to_classic");
assert(validateDesignSelection("ios", "start") === "classic", "start_select_ios_falls_back_to_classic");
assert(validateDesignSelection("classic", "start") === "classic", "start_select_classic_valid");

// STANDARD alias
assert(canUseDesign("standard", "premium") === false, "standard_premium_blocked");
assert(canUseDesign("standard", "ios") === false, "standard_ios_blocked");
assert(canUseDesign("standard", "classic") === true, "standard_classic_allowed");

// --- 3. SUBSCRIPTION LOADING STATE (No Elevated Design Flash) ---
// While loading, elevated designs are blocked for tenants; default to Classic
assert(canUseDesign("ultra", "premium", false, true) === false, "loading_blocks_premium_even_on_ultra");
assert(canUseDesign("ultra", "ios", false, true) === false, "loading_blocks_ios_even_on_ultra");
assert(canUseDesign("ultra", "classic", false, true) === true, "loading_allows_classic_safely");
assert(validateDesignSelection("premium", "ultra", false, true) === "classic", "loading_defaults_to_classic_for_stored_premium");
assert(validateDesignSelection("ios", "pro", false, true) === "classic", "loading_defaults_to_classic_for_stored_ios");

// --- 4. SUBSCRIPTION API FAILURE STATE ---
// When API returns error or plan is missing/failing
assert(canUseDesign(null, "premium", false, false, "API 500 Internal Error") === false, "api_error_blocks_premium");
assert(canUseDesign(null, "ios", false, false, "Network timeout") === false, "api_error_blocks_ios");
assert(canUseDesign(null, "classic", false, false, "Connection refused") === true, "api_error_allows_classic");
assert(validateDesignSelection("premium", null, false, false, "API 500") === "classic", "api_error_stored_premium_falls_back_to_classic");
assert(validateDesignSelection("ios", null, false, false, "API 500") === "classic", "api_error_stored_ios_falls_back_to_classic");

// --- 5. TAMPERED STORAGE ATTACKS ---
assert(validateDesignSelection("hacked_design", "ultra") === "classic", "tampered_arbitrary_design_falls_back_to_classic");
assert(validateDesignSelection("<script>alert(1)</script>", "ultra") === "classic", "xss_injection_in_storage_falls_back_to_classic");
assert(validateDesignSelection("PREMIUM", "start") === "classic", "tampered_premium_on_start_sanitized_to_classic");
assert(validateDesignSelection("IOS", "start") === "classic", "tampered_ios_on_start_sanitized_to_classic");
assert(validateDesignSelection("", "ultra") === "classic", "empty_storage_defaults_to_classic");
assert(validateDesignSelection(undefined, "pro") === "classic", "undefined_storage_defaults_to_classic");

// --- 6. SUBSCRIPTION DOWNGRADE SEQUENCES ---
// Sequence A: ULTRA with Premium -> Downgraded to PRO -> falls back to Classic
const stateA1 = validateDesignSelection("premium", "ultra");
assert(stateA1 === "premium", "seqA_step1_ultra_premium_active");
const stateA2 = validateDesignSelection(stateA1, "pro");
assert(stateA2 === "classic", "seqA_step2_downgrade_to_pro_demotes_premium_to_classic");

// Sequence B: PRO with iOS -> Downgraded to START -> falls back to Classic
const stateB1 = validateDesignSelection("ios", "pro");
assert(stateB1 === "ios", "seqB_step1_pro_ios_active");
const stateB2 = validateDesignSelection(stateB1, "start");
assert(stateB2 === "classic", "seqB_step2_downgrade_to_start_demotes_ios_to_classic");

// Sequence C: ULTRA with Premium -> Direct Downgrade to START -> falls back to Classic
const stateC1 = validateDesignSelection("premium", "ultra");
const stateC2 = validateDesignSelection(stateC1, "start");
assert(stateC2 === "classic", "seqC_direct_downgrade_ultra_to_start_demotes_to_classic");

// --- 7. ORGANIZATION SWITCHING SIMULATION ---
// Tenant user switches between Org 1 (ULTRA) and Org 2 (START)
let currentOrgPlan = "ultra";
let selectedDesign = "premium";

// User selects premium in Org 1
selectedDesign = validateDesignSelection(selectedDesign, currentOrgPlan);
assert(selectedDesign === "premium", "org_switch_org1_ultra_premium_active");

// User switches to Org 2 (which has start plan)
currentOrgPlan = "start";
selectedDesign = validateDesignSelection(selectedDesign, currentOrgPlan);
assert(selectedDesign === "classic", "org_switch_org2_start_immediately_revokes_premium");

// User switches back to Org 1 (ULTRA) and selects premium again
currentOrgPlan = "ultra";
selectedDesign = "premium";
selectedDesign = validateDesignSelection(selectedDesign, currentOrgPlan);
assert(selectedDesign === "premium", "org_switch_back_to_org1_ultra_reauthorizes_premium");

// --- 8. BROWSER REFRESH SIMULATION ---
// Saved valid selections are preserved on reload
assert(validateDesignSelection("premium", "ultra") === "premium", "refresh_preserves_valid_premium_on_ultra");
assert(validateDesignSelection("ios", "pro") === "ios", "refresh_preserves_valid_ios_on_pro");
assert(validateDesignSelection("classic", "start") === "classic", "refresh_preserves_classic_on_start");

// Saved invalid/ineligible selections are sanitized to classic on reload
assert(validateDesignSelection("premium", "pro") === "classic", "refresh_sanitizes_unauthorized_premium_on_pro");
assert(validateDesignSelection("premium", "start") === "classic", "refresh_sanitizes_unauthorized_premium_on_start");
assert(validateDesignSelection("ios", "start") === "classic", "refresh_sanitizes_unauthorized_ios_on_start");

// --- 9. PLATFORM OWNER EXPLICIT VERIFIED OVERRIDE BOUNDARIES ---
assert(canUseDesign("start", "premium", true) === true, "owner_with_verified_override_can_use_premium_on_start");
assert(canUseDesign("start", "ios", true) === true, "owner_with_verified_override_can_use_ios_on_start");
assert(validateDesignSelection("premium", "start", true) === "premium", "owner_can_preserve_premium_on_any_tenant_plan");
assert(canUseDesign("start", "premium", false) === false, "unverified_owner_false_flag_strictly_blocked_on_start");
assert(validateDesignSelection("premium", "start", false) === "classic", "unverified_owner_false_flag_falls_back_to_classic");

console.log("==================================================================");
console.log(`ENTITLEMENT AUDIT SUMMARY: ${passed}/${passed + failed} PASSED (${failed} failed)`);
console.log("==================================================================");

if (failed > 0) {
  process.exit(1);
}
