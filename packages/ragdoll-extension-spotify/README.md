# @vokality/ragdoll-extension-spotify

Spotify search and Spotify Connect playback-control tools for Ragdoll hosts.

The extension uses the host-provided OAuth capability. Create a Spotify Web API
application, configure its client ID in Lumen, and register this loopback
redirect URI in the Spotify developer dashboard:

```text
http://127.0.0.1:43821/oauth/callback/spotify
```

Spotify declares its fixed callback port in the package OAuth metadata, and the
host binds the loopback listener to that port for the authorization flow. A
Spotify Premium account and an active Spotify Connect device are required for
playback-control endpoints.

The extension contributes tools only. It does not embed a player, render UI, or
poll playback in the background.
