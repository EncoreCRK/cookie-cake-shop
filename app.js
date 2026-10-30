import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.CAKE_CONFIG;
const $ = (id) => document.getElementById(id);
const FLAVORS = [
  ["strawberry", "Strawberry", "🔴"],
  ["lemon", "Lemon", "🟡"],
  ["milky", "Milky", "⚪"],
  ["chocolate", "Chocolate", "🟤"],
  ["blueberry", "Blueberry", "🟣"],
];
const TAROT = "\u{1F0B1}";
const STAR = "\u2605";
const dot = "\u00b7";
const escapeText = (value) => String(value ?? "");
let sb,
  members = [],
  customers = [],
  templates = [],
  reviews = [],
  toppings = [],
  purchases = [],
  purchaseItems = [];
let selectedMemberId = null,
  activeTab = "overview",
  isAuthorized = false;

function node(tag, content = "", className = "") {
  const e = document.createElement(tag);
  e.textContent = escapeText(content);
  if (className) e.className = className;
  return e;
}
function notify(text, isError = false) {
  const n = $("message");
  n.textContent = text;
  n.classList.toggle("error", isError);
  n.style.display = "block";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => (n.style.display = "none"), 5500);
}
function failure(err) {
  console.error(err);
  notify(err?.message || String(err), true);
}
async function unwrap(task) {
  const { data, error } = await task;
  if (error) throw error;
  return data;
}
async function run(task, success) {
  try {
    await task();
    if (success) notify(success);
  } catch (err) {
    failure(err);
  }
}
function switchTab(id) {
  if (!isAuthorized) return;
  const headings = {
    overview: "Bakery Overview",
    members: "Community Members",
    inventory: "Frosting Inventory",
    customers: "Customer Studio",
    reviews: "Review Cards",
    purchases: "Tarot Purchases",
  };
  if (!headings[id]) return;
  activeTab = id;
  document.querySelectorAll(".tab").forEach((e) => (e.hidden = e.id !== id));
  document
    .querySelectorAll("[data-tab]")
    .forEach((e) => e.classList.toggle("active", e.dataset.tab === id));
  $("currentHeading").textContent = headings[id];
  window.scrollTo(0, 0);
}
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) switchTab(b.dataset.tab);
});
document
  .querySelectorAll("[data-go]")
  .forEach((b) => (b.onclick = () => switchTab(b.dataset.go)));

async function authenticate() {
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error) throw error;
  if (!user) {
    isAuthorized = false;
    $("login").hidden = false;
    $("dashboard").hidden = true;
    $("signOut").hidden = true;
    return;
  }
  const p = await unwrap(
    sb
      .from("profiles")
      .select("username,role,approved")
      .eq("user_id", user.id)
      .single()
  );
  if (p.role !== "admin" || !p.approved) {
    isAuthorized = false;
    $("login").hidden = false;
    $("dashboard").hidden = true;
    $("signOut").hidden = true;
    notify("This account is not an approved administrator.", true);
    return;
  }
  isAuthorized = true;
  $("login").hidden = true;
  $("dashboard").hidden = false;
  $("signOut").hidden = false;
  $("welcome").textContent = p.username;
  await refreshAll();
  switchTab(activeTab);
}
$("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  run(async () => {
    await unwrap(
      sb.auth.signInWithPassword({
        email: $("loginEmail").value,
        password: $("loginPassword").value,
      })
    );
    await authenticate();
  });
});
$("signOut").onclick = () =>
  run(async () => {
    await sb.auth.signOut();
    location.reload();
  });

async function refreshAll() {
  [members, customers, templates, reviews, toppings, purchases, purchaseItems] =
    await Promise.all([
      unwrap(
        sb
          .from("profiles")
          .select("user_id,username,role,approved")
          .order("username")
      ),
      unwrap(sb.from("customers").select("*").order("rotation_week")),
      unwrap(sb.rpc("admin_get_templates")),
      unwrap(sb.from("review_cards").select("*")),
      unwrap(sb.from("topping_catalog").select("code,name,cost").order("name")),
      unwrap(
        sb
          .from("purchases")
          .select("id,user_id,total_tarots,status,created_at")
          .order("created_at", { ascending: false })
          .limit(200)
      ),
      unwrap(
        sb
          .from("purchase_items")
          .select("purchase_id,topping_code,quantity,unit_cost")
      ),
    ]);
  drawStats();
  drawMembers();
  drawMemberSelect();
  drawCustomerSelect();
  drawReviewSelectors();
  drawPurchases();
  loadWeek().catch(() => {
    $("weekInfo").textContent = "Weekly schedule is temporarily unavailable.";
  });
}
function drawStats() {
  $("statMembers").textContent = members.length;
  $("statActive").textContent = members.filter((m) => m.approved).length;
  $("statPending").textContent = purchases.filter(
    (p) => p.status === "pending"
  ).length;
  $("statTarots").textContent = `${purchases .filter((p) => p.status === "approved") .reduce((sum, p) => sum + p.total_tarots, 0)}${TAROT}`;
}
async function loadWeek() {
  const w = await unwrap(sb.rpc("get_current_cake_orders"));
  if (w?.length) {
    $("weekPair").textContent = w.map((x) => x.customer_name).join(" & ");
    $("weekInfo").textContent =
      "Deadline: " +
      new Date(w[0].week_end).toLocaleString(undefined, {
        timeZone: "America/Los_Angeles",
        dateStyle: "full",
        timeStyle: "short",
      }) +
      " Pacific time";
  } else {
    $("weekInfo").textContent = "No current-week orders found.";
  }
}

// MEMBER MANAGEMENT: Select one member, then edit in a dedicated form.
function drawMembers() {
  const target = $("membersList"),
    term = $("memberSearch").value.trim().toLowerCase();
  target.replaceChildren();
  const subset = members.filter((m) => m.username.toLowerCase().includes(term));
  if (!subset.length)
    target.append(node("p", "No matching members.", "muted small"));
  for (const m of subset) {
    const b = node("button", "", "member-line");
    b.type = "button";
    if (selectedMemberId === m.user_id) b.classList.add("selected");
    const name = node("strong", m.username);
    const status = node("small", m.approved ? "Active" : "Disabled");
    b.append(name, status);
    b.onclick = () => {
      selectedMemberId = m.user_id;
      drawMembers();
      openMemberEditor();
    };
    target.append(b);
  }
}
$("memberSearch").oninput = drawMembers;
function openMemberEditor() {
  const m = members.find((x) => x.user_id === selectedMemberId);
  $("memberEditor").hidden = !m;
  if (!m) return;
  $("memberNameEdit").value = m.username;
  $("memberApprovedEdit").checked = m.approved;
}
$("cancelMember").onclick = () => {
  selectedMemberId = null;
  $("memberEditor").hidden = true;
  drawMembers();
};
$("memberForm").onsubmit = (e) => {
  e.preventDefault();
  const id = selectedMemberId;
  if (!id) return;
  run(async () => {
    await unwrap(
      sb.rpc("admin_set_member", {
        p_user_id: id,
        p_username: $("memberNameEdit").value,
        p_approved: $("memberApprovedEdit").checked,
      })
    );
    members = await unwrap(
      sb
        .from("profiles")
        .select("user_id,username,role,approved")
        .order("username")
    );
    drawStats();
    drawMembers();
    drawMemberSelect();
    openMemberEditor();
    drawPurchases();
  }, "Member saved successfully.");
};
$("createForm").onsubmit = (e) => {
  e.preventDefault();
  run(async () => {
    const { data, error } = await sb.functions.invoke("create-member", {
      body: {
        username: $("newUsername").value,
        email: $("newEmail").value,
        password: $("newPassword").value,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    $("createForm").reset();
    await refreshAll();
  }, "New member account created.");
};

// FROSTING: All five quantities remain visible for the chosen member.
function drawMemberSelect() {
  const sel = $("inventoryMember"),
    old = sel.value;
  sel.replaceChildren();
  for (const m of members) {
    const o = node("option", m.username);
    o.value = m.user_id;
    sel.append(o);
  }
  if (members.some((m) => m.user_id === old)) sel.value = old;
  loadInventory().catch(failure);
}
$("inventoryMember").onchange = () => loadInventory().catch(failure);
async function loadInventory() {
  const userId = $("inventoryMember").value,
    root = $("inventoryList");
  root.replaceChildren();
  if (!userId) return;
  const rows = await unwrap(
    sb
      .from("frosting_inventory")
      .select("flavor,quantity")
      .eq("user_id", userId)
  );
  const balances = new Map(rows.map((x) => [x.flavor, x.quantity]));
  for (const [code, label, emoji] of FLAVORS) {
    const card = node("div", "", "flavor-card");
    card.append(
      node("div", emoji, "emoji"),
      node("strong", label),
      node("b", balances.get(code) ?? 0)
    );
    root.append(card);
  }
}
$("inventoryForm").onsubmit = (e) => {
  e.preventDefault();
  run(async () => {
    await unwrap(
      sb.rpc("admin_adjust_frosting", {
        p_user_id: $("inventoryMember").value,
        p_flavor: $("inventoryFlavor").value,
        p_delta: Number($("inventoryDelta").value),
        p_reason: $("inventoryReason").value,
      })
    );
    await loadInventory();
  }, "Frosting inventory updated.");
};

// CUSTOMER DIALOGUE AND STRUCTURED ORDER BUILDER.
function drawCustomerSelect() {
  const sel = $("customerSelect"),
    previous = sel.value;
  sel.replaceChildren();
  for (const c of customers) {
    const o = node("option", `${c.name} | Week ${c.rotation_week}`);
    o.value = c.code;
    sel.append(o);
  }
  if (customers.some((c) => c.code === previous)) sel.value = previous;
  drawOrderFields();
  loadCustomer();
}
function drawOrderFields() {
  const flavor = $("orderFlavor");
  flavor.replaceChildren();
  for (const [code, label] of FLAVORS) {
    const o = node("option", label);
    o.value = code;
    flavor.append(o);
  }
  const creams = $("creamFields"),
    tops = $("toppingFields");
  creams.replaceChildren();
  tops.replaceChildren();
  for (const [code, label, emoji] of FLAVORS)
    creams.append(quantityField("cream", code, `${emoji} ${label}`));
  for (const t of toppings)
    tops.append(quantityField("topping", t.code, t.name));
}
function quantityField(group, code, title) {
  const label = node("label", "", "qty-item");
  label.append(node("span", title));
  const n = node("input");
  n.type = "number";
  n.inputMode = "numeric";
  n.min = "0";
  n.max = "100";
  n.step = "1";
  n.value = "0";
  n.dataset.group = group;
  n.dataset.code = code;
  n.setAttribute("aria-label", `${title} quantity`);
  label.append(n);
  return label;
}
function writeQuantities(group, values) {
  document.querySelectorAll(`input[data-group="${group}"]`).forEach((input) => {
    input.value = values?.[input.dataset.code] ?? 0;
  });
}
function readQuantities(group) {
  const out = {};
  document.querySelectorAll(`input[data-group="${group}"]`).forEach((input) => {
    const n = Number(input.value);
    if (!Number.isInteger(n) || n < 0 || n > 100)
      throw new Error(
        "Each ingredient quantity must be a whole number between 0 and 100."
      );
    if (n > 0) out[input.dataset.code] = n;
  });
  return out;
}
function loadCustomer() {
  const c = customers.find((x) => x.code === $("customerSelect").value);
  if (!c) return;
  $("customerBadge").textContent = `${c.name} · ${ c.kind === "beast" ? "Beast Cookie" : "Ancient Cookie" } · Rotation Week ${c.rotation_week}${ c.mystery ? " · Hidden randomized order" : "" }`;
  $("entranceDialogue").value = (c.entrance_dialogue || []).join("\n");
  $("orderDialogue").value = c.order_dialogue || "";
  $("portraitPath").value = c.portrait_path || "";
  $("speechPath").value = c.speech_image_path || "";
  const r =
    templates.find((x) => x.customer_code === c.code)?.requirements || {};
  $("orderFlavor").value = FLAVORS.some((f) => f[0] === r.flavor)
    ? r.flavor
    : "milky";
  $("orderLayers").value = String(
    [1, 2, 3, 4].includes(Number(r.layers)) ? Number(r.layers) : 1
  );
  writeQuantities("cream", r.cream);
  writeQuantities("topping", r.toppings);
  $("orderHint").textContent = c.mystery
    ? "Shadow Milk receives a newly randomized secret request each week. This template is not his randomized order."
    : "This recurring recipe is used whenever this Cookie appears in the five-week rotation.";
  $("applyCurrentWeek").disabled = !!c.mystery;
}
$("customerSelect").onchange = loadCustomer;
function collectRequirements() {
  return {
    flavor: $("orderFlavor").value,
    layers: Number($("orderLayers").value),
    cream: readQuantities("cream"),
    toppings: readQuantities("topping"),
  };
}
$("customerForm").onsubmit = (e) => {
  e.preventDefault();
  run(async () => {
    await unwrap(
      sb.rpc("admin_save_customer", {
        p_code: $("customerSelect").value,
        p_entrance_dialogue: $("entranceDialogue")
          .value.split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        p_order_dialogue: $("orderDialogue").value,
        p_portrait_path: $("portraitPath").value,
        p_speech_image_path: $("speechPath").value,
      })
    );
    customers = await unwrap(
      sb.from("customers").select("*").order("rotation_week")
    );
    loadCustomer();
  }, "Customer dialogue and default artwork saved.");
};
$("orderForm").onsubmit = (e) => {
  e.preventDefault();
  run(async () => {
    await unwrap(
      sb.rpc("admin_save_template", {
        p_code: $("customerSelect").value,
        p_requirements: collectRequirements(),
      })
    );
    templates = await unwrap(sb.rpc("admin_get_templates"));
    loadCustomer();
  }, "Recurring recipe saved for future weeks.");
};
$("applyCurrentWeek").onclick = () => {
  if (
    !confirm(
      "Change this customer's CURRENT week order? Any existing submitted cakes can block the change."
    )
  )
    return;
  run(async () => {
    await unwrap(
      sb.rpc("admin_override_active_order", {
        p_customer_code: $("customerSelect").value,
        p_requirements: collectRequirements(),
      })
    );
    await loadWeek();
  }, "Current-week order updated.");
};

// REVIEW CARDS: one editor, five star choices, image preview.
function drawReviewSelectors() {
  const sel = $("reviewCustomer"),
    previous = sel.value;
  sel.replaceChildren();
  for (const c of customers) {
    const o = node("option", c.name);
    o.value = c.code;
    sel.append(o);
  }
  if (customers.some((c) => c.code === previous)) sel.value = previous;
  displayReview();
}
function displayReview() {
  const stars = Number($("reviewStars").value);
  document
    .querySelectorAll("[data-stars]")
    .forEach((b) =>
      b.classList.toggle("active", Number(b.dataset.stars) === stars)
    );
  const r = reviews.find(
    (x) => x.customer_code === $("reviewCustomer").value && x.stars === stars
  );
  $("reviewText").value = r?.review_text || "";
  $("reviewImage").value = r?.review_image_path || "";
  displayReviewImage();
}
function displayReviewImage() {
  const root = $("reviewPreview"),
    path = $("reviewImage").value.trim();
  root.replaceChildren();
  if (!path || !/^(https:\/\/|\/)/.test(path)) {
    root.append(
      node(
        "span",
        "PNG preview appears here when you enter a valid /assets/ path."
      )
    );
    return;
  }
  const im = document.createElement("img");
  im.src = path;
  im.alt = "Review card preview";
  im.onerror = () => {
    root.replaceChildren(
      node("span", "Image not found. Double-check the filename and path.")
    );
  };
  root.append(im);
}
$("reviewCustomer").onchange = displayReview;
document.querySelectorAll("[data-stars]").forEach(
  (b) =>
    (b.onclick = () => {
      $("reviewStars").value = b.dataset.stars;
      displayReview();
    })
);
$("reviewImage").oninput = displayReviewImage;
$("reviewForm").onsubmit = (e) => {
  e.preventDefault();
  run(async () => {
    await unwrap(
      sb.rpc("admin_save_review", {
        p_code: $("reviewCustomer").value,
        p_stars: Number($("reviewStars").value),
        p_text: $("reviewText").value,
        p_image_path: $("reviewImage").value,
      })
    );
    reviews = await unwrap(sb.from("review_cards").select("*"));
    displayReview();
  }, "Review card saved.");
};

// PURCHASE LEDGER: use Step 5 transactional RPC, never direct table writes.
function drawPurchases() {
  const root = $("purchasesList"),
    filter = $("purchaseFilter").value;
  root.replaceChildren();
  const selected = purchases.filter(
    (p) => filter === "all" || p.status === filter
  );
  if (!selected.length) {
    root.append(node("p", "No purchases match this filter.", "muted"));
    return;
  }
  for (const p of selected) {
    const member = members.find((m) => m.user_id === p.user_id);
    const card = node("article", "", "purchase-card");
    const top = node("div", "", "purchase-top");
    const title = node(
      "strong",
      `${member?.username || "Unknown member"} ${dot} ${ p.total_tarots }${TAROT}`
    );
    const badge = node("span", p.status, "status " + p.status);
    top.append(title, badge);
    const timestamp = node("small", new Date(p.created_at).toLocaleString());
    const items = purchaseItems
      .filter((i) => i.purchase_id === p.id)
      .map((i) => {
        const t = toppings.find((x) => x.code === i.topping_code);
        return `${i.quantity} × ${t?.name || i.topping_code} (${ i.quantity * i.unit_cost }${TAROT})`;
      })
      .join(", ");
    const detail = node("div", items || "No item details", "purchase-items");
    card.append(top, timestamp, detail);
    if (p.status === "pending" || p.status === "approved") {
      const row = node("div", "", "purchase-actions");
      if (p.status === "pending") {
        const approve = node("button", "Approve + grant topping", "primary");
        approve.onclick = () => processPurchase(p, "approve");
        const cancel = node("button", "Cancel request", "ghost");
        cancel.onclick = () => processPurchase(p, "cancel");
        row.append(approve, cancel);
      } else {
        const deduct = node("button", "Mark Tarot deducted", "secondary");
        deduct.onclick = () => processPurchase(p, "deducted");
        row.append(deduct);
      }
      card.append(row);
    }
    root.append(card);
  }
}
async function processPurchase(p, action) {
  const question = {
    approve: "Approve this request and grant its toppings to the member?",
    deducted:
      "Have you already deducted these Tarots from the member in your community app?",
    cancel: "Cancel this unapproved purchase request?",
  }[action];
  if (!confirm(question)) return;
  await run(async () => {
    await unwrap(
      sb.rpc("admin_process_topping_purchase", {
        p_purchase_id: p.id,
        p_action: action,
      })
    );
    await reloadPurchases();
  }, `Purchase marked ${action === "approve" ? "approved" : action === "cancel" ? "cancelled" : "deducted"}.`);
}
async function reloadPurchases() {
  [purchases, purchaseItems] = await Promise.all([
    unwrap(
      sb
        .from("purchases")
        .select("id,user_id,total_tarots,status,created_at")
        .order("created_at", { ascending: false })
        .limit(200)
    ),
    unwrap(
      sb
        .from("purchase_items")
        .select("purchase_id,topping_code,quantity,unit_cost")
    ),
  ]);
  drawStats();
  drawPurchases();
}
$("purchaseFilter").onchange = drawPurchases;
$("reloadPurchases").onclick = () =>
  run(reloadPurchases, "Purchases refreshed.");

if (
  !cfg?.supabaseUrl ||
  !cfg?.supabaseKey ||
  cfg.supabaseUrl.includes("YOUR_NEW")
) {
  notify(
    "Your config.js must point to the separate Cake Shop Supabase project.",
    true
  );
} else {
  sb = createClient(cfg.supabaseUrl, cfg.supabaseKey);
  authenticate().catch(failure);
   }
