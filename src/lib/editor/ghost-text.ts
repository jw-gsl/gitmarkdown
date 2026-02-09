import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { useSettingsStore } from '@/stores/settings-store';
import { useFileStore } from '@/stores/file-store';
import { processCompletion } from '@/lib/editor/completion-filters';

interface GhostTextState {
  suggestion: string | null;
  position: number;
  requestId: number;
}

const ghostTextPluginKey = new PluginKey<GhostTextState>('ghostText');

export const GhostText = Extension.create({
  name: 'ghostText',

  addProseMirrorPlugins() {
    const editor = this.editor;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;
    let currentRequestId = 0;

    const clearSuggestion = (view: any) => {
      const state = ghostTextPluginKey.getState(view.state) as GhostTextState | undefined;
      if (state?.suggestion) {
        view.dispatch(
          view.state.tr.setMeta(ghostTextPluginKey, {
            suggestion: null,
            position: 0,
            requestId: state.requestId,
          })
        );
      }
    };

    const cancelPending = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    };

    const fetchCompletion = async (view: any, requestId: number) => {
      const { from } = view.state.selection;
      const doc = view.state.doc;
      const docSize = doc.content.size;

      // Extract context around cursor (larger suffix for better quality)
      const beforeStart = Math.max(0, from - 500);
      const afterEnd = Math.min(docSize, from + 400);
      const before = doc.textBetween(beforeStart, from, '\n');
      const after = doc.textBetween(from, afterEnd, '\n');

      // Don't fetch if there's very little text before cursor (need some context)
      if (before.trim().length < 10) return;

      abortController = new AbortController();

      try {
        const settings = useSettingsStore.getState();
        const currentFile = useFileStore.getState().currentFile;
        const res = await fetch('/api/ai/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            before,
            after,
            provider: settings.aiProvider,
            modelId: settings.aiModel,
            filename: currentFile?.path,
          }),
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Check if request is stale
          if (requestId !== currentRequestId) {
            reader.cancel();
            return;
          }

          accumulated += decoder.decode(value, { stream: true });

          // Run full post-processing pipeline
          const processed = processCompletion(accumulated, before, after, {
            isCode: false,
          });
          if (processed === null) continue; // Skip this chunk, wait for more

          // Ensure proper spacing
          let displayText = processed;
          const charBefore = view.state.doc.textBetween(Math.max(0, from - 1), from);
          if (charBefore && !/\s/.test(charBefore) && !/^\s/.test(displayText)) {
            displayText = ' ' + displayText;
          }

          // Update the suggestion in the editor
          const currentPos = view.state.selection.from;
          view.dispatch(
            view.state.tr.setMeta(ghostTextPluginKey, {
              suggestion: displayText,
              position: currentPos,
              requestId,
            })
          );
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        // Silently fail — completions are optional
      }
    };

    const plugin = new Plugin({
      key: ghostTextPluginKey,

      state: {
        init(): GhostTextState {
          return { suggestion: null, position: 0, requestId: 0 };
        },
        apply(tr, prev): GhostTextState {
          const meta = tr.getMeta(ghostTextPluginKey);
          if (meta) return meta as GhostTextState;

          // Progressive matching: if doc changed and we had a suggestion,
          // check if the typed text matches the start of the suggestion
          if (tr.docChanged && prev.suggestion) {
            const newPos = tr.mapping.map(prev.position);
            // Read the text that was inserted between old position and new mapped position
            if (newPos > prev.position) {
              try {
                const inserted = tr.doc.textBetween(prev.position, newPos);
                if (inserted.length > 0 && prev.suggestion.startsWith(inserted)) {
                  const remaining = prev.suggestion.slice(inserted.length);
                  if (remaining.length > 0) {
                    return {
                      suggestion: remaining,
                      position: newPos,
                      requestId: prev.requestId,
                    };
                  }
                  // Entire suggestion consumed
                  return { suggestion: null, position: 0, requestId: prev.requestId };
                }
              } catch {
                // Position mapping failed, clear suggestion
              }
            }
            return { suggestion: null, position: 0, requestId: prev.requestId };
          }
          return prev;
        },
      },

      props: {
        decorations(state) {
          const pluginState = ghostTextPluginKey.getState(state) as GhostTextState | undefined;
          if (!pluginState?.suggestion) return DecorationSet.empty;

          const { suggestion, position } = pluginState;

          // Validate position is within document bounds
          if (position < 0 || position > state.doc.content.size) {
            return DecorationSet.empty;
          }

          const widget = Decoration.widget(position, () => {
            const span = document.createElement('span');
            span.className = 'ghost-text';
            span.textContent = suggestion;
            return span;
          }, { side: 1 });

          return DecorationSet.create(state.doc, [widget]);
        },

        handleKeyDown(view, event) {
          const pluginState = ghostTextPluginKey.getState(view.state) as GhostTextState | undefined;
          if (!pluginState?.suggestion) return false;

          if (event.key === 'Tab') {
            event.preventDefault();
            const { suggestion, position } = pluginState;

            // Insert the suggestion text
            const tr = view.state.tr.insertText(suggestion, position);
            tr.setMeta(ghostTextPluginKey, {
              suggestion: null,
              position: 0,
              requestId: pluginState.requestId,
            });
            view.dispatch(tr);
            return true;
          }

          if (event.key === 'Escape') {
            clearSuggestion(view);
            return true;
          }

          // For printable characters (single char, no ctrl/alt/meta modifiers),
          // let apply() handle progressive matching instead of clearing
          if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey
          ) {
            return false;
          }

          // Non-printable keys (arrows, etc.) dismiss the suggestion
          clearSuggestion(view);
          return false;
        },
      },

      view() {
        return {
          update(view, prevState) {
            // Check settings
            const settings = useSettingsStore.getState();
            if (!settings.tabCompletionsEnabled) {
              cancelPending();
              return;
            }

            // Only trigger on doc changes (typing)
            if (!view.state.doc.eq(prevState.doc)) {
              // Check if progressive matching kept the suggestion alive
              const pluginState = ghostTextPluginKey.getState(view.state) as GhostTextState | undefined;
              if (pluginState?.suggestion) {
                // Suggestion survived via progressive match — cancel any pending fetch
                // but don't start a new one
                cancelPending();
                return;
              }

              cancelPending();

              const { from, to } = view.state.selection;
              // Only trigger on collapsed cursor
              if (from !== to) return;

              // Don't trigger inside code blocks
              const $pos = view.state.doc.resolve(from);
              for (let d = $pos.depth; d >= 0; d--) {
                if ($pos.node(d).type.name === 'codeBlock') return;
              }

              // Don't trigger when slash command is likely active
              const textBefore = view.state.doc.textBetween(
                Math.max(0, from - 20),
                from
              );
              if (textBefore.match(/\/[a-zA-Z]*$/)) return;

              // Debounce 400ms
              currentRequestId++;
              const requestId = currentRequestId;

              debounceTimer = setTimeout(() => {
                fetchCompletion(view, requestId);
              }, 400);
            }

            // Clear on selection change without doc change
            if (
              view.state.doc.eq(prevState.doc) &&
              !view.state.selection.eq(prevState.selection)
            ) {
              cancelPending();
              clearSuggestion(view);
            }
          },

          destroy() {
            cancelPending();
          },
        };
      },
    });

    return [plugin];
  },
});
