/* CodeMirror Markdown Editor */

.markdown-cm-wrapper {
  width: 100%;
  min-width: 0;
  overflow: visible !important;
  background: transparent;
  position: relative;
}

.markdown-cm-wrapper .cm-editor {
  width: 100%;
  height: 100%;
  min-height: 100%;
  background: transparent;
  color: inherit;
  font-size: 14px;
  overflow: visible !important;
}

.markdown-cm-wrapper .cm-scroller {
  height: 100%;
  max-height: 100%;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  font-family: "Sarasa Mono SC", "JetBrains Mono", monospace;
  line-height: 1.7;
  -webkit-overflow-scrolling: touch !important;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
}

.markdown-cm-wrapper .cm-content {
  min-height: 100%;
  padding: 16px;
  caret-color: currentColor;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: default;
  touch-action: pan-y;
}

.markdown-cm-wrapper .cm-line {
  padding: 0;
  -webkit-user-select: text;
  user-select: text;
}

.markdown-cm-wrapper .cm-gutters {
  display: none;
}

.markdown-cm-wrapper .cm-editor.cm-focused {
  outline: none;
}

.markdown-cm-wrapper .cm-selectionBackground {
  background: rgba(59, 130, 246, 0.25) !important;
}

.markdown-cm-wrapper .cm-cursor {
  border-left-width: 2px;
}

.markdown-cm-wrapper .cm-placeholder {
  opacity: 0.5;
  font-style: normal;
}

/* Dark mode */

.dark .markdown-cm-wrapper .cm-editor {
  background: transparent;
}

.dark .markdown-cm-wrapper .cm-content {
  color: inherit;
}

.dark .markdown-cm-wrapper .cm-placeholder {
  color: rgba(255, 255, 255, 0.45);
}
