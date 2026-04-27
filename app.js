const STORAGE_KEY = "pasteleria_db_v3";
const TITLES = {
  agenda: "Agenda de Entregas",
  pedido: "Nuevo Pedido",
  catalogo: "Catalogo y Recetas",
  compras: "Lista de Compras",
  clientes: "Base de Clientes",
  ajustes: "Ajustes y Sistema"
};
const UNIDADES = ["un", "kg", "gr", "lt", "ml"];

const state = {
  view: "agenda",
  agendaFilter: "hoy",
  selectedClientId: null,
  cart: {},
  recipeDraft: [],
  photoDraft: "",
  discountMode: "money",
  editProductId: null,
  consolidado: null,
  includedPedidos: [],
  modalOnConfirm: null
};

function emptyDB() {
  return {
    productos: [],
    pedidos: [],
    clientes: [],
    materiales_maestro: ["Harina", "Azucar", "Mantequilla", "Huevos", "Crema"],
    config: {
      github_repo: "",
      github_token: "",
      theme: "azul",
      primary_color: "#e58ba6",
      backup_path: "",
      sync_state: "idle",
      business_name: "Pasteleria Fulano",
      business_logo: ""
    }
  };
}

let db = loadDB();
seedIfNeeded();
initUI();
initCollapsibleCards();
renderAll();

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyDB();
  try {
    const parsed = JSON.parse(raw);
    return {
      ...emptyDB(),
      ...parsed,
      config: { ...emptyDB().config, ...(parsed.config || {}) }
    };
  } catch {
    return emptyDB();
  }
}

function saveDB() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function seedIfNeeded() {
  if (db.productos.length === 0) {
    db.productos.push({
      id: uid(),
      nombre: "Torta Tres Leches",
      cat: "DULCE",
      precio: 18000,
      unidad_venta: "un",
      foto_b64: "",
      receta: [
        { material: "Harina", cantidad: 0.8, unidad: "kg", costo_unit: 1600 },
        { material: "Huevos", cantidad: 8, unidad: "un", costo_unit: 250 },
        { material: "Azucar", cantidad: 0.4, unidad: "kg", costo_unit: 1300 }
      ]
    });
  }
  if (db.clientes.length === 0) {
    db.clientes.push({
      id: uid(),
      nombre: "Cliente Demo",
      fono: "+56900000000",
      direccion: "Av. Principal 123",
      lat_frecuente: -33.45,
      lon_frecuente: -70.66
    });
  }
  saveDB();
}

function initUI() {
  $("#top-menu-btn").addEventListener("click", toggleTopMenu);
  $("#overlay").addEventListener("click", () => {
    closeTopMenu();
    closeModal();
  });

  $("#menu-open-ajustes").addEventListener("click", () => {
    setView("ajustes");
    closeTopMenu();
  });
  $("#menu-sync").addEventListener("click", () => { forzarSync(); closeTopMenu(); });
  $("#menu-export").addEventListener("click", () => { exportarJSON(); closeTopMenu(); });
  $("#menu-import").addEventListener("click", () => { $("#import-file").click(); closeTopMenu(); });

  $$(".bottom-item").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $("#view-fab").addEventListener("click", onFabClick);

  $$(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      state.agendaFilter = chip.dataset.filter;
      $$(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      $("#agenda-range").classList.toggle("hidden", state.agendaFilter !== "rango");
      renderAgenda();
    });
  });
  $("#agenda-from").addEventListener("change", renderAgenda);
  $("#agenda-to").addEventListener("change", renderAgenda);

  $("#pedido-cliente").addEventListener("input", renderClienteSuggestions);
  $("#capturar-gps").addEventListener("click", capturarGPS);
  $("#transporte").addEventListener("input", renderResumenPedido);
  $("#descuento").addEventListener("input", renderResumenPedido);
  $("#discount-mode-money").addEventListener("click", () => setDiscountMode("money"));
  $("#discount-mode-percent").addEventListener("click", () => setDiscountMode("percent"));
  $("#confirmar-pedido").addEventListener("click", confirmarPedido);

  $("#generar-lista").addEventListener("click", generarConsolidado);
  $("#copiar-whatsapp").addEventListener("click", copiarWhatsApp);
  $("#buscar-cliente").addEventListener("input", renderClientes);

  $("#forzar-sync").addEventListener("click", forzarSync);
  $("#cfg-theme").addEventListener("change", saveConfigFromUI);
  $("#cfg-repo").addEventListener("input", saveConfigFromUI);
  $("#cfg-token").addEventListener("input", saveConfigFromUI);
  $("#cfg-backup-path").addEventListener("input", saveConfigFromUI);
  $("#cfg-biz-name").addEventListener("input", saveConfigFromUI);
  $("#cfg-logo-file").addEventListener("change", handleBizLogo);
  $("#export-json").addEventListener("click", exportarJSON);
  $("#import-json").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", importarJSON);

  $("#modal-cancel").addEventListener("click", closeModal);
  $("#modal-confirm").addEventListener("click", () => {
    if (typeof state.modalOnConfirm === "function") state.modalOnConfirm();
  });
}

function initCollapsibleCards() {
  $$(".card").forEach(card => {
    const heading = card.querySelector(":scope > h2");
    if (!heading || card.dataset.collapsibleReady === "1") return;
    card.dataset.collapsibleReady = "1";
    const title = heading.textContent || "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-toggle";
    btn.innerHTML = `<h2>${esc(title)}</h2><span class="card-caret">&#9662;</span>`;
    heading.replaceWith(btn);
    const body = document.createElement("div");
    body.className = "card-body";
    while (btn.nextSibling) body.appendChild(btn.nextSibling);
    card.appendChild(body);
    btn.addEventListener("click", () => card.classList.toggle("collapsed"));
  });
}

function renderAll() {
  applyTheme();
  renderTopbar();
  renderAgenda();
  renderProductoAccordion();
  renderResumenPedido();
  renderCatalogo();
  renderClientes();
  renderAjustes();
  renderCompras();
  renderFab();
}

function setView(view) {
  state.view = view;
  $$(".view").forEach(v => v.classList.remove("active"));
  $("#view-" + view).classList.add("active");
  $$(".bottom-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $("#view-title").textContent = TITLES[view];
  closeTopMenu();
  closeModal();
  renderFab();
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

function renderFab() {
  const fab = $("#view-fab");
  if (state.view === "clientes") {
    fab.textContent = "+ Cliente";
    fab.classList.remove("hidden");
  } else if (state.view === "catalogo") {
    fab.textContent = "+ Producto";
    fab.classList.remove("hidden");
  } else {
    fab.classList.add("hidden");
  }
}

function onFabClick() {
  if (state.view === "clientes") openClienteModal();
  if (state.view === "catalogo") openProductoModal();
}

function toggleTopMenu() {
  const menu = $("#top-menu");
  const willOpen = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !willOpen);
  $("#overlay").classList.toggle("show", willOpen);
}

function closeTopMenu() {
  $("#top-menu").classList.add("hidden");
  if ($("#modal-shell").classList.contains("hidden")) $("#overlay").classList.remove("show");
}

function openModal({ title, bodyNode, confirmText = "Aceptar", cancelText = "Cancelar", hideCancel = false, onConfirm = null }) {
  $("#modal-title").textContent = title;
  const body = $("#modal-body");
  body.innerHTML = "";
  if (typeof bodyNode === "string") body.innerHTML = bodyNode;
  else if (bodyNode) body.appendChild(bodyNode);
  $("#modal-confirm").textContent = confirmText;
  $("#modal-cancel").textContent = cancelText;
  $("#modal-cancel").classList.toggle("hidden", hideCancel);
  state.modalOnConfirm = () => {
    const result = onConfirm ? onConfirm() : true;
    if (result !== false) closeModal();
  };
  $("#modal-shell").classList.remove("hidden");
  $("#overlay").classList.add("show");
}

function closeModal() {
  $("#modal-shell").classList.add("hidden");
  state.modalOnConfirm = null;
  if ($("#top-menu").classList.contains("hidden")) $("#overlay").classList.remove("show");
}

function openMessage(title, text) {
  openModal({ title, bodyNode: `<p>${esc(text)}</p>`, confirmText: "OK", hideCancel: true });
}

function renderTopbar() {
  $("#biz-name").textContent = db.config.business_name || "Pasteleria Fulano";
  const logo = $("#biz-logo");
  const fallback = $("#biz-logo-fallback");
  if (db.config.business_logo) {
    logo.src = db.config.business_logo;
    logo.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    logo.classList.add("hidden");
    fallback.classList.remove("hidden");
    fallback.textContent = initials(db.config.business_name || "Pasteleria Fulano");
  }
}

function renderAgenda() {
  const list = $("#agenda-list");
  const filtered = db.pedidos.filter(p => filterPedidoByDate(p.fecha));
  if (!filtered.length) {
    list.innerHTML = `<div class="card">Sin pedidos en este filtro.</div>`;
    return;
  }
  list.innerHTML = filtered.map(p => {
    const c = findCliente(p.id_cliente);
    const items = p.items.map(i => `${i.nombre} x${i.cantidad}`).join(", ");
    const cls = p.estado === "entregado" ? "agenda-card delivered" : "agenda-card";
    return `<div class="${cls}">
      <div><strong>${esc(c ? c.nombre : "Cliente sin nombre")}</strong> · ${esc(p.fecha)} ${esc(p.hora || "")}</div>
      <div>${esc(items)}</div>
      <div>${esc(p.despacho || "")}</div>
      <div class="mini-actions">
        <button class="mini-btn" onclick="abrirMapa('${p.lat}','${p.lon}')">Ver Mapa</button>
        <button class="mini-btn" onclick="marcarEntregado('${p.id}')">Marcar Entregado</button>
        <button class="mini-btn" onclick="llamarCliente('${c ? c.fono : ""}')">Llamar Cliente</button>
      </div>
    </div>`;
  }).join("");
}

function filterPedidoByDate(fecha) {
  const today = todayISO();
  if (state.agendaFilter === "hoy") return fecha === today;
  if (state.agendaFilter === "manana") return fecha === addDaysISO(today, 1);
  const from = $("#agenda-from").value;
  const to = $("#agenda-to").value;
  if (!from || !to) return true;
  return fecha >= from && fecha <= to;
}

function renderClienteSuggestions() {
  const q = $("#pedido-cliente").value.trim().toLowerCase();
  const box = $("#cliente-suggestions");
  if (!q) { box.innerHTML = ""; return; }
  const results = db.clientes.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 8);
  box.innerHTML = results.map(c => `<div class="suggestion-item" onclick="selectCliente('${c.id}')">${esc(c.nombre)} · ${esc(c.fono || "-")}</div>`).join("");
}

function selectCliente(id) {
  const c = findCliente(id);
  if (!c) return;
  state.selectedClientId = id;
  $("#pedido-cliente").value = c.nombre;
  $("#pedido-direccion").value = c.direccion || "";
  $("#pedido-lat").value = c.lat_frecuente ?? "";
  $("#pedido-lon").value = c.lon_frecuente ?? "";
  $("#cliente-suggestions").innerHTML = "";
}

function renderProductoAccordion() {
  const container = $("#producto-accordion");
  const categories = ["DULCE", "SALADO", "COCTELERIA / OTROS"];
  container.innerHTML = categories.map((cat, idx) => {
    const products = db.productos.filter(p => p.cat === cat);
    return `<div class="accordion ${idx === 0 ? "open" : ""}">
      <button class="accordion-head">${idx === 0 ? "▼" : "▶"} ${cat}</button>
      <div class="accordion-body">
        ${products.length ? products.map(renderProductRow).join("") : `<div class="card">Sin productos</div>`}
      </div>
    </div>`;
  }).join("");
  $$(".accordion-head").forEach(h => h.addEventListener("click", () => {
    const ac = h.parentElement;
    ac.classList.toggle("open");
    h.textContent = `${ac.classList.contains("open") ? "▼" : "▶"} ` + h.textContent.slice(2);
  }));
}

function renderProductRow(p) {
  const q = state.cart[p.id] || 0;
  const thumb = p.foto_b64 ? `<img class="product-thumb" src="${p.foto_b64}" alt="">` : `<div class="product-thumb"></div>`;
  return `<div class="product-row">
    ${thumb}
    <div>
      <div><strong>${esc(p.nombre)}</strong></div>
      <div>$ ${money(p.precio)} · ${esc(p.unidad_venta || "un")}</div>
    </div>
    <div class="qty-box">
      <button class="qty-btn" onclick="chgQty('${p.id}',-1)">-</button>
      <div class="qty-num">${q}</div>
      <button class="qty-btn" onclick="chgQty('${p.id}',1)">+</button>
    </div>
  </div>`;
}

function chgQty(productId, delta) {
  const current = state.cart[productId] || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) delete state.cart[productId];
  else state.cart[productId] = next;
  renderProductoAccordion();
  renderResumenPedido();
}

function setDiscountMode(mode) {
  state.discountMode = mode;
  $("#discount-mode-money").classList.toggle("active", mode === "money");
  $("#discount-mode-percent").classList.toggle("active", mode === "percent");
  renderResumenPedido();
}

function renderResumenPedido() {
  const rows = Object.entries(state.cart).map(([id, cantidad]) => {
    const p = db.productos.find(x => x.id === id);
    if (!p) return null;
    return { nombre: p.nombre, cantidad, subtotal: p.precio * cantidad };
  }).filter(Boolean);

  $("#resumen-items").innerHTML = rows.length
    ? rows.map(r => `<div class="agenda-card">${esc(r.nombre)} x${r.cantidad} · $ ${money(r.subtotal)}</div>`).join("")
    : `<div class="agenda-card">Aun no agregas productos.</div>`;

  const subtotal = rows.reduce((a, r) => a + r.subtotal, 0);
  const transporte = Number($("#transporte").value || 0);
  const dRaw = Number($("#descuento").value || 0);
  const descuento = state.discountMode === "percent" ? (subtotal * dRaw / 100) : dRaw;
  $("#total-pagar").textContent = `$ ${money(Math.max(0, subtotal + transporte - descuento))}`;
}

function confirmarPedido() {
  const fecha = $("#pedido-fecha").value;
  const hora = $("#pedido-hora").value;
  const despacho = $("#pedido-direccion").value.trim();
  const lat = Number($("#pedido-lat").value || 0);
  const lon = Number($("#pedido-lon").value || 0);
  const nombreIngresado = $("#pedido-cliente").value.trim();
  const items = Object.entries(state.cart).map(([id, cantidad]) => {
    const p = db.productos.find(x => x.id === id);
    return p ? { id_producto: p.id, nombre: p.nombre, precio: p.precio, cantidad } : null;
  }).filter(Boolean);

  if (!fecha || !hora || !nombreIngresado || items.length === 0) {
    openMessage("Faltan datos", "Completa cliente, fecha, hora y al menos un producto.");
    return;
  }

  let clienteId = state.selectedClientId;
  if (!clienteId) {
    const same = db.clientes.find(c => c.nombre.toLowerCase() === nombreIngresado.toLowerCase());
    if (same) clienteId = same.id;
  }
  if (!clienteId) {
    const newC = {
      id: uid(),
      nombre: nombreIngresado,
      fono: "",
      direccion: despacho,
      lat_frecuente: lat || null,
      lon_frecuente: lon || null
    };
    db.clientes.push(newC);
    clienteId = newC.id;
  }

  db.pedidos.push({ id: uid(), id_cliente: clienteId, fecha, hora, items, lat, lon, despacho, estado: "pendiente" });
  saveDB();
  resetPedidoForm();
  renderAll();
  setView("agenda");
  openMessage("Pedido creado", "Pedido agendado correctamente.");
}

function resetPedidoForm() {
  state.selectedClientId = null;
  state.cart = {};
  $("#pedido-cliente").value = "";
  $("#pedido-fecha").value = "";
  $("#pedido-hora").value = "";
  $("#pedido-direccion").value = "";
  $("#pedido-lat").value = "";
  $("#pedido-lon").value = "";
  $("#transporte").value = "";
  $("#descuento").value = "";
  setDiscountMode("money");
}

function capturarGPS() {
  if (!navigator.geolocation) return openMessage("GPS no disponible", "Este navegador no permite geolocalizacion.");
  navigator.geolocation.getCurrentPosition(
    pos => {
      $("#pedido-lat").value = pos.coords.latitude.toFixed(6);
      $("#pedido-lon").value = pos.coords.longitude.toFixed(6);
    },
    () => openMessage("GPS", "No se pudo capturar la ubicacion actual.")
  );
}

function openProductoModal(editId = null) {
  const node = $("#tpl-producto-form").content.cloneNode(true);
  const wrap = document.createElement("div");
  wrap.appendChild(node);
  state.editProductId = editId;
  state.recipeDraft = [];
  state.photoDraft = "";

  openModal({
    title: editId ? "Editar producto" : "Nuevo producto",
    bodyNode: wrap,
    confirmText: editId ? "Guardar cambios" : "Guardar producto",
    onConfirm: guardarProductoDesdeModal
  });

  bindProductoModalEvents();
  if (editId) fillProductoModal(editId);
  else renderRecipeDraft();
}

function bindProductoModalEvents() {
  $("#prod-foto").addEventListener("change", handleFotoProducto);
  $("#mat-search").addEventListener("input", renderMaterialSuggestions);
  $("#nuevo-material").addEventListener("click", addMaterialDesdeInput);
}

function fillProductoModal(id) {
  const p = db.productos.find(x => x.id === id);
  if (!p) return;
  $("#prod-nombre").value = p.nombre;
  $("#prod-cat").value = p.cat;
  $("#prod-precio").value = p.precio;
  $("#prod-unidad").value = p.unidad_venta || "un";
  state.photoDraft = p.foto_b64 || "";
  $("#foto-preview").innerHTML = state.photoDraft ? `<img src="${state.photoDraft}" alt="preview">` : "Sin foto";
  state.recipeDraft = (p.receta || []).map(r => ({ ...r, costo_unit: Number(r.costo_unit || 0) }));
  renderRecipeDraft();
}

async function handleFotoProducto(e) {
  const file = e.target.files[0];
  if (!file) return;
  state.photoDraft = await compressToBase64(file, 240);
  $("#foto-preview").innerHTML = `<img src="${state.photoDraft}" alt="preview">`;
}

function renderMaterialSuggestions() {
  const input = $("#mat-search");
  const box = $("#mat-suggestions");
  if (!input || !box) return;
  const q = input.value.trim().toLowerCase();
  if (!q) { box.innerHTML = ""; return; }
  const hits = db.materiales_maestro.filter(m => m.toLowerCase().includes(q)).slice(0, 8);
  box.innerHTML = hits.map(m => `<div class="suggestion-item" onclick="addMaterial('${escAttr(m)}')">${esc(m)}</div>`).join("");
}

function addMaterialDesdeInput() {
  const inp = $("#mat-search");
  if (!inp) return;
  const m = inp.value.trim();
  if (!m) return;
  if (!db.materiales_maestro.includes(m)) db.materiales_maestro.push(m);
  addMaterial(m);
  saveDB();
}

function addMaterial(material) {
  const exists = state.recipeDraft.find(r => r.material.toLowerCase() === material.toLowerCase());
  if (exists) return;
  state.recipeDraft.push({ material, cantidad: 1, unidad: "un", costo_unit: 0 });
  if ($("#mat-search")) $("#mat-search").value = "";
  if ($("#mat-suggestions")) $("#mat-suggestions").innerHTML = "";
  renderRecipeDraft();
}

function renderRecipeDraft() {
  const table = $("#tabla-receta");
  if (!table) return;
  if (!state.recipeDraft.length) {
    table.innerHTML = `<div class="agenda-card">Sin materiales en receta.</div>`;
    $("#receta-total").textContent = "Costo receta: $ 0";
    return;
  }
  table.innerHTML = state.recipeDraft.map((r, i) => `
    <div class="material-row">
      <div>${esc(r.material)}</div>
      <input type="number" min="0" step="any" value="${r.cantidad}" onchange="updReceta(${i},'cantidad',this.value)">
      <select onchange="updReceta(${i},'unidad',this.value)">
        ${UNIDADES.map(u => `<option ${u === r.unidad ? "selected" : ""}>${u}</option>`).join("")}
      </select>
      <input type="number" min="0" step="1" value="${r.costo_unit || 0}" onchange="updReceta(${i},'costo_unit',this.value)">
      <button class="btn" onclick="delReceta(${i})">X</button>
    </div>
  `).join("");
  const total = state.recipeDraft.reduce((acc, r) => acc + (Number(r.cantidad || 0) * Number(r.costo_unit || 0)), 0);
  $("#receta-total").textContent = `Costo receta: $ ${money(total)}`;
}

function updReceta(i, key, value) {
  if (!state.recipeDraft[i]) return;
  state.recipeDraft[i][key] = (key === "cantidad" || key === "costo_unit") ? Number(value || 0) : value;
  renderRecipeDraft();
}

function delReceta(i) {
  state.recipeDraft.splice(i, 1);
  renderRecipeDraft();
}

function guardarProductoDesdeModal() {
  const nombre = $("#prod-nombre").value.trim();
  const cat = $("#prod-cat").value;
  const precio = Number($("#prod-precio").value || 0);
  const unidad = $("#prod-unidad").value;
  if (!nombre || precio <= 0 || state.recipeDraft.length === 0) {
    openMessage("Producto incompleto", "Completa nombre, precio y receta.");
    return false;
  }

  const payload = {
    id: state.editProductId || uid(),
    nombre, cat, precio,
    unidad_venta: unidad,
    foto_b64: state.photoDraft || "",
    receta: state.recipeDraft.map(r => ({ ...r }))
  };

  if (state.editProductId) {
    const idx = db.productos.findIndex(p => p.id === state.editProductId);
    if (idx >= 0) db.productos[idx] = payload;
  } else {
    db.productos.push(payload);
  }
  saveDB();
  renderCatalogo();
  return true;
}

function renderCatalogo() {
  const list = $("#catalogo-lista");
  if (!db.productos.length) {
    list.innerHTML = `<div class="agenda-card">Sin productos.</div>`;
    return;
  }
  list.innerHTML = db.productos.map(p => `
    <div class="catalogo-card">
      <div><strong>${esc(p.nombre)}</strong> · ${esc(p.cat)}</div>
      <div class="catalog-meta">Venta: $ ${money(p.precio)} / ${esc(p.unidad_venta || "un")} · Costo: $ ${money(calcProductCost(p))}</div>
      <div class="catalog-meta">${p.receta.map(r => `${esc(r.material)} (${r.cantidad} ${r.unidad})`).join(", ")}</div>
      <div class="catalog-actions">
        <button class="mini-btn" onclick="openProductoModal('${p.id}')">Editar</button>
        <button class="mini-btn" onclick="deleteProducto('${p.id}')">Eliminar</button>
      </div>
    </div>
  `).join("");
}

function deleteProducto(id) {
  const p = db.productos.find(x => x.id === id);
  if (!p) return;
  openModal({
    title: "Eliminar producto",
    bodyNode: `<p>Eliminar "${esc(p.nombre)}"?</p>`,
    confirmText: "Eliminar",
    onConfirm: () => {
      db.productos = db.productos.filter(x => x.id !== id);
      saveDB();
      renderCatalogo();
    }
  });
}

function openClienteModal(id = null) {
  const node = $("#tpl-cliente-form").content.cloneNode(true);
  const wrap = document.createElement("div");
  wrap.appendChild(node);
  openModal({
    title: id ? "Editar cliente" : "Nuevo cliente",
    bodyNode: wrap,
    confirmText: id ? "Guardar cambios" : "Guardar cliente",
    onConfirm: () => guardarClienteDesdeModal(id)
  });
  if (id) {
    const c = findCliente(id);
    if (c) {
      $("#cli-nombre").value = c.nombre || "";
      $("#cli-fono").value = c.fono || "";
      $("#cli-dir").value = c.direccion || "";
      $("#cli-lat").value = c.lat_frecuente ?? "";
      $("#cli-lon").value = c.lon_frecuente ?? "";
    }
  }
}

function guardarClienteDesdeModal(id = null) {
  const nombre = $("#cli-nombre").value.trim();
  const fono = $("#cli-fono").value.trim();
  const direccion = $("#cli-dir").value.trim();
  const lat = Number($("#cli-lat").value || 0);
  const lon = Number($("#cli-lon").value || 0);
  if (!nombre) {
    openMessage("Cliente incompleto", "Nombre requerido.");
    return false;
  }
  if (id) {
    const c = findCliente(id);
    if (!c) return;
    c.nombre = nombre;
    c.fono = fono;
    c.direccion = direccion;
    c.lat_frecuente = lat || null;
    c.lon_frecuente = lon || null;
  } else {
    db.clientes.push({ id: uid(), nombre, fono, direccion, lat_frecuente: lat || null, lon_frecuente: lon || null });
  }
  saveDB();
  renderClientes();
  return true;
}

function renderClientes() {
  const q = ($("#buscar-cliente").value || "").trim().toLowerCase();
  const list = $("#clientes-lista");
  const clients = db.clientes.filter(c =>
    c.nombre.toLowerCase().includes(q) ||
    (c.fono || "").toLowerCase().includes(q) ||
    (c.direccion || "").toLowerCase().includes(q)
  );
  if (!clients.length) {
    list.innerHTML = `<div class="agenda-card">Sin resultados.</div>`;
    return;
  }
  list.innerHTML = clients.map(c => `
    <div class="cliente-card">
      <div><strong>${esc(c.nombre)}</strong> · ${esc(c.fono || "-")}</div>
      <div>${esc(c.direccion || "-")}</div>
      <div>Lat/Lon: ${c.lat_frecuente ?? "-"} / ${c.lon_frecuente ?? "-"}</div>
      <div class="mini-actions">
        <button class="mini-btn" onclick="verHistorial('${c.id}')">Ver Historial</button>
        <button class="mini-btn" onclick="openClienteModal('${c.id}')">Editar Datos</button>
      </div>
    </div>
  `).join("");
}

function verHistorial(id) {
  const c = findCliente(id);
  const pedidos = db.pedidos.filter(p => p.id_cliente === id);
  const lines = pedidos.map(p => `<li>${esc(p.fecha)} ${esc(p.hora)} · ${esc(p.items.map(i => `${i.nombre}x${i.cantidad}`).join(", "))}</li>`).join("");
  openModal({
    title: `Historial: ${c ? c.nombre : "Cliente"}`,
    bodyNode: lines ? `<ul>${lines}</ul>` : `<p>Sin historial.</p>`,
    confirmText: "Cerrar",
    hideCancel: true
  });
}

function generarConsolidado() {
  const from = $("#compras-from").value;
  const to = $("#compras-to").value;
  const filtered = db.pedidos.filter(p => (!from || !to) ? true : (p.fecha >= from && p.fecha <= to));
  state.includedPedidos = filtered;
  $("#pedidos-incluidos").innerHTML = filtered.length
    ? filtered.map(p => {
      const c = findCliente(p.id_cliente);
      return `<div class="agenda-card">${esc(p.fecha)} · ${esc(c ? c.nombre : "Cliente")}</div>`;
    }).join("")
    : `<div class="agenda-card">Sin pedidos en rango.</div>`;

  const acc = {};
  filtered.forEach(p => p.items.forEach(item => {
    const prod = db.productos.find(x => x.id === item.id_producto);
    if (!prod) return;
    (prod.receta || []).forEach(r => {
      const key = `${r.material}||${r.unidad}`;
      acc[key] = (acc[key] || 0) + Number(r.cantidad || 0) * item.cantidad;
    });
  }));

  state.consolidado = Object.entries(acc).map(([k, cantidad]) => {
    const [material, unidad] = k.split("||");
    return { material, unidad, cantidad };
  }).sort((a, b) => a.material.localeCompare(b.material));
  renderCompras();
}

function renderCompras() {
  const box = $("#consolidado");
  if (!state.consolidado || !state.consolidado.length) {
    box.innerHTML = `<div class="agenda-card">Genera un consolidado para ver resultados.</div>`;
    return;
  }
  box.innerHTML = state.consolidado.map(r => `<div class="agenda-card">${esc(r.material)}: <strong>${fmtNumber(r.cantidad)} ${esc(r.unidad)}</strong></div>`).join("");
}

function copiarWhatsApp() {
  if (!state.consolidado || !state.consolidado.length) return openMessage("Sin datos", "Primero genera un consolidado.");
  const f = $("#compras-from").value || "-";
  const t = $("#compras-to").value || "-";
  const resumenClientes = [...new Set(state.includedPedidos.map(p => (findCliente(p.id_cliente)?.nombre || "Cliente")))].join(", ");
  const lines = [
    "*LISTA DE PRODUCCION*",
    `*Entrega:* ${f} a ${t}`,
    `*Pedidos:* ${resumenClientes || "-"}`,
    "--------------------------",
    ...state.consolidado.map(r => `• ${r.material}: ${fmtNumber(r.cantidad)} ${r.unidad}`),
    "--------------------------"
  ];
  navigator.clipboard.writeText(lines.join("\n"));
  openMessage("Copiado", "Texto copiado para WhatsApp.");
}

function renderAjustes() {
  $("#cfg-repo").value = db.config.github_repo || "";
  $("#cfg-token").value = db.config.github_token || "";
  $("#cfg-theme").value = db.config.theme === "verde" ? "verde" : "azul";
  $("#cfg-backup-path").value = db.config.backup_path || "";
  $("#cfg-biz-name").value = db.config.business_name || "Pasteleria Fulano";
}

function saveConfigFromUI() {
  db.config.github_repo = $("#cfg-repo").value.trim();
  db.config.github_token = $("#cfg-token").value.trim();
  db.config.theme = $("#cfg-theme").value === "verde" ? "verde" : "azul";
  db.config.backup_path = $("#cfg-backup-path").value.trim();
  db.config.business_name = $("#cfg-biz-name").value.trim() || "Pasteleria Fulano";
  saveDB();
  renderTopbar();
  applyTheme();
}

async function handleBizLogo(e) {
  const file = e.target.files[0];
  if (!file) return;
  db.config.business_logo = await fileToDataUrl(file);
  saveDB();
  renderTopbar();
}

function applyTheme() {
  const t = db.config.theme === "verde" ? "verde" : "azul";
  const root = document.documentElement;
  const customPrimary = db.config.primary_color || "#e58ba6";
  let palette;
  if (t === "azul") {
    palette = { bg: "#f4faff", surface: "#ecf7ff", surfaceSoft: "#bfe6ff", surfaceDeep: "#9fd5ef", line: "#14222d", text: "#0b161f", textSoft: "#172733", textMuted: "#324b5f", primary: customPrimary };
  } else if (t === "verde") {
    palette = { bg: "#f7fff5", surface: "#f0ffe9", surfaceSoft: "#d0f0c7", surfaceDeep: "#b7e3ab", line: "#1a2b1a", text: "#0d170d", textSoft: "#1d2f1d", textMuted: "#3e5a3f", primary: customPrimary };
  }
  root.style.setProperty("--bg", palette.bg);
  root.style.setProperty("--surface", palette.surface);
  root.style.setProperty("--surface-soft", palette.surfaceSoft);
  root.style.setProperty("--surface-deep", palette.surfaceDeep);
  root.style.setProperty("--line", palette.line);
  root.style.setProperty("--text", palette.text);
  root.style.setProperty("--text-soft", palette.textSoft);
  root.style.setProperty("--text-muted", palette.textMuted);
  root.style.setProperty("--primary", palette.primary);
  root.style.setProperty("--primary-soft", hexToAlpha(palette.primary, 0.2));
  updateThemeColorMeta(palette.bg);
}

function forzarSync() {
  db.config.sync_state = "syncing";
  saveDB();
  setTimeout(() => {
    db.config.sync_state = "ok";
    saveDB();
  }, 900);
}

function exportarJSON() {
  const payload = {
    "productos.json": db.productos,
    "pedidos.json": db.pedidos,
    "clientes.json": db.clientes,
    "materiales_maestro.json": db.materiales_maestro,
    "config.json": db.config
  };
  downloadJSON(`backup_pasteleria_${todayISO()}.json`, payload);
}

function importarJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed["productos.json"]) throw new Error("Formato invalido");
      db.productos = parsed["productos.json"] || [];
      db.pedidos = parsed["pedidos.json"] || [];
      db.clientes = parsed["clientes.json"] || [];
      db.materiales_maestro = parsed["materiales_maestro.json"] || [];
      db.config = { ...db.config, ...(parsed["config.json"] || {}) };
      saveDB();
      renderAll();
      openMessage("Importacion", "Backup importado correctamente.");
    } catch {
      openMessage("Importacion", "No se pudo importar el archivo.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function abrirMapa(lat, lon) {
  if (!lat && !lon) return openMessage("Sin coordenadas", "Pedido sin coordenadas.");
  window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
}

function llamarCliente(fono) {
  if (!fono) return openMessage("Telefono", "Cliente sin telefono.");
  window.location.href = `tel:${fono}`;
}

function marcarEntregado(id) {
  const p = db.pedidos.find(x => x.id === id);
  if (!p) return;
  p.estado = "entregado";
  saveDB();
  renderAgenda();
}

function findCliente(id) {
  return db.clientes.find(c => c.id === id);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function downloadJSON(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function money(v) {
  return Number(v || 0).toLocaleString("es-CL");
}

function fmtNumber(v) {
  return Number(v || 0).toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function calcProductCost(product) {
  return (product.receta || []).reduce((acc, r) => acc + Number(r.cantidad || 0) * Number(r.costo_unit || 0), 0);
}

function updateThemeColorMeta(color) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", color);
}

function hexToAlpha(hex, alpha) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(229,139,166,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function initials(name) {
  const clean = String(name || "").trim();
  if (!clean) return "PF";
  return clean.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function escAttr(s) {
  return esc(s).replace(/"/g, "&quot;");
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

async function compressToBase64(file, maxSize) {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
