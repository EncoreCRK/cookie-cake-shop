import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const c = window.CAKE_CONFIG,
  sb = createClient(c.supabaseUrl, c.supabaseKey),
  $ = (id) => document.getElementById(id);
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
async function load() {
  try {
    msg("");
    const [purchases, items, profiles] = await Promise.all([
      q(
        sb
          .from("purchases")
          .select("id,user_id,total_tarots,status,created_at")
          .order("created_at", { ascending: false })
          .limit(200)
      ),
      q(
        sb
          .from("purchase_items")
          .select("purchase_id,topping_code,quantity,unit_cost")
      ),
      q(sb.from("profiles").select("user_id,username")),
    ]);
    const users = new Map(profiles.map((x) => [x.user_id, x.username]));
    const root = $("ledger");
    root.replaceChildren();
    for (const p of purchases) {
      const card = el("div", "entry"),
        info = el("div"),
        line = el(
          "strong",
          "",
          `${users.get(p.user_id) || "Member"} Â· ${p.total_tarots}ðŸ‚±`
        ),
        meta = el(
          "div",
          "meta",
          `${new Date(p.created_at).toLocaleString()} | ${p.status}\n${items .filter((i) => i.purchase_id === p.id) .map( (i) => `${i.quantity} Ã— ${i.topping_code.replaceAll("_", " ")} (${ i.quantity * i.unit_cost }ðŸ‚±)` ) .join(", ")}`
        );
      info.append(line, meta);
      const buttons = el("div");
      for (const [action, label, allowed] of [
        ["approve", "Approve + grant", p.status === "pending"],
        ["deducted", "Mark deducted", p.status === "approved"],
        ["cancel", "Cancel", p.status === "pending"],
      ]) {
        if (!allowed) continue;
        const b = el("button", "", label);
        b.onclick = async () => {
          if (!confirm(`${label} for ${users.get(p.user_id) || "member"}?`))
            return;
          b.disabled = true;
          try {
            await q(
              sb.rpc("admin_process_topping_purchase", {
                p_purchase_id: p.id,
                p_action: action,
              })
            );
            await load();
          } catch (e) {
            msg(e.message);
            b.disabled = false;
          }
        };
        buttons.append(b);
      }
      card.append(info, buttons);
      root.append(card);
    }
    if (!purchases.length) root.append(el("p", "", "No requests yet."));
  } catch (e) {
    msg(e.message);
  }
}
$("refresh").onclick = load;
try {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw Error("Sign in using game.html first.");
  const profile = await q(
    sb.from("profiles").select("role,approved").eq("user_id", user.id).single()
  );
  if (!profile.approved || profile.role !== "admin")
    throw Error("Admin account required");
  await load();
} catch (e) {
  msg(e.message);
  $("ledger").textContent = "";
}
