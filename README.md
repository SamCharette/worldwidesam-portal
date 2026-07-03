# Worldwide Sam Orbit

Standalone static landing page for `worldwidesam.net`.

The page is a Three.js orbital launcher: each app is a clickable planet circling the Clawdia command star.

## Status And Audience

Public static portal for Sam's hosted apps and posts. It has no backend and should stay deployable as plain files.

## Prerequisites

- Any static file server for local preview.
- Python 3 is enough for the built-in preview command below.

## Run Locally

```bash
python3 -m http.server 4178 --directory worldwidesam-portal
```

Open `http://127.0.0.1:4178`.

If already inside this repo, use:

```bash
python3 -m http.server 4178
```

## Verify

With the preview server running:

```bash
curl -fsS http://127.0.0.1:4178/
```

For visual changes, check both desktop and mobile widths because the first viewport must clearly show the Worldwide Sam portal and hint at the next section.

## Deploy

Deploy the contents of this folder as static files. App links already use `https://` and open in new windows with `target="_blank"`.

No generated build output is required.
