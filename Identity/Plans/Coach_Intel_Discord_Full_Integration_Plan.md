# Coach Intel — Discord Full Integration Implementation Plan

**Product:** Coach Intel  
**Descriptor:** Competitive Intelligence for Call of Duty  
**Target:** Claude Code implementation plan  
**Scope:** Discord authentication + account linking + organization server connection + role mapping + channel integration + Coach Intel notifications + sharing + slash-command foundation  
**Rule:** Integrate into the existing Coach Intel architecture and design system. Do not redesign unrelated modules or replace existing authentication/business logic unless integration requires a minimal extension.

---

# 1. Mission

Implement Discord as a first-class optional Coach Intel integration.

The completed integration should allow users to:

1. **Sign in with Discord**
2. Link/unlink Discord to an existing Coach Intel account
3. Connect a Discord server to a Coach Intel organization/team
4. Select approved Discord channels
5. Map Discord roles to Coach Intel roles
6. Send Coach Intel notifications into Discord
7. Share Strats, reports, Intel, VOD review items, and match preparation links
8. Test and manage the integration from Coach Intel
9. Preserve Coach Intel's own authorization model as the final source of truth
10. Disconnect/revoke Discord cleanly without damaging Coach Intel data

Do **not** ingest private Discord conversations, DMs, voice audio, or general channel history in the initial implementation.

---

# 2. Official Discord Integration Model

Use Discord's official OAuth2 and application APIs.

## Authentication

Use the **OAuth2 Authorization Code Grant**.

Minimum sign-in scope:

```text
identify
```

Only request:

```text
email
```

if the existing Coach Intel account system genuinely requires an email address from Discord.

For users selecting servers they can connect, request:

```text
guilds
```

For reading the current user's membership details in a selected server when required:

```text
guilds.members.read
```

Do not request broader scopes pre-emptively.

Use Discord's OAuth2 `state` parameter and validate it on callback to protect the authorization flow against CSRF.

## Discord App / Bot

Create one official Discord application for Coach Intel.

The same Discord application can provide:

- OAuth2 sign-in
- Bot installation
- REST API access
- Slash/application commands
- Channel notifications

Use:

```text
bot
applications.commands
```

when installing the Coach Intel bot into an organization server.

Do not request Administrator permission.

---

# 3. Integration Principles

Claude Code must follow these rules:

- Inspect the existing repository before implementing.
- Reuse the current authentication/session architecture.
- Reuse the current organization/team/user models.
- Reuse the existing UI component library and Coach Intel styling.
- Do not create a second parallel authentication system.
- Do not expose Discord client secrets or bot tokens to frontend code.
- Do not store Discord tokens in localStorage.
- Keep all sensitive Discord operations server-side.
- Encrypt sensitive tokens at rest if persistent storage exists.
- Request least privilege.
- No Discord message-history ingestion.
- No voice-channel recording.
- No automatic role grants without explicit mapping/approval.
- No silent server/channel configuration changes.
- Every destructive disconnect action requires confirmation.
- Preserve Coach Intel data when Discord is disconnected.

---

# 4. Phase 0 — Repository Audit

Before writing code, inspect the repository and create a short implementation report.

Identify:

```text
Framework
Frontend entry points
Backend/server/API structure
Authentication provider
Session model
User model
Organization model
Team model
Role/permission model
Settings/Integrations area
Environment-variable handling
Database/persistence layer
Existing notification/event system
Existing router
Existing test framework
Existing logging/audit system
Deployment targets
```

Also locate:

- Sign-in page
- Sign-up/onboarding
- User settings
- Organization settings
- Integrations
- Team/member management
- Toast/notification components
- API client
- Server middleware
- security utilities

### Audit Output

Before implementation, summarize:

```text
CURRENT ARCHITECTURE
DISCORD INSERTION POINTS
FILES TO MODIFY
FILES TO CREATE
DATA MODEL CHANGES
ENV VARIABLES
RISKS / BLOCKERS
```

Then continue implementation unless a genuine blocker makes safe implementation impossible.

---

# 5. Discord Developer Configuration

Prepare support for these environment variables.

Names may be adapted to repository conventions:

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_REDIRECT_URI=
DISCORD_BOT_REDIRECT_URI=
DISCORD_PUBLIC_KEY=
DISCORD_TOKEN_ENCRYPTION_KEY=
```

Frontend may receive only non-secret values such as:

```env
PUBLIC_DISCORD_CLIENT_ID=
```

Never expose:

```text
DISCORD_CLIENT_SECRET
DISCORD_BOT_TOKEN
DISCORD_TOKEN_ENCRYPTION_KEY
```

to browser bundles or logs.

### Redirect URIs

Support separate environments:

```text
Local
Preview/Staging
Production
```

No wildcard redirect URIs.

---

# 6. Sign In with Discord

Add to Coach Intel's sign-in screen:

```text
[ Continue with Discord ]
```

Use Coach Intel styling.

Do not make Discord mandatory if another login method already exists.

## Flow

```text
User
→ Continue with Discord
→ Coach Intel generates secure OAuth state
→ Redirect to Discord authorization
→ Discord callback
→ Validate state
→ Exchange code server-side
→ Fetch Discord /users/@me
→ Resolve Coach Intel identity
→ Create or authenticate account
→ Create Coach Intel session
→ Redirect to application
```

## Identity Fields

Store only what is useful:

```text
discord_user_id
discord_username
discord_global_name
discord_avatar
discord_connected_at
discord_last_verified_at
```

Do not use the mutable Discord username as the primary identifier.

Use the immutable Discord user ID.

---

# 7. Account Creation / Existing Account Handling

Support three scenarios.

## A. New User

User chooses Discord from sign-in/sign-up.

Create the Coach Intel account using Discord identity and continue to Coach Intel organization/team onboarding.

Example:

```text
Continue with Discord
→ Discord approved
→ Welcome to Coach Intel
→ Organization Name
→ Team Name
→ Roster Setup
```

## B. Existing Coach Intel User Links Discord

Path:

```text
SETTINGS
→ ACCOUNT
→ CONNECTED ACCOUNTS
→ DISCORD
→ CONNECT
```

Require an already authenticated Coach Intel session.

Do not create another user.

## C. Identity Conflict

If the Discord account is already linked to another Coach Intel user:

```text
This Discord account is already connected to another Coach Intel account.
```

Do not auto-merge.

Create a safe recovery/support path.

---

# 8. Connected Accounts UI

Add:

```text
SETTINGS → ACCOUNT → CONNECTED ACCOUNTS
```

Discord card:

```text
DISCORD

Status          CONNECTED
Account         @username
Display Name    Example
Connected       16 Aug 2026

[REFRESH] [DISCONNECT]
```

Disconnected:

```text
DISCORD

Use Discord to sign in and connect your competitive workspace.

[CONNECT DISCORD]
```

---

# 9. Discord Organization Integration

Separate **user authentication** from **organization Discord integration**.

A user being signed in through Discord does not automatically connect a Discord server.

Add:

```text
SETTINGS → INTEGRATIONS → DISCORD
```

States:

```text
NOT CONNECTED
CONNECTING
CONNECTED
NEEDS ATTENTION
PERMISSION ERROR
DISCONNECTED
```

---

# 10. Connect Discord Server

Organization Owner/Admin initiates:

```text
[ CONNECT DISCORD SERVER ]
```

Flow:

```text
Coach Intel
→ Discord OAuth/server install
→ User selects authorized Discord server
→ Install Coach Intel bot
→ Discord callback
→ Validate server + permissions
→ Link Discord guild ID to Coach Intel organization
→ Select channels
→ Configure role mapping
→ Test
→ Save
```

Do not let normal players connect an organization-wide Discord server.

---

# 11. Guild Eligibility

Only show Discord servers the current user is allowed to manage/connect.

Server connection must be approved by a Coach Intel:

```text
Owner
Admin
```

and by Discord's own authorization rules.

Store:

```text
coach_intel_org_id
discord_guild_id
discord_guild_name
discord_guild_icon
connected_by_user_id
connected_at
last_verified_at
status
```

One organization may initially connect one Discord server.

Design the model so multiple servers could be supported later without rewriting the schema.

---

# 12. Bot Permission Model

Use minimal Discord permissions.

Initial bot capabilities need only enough access to:

- View approved channels
- Send messages in approved channels
- Embed links/content where allowed
- Use application commands
- Read basic guild/role configuration required for mapping

Avoid:

- Administrator
- Manage Server
- Manage Channels
- Manage Messages
- Ban Members
- Kick Members

Only add an elevated permission if a concrete Coach Intel feature requires it.

Coach Intel should **read Discord roles**, not manage Discord roles, in the first implementation.

---

# 13. Discord Roles → Coach Intel Roles

Add:

```text
ROLE MAPPING
```

Example:

```text
Discord Role        Coach Intel Role

Head Coach       →  HEAD COACH
Coach            →  COACH
Analyst          →  ANALYST
Main Roster      →  PLAYER
Management       →  VIEWER
```

Allow:

```text
[+ ADD MAPPING]
```

Important:

**Coach Intel authorization remains authoritative.**

Discord roles can:

- Suggest role assignment
- Assist onboarding
- Sync approved mappings

Discord roles must **not** bypass Coach Intel authorization rules.

---

# 14. Role Sync Behavior

Implement selectable behavior:

```text
Role Sync

(•) Manual Review
( ) Automatic for Approved Mappings
```

Default:

```text
MANUAL REVIEW
```

### Manual Review

Example:

```text
DISCORD ROLE CHANGE DETECTED

@PlayerName
Discord: Main Roster
Coach Intel: Viewer

Suggested:
PLAYER

[APPLY] [IGNORE]
```

### Automatic

Only organization Owner/Admin can enable automatic role sync.

Record all automatic role changes in the audit log.

---

# 15. Channels

After connecting the server, fetch channels the Coach Intel bot can actually use.

Add:

```text
DISCORD CHANNELS

General Intel        #coach-intel
Match Reports        #match-reports
Strat Review         #strats
VOD Review           #vod-review
Alerts               #coach-alerts
```

Each category can point to:

- Same channel
- Different channels
- Disabled

Do not assume channel names.

Use Discord channel IDs internally.

---

# 16. Channel Permission Validation

Before saving a channel, test whether the bot can:

- View channel
- Send message
- Send supported embed/link content

Display:

```text
#coach-intel
✓ Connected

#private-coaches
✕ Missing permission
```

Do not fail the entire Discord integration because one optional channel is unavailable.

---

# 17. Test Connection

Add:

```text
[ TEST DISCORD CONNECTION ]
```

Send a minimal test message to the configured test/general channel.

Example:

```text
COACH INTEL

Discord integration connected successfully.

Organization: Example Org
Status: Ready
```

Coach Intel UI:

```text
TEST SUCCESSFUL
Message delivered to #coach-intel.
```

---

# 18. Notification System

Create a provider abstraction rather than hard-coding Discord throughout the app.

Example:

```text
NotificationProvider

- InAppProvider
- DiscordProvider
- Future providers
```

Coach Intel domain events produce notification payloads.

DiscordProvider converts them to Discord messages.

---

# 19. Discord Notification Types

Support configurable events:

## Intel

```text
New High-Confidence Intel
Important Intel Updated
Opponent Intel Changed
```

## Strategy

```text
Strat Ready for Review
Strat Approved
Strat Changed
Match-Ready Strat Updated
```

## Review

```text
New Needs Review
Review Assigned
Review Overdue
Review Resolved
```

## Match

```text
Pre-Match Pack Ready
Opponent Report Ready
Match Preparation Incomplete
Post-Match Review Ready
```

## VOD

```text
New VOD Review Item
VOD Note Assigned
Clip Added to Review
```

## CDL / Data

```text
CDL Ruleset Change Detected
Breaking Point Opponent Data Updated
Data Conflict Requires Review
```

Each event must be individually enabled/disabled.

---

# 20. Notification Preferences

Settings:

```text
DISCORD NOTIFICATIONS

Intel
[✓] High-confidence Intel
[ ] All Intel

Strategies
[✓] Ready for Review
[✓] Approved
[ ] All changes

Matches
[✓] Pre-Match Pack
[✓] Post-Match Review

VOD
[✓] Assigned Review

Data
[✓] CDL ruleset changes
[ ] External-data refreshes
```

Avoid notification spam.

Default to high-value events only.

---

# 21. Discord Message Design

Messages should look like Coach Intel, not like raw debug output.

Example:

```text
COACH INTEL · STRAT REVIEW

Den · Hardpoint
P2 → P3 Rotation

Status
READY FOR REVIEW

Updated by
CoachName

Open in Coach Intel →
```

Include:

- Type
- Team
- Map/mode where relevant
- Short summary
- Priority/status
- Deep link to Coach Intel

Do not send confidential details when a link is enough.

---

# 22. Privacy Level Per Notification

Add event sensitivity:

```text
PUBLIC TEAM
COACHING STAFF
RESTRICTED
```

A notification must only be sent to a channel configured for that sensitivity.

Example:

Player-sensitive coaching notes should never be posted automatically into a general team channel.

---

# 23. Share to Discord

Add a contextual action:

```text
SHARE → DISCORD
```

Applicable to:

- Strat
- Setup
- Intel
- Pre-Match Pack
- Post-Match Review
- VOD item
- Report
- Practice task
- Map page

Flow:

```text
SHARE TO DISCORD

Server       Team Discord
Channel      #strats

Include:
[✓] Title
[✓] Summary
[✓] Coach Intel Link

[SHARE]
```

Do not send screenshots/files unless explicitly selected.

---

# 24. Strategy Review Integration

From a saved Strat:

```text
[ SHARE FOR REVIEW ]
```

Discord receives:

```text
COACH INTEL · STRAT

Den / Hardpoint
P2 → P3 Rotation

Status: READY FOR REVIEW
Author: CoachName

[Open Strategy]
```

The link returns to the exact Coach Intel strategy.

Authorization must still be checked inside Coach Intel.

Possessing the Discord link alone must not grant access.

---

# 25. Match Preparation Integration

Pre-match pack can send:

```text
COACH INTEL · MATCH PREP

OpTic vs Opponent
Friday · 19:00

Readiness       82%
Strats Ready    7/9
Open Reviews    2
Opponent Intel  UPDATED

[Open Match Prep]
```

Do not dump the full scouting report into Discord by default.

---

# 26. Slash Commands

Install an initial, small command set through Discord application commands.

Recommended:

```text
/coachintel
/coachintel status
/coachintel match
/coachintel review
/coachintel intel
```

Possible later commands:

```text
/coachintel strat
/coachintel player
/coachintel map
```

Do not expose sensitive data without checking:

- Guild mapping
- Discord identity
- Coach Intel account
- Organization membership
- Coach Intel permission

---

# 27. Slash Command Authorization

Every command request must resolve:

```text
Discord User ID
→ Coach Intel User
→ Organization
→ Guild Connection
→ Coach Intel Role
→ Required Permission
```

If not authorized:

```text
Your Discord account is not linked to an authorized Coach Intel member.
```

Do not use Discord role alone as sufficient authorization.

---

# 28. Interaction Endpoint Security

For Discord application/interactions endpoints:

- Verify Discord request signatures using the application public key.
- Reject invalid or replayed requests.
- Respect interaction response time requirements.
- Use deferred responses for longer Coach Intel queries.
- Never trust unsigned payloads.

---

# 29. Discord API Client

Create an isolated Discord service.

Suggested conceptual structure:

```text
/services/discord/
    oauth
    client
    guilds
    channels
    roles
    bot
    interactions
    notifications
    mapper
    tokenStore
```

Adapt to the repository's existing conventions.

Do not scatter raw Discord API requests throughout UI components.

---

# 30. Suggested Server Endpoints

Adapt paths to the current backend.

Conceptually:

```text
GET    /auth/discord
GET    /auth/discord/callback
POST   /auth/discord/link
DELETE /auth/discord/link

GET    /api/integrations/discord
POST   /api/integrations/discord/connect
GET    /api/integrations/discord/callback
DELETE /api/integrations/discord

GET    /api/integrations/discord/guild
GET    /api/integrations/discord/channels
GET    /api/integrations/discord/roles

PUT    /api/integrations/discord/channels
PUT    /api/integrations/discord/role-mappings
PUT    /api/integrations/discord/preferences

POST   /api/integrations/discord/test
POST   /api/integrations/discord/share

POST   /api/discord/interactions
```

Use CSRF/auth/session protections consistent with the existing backend.

---

# 31. Data Model

Adapt to existing persistence.

## User Discord Identity

```text
UserDiscordIdentity
id
user_id
discord_user_id
username
global_name
avatar
access_token_encrypted_optional
refresh_token_encrypted_optional
token_expires_at_optional
scopes
connected_at
last_verified_at
```

Do not persist user OAuth tokens if they are not required after login/linking.

## Organization Discord Connection

```text
DiscordIntegration
id
organization_id
discord_guild_id
guild_name
guild_icon
bot_installed
status
connected_by
connected_at
last_verified_at
last_error
```

## Channel Mapping

```text
DiscordChannelMapping
id
integration_id
purpose
discord_channel_id
discord_channel_name
sensitivity
enabled
```

## Role Mapping

```text
DiscordRoleMapping
id
integration_id
discord_role_id
discord_role_name
coach_intel_role
sync_mode
enabled
```

## Notification Preference

```text
DiscordNotificationPreference
integration_id
event_type
enabled
channel_mapping_id
```

---

# 32. Tokens

Separate:

### Discord User OAuth Token

Used only when user-authorized Discord endpoints require it.

### Bot Token

Server-side application secret.

Rules:

- Never send bot token to frontend.
- Never log tokens.
- Never include tokens in error responses.
- Encrypt persistent OAuth refresh/access tokens.
- Prefer not to store OAuth tokens when unnecessary.
- Revoke/clear tokens on disconnect where supported.

---

# 33. OAuth State

Implement:

```text
Secure random state
Short expiration
One-time use
Session binding
Callback validation
```

Reject:

- Missing state
- Expired state
- Reused state
- Mismatched state

---

# 34. Error Handling

User-facing states:

```text
Discord authorization was cancelled.
Discord account already linked.
You do not have permission to connect this server.
Coach Intel bot is missing required channel permissions.
Discord is temporarily unavailable.
The Discord connection needs to be refreshed.
```

Never expose raw Discord tokens or stack traces.

---

# 35. Rate Limits

Discord API interactions must respect Discord rate-limit responses.

Implement:

- Central Discord HTTP client
- Rate-limit header handling
- Retry only when appropriate
- Backoff
- Queue/batch notification bursts
- No uncontrolled polling

Do not repeatedly refresh guild/channels/roles on every page render.

Cache stable configuration.

---

# 36. Audit Log

Record important events:

```text
Discord account linked
Discord account unlinked
Guild connected
Guild disconnected
Channel mapping changed
Role mapping changed
Automatic role sync performed
Notification preference changed
Test message sent
Integration error
Bot permissions changed
```

Include:

```text
actor
organization
timestamp
action
target
result
```

Do not audit secrets.

---

# 37. Disconnect User Discord

User action:

```text
DISCONNECT DISCORD ACCOUNT
```

Explain:

```text
You will no longer be able to sign in with Discord unless another sign-in method exists.
Your Coach Intel data will not be deleted.
```

Prevent account lockout.

If Discord is the user's only authentication method, require them to add another method before unlinking, unless full account deletion is intended.

---

# 38. Disconnect Organization Server

Admin action:

```text
DISCONNECT DISCORD SERVER
```

Confirmation:

```text
This stops Discord notifications, sharing and role sync.

Coach Intel teams, players, Strats, Intel, matches and reports will remain unchanged.

[DISCONNECT]
```

Clean:

- Integration mapping
- Channel mappings
- Role mappings
- Pending Discord jobs
- Stored webhook/token references where applicable

Do not delete Coach Intel domain data.

---

# 39. Bot Removal Detection

Coach Intel should detect when:

- Bot removed from server
- Permissions revoked
- Channel deleted
- Role deleted
- Server inaccessible

Set:

```text
NEEDS ATTENTION
```

and show the exact remediation.

Example:

```text
Discord channel #strats no longer exists.
Select another channel.
```

---

# 40. Integration Health Panel

Display:

```text
DISCORD

Account Login          ✓
Server                  ✓ Team Discord
Bot                     ✓ Installed
Notifications           ✓ Active
Strat Channel           ✓ #strats
Intel Channel           ✓ #intel
Role Mapping            ⚠ 1 Needs Review
Last Verified           8m ago

[TEST CONNECTION]
[MANAGE]
```

---

# 41. No General Message Reading — Initial Release

Explicitly do **not** implement:

- Reading all channel messages
- Indexing Discord chat
- AI analysis of private team chat
- Reading DMs
- Recording voice channels
- Monitoring players' online activity
- Message-content intent

These can be considered separately only with a clear product need, explicit organization consent, privacy controls, and appropriate Discord permissions/policies.

---

# 42. Webhook vs Bot Delivery

Prefer the installed Coach Intel bot for the full integration because it supports:

- Guild identity
- Channel discovery
- Role discovery
- Application commands
- Unified organization integration

Discord incoming webhooks may be used as a lightweight provider abstraction where appropriate, but do not maintain two competing integration paths unless the repository benefits from it.

---

# 43. Frontend Components

Suggested components:

```text
DiscordSignInButton
DiscordConnectedAccountCard
DiscordIntegrationCard
DiscordGuildCard
DiscordChannelSelector
DiscordRoleMapper
DiscordNotificationSettings
DiscordIntegrationHealth
DiscordShareDialog
DiscordDisconnectDialog
DiscordTestConnection
```

All must follow the existing Coach Intel visual system.

---

# 44. Coach Intel Navigation

Authentication:

```text
SIGN IN
→ Continue with Discord
```

Personal:

```text
SETTINGS
→ ACCOUNT
→ CONNECTED ACCOUNTS
→ Discord
```

Organization:

```text
SETTINGS
→ INTEGRATIONS
→ Discord
```

Context actions:

```text
Strat → Share → Discord
Intel → Share → Discord
Report → Share → Discord
VOD → Share → Discord
```

---

# 45. Event Architecture

Create a domain-event layer if one does not already exist.

Examples:

```text
intel.high_confidence.created
strategy.review_requested
strategy.approved
review.assigned
match.pre_match_ready
match.post_match_ready
vod.review_assigned
cdl.ruleset_change_detected
external.opponent_updated
```

Discord notification delivery subscribes to these events.

Do not call Discord directly from deep inside unrelated domain modules.

---

# 46. Idempotency

Prevent duplicate notifications.

Example:

```text
event_id + provider + destination
```

should be unique/idempotent.

Retries must not create duplicate Discord posts.

---

# 47. Deep Links

Every Discord notification should deep-link into the relevant Coach Intel item.

Examples:

```text
/teams/:teamId/strats/:stratId
/matches/:matchId/prep
/intel/:intelId
/review/:reviewId
/vod/:vodId
```

Deep-link targets must enforce Coach Intel permissions.

---

# 48. Tests — Authentication

Implement automated tests for:

- OAuth start
- Secure state creation
- Correct callback
- Invalid state
- Expired state
- Discord denial
- Token exchange failure
- New Discord user
- Existing linked user
- Duplicate Discord identity
- Link account
- Unlink account
- Account lockout prevention

---

# 49. Tests — Organization Integration

Test:

- Admin connects guild
- Non-admin rejected
- Bot install success
- Bot missing
- Guild mismatch
- Channel listing
- Role listing
- Save channel mappings
- Save role mappings
- Permission failure
- Disconnect
- Bot removed

---

# 50. Tests — Notifications

Test:

- Correct event → correct Discord category
- Disabled event sends nothing
- Correct channel
- Missing channel handled
- Bot permission loss
- Rate-limit retry
- Duplicate event protection
- Deep link
- Restricted event not sent to public channel

---

# 51. Tests — Security

Verify:

- Secrets never appear in frontend bundle
- Secrets never appear in logs
- OAuth state validated
- Callback cannot be replayed
- Unauthorized users cannot connect guild
- Unauthorized users cannot change mappings
- Interaction signatures are verified
- Slash commands enforce Coach Intel authorization
- Discord links do not bypass Coach Intel permissions
- Tokens encrypted if stored

---

# 52. Manual QA

Run:

### Sign-In

```text
New user → Discord → onboarding
Existing Discord user → login
Existing Coach Intel user → link Discord
Unlink Discord
```

### Integration

```text
Connect server
Choose channels
Map roles
Test connection
Send Strat
Send Intel
Send report
Disconnect
Reconnect
```

### Failure

```text
Remove bot
Remove channel
Remove mapped role
Revoke Discord access
Discord API error
Missing permissions
```

---

# 53. Rollout

## Phase 1 — Authentication

- Discord application configuration
- Sign in with Discord
- Account linking/unlinking
- Connected-account UI

## Phase 2 — Server Integration

- Bot install
- Guild connection
- Channel selection
- Role mapping
- Health/status

## Phase 3 — Notifications & Sharing

- Event provider
- Notification preferences
- Strat sharing
- Intel sharing
- Pre/post-match reports
- VOD/review notifications

## Phase 4 — Discord Commands

- `/coachintel status`
- `/coachintel match`
- `/coachintel review`
- `/coachintel intel`

## Phase 5 — Refinement

- Role synchronization
- Better notification templates
- Monitoring/recovery
- Rate-limit hardening
- Audit coverage

---

# 54. Definition of Done

The Discord integration is production-ready when:

- [ ] A new user can create/sign into Coach Intel using Discord.
- [ ] An existing Coach Intel user can safely link Discord.
- [ ] Duplicate Discord identities cannot create account ambiguity.
- [ ] Owner/Admin can install the Coach Intel bot into an authorized Discord server.
- [ ] Coach Intel can list usable channels.
- [ ] Admin can configure notification destinations.
- [ ] Admin can map Discord roles to Coach Intel roles.
- [ ] Coach Intel remains the final authorization authority.
- [ ] Test notification works.
- [ ] Strat can be shared to Discord.
- [ ] Intel can be shared to Discord.
- [ ] Match-prep/report notifications work.
- [ ] Sensitive events respect channel sensitivity.
- [ ] Slash commands enforce identity and Coach Intel permissions.
- [ ] Removing Discord does not delete Coach Intel data.
- [ ] OAuth state/CSRF protection is tested.
- [ ] Discord interaction signatures are verified.
- [ ] Secrets are server-only.
- [ ] Rate limits and retries are handled.
- [ ] Audit events exist.
- [ ] Integration errors are understandable and recoverable.
- [ ] Existing Coach Intel tests continue passing.
- [ ] No unrelated UI/business logic is redesigned.

---

# 55. Claude Code Execution Instruction

Use this document as the implementation specification.

### Required working method

1. Inspect the full relevant repository before modifying anything.
2. Produce the Phase 0 audit.
3. Identify the smallest architecture-compatible implementation.
4. Implement incrementally.
5. Run tests after each integration layer.
6. Do not replace functioning authentication or organization logic without necessity.
7. Do not use mock Discord data in production paths.
8. Keep Discord behind a provider/service boundary.
9. Add migrations only where required.
10. Update environment templates and setup documentation.
11. Never commit real Discord secrets.
12. Finish with a complete implementation report.

### Final implementation report must contain

```text
IMPLEMENTED
FILES CREATED
FILES MODIFIED
MIGRATIONS
ENV VARIABLES REQUIRED
DISCORD DEVELOPER PORTAL SETUP REQUIRED
SCOPES USED
BOT PERMISSIONS USED
API ROUTES
TESTS ADDED
TEST RESULTS
SECURITY CHECK
MANUAL QA CHECKLIST
KNOWN LIMITATIONS
NEXT OPTIONAL IMPROVEMENTS
```

Do not declare the integration complete while tests fail or required security controls remain missing.

---

# 56. Official Discord Requirements Used in This Plan

The implementation must verify these details against the current official Discord developer documentation while coding:

- OAuth2 Authorization Code Grant
- OAuth2 `state` validation
- `identify` scope for basic current-user identity
- `guilds` scope for the user's guild list
- `guilds.members.read` only when current-member guild information is actually required
- `bot` + `applications.commands` for bot/application-command installation
- Discord guild/role endpoints and their permission requirements
- Discord interaction request-signature verification
- Discord rate limits
- Incoming webhook capabilities if that provider is used

If Discord's official documentation has changed, follow the current official documentation and record the deviation in the implementation report.

---

## Final Product Principle

Discord should make Coach Intel **easier to access and easier to act on**, not turn Coach Intel into a Discord data-mining system.

The integration flow is:

**DISCORD IDENTITY → COACH INTEL ACCOUNT → ORGANIZATION → TEAM → INTEL / STRATS / REVIEW → DISCORD ACTION**

Coach Intel remains the system of record.

Discord becomes the team's authentication, communication, and action layer.
