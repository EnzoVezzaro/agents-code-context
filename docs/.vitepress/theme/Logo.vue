<template>
  <!-- ============================================================
       COMPACT / INTERACTIVE LOGO
       ============================================================ -->
  <div
    v-if="compact"
    class="agc-compact"
  >
    <!-- The resting badge — a small markdown-file glyph in the topbar
         flow. Hovering gently zooms it; clicking (or Enter/Space while
         focused) launches the expansion, where the badge grows into the
         full AGENTS.md card. A hint appears on hover so the click affordance
         is obvious. -->
    <button
      ref="badgeRef"
      type="button"
      class="agc-badge"
      :style="{ width: size + 'px', height: size + 'px' }"
      :aria-label="`${brand} — ${name}. Click to expand.`"
      @click="toggle()"
      @keydown.enter.prevent="toggle()"
      @keydown.space.prevent="toggle()"
    >
      <span class="agc-badge-hint" aria-hidden="true">
        <span class="agc-hint-dot"></span>
        click to expand
      </span>
      <svg
        class="agc-badge-svg"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <!-- Markdown file: document with folded corner, centered
             in the 100×100 viewBox (doc spans x 26–74, y 14–84). -->
        <path
          class="md-doc"
          d="M26,14 h32 l16,16 v52 a4,4 0 0 1 -4,4 H26 a4,4 0 0 1 -4,-4 V18 a4,4 0 0 1 4,-4 z"
          stroke-width="3"
        />
        <path
          class="md-fold"
          d="M58,14 v16 h16"
        />

        <!-- heading: # -->
        <path
          class="md-head"
          d="M34,38 h26"
        />

        <!-- list item: - -->
        <circle
          class="md-dot"
          cx="36"
          cy="54"
          r="2.6"
        />
        <path
          class="md-line"
          d="M43,54 h24"
        />

        <!-- code fence: ``` -->
        <path
          class="md-code"
          d="M34,69 h10"
        />
        <path
          class="md-code"
          d="M34,75 h20"
        />
      </svg>
    </button>

    <!-- Full-viewport overlay: dimmed veil + the 3D card. Hidden until
         the badge is hovered; the card FLIPs from the badge's position
         to the center of the page (now showing the full AGENTS.md card),
         then slowly rotates to its back ("Markdown is all you need.").

         Teleported to <body>: the sticky topbar applies backdrop-filter,
         which becomes the containing block for fixed descendants — without
         the Teleport the overlay would only cover the topbar, not the
         viewport. -->
    <Teleport to="body">
      <div
        ref="overlayRef"
        class="agc-overlay"
        v-show="overlayVisible"
      >
        <div
          ref="veilRef"
          class="agc-veil"
          @click="leave()"
        ></div>

        <div
          ref="cardRef"
          class="agc-card3d"
        >
        <!-- ============ FRONT — THE AGENTS.MD CARD ============ -->
        <div class="agc-face agc-front">
          <!-- Morph layer: the badge glyph grown to card size. During the
               flight it is the only thing visible — the file zooming in.
               In the morph, the document outline unfolds into the card's
               frame (the fold straightens and the stroke thins into the
               border) while the AGENTS.md content grows out of it — one
               continuous shape, not a crossfade. -->
          <div class="agc-morph" ref="morphRef">
            <svg
              class="agc-morph-svg"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <path
                ref="morphOutlineRef"
                class="md-doc"
                d="M26,14 h32 l16,16 v52 a4,4 0 0 1 -4,4 h-44 a4,4 0 0 1 -4,-4 v-64 a4,4 0 0 1 4,-4 z"
                stroke-width="3"
              />
              <g ref="morphMarksRef" class="agc-morph-marks">
                <path
                  class="md-fold"
                  d="M58,14 v16 h16"
                />
                <path
                  class="md-head"
                  d="M34,38 h26"
                />
                <circle
                  class="md-dot"
                  cx="36"
                  cy="54"
                  r="2.6"
                />
                <path
                  class="md-line"
                  d="M43,54 h24"
                />
                <path
                  class="md-code"
                  d="M34,69 h10"
                />
                <path
                  class="md-code"
                  d="M34,75 h20"
                />
              </g>
            </svg>
          </div>
          <div class="agc-front-card" ref="frontContentRef">
            <div class="agc-tabbar">
              <div class="agc-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div class="agc-filename">
                <b>{{ filename }}</b> — {{ path }}
              </div>
            </div>

            <div class="agc-body">
              <div class="agc-frontmatter">
                <div class="agc-fm-line">---</div>

                <div class="agc-fm-line">
                  <span class="agc-key">name:</span>
                  <span class="agc-val">{{ name }}</span>
                </div>

                <div class="agc-fm-line">
                  <span class="agc-key">depends_on:</span>
                  <span class="agc-val">
                    [{{ dependsOn.join(', ') }}]
                  </span>
                </div>

                <div class="agc-fm-line">
                  <span class="agc-key">owner:</span>
                  <span class="agc-val">{{ owner }}</span>
                </div>

                <div class="agc-fm-line">
                  ---
                </div>
              </div>

              <div class="agc-derive">
                <span class="agc-arrow">›</span>
                <span>{{ command }}</span>
                <span class="agc-rule2"></span>
              </div>

              <div class="agc-graph-wrap">
                <svg
                  class="agc-graph"
                  viewBox="0 0 380 150"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <path
                    v-for="(edge, i) in edges"
                    :key="'e' + i"
                    class="agc-edge"
                    pathLength="1"
                    :d="edge.d"
                    :style="{
                      animationDelay: edge.delay + 's'
                    }"
                  />

                  <g
                    v-for="(node, i) in nodes"
                    :key="'n' + i"
                    class="agc-node"
                    :class="node.kind"
                    :style="{
                      animationDelay: node.delay + 's'
                    }"
                  >
                    <circle
                      :cx="node.x"
                      :cy="node.y"
                      :r="node.r"
                    />
                  </g>

                  <text
                    v-for="(node, i) in nodes"
                    :key="'t' + i"
                    class="agc-nodelabel"
                    :x="node.x"
                    :y="node.labelY"
                    text-anchor="middle"
                  >
                    {{ node.label }}
                  </text>
                </svg>
              </div>
            </div>

            <div class="agc-footer">
              <div class="agc-brandwrap">
                <span class="agc-brand">
                  {{ brand }}
                </span>

                <span class="agc-tag">
                  {{ tag }}
                </span>
              </div>

              <div class="agc-legend">
                <span class="agc-sw"></span>
                {{ legendLabel }}
              </div>
            </div>
          </div>
        </div>

          <!-- ============ BACK — MESSAGE ============ -->
          <div class="agc-face agc-back">
            <div class="agc-back-content">
              <div class="agc-back-mark">ACC</div>

              <div class="agc-back-title">
                Markdown<br />
                is all you need.
              </div>

              <div class="agc-back-rule"></div>

              <div class="agc-back-meta">agent code context</div>

              <a
                class="agc-back-link"
                :href="withBase('/markdown-is-all-you-need')"
              >
                Read the readings
                <span class="agc-back-arrow">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <!-- ============================================================
       FULL CARD (standalone, non-interactive)
       ============================================================ -->
  <div
    v-else
    class="agc-card"
  >
    <div class="agc-tabbar">
      <div class="agc-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div class="agc-filename">
        <b>{{ filename }}</b> — {{ path }}
      </div>
    </div>

    <div class="agc-body">
      <div class="agc-frontmatter">
        <div class="agc-fm-line">---</div>

        <div class="agc-fm-line">
          <span class="agc-key">name:</span>
          <span class="agc-val">{{ name }}</span>
        </div>

        <div class="agc-fm-line">
          <span class="agc-key">depends_on:</span>
          <span class="agc-val">
            [{{ dependsOn.join(', ') }}]
          </span>
        </div>

        <div class="agc-fm-line">
          <span class="agc-key">owner:</span>
          <span class="agc-val">{{ owner }}</span>
        </div>

        <div class="agc-fm-line">
          ---
        </div>
      </div>

      <div class="agc-derive">
        <span class="agc-arrow">›</span>
        <span>{{ command }}</span>
        <span class="agc-rule2"></span>
      </div>

      <div class="agc-graph-wrap">
        <svg
          class="agc-graph"
          viewBox="0 0 380 150"
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            v-for="(edge, i) in edges"
            :key="'e' + i"
            class="agc-edge"
            pathLength="1"
            :d="edge.d"
            :style="{
              animationDelay: edge.delay + 's'
            }"
          />

          <g
            v-for="(node, i) in nodes"
            :key="'n' + i"
            class="agc-node"
            :class="node.kind"
            :style="{
              animationDelay: node.delay + 's'
            }"
          >
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="node.r"
            />
          </g>

          <text
            v-for="(node, i) in nodes"
            :key="'t' + i"
            class="agc-nodelabel"
            :x="node.x"
            :y="node.labelY"
            text-anchor="middle"
          >
            {{ node.label }}
          </text>
        </svg>
      </div>
    </div>

    <div class="agc-footer">
      <div class="agc-brandwrap">
        <span class="agc-brand">
          {{ brand }}
        </span>

        <span class="agc-tag">
          {{ tag }}
        </span>
      </div>

      <div class="agc-legend">
        <span class="agc-sw"></span>
        {{ legendLabel }}
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  ref,
  onMounted,
  onBeforeUnmount
} from 'vue'
import { withBase } from 'vitepress'

import {
  animate
} from 'motion'

/* ================================================================
   PROPS
   ================================================================ */

const props = defineProps({
  filename: {
    type: String,
    default: 'AGENTS.md'
  },

  path: {
    type: String,
    default: 'src/auth'
  },

  name: {
    type: String,
    default: 'auth'
  },

  dependsOn: {
    type: Array,
    default: () => [
      'db',
      'http',
      'session',
      'token'
    ]
  },

  owner: {
    type: String,
    default: '@team-auth'
  },

  command: {
    type: String,
    default: 'acc graph --derive'
  },

  brand: {
    type: String,
    default: 'ACC'
  },

  tag: {
    type: String,
    default: 'agent code context'
  },

  legendLabel: {
    type: String,
    default: 'declared'
  },

  compact: {
    type: Boolean,
    default: false
  },

  size: {
    type: Number,
    default: 44
  }
})

/* ================================================================
   STATE
   ================================================================ */

const expanded = ref(false)
const overlayVisible = ref(false)

const badgeRef = ref(null)
const overlayRef = ref(null)
const veilRef = ref(null)
const cardRef = ref(null)
const morphRef = ref(null)
const morphOutlineRef = ref(null)
const morphMarksRef = ref(null)
const frontContentRef = ref(null)

let animations = []
let busy = false
let prefersReduced = false

/* The two states of the document outline. Both share an identical
   command structure (8 segments), so motion interpolates the path
   numerically: the folded-corner document unfolds into the card's
   plain rounded rectangle. */
const DOC_OUTLINE =
  'M26,14 h32 l16,16 v52 a4,4 0 0 1 -4,4 h-44 a4,4 0 0 1 -4,-4 v-64 a4,4 0 0 1 4,-4 z'

const CARD_OUTLINE =
  'M4,4 h92 l0,92 v0 a4,4 0 0 1 -4,4 h-88 a4,4 0 0 1 -4,-4 v-88 a4,4 0 0 1 4,-4 z'

/* ================================================================
   SIZE
   ================================================================ */

const iconSize = computed(() =>
  Math.min(props.size, 56)
)

/* ================================================================
   GRAPH (shared by the front card + standalone full card)
   ================================================================ */

const nodes = computed(() => {
  const deps = props.dependsOn.slice(0, 4)

  const positions = [
    { x: 90, y: 35 },
    { x: 90, y: 115 },
    { x: 290, y: 35 },
    { x: 290, y: 115 }
  ]

  const labelOffsets = [
    -13,
    17,
    -13,
    17
  ]

  const list = [
    {
      x: 190,
      y: 75,
      r: 9,
      kind: 'root',
      label: props.name,
      labelY: 98,
      delay: 0.15
    }
  ]

  deps.forEach((dep, i) => {
    if (!positions[i]) return

    list.push({
      x: positions[i].x,
      y: positions[i].y,
      r: 6.5,
      kind: '',
      label: dep,
      labelY:
        positions[i].y +
        labelOffsets[i],
      delay: 0.25 + i * 0.05
    })
  })

  if (deps.length > 0) {
    list.push({
      x: 30,
      y: 55,
      r: 4.5,
      kind: 'leaf',
      label: '',
      labelY: 40,
      delay: 0.5
    })
  }

  if (deps.length > 3) {
    list.push({
      x: 350,
      y: 95,
      r: 4.5,
      kind: 'leaf',
      label: '',
      labelY: 110,
      delay: 0.55
    })
  }

  return list
})

const edges = computed(() => {
  const root = {
    x: 190,
    y: 75
  }

  const list = []

  nodes.value
    .filter(
      node =>
        node.kind !== 'root' &&
        node.kind !== 'leaf'
    )
    .forEach((node, i) => {
      list.push({
        d: `
          M${root.x},${root.y}
          L${node.x},${node.y}
        `,
        delay: 0.05 + i * 0.1
      })
    })

  const leaves =
    nodes.value.filter(
      node => node.kind === 'leaf'
    )

  if (leaves[0]) {
    list.push({
      d: `
        M90,35
        L${leaves[0].x},${leaves[0].y}
      `,
      delay: 0.45
    })
  }

  if (leaves[1]) {
    list.push({
      d: `
        M290,115
        L${leaves[1].x},${leaves[1].y}
      `,
      delay: 0.5
    })
  }

  return list
})

/* ================================================================
   MOTION HELPERS
   ================================================================ */

function stopAnimations() {
  animations.forEach(animation => {
    try {
      animation.stop()
    } catch {
      // Animation may already be finished.
    }
  })

  animations = []
}

function wait(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  )
}

/* ================================================================
   EXPAND — fly to center, then slow 3D flip
   ================================================================ */

function overlaySize() {
  const vw = window.innerWidth
  const vh = window.innerHeight

  return Math.min(
    400,
    vw * 0.84,
    vh * 0.7
  )
}

async function enter() {
  if (busy || expanded.value) return
  busy = true

  const badge = badgeRef.value
  const card = cardRef.value
  const veil = veilRef.value
  const overlay = overlayRef.value
  const morph = morphRef.value
  const outline = morphOutlineRef.value
  const marks = morphMarksRef.value
  const content = frontContentRef.value

  if (!badge || !card || !veil || !overlay || !morph || !outline || !marks || !content) {
    busy = false
    return
  }

  stopAnimations()
  expanded.value = true
  overlayVisible.value = true

  const rect = badge.getBoundingClientRect()
  const size = overlaySize()
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Center the final card on the viewport.
  const centerX = (vw - size) / 2
  const centerY = (vh - size) / 2

  // FLIP: the card starts exactly where the badge sits (scaled down),
  // then flies to the center and grows to full size. While it grows,
  // only the morph layer is visible — the badge glyph zooming in — so
  // the expansion reads as the file itself getting bigger, not a new
  // image appearing.
  const fromX = rect.left + rect.width / 2
  const fromY = rect.top + rect.height / 2
  const toX = centerX + size / 2
  const toY = centerY + size / 2

  card.style.width = size + 'px'
  card.style.height = size + 'px'
  card.style.left = centerX + 'px'
  card.style.top = centerY + 'px'

  const startScale = rect.width / size

  card.style.transform =
    `translate(${fromX - toX}px, ${fromY - toY}px) scale(${startScale})`

  // Start with the glyph only (folded outline + marks, no card surface);
  // the card content grows out of it during the morph.
  morph.style.opacity = '1'
  morph.style.transform = 'scale(1)'
  outline.setAttribute('d', DOC_OUTLINE)
  outline.setAttribute('stroke-width', '3')
  marks.style.opacity = '1'
  marks.style.transform = 'scale(1)'
  content.style.opacity = '0'
  content.style.transform = 'scale(0.82)'

  // Force a frame so the FLIP start position is painted before animating.
  void overlay.offsetHeight

  if (prefersReduced) {
    // Reduced motion: jump straight to the flipped back face.
    card.style.transform = 'translate(0px, 0px) scale(1) rotateY(180deg)'
    veil.style.opacity = '0.9'
    morph.style.opacity = '0'
    content.style.opacity = '1'
    content.style.transform = 'scale(1)'
    busy = false
    return
  }

  // Veil fades in behind the card, timed with the flight so the two
  // feel like one motion.
  animations.push(
    animate(veil, { opacity: [0, 1] }, { duration: 1.0, ease: 'easeOut' })
  )

  // Fly to the center and grow. Three keyframes give the entry a gentle
  // ease-out glide with a soft settle (a hair of overshoot on scale), so
  // it lands instead of snapping.
  const fly = animate(
    card,
    {
      transform: [
        `translate(${fromX - toX}px, ${fromY - toY}px) scale(${startScale}) rotateY(0deg)`,
        'translate(0px, 0px) scale(1.015) rotateY(0deg)',
        'translate(0px, 0px) scale(1) rotateY(0deg)'
      ]
    },
    {
      duration: 1.3,
      times: [0, 0.86, 1],
      ease: [
        [0.16, 1, 0.3, 1],
        [0.34, 1, 0.4, 1]
      ]
    }
  )

  animations.push(fly)

  // The morph runs DURING the flight: a beat after the icon starts
  // moving, the document unfolds into the card — all while still
  // travelling. By the time it arrives at the center it is already the
  // card, so the whole thing reads as one continuous motion.
  await wait(160)

  if (!expanded.value) {
    fly.stop()
    return
  }

  // MORPH — geometry, not a crossfade. The document outline unfolds
  // (fold straightens) and scales from 80% to the full card, its stroke
  // thinning into the card's border; the inner marks disperse as the
  // AGENTS.md content grows out of the icon. All in ~0.35s, so it
  // finishes before the card is fully in view.
  const morphIn = Promise.all([
    animate(
      outline,
      { d: [DOC_OUTLINE, CARD_OUTLINE] },
      { duration: 0.35, ease: 'easeInOut' }
    ),
    animate(
      outline,
      { strokeWidth: [3, 0.3] },
      { duration: 0.35, ease: 'easeInOut' }
    ),
    animate(
      morph,
      {
        transform: ['scale(1)', 'scale(1.25)'],
        opacity: [1, 0]
      },
      { duration: 0.12, ease: 'easeOut' }
    ),
    animate(
      marks,
      {
        opacity: [1, 0],
        transform: ['scale(1)', 'scale(1.5)']
      },
      { duration: 0.12, ease: 'easeOut' }
    ),
    animate(
      content,
      {
        opacity: [0, 1],
        transform: ['scale(0.82)', 'scale(1)']
      },
      { duration: 0.3, delay: 0.12, ease: [0.16, 1, 0.3, 1] }
    )
  ])

  animations.push(morphIn)
  await morphIn

  if (!expanded.value) return

  // The unfolded outline now coincides with the card's own border —
  // hiding the layer is invisible.
  morph.style.opacity = '0'
  morph.style.transform = 'scale(1)'

  // Let the flight finish carrying the (now fully materialized) card.
  await fly

  if (!expanded.value) return

  // Give the card a beat as itself before the flip begins.
  await wait(250)

  if (!expanded.value) return

  // Deliberate 3D flip to the back face — a touch faster than before so
  // the reveal still reads clearly but doesn't drag.
  const flip = animate(
    card,
    {
      transform: [
        'translate(0px, 0px) scale(1) rotateY(0deg)',
        'translate(0px, 0px) scale(1) rotateY(60deg)',
        'translate(0px, 0px) scale(1) rotateY(120deg)',
        'translate(0px, 0px) scale(1) rotateY(180deg)'
      ]
    },
    {
      duration: 2.0,
      ease: [0.45, 0, 0.2, 1]
    }
  )

  animations.push(flip)
  await flip

  busy = false
}

/* ================================================================
   COLLAPSE — reverse everything
   ================================================================ */

async function leave() {
  if (busy || !expanded.value) return
  busy = true

  const badge = badgeRef.value
  const card = cardRef.value
  const veil = veilRef.value
  const overlay = overlayRef.value
  const morph = morphRef.value
  const outline = morphOutlineRef.value
  const marks = morphMarksRef.value
  const content = frontContentRef.value

  if (!badge || !card || !veil || !overlay || !morph || !outline || !marks || !content) {
    busy = false
    return
  }

  stopAnimations()

  const rect = badge.getBoundingClientRect()
  const size = Number(card.style.width) || overlaySize()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const centerX = (vw - size) / 2
  const centerY = (vh - size) / 2
  const toX = centerX + size / 2
  const toY = centerY + size / 2
  const fromX = rect.left + rect.width / 2
  const fromY = rect.top + rect.height / 2
  const startScale = rect.width / size

  if (prefersReduced) {
    expanded.value = false
    overlayVisible.value = false
    card.style.transform = ''
    morph.style.opacity = '0'
    content.style.opacity = '1'
    busy = false
    return
  }

  // Flip back to the card — snappier than the reveal.
  const flipBack = animate(
    card,
    {
      transform: [
        'translate(0px, 0px) scale(1) rotateY(180deg)',
        'translate(0px, 0px) scale(1) rotateY(0deg)'
      ]
    },
    { duration: 0.7, ease: [0.45, 0, 0.2, 1] }
  )

  animations.push(flipBack)
  await flipBack

  // REVERSE MORPH — the card shrinks back into the icon while the
  // folded document outline takes over, so the flight home is the file
  // folding back up. The glyph's unfolded state is restored instantly
  // beneath the still-opaque card, then it contracts as the card fades.
  morph.style.opacity = '0'
  morph.style.transform = 'scale(1.25)'
  outline.setAttribute('d', DOC_OUTLINE)
  outline.setAttribute('stroke-width', '3')
  marks.style.opacity = '0'
  marks.style.transform = 'scale(1)'

  animations.push(
    animate(
      content,
      {
        opacity: [1, 0],
        transform: ['scale(1)', 'scale(0.82)']
      },
      { duration: 0.22, ease: 'easeIn' }
    ),
    animate(
      morph,
      { transform: ['scale(1.25)', 'scale(1)'] },
      { duration: 0.22, ease: 'easeOut' }
    )
  )

  await wait(250)

  // Veil fades out in parallel with the flight home, so the dismiss
  // feels like one motion instead of two stacked fades.
  animations.push(
    animate(veil, { opacity: [1, 0] }, { duration: 0.5, ease: 'easeIn' })
  )

  // Fly back to the badge and shrink, with a soft settle on arrival.
  // The morph icon fades in during the flight — it materialises while
  // the card is still moving, reading as one continuous motion.
  const collapse = animate(
    card,
    {
      transform: [
        'translate(0px, 0px) scale(1) rotateY(0deg)',
        `translate(${(fromX - toX) * 0.94}px, ${(fromY - toY) * 0.94}px) scale(${Math.min(startScale * 1.08, 1)}) rotateY(0deg)`,
        `translate(${fromX - toX}px, ${fromY - toY}px) scale(${startScale}) rotateY(0deg)`
      ]
    },
    {
      duration: 0.95,
      times: [0, 0.8, 1],
      ease: [0.22, 1, 0.36, 1]
    }
  )

  animations.push(collapse)

  await collapse

  // Card hidden, badge visible again.
  morph.style.opacity = '0'
  expanded.value = false
  overlayVisible.value = false
  card.style.transform = ''
  busy = false
}

/* ================================================================
   TOGGLE (keyboard / click)
   ================================================================ */

function toggle() {
  if (expanded.value) {
    leave()
  } else {
    enter()
  }
}

/* ================================================================
   MOUNT — click / Enter / Space launches the expansion; Esc or a
   click on the dimmed veil collapses it. Hovering only zooms the
   badge (pure CSS, no motion).
   ================================================================ */

function onBlur() {
  // Window lost focus (tab switch) — collapse too.
  if (expanded.value) leave()
}

function onKey(e) {
  if (e.key === 'Escape' && expanded.value) leave()
}

onMounted(() => {
  prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  window.addEventListener('blur', onBlur)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  stopAnimations()
  window.removeEventListener('blur', onBlur)
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
/* ================================================================
   VARIABLES
   ================================================================ */

/* The overlay is Teleported to <body>, so it must define the tokens
   itself — custom properties do not cross the Teleport boundary from
   .agc-compact. The badge inherits them from .agc-compact; the overlay
   (veil + card faces) gets them from .agc-overlay. */
.agc-compact,
.agc-card,
.agc-overlay {
  --agc-paper: var(--bg, #fff);
  --agc-ink: var(--ink, #16161a);
  --agc-ink-soft: var(--muted, #55565c);
  --agc-line: var(--hair, #d9d8d2);
  --agc-line-strong: var(--hair-strong, #c9c8c2);
  --agc-accent: var(--primary, #c62828);

  --agc-accent-bright:
    color-mix(
      in oklch,
      var(--agc-accent) 100%,
      white 25%
    );

  --agc-accent-deep:
    color-mix(
      in oklch,
      var(--agc-accent) 100%,
      black 30%
    );
}

/* ================================================================
   RESTING BADGE — markdown file glyph
   ================================================================ */

.agc-compact {
  position: relative;

  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.agc-badge {
  position: relative;

  display: block;

  padding: 0;

  border-radius: 12px;

  background:
    linear-gradient(
      145deg,
      var(--agc-paper),
      color-mix(
        in oklch,
        var(--agc-paper) 92%,
        var(--agc-accent) 8%
      )
    );

  border:
    1px solid
    var(--agc-line-strong);

  box-shadow:
    0 1px 0 rgba(0, 0, 0, .04),
    0 8px 20px rgba(0, 0, 0, .08);

  cursor: pointer;

  transition:
    transform .4s cubic-bezier(.22, 1, .36, 1),
    box-shadow .4s ease;

  outline: none;
}

/* Hover: a gentle, smooth zoom — no expansion. The click does that. */
.agc-badge:hover {
  transform: translateY(-1px) scale(1.14);

  box-shadow:
    0 2px 0 rgba(0, 0, 0, .04),
    0 14px 30px rgba(0, 0, 0, .14);
}

/* Small "click to expand" hint — a page-themed tooltip (light surface,
   hairline border, red accent dot like the card's legend) with a little
   arrow pointing at the badge. Fades in below the badge on hover. */
.agc-badge-hint {
  position: absolute;

  left: 50%;
  top: calc(100% + 12px);

  display: inline-flex;
  align-items: center;
  gap: 6px;

  padding:
    6px
    10px;

  border-radius: 8px;

  background:
    var(--agc-paper);

  border:
    1px solid
    var(--agc-line-strong);

  box-shadow:
    0 1px 0 rgba(0, 0, 0, .03),
    0 10px 24px rgba(0, 0, 0, .10);

  color:
    var(--agc-ink-soft);

  font-family:
    var(--font,
    'Bricolage Grotesque',
    Inter,
    system-ui,
    sans-serif);

  font-size: 11px;

  font-weight: 500;

  letter-spacing: .01em;

  white-space: nowrap;

  opacity: 0;

  pointer-events: none;

  transform:
    translateX(-50%)
    translateY(-3px);

  transition:
    opacity .25s ease,
    transform .25s cubic-bezier(.22, 1, .36, 1);

  z-index: 10;
}

/* Little up-arrow: a rotated square, paper-colored with the same
   hairline border on its visible edges, tucking under the tooltip. */
.agc-badge-hint::after {
  content: '';

  position: absolute;

  left: 50%;
  top: -5px;

  width: 9px;
  height: 9px;

  transform:
    translateX(-50%)
    rotate(45deg);

  background:
    var(--agc-paper);

  border-left:
    1px solid
    var(--agc-line-strong);

  border-top:
    1px solid
    var(--agc-line-strong);

  border-radius: 1px;
}

/* Red accent dot — same language as the card's declared legend. */
.agc-hint-dot {
  width: 5px;
  height: 5px;

  flex-shrink: 0;

  border-radius: 50%;

  background:
    var(--agc-accent);
}

.agc-compact:hover
.agc-badge-hint {
  opacity: 1;

  transform:
    translateX(-50%)
    translateY(0);
}

.agc-badge:focus-visible {
  box-shadow:
    0 0 0 3px
    color-mix(in oklch, var(--agc-accent) 35%, transparent);
}

.agc-badge-svg {
  position: absolute;

  /* Center the markdown file in the badge square: inset all sides
     equally so the SVG box is a square centered on the button. */
  inset: 10%;

  width: 80%;
  height: 80%;

  display: block;

  overflow: visible;
}

/* ---- Morph layer: the badge glyph grown to card size. Sits at 80%
       of the card — the same proportion as in the badge — so at the
       flight's starting scale it is pixel-matched to the badge glyph,
       and grows with the card as one continuous shape. ---- */

.agc-morph {
  position: absolute;

  inset: 0;

  display: flex;

  align-items: center;
  justify-content: center;

  pointer-events: none;

  will-change: transform, opacity;
}

.agc-morph-svg {
  width: 80%;
  height: 80%;

  display: block;

  overflow: visible;

  filter:
    drop-shadow(0 10px 24px rgba(0, 0, 0, 0.16));
}

/* The flying icon keeps its white document fill (like the badge) — only
   the card background (the content's paper surface) is hidden until the
   morph, so the icon reads as one continuous shape while it grows. */

/* The marks scale from their own center when they disperse. */
.agc-morph-marks {
  transform-box: fill-box;
  transform-origin: center;
}

/* ---- markdown file strokes ---- */

.md-doc {
  fill:
    var(--agc-paper);

  stroke:
    var(--agc-ink);

  /* No stroke-width here: it lives on the SVG attribute so motion can
     animate it (a CSS rule would override the animated attribute). */

  stroke-linejoin: round;
}

.md-fold {
  fill: none;

  stroke:
    var(--agc-ink-soft);

  stroke-width: 2.4;

  stroke-linecap: round;
}

.md-head {
  fill: none;

  stroke:
    var(--agc-accent);

  stroke-width: 4.5;

  stroke-linecap: round;
}

.md-dot {
  fill:
    var(--agc-accent);
}

.md-line {
  fill: none;

  stroke:
    var(--agc-ink);

  stroke-width: 3;

  stroke-linecap: round;

  opacity: .75;
}

.md-code {
  fill: none;

  stroke:
    var(--agc-ink-soft);

  stroke-width: 2.6;

  stroke-linecap: round;

  opacity: .6;
}

/* ================================================================
   OVERLAY + VEIL
   ================================================================ */

.agc-overlay {
  position: fixed;

  inset: 0;

  z-index: 9998;

  perspective: 1600px;
}

.agc-veil {
  position: absolute;

  inset: 0;

  opacity: 0;

  background:
    color-mix(
      in oklch,
      var(--agc-ink) 34%,
      transparent
    );

  backdrop-filter:
    blur(4px) saturate(90%);
  -webkit-backdrop-filter:
    blur(4px) saturate(90%);

  cursor: default;
}

/* ================================================================
   3D CARD
   ================================================================ */

.agc-card3d {
  position: absolute;

  left: 0;
  top: 0;

  transform-style: preserve-3d;

  will-change: transform;

  /* The card swallows its own clicks; only the dimmed veil dismisses. */
  pointer-events: auto;
}

.agc-face {
  position: absolute;

  inset: 0;

  width: 100%;
  height: 100%;

  border-radius: 16px;

  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;

  box-sizing: border-box;
}

/* ---- FRONT: the AGENTS.md card. The face itself stays transparent
       during the flight so only the markdown glyph is visible; the
       paper surface lives on .agc-front-card, which fades in (opacity
       0 → 1) in the quick morph — the card materializes as one piece. ---- */

.agc-front {
  /* Purely visual (morph glyph + card content) — never interactive.
     Chrome still hit-tests this face after the flip (backface-hidden),
     so without this the invisible front content would block clicks on
     the back face's link. */
  pointer-events: none;

  color:
    var(--agc-ink);

  font-family:
    var(--font,
    'Inter',
    system-ui,
    sans-serif);
}

.agc-front-card {
  position: relative;

  z-index: 1;

  width: 100%;
  height: 100%;

  display: flex;

  flex-direction: column;

  box-sizing: border-box;

  background:
    var(--agc-paper);

  border:
    1px solid
    var(--agc-line-strong);

  border-radius:
    16px;

  box-shadow:
    0 30px 90px rgba(0, 0, 0, .22);

  overflow: hidden;
}

/* ---- BACK ---- */

.agc-back {
  transform:
    rotateY(180deg);

  background:
    var(--agc-ink);

  border:
    1px solid
    var(--agc-ink);

  box-shadow:
    0 40px 110px rgba(0, 0, 0, .35);
}

.agc-back-content {
  width: 100%;
  height: 100%;

  display: flex;

  flex-direction: column;

  align-items: center;
  justify-content: center;

  text-align: center;

  padding: 40px;

  box-sizing: border-box;
}

.agc-back-mark {
  font-family:
    var(--mono,
    'JetBrains Mono',
    ui-monospace,
    monospace);

  font-size: 13px;

  font-weight: 700;

  letter-spacing: .38em;

  color:
    var(--agc-accent-bright);

  margin-bottom: 26px;
}

.agc-back-title {
  font-family:
    var(--font,
    'Bricolage Grotesque',
    Inter,
    system-ui,
    sans-serif);

  font-size:
    clamp(30px, 5vw, 52px);

  line-height: .95;

  letter-spacing: -.05em;

  font-weight: 600;

  color:
    var(--agc-paper);

  text-wrap: balance;
}

.agc-back-rule {
  width: 42px;
  height: 2px;

  margin:
    30px
    auto
    22px;

  background:
    var(--agc-accent);
}

.agc-back-meta {
  font-family:
    var(--mono,
    'JetBrains Mono',
    ui-monospace,
    monospace);

  font-size: 9px;

  letter-spacing: .22em;

  text-transform: uppercase;

  color:
    color-mix(
      in oklch,
      var(--agc-paper) 55%,
      transparent
    );
}

.agc-back-link {
  display: inline-flex;

  align-items: center;

  gap: 6px;

  margin-top: 26px;

  font-family:
    var(--mono,
    'JetBrains Mono',
    ui-monospace,
    monospace);

  font-size: 11px;

  font-weight: 500;

  letter-spacing: .04em;

  color:
    var(--agc-accent-bright);

  text-decoration: none;

  transition:
    color .18s ease;
}

.agc-back-link:hover {
  color:
    var(--agc-paper);
}

.agc-back-arrow {
  display: inline-block;

  transition:
    transform .18s ease;
}

.agc-back-link:hover
.agc-back-arrow {
  transform: translateX(3px);
}

/* ================================================================
   CARD INTERNALS (shared: front face + standalone full card)
   ================================================================ */

.agc-tabbar {
  display: flex;

  align-items: center;

  gap: 8px;

  height: 34px;

  padding:
    0 14px;

  border-bottom:
    1px solid
    var(--agc-line);

  flex-shrink: 0;
}

.agc-dots {
  display: flex;
  gap: 5px;
}

.agc-dots span {
  width: 7px;
  height: 7px;

  border-radius: 50%;

  background:
    var(--agc-line);
}

.agc-filename {
  font-family:
    var(--mono,
    'JetBrains Mono',
    ui-monospace,
    monospace);

  font-size: 11px;

  color:
    var(--agc-ink-soft);

  margin-left: 4px;
}

.agc-filename b {
  color:
    var(--agc-ink);

  font-weight: 600;
}

.agc-body {
  position: relative;

  flex: 1;

  display: flex;

  flex-direction: column;

  padding:
    18px
    20px
    14px;

  min-height: 0;
}

.agc-frontmatter {
  font-family:
    var(--mono,
    'JetBrains Mono',
    ui-monospace,
    monospace);

  font-size: 12px;

  line-height: 1.75;
}

.agc-key {
  color:
    var(--agc-ink-soft);
}

.agc-val {
  color:
    var(--agc-ink);

  font-weight: 500;
}

.agc-fm-line {
  white-space: pre;
}

.agc-derive {
  display: flex;

  align-items: center;

  gap: 8px;

  margin:
    10px
    0
    4px;

  font-family:
    var(--mono,
    'JetBrains Mono',
    ui-monospace,
    monospace);

  font-size: 10.5px;

  color:
    var(--agc-ink-soft);
}

.agc-arrow {
  color:
    var(--agc-accent);

  font-size: 12px;
}

.agc-rule2 {
  flex: 1;

  height: 1px;

  background:
    repeating-linear-gradient(
      90deg,
      var(--agc-line) 0 4px,
      transparent 4px 8px
    );
}

.agc-graph-wrap {
  flex: 1;

  position: relative;

  min-height: 0;
}

.agc-graph {
  width: 100%;
  height: 100%;

  display: block;

  overflow: visible;
}

.agc-graph
.agc-edge {
  fill: none;

  stroke:
    var(--agc-ink);

  stroke-width: 1.2;

  stroke-linecap: round;

  opacity: .55;
}

.agc-graph
.agc-node circle {
  fill:
    var(--agc-paper);

  stroke:
    var(--agc-ink);

  stroke-width: 1.3;
}

.agc-graph
.agc-node.root circle {
  fill:
    var(--agc-accent);

  stroke:
    var(--agc-accent);
}

.agc-graph
.agc-node.leaf circle {
  stroke:
    var(--agc-ink-soft);
}

.agc-nodelabel {
  font-family:
    var(--mono,
    'JetBrains Mono',
    ui-monospace,
    monospace);

  font-size: 7.5px;

  fill:
    var(--agc-ink-soft);
}

.agc-footer {
  display: flex;

  align-items: center;

  justify-content: space-between;

  padding:
    10px
    18px
    14px;

  border-top:
    1px solid
    var(--agc-line);

  flex-shrink: 0;
}

.agc-brandwrap {
  display: flex;

  align-items: baseline;
}

.agc-brand {
  font-family:
    var(--mono,
    'JetBrains Mono',
    ui-monospace,
    monospace);

  font-size: 12px;

  font-weight: 700;

  letter-spacing: 2.5px;
}

.agc-tag {
  font-size: 8.5px;

  letter-spacing: 1.2px;

  color:
    var(--agc-ink-soft);

  text-transform: uppercase;

  margin-left: 8px;
}

.agc-legend {
  display: flex;

  align-items: center;

  gap: 5px;

  font-family:
    var(--mono,
    'JetBrains Mono',
    ui-monospace,
    monospace);

  font-size: 8.5px;

  color:
    var(--agc-ink-soft);
}

.agc-sw {
  width: 6px;
  height: 6px;

  border-radius: 50%;

  background:
    var(--agc-accent);
}

/* ================================================================
   STANDALONE FULL CARD
   ================================================================ */

.agc-card {
  position: relative;

  width: 100%;
  max-width: 440px;

  aspect-ratio: 1 / 1;

  background:
    var(--agc-paper);

  color:
    var(--agc-ink);

  border:
    1px solid
    var(--agc-line-strong);

  border-radius: 10px;

  overflow: hidden;

  display: flex;

  flex-direction: column;

  font-family:
    var(--font,
    'Inter',
    system-ui,
    sans-serif);
}

/* ================================================================
   ACCESSIBILITY
   ================================================================ */

@media (prefers-reduced-motion: reduce) {
  .agc-badge {
    transition: none;
  }
}

/* ================================================================
   SMALL SCREENS
   ================================================================ */

@media (max-width: 600px) {
  .agc-back-content {
    padding: 26px;
  }

  .agc-back-title {
    font-size: 30px;
  }

  .agc-back-mark {
    margin-bottom: 18px;
  }
}
</style>
