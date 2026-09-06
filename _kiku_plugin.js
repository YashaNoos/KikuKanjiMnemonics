/**
 * Pulls Keyword + Story (mnemonic) live from your RTK deck via AnkiConnect
 * and shows them in Kiku's kanji popup.
 *
 * SETUP:
 * 1. Install the "AnkiConnect" add-on (code 2055492159) if you don't have it.
 * 2. Tools > Add-ons > AnkiConnect > Config, and make sure "webCorsOriginList"
 *    includes "https://kiku.youyoumu.my.id"(or restart Anki after adding it)
 *    Restart Anki after changing this.
 * 3. Drop this file in your collection.media folder as `_kiku_plugin.js`
 *    (if you already have one, merge the `plugin` object below into it).
 * 4. Edit DECK_QUERY / FIELD_KANJI / FIELD_KEYWORD / FIELD_MNEMONIC below if
 *    your deck/field names differ.
 *
 * @import { KikuPlugin } from "#/plugins/plugin-types";
 */

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";


const DECK_QUERY = '("deck:Kanji_RTK")';

const FIELD_KANJI = "Character";
const FIELD_KEYWORD = "Keyword";
const FIELD_MNEMONIC = "Story";

// Set to true while debugging: shows what happened right in the popup.
const DEBUG = true;

/** @typedef {{ kanji: string, keyword: string, mnemonic: string, status: "ok" }} RtkOk */
/** @typedef {{ status: "not_found" | "error", detail: string }} RtkFail */
/** @type {Map<string, Promise<RtkOk | RtkFail>>} */
const rtkCache = new Map();

/**
 * @param {string} action
 * @param {Record<string, unknown>} [params]
 */
async function invokeAnkiConnect(action, params = {}) {
  const res = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  const data = await res.json();
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

  const query = `${DECK_QUERY} ${FIELD_KANJI}:${kanji}`;

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

      if (!(FIELD_KEYWORD in note.fields) && !(FIELD_MNEMONIC in note.fields)) {
        return /** @type {RtkFail} */ ({
          status: "error",
          detail: `note found, but has no "${FIELD_KEYWORD}"/"${FIELD_MNEMONIC}" field. Fields on this note: ${Object.keys(note.fields).join(", ")}`,
        });
      }

      return /** @type {RtkOk} */ ({
        status: "ok",
        kanji,
        keyword: note.fields?.[FIELD_KEYWORD]?.value ?? "",
        mnemonic: note.fields?.[FIELD_MNEMONIC]?.value ?? "",
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
      // By returning an arrow function here, SolidJS treats everything
      // inside as a reactive computation and updates it dynamically.
      return () => {
        const result = $$rtk();

        // 1. Still loading / Pending
        if (!result) return null;

        // 2. Guard against a stale kanji's cached result showing temporarily
        if (result.status === "ok" && result.kanji !== $kanji.kanji) return null;

        // 3. Error or Not Found state
        if (result.status !== "ok") {
          if (!DEBUG) return null;
          return h(
            "div",
            { class: "text-xs text-red-500 border border-red-500/50 p-2 mb-2" },
            `[rtk-plugin] ${result.status}: ${result.detail}`
          );
        }

        // 4. Success state - dynamically push elements that exist
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
                h("div", { class: "font-bold text-base-content-calm" }, "My Story") // Updated label text too
              ),
              h(
                "div",
                { class: "collapse-content p-0" },
                h("div", { innerHTML: result.mnemonic })
              ),
            ])
          );
        }

        // Render the finalized UI block
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
      Meanings(), // remove this line if you don't want the WaniKani/JPDB meanings
      Related(),
    ];
  },
};
