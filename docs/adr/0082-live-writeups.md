# ADR-0082 Live Markdown and LaTeX write-ups

The Write-up figure tab keeps its native textarea mounted across panel changes and shows a live read-only preview. The session owns the raw text and a write-up edit revision. Construction edits, commands and geometry undo operate on the construction alone. File, link, recovery and update boundaries explicitly compose the two. This keeps geometry draft comparisons and native text editing independent.

A portable version 2 document consists of the existing construction plus a JSON-quoted `@writeup` line. Older readers reject the version. Geometry-only files retain their existing bytes. The same portable codec validates and prints local recovery versions, checked file inputs, downloads and opted-in shares. Text entry registers a pending save synchronously. Continuous edits cap the time before the next queued write. A renderer exception, invalid formula or failure to load the preview module cannot enter the save path.

While an edited write-up has an uncommitted revision, reloading or leaving the page requests the browser’s native confirmation and starts the pending save. Selecting Stay retains the editor. The listener is removed when the transaction finishes. Page hiding alone cannot guarantee an asynchronous IndexedDB commit before navigation.

The maintainer approved bundling KaTeX and markdown-it in the web host. Native MathML avoids downloading styles or web fonts. The hosted preview loads its renderer on demand. The offline build includes it and its notices. The preview bounds source length, formula count, formula length, macro expansion, size and output. Raw HTML, trusted TeX and remote media are disabled.

The new tab changes full-workspace images. The language package surface test includes its portable subpath. The browser matrix includes hosted and standalone write-up checks.
