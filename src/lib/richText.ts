const INLINE_TAG_MAP = new Map<string, string>([
  ["b", "strong"],
  ["strong", "strong"],
  ["i", "em"],
  ["em", "em"],
  ["u", "u"],
  ["s", "s"],
  ["strike", "s"],
]);

const BLOCK_TAGS = new Set(["p", "div", "ul", "ol", "li"]);
const FONT_SIZE_VALUES = new Set(["12", "14", "16", "18", "24", "30"]);
const LEGACY_FONT_SIZE_MAP = new Map<string, string>([
  ["1", "12"],
  ["2", "14"],
  ["3", "16"],
  ["4", "18"],
  ["5", "24"],
  ["6", "30"],
  ["7", "30"],
]);
const HEX_COLOR_PATTERN = /^#([\da-f]{3}|[\da-f]{6})$/i;
const RGB_COLOR_PATTERN =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|0?\.\d+|1(?:\.0+)?))?\s*\)$/i;

type RichTextColorContext = "text" | "highlight";

export type RichTextColorToken =
  | "light-red"
  | "light-blue"
  | "light-green"
  | "black"
  | "yellow"
  | "white";

type RichTextColorOption = {
  token: RichTextColorToken;
  label: string;
  textCommandColor: string;
  highlightCommandColor: string;
  textPreviewLight: string;
  textPreviewDark: string;
  highlightPreviewLight: string;
  highlightPreviewDark: string;
  textAliases: string[];
  highlightAliases: string[];
};

export const RICH_TEXT_COLOR_OPTIONS: RichTextColorOption[] = [
  {
    token: "light-red",
    label: "Light Red",
    textCommandColor: "#d92d20",
    highlightCommandColor: "#fecdd3",
    textPreviewLight: "#b42318",
    textPreviewDark: "#fda29b",
    highlightPreviewLight: "#fecdd3",
    highlightPreviewDark: "#be123c",
    textAliases: ["#d92d20", "#fecaca"],
    highlightAliases: ["#fecdd3", "#fecaca"],
  },
  {
    token: "light-blue",
    label: "Light Blue",
    textCommandColor: "#1570ef",
    highlightCommandColor: "#bfdbfe",
    textPreviewLight: "#175cd3",
    textPreviewDark: "#84caff",
    highlightPreviewLight: "#bfdbfe",
    highlightPreviewDark: "#1d4ed8",
    textAliases: ["#1570ef", "#bfdbfe"],
    highlightAliases: ["#bfdbfe"],
  },
  {
    token: "light-green",
    label: "Light Green",
    textCommandColor: "#12b76a",
    highlightCommandColor: "#bbf7d0",
    textPreviewLight: "#027a48",
    textPreviewDark: "#6ce9a6",
    highlightPreviewLight: "#bbf7d0",
    highlightPreviewDark: "#15803d",
    textAliases: ["#12b76a", "#bbf7d0"],
    highlightAliases: ["#bbf7d0"],
  },
  {
    token: "black",
    label: "Black",
    textCommandColor: "#475467",
    highlightCommandColor: "#cbd5e1",
    textPreviewLight: "#344054",
    textPreviewDark: "#d0d5dd",
    highlightPreviewLight: "#cbd5e1",
    highlightPreviewDark: "#64748b",
    textAliases: ["#475467", "#000000"],
    highlightAliases: ["#cbd5e1", "#000000"],
  },
  {
    token: "yellow",
    label: "Yellow",
    textCommandColor: "#b54708",
    highlightCommandColor: "#fef08a",
    textPreviewLight: "#b54708",
    textPreviewDark: "#fecd68",
    highlightPreviewLight: "#fef08a",
    highlightPreviewDark: "#ca8a04",
    textAliases: ["#b54708", "#fef08a"],
    highlightAliases: ["#fef08a"],
  },
  {
    token: "white",
    label: "White",
    textCommandColor: "#d0d5dd",
    highlightCommandColor: "#fffef7",
    textPreviewLight: "#98a2b3",
    textPreviewDark: "#f8fafc",
    highlightPreviewLight: "#fffef7",
    highlightPreviewDark: "#e2e8f0",
    textAliases: ["#d0d5dd", "#ffffff"],
    highlightAliases: ["#fffef7", "#ffffff"],
  },
];

const RICH_TEXT_COLOR_TOKENS = new Set(RICH_TEXT_COLOR_OPTIONS.map((option) => option.token));

export const DEFAULT_RICH_TEXT_TEXT_COLOR: RichTextColorToken = "black";
export const DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR: RichTextColorToken = "yellow";

const createHtmlDocument = () => document.implementation.createHTMLDocument("");

const normalizeHexColor = (value: string) => {
  if (!HEX_COLOR_PATTERN.test(value)) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized.length === 4) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return normalized;
};

export const normalizeRichTextColor = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedHex = normalizeHexColor(trimmed);
  if (normalizedHex) {
    return normalizedHex;
  }

  const rgbMatch = trimmed.match(RGB_COLOR_PATTERN);
  if (!rgbMatch) {
    return null;
  }

  const [, red, green, blue, alpha] = rgbMatch;
  if (alpha !== undefined && Number.parseFloat(alpha) === 0) {
    return null;
  }

  const channels = [red, green, blue].map((channel) => Number.parseInt(channel, 10));
  if (channels.some((channel) => Number.isNaN(channel) || channel < 0 || channel > 255)) {
    return null;
  }

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};

export const isRichTextColorToken = (value: string | null | undefined): value is RichTextColorToken =>
  Boolean(value && RICH_TEXT_COLOR_TOKENS.has(value as RichTextColorToken));

export const getRichTextColorToken = (
  value: string | null | undefined,
  context: RichTextColorContext,
): RichTextColorToken | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (isRichTextColorToken(trimmed)) {
    return trimmed;
  }

  const normalizedColor = normalizeRichTextColor(trimmed);
  if (!normalizedColor) {
    return null;
  }

  const matchedOption = RICH_TEXT_COLOR_OPTIONS.find((option) => {
    const aliases = context === "text" ? option.textAliases : option.highlightAliases;
    return aliases.includes(normalizedColor);
  });

  return matchedOption?.token ?? null;
};

export const getRichTextColorCommandValue = (
  token: RichTextColorToken,
  context: RichTextColorContext,
) => {
  const option = RICH_TEXT_COLOR_OPTIONS.find((item) => item.token === token);
  if (!option) {
    return null;
  }

  return context === "text" ? option.textCommandColor : option.highlightCommandColor;
};

const appendTextWithBreaks = (doc: Document, target: Node, text: string) => {
  const parts = text.replace(/\r\n?/g, "\n").split("\n");

  parts.forEach((part, index) => {
    if (part) {
      target.appendChild(doc.createTextNode(part));
    }

    if (index < parts.length - 1) {
      target.appendChild(doc.createElement("br"));
    }
  });
};

const sanitizeNode = (node: Node, doc: Document): Node => {
  if (node.nodeType === Node.TEXT_NODE) {
    const fragment = doc.createDocumentFragment();
    appendTextWithBreaks(doc, fragment, node.textContent ?? "");
    return fragment;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return doc.createDocumentFragment();
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === "br") {
    return doc.createElement("br");
  }

  const fragment = doc.createDocumentFragment();
  Array.from(element.childNodes).forEach((childNode) => {
    fragment.appendChild(sanitizeNode(childNode, doc));
  });

  if (tagName === "font" || tagName === "span") {
    const fontSize =
      element.getAttribute("data-font-size") ??
      LEGACY_FONT_SIZE_MAP.get(element.getAttribute("size") ?? "") ??
      null;
    const textColorToken = getRichTextColorToken(
      element.getAttribute("data-text-color") ??
        element.getAttribute("color") ??
        element.style.color ??
        null,
      "text",
    );
    const highlightColorToken = getRichTextColorToken(
      element.getAttribute("data-highlight-color") ??
        element.getAttribute("bgcolor") ??
        element.style.backgroundColor ??
        null,
      "highlight",
    );
    const textColor =
      textColorToken ||
      normalizeRichTextColor(
        element.getAttribute("data-text-color") ??
          element.getAttribute("color") ??
          element.style.color ??
          null,
      );
    const highlightColor =
      highlightColorToken ||
      normalizeRichTextColor(
        element.getAttribute("data-highlight-color") ??
          element.getAttribute("bgcolor") ??
          element.style.backgroundColor ??
          null,
      );

    if ((fontSize && FONT_SIZE_VALUES.has(fontSize)) || textColor || highlightColor) {
      const cleanElement = doc.createElement("span");

      if (fontSize && FONT_SIZE_VALUES.has(fontSize)) {
        cleanElement.setAttribute("data-font-size", fontSize);
      }

      if (textColor) {
        cleanElement.setAttribute("data-text-color", textColor);
        if (!textColorToken) {
          cleanElement.style.color = textColor;
        }
      }

      if (highlightColor) {
        cleanElement.setAttribute("data-highlight-color", highlightColor);
        if (!highlightColorToken) {
          cleanElement.style.backgroundColor = highlightColor;
        }
      }

      cleanElement.appendChild(fragment);
      return cleanElement;
    }

    return fragment;
  }

  const normalizedTag = INLINE_TAG_MAP.get(tagName) ?? (BLOCK_TAGS.has(tagName) ? tagName : null);
  if (!normalizedTag) {
    return fragment;
  }

  const cleanElement = doc.createElement(normalizedTag);
  cleanElement.appendChild(fragment);
  return cleanElement;
};

const buildContainer = (input: string) => {
  const parser = new DOMParser();
  const source = parser.parseFromString(`<div>${input}</div>`, "text/html");
  const wrapper = source.body.firstElementChild;
  const output = createHtmlDocument();
  const container = output.createElement("div");

  if (!wrapper) {
    return container;
  }

  Array.from(wrapper.childNodes).forEach((node) => {
    container.appendChild(sanitizeNode(node, output));
  });

  return container;
};

export const sanitizeRichText = (input: string | null | undefined) => {
  if (!input) {
    return "";
  }

  return buildContainer(input).innerHTML;
};

export const richTextHasContent = (input: string | null | undefined) => {
  if (!input) {
    return false;
  }

  const container = buildContainer(input);
  const text = container.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
  return text.length > 0;
};

export const toStoredRichText = (input: string | null | undefined) => {
  const sanitized = sanitizeRichText(input);
  return richTextHasContent(sanitized) ? sanitized : null;
};

export const plainTextToRichText = (text: string) => {
  const output = createHtmlDocument();
  const container = output.createElement("div");
  appendTextWithBreaks(output, container, text);
  return container.innerHTML;
};
