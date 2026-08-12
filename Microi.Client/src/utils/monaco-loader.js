let loadingPromise

/**
 * Loads the single Monaco runtime used by Form, Page, Print, and GoView.
 * Worker constructors and the MonacoEnvironment hook are shared globally so
 * multiple editors do not create competing worker configurations.
 */
export const loadMonaco = async () => {
  if (window.__monacoEditorInstance) return window.__monacoEditorInstance
  if (loadingPromise) return loadingPromise

  loadingPromise = Promise.all([
    import('monaco-editor'),
    import('monaco-editor/esm/vs/language/json/json.worker?worker'),
    import('monaco-editor/esm/vs/language/css/css.worker?worker'),
    import('monaco-editor/esm/vs/language/html/html.worker?worker'),
    import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
    import('monaco-editor/esm/vs/editor/editor.worker?worker'),
  ]).then(([monaco, jsonWorker, cssWorker, htmlWorker, tsWorker, editorWorker]) => {
    if (!window.__monacoWorkers) {
      window.__monacoWorkers = {
        json: jsonWorker.default,
        css: cssWorker.default,
        html: htmlWorker.default,
        ts: tsWorker.default,
        editor: editorWorker.default,
      }
    }

    if (!window.__monacoEnvSet) {
      window.__monacoEnvSet = true
      globalThis.MonacoEnvironment = {
        getWorker(_moduleId, label) {
          const workers = window.__monacoWorkers
          if (label === 'json') return new workers.json()
          if (label === 'css' || label === 'scss' || label === 'less') return new workers.css()
          if (label === 'html' || label === 'handlebars' || label === 'razor') return new workers.html()
          if (label === 'typescript' || label === 'javascript') return new workers.ts()
          return new workers.editor()
        },
      }
    }

    window.__monacoEditorInstance = monaco
    return monaco
  }).catch((error) => {
    loadingPromise = undefined
    throw error
  })

  return loadingPromise
}

