---
theme: default
title: Litefleet — put a deadline on waiting
info: Real C4 architecture and pinned Go code. Voice intentionally stubbed.
colorSchema: dark
aspectRatio: 16/9
canvasWidth: 1280
transition: fade
fonts:
  provider: none
  sans: DejaVu Sans
  mono: DejaVu Sans Mono
drawings:
  enabled: false
magicMoveDuration: 1000
codeCopy: false
---

<div class="eyebrow">LITEFLEET / RELEASE IT! / 01</div>

# Put a deadline<br>on waiting.

<div class="lead">One silent node should not hold a gateway forever.</div>

```go
@@flawed@@
```

<div class="source">@@cite_flawed@@</div>
<div class="caption">An empty Go HTTP client has no overall timeout.</div>

<!--
0–4 seconds. Litefleet forwards SQL through a gateway. In the flawed version, this node client has no overall timeout. A silent node can hold the call open.
-->

---
class: architecture
---

<div class="eyebrow">C4 / GATEWAY COMPONENTS / 02</div>

# Find the waiting boundary.

<div class="diagram"><img src="/c4-gateway.png" alt="Litefleet C4 gateway components: tenant to API handlers, route client, node client, control plane and node agent" /></div>

```go
@@wiring@@
```

<div class="source">@@cite_wiring@@</div>
<div class="caption">API handlers use the node client to reach the owning node.</div>

<!--
4–8 seconds. The real C4 gateway view locates the boundary: handlers resolve a route, then the node client forwards the statement to its owning node. These are network dependencies.
-->

---

<div class="eyebrow">COMPONENT / NODE CLIENT / 03</div>

# Give each attempt a budget.

<div class="lead">200 ms to connect. 2.5 s for headers and the full exchange.</div>

```go
@@hardened@@
```

<div class="source">@@cite_hardened@@</div>
<div class="caption">The same constructor also configures bounded read retries.</div>

<!--
8–12 seconds. The hardened constructor sets a two hundred millisecond dial timeout and two point five seconds for headers and the total exchange. Read retries have their own bounded policy. This is an attempt budget, not a promise that the whole request finishes in two point five seconds.
-->

---

<div class="eyebrow">CODE EVOLUTION / SHIKI MAGIC MOVE / 04</div>

# Same function. Bounded waiting.

<div class="lead">v0-flawed → v1-hardened</div>

````md magic-move {duration:1000}
```go
@@flawed@@
```
```go
@@hardened@@
```
````

<div class="source">@@cite_evolution@@</div>
<div class="caption">The exact before/after source morphs on the timed click.</div>

<!--
12–19 seconds. Watch the same constructor change. The default client becomes a client with explicit phase deadlines, and the read retry policy becomes bounded. Every displayed line is extracted from one of the two pinned commits. At sixteen seconds, advance the Magic Move click.
-->

---

<div class="eyebrow">IMPLEMENTATION / HTTP TRANSPORT / 05</div>

# The budget reaches the socket.

```go
@@transport@@
```

<div class="source">@@cite_transport@@</div>
<div class="caption">DialContext, response headers, and the whole exchange each get a deadline.</div>

<!--
19–23 seconds. The shared HTTP helper applies the policy to the transport. DialContext bounds connecting; ResponseHeaderTimeout bounds the wait for headers; Client.Timeout bounds the exchange including body reads.
-->

---

<div class="eyebrow">EVIDENCE / FAULT-INJECTION CONTRACT / 06</div>

# Make the outage measurable.

```bash
@@checks@@
```

<div class="source">@@cite_checks@@</div>
<div class="lead">Blackhole node-a. Measure waiting, latency, and fast failures.</div>
<div class="caption">Repository acceptance checks shown. The fault-injection lab was not run for this POC.</div>
<div class="stub">NARRATION STUB · Speaker notes + timed captions · No synthesized voice</div>

<!--
23–28 seconds. The repository's timeout lesson blackholes node-a and checks in-flight requests, goroutines, outage latency and fast failure share. These are the actual acceptance checks, not results from this POC. Voice is stubbed; this recording proves the diagram-to-code presentation and animated transition.
-->
