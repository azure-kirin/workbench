/**
 * Finds the `play` functions a CSF file declares and cuts the ones it can
 * reach. Pure: a string in, a string and a list of what was left out.
 *
 * "Reach" is a deliberately narrow idea. A play is cut when it is a member of
 * an object literal the file's top level hands to Storybook directly:
 *
 *   export default { title: "X", play }               // CSF meta
 *   export const A = { play: async () => {} }          // CSF 3 story
 *   const meta = { … } satisfies Meta; export default meta
 *   export const B = meta.story({ play })              // CSF factories
 *   export const C = B.extend({ play })
 *
 * Anything else that looks like a play — `A.play = …`, a factory that returns
 * a story, a story built inside a function — is reported, not cut. Guessing
 * there would mean editing code whose meaning the transform cannot see.
 */
import { parse, type ParserPlugin } from "@babel/parser";

type Node = { type: string; start?: number | null; end?: number | null } & Record<
  string,
  unknown
>;

export interface Cut {
  /** Offset of the first character removed. */
  start: number;
  /** Offset one past the last character removed (a trailing comma included). */
  end: number;
}

export interface UncutPlay {
  line: number;
  column: number;
  /** Why the transform left it: what the code looks like there. */
  reason: string;
}

export interface Analysis {
  cuts: Cut[];
  uncut: UncutPlay[];
}

export interface StripResult {
  code: string;
  cuts: Cut[];
  uncut: UncutPlay[];
}

/** Calls whose first object argument is a story or a meta (CSF factories). */
const FACTORY_METHODS = new Set(["meta", "story", "extend"]);

/**
 * Keys under which a story holds data rather than annotations. A `play` key
 * in there is an arg or a parameter (a media component's `play` prop), not a
 * play function.
 */
const DATA_KEYS = new Set(["args", "argTypes", "parameters", "globals", "initialGlobals"]);

/** Keys that make an object look like a story wherever it sits. */
const STORY_KEYS = new Set([
  "args",
  "argTypes",
  "render",
  "decorators",
  "loaders",
  "beforeEach",
  "afterEach",
  "parameters",
  "tags",
  "component",
  "title",
  "globals",
]);

function pluginsFor(filename: string | undefined): ParserPlugin[] {
  const file = (filename ?? "").split("?")[0] ?? "";
  if (/\.[cm]?ts$/.test(file)) return ["typescript"];
  if (/\.[cm]?tsx$/.test(file)) return ["typescript", "jsx"];
  if (/\.[cm]?jsx?$/.test(file)) return ["jsx"];
  // Unknown: the widest grammar that does not misread `<T>(x) => x` in a .ts file
  // is TSX, and story files are TSX far more often than they are anything else.
  return ["typescript", "jsx"];
}

function parseProgram(source: string, filename: string | undefined): Node {
  const ast = parse(source, {
    sourceType: "module",
    plugins: pluginsFor(filename),
    errorRecovery: false,
  }) as unknown as { program: Node };
  return ast.program;
}

/** The node under TypeScript wrappers (`satisfies Story`, `as Meta`, parentheses). */
function unwrap(node: Node | null | undefined): Node | null {
  let current = node ?? null;
  while (
    current &&
    (current.type === "TSSatisfiesExpression" ||
      current.type === "TSAsExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "TSNonNullExpression" ||
      current.type === "ParenthesizedExpression")
  ) {
    current = current.expression as Node;
  }
  return current;
}

/** The object literal a top-level initialiser hands to Storybook, if any. */
function storyObjectOf(node: Node | null | undefined): Node | null {
  const value = unwrap(node);
  if (!value) return null;
  if (value.type === "ObjectExpression") return value;
  // CSF factories: preview.meta({…}), meta.story({…}), Story.extend({…}).
  if (value.type === "CallExpression") {
    const callee = unwrap(value.callee as Node);
    const property = callee?.type === "MemberExpression" ? (callee.property as Node) : null;
    const name = property && !callee?.computed ? (property as { name?: string }).name : undefined;
    const [first] = (value.arguments as Node[]) ?? [];
    if (name && FACTORY_METHODS.has(name)) {
      const object = unwrap(first);
      if (object?.type === "ObjectExpression") return object;
    }
  }
  return null;
}

function keyName(member: Node): string | undefined {
  const key = member.key as (Node & { name?: string; value?: unknown }) | undefined;
  if (!key) return undefined;
  if (member.computed) {
    return key.type === "StringLiteral" ? String(key.value) : undefined;
  }
  if (key.type === "Identifier") return key.name;
  if (key.type === "StringLiteral") return String(key.value);
  return undefined;
}

/** `play: …`, `"play": …`, `play() {}`, `async play() {}`, `get play() {}`. */
function isPlayMember(member: Node): boolean {
  if (member.type !== "ObjectProperty" && member.type !== "ObjectMethod") return false;
  return keyName(member) === "play";
}

/** Whether a property's value could be a function at run time. */
function couldBeFunction(member: Node): boolean {
  if (member.type === "ObjectMethod") return true;
  const value = unwrap(member.value as Node);
  if (!value) return false;
  switch (value.type) {
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
    case "NullLiteral":
    case "BigIntLiteral":
    case "TemplateLiteral":
    case "ObjectExpression":
    case "ArrayExpression":
    case "JSXElement":
    case "JSXFragment":
      return false;
    case "Identifier":
      return (value as { name?: string }).name !== "undefined";
    default:
      return true;
  }
}

/** Names bound by the file's top level: the stories, the meta, their helpers. */
function topLevelNames(program: Node): Set<string> {
  const names = new Set<string>();
  for (const statement of program.body as Node[]) {
    let node = statement;
    if (
      (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") &&
      node.declaration
    ) {
      node = node.declaration as Node;
    }
    if (node.type === "VariableDeclaration") {
      for (const declarator of node.declarations as Node[]) {
        const id = declarator.id as Node & { name?: string };
        if (id.type === "Identifier" && id.name) names.add(id.name);
      }
    } else if (
      (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") &&
      (node.id as { name?: string } | null)?.name
    ) {
      names.add((node.id as { name: string }).name);
    }
  }
  return names;
}

/**
 * Names a story is made of without being exported under them: `export { A }`,
 * `export default meta`, and `...base` spread into another object.
 */
function namesUsedAsStories(program: Node): Set<string> {
  const names = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const node = value as Node;
    if (typeof node.type !== "string") return;
    if (node.type === "SpreadElement") {
      const argument = unwrap(node.argument as Node) as (Node & { name?: string }) | null;
      if (argument?.type === "Identifier" && argument.name) names.add(argument.name);
    }
    if (node.type === "ExportSpecifier") {
      const local = node.local as Node & { name?: string };
      if (local.type === "Identifier" && local.name) names.add(local.name);
    }
    if (node.type === "ExportDefaultDeclaration") {
      const declaration = unwrap(node.declaration as Node) as (Node & { name?: string }) | null;
      if (declaration?.type === "Identifier" && declaration.name) names.add(declaration.name);
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === "loc" || key.endsWith("Comments")) continue;
      visit(child);
    }
  };
  visit(program);
  return names;
}

/**
 * The object literals the top level hands to Storybook: the default export,
 * every exported story, and the unexported objects a story is made of. A
 * top-level object nothing exports or spreads is a helper, and its `play`
 * (a media control's, say) is left alone.
 */
function storyObjects(program: Node): Node[] {
  const objects: Node[] = [];
  const used = namesUsedAsStories(program);
  for (const statement of program.body as Node[]) {
    let node = statement;
    let exported = false;
    if (node.type === "ExportNamedDeclaration" && node.declaration) {
      node = node.declaration as Node;
      exported = true;
    }
    if (node.type === "ExportDefaultDeclaration") {
      const object = storyObjectOf(node.declaration as Node);
      if (object) objects.push(object);
      continue;
    }
    if (node.type !== "VariableDeclaration") continue;
    for (const declarator of node.declarations as Node[]) {
      const id = declarator.id as Node & { name?: string };
      const object = storyObjectOf(declarator.init as Node);
      if (!object) continue;
      // A factory call is a story or a meta wherever it sits (the meta of a
      // CSF factories file is never exported); a plain object only when it is
      // exported or a story is made of it.
      const named = id.type === "Identifier" && id.name !== undefined && used.has(id.name);
      if (exported || named || unwrap(declarator.init as Node)?.type === "CallExpression") {
        objects.push(object);
      }
    }
  }
  return objects;
}

/**
 * Object literals passed straight into a call that makes an exported story
 * or the meta: `export const A = makeStory({ play })`. Their plays reach
 * Storybook through code the transform cannot follow.
 */
function objectsPassedToStoryCalls(program: Node, cut: ReadonlySet<Node>): Set<Node> {
  const objects = new Set<Node>();
  const collect = (init: Node | null | undefined) => {
    const value = unwrap(init);
    if (value?.type !== "CallExpression") return;
    for (const argument of value.arguments as Node[]) {
      const object = unwrap(argument);
      if (object?.type === "ObjectExpression" && !cut.has(object)) objects.add(object);
    }
  };
  for (const statement of program.body as Node[]) {
    if (statement.type === "ExportDefaultDeclaration") collect(statement.declaration as Node);
    if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
      const declaration = statement.declaration as Node;
      if (declaration.type !== "VariableDeclaration") continue;
      for (const declarator of declaration.declarations as Node[]) collect(declarator.init as Node);
    }
  }
  return objects;
}

function lineColumn(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastBreak = -1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      lastBreak = i;
    }
  }
  return { line, column: offset - lastBreak };
}

/**
 * Every play in `source`: the ones that can be cut, as character ranges, and
 * the ones that cannot, with a line and a reason. Throws when the file does
 * not parse, rather than letting its plays through untouched.
 */
export function analysePlays(source: string, filename?: string): Analysis {
  const program = parseProgram(source, filename);
  const cuts: Cut[] = [];
  const cutObjects = new Set(storyObjects(program));

  for (const object of cutObjects) {
    for (const member of object.properties as Node[]) {
      if (!isPlayMember(member)) continue;
      const start = member.start ?? 0;
      let end = member.end ?? start;
      // Take the comma after it, so the object stays valid.
      const after = /^\s*,/.exec(source.slice(end));
      if (after) end += after[0].length;
      cuts.push({ start, end });
    }
  }

  const topLevel = topLevelNames(program);
  const passedToCalls = objectsPassedToStoryCalls(program, cutObjects);
  const uncut: UncutPlay[] = [];
  const report = (node: Node, reason: string) => {
    uncut.push({ ...lineColumn(source, node.start ?? 0), reason });
  };

  /** `inData`: under a `args`/`parameters`/… key, where `play` is data, not a play. */
  const visit = (value: unknown, inData: boolean): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, inData);
      return;
    }
    const node = value as Node;
    if (typeof node.type !== "string") return;

    if (node.type === "ObjectExpression" && !inData && !cutObjects.has(node)) {
      const members = node.properties as Node[];
      const play = members.find((member) => isPlayMember(member) && couldBeFunction(member));
      if (play) {
        if (passedToCalls.has(node)) {
          report(play, "an object passed to a call that makes a story (a factory or a wrapper)");
        } else if (
          members.some((member) => {
            const name = keyName(member);
            return member.type === "SpreadElement" || (name !== undefined && STORY_KEYS.has(name));
          })
        ) {
          report(play, "an object shaped like a story that is not a top-level story or meta");
        }
      }
    }

    // `Story.play = …` or `Story["play"] = …` on a top-level binding.
    if (node.type === "AssignmentExpression") {
      const left = node.left as Node;
      if (left.type === "MemberExpression") {
        const object = left.object as Node & { name?: string };
        const property = left.property as Node & { name?: string; value?: unknown };
        const name = left.computed
          ? property.type === "StringLiteral"
            ? String(property.value)
            : undefined
          : property.name;
        if (name === "play" && object.type === "Identifier" && object.name && topLevel.has(object.name)) {
          report(node, `a play assigned after the story (${object.name}.play = …)`);
        }
      }
    }

    for (const [key, child] of Object.entries(node)) {
      if (key === "loc" || key.endsWith("Comments")) continue;
      if (!child || typeof child !== "object") continue;
      // Under a data key, everything below is data.
      const childInData =
        inData ||
        ((node.type === "ObjectProperty" || node.type === "ObjectMethod") &&
          key === "value" &&
          DATA_KEYS.has(keyName(node) ?? ""));
      visit(child, childInData);
    }
  };
  visit(program, false);

  uncut.sort((a, b) => a.line - b.line || a.column - b.column);
  return { cuts, uncut };
}

/**
 * Applies `cuts` to `source`. Each cut keeps its line breaks, so every line
 * after it keeps its number — stack traces and coverage still point at the
 * right line without a source map.
 */
export function applyCuts(source: string, cuts: readonly Cut[]): string {
  let code = source;
  for (const { start, end } of [...cuts].sort((a, b) => b.start - a.start)) {
    const breaks = source.slice(start, end).replace(/[^\n]/g, "");
    code = code.slice(0, start) + breaks + code.slice(end);
  }
  return code;
}

/** `source` with every play the transform can reach cut out, and what it could not reach. */
export function stripPlays(source: string, filename?: string): StripResult {
  const { cuts, uncut } = analysePlays(source, filename);
  return { code: applyCuts(source, cuts), cuts, uncut };
}
