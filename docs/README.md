# docs

`defect-report-2026-09-04.pdf` — the defects found in the door scanner, the UPI
pricing path and the store, what each one cost, and how it was fixed. Covers
commits `5437891` through `862bb1a`.

The HTML alongside it is the source, kept so the report can be corrected and
re-rendered rather than rewritten. To regenerate:

```sh
google-chrome --headless --no-sandbox \
  --user-data-dir="$(mktemp -d)" \
  --no-pdf-header-footer \
  --print-to-pdf=docs/defect-report-2026-09-04.pdf \
  "file://$PWD/docs/defect-report-2026-09-04.html"
```

Chrome needs its own `--user-data-dir` here; it refuses to start headless
against a profile another instance already holds.
