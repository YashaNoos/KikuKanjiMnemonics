# Kiku RTK AnkiConnect Plugin

A custom plugin for [Kiku](https://kiku.youyoumu.my.id) that connects to your local desktop Anki application (ankimobile not supported). It automatically pulls your personal "Remembering the Kanji" (RTK) keywords and stories (mnemonics) and injects them seamlessly into Kiku's kanji info popup.

<img width="998" height="779" alt="Screenshot_20260906_135634" src="https://github.com/user-attachments/assets/50f25134-4120-48e5-a609-9dd8b600ee78" />

## Features
* **Live Anki Sync:** Fetches data directly from your local Anki deck in real-time.
* **Custom Fields:** Configurable to match your specific Anki field names (e.g., `Keyword`, `Story`).
* **Rich Text Support:** Preserves any HTML formatting (bold, italics, line breaks) you've added to your mnemonics in Anki.
* **Native Integration:** Built using SolidJS hyperscript to blend perfectly with Kiku's UI and animations.

## Prerequisites
1. You must have **Anki** installed and running on your computer.
2. Install the **[AnkiConnect](https://ankiweb.net/shared/info/2055492159)** add-on (code: `2055492159`).

## Setup Instructions

### 1. Configure AnkiConnect
To allow Kiku to talk to Anki securely, configure AnkiConnect's CORS settings:
1. In Anki, go to **Tools > Add-ons > AnkiConnect > Config**.
2. Change the configuration to allow Kiku's URL:
   ```json
   {
     "apiKey": null,
     "apiLogPath": null,
     "webBindAddress": "127.0.0.1",
     "webBindPort": 8765,
     "webCorsOriginList": [
       "[https://kiku.youyoumu.my.id]"
     ]
   }
