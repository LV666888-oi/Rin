import React, { useCallback, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTranslation } from "react-i18next";
import Loading from "react-loading";

import { FlatInset, FlatTabButton } from "@rin/ui";
import { useAlert } from "./dialog";
import { useColorMode } from "../utils/darkModeUtils";
import { buildMarkdownImage, uploadImageFile } from "../utils/image-upload";
import { Markdown } from "./markdown";

import "./markdown-editor.css";

interface MarkdownEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
}

function MarkdownToolButton({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-lg t-secondary transition-colors hover:border-black/10 hover:bg-neutral-100 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-white/10 dark:hover:bg-neutral-700 dark:hover:text-white sm:h-10 sm:w-10"
    >
      <i className={icon} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function MarkdownEditor({
  content,
  setContent,
  placeholder = "> Write your content here...",
  height = "400px",
}: MarkdownEditorProps) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const editorRef = useRef<EditorView | null>(null);

  const [preview, setPreview] = useState<"edit" | "preview" | "comparison">("edit");
  const [uploading, setUploading] = useState(false);

  const { showAlert, AlertUI } = useAlert();

  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "14px",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "Sarasa Mono SC, JetBrains Mono, monospace",
          lineHeight: "1.7",
        },
        ".cm-content": {
          minHeight: "100%",
          padding: "16px",
          caretColor: "currentColor",
        },
        ".cm-line": {
          padding: "0",
        },
        ".cm-gutters": {
          display: "none",
        },
        "&.cm-focused": {
          outline: "none",
        },
        ".cm-selectionBackground": {
          backgroundColor: "rgba(59, 130, 246, 0.25) !important",
        },
      }),
    ],
    [],
  );

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const getSelection = () => {
    const view = editorRef.current;
    if (!view) return null;

    const selection = view.state.selection.main;

    return {
      view,
      from: selection.from,
      to: selection.to,
      selectedText: view.state.doc.sliceString(selection.from, selection.to),
    };
  };

  const replaceSelection = (
    text: string,
    selection?: { anchor: number; head?: number },
  ) => {
    const state = getSelection();
    if (!state) return;

    const { view, from, to } = state;

    view.dispatch({
      changes: { from, to, insert: text },
      selection: selection
        ? EditorSelection.range(selection.anchor, selection.head ?? selection.anchor)
        : EditorSelection.cursor(from + text.length),
    });

    setContent(view.state.doc.toString());
    focusEditor();
  };

  const wrapSelection = (prefix: string, suffix: string, fallback: string) => {
    const state = getSelection();
    if (!state) return;

    const { from, selectedText } = state;
    const innerText = selectedText || fallback;
    const insertedText = `${prefix}${innerText}${suffix}`;

    const nextSelection = selectedText
      ? { anchor: from + insertedText.length }
      : {
          anchor: from + prefix.length,
          head: from + prefix.length + innerText.length,
        };

    replaceSelection(insertedText, nextSelection);
  };

  const insertLink = () => {
    const state = getSelection();
    if (!state) return;

    const { from, selectedText } = state;
    const label = selectedText || t("markdown_editor.placeholder.link_text");
    const url = t("markdown_editor.placeholder.link_url");

    const prefix = `[${label}](`;
    const insertedText = `${prefix}${url})`;

    replaceSelection(insertedText, {
      anchor: from + prefix.length,
      head: from + prefix.length + url.length,
    });
  };

  const insertMarkdownImage = () => {
    const state = getSelection();
    if (!state) return;

    const { from, selectedText } = state;
    const alt = selectedText || t("markdown_editor.placeholder.image_alt");
    const url = t("markdown_editor.placeholder.image_url");

    const prefix = `![${alt}](`;
    const insertedText = `${prefix}${url})`;

    replaceSelection(insertedText, {
      anchor: from + prefix.length,
      head: from + prefix.length + url.length,
    });
  };

  const insertCodeBlock = () => {
    const state = getSelection();
    if (!state) return;

    const { from, selectedText } = state;
    const innerText = selectedText || t("markdown_editor.placeholder.code_block");
    const prefix = "```\n";
    const insertedText = `${prefix}${innerText}\n\`\`\``;

    replaceSelection(
      insertedText,
      selectedText
        ? { anchor: from + insertedText.length }
        : {
            anchor: from + prefix.length,
            head: from + prefix.length + innerText.length,
          },
    );
  };

  const insertHorizontalRule = () => {
    const state = getSelection();
    if (!state) return;

    const { from, to } = state;
    const text = "\n---\n";

    state.view.dispatch({
      changes: { from, to, insert: text },
      selection: EditorSelection.cursor(from + text.length),
    });

    setContent(state.view.state.doc.toString());
    focusEditor();
  };

  const formatSelectedLines = (
    formatter: (line: string, index: number) => string,
    emptyLineFallback: string,
  ) => {
    const state = getSelection();
    if (!state) return;

    const { view, from, to } = state;
    const doc = view.state.doc;

    const startLine = doc.lineAt(from);
    const endLine = doc.lineAt(to);

    const actualEndLine =
      endLine.number > startLine.number && to === endLine.from
        ? doc.line(endLine.number - 1)
        : endLine;

    const isEmptySingleLine =
      from === to && startLine.text.trim().length === 0;

    const lines = isEmptySingleLine
      ? [emptyLineFallback]
      : Array.from(
          { length: actualEndLine.number - startLine.number + 1 },
          (_, index) =>
            formatter(
              doc.line(startLine.number + index).text,
              index,
            ),
        );

    const insertedText = lines.join("\n");

    view.dispatch({
      changes: {
        from: startLine.from,
        to: actualEndLine.to,
        insert: insertedText,
      },
      selection: EditorSelection.cursor(
        startLine.from + insertedText.length,
      ),
    });

    setContent(view.state.doc.toString());
    focusEditor();
  };

  const formatHeading = () => {
    formatSelectedLines(
      (line) =>
        line.startsWith("#")
          ? `## ${line.replace(/^#+\s*/, "")}`
          : `## ${line}`,
      `## ${t("markdown_editor.placeholder.heading")}`,
    );
  };

  const formatQuote = () => {
    formatSelectedLines(
      (line) => (line.startsWith("> ") ? line : `> ${line}`),
      `> ${t("markdown_editor.placeholder.quote")}`,
    );
  };

  const formatUnorderedList = () => {
    formatSelectedLines(
      (line) => (/^\s*[-*]\s/.test(line) ? line : `- ${line}`),
      `- ${t("markdown_editor.placeholder.list_item")}`,
    );
  };

  const formatOrderedList = () => {
    formatSelectedLines(
      (line, index) =>
        (/^\s*\d+\.\s/.test(line) ? line : `${index + 1}. ${line}`),
      `1. ${t("markdown_editor.placeholder.list_item")}`,
    );
  };

  const uploadImages = async (files: File[], position?: number) => {
    const imageFiles = files.filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) return;

    const oversized = imageFiles.find((file) => file.size > 5 * 1024000);

    if (oversized) {
      showAlert(t("upload.failed$size", { size: 5 }));
      return;
    }

    setUploading(true);

    try {
      const markdownImages: string[] = [];

      for (const file of imageFiles) {
        const result = await uploadImageFile(file);

        markdownImages.push(
          buildMarkdownImage(file.name, result.url, {
            blurhash: result.blurhash,
            width: result.width,
            height: result.height,
          }),
        );
      }

      const view = editorRef.current;
      if (!view) return;

      const insertAt =
        position ?? view.state.selection.main.head;

      const text = markdownImages.join("\n");

      view.dispatch({
        changes: {
          from: insertAt,
          insert: text,
        },
        selection: EditorSelection.cursor(insertAt + text.length),
      });

      setContent(view.state.doc.toString());
      view.focus();
    } catch (error) {
      console.error(error);
      showAlert(
        error instanceof Error ? error.message : t("upload.failed"),
      );
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files);

    if (files.length === 0) return;

    const imageFiles = files.filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) return;

    event.preventDefault();

    const view = editorRef.current;
    if (!view) return;

    const position = view.state.selection.main.head;
    void uploadImages(imageFiles, position);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files);

    if (files.length === 0) return;

    const imageFiles = files.filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) return;

    event.preventDefault();

    const view = editorRef.current;
    if (!view) return;

    const position =
      view.posAtCoords({
        x: event.clientX,
        y: event.clientY,
      }) ?? view.state.selection.main.head;

    void uploadImages(imageFiles, position);
  };

  const markdownActions = [
    {
      key: "heading",
      icon: "ri-heading",
      label: t("markdown_editor.toolbar.heading"),
      onClick: formatHeading,
    },
    {
      key: "bold",
      icon: "ri-bold",
      label: t("markdown_editor.toolbar.bold"),
      onClick: () =>
        wrapSelection("**", "**", t("markdown_editor.placeholder.bold")),
    },
    {
      key: "italic",
      icon: "ri-italic",
      label: t("markdown_editor.toolbar.italic"),
      onClick: () =>
        wrapSelection("*", "*", t("markdown_editor.placeholder.italic")),
    },
    {
      key: "link",
      icon: "ri-link",
      label: t("markdown_editor.toolbar.link"),
      onClick: insertLink,
    },
    {
      key: "image",
      icon: "ri-image-line",
      label: t("markdown_editor.toolbar.image"),
      onClick: insertMarkdownImage,
    },
    {
      key: "quote",
      icon: "ri-double-quotes-l",
      label: t("markdown_editor.toolbar.quote"),
      onClick: formatQuote,
    },
    {
      key: "unordered-list",
      icon: "ri-list-unordered",
      label: t("markdown_editor.toolbar.unordered_list"),
      onClick: formatUnorderedList,
    },
    {
      key: "ordered-list",
      icon: "ri-list-ordered",
      label: t("markdown_editor.toolbar.ordered_list"),
      onClick: formatOrderedList,
    },
    {
      key: "inline-code",
      icon: "ri-code-s-slash-line",
      label: t("markdown_editor.toolbar.inline_code"),
      onClick: () =>
        wrapSelection("`", "`", t("markdown_editor.placeholder.code")),
    },
    {
      key: "code-block",
      icon: "ri-code-box-line",
      label: t("markdown_editor.toolbar.code_block"),
      onClick: insertCodeBlock,
    },
    {
      key: "horizontal-rule",
      icon: "ri-separator",
      label: t("markdown_editor.toolbar.horizontal_rule"),
      onClick: insertHorizontalRule,
    },
  ];

  function UploadImageButton() {
    const uploadRef = useRef<HTMLInputElement>(null);

    const upChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      if (files.length > 0) {
        void uploadImages(files);
      }

      event.currentTarget.value = "";
    };

    return (
      <>
        <input
          ref={uploadRef}
          onChange={upChange}
          className="hidden"
          type="file"
          accept="image/gif,image/jpeg,image/jpg,image/png,image/svg+xml"
        />

        <MarkdownToolButton
          label={t("markdown_editor.toolbar.upload_image")}
          icon="ri-image-add-line"
          disabled={uploading}
          onClick={() => uploadRef.current?.click()}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-0 sm:gap-3">
      <FlatInset className="flex flex-wrap items-center gap-2 border-0 border-b border-black/10 rounded-none bg-transparent p-2 dark:border-white/10 sm:p-3">
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <FlatTabButton
            active={preview === "edit"}
            onClick={() => setPreview("edit")}
          >
            {t("edit")}
          </FlatTabButton>

          <FlatTabButton
            active={preview === "preview"}
            onClick={() => setPreview("preview")}
          >
            {t("preview")}
          </FlatTabButton>

          <FlatTabButton
            active={preview === "comparison"}
            onClick={() => setPreview("comparison")}
          >
            {t("comparison")}
          </FlatTabButton>
        </div>

        <div className="flex-grow" />

        <div
          className="flex min-w-0 flex-wrap items-center gap-1"
          role="toolbar"
          aria-label={t("markdown_editor.toolbar.label")}
        >
          {markdownActions.map((action) => (
            <MarkdownToolButton
              key={action.key}
              label={action.label}
              icon={action.icon}
              onClick={action.onClick}
            />
          ))}

          <span
            className="mx-1 hidden h-6 w-px bg-black/10 dark:bg-white/10 sm:block"
            aria-hidden="true"
          />

          <UploadImageButton />
        </div>

        {uploading && (
          <div className="flex flex-row items-center space-x-2 px-2">
            <Loading
              type="spin"
              color="#FC466B"
              height={16}
              width={16}
            />
            <span className="text-sm text-neutral-500">
              {t("uploading")}
            </span>
          </div>
        )}
      </FlatInset>

      <div
        className={`grid grid-cols-1 gap-0 sm:gap-4 ${
          preview === "comparison" ? "lg:grid-cols-2" : ""
        }`}
      >
        <div
          className={
            "flex min-w-0 flex-col " +
            (preview === "preview" ? "hidden" : "")
          }
        >
          <div
            className="markdown-cm-wrapper relative min-h-0 overflow-hidden rounded-none border-0 bg-w"
            style={{ height }}
            onPaste={handlePaste}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <CodeMirror
              value={content}
              height={height}
              extensions={extensions}
              theme={colorMode === "dark" ? oneDark : "light"}
              onCreateEditor={(view) => {
                editorRef.current = view;
              }}
              onChange={(value) => {
                setContent(value);
              }}
              placeholder={placeholder}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLineGutter: false,
                highlightActiveLine: false,
                searchKeymap: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
              }}
            />
          </div>
        </div>

        <div
          className={
            "min-h-0 overflow-y-auto rounded-none border-0 bg-w px-4 py-4 border-t sm:border-none " +
            (preview === "edit" ? "hidden" : "")
          }
          style={{ height }}
        >
          <Markdown content={content ? content : placeholder} />
        </div>
      </div>

      <AlertUI />
    </div>
  );
}
