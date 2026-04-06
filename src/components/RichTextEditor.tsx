import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";
import { Bold, ChevronDown, Highlighter, Italic, List, ListOrdered, Strikethrough, Type, Underline } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  DEFAULT_RICH_TEXT_TEXT_COLOR,
  RICH_TEXT_COLOR_OPTIONS,
  getRichTextColorCommandValue,
  getRichTextColorToken,
  normalizeRichTextColor,
  plainTextToRichText,
  richTextHasContent,
  sanitizeRichText,
  type RichTextColorToken,
} from "@/lib/richText";

type FormatCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "insertOrderedList"
  | "insertUnorderedList";
type FormatState = Record<FormatCommand, boolean> & {
  fontSize: string;
  textColor: string;
  highlightColor: string;
};

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

const EMPTY_FORMAT_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  insertOrderedList: false,
  insertUnorderedList: false,
  fontSize: "16",
  textColor: "",
  highlightColor: "",
};

const FORMAT_CONTROLS: Array<{
  command: FormatCommand;
  label: string;
  icon: typeof Bold;
}> = [
  { command: "bold", label: "Bold", icon: Bold },
  { command: "italic", label: "Italic", icon: Italic },
  { command: "underline", label: "Underline", icon: Underline },
  { command: "strikeThrough", label: "Strikethrough", icon: Strikethrough },
  { command: "insertOrderedList", label: "Numbered list", icon: ListOrdered },
  { command: "insertUnorderedList", label: "Bulleted list", icon: List },
];

const FONT_SIZE_OPTIONS = [
  { label: "12", value: "12", commandValue: "1" },
  { label: "14", value: "14", commandValue: "2" },
  { label: "16", value: "16", commandValue: "3" },
  { label: "18", value: "18", commandValue: "4" },
  { label: "24", value: "24", commandValue: "5" },
  { label: "30", value: "30", commandValue: "6" },
] as const;

const FONT_SIZE_VALUES = FONT_SIZE_OPTIONS.map((option) => option.value);

const normalizeFontSize = (rawFontSize: string | null | undefined) => {
  if (!rawFontSize) {
    return EMPTY_FORMAT_STATE.fontSize;
  }

  const parsed = Number.parseFloat(rawFontSize);
  if (Number.isNaN(parsed)) {
    return EMPTY_FORMAT_STATE.fontSize;
  }

  return FONT_SIZE_VALUES.reduce((closest, current) => {
    const currentDistance = Math.abs(Number(current) - parsed);
    const closestDistance = Math.abs(Number(closest) - parsed);
    return currentDistance < closestDistance ? current : closest;
  }, EMPTY_FORMAT_STATE.fontSize);
};

const selectionLivesInEditor = (editor: HTMLDivElement | null) => {
  if (!editor) {
    return false;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode) {
    return false;
  }

  return editor.contains(anchorNode) && editor.contains(focusNode);
};

const getSelectionRange = (editor: HTMLDivElement | null) => {
  if (!selectionLivesInEditor(editor)) {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  return selection.getRangeAt(0).cloneRange();
};

const restoreSelectionRange = (range: Range | null) => {
  if (!range) {
    return;
  }

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  selection.addRange(range);
};

const getSelectionStartingElement = (editor: HTMLDivElement | null) => {
  if (!selectionLivesInEditor(editor)) {
    return null;
  }

  const selection = window.getSelection();
  const anchorNode = selection?.anchorNode;
  return anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as HTMLElement | null);
};

const isListElement = (element: Element | null): element is HTMLOListElement | HTMLUListElement =>
  Boolean(element && ["OL", "UL"].includes(element.tagName));

const getSelectionListItem = (editor: HTMLDivElement | null) => {
  if (!selectionLivesInEditor(editor)) {
    return null;
  }

  const selection = window.getSelection();
  const anchorNode = selection?.anchorNode;
  const startingElement =
    anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as HTMLElement | null);

  return startingElement?.closest("li") ?? null;
};

const isSelectionAtStartOfElement = (editor: HTMLDivElement | null, element: HTMLElement) => {
  if (!selectionLivesInEditor(editor)) {
    return false;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(element);
  prefixRange.setEnd(range.startContainer, range.startOffset);

  return prefixRange.toString().length === 0;
};

const placeCaretAtStart = (element: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const firstTextNode = walker.nextNode();

  if (firstTextNode) {
    range.setStart(firstTextNode, 0);
  } else {
    range.setStart(element, 0);
  }

  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

const cleanupEmptyList = (list: Element | null) => {
  if (isListElement(list) && list.children.length === 0) {
    list.remove();
  }
};

const outdentNestedListItem = (listItem: HTMLLIElement) => {
  const currentList = listItem.parentElement;
  const parentListItem = currentList?.closest("li");
  const parentList = parentListItem?.parentElement;

  if (!isListElement(currentList) || !parentListItem || !isListElement(parentList)) {
    return null;
  }

  parentList.insertBefore(listItem, parentListItem.nextSibling);
  cleanupEmptyList(currentList);
  return listItem;
};

const unwrapListItem = (listItem: HTMLLIElement) => {
  const list = listItem.parentElement;
  if (!isListElement(list)) {
    return null;
  }

  const parent = list.parentNode;
  if (!parent) {
    return null;
  }

  const hasPreviousItems = Boolean(listItem.previousElementSibling);
  const hasNextItems = Boolean(listItem.nextElementSibling);
  const listNextSibling = list.nextSibling;
  const paragraph = document.createElement("div");
  const trailingList = hasNextItems ? (list.cloneNode(false) as HTMLOListElement | HTMLUListElement) : null;
  const nestedLists: Array<HTMLOListElement | HTMLUListElement> = [];

  if (trailingList) {
    while (listItem.nextSibling) {
      trailingList.appendChild(listItem.nextSibling);
    }
  }

  while (listItem.firstChild) {
    const child = listItem.firstChild;

    if (child instanceof HTMLElement && isListElement(child)) {
      nestedLists.push(listItem.removeChild(child) as HTMLOListElement | HTMLUListElement);
      continue;
    }

    paragraph.appendChild(listItem.removeChild(child));
  }

  if (!paragraph.childNodes.length) {
    paragraph.appendChild(document.createElement("br"));
  }

  listItem.remove();

  if (hasPreviousItems) {
    parent.insertBefore(paragraph, listNextSibling);
    nestedLists.forEach((nestedList) => {
      parent.insertBefore(nestedList, listNextSibling);
    });
    if (trailingList && trailingList.children.length > 0) {
      parent.insertBefore(trailingList, listNextSibling);
    }
  } else {
    parent.insertBefore(paragraph, list);
    nestedLists.forEach((nestedList) => {
      parent.insertBefore(nestedList, list);
    });
    if (trailingList && trailingList.children.length > 0) {
      parent.insertBefore(trailingList, list);
    }
  }

  cleanupEmptyList(list);

  return paragraph;
};

const indentListItem = (listItem: HTMLLIElement) => {
  const currentList = listItem.parentElement;
  const previousSibling = listItem.previousElementSibling as HTMLLIElement | null;

  if (!isListElement(currentList) || !previousSibling) {
    return null;
  }

  const lastChild = previousSibling.lastElementChild;
  const nestedList =
    lastChild && isListElement(lastChild)
      ? lastChild
      : (document.createElement(currentList.tagName.toLowerCase()) as HTMLOListElement | HTMLUListElement);

  if (nestedList.parentElement !== previousSibling) {
    previousSibling.appendChild(nestedList);
  }

  nestedList.appendChild(listItem);
  cleanupEmptyList(currentList);
  return listItem;
};

const getSelectionFontSize = (editor: HTMLDivElement | null) => {
  const startingElement = getSelectionStartingElement(editor);

  if (!startingElement) {
    return EMPTY_FORMAT_STATE.fontSize;
  }

  const fontSize =
    startingElement.getAttribute?.("data-font-size") ??
    window.getComputedStyle(startingElement).fontSize;

  return normalizeFontSize(fontSize);
};

const getSelectionColor = (editor: HTMLDivElement | null, type: "text" | "highlight") => {
  const startingElement = getSelectionStartingElement(editor);
  if (!startingElement) {
    return "";
  }

  let current: HTMLElement | null = startingElement;
  while (current && current !== editor) {
    const rawValue =
      type === "text"
        ? current.getAttribute("data-text-color") ?? current.getAttribute("color") ?? current.style.color ?? null
        : current.getAttribute("data-highlight-color") ??
          current.getAttribute("bgcolor") ??
          current.style.backgroundColor ??
          null;
    const colorToken = getRichTextColorToken(rawValue, type);
    if (colorToken) {
      return colorToken;
    }

    const normalizedColor = normalizeRichTextColor(rawValue);

    if (normalizedColor) {
      return normalizedColor;
    }

    current = current.parentElement;
  }

  return "";
};

const getElementColorFormattingValue = (element: HTMLElement, type: "text" | "highlight") =>
  type === "text"
    ? element.getAttribute("data-text-color") ?? element.getAttribute("color") ?? element.style.color ?? null
    : element.getAttribute("data-highlight-color") ?? element.getAttribute("bgcolor") ?? element.style.backgroundColor ?? null;

const clearElementColorFormatting = (element: HTMLElement, type: "text" | "highlight") => {
  if (type === "text") {
    element.removeAttribute("data-text-color");
    element.removeAttribute("color");
    element.style.color = "";
  } else {
    element.removeAttribute("data-highlight-color");
    element.removeAttribute("bgcolor");
    element.style.backgroundColor = "";
  }

  if (!element.style.cssText) {
    element.removeAttribute("style");
  }
};

const isColorFormattingElement = (element: Element | null, type: "text" | "highlight"): element is HTMLSpanElement => {
  if (!(element instanceof HTMLSpanElement)) {
    return false;
  }

  return Boolean(getElementColorFormattingValue(element, type));
};

const unwrapElement = (element: HTMLElement) => {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  element.remove();
};

const cleanupEmptyFormattingSpan = (element: HTMLElement) => {
  if (element.tagName !== "SPAN") {
    return;
  }

  if (element.attributes.length > 0 || element.style.cssText) {
    return;
  }

  unwrapElement(element);
};

const removeEmptyColorFormattingSpans = (editor: HTMLDivElement, type: "text" | "highlight") => {
  Array.from(editor.querySelectorAll("span")).forEach((element) => {
    if (!isColorFormattingElement(element, type)) {
      cleanupEmptyFormattingSpan(element);
      return;
    }

    const hasTextContent = (element.textContent ?? "").replace(/\u200b/g, "").trim().length > 0;
    const hasElementChildren = element.children.length > 0;

    if (!hasTextContent && !hasElementChildren) {
      element.remove();
    }
  });
};

const createSelectionMarker = (name: "start" | "end") => {
  const marker = document.createElement("span");
  marker.setAttribute("data-selection-marker", name);
  marker.setAttribute("aria-hidden", "true");
  marker.style.display = "inline-block";
  marker.style.width = "0";
  marker.style.overflow = "hidden";
  marker.style.lineHeight = "0";
  marker.textContent = "\u200b";
  return marker;
};

const splitFormattingAncestorAtMarker = (
  marker: HTMLElement,
  editor: HTMLDivElement,
  type: "text" | "highlight",
  edge: "start" | "end",
) => {
  let current = marker.parentElement;

  while (current && current !== editor) {
    if (isColorFormattingElement(current, type)) {
      const splitRange = document.createRange();
      splitRange.selectNodeContents(current);

      if (edge === "start") {
        splitRange.setEndBefore(marker);
      } else {
        splitRange.setStartAfter(marker);
      }

      const fragment = splitRange.extractContents();
      if (fragment.childNodes.length > 0) {
        const clone = current.cloneNode(false) as HTMLSpanElement;
        clone.appendChild(fragment);

        if (edge === "start") {
          current.parentNode?.insertBefore(clone, current);
        } else {
          current.parentNode?.insertBefore(clone, current.nextSibling);
        }
      }
    }

    current = current.parentElement;
  }
};

const restoreSelectionBetweenMarkers = (
  startMarker: HTMLElement,
  endMarker: HTMLElement,
  selectionRangeRef: MutableRefObject<Range | null>,
) => {
  const selection = window.getSelection();
  if (!selection) {
    startMarker.remove();
    endMarker.remove();
    selectionRangeRef.current = null;
    return;
  }

  const range = document.createRange();
  range.setStartAfter(startMarker);
  range.setEndBefore(endMarker);
  selection.removeAllRanges();
  selection.addRange(range);
  startMarker.remove();
  endMarker.remove();

  if (selection.rangeCount > 0) {
    selectionRangeRef.current = selection.getRangeAt(0).cloneRange();
  } else {
    selectionRangeRef.current = null;
  }
};

const getColorPreviewStyle = (lightColor: string, darkColor: string): CSSProperties => ({
  backgroundImage: `linear-gradient(135deg, ${lightColor} 0%, ${lightColor} 50%, ${darkColor} 50%, ${darkColor} 100%)`,
});

const getSelectionFormatState = (editor: HTMLDivElement | null): FormatState => {
  if (!selectionLivesInEditor(editor)) {
    return EMPTY_FORMAT_STATE;
  }

  try {
    return {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      fontSize: getSelectionFontSize(editor),
      textColor: getSelectionColor(editor, "text"),
      highlightColor: getSelectionColor(editor, "highlight"),
    };
  } catch {
    return EMPTY_FORMAT_STATE;
  }
};

const RichTextEditor = ({ value, onChange, placeholder, className }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const isFocusedRef = useRef(false);
  const [formatState, setFormatState] = useState<FormatState>(EMPTY_FORMAT_STATE);
  const [hasContent, setHasContent] = useState(() => richTextHasContent(value));
  const [preferredTextColor, setPreferredTextColor] = useState<RichTextColorToken>(DEFAULT_RICH_TEXT_TEXT_COLOR);
  const [textColorPickerOpen, setTextColorPickerOpen] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    const nextValue = sanitizeRichText(value);

    if (!editor || isFocusedRef.current) {
      return;
    }

    if (editor.innerHTML !== nextValue) {
      editor.innerHTML = nextValue;
    }

    setHasContent(richTextHasContent(nextValue));
  }, [value]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const nextSelectionRange = getSelectionRange(editorRef.current);
      if (nextSelectionRange) {
        selectionRangeRef.current = nextSelectionRange;
      }

      setFormatState(getSelectionFormatState(editorRef.current));
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  const refreshSelectionState = () => {
    const nextSelectionRange = getSelectionRange(editorRef.current);
    if (nextSelectionRange) {
      selectionRangeRef.current = nextSelectionRange;
    }

    setFormatState(getSelectionFormatState(editorRef.current));
  };

  const syncValue = () => {
    const nextValue = editorRef.current?.innerHTML ?? "";
    setHasContent(richTextHasContent(nextValue));
    onChange(nextValue);
    refreshSelectionState();
  };

  const normalizeEditorValue = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const normalizedValue = sanitizeRichText(editor.innerHTML);
    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue;
    }

    setHasContent(richTextHasContent(normalizedValue));
    onChange(normalizedValue);
    refreshSelectionState();
  };

  const focusEditorSelection = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if (selectionLivesInEditor(editor)) {
      const currentSelectionRange = getSelectionRange(editor);
      if (currentSelectionRange) {
        selectionRangeRef.current = currentSelectionRange;
      }
      return;
    }

    editor.focus();

    try {
      restoreSelectionRange(selectionRangeRef.current);
    } catch {
      selectionRangeRef.current = null;
    }
  };

  const runDocumentCommand = (command: string, value?: string, options?: { useCss?: boolean }) => {
    focusEditorSelection();
    document.execCommand("styleWithCSS", false, options?.useCss ? "true" : "false");
    document.execCommand(command, false, value);
    syncValue();
  };

  const runCommand = (command: FormatCommand) => {
    runDocumentCommand(command);
  };

  const applyFontSize = (value: string) => {
    const option = FONT_SIZE_OPTIONS.find((item) => item.value === value);
    if (!option) {
      return;
    }

    runDocumentCommand("fontSize", option.commandValue);
  };

  const applyTextColor = (token: RichTextColorToken) => {
    const commandColor = getRichTextColorCommandValue(token, "text");
    if (!commandColor) {
      return;
    }

    setPreferredTextColor(token);
    setTextColorPickerOpen(false);
    runDocumentCommand("foreColor", commandColor, { useCss: true });
  };

  const applyHighlightColor = (token: RichTextColorToken) => {
    const commandColor = getRichTextColorCommandValue(token, "highlight");
    if (!commandColor) {
      return;
    }

    focusEditorSelection();
    document.execCommand("styleWithCSS", false, "true");

    const applied = document.execCommand("hiliteColor", false, commandColor);
    if (!applied) {
      document.execCommand("backColor", false, commandColor);
    }

    syncValue();
  };

  const clearHighlightColor = () => {
    clearSelectionColorFormatting("highlight");
  };

  const clearSelectionColorFormatting = (type: "text" | "highlight") => {
    const editor = editorRef.current;
    if (!editor || !selectionLivesInEditor(editor)) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      let current = getSelectionStartingElement(editor);

      while (current && current !== editor) {
        const rawValue = getElementColorFormattingValue(current, type);
        const hasFormatting = Boolean(getRichTextColorToken(rawValue, type) ?? normalizeRichTextColor(rawValue));

        if (hasFormatting) {
          clearElementColorFormatting(current, type);
          normalizeEditorValue();
          return;
        }

        current = current.parentElement;
      }

      return;
    }

    const endMarker = createSelectionMarker("end");
    const startMarker = createSelectionMarker("start");

    const endRange = range.cloneRange();
    endRange.collapse(false);
    endRange.insertNode(endMarker);

    const startRange = range.cloneRange();
    startRange.collapse(true);
    startRange.insertNode(startMarker);

    splitFormattingAncestorAtMarker(startMarker, editor, type, "start");
    splitFormattingAncestorAtMarker(endMarker, editor, type, "end");

    const selectedRange = document.createRange();
    selectedRange.setStartAfter(startMarker);
    selectedRange.setEndBefore(endMarker);

    Array.from(editor.querySelectorAll("span"))
      .filter((element) => isColorFormattingElement(element, type) && selectedRange.intersectsNode(element))
      .forEach((element) => {
        clearElementColorFormatting(element, type);
        cleanupEmptyFormattingSpan(element);
      });

    if (selectedRange.startContainer instanceof HTMLElement) {
      Array.from(selectedRange.startContainer.querySelectorAll("span")).forEach((element) => {
        if (isColorFormattingElement(element, type) && selectedRange.intersectsNode(element)) {
          clearElementColorFormatting(element, type);
          cleanupEmptyFormattingSpan(element);
        }
      });
    }

    restoreSelectionBetweenMarkers(startMarker, endMarker, selectionRangeRef);
    removeEmptyColorFormattingSpans(editor, type);
    syncValue();
  };

  const clearTextColor = () => {
    clearSelectionColorFormatting("text");
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertHTML", false, plainTextToRichText(text));
    syncValue();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.isCollapsed) {
      return;
    }

    const listItem = getSelectionListItem(editor);
    if (event.key === "Tab") {
      if (!listItem) {
        return;
      }

      event.preventDefault();
      const movedListItem = event.shiftKey
        ? outdentNestedListItem(listItem) ?? unwrapListItem(listItem)
        : indentListItem(listItem);

      if (!movedListItem) {
        return;
      }

      placeCaretAtStart(movedListItem);
      syncValue();
      return;
    }

    if (event.key !== "Backspace" || !listItem || !isSelectionAtStartOfElement(editor, listItem)) {
      return;
    }

    event.preventDefault();
    const nextTarget = outdentNestedListItem(listItem) ?? unwrapListItem(listItem);
    if (!nextTarget) {
      return;
    }

    placeCaretAtStart(nextTarget);
    syncValue();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    isFocusedRef.current = false;

    const nextTarget = event.relatedTarget;
    const movingToToolbar = nextTarget instanceof Node && Boolean(toolbarRef.current?.contains(nextTarget));

    if (movingToToolbar) {
      return;
    }

    normalizeEditorValue();
  };
  const activeTextColor = getRichTextColorToken(formatState.textColor, "text") ?? "";
  const activeHighlightColor = getRichTextColorToken(formatState.highlightColor, "highlight") ?? "";
  const currentTextColor = RICH_TEXT_COLOR_OPTIONS.find((option) => option.token === (activeTextColor || preferredTextColor));
  const defaultHighlightColor = RICH_TEXT_COLOR_OPTIONS.find((option) => option.token === DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-input bg-background shadow-sm", className)}>
      <div ref={toolbarRef} className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1">
          {FONT_SIZE_OPTIONS.map((option) => (
            <Toggle
              key={option.value}
              type="button"
              variant="outline"
              size="sm"
              pressed={formatState.fontSize === option.value}
              aria-label={`Font size ${option.label}`}
              className="min-w-9 px-2 text-xs font-semibold"
              onMouseDown={(event) => event.preventDefault()}
              onPressedChange={() => applyFontSize(option.value)}
            >
              {option.label}
            </Toggle>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1">
          <Toggle
            type="button"
            variant="outline"
            size="sm"
            aria-label="Toggle text color"
            aria-pressed={Boolean(activeTextColor)}
            pressed={Boolean(activeTextColor)}
            className="relative"
            onMouseDown={(event) => event.preventDefault()}
            onPressedChange={(pressed) => {
              if (pressed) {
                if (currentTextColor) {
                  applyTextColor(currentTextColor.token);
                }
                return;
              }

              clearTextColor();
            }}
          >
            <span className="relative inline-flex h-4 w-4 items-center justify-center">
              <Type className="h-4 w-4" />
              {currentTextColor ? (
                <span
                  className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full"
                  style={getColorPreviewStyle(currentTextColor.textPreviewLight, currentTextColor.textPreviewDark)}
                  aria-hidden="true"
                />
              ) : null}
            </span>
          </Toggle>
          <Popover open={textColorPickerOpen} onOpenChange={setTextColorPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Choose text color"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-3"
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Text color</p>
                  <p className="text-xs text-muted-foreground">Theme-safe shades for light and dark mode.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {RICH_TEXT_COLOR_OPTIONS.map((option) => (
                    <button
                      key={`text-${option.token}`}
                      type="button"
                      aria-label={`Text color ${option.label}`}
                      aria-pressed={activeTextColor === option.token}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                        activeTextColor === option.token
                          ? "border-primary bg-primary/10 ring-1 ring-ring"
                          : "border-border/70 hover:bg-muted/70",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyTextColor(option.token)}
                    >
                      <span
                        className="h-5 w-5 rounded-full border border-border/70 shadow-sm"
                        style={getColorPreviewStyle(option.textPreviewLight, option.textPreviewDark)}
                        aria-hidden="true"
                      />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1">
          <Toggle
            type="button"
            variant="outline"
            size="sm"
            aria-label="Toggle yellow highlight"
            aria-pressed={Boolean(activeHighlightColor)}
            pressed={Boolean(activeHighlightColor)}
            className="relative"
            onMouseDown={(event) => event.preventDefault()}
            onPressedChange={(pressed) => {
              if (pressed) {
                if (defaultHighlightColor) {
                  applyHighlightColor(defaultHighlightColor.token);
                }
                return;
              }

              clearHighlightColor();
            }}
          >
            <span className="relative inline-flex h-4 w-4 items-center justify-center">
              <Highlighter className="h-4 w-4" />
              {defaultHighlightColor ? (
                <span
                  className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full"
                  style={getColorPreviewStyle(
                    defaultHighlightColor.highlightPreviewLight,
                    defaultHighlightColor.highlightPreviewDark,
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </span>
          </Toggle>
        </div>

        {FORMAT_CONTROLS.map(({ command, label, icon: Icon }) => (
          <Toggle
            key={command}
            type="button"
            variant="outline"
            size="sm"
            pressed={formatState[command]}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onPressedChange={() => runCommand(command)}
          >
            <Icon className="h-4 w-4" />
          </Toggle>
        ))}
        <span className="text-xs text-muted-foreground">
          Select text, then use the icons for color, highlight, formatting, or lists. Use Tab and Shift+Tab for sublists.
        </span>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        data-empty={hasContent ? "false" : "true"}
        className="rich-text-editor min-h-[220px] px-4 py-3 text-base text-foreground focus:outline-none"
        onInput={syncValue}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={refreshSelectionState}
        onMouseUp={refreshSelectionState}
        onFocus={() => {
          isFocusedRef.current = true;
          refreshSelectionState();
        }}
        onPaste={handlePaste}
      />
    </div>
  );
};

export default RichTextEditor;
