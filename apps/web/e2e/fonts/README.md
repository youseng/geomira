# Screenshot font fixture

`LiberationSerif-Italic.ttf` is an unmodified Liberation Serif Italic font from the
`fonts-liberation` package, distributed under the accompanying SIL Open Font License.
Source: <https://github.com/liberationfonts/liberation-fonts>.

SHA-256: `de18fe26337e03241952dca46398d5b66f3c5738d080bfd284f66e67b926f597`.

The scene screenshot helper embeds it into the test page's existing `Geomira Math`
font face before navigation. It is not imported by the application or bundled into
the site or single-file release. See [ADR-0066](../../../../docs/adr/0066-deterministic-screenshot-font.md).
