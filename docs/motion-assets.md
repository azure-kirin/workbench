# Motion assets for the web

*Turning a motion source file — an AI-generated clip, a screen capture, an exported render — into
web-ready assets: encoding recipes, naming, storage layout, embed pattern, accessibility.*

This is not framework-specific. It produces files. Where those files land in code is per-repo; this
procedure stops at the asset boundary.

## When to use it

- Adding a new motion asset — background, hover loop, ambient accent — to the library
- Re-encoding an existing source for a new use case at a different size
- Reviewing the library for stale or oversized files
- Any time an `.mp4` needs to ship to a browser

## Seven facts

1. **One library, medium-first.** Brand and product surfaces both pull from
   `assets/motion/<use-case>/`, mirrored by `assets/images/<use-case>/` for static. The use case is
   the sub-folder. Add a use case when the first asset for it arrives, never preemptively.
2. **Audio policy is encoded by the folder, not the filename.** `motion/backgrounds/` is silent,
   always. `motion/promo/` keeps its audio, because the deliverable is a social post. An
   audio-bearing category defines its own policy — including captions — at the moment the folder is
   created.
3. **Always ship dual format plus a poster.** `.webm` (VP9, primary, roughly 50% smaller) + `.mp4`
   (H.264 fallback) + `.poster.webp` (instant render, and the reduced-motion fallback). A browser
   downloads one video format, not both.
4. **Strip audio in conversion** when the destination folder mandates silence. The source may have
   audio; that is fine. The conversion uses `-an`.
5. **Keep the source.** `<name>.source.mp4` lives next to the web-ready files, so you can re-encode
   at a different size or in a new codec later without regenerating anything.
6. **Semantic names, never UUIDs.** `ambient-gradient-waves-1`, `studio-glow-pulse` — not
   `gen_20260506_185827_e2bfd15a`. Rename on intake.
7. **Cap the resolution to the use case.** 1920px wide for a hero background, 1280px inline, 720px
   for small accents. Never upscale — the `min(N,iw)` pattern below only scales down.

## Library layout

```
assets/
├── images/                            STATIC medium
│   └── backgrounds/
└── motion/                            MOTION medium
    ├── backgrounds/                   silent, looped video backgrounds
    │   ├── ambient-gradient-waves-1.source.mp4    (raw, archival)
    │   ├── ambient-gradient-waves-1.webm          (web primary)
    │   ├── ambient-gradient-waves-1.mp4           (web fallback)
    │   └── ambient-gradient-waves-1.poster.webp   (first frame)
    └── promo/                         audio-bearing, social destination
        ├── supper-club-launch.source.mp4          (raw, archival)
        └── supper-club-launch.mp4                 (delivered WITH audio)
```

**Adding a use case** (say `motion/explainers/`):

1. Create the folder
2. Add its audio policy to the table below
3. If it is audio-bearing, define the conversion variant — sample rate, codec, bitrate, caption
   track — *before* encoding the first asset

## Audio policy

| Folder | Policy | Why |
|---|---|---|
| `motion/backgrounds/` | **Silent always.** Stripped in conversion (`-an`). | iOS blocks autoplay with sound. Background audio is a UX ambush. A consistent, autoplay-friendly contract. |
| `motion/promo/` | **Audio-bearing.** Keep the audio in the deliverable. | The destination is a social post or story, where the sound is part of the asset and the platform gives the viewer a mute control. A web embed, if one is ever needed, takes a separate silent re-encode (`-an`) per the backgrounds recipe. |
| `motion/explainers/` (future) | Audio-bearing. Procedure to be defined. | Needs encode params, caption and transcript handling, and an accessibility contract before the first asset. |
| `motion/accents/` (future) | Likely silent. Decide at creation. | Same autoplay constraint. |

Names carry no audio tag — no `.silent.mp4` suffix. The folder is the policy.

**`promo/` is the counterexample that keeps the rule honest.** Everything else in this document
assumes a browser and therefore assumes silence, and it is easy to read "strip the audio" as a law
of motion assets. It is not: it is what the *destination* demands. A promo cut for a feed keeps
its audio, ships as one `.mp4` master to whatever the platform wants, and needs neither a webm nor
a poster — no `<video>` tag is involved. The moment that same clip is asked to sit on a page, it
stops being a promo asset and gets re-encoded from the source under the backgrounds recipe:
silent, dual-format, with a poster. One source, two destinations, two policies — which is exactly
why the policy lives on the folder and not on the file.

## File naming

`<semantic-name>.<role>.<ext>`

| Pattern | Role |
|---|---|
| `<name>.source.mp4` | The original, untouched. Archival only. |
| `<name>.webm` | Web primary (VP9). |
| `<name>.mp4` | Web fallback (H.264). |
| `<name>.poster.webp` | First frame; used as the `poster` attribute and as the reduced-motion fallback. |

The semantic name describes the visual. A numeric suffix only when the series is intentional.

In an audio-bearing folder the roles collapse: `<name>.mp4` is the delivered master, not a
fallback, and there is no `.webm` and no poster to sit beside it.

## Tooling

Once per machine:

```bash
brew install ffmpeg webp
```

Verify:

```bash
ffmpeg -version | head -1
cwebp -version
```

`cwebp` ships as a separate package — the stock ffmpeg formula does not include the libwebp
encoder.

## Conversion — backgrounds (silent, looped)

Run from `motion/backgrounds/`. Replace `<name>` with the semantic name. These three recipes are
the *browser* pipeline: they assume silence and a `<video>` tag. An audio-bearing folder like
`motion/promo/` does not run them — it keeps the audio and delivers the master the platform asks
for. Do not reach for `-an` because it is in the recipe; reach for it because the destination
folder says silent.

### 1. webm / VP9 — web primary

```bash
ffmpeg -y -hide_banner -loglevel warning \
  -i <name>.source.mp4 -an \
  -c:v libvpx-vp9 -b:v 0 -crf 32 \
  -row-mt 1 -tile-columns 2 -threads 4 \
  -deadline good -cpu-used 2 \
  -pix_fmt yuv420p \
  -vf "scale='min(1920,iw)':-2" \
  <name>.webm
```

### 2. mp4 / H.264 — web fallback

```bash
ffmpeg -y -hide_banner -loglevel warning \
  -i <name>.source.mp4 -an \
  -c:v libx264 -preset slow -crf 28 \
  -profile:v high -level 4.0 \
  -pix_fmt yuv420p \
  -vf "scale='min(1920,iw)':-2" \
  -movflags +faststart \
  <name>.mp4
```

### 3. poster — first frame as webp

```bash
ffmpeg -y -hide_banner -loglevel warning \
  -i <name>.source.mp4 \
  -ss 0 -vframes 1 \
  -vf "scale='min(1920,iw)':-2" \
  /tmp/poster_tmp.png

cwebp -q 80 -m 6 /tmp/poster_tmp.png -o <name>.poster.webp
rm /tmp/poster_tmp.png
```

## Knobs

| Knob | Default | When to change |
|---|---|---|
| `crf 32` (VP9) | the sweet spot for ambient backgrounds | 36–38 for decorative content far from focus; 28–30 if you see banding in dark gradients |
| `crf 28` (H.264) | a visually clean fallback | 30–32 for a smaller payload below the fold |
| `scale=1920` | hero, above the fold | `min(1280,iw)` for inline blocks; `min(720,iw)` for small accents |
| `-an` | strip audio | mandatory for `backgrounds/`; drop it for audio-bearing use cases |
| `-pix_fmt yuv420p` | broad compatibility | don't change — required by older Safari and most embedded players |
| `-movflags +faststart` | web streaming | don't change — moves the moov atom to the front so playback starts before the full download |

## Embed pattern

```html
<video class="bg-video"
       autoplay loop muted playsinline
       poster="/path/to/<name>.poster.webp"
       aria-hidden="true">
  <source src="/path/to/<name>.webm" type="video/webm" />
  <source src="/path/to/<name>.mp4"  type="video/mp4" />
</video>
```

```css
.bg-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
  pointer-events: none;
}

/* Reduced motion: hide the video, show the poster as a static background */
@media (prefers-reduced-motion: reduce) {
  .bg-video { display: none; }
  .bg-video-fallback {
    position: absolute;
    inset: 0;
    background: center / cover no-repeat url("/path/to/<name>.poster.webp");
    z-index: -1;
  }
}
```

```html
<!-- Render the fallback alongside the video; CSS hides whichever is not active -->
<div class="bg-video-fallback" aria-hidden="true"></div>
```

### Why each attribute

| Attribute | Reason |
|---|---|
| `autoplay` + `muted` + `playsinline` | iOS needs all three for inline autoplay. Missing any one means no autoplay, or a fullscreen takeover. |
| `loop` | Seamless looping — the source has to be authored loopable. |
| `poster` | Renders instantly while the video buffers, and doubles as the reduced-motion surface. |
| `aria-hidden="true"` | Background motion is decorative; keep it out of the accessibility tree. |
| `pointer-events: none` | A background should never intercept clicks. |

## Reduced motion

Mandatory for every motion asset **you embed**. Users with vestibular sensitivity must not be
served looping motion. The poster is the fallback surface — which is why it is part of the asset
bundle rather than an optional extra. When the destination is a platform rather than a page, the
platform owns playback and the poster does not exist; what you still owe that viewer is the second
paragraph.

If the asset is content-bearing rather than decorative, reduced-motion users still need the
information: provide a captioned static alternative or a text equivalent. Decide that per use case,
at the same time as the audio policy.

## Where the files go in code

The library is the **canonical source**. Copy into each repo's asset path — do not symlink;
cross-repo symlinks break in CI, in containers, and in most build pipelines.

| Repo | Asset path |
|---|---|
| Production web app | `assets/media/motion/<name>.{webm,mp4,poster.webp}` |
| Marketing site | `public/<section>/<name>.{webm,mp4,poster.webp}` |
| Standalone component library | `src/assets/motion/<name>.{webm,mp4,poster.webp}` |

The same `<name>` across repos means the same canonical asset, traceable back to one source file.

## Anti-patterns

Browser delivery, all of them. An audio-bearing folder answers to its own policy — shipping a
single `.mp4` with sound and no poster is correct there, and wrong here.

| ❌ | Why it breaks | ✅ Instead |
|---|---|---|
| Ship the raw 2MB+ source to the browser | Slow LCP, heavy on mobile data | Convert with the recipes above |
| Ship only `.mp4` | ~50% bigger payload for ~95% of users | Always pair webm and mp4, webm first |
| Audio in a background video | iOS blocks autoplay; desktop users get ambushed | `-an`, mandatory for `backgrounds/` |
| Missing `playsinline` on iOS | Opens fullscreen on tap, or never autoplays | Always `autoplay loop muted playsinline` together |
| No `poster` | Empty box while loading, nothing to fall back to | Always generate and set the poster |
| Skipping `prefers-reduced-motion` | Accessibility violation, vestibular harm | The CSS rule above |
| A UUID filename in production | Undebuggable, no meaning, hard to swap | Rename on intake |
| Keeping only the web-ready files | Cannot re-encode for a new size or codec without regenerating | Keep `<name>.source.mp4` |
| Symlinking the library into `public/` | Breaks builds and containers | Copy; treat the library as a source-of-truth registry |
| Two motion backgrounds adjacent on one page | Performance plus visual noise — the eye loses its anchor | One per viewport; demote the second to a poster-only static surface |

## Pre-flight checklist

- [ ] Source named semantically, with the `.source.mp4` suffix
- [ ] Source in the right medium folder and use-case sub-folder
- [ ] That folder's audio policy is defined

Everything below applies to a **browser-bound** asset. For an audio-bearing folder, stop here and
follow that folder's own policy — a `promo/` master has no webm, no poster and no `<video>`.

- [ ] `ffmpeg -version` and `cwebp -version` both succeed
- [ ] Three outputs generated: `.webm`, `.mp4`, `.poster.webp`
- [ ] All four files share the same `<name>` prefix
- [ ] webm is smaller than mp4 — a sanity check; if it is not, the recipe regressed
- [ ] Per-user payload (poster + ONE video) under target: hero ≤ 600KB, inline ≤ 400KB, accent
      ≤ 200KB
- [ ] If wired into a repo: the `<video>` carries `autoplay loop muted playsinline poster=`, both
      `<source>` elements, and the reduced-motion CSS
