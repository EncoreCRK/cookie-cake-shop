import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const $ = (id) => document.getElementById(id);
const cfg = window.CAKE_CONFIG;
const Konva = window.Konva;
const FLAVORS = ["strawberry", "lemon", "milky", "chocolate", "blueberry"];
const COLORS = {
  strawberry: "#f4b0c1",
  lemon: "#efdf8d",
  milky: "#fff0dd",
  chocolate: "#906044",
  blueberry: "#a2a5ea",
};
const TOPPING_FILES = {
  crimson_cherries: "crimson_cherries.png",
  bananas: "bananas.png",
  tangy_blueberries: "tangy_blueberries.png",
  choco_stars: "choco_stars.png",
  star_candies: "star_candies.png",
  pawprint_hard_candies: "pawprint_hard_candies.png",
  wafer_rolls: "wafer_rolls.png",
  jellybeans: "jellybeans.png",
  pink_roses: "pink_roses.png",
  red_rose_petals: "red_rose_petals.png",
  fresh_leaves: "fresh_leaves.png",
};
const W = 960,
  H = 620;
const cakeCenter = { x: 480, y: 340, rx: 265, ry: 170 };
const label = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const newId = () => crypto.randomUUID();
let db,
  order,
  user,
  catalog = [],
  stockCream = {},
  stockTops = {};
let design = { frosting_flavor: "strawberry", layer_count: 1, decorations: [] };
let submitted = false,
  selected = null,
  mode = { type: "move" };
let stage, cakeLayer, decorLayer, pointerLayer, bag;
let redrawVersion = 0,
  autosaveTimer = null,
  saveQueue = Promise.resolve(),
  busy = false;
const imageCache = new Map();
function notify(text) {
  $("notice").hidden = !text;
  $("notice").textContent = text || "";
}
function saveStatus(text) {
  $("saveState").textContent = text;
}
function countUsed() {
  const c = { ...Object.fromEntries(FLAVORS.map((f) => [f, 0])) };
  c[design.frosting_flavor] += design.layer_count;
  const t = {};
  for (const d of design.decorations) {
    if (d.type === "cream") c[d.flavor] = (c[d.flavor] || 0) + 1;
    if (d.type === "topping") t[d.code] = (t[d.code] || 0) + 1;
  }
  return { c, t };
}
async function q(p) {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}
function imagePath(t) {
  const p = t.image_path;
  return p && /^(https:\/\/|\/|assets\/)/.test(p)
    ? p
    : `/assets/toppings/${TOPPING_FILES[t.code] || `${t.code}.png`}`;
}
function make(tag, cls, text) {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text !== undefined) x.textContent = text;
  return x;
}
function findSelectedOrder(orders) {
  const url = new URLSearchParams(location.search).get("order_id");
  const stored = sessionStorage.getItem("cake_active_order_id");
  return (
    orders.find((o) => o.order_id === url) ||
    orders.find((o) => o.order_id === stored) ||
    null
  );
}
async function init() {
  try {
    if (!cfg?.supabaseUrl || !cfg?.supabaseKey)
      throw Error("Configure Cake Shop config.js first.");
    if (!Konva)
      throw Error(
        "The Konva drawing library could not load. Check your connection."
      );
    db = createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const {
      data: { user: who },
    } = await db.auth.getUser();
    if (!who)
      throw Error("Please sign in on game.html before entering the Kitchen.");
    user = who;
    const profile = await q(
      db.from("profiles").select("approved").eq("user_id", user.id).single()
    );
    if (!profile.approved) throw Error("Your community access is disabled.");
    const orders = await q(db.rpc("get_current_cake_orders"));
    order = findSelectedOrder(orders);
    if (!order)
      throw Error(
        "Choose a customer on the Weekly Orders screen before entering the Kitchen."
      );
    sessionStorage.setItem("cake_active_order_id", order.order_id);
    $("customerName").textContent = `Baking for ${order.customer_name}`;
    $("orderSummary").textContent = order.mystery
      ? "Mystery order: ????"
      : describeOrder(order.display_requirements);
    await fetchStock();
    catalog = await q(
      db
        .from("topping_catalog")
        .select("code,name,cost,image_path,active")
        .eq("active", true)
        .order("cost")
    );
    const rows = await q(
      db
        .from("cakes")
        .select("id,status,frosting_flavor,layer_count,decorations")
        .eq("user_id", user.id)
        .eq("weekly_order_id", order.order_id)
        .limit(1)
    );
    const existing = rows[0];
    if (existing) {
      design = {
        frosting_flavor: existing.frosting_flavor || "strawberry",
        layer_count: existing.layer_count || 1,
        decorations: Array.isArray(existing.decorations)
          ? existing.decorations
          : [],
      };
      submitted = existing.status === "submitted";
    }
    buildStage();
    bindControls();
    showControls();
    updateUsage();
    saveStatus(submitted ? "Submitted (read-only)" : "Ready to decorate");
    if (submitted && existing) {
      const reviews = await q(
        db
          .from("cake_reviews")
          .select("stars,review_text_snapshot")
          .eq("cake_id", existing.id)
          .limit(1)
      );
      const r = reviews[0];
      if (r) {
        const cards = await q(
          db
            .from("review_cards")
            .select("review_image_path")
            .eq("customer_code", order.customer_code)
            .eq("stars", r.stars)
            .limit(1)
        );
        showReview({
          stars: r.stars,
          review: r.review_text_snapshot,
          review_image_path: cards[0]?.review_image_path,
        });
      }
    }
  } catch (e) {
    notify(e.message || String(e));
    saveStatus("Unable to load");
    $("saveBtn").disabled = true;
    $("submitBtn").disabled = true;
  }
}
function describeOrder(r) {
  if (!r || !r.flavor)
    return "This customer has not been assigned an order yet.";
  const cream =
    Object.entries(r.cream || {})
      .filter(([, n]) => n > 0)
      .map(([f, n]) => `${n} ${f} cream`)
      .join(", ") || "None";
  const tops =
    Object.entries(r.toppings || {})
      .filter(([, n]) => n > 0)
      .map(([f, n]) => `${n} ${f.replaceAll("_", " ")}`)
      .join(", ") || "None";
  return `${label(r.flavor)} cake • ${
    r.layers
  } layers • Cream: ${cream} • Toppings: ${tops}`;
}
async function fetchStock() {
  const [creams, toppings] = await Promise.all([
    q(
      db
        .from("frosting_inventory")
        .select("flavor,quantity")
        .eq("user_id", user.id)
    ),
    q(
      db
        .from("topping_inventory")
        .select("topping_code,quantity")
        .eq("user_id", user.id)
    ),
  ]);
  stockCream = Object.fromEntries(FLAVORS.map((f) => [f, 0]));
  stockTops = {};
  for (const x of creams) stockCream[x.flavor] = x.quantity;
  for (const x of toppings) stockTops[x.topping_code] = x.quantity;
}
function buildStage() {
  stage = new Konva.Stage({ container: "cakeStage", width: W, height: H });
  cakeLayer = new Konva.Layer();
  decorLayer = new Konva.Layer();
  pointerLayer = new Konva.Layer();
  stage.add(cakeLayer, decorLayer, pointerLayer);
  // A small bag-shaped cursor that appears when a cream bowl is chosen.
  bag = new Konva.Group({ x: 480, y: 180, visible: false, listening: false });
  bag.add(
    new Konva.Line({
      points: [-13, -42, 14, -42, 8, -16, 0, 7, -8, -16],
      closed: true,
      fill: "#fff6ed",
      stroke: "#8b637a",
      strokeWidth: 3,
    })
  );
  bag.add(
    new Konva.Circle({
      x: 0,
      y: 11,
      radius: 5,
      fill: "#f2a8c4",
      stroke: "#ffffff",
      strokeWidth: 1,
    })
  );
  pointerLayer.add(bag);
  redrawCake();
  redrawDecorations();
  function resize() {
    const container = $("cakeStage");
    const scale = container.clientWidth / W;
    stage.width(W * scale);
    stage.height(H * scale);
    stage.scale({ x: scale, y: scale });
  }
  resize();
  new ResizeObserver(resize).observe($("cakeStage"));
  let hold = null;
  const clearHold = () => {
    if (hold) {
      clearTimeout(hold);
      hold = null;
    }
  };
  stage.on("mousemove touchmove", () => {
    const p = pointerPosition();
    if (p && bag.visible()) bag.position(p);
    pointerLayer.batchDraw();
  });
  stage.on("mousedown touchstart", (event) => {
    if (submitted || busy || mode.type !== "cream" || inDecor(event.target))
      return;
    clearHold();
    hold = setTimeout(() => {
      hold = null;
      const p = pointerPosition();
      if (p) placeAt(p);
    }, 450);
  });
  stage.on("mouseup touchend touchcancel", clearHold);
  stage.on("click tap", (e) => {
    if (submitted || busy || inDecor(e.target)) return;
    if (mode.type === "topping") {
      const p = pointerPosition();
      if (p) placeAt(p);
    } else if (mode.type === "move") selectDecoration(null);
  });
}
function pointerPosition() {
  const p = stage.getPointerPosition();
  return p ? stage.getAbsoluteTransform().copy().invert().point(p) : null;
}
function inDecor(node) {
  let n = node;
  while (n && n !== stage) {
    if (n.getAttr("decorationId")) return true;
    n = n.getParent();
  }
  return false;
}
function cakePoint(x, y) {
  const px = (x - cakeCenter.x) / cakeCenter.rx;
  const py = (y - cakeCenter.y) / cakeCenter.ry;
  return px * px + py * py < 0.94;
}
function withinCake(x, y) {
  let dx = x - cakeCenter.x,
    dy = y - cakeCenter.y;
  const r = Math.sqrt(
    (dx * dx) / (cakeCenter.rx * cakeCenter.rx) +
      (dy * dy) / (cakeCenter.ry * cakeCenter.ry)
  );
  if (r > 0.95) {
    dx *= 0.95 / r;
    dy *= 0.95 / r;
  }
  return { x: (cakeCenter.x + dx) / W, y: (cakeCenter.y + dy) / H };
}
function placeAt(p) {
  if (submitted || busy) return;
  if (!cakePoint(p.x, p.y)) {
    notify("Place decorations on the cake itself.");
    return;
  }
  const used = countUsed();
  if (mode.type === "cream") {
    if ((used.c[mode.flavor] || 0) >= (stockCream[mode.flavor] || 0)) {
      notify(
        `You have no remaining ${mode.flavor} frosting. Ask the admin to grant more.`
      );
      return;
    }
  } else if (mode.type === "topping") {
    if ((used.t[mode.code] || 0) >= (stockTops[mode.code] || 0)) {
      notify("You have no more approved toppings of this type.");
      return;
    }
  } else return;
  const item = {
    id: newId(),
    type: mode.type,
    x: p.x / W,
    y: p.y / H,
    rotation: 0,
    scale: 1,
  };
  if (mode.type === "cream") item.flavor = mode.flavor;
  if (mode.type === "topping") item.code = mode.code;
  design.decorations.push(item);
  notify("");
  selected = item.id;
  changed();
}
function redrawCake() {
  cakeLayer.destroyChildren();
  cakeLayer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: W,
      height: H,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: W, y: H },
      fillLinearGradientColorStops: [
        0,
        "#c79b86",
        0.5,
        "#b17a6d",
        1,
        "#855d6b",
      ],
    })
  );
  for (let y = 0; y < H; y += 100)
    cakeLayer.add(
      new Konva.Line({
        points: [0, y, W, y],
        stroke: "#fff5e52a",
        strokeWidth: 4,
        listening: false,
      })
    );
  cakeLayer.add(
    new Konva.Ellipse({
      x: 480,
      y: 390,
      radiusX: 320,
      radiusY: 200,
      fill: "#fff8f2",
      stroke: "#dcbcbc",
      strokeWidth: 6,
      shadowColor: "#2c152a",
      shadowBlur: 30,
      shadowOpacity: 0.35,
      listening: false,
    })
  );
  const tint = COLORS[design.frosting_flavor];
  for (let i = 0; i < design.layer_count; i++) {
    const y = cakeCenter.y + Math.round((design.layer_count - 1 - i) * 13);
    cakeLayer.add(
      new Konva.Ellipse({
        x: cakeCenter.x,
        y: y + 17,
        radiusX: 259,
        radiusY: 167,
        fill: "#ac6d64",
        stroke: "#a66e5e",
        strokeWidth: 3,
        listening: false,
      })
    );
    cakeLayer.add(
      new Konva.Ellipse({
        x: cakeCenter.x,
        y,
        radiusX: 260,
        radiusY: 166,
        fill: tint,
        stroke: "#e8dfd6",
        strokeWidth: 6,
        listening: false,
      })
    );
  }
  cakeLayer.add(
    new Konva.Ellipse({
      x: cakeCenter.x,
      y: cakeCenter.y,
      radiusX: 243,
      radiusY: 153,
      stroke: "#ffffff77",
      strokeWidth: 4,
      dash: [9, 11],
      listening: false,
    })
  );
  cakeLayer.batchDraw();
}
async function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}
function renderCream(group, d) {
  const c = COLORS[d.flavor] || "#eee";
  group.add(
    new Konva.Ellipse({
      x: 3,
      y: 7,
      radiusX: 29,
      radiusY: 18,
      fill: "#3b253e",
      opacity: 0.25,
      listening: false,
    })
  );
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    group.add(
      new Konva.Circle({
        x: Math.cos(a) * 17,
        y: Math.sin(a) * 14,
        radius: 14,
        fill: c,
        stroke: "#785d70",
        strokeWidth: 1.6,
        listening: false,
      })
    );
  }
  group.add(
    new Konva.Circle({
      x: 0,
      y: -4,
      radius: 15,
      fill: c,
      stroke: "#ffffffa1",
      strokeWidth: 3,
      listening: false,
    })
  );
  group.add(
    new Konva.Circle({
      x: -5,
      y: -12,
      radius: 5,
      fill: "#ffffff88",
      listening: false,
    })
  );
}
function redrawDecorations() {
  const generation = ++redrawVersion;
  decorLayer.destroyChildren();
  for (const d of design.decorations) {
    const group = new Konva.Group({
      x: d.x * W,
      y: d.y * H,
      rotation: d.rotation,
      scaleX: d.scale,
      scaleY: d.scale,
      draggable: !submitted,
      decorationId: d.id,
    });
    group.add(
      new Konva.Circle({ radius: 40, fill: "#ffffff01", listening: true })
    );
    if (d.type === "cream") renderCream(group, d);
    else {
      const entry = catalog.find((t) => t.code === d.code);
      const src = entry
        ? imagePath(entry)
        : `/assets/toppings/${TOPPING_FILES[d.code] || `${d.code}.png`}`;
      // Fallback is visible even if the image is missing.
      const fallback = new Konva.Text({
        x: -36,
        y: -9,
        width: 72,
        align: "center",
        text: (entry?.name || d.code).slice(0, 15),
        fontSize: 12,
        fill: "#351a31",
        listening: false,
      });
      group.add(
        new Konva.Circle({
          radius: 35,
          fill: "#ffe5ec",
          stroke: "#8e6686",
          strokeWidth: 2,
          listening: false,
        })
      );
      group.add(fallback);
      loadImage(src).then((img) => {
        if (!img || redrawVersion !== generation || !group.getLayer()) return;
        fallback.destroy();
        group.add(
          new Konva.Image({
            x: -38,
            y: -38,
            width: 76,
            height: 76,
            image: img,
            listening: false,
          })
        );
        decorLayer.batchDraw();
      });
    }
    if (d.id === selected) {
      group.add(
        new Konva.Circle({
          radius: 47,
          stroke: "#fff5f0",
          strokeWidth: 2,
          dash: [6, 6],
          listening: false,
        })
      );
    }
    group.on("click tap", (evt) => {
      evt.cancelBubble = true;
      selectDecoration(d.id);
    });
    group.on("dragend", () => {
      const next = withinCake(group.x(), group.y());
      d.x = next.x;
      d.y = next.y;
      selected = d.id;
      changed();
    });
    decorLayer.add(group);
  }
  decorLayer.batchDraw();
}
function selectDecoration(id) {
  selected = id;
  redrawDecorations();
}
function setMode(value) {
  mode = value;
  selected = null;
  bag.visible(value.type === "cream");
  if (value.type === "cream") bag.findOne("Line").fill(COLORS[value.flavor]);
  $("modeLabel").textContent =
    value.type === "move"
      ? "Move existing decorations"
      : value.type === "cream"
      ? `Piping ${label(value.flavor)} cream`
      : `Placing ${
          catalog.find((t) => t.code === value.code)?.name || value.code
        }`;
  showControls();
  redrawDecorations();
  pointerLayer.batchDraw();
}
function showControls() {
  $("flavor").value = design.frosting_flavor;
  $("flavorName").textContent = `${label(design.frosting_flavor)} frosting`;
  $("flavorPicture").hidden = false;
  $("flavorPicture").src = `/assets/frostings/${design.frosting_flavor}.png`;
  for (const b of $("layerOptions").querySelectorAll("button"))
    b.classList.toggle(
      "chosen",
      Number(b.dataset.layers) === design.layer_count
    );
  $("selectMode").classList.toggle("chosen", mode.type === "move");
  $("creamChoices").replaceChildren();
  const used = countUsed();
  for (const f of FLAVORS) {
    const b = make(
      "button",
      "cream-button" +
        (mode.type === "cream" && mode.flavor === f ? " chosen" : "")
    );
    b.type = "button";
    b.disabled = submitted || busy || (used.c[f] || 0) >= (stockCream[f] || 0);
    const swatch = make("span", "swatch");
    swatch.style.background = COLORS[f];
    const body = make("span");
    body.textContent = label(f);
    body.append(
      make("span", "qty", `${used.c[f] || 0} / ${stockCream[f] || 0} used`)
    );
    b.append(swatch, body);
    b.onclick = () => setMode({ type: "cream", flavor: f });
    $("creamChoices").append(b);
  }
  $("toppingChoices").replaceChildren();
  let available = 0;
  for (const t of catalog) {
    if (!(stockTops[t.code] > 0)) continue;
    available++;
    const b = make(
      "button",
      "topping-button" +
        (mode.type === "topping" && mode.code === t.code ? " chosen" : "")
    );
    b.disabled =
      submitted || busy || (used.t[t.code] || 0) >= stockTops[t.code];
    const img = make("img");
    img.src = imagePath(t);
    img.alt = t.name;
    img.onerror = () => (img.style.display = "none");
    b.append(
      img,
      make("span", "", t.name),
      make(
        "span",
        "qty",
        `${used.t[t.code] || 0} / ${stockTops[t.code]} placed`
      )
    );
    b.onclick = () => setMode({ type: "topping", code: t.code });
    $("toppingChoices").append(b);
  }
  if (!available)
    $("toppingChoices").append(make("p", "help", "No approved toppings yet."));
  $("flavor").disabled = submitted || busy;
  $("layerOptions")
    .querySelectorAll("button")
    .forEach((b) => (b.disabled = submitted || busy));
  for (const id of [
    "saveBtn",
    "submitBtn",
    "removeSelected",
    "rotateLeft",
    "rotateRight",
    "undo",
  ])
    $(id).disabled = submitted || busy;
}
function updateUsage() {
  const used = countUsed();
  const creamRoot = $("frostingUsage");
  creamRoot.replaceChildren();
  FLAVORS.forEach((f) => {
    const n = used.c[f] || 0,
      m = stockCream[f] || 0;
    const row = make("div", "usage-row" + (!submitted && n > m ? " over" : ""));
    row.append(
      make("span", "", `${label(f)} frosting`),
      make("strong", "", submitted ? `${n} consumed` : `${n} / ${m}`)
    );
    creamRoot.append(row);
  });
  const topRoot = $("toppingUsage");
  topRoot.replaceChildren();
  for (const [code, n] of Object.entries(used.t)) {
    const m = stockTops[code] || 0;
    const row = make("div", "usage-row" + (!submitted && n > m ? " over" : ""));
    row.append(
      make("span", "", catalog.find((t) => t.code === code)?.name || code),
      make("strong", "", submitted ? `${n} consumed` : `${n} / ${m}`)
    );
    topRoot.append(row);
  }
}
function changed() {
  redrawCake();
  redrawDecorations();
  updateUsage();
  showControls();
  saveStatus("Unsaved changes");
  if (!submitted) {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => persist(), 900);
  }
}
function persist() {
  if (!order || submitted) return Promise.resolve();
  const snapshot = structuredClone(design);
  saveStatus("Saving draft...");
  saveQueue = saveQueue
    .catch(() => 
