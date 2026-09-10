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

### Install the Plugin
Download _kiku_plugin.js from this repository.

Drop the file into your Kiku collection.media folder (or wherever your custom plugins are stored).

If your Anki deck uses different names for the Deck, Kanji field, Keyword field, or Story field, open _kiku_plugin.js and edit the constants at the top of the file:

```javascript
const DECK_QUERY = '("deck:Kanji_RTK")';

const FIELD_KANJI = "Character";
const FIELD_KEYWORD = "Keyword";
const FIELD_MNEMONIC = "Story";
```

## Usage
Simply open a kanji popup, the plugin will query Anki and display your custom keyword and story!
