---
theme: default
title: Litefleet — a timeout turns a hang into an error
info: Real C4 architecture and pinned Go code. Silent video; captions carry the narration.
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
magicMoveDuration: 1200
codeCopy: false
layout: default
class: opener
---

<div class="eyebrow">LITEFLEET · RELEASE IT! · TIMEOUTS</div>

# A timeout turns a hang<br>into an error.

<div class="lead">In litefleet's gateway, one constructor decided whether a silent node could hold every request forever. Watch it gain a deadline — then see what that bought in the repo's outage test.</div>

<div class="facts">
  <span>Real C4 render</span>
  <span>Code from pinned commits v0-flawed → v1-hardened</span>
  <span>Recorded results, not re-run</span>
</div>

<div class="caption">The lesson: never wait on the network without a limit.</div>

<!--
0–4.5 seconds. The design lesson first: a timeout turns a hang into an error, and an error is something the system can handle. Litefleet's gateway proves it with one constructor, the node client. We will see where it sits, how it changed across three pinned commits, and what the repository's own outage test recorded before and after.
-->

---
clicks: 1
---

<div class="eyebrow">1 / 3 · WHERE THE WAIT HAPPENS</div>

# Every query crosses the node client.

<div class="diagram" :class="{ zoom: $clicks >= 1 }">
  <div class="canvas">
    <img src="/c4-gateway.png" alt="Litefleet C4 gateway components: tenant to API handlers, route client, node client, control plane and node agent" />
    <div class="ring handlers"></div>
    <div class="ring nodeclient"></div>
    <div class="ring agent"></div>
  </div>
</div>

```go
@@wiring@@
```

<div class="source">@@cite_wiring@@</div>

<div class="caption swap" :class="{ on: $clicks === 0 }">The real C4 render of litefleet's gateway process and its two network dependencies.</div>
<div class="caption swap" :class="{ on: $clicks >= 1 }">Each statement leaves the gateway through the node client: a network wait.</div>

<!--
4.5–11.5 seconds. This is the real C4 component render of the gateway process. Zoom in: API handlers resolve a route, then the node client forwards the statement over the network to the node agent that owns the database. The gateway wires that client with nodeclient.New. Whatever New builds decides how long a request can wait on a node.
-->

---

<div class="eyebrow">2 / 3 · ONE CONSTRUCTOR, THREE COMMITS · SHIKI MAGIC MOVE</div>

# nodeclient.New learns to stop waiting.

<div class="steps">
  <span :class="{ on: $clicks === 0 }">v0-flawed</span><b>→</b>
  <span :class="{ on: $clicks === 1 }">lesson-02 · timeouts</span><b>→</b>
  <span :class="{ on: $clicks >= 2 }">v1-hardened</span>
</div>

````md magic-move {duration:1200}
```go
@@flawed@@
```
```go
@@deadlines@@
```
```go
@@hardened@@
```
````

<div class="cites">
  <div class="source swap" :class="{ on: $clicks === 0 }">@@cite_flawed@@</div>
  <div class="source swap" :class="{ on: $clicks === 1 }">@@cite_deadlines@@</div>
  <div class="source swap" :class="{ on: $clicks >= 2 }">@@cite_hardened@@</div>
</div>

<div class="callouts">
  <div class="callout flaw swap" :class="{ on: $clicks === 0 }"><strong>The flaw</strong> <code>&amp;http.Client{}</code> sets no connect, header or total timeout. A node that accepts the connection and never answers holds the request, and its goroutine, indefinitely.</div>
  <div class="callout swap" :class="{ on: $clicks === 1 }"><strong>What changed</strong> Each attempt now has a budget: 200 ms to connect, 2.5 s for headers and for the whole exchange. A hang ends as an error the gateway can return as a 504.</div>
  <div class="callout swap" :class="{ on: $clicks >= 2 }"><strong>Then, bounded retries</strong> The deadlines stay. Reads may retry at most twice, with backoff capped at 400 ms and retries held under 10 % of node calls. Writes are never retried.</div>
</div>

<div class="caption swap" :class="{ on: $clicks === 0 }">v0: an empty http.Client. Nothing limits how long a node call can wait.</div>
<div class="caption swap" :class="{ on: $clicks === 1 }">Lesson 02 puts a deadline on every attempt: 200 ms to connect, 2.5 s in total.</div>
<div class="caption swap" :class="{ on: $clicks >= 2 }">v1 keeps those deadlines and bounds read retries, so waiting stays finite.</div>

<!--
11.5–27.5 seconds. The flawed v0 constructor returns an empty http.Client: no connect timeout, no response-header timeout, no total. A node that accepts a connection and never answers holds the request and its goroutine indefinitely.

First click, at lesson-02: the same function now builds its client from three numbers — two hundred milliseconds to dial, two and a half seconds for response headers, and two and a half seconds for the whole exchange. That is a per-attempt budget; a hang becomes an error the gateway answers with a 504.

Second click, at v1-hardened: the deadlines stay, and reads gain a bounded retry policy — at most two retries, backoff capped at four hundred milliseconds, only while retries stay under ten percent of node calls. Writes are never retried. Every line shown comes from one of the three pinned commits.
-->

---

<div class="eyebrow">3 / 3 · WHAT THE DEADLINE BOUGHT</div>

# Same outage. Bounded waiting.

<div class="compare">
<div>
<div class="label before">BEFORE · lesson-01 (no timeouts)</div>

```text
@@before@@
```

<div class="source">@@cite_before@@</div>
</div>
<div>
<div class="label after">AFTER · lesson-02 (timeouts)</div>

```text
@@after@@
```

<div class="source">@@cite_after@@</div>
</div>
</div>

<div class="stats">
  <div><span>Peak in-flight requests</span><b>1130 → 149</b></div>
  <div><span>Peak gateway goroutines</span><b>4650 → 632</b></div>
  <div><span>node-a failures answered 504</span><b>0.0 % → 99.4 %</b></div>
</div>

<div class="note">Excerpted from the repo's recorded verify run: node-a blackholed for 20 s under 300 req/s of reads. It measures the whole lesson-02 timeout patch, not this constructor alone, and was not re-run for this video.</div>

<div class="caption">Recorded outage: peak in-flight 1130 → 149; failures answered 504: 0 % → 99.4 %.</div>

<!--
27.5–34.5 seconds. The repository's lesson 02 records a before and after run: node-a's proxy accepts connections and never answers for twenty seconds while the gateway serves three hundred reads per second. Before the timeouts, in-flight requests peaked at 1130, goroutines at 4650, and none of node-a's failures came back as a 504. After, in-flight peaked at 149, goroutines at 632, and 99.4 percent of them did. These numbers are quoted from the lesson file at the v1-hardened commit; they cover the whole lesson-02 patch, and this video did not re-run the experiment.
-->

---
class: endcard
---

<div class="eyebrow">TAKEAWAY</div>
<div class="wordmark">litefleet</div>

# Never wait without a limit.

<div class="lead">Give every network call a deadline. A timeout turns a hang into an error the rest of the system can retry, report or shed.</div>

<div class="facts">
  <span>book-notes · release-it/v0-flawed 6076a82 → lesson-02 8e71627 → v1-hardened 9367863</span>
</div>

<div class="stub">SILENT VIDEO · CAPTIONS CARRY THE NARRATION · NO SYNTHESIZED VOICE</div>

<!--
34.5–38.5 seconds. Litefleet's takeaway: never wait without a limit. Give every network call a deadline, because a timeout turns a hang into an error the rest of the system can retry, report or shed. Voice is not synthesized; these notes are the narration script and the on-screen captions carry it.
-->
