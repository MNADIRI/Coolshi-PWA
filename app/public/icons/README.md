# Icons

`icon.svg` is the master mark. Export PNGs before deploying:

```bash
# With librsvg
rsvg-convert -w 192 -h 192 icon.svg > icon-192.png
rsvg-convert -w 512 -h 512 icon.svg > icon-512.png
rsvg-convert -w 180 -h 180 icon.svg > apple-touch-icon.png
```

Or use any design tool (Figma, Sketch) — the manifest and metadata expect `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` in this directory.
