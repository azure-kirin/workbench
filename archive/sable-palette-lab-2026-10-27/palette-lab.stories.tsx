/**
 * Sandbox/Palette Lab — TEMPORARY, round 4 (the Wash: shaped + fluid). Round 3: Three sets (Warm, Cool, Neutral),
 * each one family: greys of its temperature, an analogous aura trio for the
 * wash, a button accent drawn from that trio. Shown on Mariia's stage recipe
 * over three photos. Lives in git-ignored sandbox/, tagged `!test`. Round 2's
 * data is in round2/.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRightIcon } from "lucide-react";
import { Fragment, useState } from "react";
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Surface,
} from "../../src/components/items/index.ts";
import globalsCss from "../../src/globals.css?raw";
import { cn } from "../../src/utils.ts";
import { formatOklch, oklchToRgb, rgbToHex } from "./color.ts";
import { checkSet, GROUPS, readDeclarations, summarise } from "./contrast.ts";
import { trioHarmony } from "./harmony.ts";
import "./lab.css";
import { type PaletteSet, SETS, type SetId } from "./sets.ts";
import { PHOTO_IDS, PHOTOS, type PhotoId, Stage, type Strength } from "./stage.tsx";
import {
  BACKDROPS,
  type BackdropReading,
  type BackdropSetting,
  BLENDS,
  type Calm,
  COMPOSITIONS,
  calmFor,
  DEFAULT_VARIANT,
  VARIANTS,
  Wash,
  type WashBlend,
  type WashRenderer,
  type WashVariant,
} from "./wash/index.ts";

const DECLARED = readDeclarations(globalsCss);

const meta = {
  title: "Sandbox/Palette Lab",
  tags: ["!test", "!autodocs"],
  parameters: { layout: "fullscreen", a11y: { test: "off" } },
} satisfies Meta;
export default meta;

// ─── Controls ──────────────────────────────────────────────────────────────

interface Controls {
  photoOpacity: 55 | 100;
  strength: Strength;
  renderer: WashRenderer;
  variant: WashVariant;
  seed: number;
  motion: boolean;
  backdrop: BackdropSetting;
  blend: "profile" | WashBlend;
}

const CONTROL_TYPES = {
  photoOpacity: {
    name: "Photo opacity",
    control: { type: "inline-radio", labels: { 55: "55%", 100: "100%" } },
    options: [55, 100],
    description: "55% is the reference default; its labs ran the photo at 100%.",
  },
  strength: {
    name: "Wash intensity",
    control: "inline-radio",
    options: ["bold", "medium", "subtle"],
    description:
      "Spine peaks for slots 1/2/3 — bold .6/.45/.35 · medium .4/.3/.25 · subtle .25/.15/.1. Glow falls off from the spine; never a flat fill.",
  },
  renderer: {
    name: "Renderer",
    control: "inline-radio",
    options: ["fluid", "shaped"],
    description:
      "fluid: WebGL, drifting (falls back to shaped without WebGL) · shaped: static SVG",
  },
  variant: {
    name: "Composition",
    control: "inline-radio",
    options: VARIANTS,
    description: "sweep · fold (Mariia's reference) · tide · corner",
  },
  seed: {
    name: "Seed",
    control: { type: "number", min: 0, max: 99, step: 1 },
    description: "Shifts the composition deterministically; odd seeds mirror it.",
  },
  motion: {
    name: "Motion",
    control: "boolean",
    description: "Fluid only. Reduced motion always renders one still frame.",
  },
  backdrop: {
    name: "Backdrop profile",
    control: "inline-radio",
    options: ["auto", ...BACKDROPS],
    description:
      "auto measures each photo's mean luma (32×20, after photo opacity) and picks dark / medium / light; or force one profile on every stage.",
  },
  blend: {
    name: "Blend override",
    control: "inline-radio",
    options: ["profile", ...BLENDS],
    description:
      "profile = the backdrop profile's own blend. screen / plus-lighter add light · color / soft-light / overlay / multiply tint · normal lays colour on top.",
  },
} as const;

const CONTROL_DEFAULTS: Controls = {
  photoOpacity: 55,
  strength: "bold",
  renderer: "fluid",
  variant: DEFAULT_VARIANT,
  seed: 0,
  motion: true,
  backdrop: "auto",
  blend: "profile",
};

// ─── Small pieces ──────────────────────────────────────────────────────────

const hexOf = (set: PaletteSet, token: string) => {
  const colour = set.primitives[token];
  return colour ? rgbToHex(oklchToRgb(colour)) : "";
};

/**
 * Identity avatars: an opaque pastel disc (`--hue-n`) with near-black initials
 * (`--hue-n-text`). Avatar's own tint sits on its inner root (the outer span's
 * first child), so the override targets that child.
 */
// Literal strings: the lab's Tailwind build scans source, so no templating.
const IDENTITY_CLASS = [
  "*:bg-(color:--hue-1)! *:text-(color:--hue-1-text)!",
  "*:bg-(color:--hue-2)! *:text-(color:--hue-2-text)!",
  "*:bg-(color:--hue-3)! *:text-(color:--hue-3-text)!",
  "*:bg-(color:--hue-4)! *:text-(color:--hue-4-text)!",
  "*:bg-(color:--hue-5)! *:text-(color:--hue-5-text)!",
  "*:bg-(color:--hue-6)! *:text-(color:--hue-6-text)!",
];
const PEOPLE = [
  "Ada Lovelace",
  "Mo Rahimi",
  "Iris Chen",
  "Taro Sato",
  "Lena Novak",
  "Kofi Mensah",
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] text-white/45 uppercase tracking-[0.12em]">
      {children}
    </span>
  );
}

/** The set's facts: trio, button accent, greys (statuses and identity quietly below). */
function SetCard({ set }: { set: PaletteSet }) {
  const harmony = trioHarmony(set);
  const accentAura = set.aura[set.accentSlot - 1];
  return (
    <div className="flex h-full flex-col gap-7 rounded-2xl border border-white/8 bg-white/[0.02] p-8">
      <div className="flex flex-col gap-1.5">
        <Label>Aura · {harmony.span}° arc</Label>
        <div className="grid grid-cols-3 gap-3">
          {[...set.aura]
            .sort((a, b) => b.colour.h - a.colour.h)
            .map((aura) => (
              <div
                key={aura.slot}
                className="flex flex-col gap-2"
                data-aura-slot={aura.slot}
              >
                <div
                  className="h-28 rounded-xl"
                  style={{ backgroundColor: `var(${aura.token})` }}
                />
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-white/90">
                    {aura.name}
                  </span>
                  <span className="font-mono text-white/55 text-xs">
                    {hexOf(set, aura.token)}
                  </span>
                  <span className="font-mono text-[11px] text-white/35">
                    {formatOklch(aura.colour)}
                  </span>
                  {aura.anchor ? (
                    <span
                      className="mt-1 flex items-center gap-1.5 text-[11px] text-white/45"
                      title={aura.anchor.note}
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: aura.anchor.hex }}
                      />
                      from swatch {aura.anchor.hex}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-8">
        <div className="flex flex-col gap-2">
          <Label>Button · {set.accentName}</Label>
          <div className="flex items-center gap-3">
            <Button trailingIcon={ArrowRightIcon}>Continue</Button>
            <span className="font-mono text-white/45 text-xs">
              {hexOf(set, "--copper-400")}
              {accentAura ? ` · = aura ${accentAura.name.toLowerCase()}` : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>{set.neutralName}</Label>
          <div className="flex h-10 overflow-hidden rounded-lg">
            {set.ramps.neutral.map(({ token, step }) => (
              <div
                key={token}
                title={`${token} · ${hexOf(set, token)}`}
                className="flex-1"
                style={{ backgroundColor: `var(${token})` }}
                data-step={step}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-[auto_minmax(0,1fr)] items-center gap-8 border-white/6 border-t pt-5">
        <div className="flex flex-col gap-2">
          <Label>Status · meaning only</Label>
          <div className="flex gap-1.5">
            <Badge intent="info">Info</Badge>
            <Badge intent="success">Done</Badge>
            <Badge intent="warning">Due</Badge>
            <Badge intent="danger">Failed</Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Identity · avatars</Label>
          {/* Ring = the facts card's own colour (white 2% over the #0a0a0a page). */}
          <AvatarGroup
            size="lg"
            data-identity={set.id}
            className="-space-x-1 [--avatar-ring:#0f0f0f]"
          >
            {set.identity.map((hue, index) => (
              <Avatar
                key={hue.n}
                name={PEOPLE[index]}
                className={IDENTITY_CLASS[index]}
                title={`${hue.name} · ${hexOf(set, hue.solid)}`}
              />
            ))}
          </AvatarGroup>
        </div>
      </div>
    </div>
  );
}

const CALM_X: Record<Calm["x"], string> = {
  left: "left-8",
  center: "left-1/2 -translate-x-1/2",
  right: "right-8",
};
const CALM_Y: Record<Calm["y"], string> = {
  top: "top-8",
  center: "top-1/2 -translate-y-1/2",
  bottom: "bottom-8",
};

/** What sits on every stage: a glass card (badge, avatars, button) placed in the composition's calm space. */
function StageContent({
  photo,
  calm,
  reading,
  bare,
}: {
  photo: PhotoId;
  calm: Calm;
  reading?: BackdropReading | null;
  /** Labels only, no card — for small comparison stages. */
  bare?: boolean;
}) {
  return (
    <div className="relative h-full p-8">
      <span className="absolute top-8 right-8 flex flex-col items-end gap-1 font-mono text-[11px] text-white/45 uppercase tracking-[0.12em]">
        <span>{PHOTOS[photo].label}</span>
        {reading ? (
          <span data-backdrop-readout={reading.backdrop} className="text-white/60">
            {reading.source === "auto"
              ? `auto → ${reading.backdrop} · L ${reading.luma?.toFixed(3)}`
              : reading.source === "forced"
                ? `${reading.backdrop} (forced)`
                : `${reading.backdrop} (fallback)`}
          </span>
        ) : null}
      </span>
      {bare ? null : (
        <Surface
          materialRole="float"
          material="glass"
          data-calm={`${calm.x}-${calm.y}`}
          className={cn(
            "absolute flex w-[22rem] flex-col gap-4 rounded-2xl border p-5",
            CALM_X[calm.x],
            CALM_Y[calm.y],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-heading font-semibold text-lg leading-tight">
                Morning session
              </span>
              <span className="text-sm text-text-secondary">
                45 min · 6 people joined
              </span>
            </div>
            <Badge intent="success">Live</Badge>
          </div>
          <div className="flex items-center justify-between">
            {/* The overlap ring is the stage's surface colour (the glass card's base). */}
            <AvatarGroup
              size="md"
              className="-space-x-0.5 [--avatar-ring:var(--ink-900)]"
            >
              {PEOPLE.slice(0, 4).map((person, index) => (
                <Avatar key={person} name={person} className={IDENTITY_CLASS[index]} />
              ))}
            </AvatarGroup>
            <Button size="sm">Join</Button>
          </div>
        </Surface>
      )}
    </div>
  );
}

/** The set's aura trio as hex, slot 1 → 3. */
const trioOf = (set: PaletteSet) =>
  [hexOf(set, "--aura-1"), hexOf(set, "--aura-2"), hexOf(set, "--aura-3")] as const;

function SetStage({
  set,
  photo,
  controls,
  className,
  bare,
}: {
  set: PaletteSet;
  photo: PhotoId;
  controls: Controls;
  className?: string;
  bare?: boolean;
}) {
  const [reading, setReading] = useState<BackdropReading | null>(null);
  return (
    <Stage
      data-stage={`${set.id}-${photo}`}
      photo={photo}
      photoOpacity={controls.photoOpacity / 100}
      strength={controls.strength}
      className={className}
      wash={
        <Wash
          trio={trioOf(set)}
          renderer={controls.renderer}
          variant={controls.variant}
          intensity={controls.strength}
          seed={controls.seed}
          motion={controls.motion}
          backdrop={controls.backdrop}
          backdropImage={PHOTOS[photo].url}
          backdropOpacity={controls.photoOpacity / 100}
          blend={controls.blend === "profile" ? undefined : controls.blend}
          onBackdrop={setReading}
        />
      }
    >
      <StageContent
        photo={photo}
        calm={calmFor(controls.variant, controls.seed)}
        reading={reading}
        bare={bare}
      />
    </Stage>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-12 py-14 text-white">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-24">{children}</div>
    </main>
  );
}

function SetHeading({ set }: { set: PaletteSet }) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-baseline gap-4">
        <h2 className="font-heading font-semibold text-3xl tracking-tight">{set.name}</h2>
        <span className="font-mono text-sm text-white/45">{set.trioName}</span>
      </div>
      <p className="max-w-3xl text-base text-white/65">{set.idea}</p>
    </header>
  );
}

// ─── Sets ──────────────────────────────────────────────────────────────────

interface SetsArgs extends Controls {
  set: "all" | SetId;
}

/** One section per set: its facts, then the same stage over the dark, medium and light photo. */
export const Sets: StoryObj<SetsArgs> = {
  argTypes: {
    set: {
      name: "Set",
      control: "inline-radio",
      options: ["all", ...SETS.map((s) => s.id)],
    },
    ...CONTROL_TYPES,
  },
  args: { set: "all", ...CONTROL_DEFAULTS },
  render: (args) => (
    <PageShell>
      {SETS.filter((set) => args.set === "all" || set.id === args.set).map((set) => (
        <section
          key={set.id}
          data-set={set.id}
          data-section={set.id}
          className="flex flex-col gap-8"
        >
          <SetHeading set={set} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(720px,1fr))] gap-8">
            <SetCard set={set} />
            {PHOTO_IDS.map((photo) => (
              <SetStage
                key={photo}
                set={set}
                photo={photo}
                controls={args}
                className="aspect-[16/10]"
              />
            ))}
          </div>
        </section>
      ))}
    </PageShell>
  ),
};

// ─── Compare ───────────────────────────────────────────────────────────────

interface CompareArgs extends Controls {
  photo: PhotoId;
}

/** One photo, the three sets stacked full width. */
export const Compare: StoryObj<CompareArgs> = {
  argTypes: {
    photo: {
      name: "Photo",
      control: {
        type: "inline-radio",
        labels: Object.fromEntries(
          PHOTO_IDS.map((id) => [id, `${id} · ${PHOTOS[id].label}`]),
        ),
      },
      options: PHOTO_IDS,
    },
    ...CONTROL_TYPES,
  },
  args: { photo: "dark", ...CONTROL_DEFAULTS },
  render: (args) => (
    <PageShell>
      {SETS.map((set) => (
        <section key={set.id} data-set={set.id} className="flex flex-col gap-5">
          <div className="flex items-baseline gap-4">
            <h2 className="font-heading font-semibold text-2xl tracking-tight">
              {set.name}
            </h2>
            <span className="font-mono text-sm text-white/45">{set.trioName}</span>
          </div>
          <SetStage
            set={set}
            photo={args.photo}
            controls={args}
            className="aspect-[2/1]"
          />
        </section>
      ))}
    </PageShell>
  ),
};

// ─── Shapes ────────────────────────────────────────────────────────────────

interface ShapesArgs extends Controls {
  set: SetId;
  photo: PhotoId;
}

/** One set: every shaped composition large, then the fluid renderer drifting. */
export const Shapes: StoryObj<ShapesArgs> = {
  argTypes: {
    set: {
      name: "Set",
      control: "inline-radio",
      options: SETS.map((s) => s.id),
    },
    photo: {
      name: "Photo",
      control: "inline-radio",
      options: PHOTO_IDS,
    },
    ...CONTROL_TYPES,
    renderer: { table: { disable: true } },
    variant: { ...CONTROL_TYPES.variant, name: "Fluid composition" },
  },
  args: { set: "warm", photo: "medium", ...CONTROL_DEFAULTS },
  render: (args) => {
    const set = SETS.find((s) => s.id === args.set) ?? (SETS[0] as PaletteSet);
    return (
      <PageShell>
        <section data-set={set.id} className="flex flex-col gap-8">
          <SetHeading set={set} />
          <div className="grid grid-cols-2 gap-8">
            {VARIANTS.map((variant) => (
              <figure
                key={variant}
                data-variant={variant}
                className="flex min-w-0 flex-col gap-3"
              >
                <SetStage
                  set={set}
                  photo={args.photo}
                  controls={{ ...args, renderer: "shaped", variant }}
                  className="aspect-[16/10]"
                />
                <figcaption className="flex flex-col gap-1">
                  <span className="font-medium text-white/90">
                    {COMPOSITIONS[variant].label}
                    <span className="ml-2 font-mono text-white/40 text-xs">shaped</span>
                  </span>
                  <span className="text-sm text-white/55">
                    {COMPOSITIONS[variant].summary}
                  </span>
                </figcaption>
              </figure>
            ))}
            <figure data-variant="fluid" className="col-span-2 flex flex-col gap-3">
              <SetStage
                set={set}
                photo={args.photo}
                controls={{ ...args, renderer: "fluid" }}
                className="aspect-[2/1]"
              />
              <figcaption className="flex flex-col gap-1">
                <span className="font-medium text-white/90">
                  {COMPOSITIONS[args.variant].label}
                  <span className="ml-2 font-mono text-white/40 text-xs">
                    fluid · WebGL
                  </span>
                </span>
                <span className="text-sm text-white/55">
                  The same strokes as distance fields in a shader, over a slowly
                  domain-warped space: edges flow, each stroke drifts on a 20–40 s orbit.
                  One still frame under reduced motion; falls back to shaped without
                  WebGL.
                </span>
              </figcaption>
            </figure>
          </div>
        </section>
        <section data-set={set.id} data-profiles={set.id} className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h3 className="font-heading font-semibold text-xl tracking-tight">
              Backdrop profiles
            </h3>
            <p className="max-w-4xl text-sm text-white/55">
              The same fluid {COMPOSITIONS[args.variant].label} on the dark, medium and
              light photo. Each stage measures its photo (auto) and takes that backdrop's
              profile — peaks and blend — so the three carry the same amount of colour.
            </p>
          </header>
          <div className="grid grid-cols-3 gap-6">
            {PHOTO_IDS.map((photo) => (
              <SetStage
                key={photo}
                set={set}
                photo={photo}
                controls={{ ...args, renderer: "fluid" }}
                className="aspect-[16/10]"
                bare
              />
            ))}
          </div>
        </section>
      </PageShell>
    );
  },
};

// ─── Contrast ──────────────────────────────────────────────────────────────

/** The checker for the three sets: the worst ratio in each group, then every check. */
export const Contrast: StoryObj = {
  render: () => {
    const results = SETS.map((set) => ({ set, checks: checkSet(set, DECLARED) }));
    return (
      <PageShell>
        <section className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h2 className="font-heading font-semibold text-3xl tracking-tight">
              Contrast
            </h2>
            <p className="max-w-3xl text-white/60">
              The same promises Sable's own tests keep, run against each set. Cells are
              the worst ratio in the group; hover for the check. Extras are informational.
            </p>
          </header>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-white/10 border-b">
                <th className="py-3 pr-4 font-medium text-white/60">Set</th>
                {GROUPS.map((g) => (
                  <th
                    key={g.id}
                    className="px-3 py-3 font-medium text-white/60"
                    title={g.detail}
                  >
                    {g.title} <span className="text-white/35">≥{g.min}</span>
                  </th>
                ))}
                <th className="px-3 py-3 font-medium text-white/60">Trio arc · mix</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ set, checks }) => {
                const harmony = trioHarmony(set);
                return (
                  <tr key={set.id} className="border-white/6 border-b">
                    <td className="py-3 pr-4 font-medium">{set.name}</td>
                    {summarise(checks).map(({ group, worst, pass }) => (
                      <td key={group} className="px-3 py-3" title={worst.label}>
                        <span
                          className={cn(
                            "font-mono tabular-nums",
                            pass ? "text-[#8fd6a8]" : "text-[#f2a0a0]",
                          )}
                        >
                          {pass ? "✓" : "✗"} {worst.ratio.toFixed(2)}
                        </span>
                      </td>
                    ))}
                    <td className="px-3 py-3 font-mono text-white/70 tabular-nums">
                      {harmony.span}° · {harmony.worstRetention}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-white/45 text-xs">
            Wash = Sable's Ambient Wash model over --background with the trio in its slots
            (subtle/medium/vivid × every layout). Glass = the material model over a white
            page, the worst case under any stage. Trio mix = chroma kept at the OKLab
            midpoint of the worst pair.
          </p>
        </section>
        <section className="grid grid-cols-3 gap-8">
          {results.map(({ set, checks }) => (
            <div key={set.id} className="flex flex-col gap-2">
              <h3 className="font-heading font-semibold text-lg">{set.name}</h3>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                {checks.map((c) => (
                  <Fragment key={c.label}>
                    <span
                      className={cn(
                        "font-mono tabular-nums",
                        c.ratio >= c.min ? "text-white/55" : "text-[#f2a0a0]",
                      )}
                    >
                      {c.ratio.toFixed(2)}
                    </span>
                    <span className="truncate text-white/45">{c.label}</span>
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
        </section>
      </PageShell>
    );
  },
};
