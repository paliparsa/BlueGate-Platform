# BlueGate v0.10.9 — Smart Locations & Subscription Fix

- 3x-ui location count is based on unique country flags found in inbound remarks, not inbound count.
- Duplicate inbounds from the same country collapse into one location.
- The customer location list shows flag + Persian country name.
- Target/inbound remarks are persisted from the provider and refreshed for old services on service sync/view.
- 3x-ui share links (`vless://`, `vmess://`, etc.) are no longer accepted as a subscription URL.
- BlueGate reads official 3x-ui subscription settings using `/panel/api/setting/all` and constructs the native subscription from `subURI`, or from `subDomain`, `subPort`, `subPath` and the client's `subId`.
- Existing services that accidentally stored an individual config as `subscription_url` are repaired on view/sync when the panel is reachable.
