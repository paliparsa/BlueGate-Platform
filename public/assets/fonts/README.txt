Self-hosted Vazirmatn (Persian UI font)
=======================================
Place these 4 files in this folder (exact names, WOFF2 format):

  Vazirmatn-Regular.woff2     -> font-weight 400
  Vazirmatn-Medium.woff2      -> font-weight 500
  Vazirmatn-Bold.woff2        -> font-weight 700
  Vazirmatn-ExtraBold.woff2   -> font-weight 800

They are declared in public/design-system.css (loaded by both the Web store and the Mini App)
and served at /assets/fonts/<name>.woff2.

Weights 300 / 600 / 900 used elsewhere in the CSS fall back to the nearest declared weight
(300 -> 400, 600 -> 700, 900 -> 800).

Source: https://github.com/rastikerdar/vazirmatn (SIL Open Font License). Use the woff2 files from its "fonts/webfonts" folder.
If a file is missing, the browser falls back to Tahoma/system fonts (the stacks already list them).
