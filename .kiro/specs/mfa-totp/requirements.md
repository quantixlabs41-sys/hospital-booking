# Requirements Document

## Introduction

This feature adds Time-based One-Time Password (TOTP) Multi-Factor Authentication (MFA) to MediBook, a hospital appointment and management system. MFA raises account security beyond a password by requiring a second factor (a rotating 6-digit code from an authenticator app) before a session is granted access to sensitive data such as payments, medical records, and complaints.

The implementation builds on Supabase Auth's GA TOTP support (`supabase.auth.mfa.*`) and the concept of Authenticator Assurance Levels (AAL): `aal1` means a session authenticated with a password only, and `aal2` means the session has additionally satisfied an MFA challenge. MediBook serves four roles — PATIENT, DOCTOR, ADMIN, and HOSPITAL — and this feature makes MFA available to every user, mandatory for privileged roles, and enforced at both the route layer (React) and the data layer (Postgres RLS keyed on the JWT `aal` claim).

The feature must integrate with existing security infrastructure: the session guard idle-timeout, the closed-account gate, the role-based routing in `ProtectedRoute`, and the least-privilege RLS policies established in migrations 023–026. Because MediBook handles protected health information and payment data, this feature is designed for production with security and account-recovery safety as first-order concerns.

## Glossary

- **MediBook_System**: The overall MediBook application, comprising the React frontend, Supabase Auth, and the Postgres backend with RLS.
- **MFA_Service**: The client-side module that wraps `supabase.auth.mfa.*` operations (enroll, challenge, verify, unenroll, list factors, get assurance level).
- **Auth_Provider**: The React authentication context (`src/context/AuthContext.jsx`) that manages session, profile, assurance level, and session-guard lifecycle.
- **Route_Guard**: The route-protection component (`src/routes/ProtectedRoute.jsx`) that gates access based on authentication, role, onboarding, and assurance level.
- **RLS_Policy**: A Postgres Row-Level Security policy that authorizes data access, some of which reference the session's `aal` claim.
- **Session_Guard**: The existing idle-timeout controller (`src/security/sessionGuard`) that warns and signs out inactive users.
- **TOTP_Factor**: An enrolled TOTP authenticator registered against a user account, identified by a factor id.
- **Authenticator_App**: A third-party application (e.g., Google Authenticator, Authy, 1Password) that generates TOTP codes from a shared secret.
- **AAL**: Authenticator Assurance Level. `aal1` = password only; `aal2` = MFA challenge satisfied.
- **Step_Up_Challenge**: The post-password flow that prompts the user for a TOTP code to raise the session from `aal1` to `aal2`.
- **Recovery_Code**: A single-use backup code issued at enrollment that lets a user satisfy MFA when the authenticator device is unavailable.
- **Admin_MFA_Reset**: An administrator-initiated action that removes a user's TOTP factors so the user can re-enroll after losing all authenticators and recovery codes.
- **Privileged_Role**: A role with elevated data access — ADMIN, DOCTOR, and HOSPITAL.
- **Sensitive_Action**: An operation that reads or writes protected data — payments, medical history/records, complaints, admin reports, and administrative user management.
- **Enrollment_Confirmed**: The state of a TOTP_Factor after a first successful verify, marking it active for the account.
- **Closed_Account_Gate**: The existing mechanism that signs out and blocks any user whose profile `is_active` is false.

## Requirements

### Requirement 1: TOTP Enrollment

**User Story:** As a user of any role, I want to register an authenticator app as a second factor, so that my account is protected by more than a password.

#### Acceptance Criteria

1. WHEN an authenticated user initiates enrollment, THE MFA_Service SHALL request a TOTP_Factor and return a factor id, a TOTP secret, and an otpauth provisioning URI.
2. WHEN an authenticated user initiates enrollment, THE MediBook_System SHALL explicitly record a pending TOTP-factor-requested state for the user in addition to returning the factor id, secret, and otpauth URI.
3. WHEN a TOTP_Factor enrollment is requested, THE MediBook_System SHALL display a scannable QR code and the plain-text secret as a manual-entry fallback.
4. WHEN the user submits a TOTP code during enrollment, THE MFA_Service SHALL issue a challenge for the factor id and verify the submitted code against that challenge.
5. WHEN enrollment verification succeeds, THE MediBook_System SHALL mark the TOTP_Factor as Enrollment_Confirmed and display a success confirmation.
6. IF the user submits an incorrect code during enrollment, THEN THE MediBook_System SHALL display an invalid-code error and retain the pending factor for another attempt.
7. IF the user abandons enrollment before verification succeeds, THEN THE MFA_Service SHALL remove the unconfirmed TOTP_Factor so no unverified factor persists on the account.
8. WHERE a user already has an Enrollment_Confirmed TOTP_Factor, THE MediBook_System SHALL display the enrolled state and SHALL NOT present the enrollment QR code again unless a new factor is explicitly added.

### Requirement 2: Recovery Codes

**User Story:** As a user, I want backup recovery codes when I enroll in MFA, so that I can still sign in if I lose access to my authenticator app.

#### Acceptance Criteria

1. WHEN a TOTP_Factor reaches Enrollment_Confirmed, THE MediBook_System SHALL generate a set of 10 single-use Recovery_Codes.
2. THE MediBook_System SHALL store Recovery_Codes as one-way hashes and SHALL NOT store or display recovery codes in plain text after the initial generation view.
3. WHEN Recovery_Codes are generated, THE MediBook_System SHALL display the codes once and SHALL offer a download or copy action.
4. WHEN a user submits a valid unused Recovery_Code during a Step_Up_Challenge, THE MediBook_System SHALL raise the session to `aal2` and SHALL mark that Recovery_Code as consumed.
5. IF a user submits a Recovery_Code that is already consumed or does not match any stored hash, THEN THE MediBook_System SHALL reject the code and display a recovery-failed error.
6. WHILE a user has 3 or fewer unused Recovery_Codes remaining, THE MediBook_System SHALL display a warning prompting the user to regenerate codes.
7. WHEN a user requests regeneration of Recovery_Codes, THE MediBook_System SHALL invalidate all previously issued Recovery_Codes for that user and issue a new set of 10.

### Requirement 3: Login Step-Up Challenge

**User Story:** As an enrolled user, I want to be prompted for my authenticator code after entering my password, so that a stolen password alone cannot access my account.

#### Acceptance Criteria

1. WHEN a user completes a password sign-in, THE Auth_Provider SHALL retrieve the current and next assurance levels for the session.
2. IF the session current level is `aal1` and the next level is `aal2`, THEN THE Route_Guard SHALL redirect the user to the Step_Up_Challenge screen before granting access to any protected route.
3. WHEN the user submits a valid TOTP code on the Step_Up_Challenge screen, THE MFA_Service SHALL verify the code and raise the session to `aal2`.
4. WHEN the session reaches `aal2`, THE Auth_Provider SHALL route the user to the role-appropriate dashboard using the profile role.
5. IF the user submits an incorrect TOTP code during the Step_Up_Challenge, THEN THE MediBook_System SHALL display an invalid-code error and allow another attempt subject to the rate-limiting rules.
6. WHILE a session remains at `aal1` for a user who has an Enrollment_Confirmed TOTP_Factor, THE Route_Guard SHALL deny access to all protected routes except the Step_Up_Challenge and sign-out.
7. WHERE a user offers a Recovery_Code instead of a TOTP code on the Step_Up_Challenge, THE MediBook_System SHALL accept the Recovery_Code as an alternative input that completes the same Step_Up_Challenge verification path before access is granted.
8. WHEN a user submits a Recovery_Code on the Step_Up_Challenge, THE MediBook_System SHALL raise the session to `aal2` only by completing the Step_Up_Challenge verification path and SHALL NOT grant access without that completion.

### Requirement 4: MFA Enrollment Enforcement Policy

**User Story:** As a security administrator, I want MFA required for privileged roles and available to everyone, so that accounts with access to sensitive data are always protected.

#### Acceptance Criteria

1. WHERE a user holds a Privileged_Role and has no Enrollment_Confirmed TOTP_Factor, THE Route_Guard SHALL redirect the user to a mandatory-enrollment screen after sign-in.
2. WHILE a Privileged_Role user has not completed enrollment, THE Route_Guard SHALL deny access to all protected routes except the enrollment screen and sign-out.
3. WHILE a Privileged_Role user has not completed enrollment, THE MediBook_System SHALL block all system access at both the route layer and the data layer, so that bypassing the enrollment redirect yields no data access.
4. WHERE a user holds the PATIENT role, THE MediBook_System SHALL make TOTP enrollment available as an opt-in security setting.
5. WHEN any user has an Enrollment_Confirmed TOTP_Factor, THE MediBook_System SHALL require a satisfied Step_Up_Challenge on each new session in accordance with Requirement 3.
6. THE MediBook_System SHALL determine the enforcement requirement from the profile role stored in `public.profiles.role` and SHALL NOT derive enforcement from client-supplied user metadata.

### Requirement 5: Assurance-Level Gating for Sensitive Actions

**User Story:** As a patient, I want my payments, medical records, and complaints reachable only from a fully verified session, so that a partially authenticated session cannot expose my protected data.

#### Acceptance Criteria

1. WHILE a session is at `aal2`, THE Route_Guard SHALL permit navigation to routes that expose a Sensitive_Action.
2. IF a session at `aal1` requests a route that exposes a Sensitive_Action for a user who has an Enrollment_Confirmed TOTP_Factor, THEN THE Route_Guard SHALL redirect the session to the Step_Up_Challenge.
3. THE RLS_Policy set SHALL require the session `aal` claim to equal `aal2` for read and write access to payments, medical records, and complaints tables.
4. IF the JWT `aal` claim value is not `aal2`, THEN THE RLS_Policy SHALL deny access to Sensitive_Action protected tables, treating the claim value as authoritative even if the live session might otherwise be considered `aal2`.
5. IF a session at `aal1` issues a database request for a Sensitive_Action protected table, THEN THE RLS_Policy SHALL deny the request.
6. THE RLS_Policy changes SHALL preserve the existing least-privilege read paths defined in migrations 024 through 026 for sessions that have satisfied the required assurance level.

### Requirement 6: Rate Limiting and Lockout on Failed Codes

**User Story:** As a security administrator, I want repeated wrong codes to be throttled and locked out, so that attackers cannot brute-force a TOTP or recovery code.

#### Acceptance Criteria

1. WHEN a user submits an incorrect TOTP code or Recovery_Code during a Step_Up_Challenge, THE MediBook_System SHALL increment a failed-attempt counter for that user.
2. IF the failed-attempt counter reaches 5 within a 15-minute window, THEN THE MediBook_System SHALL lock further MFA verification attempts for that user for 15 minutes.
3. WHILE a user is locked out, THE MediBook_System SHALL reject MFA verification submissions and display the actual failed-attempt count that triggered the lockout together with the remaining lockout duration.
4. WHEN a user submits a correct code before reaching the lockout threshold, THE MediBook_System SHALL reset the failed-attempt counter to zero.
5. WHEN the lockout window elapses, THE MediBook_System SHALL permit MFA verification attempts again and reset the failed-attempt counter.
6. WHEN a lockout is triggered, THE MediBook_System SHALL record an audit-log entry containing the user id and the lockout timestamp.

### Requirement 7: Admin-Assisted MFA Reset

**User Story:** As an administrator, I want to reset a locked-out user's MFA, so that a user who has lost their authenticator and recovery codes can regain access.

#### Acceptance Criteria

1. WHERE the caller holds the ADMIN role, THE MediBook_System SHALL expose an Admin_MFA_Reset action for a selected user.
2. WHEN an administrator confirms an Admin_MFA_Reset for a target user, THE MediBook_System SHALL remove all TOTP_Factors and invalidate all Recovery_Codes for that user.
3. IF a non-admin caller attempts an Admin_MFA_Reset, THEN THE MediBook_System SHALL deny the request.
4. WHEN an Admin_MFA_Reset completes, THE MediBook_System SHALL record an audit-log entry containing the acting admin id, the target user id, and the reset timestamp.
5. WHEN a Privileged_Role user signs in after an Admin_MFA_Reset, THE Route_Guard SHALL require the user to complete mandatory enrollment again per Requirement 4.

### Requirement 8: Self-Service MFA Management

**User Story:** As a user, I want to view and remove my registered authenticator, so that I can replace a lost device or rotate my second factor.

#### Acceptance Criteria

1. WHEN an authenticated user opens security settings, THE MediBook_System SHALL list the user's Enrollment_Confirmed TOTP_Factors with enrollment dates.
2. WHERE the current session is at `aal2`, THE MediBook_System SHALL allow the user to remove an existing TOTP_Factor.
3. IF a user at `aal1` attempts to remove a TOTP_Factor, THEN THE MediBook_System SHALL require a Step_Up_Challenge before allowing removal.
4. WHEN a user removes the last TOTP_Factor while holding a Privileged_Role, THE Route_Guard SHALL redirect the user to mandatory enrollment on the next protected-route access.
5. WHEN a user adds a replacement TOTP_Factor, THE MediBook_System SHALL follow the enrollment flow defined in Requirement 1.

### Requirement 9: Session, Assurance, and Existing-Gate Integration

**User Story:** As a user, I want MFA to work smoothly with idle timeout and the closed-account gate, so that security controls do not conflict or trap me.

#### Acceptance Criteria

1. WHEN the Auth_Provider establishes or refreshes a session, THE Auth_Provider SHALL expose the current assurance level to the Route_Guard.
2. WHEN the Session_Guard signs out an idle user, THE MediBook_System SHALL clear the assurance level so the next sign-in requires a fresh Step_Up_Challenge.
3. IF the Closed_Account_Gate detects an inactive profile, THEN THE MediBook_System SHALL sign the user out regardless of assurance level.
4. WHILE a session token is auto-refreshed, THE MediBook_System SHALL preserve the existing assurance level without forcing a new Step_Up_Challenge.
5. WHEN a user signs out, THE Auth_Provider SHALL clear cached assurance-level state.

### Requirement 10: Error Handling and User Experience States

**User Story:** As a user, I want clear guidance at every MFA step, so that I understand what to do and never get stuck without a next action.

#### Acceptance Criteria

1. WHEN the MFA_Service call fails due to a network or service error, THE MediBook_System SHALL display a retry-able error message and SHALL NOT expose raw error details.
2. WHILE an MFA verification request is in flight, THE MediBook_System SHALL disable the submit control and display a loading indicator.
3. IF a user submits a TOTP code that is not exactly 6 digits, THEN THE MediBook_System SHALL display a format-validation error before contacting the MFA_Service.
4. WHEN a user reaches the Step_Up_Challenge, THE MediBook_System SHALL provide a visible option to enter a Recovery_Code instead of a TOTP code.
5. WHEN a user is locked out or has lost all factors and recovery codes, THE MediBook_System SHALL display instructions to request an Admin_MFA_Reset.
6. THE MediBook_System SHALL present all MFA screens with accessible labels, focus management on error, and screen-reader-announced status messages.
