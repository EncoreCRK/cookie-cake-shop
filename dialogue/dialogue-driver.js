// Adds per-page PNG poses + special shared Shadow Milk/Pure Vanilla scenes.
// Does NOT change the bakery background, reception, inventory, ratings, or orders.
(function () {
  "use strict";
  const get = (id) => document.getElementById(id);
  const settings = () => window.CAKE_DIALOGUE_PAGES || {};
  const validPath = (x) => typeof x === "string" && /^(https:\/\/|\/)/.test(x);

  function buildFrames(orders, ordinaryFrames) {
    const config = settings();
    const sm = orders.find((o) => o.customer_code === "shadow_milk");
    const pv = orders.find((o) => o.customer_code === "pure_vanilla");
    if (
      sm &&
      pv &&
      Array.isArray(config.shadowMilkInterruption) &&
      config.shadowMilkInterruption.length
    ) {
      return config.shadowMilkInterruption.map((page) => {
        const o = orders.find((x) => x.customer_code === page.speaker) || sm;
        const main = page.main || o.customer_code;
        const s =
          page.from === "order"
            ? o.order_dialogue || "A cake, please!"
            : page.text || "...";
        return { o, s, main, page };
      });
    }
    const count = {};
    return ordinaryFrames.map((item) => {
      const code = item.o.customer_code;
      const index = count[code] || 0;
      count[code] = index + 1;
      const page = config.customers?.[code]?.[index] || {};
      return { ...item, main: code, page };
    });
  }

  function loadWithFallback( el, preferred, fallback, placeholder, setImage, onLoaded ) {
    const base = validPath(fallback) ? fallback : "";
    const first = validPath(preferred) ? preferred : base;
    if (!first) {
      setImage(el, "", placeholder, onLoaded);
      return;
    }
    setImage(el, first, placeholder, (ok) => {
      if (!ok && base && first !== base)
        setImage(el, base, placeholder, onLoaded);
      else if (onLoaded) onLoaded(ok);
    });
  }

  function addCompanion() {
    let wrap = get("dialogueCompanionWrap");
    if (wrap) return wrap;
    wrap = document.createElement("div");
    wrap.id = "dialogueCompanionWrap";
    wrap.className = "dialogueCompanionWrap";
    const img = document.createElement("img");
    img.id = "dialogueCompanionImage";
    img.alt = "Second customer";
    wrap.appendChild(img);
    get("stageScene").querySelector(".customerLane").appendChild(wrap);
    return wrap;
  }

  function addReaction() {
    let wrap = get("dialogueReactionWrap");
    if (wrap) return wrap;
    wrap = document.createElement("div");
    wrap.id = "dialogueReactionWrap";
    wrap.className = "dialogueReactionWrap bubbleWaiting";
    const art = document.createElement("img");
    art.id = "dialogueReactionArt";
    art.className = "dialogueReactionArt";
    art.alt = "";
    const text = document.createElement("p");
    text.id = "dialogueReactionText";
    wrap.append(art, text);
    get("stageScene").appendChild(wrap);
    const primary = get("customerWrap");
    const syncEntering = () =>
      wrap.classList.toggle(
        "bubbleWaiting",
        primary.classList.contains("entering")
      );
    new MutationObserver(syncEntering).observe(primary, {
      attributes: true,
      attributeFilter: ["class"],
    });
    syncEntering();
    return wrap;
  }

  function renderFrame(frame, tools) {
    const { characterAssets, setImage } = tools;
    const stage = get("stageScene");
    const page = frame.page || {};
    const mainCode = frame.main || frame.o.customer_code;
    const main =
      tools.orders.find((o) => o.customer_code === mainCode) || frame.o;
    // Only the special interruption may put a Cookie in front of the desk.
    const lane = stage.querySelector(".customerLane");
    const primary = get("customerWrap");
    const parent = page.frontOfDesk ? stage : lane;
    if (primary.parentElement !== parent) parent.appendChild(primary);
    stage.classList.toggle("dialogueFront", !!page.frontOfDesk);
    const mainArt = characterAssets[mainCode] || {};
    const speakerArt = characterAssets[frame.o.customer_code] || {};
    const isDuo = !!page.companion;
    stage.classList.toggle("dialogueDuo", isDuo);
    stage.classList.toggle(
      "dialoguePvSolo",
      !isDuo &&
        mainCode === "pure_vanilla" &&
        tools.orders.some((o) => o.customer_code === "shadow_milk")
    );
    stage.classList.toggle("dialogueBubbleLeft", page.bubbleSide === "left");

    loadWithFallback(
      get("portrait"),
      page.sprite,
      mainArt.sprite || main.portrait_path,
      get("portraitFallback"),
      setImage
    );
    get("speaker").textContent = frame.o.customer_name;
    get("speech").textContent = frame.s;

    const bubbleBox = get("bubbleBox");
    bubbleBox.classList.remove("customArt");
    loadWithFallback(
      get("speechArt"),
      page.bubble,
      speakerArt.bubble || frame.o.speech_image_path,
      null,
      setImage,
      (ok) => bubbleBox.classList.toggle("customArt", !!ok)
    );

    const companion = addCompanion();
    if (isDuo) {
      companion.hidden = false;
      const other = tools.orders.find(
        (o) => o.customer_code === page.companion
      );
      const otherArt = characterAssets[page.companion] || {};
      loadWithFallback(
        get("dialogueCompanionImage"),
        page.companionSprite,
        otherArt.sprite || other?.portrait_path,
        null,
        setImage
      );
    } else companion.hidden = true;

    const reaction = addReaction();
    if (
      isDuo &&
      typeof page.reactionText === "string" &&
      page.reactionText.trim()
    ) {
      reaction.hidden = false;
      reaction.classList.remove("customArt");
      reaction.classList.toggle(
        "bubbleWaiting",
        get("customerWrap").classList.contains("entering")
      );
      get("dialogueReactionText").textContent = page.reactionText;
      const otherArt = characterAssets[page.companion] || {};
      loadWithFallback(
        get("dialogueReactionArt"),
        page.reactionBubble,
        otherArt.bubble,
        null,
        setImage,
        (ok) => reaction.classList.toggle("customArt", !!ok)
      );
    } else reaction.hidden = true;
  }

  window.CAKE_DIALOGUE_DRIVER = { buildFrames, renderFrame };
})();
