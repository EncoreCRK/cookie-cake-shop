import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg = window.CAKE_CONFIG,
  sb = createClient(cfg.supabaseUrl, cfg.supabaseKey),
  $ = (id) => document.getElementById(id);
const TAROT = "\u{1F0B1}";
const MINUS = "\u2212";
const TIMES = "\u00D7";
const MIDDLE_DOT = "\u00B7";
const cart = {};
let catalog = [];
const msg = (s) => ($("message").textContent = s);
async function q(p) {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text !== undefined) x.textContent = text;
  return x;
};
// Set your exact PNG filenames here. Each topping code matches its Supabase catalog code.
const TOPPING_IMAGES = {
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
function redraw() {
  const root = $("items");
  root.replaceChildren();
  catalog.forEach((t) => {
    const card = el("div", "item");
    const imageBox = el("div", "topping-picture");
    const img = el("img", "topping-img");
    const file = TOPPING_IMAGES[t.code] || `${t.code}.png`;
    // Prefer an explicitly configured catalog image path when available.
    const path = t.image_path || `assets/toppings/${file}`;
    img.src = path;
    img.alt = t.name;
    img.loading = "lazy";
    img.onerror = () => {
      imageBox.textContent = "Image unavailable";
      imageBox.classList.add("missing-image");
    };
    imageBox.append(img);
    const title = el("strong", "", t.name);
    const cost = el("small", "", `${t.cost}${TAROT} each`);
    const qty = el("div", "quantity");
    const minus = el("button", "", MINUS);
    const number = el("span", "", String(cart[t.code] || 0));
    const plus = el("button", "", "+");
    minus.disabled = !(cart[t.code] > 0);
    minus.onclick = () => {
      cart[t.code] = Math.max(0, (cart[t.code] || 0) - 1);
      redraw();
    };
    plus.onclick = () => {
      cart[t.code] = Math.min(99, (cart[t.code] || 0) + 1);
      redraw();
    };
    qty.append(minus, number, plus);
    card.append(imageBox, title, cost, qty);
    root.append(card);
  });
  const total = catalog.reduce(
    (sum, t) => sum + (cart[t.code] || 0) * t.cost,
    0
  );
  $("total").textContent = `Total: ${total}${TAROT}`;
  $("checkout").disabled = !total;
}
async function refresh() {
  const [stock, history, details] = await Promise.all([
    q(
      sb
        .from("topping_inventory")
        .select("topping_code,quantity")
        .order("topping_code")
    ),
    q(
      sb
        .from("purchases")
        .select("id,total_tarots,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100)
    ),
    q(
      sb
        .from("purchase_items")
        .select("purchase_id,topping_code,quantity,unit_cost")
    ),
  ]);
  $("stock").replaceChildren(
    ...stock.map((s) =>
      el(
        "div",
        "entry",
        `${s.topping_code.replaceAll("_", " ")}: ${s.quantity}`
      )
    )
  );
  $("history").replaceChildren(
    ...history.map((h) => {
      const items = details
        .filter((d) => d.purchase_id === h.id)
        .map(
          (d) => `${d.quantity} ${TIMES} ${d.topping_code.replaceAll("_", " ")}`
        )
        .join(", ");
      return el(
        "div",
        "entry",
        `${new Date(h.created_at).toLocaleString()} ${MIDDLE_DOT} ${ h.total_tarots }${TAROT} ${MIDDLE_DOT} ${h.status}\n${items}`
      );
    })
  );
}
$("checkout").onclick = async () => {
  const items = Object.fromEntries(
    Object.entries(cart).filter(([, v]) => v > 0)
  );
  if (!Object.keys(items).length) return;
  $("checkout").disabled = true;
  try {
    await q(sb.rpc("request_toppings", { p_items: items }));
    Object.keys(cart).forEach((k) => (cart[k] = 0));
    redraw();
    msg(
      "Purchase request recorded. The admin must approve it before toppings become available."
    );
    await refresh();
  } catch (e) {
    msg(e.message);
    redraw();
  }
};
try {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw Error("Sign in on game.html first.");
  const profile = await q(
    sb.from("profiles").select("role,approved").eq("user_id", user.id).single()
  );
  if (!profile.approved) throw Error("Membership disabled");
  catalog = await q(
    sb
      .from("topping_catalog")
      .select("code,name,cost,image_path")
      .eq("active", true)
      .order("cost")
  );
  redraw();
  await refresh();
} catch (e) {
  msg(e.message);
}
