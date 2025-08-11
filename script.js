// Elementos del DOM (sección modificada)
const verticalDivider = document.getElementById('verticalDivider');
const leftSection = document.getElementById('leftSection');
const rightSection = document.getElementById('rightSection');
const container = document.querySelector('.main-container');
const attributeStatsDiv = document.getElementById("attributeStats");
const output = document.getElementById("output");
const xlsxFileInput = document.getElementById("xlsxFile");
const csvFileInput = document.getElementById("csvFile");
const categoryDataFileInput = document.getElementById("categoryDataFile");
const fileInfoDiv = document.getElementById("fileInfo");
const applyOrderBtn = document.getElementById("applyOrderBtn");
const applyCatOrderBtn = document.getElementById("applyCatOrderBtn");
const loadWebOrderBtn = document.getElementById("loadWebOrderBtn");
const clearOrderBtn = document.getElementById("clearOrderBtn");
const clearCatOrderBtn = document.getElementById("clearCatOrderBtn");
const toggleEmptyBtn = document.getElementById("toggleEmptyBtn");
const clearChecksBtn = document.getElementById("clearChecksBtn");
const webFiltersBtn = document.getElementById("webFiltersBtn");
const clearFilterInputsBtn = document.getElementById("clearFilterInputs");
const loadDefaultFiltersBtn = document.getElementById("loadDefaultFilters");
const combinedFileInput = document.getElementById("combinedFile");


// Variables de estado
let filteredItems = [];
let editedCells = {};
let objectData = [];
let categoryData = [];
let currentStatClickFilter = null;
let isVerticalDragging = false;
let defaultCatAttributesOrder = {};
let startX, startLeftWidth;
let currentCmsIg = null;
let currentFilter = {
  attribute: null,
  type: null
};
let showEmptyAttributes = false;
let defaultAttributesOrder = {};
let selectedGroups = new Set();
let filteredItemsOriginal = [];
let moveInfoUndoBackup = {};
let objectDataOriginal = [];
let groupDestHighlightAttr = {};
// Copia de seguridad por grupo para "Deshacer mover info"
let moveInfoBackups = {}; // { [groupId]: [array de copias de objetos] }

let attributeFiltersState = {};
let attributeFilterInputs = {};
let statsOriginalOrder = null; // Variable global o fuera de la función
let currentFilteredItems = [];
let originalExcelSheets = {}; // { sheetName: { header: [], data: [] } }
let originalCsvHeader = [];
let moveInfoModalState = { groupId: null, groupItems: [], attributes: [] };
let groupSortModalState = { groupId: null, groupItems: [], orderedAttrs: [] };
let separateGroupModalState = { groupId: null, groupItems: [], selectedAttr: null, selectedValue: null };
let originalCsvData = [];
let activeFilters = {};
let defaultFilterAttributes = new Set();
const forcedFilterAttributes = new Set(['marca', 'shop_by']);
let addStatsModalState = { available: [], selected: [] };
const mergedGroupsMap = new Map();
const mergedGroups = new Map();
let groupOrderMap = new Map(); // clave: groupId, valor: array de SKUs ordenados
let useCatOrder = false;
let currentViewState = {
  catTables: false,
  webOrder: false,
  catOrder: false,
  showEmpty: false
};




// Configuración
const forcedColumns = ["marca", "item_code"];
const priorityStatsAttributes = ["titulo", "marca", "orden_tabla", "shop_by"];
const excludedAttributes = new Set([
  "product.type", "url_key", "product.attribute_set", "product.websites",
  "product.required_options", "stock.manage_stock", "stock.qty", "Price", "Status",
  "Tax_class_id", "Visibility", "name", "category.name", "leaf_name_filter",
  "image", "small_image", "thumbnail", "pdp_display_attribute",
  "pdp_description_attribute", "pdp_short_description_attribute", "icon_order",
  "orden_cms", "aplicaciones", "incluye", 
    "seccion", "ventajas", "brand_logo",
  "categoria", "item_codeunspcweb_search_term",
  "beneficio_principal", "catalog_cover_image", "item_code", "titulo_web", "paginadecatalogo",
  "unspc", "description", "especificaciones", "web_search_term", "product_ranking",
  "Weight", "icono_nuevo"
]);
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.14.0/Sortable.min.js';
document.head.appendChild(script);

// Event Listeners (sección modificada)
document.addEventListener('DOMContentLoaded', function() {
  injectMoveInfoModal();
  injectGroupSortModal();
  injectSeparateGroupModal();
  injectAddStatsAttributeModal();

    const mergeVisibleHeaderBtn = document.getElementById('mergeVisibleGroupsBtn');
  if (mergeVisibleHeaderBtn) {
    mergeVisibleHeaderBtn.addEventListener('click', mergeVisibleItemsOnly);
  }

  verticalDivider.addEventListener('mousedown', initVerticalDrag);
  document.getElementById('horizontalDivider').addEventListener('mousedown', (e) => {
    initHorizontalDrag(e, 'box1', 'box3');
  });

  const mergeHeaderBtn = document.getElementById('mergeSelectedGroupsBtn');
  if (mergeHeaderBtn) {
    mergeHeaderBtn.addEventListener('click', mergeSelectedGroups);
  }

    // Nuevo: botón en el header para aplicar catálogo actual
  const applyCatTablesHeaderBtn = document.getElementById('applyCatTablesHeaderBtn');
  if (applyCatTablesHeaderBtn) {
    applyCatTablesHeaderBtn.addEventListener('click', function() {
      if (typeof applyCategoryTables === 'function') applyCategoryTables();
    });
  }

  //xlsxFileInput.addEventListener("change", handleXLSX);
  csvFileInput.addEventListener("change", handleCSV);
  //categoryDataFileInput.addEventListener("change", handleCategoryData);
  document.getElementById('combinedFile').addEventListener('change', handleCombinedExcel);
  combinedFileInput.addEventListener("change", handleCombinedExcel);

  addMergeStyles();

  const applyCatTablesBtn = document.getElementById("applyCatTablesBtn");

  document.getElementById('exportWebAttributesBtn').addEventListener('click', exportWebAttributesToExcel);

  // SOLO ESTE MANEJADOR para exportar TODO. Elimina cualquier otro para este botón.
  document.getElementById('exportStatsExcelBtn').addEventListener('click', exportAllDataCustom);

  document.getElementById('avanceExcelFile').addEventListener('change', handleAvanceExcel);
  document.getElementById('avanceCsvFile').addEventListener('change', handleAvanceCSV);

  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.style.color = 'transparent';
    input.style.width = '120px';

    input.addEventListener('change', function() {
      if(this.files.length > 0) {
        this.style.color = 'inherit';
      } else {
        this.style.color = 'transparent';
      }
    });
  });
});

// Helper para obtener el CMS IG principal y sanitizar para nombre de archivo
function getCmsIg() {
  let cmsIg = "";
  for (const item of filteredItems) {
    if (item["CMS IG"]) {
      cmsIg = item["CMS IG"];
      break;
    }
  }
  // Sanitizar para nombre de archivo
  return String(cmsIg).replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").trim();
}

// 1. EXPORTAR SOLO "Atributos"
document.getElementById('exportAtributosBtn').addEventListener('click', function() {
  const cmsIg = getCmsIg();

  // ============== Hoja "Atributos" ==============
  const cmsSet = new Set();
  filteredItems.forEach(item => {
    if (item["CMS IG"]) cmsSet.add(item["CMS IG"]);
  });
  const attributes = [];
  document.querySelectorAll('.filter-order-input').forEach(input => {
    const attr = input.getAttribute('data-attribute');
    if (attr) attributes.push(attr);
  });
  const data = [];
  cmsSet.forEach(cmsIgVal => {
    attributes.forEach(attr => {
      const filtroInput = document.querySelector(`.filter-order-input[data-attribute="${attr}"]`);
      const catInput = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
      const webInput = document.querySelector(`.order-input[data-attribute="${attr}"]`);
      data.push({
        "CMS IG": cmsIgVal,          
        "Atributo": attr,
        "Filtros": filtroInput ? (filtroInput.value || "") : "",
        "Web": webInput ? (webInput.value || "") : "",
        "Cat": catInput ? (catInput.value || "") : ""
      });
    });
  });

  const atributosCols = ["CMS IG", "Atributo", "Filtros", "Web", "Cat"];
  const wsAtributos = XLSX.utils.json_to_sheet(data.length ? data : [{}], { header: atributosCols });
  XLSX.utils.sheet_add_aoa(wsAtributos, [atributosCols], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsAtributos, "Atributos");
  XLSX.writeFile(wb, `${cmsIg}_Atributos.xlsx`);
});

// 2. EXPORTAR SOLO "Orden Grupos"
document.getElementById('exportOrdenGruposBtn').addEventListener('click', function() {
  const cmsIg = getCmsIg();

  // ============== Hoja "Orden Grupos" ==============
  const originalOrderByGroup = {};
  filteredItems.forEach(item => {
    const igidStr = String(item["IG ID"]);
    if (!originalOrderByGroup[igidStr]) originalOrderByGroup[igidStr] = [];
    originalOrderByGroup[igidStr].push(item.SKU);
  });
  const ordenExportData = [];
  if (typeof groupOrderMap.entries === "function") {
    for (const [igid, currentOrder] of groupOrderMap.entries()) {
      const igidStr = String(igid);
      if (igidStr.startsWith('merged-')) continue;
      if (!Array.isArray(currentOrder)) continue;
      const originalOrder = originalOrderByGroup[igidStr] || [];
      const changed = originalOrder.length === currentOrder.length &&
        originalOrder.some((sku, idx) => sku !== currentOrder[idx]);
      if (!changed) continue;
let groupObj = objectData.find(o => String(o.SKU) === igidStr);
if (!groupObj) {
  groupObj = objectData.find(o => String(o["IG ID"]) === igidStr);
}
      const titulo = groupObj && groupObj.name ? groupObj.name : "";
      currentOrder.forEach(sku => {
        ordenExportData.push({
          "IG ID": igidStr,
          "titulo": titulo,
          "Sku": sku
        });
      });
    }
  }
  const ordenCols = ["IG ID", "titulo", "Sku"];
  const wsOrden = XLSX.utils.json_to_sheet(ordenExportData.length ? ordenExportData : [{}], { header: ordenCols });
  XLSX.utils.sheet_add_aoa(wsOrden, [ordenCols], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsOrden, "Orden Grupos");
  XLSX.writeFile(wb, `${cmsIg}_OrdenGrupos.xlsx`);
});

// 3. EXPORTAR SOLO "Merged"
document.getElementById('exportMergedBtn').addEventListener('click', function() {
  const cmsIg = getCmsIg();

  // ============== Hoja "Merged" ==============
  const mergedExportData = [];
  if (typeof groupOrderMap.entries === "function") {
    for (const [igid, currentOrder] of groupOrderMap.entries()) {
      const igidStr = String(igid);
let groupObj = objectData.find(o => String(o.SKU) === igidStr);
if (!groupObj) {
  groupObj = objectData.find(o => String(o["IG ID"]) === igidStr);
}      const hasItems = filteredItems.some(item => String(item["IG ID"]) === igidStr);
      if (!igidStr.startsWith('merged-') || !groupObj || !hasItems) continue;
      if (!Array.isArray(currentOrder)) continue;
      let titulo = "";
      const titleInput = document.querySelector(`.group-container[data-group-id="${igidStr}"] .group-title-input`);
      if (titleInput && titleInput.value) {
        titulo = titleInput.value;
      } else {
        titulo = groupObj.name || "";
      }
      let detalles = "";
      const detailsInput = document.querySelector(`.group-container[data-group-id="${igidStr}"] .merged-group-textarea`);
      if (detailsInput && detailsInput.value) {
        detalles = detailsInput.value.trim();
      } else {
        detalles =
          groupObj.details ||
          groupObj.detalles ||
          groupObj.ventajas ||
          groupObj.descripcion ||
          "";
      }
      currentOrder.forEach(sku => {
        const item = filteredItems.find(i => i.SKU === sku && String(i["IG ID"]) === igidStr);
        const originalIGID = item?.__originalIGID || item?.["Original IG ID"] || "";
        mergedExportData.push({
          "ID": igidStr.replace('merged-', ''),
          "IG ID Original": originalIGID,
          "titulo": titulo,
          "Detalles": detalles,
          "Sku": sku
        });
      });
    }
  }
  const mergedCols = ["ID", "IG ID Original", "titulo", "Detalles", "Sku"];
  const wsMerged = XLSX.utils.json_to_sheet(mergedExportData.length ? mergedExportData : [{}], { header: mergedCols });
  XLSX.utils.sheet_add_aoa(wsMerged, [mergedCols], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMerged, "Merged");
  XLSX.writeFile(wb, `${cmsIg}_Merged.xlsx`);
});

// 4. EXPORTAR SOLO "Valores Nuevos"
document.getElementById('exportValoresNuevosBtn').addEventListener('click', function() {
  const cmsIg = getCmsIg();

  // ============== Hoja "Valores Nuevos" ==============
  const originalMap = Object.fromEntries(objectDataOriginal.map(o => [o.SKU, o]));
  const allAttrsChanged = new Set();
  const changedByUser = {};

  objectData.forEach(obj => {
    const sku = obj.SKU;
    const original = originalMap[sku] || {};
    const changes = {};

    Object.keys(obj).forEach(attr => {
      if (attr === "SKU" || excludedAttributes.has(attr)) return;
      const oldVal = (original[attr] || "").toString().trim();
      const newVal = (obj[attr] || "").toString().trim();

      if (oldVal !== newVal) {
        changes[attr] = (oldVal && !newVal) ? '<NULL>' : newVal;
        allAttrsChanged.add(attr);
      }
    });

    if (Object.keys(changes).length > 0) {
      changedByUser[sku] = changes;
    }
  });

  const validKeys = new Set(
    Object.keys(objectDataOriginal[0] || {}).filter(k => k !== "SKU" && !excludedAttributes.has(k))
  );
  const safeAttrsChanged = Array.from(allAttrsChanged).filter(attr => validKeys.has(attr));
  const valoresCols = ["SKU", ...safeAttrsChanged];

  const valoresExport = [];
  Object.entries(changedByUser).forEach(([sku, attrs]) => {
    const row = { "SKU": sku };
    valoresCols.slice(1).forEach(attr => {
      row[attr] = attrs[attr] || "";
    });
    valoresExport.push(row);
  });

  const wsValores = XLSX.utils.json_to_sheet(
    valoresExport.length ? valoresExport : [{}],
    { header: valoresCols.length > 1 ? valoresCols : ["SKU"] }
  );
  XLSX.utils.sheet_add_aoa(wsValores, [valoresCols.length > 1 ? valoresCols : ["SKU"]], { origin: "A1" });

  // ============== Hoja "Valores Nuevos Grupos" ==============
  const valoresNuevosGrupos = [];
  const grupoCols = ["IG ID", "titulo", "detalles"];

  groupOrderMap.forEach((currentOrder, igid) => {
    const igidStr = String(igid);
let groupObj = objectData.find(o => String(o.SKU) === igidStr);
if (!groupObj) {
  groupObj = objectData.find(o => String(o["IG ID"]) === igidStr);
}    const originalObj = (window.originalGroupData || []).find(o => String(o.SKU) === igidStr) || {};

    // Valores actuales
    const titulo = (groupObj && groupObj.name ? groupObj.name : "").trim();
    const detalles = (groupObj && groupObj.details ? groupObj.details : "").trim();

    // Valores originales
    const originalTitulo = (originalObj && originalObj.name ? originalObj.name : "").trim();
    const originalDetalles = (originalObj && originalObj.details ? originalObj.details : "").trim();

    // Solo exporta si cambió alguno
    if (titulo !== originalTitulo || detalles !== originalDetalles) {
      valoresNuevosGrupos.push({
        "IG ID": igidStr,
        "titulo": titulo,
        "detalles": detalles
      });
    }
  });

  const wsValoresNuevosGrupos = XLSX.utils.json_to_sheet(
    valoresNuevosGrupos.length ? valoresNuevosGrupos : [{}],
    { header: grupoCols }
  );
  XLSX.utils.sheet_add_aoa(wsValoresNuevosGrupos, [grupoCols], { origin: "A1" });

  // ========== Construcción y descarga del archivo ==========
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsValores, "Valores Nuevos");
  XLSX.utils.book_append_sheet(wb, wsValoresNuevosGrupos, "Valores Nuevos Grupos");
  XLSX.writeFile(wb, `${cmsIg}_ValoresNuevos.xlsx`);
});


function clearAllChecks() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
}

injectMoveInfoModal();
injectGroupSortModal();
injectSeparateGroupModal();

// Esta función regresa el rightContainer con BOTONES y BADGES para el header del grupo
function createGroupHeaderRight({
  groupIdStr, groupItems, skuToObject, isMergedGroup, groupDiv
}) {
  const rightContainer = document.createElement("div");
  rightContainer.className = "group-header-right";

  // === Primera línea: botones y acciones ===
  const topDiv = document.createElement("div");
  topDiv.className = "group-header-right-top";

  // 1. Botón Mover info
  const moveBtn = document.createElement("button");
  moveBtn.className = "btn btn-sm btn-outline-secondary move-info-btn";
  moveBtn.textContent = "Mover info";
  moveBtn.onclick = function () {
      console.log('Mover info click', groupIdStr);

    let attributeList = [];
    const table = groupDiv.querySelector('.attribute-table');
    if (table) {
      attributeList = Array.from(table.querySelectorAll('thead th'))
        .map(th => th.textContent.trim())
        .filter(header => header && !["×", "Drag", "Origen", ""].includes(header));
    } else if (window.filteredItems && window.filteredItems.length > 0) {
      const item = groupItems[0];
      attributeList = Object.keys(item || {});
    }
    openMoveInfoModal(groupIdStr, groupItems, attributeList);
  };
  topDiv.appendChild(moveBtn);

  // 2. Botón Editar
  const editAllBtn = document.createElement("button");
  editAllBtn.textContent = "Editar";
  editAllBtn.className = "btn btn-sm btn-outline-primary";
  editAllBtn.dataset.editing = "false";
 editAllBtn.onclick = function() {
  const titleContainer = groupDiv.querySelector('.group-title-container');
  const groupTitle = titleContainer && titleContainer.querySelector('.group-title');
  const existingInput = titleContainer && titleContainer.querySelector('.group-title-input');
  const detailsDiv = groupDiv.querySelector('.group-extra-details');
  const detailsTextDiv = detailsDiv && detailsDiv.querySelector('.group-details-text');
  const detailsTextarea = detailsDiv && detailsDiv.querySelector('.group-details-textarea');

  if (editAllBtn.dataset.editing === "false") {
    editAllBtn.textContent = "Guardar cambios";
    editAllBtn.dataset.editing = "true";
    makeGroupItemsEditable(groupDiv, groupIdStr);
    if (groupTitle && !existingInput) {
      const currentText = groupTitle.textContent;
      const input = document.createElement('input');
      input.type = "text";
      input.className = "group-title-input";
      input.value = currentText;
      input.style.fontSize = "1.1rem";
      input.style.width = "90%";
      groupTitle.replaceWith(input);
      input.focus();
    }
    if (!isMergedGroup && detailsTextDiv && detailsTextarea) {
      // Copia el texto actual al textarea
      let html = detailsTextDiv.innerHTML;
      // Convierte <br> y <div> a saltos de línea
      html = html.replace(/<div[^>]*>/gi, '\n').replace(/<\/div>/gi, '').replace(/<br\s*\/?>/gi, '\n');
      // Quita etiquetas HTML restantes
      html = html.replace(/<[^>]+>/g, '');
      detailsTextarea.value = html.trim();
      detailsTextDiv.style.display = "none";
      detailsTextarea.style.display = "";
      detailsTextarea.removeAttribute('readonly');
      detailsTextarea.focus();
    }
  } else {
    saveGroupItemEdits(groupDiv, groupIdStr);
    editAllBtn.textContent = "Editar";
    editAllBtn.dataset.editing = "false";
    if (titleContainer) {
      const input = titleContainer.querySelector('.group-title-input');
      if (input) {
        const newTitle = input.value.trim() || groupIdStr;
        const groupObj = objectData.find(o => String(o.SKU) === String(groupIdStr));
        if (groupObj) groupObj.name = newTitle;
        if (mergedGroups.has(groupIdStr)) {
          mergedGroups.get(groupIdStr).name = newTitle;
        }
        const h2 = document.createElement('h2');
        h2.className = "group-title";
        const link = document.createElement('a');
        link.href = `https://www.travers.com.mx/${groupIdStr}`;
        link.target = "_blank";
        link.textContent = newTitle;
        h2.appendChild(link);
        input.replaceWith(h2);
      }
    }
    if (!isMergedGroup && detailsTextDiv && detailsTextarea) {
      const newValue = detailsTextarea.value.trim();
      const groupObj = objectData.find(o => String(o.SKU) === String(groupIdStr));
      if (groupObj) groupObj.details = newValue;
      detailsTextDiv.innerHTML = newValue
        ? newValue.replace(/\n/g, "<br>")
        : "<em>Sin detalles</em>";
      detailsTextDiv.style.display = "";
      detailsTextarea.style.display = "none";
      detailsTextarea.setAttribute('readonly', 'readonly');
    }
    refreshView();
    setTimeout(() => highlightActiveFilter(), 0);

    let attempts = 0;
    const maxAttempts = 20;
    const pollId = setInterval(() => {
      const output = document.getElementById('output');
      const groupDivNew = document.querySelector(`.group-container[data-group-id="${groupIdStr}"]`);
      if (output && groupDivNew) {
        groupDivNew.scrollIntoView({ behavior: "auto", block: "start" });
        output.scrollTop -= 40;
        clearInterval(pollId);
      } else if (++attempts > maxAttempts) {
        clearInterval(pollId);
      }
    }, 40);
  }
};
  topDiv.appendChild(editAllBtn);

  // 3. Botón Ordenar
  const sortBtn = document.createElement("button");
  sortBtn.className = "btn btn-sm btn-outline-primary group-sort-btn";
  sortBtn.textContent = "Ordenar";
  sortBtn.onclick = function () {
      console.log('Ordenar click', groupIdStr);

    let attributeList = [];
    const table = groupDiv.querySelector('.attribute-table');
    if (table) {
      attributeList = Array.from(table.querySelectorAll('thead th'))
        .map(th => th.textContent.trim())
        .filter(header => header && !["×", "Drag", "Origen", ""].includes(header));
    } else if (window.filteredItems && window.filteredItems.length > 0) {
      const item = groupItems[0];
      attributeList = Object.keys(item || {});
    }
    openGroupSortModal(groupIdStr, groupItems, skuToObject, attributeList);
  };
  topDiv.appendChild(sortBtn);

  // 4. Botón Borrar
  const borrarBtn = document.createElement("button");
  borrarBtn.textContent = "Borrar";
  borrarBtn.className = "btn btn-sm btn-danger";
  borrarBtn.onclick = function() {
    const titleInput = groupDiv.querySelector('.group-title-input');
    const groupTitle = groupDiv.querySelector('.group-title');
    let currTitle = "";

    if (titleInput) {
      currTitle = titleInput.value.trim();
      if (!currTitle.startsWith("[BORRAR]")) {
        titleInput.value = `[BORRAR] ${currTitle}`;
      }
    } else if (groupTitle) {
      currTitle = groupTitle.textContent.trim();
      if (!currTitle.startsWith("[BORRAR]")) {
        const link = groupTitle.querySelector('a');
        if (link) link.textContent = `[BORRAR] ${currTitle}`;
        else groupTitle.textContent = `[BORRAR] ${currTitle}`;
      }
    }

    const groupObj = objectData.find(o => String(o.SKU) === String(groupIdStr));
    if (groupObj) {
      if (!groupObj.name || !groupObj.name.startsWith("[BORRAR]")) {
        groupObj.name = `[BORRAR] ${groupObj.name || currTitle}`;
      }
    }
    if (mergedGroups.has(groupIdStr)) {
      let mg = mergedGroups.get(groupIdStr);
      if (mg && mg.name && !mg.name.startsWith("[BORRAR]")) {
        mg.name = `[BORRAR] ${mg.name}`;
      }
    }
  };
  topDiv.appendChild(borrarBtn);

  // 5. Botón de desagrupar (solo si es grupo unido)
  if (isMergedGroup) {
    const unmergeBtn = document.createElement("button");
    unmergeBtn.className = "btn btn-sm btn-outline-danger";
    unmergeBtn.textContent = "Desagrupar";
    unmergeBtn.title = "Revertir esta unión de grupos";
    unmergeBtn.dataset.groupIdStr = groupIdStr;
    unmergeBtn.addEventListener('click', function() {
      unmergeGroup(this.dataset.groupIdStr);
    });
    topDiv.appendChild(unmergeBtn);
  }

  // 6. Botón de "Deshacer mover info" (solo si aplica)
  if (moveInfoUndoBackup[groupIdStr]) {
    const undoBtn = document.createElement("button");
    undoBtn.textContent = "Deshacer mover info";
    undoBtn.className = "btn btn-warning btn-sm";
    undoBtn.onclick = function() {
      const backup = moveInfoUndoBackup[groupIdStr];
      if (backup && backup.values && backup.values.length) {
        backup.values.forEach(b => {
          const obj = objectData.find(o => String(o.SKU) === String(b.SKU));
          if (obj) {
            obj[backup.srcAttr] = b.srcAttrValue;
            obj[backup.dstAttr] = b.dstAttrValue;
          }
        });
      }
      delete moveInfoUndoBackup[groupIdStr];
      if (groupDestHighlightAttr[groupIdStr]) delete groupDestHighlightAttr[groupIdStr];

      refreshView();
      setTimeout(() => highlightActiveFilter(), 0);

      let attempts = 0;
      const maxAttempts = 20;
      const pollId = setInterval(() => {
        const output = document.getElementById('output');
        const newGroupDiv = document.querySelector(`.group-container[data-group-id="${groupIdStr}"]`);
        if (output && newGroupDiv) {
          newGroupDiv.scrollIntoView({ behavior: "auto", block: "start" });
          output.scrollTop -= 40;
          newGroupDiv.classList.add('just-undone');
          setTimeout(() => newGroupDiv.classList.remove('just-undone'), 1200);
          clearInterval(pollId);
        }
        if (++attempts > maxAttempts) clearInterval(pollId);
      }, 50);
    };
    topDiv.appendChild(undoBtn);
  }

  rightContainer.appendChild(topDiv);

  // === Segunda línea: IG ID, PG, Llenos, #Items (nuevo), Unión de grupos (azul, al final) ===
  const bottomDiv = document.createElement("div");
  bottomDiv.className = "group-header-right-bottom";

  // 1. IG ID
  const igIdTag = document.createElement("span");
  igIdTag.className = "badge bg-secondary text-white small";
  igIdTag.textContent = groupIdStr;
  bottomDiv.appendChild(igIdTag);

// 2. PG (siempre se muestra)
const groupObj = objectData.find(o => String(o.SKU) === String(groupIdStr));
let pgTag;
if (groupObj && groupObj.catalog_page_number && String(groupObj.catalog_page_number).trim() !== "") {
  pgTag = document.createElement("a");
  pgTag.className = "badge bg-secondary text-white small";
  pgTag.textContent = `PG. ${groupObj.catalog_page_number}`;
  pgTag.href = `https://catalogo.travers.com.mx/catalogo/?page=${groupObj.catalog_page_number}`;
  pgTag.target = "_blank";
  pgTag.rel = "noopener noreferrer";
  pgTag.style.textDecoration = "none"; // Opcional: por si quieres quitar el subrayado
} else {
  pgTag = document.createElement("span");
  pgTag.className = "badge bg-secondary text-white small";
  pgTag.textContent = "No en Catálogo";
}
bottomDiv.appendChild(pgTag);

  // 3. Llenos badge
  setTimeout(() => {
    // Elimina el anterior si existe
    const oldBadge = bottomDiv.querySelector('.group-cols-badge');
    if (oldBadge) oldBadge.remove();

    const table = groupDiv.querySelector('.attribute-table');
    if (!table) return;
    const ths = Array.from(table.querySelectorAll('thead th'))
      .map(th => th.textContent.trim())
      .filter(header =>
        header && !["×", "Drag", "Origen", ""].includes(header.toLowerCase())
      );
    let withValue = 0;
    ths.forEach(attr => {
      const hasAny = groupItems.some(item => {
        const details = skuToObject[item.SKU] || {};
        return details[attr] && details[attr].toString().trim() !== "";
      });
      if (hasAny) withValue++;
    });
    const badgeLl = Math.max(withValue - 2, 0);
    const badgeTot = Math.max(ths.length - 4, 0);
    if (ths.length > 0) {
      const badge = document.createElement("span");
      badge.className = "badge bg-secondary text-white small group-cols-badge";
      badge.textContent = `Llenos: ${badgeLl} / ${badgeTot}`;
      // Insertar después de los dos primeros badges (IG ID y PG)
      let insertAfter = bottomDiv.querySelectorAll("span")[1] || bottomDiv.lastChild;
      if (insertAfter && insertAfter.nextSibling) {
        bottomDiv.insertBefore(badge, insertAfter.nextSibling);
      } else {
        bottomDiv.appendChild(badge);
      }
    }
  }, 0);

  // 4. NUEVO: Número de items (penúltimo)
  const itemsTag = document.createElement("span");
  itemsTag.className = "badge bg-secondary text-white small";
  itemsTag.textContent = `Items: ${groupItems.length}`;
  bottomDiv.appendChild(itemsTag);

  // 5. Unión de grupos (si aplica, SIEMPRE al final y azul)
  if (isMergedGroup && mergedGroups.has(groupIdStr)) {
    const mergedBadge = document.createElement("span");
    mergedBadge.className = "badge bg-info text-white small";
    mergedBadge.textContent = `Unión de ${mergedGroups.get(groupIdStr).originalGroups.length} grupos`;
    bottomDiv.appendChild(mergedBadge);
  }

    // 6. Botón Separar grupo
  const separarBtn = document.createElement("button");
  separarBtn.textContent = "Separar";
  separarBtn.className = "btn btn-sm btn-warning";
  separarBtn.onclick = function() {
      console.log('Separar click', groupIdStr);

    openSeparateGroupModal(groupIdStr, groupItems);
  };
  topDiv.appendChild(separarBtn);


  rightContainer.appendChild(bottomDiv);

  return rightContainer;
}

function confirmSeparateGroupModal() {
  const { groupId, groupItems, selectedAttr, selectedValue } = separateGroupModalState;
  if (!groupId || !groupItems.length || !selectedAttr || !selectedValue) {
    showTemporaryMessage("Selecciona atributo y valor para separar.");
    return;
  }
  // Genera base de IG ID único con timestamp
  const baseId = `split-${Date.now()}`;
  const newGroupId = `${baseId}2`;
  const newOldGroupId = `${baseId}1`;
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  // Items que se van al nuevo grupo
  const itemsToMove = groupItems.filter(item => {
    const val = (skuToObject[item.SKU]?.[selectedAttr] || "").toString().trim().replace(/["']/g, "");
    const selected = (selectedValue || "").toString().trim().replace(/["']/g, "");
    return val === selected;
  });
  // Items que permanecen en el grupo original
  const itemsToKeep = groupItems.filter(item => {
    const val = (skuToObject[item.SKU]?.[selectedAttr] || "").toString().trim().replace(/["']/g, "");
    const selected = (selectedValue || "").toString().trim().replace(/["']/g, "");
    return val !== selected;
  });
  // Actualiza IG ID de los items movidos
  itemsToMove.forEach(item => {
    if (!item.__originalIGID && !item["Original IG ID"]) {
      item.__originalIGID = item["IG ID"];
      item["Original IG ID"] = item["IG ID"];
    }
    item["IG ID"] = newGroupId;
  });
  // Actualiza IG ID de los items que permanecen (grupo viejo)
  itemsToKeep.forEach(item => {
    if (!item.__originalIGID && !item["Original IG ID"]) {
      item.__originalIGID = item["IG ID"];
      item["Original IG ID"] = item["IG ID"];
    }
    item["IG ID"] = newOldGroupId;
  });

  // Elimina todos los items del grupo original antes de agregar los nuevos
  filteredItems = [
    ...filteredItems.filter(item => String(item["IG ID"]) !== groupId),
    ...itemsToMove,
    ...itemsToKeep
  ];

  // Actualiza groupOrderMap
  groupOrderMap.set(newGroupId, itemsToMove.map(item => item.SKU));
  groupOrderMap.set(newOldGroupId, itemsToKeep.map(item => item.SKU));

  // Opcional: crea objeto grupo en objectData para ambos
  const origGroupObj = objectData.find(o => String(o.SKU) === groupId);
  if (origGroupObj) {
    objectData.push({
      ...origGroupObj,
      SKU: newGroupId,
      name: `[Separado] ${origGroupObj.name || groupId}`,
      "IG ID": newGroupId
    });
    objectData.push({
      ...origGroupObj,
      SKU: newOldGroupId,
      name: `[Restante] ${origGroupObj.name || groupId}`,
      "IG ID": newOldGroupId
    });
    // Elimina el objeto original
    objectData = objectData.filter(o => String(o.SKU) !== groupId);
  }
  closeSeparateGroupModal();
  showTemporaryMessage(`Grupo separado: ${itemsToMove.length} items movidos a ${newGroupId}, ${itemsToKeep.length} items a ${newOldGroupId}`);
  render();
}

function injectSeparateGroupModal() {
  if (document.getElementById('separateGroupModal')) return;
  const modal = document.createElement('div');
  modal.id = 'separateGroupModal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="separate-group-modal-backdrop"></div>
    <div class="separate-group-modal-content">
      <h3>Separar grupo por atributo</h3>
      <div id="separateGroupAttrList"></div>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button id="separateGroupConfirmBtn" class="btn btn-warning btn-sm">Separar</button>
        <button id="separateGroupCancelBtn" class="btn btn-outline-secondary btn-sm">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // SOLO para separar grupo: CSS exclusivo
  if (!document.getElementById('separate-group-css')) {
    const style = document.createElement('style');
    style.id = 'separate-group-css';
    style.textContent = `
      .separate-group-modal-backdrop {position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.2);}
      .separate-group-modal-content {
        background:white;max-width:400px;padding:24px 18px 18px 18px;border-radius:8px;
        box-shadow:0 6px 32px 0 #2222;position:fixed;top:50%;left:50%;
        transform:translate(-50%,-50%);
      }
      .separate-group-row {display:flex;align-items:center;gap:8px;padding:3px 0;}
      .separate-group-row.selected {background:#fffbe6;}
      .separate-group-row label {flex:1;}
    `;
    document.head.appendChild(style);
  }

  document.getElementById('separateGroupCancelBtn').onclick = closeSeparateGroupModal;
}
injectSeparateGroupModal();


function openSeparateGroupModal(groupIdStr, groupItems) {
  separateGroupModalState.groupId = groupIdStr;
  separateGroupModalState.groupItems = groupItems;
  separateGroupModalState.selectedAttr = null;
  separateGroupModalState.selectedValue = null;

const statsAttrs = Array.from(document.querySelectorAll('.attribute-stats-table tbody tr td select'))
  .map(sel => sel.getAttribute('data-attribute'))
  .filter(attr => attr && !excludedAttributes.has(attr))
  .sort((a, b) => a.localeCompare(b)); // <-- Ordena alfabéticamente

  // Obtén valores únicos por atributo en el grupo
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  const attrValuesMap = {};
  statsAttrs.forEach(attr => {
    attrValuesMap[attr] = new Set();
    groupItems.forEach(item => {
      const val = (skuToObject[item.SKU]?.[attr] || "").toString().trim();
      if (val) attrValuesMap[attr].add(val);
    });
  });

  // Renderiza el modal
  const listDiv = document.getElementById('separateGroupAttrList');
  listDiv.innerHTML = `
    <div>
      <label>Atributo:</label>
      <select id="separateGroupAttrSelect" class="form-control form-control-sm">
        <option value="">Selecciona atributo</option>
        ${statsAttrs.map(attr => `<option value="${attr}">${attr}</option>`).join('')}
      </select>
    </div>
    <div style="margin-top:10px;">
      <label>Valor:</label>
      <select id="separateGroupValueSelect" class="form-control form-control-sm" disabled>
        <option value="">Selecciona valor</option>
      </select>
    </div>
  `;

  // Listeners para selects
  const attrSelect = document.getElementById('separateGroupAttrSelect');
  const valueSelect = document.getElementById('separateGroupValueSelect');
  attrSelect.onchange = function() {
    const attr = this.value;
    separateGroupModalState.selectedAttr = attr;
    valueSelect.innerHTML = `<option value="">Selecciona valor</option>`;
    if (attr && attrValuesMap[attr]) {
      valueSelect.disabled = false;
      attrValuesMap[attr].forEach(val => {
        valueSelect.innerHTML += `<option value="${val}">${val}</option>`;
      });
    } else {
      valueSelect.disabled = true;
    }
  };
  valueSelect.onchange = function() {
    separateGroupModalState.selectedValue = this.value;
  };

  document.getElementById('separateGroupModal').style.display = 'block';
  document.getElementById('separateGroupConfirmBtn').onclick = confirmSeparateGroupModal;
}

function closeSeparateGroupModal() {
  document.getElementById('separateGroupModal').style.display = 'none';
  separateGroupModalState = { groupId: null, groupItems: [], selectedAttr: null, selectedValue: null };
}

function createBrandLogoElement(brandLogoPath) {
  const logo = document.createElement("img");
  logo.className = "brand-logo";

  const fallbackUrl = 'https://i.imgur.com/7K4mHkh.jpeg';

  // Si no viene ruta de logo, usamos fallback directamente
  if (!brandLogoPath || brandLogoPath.trim() === "") {
    logo.src = fallbackUrl;
    return logo;
  }

  // Si viene algo, intentamos cargarlo
  logo.src = `https://www.travers.com.mx/media/catalog/category/${brandLogoPath}`;
  logo.onerror = () => {
    logo.src = fallbackUrl;
    logo.onerror = () => {
      logo.style.display = 'none';
    };
  };

  return logo;
}

function createProductImageElement(rawImagePath) {
  const img = document.createElement("img");
  img.className = "product-img";

  const fallbackUrl = 'https://i.imgur.com/xrt9MK3.jpeg';

  const imagePath = rawImagePath
    ? rawImagePath
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/["']/g, '')
        .trim()
    : '';

  // Si no hay un path válido, usar fallback
  if (!imagePath || !/\.(png|jpe?g|webp)$/i.test(imagePath)) {
    img.src = fallbackUrl;
    return img;
  }

  const testImage = new Image();
  const imageUrl = `https://www.travers.com.mx/media/catalog/product/${imagePath}`;

  testImage.onload = () => {
    img.src = imageUrl;
  };

  testImage.onerror = () => {
    img.src = fallbackUrl;
  };

  testImage.src = imageUrl;

  return img;
}

function refreshView() {
  if (currentStatClickFilter) {
    handleStatClickFromState();
  } else if (Object.keys(activeFilters).length > 0) {
    applyMultipleFilters();
  } else {
    render();
  }
}

function handleStatClickFromState() {
  if (!currentStatClickFilter) return render();
  handleStatClick({
    target: {
      getAttribute: (attr) => {
        if (attr === 'data-attribute') return currentStatClickFilter.attribute;
        if (attr === 'data-type') return currentStatClickFilter.type;
        return undefined;
      }
    }
  });
}

function applyWebFilters() {
  // Implementación de applyWebFilters si es necesaria
}

// Llama a esto una vez al inicio
function injectAddStatsAttributeModal() {
  if (document.getElementById('addStatsAttributeModal')) return;
  const modal = document.createElement('div');
  modal.id = 'addStatsAttributeModal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="group-sort-modal-backdrop"></div>
    <div class="group-sort-modal-content">
      <h3>Agregar atributos a la tabla</h3>
      <div id="addStatsAttrList"></div>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button id="addStatsAttrConfirmBtn" class="btn btn-primary btn-sm">Agregar</button>
        <button id="addStatsAttrCancelBtn" class="btn btn-outline-secondary btn-sm">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Reutiliza el mismo CSS que el otro modal (solo se añade si no existe)
  if (!document.getElementById('dual-list-css')) {
    const style = document.createElement('style');
    style.id = 'dual-list-css';
    style.textContent = `
      #addStatsAttributeModal, #groupSortModal { position:fixed;z-index:2000;top:0;left:0;width:100vw;height:100vh;display:none; }
      .group-sort-modal-backdrop {position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.2);}
      .group-sort-modal-content {
        background:white;max-width:400px;padding:24px 18px 18px 18px;border-radius:8px;
        box-shadow:0 6px 32px 0 #2222;position:fixed;top:50%;left:50%;
        transform:translate(-50%,-50%);
      }
      .dual-list-modal.compact {
        display: flex;
        gap: 16px;
        justify-content: center;
        align-items: center;
        padding: 8px 0 0 0;
        font-size: 13px;
      }
      .dual-list-col {
        flex:1; min-width:120px; max-width:170px;
      }
      .dual-list-label {
        text-align: center;
        font-weight: 500;
        margin-bottom: 4px;
        font-size: 12px;
        color: #456;
      }
      .dual-list-box {
        border: 1px solid #bbb;
        background: #fafbfc;
        border-radius: 4px;
        min-height: 120px;
        max-height: 160px;
        overflow-y: auto;
        list-style: none;
        margin: 0; padding: 0;
        font-size: 13px;
      }
      .dual-list-box li {
        padding: 4px 7px;
        cursor: pointer;
        user-select: none;
        transition: background 0.13s;
        border-bottom: 1px solid #eee;
        font-size: 13px;
      }
      .dual-list-box li:last-child { border-bottom: none;}
      .dual-list-box li.selected, .dual-list-box li:focus {
        background: #e6f1ff;
        outline: none;
      }
      .dual-list-controls {
        display: flex;
        flex-direction: column;
        gap: 7px;
        justify-content: center;
        align-items: center;
      }
      .dual-list-btn {
        font-size: 1.08em;
        width: 30px; height: 30px;
        border-radius: 50%; border: none;
        background: #f1f4f7;
        color: #456;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
        padding: 0;
      }
      .dual-list-btn:active, .dual-list-btn:focus { background: #d6e8fd; color: #124;}
      .dual-list-selected li {
        cursor: grab;
      }
      @media (max-width:600px) {
        .dual-list-modal.compact { flex-direction:column; gap:7px;}
        .dual-list-controls { flex-direction:row; gap: 7px;}
      }
    `;
    document.head.appendChild(style);
  }

  document.getElementById('addStatsAttrCancelBtn').onclick = closeAddStatsAttributeModal;
}


function openAddStatsAttributeModal() {
  // Blacklist proporcionada
  const blacklist = new Set([
    "SKU", "product.type", "url_key", "product.attribute_set", "product.websites",
    "product.required_options", "stock.manage_stock", "stock.qty", "Price", "Price_View",
    "Short_Description", "Status", "Tax_class_id", "Visibility", "Weight", "name",
    "category.name", "leaf_name_filter", "item_group_id", "catalog_page_number",
    "catalog_cover_image", "image", "small_image", "thumbnail", "ShortDescription",
    "description", "pdp_display_attribute", "pdp_description_attribute", "pdp_short_description_attribute",
    "icon_order", "orden_cms", "algolia_synced_ids", "cost", "manufactuer", "on_order_qty"
  ]);
  // Todos los keys de objectData
  let allAttrs = new Set();
  objectData.forEach(obj => Object.keys(obj).forEach(k => allAttrs.add(k)));
  // Excluye los atributos ya visibles en la tabla de stats
  document.querySelectorAll('.attribute-stats-table tbody tr').forEach(row => {
    const attr = row.querySelector('td select')?.getAttribute('data-attribute');
    if (attr) blacklist.add(attr);
  });
  // Si es la primera vez o tras cerrar: reconstruye el estado
  if (!addStatsModalState.available.length && !addStatsModalState.selected.length) {
    addStatsModalState.available = Array.from(allAttrs).filter(attr => !blacklist.has(attr));
    addStatsModalState.selected = [];
  }

  // Render dual-list con filtro de búsqueda
  const listDiv = document.getElementById('addStatsAttrList');
  listDiv.innerHTML = `
    <div class="dual-list-modal compact">
      <div class="dual-list-col">
        <div class="dual-list-label">Disponibles</div>
        <input type="text" id="addStats-search" class="form-control form-control-sm" placeholder="Buscar atributo..." style="margin-bottom:4px;">
        <ul id="addStats-available" class="dual-list-box" tabindex="0">
          ${addStatsModalState.available.map(attr => `<li tabindex="0">${attr}</li>`).join('')}
        </ul>
      </div>
      <div class="dual-list-controls">
        <button id="addStats-add" class="dual-list-btn compact-btn">&rarr;</button>
        <button id="addStats-remove" class="dual-list-btn compact-btn">&larr;</button>
      </div>
      <div class="dual-list-col">
        <div class="dual-list-label">Seleccionados</div>
        <ul id="addStats-selected" class="dual-list-box dual-list-selected" tabindex="0">
          ${addStatsModalState.selected.map(attr => `<li tabindex="0">${attr}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  // --- Filtro de búsqueda ---
  const searchInput = document.getElementById('addStats-search');
  const availUl = document.getElementById('addStats-available');
  searchInput.addEventListener('input', function() {
    const term = this.value.trim().toLowerCase();
    Array.from(availUl.children).forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });

  // --- Dual-list logic ---
  const selUl = document.getElementById('addStats-selected');
  let selectedAvailable = null, selectedSelected = null;

  availUl.onclick = e => {
    if (e.target.tagName === "LI") {
      selectedAvailable = e.target;
      availUl.querySelectorAll('.selected').forEach(li => li.classList.remove('selected'));
      e.target.classList.add('selected');
    }
  };
  selUl.onclick = e => {
    if (e.target.tagName === "LI") {
      selectedSelected = e.target;
      selUl.querySelectorAll('.selected').forEach(li => li.classList.remove('selected'));
      e.target.classList.add('selected');
    }
  };
  document.getElementById('addStats-add').onclick = () => {
    if (!selectedAvailable) return;
    const attr = selectedAvailable.textContent;
    addStatsModalState.available = addStatsModalState.available.filter(a => a !== attr);
    addStatsModalState.selected.push(attr);
    openAddStatsAttributeModal(); // rerender visual
  };
  availUl.ondblclick = e => {
    if (e.target.tagName === "LI") {
      const attr = e.target.textContent;
      addStatsModalState.available = addStatsModalState.available.filter(a => a !== attr);
      addStatsModalState.selected.push(attr);
      openAddStatsAttributeModal();
    }
  };
  document.getElementById('addStats-remove').onclick = () => {
    if (!selectedSelected) return;
    const attr = selectedSelected.textContent;
    addStatsModalState.selected = addStatsModalState.selected.filter(a => a !== attr);
    addStatsModalState.available.push(attr);
    openAddStatsAttributeModal();
  };
  selUl.ondblclick = e => {
    if (e.target.tagName === "LI") {
      const attr = e.target.textContent;
      addStatsModalState.selected = addStatsModalState.selected.filter(a => a !== attr);
      addStatsModalState.available.push(attr);
      openAddStatsAttributeModal();
    }
  };

  document.getElementById('addStatsAttributeModal').style.display = 'block';
  document.getElementById('addStatsAttrConfirmBtn').onclick = confirmAddStatsAttributesModal;
}


function exportAllDataCustom() {
  const cmsIg = getCmsIg();

  // ===== 1. Hoja "Atributos" =====
  const atributosCols = ["CMS IG", "Atributo", "Filtros", "Web", "Cat", "enable_table_view"];
  const viewDropdown = document.getElementById("viewModeDropdown");
  const currentViewValue = viewDropdown ? viewDropdown.value : "";

  // Detectar cambios en los valores de atributos
  let hasChanges = false;
  const cmsSet = new Set(filteredItems.map(item => item["CMS IG"]).filter(Boolean));
  const attributes = [];
  document.querySelectorAll('.filter-order-input').forEach(input => {
    const attr = input.getAttribute('data-attribute');
    if (attr) attributes.push(attr);
  });

  // Compara valores actuales vs originales
  for (const cmsIgVal of cmsSet) {
    for (const attr of attributes) {
      const filtroInput = document.querySelector(`.filter-order-input[data-attribute="${attr}"]`);
      const webInput = document.querySelector(`.order-input[data-attribute="${attr}"]`);

      // Busca el valor original en filteredItemsOriginalStats
      const originalItem = (window.filteredItemsOriginalStats || []).find(item => item["CMS IG"] === cmsIgVal);
      const origFiltro = originalItem ? (originalItem[attr + "_filtros"] || "") : "";
      const origWeb = originalItem ? (originalItem[attr + "_web"] || "") : "";

      // Compara con el valor actual (IGNORA CAT)
      const currFiltro = filtroInput ? (filtroInput.value || "") : "";
      const currWeb = webInput ? (webInput.value || "") : "";

      if (origFiltro !== currFiltro || origWeb !== currWeb) {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) break;
  }

  // Si hay cambios, pregunta al usuario
  if (hasChanges) {
    showExportChangesModal(
      () => { exportAllDataCustomCore(false, cmsSet, attributes, atributosCols, currentViewValue, cmsIg); },
      () => { exportAllDataCustomCore(true, cmsSet, attributes, atributosCols, currentViewValue, cmsIg); },
      () => {}
    );
    return;
  }
  exportAllDataCustomCore(false, cmsSet, attributes, atributosCols, currentViewValue, cmsIg);
}

function exportAllData() {
  // Usa el CMS actual para los nombres de archivo
  const cmsIg = getCmsIg();
  const excelFilename = `${cmsIg}_FilteredItems.xlsx`;
  const csvFilename = `${cmsIg}_ObjectData.csv`;

  // 1. Exportar el Excel con los datos modificados
  const wb = XLSX.utils.book_new();
  Object.keys(originalExcelSheets).forEach(sheetName => {
    let sheetData = [];
    let sheetHeader = originalExcelSheets[sheetName].header;

    if (sheetName === "data") {
      // Agrupa por grupo
      const grouped = {};
      filteredItems.forEach(item => {
        const groupId = String(item["IG ID"]);
        if (!grouped[groupId]) grouped[groupId] = [];
        grouped[groupId].push(item);
      });

      // Orden visual según groupOrderMap
      let ordered = [];
      Object.keys(grouped).forEach(groupId => {
        const groupItems = grouped[groupId];
        const skusOrder = groupOrderMap.get(groupId) || groupItems.map(i => i.SKU);
        const groupOrdered = skusOrder
          .map(sku => groupItems.find(i => String(i.SKU) === String(sku)))
          .filter(Boolean);
        ordered = ordered.concat(groupOrdered);
      });

      // Calcula el orden de atributos Cat
      const catOrderInputs = Array.from(document.querySelectorAll('.order-cat-input'));
      const catOrderArr = catOrderInputs
        .map(input => ({
          attribute: input.getAttribute('data-attribute'),
          value: parseInt(input.value)
        }))
        .filter(input => input.value > 0 && input.attribute)
        .sort((a, b) => a.value - b.value);
      const catOrderAttributes = catOrderArr.map(x => x.attribute);
      const catOrderString = catOrderAttributes.join(',');

      // Asegura que el header tenga la columna
      if (!sheetHeader.includes('table_attributes_cat')) {
        sheetHeader.push('table_attributes_cat');
      }
      // NUEVO: agrega la columna IG ID Original si no existe
      if (!sheetHeader.includes('IG ID Original')) {
        sheetHeader.push('IG ID Original');
      }

      // Ahora usa el header original y el orden correcto
      sheetData = ordered.map(item => {
        const row = {};
        sheetHeader.forEach(col => row[col] = item[col] ?? "");
        row['table_attributes_cat'] = catOrderString;
        // NUEVO: agrega IG ID Original si existe
        row['IG ID Original'] = item.__originalIGID || item["IG ID Original"] || "";
        return row;
      });
    }
    else if (sheetName === "category-data") {
      sheetData = categoryData.map(item => {
        const row = {};
        sheetHeader.forEach(col => row[col] = item[col] ?? "");
        return row;
      });
    }
    else {
      sheetData = originalExcelSheets[sheetName].data;
    }

    // Header primero SIEMPRE
    const ws = XLSX.utils.json_to_sheet(sheetData, { header: sheetHeader });
    XLSX.utils.sheet_add_aoa(ws, [sheetHeader], { origin: "A1" });
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });


// ...existing code...
// Exportar hoja "Atributos" (stats)
const atributosCols = ["CMS IG", "Atributo", "Filtros", "Web", "Cat"];
const atributosData = [];
const cmsSet = new Set(filteredItems.map(item => item["CMS IG"]).filter(Boolean));
const attributes = [];
document.querySelectorAll('.filter-order-input').forEach(input => {
  const attr = input.getAttribute('data-attribute');
  if (attr) attributes.push(attr);
});
cmsSet.forEach(cmsIgVal => {
  attributes.forEach(attr => {
    const filtroInput = document.querySelector(`.filter-order-input[data-attribute="${attr}"]`);
    const catInput = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
    const webInput = document.querySelector(`.order-input[data-attribute="${attr}"]`);
    atributosData.push({
      "CMS IG": cmsIgVal,
      "Atributo": attr,
      "Filtros": filtroInput ? (filtroInput.value || "") : "",
      "Web": webInput ? (webInput.value || "") : "",
      "Cat": catInput ? (catInput.value || "") : ""
    });
  });
});
const wsAtributos = XLSX.utils.json_to_sheet(atributosData.length ? atributosData : [{}], { header: atributosCols });
XLSX.utils.sheet_add_aoa(wsAtributos, [atributosCols], { origin: "A1" });
XLSX.utils.book_append_sheet(wb, wsAtributos, "Atributos");
// ...existing code...


  // 2. Exportar hoja "Orden Grupos" con el orden visual actual
  const ordenGruposData = [];
  groupOrderMap.forEach((skuList, groupId) => {
    ordenGruposData.push({
      "IG ID": groupId,
      "Orden SKUs": skuList.join(",")
    });
  });
  const wsOrdenGrupos = XLSX.utils.json_to_sheet(ordenGruposData, { header: ["IG ID", "Orden SKUs"] });
  XLSX.utils.book_append_sheet(wb, wsOrdenGrupos, "Orden Grupos");

  // 3. Guardar el Excel con el nombre personalizado
  XLSX.writeFile(wb, excelFilename);

  // 3. Exportar el CSV de objectData (modificado)
  if (objectData.length && originalCsvHeader.length) {
    // Incluye también los grupos NUEVOS (merged) en el CSV
    let mergedGroupsArr = [];
    if (typeof mergedGroups !== "undefined" && mergedGroups.size > 0) {
      for (const [mergedId, mergedGroupData] of mergedGroups.entries()) {
        let groupObj = objectData.find(o => String(o.SKU) === mergedId);
        // Intenta obtener los detalles guardados o generados dinámicamente
        let detallesGrupo = "";
        if (typeof getMergedGroupDetails === "function") {
          detallesGrupo = getMergedGroupDetails(mergedId);
        }
        // Si no hay detalles guardados, genera el texto por default al unir grupos
        if (!detallesGrupo) {
          if (mergedGroupData && mergedGroupData.originalGroups && mergedGroupData.items) {
            detallesGrupo = "";
            mergedGroupData.originalGroups.forEach(originalGroupId => {
              const originalGroupInfo = objectData.find(o => o.SKU === originalGroupId) || {};
              detallesGrupo += `${originalGroupId}, ${originalGroupInfo.name || ""}, ${originalGroupInfo.brand_logo || ""}\n`;
              const fields = ['ventajas', 'aplicaciones', 'especificaciones', 'incluye'];
              fields.forEach(field => {
                if (originalGroupInfo[field]) {
                  let fieldValue = originalGroupInfo[field]
                    .replace(/<special[^>]*>|<\/special>|<strong>|<\/strong>/gi, '')
                    .replace(/<br\s*\/?>|<\/br>/gi, '\n');
                  detallesGrupo += `${field.charAt(0).toUpperCase() + field.slice(1)}:\n${fieldValue}\n\n`;
                }
              });
              detallesGrupo += "--------------------\n\n";
            });
            detallesGrupo = detallesGrupo.trim();
          }
        }
        if (!groupObj) {
          const firstItem = mergedGroupData.items && mergedGroupData.items[0] ? mergedGroupData.items[0] : {};
          groupObj = {
            SKU: mergedId,
            name: mergedGroupData.name || firstItem.name || "",
            marca: firstItem.marca || "",
            imagen: firstItem.imagen || firstItem.image || "",
            "IG ID": mergedId,
            ventajas: detallesGrupo,
            aplicaciones: "",
            especificaciones: "",
            incluye: ""
          };
          originalCsvHeader.forEach(col => {
            if (!(col in groupObj) && col in firstItem) groupObj[col] = firstItem[col];
          });
        } else {
          groupObj.ventajas = detallesGrupo;
          groupObj.aplicaciones = "";
          groupObj.especificaciones = "";
          groupObj.incluye = "";
        }
        mergedGroupsArr.push(groupObj);
      }
    }

    // Combina los objetos normales y los merged
    const allObjectsToExport = [...objectData, ...mergedGroupsArr];

    // ---- BLOQUE CORREGIDO PARA TÍTULO Y VENTAJAS ----
    const csvRows = allObjectsToExport.map(obj => {
      const row = {};
      originalCsvHeader.forEach(col => {
        // Sobrescribe "name" o "titulo" si existe, con el valor editado
        if (col === "name" || col === "titulo") {
          row[col] = obj.name || "";
        }
        // Sobrescribe "ventajas" con details si existe, y limpia otros si hubo edición
        else if (col === "ventajas") {
          if (typeof obj.details === "string" && obj.details.trim() !== "") {
            row[col] = obj.details;
          } else {
            row[col] = obj.ventajas || "";
          }
        }
        // Si hubo edición de detalles, limpia aplicaciones, especificaciones, incluye
        else if ((col === "aplicaciones" || col === "especificaciones" || col === "incluye")) {
          if (typeof obj.details === "string" && obj.details.trim() !== "") {
            row[col] = "";
          } else {
            row[col] = obj[col] || "";
          }
        }
        // El resto igual
        else {
          row[col] = obj[col] ?? "";
        }
      });
      return row;
    });
    // ---- FIN BLOQUE CORREGIDO ----

    const csv = Papa.unparse(csvRows, { columns: originalCsvHeader });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = csvFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function closeAddStatsAttributeModal() {
  document.getElementById('addStatsAttributeModal').style.display = 'none';
  // Limpiar el estado para que siempre empiece fresh
  addStatsModalState = { available: [], selected: [] };
}

// Al confirmar, agrega los atributos seleccionados a window.extraStatsAttributes y refresca la tabla
function confirmAddStatsAttributesModal() {
  const attrsToAdd = addStatsModalState.selected;
  if (!window.extraStatsAttributes) window.extraStatsAttributes = new Set();
  attrsToAdd.forEach(attr => window.extraStatsAttributes.add(attr));
  closeAddStatsAttributeModal();
  render();
}

function closeAddStatsAttributeModal() {
  document.getElementById('addStatsAttributeModal').style.display = 'none';
  addStatsModalState = { available: [], selected: [] };
}

// Al confirmar, agrega los atributos seleccionados a window.extraStatsAttributes y refresca la tabla
function confirmAddStatsAttributesModal() {
  const attrsToAdd = addStatsModalState.selected;
  if (!window.extraStatsAttributes) window.extraStatsAttributes = new Set();
  attrsToAdd.forEach(attr => window.extraStatsAttributes.add(attr));
  closeAddStatsAttributeModal();
  render();
}


function handleCombinedExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      // GUARDAR TODAS LAS HOJAS ORIGINALES (headers y datos)
      originalExcelSheets = {};
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }); // array de arrays
        if (rows.length) {
          originalExcelSheets[sheetName] = {
            header: rows[0],
            data: XLSX.utils.sheet_to_json(sheet, { defval: "" }) // array de objetos
          };
        }
      });

      // CARGAR TUS DATOS NORMALES (usa los objetos, como ya tienes)
      const dataSheet = workbook.Sheets["data"];
      const catSheet = workbook.Sheets["category-data"];
      const valueOrderSheet = workbook.Sheets["value order"];
      const rankingSheet = workbook.Sheets["product_ranking"];

      if (!dataSheet || !catSheet) {
        alert("El archivo no contiene las hojas necesarias.");
        return;
      }

      // 1. Cargar datos principales
      filteredItemsOriginal = XLSX.utils.sheet_to_json(dataSheet, { defval: "" }).map(o => ({ ...o }));
      filteredItems = filteredItemsOriginal.map(o => ({ ...o }));
      categoryData = XLSX.utils.sheet_to_json(catSheet, { defval: "" });

      // 2. Value order (opcional)
      if (valueOrderSheet) {
        window.valueOrderList = XLSX.utils.sheet_to_json(valueOrderSheet, { defval: "" });
      } else {
        window.valueOrderList = [];
      }

      // 3. Merge product_ranking
      if (rankingSheet) {
        const rankingRows = XLSX.utils.sheet_to_json(rankingSheet, { defval: "" });
        const rankingMap = {};
        rankingRows.forEach(row => {
          let sku =
            (row.sku !== undefined ? row.sku :
            row.SKU !== undefined ? row.SKU :
            row.Sku !== undefined ? row.Sku :
            row.Codigo !== undefined ? row.Codigo :
            row.ID !== undefined ? row.ID : ""
            );
          sku = sku ? sku.toString().trim() : "";

          let ranking =
            (row.product_ranking !== undefined ? row.product_ranking :
            row.ranking !== undefined ? row.ranking :
            row.Product_Ranking !== undefined ? row.Product_Ranking :
            row.Ranking !== undefined ? row.Ranking : ""
            );
          ranking = (ranking !== null && ranking !== undefined) ? ranking : "";

          rankingMap[sku] = ranking;
        });

        filteredItems.forEach(item => {
          const sku = item.SKU ? item.SKU.toString().trim() : "";
          item.product_ranking = rankingMap[sku] || "";
        });
        filteredItemsOriginal.forEach(item => {
          const sku = item.SKU ? item.SKU.toString().trim() : "";
          item.product_ranking = rankingMap[sku] || "";
        });
      } else {
        filteredItems.forEach(item => { item.product_ranking = ""; });
        filteredItemsOriginal.forEach(item => { item.product_ranking = ""; });
      }

      // === SNAPSHOT PARA DETECCIÓN DE CAMBIOS DE GRUPO ===
      // Recuerda: objectData puede que no exista aún aquí, lo igualamos con filteredItems
      window.objectData = filteredItems.map(o => ({ ...o }));
      window.originalGroupData = window.objectData.map(obj => ({
        SKU: obj.SKU,
        name: obj.name || "",
        details: obj.details || ""
      }));

      // Renderiza el árbol de categorías y sigue el flujo normal
      renderCategoryTree(categoryData, document.getElementById('fileInfo'));
      processCategoryDataFromSheet();

    } catch (error) {
      console.error("Error procesando archivo combinado:", error);
      alert("Ocurrió un error procesando el archivo combinado: " + error.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ---- FUNCION COMPLETA: Cuando cargas el CSV ----
function handleCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      objectDataOriginal = results.data.map(o => ({ ...o })); // copia profunda
      objectData = objectDataOriginal.map(o => ({ ...o }));   // copia profunda

      // GUARDAR HEADER Y DATOS ORIGINALES DEL CSV
      originalCsvHeader = results.meta.fields ? [...results.meta.fields] : Object.keys(results.data[0] || {});
      originalCsvData = results.data.map(o => ({ ...o }));

      // === SNAPSHOT PARA DETECCIÓN DE CAMBIOS DE GRUPO ===
      // Solo las propiedades relevantes para los cambios de grupo
      window.originalGroupData = objectData.map(obj => ({
        SKU: obj.SKU,
        name: obj.name || "",
        details: obj.details || ""
      }));

      // --- HABILITA EL BOTÓN ---
      const btn = document.getElementById('btn-cargar-categoria');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      }
      // NO render() aquí: Espera a que elijan categoría
    },
    error: (error) => {
      console.error("Error procesando Data File:", error);
    }
  });
}

// Aplica el avance de datos_modificados.xlsx sobre el originalExcelSheets y filteredItems
function handleAvanceExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      // Aplica SOLO la hoja "data"
      const dataSheet = workbook.Sheets["data"];
      if (dataSheet) {
        const avanceItems = XLSX.utils.sheet_to_json(dataSheet, { defval: "" });
        let avanceMap = {};
        avanceItems.forEach(item => {
          if (item.SKU) avanceMap[String(item.SKU)] = item;
        });
        filteredItems = filteredItems.map(orig => {
          let sku = String(orig.SKU);
          let avance = avanceMap[sku];
          if (avance) {
            // NUEVO: restaura IG ID Original si existe
            orig.__originalIGID = avance["IG ID Original"] || avance.__originalIGID || orig.__originalIGID || "";
            return { ...orig, ...avance };
          }
          return orig;
        });
      }
// ...existing code...
const atributosSheet = workbook.Sheets["Atributos"];
if (atributosSheet) {
  const atributosRows = XLSX.utils.sheet_to_json(atributosSheet, { defval: "" });
  atributosRows.forEach(row => {
    const attr = row["Atributo"];
    if (!attr) return;
    // Filtros
    if (attributeFilterInputs[attr]) {
      attributeFilterInputs[attr].value = row["Filtros"] || "";
      localStorage.setItem(`filter_${attr}`, row["Filtros"] || "0");
    }
    // Orden Web
    const webInput = document.querySelector(`.order-input[data-attribute="${attr}"]`);
    if (webInput) {
      webInput.value = row["Web"] || "";
      localStorage.setItem(`order_${attr}`, row["Web"] || "");
    }
    // Orden Cat
    const catInput = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
    if (catInput) {
      catInput.value = row["Cat"] || "";
      localStorage.setItem(`cat_order_${attr}`, row["Cat"] || "");
    }
  });
}
// ...existing code...
      // NUEVO: restaurar el orden visual de los grupos si existe la hoja "Orden Grupos"
      const ordenGruposSheet = workbook.Sheets["Orden Grupos"];
      if (ordenGruposSheet) {
        const ordenRows = XLSX.utils.sheet_to_json(ordenGruposSheet, { defval: "" });
        ordenRows.forEach(row => {
          if (row["IG ID"] && row["Orden SKUs"]) {
            const skuList = row["Orden SKUs"].split(",").map(s => s.trim()).filter(Boolean);
            groupOrderMap.set(row["IG ID"], skuList);
          }
        });
      }

      showTemporaryMessage('Avance Excel aplicado');
      render();
    } catch (e) {
      alert("Error cargando avance Excel: " + e.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// Aplica el avance de object_data_modificado.csv sobre objectData
function handleAvanceCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const avanceRows = results.data.map(o => ({ ...o }));

      // --- Normaliza campos para merged groups
      avanceRows.forEach(row => {
        if (row.SKU && row.SKU.startsWith("merged-")) {
          if (!row.name && row.titulo) row.name = row.titulo;
          if (!row.name && row["titulo"]) row.name = row["titulo"];
        }
      });

      let avanceMap = {};
      avanceRows.forEach(row => {
        if (row.SKU) avanceMap[String(row.SKU)] = row;
      });
      objectData = objectData.map(orig => {
        let sku = String(orig.SKU);
        return avanceMap[sku] ? { ...orig, ...avanceMap[sku] } : orig;
      });

      // Agrega merged- y split- que no existan en objectData
      avanceRows.forEach(row => {
        if (
          row.SKU &&
          (row.SKU.startsWith("merged-") || row.SKU.startsWith("split-")) &&
          !objectData.find(o => o.SKU === row.SKU)
        ) {
          objectData.push(row);
        }
      });

      // === RECONSTRUIR mergedGroups para que la raya azul aparezca ===
      mergedGroups.clear();
      objectData.forEach(obj => {
        if (String(obj.SKU).startsWith("merged-")) {
          mergedGroups.set(String(obj.SKU), {
            originalGroups: obj.__originalGroups || [],
            items: [], // Si tienes los items, agrégalos aquí
            creationTime: obj.groupCreatedAt || Date.now(),
            details: obj.details || "",
            name: obj.name || ""
          });
        }
      });

      // NO actualices objectDataOriginal aquí
      showTemporaryMessage('Avance CSV aplicado');
      render();
    },
    error: (error) => {
      alert("Error cargando avance CSV: " + error.message);
    }
  });
}

function clearAllOrderAndFilterInputs() {
  document.querySelectorAll('.filter-order-input, .order-input, .order-cat-input').forEach(input => {
    input.value = '';
  });
  document.querySelectorAll('.filter-order-input').forEach(input => {
    const attr = input.getAttribute('data-attribute');
    localStorage.removeItem(`filter_${attr}`);
  });
  document.querySelectorAll('.order-input').forEach(input => {
    const attr = input.getAttribute('data-attribute');
    localStorage.removeItem(`order_${attr}`);
  });
  document.querySelectorAll('.order-cat-input').forEach(input => {
    const attr = input.getAttribute('data-attribute');
    localStorage.removeItem(`cat_order_${attr}`);
  });
  console.log('Inputs y localStorage de filtros/orden limpiados');
}

function renderCategoryTree(categoryData, fileInfoDiv) {
  // Construir estructura de árbol y mapa de imágenes
  const tree = {};
  const pathToImage = {};

  categoryData.forEach(row => {
    if (!row.category || typeof row.category !== "string") return;
    const path = row.category.split('ç');
    let node = tree;
    let currentPath = '';
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      currentPath = currentPath ? currentPath + 'ç' + key : key;
      if (!node[key]) node[key] = { __children: {}, __path: currentPath };
      node = node[key].__children;
      if (i === path.length - 1 && row.image) {
        pathToImage[currentPath] = row.image;
      }
    }
  });

  function createTreeHTML(nodeObj) {
    const ul = document.createElement('ul');
    ul.className = 'category-tree-ul';
    Object.keys(nodeObj).forEach(key => {
      if (key === '__children' || key === '__path') return;
      const node = nodeObj[key];
      const li = document.createElement('li');
      li.className = 'category-tree-li';
      const nodePath = node.__path;
      const imageRaw = pathToImage[nodePath] || '';
      let code = '';
      if (imageRaw) code = imageRaw.replace(/^W/, '').replace(/\.png$/i, '');
      const label = document.createElement('span');
      label.className = 'category-tree-label';
      label.setAttribute('data-path', nodePath);
      label.textContent = code ? `[${code}] ${key}` : key;
      label.addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.category-tree-label.selected').forEach(el => el.classList.remove('selected'));
        label.classList.add('selected');
      });
      li.appendChild(label);
      const childrenKeys = Object.keys(node.__children).filter(k => k !== '__children' && k !== '__path');
      if (childrenKeys.length > 0) {
        const expandBtn = document.createElement('span');
        expandBtn.textContent = '⏵';
        expandBtn.className = 'category-tree-expand-btn';
        expandBtn.setAttribute('aria-expanded', 'false');
        li.insertBefore(expandBtn, label);
        const childrenUl = createTreeHTML(node.__children);
        childrenUl.style.display = 'none';
        expandBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          const expanded = expandBtn.getAttribute('aria-expanded') === 'true';
          expandBtn.setAttribute('aria-expanded', !expanded);
          childrenUl.style.display = expanded ? 'none' : 'block';
          expandBtn.textContent = expanded ? '⏵' : '⏷';
        });
        li.appendChild(childrenUl);
      } else {
        const emptySpan = document.createElement('span');
        emptySpan.className = 'category-tree-expand-btn empty';
        emptySpan.textContent = '⏷';
        emptySpan.style.visibility = 'hidden';
        li.insertBefore(emptySpan, label);
      }
      ul.appendChild(li);
    });
    return ul;
  }

  // Limpiar y montar la estructura
  fileInfoDiv.innerHTML = '';

  // Header sticky con el botón
  let header = document.createElement('div');
  header.className = 'category-tree-header';
  fileInfoDiv.appendChild(header);

  let cargarBtn = document.createElement('button');
  cargarBtn.id = 'btn-cargar-categoria';
  cargarBtn.className = 'btn btn-secondary';
  cargarBtn.textContent = 'Cargar categoría';
  cargarBtn.disabled = true;
  header.appendChild(cargarBtn);

  // Contenedor para el árbol (hace scroll, no el header)
  let treeList = document.createElement('div');
  treeList.className = 'category-tree-list';
  fileInfoDiv.appendChild(treeList);

  const treeHtml = createTreeHTML(tree);
  treeList.appendChild(treeHtml);

  cargarBtn.addEventListener('click', function() {
    const selected = fileInfoDiv.querySelector('.category-tree-label.selected');
    if (!selected) {
      alert("Selecciona una categoría del árbol");
      return;
    }
    const match = selected.textContent.match(/\[(.*?)\]/);
    if (!match) {
      alert("La categoría seleccionada no tiene código CMS válido");
      return;
    }
    const cmsCode = match[1].trim();
currentCmsIg = cmsCode; // <--- AGREGA ESTA LÍNEA AQUÍ

    if (!filteredItemsOriginal.length || !objectDataOriginal.length) {
      alert("Primero carga los archivos de datos.");
      return;
    }

    // 1. Filtra los SKUs del CMS
    const filtered = filteredItemsOriginal.filter(x => (x["CMS IG"] || "").trim() === cmsCode);

    filtered.sort((a, b) => {
  const oa = parseInt(a.orden_tabla) || 99999;
  const ob = parseInt(b.orden_tabla) || 99999;
  return oa - ob;
});

    if (!filtered.length) {
      alert("No hay SKUs para este código CMS en los datos cargados.");
      return;
    }

    // 2. Calcula los IG ID únicos de los SKUs filtrados
    const validSkus = new Set(filtered.map(x => x.SKU));
    const groupIds = new Set(filtered.map(x => String(x["IG ID"])).filter(Boolean));

    // 3. Incluye SKUs y también los objetos grupo (SKU == IG ID)
    // --- COPIA PROFUNDA! ---
    // a) Crea un backup original SOLO de la categoría activa
    const newObjectDataOriginal = objectDataOriginal.filter(obj =>
      validSkus.has(obj.SKU) || groupIds.has(String(obj.SKU))
    ).map(o => ({ ...o }));

    // b) Asigna el "original" y el "editable" a partir de ahí
    objectDataOriginal = newObjectDataOriginal;
    objectData = objectDataOriginal.map(o => ({ ...o }));

    // 4. Actualiza el array visible
    filteredItems = filtered;

    // 4.1 Inicializa el orden de los SKUs en cada grupo según orden_tabla
groupOrderMap = new Map();
const groupMap = {};
filteredItems.forEach(item => {
  const groupId = String(item["IG ID"]);
  if (!groupMap[groupId]) groupMap[groupId] = [];
  groupMap[groupId].push(item);
});
Object.entries(groupMap).forEach(([groupId, items]) => {
  items.sort((a, b) => {
    const oa = parseInt(a.orden_tabla) || 99999;
    const ob = parseInt(b.orden_tabla) || 99999;
    return oa - ob;
  });
  groupOrderMap.set(groupId, items.map(item => item.SKU));
});

    // 5. Limpia merges/selección si aplica (si existen esas variables)
    if (typeof selectedGroups !== "undefined") selectedGroups.clear();
    if (typeof mergedGroups !== "undefined") mergedGroups.clear();

  // 5.1 LIMPIA TODOS LOS INPUTS Y LOCALSTORAGE DE FILTRO/ORDEN
  if (typeof clearAllOrderAndFilterInputs === "function") {
    clearAllOrderAndFilterInputs();
  }

  // 6. Procesar datos de categorías para orden/filtros
  processCategoryDataFromSheet();

  // 7. Renderiza
  render();

  // 8. AHORA sí, actualiza los inputs visuales con los valores correctos
  setTimeout(() => {
    updateOrderInputs();
    applyWebFiltersVisualUpdate();

    // === SNAPSHOT: Guarda los valores originales de los inputs para el CMS actual ===
    window.filteredItemsOriginalStats = [];
    const cmsIgValue = filteredItems[0]?.["CMS IG"];
    const attributes = [];
    document.querySelectorAll('.filter-order-input').forEach(input => {
      const attr = input.getAttribute('data-attribute');
      if (attr) attributes.push(attr);
    });
    const row = { "CMS IG": cmsIgValue };
    attributes.forEach(attr => {
      const filtroInput = document.querySelector(`.filter-order-input[data-attribute="${attr}"]`);
      const webInput = document.querySelector(`.order-input[data-attribute="${attr}"]`);
      const catInput = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
      row[attr + "_filtros"] = filtroInput ? (filtroInput.value || "") : "";
      row[attr + "_web"] = webInput ? (webInput.value || "") : "";
      row[attr + "_cat"] = catInput ? (catInput.value || "") : "";
    });
    window.filteredItemsOriginalStats.push(row);
    // Opcional: log para depuración
    console.log("Snapshot actualizado para CMS:", cmsIgValue, window.filteredItemsOriginalStats);
  }, 150);
});
}

function processCategoryDataFromSheet() {
  if (!categoryData.length || !filteredItems.length) return;
  const cmsIgValue = filteredItems[0]['CMS IG'];
  const matchedItem = categoryData.find(item => item.image && item.image.includes(`W${cmsIgValue}.png`));
  if (matchedItem) {
// --- CAT ---
let catAttributesStr = matchedItem.cat_attributes || "";
if (!catAttributesStr.includes(',') && catAttributesStr.includes(' ')) {
  catAttributesStr = catAttributesStr.replace(/\s+/g, ',');
}
const catAttributes = catAttributesStr.split(',').map(attr => attr.trim()).filter(Boolean);
defaultCatAttributesOrder = {};
catAttributes.forEach((attr, idx) => {
  defaultCatAttributesOrder[attr] = idx + 1;
  const input = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
  if (input) {
    input.value = idx + 1;
    localStorage.setItem(`cat_order_${attr}`, (idx + 1).toString());
  }
});
    // Limpiar los que no están en cat_attributes
    document.querySelectorAll('.order-cat-input').forEach(input => {
      const attr = input.getAttribute('data-attribute');
      if (!catAttributes.includes(attr)) {
        input.value = '';
        localStorage.removeItem(`cat_order_${attr}`);
      }
    });

    // --- WEB ---
    let webAttributesStr = matchedItem.table_attributes || "";
    if (!webAttributesStr.includes(',') && webAttributesStr.includes(' ')) {
      webAttributesStr = webAttributesStr.replace(/\s+/g, ',');
    }
    const webAttributes = webAttributesStr.split(',').map(attr => attr.trim()).filter(Boolean);
    // ACTUALIZA defaultAttributesOrder para el CMS actual (usa los de Web)
    defaultAttributesOrder = {};
    webAttributes.forEach((attr, idx) => {
      defaultAttributesOrder[attr] = idx + 1;
      const input = document.querySelector(`.order-input[data-attribute="${attr}"]`);
      if (input) {
        input.value = idx + 1;
        localStorage.setItem(`order_${attr}`, (idx + 1).toString());
      }
    });
    // Limpiar los que no están en table_attributes
    document.querySelectorAll('.order-input').forEach(input => {
      const attr = input.getAttribute('data-attribute');
      if (!webAttributes.includes(attr)) {
        input.value = '';
        localStorage.removeItem(`order_${attr}`);
      }
    });

    // --- FILTROS ---
    let filterAttributesStr = matchedItem.filter_attributes || "";
    if (!filterAttributesStr.includes(',') && filterAttributesStr.includes(' ')) {
      filterAttributesStr = filterAttributesStr.replace(/\s+/g, ',');
    }
    const filterAttributes = filterAttributesStr.split(',').map(attr => attr.trim()).filter(Boolean);
    // ACTUALIZA defaultFilterAttributes para el CMS actual
    defaultFilterAttributes = new Set(filterAttributes);
    forcedFilterAttributes.forEach(attr => defaultFilterAttributes.add(attr));
    filterAttributes.forEach((attr, idx) => {
      const input = document.querySelector(`.filter-order-input[data-attribute="${attr}"]`);
      if (input) {
        input.value = idx + 1;
        localStorage.setItem(`filter_${attr}`, (idx + 1).toString());
      }
    });
    // Limpiar los que no están en filter_attributes
    document.querySelectorAll('.filter-order-input').forEach(input => {
      const attr = input.getAttribute('data-attribute');
      if (!filterAttributes.includes(attr)) {
        input.value = '';
        localStorage.removeItem(`filter_${attr}`);
      }
    });
  }
}

function initializeDragAndDrop() {
  // Agregar SortableJS si no está cargado
  if (typeof Sortable === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.14.0/Sortable.min.js';
    script.onload = setupDragAndDropForAllTables;
    document.head.appendChild(script);
  } else {
    setupDragAndDropForAllTables();
  }
}

function setupDragAndDropForAllTables() {
  document.querySelectorAll('.attribute-table tbody').forEach(tbody => {
    new Sortable(tbody, {
      animation: 0,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      forceFallback: true, //
      onStart: function(evt) {
        setTimeout(() => {
          const originalRow = evt.item;
          const ghostRow = document.querySelector('.sortable-ghost');
          if (ghostRow && originalRow) {
            ghostRow.style.height = `${originalRow.offsetHeight}px`;
            Array.from(ghostRow.children).forEach((cell, i) => {
              if (originalRow.children[i])
                cell.style.width = `${originalRow.children[i].offsetWidth}px`;
            });
          }
          // ---- DRAG IMAGE INVISIBLE FIX ----
          // Crea un canvas vacío como drag image invisible
          if (evt.originalEvent && evt.originalEvent.dataTransfer) {
            const img = document.createElement('img');
            img.src =
              'data:image/svg+xml;base64,' +
              btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
            evt.originalEvent.dataTransfer.setDragImage(img, 0, 0);
          }
          // ---- FIN DRAG IMAGE INVISIBLE FIX ----
        }, 0);
      },
      onEnd: function(evt) {
        // Refuerza el tamaño por si la animación hace un "snap"
        const originalRow = evt.item;
        const ghostRow = document.querySelector('.sortable-ghost');
        if (ghostRow && originalRow) {
          ghostRow.style.height = `${originalRow.offsetHeight}px`;
          Array.from(ghostRow.children).forEach((cell, i) => {
            if (originalRow.children[i])
              cell.style.width = `${originalRow.children[i].offsetWidth}px`;
          });
        }
        handleRowReorder(evt);
      }
    });
  });
}


// Función para manejar el reordenamiento de filas
function handleRowReorder(evt) {
  const tbody = evt.to;
  const groupId = tbody.closest('.group-container').dataset.groupId;
  const rows = Array.from(tbody.querySelectorAll('tr:not(.skip-dnd)'));
  const newVisibleOrder = rows.map(row => row.dataset.sku).filter(Boolean);

  // Orden completo anterior
  const prevFullOrder = groupOrderMap.get(groupId) || 
    filteredItems.filter(item => item["IG ID"] === groupId).map(item => item.SKU);

  // Nuevo orden: visibles primero (en el nuevo orden), luego los demás
  const newFullOrder = [
    ...newVisibleOrder,
    ...prevFullOrder.filter(sku => !newVisibleOrder.includes(sku))
  ];

  groupOrderMap.set(groupId, newFullOrder);

  // Feedback visual
  showTemporaryMessage(`Orden del grupo ${groupId} actualizado`);
}

// Función para configurar la selección múltiple
function setupRowSelection(table) {
  let lastSelectedRow = null;
  
  table.querySelectorAll('tbody tr').forEach((row, index) => {
    // Excluir el handle de arrastre de la selección
    row.querySelectorAll('td:not(.drag-handle)').forEach(cell => {
      cell.addEventListener('click', function(e) {
        // No hacer nada si se hace clic en un input
        if (e.target.tagName === 'INPUT') return;
        
        // Ctrl/Cmd para selección múltiple
        if (e.ctrlKey || e.metaKey) {
          row.classList.toggle('selected');
        } 
        // Shift para rango
        else if (e.shiftKey && lastSelectedRow) {
          selectRange(lastSelectedRow, row);
        } 
        // Selección simple
        else {
          clearSelections(table);
          row.classList.add('selected');
        }
        
        lastSelectedRow = row;
        updateSelectionCount();
      });
    });
  });
}

// Función para seleccionar un rango de filas
function selectRange(startRow, endRow) {
  const table = startRow.closest('table');
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const startIndex = rows.indexOf(startRow);
  const endIndex = rows.indexOf(endRow);
  
  const [start, end] = [startIndex, endIndex].sort((a, b) => a - b);
  
  rows.forEach((row, idx) => {
    if (idx >= start && idx <= end) {
      row.classList.add('selected');
    }
  });
}
// 1. Guarda el orden original de cada grupo al filtrar/cargar la categoría
// (pon esto después de: filteredItems = filtered; en tu renderCategoryTree o donde filtras por CMS IG)
window.originalGroupOrderMap = new Map();
const groupMap = {};
filteredItems.forEach(item => {
  const groupId = String(item["IG ID"]);
  if (!groupMap[groupId]) groupMap[groupId] = [];
  groupMap[groupId].push(item.SKU);
});
Object.entries(groupMap).forEach(([groupId, skuList]) => {
  window.originalGroupOrderMap.set(groupId, [...skuList]);
});

// 2. Modifica la función de reset para usar ese orden original
function resetGroupOrder(groupId) {
  // Usa el orden original guardado, o el de filteredItems si no existe
  const originalSkus = (window.originalGroupOrderMap && window.originalGroupOrderMap.get(groupId))
    || filteredItems.filter(item => String(item["IG ID"]) === String(groupId)).map(item => item.SKU);

  groupOrderMap.set(groupId, originalSkus);

  // Volver a renderizar el grupo
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  // Toma los items filtrados para el grupo
  const groupItems = filteredItems.filter(item => String(item["IG ID"]) === String(groupId));
  // Ordena los groupItems según el orden original
  groupItems.sort((a, b) => originalSkus.indexOf(a.SKU) - originalSkus.indexOf(b.SKU));

  // Buscar el contenedor del grupo en el DOM
  const groupContainer = document.querySelector(`.group-container[data-group-id="${groupId}"]`);
  if (groupContainer) {
    const existingTable = groupContainer.querySelector('.table-responsive');
    if (existingTable) existingTable.remove();
    createItemsTable(groupContainer, groupItems, skuToObject);
  }

  showTemporaryMessage(`Orden del grupo ${groupId} restaurado`);
}

// Función para limpiar selecciones
function clearSelections(table = null) {
  if (table) {
    table.querySelectorAll('tr.selected').forEach(row => {
      row.classList.remove('selected');
    });
  } else {
    document.querySelectorAll('.attribute-table tr.selected').forEach(row => {
      row.classList.remove('selected');
    });
  }
}

// Función para actualizar el contador de selección
function updateSelectionCount() {
  const selectedCount = document.querySelectorAll('.attribute-table tr.selected').length;
  const counter = document.getElementById('selection-counter') || createSelectionCounter();
  counter.textContent = selectedCount > 0 ? `${selectedCount} items seleccionados` : '';
}

// Función para crear el contador de selección
function createSelectionCounter() {
  const counter = document.createElement('div');
  counter.id = 'selection-counter';
  document.body.appendChild(counter);
  return counter;
}

// Función para mostrar mensajes temporales
function showTemporaryMessage(message) {
  const existingMessage = document.getElementById('temp-message');
  if (existingMessage) existingMessage.remove();
  
  const msgDiv = document.createElement('div');
  msgDiv.id = 'temp-message';
  msgDiv.textContent = message;
  msgDiv.style.position = 'fixed';
  msgDiv.style.bottom = '20px';
  msgDiv.style.right = '20px';
  msgDiv.style.color = 'white';
  msgDiv.style.padding = '8px 15px';
  msgDiv.style.borderRadius = '4px';
  msgDiv.style.zIndex = '1000';
  msgDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  
  document.body.appendChild(msgDiv);
  
  setTimeout(() => {
    msgDiv.style.opacity = '0';
    msgDiv.style.transition = 'opacity 0.5s';
    setTimeout(() => msgDiv.remove(), 500);
  }, 3000);
}

function getSelectedItems(groupId = null) {
  const selectedRows = document.querySelectorAll(
    groupId 
      ? `[data-group-id="${groupId}"] .attribute-table tr.selected` 
      : '.attribute-table tr.selected'
  );
  
  return Array.from(selectedRows).map(row => {
    const sku = row.querySelector('[data-sku]')?.dataset.sku || 
                row.querySelector('a[href*="travers.com.mx"]')?.textContent;
    return filteredItems.find(item => item.SKU === sku);
  }).filter(Boolean);
}

function handleCategoryData(event) {
  const file = event.target.files[0];
  if (!file) return;

  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      categoryData = XLSX.utils.sheet_to_json(sheet);
      
      
      if (filteredItems.length > 0 && filteredItems[0]['CMS IG']) {
        const cmsIgValue = filteredItems[0]['CMS IG'];
        const matchedItem = categoryData.find(item => item.image && item.image.includes(`W${cmsIgValue}.png`));
        
        if (matchedItem) {
          if (matchedItem.table_attributes) {
            let attributesStr = matchedItem.table_attributes;
            if (!attributesStr.includes(',') && attributesStr.includes(' ')) {
              attributesStr = attributesStr.replace(/\s+/g, ',');
            }
            
            const attributes = attributesStr.split(',')
              .map(attr => attr.trim())
              .filter(attr => attr && !['marca', 'sku', 'price'].includes(attr));
            
            defaultAttributesOrder = {};
            attributes.forEach((attr, index) => {
              defaultAttributesOrder[attr] = index + 1;
            });
          }
          
          if (matchedItem.filter_attributes) {
            let filterAttributesStr = matchedItem.filter_attributes;
            if (!filterAttributesStr.includes(',') && filterAttributesStr.includes(' ')) {
              filterAttributesStr = filterAttributesStr.replace(/\s+/g, ',');
            }
            
            const filterAttributes = filterAttributesStr.split(',')
              .map(attr => attr.trim())
              .filter(attr => attr);
            
            defaultFilterAttributes = new Set(filterAttributes);
            forcedFilterAttributes.forEach(attr => {
              defaultFilterAttributes.add(attr);
            });
            
            applyWebFiltersVisualUpdate();
          }
          
          updateOrderInputs();
        }
      }
      
      if (filteredItems.length > 0 && objectData.length > 0) {
        render();
      }
    } catch (error) {
      console.error("Error procesando Category Data:", error);
    }
  };
  reader.readAsArrayBuffer(file);
}

function applyWebFiltersVisualUpdate() {
  if (!defaultFilterAttributes.size) return;

  const filterAttrsArray = Array.from(defaultFilterAttributes);
  
  Object.keys(attributeFilterInputs).forEach(attr => {
    const isActive = defaultFilterAttributes.has(attr);
    const input = attributeFilterInputs[attr];
    
    if (input) {
      if (isActive) {
        const order = filterAttrsArray.indexOf(attr) + 1;
        input.value = order;
        localStorage.setItem(`filter_${attr}`, order.toString());
      } else if (!forcedFilterAttributes.has(attr)) {
        input.value = ''; // Mostrar vacío en lugar de 0
        localStorage.setItem(`filter_${attr}`, '0'); // Guardar 0 internamente
      }
    }
  });
}

function render() {
  attributeStatsDiv.innerHTML = "<p>Generando estadísticas...</p>";
  output.innerHTML = "<p>Preparando visualización...</p>";
  setupFillSequentialBtns();

  setTimeout(() => {
    try {
      const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
      updateOrderInputs();
      processAttributeStats(skuToObject);
      processItemGroups(skuToObject);

      // Asegura que el botón "Agrupar visibles" tenga el handler después de cada render
      setTimeout(() => {
        const btn = document.querySelector('.btn-warning');
        if (btn) btn.onclick = mergeVisibleItemsOnly;
      }, 0);


    } catch (error) {
      console.error("Error en render:", error);
      output.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }, 100);
}


function updateOrderInputs() {
  // Limpia inputs de atributos que NO están en el CMS actual
  const validAttrs = Object.keys(defaultAttributesOrder || {});
  document.querySelectorAll('.order-input, .order-cat-input, .filter-order-input').forEach(input => {
    const attr = input.getAttribute('data-attribute');
    if (!validAttrs.includes(attr)) {
      input.value = '';
      localStorage.removeItem(`order_${attr}`);
      localStorage.removeItem(`cat_order_${attr}`);
      localStorage.removeItem(`filter_${attr}`);
    }
  });

  const inputs = document.querySelectorAll('.order-input, .order-cat-input, .filter-order-input');

inputs.forEach(input => {
  const attribute = input.getAttribute('data-attribute');
  const isCat = input.classList.contains('order-cat-input');
  const savedOrder = localStorage.getItem(isCat ? `cat_order_${attribute}` : `order_${attribute}`);
  if (savedOrder !== null && savedOrder !== undefined && savedOrder !== "") {
    input.value = savedOrder;
  } else if (isCat && defaultCatAttributesOrder[attribute]) {
    input.value = defaultCatAttributesOrder[attribute];
    localStorage.setItem(`cat_order_${attribute}`, defaultCatAttributesOrder[attribute]);
  } else if (!isCat && defaultAttributesOrder[attribute]) {
    input.value = defaultAttributesOrder[attribute];
    localStorage.setItem(`order_${attribute}`, defaultAttributesOrder[attribute]);
  } else {
    input.value = '';
  }
});

  fileInfoDiv.scrollTop = fileInfoDiv.scrollHeight;
}

// Función corregida: applyMultipleFilters
function applyMultipleFilters() {
  if (Object.keys(activeFilters).length === 0) {
    // Mostrar todos los items agrupados, como render()
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
    return;
  }

  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  const filteredSet = new Set();

  filteredItems.forEach(item => {
    const details = skuToObject[item.SKU];
    let matches = true;

    for (const [attr, val] of Object.entries(activeFilters)) {
      const value = (details?.[attr] || "").toString().toLowerCase();

      if (val === '__withValue__') {
        if (!value.trim()) {
          matches = false;
          break;
        }
      } else if (val === '__withoutValue__') {
        if (value.trim()) {
          matches = false;
          break;
        }
      } else {
        if (!value.includes(val.toLowerCase())) {
          matches = false;
          break;
        }
      }
    }

    if (matches) {
      filteredSet.add(item.SKU);
    }
  });

  // Reconstruir items visibles agrupados por grupo
  const groupMap = {};
  const orderedGroupIds = [];

  filteredItems.forEach(item => {
    const groupId = item["IG ID"];
    if (!groupMap[groupId]) {
      groupMap[groupId] = [];
      orderedGroupIds.push(groupId);
    }
    if (filteredSet.has(item.SKU)) {
      groupMap[groupId].push(item);
    }
  });

  const visibleItems = [];
  orderedGroupIds.forEach(groupId => {
    const groupItems = groupMap[groupId];
    if (!groupItems || groupItems.length === 0) return;

    // ORDEN MANUAL DEL USUARIO
    if (!groupOrderMap.has(groupId)) {
      groupOrderMap.set(groupId, groupItems.map(item => item.SKU));
    }
    const orderedSkus = groupOrderMap.get(groupId);
    groupItems.sort((a, b) => orderedSkus.indexOf(a.SKU) - orderedSkus.indexOf(b.SKU));

    visibleItems.push(...groupItems);
  });

  displayFilteredResults(visibleItems);
}

//al aplicar filtros de atributos
function displayFilteredResults(filteredItems) {
  // Guarda la lista filtrada globalmente para mantener el estado tras acciones
  currentFilteredItems = filteredItems;

  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  let filtersHtml = Object.keys(activeFilters).map(attr =>
    `<span class="active-filter-tag" data-attribute="${attr}">
      ${attr}: ${activeFilters[attr]}
      <button class="remove-filter-btn" data-attribute="${attr}">×</button>
    </span>`
  ).join('');
  output.innerHTML = `
    <div class="filter-results">
      <h3>Filtros activos: ${filtersHtml || 'Ninguno'}</h3>
      <p>Mostrando ${filteredItems.length} items</p>
    </div>
  `;

  

  // Listeners para quitar filtros
  document.querySelectorAll('.remove-filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const attr = this.getAttribute('data-attribute');
      delete activeFilters[attr];
      if (Object.keys(activeFilters).length === 0) {
        render();
      } else {
        applyMultipleFilters();
      }
    });
  });

  updateAttributeDropdowns(filteredItems);

  // --- Controles de selección y agrupación ---
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "groups-controls";

  const mergeBtn = document.createElement("button");
  mergeBtn.className = "btn btn-primary";
  mergeBtn.textContent = "Agrupar (bloques)";
  mergeBtn.addEventListener('click', mergeSelectedGroups);

  const mergeVisibleBtn = document.createElement("button");
  mergeVisibleBtn.className = "btn btn-warning";
  mergeVisibleBtn.textContent = "Agrupar visibles";
  mergeVisibleBtn.title = "Agrupa solo los items visibles en pantalla";
mergeVisibleBtn.addEventListener('click', mergeVisibleItemsOnly);
  const selectAllBtn = document.createElement("button");
  selectAllBtn.className = "btn btn-secondary";
  selectAllBtn.textContent = "Seleccionar Todos";
  selectAllBtn.addEventListener('click', selectAllGroups);

  const deselectAllBtn = document.createElement("button");
  deselectAllBtn.className = "btn btn-outline-secondary";
  deselectAllBtn.textContent = "Deseleccionar Todos";
  deselectAllBtn.addEventListener('click', deselectAllGroups);

  const selectionCount = document.createElement("span");
  selectionCount.className = "selection-count";
  selectionCount.textContent = selectedGroups.size > 0 ? `(${selectedGroups.size} seleccionados)` : "";

  controlsDiv.appendChild(mergeBtn);
  controlsDiv.appendChild(mergeVisibleBtn);
  controlsDiv.appendChild(selectAllBtn);
  controlsDiv.appendChild(deselectAllBtn);
  
    controlsDiv.appendChild(selectionCount);
  
const vistaContainer = document.createElement("div");
vistaContainer.style.display = "flex";
vistaContainer.style.alignItems = "center";
vistaContainer.style.marginLeft = "auto";
vistaContainer.style.gap = "6px"; // Espacio pequeño entre icono, label y select

// Icono Bootstrap
const vistaIcon = document.createElement("i");
vistaIcon.className = "bi bi-columns-gap"; // Cambia por el icono que prefieras
vistaIcon.style.fontSize = "1.1em";
vistaIcon.style.marginRight = "2px";

// Label
const vistaLabel = document.createElement("label");
vistaLabel.textContent = "Vista default en Web:";
vistaLabel.style.fontWeight = "600";
vistaLabel.style.fontSize = "1em";
vistaLabel.htmlFor = "viewModeDropdown";
vistaLabel.style.margin = "0";

// Dropdown
const viewDropdown = document.createElement("select");
viewDropdown.className = "form-select view-mode-dropdown";
viewDropdown.style.fontWeight = "500";
viewDropdown.style.fontSize = ".95em";
viewDropdown.id = "viewModeDropdown";
viewDropdown.style.width = "150px";
viewDropdown.title = "Cambiar vista";

["table", "grid", "list"].forEach(opt => {
  const option = document.createElement("option");
  option.value = opt.toLowerCase();
  option.textContent = opt;
  viewDropdown.appendChild(option);
});
  vistaContainer.appendChild(vistaIcon); 
  vistaContainer.appendChild(vistaLabel);
  vistaContainer.appendChild(viewDropdown);
  controlsDiv.appendChild(vistaContainer);
  
  // --- SOLO UNA VEZ, AL FINAL ---
  output.appendChild(controlsDiv);


const cmsIgValue = filteredItems[0]?.['CMS IG'];
if (cmsIgValue && Array.isArray(categoryData)) {
  // Busca la fila donde image === `W${cmsIgValue}.png`
  const matchedItem = categoryData.find(item =>
    item.image && item.image.trim() === `W${cmsIgValue}.png`
  );
  if (matchedItem && matchedItem.enable_table_view) {
    const viewValue = matchedItem.enable_table_view.toLowerCase();
    const option = Array.from(viewDropdown.options).find(opt => opt.value === viewValue);
    if (option) {
      viewDropdown.value = viewValue;
    }
  }
}


  // Agrupar items por grupo
  const groupMap = {};
  const orderedGroupIds = [];
  filteredItems.forEach(item => {
    const groupIdStr = String(item["IG ID"]);
    if (!groupMap[groupIdStr]) {
      groupMap[groupIdStr] = [];
      orderedGroupIds.push(groupIdStr);
    }
    groupMap[groupIdStr].push(item);
  });

// Ordena: merged y split primero, luego el resto
orderedGroupIds.sort((a, b) => {
  const isMergedA = a.startsWith('merged-');
  const isMergedB = b.startsWith('merged-');
  const isSplitA = a.startsWith('split-') || a.startsWith('split-');
  const isSplitB = b.startsWith('split-') || b.startsWith('split-');
  // Merged primero, luego split, luego el resto
  if (isMergedA && !isMergedB) return -1;
  if (!isMergedA && isMergedB) return 1;
  if (isSplitA && !isSplitB) return -1;
  if (!isSplitA && isSplitB) return 1;
  return 0;
});


orderedGroupIds.forEach(groupIdStr => {
  const groupItems = groupMap[groupIdStr]; // <-- Cambia groups por groupMap
  if (!groupItems || !groupItems.length) return;
  const orderedSkus = groupOrderMap.get(groupIdStr);
  let orderedGroupItems = groupItems;
  if (Array.isArray(orderedSkus)) {
    // Solo los SKUs filtrados, pero en el orden original
    orderedGroupItems = orderedSkus
      .map(sku => groupItems.find(item => item.SKU === sku))
      .filter(Boolean);
  }

    const groupInfo = skuToObject[groupIdStr] || {};
    const isMergedGroup = mergedGroups.has(groupIdStr);
const isSeparatedGroup = groupIdStr.startsWith('split-') || groupIdStr.startsWith('split-');    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container filtered-group${isMergedGroup ? ' merged-group' : ''}${isSeparatedGroup ? ' separated-group' : ''}`;
    groupDiv.dataset.groupId = groupIdStr;


    
    // Checkbox de selección
    const checkboxDiv = document.createElement("div");
    checkboxDiv.className = "group-checkbox-container";
    checkboxDiv.innerHTML = `
      <input type="checkbox" class="group-checkbox" id="group-${groupIdStr}" 
             data-group-id="${groupIdStr}"
             ${selectedGroups.has(groupIdStr) ? 'checked' : ''}>
      <label for="group-${groupIdStr}"></label>
    `;
    groupDiv.appendChild(checkboxDiv);

    // --- Header ---
    const headerDiv = document.createElement("div");
    headerDiv.className = "group-header";

    // --- Header content (left + right) ---
    const headerContentDiv = document.createElement("div");
    headerContentDiv.className = "group-header-content";

    // --- Left (image + info) ---
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";
    const productImg = createProductImageElement(groupInfo.image);
    leftContainer.appendChild(productImg);

    const infoDiv = document.createElement("div");
    infoDiv.className = "group-info";
    const title = document.createElement("h2");
    title.className = "group-title";
    const link = document.createElement("a");
    link.href = `https://www.travers.com.mx/${groupIdStr}`;
    link.target = "_blank";
    link.textContent = groupInfo.name || groupIdStr;
    title.appendChild(link);
    infoDiv.appendChild(title);

    const logo = createBrandLogoElement(groupInfo.brand_logo);
    infoDiv.appendChild(logo);

    if (groupInfo.sku) {
      const skuP = document.createElement("p");
      skuP.textContent = "SKU: " + groupInfo.sku;
      infoDiv.appendChild(skuP);
    }
    leftContainer.appendChild(infoDiv);
    headerContentDiv.appendChild(leftContainer);

    // --- Right ---
    const rightContainer = createGroupHeaderRight({
      groupIdStr,
      groupItems,
      skuToObject,
      isMergedGroup,
      groupDiv
    });
    headerContentDiv.appendChild(rightContainer);

    headerDiv.appendChild(headerContentDiv);

    // --- Detalles de grupo unido (si aplica) ---
    if (isMergedGroup) {
      const detailsContainer = document.createElement("div");
      detailsContainer.className = "group-details-container";
      const toggleDetailsBtn = document.createElement("button");
      toggleDetailsBtn.className = "toggle-details-btn";
      toggleDetailsBtn.textContent = "▼ Detalles";
      toggleDetailsBtn.setAttribute("aria-expanded", "false");

      const detailsDiv = document.createElement("div");
      detailsDiv.className = "group-extra-details";
      detailsDiv.style.display = "none";

      const mergedTextarea = document.createElement("textarea");
      mergedTextarea.className = "form-control merged-group-textarea";
      mergedTextarea.rows = 10;
      let mergedContent = getMergedGroupDetails(groupIdStr);
      if (!mergedContent) {
        const mergedGroupData = mergedGroups.get(groupIdStr);
        mergedContent = "";
        mergedGroupData.originalGroups.forEach(originalGroupId => {
          const originalGroupInfo = objectData.find(o => o.SKU === originalGroupId) || {};
          mergedContent += `${originalGroupId}, ${originalGroupInfo.name || ''}, ${originalGroupInfo.brand_logo || ''}\n`;
          const fields = ['ventajas', 'aplicaciones', 'especificaciones', 'incluye'];
          fields.forEach(field => {
            if (originalGroupInfo[field]) {
              let fieldValue = originalGroupInfo[field]
                .replace(/<special[^>]*>|<\/special>|<strong>|<\/strong>/gi, '')
                .replace(/<br\s*\/?>|<\/br>/gi, '\n');
              mergedContent += `${field.charAt(0).toUpperCase() + field.slice(1)}:\n${fieldValue}\n\n`;
            }
          });
          mergedContent += "--------------------\n\n";
        });
      }
      mergedTextarea.value = mergedContent.trim();
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-sm btn-primary save-merged-btn";
      saveBtn.textContent = "Guardar Cambios";
      saveBtn.addEventListener('click', function() {
        saveMergedGroupDetails(groupIdStr, mergedTextarea.value);
      });
      detailsDiv.appendChild(mergedTextarea);
      detailsDiv.appendChild(saveBtn);
      toggleDetailsBtn.addEventListener("click", function () {
        const expanded = toggleDetailsBtn.getAttribute("aria-expanded") === "true";
        toggleDetailsBtn.setAttribute("aria-expanded", !expanded);
        detailsDiv.style.display = expanded ? "none" : "block";
        toggleDetailsBtn.textContent = expanded ? "▼ Detalles" : "▲ Detalles";
      });
      detailsContainer.appendChild(toggleDetailsBtn);
      detailsContainer.appendChild(detailsDiv);
      headerDiv.appendChild(detailsContainer);
    }

    groupDiv.appendChild(headerDiv);

    // --- Items table ---
    createItemsTable(groupDiv, groupItems, skuToObject);

    output.appendChild(groupDiv);

    // Checkbox handler
    const groupCheckbox = groupDiv.querySelector('.group-checkbox');
    if (groupCheckbox) {
      groupCheckbox.addEventListener('change', function() {
        if (this.checked) selectedGroups.add(this.dataset.groupId);
        else selectedGroups.delete(this.dataset.groupId);
        selectionCount.textContent = selectedGroups.size > 0 ? `(${selectedGroups.size} seleccionados)` : "";
      });
    }
  });
}


function getAttributeStatsForItems(items) {
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  const stats = {};

  items.forEach(item => {
    const details = skuToObject[item.SKU] || {};
    for (const key in details) {
      if (key === "SKU" || excludedAttributes.has(key)) continue;
      
      if (!stats[key]) {
        stats[key] = new Map();
      }

      const rawValue = details[key]?.toString().trim();
      if (rawValue) {
        stats[key].set(rawValue, (stats[key].get(rawValue) || 0) + 1);
      }
    }
  });

  return stats;
}

function updateAttributeDropdowns(filteredItems) {
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  const stats = getAttributeStatsForItems(filteredItems);

  document.querySelectorAll('.attribute-dropdown').forEach(dropdown => {
    const attribute = dropdown.getAttribute('data-attribute');
    const currentValue = dropdown.value;
    
    // Solo actualizar si no es un filtro activo o si el valor actual ya no existe
    if (!activeFilters[attribute] || !stats[attribute] || !stats[attribute].has(activeFilters[attribute])) {
      const newDropdown = createAttributeDropdown(attribute, stats[attribute], filteredItems);
      dropdown.outerHTML = newDropdown;
      
      // Restaurar el valor si era un filtro activo
      const newDropdownElement = document.querySelector(`.attribute-dropdown[data-attribute="${attribute}"]`);
      if (activeFilters[attribute]) {
        newDropdownElement.value = activeFilters[attribute];
      }
      
      // Restaurar el evento
      newDropdownElement.addEventListener('change', function() {
        filterItemsByAttributeValue(attribute, this.value);
      });
    }
  });
}

function handleDropdownFilter(e) {
  const attribute = e.target.getAttribute('data-attribute');
  const value = e.target.value;

  if (value) {
    activeFilters[attribute] = value;
  } else {
    delete activeFilters[attribute];
  }
  // Nueva lógica:
  if (Object.keys(activeFilters).length === 0) {
    render();
  } else {
    applyMultipleFilters();
  }
}

// Asignar el evento a los dropdowns
document.querySelectorAll('.attribute-dropdown').forEach(dropdown => {
  dropdown.addEventListener('change', handleDropdownFilter);
});


function processAttributeStats(skuToObject) {
  const usedInTables = new Set();
  const itemCounts = {};
  const attributeValues = {};

  for (const item of filteredItems) {
    const details = skuToObject[item.SKU];
    if (!details) continue;

    for (const key in details) {
      if (key === "SKU" || excludedAttributes.has(key)) continue;
      
      if (!itemCounts[key]) {
        itemCounts[key] = { withValue: 0, withoutValue: 0 };
        attributeValues[key] = new Map();
      }

      const rawValue = details[key]?.toString().trim();
      if (rawValue) {
        itemCounts[key].withValue++;
        usedInTables.add(key);
        
        if (attributeValues[key].has(rawValue)) {
          attributeValues[key].set(rawValue, attributeValues[key].get(rawValue) + 1);
        } else {
          attributeValues[key].set(rawValue, 1);
        }
      } else {
        itemCounts[key].withoutValue++;
      }
    }
  }

  // Separar los atributos prioritarios del resto
  const priorityStats = [];
  const otherStats = [];
  
  Array.from(usedInTables).forEach(attr => {
    const stat = {
      attribute: attr,
      withValue: itemCounts[attr].withValue,
      withoutValue: itemCounts[attr].withoutValue,
      uniqueValues: attributeValues[attr]
    };
    if (priorityStatsAttributes.includes(attr)) {
      priorityStats.push(stat);
    } else {
      otherStats.push(stat);
    }
  });

  // ----------- INICIO CAMBIO: incluir atributos extras seleccionados manualmente -----------
  if (window.extraStatsAttributes) {
    window.extraStatsAttributes.forEach(attr => {
      if (!priorityStats.find(s => s.attribute === attr) && !otherStats.find(s => s.attribute === attr)) {
        otherStats.push({
          attribute: attr,
          withValue: 0,
          withoutValue: filteredItems.length,
          uniqueValues: new Map(),
        });
      }
    });
  }
  // ----------- FIN CAMBIO -----------

  let stats = [...priorityStats, ...otherStats].filter(s => s.attribute !== "product_ranking");

  stats = stats.sort((a, b) => {
  // marca y titulo siempre primero
  if (a.attribute === "marca") return -5;
  if (b.attribute === "marca") return 5;
  if (a.attribute === "titulo") return -4;
  if (b.attribute === "titulo") return 4;

  if (a.attribute === "catalog_page_number") return -3;
  if (b.attribute === "catalog_page_number") return 3;

  if (a.attribute === "item_group_id") return -2;
  if (b.attribute === "item_group_id") return 2;

      if (a.attribute === "orden_tabla") return -1;
  if (b.attribute === "orden_tabla") return 1;

  // luego por cantidad de valores con valor (descendente)
  return b.withValue - a.withValue;
});
  // ===> FIN CAMBIO <===

  if (stats.length) {
    attributeStatsDiv.innerHTML = '';
    const statsContainer = document.createElement("div");
    statsContainer.className = "stats-container";
    
    if (stats.length > 100) {
      const half = Math.ceil(stats.length / 2);
      const firstHalf = stats.slice(0, half);
      const secondHalf = stats.slice(half);
      statsContainer.appendChild(createStatsColumn(firstHalf));
      statsContainer.appendChild(createStatsColumn(secondHalf));
    } else {
      statsContainer.className += " single-column";
      statsContainer.appendChild(createStatsColumn(stats));
    }
    
    attributeStatsDiv.appendChild(statsContainer);
    highlightActiveFilter();
    setupFillSequentialBtns();
  } else {
    attributeStatsDiv.innerHTML = '<p>No hay atributos usados en las tablas</p>';
  }
}

function fillSequentialOrder(columnType) {
  let selector, storagePrefix, label;
  if (columnType === 'web') {
    selector = 'input.order-input:not(.order-cat-input)';
    storagePrefix = 'order_';
    label = 'WEB';
  } else {
    selector = 'input.order-cat-input:not(.order-input)';
    storagePrefix = 'cat_order_';
    label = 'CAT';
  }
  const excludedAttributes = new Set(["titulo", "marca", "shop_by", "no_de_modelo"]);
  const inputs = Array.from(document.querySelectorAll(selector))
    .filter(input => !excludedAttributes.has(input.getAttribute('data-attribute')));

  let count = 1;
  inputs.forEach(input => {
    const attr = input.getAttribute('data-attribute');
    input.value = count;
    localStorage.setItem(storagePrefix + attr, String(count));
    count++;
  });

  // updateOrderInputs(); // Descomenta sólo si sabes que no sincroniza ambas columnas
  showTemporaryMessage(`Orden secuencial aplicado para ${label}: ${inputs.length} atributos llenados`);
}

function setupFillSequentialBtns() {
  const fillWebBtn = document.getElementById('stats-fillWebSequentialBtn');
  const fillCatBtn = document.getElementById('stats-fillCatSequentialBtn');

  if (fillWebBtn) {
    fillWebBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fillSequentialOrder('web');
    });
  }

  if (fillCatBtn) {
    fillCatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fillSequentialOrder('cat');
    });
  }
}


function createStatsColumn(stats) {
  const colWidthAtributo = 'auto';
  const colMinWidthAtributo = '120px';
  const colWidthFiltro = '50px';
  const colWidthWeb = '55px';
  const colWidthCat = '55px';
  const colWidthConValor = '40px'; 
  const colWidthSinValor = '40px';

  const column = document.createElement("div");
  column.className = "stats-column";
  
  
  const table = document.createElement("table");
  table.className = "table table-sm table-bordered attribute-stats-table";
  table.style.tableLayout = "fixed";

  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:${colWidthAtributo}; min-width:${colMinWidthAtributo}; position:relative;">
          <div class="att-header-toggle-container">
            <button type="button" id="stats-toggleEmptyBtn" class="att-header-toggle-btn" title="Mostrar/Ocultar atributos vacíos">
              <span class="toggle-content">
                Vacíos
                <span class="toggle-state">${showEmptyAttributes ? 'On' : 'Off'}</span>
              </span>
            </button>
          </div>
 <div class="attribute-header-wrapper">
  Atributo
  <button type="button" id="stats-addAttributeBtn" class="btn-clear-filter" title="Agregar atributos">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  </button>
  <button type="button" id="stats-sortAlphaBtn" class="btn-clear-filter" title="Ordenar alfabéticamente">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <text x="9" y="16" font-size="15" fill="currentColor">A</text>
    </svg>
  </button>
  <button class="btn-clear-filter" title="Limpiar filtros" type="button">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  </button>
</div>
        </th>
 <th style="width:${colWidthFiltro}; min-width:${colWidthFiltro}; position:relative;">
  <div class="filter-header-icons">
<button type="button" id="stats-loadDefaultFiltersBtn" class="web-header-icon-btn" title="Aplicar Filtros Actuales">
<i class="bi bi-folder" style="font-size: 1.2em;"></i>
</button>
<button type="button" id="stats-clearFilterInputsBtn" class="web-header-icon-btn" title="Limpiar Filtros Nuevos">
<i class="bi bi-trash3"></i>
</button>
  </div>
  <div class="filter-header-divider"></div>
  Filtro
</th>
        <th style="width:${colWidthWeb}; min-width:${colWidthWeb}; position:relative;">
  <div class="web-header-icons grid-2x2">
  <button type="button" id="stats-loadWebOrderBtn" class="web-header-icon-btn filter-header-icon-btn" title="Aplicar Web Actual">
<i class="bi bi-folder" style="font-size: 1.2em;"></i>
  </button>
  <button type="button" id="stats-fillWebSequentialBtn" class="web-header-icon-btn filter-header-icon-btn" title="Autoordenar Web">
    <i class="bi bi-card-checklist" style="font-size: 1.2em;"></i>
  </button>
  <button type="button" id="stats-applyOrderBtn" class="web-header-icon-btn filter-header-icon-btn" title="Aplicar Web Nuevas">
    <i class="bi bi-check-circle" style="font-size: 1.1em;"></i>
  </button>
  <button type="button" id="stats-clearOrderBtn" class="web-header-icon-btn filter-header-icon-btn" title="Limpiar Web Nuevas">
<i class="bi bi-trash3"></i>
  </button>
  </div>
  <div class="web-header-divider"></div>
 <span id="copyWebToCat" class="copy-header-label" style="cursor:pointer;">Web ⏵</span>
 </th>
        <th style="width:${colWidthCat}; min-width:${colWidthCat}; position:relative;">
<div class="cat-header-icons grid-2x2">
  <button type="button" id="stats-applyCatTablesBtn" class="cat-header-icon-btn filter-header-icon-btn" title="Aplicar Catálogo Actual">
<i class="bi bi-folder" style="font-size: 1.2em;"></i>
  </button>
  <button type="button" id="stats-fillCatSequentialBtn" class="cat-header-icon-btn filter-header-icon-btn" title="Autoordenar Catálogo">
    <i class="bi bi-card-checklist" style="font-size: 1.2em;"></i>
  </button>
  <button type="button" id="stats-applyCatOrderBtn" class="cat-header-icon-btn filter-header-icon-btn" title="Aplicar Catálogo Nuevas">
    <i class="bi bi-check-circle" style="font-size: 1.1em;"></i>
  </button>
  <button type="button" id="stats-clearCatOrderBtn" class="cat-header-icon-btn filter-header-icon-btn" title="Limpiar Catálogo Nuevas">
<i class="bi bi-trash3"></i>
  </button>
</div>
  <div class="cat-header-divider"></div>
  <span id="copyCatToWeb" class="copy-header-label" style="cursor:pointer;">⏴ Cat</span>
</th>
        <th style="width:${colWidthConValor}; min-width:${colWidthConValor};">Con</th>
        <th style="width:${colWidthSinValor}; min-width:${colWidthSinValor};">Sin</th>
      </tr>
    </thead>
    <tbody>
      ${stats.map(stat => {
        // Orden Web
        const savedOrder = localStorage.getItem(`order_${stat.attribute}`);
        const defaultValue = defaultAttributesOrder[stat.attribute];
        const displayValue = (savedOrder !== null && savedOrder !== undefined) ? savedOrder : (defaultValue || '');

        // Orden Cat
        const savedCatOrder = localStorage.getItem(`cat_order_${stat.attribute}`);
        const catDisplayValue = (savedCatOrder !== null && savedCatOrder !== undefined) ? savedCatOrder : '';

        // Filtro: localStorage tiene máxima prioridad
        const savedFilter = localStorage.getItem(`filter_${stat.attribute}`);
        let filterValue = '';
        if (savedFilter !== null && savedFilter !== undefined && savedFilter !== '0') {
          filterValue = savedFilter;
        } else if (
          defaultFilterAttributes.size > 0 &&
          defaultFilterAttributes.has(stat.attribute)
        ) {
          const order = Array.from(defaultFilterAttributes).indexOf(stat.attribute) + 1;
          filterValue = order.toString();
        } else {
          filterValue = '';
        }

        // Crear dropdown para el atributo
        const dropdown = createAttributeDropdown(stat.attribute, stat.uniqueValues);

        return `
        <tr>
          <td style="width:${colWidthAtributo}; min-width:${colMinWidthAtributo};">${dropdown}</td>
          <td style="width:${colWidthFiltro}; min-width:${colWidthFiltro};">
            <div class="filter-input-container">
              <input type="number" min="0" class="filter-order-input form-control form-control-sm" 
                   data-attribute="${stat.attribute}" 
                   value="${filterValue}">
            </div>
          </td>
          <td style="width:${colWidthWeb}; min-width:${colWidthWeb};">
            <input type="number" min="1" class="order-input form-control form-control-sm" 
                   data-attribute="${stat.attribute}" 
                   value="${displayValue}">
          </td>
          <td style="width:${colWidthCat}; min-width:${colWidthCat};">
            <input type="number" min="1" class="order-cat-input form-control form-control-sm" 
                   data-attribute="${stat.attribute}" 
                   value="${catDisplayValue}">
          </td>
          <td style="width:${colWidthConValor}; min-width:${colWidthConValor};" class="clickable with-value" 
              data-attribute="${stat.attribute}" 
              data-type="withValue">${stat.withValue}</td>
          <td style="width:${colWidthSinValor}; min-width:${colWidthSinValor};" class="clickable without-value" 
              data-attribute="${stat.attribute}" 
              data-type="withoutValue">${stat.withoutValue}</td>
        </tr>
      `;
      }).join('')}
    </tbody>
  `;

  // --- Listener para el botón "+" ---
  const statsAddAttributeBtn = table.querySelector('#stats-addAttributeBtn');
  if (statsAddAttributeBtn) {
    statsAddAttributeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openAddStatsAttributeModal();
    });
  }
const statsSortAlphaBtn = table.querySelector('#stats-sortAlphaBtn');
if (statsSortAlphaBtn) {
  statsSortAlphaBtn.addEventListener('click', function(e) {
    e.preventDefault();
    const isCurrentlyAlpha = column.getAttribute('data-alpha') === 'true';
    let newColumn;
    if (!isCurrentlyAlpha) {
      // Guarda el orden original solo la primera vez
      if (!window.statsOriginalOrder) window.statsOriginalOrder = [...stats];
      const sortedStats = [...stats].sort((a, b) => a.attribute.localeCompare(b.attribute));
      newColumn = createStatsColumn(sortedStats, true);
      newColumn.setAttribute('data-alpha', 'true');
    } else {
      newColumn = createStatsColumn(window.statsOriginalOrder, false);
      newColumn.setAttribute('data-alpha', 'false');
    }
    column.parentNode.replaceChild(newColumn, column);
  });
}
  // --------- LISTENERS ---------
  // Limpiar filtros generales
const clearFilterBtn = table.querySelector('.btn-clear-filter[title="Limpiar filtros"]');
if (clearFilterBtn) {
  clearFilterBtn.addEventListener('click', function() {
    clearAllFilters();
  });
}
  // Dropdowns de atributo
  table.querySelectorAll('.attribute-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', function() {
      const attribute = this.getAttribute('data-attribute');
      const value = this.value;
      filterItemsByAttributeValue(attribute, value);
    });
  });
  // Inputs de filtro
  table.querySelectorAll('.filter-order-input').forEach(input => {
    const attribute = input.getAttribute('data-attribute');
    attributeFilterInputs[attribute] = input;
    input.addEventListener('change', function() {
      const value = this.value.trim();
      const numericValue = parseInt(value) || 0;
      if (value === '' || numericValue === 0) {
        this.value = '';
        localStorage.setItem(`filter_${attribute}`, '0');
      } else {
        this.value = numericValue;
        localStorage.setItem(`filter_${attribute}`, numericValue.toString());
      }
    });
  });

const statsApplyCatTablesBtn = table.querySelector('#stats-applyCatTablesBtn');
if (statsApplyCatTablesBtn) {
  statsApplyCatTablesBtn.addEventListener('click', function(e) {
    e.preventDefault();

    // 1. Obtener el CMS IG actual
    const cmsIgValue = filteredItems[0]?.['CMS IG'];
    if (!cmsIgValue || !Array.isArray(categoryData)) {
      showTemporaryMessage('No hay CMS IG seleccionado o categoryData vacío');
      return;
    }

    // 2. Buscar la fila de categoryData para el CMS actual
    const matchedItem = categoryData.find(item =>
      item.image && item.image.trim() === `W${cmsIgValue}.png`
    );
    if (!matchedItem || !matchedItem.cat_attributes) {
      showTemporaryMessage('No hay atributos de catálogo para esta categoría');
      return;
    }

    // 3. Procesar los atributos y valores
    let catAttributesStr = matchedItem.cat_attributes;
    if (!catAttributesStr.includes(',') && catAttributesStr.includes(' ')) {
      catAttributesStr = catAttributesStr.replace(/\s+/g, ',');
    }
    const catAttributes = catAttributesStr.split(',').map(attr => attr.trim()).filter(Boolean);

    // 4. Actualizar los inputs de orden Cat con los atributos de cat_attributes
    catAttributes.forEach((attr, idx) => {
      const input = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
      if (input) {
        input.value = idx + 1;
        localStorage.setItem(`cat_order_${attr}`, (idx + 1).toString());
      }
    });

    // 5. Limpiar los que no están en cat_attributes
    document.querySelectorAll('.order-cat-input').forEach(input => {
      const attr = input.getAttribute('data-attribute');
      if (!catAttributes.includes(attr)) {
        input.value = '';
        localStorage.removeItem(`cat_order_${attr}`);
      }
    });

    // 6. Aplica el orden de catálogo en la tabla (igual que applyCatOrder)
    if (objectData.length && filteredItems.length) {
      // Guarda los órdenes de catálogo
      document.querySelectorAll('.order-cat-input').forEach(input => {
        const attribute = input.getAttribute('data-attribute');
        const value = input.value.trim();
        if (value) {
          localStorage.setItem(`cat_order_${attribute}`, value);
        } else {
          localStorage.removeItem(`cat_order_${attribute}`);
        }
      });

      // Procesa los grupos con el orden de catálogo
      const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
      processItemGroups(skuToObject);
    }

    showTemporaryMessage('Atributos de catálogo aplicados desde category-data');
  });
}

  // Inputs de orden
  table.querySelectorAll('.order-input, .order-cat-input').forEach(input => {
    input.addEventListener('change', saveAttributeOrder);
  });
  // Celdas de click
  table.querySelectorAll('.clickable').forEach(cell => {
    cell.addEventListener('click', handleStatClick);
  });

  // --------- Toggle atributos vacíos ---------
  const statsToggleEmptyBtn = table.querySelector('#stats-toggleEmptyBtn');
  if (statsToggleEmptyBtn) {
    function setToggleUI() {
      const toggleState = statsToggleEmptyBtn.querySelector('.toggle-state');
      if (showEmptyAttributes) {
        statsToggleEmptyBtn.classList.add('active');
        toggleState.textContent = 'On';
      } else {
        statsToggleEmptyBtn.classList.remove('active');
        toggleState.textContent = 'Off';
      }
    }
    setToggleUI();
    statsToggleEmptyBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof toggleEmptyAttributes === 'function') {
        toggleEmptyAttributes();
        setToggleUI();
      }
    });
  }

  // --------- Listeners Header Filtro ---------
  const statsLoadDefaultFiltersBtn = table.querySelector('#stats-loadDefaultFiltersBtn');
  if (statsLoadDefaultFiltersBtn) {
    statsLoadDefaultFiltersBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof loadDefaultFilters === 'function') loadDefaultFilters();
    });
  }
  const statsClearFilterInputsBtn = table.querySelector('#stats-clearFilterInputsBtn');
  if (statsClearFilterInputsBtn) {
    statsClearFilterInputsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof clearFilterInputs === 'function') clearFilterInputs();
    });
  }

  // --------- Listeners Header Web ---------
  const statsLoadWebOrderBtn = table.querySelector('#stats-loadWebOrderBtn');
  if (statsLoadWebOrderBtn) {
    statsLoadWebOrderBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof loadWebOrder === 'function') loadWebOrder();
    });
  }
  const statsApplyOrderBtn = table.querySelector('#stats-applyOrderBtn');
  if (statsApplyOrderBtn) {
    statsApplyOrderBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof applyOrder === 'function') applyOrder();
    });
  }
  const statsClearOrderBtn = table.querySelector('#stats-clearOrderBtn');
  if (statsClearOrderBtn) {
    statsClearOrderBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof clearAttributeOrder === 'function') clearAttributeOrder();
    });
  }

  // --------- Listeners Header Cat ---------

  const statsApplyCatOrderBtn = table.querySelector('#stats-applyCatOrderBtn');
  if (statsApplyCatOrderBtn) {
    statsApplyCatOrderBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof applyCatOrder === 'function') applyCatOrder();
    });
  }
  const statsClearCatOrderBtn = table.querySelector('#stats-clearCatOrderBtn');
  if (statsClearCatOrderBtn) {
    statsClearCatOrderBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof clearCatOrder === 'function') clearCatOrder();
    });
  }

 

  // --------- OPCIONAL: CSS global para feedback visual de hover ---------
  if (!document.getElementById('stats-header-pointer-css')) {
    const style = document.createElement('style');
    style.id = 'stats-header-pointer-css';
    style.innerHTML = `
    `;
    document.head.appendChild(style);
  }
  // --------- COPIAR ORDEN ENTRE WEB Y CAT SOLO EN EL SPAN ---------
setTimeout(() => {
  // Web → Cat
  const copyWebToCat = table.querySelector('#copyWebToCat');
  if (copyWebToCat) {
    copyWebToCat.addEventListener('click', function (e) {
      e.stopPropagation();
      document.querySelectorAll('.order-input:not(.order-cat-input)').forEach(webInput => {
        const attr = webInput.getAttribute('data-attribute');
        const catInput = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
        if (catInput) {
          catInput.value = webInput.value;
          localStorage.setItem(`cat_order_${attr}`, webInput.value);
        }
      });
      showTemporaryMessage('Valores de Web copiados a Catálogo');
    });
  }
  // Cat → Web
  const copyCatToWeb = table.querySelector('#copyCatToWeb');
  if (copyCatToWeb) {
    copyCatToWeb.addEventListener('click', function (e) {
      e.stopPropagation();
      document.querySelectorAll('.order-cat-input').forEach(catInput => {
        const attr = catInput.getAttribute('data-attribute');
        const webInput = document.querySelector(`.order-input[data-attribute="${attr}"]:not(.order-cat-input)`);
        if (webInput) {
          webInput.value = catInput.value;
          localStorage.setItem(`order_${attr}`, catInput.value);
        }
      });
      showTemporaryMessage('Valores de Catálogo copiados a Web');
    });
  }
}, 0);

  column.appendChild(table);
  return column;
}


let addAttributesModalState = { available: [], selected: [] };

function openAddAttributesModal() {
  // 1. Obtener todos los atributos posibles de objectData excluyendo los de la lista negra
  const blacklist = new Set([
    "SKU", "product.type", "url_key", "product.attribute_set", "product.websites",
    "product.required_options", "stock.manage_stock", "stock.qty", "Price", "Price_View",
    "Short_Description", "Status", "Tax_class_id", "Visibility", "Weight", "name",
    "category.name", "leaf_name_filter", "item_group_id", "catalog_page_number",
    "catalog_cover_image", "image", "small_image", "thumbnail", "ShortDescription",
    "description", "pdp_display_attribute", "pdp_description_attribute", "pdp_short_description_attribute",
    "icon_order", "orden_cms", "algolia_synced_ids", "cost", "manufactuer", "on_order_qty"
  ]);
  // Todos los keys de objectData
  let allAttrs = new Set();
  objectData.forEach(obj => Object.keys(obj).forEach(k => allAttrs.add(k)));
  // Excluye ya los de la tabla de stats actual
  document.querySelectorAll('.attribute-stats-table tbody tr').forEach(row => {
    const attr = row.querySelector('td select')?.getAttribute('data-attribute');
    if (attr) blacklist.add(attr);
  });
  const available = Array.from(allAttrs).filter(attr => !blacklist.has(attr));
  addAttributesModalState.available = available;
  addAttributesModalState.selected = [];

  // 2. Render dual-list
  const dualListDiv = document.getElementById('addAttrDualList');
  dualListDiv.innerHTML = `
    <div class="dual-list-modal compact">
      <div class="dual-list-col">
        <div class="dual-list-label">Disponibles</div>
        <ul id="addAttr-available" class="dual-list-box" tabindex="0">
          ${available.map(attr => `<li tabindex="0">${attr}</li>`).join('')}
        </ul>
      </div>
      <div class="dual-list-controls">
        <button id="addAttr-add" class="dual-list-btn compact-btn">&rarr;</button>
        <button id="addAttr-remove" class="dual-list-btn compact-btn">&larr;</button>
      </div>
      <div class="dual-list-col">
        <div class="dual-list-label">Seleccionados</div>
        <ul id="addAttr-selected" class="dual-list-box dual-list-selected" tabindex="0"></ul>
      </div>
    </div>
  `;
  // Listeners para dual-list
  setupDualListEvents('addAttr');
  document.getElementById('addAttributesModal').style.display = 'block';
  document.getElementById('addAttrConfirmBtn').onclick = confirmAddAttributesModal;
}
function closeAddAttributesModal() {
  document.getElementById('addAttributesModal').style.display = 'none';
  addAttributesModalState = { available: [], selected: [] };
}

function showExportChangesModal(onExportNew, onExportOriginal, onCancel) {
  // Si ya existe, elimínalo primero
  const prev = document.getElementById('exportChangesModal');
  if (prev) prev.remove();

  const modal = document.createElement('div');
  modal.id = 'exportChangesModal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="group-sort-modal-backdrop"></div>
    <div class="group-sort-modal-content">
      <h3>Cambios detectados</h3>
      <div style="margin-bottom:16px;">
        El orden de los atributos ha cambiado.<br>
        ¿Qué versión quieres exportar?
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="exportNewBtn" class="btn btn-primary btn-sm">Nuevos</button>
        <button id="exportOriginalBtn" class="btn btn-outline-primary btn-sm">Originales</button>
        <button id="exportCancelBtn" class="btn btn-outline-secondary btn-sm">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('exportNewBtn').onclick = () => { modal.remove(); onExportNew(); };
  document.getElementById('exportOriginalBtn').onclick = () => { modal.remove(); onExportOriginal(); };
  document.getElementById('exportCancelBtn').onclick = () => { modal.remove(); if (onCancel) onCancel(); };
}

function exportAllDataCustomCore(useOriginals, cmsSet, attributes, atributosCols, currentViewValue, cmsIg) {
  const wb = XLSX.utils.book_new();

  // ===== 1. Hoja "Atributos" =====
  const atributosData = [];
  cmsSet.forEach(cmsIgVal => {
    attributes.forEach(attr => {
      let filtroVal, webVal, catVal;
      if (useOriginals) {
        // Busca en filteredItemsOriginalStats
        const originalItem = (window.filteredItemsOriginalStats || []).find(item => item["CMS IG"] === cmsIgVal);
        filtroVal = originalItem ? (originalItem[attr + "_filtros"] || "") : "";
        webVal = originalItem ? (originalItem[attr + "_web"] || "") : "";
        catVal = originalItem ? (originalItem[attr + "_cat"] || "") : "";
      } else {
        // Toma los valores actuales de los inputs
        const filtroInput = document.querySelector(`.filter-order-input[data-attribute="${attr}"]`);
        const catInput = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
        const webInput = document.querySelector(`.order-input[data-attribute="${attr}"]`);
        filtroVal = filtroInput ? (filtroInput.value || "") : "";
        webVal = webInput ? (webInput.value || "") : "";
        catVal = catInput ? (catInput.value || "") : "";
      }
      atributosData.push({
        "CMS IG": cmsIgVal,
        "Atributo": attr,
        "Filtros": filtroVal,
        "Web": webVal,
        "Cat": catVal,
        "enable_table_view": currentViewValue
      });
    });
  });

  const wsAtributos = XLSX.utils.json_to_sheet(atributosData.length ? atributosData : [{}], { header: atributosCols });
  XLSX.utils.sheet_add_aoa(wsAtributos, [atributosCols], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsAtributos, "Atributos");

  // ===== 2. Hoja "Orden Grupos" =====
  const originalOrderByGroup = {};
  filteredItems.forEach(item => {
    const igidStr = String(item["IG ID"]);
    if (!originalOrderByGroup[igidStr]) originalOrderByGroup[igidStr] = [];
    originalOrderByGroup[igidStr].push(item.SKU);
  });
  const ordenExportData = [];
  if (typeof groupOrderMap.entries === "function") {
    for (const [igid, currentOrder] of groupOrderMap.entries()) {
      const igidStr = String(igid);
      if (igidStr.startsWith('merged-')) continue;
      if (!Array.isArray(currentOrder)) continue;
      const originalOrder = originalOrderByGroup[igidStr] || [];
      const changed = originalOrder.length === currentOrder.length &&
        originalOrder.some((sku, idx) => sku !== currentOrder[idx]);
      if (!changed) continue;
      let groupObj = objectData.find(o => String(o.SKU) === igidStr);
      if (!groupObj) {
        groupObj = objectData.find(o => String(o["IG ID"]) === igidStr);
      }
      const titulo = groupObj && groupObj.name ? groupObj.name : "";
      currentOrder.forEach(sku => {
        ordenExportData.push({
          "IG ID": igidStr,
          "titulo": titulo,
          "Sku": sku
        });
      });
    }
  }
  const ordenCols = ["IG ID", "titulo", "Sku"];
  const wsOrden = XLSX.utils.json_to_sheet(ordenExportData.length ? ordenExportData : [{}], { header: ordenCols });
  XLSX.utils.sheet_add_aoa(wsOrden, [ordenCols], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsOrden, "Orden Grupos");

  // ===== 3. Hoja "Merged" =====
  const mergedExportData = [];
  if (typeof groupOrderMap.entries === "function") {
    for (const [igid, currentOrder] of groupOrderMap.entries()) {
      const igidStr = String(igid);
      let groupObj = objectData.find(o => String(o.SKU) === igidStr);
      if (!groupObj) {
        groupObj = objectData.find(o => String(o["IG ID"]) === igidStr);
      }
      const hasItems = filteredItems.some(item => String(item["IG ID"]) === igidStr);
      if (!groupObj || !hasItems || !Array.isArray(currentOrder)) continue;
      let titulo = "";
      const titleInput = document.querySelector(`.group-container[data-group-id="${igidStr}"] .group-title-input`);
      if (titleInput && titleInput.value) {
        titulo = titleInput.value;
      } else {
        titulo = groupObj.name || "";
      }
      let detalles = "";
      const detailsInput = document.querySelector(`.group-container[data-group-id="${igidStr}"] .merged-group-textarea`);
      if (detailsInput && detailsInput.value) {
        detalles = detailsInput.value.trim();
      } else {
        detalles =
          groupObj.details ||
          groupObj.detalles ||
          groupObj.ventajas ||
          groupObj.descripcion ||
          "";
      }
      currentOrder.forEach(sku => {
        const item = filteredItems.find(i => i.SKU === sku && String(i["IG ID"]) === igidStr);
        const originalIGID = item?.__originalIGID || item?.["Original IG ID"] || "";
        mergedExportData.push({
          "ID": igidStr,
          "IG ID Original": originalIGID,
          "titulo": titulo,
          "Detalles": detalles,
          "Sku": sku
        });
      });
    }
  }
  const mergedCols = ["ID", "IG ID Original", "titulo", "Detalles", "Sku"];
  const wsMerged = XLSX.utils.json_to_sheet(mergedExportData.length ? mergedExportData : [{}], { header: mergedCols });
  XLSX.utils.sheet_add_aoa(wsMerged, [mergedCols], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsMerged, "Merged");

  // ===== 4. Hoja "Valores Nuevos" =====
  const originalMap = Object.fromEntries(objectDataOriginal.map(o => [o.SKU, o]));
  const allAttrsChanged = new Set();
  const changedByUser = {};

  objectData.forEach(obj => {
    const sku = obj.SKU;
    const original = originalMap[sku] || {};
    const changes = {};

    Object.keys(obj).forEach(attr => {
      if (attr === "SKU" || excludedAttributes.has(attr)) return;
      const oldVal = (original[attr] || "").toString().trim();
      const newVal = (obj[attr] || "").toString().trim();

      if (oldVal !== newVal) {
        changes[attr] = (oldVal && !newVal) ? '<NULL>' : newVal;
        allAttrsChanged.add(attr);
      }
    });

    if (Object.keys(changes).length > 0) {
      changedByUser[sku] = changes;
    }
  });

  const validKeys = new Set(
    Object.keys(objectDataOriginal[0] || {}).filter(k => k !== "SKU" && !excludedAttributes.has(k))
  );
  const safeAttrsChanged = Array.from(allAttrsChanged).filter(attr => validKeys.has(attr));
  const valoresCols = ["SKU", ...safeAttrsChanged];

  const valoresExport = [];
  Object.entries(changedByUser).forEach(([sku, attrs]) => {
    const row = { "SKU": sku };
    valoresCols.slice(1).forEach(attr => {
      row[attr] = attrs[attr] || "";
    });
    valoresExport.push(row);
  });

  const wsValores = XLSX.utils.json_to_sheet(
    valoresExport.length ? valoresExport : [{}],
    { header: valoresCols.length > 1 ? valoresCols : ["SKU"] }
  );
  XLSX.utils.sheet_add_aoa(wsValores, [valoresCols.length > 1 ? valoresCols : ["SKU"]], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsValores, "Valores Nuevos");

  // ===== 5. Hoja "Valores Nuevos Grupos" =====
  const valoresNuevosGrupos = [];
  const grupoCols = ["IG ID", "titulo", "detalles"];

  groupOrderMap.forEach((currentOrder, igid) => {
    const igidStr = String(igid);
    let groupObj = objectData.find(o => String(o.SKU) === igidStr);
    if (!groupObj) {
      groupObj = objectData.find(o => String(o["IG ID"]) === igidStr);
    }
    const originalObj = (window.originalGroupData || []).find(o => String(o.SKU) === igidStr) || {};

    // Valores actuales
    const titulo = (groupObj && groupObj.name ? groupObj.name : "").trim();
    const detalles = (groupObj && groupObj.details ? groupObj.details : "").trim();

    // Valores originales
    const originalTitulo = (originalObj && originalObj.name ? originalObj.name : "").trim();
    const originalDetalles = (originalObj && originalObj.details ? originalObj.details : "").trim();

    // Solo exporta si cambió alguno
    if (titulo !== originalTitulo || detalles !== originalDetalles) {
      valoresNuevosGrupos.push({
        "IG ID": igidStr,
        "titulo": titulo,
        "detalles": detalles
      });
    }
  });

  const wsValoresNuevosGrupos = XLSX.utils.json_to_sheet(
    valoresNuevosGrupos.length ? valoresNuevosGrupos : [{}],
    { header: grupoCols }
  );
  XLSX.utils.sheet_add_aoa(wsValoresNuevosGrupos, [grupoCols], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsValoresNuevosGrupos, "Valores Nuevos Grupos");

  // ===== Exporta el archivo Excel =====
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const fecha = `${yyyy}${mm}${dd}_${hh}${min}`;
  XLSX.writeFile(wb, `${cmsIg}_ALL_${fecha}.xlsx`);
}




function syncAllFilterInputsToLocalStorage() {
  document.querySelectorAll('.filter-order-input').forEach(input => {
    const attribute = input.getAttribute('data-attribute');
    const value = input.value.trim();
    if (value === '' || value === '0') {
      localStorage.setItem(`filter_${attribute}`, '0');
    } else {
      localStorage.setItem(`filter_${attribute}`, value);
    }
  });
}


function clearAllFilters() {
  // Guarda lo que hay en los inputs ANTES de limpiar visualmente (¡pero no borres localStorage!)
  syncAllFilterInputsToLocalStorage();

  activeFilters = {};

  document.querySelectorAll('.attribute-dropdown').forEach(dropdown => {
    dropdown.value = '';
  });

  currentFilter = { attribute: null, type: null };
  highlightActiveFilter();

  render();
}

function filterItemsByAttributeValue(attribute, value) {
  if (value) {
    activeFilters[attribute] = value;
  } else {
    delete activeFilters[attribute];
  }
  applyMultipleFilters();
}

function createFilteredItemsTable(container, groupItems, skuToObject, highlightAttribute) {
  const table = document.createElement("table");
  table.className = "table table-striped table-bordered filtered-items-table";
  
  // Crear THEAD
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  
  // Columna del atributo filtrado
  const attributeHeader = document.createElement("th");
  attributeHeader.textContent = highlightAttribute;
  headerRow.appendChild(attributeHeader);
  
  // Columnas forzadas
  forcedColumns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Crear TBODY
  const tbody = document.createElement("tbody");
  
  groupItems.forEach(item => {
    const details = skuToObject[item.SKU] || {};
    const row = document.createElement("tr");
    
    // Celda del atributo filtrado
    const attributeCell = document.createElement("td");
    attributeCell.className = "highlight-cell";
    attributeCell.textContent = details[highlightAttribute] || '(vacío)';
    row.appendChild(attributeCell);
    
    // Columnas forzadas
    forcedColumns.forEach(col => {
      const cell = document.createElement("td");
      const cellValue = details[col] || '';
      
      if (col === 'item_code' && cellValue) {
        const link = document.createElement("a");
        link.href = `https://www.travers.com.mx/${cellValue}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = cellValue;
        cell.appendChild(link);
      } else {
        cell.textContent = cellValue;
      }
      
      row.appendChild(cell);
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  
  const tableContainer = document.createElement("div");
  tableContainer.className = "table-responsive";
  tableContainer.appendChild(table);
  container.appendChild(tableContainer);
}

function clearAttributeFilter() {
  if (objectData.length && filteredItems.length) {
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
    
    // Resetear los dropdowns a su estado inicial
    document.querySelectorAll('.attribute-dropdown').forEach(dropdown => {
      dropdown.value = '';
    });
  }
}

function createAttributeDropdown(attribute, valuesMap, currentFilteredItems = null) {
  // Si hay items filtrados, recalcular los valores disponibles para este atributo
  if (currentFilteredItems && currentFilteredItems.length > 0) {
    const filteredValues = new Map();
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    
    currentFilteredItems.forEach(item => {
      const details = skuToObject[item.SKU];
      if (details && details[attribute]) {
        const rawValue = details[attribute].toString().trim();
        if (rawValue) {
          filteredValues.set(rawValue, (filteredValues.get(rawValue) || 0) + 1);
        }
      }
    });
    
    valuesMap = filteredValues;
  }

  // Convertir el Map a array y ordenar por frecuencia (mayor a menor)
  const sortedValues = Array.from(valuesMap.entries())
    .sort((a, b) => b[1] - a[1]);

  // Crear opciones del dropdown
  const options = sortedValues.map(([value, count]) => {
    const escapedValue = value
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    return `<option value="${escapedValue}">(${count}) ${value}</option>`;
  }).join('');

  return `
    <select class="form-control form-control-sm attribute-dropdown" 
            data-attribute="${attribute}"
            title="Filtrar por ${attribute}">
      <option value="">${attribute} (${sortedValues.length})</option>
      ${options}
    </select>
  `;
}

function saveAttributeOrder(e) {
  const input = e.target;
  const attribute = input.getAttribute('data-attribute');
  const value = input.value.trim();
  const isCatOrder = input.classList.contains('order-cat-input');
  
  if (value) {
    localStorage.setItem(`${isCatOrder ? 'cat_order_' : 'order_'}${attribute}`, value);
  } else {
    localStorage.removeItem(`${isCatOrder ? 'cat_order_' : 'order_'}${attribute}`);
  }
}

function loadWebOrder() {
  if (Object.keys(defaultAttributesOrder).length === 0) {

    alert("Primero debes cargar los archivos necesarios");
    return;
  }

  const inputs = document.querySelectorAll('.order-input');
  inputs.forEach(input => {
    const attribute = input.getAttribute('data-attribute');
    if (defaultAttributesOrder[attribute]) {
      input.value = defaultAttributesOrder[attribute];
      localStorage.setItem(`order_${attribute}`, defaultAttributesOrder[attribute]);
    } else {
      input.value = '';
      localStorage.removeItem(`order_${attribute}`);
    }
  });
  
  if (objectData.length && filteredItems.length) {
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
  }
}

function clearAttributeOrder() {
  const inputs = document.querySelectorAll('.order-input');
  inputs.forEach(input => {
    const attribute = input.getAttribute('data-attribute');
    localStorage.removeItem(`order_${attribute}`);
    input.value = '';
  });

  if (objectData.length && filteredItems.length) {
    currentViewState.webOrder = true; // Mostrar que estamos en orden web (aunque limpio)
    currentViewState.catOrder = false;
    currentViewState.catTables = false;
    
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
    createStatusMessage();
  }
}


function clearCatOrder() {
  const catOrderInputs = document.querySelectorAll('.order-cat-input');
  
  catOrderInputs.forEach(input => {
    const attribute = input.getAttribute('data-attribute');
    input.value = '';
    localStorage.removeItem(`cat_order_${attribute}`);
  });
  
  if (objectData.length && filteredItems.length) {
    currentViewState.catOrder = true; // Mostrar que estamos en orden cat (aunque limpio)
    currentViewState.webOrder = false;
    currentViewState.catTables = false;
    
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
    createStatusMessage();
  }
}

function toggleEmptyAttributes() {
  showEmptyAttributes = !showEmptyAttributes;
  currentViewState.showEmpty = showEmptyAttributes;
  
  const toggleBtn = document.getElementById('toggleEmptyBtn');
  // Solo intenta actualizar el toggle si existe el botón en el DOM
  if (toggleBtn) {
    const toggleState = toggleBtn.querySelector('.toggle-state');
    if (showEmptyAttributes) {
      toggleBtn.classList.add('active'); // Clase para estado activo
      if (toggleState) toggleState.textContent = 'On';
    } else {
      toggleBtn.classList.remove('active'); // Clase para estado inactivo
      if (toggleState) toggleState.textContent = 'Off';
    }
  }

  if (objectData.length && filteredItems.length) {
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
  }
}

function getOrderedAttributes(groupItems, skuToObject) {
  const orderedAttributes = [];
  const uniqueAttributes = new Set();

  // Para tablas de catálogo
  if (currentViewState.catTables) {
    const itemWithCatAttrs = groupItems.find(item => item.table_attributes_cat);
    if (itemWithCatAttrs) {
      return itemWithCatAttrs.table_attributes_cat
        .replace(/\s+/g, ',')
        .split(',')
        .map(attr => attr.trim())
        .filter(attr => attr)
        .map(attr => ({
          attribute: attr,
          order: 0,
          isForced: forcedColumns.includes(attr)
        }));
    }
  }

  
  // Determinar qué selector usar basado en useCatOrder
  const selector = useCatOrder ? '.order-cat-input' : '.order-input';
  
  document.querySelectorAll(selector).forEach(input => {
    const attr = input.getAttribute('data-attribute');
    const value = input.value.trim();

    if (value && !uniqueAttributes.has(attr)) {
      uniqueAttributes.add(attr);
      orderedAttributes.push({
        attribute: attr,
        order: parseInt(value),
        isForced: forcedColumns.includes(attr)
      });
    }
  });

  // Ordenar: primero columnas forzadas, luego por orden asignado
  return orderedAttributes.sort((a, b) => {
    if (a.isForced !== b.isForced) return a.isForced ? -1 : 1;
    return a.order - b.order;
  });
}


function applyOrder() {
  if (objectData.length && filteredItems.length) {

    // 1. Establecer los estados correctos
    currentViewState.webOrder = true;
    currentViewState.catOrder = false;
    currentViewState.catTables = false;
    useCatOrder = false;

    // 2. Guardar los órdenes web
    document.querySelectorAll('.order-input').forEach(input => {
      const attribute = input.getAttribute('data-attribute');
      const value = input.value.trim();
      if (value) {
        localStorage.setItem(`order_${attribute}`, value);
      } else {
        localStorage.removeItem(`order_${attribute}`);
      }
    });

    // 3. Procesar los grupos con el orden web
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
    
    // 4. Feedback visual
  } 
}


function applyCatOrder() {
  if (objectData.length && filteredItems.length) {

    // 1. Establecer los estados correctos
    currentViewState.catOrder = true;
    currentViewState.webOrder = false;
    currentViewState.catTables = false;
    useCatOrder = true; // Esto es CLAVE para que use el orden de catálogo

    // 2. Guardar los órdenes de catálogo
    document.querySelectorAll('.order-cat-input').forEach(input => {
      const attribute = input.getAttribute('data-attribute');
      const value = input.value.trim();
      if (value) {
        localStorage.setItem(`cat_order_${attribute}`, value);
      } else {
        localStorage.removeItem(`cat_order_${attribute}`);
      }
    });

    // 3. Procesar los grupos con el orden de catálogo
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
    
    // 4. Feedback visual

  }
}



// Función para seleccionar todos los grupos
function selectAllGroups() {
  const checkboxes = document.querySelectorAll('.group-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
    selectedGroups.add(checkbox.dataset.groupId);
  });
  
  // Actualizar contador
  const selectionCount = document.querySelector('.selection-count');
  selectionCount.textContent = `(${selectedGroups.size} seleccionados)`;
}

// Función para deseleccionar todos los grupos
function deselectAllGroups() {
  const checkboxes = document.querySelectorAll('.group-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  selectedGroups.clear();
  
  // Actualizar contador
  const selectionCount = document.querySelector('.selection-count');
  selectionCount.textContent = "";
}

// Función para desagrupar un grupo unido
function unmergeGroup(groupId) {
  if (!mergedGroups.has(groupId)) {
    console.error(`El grupo ${groupId} no es un grupo unido`);
    return;
  }

  const mergedGroupData = mergedGroups.get(groupId);
  
  // 1. Eliminar los items del grupo unido
  filteredItems = filteredItems.filter(item => item["IG ID"] !== groupId);
  
  // 2. Restaurar los items originales con sus IG IDs originales
  mergedGroupData.items.forEach(item => {
    const originalItem = {
      ...item,
      "IG ID": item.__originalIGID,
      "Original IG ID": undefined,
      __originalIGID: undefined
    };
    filteredItems.push(originalItem);
  });
  
  // 3. Eliminar el grupo unido del mapa mergedGroups
  mergedGroups.delete(groupId);
  
  // 4. Eliminar el grupo de objectData
  objectData = objectData.filter(o => o.SKU !== groupId);
  
  // 5. Limpiar selección si estaba seleccionado
  selectedGroups.delete(groupId);
  
  // 6. Forzar render completo
  if (filteredItems.length && objectData.length) {
    refreshView();
  }
  
  // 7. Mensaje visual
  fileInfoDiv.scrollTop = fileInfoDiv.scrollHeight;
  
}

function displayFilteredGroups(filteredGroupIds, attribute, type) {
  output.innerHTML = `
    <div class="filter-results">
      <h3>Item groups ${type === 'withValue' ? 'con' : 'sin'} 
        <span class="active-filter-label" style="color: ${type === 'withValue' ? '#2ecc71' : '#e74c3c'}">
          ${attribute}
        </span>
      </h3>
      <p>Mostrando ${filteredGroupIds.size} Item Groups</p>
    </div>
  `;

  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  const groups = {};
  filteredItems.forEach(item => {
    const groupIdStr = String(item["IG ID"]);
    if (filteredGroupIds.has(groupIdStr)) {
      if (!groups[groupIdStr]) {
        groups[groupIdStr] = [];
      }
      groups[groupIdStr].push(item);
    }
  });

  filteredItems.forEach(item => {
    const groupIdStr = String(item["IG ID"]);
    if (groups[groupIdStr] && !output.querySelector(`[data-group-id="${groupIdStr}"]`)) {
      const groupItems = groups[groupIdStr];

      if (!groupItems || !Array.isArray(groupItems) || groupItems.length === 0) {
        return;
      }
const orderedSkus = groupOrderMap.get(groupIdStr);
if (Array.isArray(orderedSkus)) {
  groupItems.sort((a, b) => orderedSkus.indexOf(a.SKU) - orderedSkus.indexOf(b.SKU));
}

      const groupInfo = skuToObject[groupIdStr] || {};
      const isMergedGroup = mergedGroups.has(groupIdStr);

      const groupDiv = document.createElement("div");
      groupDiv.className = `group-container ${isMergedGroup ? 'merged-group' : ''}`;
      groupDiv.dataset.groupId = groupIdStr;

      createGroupHeader(groupDiv, groupInfo, isMergedGroup, groupItems, skuToObject);
      createItemsTable(groupDiv, groupItems, skuToObject, attribute);
      output.appendChild(groupDiv);
    }
  });
}

function handleStatClick(event) {
  const attribute = event.target.getAttribute('data-attribute');
  const type = event.target.getAttribute('data-type');
  const filterAttribute = attribute === 'item_code' ? 'item_code' : attribute;

  // Toggle: Si ya está ese filtro, quítalo y muestra todo
  if (
    currentFilter.attribute === filterAttribute &&
    currentFilter.type === type
  ) {
    clearFilter();
    return;
  }

  // Aplica nuevo filtro
  currentStatClickFilter = { attribute: filterAttribute, type };
  currentFilter = { attribute: filterAttribute, type };
  highlightActiveFilter();

  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  const filteredGroupIds = new Set();
  const filteredItemsMap = {};

  filteredItems.forEach(item => {
    const details = skuToObject[item.SKU] || {};
    const hasValue = details[filterAttribute]?.toString().trim();
    if ((type === 'withValue' && hasValue) || (type === 'withoutValue' && !hasValue)) {
      const groupIdStr = String(item["IG ID"]);
      filteredGroupIds.add(groupIdStr);
      if (!filteredItemsMap[groupIdStr]) filteredItemsMap[groupIdStr] = [];
      filteredItemsMap[groupIdStr].push(item);
    }
  });

  output.innerHTML = `
    <div class="filter-results">
      <h3>Item groups ${type === 'withValue' ? 'con' : 'sin'} 
        <span class="active-filter-label" style="color: ${type === 'withValue' ? '#2ecc71' : '#e74c3c'}">
          ${filterAttribute}
        </span>
        <button class="btn btn-sm btn-outline-secondary ml-2 clear-filter-btn">Limpiar filtro</button>
      </h3>
      <p>Mostrando ${filteredGroupIds.size} Item Groups</p>
    </div>
  `;
  // Asegúrate de que el botón "Limpiar filtro" SIEMPRE limpie y rerenderice
  output.querySelector('.clear-filter-btn').addEventListener('click', function() {
    clearFilter();
    // El refreshView asegura que se vea la vista original de grupos
    refreshView();
  });

  const orderedGroupIds = [];
  const uniqueGroupIds = new Set();
  filteredItems.forEach(item => {
    const groupIdStr = String(item["IG ID"]);
    if (filteredGroupIds.has(groupIdStr) && !uniqueGroupIds.has(groupIdStr)) {
      orderedGroupIds.push(groupIdStr);
      uniqueGroupIds.add(groupIdStr);
    }
  });

// Ordena: merged y split primero, luego el resto
orderedGroupIds.sort((a, b) => {
  const isMergedA = a.startsWith('merged-');
  const isMergedB = b.startsWith('merged-');
  const isSplitA = a.startsWith('split-') || a.startsWith('split-');
  const isSplitB = b.startsWith('split-') || b.startsWith('split-');
  // Merged primero, luego split, luego el resto
  if (isMergedA && !isMergedB) return -1;
  if (!isMergedA && isMergedB) return 1;
  if (isSplitA && !isSplitB) return -1;
  if (!isSplitA && isSplitB) return 1;
  return 0;
});

  orderedGroupIds.forEach(groupIdStr => {
    const groupItems = filteredItemsMap[groupIdStr];
    if (!groupItems || groupItems.length === 0) return;
    const orderedSkus = groupOrderMap.get(groupIdStr);
    let orderedGroupItems = groupItems;
    if (Array.isArray(orderedSkus)) {
      // Solo los SKUs filtrados, pero en el orden original
      orderedGroupItems = orderedSkus
        .map(sku => groupItems.find(item => item.SKU === sku))
        .filter(Boolean);
    }

    const groupInfo = skuToObject[groupIdStr] || {};
    const isMergedGroup = mergedGroups.has(groupIdStr);
    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container ${isMergedGroup ? 'merged-group' : ''}`;
    groupDiv.dataset.groupId = groupIdStr;

    createGroupHeader(groupDiv, groupInfo, isMergedGroup, orderedGroupItems, skuToObject);
    createItemsTable(groupDiv, orderedGroupItems, skuToObject, attribute);
    output.appendChild(groupDiv);
  });
}
   

// REEMPLAZA tu clearFilter por esto:
function clearFilter() {
  currentStatClickFilter = null;
  currentFilter = { attribute: null, type: null };
  highlightActiveFilter();
  // SIEMPRE regresa a la vista de grupos principal
  render();
}

function highlightActiveFilter() {
  document.querySelectorAll('.clickable').forEach(td => {
    td.classList.remove('active-filter', 'active-with-value', 'active-without-value');
  });
  
  if (currentFilter.attribute && currentFilter.type) {
    const selector = `.clickable[data-attribute="${currentFilter.attribute}"][data-type="${currentFilter.type}"]`;
    document.querySelectorAll(selector).forEach(td => {
      td.classList.add('active-filter');
      td.classList.add(currentFilter.type === 'withValue' ? 'active-with-value' : 'active-without-value');
    });
  }
}

function createStatusMessage() {
  document.querySelectorAll('.status-message').forEach(el => el.remove());
  
  const messagesContainer = document.createElement('div');
  messagesContainer.id = 'status-messages-container';

  // Solo mostrar un mensaje a la vez según el estado actual
  if (currentViewState.catTables) {
    const message = document.createElement('div');
    message.className = 'status-message cat-tables';
    message.innerHTML = `Tablas con orden de Catálogo actual <span class="toggle-status">| Vacíos ${currentViewState.showEmpty ? 'ON' : 'OFF'}</span>`;
    messagesContainer.appendChild(message);
  } 
  else if (currentViewState.webOrder) {
    const message = document.createElement('div');
    message.className = 'status-message web-order';
    message.innerHTML = `Tablas con orden Web <span class="toggle-status">| Vacíos ${currentViewState.showEmpty ? 'ON' : 'OFF'}</span>`;
    messagesContainer.appendChild(message);
  }
  else if (currentViewState.catOrder) {
    const message = document.createElement('div');
    message.className = 'status-message cat-order';
    message.innerHTML = `Tablas con nuevo orden de Catálogo <span class="toggle-status">| Vacíos ${currentViewState.showEmpty ? 'ON' : 'OFF'}</span>`;
    messagesContainer.appendChild(message);
  }

  if (output.firstChild) {
    output.insertBefore(messagesContainer, output.firstChild);
  } else {
    output.appendChild(messagesContainer);
  }
}

function getMergedGroupDetails(groupId) {
  if (mergedGroups.has(groupId) && typeof mergedGroups.get(groupId).details === 'string' && mergedGroups.get(groupId).details !== '') {
    return mergedGroups.get(groupId).details;
  }
  const local = localStorage.getItem(`merged_details_${groupId}`);
  if (local) return local;
  return '';
}

function saveMergedGroupDetails(groupId, value) {
  if (mergedGroups.has(groupId)) mergedGroups.get(groupId).details = value;
  localStorage.setItem(`merged_details_${groupId}`, value);
  // Si existe en objectData también lo puedes guardar ahí si lo deseas
  const groupObj = objectData.find(o => o.SKU === groupId);
  if (groupObj) groupObj.details = value;
  showTemporaryMessage('Detalles de grupo guardados');
}

function processItemGroups(skuToObject) {
  // Agrupar items por IG ID en orden de aparición
  const groups = {};
  const orderedGroupIds = [];
  filteredItems.forEach(item => {
    const groupIdStr = String(item["IG ID"]);
    if (!groups[groupIdStr]) {
      groups[groupIdStr] = [];
      orderedGroupIds.push(groupIdStr);
    }
    groups[groupIdStr].push(item);
  });

    output.innerHTML = '';
  createStatusMessage();
  
  // --- Controles de selección y agrupación ---
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "groups-controls";
  
  const mergeBtn = document.createElement("button");
  mergeBtn.className = "btn btn-primary";
  mergeBtn.textContent = "Agrupar (bloques)";
  mergeBtn.addEventListener('click', mergeSelectedGroups);
  
  const mergeVisibleBtn = document.createElement("button");
  mergeVisibleBtn.className = "btn btn-warning";
  mergeVisibleBtn.textContent = "Agrupar visibles";
  mergeVisibleBtn.title = "Agrupa solo los items visibles en pantalla";
  mergeVisibleBtn.addEventListener('click', mergeVisibleItemsOnly);
  
  const selectAllBtn = document.createElement("button");
  selectAllBtn.className = "btn btn-secondary";
  selectAllBtn.textContent = "Seleccionar Todos";
  selectAllBtn.addEventListener('click', selectAllGroups);
  
  const deselectAllBtn = document.createElement("button");
  deselectAllBtn.className = "btn btn-outline-secondary";
  deselectAllBtn.textContent = "Deseleccionar Todos";
  deselectAllBtn.addEventListener('click', deselectAllGroups);
  
  const selectionCount = document.createElement("span");
  selectionCount.className = "selection-count";
  selectionCount.textContent = selectedGroups.size > 0 ? `(${selectedGroups.size} seleccionados)` : "";
  
  controlsDiv.appendChild(mergeBtn);
  controlsDiv.appendChild(mergeVisibleBtn);
  controlsDiv.appendChild(selectAllBtn);
  controlsDiv.appendChild(deselectAllBtn);
  controlsDiv.appendChild(selectionCount);
  

const vistaContainer = document.createElement("div");
vistaContainer.style.display = "flex";
vistaContainer.style.alignItems = "center";
vistaContainer.style.marginLeft = "auto";
vistaContainer.style.gap = "6px"; // Espacio pequeño entre icono, label y select

// Icono Bootstrap
const vistaIcon = document.createElement("i");
vistaIcon.className = "bi bi-columns-gap"; // Cambia por el icono que prefieras
vistaIcon.style.fontSize = "1.1em";
vistaIcon.style.marginRight = "2px";

// Label
const vistaLabel = document.createElement("label");
vistaLabel.textContent = "Vista default en Web:";
vistaLabel.style.fontWeight = "600";
vistaLabel.style.fontSize = "1em";
vistaLabel.htmlFor = "viewModeDropdown";
vistaLabel.style.margin = "0";

// Dropdown
const viewDropdown = document.createElement("select");
viewDropdown.className = "form-select view-mode-dropdown";
viewDropdown.style.fontWeight = "500";
viewDropdown.style.fontSize = ".95em";
viewDropdown.id = "viewModeDropdown";
viewDropdown.style.width = "150px";
viewDropdown.title = "Cambiar vista";

["table", "grid", "list"].forEach(opt => {
  const option = document.createElement("option");
  option.value = opt.toLowerCase();
  option.textContent = opt;
  viewDropdown.appendChild(option);
});
  vistaContainer.appendChild(vistaIcon); 
  vistaContainer.appendChild(vistaLabel);
  vistaContainer.appendChild(viewDropdown);
  controlsDiv.appendChild(vistaContainer);
  
  // --- SOLO UNA VEZ, AL FINAL ---
  output.appendChild(controlsDiv);


const cmsIgValue = filteredItems[0]?.['CMS IG'];
if (cmsIgValue && Array.isArray(categoryData)) {
  // Busca la fila donde image === `W${cmsIgValue}.png`
  const matchedItem = categoryData.find(item =>
    item.image && item.image.trim() === `W${cmsIgValue}.png`
  );
  if (matchedItem && matchedItem.enable_table_view) {
    const viewValue = matchedItem.enable_table_view.toLowerCase();
    const option = Array.from(viewDropdown.options).find(opt => opt.value === viewValue);
    if (option) {
      viewDropdown.value = viewValue;
    }
  }
}

// Ordena: merged y split primero, luego el resto
orderedGroupIds.sort((a, b) => {
  const isMergedA = a.startsWith('merged-');
  const isMergedB = b.startsWith('merged-');
  const isSplitA = a.startsWith('split-') || a.startsWith('split-');
  const isSplitB = b.startsWith('split-') || b.startsWith('split-');
  // Merged primero, luego split, luego el resto
  if (isMergedA && !isMergedB) return -1;
  if (!isMergedA && isMergedB) return 1;
  if (isSplitA && !isSplitB) return -1;
  if (!isSplitA && isSplitB) return 1;
  return 0;
});


orderedGroupIds.forEach(groupIdStr => {
  const groupItems = groups[groupIdStr];
  if (!groupItems || !groupItems.length) return;
  const orderedSkus = groupOrderMap.get(groupIdStr);
  let orderedGroupItems = groupItems;
  if (Array.isArray(orderedSkus)) {
    // Solo los SKUs filtrados, pero en el orden original
    orderedGroupItems = orderedSkus
      .map(sku => groupItems.find(item => item.SKU === sku))
      .filter(Boolean);
  }

    const groupInfo = skuToObject[groupIdStr] || {};
    const isMergedGroup = mergedGroups.has(groupIdStr);
    const isSeparatedGroup = groupIdStr.startsWith('split-') || groupIdStr.startsWith('split-');
    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container${isMergedGroup ? ' merged-group' : ''}${isSeparatedGroup ? ' separated-group' : ''}`;
    groupDiv.dataset.groupId = groupIdStr;

    // Checkbox de selección
    const checkboxDiv = document.createElement("div");
    checkboxDiv.className = "group-checkbox-container";
    checkboxDiv.innerHTML = `
      <input type="checkbox" class="group-checkbox" id="group-${groupIdStr}" 
             data-group-id="${groupIdStr}"
             ${selectedGroups.has(groupIdStr) ? 'checked' : ''}>
      <label for="group-${groupIdStr}"></label>
    `;
    groupDiv.appendChild(checkboxDiv);

    // --- Header ---
    const headerDiv = document.createElement("div");
    headerDiv.className = "group-header";

    // --- Header content (left + right) ---
    const headerContentDiv = document.createElement("div");
    headerContentDiv.className = "group-header-content";

    // --- Left (image + info) ---
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";
    const productImg = createProductImageElement(groupInfo.image);
    leftContainer.appendChild(productImg);

    const infoDiv = document.createElement("div");
    infoDiv.className = "group-info";
    const titleContainer = document.createElement("div");
titleContainer.className = "group-title-container";

if (isMergedGroup) {
  // Input editable por default para merged
  const input = document.createElement('input');
  input.type = "text";
  input.className = "group-title-input";
  input.value = groupInfo.name || groupIdStr;
  input.style.fontSize = "1.1rem";
  input.style.width = "90%";
  input.addEventListener("blur", function() {
    const newTitle = this.value.trim();
    if (newTitle) {
      const groupObj = objectData.find(o => o.SKU === groupIdStr);
      if (groupObj) groupObj.name = newTitle;
      const mergedGroup = mergedGroups.get(groupIdStr);
      if (mergedGroup) mergedGroup.name = newTitle;
    }
  });
  titleContainer.appendChild(input);
} else {
  // Título normal para los demás
  const title = document.createElement("h2");
  title.className = "group-title";
  const link = document.createElement("a");
  link.href = `https://www.travers.com.mx/${groupIdStr}`;
  link.target = "_blank";
  link.textContent = groupInfo.name || groupIdStr;
  title.appendChild(link);
  titleContainer.appendChild(title);
}
infoDiv.appendChild(titleContainer);

    const logo = createBrandLogoElement(groupInfo.brand_logo);
    infoDiv.appendChild(logo);

    if (groupInfo.sku) {
      const skuP = document.createElement("p");
      skuP.textContent = "SKU: " + groupInfo.sku;
      infoDiv.appendChild(skuP);
    }
    leftContainer.appendChild(infoDiv);
    headerContentDiv.appendChild(leftContainer);

    // --- Right ---
    const rightContainer = createGroupHeaderRight({
      groupIdStr,
      groupItems,
      skuToObject,
      isMergedGroup,
      groupDiv
    });
    headerContentDiv.appendChild(rightContainer);

    headerDiv.appendChild(headerContentDiv);

    // --- Detalles desplegables para TODOS los grupos ---
    const detailsContainer = document.createElement("div");
    detailsContainer.className = "group-details-container";
    const toggleDetailsBtn = document.createElement("button");
    toggleDetailsBtn.className = "toggle-details-btn";
    toggleDetailsBtn.textContent = "▼ Detalles";
    toggleDetailsBtn.setAttribute("aria-expanded", "false");

    const detailsDiv = document.createElement("div");
    detailsDiv.className = "group-extra-details";
    detailsDiv.style.display = "none";

    if (isMergedGroup) {
      // Merged: textarea editable
      const mergedTextarea = document.createElement("textarea");
      mergedTextarea.className = "form-control merged-group-textarea";
      mergedTextarea.rows = 10;
      let mergedContent = getMergedGroupDetails(groupIdStr);
      if (!mergedContent) {
        const mergedGroupData = mergedGroups.get(groupIdStr);
        mergedContent = "";
        mergedGroupData.originalGroups.forEach(originalGroupId => {
          const originalGroupInfo = objectData.find(o => o.SKU === originalGroupId) || {};
          mergedContent += `${originalGroupId}, ${originalGroupInfo.name || ''}, ${originalGroupInfo.brand_logo || ''}\n`;
          const fields = ['ventajas', 'aplicaciones', 'especificaciones', 'incluye'];
          fields.forEach(field => {
            if (originalGroupInfo[field]) {
              let fieldValue = originalGroupInfo[field]
                .replace(/<special[^>]*>|<\/special>|<strong>|<\/strong>/gi, '')
                .replace(/<br\s*\/?>|<\/br>/gi, '\n');
              mergedContent += `${field.charAt(0).toUpperCase() + field.slice(1)}:\n${fieldValue}\n\n`;
            }
          });
          mergedContent += "--------------------\n\n";
        });
      }
      mergedTextarea.value = mergedContent.trim();
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-sm btn-primary save-merged-btn";
      saveBtn.textContent = "Guardar Cambios";
      saveBtn.addEventListener('click', function() {
        saveMergedGroupDetails(groupIdStr, mergedTextarea.value);
      });
      detailsDiv.appendChild(mergedTextarea);
      detailsDiv.appendChild(saveBtn);
    } else {
let detailsHtml = "";
if (groupInfo.details && groupInfo.details.trim() !== "") {
  // Si hay detalles editados, muestra solo eso
  detailsHtml = groupInfo.details.replace(/\n/g, "<br>");
} else {
  if (groupInfo.ventajas) detailsHtml += `<div><strong>Ventajas:</strong><br> ${groupInfo.ventajas}</div><br>`;
  if (groupInfo.aplicaciones) detailsHtml += `<div><strong>Aplicaciones:</strong><br> ${groupInfo.aplicaciones}</div><br>`;
  if (groupInfo.especificaciones) detailsHtml += `<div><strong>Especificaciones:</strong><br> ${groupInfo.especificaciones}</div><br>`;
  if (groupInfo.incluye) detailsHtml += `<div><strong>Incluye:</strong><br> ${groupInfo.incluye}</div><br>`;
}
detailsDiv.innerHTML = `
  <div class="group-details-text">${detailsHtml || "<em>Sin detalles</em>"}</div>
  <textarea class="group-details-textarea form-control" style="display:none;" rows="6">${groupInfo.details || ""}</textarea>
`;
    }

    toggleDetailsBtn.addEventListener("click", function () {
      const expanded = toggleDetailsBtn.getAttribute("aria-expanded") === "true";
      toggleDetailsBtn.setAttribute("aria-expanded", !expanded);
      detailsDiv.style.display = expanded ? "none" : "block";
      toggleDetailsBtn.textContent = expanded ? "▼ Detalles" : "▲ Detalles";
    });

    detailsContainer.appendChild(toggleDetailsBtn);
    detailsContainer.appendChild(detailsDiv);
    headerDiv.appendChild(detailsContainer);

    groupDiv.appendChild(headerDiv);

    // --- Items table ---
    createItemsTable(groupDiv, groupItems, skuToObject);

    output.appendChild(groupDiv);

    // Checkbox handler
    const groupCheckbox = groupDiv.querySelector('.group-checkbox');
    if (groupCheckbox) {
      groupCheckbox.addEventListener('change', function() {
        if (this.checked) selectedGroups.add(this.dataset.groupId);
        else selectedGroups.delete(this.dataset.groupId);
        selectionCount.textContent = selectedGroups.size > 0 ? `(${selectedGroups.size} seleccionados)` : "";
      });
    }
  });
}


// ------------

function renderMergedGroups(skuToObject) {
  output.innerHTML = '';
  const groups = {};
  filteredItems.forEach(item => {
    const groupId = item["IG ID"];
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(item);
  });

  Object.keys(groups).forEach(groupId => {
    const groupItems = groups[groupId];
    if (!groupOrderMap.has(groupId)) {
      groupOrderMap.set(groupId, groupItems.map(item => item.SKU));
    }
    const orderedSkus = groupOrderMap.get(groupId);
    groupItems.sort((a, b) => orderedSkus.indexOf(a.SKU) - orderedSkus.indexOf(b.SKU));

    const groupInfo = skuToObject[groupId] || {};
    const isMergedGroup = mergedGroups.has(groupId);

    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container ${isMergedGroup ? 'merged-group' : ''}`;
    groupDiv.dataset.groupId = groupId;

    const headerDiv = document.createElement("div");
    headerDiv.className = "group-header";
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";
    const productImg = createProductImageElement(groupInfo.image);
    leftContainer.appendChild(productImg);

    const infoDiv = document.createElement("div");
    infoDiv.className = "group-info";
    const title = document.createElement("h2");
    title.className = "group-title";
    const link = document.createElement("a");
    link.href = `https://www.travers.com.mx/${groupId}`;
    link.target = "_blank";
    link.textContent = groupInfo.name || groupId;
    title.appendChild(link);
    infoDiv.appendChild(title);

    const logo = createBrandLogoElement(groupInfo.brand_logo);
    infoDiv.appendChild(logo);

    const skuP = document.createElement("p");
    skuP.textContent = `SKU: ${groupId}`;
    infoDiv.appendChild(skuP);

    if (isMergedGroup) {
      const originP = document.createElement("p");
      originP.className = "group-origin";
      originP.textContent = `Contiene items de: ${mergedGroups.get(groupId).originalGroups.join(', ')}`;
      infoDiv.appendChild(originP);
    }

    leftContainer.appendChild(infoDiv);
    headerDiv.appendChild(leftContainer);

    const rightContainer = createGroupHeaderRight({
  groupIdStr: groupId,
  groupItems,
  skuToObject,
  isMergedGroup,
  groupDiv
});
headerDiv.appendChild(rightContainer);

    if (isMergedGroup) {
      const detailsContainer = document.createElement("div");
      detailsContainer.className = "group-details-container";
      const toggleDetailsBtn = document.createElement("button");
      toggleDetailsBtn.className = "toggle-details-btn";
      toggleDetailsBtn.textContent = "▼ Detalles";
      toggleDetailsBtn.setAttribute("aria-expanded", "false");

      const detailsDiv = document.createElement("div");
      detailsDiv.className = "group-extra-details";
      detailsDiv.style.display = "none";

      const mergedGroupData = mergedGroups.get(groupId);
      const mergedTextarea = document.createElement("textarea");
      mergedTextarea.className = "form-control merged-group-textarea";
      mergedTextarea.rows = 10;

      let mergedDetails = mergedGroupData.details || '';
      if (!mergedDetails) {
        mergedDetails = localStorage.getItem(`merged_details_${groupId}`) || '';
      }
      let mergedContent = mergedDetails;
      if (!mergedDetails) {
        mergedContent = "";
        mergedGroupData.originalGroups.forEach(originalGroupId => {
          const originalGroupInfo = objectData.find(o => o.SKU === originalGroupId) || {};
          mergedContent += `${originalGroupId}, ${originalGroupInfo.name || ''}, ${originalGroupInfo.brand_logo || ''}\n`;
          const fields = ['ventajas', 'aplicaciones', 'especificaciones', 'incluye'];
          fields.forEach(field => {
            if (originalGroupInfo[field]) {
              let fieldValue = originalGroupInfo[field]
                .replace(/<special[^>]*>|<\/special>|<strong>|<\/strong>/gi, '')
                .replace(/<br\s*\/?>|<\/br>/gi, '\n');
              mergedContent += `${field.charAt(0).toUpperCase() + field.slice(1)}:\n${fieldValue}\n\n`;
            }
          });
          mergedContent += "--------------------\n\n";
        });
      }
      mergedTextarea.value = mergedContent.trim();

      const saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-sm btn-primary save-merged-btn";
      saveBtn.textContent = "Guardar Cambios";
      saveBtn.addEventListener('click', function() {
        mergedGroupData.details = mergedTextarea.value;
        const groupObj = objectData.find(o => o.SKU === groupId);
        if (groupObj) groupObj.details = mergedTextarea.value;
        localStorage.setItem(`merged_details_${groupId}`, mergedTextarea.value);
        showTemporaryMessage('Detalles de grupo guardados');
      });

      detailsDiv.appendChild(mergedTextarea);
      detailsDiv.appendChild(saveBtn);

      toggleDetailsBtn.addEventListener("click", function () {
        const expanded = toggleDetailsBtn.getAttribute("aria-expanded") === "true";
        toggleDetailsBtn.setAttribute("aria-expanded", !expanded);
        detailsDiv.style.display = expanded ? "none" : "block";
        toggleDetailsBtn.textContent = expanded ? "▼ Detalles" : "▲ Detalles";
      });

      detailsContainer.appendChild(toggleDetailsBtn);
      detailsContainer.appendChild(detailsDiv);
      headerDiv.appendChild(detailsContainer);
    }

    groupDiv.appendChild(headerDiv);
    createItemsTable(groupDiv, groupItems, skuToObject);
    output.appendChild(groupDiv);
  });
}

function saveGroupDetails(groupId, updatedDetails) {
  // Buscar y actualizar en objectData principal
  const groupIndex = objectData.findIndex(o => String(o.SKU) === String(groupId));
  if (groupIndex !== -1) {
      // Conservar todos los datos existentes y solo actualizar los modificados
      objectData[groupIndex] = { 
          ...objectData[groupIndex], 
          ...updatedDetails 
      };
  }
  
  // Si es un grupo fusionado, actualizar también en mergedGroups
  if (mergedGroups.has(groupId)) {
      const mergedGroup = mergedGroups.get(groupId);
      mergedGroups.set(groupId, {
          ...mergedGroup,
          name: updatedDetails.name || mergedGroup.name,
          ventajas: updatedDetails.ventajas || mergedGroup.ventajas,
          aplicaciones: updatedDetails.aplicaciones || mergedGroup.aplicaciones,
          especificaciones: updatedDetails.especificaciones || mergedGroup.especificaciones,
          incluye: updatedDetails.incluye || mergedGroup.incluye
      });
  }
  
  // Guardar en localStorage para persistencia
  localStorage.setItem('modifiedGroups', JSON.stringify({
      objectData,
      mergedGroups: Array.from(mergedGroups.entries())
  }));
}

// Convierte todas las celdas del grupo a inputs (solo si no son ya input)
function makeGroupItemsEditable(groupDiv, groupId) {
  const table = groupDiv.querySelector('table');
  if (!table) return;

  // Saca los atributos válidos de objectData (excepto marca y item_code)
  const validAttrs = new Set(
    Object.keys(objectData[0] || {}).filter(k => k !== "marca" && k !== "item_code" && k !== "SKU")
  );

  // Encuentra el índice de cada columna por nombre
  const headerCells = table.tHead ? table.tHead.rows[0].cells : [];
  const skipColumns = new Set(["×", "Origen", "marca", "item_code"]);

  Array.from(table.tBodies[0].rows).forEach(row => {
    if (row.classList.contains('sub-table-header')) return; // <--- ESTA LÍNEA ES LA CLAVE

    Array.from(row.cells).forEach((cell, i) => {
      // No editable si ya tiene input, select, o si es "not-editable"
      if (cell.querySelector('input,select') || cell.classList.contains('not-editable')) return;

      // Si hay encabezado, revisa si es columna bloqueada
      let colName = headerCells[i]?.textContent?.trim();
      if (skipColumns.has(colName)) return;
      // Si es atributo no válido (accidental), tampoco
      if (colName && !validAttrs.has(colName)) return;

      // Si llegaste aquí, SÍ es editable
      const prevVal = cell.textContent.trim();
      const input = document.createElement('input');
      input.type = "text";
      input.value = prevVal;
      input.className = "form-control form-control-sm table-input";
      input.style.minWidth = "80px";
      cell.textContent = "";
      cell.appendChild(input);
    });
  });
}

function saveGroupItemEdits(groupDiv, groupIdStr) {
  // Encuentra todos los inputs editables del grupo
  const inputs = groupDiv.querySelectorAll('.table-input');

  // Por cada input, actualiza el objeto correspondiente en objectData o filteredItems
  inputs.forEach(input => {
    // Encuentra la fila y columna para saber qué SKU y atributo es
    // Si usaste dataset en los inputs (¡recomendado!), úsalo:
    const cell = input.closest('td');
    const row = input.closest('tr');
    let sku = null;
    let attribute = null;

    // Intenta obtener el SKU y atributo desde dataset
    if (input.dataset.sku && input.dataset.attribute) {
      sku = input.dataset.sku;
      attribute = input.dataset.attribute;
    } else {
      // Fallback si no tienes dataset:
      // Busca el SKU en una celda específica de la fila (ajusta el índice según tu tabla)
      sku = row.dataset.sku || row.getAttribute('data-sku'); // o busca en la primera celda de la fila
      // Atributo: usa el encabezado de la columna
      const table = groupDiv.querySelector('table');
      const colIndex = Array.from(row.cells).indexOf(cell);
      const th = table.querySelectorAll('th')[colIndex];
      attribute = th ? th.textContent.trim() : null;
    }

    // Actualiza en objectData
    if (sku && attribute) {
      // Busca el objeto correspondiente
      const obj = objectData.find(o => String(o.SKU) === String(sku));
      if (obj) {
        obj[attribute] = input.value;
      }
      // También en filteredItems, si aplica
      const item = filteredItems.find(o => String(o.SKU) === String(sku));
      if (item) {
        item[attribute] = input.value;
      }
    }
  });

  // Mensaje de éxito
  showTemporaryMessage('Cambios guardados correctamente');
}

function loadSavedChanges() {
  const savedData = localStorage.getItem('modifiedGroups');
  if (savedData) {
      const { objectData: savedObjectData, mergedGroups: savedMergedGroups } = JSON.parse(savedData);
      
      // Fusionar cambios guardados con los datos actuales
      if (savedObjectData) {
          objectData = objectData.map(item => {
              const savedItem = savedObjectData.find(s => String(s.SKU) === String(item.SKU));
              return savedItem ? { ...item, ...savedItem } : item;
          });
      }
      
      if (savedMergedGroups) {
          mergedGroups = new Map(savedMergedGroups);
      }
  }
}

function initializeData(initialObjectData, initialFilteredItems) {
  // Cargar datos iniciales
  objectData = initialObjectData;
  filteredItems = initialFilteredItems;
  
  // Cargar modificaciones guardadas
  loadSavedChanges();
  
  // Inicializar groupOrderMap si es necesario
  if (!groupOrderMap) {
      groupOrderMap = new Map();
  }
}


function mergeSelectedGroups() {
  if (selectedGroups.size < 2) {
    alert("Debes seleccionar al menos 2 grupos para unir");
    return;
  }

  const groupsToMerge = Array.from(selectedGroups);
  const newGroupId = `merged-${Date.now()}`;

  // Recupera detalles si ya existían (en memoria o localStorage)
  let previousDetails = '';
  if (mergedGroups.has(newGroupId)) {
    previousDetails = mergedGroups.get(newGroupId).details || '';
  } else if (localStorage.getItem(`merged_details_${newGroupId}`)) {
    previousDetails = localStorage.getItem(`merged_details_${newGroupId}`);
  }

  // Crear array para los items unidos, ÚNICOS por item_code o SKU
  const mergedItemsMap = new Map();
  groupsToMerge.forEach(groupId => {
    const itemsInGroup = filteredItems.filter(item => String(item["IG ID"]) === String(groupId));
    itemsInGroup.forEach(item => {
      const code = item.item_code || item.SKU; // Usa aquí el campo correcto
      if (!mergedItemsMap.has(code)) {
        const mergedItem = {
  ...item,
  __originalIGID: item.__originalIGID || item["Original IG ID"] || groupId,
  "IG ID": newGroupId,
  "Original IG ID": item.__originalIGID || item["Original IG ID"] || groupId
};
        mergedItemsMap.set(code, mergedItem);
      }
    });
  });
  const mergedItems = Array.from(mergedItemsMap.values());

  // Eliminar items de los grupos originales
  filteredItems = filteredItems.filter(item => !groupsToMerge.includes(String(item["IG ID"])));

  // Agregar el nuevo grupo al principio
  filteredItems = [...mergedItems, ...filteredItems];

  // Registrar el grupo unido
  mergedGroups.set(newGroupId, {
    originalGroups: [...groupsToMerge],
    items: [...mergedItems],
    creationTime: Date.now(),
    details: previousDetails
  });

  // Agregar el nuevo grupo a objectData
  const firstGroupId = groupsToMerge[0];
  let firstGroupInfo = objectData.find(o => o.SKU == firstGroupId);
  if (!firstGroupInfo) {
    firstGroupInfo = {
      SKU: firstGroupId,
      name: `Grupo ${firstGroupId}`
    };
  }
  objectData = objectData.filter(o => o.SKU !== newGroupId);
  objectData.push({
    ...firstGroupInfo,
    SKU: newGroupId,
    name: `[Grouped] ${firstGroupInfo.name || firstGroupId}`,
    __isMergedGroup: true,
    __originalGroups: [...groupsToMerge],
    groupCreatedAt: Date.now(),
    details: previousDetails
  });

  // Limpiar la selección visual
  selectedGroups.clear();
  document.querySelectorAll('.group-checkbox').forEach(cb => {
    cb.checked = false;
  });

  // Forzar render completo
  if (filteredItems.length && objectData.length) {
    render();
  }

  // Mensaje visual
  const message = `✅ ${groupsToMerge.length} grupos unidos como ${newGroupId}`;
  fileInfoDiv.scrollTop = fileInfoDiv.scrollHeight;
}

// 4. Agregar estos estilos CSS (puedes ponerlos en tu archivo CSS o crear un elemento style)
function addMergeStyles() {
  if (document.getElementById('group-border-css')) return;
  const style = document.createElement('style');
  style.id = 'group-border-css';
  style.textContent = `

    .group-container.merged-group {
      border-left: 5px solid #007bff;
      margin-bottom: 18px;
      background: #fff;
    }
  `;
  document.head.appendChild(style);
}
addMergeStyles();

function addSeparatedStyles() {
  if (document.getElementById('group-separated-css')) return;
  const style = document.createElement('style');
  style.id = 'group-separated-css';
  style.textContent = `
    .group-container.separated-group {
      border-left: 5px solid #ffe066;
      margin-bottom: 18px;
    }
  `;
  document.head.appendChild(style);
}
addSeparatedStyles();

function createItemsTable(container, groupItems, skuToObject, highlightAttribute = null, customAttributes = null) {
  // Remueve tabla anterior si existe
  const existingHeader = container.querySelector('.group-header');
  const plecaDiv = container.querySelector('.group-details-pleca');
  const existingTable = container.querySelector('.table-responsive');
  if (existingTable) existingTable.remove();

  const groupId = groupItems[0]?.["IG ID"] || groupItems[0]?.SKU || groupItems[0]?.sku;
  const isMergedGroup = typeof mergedGroups !== "undefined" && mergedGroups.has(groupId);
  if (isMergedGroup) container.classList.add('merged-group');

  const table = document.createElement("table");
  table.className = "table table-striped table-bordered sticky-table-header attribute-table";
  table.style.width = "100%";
  table.style.tableLayout = "fixed";

  // FILTRA SKUs DUPLICADOS SOLO EN ESTE GRUPO
  const seenSkus = new Set();
  const uniqueGroupItems = groupItems.filter(item => {
    const sku = item.SKU || item.sku;
    if (seenSkus.has(sku)) return false;
    seenSkus.add(sku);
    return true;
  });

  // Obtener atributos ordenados
  let orderedAttributes;
  if (customAttributes) {
    orderedAttributes = customAttributes.map(attr => ({
      attribute: attr.trim(),
      order: 0,
      isForced: typeof forcedColumns !== "undefined" && forcedColumns.includes(attr.trim())
    }));
  } else {
    orderedAttributes = typeof getOrderedAttributes === "function"
      ? getOrderedAttributes(uniqueGroupItems, skuToObject)
      : Object.keys(uniqueGroupItems[0] || {}).map(attr => ({ attribute: attr, order: 0, isForced: false }));
  }

  // Filtrar atributos según showEmptyAttributes
  const filteredAttributes = orderedAttributes.filter(attr => {
    if (typeof showEmptyAttributes !== "undefined" && showEmptyAttributes) return true;
    return uniqueGroupItems.some(item => {
      const details = skuToObject[item.SKU] || skuToObject[item.sku] || {};
      if (attr.attribute === "product_ranking") {
        return (item.product_ranking || "").toString().trim();
      }
      return details[attr.attribute]?.toString().trim();
    });
  });

  // Detección de SKUs repetidos SOLO EN LA TABLA ACTUAL
  const allSkus = uniqueGroupItems.map(item => item.sku || item.SKU || "").filter(x => x);
  const skuCounts = {};
  allSkus.forEach(sku => {
    skuCounts[sku] = (skuCounts[sku] || 0) + 1;
  });
  const duplicatedSkus = Object.keys(skuCounts).filter(sku => skuCounts[sku] > 1);

  // Crear THEAD y guardar los TH para sub-header
  let theadRowCells = '';
  theadRowCells += `
    <th style='width: 10px;' class='drag-handle-column'>
      <span class='drag-reset-btn' title='Reordenar a estado original'>×</span>
    </th>
  `;
  filteredAttributes.forEach(attr => {
    let isAllEmpty = true;
    for (const item of uniqueGroupItems) {
      const details = skuToObject[item.SKU] || skuToObject[item.sku] || {};
      if (attr.attribute === "product_ranking") {
        if ((item.product_ranking || "").toString().trim()) {
          isAllEmpty = false;
          break;
        }
      } else if (details[attr.attribute]?.toString().trim()) {
        isAllEmpty = false;
        break;
      }
    }
    const isHighlighted = attr.attribute === highlightAttribute;
    const highlightClass = typeof groupDestHighlightAttr !== "undefined" &&
      groupDestHighlightAttr[groupId] === attr.attribute ? 'destination-filled-th' : '';
    theadRowCells += `<th class="${isAllEmpty ? 'empty-header' : ''} ${isHighlighted ? 'highlight-column' : ''} ${highlightClass}">${attr.attribute}</th>`;
  });
  if (typeof forcedColumns !== "undefined") {
    forcedColumns.forEach(forced => {
      let width = "";
      if (forced === "sku") width = "width:95px;min-width:95px;max-width:95px;";
      if (forced === "item_code") width = "width:95px;min-width:95px;max-width:95px;";
      theadRowCells += `<th style="${width}">${forced}</th>`;
    });
  }
  theadRowCells += `<th style="width:70px;min-width:70px;max-width:70px;">Origen</th>`;

  let theadHtml = "<thead><tr>" + theadRowCells + "</tr></thead>";

  // Crear TBODY
  const tbody = document.createElement("tbody");
  tbody.id = `tbody-${groupId}`;

  let currentColorClass = 'origen-cell-color1';
  let lastOrigenValue = null;

  uniqueGroupItems.forEach((item, itemIndex) => {

    const details = skuToObject[item.SKU] || skuToObject[item.sku] || {};
    const currentItem = typeof filteredItems !== "undefined"
      ? filteredItems.find(fi => (fi.SKU || fi.sku) === (item.SKU || item.sku))
      : null;
    const isMergedItem = item.__originalIGID || item["Original IG ID"];

    const row = document.createElement("tr");
    row.dataset.sku = item.SKU || item.sku;

    // Celda de drag handle
    const dragCell = document.createElement("td");
    dragCell.className = "drag-handle";
    dragCell.innerHTML = '≡';
    dragCell.title = "Arrastrar para reordenar";
    row.appendChild(dragCell);

    // Columnas de atributos normales
    filteredAttributes.forEach((attr, attrIdx) => {
      let originalValue;
      if (attr.attribute === "product_ranking") {
        originalValue = (item.product_ranking || "").toString().trim();
      } else {
        originalValue = details[attr.attribute]?.toString().trim() || "";
      }
      const cellKey = `${item.SKU || item.sku}-${attr.attribute}`;
      const cellData = typeof editedCells !== "undefined" ? editedCells[cellKey] : null;
      const shouldShowInput = !originalValue || (cellData && cellData.wasOriginallyEmpty);
      const isHighlighted = attr.attribute === highlightAttribute;
      const cell = document.createElement("td");
      cell.style.minWidth = "100px";
      if (isHighlighted) {
        cell.classList.add('highlight-cell');
      }
      if (shouldShowInput) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control form-control-sm table-input";
        input.value = cellData?.value || originalValue;
        input.dataset.sku = item.SKU || item.sku;
        input.dataset.attribute = attr.attribute;
        input.dataset.originallyEmpty = (!originalValue).toString();
        input.addEventListener('input', function() {
          if (typeof editedCells !== "undefined") {
            editedCells[cellKey] = {
              value: this.value,
              wasOriginallyEmpty: this.dataset.originallyEmpty === 'true'
            };
          }
          if (typeof updateCellStyle === "function") {
            updateCellStyle(cell, this.value.trim());
          }
          if (typeof objectData !== "undefined") {
            const itemToUpdate = objectData.find(o => (o.SKU || o.sku) === this.dataset.sku);
            if (itemToUpdate) {
              itemToUpdate[this.dataset.attribute] = this.value.trim();
            }
          }
        });
        if (typeof updateCellStyle === "function") {
          updateCellStyle(cell, input.value.trim());
        }
        cell.appendChild(input);
      } else {
        cell.textContent = originalValue;
        if (originalValue.length > 40) {
          cell.style.whiteSpace = "normal";
          cell.style.wordBreak = "break-word";
        }
      }
      row.appendChild(cell);
    });

    // Columnas forzadas con anchos fijos
    if (typeof forcedColumns !== "undefined") {
      forcedColumns.forEach(forced => {
        const cell = document.createElement("td");
        let width = "";
        if (forced === "sku") width = "100px";
        if (forced === "item_code") width = "100px";
        cell.style.width = width;
        cell.style.minWidth = width;
        cell.style.maxWidth = width;

          // El valor real del item_code (SKU) viene de item["sku"]
  const value = forced === "item_code"
    ? item["sku"] || item["SKU"] || ""
    : details[forced] || details[forced?.toUpperCase?.()] || "";

  // Pinta la celda de item_code si el CMS IC es diferente al CMS IG seleccionado
  if (forced === "item_code") {
  console.log('item_code:', value, 'CMS IC:', item["CMS IC"], 'currentCmsIg:', currentCmsIg);
}
if (
  forced === "item_code" &&
  item["CMS IC"] &&
  currentCmsIg &&
  item["CMS IC"].toString().trim() !== currentCmsIg.toString().trim()
) {
  cell.style.backgroundColor = "#ffe0e0";
  cell.title = "CMS IC diferente al CMS IG seleccionado";
}

        if (forced === 'item_code' && value) {
          const link = document.createElement("a");
          link.href = `https://www.travers.com.mx/${encodeURIComponent(value)}`;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = value;
          const code = value.toString().trim();
          if (duplicatedSkus.includes(code)) {
            cell.classList.add("item-code-duplicate");
            cell.title = `item_code duplicado (${skuCounts[code]} veces en la tabla)`;
          }
          cell.appendChild(link);
        } else {
          cell.textContent = value;
        }

        row.appendChild(cell);
      });
    }

    // Columna de origen con ancho fijo
    const originCell = document.createElement("td");
    originCell.style.width = "100px";
    originCell.style.minWidth = "100px";
    originCell.style.maxWidth = "100px";
    let origenValue;
    // CAMBIO: SIEMPRE muestra el IG ID original si existe, aunque se agrupe varias veces
    origenValue = item["Original IG ID"] || item.__originalIGID || "-";
    if (origenValue !== "-") {
      if (lastOrigenValue !== origenValue) {
        currentColorClass = currentColorClass === 'origen-cell-color1'
          ? 'origen-cell-color2'
          : 'origen-cell-color1';
        lastOrigenValue = origenValue;
      }
      originCell.textContent = origenValue;
      originCell.classList.add(currentColorClass);
      originCell.style.fontSize = "0.8em";
      originCell.style.color = "#666";
    } else {
      originCell.textContent = "-";
      originCell.style.fontSize = "0.8em";
      originCell.style.color = "#28a745";
      originCell.style.fontWeight = "bold";
    }
    row.appendChild(originCell);
    tbody.appendChild(row);
  });

  table.innerHTML = theadHtml;
  table.appendChild(tbody);

  if (typeof Sortable !== 'undefined') {
    new Sortable(tbody, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: function(evt) {
        if (typeof handleRowReorder === "function") {
          handleRowReorder(evt);
        }
      }
    });
  }

  if (typeof setupRowSelection === "function") {
    setupRowSelection(table);
  }

  const dragResetBtn = table.querySelector('.drag-reset-btn');
  if (dragResetBtn) {
    dragResetBtn.addEventListener('click', function() {
      if (typeof resetGroupOrder === "function") {
        resetGroupOrder(groupId);
      }
    });
  }

  // Otros estilos de origen y drag
  const style = document.createElement('style');
  style.textContent = `
    .origen-cell-color1 { background-color: #e8f5e9 !important; }
    .origen-cell-color2 { background-color: #e3f2fd !important; }
    .drag-handle-column {
      position: relative;
    }
    .drag-reset-btn {
      position: absolute;
      top: 0;
      right: 0;
      cursor: pointer;
      font-size: 16px;
      padding: 0 3px;
      color: #999;
      z-index: 10;
    }
    .drag-reset-btn:hover {
      color: #333;
      background-color: #eee;
      border-radius: 3px;
    }
  `;
  table.appendChild(style);

  const tableContainer = document.createElement("div");
  tableContainer.className = "table-responsive";
  tableContainer.appendChild(table);

  if (plecaDiv) {
    plecaDiv.insertAdjacentElement('afterend', tableContainer);
  } else if (existingHeader) {
    existingHeader.insertAdjacentElement('afterend', tableContainer);
  } else {
    container.appendChild(tableContainer);
  }
}


// === POPUP/MODAL PARA ORDENAR GRUPO POR ATRIBUTOS ===
function injectGroupSortModal() {
  if (document.getElementById('groupSortModal')) return;
  const modal = document.createElement('div');
  modal.id = 'groupSortModal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="group-sort-modal-backdrop"></div>
    <div class="group-sort-modal-content">
      <h3>Ordenar grupo por atributos</h3>
      <div id="groupSortAttrList"></div>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button id="groupSortConfirmBtn" class="btn btn-primary btn-sm">Confirmar</button>
        <button id="groupSortCancelBtn" class="btn btn-outline-secondary btn-sm">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // SOLO para ordenar grupo: CSS propio
  if (!document.getElementById('group-sort-css')) {
    const style = document.createElement('style');
    style.id = 'group-sort-css';
    style.textContent = `
      #groupSortModal { position:fixed;z-index:2000;top:0;left:0;width:100vw;height:100vh;display:none; }
      .group-sort-modal-backdrop {position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.2);}
      .group-sort-modal-content {
        background:white;max-width:400px;padding:24px 18px 18px 18px;border-radius:8px;
        box-shadow:0 6px 32px 0 #2222;position:fixed;top:50%;left:50%;
        transform:translate(-50%,-50%);
      }
      .group-sort-attr-row {display:flex;align-items:center;gap:8px;padding:3px 0;}
      .group-sort-attr-row.selected {background:#e6f7ff;}
      .group-sort-attr-row .move-btn {font-size:1.2em;cursor:pointer;background:none;border:none;}
      .group-sort-attr-row .move-btn:disabled {opacity:0.2;}
      .group-sort-attr-row label {flex:1;}
    `;
    document.head.appendChild(style);
  }

  document.getElementById('groupSortCancelBtn').onclick = closeGroupSortModal;
}

// Estado temporal del modal (por grupo)

// MODAL DE ORDEN: SIEMPRE incluye product_ranking
function openGroupSortModal(groupId, groupItems, skuToObject, attributeList) {
  groupSortModalState.groupId = groupId;
  groupSortModalState.groupItems = groupItems;

  // Incluye todos los atributos de attributeList que no están en excludedAttributes
  let available = attributeList.filter(attr => !excludedAttributes.has(attr));
  let selected = [];

  // Forzar que 'product_ranking' esté siempre al principio
  if (!available.includes("product_ranking")) {
    available.unshift("product_ranking");
  }

  // Forzar que 'marca' esté siempre en la lista (después de product_ranking)
  if (!available.includes("marca")) {
    if (available[0] === "product_ranking") {
      available.splice(1, 0, "marca");
    } else {
      available.unshift("marca");
    }
  }

  // NUEVO: Agrega IG ID Original como opción para ordenar
  if (!available.includes("IG ID Original")) {
    available.unshift("IG ID Original");
  }

  // UI ajustada
  const listDiv = document.getElementById('groupSortAttrList');
  listDiv.innerHTML = `
    <div class="dual-list-modal compact">
      <div class="dual-list-col">
        <div class="dual-list-label">Atributos disponibles</div>
        <ul id="attr-available" class="dual-list-box" tabindex="0"></ul>
      </div>
      <div class="dual-list-controls">
        <button id="attr-add" title="Agregar seleccionados" class="dual-list-btn compact-btn">&rarr;</button>
        <button id="attr-remove" title="Quitar seleccionados" class="dual-list-btn compact-btn">&larr;</button>
      </div>
      <div class="dual-list-col">
        <div class="dual-list-label">Seleccionados</div>
        <ul id="attr-selected" class="dual-list-box dual-list-selected" tabindex="0"></ul>
      </div>
    </div>
  `;

  // Añade CSS compacto una sola vez
  if (!document.getElementById('dual-list-css')) {
    const style = document.createElement('style');
    style.id = 'dual-list-css';
    style.textContent = `
      .dual-list-modal.compact {
        display: flex;
        gap: 16px;
        justify-content: center;
        align-items: center;
        padding: 8px 0 0 0;
        font-size: 13px;
      }
      .dual-list-col {
        flex:1; min-width:120px; max-width:170px;
      }
      .dual-list-label {
        text-align: center;
        font-weight: 500;
        margin-bottom: 4px;
        font-size: 12px;
        color: #456;
      }
      .dual-list-box {
        border: 1px solid #bbb;
        background: #fafbfc;
        border-radius: 4px;
        min-height: 120px;
        max-height: 160px;
        overflow-y: auto;
        list-style: none;
        margin: 0; padding: 0;
        font-size: 13px;
      }
      .dual-list-box li {
        padding: 4px 7px;
        cursor: pointer;
        user-select: none;
        transition: background 0.13s;
        border-bottom: 1px solid #eee;
        font-size: 13px;
      }
      .dual-list-box li:last-child { border-bottom: none;}
      .dual-list-box li.selected, .dual-list-box li:focus {
        background: #e6f1ff;
        outline: none;
      }
      .dual-list-controls {
        display: flex;
        flex-direction: column;
        gap: 7px;
        justify-content: center;
        align-items: center;
      }
      .dual-list-btn {
        font-size: 1.08em;
        width: 30px; height: 30px;
        border-radius: 50%; border: none;
        background: #f1f4f7;
        color: #456;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
        padding: 0;
      }
      .dual-list-btn:active, .dual-list-btn:focus { background: #d6e8fd; color: #124;}
      .dual-list-selected li {
        cursor: grab;
      }
      @media (max-width:600px) {
        .dual-list-modal.compact { flex-direction:column; gap:7px;}
        .dual-list-controls { flex-direction:row; gap: 7px;}
      }
    `;
    document.head.appendChild(style);
  }

  // Render helpers
  function renderLists() {
    const availUl = listDiv.querySelector('#attr-available');
    availUl.innerHTML = available.map(attr =>
      `<li tabindex="0">${attr}</li>`
    ).join('');
    const selUl = listDiv.querySelector('#attr-selected');
    selUl.innerHTML = selected.map(attr =>
      `<li draggable="true" tabindex="0">${attr}</li>`
    ).join('');
  }
  renderLists();

  // Selection logic
  function getSelectedIndices(ul) {
    return Array.from(ul.querySelectorAll('li.selected')).map(li =>
      Array.from(ul.children).indexOf(li)
    );
  }
  function selectLi(li, multi=false) {
    const ul = li.parentElement;
    if (!multi) ul.querySelectorAll('li.selected').forEach(l => l.classList.remove('selected'));
    li.classList.add('selected');
    li.focus();
  }
  function clearSelection(ul) { ul.querySelectorAll('li.selected').forEach(l => l.classList.remove('selected')); }

  function setupListClicks(ul, multiAllowed) {
    ul.addEventListener('click', (e) => {
      if (e.target.tagName === "LI") {
        selectLi(e.target, e.ctrlKey || e.metaKey);
      }
    });
    ul.addEventListener('dblclick', (e) => {
      if (e.target.tagName !== "LI") return;
      if (ul.id === 'attr-available') addAttrs();
      else removeAttrs();
    });
    ul.addEventListener('keydown', (e) => {
      const items = ul.querySelectorAll('li');
      let idx = Array.from(items).findIndex(li => li.classList.contains('selected'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx < items.length - 1) {
          clearSelection(ul);
          selectLi(items[idx + 1]);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx > 0) {
          clearSelection(ul);
          selectLi(items[idx - 1]);
        }
      }
    });
  }
  setupListClicks(listDiv.querySelector('#attr-available'));
  setupListClicks(listDiv.querySelector('#attr-selected'));

  // Add to selected
  function addAttrs() {
    const ul = listDiv.querySelector('#attr-available');
    const idxs = getSelectedIndices(ul);
    const toAdd = idxs.map(i => available[i]);
    selected = selected.concat(toAdd);
    available = available.filter(a => !toAdd.includes(a));
    renderLists(); setupListClicks(listDiv.querySelector('#attr-available')); setupListClicks(listDiv.querySelector('#attr-selected'));
  }
  // Remove from selected
  function removeAttrs() {
    const ul = listDiv.querySelector('#attr-selected');
    const idxs = getSelectedIndices(ul);
    const toRemove = idxs.map(i => selected[i]);
    available = available.concat(toRemove);
    selected = selected.filter(a => !toRemove.includes(a));
    renderLists(); setupListClicks(listDiv.querySelector('#attr-available')); setupListClicks(listDiv.querySelector('#attr-selected'));
  }
  listDiv.querySelector('#attr-add').onclick = addAttrs;
  listDiv.querySelector('#attr-remove').onclick = removeAttrs;

  // Drag and drop para reordenar
  const selUl = listDiv.querySelector('#attr-selected');
  let dragIdx = null;
  selUl.addEventListener('dragstart', e => {
    dragIdx = Array.from(selUl.children).indexOf(e.target);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  });
  selUl.addEventListener('dragend', e => { e.target.style.opacity = ''; });
  selUl.addEventListener('dragover', e => e.preventDefault());
  selUl.addEventListener('drop', e => {
    e.preventDefault();
    if (dragIdx === null) return;
    const targetLi = e.target.closest('li');
    if (!targetLi) return;
    const dropIdx = Array.from(selUl.children).indexOf(targetLi);
    if (dropIdx === dragIdx) return;
    const moved = selected.splice(dragIdx, 1)[0];
    selected.splice(dropIdx, 0, moved);
    renderLists(); setupListClicks(listDiv.querySelector('#attr-available')); setupListClicks(listDiv.querySelector('#attr-selected'));
    dragIdx = null;
  });

  // Confirmar
  document.getElementById('groupSortConfirmBtn').onclick = () => {
    if (selected.length === 0) {
      alert('Selecciona al menos un atributo para ordenar.');
      return;
    }
    confirmGroupSortModal(selected);
    closeGroupSortModal();
  };

  document.getElementById('groupSortModal').style.display = 'block';
}



// ORDENAMIENTO: product_ranking como número
function confirmGroupSortModal(orderedAttrs) {
  const { groupId } = groupSortModalState;
  const groupItems = filteredItems.filter(item => String(item["IG ID"]) === String(groupId));
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));

  const valueOrderMap = new Map();
  (window.valueOrderList || []).forEach(row => {
    if (!row["Nombre atributo"] || !row["Valor de Atributo"]) return;
    const key = `${row["Nombre atributo"]}|||${row["Valor de Atributo"]}`;
    valueOrderMap.set(key, Number(row.sort_order));
  });

  const items = groupItems.slice();
  items.sort((a, b) => {
    for (const attr of orderedAttrs) {
      let va, vb;
      if (attr === "IG ID Original") {
        va = a["IG ID Original"] || a.__originalIGID || "";
        vb = b["IG ID Original"] || b.__originalIGID || "";
        if (va < vb) return -1;
        if (va > vb) return 1;
        // Si son iguales, sigue al siguiente atributo
      } else if (attr === "product_ranking") {
        va = (skuToObject[a.SKU]?.[attr] ?? a[attr] ?? "");
        vb = (skuToObject[b.SKU]?.[attr] ?? b[attr] ?? "");
        const na = Number(va) || Infinity;
        const nb = Number(vb) || Infinity;
        if (na !== nb) return na - nb;
      } else {
        va = (skuToObject[a.SKU]?.[attr] ?? a[attr] ?? "");
        vb = (skuToObject[b.SKU]?.[attr] ?? b[attr] ?? "");
        const sortA = valueOrderMap.get(`${attr}|||${va}`);
        const sortB = valueOrderMap.get(`${attr}|||${vb}`);
        if (sortA !== undefined && sortB !== undefined) {
          if (sortA !== sortB) return sortA - sortB;
        } else if (sortA !== undefined) {
          return -1;
        } else if (sortB !== undefined) {
          return 1;
        } else {
          if (va < vb) return -1;
          if (va > vb) return 1;
        }
      }
    }
    return 0;
  });

  groupOrderMap.set(groupId, items.map(it => it.SKU));
  const groupContainer = document.querySelector(`.group-container[data-group-id="${groupId}"]`);
  if (groupContainer) {
    const existingTable = groupContainer.querySelector('.table-responsive');
    if (existingTable) existingTable.remove();
    const orderedSkus = groupOrderMap.get(groupId);
    const orderedItems = orderedSkus
      .map(sku => items.find(it => it.SKU === sku))
      .filter(Boolean);
    createItemsTable(groupContainer, orderedItems, skuToObject);
  }
  showTemporaryMessage('Grupo ordenado por atributos seleccionados');
}

function closeGroupSortModal() {
  document.getElementById('groupSortModal').style.display = 'none';
  groupSortModalState = { groupId: null, groupItems: [], orderedAttrs: [] };
}

function setupRowSelection(table) {
  let lastSelectedRow = null;
  
  table.querySelectorAll('tr').forEach((row, index) => {
    // Saltar la fila de encabezados
    if (index === 0) return;
    
    row.addEventListener('click', function(e) {
      // Si se hace clic en el handle de arrastre, no seleccionar
      if (e.target.classList.contains('drag-handle')) return;
      
      // Manejar selección con Ctrl
      if (e.ctrlKey || e.metaKey) {
        this.classList.toggle('selected');
      } 
      // Manejar selección con Shift
      else if (e.shiftKey && lastSelectedRow) {
        const rows = Array.from(table.querySelectorAll('tr'));
        const startIndex = rows.indexOf(lastSelectedRow);
        const endIndex = rows.indexOf(this);
        
        const [start, end] = [startIndex, endIndex].sort((a, b) => a - b);
        
        rows.forEach((row, idx) => {
          if (idx > start && idx < end) {
            row.classList.add('selected');
          }
        });
      } 
      // Selección simple
      else {
        table.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        this.classList.add('selected');
      }
      
      lastSelectedRow = this;
    });
  });
}

// Función auxiliar para actualizar estilos de celda
function updateCellStyle(cell, hasValue) {
    if (hasValue) {
        cell.classList.add('filled-cell');
        cell.classList.remove('empty-cell');
    } else {
        cell.classList.remove('filled-cell');
        cell.classList.add('empty-cell');
    }
}

// Función auxiliar para actualizar estilos de celda
function updateCellStyle(cell, hasValue) {
  cell.classList.toggle('filled-cell', hasValue);
  cell.classList.toggle('empty-cell', !hasValue);
}

// 3. Asegurarse de tener esta función auxiliar
function updateCellStyle(cell, hasValue) {
  if (hasValue) {
    cell.classList.add('filled-cell');
    cell.classList.remove('empty-cell');
  } else {
    cell.classList.remove('filled-cell');
    cell.classList.add('empty-cell');
  }
}

// 4. Agregar esta función para limpiar el estado cuando sea necesario
function clearEditedCells() {
  editedCells = {};
}

// Función auxiliar para actualizar estilos de celda
function updateCellStyle(cell, hasValue) {
  if (hasValue) {
    cell.classList.add('filled-cell');
    cell.classList.remove('empty-cell');
  } else {
    cell.classList.remove('filled-cell');
    cell.classList.add('empty-cell');
  }
}

function applyCategoryTables() {
  if (!filteredItems.length || !objectData.length) {
    alert("Primero debes cargar los archivos necesarios");
    return;
  }
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  const groups = {};
  filteredItems.forEach(item => {
    const groupIdStr = String(item["IG ID"]);
    if (!groups[groupIdStr]) groups[groupIdStr] = [];
    groups[groupIdStr].push(item);
  });

  output.innerHTML = '';
  createStatusMessage();

  // --- Botones de arriba (igual que processItemGroups) ---
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "groups-controls";
  const mergeBtn = document.createElement("button");
  mergeBtn.className = "btn btn-primary";
  mergeBtn.textContent = "Agrupar";
  mergeBtn.addEventListener('click', mergeSelectedGroups);
  const selectAllBtn = document.createElement("button");
  selectAllBtn.className = "btn btn-secondary";
  selectAllBtn.textContent = "Seleccionar Todos";
  selectAllBtn.addEventListener('click', selectAllGroups);
  const deselectAllBtn = document.createElement("button");
  deselectAllBtn.className = "btn btn-outline-secondary";
  deselectAllBtn.textContent = "Deseleccionar Todos";
  deselectAllBtn.addEventListener('click', deselectAllGroups);

  const selectionCount = document.createElement("span");
  selectionCount.className = "selection-count";
  selectionCount.textContent = selectedGroups.size > 0 ? `(${selectedGroups.size} seleccionados)` : "";
  controlsDiv.appendChild(mergeBtn);
  controlsDiv.appendChild(selectAllBtn);
  controlsDiv.appendChild(deselectAllBtn);
  controlsDiv.appendChild(selectionCount);
  output.appendChild(controlsDiv);

const orderedGroupIds = [
  ...Array.from(groupOrderMap.keys()).filter(id => groups[id]),
  ...Object.keys(groups).filter(id => !groupOrderMap.has(id))
];

// Ordena: merged y split primero, luego el resto
orderedGroupIds.sort((a, b) => {
  const isMergedA = a.startsWith('merged-');
  const isMergedB = b.startsWith('merged-');
  const isSplitA = a.startsWith('split-') || a.startsWith('split-');
  const isSplitB = b.startsWith('split-') || b.startsWith('split-');
  // Merged primero, luego split, luego el resto
  if (isMergedA && !isMergedB) return -1;
  if (!isMergedA && isMergedB) return 1;
  if (isSplitA && !isSplitB) return -1;
  if (!isSplitA && isSplitB) return 1;
  return 0;
});

orderedGroupIds.forEach(groupIdStr => {
  const groupItems = groups[groupIdStr];
  if (!groupItems || !groupItems.length) return;
  const orderedSkus = groupOrderMap.get(groupIdStr);
  let orderedGroupItems = groupItems;
  if (Array.isArray(orderedSkus)) {
    // Solo los SKUs filtrados, pero en el orden original
    orderedGroupItems = orderedSkus
      .map(sku => groupItems.find(item => item.SKU === sku))
      .filter(Boolean);
  }

  const groupInfo = skuToObject[groupIdStr] || {};
  const isMergedGroup = mergedGroups.has(groupIdStr);

    // --- Checkbox fuera del header, igual que processItemGroups ---
    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container${isMergedGroup ? ' merged-group' : ''}`;
    groupDiv.dataset.groupId = groupIdStr;

    const checkboxDiv = document.createElement("div");
    checkboxDiv.className = "group-checkbox-container";
    checkboxDiv.innerHTML = `
      <input type="checkbox" class="group-checkbox" id="group-${groupIdStr}" 
             data-group-id="${groupIdStr}"
             ${selectedGroups.has(groupIdStr) ? 'checked' : ''}>
      <label for="group-${groupIdStr}"></label>
    `;
    groupDiv.appendChild(checkboxDiv);

    // --- Header del grupo ---
    const headerDiv = document.createElement("div");
    headerDiv.className = "group-header";

    // --- Contenido del header (left + right) ---
    const headerContentDiv = document.createElement("div");
    headerContentDiv.className = "group-header-content";

    // --- Contenedor izquierdo (imagen + info) ---
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";

    const productImg = createProductImageElement(groupInfo.image);
    leftContainer.appendChild(productImg);

    const infoDiv = document.createElement("div");
    infoDiv.className = "group-info";
    const titleContainer = document.createElement("div");
    titleContainer.className = "group-title-container";

    if (isMergedGroup) {
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "group-title-input";
      titleInput.value = groupInfo.name || groupIdStr;
      titleInput.addEventListener("blur", function() {
        const newTitle = this.value.trim();
        if (newTitle) {
          const groupObj = objectData.find(o => o.SKU === groupIdStr);
          if (groupObj) groupObj.name = newTitle;
          const mergedGroup = mergedGroups.get(groupIdStr);
          if (mergedGroup) mergedGroup.name = newTitle;
        }
      });
      titleContainer.appendChild(titleInput);
    } else {
      const title = document.createElement("h2");
      title.className = "group-title";
      const link = document.createElement("a");
      link.href = `https://www.travers.com.mx/${groupIdStr}`;
      link.target = "_blank";
      link.textContent = groupInfo.name || groupIdStr;
      title.appendChild(link);
      titleContainer.appendChild(title);
    }
    infoDiv.appendChild(titleContainer);
    const logo = createBrandLogoElement(groupInfo.brand_logo);
    infoDiv.appendChild(logo);
    if (groupInfo.sku) {
      const skuP = document.createElement("p");
      skuP.textContent = "SKU: " + groupInfo.sku;
      infoDiv.appendChild(skuP);
    }
    leftContainer.appendChild(infoDiv);
    headerContentDiv.appendChild(leftContainer);

    // --- Right header usando tu función extraída ---
    const rightContainer = createGroupHeaderRight({
      groupIdStr,
      groupItems,
      skuToObject,
      isMergedGroup,
      groupDiv
    });
    headerContentDiv.appendChild(rightContainer);

    headerDiv.appendChild(headerContentDiv);

    // --- Bloque de detalles/pleca con toggle SIEMPRE ---
    let detailsHtml = "";
    if (groupInfo) {
      if (groupInfo.ventajas) detailsHtml += `<div class="details-row"><strong>Ventajas:<br></strong> ${groupInfo.ventajas}</div>`;
      if (groupInfo.aplicaciones) detailsHtml += `<div class="details-row"><strong>Aplicaciones:<br></strong> ${groupInfo.aplicaciones}</div>`;
      if (groupInfo.especificaciones) detailsHtml += `<div class="details-row"><strong>Especificaciones:<br></strong> ${groupInfo.especificaciones}</div>`;
      if (groupInfo.incluye) detailsHtml += `<div class="details-row"><strong>Incluye:<br></strong> ${groupInfo.incluye}</div>`;
    }

    if (detailsHtml || isMergedGroup) {
      const detailsContainer = document.createElement("div");
      detailsContainer.className = "group-details-container";
      const toggleDetailsBtn = document.createElement("button");
      toggleDetailsBtn.className = "toggle-details-btn";
      toggleDetailsBtn.textContent = "▼ Detalles";
      toggleDetailsBtn.setAttribute("aria-expanded", "false");

      const detailsDiv = document.createElement("div");
      detailsDiv.className = "group-extra-details";
      detailsDiv.style.display = "none";

      if (isMergedGroup) {
        const mergedTextarea = document.createElement("textarea");
        mergedTextarea.className = "form-control merged-group-textarea";
        mergedTextarea.rows = 10;
        let mergedContent = getMergedGroupDetails(groupIdStr);
        if (!mergedContent) {
          // Genera el default solo si nunca se ha editado
          const mergedGroupData = mergedGroups.get(groupIdStr);
          mergedContent = "";
          mergedGroupData.originalGroups.forEach(originalGroupId => {
            const originalGroupInfo = objectData.find(o => o.SKU === originalGroupId) || {};
            mergedContent += `${originalGroupId}, ${originalGroupInfo.name || ''}, ${originalGroupInfo.brand_logo || ''}\n`;
            const fields = ['ventajas', 'aplicaciones', 'especificaciones', 'incluye'];
            fields.forEach(field => {
              if (originalGroupInfo[field]) {
                let fieldValue = originalGroupInfo[field]
                  .replace(/<special[^>]*>|<\/special>|<strong>|<\/strong>/gi, '')
                  .replace(/<br\s*\/?>|<\/br>/gi, '\n');
                mergedContent += `${field.charAt(0).toUpperCase() + field.slice(1)}:\n${fieldValue}\n\n`;
              }
            });
            mergedContent += "--------------------\n\n";
          });
        }
        mergedTextarea.value = mergedContent.trim();

        const saveBtn = document.createElement("button");
        saveBtn.className = "btn btn-sm btn-primary save-merged-btn";
        saveBtn.textContent = "Guardar Cambios";
        saveBtn.addEventListener('click', function() {
          saveMergedGroupDetails(groupIdStr, mergedTextarea.value);
        });

        detailsDiv.appendChild(mergedTextarea);
        detailsDiv.appendChild(saveBtn);
      } else {
        detailsDiv.innerHTML = detailsHtml;
      }

      toggleDetailsBtn.addEventListener("click", function () {
        const expanded = toggleDetailsBtn.getAttribute("aria-expanded") === "true";
        toggleDetailsBtn.setAttribute("aria-expanded", !expanded);
        detailsDiv.style.display = expanded ? "none" : "block";
        toggleDetailsBtn.textContent = expanded ? "▼ Detalles" : "▲ Detalles";
      });

      detailsContainer.appendChild(toggleDetailsBtn);
      detailsContainer.appendChild(detailsDiv);
      headerDiv.appendChild(detailsContainer);
    }

    groupDiv.appendChild(headerDiv);

    // --- SOLO CAMBIA ESTA PARTE ---
    // Lee columnas de table_attributes_cat del primer item
    const groupObj = groupItems[0];
    let customAttrs = null;
    if (groupObj && groupObj.table_attributes_cat) {
      customAttrs = groupObj.table_attributes_cat
        .split(",")
        .map(attr => attr.trim())
        .filter(attr => attr && attr !== "marca" && attr !== "sku" && attr !== "price");
    }
    createItemsTable(groupDiv, groupItems, skuToObject, null, customAttrs);

    output.appendChild(groupDiv);

    // Checkbox handler
    const groupCheckbox = groupDiv.querySelector('.group-checkbox');
    if (groupCheckbox) {
      groupCheckbox.addEventListener('change', function() {
        if (this.checked) selectedGroups.add(this.dataset.groupId);
        else selectedGroups.delete(this.dataset.groupId);
        selectionCount.textContent = selectedGroups.size > 0 ? `(${selectedGroups.size} seleccionados)` : "";
      });
    }
      });
}

function initVerticalDrag(e) {
  isVerticalDragging = true;
  startX = e.clientX;
  startLeftWidth = leftSection.getBoundingClientRect().width;
  document.addEventListener('mousemove', handleVerticalDrag);
  document.addEventListener('mouseup', stopVerticalDrag);
}

function handleVerticalDrag(e) {
  if (!isVerticalDragging) return;
  const containerWidth = container.getBoundingClientRect().width;
  const dividerWidth = verticalDivider.offsetWidth;
  const minWidth = 100;
  const dx = e.clientX - startX;
  
  let newLeftWidth = startLeftWidth + dx;
  let newRightWidth = containerWidth - newLeftWidth - dividerWidth;

  if (newLeftWidth < minWidth) {
    newLeftWidth = minWidth;
    newRightWidth = containerWidth - newLeftWidth - dividerWidth;
  } else if (newRightWidth < minWidth) {
    newRightWidth = minWidth;
    newLeftWidth = containerWidth - newRightWidth - dividerWidth;
  }

  leftSection.style.width = newLeftWidth + 'px';
  rightSection.style.flex = 'none';
  rightSection.style.width = newRightWidth + 'px';
}

function stopVerticalDrag() {
  isVerticalDragging = false;
  document.removeEventListener('mousemove', handleVerticalDrag);
  document.removeEventListener('mouseup', stopVerticalDrag);
}

function initHorizontalDrag(e, topBoxId, bottomBoxId) {
  const topBox = document.getElementById(topBoxId);
  const bottomBox = document.getElementById(bottomBoxId);
  let isDragging = true;
  let startY = e.clientY;
  let startTopHeight = topBox.getBoundingClientRect().height;
  let startBottomHeight = bottomBox.getBoundingClientRect().height;

  function handleDrag(e) {
    if (!isDragging) return;
    const dy = e.clientY - startY;
    const newTopHeight = startTopHeight + dy;
    const newBottomHeight = startBottomHeight - dy;

    if (newTopHeight >= 50 && newBottomHeight >= 50) {
      topBox.style.height = newTopHeight + 'px';
      bottomBox.style.height = newBottomHeight + 'px';
      topBox.style.flexGrow = '0';
      bottomBox.style.flexGrow = '0';
    }
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
}

function clearFilterInputs() {
  // 1. Limpiar inputs de filtros
  Object.keys(attributeFilterInputs).forEach(attr => {
    const input = attributeFilterInputs[attr];
    input.value = '';
    localStorage.setItem(`filter_${attr}`, '0');
  });

  // 2. Limpiar filtros activos
  activeFilters = {};

  // 3. Resetear dropdowns
  document.querySelectorAll('.attribute-dropdown').forEach(dropdown => {
    dropdown.value = '';
  });

  // 4. Actualizar visualización si hay datos
  if (objectData.length && filteredItems.length) {
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
  }

}
// ========== MODAL "Mover Info" ==========



function injectMoveInfoModal() {
  if (document.getElementById('moveInfoModal')) return;
  const modal = document.createElement('div');
  modal.id = 'moveInfoModal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="group-sort-modal-backdrop"></div>
    <div class="group-sort-modal-content">
      <h3>Mover información entre atributos</h3>
      <div style="margin-bottom:12px;">Selecciona un atributo de origen y uno de destino para mover/copiar la información.</div>
      <div id="moveInfoSelects" style="display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:14px;">
        <div>
          <label>Origen<br>
            <select id="moveInfoSource" class="form-control form-control-sm"></select>
          </label>
        </div>
        <div>
          <label>Destino<br>
            <select id="moveInfoTarget" class="form-control form-control-sm"></select>
          </label>
        </div>
      </div>
      <div style="margin-bottom:8px;">
        <input type="checkbox" id="moveInfoClearSource" style="vertical-align:middle;"> 
        <label for="moveInfoClearSource" style="font-size:12px;vertical-align:middle;">Vaciar origen después de copiar</label>
      </div>
      <div style="color:#8a2626;font-size:12px;margin-bottom:8px;" id="moveInfoWarning"></div>
      <div style="display:flex;gap:8px;">
        <button id="moveInfoConfirmBtn" class="btn btn-primary btn-sm">Confirmar</button>
        <button id="moveInfoCancelBtn" class="btn btn-outline-secondary btn-sm">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Reutiliza CSS del modal de sort, no agregamos más aquí

  document.getElementById('moveInfoCancelBtn').onclick = closeMoveInfoModal;
}



function openMoveInfoModal(groupId, groupItems, attributeList) {
  moveInfoModalState.groupId = groupId;
  moveInfoModalState.groupItems = groupItems;
  moveInfoModalState.attributes = attributeList;

  // Llena los select con los atributos visibles en la tabla
  const sourceSel = document.getElementById('moveInfoSource');
  const targetSel = document.getElementById('moveInfoTarget');
  sourceSel.innerHTML = '';
  targetSel.innerHTML = '';
  attributeList.forEach(attr => {
    const opt1 = document.createElement('option');
    opt1.value = attr;
    opt1.textContent = attr;
    sourceSel.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = attr;
    opt2.textContent = attr;
    targetSel.appendChild(opt2);
  });
  // El warning oculto al principio
  document.getElementById('moveInfoWarning').textContent = '';
  // El checkbox desmarcado
  document.getElementById('moveInfoClearSource').checked = true;

  document.getElementById('moveInfoModal').style.display = 'block';

  document.getElementById('moveInfoConfirmBtn').onclick = confirmMoveInfoModal;
}
function closeMoveInfoModal() {
  document.getElementById('moveInfoModal').style.display = 'none';
  moveInfoModalState = { groupId: null, groupItems: [], attributes: [] };
}

function addUndoMoveInfoBtn(groupId, srcAttr, dstAttr, clearSrc) {
  const groupDiv = document.querySelector(`.group-container[data-group-id="${groupId}"]`);
  if (!groupDiv) return;
  const headerRight = groupDiv.querySelector('.group-header-right');
  if (!headerRight) return;

  // Quitar botón previo si existe
  let existingBtn = headerRight.querySelector('.undo-move-info-btn');
  if (existingBtn) existingBtn.remove();

  // Crea el botón de deshacer
  const undoBtn = document.createElement('button');
  undoBtn.className = "btn btn-sm btn-warning undo-move-info-btn";
  undoBtn.textContent = "Deshacer mover info";
  undoBtn.title = `Deshace el último movimiento de info (${srcAttr} → ${dstAttr})`;
  undoBtn.onclick = function() {
    undoMoveInfo(groupId, srcAttr, dstAttr, clearSrc);
  };

  headerRight.insertBefore(undoBtn, headerRight.firstChild);
}

// ========== LÓGICA DEL MOVIMIENTO ==========


function confirmMoveInfoModal() {
  const srcAttr = document.getElementById('moveInfoSource').value;
  const dstAttr = document.getElementById('moveInfoTarget').value;
  const clearSrc = document.getElementById('moveInfoClearSource').checked;
  const warningDiv = document.getElementById('moveInfoWarning');
  if (!srcAttr || !dstAttr || srcAttr === dstAttr) {
    warningDiv.textContent = 'Debes elegir atributos diferentes.';
    return;
  }
  warningDiv.textContent = '';

  const groupId = moveInfoModalState.groupId;
  const items = filteredItems.filter(item => String(item["IG ID"]) === String(groupId));
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));

  // Backup antes de modificar (para deshacer)
moveInfoUndoBackup[groupId] = {
  srcAttr,
  dstAttr,
  values: items.map(item => ({
    SKU: item.SKU,
    srcAttrValue: skuToObject[item.SKU]?.[srcAttr],
    dstAttrValue: skuToObject[item.SKU]?.[dstAttr]
  }))
};

  let anyChange = false;
  items.forEach(item => {
    const obj = skuToObject[item.SKU];
    if (!obj) return;
    const srcVal = (obj[srcAttr] || '').toString().trim();
    const dstVal = (obj[dstAttr] || '').toString().trim();
    if (!srcVal && dstVal) return;
    if (srcVal && (!dstVal || dstVal)) {
      obj[dstAttr] = srcVal;
      anyChange = true;
      if (clearSrc) obj[srcAttr] = '';
    }
  });

  if (anyChange) {
    // Highlight header destino en tabla
    groupDestHighlightAttr[groupId] = dstAttr;

    showTemporaryMessage('Información movida correctamente');
    refreshView();

    // Espera a que el DOM esté renderizado y luego: scroll + resalta head + muestra botón deshacer
    let attempts = 0;
    const maxAttempts = 20;
    const pollId = setInterval(() => {
      const output = document.getElementById('output');
      const groupDiv = document.querySelector(`.group-container[data-group-id="${groupId}"]`);
      if (output && groupDiv) {
        // Scroll
        groupDiv.scrollIntoView({ behavior: "auto", block: "start" });
        output.scrollTop -= 40;

        // Resalta header (el render de la tabla debe usar groupDestHighlightAttr[groupId])
        // Muestra botón "Deshacer mover info"

        clearInterval(pollId);
      }
      if (++attempts > maxAttempts) clearInterval(pollId);
    }, 50);
  } else {
    showTemporaryMessage('No hubo cambios');
  }
  closeMoveInfoModal();
}



function loadDefaultFilters() {
  if (defaultFilterAttributes.size === 0) {
      return;
  }

  // 1. Aplicar solo a inputs de filtro
  const filterAttrsArray = Array.from(defaultFilterAttributes);
  Object.keys(attributeFilterInputs).forEach(attr => {
      if (defaultFilterAttributes.has(attr)) {
          const order = filterAttrsArray.indexOf(attr) + 1;
          attributeFilterInputs[attr].value = order;
          localStorage.setItem(`filter_${attr}`, order.toString());
      }
  });

  // 2. Limpiar filtros activos
  attributeFiltersState = {};

  // 3. Regenerar dropdowns (sin afectar tablas)
  // 4. Feedback visual
}

function groupAllVisibleSplits(
  splitVisibleItems,
  splitRestItems,
  splitGroupObjects,
  originalGroups,
  objectData,
  filteredItems
) {
  // Usa el array original para reconstruir los objetos completos
  const newGroupId = `merged-${Date.now()}`;

  // 1. Reconstruye splitVisibleItems con todos los datos originales
  splitVisibleItems = splitVisibleItems.map(item => {
    const originalObj = objectDataOriginal.find(o => o.SKU === item.SKU);
    if (originalObj) {
      return {
        ...originalObj,
        "IG ID": newGroupId,
        "Original IG ID": item.__originalIGID || item["Original IG ID"] || originalObj["IG ID"],
        __originalIGID: item.__originalIGID || item["Original IG ID"] || originalObj["IG ID"]
      };
    }
    return item;
  });

  // 2. Reconstruye splitRestItems igual
  splitRestItems = splitRestItems.map(item => {
    const originalObj = objectDataOriginal.find(o => o.SKU === item.SKU);
    if (originalObj) {
      return {
        ...originalObj,
        "IG ID": item["IG ID"],
        "Original IG ID": item.__originalIGID || item["Original IG ID"] || originalObj["IG ID"],
        __originalIGID: item.__originalIGID || item["Original IG ID"] || originalObj["IG ID"]
      };
    }
    return item;
  });

  // 3. Elimina los SKUs viejos de filteredItems y objectData
  const allNewSkus = new Set([
    ...splitVisibleItems.map(i => i.SKU),
    ...splitRestItems.map(i => i.SKU)
  ]);
  filteredItems = filteredItems.filter(item => !allNewSkus.has(item.SKU));
  objectData = objectData.filter(item => !allNewSkus.has(item.SKU));

  // 4. Agrega los nuevos objetos completos
  filteredItems = [
    ...filteredItems,
    ...splitVisibleItems,
    ...splitRestItems
  ];
  objectData = [
    ...objectData,
    ...splitVisibleItems,
    ...splitRestItems,
    ...splitGroupObjects.filter(o => o.SKU && o["IG ID"])
  ];

  // 5. Registrar el grupo unido
  mergedGroups.set(newGroupId, {
    originalGroups,
    items: splitVisibleItems.map(i => ({ ...i })),
    creationTime: Date.now(),
    details: ''
  });

  // 6. Crea el objeto de grupo unido SOLO con los datos del primer item visible
  const firstItem = splitVisibleItems[0];
  objectData = objectData.filter(o => o.SKU !== newGroupId);
  objectData.push({
    ...firstItem,
    SKU: newGroupId,
    "IG ID": newGroupId,
    name: `[Grouped] ${firstItem.name || newGroupId}`,
    __isMergedGroup: true,
    __originalGroups: [...originalGroups],
    groupCreatedAt: Date.now(),
    details: ''
  });

  selectedGroups.clear();
  document.querySelectorAll('.group-checkbox').forEach(cb => { cb.checked = false; });

  render();
  showTemporaryMessage(`✅ Solo los SKUs visibles se agruparon como ${newGroupId}. Los no visibles se separaron en split.`);

  return { filteredItems, objectData };
}

function mergeVisibleItemsOnly() {
  const selectedGroupIds = Array.from(selectedGroups);

  if (selectedGroupIds.length < 2) {
    alert("Selecciona al menos 2 grupos visibles para unir");
    return;
  }

  const visibleSkus = new Set(currentFilteredItems.map(item => item.SKU));
  const splitVisibleItems = [];
  const splitRestItems = [];
  const splitGroupObjects = [];
  const originalGroups = [];
  const groupObjMap = {};

  // Guarda los objetos grupo originales ANTES de eliminarlos
  selectedGroupIds.forEach(groupId => {
    const groupObj = objectData.find(o => String(o.SKU) === String(groupId));
    if (groupObj) groupObjMap[groupId] = { ...groupObj };
  });

  selectedGroupIds.forEach(groupId => {
    // Todos los SKUs del grupo original
    const allItems = filteredItems.filter(item => String(item["IG ID"]) === String(groupId));
    const allSkus = allItems.map(item => item.SKU);
    const visibleItems = allItems.filter(item => visibleSkus.has(item.SKU));
    const notVisibleItems = allItems.filter(item => !visibleSkus.has(item.SKU));


    if (visibleItems.length > 0) {
    }
    if (notVisibleItems.length > 0) {
    }
    if (visibleItems.length === 0 && notVisibleItems.length === 0) {
    }

    // Split para visibles
    if (visibleItems.length > 0) {
      const splitVisibleId = `split-${Date.now()}-${groupId}`;
      visibleItems.forEach(item => {
        item.__originalIGID = item.__originalIGID || item["Original IG ID"] || groupId;
        item["Original IG ID"] = item.__originalIGID;
        item["IG ID"] = splitVisibleId;
        splitVisibleItems.push(item);
      });
      groupOrderMap.set(splitVisibleId, visibleItems.map(item => item.SKU));
      let groupObj = groupObjMap[groupId];
      if (groupObj) {
        splitGroupObjects.push({
          ...groupObj,
          SKU: splitVisibleId,
          "IG ID": splitVisibleId,
          name: `[Filtrado] ${groupObj.name || groupId}`,
          marca: groupObj.marca || "",
          image: groupObj.image || "",
          brand_logo: groupObj.brand_logo || "",
          ventajas: groupObj.ventajas || "",
          aplicaciones: groupObj.aplicaciones || "",
          especificaciones: groupObj.especificaciones || "",
          incluye: groupObj.incluye || "",
          skus: visibleItems.map(item => item.SKU)
        });
      }
    }

    // Split para no visibles
    if (notVisibleItems.length > 0) {
      const splitRestId = `split-${Date.now()}-${groupId}`;
      notVisibleItems.forEach(item => {
        item.__originalIGID = item.__originalIGID || item["Original IG ID"] || groupId;
        item["Original IG ID"] = item.__originalIGID;
        item["IG ID"] = splitRestId;
        splitRestItems.push(item);
      });
      groupOrderMap.set(splitRestId, notVisibleItems.map(item => item.SKU));
      let groupObj = groupObjMap[groupId];
      if (groupObj) {
        splitGroupObjects.push({
          ...groupObj,
          SKU: splitRestId,
          "IG ID": splitRestId,
          name: `[Restante] ${groupObj.name || groupId}`,
          marca: groupObj.marca || "",
          image: groupObj.image || "",
          brand_logo: groupObj.brand_logo || "",
          ventajas: groupObj.ventajas || "",
          aplicaciones: groupObj.aplicaciones || "",
          especificaciones: groupObj.especificaciones || "",
          incluye: groupObj.incluye || "",
          skus: notVisibleItems.map(item => item.SKU)
        });
      }
    }

    // Elimina el objeto grupo original (solo el objeto de grupo, no los SKUs)
    objectData = objectData.filter(o => String(o.SKU) !== String(groupId));
    originalGroups.push(groupId);
  });

  // Log de bloques nuevos
  [...splitGroupObjects].forEach(groupObj => {
    if (!groupObj) return;
    const skus = Array.isArray(groupObj.skus) ? groupObj.skus : [];

    if (groupOrderMap.has(groupObj.SKU)) {
    }
  });

  // 2. Agrupa los visibles
  const result = groupAllVisibleSplits(
    splitVisibleItems,
    splitRestItems,
    splitGroupObjects,
    originalGroups,
    objectData,
    filteredItems
  );

  // 3. Actualiza los arrays globales
  filteredItems = result.filteredItems;
  objectData = result.objectData;


  // 4. Forzar render y feedback visual
  render();
  showTemporaryMessage(`✅ Solo los SKUs visibles se agruparon. Los no visibles se separaron en split.`);
}

function separateVisibleAndRestFromGroups(selectedGroupIds, filteredItems, objectData) {
  const visibleSkus = new Set(filteredItems.map(item => item.SKU));
  const splitVisibleItems = [];
  const splitRestItems = [];
  const splitGroupObjects = [];
  const originalGroups = [];

  selectedGroupIds.forEach(groupId => {
    // Busca los SKUs en filteredItems, no solo en objectData
    const allItems = filteredItems.filter(item => String(item["IG ID"]) === String(groupId));
    const visibleItems = allItems.filter(item => visibleSkus.has(item.SKU));
    const notVisibleItems = allItems.filter(item => !visibleSkus.has(item.SKU));

    // Split para visibles
    if (visibleItems.length > 0) {
      const splitVisibleId = `split-${Date.now()}-${groupId}`;
      visibleItems.forEach(item => {
        item.__originalIGID = item.__originalIGID || item["Original IG ID"] || groupId;
        item["Original IG ID"] = item.__originalIGID;
        item["IG ID"] = splitVisibleId;
        splitVisibleItems.push(item);
      });
      groupOrderMap.set(splitVisibleId, visibleItems.map(item => item.SKU));
      let groupObj = objectData.find(o => String(o.SKU) === String(groupId));
      if (groupObj) {
        splitGroupObjects.push({
          ...groupObj,
          SKU: splitVisibleId,
          "IG ID": splitVisibleId,
          name: `[Filtrado] ${groupObj.name || groupId}`,
        });
      }
    }

    // Split para no visibles
    if (notVisibleItems.length > 0) {
      const splitRestId = `split-${Date.now()}-${groupId}`;
      notVisibleItems.forEach(item => {
        item.__originalIGID = item.__originalIGID || item["Original IG ID"] || groupId;
        item["Original IG ID"] = item.__originalIGID;
        item["IG ID"] = splitRestId;
        splitRestItems.push(item);
      });
      groupOrderMap.set(splitRestId, notVisibleItems.map(item => item.SKU));
      let groupObj = objectData.find(o => String(o.SKU) === String(groupId));
      if (groupObj) {
        splitGroupObjects.push({
          ...groupObj,
          SKU: splitRestId,
          "IG ID": splitRestId,
          name: `[Restante] ${groupObj.name || groupId}`,
        });
      }
    }

    // Elimina el objeto grupo original (solo el objeto de grupo, no los SKUs)
    objectData = objectData.filter(o => String(o.SKU) !== String(groupId));
    originalGroups.push(groupId);
  });

  return {
    splitVisibleItems,
    splitRestItems,
    splitGroupObjects,
    originalGroups,
    objectData
  };
}

function exportWebAttributesToExcel() {
  // 1. Obtén los SKUs y datos del CMS actual
  const cmsIg = getCmsIg();
  const itemsData = filteredItems.filter(item => item["CMS IG"] === cmsIg);

  // 2. Obtén el orden de atributos Web según los inputs de la columna Web
  const webOrderInputs = Array.from(document.querySelectorAll('.order-input'))
    .filter(input => input.value && parseInt(input.value) > 0)
    .sort((a, b) => parseInt(a.value) - parseInt(b.value));
  const webAttributesOrder = webOrderInputs.map(input => input.getAttribute('data-attribute'));

  // 3. Construye los datos para exportar SOLO si hay algún campo vacío
  const exportRows = [];
  exportRows.push(['SKU', 'titulo', 'marca', 'no_de_modelo',  ...webAttributesOrder]);
 itemsData.forEach(item => {
  const obj = objectData.find(o => String(o.SKU) === String(item.SKU)) || {};
  const row = [
    item.SKU,
    obj.titulo || obj.title || '',
    obj.marca || '',
    obj.no_de_modelo || obj.no_de_modelo || ''
  ];
  webAttributesOrder.forEach(attr => {
    row.push(obj[attr] !== undefined ? obj[attr] : '');
  });
  // Solo cuenta faltantes en los atributos web (no en los primeros 4)
  const hasMissing = webAttributesOrder.some((attr, idx) => {
    const val = row[4 + idx];
    return val === '' || val === null || val === undefined;
  });
  if (hasMissing) {
    exportRows.push(row);
  }
});

  // Si no hay ningún SKU con faltantes, muestra mensaje y no exporta
  if (exportRows.length === 1) {
    showTemporaryMessage('Todos los SKUs tienen información completa en los atributos exportados.');
    return;
  }

  // 4. Exporta a Excel usando XLSX
  const ws = XLSX.utils.aoa_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Valores");
  XLSX.writeFile(wb, `${cmsIg}_Valores.xlsx`);
}