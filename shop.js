import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg = window.CAKE_CONFIG,
  sb = createClient(cfg.supabaseUrl, cfg.supabaseKey),
  $ = (id) => document.getElementById(id);
const cart = {};
let catalog = [];
const msg = (s) => ($("message").textContent = s);
async function q(p) {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}
const TAROT = '\u{1F0B1}';
const MINUS = '\u2212';
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text !== undefined) x.textContent = text;
  return x;
};
function redraw() {
  const root = $("items");
  root.replaceChildren();
  catalog.forEach((t) => {
    const card = el("div", "item"),
      title = el("strong", "", t.name),
      cost = el("small", "", `${t.cost}ðŸ‚± each`),
      qty = el("div", "quantity"),
      minus = el("button", "", "âˆ’"),
      number = el("span", "", String(cart[t.code] || 0)),
      plus = el("button", "", "+");
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
    card.append(title, cost, qty);
    root.append(card);
  });
  const total = catalog.reduce(
    (sum, t) => sum + (cart[t.code] || 0) * t.cost,
    0
  );
  $("total").textContent = `Total: ${total}ðŸ‚±`;
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
        .map((d) => `${d.quantity} Ã— ${d.topping_code.replaceAll("_", " ")}`)
        .join(", ");
      return el(
        "div",
        "entry",
        `${new Date(h.created_at).toLocaleString()} Â· ${ h.total_tarots }ðŸ‚± Â· ${h.status}\n${items}`
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
  $("adminLink").hidden = profile.role !== "admin";
  catalog = await q(
    sb
      .from("topping_catalog")
      .select("code,name,cost")
      .eq("active", true)
      .order("cost")
  );
  redraw();
  await refresh();
} catch (e) {
  msg(e.message);
    }
