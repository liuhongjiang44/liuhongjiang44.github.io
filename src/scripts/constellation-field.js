/**
 * Constellation Field — ported from https://github.com/continue33/Vibe-UI (MIT).
 * Framework-free canvas background.
 * Drifting dust on a flow field, a sparse layer of linked nodes with glowing
 * anchors, and a gentle cursor parallax. Canvas 2D, zero dependencies.
 *
 * Usage:
 *   import { createConstellationField } from "./constellation-field.js";
 *   const destroy = createConstellationField(document.querySelector("canvas"));
 *   // later: destroy();
 *
 * The canvas is sized by CSS (it fills its own box); the script follows it
 * with a ResizeObserver. Honours prefers-reduced-motion and pauses in
 * background tabs.
 */

// ---------- tuning ----------
const SEED = 24301
const REF_AREA = 1440 * 810
const DUST_AT_REF = 4800
const DUST_FLOOR = 900
const NODES_AT_REF = 130
const NODE_FLOOR = 34
const LINK_DIST = 116
const WRAP = 24
const PARALLAX_MAX = 18 // dust ≈ 18px, nodes ≈ 9.5px
const DUST_DEPTH = 1.9
const PARALLAX_EASE = 0.045
const BUCKETS = 8

const HUES = [
  [278, 292], // violet
  [22, 38], // warm
]
const WARM_SHARE = 0.18
const ANCHOR_SHARE = 0.14

const DUST_STYLES = []
for (let c = 0; c < 2; c++) {
  const hue = (HUES[c][0] + HUES[c][1]) / 2
  const light = c ? 74 : 82
  for (let k = 0; k < BUCKETS; k++) {
    DUST_STYLES.push(
      `hsla(${hue},84%,${light}%,${((k + 0.5) / BUCKETS).toFixed(3)})`,
    )
  }
}
const LINK_STYLES = []
for (let k = 0; k < BUCKETS; k++) {
  LINK_STYLES.push(
    `rgba(184,170,232,${(((k + 1) / BUCKETS) * 0.28).toFixed(3)})`,
  )
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createConstellationField(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx)
    return () => {}

  let w = 0
  let h = 0
  let dpr = 1
  let dustCount = 0

  let dx = new Float32Array(0)
  let dy = new Float32Array(0)
  let dvx = new Float32Array(0)
  let dvy = new Float32Array(0)
  let dsize = new Uint8Array(0)
  let dcolor = new Uint8Array(0)
  let dbase = new Float32Array(0)
  let drate = new Float32Array(0)
  let dphase = new Float32Array(0)
  let nodes = []

  const groupCount = 2 * BUCKETS
  let groups = []
  const groupLen = new Int32Array(groupCount)
  const segs = Array.from({ length: BUCKETS }, () => [])

  let targetX = 0
  let targetY = 0
  let curX = 0
  let curY = 0
  let t = 0
  let raf = 0
  const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motionMq.matches

  function build() {
    const rand = mulberry32(SEED)
    const ratio = Math.min(1, (w * h) / REF_AREA)
    dustCount = Math.max(DUST_FLOOR, Math.round(DUST_AT_REF * ratio))
    const nodeCount = Math.max(NODE_FLOOR, Math.round(NODES_AT_REF * ratio))

    dx = new Float32Array(dustCount)
    dy = new Float32Array(dustCount)
    dvx = new Float32Array(dustCount)
    dvy = new Float32Array(dustCount)
    dsize = new Uint8Array(dustCount)
    dcolor = new Uint8Array(dustCount)
    dbase = new Float32Array(dustCount)
    drate = new Float32Array(dustCount)
    dphase = new Float32Array(dustCount)
    for (let i = 0; i < dustCount; i++) {
      dcolor[i] = rand() < WARM_SHARE ? 1 : 0
      dx[i] = rand() * w
      dy[i] = rand() * h
      dvx[i] = (rand() - 0.5) * 0.9
      dvy[i] = (rand() - 0.5) * 0.9
      dsize[i] = rand() < 0.82 ? 1 : 2
      dbase[i] = 0.34 + 0.62 * rand()
      dphase[i] = rand() * Math.PI * 2
      drate[i] = 0.6 + 1.8 * rand()
    }

    nodes = []
    for (let i = 0; i < nodeCount; i++) {
      const anchor = rand() < ANCHOR_SHARE
      const [lo, hi] = HUES[rand() < WARM_SHARE ? 1 : 0]
      const hue = lo + rand() * (hi - lo)
      nodes.push({
        x: rand() * w,
        y: rand() * h,
        vx: (rand() - 0.5) * 0.5,
        vy: (rand() - 0.5) * 0.5,
        r: anchor ? 1.7 + 1.2 * rand() : 0.8 + rand(),
        anchor,
        core: `hsla(${hue.toFixed(1)},84%,${anchor ? 90 : 80}%,${
          anchor ? 1 : 0.78
        })`,
        glow: `hsla(${hue.toFixed(1)},90%,78%,`,
        phase: rand() * Math.PI * 2,
        rate: 0.5 + rand() * 0.9,
      })
    }

    groups = Array.from(
      { length: groupCount },
      () => new Int32Array(dustCount),
    )
  }

  const wrapX = x => (x < -WRAP ? w + WRAP : x > w + WRAP ? -WRAP : x)
  const wrapY = y => (y < -WRAP ? h + WRAP : y > h + WRAP ? -WRAP : y)

  function step() {
    t += 1 / 60
    for (let i = 0; i < dustCount; i++) {
      let vx = dvx[i] + 0.02 * Math.sin(0.0045 * dy[i] + 0.34 * t)
      let vy = dvy[i] + 0.02 * Math.cos(0.0052 * dx[i] - 0.29 * t)
      vx *= 0.985
      vy *= 0.985
      dvx[i] = vx
      dvy[i] = vy
      dx[i] = wrapX(dx[i] + vx)
      dy[i] = wrapY(dy[i] + vy)
    }
    for (const n of nodes) {
      n.x = wrapX(n.x + n.vx)
      n.y = wrapY(n.y + n.vy)
    }
    curX += (targetX - curX) * PARALLAX_EASE
    curY += (targetY - curY) * PARALLAX_EASE
  }

  function draw() {
    const c = ctx
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    // transparent: the page's own dark background shows through
    c.clearRect(0, 0, w, h)

    // dust, batched by (colour, alpha bucket)
    groupLen.fill(0)
    for (let i = 0; i < dustCount; i++) {
      const a = dbase[i] * (0.62 + 0.38 * Math.sin(t * drate[i] + dphase[i]))
      let k = (a * BUCKETS) | 0
      if (k > BUCKETS - 1)
        k = BUCKETS - 1
      const g = dcolor[i] * BUCKETS + k
      groups[g][groupLen[g]++] = i
    }
    const pdx = curX * DUST_DEPTH
    const pdy = curY * DUST_DEPTH
    for (let g = 0; g < groupCount; g++) {
      const len = groupLen[g]
      if (!len)
        continue
      c.fillStyle = DUST_STYLES[g]
      const idx = groups[g]
      for (let j = 0; j < len; j++) {
        const i = idx[j]
        c.fillRect(dx[i] + pdx, dy[i] + pdy, dsize[i], dsize[i])
      }
    }

    // links, batched by alpha bucket
    const px = curX
    const py = curY
    for (let k = 0; k < BUCKETS; k++) segs[k].length = 0
    const L2 = LINK_DIST * LINK_DIST
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]
        const ddx = a.x - b.x
        if (ddx > LINK_DIST || ddx < -LINK_DIST)
          continue
        const ddy = a.y - b.y
        const d2 = ddx * ddx + ddy * ddy
        if (d2 > L2)
          continue
        let k = ((1 - Math.sqrt(d2) / LINK_DIST) * BUCKETS) | 0
        if (k > BUCKETS - 1)
          k = BUCKETS - 1
        segs[k].push(a.x + px, a.y + py, b.x + px, b.y + py)
      }
    }
    c.lineWidth = 1
    for (let k = 0; k < BUCKETS; k++) {
      const s = segs[k]
      if (!s.length)
        continue
      c.strokeStyle = LINK_STYLES[k]
      c.beginPath()
      for (let m = 0; m < s.length; m += 4) {
        c.moveTo(s[m], s[m + 1])
        c.lineTo(s[m + 2], s[m + 3])
      }
      c.stroke()
    }

    // nodes; anchors carry a soft breathing halo
    for (const n of nodes) {
      const x = n.x + px
      const y = n.y + py
      if (n.anchor) {
        const breathe = 0.36 + 0.14 * Math.sin(t * n.rate + n.phase)
        const R = 8 * n.r
        const grad = c.createRadialGradient(x, y, 0, x, y, R)
        grad.addColorStop(0, `${n.glow}${breathe.toFixed(3)})`)
        grad.addColorStop(1, 'hsla(0,0%,0%,0)')
        c.fillStyle = grad
        c.beginPath()
        c.arc(x, y, R, 0, Math.PI * 2)
        c.fill()
      }
      c.fillStyle = n.core
      c.beginPath()
      c.arc(x, y, n.r, 0, Math.PI * 2)
      c.fill()
    }
  }

  function frame() {
    raf = requestAnimationFrame(frame)
    step()
    draw()
  }

  const shouldRun = () =>
    !reduced && !document.hidden && dustCount > 0
  function updateLoop() {
    if (shouldRun()) {
      if (!raf)
        raf = requestAnimationFrame(frame)
    }
    else if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  function resize() {
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    if (!cw || !ch)
      return
    dpr = Math.min(2, window.devicePixelRatio || 1)
    const bw = Math.round(cw * dpr)
    const bh = Math.round(ch * dpr)
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    // rebuild from this instance's own state, never from canvas attributes
    if (dustCount === 0 || cw !== w || ch !== h) {
      w = cw
      h = ch
      build()
    }
    draw()
    updateLoop()
  }

  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // 全屏背景始终在视口内，不再用 IntersectionObserver 暂停：
  // 开场动画期间画布被圆形裁剪到很小，观察器可能误判为离屏而停住循环。
  // 后台标签页由 visibilitychange 负责暂停。

  const onVisibility = () => updateLoop()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onVisibility)
  window.addEventListener('pageshow', onVisibility)

  const onPointerMove = (e) => {
    if (reduced)
      return
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height)
      return
    const nx = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5))
    const ny = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5))
    targetX = -nx * 2 * (PARALLAX_MAX / DUST_DEPTH)
    targetY = -ny * 2 * (PARALLAX_MAX / DUST_DEPTH)
  }
  const onPointerOut = (e) => {
    if (!e.relatedTarget)
      targetX = targetY = 0
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerout', onPointerOut)

  const onMotionChange = () => {
    reduced = motionMq.matches
    if (reduced) {
      targetX = targetY = curX = curY = 0
      if (dustCount > 0)
        draw()
    }
    updateLoop()
  }
  motionMq.addEventListener('change', onMotionChange)

  resize()

  return function destroy() {
    if (raf)
      cancelAnimationFrame(raf)
    raf = 0
    ro.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onVisibility)
    window.removeEventListener('pageshow', onVisibility)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerout', onPointerOut)
    motionMq.removeEventListener('change', onMotionChange)
  }
}
