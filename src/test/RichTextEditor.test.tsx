import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RichTextEditor from "@/components/RichTextEditor";

const setCollapsedSelection = (node: Node, offset = 0) => {
  const selection = window.getSelection();
  const range = document.createRange();

  range.setStart(node, offset);
  range.collapse(true);

  selection?.removeAllRanges();
  selection?.addRange(range);
};

const setExpandedSelection = (node: Node, startOffset: number, endOffset: number) => {
  const selection = window.getSelection();
  const range = document.createRange();

  range.setStart(node, startOffset);
  range.setEnd(node, endOffset);

  selection?.removeAllRanges();
  selection?.addRange(range);
};

describe("RichTextEditor", () => {
  beforeEach(() => {
    document.execCommand = vi.fn(() => true);
    document.queryCommandState = vi.fn(() => false);
  });

  it("keeps the focused editor DOM untouched when the same external value comes back through props", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<RichTextEditor value="" onChange={onChange} />);
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;

    fireEvent.focus(editor);
    editor.innerHTML = '<font size="4">Focused</font>';

    rerender(<RichTextEditor value={'<font size="4">Focused</font>'} onChange={onChange} />);

    expect(editor.innerHTML).toBe('<font size="4">Focused</font>');
  });

  it("turns the current list line into a separate block when backspace is pressed at the start of that line", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor value="<ul><li>One</li><li>Two</li><li>Three</li></ul>" onChange={onChange} />,
    );
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const secondListItem = editor.querySelectorAll("li")[1];
    const secondListItemText = secondListItem.firstChild as Text;

    fireEvent.focus(editor);
    setCollapsedSelection(secondListItemText, 0);
    fireEvent.keyDown(editor, { key: "Backspace" });

    expect(editor.innerHTML).toBe("<ul><li>One</li></ul><div>Two</div><ul><li>Three</li></ul>");
    expect(onChange).toHaveBeenCalledWith("<ul><li>One</li></ul><div>Two</div><ul><li>Three</li></ul>");
  });

  it("creates a nested sublist when tab is pressed on a list item", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor value="<ul><li>One</li><li>Two</li><li>Three</li></ul>" onChange={onChange} />,
    );
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const secondListItem = editor.querySelectorAll("li")[1];
    const secondListItemText = secondListItem.firstChild as Text;

    fireEvent.focus(editor);
    setCollapsedSelection(secondListItemText, 0);
    fireEvent.keyDown(editor, { key: "Tab" });

    expect(editor.innerHTML).toBe("<ul><li>One<ul><li>Two</li></ul></li><li>Three</li></ul>");
    expect(onChange).toHaveBeenCalledWith("<ul><li>One<ul><li>Two</li></ul></li><li>Three</li></ul>");
  });

  it("applies text and highlight colors from the toolbar", () => {
    const onChange = vi.fn();
    const execCommandMock = vi.mocked(document.execCommand);
    const { container } = render(<RichTextEditor value="<div>Color me</div>" onChange={onChange} />);
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const textNode = editor.querySelector("div")?.firstChild as Text;

    fireEvent.focus(editor);
    setCollapsedSelection(textNode, 0);
    fireEvent.mouseUp(editor);
    fireEvent.click(screen.getByRole("button", { name: "Choose text color" }));
    fireEvent.click(screen.getByRole("button", { name: "Text color Light Blue" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle yellow highlight" }));

    expect(execCommandMock).toHaveBeenCalledWith("styleWithCSS", false, "true");
    expect(execCommandMock).toHaveBeenCalledWith("foreColor", false, "#1570ef");
    expect(execCommandMock).toHaveBeenCalledWith("hiliteColor", false, "#fef08a");
  });

  it("toggles an active text color off from the text color icon", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor value='<div><span data-text-color="light-blue">Blue text</span></div>' onChange={onChange} />,
    );
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const textNode = editor.querySelector("span")?.firstChild as Text;

    fireEvent.focus(editor);
    setCollapsedSelection(textNode, 0);
    fireEvent.mouseUp(editor);

    const toggleButton = screen.getByRole("button", { name: "Toggle text color" });
    expect(toggleButton).toHaveAttribute("data-state", "on");

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute("data-state", "off");
    expect(editor.querySelector("[data-text-color]")).not.toBeInTheDocument();
  });

  it("toggles an active highlight off from the highlight icon", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor value='<div><span data-highlight-color="yellow">Marked text</span></div>' onChange={onChange} />,
    );
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const textNode = editor.querySelector("span")?.firstChild as Text;

    fireEvent.focus(editor);
    setCollapsedSelection(textNode, 0);
    fireEvent.mouseUp(editor);

    const toggleButton = screen.getByRole("button", { name: "Toggle yellow highlight" });
    expect(toggleButton).toHaveAttribute("data-state", "on");

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute("data-state", "off");
    expect(editor.querySelector("[data-highlight-color]")).not.toBeInTheDocument();
  });

  it("clears highlight inside a list item without changing the list structure", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        value='<ul><li><span data-highlight-color="yellow">First item</span></li><li>Second item</li></ul>'
        onChange={onChange}
      />,
    );
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const textNode = editor.querySelector("span")?.firstChild as Text;

    fireEvent.focus(editor);
    setCollapsedSelection(textNode, 0);
    fireEvent.mouseUp(editor);
    fireEvent.click(screen.getByRole("button", { name: "Toggle yellow highlight" }));

    expect(editor.innerHTML).toBe("<ul><li>First item</li><li>Second item</li></ul>");
    expect(onChange).toHaveBeenLastCalledWith("<ul><li>First item</li><li>Second item</li></ul>");
  });

  it("removes selected saved highlight and keeps the selection on that text", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor value='<div><span data-highlight-color="yellow">Marked text</span></div>' onChange={onChange} />,
    );
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const textNode = editor.querySelector("span")?.firstChild as Text;

    fireEvent.focus(editor);
    setExpandedSelection(textNode, 0, textNode.textContent?.length ?? 0);
    fireEvent.mouseUp(editor);
    fireEvent.click(screen.getByRole("button", { name: "Toggle yellow highlight" }));

    expect(editor.innerHTML).toBe("<div>Marked text</div>");
    expect(window.getSelection()?.toString()).toBe("Marked text");
    expect(editor.contains(window.getSelection()?.anchorNode ?? null)).toBe(true);
  });

  it("removes selected saved text color and keeps the selection on that text", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor value='<div><span data-text-color="light-blue">Blue text</span></div>' onChange={onChange} />,
    );
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const textNode = editor.querySelector("span")?.firstChild as Text;

    fireEvent.focus(editor);
    setExpandedSelection(textNode, 0, textNode.textContent?.length ?? 0);
    fireEvent.mouseUp(editor);
    fireEvent.click(screen.getByRole("button", { name: "Toggle text color" }));

    expect(editor.innerHTML).toBe("<div>Blue text</div>");
    expect(window.getSelection()?.toString()).toBe("Blue text");
    expect(editor.contains(window.getSelection()?.anchorNode ?? null)).toBe(true);
  });

  it("moves a nested list item up one level per backspace press", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor value="<ul><li>Parent<ul><li>Child</li></ul></li></ul>" onChange={onChange} />,
    );
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const childListItem = editor.querySelectorAll("li")[1];
    const childListItemText = childListItem.firstChild as Text;

    fireEvent.focus(editor);
    setCollapsedSelection(childListItemText, 0);
    fireEvent.keyDown(editor, { key: "Backspace" });

    expect(editor.innerHTML).toBe("<ul><li>Parent</li><li>Child</li></ul>");

    fireEvent.keyDown(editor, { key: "Backspace" });

    expect(editor.innerHTML).toBe("<ul><li>Parent</li></ul><div>Child</div>");
    expect(onChange).toHaveBeenLastCalledWith("<ul><li>Parent</li></ul><div>Child</div>");
  });
});
