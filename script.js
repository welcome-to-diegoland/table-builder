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

// Variables de estado
let filteredItems = [];
let editedCells = {};
let objectData = [];
let categoryData = [];
let isVerticalDragging = false;
let startX, startLeftWidth;
let currentFilter = {
  attribute: null,
  type: null
};
let showEmptyAttributes = false;
let defaultAttributesOrder = {};
let selectedGroups = new Set();
let attributeFiltersState = {};
let attributeFilterInputs = {};
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
const priorityStatsAttributes = ["titulo", "marca", "shop_by"];
const excludedAttributes = new Set([
  "product.type", "url_key", "product.attribute_set", "product.websites",
  "product.required_options", "stock.manage_stock", "stock.qty", "Price", "Status",
  "Tax_class_id", "Visibility", "name", "category.name", "leaf_name_filter",
  "image", "small_image", "thumbnail", "pdp_display_attribute",
  "pdp_description_attribute", "pdp_short_description_attribute", "icon_order",
  "orden_tabla", "orden_cms", "aplicaciones", "cms_web", "incluye", 
  "paginadecatalogo", "seccion", "ventajas", "brand_logo",
  "item_group_id", "categoria", "item_codeunspcweb_search_term",
  "beneficio_principal", "catalog_cover_image", "item_code", "titulo_web",
  "unspc", "description", "descripcion", "especificaciones", "web_search_term", 
  "catalog_page_number", "Weight"
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

  xlsxFileInput.addEventListener("change", handleXLSX);
  csvFileInput.addEventListener("change", handleCSV);
  categoryDataFileInput.addEventListener("change", handleCategoryData);
  applyOrderBtn.addEventListener("click", applyOrder);
  applyCatOrderBtn.addEventListener("click", applyCatOrder);
  loadWebOrderBtn.addEventListener("click", loadWebOrder);
  clearOrderBtn.addEventListener("click", clearAttributeOrder);
  clearCatOrderBtn.addEventListener("click", clearCatOrder);
  addMergeStyles();
  
  toggleEmptyBtn.addEventListener("click", toggleEmptyAttributes);
  clearFilterInputsBtn.addEventListener("click", clearFilterInputs);
  loadDefaultFiltersBtn.addEventListener("click", loadDefaultFilters);
  document.getElementById('mergeGroupsBtn').addEventListener('click', mergeSelectedGroups);
  const applyCatTablesBtn = document.getElementById("applyCatTablesBtn");
  applyCatTablesBtn.addEventListener("click", applyCategoryTables);


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
  
    const data = [];
    cmsSet.forEach(cmsIg => {
      attributes.forEach(attr => {
        const filtroInput = document.querySelector(`.filter-order-input[data-attribute="${attr}"]`);
        const catInput = document.querySelector(`.order-cat-input[data-attribute="${attr}"]`);
        const webInput = document.querySelector(`.order-input[data-attribute="${attr}"]`);
        data.push({
          "Atributo": attr,
          "Filtros": filtroInput ? (filtroInput.value || "") : "",
          "Web": webInput ? (webInput.value || "") : "",
          "Cat": catInput ? (catInput.value || "") : "",
          "CMS IG": cmsIg
        });
      });
    });
  
    let cmsPart = 'CMSIG';
    if (cmsSet.size >= 1) {
      cmsPart = [...cmsSet][0];
    }
    const atributosCols = ["Atributo", "Filtros", "Web", "Cat", "CMS IG"];
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

function clearAllChecks() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
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



function applyWebFilters() {
  // Implementación de applyWebFilters si es necesaria
}

function handleXLSX(event) {
  const file = event.target.files[0];
  if (!file) return;

  fileInfoDiv.innerHTML = `<p>Procesando Items File: <strong>${file.name}</strong></p>`;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets["data"];
      filteredItems = XLSX.utils.sheet_to_json(sheet);
      
      fileInfoDiv.innerHTML += `<p>✅ Items File cargado (${filteredItems.length} registros)</p>`;
      
      if (filteredItems[0] && filteredItems[0]['CMS IG']) {
        fileInfoDiv.innerHTML += `<p>CMS IG encontrado: <strong>${filteredItems[0]['CMS IG']}</strong></p>`;
      } else {
        fileInfoDiv.innerHTML += `<p>No se encontró columna CMS IG en Items File</p>`;
      }
      
      if (categoryData.length > 0) {
        updateOrderInputs();
      }
      
      if (objectData.length) render();
    } catch (error) {
      console.error("Error procesando Items File:", error);
      fileInfoDiv.innerHTML += `<p class="text-danger">Error: ${error.message}</p>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

function handleCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  fileInfoDiv.innerHTML += `<p>Procesando Data File: <strong>${file.name}</strong></p>`;
  
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      objectData = results.data;
      fileInfoDiv.innerHTML += `<p>✅ Data File cargado (${objectData.length} registros)</p>`;
      if (filteredItems.length) render();
    },
    error: (error) => {
      console.error("Error procesando Data File:", error);
      fileInfoDiv.innerHTML += `<p class="text-danger">Error: ${error.message}</p>`;
    }
  });
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

  fileInfoDiv.innerHTML += `<p>Procesando Category Data: <strong>${file.name}</strong></p>`;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      categoryData = XLSX.utils.sheet_to_json(sheet);
      
      fileInfoDiv.innerHTML += `<p>✅ Category Data cargado (${categoryData.length} registros)</p>`;
      
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
      fileInfoDiv.innerHTML += `<p class="text-danger">Error: ${error.message}</p>`;
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
    if (defaultAttributesOrder[attribute]) {
      input.value = defaultAttributesOrder[attribute];
      localStorage.setItem(`order_${attribute}`, defaultAttributesOrder[attribute]);
      updateCount++;
    }
  });
  
  fileInfoDiv.innerHTML += `
    <p class="update-info">
      <strong>Actualización de órdenes:</strong> 
      ${updateCount} inputs actualizados
    </p>
  `;
  
  fileInfoDiv.scrollTop = fileInfoDiv.scrollHeight;
}

// Función corregida: applyMultipleFilters
function applyMultipleFilters() {
  // Si NO hay filtros activos, regresamos a la UI principal
  if (Object.keys(activeFilters).length === 0) {
    render();
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

function displayFilteredResults(filteredItems) {
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
    if (!groupItems || !Array.isArray(groupItems) || groupItems.length === 0) {
      return;
    }
    if (!groupOrderMap.has(groupIdStr)) {
      groupOrderMap.set(groupIdStr, groupItems.map(item => item.SKU));
    }
    const orderedSkus = groupOrderMap.get(groupIdStr);
    if (Array.isArray(orderedSkus)) {
      groupItems.sort((a, b) => orderedSkus.indexOf(a.SKU) - orderedSkus.indexOf(b.SKU));
    }
    const groupInfo = objectData.find(o => o.SKU == groupIdStr) || {};
    const isMergedGroup = mergedGroups.has(groupIdStr);
    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container filtered-group ${isMergedGroup ? 'merged-group' : ''}`;
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
    const rightContainer = document.createElement("div");
    rightContainer.className = "group-header-right";
    const hasNewItem = groupItems.some(item => {
      const details = objectData.find(o => o.SKU === item.SKU);
      return details && details.shop_by && details.shop_by.trim().toLowerCase() === 'new';
    });
    if (hasNewItem) {
      const newBadge = document.createElement("span");
      newBadge.className = "new-badge";
      newBadge.textContent = "New";
      rightContainer.appendChild(newBadge);
    }
    if (isMergedGroup) {
      const mergedBadge = document.createElement("span");
      mergedBadge.className = "merged-badge";
      mergedBadge.textContent = `Unión de ${mergedGroups.get(groupIdStr).originalGroups.length} grupos`;
      rightContainer.appendChild(mergedBadge);
    }
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
  } else {
    attributeStatsDiv.innerHTML = '<p>No hay atributos usados en las tablas</p>';
  }
}
function createStatsColumn(stats) {
  // Puedes editar estos valores para ajustar el ancho de cada columna
  const colWidthAtributo = 'auto'; // flexible
  const colMinWidthAtributo = '120px';
  const colWidthFiltro = '50px';
  const colWidthWeb = '50px';
  const colWidthCat = '50px';
  const colWidthConValor = '40px';
  const colWidthSinValor = '40px';

  const column = document.createElement("div");
  column.className = "stats-column";
  
  const table = document.createElement("table");
  table.className = "table table-sm table-bordered attribute-stats-table";
  table.style.tableLayout = "fixed"; // Importante para respetar anchos

  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:${colWidthAtributo}; min-width:${colMinWidthAtributo};">
          <div class="attribute-header-wrapper">
            Atributo
            <button class="btn-clear-filter" title="Limpiar filtros" type="button">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </th>
        <th style="width:${colWidthFiltro}; min-width:${colWidthFiltro};">Filtro</th>
        <th style="width:${colWidthWeb}; min-width:${colWidthWeb};">Web</th>
        <th style="width:${colWidthCat}; min-width:${colWidthCat};">Cat</th>
        <th style="width:${colWidthConValor}; min-width:${colWidthConValor};">Con</th>
        <th style="width:${colWidthSinValor}; min-width:${colWidthSinValor};">Sin</th>
      </tr>
    </thead>
    <tbody>
      ${stats.map(stat => {
        const savedOrder = localStorage.getItem(`order_${stat.attribute}`);
        const defaultValue = defaultAttributesOrder[stat.attribute];
        const displayValue = savedOrder || defaultValue || '';
        
        let filterValue = '';
        if (defaultFilterAttributes.size > 0 && defaultFilterAttributes.has(stat.attribute)) {
          const order = Array.from(defaultFilterAttributes).indexOf(stat.attribute) + 1;
          filterValue = order.toString();
        } else {
          const savedFilter = localStorage.getItem(`filter_${stat.attribute}`);
          filterValue = savedFilter !== null && savedFilter !== '0' ? savedFilter : '';
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
                   value="">
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

  // Asignar el evento de limpieza al/los botón/es btn-clear-filter
  table.querySelectorAll('.btn-clear-filter').forEach(btn => {
    btn.addEventListener('click', function() {
      clearAllFilters();
    });
  });

  // Eventos para dropdowns de atributo
  table.querySelectorAll('.attribute-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', function() {
      const attribute = this.getAttribute('data-attribute');
      const value = this.value;
      filterItemsByAttributeValue(attribute, value);
    });
  });

  // Eventos para inputs de filtro
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

  // Eventos para inputs de orden
  table.querySelectorAll('.order-input, .order-cat-input').forEach(input => {
    input.addEventListener('change', saveAttributeOrder);
  });

  // Eventos para celdas de click
  table.querySelectorAll('.clickable').forEach(cell => {
    cell.addEventListener('click', handleStatClick);
  });

  column.appendChild(table);
  return column;
}

function clearAllFilters() {
  // 1. Limpiar todos los filtros activos
  activeFilters = {};
  
  // 2. Resetear todos los dropdowns
  document.querySelectorAll('.attribute-dropdown').forEach(dropdown => {
    dropdown.value = '';
  });
  
  // 3. Limpiar el filtro actual
  currentFilter = { attribute: null, type: null };
  highlightActiveFilter();
  
  // 4. Limpiar filtros del localStorage
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('filter_')) {
      localStorage.removeItem(key);
    }
  });

  // 5. RE-RENDER usando los mismos items en uso
  if (filteredItems.length) {
    // Recalcula stats, tablas y dropdowns, usando solo los items que están en filteredItems ahora
    render();
  }

  fileInfoDiv.innerHTML += `<p>Todos los filtros han sido limpiados completamente</p>`;
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
    fileInfoDiv.innerHTML += `<p>Órdenes restaurados desde table_attributes</p>`;
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
    fileInfoDiv.innerHTML += `<p>Órdenes Web eliminados</p>`;
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
    fileInfoDiv.innerHTML += `<p>Órdenes Cat eliminados</p>`;
  }
}

function toggleEmptyAttributes() {
  showEmptyAttributes = !showEmptyAttributes;
  currentViewState.showEmpty = showEmptyAttributes;
  
  const toggleBtn = document.getElementById('toggleEmptyBtn');
  const toggleState = toggleBtn.querySelector('.toggle-state');
  
  if (showEmptyAttributes) {
    toggleBtn.classList.add('active'); // Clase para estado activo
    toggleState.textContent = 'On';
  } else {
    toggleBtn.classList.remove('active'); // Clase para estado inactivo
    toggleState.textContent = 'Off';
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
    fileInfoDiv.innerHTML += `<p>Órdenes de columnas web aplicados</p>`;
  } else {
    alert("Primero debes cargar los archivos necesarios");
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
    fileInfoDiv.innerHTML += `<p>Órdenes de categoría aplicados</p>`;
  } else {
    alert("Primero debes cargar los archivos necesarios");
  }
}

function clearFilter() {
  currentFilter = { attribute: null, type: null };
  highlightActiveFilter();
  if (objectData.length && filteredItems.length) {
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
    fileInfoDiv.innerHTML += `<p>Filtro limpiado</p>`;
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
    render();
  }
  
  // 7. Mensaje visual
  fileInfoDiv.innerHTML += `<p class="text-success">✅ Grupo unido ${groupId} ha sido desagrupado</p>`;
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
    const rightContainer = document.createElement("div");
    rightContainer.className = "group-header-right";
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
    if (isMergedGroup) {
      const mergedBadge = document.createElement("span");
      mergedBadge.className = "merged-badge";
      mergedBadge.textContent = `Unión de ${mergedGroups.get(groupIdStr).originalGroups.length} grupos`;
      rightContainer.appendChild(mergedBadge);
      const unmergeBtn = document.createElement("button");
      unmergeBtn.className = "btn btn-sm btn-outline-danger unmerge-btn";
      unmergeBtn.textContent = "Desagrupar";
      unmergeBtn.title = "Revertir esta unión de grupos";
      unmergeBtn.dataset.groupIdStr = groupIdStr;
      unmergeBtn.addEventListener('click', function() {
        unmergeGroup(this.dataset.groupIdStr);
      });
      rightContainer.appendChild(unmergeBtn);
    }
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

    // Contenedor derecho (badges)
    const rightContainer = document.createElement("div");
    rightContainer.className = "group-header-right";
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
    if (isMergedGroup) {
      const mergedBadge = document.createElement("span");
      mergedBadge.className = "merged-badge";
      mergedBadge.textContent = `Unión de ${mergedGroups.get(groupIdStr).originalGroups.length} grupos`;
      rightContainer.appendChild(mergedBadge);

      const unmergeBtn = document.createElement("button");
      unmergeBtn.className = "btn btn-sm btn-outline-danger unmerge-btn";
      unmergeBtn.textContent = "Desagrupar";
      unmergeBtn.title = "Revertir esta unión de grupos";
      unmergeBtn.dataset.groupIdStr = groupIdStr;
      unmergeBtn.addEventListener('click', function() {
        unmergeGroup(this.dataset.groupIdStr);
      });
      rightContainer.appendChild(unmergeBtn);
    }
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

    const rightContainer = document.createElement("div");
    rightContainer.className = "group-header-right";
    const hasNewItem = groupItems.some(item => {
      const details = skuToObject[item.SKU];
      return details?.shop_by?.trim().toLowerCase() === 'new';
    });
    if (hasNewItem) {
      const newBadge = document.createElement("span");
      newBadge.className = "new-badge";
      newBadge.textContent = "New";
      rightContainer.appendChild(newBadge);
    }
    if (isMergedGroup) {
      const mergedBadge = document.createElement("span");
      mergedBadge.className = "merged-badge";
      mergedBadge.textContent = `Unión de ${mergedGroups.get(groupId).originalGroups.length} grupos`;
      rightContainer.appendChild(mergedBadge);

      const unmergeBtn = document.createElement("button");
      unmergeBtn.className = "btn btn-sm btn-outline-danger unmerge-btn";
      unmergeBtn.textContent = "Desagrupar";
      unmergeBtn.title = "Revertir esta unión de grupos";
      unmergeBtn.dataset.groupId = groupId;
      unmergeBtn.addEventListener('click', function() {
        unmergeGroup(this.dataset.groupId);
      });
      rightContainer.appendChild(unmergeBtn);
    }

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
  fileInfoDiv.innerHTML += `<p class="text-success">${message}</p>`;
  fileInfoDiv.scrollTop = fileInfoDiv.scrollHeight;
}

function renderMergedGroups(skuToObject) {
  // Limpiar output
  output.innerHTML = '';
  
  // Agrupar items por IG ID (incluyendo los unidos)
  const groups = {};
  filteredItems.forEach(item => {
    const groupId = item["IG ID"];
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(item);
  });

  // Procesar cada grupo
  Object.keys(groups).forEach(groupId => {
    const groupItems = groups[groupId];

    // Inicializa el orden si no existe
    if (!groupOrderMap.has(groupId)) {
      groupOrderMap.set(groupId, groupItems.map(item => item.SKU));
    }
    const orderedSkus = groupOrderMap.get(groupId);
    groupItems.sort((a, b) => orderedSkus.indexOf(a.SKU) - orderedSkus.indexOf(b.SKU));

    const groupInfo = skuToObject[groupId] || {};
    const isMergedGroup = mergedGroups.has(groupId);

    // Crear contenedor del grupo
    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container ${isMergedGroup ? 'merged-group' : ''}`;
    groupDiv.dataset.groupId = groupId;

    // Header del grupo
    const headerDiv = document.createElement("div");
    headerDiv.className = "group-header";

    // Contenedor izquierdo (imagen + info)
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";

    // Imagen del producto 
    const productImg = createProductImageElement(groupInfo.image);
    leftContainer.appendChild(productImg);

    // Información del grupo
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

    // SKU y procedencia
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

    // Contenedor derecho (badges)
    const rightContainer = document.createElement("div");
    rightContainer.className = "group-header-right";

    // Badge "New"
    const hasNewItem = groupItems.some(item => {
      const details = skuToObject[item.SKU];
      return details?.shop_by?.trim().toLowerCase() === 'new';
    });
    
    if (hasNewItem) {
      const newBadge = document.createElement("span");
      newBadge.className = "new-badge";
      newBadge.textContent = "New";
      rightContainer.appendChild(newBadge);
    }

    // Badge "Unido"
    if (isMergedGroup) {
      const mergedBadge = document.createElement("span");
      mergedBadge.className = "merged-badge";
      mergedBadge.textContent = `Unión de ${mergedGroups.get(groupId).originalGroups.length} grupos`;
      rightContainer.appendChild(mergedBadge);

      // Botón para desagrupar
      const unmergeBtn = document.createElement("button");
      unmergeBtn.className = "btn btn-sm btn-outline-danger unmerge-btn";
      unmergeBtn.textContent = "Desagrupar";
      unmergeBtn.title = "Revertir esta unión de grupos";
      unmergeBtn.dataset.groupId = groupId;
      unmergeBtn.addEventListener('click', function() {
        unmergeGroup(this.dataset.groupId);
      });
      rightContainer.appendChild(unmergeBtn);
    }

    headerDiv.appendChild(rightContainer);

    // Detalles de grupo unido (editable)
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
        // Genera detalles por defecto
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
        if (groupObj) {
          groupObj.details = mergedTextarea.value;
        }
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

    // Crear tabla con colores alternados para grupos originales
    createItemsTable(groupDiv, groupItems, skuToObject);

    output.appendChild(groupDiv);
  });
}



  // Limpiar output
  output.innerHTML = '';
  
  // Agrupar items por IG ID (incluyendo los unidos)
  const groups = {};
  filteredItems.forEach(item => {
    const groupId = item["IG ID"];
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(item);
  });

  // Procesar cada grupo
  Object.keys(groups).forEach(groupId => {
    const groupItems = groups[groupId];

 // Inicializa el orden si no existe
if (!groupOrderMap.has(groupId)) {
  groupOrderMap.set(groupId, groupItems.map(item => item.SKU));
}
const orderedSkus = groupOrderMap.get(groupId);
groupItems.sort((a, b) => orderedSkus.indexOf(a.SKU) - orderedSkus.indexOf(b.SKU));

    const groupInfo = skuToObject[groupId] || {};
    const isMergedGroup = mergedGroups.has(groupId);

    // Crear contenedor del grupo
    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container ${isMergedGroup ? 'merged-group' : ''}`;
    groupDiv.dataset.groupId = groupId;

    // Header del grupo
    const headerDiv = document.createElement("div");
    headerDiv.className = "group-header";

    // Contenedor izquierdo (imagen + info)
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";

    // Imagen del producto 
    const productImg = createProductImageElement(groupInfo.image);
    leftContainer.appendChild(productImg);
    

    // Información del grupo
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

    // SKU y procedencia
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

    // Contenedor derecho (badges)
    const rightContainer = document.createElement("div");
    rightContainer.className = "group-header-right";

    // Badge "New"
    const hasNewItem = groupItems.some(item => {
      const details = skuToObject[item.SKU];
      return details?.shop_by?.trim().toLowerCase() === 'new';
    });
    
    if (hasNewItem) {
      const newBadge = document.createElement("span");
      newBadge.className = "new-badge";
      newBadge.textContent = "New";
      rightContainer.appendChild(newBadge);
    }

    // Badge "Unido"
    if (isMergedGroup) {
      const mergedBadge = document.createElement("span");
      mergedBadge.className = "merged-badge";
      mergedBadge.textContent = `Unión de ${mergedGroups.get(groupId).originalGroups.length} grupos`;
      rightContainer.appendChild(mergedBadge);

      // Botón para desagrupar
      const unmergeBtn = document.createElement("button");
      unmergeBtn.className = "btn btn-sm btn-outline-danger unmerge-btn";
      unmergeBtn.textContent = "Desagrupar";
      unmergeBtn.title = "Revertir esta unión de grupos";
      unmergeBtn.dataset.groupId = groupId;
      unmergeBtn.addEventListener('click', function() {
        unmergeGroup(this.dataset.groupId);
      });
      rightContainer.appendChild(unmergeBtn);
    }

    headerDiv.appendChild(rightContainer);
    groupDiv.appendChild(headerDiv);

    // Crear tabla con colores alternados para grupos originales
    const table = document.createElement("table");
    table.className = "table table-striped table-bordered attribute-table";
    
    // Variables para alternar colores
    let currentColorClass = 'original-row-color1';
    let lastOriginalGroup = null;

    // Crear THEAD
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    
    // Agregar columnas necesarias
    headerRow.innerHTML = `
      <th>Atributo</th>
      <th>Valor</th>
      <th style="width:100px">Origen</th>
    `;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Crear TBODY
    const tbody = document.createElement("tbody");

    groupItems.forEach(item => {
      const details = skuToObject[item.SKU] || {};
      const isMergedItem = item.__originalIGID;

      // Alternar colores cuando cambia el grupo original
      if (isMergedItem && lastOriginalGroup !== item.__originalIGID) {
        currentColorClass = currentColorClass === 'original-row-color1' 
                         ? 'original-row-color2' 
                         : 'original-row-color1';
        lastOriginalGroup = item.__originalIGID;
      }

      // Crear fila para cada atributo del item
      Object.entries(details).forEach(([attr, value]) => {
        if (excludedAttributes.has(attr)) return;

        const row = document.createElement("tr");
        if (isMergedItem) {
          row.classList.add(currentColorClass);
          row.dataset.originalIgid = item.__originalIGID;
        }

        row.innerHTML = `
          <td>${attr}</td>
          <td>${value || ''}</td>
          <td>${isMergedItem ? item.__originalIGID : 'Original'}</td>
        `;

        tbody.appendChild(row);
      });
    });

    table.appendChild(tbody);

    // Agregar estilos para los colores alternados
    const style = document.createElement('style');
    style.textContent = `
      .original-row-color1 {
        background-color: #f8f9fa;
      }
      .original-row-color2 {
        background-color: #e9ecef;
      }
      .merged-group {
        border-left: 4px solid #007bff;
      }
      /* Resto de estilos... */
    `;
    groupDiv.appendChild(style);

    const tableContainer = document.createElement("div");
    tableContainer.className = "table-responsive";
    tableContainer.appendChild(table);
    groupDiv.appendChild(tableContainer);
    output.appendChild(groupDiv);
  });


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
        
        .group-header-right {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 5px;
            position: absolute;
            right: 10px;
            top: 10px;
        }
      
        
        .merged-badge {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8em;
        }
        
        .unmerge-btn {
            font-size: 0.7em;
            padding: 0.15rem 0.5rem;
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
    if (showEmptyAttributes) return true;
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
    theadHtml += `<th class="${isAllEmpty ? 'empty-header' : ''} ${isHighlighted ? 'highlight-column' : ''}">${attr.attribute}</th>`;
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

function resetGroupOrder(groupId) {
  // Obtener los SKUs en el orden original (como aparecen en filteredItems)
  const originalSkus = filteredItems
    .filter(item => item["IG ID"] === groupId)
    .map(item => item.SKU);
  
  // Actualizar el orden en groupOrderMap
  groupOrderMap.set(groupId, originalSkus);
  
  // Volver a renderizar el grupo
  const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
  const groupItems = filteredItems.filter(item => item["IG ID"] === groupId);
  
  // Encontrar el contenedor del grupo
  const groupContainer = document.querySelector(`.group-container[data-group-id="${groupId}"]`);
  if (groupContainer) {
    // Eliminar la tabla existente
    const existingTable = groupContainer.querySelector('.table-responsive');
    if (existingTable) existingTable.remove();
    
    // Crear nueva tabla con el orden original
    createItemsTable(groupContainer, groupItems, skuToObject);
  }
  
  showTemporaryMessage(`Orden del grupo ${groupId} restaurado`);
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
  for (const groupIdStr in groups) {
    const groupItems = groups[groupIdStr];
    if (!groupItems || !Array.isArray(groupItems) || groupItems.length === 0) continue;
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
    const rightContainer = document.createElement("div");
    rightContainer.className = "group-header-right";
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
    if (isMergedGroup) {
      const mergedBadge = document.createElement("span");
      mergedBadge.className = "merged-badge";
      mergedBadge.textContent = `Unión de ${mergedGroups.get(groupIdStr).originalGroups.length} grupos`;
      rightContainer.appendChild(mergedBadge);

      // Detalles de grupo unido
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
    headerDiv.appendChild(rightContainer);
    groupDiv.appendChild(headerDiv);

    const itemWithCatAttrs = groupItems.find(item => item.table_attributes_cat);
    let customAttrs = [];
    if (itemWithCatAttrs) {
      customAttrs = itemWithCatAttrs.table_attributes_cat
        .replace(/\s+/g, ',')
        .split(',')
        .map(attr => attr.trim())
        .filter(attr => attr);
    }
    createItemsTable(groupDiv, groupItems, skuToObject, null, customAttrs);
    output.appendChild(groupDiv);
  }
  fileInfoDiv.innerHTML += `<p class="text-success">✅ Tablas Cat aplicadas</p>`;
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

  fileInfoDiv.innerHTML += `<p class="text-success">✅ Inputs de filtro limpiados completamente</p>`;
}

function loadDefaultFilters() {
  if (defaultFilterAttributes.size === 0) {
      fileInfoDiv.innerHTML += `<p class="text-warning">⚠️ No hay filtros predeterminados definidos</p>`;
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
  fileInfoDiv.innerHTML += `<p class="text-success">✅ Filtros predeterminados cargados</p>`;
}