# Extension host configuration and OAuth

## Status

Accepted for implementation. Spotify is the first proving extension, but no
Spotify-specific behavior belongs in the host.

## Goals

- Built-in and installed extensions use the same validated package metadata.
- Extension configuration is initialized before extension activation.
- Extensions that are not configured remain discoverable without partially
  activating.
- OAuth runs in the Electron main process using Authorization Code with PKCE.
- OAuth credentials and secret configuration never enter renderer state or
  extension-owned storage.
- Native-app callbacks use a short-lived loopback listener bound to
  `127.0.0.1`.
- Provider configuration flows from the extension package manifest into the
  host without provider-specific registration code.

## Non-goals

- Embedded browser authentication.
- Client-secret OAuth flows. Desktop extensions are public clients.
- Provider-specific OAuth adapters without a demonstrated provider need.
- Compatibility with the previous custom-scheme callback or plaintext host
  credential storage.
- Background Spotify playback polling.

## Package contract

`package.json#ragdollExtension` is the canonical extension descriptor. It
declares identity, contributed capabilities, required host capabilities,
configuration fields, and OAuth endpoints. Built-ins import that descriptor;
installed extensions read it from disk. Both are normalized into one
`ExtensionPackageDescriptor` before host services or extension runtime code are
created.

An OAuth declaration must include:

- authorization and token endpoint URLs;
- requested scopes;
- the configuration key containing the public client ID;
- PKCE enabled.

It may also declare a fixed loopback callback port when the provider requires
the registered redirect URI to include one. Providers without that requirement
use an ephemeral port.

The host rejects metadata/runtime identity, capability, or host-requirement
drift.

## Configuration lifecycle

1. Discover and validate the package descriptor.
2. Initialize the extension's host-owned configuration manager.
3. Expose configuration status to settings UI.
4. Activate only when all required fields are present and the extension is
   enabled.
5. When configuration becomes complete, activate the extension.
6. When an OAuth client ID changes, disconnect the previous OAuth session
   before using the new client registration.

Public configuration is stored in host application storage. Fields marked
`secret` are encrypted with Electron secure storage and are returned to the
renderer only as redacted values.

## OAuth lifecycle

1. Create a short-lived callback listener on `127.0.0.1`, using the package's
   declared callback port or an ephemeral port when none is declared.
2. Generate a high-entropy PKCE verifier, S256 challenge, and independent
   one-use `state` value.
3. Open the provider authorization URL in the system browser.
4. Accept exactly one callback on the extension-specific path.
5. Verify `state` before exchanging the authorization code.
6. Exchange the code using the exact callback URI and PKCE verifier.
7. Encrypt tokens in host-owned storage and close the callback listener.
8. Refresh access tokens through one coalesced refresh operation.

The extension-facing OAuth capability exposes connection state,
`startFlow()`, `getAccessToken()`, `disconnect()`, and `isAuthenticated()`.
Refresh tokens remain private to the host.

## Failure semantics

- Missing configuration is an explicit lifecycle state, not a runtime
  fallback.
- Callback timeout, denial, state mismatch, token exchange failure, refresh
  failure, and unavailable secure storage remain distinguishable errors.
- API errors are not converted into empty domain state.
- No automatic retry is performed for provider rate limits.

## Acceptance criteria

- A built-in OAuth extension is discoverable before configuration and activates
  after its required configuration is saved.
- Installed and built-in packages receive identical config/OAuth host
  capabilities from equivalent descriptors.
- Incorrect callback state never reaches the token endpoint.
- Tokens and secret config values are absent from plaintext application and
  extension storage.
- Concurrent access-token requests share one refresh.
- Spotify can be configured, authenticated, searched, and controlled through
  the generic host capabilities.
- Spotify correctly distinguishes no playback from API failure and accepts only
  the current development-mode search limit.
