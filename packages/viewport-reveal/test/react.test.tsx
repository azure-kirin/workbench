import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Reveal, RevealScript } from "../src/react.js";
import { stagger } from "../src/index.js";

describe("<Reveal>", () => {
  it("renders a plain element carrying the attribute, and nothing else", () => {
    expect(renderToStaticMarkup(<Reveal>text</Reveal>)).toBe(
      '<div data-reveal="">text</div>',
    );
  });

  it("writes a numeric delay as milliseconds on the custom property", () => {
    expect(renderToStaticMarkup(<Reveal delay={120}>text</Reveal>)).toBe(
      '<div data-reveal="" style="--vr-delay:120ms">text</div>',
    );
  });

  it("passes a string delay through, so any CSS time or calc() works", () => {
    const html = renderToStaticMarkup(<Reveal delay="0.4s">text</Reveal>);
    expect(html).toContain("--vr-delay:0.4s");
  });

  it("accepts a stagger() step, keeping the whole rhythm re-tunable from one token", () => {
    const html = renderToStaticMarkup(<Reveal delay={stagger(2)}>text</Reveal>);
    expect(stagger(2)).toBe("calc(2 * var(--vr-stagger, 60ms))");
    expect(html).toContain("calc(2 * var(--vr-stagger, 60ms))");
  });

  it("merges the delay into a caller's style instead of replacing it", () => {
    const html = renderToStaticMarkup(
      <Reveal delay={60} style={{ marginTop: 8 }}>
        text
      </Reveal>,
    );
    expect(html).toContain("margin-top:8px");
    expect(html).toContain("--vr-delay:60ms");
  });

  it('trigger="none" renders finished markup with no attribute and no delay', () => {
    expect(
      renderToStaticMarkup(
        <Reveal trigger="none" delay={120}>
          hero
        </Reveal>,
      ),
    ).toBe("<div>hero</div>");
  });

  it('trigger="mount" uses the insertion animation, not the viewport one', () => {
    const html = renderToStaticMarkup(<Reveal trigger="mount">dialog</Reveal>);
    expect(html).toContain("data-reveal-mount");
    expect(html).not.toContain('data-reveal="');
  });

  it("renders any element via `as`, and forwards the rest of the props", () => {
    const html = renderToStaticMarkup(
      <Reveal as="section" className="card" aria-label="Work">
        body
      </Reveal>,
    );
    expect(html).toBe(
      '<section class="card" aria-label="Work" data-reveal="">body</section>',
    );
  });

  it("does not let a caller's props clobber the reveal contract", () => {
    const html = renderToStaticMarkup(
      // Deliberately passing the attribute the component owns: the contract
      // props are applied after the spread, so they cannot be overwritten.
      <Reveal data-reveal={undefined}>text</Reveal>,
    );
    expect(html).toContain("data-reveal");
  });

  it("marks the element as co-owned so React does not report the class the engine adds", () => {
    /* The engine adds `vr-revealed` before hydration. React's hydration pass
       walks every live attribute and reports the ones it did not render, so
       without this the console fills with mismatch warnings on every page. */
    const element = Reveal({ children: "text" });
    expect(element.props.suppressHydrationWarning).toBe(true);

    const inert = Reveal({ trigger: "none", children: "text" });
    expect(inert.props.suppressHydrationWarning).toBeUndefined();
  });
});

describe("<RevealScript>", () => {
  it("renders the engine inline, not as a src", () => {
    const html = renderToStaticMarkup(<RevealScript />);
    expect(html.startsWith("<script>")).toBe(true);
    expect(html).not.toContain("src=");
    expect(html).not.toContain("defer");
    expect(html).toContain("vr-js");
  });

  it("forwards engine options into the inlined source", () => {
    expect(renderToStaticMarkup(<RevealScript offset={96} />)).toContain(
      '{"offset":96}',
    );
  });

  it("carries a CSP nonce when one is given", () => {
    expect(renderToStaticMarkup(<RevealScript nonce="abc123" />)).toContain(
      'nonce="abc123"',
    );
  });
});
