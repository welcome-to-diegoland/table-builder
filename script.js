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
let startX, startLeftWidth;
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
let currentFilteredItems = [];
let activeFilters = {};
let defaultFilterAttributes = new Set();
const forcedFilterAttributes = new Set(['marca', 'shop_by']);
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
const forcedColumns = ["marca", "item_code", "precio"];
const priorityStatsAttributes = ["titulo", "marca", "orden_tabla", "shop_by"];
const excludedAttributes = new Set([
  "product.type", "url_key", "product.attribute_set", "product.websites",
  "product.required_options", "stock.manage_stock", "stock.qty", "Price", "Status",
  "Tax_class_id", "Visibility", "name", "category.name", "leaf_name_filter",
  "image", "small_image", "thumbnail", "pdp_display_attribute",
  "pdp_description_attribute", "pdp_short_description_attribute", "icon_order",
  "orden_cms", "aplicaciones", "cms_web", "incluye", 
  "paginadecatalogo", "seccion", "ventajas", "brand_logo",
  "item_group_id", "categoria", "item_codeunspcweb_search_term",
  "beneficio_principal", "catalog_cover_image", "item_code", "titulo_web",
  "unspc", "description", "especificaciones", "web_search_term", 
  "catalog_page_number", "Weight", "icono_nuevo"
]);
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.14.0/Sortable.min.js';
document.head.appendChild(script);

// Event Listeners (sección modificada)
document.addEventListener('DOMContentLoaded', function() {
  verticalDivider.addEventListener('mousedown', initVerticalDrag);
  document.getElementById('horizontalDivider').addEventListener('mousedown', (e) => {
    initHorizontalDrag(e, 'box1', 'box3');
  });

  const mergeHeaderBtn = document.getElementById('mergeSelectedGroupsBtn');
  if (mergeHeaderBtn) {
    mergeHeaderBtn.addEventListener('click', mergeSelectedGroups);
  }

  //xlsxFileInput.addEventListener("change", handleXLSX);
  csvFileInput.addEventListener("change", handleCSV);
  //categoryDataFileInput.addEventListener("change", handleCategoryData);
  document.getElementById('combinedFile').addEventListener('change', handleCombinedExcel);
  combinedFileInput.addEventListener("change", handleCombinedExcel);
 

  addMergeStyles();

  const applyCatTablesBtn = document.getElementById("applyCatTablesBtn");


  // Exportar Excel
  document.getElementById('exportStatsExcelBtn').addEventListener('click', function () {
    // Creamos el workbook una sola vez
    const wb = XLSX.utils.book_new();
  
    // ====== 1. ATRIBUTOS ======
    const cmsSet = new Set();
    filteredItems.forEach(item => {
      if (item["CMS IG"]) cmsSet.add(item["CMS IG"]);
    });
  
    const attributes = [];
    document.querySelectorAll('.filter-order-input').forEach(input => {
      const attr = input.getAttribute('data-attribute');
      if (attr) attributes.push(attr);
    });
  
      const mergeBtn = document.getElementById('mergeSelectedGroupsBtn');
  if (mergeBtn) {
    mergeBtn.addEventListener('click', mergeSelectedGroups);
  }



    const data = [];
    cmsSet.forEach(cmsIg => {
      attributes.forEach(attr => {
        const filtroInput = document.querySelector(`.filter-order-input[data-attribute="${attr}"]`);
        const catInput = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
        const webInput = document.querySelector(`.order-input[data-attribute="${attr}"]`);
        data.push({
          "CMS IG": cmsIg,          
          "Atributo": attr,
          "Filtros": filtroInput ? (filtroInput.value || "") : "",
          "Web": webInput ? (webInput.value || "") : "",
          "Cat": catInput ? (catInput.value || "") : ""
        });
      });
    });
  
    let cmsPart = 'CMSIG';
    if (cmsSet.size >= 1) {
      cmsPart = [...cmsSet][0];
    }
    const atributosCols = ["CMS IG", "Atributo", "Filtros", "Web", "Cat"];
    // Siempre crear la pestaña, aunque data esté vacío
    const wsAtributos = XLSX.utils.json_to_sheet(
      data.length ? data : [{}],
      { header: atributosCols }
    );
    XLSX.utils.sheet_add_aoa(wsAtributos, [atributosCols], { origin: "A1" });
    XLSX.utils.book_append_sheet(wb, wsAtributos, "Atributos");
  
    // ====== 2. ORDEN DE GRUPOS SOLO REORDENADOS ======
    const originalOrderByGroup = {};
    filteredItems.forEach(item => {
      const igidStr = String(item["IG ID"]);
      if (!originalOrderByGroup[igidStr]) originalOrderByGroup[igidStr] = [];
      originalOrderByGroup[igidStr].push(item.SKU);
    });
  
    const ordenExportData = [];
    const gruposReordenados = [];
  
    if (typeof groupOrderMap.entries === "function") {
      for (const [igid, currentOrder] of groupOrderMap.entries()) {
        const igidStr = String(igid);
        if (igidStr.startsWith('merged-')) continue;
        if (!Array.isArray(currentOrder)) continue;
        const originalOrder = originalOrderByGroup[igidStr] || [];
        const changed = originalOrder.length === currentOrder.length &&
          originalOrder.some((sku, idx) => sku !== currentOrder[idx]);
        if (!changed) continue;
        const groupObj = objectData.find(o => String(o.SKU) === igidStr);
        const titulo = groupObj && groupObj.name ? groupObj.name : "";
        gruposReordenados.push(igidStr);
        currentOrder.forEach(sku => {
          ordenExportData.push({
            "IG ID": igidStr,
            "titulo": titulo,
            "Sku": sku
          });
        });
      }
    } else {
      Object.keys(groupOrderMap).forEach(igid => {
        const igidStr = String(igid);
        if (igidStr.startsWith('merged-')) return;
        const currentOrder = groupOrderMap[igidStr];
        if (!Array.isArray(currentOrder)) return;
        const originalOrder = originalOrderByGroup[igidStr] || [];
        const changed = originalOrder.length === currentOrder.length &&
          originalOrder.some((sku, idx) => sku !== currentOrder[idx]);
        if (!changed) return;
        const groupObj = objectData.find(o => String(o.SKU) === igidStr);
        const titulo = groupObj && groupObj.name ? groupObj.name : "";
        gruposReordenados.push(igidStr);
        currentOrder.forEach(sku => {
          ordenExportData.push({
            "IG ID": igidStr,
            "titulo": titulo,
            "Sku": sku
          });
        });
      });
    }
    const ordenCols = ["IG ID", "titulo", "Sku"];
    // Siempre crear la pestaña, aunque ordenExportData esté vacío
    const wsOrden = XLSX.utils.json_to_sheet(
      ordenExportData.length ? ordenExportData : [{}],
      { header: ordenCols }
    );
    XLSX.utils.sheet_add_aoa(wsOrden, [ordenCols], { origin: "A1" });
    XLSX.utils.book_append_sheet(wb, wsOrden, "Orden Grupos");
  
    // ====== 3. GRUPOS AGRUPADOS (MERGED) ======
    const mergedExportData = [];
    let mergedCmsWeb = null; // para el nombre del archivo
  
    if (typeof groupOrderMap.entries === "function") {
      for (const [igid, currentOrder] of groupOrderMap.entries()) {
        const igidStr = String(igid);
  
        // Solo exportar si el grupo sigue existiendo y tiene items
        const groupObj = objectData.find(o => String(o.SKU) === igidStr);
        const hasItems = filteredItems.some(item => String(item["IG ID"]) === igidStr);
        if (!igidStr.startsWith('merged-') || !groupObj || !hasItems) continue;
        if (!Array.isArray(currentOrder)) continue;
  
        const cmsWeb = groupObj["cms_web"] || groupObj["CMS IG"] || groupObj["CMSIG"] || "CMSIG";
        if (!mergedCmsWeb) mergedCmsWeb = cmsWeb;
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
          detalles = detailsInput.value;
        } else {
          detalles = groupObj.detalles || groupObj.ventajas || groupObj.descripcion || "";
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
    // Siempre crear la pestaña, aunque mergedExportData esté vacío
    const wsMerged = XLSX.utils.json_to_sheet(
      mergedExportData.length ? mergedExportData : [{}],
      { header: mergedCols }
    );
    XLSX.utils.sheet_add_aoa(wsMerged, [mergedCols], { origin: "A1" });
    XLSX.utils.book_append_sheet(wb, wsMerged, "Merged");
  
    // ====== 4. SKUs con valores rellenados (inputs vacíos) ======
    const filledByUser = {}; // { sku: { attr1: val1, attr2: val2, ... } }
    const allAttrsFilled = new Set();
  
    for (const cellKey in editedCells) {
      const { value, wasOriginallyEmpty } = editedCells[cellKey];
      if (wasOriginallyEmpty && value && value.trim() !== "") {
        const idx = cellKey.lastIndexOf("-");
        if (idx > 0) {
          const sku = cellKey.substring(0, idx);
          const attr = cellKey.substring(idx + 1);
          if (!filledByUser[sku]) filledByUser[sku] = {};
          filledByUser[sku][attr] = value.trim();
          allAttrsFilled.add(attr);
        }
      }
    }
  
    
    // Si hay valores, usa los atributos editados; si no, pon solo el encabezado SKU
    const valoresCols = ["SKU", ...Array.from(allAttrsFilled)];
    const valoresExport = [];
    if (Object.keys(filledByUser).length > 0 && allAttrsFilled.size > 0) {
      for (const sku in filledByUser) {
        const row = { "SKU": sku };
        for (const attr of allAttrsFilled) {
          row[attr] = filledByUser[sku][attr] || "";
        }
        valoresExport.push(row);
      }
    }
    // Siempre crear la pestaña, aunque valoresExport esté vacío
    const wsValores = XLSX.utils.json_to_sheet(
      valoresExport.length ? valoresExport : [{}],
      { header: valoresCols.length > 1 ? valoresCols : ["SKU"] }
    );
    XLSX.utils.sheet_add_aoa(wsValores, [valoresCols.length > 1 ? valoresCols : ["SKU"]], { origin: "A1" });
    XLSX.utils.book_append_sheet(wb, wsValores, "Valores Nuevos");
  
    // ==== Guardar todo en un solo archivo ====
    const finalFileName = `${cmsPart}_todo.xlsx`;
    XLSX.writeFile(wb, finalFileName);
  });
  


  
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

document.getElementById('exportAtributosBtn').addEventListener('click', function() {
  // Generar y exportar la pestaña "Atributos"
  const cmsIg = getCmsIg();

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

document.getElementById('exportOrdenGruposBtn').addEventListener('click', function() {
  // Generar y exportar la pestaña "Orden Grupos"
  const cmsIg = getCmsIg();

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
      const groupObj = objectData.find(o => String(o.SKU) === igidStr);
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

document.getElementById('exportMergedBtn').addEventListener('click', function() {
  // Generar y exportar la pestaña "Merged"
  const cmsIg = getCmsIg();

  const mergedExportData = [];
  if (typeof groupOrderMap.entries === "function") {
    for (const [igid, currentOrder] of groupOrderMap.entries()) {
      const igidStr = String(igid);
      const groupObj = objectData.find(o => String(o.SKU) === igidStr);
      const hasItems = filteredItems.some(item => String(item["IG ID"]) === igidStr);
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
        detalles = detailsInput.value;
      } else {
        detalles = groupObj.detalles || groupObj.ventajas || groupObj.descripcion || "";
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

document.getElementById('exportValoresNuevosBtn').addEventListener('click', function() {
  // Generar y exportar la pestaña "Valores Nuevos"
  const cmsIg = getCmsIg();

  // Mapa SKU → objeto original
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
        // Si antes tenía valor y ahora está vacío, pon '<NULL>'
        changes[attr] = (oldVal && !newVal) ? '<NULL>' : newVal;
        allAttrsChanged.add(attr);
      }
    });

    if (Object.keys(changes).length > 0) {
      changedByUser[sku] = changes;
    }
  });

  // --- FILTRO DE SEGURIDAD ---
  // Solo atributos que existen en objectDataOriginal (por si hay basura)
  const validKeys = new Set(
    Object.keys(objectDataOriginal[0] || {}).filter(k => k !== "SKU" && !excludedAttributes.has(k))
  );
  const safeAttrsChanged = Array.from(allAttrsChanged).filter(attr => validKeys.has(attr));
  const valoresCols = ["SKU", ...safeAttrsChanged];

  // --- Armado de las filas ---
  const valoresExport = [];
  Object.entries(changedByUser).forEach(([sku, attrs]) => {
    const row = { "SKU": sku };
    valoresCols.slice(1).forEach(attr => {
      row[attr] = attrs[attr] || "";
    });
    valoresExport.push(row);
  });

  const wsValores = XLSX.utils.json_to_sheet(valoresExport.length ? valoresExport : [{}], { header: valoresCols.length > 1 ? valoresCols : ["SKU"] });
  XLSX.utils.sheet_add_aoa(wsValores, [valoresCols.length > 1 ? valoresCols : ["SKU"]], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsValores, "Valores Nuevos");
  XLSX.writeFile(wb, `${cmsIg}_ValoresNuevos.xlsx`);
});


function clearAllChecks() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
}

// Esta función regresa el rightContainer con BOTONES y BADGES para el header del grupo
function createGroupHeaderRight({
  groupIdStr, groupItems, skuToObject, isMergedGroup, groupDiv
}) {
  const rightContainer = document.createElement("div");
  rightContainer.className = "group-header-right";

  // Botón Editar Todo
  const editAllBtn = document.createElement("button");
  editAllBtn.textContent = "Editar";
  editAllBtn.className = "btn btn-sm btn-outline-primary";
  editAllBtn.dataset.editing = "false";
  editAllBtn.onclick = function() {
    if (editAllBtn.dataset.editing === "false") {
      editAllBtn.textContent = "Guardar cambios";
      editAllBtn.dataset.editing = "true";
      makeGroupItemsEditable(groupDiv, groupIdStr);
    } else {
      saveGroupItemEdits(groupDiv, groupIdStr);
      editAllBtn.textContent = "Editar";
      editAllBtn.dataset.editing = "false";
      refreshView();
      // Scroll y highlight (igual que antes)
      let attempts = 0;
      const maxAttempts = 20;
      const pollId = setInterval(() => {
        const output = document.getElementById('output');
        const groupDiv = document.querySelector(`.group-container[data-group-id="${groupIdStr}"]`);
        if (output && groupDiv) {
          groupDiv.scrollIntoView({ behavior: "auto", block: "start" });
          output.scrollTop -= 40;
          clearInterval(pollId);
        } else if (++attempts > maxAttempts) {
          clearInterval(pollId);
        }
      }, 40);
    }
  };
  rightContainer.appendChild(editAllBtn);

  // Badge "New" si algún item es nuevo
  const hasNewItem = groupItems.some(item => {
    const details = skuToObject[item.SKU];
    return details && details.shop_by && details.shop_by.trim().toLowerCase() === 'new';
  });
  if (hasNewItem) {
    const newBadge = document.createElement("span");
    newBadge.className = "new-badge";
    newBadge.textContent = "New";
    rightContainer.appendChild(newBadge);
  }

  // Badge y botón de desagrupar si es grupo unido
  if (isMergedGroup) {
    const mergedBadge = document.createElement("span");
    mergedBadge.className = "merged-badge";
    mergedBadge.textContent = `Unión de ${mergedGroups.get(groupIdStr).originalGroups.length} grupos`;
    rightContainer.appendChild(mergedBadge);

    const unmergeBtn = document.createElement("button");
    unmergeBtn.className = "btn btn-sm btn-outline-danger";
    unmergeBtn.textContent = "Desagrupar";
    unmergeBtn.title = "Revertir esta unión de grupos";
    unmergeBtn.dataset.groupIdStr = groupIdStr;
    unmergeBtn.addEventListener('click', function() {
      unmergeGroup(this.dataset.groupIdStr);
    });
    rightContainer.appendChild(unmergeBtn);
  }

  // Botón de "Deshacer mover info" si aplica
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
    rightContainer.appendChild(undoBtn);
  }

  return rightContainer;
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
injectAddStatsAttributeModal();

let addStatsModalState = { available: [], selected: [] };

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

  // Render dual-list
  const listDiv = document.getElementById('addStatsAttrList');
  listDiv.innerHTML = `
    <div class="dual-list-modal compact">
      <div class="dual-list-col">
        <div class="dual-list-label">Disponibles</div>
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

  // --- Dual-list logic ---
  const availUl = document.getElementById('addStats-available');
  const selUl = document.getElementById('addStats-selected');
  let selectedAvailable = null, selectedSelected = null;

  // Seleccionar disponible (click)
  availUl.onclick = e => {
    if (e.target.tagName === "LI") {
      selectedAvailable = e.target;
      availUl.querySelectorAll('.selected').forEach(li => li.classList.remove('selected'));
      e.target.classList.add('selected');
    }
  };
  // Seleccionar seleccionado (click)
  selUl.onclick = e => {
    if (e.target.tagName === "LI") {
      selectedSelected = e.target;
      selUl.querySelectorAll('.selected').forEach(li => li.classList.remove('selected'));
      e.target.classList.add('selected');
    }
  };
  // Pasar a la derecha (flecha o doble click)
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

  // Quitar de la derecha (flecha o doble click)
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
      const dataSheet = workbook.Sheets["data"];
      const catSheet = workbook.Sheets["category-data"];
      const valueOrderSheet = workbook.Sheets["value order"]; // NUEVO

      if (!dataSheet || !catSheet) {
        alert("El archivo no contiene las hojas necesarias.");
        return;
      }

      // Guardar originales
filteredItemsOriginal = XLSX.utils.sheet_to_json(dataSheet).map(o => ({ ...o }));
filteredItems = filteredItemsOriginal.map(o => ({ ...o }));
      categoryData = XLSX.utils.sheet_to_json(catSheet);

      // NUEVO: Leer value order si existe
      if (valueOrderSheet) {
        window.valueOrderList = XLSX.utils.sheet_to_json(valueOrderSheet);
      } else {
        window.valueOrderList = [];
      }

      // Renderiza el árbol (con el botón)
      renderCategoryTree(categoryData, document.getElementById('fileInfo'));
      processCategoryDataFromSheet();
      // NO render() aquí, hasta elegir categoría

    } catch (error) {
      console.error("Error procesando archivo combinado:", error);
    }
  };
  reader.readAsArrayBuffer(file);
}

function handleCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      objectDataOriginal = results.data.map(o => ({ ...o })); // copia profunda
      objectData = objectDataOriginal.map(o => ({ ...o }));   // copia profunda
      // NO render() aquí: Espera a que elijan categoría
    },
    error: (error) => {
      console.error("Error procesando Data File:", error);
    }
  });
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
  cargarBtn.className = 'btn btn-primary';
  cargarBtn.textContent = 'Cargar categoría';
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

  if (!filteredItemsOriginal.length || !objectDataOriginal.length) {
    alert("Primero carga los archivos de datos.");
    return;
  }

  // 1. Filtra los SKUs del CMS
  const filtered = filteredItemsOriginal.filter(x => (x["CMS IG"] || "").trim() === cmsCode);

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

  // 5. Limpia merges/selección si aplica (si existen esas variables)
  if (typeof selectedGroups !== "undefined") selectedGroups.clear();
  if (typeof mergedGroups !== "undefined") mergedGroups.clear();

  // 6. Procesar datos de categorías para orden/filtros
  processCategoryDataFromSheet();

  // 7. Renderiza
  render();
});
}

function processCategoryDataFromSheet() {
  // Si no hay datos, no procesar
  if (!categoryData.length || !filteredItems.length) return;
  // Tomar el CMS IG actual
  const cmsIgValue = filteredItems[0]['CMS IG'];
  // Buscar la fila de categoryData correspondiente al CMS IG
  const matchedItem = categoryData.find(item => item.image && item.image.includes(`W${cmsIgValue}.png`));
  if (matchedItem) {
    // Procesa los atributos para defaultAttributesOrder, defaultFilterAttributes, etc...
    // (Tu lógica aquí, igual que antes)
    let attributesStr = matchedItem.table_attributes || "";
    if (!attributesStr.includes(',') && attributesStr.includes(' ')) {
      attributesStr = attributesStr.replace(/\s+/g, ',');
    }
    const attributes = attributesStr.split(',').map(attr => attr.trim()).filter(attr => attr && !['marca', 'sku', 'price'].includes(attr));
    defaultAttributesOrder = {};
    attributes.forEach((attr, index) => {
      defaultAttributesOrder[attr] = index + 1;
    });
    // Filtros
    let filterAttributesStr = matchedItem.filter_attributes || "";
    if (!filterAttributesStr.includes(',') && filterAttributesStr.includes(' ')) {
      filterAttributesStr = filterAttributesStr.replace(/\s+/g, ',');
    }
    const filterAttributes = filterAttributesStr.split(',').map(attr => attr.trim()).filter(attr => attr);
    defaultFilterAttributes = new Set(filterAttributes);
    forcedFilterAttributes.forEach(attr => defaultFilterAttributes.add(attr));
    // (Agrega aquí tu lógica si tienes otras variables de orden/filtro)
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

function confirmGroupSortModal(orderedAttrs) {
  const { groupId } = groupSortModalState;
  // SIEMPRE usa los items de filteredItems actuales del grupo
  const groupItems = filteredItems.filter(item => String(item["IG ID"]) === String(groupId));
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));

  // Mapa para sort_order rápido
  const valueOrderMap = new Map();
  (window.valueOrderList || []).forEach(row => {
    if (!row["Nombre atributo"] || !row["Valor de Atributo"]) return;
    const key = `${row["Nombre atributo"]}|||${row["Valor de Atributo"]}`;
    valueOrderMap.set(key, Number(row.sort_order));
  });

  // Ordena según los atributos seleccionados y sort_order
  const items = groupItems.slice();
  items.sort((a, b) => {
    for (const attr of orderedAttrs) {
      const va = (skuToObject[a.SKU]?.[attr] || "").toString();
      const vb = (skuToObject[b.SKU]?.[attr] || "").toString();
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
    return 0;
  });

  // Actualiza el orden en el groupOrderMap
  groupOrderMap.set(groupId, items.map(it => it.SKU));

  // Forzar que el render del grupo use el NUEVO ORDEN de groupOrderMap
  const groupContainer = document.querySelector(`.group-container[data-group-id="${groupId}"]`);
  if (groupContainer) {
    // Elimina solo la tabla previa
    const existingTable = groupContainer.querySelector('.table-responsive');
    if (existingTable) existingTable.remove();

    // OJO: aquí fuerza el orden usando groupOrderMap
    const orderedSkus = groupOrderMap.get(groupId);
    const orderedItems = orderedSkus
      .map(sku => items.find(it => it.SKU === sku))
      .filter(Boolean);

    createItemsTable(groupContainer, orderedItems, skuToObject);
  }

  showTemporaryMessage('Grupo ordenado por atributos seleccionados');
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
    } catch (error) {
      console.error("Error en render:", error);
      output.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }, 100);
}


function updateOrderInputs() {
  const inputs = document.querySelectorAll('.order-input, .order-cat-input');
  if (!inputs.length) return;

  let updateCount = 0;
  inputs.forEach(input => {
    const attribute = input.getAttribute('data-attribute');
    // Primero intenta cargar del localStorage (si el usuario ya puso algo)
    const savedOrder = localStorage.getItem(
      input.classList.contains('order-cat-input') ? `cat_order_${attribute}` : `order_${attribute}`
    );
    if (savedOrder) {
      input.value = savedOrder;
      updateCount++;
    } else if (defaultAttributesOrder[attribute]) {
      input.value = defaultAttributesOrder[attribute];
      localStorage.setItem(
        input.classList.contains('order-cat-input') ? `cat_order_${attribute}` : `order_${attribute}`,
        defaultAttributesOrder[attribute]
      );
      updateCount++;
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
      } else {
        applyMultipleFilters();
      }
    });
  });

  updateAttributeDropdowns(filteredItems);

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

  orderedGroupIds.forEach(groupIdStr => {
    const groupItems = groupMap[groupIdStr];
    if (!groupItems || !Array.isArray(groupItems) || groupItems.length === 0) return;

    if (!groupOrderMap.has(groupIdStr)) {
      groupOrderMap.set(groupIdStr, groupItems.map(item => item.SKU));
    }
    const orderedSkus = groupOrderMap.get(groupIdStr);
    if (Array.isArray(orderedSkus)) {
      groupItems.sort((a, b) => orderedSkus.indexOf(a.SKU) - orderedSkus.indexOf(b.SKU));
    }
    const groupInfo = skuToObject[groupIdStr] || {};
    const isMergedGroup = mergedGroups.has(groupIdStr);

    // --- Render group container ---
    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container filtered-group${isMergedGroup ? ' merged-group' : ''}`;
    groupDiv.dataset.groupId = groupIdStr;

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

  // Ordenar los prioritarios según el orden definido y los otros por frecuencia
  const sortedPriorityStats = priorityStats.sort((a, b) => 
    priorityStatsAttributes.indexOf(a.attribute) - priorityStatsAttributes.indexOf(b.attribute)
  );
  
  const sortedOtherStats = otherStats.sort((a, b) => b.withValue - a.withValue);
  
  const filteredStats = [...sortedPriorityStats, ...sortedOtherStats];

  if (filteredStats.length) {
    attributeStatsDiv.innerHTML = '';
    const statsContainer = document.createElement("div");
    statsContainer.className = "stats-container";
    
    if (filteredStats.length > 100) {
      const half = Math.ceil(filteredStats.length / 2);
      const firstHalf = filteredStats.slice(0, half);
      const secondHalf = filteredStats.slice(half);
      
      statsContainer.appendChild(createStatsColumn(firstHalf));
      statsContainer.appendChild(createStatsColumn(secondHalf));
    } else {
      statsContainer.className += " single-column";
      statsContainer.appendChild(createStatsColumn(filteredStats));
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
    console.log('Asignando', attr, 'valor', count, 'en', label);
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
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
</button>
            <button class="btn-clear-filter" title="Limpiar filtros" type="button">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </th>
 <th style="width:${colWidthFiltro}; min-width:${colWidthFiltro}; position:relative;">
  <div class="filter-header-icons">
    <button type="button" id="stats-loadDefaultFiltersBtn" class="web-header-icon-btn" title="Aplicar Filtros Actuales">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#198754" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button type="button" id="stats-clearFilterInputsBtn" class="web-header-icon-btn" title="Limpiar Filtros Nuevos">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
  <div class="filter-header-divider"></div>
  Filtro
</th>
        <th style="width:${colWidthWeb}; min-width:${colWidthWeb}; position:relative;">
  <div class="web-header-icons grid-2x2">
    <button type="button" id="stats-loadWebOrderBtn" class="web-header-icon-btn filter-header-icon-btn" title="Aplicar Web Actual">✓</button>
    <button type="button" id="stats-fillWebSequentialBtn" class="web-header-icon-btn filter-header-icon-btn" title="Autoordenar Web">○</button>
    <button type="button" id="stats-applyOrderBtn" class="web-header-icon-btn filter-header-icon-btn" title="Aplicar Web Nuevas">+</button>
    <button type="button" id="stats-clearOrderBtn" class="web-header-icon-btn filter-header-icon-btn" title="Limpiar Web Nuevas">x</button>
  </div>
  <div class="web-header-divider"></div>
  Web
</th>
        <th style="width:${colWidthCat}; min-width:${colWidthCat}; position:relative;">
  <div class="cat-header-icons grid-2x2">
    <button type="button" id="stats-applyCatTablesBtn" class="cat-header-icon-btn filter-header-icon-btn" title="Aplicar Catálogo Actual">✓</button>
    <button type="button" id="stats-fillCatSequentialBtn" class="cat-header-icon-btn filter-header-icon-btn" title="Autoordenar Catálogo">○</button>
    <button type="button" id="stats-applyCatOrderBtn" class="cat-header-icon-btn filter-header-icon-btn" title="Aplicar Catálogo Nuevas">+</button>
    <button type="button" id="stats-clearCatOrderBtn" class="cat-header-icon-btn filter-header-icon-btn" title="Limpiar Catálogo Nuevas">x</button>
  </div>
  <div class="cat-header-divider"></div>
  Cat
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

  // --------- LISTENERS ---------
  // Limpiar filtros generales
  table.querySelectorAll('.btn-clear-filter').forEach(btn => {
    btn.addEventListener('click', function() {
      clearAllFilters();
    });
  });
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
  const statsApplyCatTablesBtn = table.querySelector('#stats-applyCatTablesBtn');
  if (statsApplyCatTablesBtn) {
    statsApplyCatTablesBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof applyCategoryTables === 'function') applyCategoryTables();
    });
  }
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

  column.appendChild(table);
  return column;
}

function injectAddAttributesModal() {
  if (document.getElementById('addAttributesModal')) return;
  const modal = document.createElement('div');
  modal.id = 'addAttributesModal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="group-sort-modal-backdrop"></div>
    <div class="group-sort-modal-content">
      <h3>Agregar atributos a la tabla</h3>
      <div id="addAttrDualList"></div>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button id="addAttrConfirmBtn" class="btn btn-primary btn-sm">Agregar</button>
        <button id="addAttrCancelBtn" class="btn btn-outline-secondary btn-sm">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Reutiliza el mismo CSS del modal dual-list/sort
  document.getElementById('addAttrCancelBtn').onclick = closeAddAttributesModal;
}
injectAddAttributesModal();

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
      console.log("objectData.length", objectData.length);
  console.log("filteredItems.length", filteredItems.length);
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
      console.log("objectData.length", objectData.length);
  console.log("filteredItems.length", filteredItems.length);
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
      console.log("objectData.length", objectData.length);
  console.log("filteredItems.length", filteredItems.length);
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

function clearFilter() {
  currentStatClickFilter = null; // LIMPIAR
  currentFilter = { attribute: null, type: null };
  highlightActiveFilter();
  refreshView();
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
    render();
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
      if (!groupOrderMap.has(groupIdStr)) {
        groupOrderMap.set(groupIdStr, groupItems.map(item => item.SKU));
      }
      const orderedSkus = groupOrderMap.get(groupIdStr);
      if (!Array.isArray(orderedSkus)) {
        console.error('[render][error] orderedSkus no es array!', groupIdStr, orderedSkus);
      } else {
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
  // GUARDAR
  currentStatClickFilter = { attribute: filterAttribute, type };
  if (currentFilter.attribute === filterAttribute && currentFilter.type === type) {
    clearFilter();
    return;
  }
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
  output.querySelector('.clear-filter-btn').addEventListener('click', clearFilter);

  const orderedGroupIds = [];
  const uniqueGroupIds = new Set();
  filteredItems.forEach(item => {
    const groupIdStr = String(item["IG ID"]);
    if (filteredGroupIds.has(groupIdStr) && !uniqueGroupIds.has(groupIdStr)) {
      orderedGroupIds.push(groupIdStr);
      uniqueGroupIds.add(groupIdStr);
    }
  });

  orderedGroupIds.forEach(groupIdStr => {
    const groupItems = filteredItemsMap[groupIdStr];
    if (!groupItems || groupItems.length === 0) return;
    if (!groupOrderMap.has(groupIdStr)) {
      groupOrderMap.set(groupIdStr, groupItems.map(item => item.SKU));
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

    // Header
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
    headerDiv.appendChild(leftContainer);
    const rightContainer = createGroupHeaderRight({
  groupIdStr,
  groupItems,
  skuToObject,
  isMergedGroup,
  groupDiv
});
headerDiv.appendChild(rightContainer);

    // Detalles de grupo unido
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
        // Default solo si nunca se editó
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
    createItemsTable(groupDiv, groupItems, skuToObject, filterAttribute);
    output.appendChild(groupDiv);
  });
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
  currentFilter = { attribute: null, type: null };
  highlightActiveFilter();

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

  orderedGroupIds.forEach(groupIdStr => {
    const groupItems = groups[groupIdStr];
    if (!groupItems || !Array.isArray(groupItems) || groupItems.length === 0) return;

    if (!groupOrderMap.has(groupIdStr)) {
      groupOrderMap.set(groupIdStr, groupItems.map(item => item.SKU));
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

    // Header del grupo
    const headerDiv = document.createElement("div");
    headerDiv.className = "group-header";

    // Contenedor principal (imagen + info + badges)
    const headerContentDiv = document.createElement("div");
    headerContentDiv.className = "group-header-content";

    // Contenedor izquierdo (imagen + info)
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";

    // Imagen del producto 
    const productImg = createProductImageElement(groupInfo.image);
    leftContainer.appendChild(productImg);

    // Información del grupo
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


   // ...dentro del forEach groupIdStr...
const rightContainer = createGroupHeaderRight({
  groupIdStr,
  groupItems,
  skuToObject,
  isMergedGroup,
  groupDiv
});
headerContentDiv.appendChild(rightContainer);

   
    headerDiv.appendChild(headerContentDiv);

    // Contenedor de detalles (pleca)
    const groupObj = objectData.find(o => String(o.SKU) === String(groupIdStr));
    let detailsHtml = "";
    if (groupObj) {
      if (groupObj.ventajas) detailsHtml += `<div class="details-row"><strong>Ventajas:<br></strong> ${groupObj.ventajas}</div>`;
      if (groupObj.aplicaciones) detailsHtml += `<div class="details-row"><strong>Aplicaciones:<br></strong> ${groupObj.aplicaciones}</div>`;
      if (groupObj.especificaciones) detailsHtml += `<div class="details-row"><strong>Especificaciones:<br></strong> ${groupObj.especificaciones}</div>`;
      if (groupObj.incluye) detailsHtml += `<div class="details-row"><strong>Incluye:<br></strong> ${groupObj.incluye}</div>`;
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
      const input = document.createElement("input");
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
  console.log('Inputs encontrados:', inputs.length);

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

  // Crear array para los items unidos
  const mergedItems = [];
  groupsToMerge.forEach(groupId => {
    const itemsInGroup = filteredItems.filter(item => String(item["IG ID"]) === String(groupId));
    itemsInGroup.forEach(item => {
      const mergedItem = {
        ...item,
        __originalIGID: groupId,
        "IG ID": newGroupId,
        "Original IG ID": groupId
      };
      mergedItems.push(mergedItem);
    });
  });

  // Eliminar items de los grupos originales
  filteredItems = filteredItems.filter(item => !groupsToMerge.includes(String(item["IG ID"])));

  // Agregar el nuevo grupo al principio
  filteredItems = [...mergedItems, ...filteredItems];

  // Registrar el grupo unido
  mergedGroups.set(newGroupId, {
    originalGroups: [...groupsToMerge],
    items: [...mergedItems],
    creationTime: Date.now(),
    details: previousDetails // CONSERVA SI YA EXISTÍA
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
    details: previousDetails // CONSERVA SI YA EXISTÍA
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
    const style = document.createElement('style');
    style.textContent = `
        .group-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            padding: 10px;
            position: relative;
        }
        
        .group-header-left {
            display: flex;
            flex: 1;
            gap: 10px;
            min-width: 0;
        }
    
      
        
        .merged-badge {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8em;
        }
        

        
        .product-img {
            max-width: 80px;
            max-height: 80px;
            object-fit: contain;
        }
        
        .group-info {
            flex: 1;
            min-width: 0;
        }
        
        .group-title {
            margin: 0;
            font-size: 1.1rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .brand-logo {
            max-height: 30px;
            max-width: 100px;
            margin-top: 5px;
        }
        
        .group-details {
            margin-top: 5px;
            font-size: 0.9em;
            color: #666;
        }
        
        .group-origin {
            font-size: 0.8em;
            color: #6c757d;
            margin-top: 3px;
        }
        
        /* Resto de estilos existentes... */
        .merged-group {
            border-left: 4px solid #007bff;
            background-color: #f8f9fa;
        }
        
        .groups-controls {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px;
            background-color: #f8f9fa;
            border-radius: 4px;
        }
        
        .groups-controls button {
            white-space: nowrap;
        }
        
        .selection-count {
            margin-left: auto;
            font-size: 0.9em;
            color: #666;
        }
        
        tr[data-original-igid] {
            background-color: #f8f9fa;
        }
        
        tr[data-original-igid]:nth-child(even) {
            background-color: #f1f3f5;
        }
    `;
    document.head.appendChild(style);
}


function createItemsTable(container, groupItems, skuToObject, highlightAttribute = null, customAttributes = null) {
  // Preservar el header del grupo si existe
  const existingHeader = container.querySelector('.group-header');
  // Buscar la pleca de detalles, si existe
  const plecaDiv = container.querySelector('.group-details-pleca');
  
  // Limpiar solo la tabla anterior
  const existingTable = container.querySelector('.table-responsive');
  if (existingTable) {
    existingTable.remove();
  }

  // Verificar si es un grupo unido
  const groupId = groupItems[0]?.["IG ID"];
  const isMergedGroup = mergedGroups.has(groupId);
  if (isMergedGroup) {
    container.classList.add('merged-group'); 
  }

  // === AGREGAR BOTÓN "ORDENAR..." EN EL HEADER DERECHO DEL GRUPO ===
(function() {
  // Busca el header del grupo
  let headerDiv = container.querySelector('.group-header');
  if (!headerDiv) return;
  let headerRight = headerDiv.querySelector('.group-header-right');
  if (!headerRight) {
    headerRight = document.createElement('div');
    headerRight.className = "group-header-right";
    headerDiv.appendChild(headerRight);
  }
  // Botón "Ordenar..."
  if (!headerRight.querySelector('.group-sort-btn')) {
    const sortBtn = document.createElement("button");
    sortBtn.className = "btn btn-sm btn-outline-primary group-sort-btn";
    sortBtn.textContent = "Ordenar";
    sortBtn.addEventListener('click', () =>
      openGroupSortModal(groupId, groupItems, skuToObject, filteredAttributes.map(a => a.attribute))
    );
    headerRight.insertBefore(sortBtn, headerRight.firstChild);
  }
  // Botón "Mover info"
  if (!headerRight.querySelector('.move-info-btn')) {
    const moveBtn = document.createElement("button");
    moveBtn.className = "btn btn-sm btn-outline-secondary move-info-btn";
    moveBtn.textContent = "Mover info";
    moveBtn.addEventListener('click', () => {
      let attributeList = filteredAttributes.map(a => a.attribute);
      openMoveInfoModal(groupId, groupItems, attributeList);
    });
    headerRight.insertBefore(moveBtn, headerRight.firstChild);
  }
})();

  const table = document.createElement("table");
  table.className = "table table-striped table-bordered attribute-table";
  table.style.width = "100%";
  table.style.tableLayout = "fixed"; // Importante para que los anchos se respeten

  // Obtener atributos ordenados
  let orderedAttributes;
  if (customAttributes) {
    orderedAttributes = customAttributes.map(attr => ({
      attribute: attr.trim(),
      order: 0,
      isForced: forcedColumns.includes(attr.trim())
    }));
  } else {
    orderedAttributes = getOrderedAttributes(groupItems, skuToObject);
  }
  
  // Filtrar atributos según showEmptyAttributes
  const filteredAttributes = orderedAttributes.filter(attr => {
    if (showEmptyAttributes) return true; // ON: mostrar todos, vacíos incluidos
    // OFF: solo los que tengan algún valor
    return groupItems.some(item => {
      const details = skuToObject[item.SKU] || {};
      return details[attr.attribute]?.toString().trim();
    });
  });

  // Crear THEAD
  let theadHtml = "<thead><tr>";
  
  // Columna de drag handle con botón de reset
  theadHtml += `
    <th style='width: 10px;' class='drag-handle-column'>
      <span class='drag-reset-btn' title='Reordenar a estado original'>×</span>
    </th>
  `;

filteredAttributes.forEach(attr => {
  let isAllEmpty = true;
  for (const item of groupItems) {
    const details = skuToObject[item.SKU] || {};
    if (details[attr.attribute]?.toString().trim()) {
      isAllEmpty = false;
      break;
    }
  }
  const isHighlighted = attr.attribute === highlightAttribute;

  // Aquí la línea IMPORTANTE:
  const highlightClass = groupDestHighlightAttr[groupId] === attr.attribute ? 'destination-filled-th' : '';

  theadHtml += `<th class="${isAllEmpty ? 'empty-header' : ''} ${isHighlighted ? 'highlight-column' : ''} ${highlightClass}">${attr.attribute}</th>`;
});

  // Columnas forzadas con ancho
  forcedColumns.forEach(forced => {
    let width = "";
    if (forced === "item_code") width = "width:95px;min-width:95px;max-width:95px;";
    if (forced === "precio") width = "width:58px;min-width:58px;max-width:58px;";
    theadHtml += `<th style="${width}">${forced}</th>`;
  });

  // Columna de origen (ancho fijo)
  theadHtml += `<th style="width:70px;min-width:70px;max-width:70px;">Origen</th></tr></thead>`;

  // Crear TBODY
  const tbody = document.createElement("tbody");
  tbody.id = `tbody-${groupId}`; // ID único para cada tabla

  // === Alternancia de color SOLO en la celda Origen ===
  let currentColorClass = 'origen-cell-color1';
  let lastOrigenValue = null;
  
  groupItems.forEach((item, itemIndex) => {
    const details = skuToObject[item.SKU] || {};
    const currentItem = filteredItems.find(fi => fi.SKU === item.SKU);
    const shouldHighlight = currentItem && 
                          currentItem['CMS IG'] && 
                          currentItem['CMS IC'] && 
                          currentItem['CMS IG'] !== currentItem['CMS IC'];
    const isMergedItem = item.__originalIGID;

    const row = document.createElement("tr");
    row.dataset.sku = item.SKU; // Agregar SKU como data attribute

    // Celda de drag handle
    const dragCell = document.createElement("td");
    dragCell.className = "drag-handle";
    dragCell.innerHTML = '≡';
    dragCell.title = "Arrastrar para reordenar";
    row.appendChild(dragCell);

    // Columnas de atributos normales
    filteredAttributes.forEach(attr => {
      const originalValue = details[attr.attribute]?.toString().trim() || "";
      const cellKey = `${item.SKU}-${attr.attribute}`;
      const cellData = editedCells[cellKey];
      
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
        input.dataset.sku = item.SKU;
        input.dataset.attribute = attr.attribute;
        input.dataset.originallyEmpty = (!originalValue).toString();
        
        input.addEventListener('input', function() {
          editedCells[cellKey] = {
            value: this.value,
            wasOriginallyEmpty: this.dataset.originallyEmpty === 'true'
          };
          updateCellStyle(cell, this.value.trim());
          
          const itemToUpdate = objectData.find(o => o.SKU === this.dataset.sku);
          if (itemToUpdate) {
            itemToUpdate[this.dataset.attribute] = this.value.trim();
          }
        });
        
        updateCellStyle(cell, input.value.trim());
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
    forcedColumns.forEach(forced => {
      const cell = document.createElement("td");
      let width = "";
      if (forced === "item_code") width = "100px";
      if (forced === "precio") width = "100px";
      cell.style.width = width;
      cell.style.minWidth = width;
      cell.style.maxWidth = width;

      const value = details[forced] || "";
      const highlightStyle = forced === 'item_code' && shouldHighlight ? 
                         'background-color: #e6e6fa;' : '';
      if (highlightStyle) cell.style = highlightStyle + `width:${width};min-width:${width};max-width:${width};`;
      
      if (forced === 'item_code' && value) {
        const link = document.createElement("a");
        link.href = `https://www.travers.com.mx/${value}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = value;
        cell.appendChild(link);
      } else {
        cell.textContent = value;
      }
      
      row.appendChild(cell);
    });
    
    // Columna de origen con ancho fijo
    const originCell = document.createElement("td");
    originCell.style.width = "100px";
    originCell.style.minWidth = "100px";
    originCell.style.maxWidth = "100px";
    let origenValue;
    if (isMergedItem) {
      origenValue = item.__originalIGID;
      // Alternar color cuando cambie el valor de origen
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
      originCell.textContent = "Original";
      originCell.style.fontSize = "0.8em";
      originCell.style.color = "#28a745";
      originCell.style.fontWeight = "bold";
    }
    row.appendChild(originCell);
    tbody.appendChild(row);
  });

  table.innerHTML = theadHtml;
  table.appendChild(tbody);

  // Hacer la tabla ordenable
  if (typeof Sortable !== 'undefined') {
    new Sortable(tbody, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: function(evt) {
        handleRowReorder(evt);
      }
    });
  }

  // Configurar selección múltiple
  setupRowSelection(table);

  // Agregar evento al botón de reset
  table.querySelector('.drag-reset-btn').addEventListener('click', function() {
    resetGroupOrder(groupId);
  });

  // Estilos CSS para la celda Origen y el botón de reset
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
  
  // Insertar tabla después de la pleca si existe, si no después del header, si no al final
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

  // CSS rápido (puedes llevarlo a tu stylesheet)
  const style = document.createElement('style');
  style.innerHTML = `
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

  // Cancel
  document.getElementById('groupSortCancelBtn').onclick = closeGroupSortModal;
}
injectGroupSortModal();

// Estado temporal del modal (por grupo)
let groupSortModalState = { groupId: null, groupItems: [], orderedAttrs: [] };

function openGroupSortModal(groupId, groupItems, skuToObject, attributeList) {
  groupSortModalState.groupId = groupId;
  groupSortModalState.groupItems = groupItems;

  let available = attributeList.filter(attr => attr === "marca" || !excludedAttributes.has(attr));
  let selected = [];

  // AÑADIDO: Forzar que "orden_tabla" SIEMPRE esté disponible si no está seleccionado ni en la lista
  if (
    !available.includes("orden_tabla") &&
    !selected.includes("orden_tabla")
  ) {
    available.push("orden_tabla");
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
      if (e.target.tagName === 'LI') {
        selectLi(e.target, e.ctrlKey || e.metaKey);
      }
    });
    ul.addEventListener('dblclick', (e) => {
      if (e.target.tagName !== 'LI') return;
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
    available = available.filter(attr => !toAdd.includes(attr));
    renderLists(); setupListClicks(listDiv.querySelector('#attr-available')); setupListClicks(listDiv.querySelector('#attr-selected'));
  }
  // Remove from selected
  function removeAttrs() {
    const ul = listDiv.querySelector('#attr-selected');
    const idxs = getSelectedIndices(ul);
    const toRemove = idxs.map(i => selected[i]);
    available = available.concat(toRemove);
    selected = selected.filter(attr => !toRemove.includes(attr));
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

  for (const groupIdStr in groups) {
    const groupItems = groups[groupIdStr];
    if (!groupItems.length) continue;
    if (!groupOrderMap.has(groupIdStr)) {
      groupOrderMap.set(groupIdStr, groupItems.map(item => item.SKU));
    }
    const orderedSkus = groupOrderMap.get(groupIdStr);
    if (Array.isArray(orderedSkus)) {
      groupItems.sort((a, b) => orderedSkus.indexOf(a.SKU) - orderedSkus.indexOf(b.SKU));
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

    // Renderiza la tabla usando customAttrs
    // (No olvides el manejo de catálogo, omitted here for brevity)
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
  }
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
injectMoveInfoModal();

let moveInfoModalState = {
  groupId: null,
  groupItems: [],
  attributes: []
};

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
    render();

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