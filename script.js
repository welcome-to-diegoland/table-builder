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
  document.getElementById('horizontalDivider2').addEventListener('mousedown', (e) => {
    initHorizontalDrag(e, 'box2', 'box4');
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
  
  verticalDivider.addEventListener('mousedown', initVerticalDrag);
  document.getElementById('horizontalDivider').addEventListener('mousedown', (e) => {
    initHorizontalDrag(e, 'box1', 'box3');
  });
  
  toggleEmptyBtn.addEventListener("click", toggleEmptyAttributes);
  clearFilterInputsBtn.addEventListener("click", clearFilterInputs);
  loadDefaultFiltersBtn.addEventListener("click", loadDefaultFilters);
  document.getElementById('mergeGroupsBtn').addEventListener('click', mergeSelectedGroups);
  const applyCatTablesBtn = document.getElementById("applyCatTablesBtn");
  applyCatTablesBtn.addEventListener("click", applyCategoryTables);
  
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
  msgDiv.style.bottom = '60px';
  msgDiv.style.right = '20px';
  msgDiv.style.backgroundColor = '#007bff';
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
// Inicializa el orden si no existe
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
        render(); // ← Esto reconstruye la UI y muestra TODOS los controles
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
    if (!Array.isArray(orderedSkus)) {
      console.error('[render][error] orderedSkus no es array!', groupIdStr, orderedSkus);
    } else {
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
    if (groupInfo.image) {
      const productImg = document.createElement("img");
      productImg.src = `https://www.travers.com.mx/media/catalog/product/${groupInfo.image}`;
      productImg.className = "product-img";
      leftContainer.appendChild(productImg);
    }
    const infoDiv = document.createElement("div");
    infoDiv.className = "group-info";
    const h2 = document.createElement("h2");
    h2.className = "group-title";
    const link = document.createElement("a");
    link.href = `https://www.travers.com.mx/${groupIdStr}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = groupInfo.name || groupIdStr;
    h2.appendChild(link);
    infoDiv.appendChild(h2);
    if (groupInfo.brand_logo) {
      const logoImg = document.createElement("img");
      logoImg.src = `https://www.travers.com.mx/media/catalog/category/${groupInfo.brand_logo}`;
      logoImg.className = "logo-img";
      infoDiv.appendChild(logoImg);
    }
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
    // Agregar filtro
    activeFilters[attribute] = value;
  } else {
    // Remover filtro
    delete activeFilters[attribute];
  }
  
  applyMultipleFilters();
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
  const column = document.createElement("div");
  column.className = "stats-column";
  
  const table = document.createElement("table");
  table.className = "table table-sm table-bordered attribute-stats-table";
  
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 50px">Filtro</th>
        <th style="width: 60px">Col Web</th>
        <th style="width: 60px">Col Cat</th>
        <th>
          <div class="attribute-header-wrapper">
            Atributo
            <button class="btn-clear-filter" title="Limpiar filtros">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </th>
        <th>Con valor</th>
        <th>Sin valor</th>
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
          <td>
            <div class="filter-input-container">
              <input type="number" min="0" class="filter-order-input form-control form-control-sm" 
                   data-attribute="${stat.attribute}" 
                   value="${filterValue}">
            </div>
          </td>
          <td><input type="number" min="1" class="order-input form-control form-control-sm" 
               data-attribute="${stat.attribute}" 
               value="${displayValue}"></td>
          <td><input type="number" min="1" class="order-cat-input form-control form-control-sm" 
               data-attribute="${stat.attribute}" 
               value=""></td>
          <td>${dropdown}</td>
          <td class="clickable with-value" 
              data-attribute="${stat.attribute}" 
              data-type="withValue">${stat.withValue}</td>
          <td class="clickable without-value" 
              data-attribute="${stat.attribute}" 
              data-type="withoutValue">${stat.withoutValue}</td>
        </tr>
      `}).join('')}
    </tbody>
  `;

  // Asignar el evento de limpieza al botón btn-clear-filter
  table.querySelector('.btn-clear-filter').addEventListener('click', function() {
    clearAllFilters();
  });

  // Resto del código de eventos (sin cambios)
  table.querySelectorAll('.attribute-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', function() {
      const attribute = this.getAttribute('data-attribute');
      const value = this.value;
      filterItemsByAttributeValue(attribute, value);
    });
  });

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

  table.querySelectorAll('.order-input, .order-cat-input').forEach(input => {
    input.addEventListener('change', saveAttributeOrder);
  });

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
  
  // 5. Reprocesar items si hay datos cargados
  if (objectData.length && filteredItems.length) {
    const skuToObject = Object.fromEntries(objectData.map(o => [o.SKU, o]));
    processItemGroups(skuToObject);
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
  
  // Forzar el filtrado por item_code si es necesario
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

  // Filtrar los items
  filteredItems.forEach(item => {
    const details = skuToObject[item.SKU] || {};
    const hasValue = details[filterAttribute]?.toString().trim();
    
    if ((type === 'withValue' && hasValue) || (type === 'withoutValue' && !hasValue)) {
      const groupIdStr = String(item["IG ID"]);
      filteredGroupIds.add(groupIdStr);
      if (!filteredItemsMap[groupIdStr]) {
        filteredItemsMap[groupIdStr] = [];
      }
      filteredItemsMap[groupIdStr].push(item);
    }
  });

  // Mostrar resultados
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

  // Agregar evento al botón de limpiar filtro
  output.querySelector('.clear-filter-btn').addEventListener('click', clearFilter);

  // Mantener el orden original de los grupos
  const orderedGroupIds = [];
  const uniqueGroupIds = new Set();
  
  filteredItems.forEach(item => {
    const groupIdStr = String(item["IG ID"]);
    if (filteredGroupIds.has(groupIdStr) && !uniqueGroupIds.has(groupIdStr)) {
      orderedGroupIds.push(groupIdStr);
      uniqueGroupIds.add(groupIdStr);
    }
  });

  // Mostrar los grupos filtrados en el orden original
  orderedGroupIds.forEach(groupIdStr => {
    const groupItems = filteredItemsMap[groupIdStr];
    if (!groupItems || groupItems.length === 0) return;

    // === BLOQUE DE ORDEN MANUAL (igual que en processItemGroups) ===
    // Aplica el orden manual si existe
    if (!groupOrderMap.has(groupIdStr)) {
      groupOrderMap.set(groupIdStr, groupItems.map(item => item.SKU));
    }
    const orderedSkus = groupOrderMap.get(groupIdStr);
    if (!Array.isArray(orderedSkus)) {
      console.error('[render][error] orderedSkus no es array!', groupIdStr, orderedSkus);
    } else {
      groupItems.sort((a, b) => orderedSkus.indexOf(a.SKU) - orderedSkus.indexOf(b.SKU));
    }
    // === FIN BLOQUE DE ORDEN ===

    const groupInfo = skuToObject[groupIdStr] || {};
    const isMergedGroup = mergedGroups.has(groupIdStr);

    const groupDiv = document.createElement("div");
    groupDiv.className = `group-container ${isMergedGroup ? 'merged-group' : ''}`;
    groupDiv.dataset.groupId = groupIdStr;

    // Header del grupo - NUEVA ESTRUCTURA
    const headerDiv = document.createElement("div");
    headerDiv.className = "group-header";
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";
    if (groupInfo.image) {
      const productImg = document.createElement("img");
      productImg.src = `https://www.travers.com.mx/media/catalog/product/${groupInfo.image}`;
      productImg.className = "product-img";
      leftContainer.appendChild(productImg);
    }
    const infoDiv = document.createElement("div");
    infoDiv.className = "group-info";
    const h2 = document.createElement("h2");
    h2.className = "group-title";
    const link = document.createElement("a");
    link.href = `https://www.travers.com.mx/${groupIdStr}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = groupInfo.name || groupIdStr;
    h2.appendChild(link);
    infoDiv.appendChild(h2);
    if (groupInfo.brand_logo) {
      const logoImg = document.createElement("img");
      logoImg.src = `https://www.travers.com.mx/media/catalog/category/${groupInfo.brand_logo}`;
      logoImg.className = "logo-img";
      infoDiv.appendChild(logoImg);
    }
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
      unmergeBtn.dataset.groupId = groupIdStr;
      unmergeBtn.addEventListener('click', function() {
        unmergeGroup(this.dataset.groupId);
      });
      rightContainer.appendChild(unmergeBtn);
    }
    headerDiv.appendChild(rightContainer);
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
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";

    // Imagen del producto
    if (groupInfo.image) {
      const img = document.createElement("img");
      img.src = `https://www.travers.com.mx/media/catalog/product/${groupInfo.image}`;
      img.className = "product-img";
      img.onerror = () => img.style.display = 'none';
      leftContainer.appendChild(img);
    }

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

    if (groupInfo.brand_logo) {
      const logo = document.createElement("img");
      logo.src = `https://www.travers.com.mx/media/catalog/category/${groupInfo.brand_logo}`;
      logo.className = "brand-logo";
      logo.onerror = () => logo.style.display = 'none';
      infoDiv.appendChild(logo);
    }

    const details = document.createElement("div");
    details.className = "group-details";
    if (groupInfo.sku) {
      const sku = document.createElement("p");
      sku.textContent = `SKU: ${groupInfo.sku}`;
      details.appendChild(sku);
    }
    if (isMergedGroup) {
      const origin = document.createElement("p");
      origin.textContent = `Contiene items de: ${mergedGroups.get(groupIdStr).originalGroups.join(', ')}`;
      origin.className = "group-origin";
      details.appendChild(origin);
    }
    infoDiv.appendChild(details);
    leftContainer.appendChild(infoDiv);
    headerDiv.appendChild(leftContainer);

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
      unmergeBtn.dataset.groupId = groupIdStr;
      unmergeBtn.addEventListener('click', function() {
        unmergeGroup(this.dataset.groupId);
      });
      rightContainer.appendChild(unmergeBtn);
    }
    headerDiv.appendChild(rightContainer);
    groupDiv.appendChild(headerDiv);

    createItemsTable(groupDiv, groupItems, skuToObject);
    output.appendChild(groupDiv);

    groupDiv.querySelector('.group-checkbox').addEventListener('change', function() {
      if (this.checked) {
        selectedGroups.add(this.dataset.groupId);
      } else {
        selectedGroups.delete(this.dataset.groupId);
      }
      selectionCount.textContent = selectedGroups.size > 0 ? `(${selectedGroups.size} seleccionados)` : "";
    });
  });
}


function mergeSelectedGroups() {
  if (selectedGroups.size < 2) {
    alert("Debes seleccionar al menos 2 grupos para unir");
    return;
  }

  const groupsToMerge = Array.from(selectedGroups);
  const newGroupId = `merged-${Date.now()}`;

  // 1. Crear array para los items unidos
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

  // 2. Eliminar items de los grupos originales
  filteredItems = filteredItems.filter(item => !groupsToMerge.includes(String(item["IG ID"])));

  // 3. Agregar el nuevo grupo al principio
  filteredItems = [...mergedItems, ...filteredItems];

  // 4. Registrar el grupo unido
  mergedGroups.set(newGroupId, {
    originalGroups: [...groupsToMerge],
    items: [...mergedItems],
    creationTime: Date.now()
  });

  // 5. Agregar el nuevo grupo a objectData
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
    groupCreatedAt: Date.now() // 👈 esto es lo nuevo
  });

  // 6. Limpiar la selección visual
  selectedGroups.clear();
  document.querySelectorAll('.group-checkbox').forEach(cb => {
    cb.checked = false;
  });

  // 7. Forzar render completo
  if (filteredItems.length && objectData.length) {
    render();
  }

  // 8. Mensaje visual
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
    if (groupInfo.image) {
      const productImg = document.createElement("img");
      productImg.src = `https://www.travers.com.mx/media/catalog/product/${groupInfo.image}`;
      productImg.className = "product-img";
      leftContainer.appendChild(productImg);
    }

    // Información del grupo
    const infoDiv = document.createElement("div");
    infoDiv.className = "group-info";

    const h2 = document.createElement("h2");
    h2.className = "group-title";
    
    const link = document.createElement("a");
    link.href = `https://www.travers.com.mx/${groupId}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = groupInfo.name || groupId;
    h2.appendChild(link);
    infoDiv.appendChild(h2);

    // Logo de marca
    if (groupInfo.brand_logo) {
      const logoImg = document.createElement("img");
      logoImg.src = `https://www.travers.com.mx/media/catalog/category/${groupInfo.brand_logo}`;
      logoImg.className = "logo-img";
      infoDiv.appendChild(logoImg);
    }

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
  let theadHtml = "<thead><tr><th style='width: 10px;' class='drag-handle-column'></th>"; // Columna para drag handle
  
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
  
  // Columnas forzadas
  forcedColumns.forEach(forced => {
    theadHtml += `<th>${forced}</th>`;
  });
  
  // Columna para mostrar grupo original (solo para items unidos)
  theadHtml += `<th style="width:100px">Origen</th></tr></thead>`;

  // Crear TBODY
  const tbody = document.createElement("tbody");
  tbody.id = `tbody-${groupId}`; // ID único para cada tabla

  // Variables para alternar colores
  let currentColorClass = 'original-row-color1';
  let lastOriginalGroup = null;
  
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
    
    if (isMergedItem) {
      // Cambiar color solo cuando cambie el grupo original
      if (lastOriginalGroup !== item.__originalIGID) {
        currentColorClass = currentColorClass === 'original-row-color1' 
                         ? 'original-row-color2' 
                         : 'original-row-color1';
        lastOriginalGroup = item.__originalIGID;
      }
      
      row.dataset.originalIgid = item.__originalIGID;
      row.title = `Originalmente del grupo ${item.__originalIGID}`;
      row.classList.add(currentColorClass);
    }

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
    
    // Columnas forzadas
    forcedColumns.forEach(forced => {
      const cell = document.createElement("td");
      cell.style.minWidth = "100px";
      
      const value = details[forced] || "";
      const highlightStyle = forced === 'item_code' && shouldHighlight ? 
                         'background-color: #e6e6fa; font-weight: bold;' : '';
      cell.style = highlightStyle;
      
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
    
    // Columna de origen (para items unidos)
    const originCell = document.createElement("td");
    if (isMergedItem) {
      originCell.textContent = item.__originalIGID;
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

  // Estilos CSS para la tabla
  const style = document.createElement('style');
  style.textContent = `
    /* Estilos para drag and drop */
    .drag-handle-column {
      width: 20px;
      min-width: 20px !important;
    }
    
    .drag-handle {
      cursor: move;
      user-select: none;
      text-align: center;
      opacity: 0.5;
      transition: opacity 0.2s;
      width: 20px;
      color: #6c757d;
      font-size: 1.2em;
      padding: 0.3rem 0.5rem;
    }
    
    .drag-handle:hover {
      opacity: 1;
      color: #495057;
      background-color: #f1f3f5;
    }
    
    .sortable-chosen {
      background-color: #f8f9fa !important;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    
    .sortable-ghost {
      background-color: #e9ecef !important;
      opacity: 0.8;
    }
    
    .sortable-ghost .drag-handle {
      visibility: hidden;
    }
    
    /* Estilos para selección múltiple */
    tr.selected {
      background-color: #d4edff !important;
    }
    
    tr.selected td {
      border-color: #bfdfff !important;
    }
    
    /* Estilos para filas alternadas de grupos unidos */
    .original-row-color1 {
      background-color: #f8f9fa;
    }
    .original-row-color2 {
      background-color: #e9ecef;
    }
    
    /* Efecto hover para filas de grupos unidos */
    tr[data-original-igid]:hover {
      background-color: #e2e6ea !important;
    }
    
    /* Estilos existentes */
    .empty-header {
      color: #aaa;
      font-style: italic;
      background-color: #f8f9fa;
    }
    .empty-cell {
      background-color: #f9f9f9;
      padding: 0.3rem;
    }
    .filled-cell {
      background-color: #e6ffe6 !important;
    }
    .highlight-cell {
      background-color: #fffacd !important;
    }
    .highlight-column {
      background-color: #fffacd !important;
    }
    
    .attribute-table th,
    .attribute-table td {
      min-width: 100px !important;
      max-width: 300px;
      padding: 0.4rem;
      vertical-align: top;
    }
    
    .table-input {
      width: 90px;
      min-width: 90px;
      max-width: 90px;
      border: 1px solid #ddd;
      padding: 0.2rem 0.3rem;
      background-color: transparent;
      box-sizing: border-box;
      margin: 0 auto;
      display: block;
    }
    
    .attribute-table td {
      white-space: normal;
      word-break: break-word;
    }
    
    .table-input:focus {
      background-color: white;
      outline: none;
      border-color: #80bdff;
      box-shadow: 0 0 0 0.2rem rgba(0,123,255,0.25);
    }
    
    .merged-group {
      border-left: 4px solid #007bff;
    }
  `;
  table.appendChild(style);

  const tableContainer = document.createElement("div");
  tableContainer.className = "table-responsive";
  tableContainer.appendChild(table);
  
  // Insertar tabla después del header si existe
  if (existingHeader) {
    existingHeader.insertAdjacentElement('afterend', tableContainer);
  } else {
    container.appendChild(tableContainer);
  }
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
    if (!groupItems || !Array.isArray(groupItems) || groupItems.length === 0) {
      continue;
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
    const groupDiv = document.createElement("div");
    groupDiv.className = "group-container";
    const headerDiv = document.createElement("div");
    headerDiv.className = "group-header";
    const leftContainer = document.createElement("div");
    leftContainer.className = "group-header-left";
    const hasNewItem = groupItems.some(item => {
      const details = skuToObject[item.SKU];
      return details && details.shop_by && details.shop_by.trim().toLowerCase() === 'new';
    });
    if (hasNewItem) {
      const newBadge = document.createElement("span");
      newBadge.className = "new-badge";
      newBadge.textContent = "New";
      headerDiv.appendChild(newBadge);
    }
    if (groupInfo.image) {
      const productImg = document.createElement("img");
      productImg.src = `https://www.travers.com.mx/media/catalog/product/${groupInfo.image}`;
      productImg.className = "product-img";
      leftContainer.appendChild(productImg);
    }
    const infoDiv = document.createElement("div");
    infoDiv.className = "group-info";
    const h2 = document.createElement("h2");
    h2.className = "group-title";
    const link = document.createElement("a");
    link.href = `https://www.travers.com.mx/${groupIdStr}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = groupInfo.name || groupIdStr;
    h2.appendChild(link);
    infoDiv.appendChild(h2);
    if (groupInfo.brand_logo) {
      const logoImg = document.createElement("img");
      logoImg.src = `https://www.travers.com.mx/media/catalog/category/${groupInfo.brand_logo}`;
      logoImg.className = "logo-img";
      infoDiv.appendChild(logoImg);
    }
    if (groupInfo.sku) {
      const skuP = document.createElement("p");
      skuP.textContent = "SKU: " + groupInfo.sku;
      infoDiv.appendChild(skuP);
    }
    leftContainer.appendChild(infoDiv);
    headerDiv.appendChild(leftContainer);
    const rightContainer = document.createElement("div");
    rightContainer.className = "group-header-right";
    if (hasNewItem) {
      const newBadge = document.createElement("span");
      newBadge.className = "new-badge";
      newBadge.textContent = "New";
      rightContainer.appendChild(newBadge);
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