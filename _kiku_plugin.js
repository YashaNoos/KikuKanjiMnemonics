/**
 * Pulls Keyword + Story (mnemonic) live from your RTK deck via AnkiConnect
 * and shows them in Kiku's kanji popup.
 *
 * SETUP:
 * 1. Install the "AnkiConnect" add-on (code 2055492159) if you don't have it.
 * 2. Tools > Add-ons > AnkiConnect > Config, and make sure "webCorsOriginList"
 *    includes "https://kiku.youyoumu.my.id" (or restart Anki after adding it).
 * 3. Drop this file in your collection.media folder as `_kiku_plugin.js`
 *    (if you already have one, merge the `plugin` object below into it).
 * 4. Edit DECK_QUERY / FIELD_KANJI / FIELD_KEYWORD / FIELD_MNEMONIC below if
 *    your deck/field names differ.
 *
 * @import { KikuPlugin } from "#/plugins/plugin-types";
 */

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";

// Deck name check it in the anki browser
const DECK_QUERY = '("deck:Kanji_RTK")';

// Field names (case-sensitive as defined in your Note Type)
const FIELD_KANJI = "Character";
const FIELD_KEYWORD = "Keyword";
const FIELD_MNEMONIC = "Story";

// Set to true while debugging; set to false for production.
const DEBUG = false;

/** @typedef {{ kanji: string, keyword: string, mnemonic: string, status: "ok" }} RtkOk */
/** @typedef {{ status: "not_found" | "error", detail: string }} RtkFail */
/** @type {Map<string, Promise<RtkOk | RtkFail>>} */
const rtkCache = new Map();

/**
 * Exposing a helper to clear the memory cache if notes are edited in Anki.
 */
export function clearRtkCache() {
  rtkCache.clear();
}

/**
 * Strips executable scripts, dangerous tags, inline CSS styles, and un-sanitized URIs while preserving HTML formatting.
 * @param {string} html
 * @returns {string}
 */
function sanitizeHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const FORBIDDEN_TAGS = ["script", "iframe", "object", "embed", "style", "link", "form", "base"];

  // 1. Remove dangerous elements completely
  doc.querySelectorAll(FORBIDDEN_TAGS.join(",")).forEach((el) => el.remove());

  // 2. Strip inline styles, event handlers, and dangerous URI schemes
  const elements = doc.body.querySelectorAll("*");
  for (const el of elements) {
    // Strip inline styles to prevent CSS-based injection/layout distortion
    el.removeAttribute("style");

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();

      // Strip event attributes (onload, onerror, etc.)
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }

      // Block executable and embedding URI protocols
      if (value.startsWith("javascript:") || value.startsWith("data:") || value.startsWith("vbscript:")) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return doc.body.innerHTML;
}

/**
 * @param {string} action
 * @param {Record<string, unknown>} [params]
 */
async function invokeAnkiConnect(action, params = {}) {
  let res;
  try {
    res = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: 6, params }),
    });
  } catch (err) {
    throw new Error(`Could not connect to Anki at ${ANKI_CONNECT_URL}. Is Anki running and AnkiConnect configured?`);
  }

  if (!res.ok) {
    throw new Error(`AnkiConnect HTTP error! status: ${res.status} ${res.statusText}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(`AnkiConnect: Failed to parse JSON response (status: ${res.status})`);
  }

  if (data.error) throw new Error(data.error);
  return data.result;
}

/**
 * Looks up a single kanji's Keyword + mnemonic from your RTK deck.
 * Cached per kanji so re-opening the popup doesn't re-query every time.
 * @param {string} kanji
 * @returns {Promise<RtkOk | RtkFail>}
 */
function fetchRtkData(kanji) {
  if (!kanji) return Promise.resolve({ status: "error", detail: "no kanji given" });
  if (rtkCache.has(kanji)) return /** @type {Promise<any>} */ (rtkCache.get(kanji));

  // Escaping quotes inside the search query prevents query syntax errors
  const safeKanji = kanji.replace(/"/g, '\\"');
  const query = `${DECK_QUERY} ${FIELD_KANJI}:"${safeKanji}"`;

  const promise = (async () => {
    try {
      const noteIds = await invokeAnkiConnect("findNotes", { query });
      if (!noteIds || noteIds.length === 0) {
        return /** @type {RtkFail} */ ({ status: "not_found", detail: query });
      }

      const notesInfo = await invokeAnkiConnect("notesInfo", { notes: noteIds });
      const note = notesInfo?.[0];
      if (!note) {
        return /** @type {RtkFail} */ ({ status: "not_found", detail: query });
      }

      if (!note.fields || (!(FIELD_KEYWORD in note.fields) && !(FIELD_MNEMONIC in note.fields))) {
        const fieldsFound = note.fields ? Object.keys(note.fields).join(", ") : "none";
        return /** @type {RtkFail} */ ({
          status: "error",
          detail: `Note found, but missing "${FIELD_KEYWORD}" or "${FIELD_MNEMONIC}". Fields present: ${fieldsFound}`,
        });
      }

      return /** @type {RtkOk} */ ({
        status: "ok",
        kanji,
        keyword: sanitizeHtml(note.fields[FIELD_KEYWORD]?.value ?? ""),
        mnemonic: sanitizeHtml(note.fields[FIELD_MNEMONIC]?.value ?? ""),
      });
    } catch (e) {
      console.warn("[rtk-kiku-plugin] AnkiConnect lookup failed:", e);
      return /** @type {RtkFail} */ ({
        status: "error",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  })();

  rtkCache.set(kanji, promise);
  return promise;
}

/**
 * @type { KikuPlugin }
 */
export const plugin = {
  KanjiInfoExtra: (props) => {
    const { h, createResource } = props.ctx;
    const { $kanji } = props.useKanjiContext();
    const { VisuallySimilar, ComposedOf, UsedIn, Meanings, Related } = props.sections;

    const [$$rtk] = createResource(() => $kanji.kanji, fetchRtkData);

    function RtkSection() {
      return () => {
        const result = $$rtk();

        if (!result) return null;
        if (result.status === "ok" && result.kanji !== $kanji.kanji) return null;

        if (result.status !== "ok") {
          if (!DEBUG) return null;
          return h(
            "div",
            { class: "text-xs text-red-500 border border-red-500/50 p-2 mb-2" },
            `[rtk-plugin] ${result.status}: ${result.detail}`
          );
        }

        const contentNodes = [];

        if (result.keyword) {
          contentNodes.push(
            h("div", { class: "inline-flex flex-wrap gap-x-1 sm:gap-x-2 items-center mb-1" }, [
              h("span", { class: "font-bold" }, "My Keyword: "),
              h("span", { innerHTML: result.keyword }),
            ])
          );
        }

        if (result.mnemonic) {
          contentNodes.push(
            h("div", { class: "collapse collapse-arrow rounded-none" }, [
              h("input", { type: "checkbox", class: "p-0" }),
              h(
                "div",
                { class: "collapse-title p-0 mb-1 after:text-base-content-calm text-start" },
                h("div", { class: "font-bold text-base-content-calm" }, "My Story")
              ),
              h(
                "div",
                { class: "collapse-content p-0" },
                h("div", { innerHTML: result.mnemonic })
              ),
            ])
          );
        }

        return h(
          "div",
          {
            class: "flex flex-col gap-1 text-xs sm:text-sm text-base-content-calm animate-fade-in mb-3",
          },
          contentNodes
        );
      };
    }

    return [
      RtkSection(),
      VisuallySimilar(),
      ComposedOf(),
      UsedIn(),
      Meanings(),
      Related(),
    ];
  },
};
