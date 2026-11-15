/** ADR-0065: only an explicit internal build may run the retired claim interface.
 * No URL, storage value, document or runtime settings participate in this decision.
 */
declare const __GEOMIRA_CLAIM_TESTING__: boolean | undefined;
export const CLAIM_TESTING =
  typeof __GEOMIRA_CLAIM_TESTING__ === 'boolean' && __GEOMIRA_CLAIM_TESTING__;
export const CLAIMS_UNAVAILABLE = 'Claim testing and discovery are unavailable in this build.';
