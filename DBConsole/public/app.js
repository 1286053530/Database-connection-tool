const state = {
  connections: [],
  activeConnectionId: null,
  activeDatabase: '',
  catalogs: [],
  queryTabs: [
    { id: 'query_1', title: '\u67e5\u8be2 1', sql: 'SELECT NOW();', resultHtml: '', connectionId: '', database: '', catalogs: [] }
  ],
  activeQueryTabId: 'query_1',
  activeTable: null,
  activeColumns: [],
  activeRows: [],
  editor: null,
  editorReady: null,
  contextConnectionId: null,
  contextTable: null,
  contextTableGroup: null,
  contextRowIndex: null,
  contextQueryCellValue: '',
  currentInsertSql: '',
  schemaSearchTerm: '',
  tableLimit: 1000,
  tablePage: 1,
  tableTotal: 0,
  tablePageSize: 1000,
  queryAbortController: null,
  filterVisible: false,
  contextDatabaseName: null,
  contextTableAction: '',
  renamingTableKey: '',
  activeFilter: {
    column: '',
    operator: 'contains',
    value: ''
  },
  tableInspectorVisible: false,
  tableInspectorCollapsed: false,
  sqlHistoryVisible: false,
  sqlHistoryCollapsed: false,
  activeInspectorTab: 'info',
  activeInspectorColumn: '',
  tableDetails: null,
  sqlSuggestions: [],
  activeSqlSuggestionIndex: 0,
  editingRowIndex: null,
  editingValues: null,
  columnWidths: {},
  manualColumnWidths: {},
  treeState: {}
};

const PASSWORD_MASK = '********';
const SQL_HISTORY_KEY = 'db-console-sql-history';
const SQL_HISTORY_LIMIT = 100;

const SQL_COMPLETION_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'JOIN', 'LEFT JOIN',
  'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
  'LIKE', 'BETWEEN', 'IS NULL', 'IS NOT NULL', 'DISTINCT', 'AS', 'CREATE TABLE',
  'ALTER TABLE', 'DROP TABLE', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'INDEX',
  'UNION', 'UNION ALL', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'
];

const COLUMN_TYPE_CONFIG = {
  mysql: {
    varchar: { template: 'varchar({length})', length: true },
    text: { template: 'text' },
    integer: { template: 'int' },
    bigint: { template: 'bigint' },
    decimal: { template: 'decimal({precision},{scale})', precision: true, scale: true },
    boolean: { template: 'tinyint(1)' },
    date: { template: 'date' },
    datetime: { template: 'datetime' },
    json: { template: 'json' }
  },
  postgres: {
    varchar: { template: 'varchar({length})', length: true },
    text: { template: 'text' },
    integer: { template: 'integer' },
    bigint: { template: 'bigint' },
    decimal: { template: 'numeric({precision},{scale})', precision: true, scale: true },
    boolean: { template: 'boolean' },
    date: { template: 'date' },
    datetime: { template: 'timestamp' },
    json: { template: 'jsonb' }
  }
};

const els = {
  connectionList: document.getElementById('connectionList'),
  shell: document.getElementById('shell'),
  connectionForm: document.getElementById('connectionForm'),
  newConnectionBtn: document.getElementById('newConnectionBtn'),
  connectionContextMenu: document.getElementById('connectionContextMenu'),
  editConnectionBtn: document.getElementById('editConnectionBtn'),
  deleteConnectionBtn: document.getElementById('deleteConnectionBtn'),
  connectionModal: document.getElementById('connectionModal'),
  connectionModalTitle: document.getElementById('connectionModalTitle'),
  closeConnectionModalBtn: document.getElementById('closeConnectionModalBtn'),
  connectionTestModal: document.getElementById('connectionTestModal'),
  closeConnectionTestModalBtn: document.getElementById('closeConnectionTestModalBtn'),
  connectionTestResult: document.getElementById('connectionTestResult'),
  toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  activeConnectionName: document.getElementById('activeConnectionName'),
  statusBar: document.getElementById('statusBar'),
  workspaceResizeHandle: document.getElementById('workspaceResizeHandle'),
  schemaTree: document.getElementById('schemaTree'),
  schemaSearchInput: document.getElementById('schemaSearchInput'),
  databaseContextMenu: document.getElementById('databaseContextMenu'),
  openDatabaseBtn: document.getElementById('openDatabaseBtn'),
  closeDatabaseBtn: document.getElementById('closeDatabaseBtn'),
  editDatabaseBtn: document.getElementById('editDatabaseBtn'),
  deleteDatabaseBtn: document.getElementById('deleteDatabaseBtn'),
  createDatabaseBtn: document.getElementById('createDatabaseBtn'),
  refreshDatabaseBtn: document.getElementById('refreshDatabaseBtn'),
  tableContextMenu: document.getElementById('tableContextMenu'),
  tableGroupContextMenu: document.getElementById('tableGroupContextMenu'),
  openTableMenuBtn: document.getElementById('openTableMenuBtn'),
  designTableBtn: document.getElementById('designTableBtn'),
  createTableBtn: document.getElementById('createTableBtn'),
  deleteTableBtn: document.getElementById('deleteTableBtn'),
  clearTableBtn: document.getElementById('clearTableBtn'),
  truncateTableBtn: document.getElementById('truncateTableBtn'),
  importWizardBtn: document.getElementById('importWizardBtn'),
  exportWizardBtn: document.getElementById('exportWizardBtn'),
  renameTableBtn: document.getElementById('renameTableBtn'),
  refreshTableSchemaBtn: document.getElementById('refreshTableSchemaBtn'),
  createTableFromGroupBtn: document.getElementById('createTableFromGroupBtn'),
  importTableGroupBtn: document.getElementById('importTableGroupBtn'),
  refreshTableGroupBtn: document.getElementById('refreshTableGroupBtn'),
  sqlEditor: document.getElementById('sqlEditor'),
  sqlSuggestPanel: document.getElementById('sqlSuggestPanel'),
  queryTabs: document.getElementById('queryTabs'),
  newQueryTabBtn: document.getElementById('newQueryTabBtn'),
  formatSqlBtn: document.getElementById('formatSqlBtn'),
  openSqlHistoryBtn: document.getElementById('openSqlHistoryBtn'),
  queryConnectionSelect: document.getElementById('queryConnectionSelect'),
  queryDatabaseSelect: document.getElementById('queryDatabaseSelect'),
  queryEditorActions: document.getElementById('queryEditorActions'),
  stopQueryBtn: document.getElementById('stopQueryBtn'),
  queryRunActions: document.getElementById('queryRunActions'),
  queryResultWrap: document.getElementById('queryResultWrap'),
  queryResultResizeHandle: document.getElementById('queryResultResizeHandle'),
  queryCellContextMenu: document.getElementById('queryCellContextMenu'),
  copyQueryCellBtn: document.getElementById('copyQueryCellBtn'),
  editorDialectBadge: document.getElementById('editorDialectBadge'),
  runQueryBtn: document.getElementById('runQueryBtn'),
  queryResult: document.getElementById('queryResult'),
  columnList: document.getElementById('columnList'),
  structureToolbar: document.getElementById('structureToolbar'),
  addColumnBtn: document.getElementById('addColumnBtn'),
  designTableModal: document.getElementById('designTableModal'),
  closeDesignTableModalBtn: document.getElementById('closeDesignTableModalBtn'),
  designTableModalTitle: document.getElementById('designTableModalTitle'),
  designTableToolbar: document.getElementById('designTableToolbar'),
  addColumnFromDesignBtn: document.getElementById('addColumnFromDesignBtn'),
  designTableColumnList: document.getElementById('designTableColumnList'),
  columnModal: document.getElementById('columnModal'),
  closeColumnModalBtn: document.getElementById('closeColumnModalBtn'),
  columnModalTitle: document.getElementById('columnModalTitle'),
  columnForm: document.getElementById('columnForm'),
  cancelColumnBtn: document.getElementById('cancelColumnBtn'),
  columnTypePreset: document.getElementById('columnTypePreset'),
  columnTypeLength: document.getElementById('columnTypeLength'),
  columnTypePrecision: document.getElementById('columnTypePrecision'),
  columnTypeScale: document.getElementById('columnTypeScale'),
  columnCustomTypeWrap: document.getElementById('columnCustomTypeWrap'),
  columnCustomType: document.getElementById('columnCustomType'),
  columnDefaultMode: document.getElementById('columnDefaultMode'),
  columnDefaultValueWrap: document.getElementById('columnDefaultValueWrap'),
  columnDefaultValueLabel: document.getElementById('columnDefaultValueLabel'),
  columnPrimaryKey: document.getElementById('columnPrimaryKey'),
  columnPrimaryKeyWrap: document.getElementById('columnPrimaryKeyWrap'),
  columnAutoIncrement: document.getElementById('columnAutoIncrement'),
  columnAutoIncrementWrap: document.getElementById('columnAutoIncrementWrap'),
  columnDefinitionPreview: document.getElementById('columnDefinitionPreview'),
  databaseModal: document.getElementById('databaseModal'),
  closeDatabaseModalBtn: document.getElementById('closeDatabaseModalBtn'),
  databaseModalTitle: document.getElementById('databaseModalTitle'),
  databaseForm: document.getElementById('databaseForm'),
  deleteDatabaseModal: document.getElementById('deleteDatabaseModal'),
  closeDeleteDatabaseModalBtn: document.getElementById('closeDeleteDatabaseModalBtn'),
  deleteDatabaseMessage: document.getElementById('deleteDatabaseMessage'),
  confirmDeleteDatabaseBtn: document.getElementById('confirmDeleteDatabaseBtn'),
  tableModal: document.getElementById('tableModal'),
  closeTableModalBtn: document.getElementById('closeTableModalBtn'),
  tableModalTitle: document.getElementById('tableModalTitle'),
  tableForm: document.getElementById('tableForm'),
  deleteTableModal: document.getElementById('deleteTableModal'),
  deleteTableModalTitle: document.getElementById('deleteTableModalTitle'),
  closeDeleteTableModalBtn: document.getElementById('closeDeleteTableModalBtn'),
  deleteTableMessage: document.getElementById('deleteTableMessage'),
  confirmDeleteTableBtn: document.getElementById('confirmDeleteTableBtn'),
  dataTableWrap: document.getElementById('dataTableWrap'),
  dataToolbar: document.getElementById('dataToolbar'),
  openQueryFromDataBtn: document.getElementById('openQueryFromDataBtn'),
  dataFilterRow: document.getElementById('dataFilterRow'),
  tableLimitInput: document.getElementById('tableLimitInput'),
  tablePagination: document.getElementById('tablePagination'),
  openExportModalBtn: document.getElementById('openExportModalBtn'),
  openImportModalBtn: document.getElementById('openImportModalBtn'),
  toggleFilterBtn: document.getElementById('toggleFilterBtn'),
  filterColumnSelect: document.getElementById('filterColumnSelect'),
  filterOperatorSelect: document.getElementById('filterOperatorSelect'),
  filterValueInput: document.getElementById('filterValueInput'),
  applyFilterBtn: document.getElementById('applyFilterBtn'),
  clearFilterBtn: document.getElementById('clearFilterBtn'),
  importForm: document.getElementById('importForm'),
  tableActionModal: document.getElementById('tableActionModal'),
  tableActionModalTitle: document.getElementById('tableActionModalTitle'),
  closeTableActionModalBtn: document.getElementById('closeTableActionModalBtn'),
  exportActionPanel: document.getElementById('exportActionPanel'),
  confirmExportBtn: document.getElementById('confirmExportBtn'),
  importFile: document.getElementById('importFile'),
  confirmImportBtn: document.getElementById('confirmImportBtn'),
  activeTableName: document.getElementById('activeTableName'),
  primaryKeyHint: document.getElementById('primaryKeyHint'),
  tableInspector: document.getElementById('tableInspector'),
  toggleTableInspectorBtn: document.getElementById('toggleTableInspectorBtn'),
  tableInspectorTitle: document.getElementById('tableInspectorTitle'),
  tableInspectorSubtitle: document.getElementById('tableInspectorSubtitle'),
  tableInspectorTabs: document.getElementById('tableInspectorTabs'),
  tableInspectorBody: document.getElementById('tableInspectorBody'),
  dataActions: document.getElementById('dataActions'),
  insertRowBtn: document.getElementById('insertRowBtn'),
  refreshTableBtn: document.getElementById('refreshTableBtn'),
  editActions: document.getElementById('editActions'),
  saveEditBtn: document.getElementById('saveEditBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  rowContextMenu: document.getElementById('rowContextMenu'),
  designTableFromRowBtn: document.getElementById('designTableFromRowBtn'),
  showInsertSqlBtn: document.getElementById('showInsertSqlBtn'),
  deleteRowBtn: document.getElementById('deleteRowBtn'),
  sqlPreviewModal: document.getElementById('sqlPreviewModal'),
  insertSqlPreview: document.getElementById('insertSqlPreview'),
  copyInsertSqlBtn: document.getElementById('copyInsertSqlBtn'),
  closeSqlPreviewBtn: document.getElementById('closeSqlPreviewBtn'),
  sqlHistoryModal: document.getElementById('sqlHistoryModal'),
  closeSqlHistoryBtn: document.getElementById('closeSqlHistoryBtn'),
  clearSqlHistoryBtn: document.getElementById('clearSqlHistoryBtn'),
  sqlHistoryList: document.getElementById('sqlHistoryList'),
  tabPanels: {
    query: document.getElementById('queryTab'),
    data: document.getElementById('dataTab'),
    structure: document.getElementById('structureTab')
  }
};

function setSidebarCollapsed(collapsed) {
  els.shell.classList.toggle('sidebar-collapsed', collapsed);
  els.toggleSidebarBtn.textContent = collapsed ? '>' : '<';
  els.toggleSidebarBtn.title = collapsed ? '展开左侧栏' : '收起左侧栏';
  els.toggleSidebarBtn.setAttribute('aria-label', collapsed ? '展开左侧栏' : '收起左侧栏');
  requestAnimationFrame(syncActiveDataTableLayout);
}

function initWorkspaceResize() {
  let startX = 0;
  let startWidth = 320;

  function stopResize() {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stopResize);
  }

  function onMouseMove(event) {
    const nextWidth = Math.max(220, Math.min(520, startWidth + (event.clientX - startX)));
    const grid = document.querySelector('.workspace-grid');
    if (grid) {
      grid.style.gridTemplateColumns = `${nextWidth}px 10px minmax(0, 1fr)`;
    }
  }

  els.workspaceResizeHandle.addEventListener('mousedown', (event) => {
    event.preventDefault();
    startX = event.clientX;
    const schemaPanel = document.querySelector('.schema-panel');
    startWidth = schemaPanel ? schemaPanel.getBoundingClientRect().width : 320;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopResize);
  });
}

function openConnectionModal(title) {
  els.connectionModalTitle.textContent = title;
  if (els.connectionModal) {
    els.connectionModal.classList.remove('hidden');
  }
}

function closeConnectionModal() {
  if (els.connectionModal) {
    els.connectionModal.classList.add('hidden');
  }
}

function openConnectionTestModal() {
  if (els.connectionTestModal) {
    els.connectionTestModal.classList.remove('hidden');
  }
}

function closeConnectionTestModal() {
  if (els.connectionTestModal) {
    els.connectionTestModal.classList.add('hidden');
  }
}

function openTableActionModal(mode) {
  els.tableActionModalTitle.textContent = mode === 'export' ? '\u5bfc\u51fa' : '\u5bfc\u5165';
  els.exportActionPanel.classList.toggle('hidden', mode !== 'export');
  els.importForm.classList.toggle('hidden', mode !== 'import');
  if (els.tableActionModal) {
    els.tableActionModal.classList.remove('hidden');
  }
}

function closeTableActionModal() {
  if (els.tableActionModal) {
    els.tableActionModal.classList.add('hidden');
  }
}

function getColumnDialect() {
  const active = getActiveConnection();
  return active && active.type === 'postgres' ? 'postgres' : 'mysql';
}

function renderColumnTypeFromDesigner() {
  const preset = els.columnTypePreset ? els.columnTypePreset.value : 'varchar';
  if (preset === 'custom') {
    return (els.columnCustomType ? els.columnCustomType.value : '').trim();
  }
  const config = (COLUMN_TYPE_CONFIG[getColumnDialect()] || COLUMN_TYPE_CONFIG.mysql)[preset] || COLUMN_TYPE_CONFIG.mysql.varchar;
  return config.template
    .replace('{length}', String(Number(els.columnTypeLength.value) || 255))
    .replace('{precision}', String(Number(els.columnTypePrecision.value) || 18))
    .replace('{scale}', String(Number(els.columnTypeScale.value) || 0));
}

function buildColumnDefinitionPreview() {
  const form = els.columnForm;
  const columnName = form.elements.columnName.value.trim() || 'column_name';
  const columnType = renderColumnTypeFromDesigner() || 'varchar(255)';
  const parts = [columnName, columnType, form.elements.allowNull.checked ? 'NULL' : 'NOT NULL'];
  const defaultMode = els.columnDefaultMode ? els.columnDefaultMode.value : 'none';
  const defaultValue = form.elements.columnDefault.value.trim();
  if (defaultMode === 'null') {
    parts.push('DEFAULT NULL');
  } else if (defaultMode === 'value' && defaultValue) {
    parts.push(`DEFAULT '${defaultValue.replace(/'/g, "''")}'`);
  } else if (defaultMode === 'expression' && defaultValue) {
    parts.push(`DEFAULT ${defaultValue}`);
  }
  if (form.elements.primaryKey && form.elements.primaryKey.checked) {
    parts.push('PRIMARY KEY');
  }
  if (form.elements.autoIncrement && form.elements.autoIncrement.checked && form.elements.primaryKey && form.elements.primaryKey.checked) {
    parts.push(getColumnDialect() === 'postgres' ? 'GENERATED BY DEFAULT AS IDENTITY' : 'AUTO_INCREMENT');
  }
  return parts.join(' ');
}

function updateColumnDesignerState() {
  if (!els.columnTypePreset) {
    return;
  }
  const preset = els.columnTypePreset.value;
  const config = (COLUMN_TYPE_CONFIG[getColumnDialect()] || COLUMN_TYPE_CONFIG.mysql)[preset] || {};
  Array.from(document.querySelectorAll('[data-column-type-option]')).forEach((element) => {
    const key = element.dataset.columnTypeOption;
    element.classList.toggle('hidden', preset === 'custom' || !config[key]);
  });
  if (els.columnCustomTypeWrap) {
    els.columnCustomTypeWrap.classList.toggle('hidden', preset !== 'custom');
  }

  const defaultMode = els.columnDefaultMode ? els.columnDefaultMode.value : 'none';
  if (els.columnDefaultValueWrap) {
    els.columnDefaultValueWrap.classList.toggle('hidden', defaultMode === 'none' || defaultMode === 'null');
  }
  if (els.columnDefaultValueLabel) {
    els.columnDefaultValueLabel.textContent = defaultMode === 'expression' ? '\u9ed8\u8ba4\u8868\u8fbe\u5f0f' : '\u9ed8\u8ba4\u503c\u5185\u5bb9';
  }
  if (els.columnAutoIncrementWrap && els.columnAutoIncrement) {
    const enabled = !!(els.columnForm.elements.primaryKey && els.columnForm.elements.primaryKey.checked);
    els.columnAutoIncrement.disabled = !enabled;
    els.columnAutoIncrementWrap.classList.toggle('is-disabled', !enabled);
    if (!enabled) {
      els.columnAutoIncrement.checked = false;
    }
  }
  if (els.columnDefinitionPreview) {
    els.columnForm.elements.columnType.value = renderColumnTypeFromDesigner();
    els.columnDefinitionPreview.textContent = buildColumnDefinitionPreview();
  }
}

function inferColumnTypePreset(columnType) {
  const value = String(columnType || '').trim().toLowerCase();
  const sizeMatch = value.match(/\((\d+)(?:\s*,\s*(\d+))?\)/);
  if (sizeMatch) {
    els.columnTypeLength.value = sizeMatch[1] || '255';
    els.columnTypePrecision.value = sizeMatch[1] || '18';
    els.columnTypeScale.value = sizeMatch[2] || '4';
  }
  if (/^(var)?char/.test(value)) return 'varchar';
  if (/^(text|longtext|mediumtext)/.test(value)) return 'text';
  if (/^(int|integer|smallint)/.test(value)) return 'integer';
  if (/^bigint/.test(value)) return 'bigint';
  if (/^(decimal|numeric|number)/.test(value)) return 'decimal';
  if (/^(bool|boolean|tinyint\(1\))/.test(value)) return 'boolean';
  if (/^date$/.test(value)) return 'date';
  if (/^(datetime|timestamp)/.test(value)) return 'datetime';
  if (/^json/.test(value)) return 'json';
  return 'custom';
}

function inferDefaultMode(columnDefault) {
  if (columnDefault === null || columnDefault === undefined || columnDefault === '') {
    return 'none';
  }
  const value = String(columnDefault).trim();
  if (/^null$/i.test(value)) {
    return 'null';
  }
  if (/^(current_timestamp|now\(\)|uuid\(\)|gen_random_uuid\(\))/i.test(value)) {
    return 'expression';
  }
  return 'value';
}

function isPrimaryKeyColumn(column) {
  return String(column && column.columnKey ? column.columnKey : '').toUpperCase() === 'PRI';
}

function isAutoIncrementColumn(column) {
  if (!column) {
    return false;
  }
  if (column.autoIncrement === true) {
    return true;
  }
  const extra = String(column.extra || '').toLowerCase();
  if (extra.includes('auto_increment')) {
    return true;
  }
  const columnDefault = String(column.columnDefault || '').toLowerCase();
  return columnDefault.includes('nextval(');
}

function openColumnModal(title, column) {
  els.columnModalTitle.textContent = title;
  els.columnForm.elements.mode.value = column ? 'edit' : 'add';
  els.columnForm.elements.originalName.value = column ? column.columnName : '';
  els.columnForm.elements.columnName.value = column ? column.columnName : '';
  els.columnTypeLength.value = '255';
  els.columnTypePrecision.value = '18';
  els.columnTypeScale.value = '4';
  const preset = column ? inferColumnTypePreset(column.columnType) : 'varchar';
  els.columnTypePreset.value = preset;
  els.columnCustomType.value = preset === 'custom' && column ? column.columnType : '';
  els.columnForm.elements.allowNull.checked = !column || column.isNullable === 'YES';
  els.columnForm.elements.columnDefault.value = column && column.columnDefault != null ? column.columnDefault : '';
  els.columnDefaultMode.value = column ? inferDefaultMode(column.columnDefault) : 'none';
  if (els.columnForm.elements.primaryKey) {
    els.columnForm.elements.primaryKey.checked = !!column && isPrimaryKeyColumn(column);
  }
  if (els.columnForm.elements.autoIncrement) {
    els.columnForm.elements.autoIncrement.checked = !!column && isPrimaryKeyColumn(column) && isAutoIncrementColumn(column);
  }
  updateColumnDesignerState();
  els.columnModal.classList.remove('hidden');
}

function closeColumnModal() {
  els.columnModal.classList.add('hidden');
}

function openDesignTableModal() {
  const tableName = state.activeTable
    ? `${state.activeTable.database ? `${state.activeTable.database}.` : ''}${state.activeTable.schema ? `${state.activeTable.schema}.` : ''}${state.activeTable.table}`
    : '';
  els.designTableModalTitle.textContent = tableName ? `\u8bbe\u8ba1\u8868 · ${tableName}` : '\u8bbe\u8ba1\u8868';
  els.designTableModal.classList.remove('hidden');
}

function closeDesignTableModal() {
  els.designTableModal.classList.add('hidden');
}

function openDatabaseModal(title, databaseName, mode) {
  els.databaseModalTitle.textContent = title;
  els.databaseForm.elements.mode.value = mode;
  els.databaseForm.elements.originalName.value = databaseName || '';
  els.databaseForm.elements.databaseName.value = databaseName || '';
  els.databaseModal.classList.remove('hidden');
}

function closeDatabaseModal() {
  els.databaseModal.classList.add('hidden');
}

function openDeleteDatabaseModal(databaseName) {
  els.deleteDatabaseMessage.textContent = `${databaseName}`;
  els.deleteDatabaseModal.classList.remove('hidden');
}

function closeDeleteDatabaseModal() {
  els.deleteDatabaseModal.classList.add('hidden');
  state.contextDatabaseName = null;
}

function hideDatabaseContextMenu() {
  els.databaseContextMenu.classList.add('hidden');
}

function positionContextMenu(menu, x, y) {
  const viewportPadding = 8;
  menu.style.left = '0px';
  menu.style.top = '0px';
  menu.style.visibility = 'hidden';
  menu.classList.remove('hidden');

  const rect = menu.getBoundingClientRect();
  const maxLeft = Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding);
  const maxTop = Math.max(viewportPadding, window.innerHeight - rect.height - viewportPadding);
  const nextLeft = Math.min(Math.max(viewportPadding, x), maxLeft);
  const nextTop = Math.min(Math.max(viewportPadding, y), maxTop);

  menu.style.left = `${nextLeft}px`;
  menu.style.top = `${nextTop}px`;
  menu.style.visibility = '';
}

function showDatabaseContextMenu(x, y, databaseName) {
  state.contextDatabaseName = databaseName;
  positionContextMenu(els.databaseContextMenu, x, y);
}

function hideTableContextMenu() {
  els.tableContextMenu.classList.add('hidden');
}

function hideTableGroupContextMenu() {
  els.tableGroupContextMenu.classList.add('hidden');
  state.contextTableGroup = null;
}

function showTableContextMenu(x, y, tableContext) {
  state.contextTable = tableContext;
  positionContextMenu(els.tableContextMenu, x, y);
}

function showTableGroupContextMenu(x, y, groupContext) {
  state.contextTableGroup = groupContext;
  positionContextMenu(els.tableGroupContextMenu, x, y);
}

function openTableModal(title, tableName, mode) {
  els.tableModalTitle.textContent = title;
  els.tableForm.elements.mode.value = mode;
  els.tableForm.elements.originalName.value = tableName || '';
  els.tableForm.elements.tableName.value = tableName || '';
  els.tableModal.classList.remove('hidden');
}

function closeTableModal() {
  els.tableModal.classList.add('hidden');
}

function openDeleteTableModal(action, tableName) {
  const isTruncate = action === 'truncate';
  const isClear = action === 'clear';
  state.contextTableAction = action;
  els.deleteTableModalTitle.textContent = isTruncate ? '确认截断表' : isClear ? '确认清空表' : '确认删除表';
  els.deleteTableMessage.textContent = isTruncate
    ? `确定要截断表 ${tableName} 吗？此操作会删除全部数据。`
    : isClear
      ? `确定要清空表 ${tableName} 吗？此操作会删除全部数据。`
      : `确定要删除表 ${tableName} 吗？`;
  els.confirmDeleteTableBtn.textContent = isTruncate ? '确认截断' : isClear ? '确认清空' : '确认删除';
  els.deleteTableModal.classList.remove('hidden');
}

function closeDeleteTableModal() {
  els.deleteTableModal.classList.add('hidden');
  state.contextTableAction = '';
  state.contextTable = null;
}

function openCurrentDatabase() {
  if (!state.contextDatabaseName) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  state.activeDatabase = state.contextDatabaseName;
  state.treeState[`catalog:${state.contextDatabaseName}`] = true;
  hideDatabaseContextMenu();
  renderSchema();
  updateHeader();
  setStatus(`已打开数据库 ${state.activeDatabase}`, false);
}

function hideConnectionContextMenu() {
  els.connectionContextMenu.classList.add('hidden');
  state.contextConnectionId = null;
}

function showConnectionContextMenu(x, y, connectionId) {
  state.contextConnectionId = connectionId;
  positionContextMenu(els.connectionContextMenu, x, y);
}

function getActiveQueryTab() {
  return state.queryTabs.find((tab) => tab.id === state.activeQueryTabId) || state.queryTabs[0];
}

function getConnectionByTabId(connectionId) {
  return state.connections.find((item) => item.id === connectionId) || null;
}

async function resetQueryTabsForConnection(connectionId, catalogs, database) {
  if (state.queryAbortController) {
    state.queryAbortController.abort();
    state.queryAbortController = null;
    els.stopQueryBtn.disabled = true;
  }

  const activeConnectionId = connectionId || '';
  const availableCatalogs = activeConnectionId ? (catalogs || []) : [];
  state.queryTabs = [{
    id: 'query_1',
    title: '\u67e5\u8be2 1',
    sql: '',
    resultHtml: '',
    connectionId: activeConnectionId,
    database: activeConnectionId ? (database || (availableCatalogs[0] ? availableCatalogs[0].name : '')) : '',
    catalogs: availableCatalogs.slice()
  }];
  state.activeQueryTabId = 'query_1';
  els.queryResult.innerHTML = '';
  els.queryResultWrap.classList.add('hidden');
  renderQueryTabs();
  syncQuerySelectors();
  await syncEditorToActiveQueryTab();
}

async function resetQueryTabsForActiveConnection() {
  await resetQueryTabsForConnection(state.activeConnectionId, state.catalogs, state.activeDatabase);
}

function renderQueryTabs() {
  const isDataTabActive = els.tabPanels.data.classList.contains('active');
  const dataTabHtml = `<div class="query-tab-item query-tab-item-data ${isDataTabActive ? 'active' : ''}"><button type="button" class="query-tab-main" data-action="switch-data-tab">\u8868\u6570\u636e</button></div>`;
  els.queryTabs.innerHTML = dataTabHtml + state.queryTabs.map((tab) => `
    <div class="query-tab-item ${tab.id === state.activeQueryTabId ? 'active' : ''}">
      <button type="button" class="query-tab-main" data-action="switch-query-tab" data-tab-id="${escapeAttr(tab.id)}">${escapeHtml(tab.title)}</button>
      ${state.queryTabs.length > 1 ? `<button type="button" class="query-tab-close" data-action="close-query-tab" data-tab-id="${escapeAttr(tab.id)}">x</button>` : ''}
    </div>
  `).join('');
}

async function syncEditorToActiveQueryTab() {
  const activeTab = getActiveQueryTab();
  if (!activeTab) {
    return;
  }
  await setEditorSql(activeTab.sql || '');
  els.queryResult.innerHTML = activeTab.resultHtml || '';
  updateHeader();
}

async function createQueryTab(initialSql) {
  const nextNumber = state.queryTabs.length + 1;
  const activeTab = getActiveQueryTab();
  const tab = {
    id: `query_${Date.now()}`,
    title: `\u67e5\u8be2 ${nextNumber}`,
    sql: initialSql || '',
    resultHtml: '',
    connectionId: activeTab ? activeTab.connectionId : '',
    database: activeTab ? activeTab.database : '',
    catalogs: activeTab ? (activeTab.catalogs || []).slice() : []
  };
  state.queryTabs.push(tab);
  state.activeQueryTabId = tab.id;
  renderQueryTabs();
  await syncEditorToActiveQueryTab();
}

async function switchQueryTab(tabId) {
  const current = getActiveQueryTab();
  if (current && state.editor) {
    current.sql = state.editor.getValue();
  }
  state.activeQueryTabId = tabId;
  renderQueryTabs();
  await syncEditorToActiveQueryTab();
}

async function closeQueryTab(tabId) {
  if (state.queryTabs.length === 1) {
    return;
  }
  const current = getActiveQueryTab();
  if (current && current.id === tabId && state.editor) {
    current.sql = state.editor.getValue();
  }
  const currentIndex = state.queryTabs.findIndex((tab) => tab.id === tabId);
  state.queryTabs = state.queryTabs.filter((tab) => tab.id !== tabId);
  if (state.activeQueryTabId === tabId) {
    const nextTab = state.queryTabs[Math.max(0, currentIndex - 1)] || state.queryTabs[0];
    state.activeQueryTabId = nextTab.id;
  }
  renderQueryTabs();
  await syncEditorToActiveQueryTab();
}

function syncQuerySelectors() {
  const activeTab = getActiveQueryTab();
  const connectionOptions = ['<option value="">\u9009\u62e9\u8fde\u63a5</option>']
    .concat(state.connections.map((connection) => `<option value="${escapeAttr(connection.id)}">${escapeHtml(connection.name)}</option>`));
  els.queryConnectionSelect.innerHTML = connectionOptions.join('');
  els.queryConnectionSelect.value = activeTab ? activeTab.connectionId || '' : '';

  const databaseOptions = ['<option value="">\u9009\u62e9\u6570\u636e\u5e93</option>']
    .concat((activeTab && activeTab.catalogs ? activeTab.catalogs : []).map((catalog) => `<option value="${escapeAttr(catalog.name)}">${escapeHtml(catalog.name)}</option>`));
  els.queryDatabaseSelect.innerHTML = databaseOptions.join('');
  els.queryDatabaseSelect.value = activeTab ? activeTab.database || '' : '';
  els.queryDatabaseSelect.disabled = !(activeTab && activeTab.connectionId);
}

function setConnectionTestResult(message, tone) {
  els.connectionTestResult.textContent = message;
  els.connectionTestResult.classList.remove('success', 'error');
  if (tone) {
    els.connectionTestResult.classList.add(tone);
  }
  openConnectionTestModal();
}

function clearConnectionTestResult() {
  els.connectionTestResult.textContent = '';
  els.connectionTestResult.classList.remove('success', 'error');
}

function initQueryResultResize() {
  let startY = 0;
  let startHeight = 0;
  let isResizing = false;

  function stopResize() {
    isResizing = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    if (state.editor) {
      state.editor.layout();
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stopResize);
    window.removeEventListener('blur', stopResize);
  }

  function onMouseMove(event) {
    if (!isResizing || event.buttons !== 1) {
      stopResize();
      return;
    }
    const nextHeight = Math.max(160, Math.min(520, startHeight + (startY - event.clientY)));
    els.queryResult.style.height = `${nextHeight}px`;
    if (state.editor) {
      state.editor.layout();
    }
  }

  els.queryResultResizeHandle.addEventListener('mousedown', (event) => {
    event.preventDefault();
    isResizing = true;
    startY = event.clientY;
    startHeight = els.queryResult.getBoundingClientRect().height;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopResize);
    window.addEventListener('blur', stopResize);
  });
}

function getColumnWidth(column) {
  return state.columnWidths[column] || 160;
}

function measureColumnWidths(columns, rows) {
  const minWidth = 120;
  const maxWidth = 420;
  const widths = {};
  columns.forEach((column) => {
    const headerLength = String(column || '').length;
    const sampleLength = rows.slice(0, 30).reduce((max, row) => {
      const value = row && row[column] != null ? String(row[column]) : '';
      return Math.max(max, value.length);
    }, 0);
    const estimated = Math.max(headerLength, sampleLength);
    widths[column] = Math.max(minWidth, Math.min(maxWidth, estimated * 8 + 36));
  });
  return widths;
}

function resolveColumnWidths(columns, rows) {
  const measuredWidths = measureColumnWidths(columns, rows);
  Object.keys(state.columnWidths).forEach((column) => {
    if (!columns.includes(column)) {
      delete state.columnWidths[column];
    }
  });
  Object.keys(state.manualColumnWidths).forEach((column) => {
    if (!columns.includes(column)) {
      delete state.manualColumnWidths[column];
    }
  });
  const widths = {};
  columns.forEach((column) => {
    widths[column] = state.manualColumnWidths[column] ? getColumnWidth(column) : measuredWidths[column];
  });

  columns.forEach((column) => {
    state.columnWidths[column] = widths[column];
  });
}

function renderHeaderCells(columns) {
  return columns.map((column) => `
    <th class="grid-header-cell" data-column="${escapeAttr(column)}">
      <span class="grid-header-label">${escapeHtml(column)}</span>
      <span class="column-resize-handle" data-role="column-resize" data-column="${escapeAttr(column)}"></span>
    </th>
  `).join('');
}

function syncColumnWidths(tableElement) {
  if (!tableElement) {
    return;
  }
  const columns = Array.from(tableElement.querySelectorAll('th[data-column]')).map((header) => header.dataset.column);
  const widths = {};
  columns.forEach((column) => {
    widths[column] = getColumnWidth(column);
  });

  const containerWidth = Math.max(0, els.dataTableWrap.clientWidth - 4);
  const baseTotalWidth = columns.reduce((sum, column) => sum + widths[column], 0);
  if (containerWidth > baseTotalWidth && columns.length) {
    const adjustableColumns = columns.filter((column) => !state.manualColumnWidths[column]);
    const growColumns = adjustableColumns.length ? adjustableColumns : columns;
    const extraWidth = Math.floor((containerWidth - baseTotalWidth) / growColumns.length);
    if (extraWidth > 0) {
      growColumns.forEach((column) => {
        widths[column] += extraWidth;
      });
    }
    const remainder = containerWidth - columns.reduce((sum, column) => sum + widths[column], 0);
    if (remainder > 0) {
      widths[growColumns[growColumns.length - 1]] += remainder;
    }
  }

  let totalWidth = 0;
  columns.forEach((column, index) => {
    const width = widths[column];
    totalWidth += width;
    const col = tableElement.querySelector(`col[data-column="${column}"]`);
    if (col) {
      col.style.width = `${width}px`;
      col.style.minWidth = `${width}px`;
      col.style.maxWidth = `${width}px`;
    }
    tableElement.querySelectorAll(`th:nth-child(${index + 1}), td:nth-child(${index + 1})`).forEach((cell) => {
      cell.style.width = `${width}px`;
      cell.style.minWidth = `${width}px`;
      cell.style.maxWidth = `${width}px`;
    });
  });
  tableElement.style.width = `${totalWidth}px`;
  tableElement.style.minWidth = `${totalWidth}px`;
}

function syncActiveDataTableLayout() {
  syncColumnWidths(els.dataTableWrap.querySelector('table'));
}

function initDataTableAutoResize() {
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      syncActiveDataTableLayout();
    });
    observer.observe(els.dataTableWrap);
  }
  window.addEventListener('resize', syncActiveDataTableLayout);
}

function initColumnResize() {
  let activeHandle = null;
  let activeColumn = '';
  let startX = 0;
  let startWidth = 0;

  function stopResize() {
    if (activeHandle) {
      activeHandle.classList.remove('is-resizing');
    }
    activeHandle = null;
    activeColumn = '';
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stopResize);
  }

  function onMouseMove(event) {
    if (!activeHandle || event.buttons !== 1) {
      stopResize();
      return;
    }
    const width = Math.max(80, startWidth + (event.clientX - startX));
    state.columnWidths[activeColumn] = width;
    state.manualColumnWidths[activeColumn] = true;
    syncColumnWidths(els.dataTableWrap.querySelector('table'));
  }

  els.dataTableWrap.addEventListener('mousedown', (event) => {
    const handle = event.target.closest('[data-role="column-resize"]');
    if (!handle) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    activeHandle = handle;
    activeColumn = handle.dataset.column;
    startX = event.clientX;
    startWidth = getColumnWidth(activeColumn);
    activeHandle.classList.add('is-resizing');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopResize);
  });
}

function flashButtonSuccess(button, text) {
  const originalText = button.textContent;
  button.textContent = text;
  button.classList.add('success-btn');
  window.clearTimeout(button._successTimer);
  button._successTimer = window.setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('success-btn');
  }, 1200);
}

function loadMonaco() {
  if (state.editorReady) {
    return state.editorReady;
  }

  state.editorReady = new Promise((resolve, reject) => {
    if (!window.require) {
      reject(new Error('Monaco loader is not available'));
      return;
    }
    window.MonacoEnvironment = {
      getWorkerUrl() {
        const workerUrl = `${window.location.origin}/monaco/base/worker/workerMain.js`;
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`self.MonacoEnvironment = { baseUrl: '${window.location.origin}/monaco/' }; importScripts('${workerUrl}');`)}`;
      }
    };
    window.require.config({ paths: { vs: '/monaco' } });
    window.require(['vs/editor/editor.main'], () => {
      window.monaco.editor.defineTheme('db-console-sql', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.foreground': '#18324a',
          'editor.background': '#ffffff',
          'editorSuggestWidget.background': '#ffffff',
          'editorSuggestWidget.border': '#d7e1ec',
          'editorSuggestWidget.foreground': '#18324a',
          'editorSuggestWidget.selectedBackground': '#edf8f7',
          'editorSuggestWidget.selectedForeground': '#0f8a83',
          'editorSuggestWidget.highlightForeground': '#127e75',
          'editorSuggestWidget.focusHighlightForeground': '#127e75'
        }
      });

      state.editor = window.monaco.editor.create(els.sqlEditor, {
        value: getActiveQueryTab().sql,
        language: 'sql',
        theme: 'db-console-sql',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineHeight: 22,
        padding: { top: 14, bottom: 14 },
        roundedSelection: true,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        suggest: {
          showWords: false,
          showSnippets: false,
          preview: false,
          showIcons: true,
          showStatusBar: false
        },
        quickSuggestions: {
          other: false,
          comments: false,
          strings: false
        },
        suggestOnTriggerCharacters: false,
        parameterHints: {
          enabled: false
        }
      });

      state.editor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter, () => {
        handleAction(runCurrentQuery);
      });

      state.editor.onDidChangeModelContent(() => {
        const activeTab = getActiveQueryTab();
        if (activeTab) {
          activeTab.sql = state.editor.getValue();
        }
        updateSqlSuggestions();
      });

      state.editor.onDidChangeCursorPosition(() => {
        if (state.sqlSuggestions.length) {
          updateSqlSuggestions();
        }
      });

      state.editor.onDidScrollChange(() => {
        positionSqlSuggestPanel();
      });

      state.editor.onDidBlurEditorText(() => {
        window.setTimeout(hideSqlSuggestPanel, 120);
      });

      state.editor.onDidFocusEditorText(() => {
        updateSqlSuggestions();
      });

      state.editor.onKeyDown((event) => {
        if (!state.sqlSuggestions.length || !els.sqlSuggestPanel || els.sqlSuggestPanel.classList.contains('hidden')) {
          return;
        }
        if (event.keyCode === window.monaco.KeyCode.DownArrow) {
          state.activeSqlSuggestionIndex = Math.min(state.activeSqlSuggestionIndex + 1, state.sqlSuggestions.length - 1);
          renderSqlSuggestPanel();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.keyCode === window.monaco.KeyCode.UpArrow) {
          state.activeSqlSuggestionIndex = Math.max(state.activeSqlSuggestionIndex - 1, 0);
          renderSqlSuggestPanel();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.keyCode === window.monaco.KeyCode.Enter || event.keyCode === window.monaco.KeyCode.Tab) {
          applySqlSuggestion(state.activeSqlSuggestionIndex);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.keyCode === window.monaco.KeyCode.Escape) {
          hideSqlSuggestPanel();
          event.preventDefault();
          event.stopPropagation();
        }
      });

      resolve(state.editor);
    }, reject);
  });

  return state.editorReady;
}

async function ensureEditor() {
  if (state.editor) {
    return state.editor;
  }
  return loadMonaco();
}

async function getEditorSql() {
  const editor = await ensureEditor();
  return editor.getValue();
}

async function setEditorSql(value) {
  const editor = await ensureEditor();
  editor.setValue(value);
}

function updateEditorDialect() {
  const active = getActiveConnection();
  const label = active
    ? active.type === 'mysql'
      ? 'MySQL'
      : active.type === 'postgres'
        ? 'PostgreSQL'
        : active.type === 'selectdb'
          ? 'SelectDB'
        : active.type === 'mongodb'
          ? 'MongoDB'
        : 'SQL'
    : 'SQL';
  els.editorDialectBadge.textContent = label;
}

function getDefaultPortByType(type) {
  if (type === 'postgres') {
    return '5432';
  }
  if (type === 'mongodb') {
    return '27017';
  }
  if (type === 'selectdb') {
    return '9030';
  }
  return '3306';
}

function quoteIdentifier(identifier, type) {
  return type === 'postgres'
    ? `"${String(identifier).replace(/"/g, '""')}"`
    : `\`${String(identifier).replace(/`/g, '``')}\``;
}

function escapeSqlValue(value, type) {
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return type === 'postgres' ? (value ? 'TRUE' : 'FALSE') : (value ? '1' : '0');
  }
  const text = String(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function getQualifiedTableName() {
  const connection = getActiveConnection();
  if (!connection || !state.activeTable) {
    return '';
  }
  if (connection.type === 'postgres' && state.activeTable.schema) {
    return `${quoteIdentifier(state.activeTable.schema, connection.type)}.${quoteIdentifier(state.activeTable.table, connection.type)}`;
  }
  return quoteIdentifier(state.activeTable.table, connection.type);
}

function buildInsertSqlForRow(row) {
  const connection = getActiveConnection();
  if (!connection || !state.activeTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const columns = Object.keys(row);
  const quotedColumns = columns.map((column) => quoteIdentifier(column, connection.type));
  const values = columns.map((column) => escapeSqlValue(row[column], connection.type));
  return `INSERT INTO ${getQualifiedTableName()} (\n  ${quotedColumns.join(',\n  ')}\n)\nVALUES (\n  ${values.join(',\n  ')}\n);`;
}

function hideContextMenu() {
  els.rowContextMenu.classList.add('hidden');
}

function showContextMenu(x, y, rowIndex) {
  state.contextRowIndex = rowIndex;
  positionContextMenu(els.rowContextMenu, x, y);
}

function hideQueryCellContextMenu() {
  els.queryCellContextMenu.classList.add('hidden');
  state.contextQueryCellValue = '';
}

function showQueryCellContextMenu(x, y, cellValue) {
  state.contextQueryCellValue = cellValue == null ? '' : String(cellValue);
  positionContextMenu(els.queryCellContextMenu, x, y);
}

function closeSqlPreview() {
  state.currentInsertSql = '';
  if (els.sqlPreviewModal) {
    els.sqlPreviewModal.classList.add('hidden');
  }
}

function openSqlPreview(sql) {
  state.currentInsertSql = sql;
  els.insertSqlPreview.textContent = sql;
  if (els.sqlPreviewModal) {
    els.sqlPreviewModal.classList.remove('hidden');
  }
}

function formatSql(sql) {
  const keywords = [
    'select', 'from', 'where', 'order by', 'group by', 'having', 'limit', 'offset',
    'insert into', 'values', 'update', 'set', 'delete from', 'join', 'left join',
    'right join', 'inner join', 'outer join', 'on', 'and', 'or', 'union', 'as'
  ];

  let formatted = String(sql || '').trim().replace(/\s+/g, ' ');
  keywords.forEach((keyword) => {
    const pattern = new RegExp(`\\b${keyword.replace(/ /g, '\\s+')}\\b`, 'gi');
    formatted = formatted.replace(pattern, function (match) {
      const upper = match.toUpperCase();
      return ['AND', 'OR', 'ON', 'AS'].indexOf(upper) !== -1 ? ` ${upper} ` : `\n${upper} `;
    });
  });

  return formatted
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .trim();
}

function getSqlSuggestionItems() {
  const keywordItems = SQL_COMPLETION_KEYWORDS.map((keyword) => ({
    label: keyword,
    kind: 'keyword',
    insertText: keyword
  }));
  const tableItems = state.catalogs.flatMap((catalog) => {
    if (catalog.schemas) {
      return catalog.schemas.flatMap((schema) => (schema.groups.tables || []).map((item) => ({
        label: item.name,
        kind: 'table',
        insertText: item.name
      })));
    }
    return (catalog.groups.tables || []).map((item) => ({
      label: item.name,
      kind: 'table',
      insertText: item.name
    }));
  });
  const columnItems = state.activeColumns.map((column) => ({
    label: column.columnName,
    kind: 'column',
    insertText: column.columnName
  }));
  return keywordItems.concat(tableItems, columnItems);
}

function getSqlSuggestionKeyword() {
  if (!state.editor) {
    return '';
  }
  const position = state.editor.getPosition();
  if (!position) {
    return '';
  }
  const model = state.editor.getModel();
  const word = model.getWordUntilPosition(position);
  return (word.word || '').trim();
}

function hideSqlSuggestPanel() {
  state.sqlSuggestions = [];
  state.activeSqlSuggestionIndex = 0;
  if (els.sqlSuggestPanel) {
    els.sqlSuggestPanel.classList.add('hidden');
    els.sqlSuggestPanel.innerHTML = '';
  }
}

function positionSqlSuggestPanel() {
  if (!state.editor || !els.sqlSuggestPanel || els.sqlSuggestPanel.classList.contains('hidden')) {
    return;
  }
  const position = state.editor.getPosition();
  if (!position) {
    return;
  }
  const coords = state.editor.getScrolledVisiblePosition(position);
  if (!coords) {
    return;
  }
  const editorDomNode = state.editor.getDomNode();
  const panelWidth = els.sqlSuggestPanel.offsetWidth || 320;
  const panelHeight = els.sqlSuggestPanel.offsetHeight || 180;
  const left = Math.max(14, Math.min(coords.left + 8, Math.max(14, editorDomNode.clientWidth - panelWidth - 14)));
  const topCandidate = coords.top + coords.height + 8;
  const top = topCandidate + panelHeight <= editorDomNode.clientHeight - 12
    ? topCandidate
    : Math.max(12, coords.top - panelHeight - 8);
  els.sqlSuggestPanel.style.left = `${left}px`;
  els.sqlSuggestPanel.style.top = `${top}px`;
}

function renderSqlSuggestPanel() {
  if (!els.sqlSuggestPanel) {
    return;
  }
  if (!state.sqlSuggestions.length) {
    hideSqlSuggestPanel();
    return;
  }
  els.sqlSuggestPanel.innerHTML = state.sqlSuggestions.map((item, index) => `
    <button type="button" class="sql-suggest-item ${index === state.activeSqlSuggestionIndex ? 'active' : ''}" data-index="${index}">
      <span class="sql-suggest-content">
        ${item.kind === 'table'
          ? '<span class="sql-suggest-icon sql-suggest-icon-table" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M3.5 4.5h9v7h-9Z"></path><path d="M3.5 7.9h9"></path><path d="M8 4.5v7"></path></svg></span>'
          : item.kind === 'column'
            ? '<span class="sql-suggest-icon sql-suggest-icon-column" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M4.5 2.5h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"></path><path d="M6 5.5h4"></path><path d="M6 8h4"></path><path d="M6 10.5h3"></path></svg></span>'
            : ''}
        <span class="sql-suggest-main">${escapeHtml(item.label)}</span>
      </span>
    </button>
  `).join('');
  els.sqlSuggestPanel.classList.remove('hidden');
  positionSqlSuggestPanel();
}

function updateSqlSuggestions() {
  const keyword = getSqlSuggestionKeyword().toLowerCase();
  if (!keyword || !/^[a-z_][a-z0-9_]*$/i.test(keyword)) {
    hideSqlSuggestPanel();
    return;
  }
  const items = getSqlSuggestionItems().filter((item) => {
    return item.label.toLowerCase().startsWith(keyword);
  }).slice(0, 10);
  if (!items.length) {
    hideSqlSuggestPanel();
    return;
  }
  state.sqlSuggestions = items;
  state.activeSqlSuggestionIndex = 0;
  renderSqlSuggestPanel();
}

function applySqlSuggestion(index) {
  const item = state.sqlSuggestions[index];
  if (!item || !state.editor) {
    return;
  }
  const position = state.editor.getPosition();
  const model = state.editor.getModel();
  const word = model.getWordUntilPosition(position);
  state.editor.executeEdits('sql-suggest', [{
    range: new window.monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
    text: item.insertText
  }]);
  state.editor.focus();
  hideSqlSuggestPanel();
}

function stripSqlForSafetyCheck(sql) {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/#[^\r\n]*/g, ' ')
    .replace(/'([^']|'')*'/g, "''")
    .replace(/"([^"]|"")*"/g, '""')
    .replace(/`([^`]|``)*`/g, '``');
}

function analyzeDangerousSql(sql) {
  const normalized = stripSqlForSafetyCheck(sql)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return [];
  }
  const warnings = [];
  normalized.split(';').map((item) => item.trim()).filter(Boolean).forEach((statement) => {
    if (/^(drop|truncate)\b/.test(statement)) {
      warnings.push('包含 DROP/TRUNCATE，会删除对象或清空数据');
    } else if (/^alter\b/.test(statement)) {
      warnings.push('包含 ALTER，会修改表结构');
    } else if (/^delete\b/.test(statement) && !/\bwhere\b/.test(statement)) {
      warnings.push('DELETE 语句没有 WHERE 条件，可能删除整表数据');
    } else if (/^update\b/.test(statement) && !/\bwhere\b/.test(statement)) {
      warnings.push('UPDATE 语句没有 WHERE 条件，可能更新整表数据');
    }
  });
  return Array.from(new Set(warnings));
}

function confirmDangerousSql(warnings) {
  if (!warnings.length) {
    return true;
  }
  return window.confirm(`检测到危险 SQL：\n\n${warnings.map((item) => `- ${item}`).join('\n')}\n\n确认继续执行吗？`);
}

function readSqlHistory() {
  try {
    const items = JSON.parse(window.localStorage.getItem(SQL_HISTORY_KEY) || '[]');
    return Array.isArray(items) ? items : [];
  } catch (error) {
    return [];
  }
}

function writeSqlHistory(items) {
  window.localStorage.setItem(SQL_HISTORY_KEY, JSON.stringify(items.slice(0, SQL_HISTORY_LIMIT)));
}

function getSqlHistoryTitle(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim().slice(0, 96) || 'SQL';
}

function saveSqlHistory(sql, context) {
  const normalizedSql = String(sql || '').trim();
  if (!normalizedSql) {
    return;
  }
  const now = new Date().toISOString();
  const items = readSqlHistory();
  const deduped = items.filter((item) => item.sql !== normalizedSql);
  deduped.unshift({
    id: `history_${Date.now()}`,
    sql: normalizedSql,
    title: getSqlHistoryTitle(normalizedSql),
    connectionName: context && context.connectionName ? context.connectionName : '',
    database: context && context.database ? context.database : '',
    executedAt: now
  });
  writeSqlHistory(deduped);
}

function formatHistoryTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString();
}

function renderSqlHistory() {
  if (!els.sqlHistoryList) {
    return;
  }
  const items = readSqlHistory();
  if (!items.length) {
    els.sqlHistoryList.innerHTML = '<div class="empty-state">暂无 SQL 历史。</div>';
    return;
  }
  els.sqlHistoryList.innerHTML = items.map((item) => `
    <article class="sql-history-item">
      <button type="button" class="sql-history-main" data-history-id="${escapeAttr(item.id)}">
        <span class="sql-history-title">${escapeHtml(item.title || getSqlHistoryTitle(item.sql))}</span>
        <span class="sql-history-meta">${escapeHtml([item.connectionName, item.database, formatHistoryTime(item.executedAt)].filter(Boolean).join(' · '))}</span>
      </button>
      <button type="button" class="sql-history-delete" data-history-delete="${escapeAttr(item.id)}" title="删除">×</button>
    </article>
  `).join('');
}

function openSqlHistoryModal() {
  state.sqlHistoryVisible = true;
  state.sqlHistoryCollapsed = false;
  state.tableInspectorVisible = false;
  renderSqlHistory();
  if (els.sqlHistoryModal) {
    els.sqlHistoryModal.setAttribute('aria-hidden', 'false');
  }
  renderTableInspector();
  renderSqlHistoryPanel();
}

function closeSqlHistoryModal() {
  state.sqlHistoryVisible = false;
  state.sqlHistoryCollapsed = false;
  renderSqlHistoryPanel();
}

function renderSqlHistoryPanel() {
  if (!els.sqlHistoryModal) {
    return;
  }
  els.sqlHistoryModal.setAttribute('aria-hidden', state.sqlHistoryVisible ? 'false' : 'true');
  els.sqlHistoryModal.classList.toggle('visible', state.sqlHistoryVisible);
  els.sqlHistoryModal.classList.toggle('collapsed', false);
  els.tabPanels.data.parentElement.classList.toggle('has-history', state.sqlHistoryVisible);
  if (els.closeSqlHistoryBtn) {
    els.closeSqlHistoryBtn.textContent = '×';
    els.closeSqlHistoryBtn.title = '关闭 SQL 历史';
    els.closeSqlHistoryBtn.setAttribute('aria-label', '关闭 SQL 历史');
  }
  requestAnimationFrame(() => {
    if (state.editor) {
      state.editor.layout();
    }
    syncActiveDataTableLayout();
  });
}

async function applySqlHistoryItem(id) {
  const item = readSqlHistory().find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  await setEditorSql(item.sql);
  const activeTab = getActiveQueryTab();
  if (activeTab) {
    activeTab.sql = item.sql;
  }
  closeSqlHistoryModal();
  switchTab('query');
}

function deleteSqlHistoryItem(id) {
  writeSqlHistory(readSqlHistory().filter((item) => item.id !== id));
  renderSqlHistory();
}

function clearSqlHistory() {
  if (!window.confirm('确认清空全部 SQL 历史吗？')) {
    return;
  }
  writeSqlHistory([]);
  renderSqlHistory();
}

async function api(url, options) {
  const response = await fetch(url, {
    headers: options && options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (error) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function setStatus(message, isError) {
  els.statusBar.textContent = message;
  els.statusBar.style.color = isError ? 'var(--danger)' : 'var(--muted)';
}

function getActiveConnection() {
  const activeTab = getActiveQueryTab();
  const queryConnectionId = activeTab && activeTab.connectionId ? activeTab.connectionId : null;
  return state.connections.find((item) => item.id === (queryConnectionId || state.activeConnectionId)) || null;
}

function getPrimaryKey() {
  const keyColumn = state.activeColumns.find((column) => column.columnKey === 'PRI');
  if (keyColumn) {
    return keyColumn.columnName;
  }
  return state.activeColumns[0] ? state.activeColumns[0].columnName : null;
}

function getTableLimit() {
  const value = Number(els.tableLimitInput.value);
  if (!Number.isFinite(value) || value < 1) {
    return 1000;
  }
  return Math.min(Math.floor(value), 5000);
}

function getTablePageCount() {
  if (!state.tablePageSize || state.tablePageSize < 1) {
    return 1;
  }
  return Math.max(Math.ceil(state.tableTotal / state.tablePageSize), 1);
}

function getFilterState() {
  const operator = els.filterOperatorSelect.value || 'contains';
  return {
    column: els.filterColumnSelect.value || '',
    operator,
    value: els.filterValueInput.value || ''
  };
}

function shouldUseFilter(filter) {
  if (!filter.column) {
    return false;
  }
  return filter.operator === 'isNull' || filter.operator === 'isNotNull' || filter.value.trim() !== '';
}

function buildTableSql(schema, table) {
  const qualifiedTable = `${schema ? `${schema}.` : ''}${table}`;
  const filter = state.activeFilter;
  const clauses = [];
  if (shouldUseFilter(filter)) {
    const column = filter.column;
    if (filter.operator === 'contains') {
      clauses.push(`${column} LIKE ${escapeSqlValue(`%${filter.value}%`)}`);
    } else if (filter.operator === 'equals') {
      clauses.push(`${column} = ${escapeSqlValue(filter.value)}`);
    } else if (filter.operator === 'startsWith') {
      clauses.push(`${column} LIKE ${escapeSqlValue(`${filter.value}%`)}`);
    } else if (filter.operator === 'endsWith') {
      clauses.push(`${column} LIKE ${escapeSqlValue(`%${filter.value}`)}`);
    } else if (filter.operator === 'isNull') {
      clauses.push(`${column} IS NULL`);
    } else if (filter.operator === 'isNotNull') {
      clauses.push(`${column} IS NOT NULL`);
    }
  }
  const whereClause = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const offset = Math.max((state.tablePage - 1) * state.tablePageSize, 0);
  return `SELECT * FROM ${qualifiedTable}${whereClause} LIMIT ${state.tablePageSize} OFFSET ${offset};`;
}

function syncFilterControls() {
  els.filterOperatorSelect.value = state.activeFilter.operator || 'contains';
  els.filterValueInput.value = state.activeFilter.value || '';
}

function renderFilterColumns() {
  const current = state.activeFilter.column || '';
  const options = ['<option value=""></option>']
    .concat(state.activeColumns.map((column) => `<option value="${escapeAttr(column.columnName)}">${escapeHtml(column.columnName)}</option>`));
  els.filterColumnSelect.innerHTML = options.join('');
  els.filterColumnSelect.value = current;
}

function updateFilterValueState() {
  const operator = els.filterOperatorSelect.value || 'contains';
  const isValueDisabled = operator === 'isNull' || operator === 'isNotNull';
  els.filterValueInput.disabled = isValueDisabled;
}

function beginRowEdit(rowIndex) {
  const row = state.activeRows[rowIndex];
  if (!row) {
    return;
  }
  state.editingRowIndex = rowIndex;
  state.editingValues = JSON.parse(JSON.stringify(row));
  renderDataTable();
}

function cancelRowEdit() {
  state.editingRowIndex = null;
  state.editingValues = null;
  renderDataTable();
}

function getTreeDefaultExpanded(nodeKey) {
  return false;
}

function switchTab(name) {
  Object.keys(els.tabPanels).forEach((key) => {
    els.tabPanels[key].classList.toggle('active', key === name);
  });
  renderQueryTabs();
  renderTableInspector();
}

function renderConnections() {
  if (!state.connections.length) {
    els.connectionList.innerHTML = '<div class="empty-state">\u8fd8\u6ca1\u6709\u8fde\u63a5\uff0c\u5148\u521b\u5efa\u4e00\u4e2a\u3002</div>';
    return;
  }

  els.connectionList.innerHTML = state.connections.map((connection) => `
    <button type="button" data-action="select" data-id="${connection.id}" class="connection-item ${connection.id === state.activeConnectionId ? 'active' : ''}">
      <h3>${escapeHtml(connection.name)}</h3>
      <div class="meta">${escapeHtml(connection.type)}  ${escapeHtml(connection.host)}:${escapeHtml(String(connection.port || ''))}  ${escapeHtml(connection.database)}</div>
    </button>
  `).join('');
}

function renderSchema() {
  if (!state.activeConnectionId) {
    els.schemaTree.innerHTML = '<div class="empty-state">\u9009\u62e9\u8fde\u63a5\u540e\u663e\u793a\u8868\u7ed3\u6784\u3002</div>';
    return;
  }
  if (!state.catalogs.length) {
    els.schemaTree.innerHTML = '<div class="empty-state">选择连接后显示表结构。</div>';
    return;
  }

  const keyword = state.schemaSearchTerm.trim().toLowerCase();
  const objectGroupLabels = {
    tables: '表',
    views: '视图',
    functions: '函数',
    procedures: '存储过程'
  };

  function isExpanded(key, defaultValue) {
    return state.treeState[key] === undefined ? defaultValue : state.treeState[key];
  }

  function filterGroups(groups, matchedParent) {
    const nextGroups = {};
    Object.keys(objectGroupLabels).forEach((key) => {
      const items = groups[key] || [];
      nextGroups[key] = matchedParent
        ? items
        : items.filter((item) => item.name.toLowerCase().indexOf(keyword) !== -1);
    });
    return nextGroups;
  }

  const filteredCatalogs = state.catalogs.map((catalog) => {
    const catalogMatched = !keyword || catalog.name.toLowerCase().indexOf(keyword) !== -1;
    if (catalog.schemas) {
      const schemas = catalog.schemas.map((schema) => {
        const schemaMatched = catalogMatched || schema.name.toLowerCase().indexOf(keyword) !== -1;
        const groups = filterGroups(schema.groups, schemaMatched);
        const hasItems = Object.keys(objectGroupLabels).some((key) => groups[key].length > 0);
        if (!keyword || hasItems) {
          return { name: schema.name, groups };
        }
        return null;
      }).filter(Boolean);
      return !keyword || catalogMatched || schemas.length
        ? { name: catalog.name, schemas }
        : null;
    }

    const groups = filterGroups(catalog.groups, catalogMatched);
    const hasItems = Object.keys(objectGroupLabels).some((key) => groups[key].length > 0);
    return !keyword || catalogMatched || hasItems
      ? { name: catalog.name, groups }
      : null;
  }).filter(Boolean);

  if (!filteredCatalogs.length) {
    els.schemaTree.innerHTML = `<div class="empty-state">没有匹配 "${escapeHtml(state.schemaSearchTerm)}" 的对象。</div>`;
    return;
  }

  function renderGroup(groupKey, items, databaseName, schemaName) {
    if (!items.length) {
      return '';
    }
    const isOpenable = groupKey === 'tables' || groupKey === 'views';
    const groupNodeKey = `group:${databaseName}:${schemaName || ''}:${groupKey}`;
    const expanded = isExpanded(groupNodeKey, keyword ? true : getTreeDefaultExpanded(groupNodeKey));
    return `
      <div class="tree-node object-group ${expanded ? 'expanded' : ''}">
        <button type="button" class="tree-toggle" data-action="toggle-tree" data-node-key="${escapeAttr(groupNodeKey)}" data-group-key="${escapeAttr(groupKey)}" data-database="${escapeAttr(databaseName || '')}" data-schema="${escapeAttr(schemaName || '')}">
          <span class="tree-caret" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
          <span class="object-group-title">${objectGroupLabels[groupKey]}</span>
        </button>
        <div class="tree-children ${expanded ? '' : 'hidden'}">
          ${items.map((item) => {
          const isActive = state.activeTable
            && state.activeTable.table === item.name
            && state.activeTable.schema === (schemaName || '')
            && state.activeTable.database === (databaseName || '');
          const renameKey = `${databaseName || ''}:${schemaName || ''}:${item.name}`;
          const isRenaming = state.renamingTableKey === renameKey;
          const itemLabel = escapeHtml(item.name);
          return `
            ${isOpenable
              ? `
                ${isRenaming
                  ? `
                    <input
                      class="tree-rename-input"
                      data-role="rename-table-input"
                      data-database="${escapeAttr(databaseName || '')}"
                      data-schema="${escapeAttr(schemaName || '')}"
                      data-table="${escapeAttr(item.name)}"
                      value="${escapeAttr(item.name)}"
                    >
                  `
                  : `
                    <button
                      type="button"
                      class="tree-leaf ${isActive ? 'active' : ''}"
                      data-action="open-table"
                      data-database="${escapeAttr(databaseName || '')}"
                      data-schema="${escapeAttr(schemaName || '')}"
                      data-table="${escapeAttr(item.name)}"
                      data-object-type="${escapeAttr(groupKey)}"
                    >${itemLabel}</button>
                  `}
              `
              : `
                <div class="tree-leaf tree-leaf-static">${itemLabel}</div>
              `}
          `;
          }).join('')}
        </div>
      </div>
    `;
  }

  els.schemaTree.innerHTML = filteredCatalogs.map((catalog) => `
    <div class="schema-item tree-node ${isExpanded(`catalog:${catalog.name}`, keyword ? true : getTreeDefaultExpanded(`catalog:${catalog.name}`)) ? 'expanded' : ''}">
      <button type="button" class="tree-toggle tree-title" data-action="toggle-tree" data-database="${escapeAttr(catalog.name)}" data-node-key="${escapeAttr(`catalog:${catalog.name}`)}">
        <span class="tree-caret" aria-hidden="true">${isExpanded(`catalog:${catalog.name}`, keyword ? true : getTreeDefaultExpanded(`catalog:${catalog.name}`)) ? '▾' : '▸'}</span>
        <span>${escapeHtml(catalog.name)}</span>
      </button>
      <div class="tree-children ${isExpanded(`catalog:${catalog.name}`, keyword ? true : getTreeDefaultExpanded(`catalog:${catalog.name}`)) ? '' : 'hidden'}">
        ${catalog.schemas
          ? catalog.schemas.map((schema) => {
              const schemaNodeKey = `schema:${catalog.name}:${schema.name}`;
              const expanded = isExpanded(schemaNodeKey, keyword ? true : getTreeDefaultExpanded(schemaNodeKey));
              return `
                <div class="schema-section tree-node ${expanded ? 'expanded' : ''}">
                  <button type="button" class="tree-toggle tree-subtitle" data-action="toggle-tree" data-node-key="${escapeAttr(schemaNodeKey)}">
                    <span class="tree-caret" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
                    <span>${escapeHtml(schema.name)}</span>
                  </button>
                  <div class="tree-children ${expanded ? '' : 'hidden'}">
                    ${Object.keys(objectGroupLabels).map((key) => renderGroup(key, schema.groups[key], catalog.name, schema.name)).join('')}
                  </div>
                </div>
              `;
            }).join('')
          : Object.keys(objectGroupLabels).map((key) => renderGroup(key, catalog.groups[key], catalog.name, '')).join('')}
      </div>
    </div>
  `).join('');
}

function renderColumns() {
  if (!state.activeColumns.length) {
    els.columnList.innerHTML = '<div class="empty-state">\u9009\u62e9\u8868\u540e\u67e5\u770b\u5b57\u6bb5\u3002</div>';
    els.structureToolbar.classList.add('hidden');
    if (els.designTableColumnList) {
      els.designTableColumnList.innerHTML = '<div class="empty-state">\u9009\u62e9\u8868\u540e\u67e5\u770b\u5b57\u6bb5\u3002</div>';
    }
    if (els.designTableToolbar) {
      els.designTableToolbar.classList.add('hidden');
    }
    renderFilterColumns();
    renderTableInspector();
    return;
  }

  els.structureToolbar.classList.remove('hidden');
  if (els.designTableToolbar) {
    els.designTableToolbar.classList.remove('hidden');
  }
  renderFilterColumns();
  const tableHtml = `
    <table class="schema-column-table">
      <thead>
        <tr>
          <th>\u5b57\u6bb5\u540d</th>
          <th>\u7c7b\u578b</th>
          <th>\u5141\u8bb8\u4e3a\u7a7a</th>
          <th>\u9ed8\u8ba4\u503c</th>
          <th>\u952e</th>
          <th>\u64cd\u4f5c</th>
        </tr>
      </thead>
      <tbody>
        ${state.activeColumns.map((column) => `
          <tr class="${state.activeInspectorColumn === column.columnName ? 'active-column-row' : ''}" data-role="column-row" data-column-name="${escapeAttr(column.columnName)}">
            <td>${escapeHtml(column.columnName || '')}</td>
            <td>${escapeHtml(column.columnType || '')}</td>
            <td><span class="column-flag ${column.isNullable === 'NO' ? 'column-flag-required' : ''}">${escapeHtml(column.isNullable || '')}</span></td>
            <td>${column.columnDefault == null ? '' : escapeHtml(String(column.columnDefault))}</td>
            <td>${column.columnKey ? `<span class="column-key-badge">${escapeHtml(column.columnKey)}</span>` : ''}</td>
            <td><button type="button" class="text-action-btn" data-action="edit-column" data-column-name="${escapeAttr(column.columnName)}">\u7f16\u8f91</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  els.columnList.innerHTML = tableHtml;
  if (els.designTableColumnList) {
    els.designTableColumnList.innerHTML = `
      <div class="design-table-summary">
        <span>${state.activeColumns.length} 个字段</span>
        <span>${state.activeColumns.filter((column) => column.columnKey).length} 个键</span>
      </div>
      ${tableHtml}
    `;
  }
  renderTableInspector();
}

function formatInspectorValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return escapeHtml(String(value));
}

function renderSqlWithHighlight(sql) {
  const formatted = escapeHtml(formatSql(sql));
  const keywords = [
    'CREATE', 'TABLE', 'VIEW', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'CONSTRAINT',
    'NOT NULL', 'NULL', 'DEFAULT', 'AUTO_INCREMENT', 'UNIQUE', 'INDEX', 'KEY', 'ON',
    'USING', 'ENGINE', 'CHARSET', 'COLLATE', 'COMMENT', 'ALTER', 'ADD', 'DROP'
  ];
  return keywords.reduce((html, keyword) => {
    const pattern = new RegExp(`(^|[^A-Z_])(${keyword.replace(/ /g, '\\s+')})(?=[^A-Z_]|$)`, 'gm');
    return html.replace(pattern, '$1<span class="sql-keyword">$2</span>');
  }, formatted);
}

function getSelectedInspectorColumn() {
  if (!state.activeColumns.length) {
    return null;
  }
  return state.activeColumns.find((column) => column.columnName === state.activeInspectorColumn) || state.activeColumns[0];
}

function showInspectorColumn(columnName) {
  if (!columnName) {
    return;
  }
  state.activeInspectorColumn = columnName;
  state.activeInspectorTab = 'column';
  state.tableInspectorVisible = true;
  state.tableInspectorCollapsed = false;
  state.sqlHistoryVisible = false;
  state.sqlHistoryCollapsed = false;
}

function renderInspectorInfoTab() {
  const info = state.tableDetails && state.tableDetails.info;
  const fields = [
    ['存储引擎', info && info.engine],
    ['创建时间', info && info.createTime],
    ['排序规则', info && info.collation],
    ['自增值', info && info.autoIncrement],
    ['索引长度', info && info.indexLength],
    ['数据长度', info && info.dataLength]
  ];
  return `
    <section class="inspector-section">
      <dl class="inspector-kv">
        ${fields.map(([label, value]) => `<dt>${label}</dt><dd>${formatInspectorValue(value)}</dd>`).join('')}
      </dl>
    </section>
  `;
}

function renderInspectorDdlTab() {
  const ddl = state.tableDetails && state.tableDetails.ddl;
  if (!ddl) {
    return '<div class="inspector-empty"> DDL </div>';
  }
  return `<pre class="inspector-code sql-highlight">${renderSqlWithHighlight(ddl)}</pre>`;
}

function renderInspectorColumnTab() {
  const column = getSelectedInspectorColumn();
  if (!column) {
    return '<div class="inspector-empty"></div>';
  }
  return `
    <section class="inspector-section">
      <h4 class="inspector-section-title">${escapeHtml(column.columnName || '')}</h4>
      <dl class="inspector-kv">
        <dt>类型</dt><dd>${formatInspectorValue(column.columnType)}</dd>
        <dt>允许为空</dt><dd>${formatInspectorValue(column.isNullable)}</dd>
        <dt>默认值</dt><dd>${formatInspectorValue(column.columnDefault)}</dd>
        <dt>键</dt><dd>${formatInspectorValue(column.columnKey)}</dd>
        <dt>额外信息</dt><dd>${formatInspectorValue(column.extra)}</dd>
      </dl>
    </section>
  `;
}

function renderTableInspector() {
  const hasTable = Boolean(state.activeTable && state.tableInspectorVisible && els.tabPanels.data.classList.contains('active'));
  els.tableInspector.setAttribute('aria-hidden', hasTable ? 'false' : 'true');
  els.tableInspectorTitle.textContent = state.activeTable ? state.activeTable.table : '\u8868\u4fe1\u606f';
  els.tableInspectorSubtitle.textContent = state.activeTable
    ? `${state.activeTable.database ? `${state.activeTable.database}.` : ''}${state.activeTable.schema ? `${state.activeTable.schema}.` : ''}${state.activeTable.table}`
    : '';
  els.tabPanels.data.parentElement.classList.toggle('has-inspector', hasTable);
  els.tabPanels.data.parentElement.classList.toggle('inspector-collapsed', hasTable && state.tableInspectorCollapsed);
  renderSqlHistoryPanel();
  if (els.toggleTableInspectorBtn) {
    els.toggleTableInspectorBtn.textContent = state.tableInspectorCollapsed ? '<' : '>';
    els.toggleTableInspectorBtn.title = state.tableInspectorCollapsed ? '展开模块面板' : '收起模块面板';
    els.toggleTableInspectorBtn.setAttribute('aria-label', state.tableInspectorCollapsed ? '展开模块面板' : '收起模块面板');
  }

  Array.from(els.tableInspectorTabs.querySelectorAll('[data-tab]')).forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === state.activeInspectorTab);
  });

  if (!hasTable) {
    els.tableInspectorBody.innerHTML = '<div class="inspector-empty">选择表后查看详情。</div>';
    return;
  }

  if (!state.tableDetails) {
    els.tableInspectorBody.innerHTML = '<div class="inspector-empty">...</div>';
    return;
  }

  if (state.activeInspectorTab === 'ddl') {
    els.tableInspectorBody.innerHTML = renderInspectorDdlTab();
    return;
  }
  if (state.activeInspectorTab === 'column') {
    els.tableInspectorBody.innerHTML = renderInspectorColumnTab();
    return;
  }
  els.tableInspectorBody.innerHTML = renderInspectorInfoTab();
}

function renderQueryResult(rows) {
  const activeTab = getActiveQueryTab();
  els.queryResultWrap.classList.remove('hidden');
  els.queryResult.innerHTML = rows && rows.length ? renderQueryTable(rows) : '<div class="message"></div>';
  if (activeTab) {
    activeTab.resultHtml = els.queryResult.innerHTML;
  }
}

function renderQueryError(message) {
  const activeTab = getActiveQueryTab();
  els.queryResultWrap.classList.remove('hidden');
  els.queryResult.innerHTML = `<div class="message error-message">${escapeHtml(message || 'SQL ')}</div>`;
  if (activeTab) {
    activeTab.resultHtml = els.queryResult.innerHTML;
  }
}

function renderDataTable() {
  const columns = state.activeRows.length
    ? Object.keys(state.activeRows[0])
    : state.activeColumns.map((column) => column.columnName).filter(Boolean);
  if (!columns.length) {
    els.dataTableWrap.innerHTML = '<div class="empty-state"></div>';
    els.editActions.classList.add('hidden');
    return;
  }

  resolveColumnWidths(columns, state.activeRows);
  const totalWidth = columns.reduce((sum, column) => sum + getColumnWidth(column), 0);
  els.editActions.classList.toggle('hidden', state.editingRowIndex === null);
  els.dataTableWrap.innerHTML = `
    <table style="width:${totalWidth}px; min-width:${totalWidth}px; table-layout:fixed;">
      <colgroup>
        ${columns.map((column) => `<col data-column="${escapeAttr(column)}" style="width:${getColumnWidth(column)}px; min-width:${getColumnWidth(column)}px; max-width:${getColumnWidth(column)}px;">`).join('')}
      </colgroup>
      <thead>
        <tr>
          ${renderHeaderCells(columns)}
        </tr>
      </thead>
      <tbody>
        ${state.activeRows.length
          ? state.activeRows.map((row, rowIndex) => `
              <tr class="grid-row ${state.editingRowIndex === rowIndex ? 'editing' : ''}" data-role="data-row" data-row-index="${rowIndex}">
                ${columns.map((column) => `
                  <td class="grid-cell" data-role="data-cell" data-row-index="${rowIndex}" data-column="${escapeAttr(column)}">
                    ${state.editingRowIndex === rowIndex
                      ? `<input class="cell-input" data-role="cell-input" data-row-index="${rowIndex}" data-column="${escapeAttr(column)}" value="${state.editingValues && state.editingValues[column] != null ? escapeAttr(String(state.editingValues[column])) : ''}">`
                      : `<span class="grid-cell-value">${row[column] == null ? '' : escapeHtml(String(row[column]))}</span>`}
                  </td>
                `).join('')}
              </tr>
            `).join('')
          : `<tr><td class="empty-grid-cell" colspan="${columns.length}"></td></tr>`}
      </tbody>
    </table>
  `;
  syncActiveDataTableLayout();
}

function renderTablePagination() {
  if (!els.tablePagination) {
    return;
  }
  if (!state.activeTable || !state.activeColumns.length) {
    els.tablePagination.innerHTML = '';
    return;
  }
  const pageCount = getTablePageCount();
  const start = state.tableTotal === 0 ? 0 : ((state.tablePage - 1) * state.tablePageSize) + 1;
  const end = Math.min(state.tablePage * state.tablePageSize, state.tableTotal);
  els.tablePagination.innerHTML = `
    <button type="button" class="pagination-btn" data-page-action="first" ${state.tablePage <= 1 ? 'disabled' : ''}>首页</button>
    <button type="button" class="pagination-btn pagination-icon-btn" data-page-action="prev" ${state.tablePage <= 1 ? 'disabled' : ''}>&lt;</button>
    <span class="pagination-status">${start}-${end} / ${state.tableTotal}，第 ${state.tablePage} / ${pageCount} 页</span>
    <button type="button" class="pagination-btn pagination-icon-btn" data-page-action="next" ${state.tablePage >= pageCount ? 'disabled' : ''}>&gt;</button>
    <button type="button" class="pagination-btn" data-page-action="last" ${state.tablePage >= pageCount ? 'disabled' : ''}>末页</button>
  `;
}

function renderTable(rows) {
  if (!rows.length) {
    return '<div class="empty-state"></div>';
  }
  const columns = Object.keys(rows[0]);
  return `
    <table>
      <thead>
        <tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>${columns.map((column) => `<td>${row[column] == null ? '' : escapeHtml(String(row[column]))}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderQueryTable(rows) {
  if (!rows.length) {
    return '<div class="empty-state"></div>';
  }
  const columns = Object.keys(rows[0]);
  const widthPercent = `${100 / Math.max(columns.length, 1)}%`;
  return `
    <table class="query-result-table ${columns.length <= 6 ? 'query-result-table-fill' : ''}">
      <colgroup>
        ${columns.map(() => `<col style="width:${widthPercent};">`).join('')}
      </colgroup>
      <thead>
        <tr>${columns.map((column) => `<th>${escapeHtml(String(column))}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>${columns.map((column) => {
            const text = row[column] == null ? '' : String(row[column]);
            return `<td class="query-result-cell" data-role="query-result-cell" data-copy-value="${escapeAttr(text)}" title="\u53f3\u952e\u590d\u5236\u5355\u5143\u683c\u5185\u5bb9">${escapeHtml(text)}</td>`;
          }).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function fillConnectionForm(connection) {
  const form = els.connectionForm;
  const type = connection && connection.type ? connection.type : 'mysql';
  clearConnectionTestResult();
  form.elements.id.value = connection && connection.id ? connection.id : '';
  form.elements.name.value = connection && connection.name ? connection.name : '';
  form.elements.type.value = type;
  form.elements.host.value = connection && connection.host ? connection.host : '127.0.0.1';
  form.elements.port.value = connection && connection.port ? connection.port : getDefaultPortByType(type);
  form.elements.database.value = connection && connection.database ? connection.database : '';
  form.elements.username.value = connection && connection.username ? connection.username : '';
  form.elements.password.value = connection && connection.id ? PASSWORD_MASK : '';
  form.elements.password.dataset.masked = connection && connection.id ? 'true' : 'false';
}

async function loadConnections() {
  const items = await api('/api/connections');
  state.connections = items;
  hideContextMenu();
  closeSqlPreview();
  state.contextRowIndex = null;
  state.editingRowIndex = null;
  state.editingValues = null;
  renderConnections();
  syncQuerySelectors();
  if (state.activeConnectionId && !getActiveConnection()) {
    state.activeConnectionId = null;
    state.activeDatabase = '';
    state.catalogs = [];
    state.activeTable = null;
    state.filterVisible = false;
    state.activeColumns = [];
    state.activeRows = [];
    state.tablePage = 1;
    state.tableTotal = 0;
    state.tableDetails = null;
    state.activeInspectorColumn = '';
    state.tableInspectorVisible = false;
    state.tableInspectorCollapsed = false;
    state.sqlHistoryVisible = false;
    state.sqlHistoryCollapsed = false;
    state.schemaSearchTerm = '';
    els.schemaSearchInput.value = '';
    els.queryResultWrap.classList.add('hidden');
    els.queryResult.innerHTML = '';
  }
  updateHeader();
  renderSchema();
  renderColumns();
  renderDataTable();
  renderTablePagination();
  syncQuerySelectors();
}

function updateHeader() {
  const active = getActiveConnection();
  const activeQueryTab = getActiveQueryTab();
  const hasConnection = Boolean(active);
  const hasTable = Boolean(state.activeTable);
  els.activeConnectionName.textContent = active
    ? `${active.name} (${active.type})${activeQueryTab && activeQueryTab.database ? ` / ${activeQueryTab.database}` : ''}`
    : '\u672a\u9009\u62e9\u8fde\u63a5';
  els.activeTableName.textContent = state.activeTable
    ? `${state.activeTable.database ? `${state.activeTable.database}.` : ''}${state.activeTable.schema ? `${state.activeTable.schema}.` : ''}${state.activeTable.table}`
    : '\u672a\u9009\u62e9\u8868';
  const primaryKey = getPrimaryKey();
  els.primaryKeyHint.textContent = primaryKey ? `\u4e3b\u952e\u5217: ${primaryKey}` : '';
  els.queryEditorActions.classList.toggle('hidden', !hasConnection);
  if (els.queryRunActions) {
    els.queryRunActions.classList.toggle('hidden', !hasConnection);
  }
  els.queryResultWrap.classList.toggle('hidden', !hasConnection || !els.queryResult.innerHTML.trim());
  els.dataToolbar.classList.toggle('hidden', !hasConnection);
  els.openQueryFromDataBtn.classList.toggle('hidden', !hasConnection);
  Array.from(document.querySelectorAll('.table-only-action')).forEach((element) => {
    element.classList.toggle('hidden', !hasTable);
  });
  els.dataFilterRow.classList.toggle('hidden', !hasTable || !state.filterVisible);
  els.dataActions.classList.toggle('hidden', !state.activeTable || !state.activeColumns.length);
  updateEditorDialect();
  if (!hasConnection) {
    hideSqlSuggestPanel();
  }
  renderTableInspector();
}

function toggleFilterPanel() {
  if (!state.activeTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  state.filterVisible = !state.filterVisible;
  updateHeader();
}

async function loadSchema() {
  if (!state.activeConnectionId) {
    return;
  }
  const data = await api(`/api/connections/${state.activeConnectionId}/schema`);
  state.catalogs = data.catalogs;
  if (!state.activeDatabase && state.catalogs.length) {
    state.activeDatabase = state.catalogs[0].name;
  }
  syncQuerySelectors();
  renderSchema();
}

async function loadCatalogsForConnection(connectionId) {
  if (!connectionId) {
    return [];
  }
  const data = await api(`/api/connections/${connectionId}/schema`);
  return data.catalogs || [];
}

async function openTable(database, schema, table, options = {}) {
  hideContextMenu();
  closeSqlPreview();
  const sameTable = state.activeTable
    && state.activeTable.database === database
    && state.activeTable.schema === schema
    && state.activeTable.table === table;
  state.contextRowIndex = null;
  state.editingRowIndex = null;
  state.editingValues = null;
  state.filterVisible = false;
  setSidebarCollapsed(true);
  state.activeDatabase = database || state.activeDatabase;
  state.activeTable = { database, schema, table };
  state.tableInspectorVisible = true;
  state.tableInspectorCollapsed = false;
  state.sqlHistoryVisible = false;
  state.sqlHistoryCollapsed = false;
  state.activeInspectorTab = 'info';
  state.tableDetails = null;
  switchTab('data');
  updateHeader();
  state.tableLimit = getTableLimit();
  state.tablePageSize = state.tableLimit;
  state.tablePage = options.page || (sameTable && !options.resetPage ? state.tablePage : 1);
  state.activeFilter = getFilterState();
  const params = [
    `limit=${encodeURIComponent(state.tableLimit)}`,
    `pageSize=${encodeURIComponent(state.tablePageSize)}`,
    `page=${encodeURIComponent(state.tablePage)}`
  ];
  if (database) {
    params.push(`database=${encodeURIComponent(database)}`);
  }
  if (shouldUseFilter(state.activeFilter)) {
    params.push(`filterColumn=${encodeURIComponent(state.activeFilter.column)}`);
    params.push(`filterOperator=${encodeURIComponent(state.activeFilter.operator)}`);
    if (state.activeFilter.operator !== 'isNull' && state.activeFilter.operator !== 'isNotNull') {
      params.push(`filterValue=${encodeURIComponent(state.activeFilter.value)}`);
    }
  }
  if (schema) {
    params.unshift(`schema=${encodeURIComponent(schema)}`);
  }
  const query = `?${params.join('&')}`;
  const [columnsRes, rowsRes, detailsRes] = await Promise.all([
    api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(table)}/columns${query}`),
    api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(table)}/data${query}`),
    api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(table)}/details${query}`).catch((error) => {
      console.warn('Failed to load table details:', error);
      return { info: null, ddl: '' };
    })
  ]);
  const nextTotal = Number(rowsRes.total) || 0;
  const nextPageSize = Number(rowsRes.pageSize) || state.tablePageSize;
  const nextPageCount = Math.max(Math.ceil(nextTotal / nextPageSize), 1);
  if (nextTotal > 0 && (!rowsRes.rows || !rowsRes.rows.length) && state.tablePage > nextPageCount) {
    await openTable(database, schema, table, { page: nextPageCount });
    return;
  }
  state.activeColumns = columnsRes.columns;
  state.activeRows = rowsRes.rows;
  state.tableTotal = nextTotal;
  state.tablePage = Number(rowsRes.page) || state.tablePage;
  state.tablePageSize = nextPageSize;
  state.tableDetails = detailsRes;
  state.activeInspectorColumn = state.activeColumns[0] ? state.activeColumns[0].columnName : '';
  renderSchema();
  renderColumns();
  renderDataTable();
  renderTablePagination();
  updateHeader();
  syncQuerySelectors();
  syncFilterControls();
  updateFilterValueState();
  const activeTab = getActiveQueryTab();
  if (activeTab) {
    activeTab.connectionId = state.activeConnectionId;
    activeTab.catalogs = state.catalogs.slice();
    activeTab.database = database || state.activeDatabase;
    activeTab.sql = buildTableSql(schema, table);
  }
  await syncEditorToActiveQueryTab();
  switchTab('data');
}

async function goToTablePage(page) {
  if (!state.activeTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const nextPage = Math.max(Math.min(page, getTablePageCount()), 1);
  await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table, { page: nextPage });
}

async function changeTablePageSize() {
  if (!state.activeTable) {
    return;
  }
  state.tableLimit = getTableLimit();
  state.tablePageSize = state.tableLimit;
  await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table, { resetPage: true });
}

async function applyTableFilter() {
  if (!state.activeTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  state.activeFilter = getFilterState();
  await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table, { resetPage: true });
  setStatus('OK', false);
}

async function clearTableFilter() {
  if (!state.activeTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  state.activeFilter = {
    column: '',
    operator: 'contains',
    value: ''
  };
  syncFilterControls();
  updateFilterValueState();
  await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table, { resetPage: true });
  setStatus('OK', false);
}

async function refreshCurrentTable() {
  if (!state.activeTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  els.refreshTableBtn.classList.add('is-loading');
  try {
    await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table, { page: state.tablePage });
    setStatus('OK', false);
  } finally {
    els.refreshTableBtn.classList.remove('is-loading');
  }
}

async function saveColumn(event) {
  event.preventDefault();
  if (!state.activeTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  updateColumnDesignerState();
  const formData = new FormData(els.columnForm);
  const payload = Object.fromEntries(formData.entries());
  payload.allowNull = els.columnForm.elements.allowNull.checked;
  payload.columnType = renderColumnTypeFromDesigner();
  if (!payload.columnType) {
    throw new Error('\u8bf7\u586b\u5199\u5b57\u6bb5\u7c7b\u578b');
  }
  payload.defaultMode = els.columnDefaultMode ? els.columnDefaultMode.value : 'none';
  payload.hasDefault = payload.defaultMode !== 'none';
  payload.isPrimaryKey = !!(els.columnForm.elements.primaryKey && els.columnForm.elements.primaryKey.checked);
  payload.autoIncrement = payload.isPrimaryKey && !!(els.columnForm.elements.autoIncrement && els.columnForm.elements.autoIncrement.checked);
  if (payload.defaultMode === 'expression' && !String(payload.columnDefault || '').trim()) {
    throw new Error('\u8bf7\u586b\u5199\u9ed8\u8ba4\u8868\u8fbe\u5f0f');
  }
  if (payload.defaultMode === 'null') {
    payload.columnDefault = '';
  }
  payload.database = state.activeTable.database;
  payload.schema = state.activeTable.schema;

  if (payload.mode === 'edit') {
    await api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(state.activeTable.table)}/columns/${encodeURIComponent(payload.originalName)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    setStatus('OK', false);
  } else {
    await api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(state.activeTable.table)}/columns`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setStatus('OK', false);
  }

  closeColumnModal();
  await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table);
  switchTab('structure');
}

async function saveDatabase(event) {
  event.preventDefault();
  if (!state.activeConnectionId) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const formData = new FormData(els.databaseForm);
  const payload = Object.fromEntries(formData.entries());
  if (payload.mode === 'edit') {
    await api(`/api/connections/${state.activeConnectionId}/databases/${encodeURIComponent(payload.originalName)}`, {
      method: 'PUT',
      body: JSON.stringify({ databaseName: payload.databaseName })
    });
    setStatus('OK', false);
  } else {
    await api(`/api/connections/${state.activeConnectionId}/databases`, {
      method: 'POST',
      body: JSON.stringify({ databaseName: payload.databaseName })
    });
    setStatus('OK', false);
  }
  closeDatabaseModal();
  await loadSchema();
}

function closeCurrentDatabaseNode() {
  if (!state.contextDatabaseName) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  state.treeState[`catalog:${state.contextDatabaseName}`] = false;
  hideDatabaseContextMenu();
  renderSchema();
}

function refreshCurrentDatabaseNode() {
  hideDatabaseContextMenu();
  return loadSchema().then(() => setStatus('已刷新', false));
}

function openCreateDatabase() {
  hideDatabaseContextMenu();
  openDatabaseModal('新建数据库', '', 'add');
}

function openEditDatabase() {
  if (!state.contextDatabaseName) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const databaseName = state.contextDatabaseName;
  hideDatabaseContextMenu();
  openDatabaseModal('编辑数据库', databaseName, 'edit');
}

async function deleteCurrentDatabase() {
  if (!state.contextDatabaseName) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const databaseName = state.contextDatabaseName;
  hideDatabaseContextMenu();
  openDeleteDatabaseModal(databaseName);
}

async function confirmDeleteCurrentDatabase() {
  if (!state.contextDatabaseName) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const databaseName = state.contextDatabaseName;
  await api(`/api/connections/${state.activeConnectionId}/databases/${encodeURIComponent(databaseName)}`, {
    method: 'DELETE'
  });
  closeDeleteDatabaseModal();
  setStatus('OK', false);
  await loadSchema();
}

async function openContextTable() {
  if (!state.contextTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  hideTableContextMenu();
  await openTable(state.contextTable.database, state.contextTable.schema, state.contextTable.table);
}

async function designContextTable() {
  await openContextTable();
  openDesignTableModal();
}

function designActiveTable() {
  if (!state.activeTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  hideContextMenu();
  openDesignTableModal();
}

function createContextTable() {
  const context = state.contextTable || state.contextTableGroup || { database: state.activeDatabase, schema: '' };
  hideTableContextMenu();
  hideTableGroupContextMenu();
  state.contextTable = context;
  openTableModal('新建表', '', 'add');
}

function renameContextTable() {
  if (!state.contextTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const tableName = state.contextTable.table;
  state.renamingTableKey = `${state.contextTable.database || ''}:${state.contextTable.schema || ''}:${tableName}`;
  hideTableContextMenu();
  renderSchema();
  window.setTimeout(() => {
    const input = document.querySelector('[data-role="rename-table-input"]');
    if (input) {
      input.focus();
      input.select();
    }
  }, 0);
}

function deleteContextTable() {
  if (!state.contextTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const tableName = state.contextTable.table;
  hideTableContextMenu();
  openDeleteTableModal('drop', tableName);
}

function clearContextTable(truncate) {
  if (!state.contextTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const tableName = state.contextTable.table;
  hideTableContextMenu();
  openDeleteTableModal(truncate ? 'truncate' : 'clear', tableName);
}

function openImportWizard() {
  if (state.contextTableGroup) {
    els.tableGroupContextMenu.classList.add('hidden');
    openTableActionModal('import');
    return;
  }
  if (!state.contextTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  state.activeTable = { ...state.contextTable };
  hideTableContextMenu();
  updateHeader();
  openTableActionModal('import');
}

function openExportWizard() {
  if (!state.contextTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  state.activeTable = { ...state.contextTable };
  hideTableContextMenu();
  updateHeader();
  openTableActionModal('export');
}

async function refreshContextTableSchema() {
  hideTableGroupContextMenu();
  hideTableContextMenu();
  await loadSchema();
  setStatus('OK', false);
}

function openTableGroupCreate() {
  if (!state.contextTableGroup) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  createContextTable();
}

function openTableGroupImport() {
  if (!state.contextTableGroup) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  openImportWizard();
}

async function refreshTableGroup() {
  if (!state.contextTableGroup) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  await refreshContextTableSchema();
}

async function saveTable(event) {
  event.preventDefault();
  const formData = new FormData(els.tableForm);
  const payload = Object.fromEntries(formData.entries());
  const context = state.contextTable || { database: state.activeDatabase, schema: '' };
  payload.database = context.database;
  payload.schema = context.schema;

  if (payload.mode === 'rename') {
    await api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(payload.originalName)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    setStatus('OK', false);
  } else {
    await api(`/api/connections/${state.activeConnectionId}/tables`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setStatus('OK', false);
  }

  closeTableModal();
  await loadSchema();
}

async function commitInlineRenameTable(input) {
  const nextName = String(input.value || '').trim();
  const originalName = input.dataset.table;
  const database = input.dataset.database || '';
  const schema = input.dataset.schema || '';
  state.renamingTableKey = '';
  if (!nextName || nextName === originalName) {
    renderSchema();
    return;
  }
  await api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(originalName)}`, {
    method: 'PUT',
    body: JSON.stringify({
      tableName: nextName,
      database,
      schema
    })
  });
  setStatus('OK', false);
  await loadSchema();
}

async function confirmDeleteContextTable() {
  if (!state.contextTable) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const context = state.contextTable;
  const action = state.contextTableAction || 'drop';
  const truncate = action === 'truncate';
  const dropTable = action === 'drop';
  await api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(context.table)}`, {
    method: 'DELETE',
    body: JSON.stringify({
      database: context.database,
      schema: context.schema,
      truncate,
      dropTable
    })
  });
  closeDeleteTableModal();
  setStatus(dropTable ? '已删除表' : truncate ? '已截断表' : '已清空表', false);
  if (!dropTable && state.activeTable && state.activeTable.table === context.table) {
    await openTable(context.database, context.schema, context.table);
  }
  await loadSchema();
}

async function runCurrentQuery() {
  const activeTab = getActiveQueryTab();
  if (!activeTab || !activeTab.connectionId) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8fde\u63a5');
  }
  const sql = await getEditorSql();
  const dangerWarnings = analyzeDangerousSql(sql);
  const confirmedDangerous = confirmDangerousSql(dangerWarnings);
  if (!confirmedDangerous) {
    setStatus('已取消危险 SQL 执行', false);
    return;
  }
  const startTime = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
  state.queryAbortController = new AbortController();
  els.stopQueryBtn.disabled = false;
  let result;
  try {
    result = await api(`/api/connections/${activeTab.connectionId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        sql,
        database: activeTab.database,
        confirmDangerous: dangerWarnings.length > 0
      }),
      signal: state.queryAbortController.signal
    });
  } finally {
    state.queryAbortController = null;
    els.stopQueryBtn.disabled = true;
  }
  const endTime = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
  const durationMs = Math.max(0, Math.round(endTime - startTime));
  const durationSeconds = (durationMs / 1000).toFixed(3);
  renderQueryResult(result.rows);
  const activeConnection = getActiveConnection();
  saveSqlHistory(sql, {
    connectionName: activeConnection ? activeConnection.name : '',
    database: activeTab.database || ''
  });
  setStatus(`SQL ${result.rowCount} / ${durationSeconds} s`, false);
  switchTab('query');
}

function stopCurrentQuery() {
  if (!state.queryAbortController) {
    return;
  }
  state.queryAbortController.abort();
  state.queryAbortController = null;
  els.stopQueryBtn.disabled = true;
  setStatus('OK', false);
}

async function openNewQueryFromData() {
  if (!state.activeConnectionId) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const initialSql = state.activeTable
    ? `SELECT * FROM ${state.activeTable.schema ? `${state.activeTable.schema}.` : ''}${state.activeTable.table} LIMIT 100;`
    : '';
  const shouldReuseFirstQuery = state.queryTabs.length === 1
    && state.queryTabs[0].id === 'query_1'
    && state.queryTabs[0].title === '\u67e5\u8be2 1'
    && !state.queryTabs[0].resultHtml;
  if (shouldReuseFirstQuery) {
    state.activeQueryTabId = 'query_1';
    state.queryTabs[0].sql = initialSql;
    state.queryTabs[0].connectionId = state.activeConnectionId;
    state.queryTabs[0].database = state.activeTable ? (state.activeTable.database || '') : '';
    state.queryTabs[0].catalogs = state.catalogs.slice();
    renderQueryTabs();
    await syncEditorToActiveQueryTab();
  } else {
    await createQueryTab(initialSql);
  }
  const activeTab = getActiveQueryTab();
  if (activeTab) {
    activeTab.connectionId = state.activeConnectionId;
    activeTab.database = state.activeTable ? (state.activeTable.database || '') : '';
    activeTab.catalogs = state.catalogs.slice();
  }
  syncQuerySelectors();
  switchTab('query');
}

async function formatCurrentSql() {
  const sql = await getEditorSql();
  const formatted = formatSql(sql);
  await setEditorSql(formatted);
  setStatus('OK', false);
}

async function saveConnection(event) {
  event.preventDefault();
  const formData = new FormData(els.connectionForm);
  const payload = Object.fromEntries(formData.entries());
  const id = payload.id;
  delete payload.id;
  payload.port = String(payload.port || '').trim();
  if (id && payload.password === PASSWORD_MASK) {
    delete payload.password;
  }

  const url = id ? `/api/connections/${id}` : '/api/connections';
  const method = id ? 'PUT' : 'POST';
  await api(url, {
    method,
    body: JSON.stringify(payload)
  });
  fillConnectionForm(null);
  closeConnectionModal();
  await loadConnections();
  setStatus(id ? '已更新连接' : '已保存连接', false);
}

async function editContextConnection() {
  if (!state.contextConnectionId) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const connection = state.connections.find((item) => item.id === state.contextConnectionId);
  if (!connection) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  hideConnectionContextMenu();
  fillConnectionForm(connection);
  openConnectionModal('编辑连接');
}

async function deleteContextConnection() {
  if (!state.contextConnectionId) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const connectionId = state.contextConnectionId;
  hideConnectionContextMenu();
  await api(`/api/connections/${connectionId}`, { method: 'DELETE' });
  if (state.activeConnectionId === connectionId) {
    state.activeConnectionId = null;
    state.catalogs = [];
    state.activeTable = null;
    state.filterVisible = false;
    state.activeColumns = [];
    state.activeRows = [];
    state.tablePage = 1;
    state.tableTotal = 0;
  }
  await loadConnections();
  setStatus('OK', false);
}

async function testConnectionFromForm() {
  const formData = new FormData(els.connectionForm);
  const payload = Object.fromEntries(formData.entries());
  delete payload.id;
  els.testConnectionBtn.disabled = true;
  els.testConnectionBtn.textContent = '...';
  clearConnectionTestResult();
  try {
    await api('/api/connections/test', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setConnectionTestResult('连接成功', 'success');
    setStatus('OK', false);
  } catch (error) {
    setConnectionTestResult(error.message, 'error');
    throw error;
  } finally {
    els.testConnectionBtn.disabled = false;
    els.testConnectionBtn.textContent = '测试连接';
  }
}

async function saveRow(rowIndex) {
  const row = state.activeRows[rowIndex];
  const primaryKey = getPrimaryKey();
  const values = {};
  Array.from(els.dataTableWrap.querySelectorAll(`[data-role="cell-input"][data-row-index="${rowIndex}"]`)).forEach((input) => {
    const column = input.dataset.column;
    const originalValue = row[column] == null ? '' : String(row[column]);
    if (input.value !== originalValue) {
      values[column] = input.value;
    }
  });
  if (!Object.keys(values).length) {
    setStatus('OK', false);
    return;
  }
  await api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(state.activeTable.table)}/rows`, {
    method: 'PUT',
    body: JSON.stringify({
      database: state.activeTable.database,
      schema: state.activeTable.schema,
      primaryKey,
      keyValue: row[primaryKey],
      values
    })
  });
  await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table);
  setStatus('OK', false);
}

async function saveCurrentEdit() {
  if (state.editingRowIndex === null) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  await saveRow(state.editingRowIndex);
  state.editingRowIndex = null;
  state.editingValues = null;
}

async function deleteRow(keyValue) {
  const primaryKey = getPrimaryKey();
  await api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(state.activeTable.table)}/rows`, {
    method: 'DELETE',
    body: JSON.stringify({
      database: state.activeTable.database,
      schema: state.activeTable.schema,
      primaryKey,
      keyValue
    })
  });
  await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table);
  setStatus('OK', false);
}

async function insertRow() {
  const values = {};
  state.activeColumns.forEach((column) => {
    const input = window.prompt(` ${column.columnName} `, '');
    if (input !== null) {
      values[column.columnName] = input;
    }
  });
  await api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(state.activeTable.table)}/rows`, {
    method: 'POST',
    body: JSON.stringify({
      database: state.activeTable.database,
      schema: state.activeTable.schema,
      values
    })
  });
  await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table);
  setStatus('OK', false);
}

async function exportTable() {
  const queryParts = [];
  const exportFormat = (document.querySelector('input[name="exportFormat"]:checked') || {}).value || 'csv';
  queryParts.push(`format=${encodeURIComponent(exportFormat)}`);
  if (state.activeTable.database) {
    queryParts.push(`database=${encodeURIComponent(state.activeTable.database)}`);
  }
  if (state.activeTable.schema) {
    queryParts.push(`schema=${encodeURIComponent(state.activeTable.schema)}`);
  }
  const query = queryParts.length ? `?${queryParts.join('&')}` : '';
  const url = `/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(state.activeTable.table)}/export${query}`;
  window.open(url, '_blank');
  closeTableActionModal();
}

async function importCsv(event) {
  event.preventDefault();
  if (!els.importFile.files.length) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const formData = new FormData();
  formData.append('file', els.importFile.files[0]);
  if (state.contextTableGroup) {
    formData.append('database', state.contextTableGroup.database || '');
    formData.append('schema', state.contextTableGroup.schema || '');
    const result = await api(`/api/connections/${state.activeConnectionId}/tables/import-create`, {
      method: 'POST',
      body: formData
    });
    await loadSchema();
    await openTable(state.contextTableGroup.database, state.contextTableGroup.schema, result.tableName);
    setStatus(`已导入 ${result.tableName}，共 ${result.imported} 行`, false);
    hideTableGroupContextMenu();
  } else {
    formData.append('database', state.activeTable.database || '');
    formData.append('schema', state.activeTable.schema || '');
    formData.append('mode', els.importForm.elements.importMode.value || 'append');
    const result = await api(`/api/connections/${state.activeConnectionId}/tables/${encodeURIComponent(state.activeTable.table)}/import`, {
      method: 'POST',
      body: formData
    });
    await openTable(state.activeTable.database, state.activeTable.schema, state.activeTable.table);
    setStatus(`${result.mode === 'replace' ? '已覆盖导入' : '已追加导入'} ${result.imported} 行`, false);
  }
  els.importForm.reset();
  closeTableActionModal();
}

async function showInsertSqlForContextRow() {
  if (state.contextRowIndex === null || state.contextRowIndex === undefined) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const row = state.activeRows[state.contextRowIndex];
  if (!row) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const sql = buildInsertSqlForRow(row);
  hideContextMenu();
  openSqlPreview(sql);
  setStatus('OK', false);
}

async function deleteContextRow() {
  if (state.contextRowIndex === null || state.contextRowIndex === undefined) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  const row = state.activeRows[state.contextRowIndex];
  const primaryKey = getPrimaryKey();
  if (!row || !primaryKey) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  hideContextMenu();
  await deleteRow(row[primaryKey]);
}

async function copyInsertSql() {
  if (!state.currentInsertSql) {
    throw new Error('\u8bf7\u5148\u9009\u62e9\u8868');
  }
  await copyTextToClipboard(state.currentInsertSql);
  flashButtonSuccess(els.copyInsertSqlBtn, '已复制');
  setStatus('OK', false);
}

async function copyQueryCellValue() {
  await copyTextToClipboard(state.contextQueryCellValue || '');
  hideQueryCellContextMenu();
  setStatus('\u5df2\u590d\u5236\u5355\u5143\u683c\u5185\u5bb9', false);
}

els.connectionForm.addEventListener('submit', (event) => handleAction(() => saveConnection(event)));
els.connectionForm.elements.type.addEventListener('change', function () {
  if (!els.connectionForm.elements.id.value) {
    els.connectionForm.elements.port.value = getDefaultPortByType(this.value);
  }
});
els.connectionForm.elements.password.addEventListener('focus', function () {
  if (this.dataset.masked === 'true') {
    this.value = '';
    this.dataset.masked = 'false';
  }
});
els.newConnectionBtn.addEventListener('click', () => {
  fillConnectionForm(null);
  openConnectionModal('新建连接');
});
els.editConnectionBtn.addEventListener('click', () => handleAction(editContextConnection));
els.deleteConnectionBtn.addEventListener('click', () => handleAction(deleteContextConnection));
els.newQueryTabBtn.addEventListener('click', () => handleAction(() => createQueryTab('')));
if (els.closeConnectionModalBtn) {
  els.closeConnectionModalBtn.addEventListener('click', closeConnectionModal);
}
if (els.closeConnectionTestModalBtn) {
  els.closeConnectionTestModalBtn.addEventListener('click', closeConnectionTestModal);
}
els.toggleSidebarBtn.addEventListener('click', () => {
  setSidebarCollapsed(!els.shell.classList.contains('sidebar-collapsed'));
});
els.testConnectionBtn.addEventListener('click', () => handleAction(testConnectionFromForm));
els.queryConnectionSelect.addEventListener('change', (event) => {
  const nextConnectionId = event.target.value;
  handleAction(async () => {
    const activeTab = getActiveQueryTab();
    if (!activeTab) {
      return;
    }
    if (!nextConnectionId) {
      await resetQueryTabsForConnection('', [], '');
      state.filterVisible = false;
      return;
    }
    const catalogs = await loadCatalogsForConnection(nextConnectionId);
    await resetQueryTabsForConnection(nextConnectionId, catalogs, catalogs[0] ? catalogs[0].name : '');
    setStatus('OK', false);
  });
});
els.queryDatabaseSelect.addEventListener('change', (event) => {
  const activeTab = getActiveQueryTab();
  if (activeTab) {
    activeTab.database = event.target.value || '';
  }
  syncQuerySelectors();
});
els.schemaSearchInput.addEventListener('input', function (event) {
  state.schemaSearchTerm = event.target.value || '';
  renderSchema();
});
els.filterOperatorSelect.addEventListener('change', updateFilterValueState);
els.toggleFilterBtn.addEventListener('click', () => handleAction(toggleFilterPanel));
els.applyFilterBtn.addEventListener('click', () => handleAction(applyTableFilter));
els.clearFilterBtn.addEventListener('click', () => handleAction(clearTableFilter));
els.openQueryFromDataBtn.addEventListener('click', () => handleAction(openNewQueryFromData));
els.stopQueryBtn.addEventListener('click', stopCurrentQuery);
els.formatSqlBtn.addEventListener('click', () => handleAction(formatCurrentSql));
els.runQueryBtn.addEventListener('click', () => handleAction(runCurrentQuery));
els.openSqlHistoryBtn.addEventListener('click', openSqlHistoryModal);
els.openExportModalBtn.addEventListener('click', () => handleAction(() => state.activeTable ? openTableActionModal('export') : Promise.reject(new Error('请先选择表'))));
els.openImportModalBtn.addEventListener('click', () => handleAction(() => state.activeTable ? openTableActionModal('import') : Promise.reject(new Error('请先选择表'))));
els.confirmExportBtn.addEventListener('click', () => handleAction(() => state.activeTable ? exportTable() : Promise.reject(new Error('请先选择表'))));
if (els.closeTableActionModalBtn) {
  els.closeTableActionModalBtn.addEventListener('click', closeTableActionModal);
}
els.importForm.addEventListener('submit', (event) => handleAction(() => importCsv(event)));
els.columnForm.addEventListener('submit', (event) => handleAction(() => saveColumn(event)));
['input', 'change'].forEach((eventName) => {
  els.columnForm.addEventListener(eventName, updateColumnDesignerState);
});
if (els.cancelColumnBtn) {
  els.cancelColumnBtn.addEventListener('click', closeColumnModal);
}
els.insertRowBtn.addEventListener('click', () => handleAction(insertRow));
els.refreshTableBtn.addEventListener('click', () => handleAction(refreshCurrentTable));
if (els.tablePagination) {
  els.tablePagination.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page-action]');
    if (!button || button.disabled) {
      return;
    }
    const pageCount = getTablePageCount();
    const actions = {
      first: 1,
      prev: state.tablePage - 1,
      next: state.tablePage + 1,
      last: pageCount
    };
    handleAction(() => goToTablePage(actions[button.dataset.pageAction] || state.tablePage));
  });
}
els.tableLimitInput.addEventListener('change', () => handleAction(changeTablePageSize));
els.addColumnBtn.addEventListener('click', () => openColumnModal('\u65b0\u589e\u5b57\u6bb5'));
els.addColumnFromDesignBtn.addEventListener('click', () => openColumnModal('\u65b0\u589e\u5b57\u6bb5'));
els.databaseForm.addEventListener('submit', (event) => handleAction(() => saveDatabase(event)));
els.confirmDeleteDatabaseBtn.addEventListener('click', () => handleAction(confirmDeleteCurrentDatabase));
els.openDatabaseBtn.addEventListener('click', () => handleAction(openCurrentDatabase));
els.closeDatabaseBtn.addEventListener('click', () => handleAction(closeCurrentDatabaseNode));
els.editDatabaseBtn.addEventListener('click', () => handleAction(openEditDatabase));
els.deleteDatabaseBtn.addEventListener('click', () => handleAction(deleteCurrentDatabase));
els.createDatabaseBtn.addEventListener('click', () => handleAction(openCreateDatabase));
els.refreshDatabaseBtn.addEventListener('click', () => handleAction(refreshCurrentDatabaseNode));
els.tableForm.addEventListener('submit', (event) => handleAction(() => saveTable(event)));
els.confirmDeleteTableBtn.addEventListener('click', () => handleAction(confirmDeleteContextTable));
els.openTableMenuBtn.addEventListener('click', () => handleAction(openContextTable));
els.designTableBtn.addEventListener('click', () => handleAction(designContextTable));
els.createTableBtn.addEventListener('click', () => handleAction(createContextTable));
els.deleteTableBtn.addEventListener('click', () => handleAction(deleteContextTable));
els.clearTableBtn.addEventListener('click', () => handleAction(() => clearContextTable(false)));
els.truncateTableBtn.addEventListener('click', () => handleAction(() => clearContextTable(true)));
els.importWizardBtn.addEventListener('click', () => handleAction(openImportWizard));
els.exportWizardBtn.addEventListener('click', () => handleAction(openExportWizard));
els.renameTableBtn.addEventListener('click', () => handleAction(renameContextTable));
els.refreshTableSchemaBtn.addEventListener('click', () => handleAction(refreshContextTableSchema));
els.createTableFromGroupBtn.addEventListener('click', () => handleAction(openTableGroupCreate));
els.importTableGroupBtn.addEventListener('click', () => handleAction(openTableGroupImport));
els.refreshTableGroupBtn.addEventListener('click', () => handleAction(refreshTableGroup));
els.saveEditBtn.addEventListener('click', () => handleAction(saveCurrentEdit));
els.cancelEditBtn.addEventListener('click', cancelRowEdit);
els.designTableFromRowBtn.addEventListener('click', () => handleAction(designActiveTable));
els.showInsertSqlBtn.addEventListener('click', () => handleAction(showInsertSqlForContextRow));
els.deleteRowBtn.addEventListener('click', () => handleAction(deleteContextRow));
els.copyInsertSqlBtn.addEventListener('click', () => handleAction(copyInsertSql));
els.copyQueryCellBtn.addEventListener('click', () => handleAction(copyQueryCellValue));
if (els.closeSqlPreviewBtn) {
  els.closeSqlPreviewBtn.addEventListener('click', closeSqlPreview);
}
if (els.closeSqlHistoryBtn) {
  els.closeSqlHistoryBtn.addEventListener('click', closeSqlHistoryModal);
}
if (els.clearSqlHistoryBtn) {
  els.clearSqlHistoryBtn.addEventListener('click', clearSqlHistory);
}
if (els.sqlHistoryList) {
  els.sqlHistoryList.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('button[data-history-delete]');
    if (deleteButton) {
      deleteSqlHistoryItem(deleteButton.dataset.historyDelete);
      return;
    }
    const itemButton = event.target.closest('button[data-history-id]');
    if (itemButton) {
      handleAction(() => applySqlHistoryItem(itemButton.dataset.historyId));
    }
  });
}

els.queryTabs.addEventListener('click', (event) => {
  const dataBtn = event.target.closest('button[data-action="switch-data-tab"]');
  if (dataBtn) {
    switchTab('data');
    renderQueryTabs();
    return;
  }
  const switchBtn = event.target.closest('button[data-action="switch-query-tab"]');
  if (switchBtn) {
    handleAction(() => switchQueryTab(switchBtn.dataset.tabId));
    return;
  }
  const closeBtn = event.target.closest('button[data-action="close-query-tab"]');
  if (closeBtn) {
    handleAction(() => closeQueryTab(closeBtn.dataset.tabId));
  }
});

els.queryResult.addEventListener('contextmenu', (event) => {
  const cell = event.target.closest('td[data-role="query-result-cell"]');
  if (!cell) {
    hideQueryCellContextMenu();
    return;
  }
  event.preventDefault();
  showQueryCellContextMenu(event.clientX, event.clientY, cell.dataset.copyValue || '');
});

els.connectionList.addEventListener('dblclick', (event) => {
  hideConnectionContextMenu();
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  handleAction(async () => {
    if (action === 'select') {
      state.activeConnectionId = id;
      state.activeDatabase = '';
      state.activeTable = null;
      state.filterVisible = false;
      state.activeColumns = [];
      state.activeRows = [];
      state.tablePage = 1;
      state.tableTotal = 0;
      state.tableDetails = null;
      state.activeInspectorColumn = '';
      state.tableInspectorVisible = false;
      state.tableInspectorCollapsed = false;
      state.sqlHistoryVisible = false;
      state.sqlHistoryCollapsed = false;
      state.schemaSearchTerm = '';
      state.editingRowIndex = null;
      state.editingValues = null;
      els.schemaSearchInput.value = '';
      updateHeader();
      renderConnections();
      await loadSchema();
      await resetQueryTabsForActiveConnection();
      renderColumns();
      renderDataTable();
      renderTablePagination();
      setStatus('OK', false);
      return;
    }
  });
});

els.connectionList.addEventListener('contextmenu', (event) => {
  const item = event.target.closest('button[data-action="select"]');
  if (!item) {
    hideConnectionContextMenu();
    return;
  }
  event.preventDefault();
  showConnectionContextMenu(event.clientX, event.clientY, item.dataset.id);
});

els.schemaTree.addEventListener('click', (event) => {
  hideDatabaseContextMenu();
  hideTableContextMenu();
  hideTableGroupContextMenu();
  const toggleButton = event.target.closest('button[data-action="toggle-tree"]');
  if (toggleButton) {
    const nodeKey = toggleButton.dataset.nodeKey;
    const defaultExpanded = state.schemaSearchTerm.trim() ? true : getTreeDefaultExpanded(nodeKey);
    const currentExpanded = state.treeState[nodeKey] === undefined
      ? defaultExpanded
      : state.treeState[nodeKey];
    state.treeState[nodeKey] = !currentExpanded;
    renderSchema();
    return;
  }
  const button = event.target.closest('button[data-action="open-table"]');
  if (!button) {
    return;
  }
  handleAction(() => openTable(button.dataset.database, button.dataset.schema, button.dataset.table));
});

els.schemaTree.addEventListener('keydown', (event) => {
  const input = event.target.closest('[data-role="rename-table-input"]');
  if (!input) {
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    handleAction(() => commitInlineRenameTable(input));
  }
  if (event.key === 'Escape') {
    state.renamingTableKey = '';
    renderSchema();
  }
});

els.schemaTree.addEventListener('focusout', (event) => {
  const input = event.target.closest('[data-role="rename-table-input"]');
  if (!input) {
    return;
  }
  handleAction(() => commitInlineRenameTable(input));
});

els.schemaTree.addEventListener('contextmenu', (event) => {
  const tableNode = event.target.closest('button.tree-leaf[data-action="open-table"]');
  if (tableNode) {
    event.preventDefault();
    showTableContextMenu(event.clientX, event.clientY, {
      database: tableNode.dataset.database,
      schema: tableNode.dataset.schema,
      table: tableNode.dataset.table
    });
    hideDatabaseContextMenu();
    hideTableGroupContextMenu();
    return;
  }
  const tableGroupNode = event.target.closest('button.tree-toggle[data-group-key="tables"]');
  if (tableGroupNode) {
    event.preventDefault();
    showTableGroupContextMenu(event.clientX, event.clientY, {
      database: tableGroupNode.dataset.database || '',
      schema: tableGroupNode.dataset.schema || ''
    });
    hideDatabaseContextMenu();
    hideTableContextMenu();
    return;
  }
  const databaseNode = event.target.closest('button.tree-title[data-database]');
  if (!databaseNode) {
    hideDatabaseContextMenu();
    hideTableContextMenu();
    hideTableGroupContextMenu();
    return;
  }
  event.preventDefault();
  showDatabaseContextMenu(event.clientX, event.clientY, databaseNode.dataset.database);
  hideTableContextMenu();
  hideTableGroupContextMenu();
});

els.columnList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="edit-column"]');
  if (!button) {
    return;
  }
  const column = state.activeColumns.find((item) => item.columnName === button.dataset.columnName);
  if (column) {
    openColumnModal('\u7f16\u8f91\u5b57\u6bb5', column);
  }
});

els.designTableColumnList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="edit-column"]');
  if (!button) {
    return;
  }
  const column = state.activeColumns.find((item) => item.columnName === button.dataset.columnName);
  if (column) {
    openColumnModal('\u7f16\u8f91\u5b57\u6bb5', column);
  }
});

if (els.tableInspectorTabs) {
  els.tableInspectorTabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (!button) {
      return;
    }
    state.activeInspectorTab = button.dataset.tab;
    renderTableInspector();
  });
}

if (els.toggleTableInspectorBtn) {
  els.toggleTableInspectorBtn.addEventListener('click', () => {
    if (!state.activeTable) {
      return;
    }
    state.tableInspectorVisible = true;
    state.tableInspectorCollapsed = !state.tableInspectorCollapsed;
    renderTableInspector();
    requestAnimationFrame(syncActiveDataTableLayout);
  });
}

if (els.sqlSuggestPanel) {
  els.sqlSuggestPanel.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-index]');
    if (!button) {
      return;
    }
    applySqlSuggestion(Number(button.dataset.index));
  });
}

els.columnList.addEventListener('click', (event) => {
  if (event.target.closest('button[data-action="edit-column"]')) {
    return;
  }
  const row = event.target.closest('tr[data-role="column-row"]');
  if (!row) {
    return;
  }
  showInspectorColumn(row.dataset.columnName || '');
  renderColumns();
});

els.dataTableWrap.addEventListener('click', (event) => {
  hideContextMenu();
  const header = event.target.closest('th[data-column]');
  if (header && header.dataset.column) {
    showInspectorColumn(header.dataset.column);
    renderColumns();
    return;
  }
  const cell = event.target.closest('td[data-role="data-cell"]');
  if (cell && cell.dataset.column) {
    showInspectorColumn(cell.dataset.column);
    renderColumns();
  }
  const input = event.target.closest('input[data-role="cell-input"]');
  if (input && state.editingValues) {
    state.editingValues[input.dataset.column] = input.value;
  }
});

els.dataTableWrap.addEventListener('input', (event) => {
  const input = event.target.closest('input[data-role="cell-input"]');
  if (!input || !state.editingValues) {
    return;
  }
  state.editingValues[input.dataset.column] = input.value;
});

els.dataTableWrap.addEventListener('dblclick', (event) => {
  const cell = event.target.closest('td[data-role="data-cell"]');
  if (!cell) {
    return;
  }
  beginRowEdit(Number(cell.dataset.rowIndex));
});

els.dataTableWrap.addEventListener('contextmenu', (event) => {
  const row = event.target.closest('tr[data-role="data-row"]');
  if (!row) {
    hideContextMenu();
    return;
  }
  event.preventDefault();
  showContextMenu(event.clientX, event.clientY, Number(row.dataset.rowIndex));
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('#tableContextMenu')) {
    hideTableContextMenu();
  }
  if (!event.target.closest('#tableGroupContextMenu')) {
    hideTableGroupContextMenu();
  }
  if (!event.target.closest('#databaseContextMenu')) {
    hideDatabaseContextMenu();
  }
  if (!event.target.closest('#connectionContextMenu')) {
    hideConnectionContextMenu();
  }
  if (!event.target.closest('#rowContextMenu')) {
    hideContextMenu();
  }
  if (!event.target.closest('#queryCellContextMenu')) {
    hideQueryCellContextMenu();
  }
});

document.addEventListener('scroll', () => {
  hideConnectionContextMenu();
  hideDatabaseContextMenu();
  hideTableContextMenu();
  hideTableGroupContextMenu();
  hideContextMenu();
  hideQueryCellContextMenu();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideConnectionContextMenu();
    hideDatabaseContextMenu();
    hideTableContextMenu();
    hideTableGroupContextMenu();
    hideContextMenu();
    hideQueryCellContextMenu();
    closeSqlPreview();
    if (state.sqlHistoryVisible) {
      closeSqlHistoryModal();
    }
    closeConnectionModal();
    closeConnectionTestModal();
    closeDatabaseModal();
    closeTableModal();
    closeDeleteTableModal();
  }
});

if (els.sqlPreviewModal) {
  els.sqlPreviewModal.addEventListener('click', (event) => {
    if (event.target === els.sqlPreviewModal) {
      closeSqlPreview();
    }
  });
}

if (els.connectionModal) {
  els.connectionModal.addEventListener('click', (event) => {
    if (event.target === els.connectionModal) {
      closeConnectionModal();
    }
  });
}

if (els.connectionTestModal) {
  els.connectionTestModal.addEventListener('click', (event) => {
    if (event.target === els.connectionTestModal) {
      closeConnectionTestModal();
    }
  });
}

if (els.tableActionModal) {
  els.tableActionModal.addEventListener('click', (event) => {
    if (event.target === els.tableActionModal) {
      closeTableActionModal();
    }
  });
}

if (els.closeColumnModalBtn) {
  els.closeColumnModalBtn.addEventListener('click', closeColumnModal);
}

if (els.columnModal) {
  els.columnModal.addEventListener('click', (event) => {
    if (event.target === els.columnModal) {
      closeColumnModal();
    }
  });
}

if (els.closeDesignTableModalBtn) {
  els.closeDesignTableModalBtn.addEventListener('click', closeDesignTableModal);
}

if (els.designTableModal) {
  els.designTableModal.addEventListener('click', (event) => {
    if (event.target === els.designTableModal) {
      closeDesignTableModal();
    }
  });
}

if (els.closeDatabaseModalBtn) {
  els.closeDatabaseModalBtn.addEventListener('click', closeDatabaseModal);
}

if (els.databaseModal) {
  els.databaseModal.addEventListener('click', (event) => {
    if (event.target === els.databaseModal) {
      closeDatabaseModal();
    }
  });
}

if (els.closeTableModalBtn) {
  els.closeTableModalBtn.addEventListener('click', closeTableModal);
}

if (els.tableModal) {
  els.tableModal.addEventListener('click', (event) => {
    if (event.target === els.tableModal) {
      closeTableModal();
    }
  });
}

if (els.closeDeleteTableModalBtn) {
  els.closeDeleteTableModalBtn.addEventListener('click', closeDeleteTableModal);
}

if (els.deleteTableModal) {
  els.deleteTableModal.addEventListener('click', (event) => {
    if (event.target === els.deleteTableModal) {
      closeDeleteTableModal();
    }
  });
}

if (els.closeDeleteDatabaseModalBtn) {
  els.closeDeleteDatabaseModalBtn.addEventListener('click', closeDeleteDatabaseModal);
}

if (els.deleteDatabaseModal) {
  els.deleteDatabaseModal.addEventListener('click', (event) => {
    if (event.target === els.deleteDatabaseModal) {
      closeDeleteDatabaseModal();
    }
  });
}

async function handleAction(action) {
  try {
    setStatus('OK', false);
    await action();
  } catch (error) {
    if (error && error.name === 'AbortError') {
      setStatus('OK', false);
      return;
    }
    if (action === runCurrentQuery) {
      renderQueryError(error.message);
      setStatus('Error', true);
      switchTab('query');
      return;
    }
    setStatus(error.message, true);
  }
}

fillConnectionForm(null);
renderQueryTabs();
syncFilterControls();
updateFilterValueState();
setSidebarCollapsed(false);
renderSqlHistoryPanel();
initWorkspaceResize();
initQueryResultResize();
initColumnResize();
initDataTableAutoResize();
loadMonaco().then(() => {
  updateEditorDialect();
}).catch((error) => {
  setStatus(error.message, true);
});
handleAction(loadConnections);
