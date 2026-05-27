const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const multer = require('multer');
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const {
  MongoClient,
  ObjectId,
  Long,
  Int32,
  Decimal128
} = require('mongodb');
const XLSX = require('xlsx');

const app = express();
const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const connectionsFile = path.join(dataDir, 'connections.json');
const encryptionKeyFile = path.join(dataDir, 'encryption.key');
const encryptedSecretPrefix = 'enc:v1:';
let cachedEncryptionKey = null;

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(connectionsFile)) {
  fs.writeFileSync(connectionsFile, '[]', 'utf8');
}

const upload = multer({ dest: uploadsDir });

app.use(express.json({ limit: '5mb' }));
app.use('/monaco', express.static(path.join(__dirname, 'node_modules', 'monaco-editor', 'min', 'vs')));
app.use('/monaco/vs', express.static(path.join(__dirname, 'node_modules', 'monaco-editor', 'min', 'vs')));
app.use(express.static(path.join(__dirname, 'public')));

function readConnections() {
  return JSON.parse(fs.readFileSync(connectionsFile, 'utf8'));
}

function writeConnections(items) {
  const safeItems = items.map(encryptConnectionForStorage);
  fs.writeFileSync(connectionsFile, JSON.stringify(safeItems, null, 2), 'utf8');
}

function getEncryptionKey() {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  if (!fs.existsSync(encryptionKeyFile)) {
    fs.writeFileSync(encryptionKeyFile, crypto.randomBytes(32).toString('hex'), 'utf8');
  }

  const key = fs.readFileSync(encryptionKeyFile, 'utf8').trim();
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Invalid connection encryption key');
  }

  cachedEncryptionKey = keyBuffer;
  return cachedEncryptionKey;
}

function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(encryptedSecretPrefix);
}

function encryptSecret(value) {
  if (value === undefined || value === null || value === '' || isEncryptedSecret(value)) {
    return value || '';
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${encryptedSecretPrefix}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(value) {
  if (!isEncryptedSecret(value)) {
    return value || '';
  }

  const payload = value.slice(encryptedSecretPrefix.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted connection password');
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]).toString('utf8');
}

function encryptConnectionForStorage(connection) {
  return {
    ...connection,
    password: encryptSecret(connection.password)
  };
}

function decryptConnection(connection) {
  return {
    ...connection,
    password: decryptSecret(connection.password)
  };
}

function migrateConnectionPasswords() {
  const items = readConnections();
  if (items.some((item) => item.password && !isEncryptedSecret(item.password))) {
    writeConnections(items);
  }
}

migrateConnectionPasswords();

function sanitizeConnection(connection) {
  const normalizedType = normalizeConnectionType(connection.type);
  return {
    id: connection.id,
    name: connection.name,
    type: normalizedType,
    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.username,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt
  };
}

function normalizeConnectionType(type) {
  const raw = String(type || '').trim().toLowerCase();
  if (raw === 'postgresql' || raw === 'postgres' || raw === 'pg') {
    return 'postgres';
  }
  if (raw === 'mongodb' || raw === 'mongo' || raw === 'mongodb+srv') {
    return 'mongodb';
  }
  if (raw === 'selectdb' || raw === 'select_db' || raw === 'select-db') {
    return 'selectdb';
  }
  if (raw === 'mysql') {
    return 'mysql';
  }
  return raw;
}

function normalizeConnection(connection) {
  return {
    ...connection,
    type: normalizeConnectionType(connection.type)
  };
}

function getConnectionById(id) {
  const connection = readConnections().find((item) => item.id === id);
  if (!connection) {
    const error = new Error('Connection not found');
    error.status = 404;
    throw error;
  }
  return normalizeConnection(decryptConnection(connection));
}

function quoteIdentifier(type, identifier) {
  if (!identifier) {
    throw new Error('Identifier is required');
  }
  const safe = String(identifier);
  if (!/^[A-Za-z0-9_]+$/.test(safe)) {
    throw new Error('Invalid identifier');
  }
  return type === 'postgres' ? `"${safe}"` : `\`${safe}\``;
}

function buildQualifiedName(type, schema, table) {
  if (type === 'postgres' && schema) {
    return `${quoteIdentifier(type, schema)}.${quoteIdentifier(type, table)}`;
  }
  return quoteIdentifier(type, table);
}

function toPlainRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row) => JSON.parse(JSON.stringify(row)));
}

function getFilterConfig(type, filter) {
  const allowedOperators = ['contains', 'equals', 'startsWith', 'endsWith', 'isNull', 'isNotNull'];
  if (!filter || !filter.column || allowedOperators.indexOf(filter.operator) === -1) {
    return null;
  }

  const column = quoteIdentifier(type, filter.column);
  const operator = filter.operator;
  const rawValue = filter.value === undefined || filter.value === null ? '' : String(filter.value);

  if (type === 'postgres') {
    if (operator === 'isNull') {
      return { clause: `${column} IS NULL`, params: [] };
    }
    if (operator === 'isNotNull') {
      return { clause: `${column} IS NOT NULL`, params: [] };
    }
    if (operator === 'equals') {
      return { clause: `${column}::text = $1`, params: [rawValue] };
    }
    if (operator === 'contains') {
      return { clause: `${column}::text ILIKE $1`, params: [`%${rawValue}%`] };
    }
    if (operator === 'startsWith') {
      return { clause: `${column}::text ILIKE $1`, params: [`${rawValue}%`] };
    }
    if (operator === 'endsWith') {
      return { clause: `${column}::text ILIKE $1`, params: [`%${rawValue}`] };
    }
  }

  if (operator === 'isNull') {
    return { clause: `${column} IS NULL`, params: [] };
  }
  if (operator === 'isNotNull') {
    return { clause: `${column} IS NOT NULL`, params: [] };
  }
  if (operator === 'equals') {
    return { clause: `CAST(${column} AS CHAR) = ?`, params: [rawValue] };
  }
  if (operator === 'contains') {
    return { clause: `CAST(${column} AS CHAR) LIKE ?`, params: [`%${rawValue}%`] };
  }
  if (operator === 'startsWith') {
    return { clause: `CAST(${column} AS CHAR) LIKE ?`, params: [`${rawValue}%`] };
  }
  if (operator === 'endsWith') {
    return { clause: `CAST(${column} AS CHAR) LIKE ?`, params: [`%${rawValue}`] };
  }

  return null;
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
  const statements = normalized.split(';').map((item) => item.trim()).filter(Boolean);
  statements.forEach((statement) => {
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

function splitSqlStatements(sql) {
  const text = String(sql || '');
  const statements = [];
  let current = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === '\n') {
        inLineComment = false;
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i += 2;
        inBlockComment = false;
        continue;
      }
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '-' && next === '-') {
        current += ch + next;
        i += 2;
        inLineComment = true;
        continue;
      }
      if (ch === '#') {
        current += ch;
        i += 1;
        inLineComment = true;
        continue;
      }
      if (ch === '/' && next === '*') {
        current += ch + next;
        i += 2;
        inBlockComment = true;
        continue;
      }
    }

    if (ch === "'" && !inDouble && !inBacktick) {
      // Handle escaped single quote ('')
      if (inSingle && next === "'") {
        current += ch + next;
        i += 2;
        continue;
      }
      inSingle = !inSingle;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && !inSingle && !inBacktick) {
      // Handle escaped double quote ("")
      if (inDouble && next === '"') {
        current += ch + next;
        i += 2;
        continue;
      }
      inDouble = !inDouble;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === ';' && !inSingle && !inDouble && !inBacktick) {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

async function resolveSelectDbDefaultDatabase(client) {
  const [rows] = await client.query('SHOW DATABASES');
  const names = (rows || []).map((row) => {
    const firstKey = Object.keys(row || {})[0];
    return firstKey ? String(row[firstKey]) : '';
  }).filter(Boolean);
  const preferred = names.find((name) => !['information_schema', '__internal_schema'].includes(name.toLowerCase()));
  return preferred || names[0] || '';
}

async function executeMongoShellScript(db, script) {
  const results = [];
  const pendingOps = [];
  const pushResult = (action, detail) => {
    results.push({
      action,
      ...detail
    });
  };

  const collectionProxyCache = new Map();
  const getCollectionProxy = (collectionName) => {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    const safeName = String(collectionName);
    if (collectionProxyCache.has(safeName)) {
      return collectionProxyCache.get(safeName);
    }
    const collection = db.collection(safeName);
    const proxy = {
      createIndex: (keys, options) => {
        const op = (async () => {
        const indexName = await collection.createIndex(keys || {}, options || {});
        pushResult('createIndex', { collection: safeName, indexName });
        return indexName;
        })();
        pendingOps.push(op);
        return op;
      },
      insertOne: (document, options) => {
        const op = (async () => {
        const result = await collection.insertOne(document || {}, options || {});
        pushResult('insertOne', { collection: safeName, insertedId: result.insertedId, acknowledged: result.acknowledged });
        return result;
        })();
        pendingOps.push(op);
        return op;
      },
      updateOne: (filter, update, options) => {
        const op = (async () => {
        const result = await collection.updateOne(filter || {}, update || {}, options || {});
        pushResult('updateOne', {
          collection: safeName,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          acknowledged: result.acknowledged
        });
        return result;
        })();
        pendingOps.push(op);
        return op;
      },
      deleteOne: (filter, options) => {
        const op = (async () => {
        const result = await collection.deleteOne(filter || {}, options || {});
        pushResult('deleteOne', { collection: safeName, deletedCount: result.deletedCount, acknowledged: result.acknowledged });
        return result;
        })();
        pendingOps.push(op);
        return op;
      },
      find: (filter, options) => collection.find(filter || {}, options || {}),
      aggregate: (pipeline, options) => collection.aggregate(Array.isArray(pipeline) ? pipeline : [], options || {})
    };
    collectionProxyCache.set(safeName, proxy);
    return proxy;
  };

  const dbProxy = new Proxy({
    createCollection: (collectionName, options) => {
      const op = (async () => {
        const created = await db.createCollection(String(collectionName || ''), options || {});
        pushResult('createCollection', { collection: created.collectionName, ok: 1 });
        return created;
      })();
      pendingOps.push(op);
      return op;
    }
  }, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      if (typeof prop === 'string') {
        return getCollectionProxy(prop);
      }
      return undefined;
    }
  });

  const sandbox = {
    db: dbProxy,
    ObjectId: (value) => (value ? new ObjectId(value) : new ObjectId()),
    NumberLong: (value) => Long.fromString(String(value)),
    NumberInt: (value) => new Int32(Number(value)),
    NumberDecimal: (value) => Decimal128.fromString(String(value)),
    ISODate: (value) => (value ? new Date(value) : new Date())
  };

  const wrappedScript = `(async () => { ${String(script || '')}\n })()`;
  const runner = new vm.Script(wrappedScript, { filename: 'mongo-shell.js' });
  await runner.runInNewContext(sandbox, { timeout: 5000 });
  if (pendingOps.length) {
    await Promise.all(pendingOps);
  }
  return results;
}

async function withClient(connection, handler) {
  const activeConnection = normalizeConnection(decryptConnection(connection));

  if (activeConnection.type === 'mysql') {
    const client = await mysql.createConnection({
      host: activeConnection.host,
      port: Number(activeConnection.port) || 3306,
      user: activeConnection.username,
      password: activeConnection.password,
      database: activeConnection.database,
      multipleStatements: false
    });
    try {
      return await handler({
        type: 'mysql',
        query: (sql, params) => client.query(sql, params)
      });
    } finally {
      await client.end();
    }
  }

  if (activeConnection.type === 'selectdb') {
    const client = await mysql.createConnection({
      host: activeConnection.host,
      port: Number(activeConnection.port) || 9030,
      user: activeConnection.username,
      password: activeConnection.password,
      database: activeConnection.database,
      multipleStatements: false
    });
    try {
      if (!activeConnection.database) {
        const fallbackDb = await resolveSelectDbDefaultDatabase(client);
        if (fallbackDb) {
          await client.query(`USE ${quoteIdentifier('mysql', fallbackDb)}`);
        }
      }
      return await handler({
        type: 'mysql',
        query: (sql, params) => client.query(sql, params)
      });
    } finally {
      await client.end();
    }
  }

  if (activeConnection.type === 'postgres') {
    const pool = new Pool({
      host: activeConnection.host,
      port: Number(activeConnection.port) || 5432,
      user: activeConnection.username,
      password: activeConnection.password,
      database: activeConnection.database,
      max: 1,
      idleTimeoutMillis: 1000
    });
    const client = await pool.connect();
    try {
      return await handler({
        type: 'postgres',
        query: async (sql, params) => {
          const result = await client.query(sql, params);
          return [result.rows, result];
        }
      });
    } finally {
      client.release();
      await pool.end();
    }
  }

  if (activeConnection.type === 'mongodb') {
    const client = new MongoClient(`mongodb://${activeConnection.host}:${Number(activeConnection.port) || 27017}`, {
      auth: activeConnection.username ? {
        username: activeConnection.username,
        password: activeConnection.password || ''
      } : undefined
    });
    await client.connect();
    try {
      return await handler({
        type: 'mongodb',
        db: (dbName) => client.db(dbName || activeConnection.database || 'admin')
      });
    } finally {
      await client.close();
    }
  }

  throw new Error(`Unsupported database type: ${activeConnection.type}`);
}

async function withCancelableClient(connection, handler) {
  const activeConnection = normalizeConnection(decryptConnection(connection));

  if (activeConnection.type === 'mysql') {
    const client = await mysql.createConnection({
      host: activeConnection.host,
      port: Number(activeConnection.port) || 3306,
      user: activeConnection.username,
      password: activeConnection.password,
      database: activeConnection.database,
      multipleStatements: false
    });
    let cancelled = false;
    try {
      return await handler({
        type: 'mysql',
        query: (sql, params) => client.query(sql, params),
        cancel: async () => {
          if (!cancelled) {
            cancelled = true;
            client.destroy();
          }
        }
      });
    } finally {
      if (!cancelled) {
        await client.end();
      }
    }
  }

  if (activeConnection.type === 'selectdb') {
    const client = await mysql.createConnection({
      host: activeConnection.host,
      port: Number(activeConnection.port) || 9030,
      user: activeConnection.username,
      password: activeConnection.password,
      database: activeConnection.database,
      multipleStatements: false
    });
    let cancelled = false;
    try {
      if (!activeConnection.database) {
        const fallbackDb = await resolveSelectDbDefaultDatabase(client);
        if (fallbackDb) {
          await client.query(`USE ${quoteIdentifier('mysql', fallbackDb)}`);
        }
      }
      return await handler({
        type: 'mysql',
        query: (sql, params) => client.query(sql, params),
        cancel: async () => {
          if (!cancelled) {
            cancelled = true;
            client.destroy();
          }
        }
      });
    } finally {
      if (!cancelled) {
        await client.end();
      }
    }
  }

  if (activeConnection.type === 'postgres') {
    const pool = new Pool({
      host: activeConnection.host,
      port: Number(activeConnection.port) || 5432,
      user: activeConnection.username,
      password: activeConnection.password,
      database: activeConnection.database,
      max: 1,
      idleTimeoutMillis: 1000
    });
    const client = await pool.connect();
    try {
      return await handler({
        type: 'postgres',
        query: async (sql, params) => {
          const result = await client.query(sql, params);
          return [result.rows, result];
        },
        cancel: async () => {
          const cancelPool = new Pool({
            host: activeConnection.host,
            port: Number(activeConnection.port) || 5432,
            user: activeConnection.username,
            password: activeConnection.password,
            database: activeConnection.database,
            max: 1,
            idleTimeoutMillis: 1000
          });
          try {
            await cancelPool.query('SELECT pg_cancel_backend($1)', [client.processID]);
          } finally {
            await cancelPool.end();
          }
        }
      });
    } finally {
      client.release();
      await pool.end();
    }
  }

  if (activeConnection.type === 'mongodb') {
    const client = new MongoClient(`mongodb://${activeConnection.host}:${Number(activeConnection.port) || 27017}`, {
      auth: activeConnection.username ? {
        username: activeConnection.username,
        password: activeConnection.password || ''
      } : undefined
    });
    await client.connect();
    try {
      return await handler({
        type: 'mongodb',
        db: (dbName) => client.db(dbName || activeConnection.database || 'admin'),
        cancel: async () => {}
      });
    } finally {
      await client.close();
    }
  }

  throw new Error(`Unsupported database type: ${activeConnection.type}`);
}

async function testConnection(connection) {
  return withClient(connection, async (client) => {
    if (client.type === 'mongodb') {
      await client.db().command({ ping: 1 });
    } else if (client.type === 'mysql') {
      await client.query('SELECT 1');
    } else {
      await client.query('SELECT 1');
    }
    return true;
  });
}

function createObjectGroups() {
  return {
    tables: [],
    views: [],
    functions: [],
    procedures: []
  };
}

async function listConnectionObjects(connection) {
  if (connection.type === 'selectdb') {
    return withClient(connection, async (client) => {
      const [databaseRows] = await client.query('SHOW DATABASES');
      const databases = (databaseRows || []).map((row) => {
        const firstKey = Object.keys(row || {})[0];
        return firstKey ? String(row[firstKey]) : '';
      }).filter(Boolean);

      const catalogs = [];
      for (const databaseName of databases) {
        const groups = createObjectGroups();
        const [tableRows] = await client.query(`SHOW FULL TABLES FROM ${quoteIdentifier('mysql', databaseName)}`);
        (tableRows || []).forEach((row) => {
          const keys = Object.keys(row || {});
          const nameKey = keys.find((key) => key.toLowerCase().includes('tables_in_')) || keys[0];
          const typeKey = keys.find((key) => key.toLowerCase().includes('table_type')) || keys[1];
          const name = nameKey ? row[nameKey] : '';
          const tableType = typeKey ? String(row[typeKey] || '').toUpperCase() : 'BASE TABLE';
          if (!name) {
            return;
          }
          if (tableType === 'VIEW') {
            groups.views.push({ name });
          } else {
            groups.tables.push({ name });
          }
        });
        catalogs.push({
          name: databaseName,
          type: 'database',
          groups
        });
      }
      return catalogs;
    });
  }

  if (connection.type === 'mongodb') {
    return withClient(connection, async (client) => {
      const adminDb = client.db('admin');
      const dbResult = await adminDb.admin().listDatabases();
      const databases = (dbResult.databases || []).map((item) => item.name).sort();
      const catalogs = [];
      for (const databaseName of databases) {
        const collections = await client.db(databaseName).listCollections({}, { nameOnly: true }).toArray();
        catalogs.push({
          name: databaseName,
          type: 'database',
          groups: {
            tables: collections.map((item) => ({ name: item.name })).sort((a, b) => a.name.localeCompare(b.name)),
            views: [],
            functions: [],
            procedures: []
          }
        });
      }
      return catalogs;
    });
  }

  if (connection.type === 'mysql') {
    return withClient(connection, async (client) => {
      const [databaseRows] = await client.query(
        `SELECT SCHEMA_NAME AS databaseName
         FROM information_schema.schemata
         ORDER BY SCHEMA_NAME`
      );
      const databases = databaseRows.map((row) => row.databaseName);
      if (!databases.length) {
        return [];
      }

      const placeholders = databases.map(() => '?').join(', ');
      const [tableRows] = await client.query(
        `SELECT TABLE_SCHEMA AS databaseName, TABLE_NAME AS objectName, TABLE_TYPE AS tableType
         FROM information_schema.tables
         WHERE TABLE_SCHEMA IN (${placeholders})
         ORDER BY TABLE_SCHEMA, TABLE_NAME`,
        databases
      );
      const [routineRows] = await client.query(
        `SELECT ROUTINE_SCHEMA AS databaseName, ROUTINE_NAME AS routineName, ROUTINE_TYPE AS routineType
         FROM information_schema.routines
         WHERE ROUTINE_SCHEMA IN (${placeholders})
         ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME`,
        databases
      );

      return databases.map((databaseName) => {
        const groups = createObjectGroups();
        tableRows.filter((row) => row.databaseName === databaseName).forEach((row) => {
          const item = { name: row.objectName };
          if (row.tableType === 'VIEW') {
            groups.views.push(item);
          } else {
            groups.tables.push(item);
          }
        });
        routineRows.filter((row) => row.databaseName === databaseName).forEach((row) => {
          const item = { name: row.routineName };
          if (row.routineType === 'PROCEDURE') {
            groups.procedures.push(item);
          } else {
            groups.functions.push(item);
          }
        });
        return {
          name: databaseName,
          type: 'database',
          groups
        };
      });
    });
  }

  return withClient(connection, async (client) => {
    const [databaseRows] = await client.query(
      `SELECT datname AS "databaseName"
       FROM pg_database
       WHERE datistemplate = false AND datallowconn = true
       ORDER BY datname`
    );

    const catalogs = [];
    for (const databaseRow of databaseRows) {
      const databaseName = databaseRow.databaseName;
      const catalogConnection = { ...connection, database: databaseName };
      const catalog = await withClient(catalogConnection, async (catalogClient) => {
        const [schemaRows] = await catalogClient.query(
          `SELECT schema_name AS "schemaName"
           FROM information_schema.schemata
           WHERE schema_name NOT IN ('information_schema')
             AND schema_name NOT LIKE 'pg_%'
           ORDER BY schema_name`
        );
        const [tableRows] = await catalogClient.query(
          `SELECT table_schema AS "schemaName", table_name AS "objectName", table_type AS "tableType"
           FROM information_schema.tables
           WHERE table_schema NOT IN ('information_schema')
             AND table_schema NOT LIKE 'pg_%'
           ORDER BY table_schema, table_name`
        );
        const [routineRows] = await catalogClient.query(
          `SELECT routine_schema AS "schemaName", routine_name AS "routineName", routine_type AS "routineType"
           FROM information_schema.routines
           WHERE routine_schema NOT IN ('information_schema')
             AND routine_schema NOT LIKE 'pg_%'
           ORDER BY routine_schema, routine_name`
        );

        return {
          name: databaseName,
          type: 'database',
          schemas: schemaRows.map((schemaRow) => {
            const groups = createObjectGroups();
            tableRows.filter((row) => row.schemaName === schemaRow.schemaName).forEach((row) => {
              const item = { name: row.objectName };
              if (row.tableType === 'VIEW') {
                groups.views.push(item);
              } else {
                groups.tables.push(item);
              }
            });
            routineRows.filter((row) => row.schemaName === schemaRow.schemaName).forEach((row) => {
              const item = { name: row.routineName };
              if (row.routineType === 'PROCEDURE') {
                groups.procedures.push(item);
              } else {
                groups.functions.push(item);
              }
            });
            return {
              name: schemaRow.schemaName,
              type: 'schema',
              groups
            };
          })
        };
      });
      catalogs.push(catalog);
    }

    return catalogs;
  });
}

async function listColumns(connection, schema, table) {
  const targetDatabase = connection.database;
  return withClient(connection, async (client) => {
    if (client.type === 'mongodb') {
      const sampleDocs = await client.db(targetDatabase).collection(table).find({}, { limit: 200 }).toArray();
      const keyTypes = new Map();
      sampleDocs.forEach((doc) => {
        Object.keys(doc || {}).forEach((key) => {
          const value = doc[key];
          const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
          if (!keyTypes.has(key)) {
            keyTypes.set(key, new Set());
          }
          keyTypes.get(key).add(type);
        });
      });
      return Array.from(keyTypes.entries()).map(([columnName, types]) => ({
        columnName,
        columnType: Array.from(types).join('|') || 'mixed',
        isNullable: 'YES',
        columnKey: columnName === '_id' ? 'PRI' : '',
        columnDefault: null,
        autoIncrement: false
      }));
    }

    if (client.type === 'mysql') {
      const [rows] = await client.query(
        `SELECT COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable,
                COLUMN_KEY AS columnKey, COLUMN_DEFAULT AS columnDefault, EXTRA AS extra
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position`,
        [targetDatabase, table]
      );
      return rows.map((row) => ({
        ...row,
        autoIncrement: String(row.extra || '').toLowerCase().includes('auto_increment')
      }));
    }

    const [rows] = await client.query(
      `SELECT c.column_name AS "columnName", c.data_type AS "columnType", c.is_nullable AS "isNullable",
              c.column_default AS "columnDefault",
              c.is_identity AS "isIdentity",
              CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRI' ELSE '' END AS "columnKey"
       FROM information_schema.columns c
       LEFT JOIN information_schema.key_column_usage kcu
         ON c.table_schema = kcu.table_schema
        AND c.table_name = kcu.table_name
        AND c.column_name = kcu.column_name
       LEFT JOIN information_schema.table_constraints tc
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
        AND kcu.table_name = tc.table_name
       WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY ordinal_position`,
      [schema || 'public', table]
    );
    return rows.map((row) => ({
      ...row,
      autoIncrement: String(row.isIdentity || '').toUpperCase() === 'YES'
        || String(row.columnDefault || '').toLowerCase().includes('nextval(')
    }));
  });
}

async function getTableDetails(connection, schema, table) {
  return withClient(connection, async (client) => {
    if (client.type === 'mysql') {
      let info = null;
      let ddl = '';
      try {
        const [infoRows] = await client.query(
          `SELECT ENGINE AS engine,
                  CREATE_TIME AS createTime,
                  TABLE_COLLATION AS collation,
                  AUTO_INCREMENT AS autoIncrement,
                  INDEX_LENGTH AS indexLength,
                  DATA_LENGTH AS dataLength
           FROM information_schema.tables
           WHERE table_schema = ? AND table_name = ?
           LIMIT 1`,
          [connection.database, table]
        );
        info = infoRows[0] || null;
      } catch (error) {
      }
      try {
        const [ddlRows] = await client.query(`SHOW CREATE TABLE ${quoteIdentifier(connection.type, table)}`);
        const ddlRow = Array.isArray(ddlRows) && ddlRows[0] ? ddlRows[0] : null;
        ddl = ddlRow ? (ddlRow['Create Table'] || ddlRow['Create View'] || '') : '';
      } catch (error) {
      }
      return {
        info,
        ddl
      };
    }

    const targetSchema = schema || 'public';
    let info = null;
    let ddl = '';
    try {
      const [infoRows] = await client.query(
        `SELECT current_setting('server_encoding') AS engine,
                NULL::text AS "createTime",
                current_setting('lc_collate') AS collation,
                pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS "autoIncrement",
                COALESCE(pg_total_relation_size(c.oid) - pg_relation_size(c.oid), 0) AS "indexLength",
                COALESCE(pg_relation_size(c.oid), 0) AS "dataLength"
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary = true
         LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
         WHERE n.nspname = $1 AND c.relname = $2
         LIMIT 1`,
        [targetSchema, table]
      );
      info = infoRows[0] || null;
    } catch (error) {
    }
    try {
      const [ddlRows] = await client.query(
        `SELECT (
            pg_get_tabledef_stub.nsp_prefix
            || pg_get_tabledef_stub.table_name
            || E' (\n'
            || pg_get_tabledef_stub.columns_sql
            || E'\n)'
            || pg_get_tabledef_stub.index_sql
          ) AS ddl
         FROM (
           SELECT quote_ident(n.nspname) || '.' AS nsp_prefix,
                  quote_ident(c.relname) AS table_name,
                  string_agg(
                    '  ' || quote_ident(a.attname) || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod)
                    || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
                    || CASE WHEN pg_get_expr(ad.adbin, ad.adrelid) IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END,
                    E',\n' ORDER BY a.attnum
                  ) AS columns_sql,
                  COALESCE((
                    SELECT E'\n\n' || string_agg(pg_get_indexdef(i.indexrelid), E';\n') || E';'
                    FROM pg_index i
                    WHERE i.indrelid = c.oid
                  ), '') AS index_sql
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
           LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
           WHERE n.nspname = $1 AND c.relname = $2
           GROUP BY n.nspname, c.relname, c.oid
         ) AS pg_get_tabledef_stub`,
        [targetSchema, table]
      );
      ddl = ddlRows[0] ? ddlRows[0].ddl : '';
    } catch (error) {
    }
    return {
      info,
      ddl
    };
  });
}

function normalizeValue(value) {
  if (value === '') {
    return null;
  }
  return value;
}

function formatColumnDefault(column) {
  const mode = column.defaultMode || 'value';
  if (mode === 'null') {
    return 'NULL';
  }
  if (mode === 'expression') {
    const expression = String(column.columnDefault || '').trim();
    if (!expression || /;/.test(expression)) {
      throw new Error('Invalid default expression');
    }
    return expression;
  }
  if (column.columnDefault === null || column.columnDefault === undefined || column.columnDefault === '') {
    return 'NULL';
  }
  return `'${String(column.columnDefault).replace(/'/g, "''")}'`;
}

function buildColumnDefinition(type, column) {
  const parts = [quoteIdentifier(type, column.columnName), String(column.columnType).trim()];
  parts.push(column.allowNull ? 'NULL' : 'NOT NULL');
  if (column.hasDefault) {
    parts.push(`DEFAULT ${formatColumnDefault(column)}`);
  }
  if (column.isPrimaryKey) {
    parts.push('PRIMARY KEY');
  }
  if (column.autoIncrement && column.isPrimaryKey) {
    if (type === 'postgres') {
      parts.push('GENERATED BY DEFAULT AS IDENTITY');
    } else {
      parts.push('AUTO_INCREMENT');
    }
  }
  return parts.join(' ');
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  function parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseLine(line));
  return { headers, rows };
}

function inferColumnType(type, values) {
  const samples = values
    .map((value) => value === undefined || value === null ? '' : String(value).trim())
    .filter((value) => value !== '');
  if (!samples.length) {
    return type === 'postgres' ? 'text' : 'varchar(255)';
  }

  const isInteger = samples.every((value) => /^-?\d+$/.test(value));
  if (isInteger) {
    return type === 'postgres' ? 'bigint' : 'bigint';
  }

  const isDecimal = samples.every((value) => /^-?\d+(\.\d+)?$/.test(value));
  if (isDecimal) {
    return type === 'postgres' ? 'numeric(18,4)' : 'decimal(18,4)';
  }

  return type === 'postgres' ? 'text' : 'varchar(255)';
}

async function createTableFromCsv(connection, schema, table, headers, rows) {
  const normalizedHeaders = headers.map((header, index) => {
    const value = String(header || '').trim();
    if (!value) {
      throw new Error(`CSV 第 ${index + 1} 列缺少表头`);
    }
    return value;
  });
  const duplicatedHeader = normalizedHeaders.find((header, index) => normalizedHeaders.indexOf(header) !== index);
  if (duplicatedHeader) {
    throw new Error(`CSV 表头重复: ${duplicatedHeader}`);
  }

  const tableName = buildQualifiedName(connection.type, schema, table);
  const columnDefinitions = normalizedHeaders.map((header, index) => {
    const values = rows.map((row) => row[index]);
    return `${quoteIdentifier(connection.type, header)} ${inferColumnType(connection.type, values)} NULL`;
  });

  await withClient(connection, async (client) => {
    await client.query(`CREATE TABLE ${tableName} (${columnDefinitions.join(', ')})`);
    const quotedColumns = normalizedHeaders.map((header) => quoteIdentifier(connection.type, header));
    for (const row of rows) {
      const placeholders = normalizedHeaders.map((_, index) => connection.type === 'postgres' ? `$${index + 1}` : '?');
      await client.query(
        `INSERT INTO ${tableName} (${quotedColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
        normalizedHeaders.map((_, index) => normalizeValue(row[index]))
      );
    }
  });
}

function buildTableNameFromFilename(filename) {
  const rawName = path.parse(String(filename || '')).name.trim().toLowerCase();
  const normalized = rawName
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  if (!normalized) {
    throw new Error('鏃犳硶浠庢枃浠跺悕鐢熸垚琛ㄥ悕锛岃浣跨敤浠呭寘鍚瓧姣嶃€佹暟瀛椼€佷笅鍒掔嚎鐨勬枃浠跺悕');
  }
  if (!/^[a-z_]/.test(normalized)) {
    return `t_${normalized}`;
  }
  return normalized;
}

function toCsv(rows) {
  if (!rows.length) {
    return '';
  }
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    const text = String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return [headers.join(',')]
    .concat(rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')))
    .join('\n');
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/connections', (req, res) => {
  res.json(readConnections().map(sanitizeConnection));
});

app.post('/api/connections/test', async (req, res, next) => {
  try {
    await testConnection(normalizeConnection(req.body || {}));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/connections', async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const connection = {
      id: `conn_${Date.now()}`,
      name: req.body.name,
      type: normalizeConnectionType(req.body.type),
      host: req.body.host,
      port: req.body.port,
      database: req.body.database,
      username: req.body.username,
      password: req.body.password,
      createdAt: now,
      updatedAt: now
    };
    await testConnection(connection);
    const items = readConnections();
    items.push(connection);
    writeConnections(items);
    res.status(201).json(sanitizeConnection(connection));
  } catch (error) {
    next(error);
  }
});

app.put('/api/connections/:id', async (req, res, next) => {
  try {
    const items = readConnections();
    const index = items.findIndex((item) => item.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    const updated = {
      ...items[index],
      ...req.body,
      type: normalizeConnectionType(req.body.type || items[index].type),
      id: items[index].id,
      updatedAt: new Date().toISOString()
    };
    await testConnection(updated);
    items[index] = updated;
    writeConnections(items);
    res.json(sanitizeConnection(updated));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/connections/:id', (req, res) => {
  const items = readConnections();
  const nextItems = items.filter((item) => item.id !== req.params.id);
  writeConnections(nextItems);
  res.status(204).end();
});

app.get('/api/connections/:id/schema', async (req, res, next) => {
  try {
    const connection = getConnectionById(req.params.id);
    const catalogs = await listConnectionObjects(connection);
    res.json({ catalogs });
  } catch (error) {
    next(error);
  }
});

app.post('/api/connections/:id/databases', async (req, res, next) => {
  try {
    const connection = getConnectionById(req.params.id);
    const databaseName = String(req.body.databaseName || '').trim();
    if (!databaseName) {
      return res.status(400).json({ message: 'databaseName is required' });
    }
    const quoted = quoteIdentifier(connection.type, databaseName);

    if (connection.type === 'mysql') {
      await withClient({ ...connection, database: undefined }, async (client) => {
        await client.query(`CREATE DATABASE ${quoted}`);
      });
    } else {
      await withClient({ ...connection, database: 'postgres' }, async (client) => {
        await client.query(`CREATE DATABASE ${quoted}`);
      });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.put('/api/connections/:id/databases/:database', async (req, res, next) => {
  try {
    const connection = getConnectionById(req.params.id);
    const nextDatabaseName = String(req.body.databaseName || '').trim();
    if (!nextDatabaseName) {
      return res.status(400).json({ message: 'databaseName is required' });
    }
    const currentQuoted = quoteIdentifier(connection.type, req.params.database);
    const nextQuoted = quoteIdentifier(connection.type, nextDatabaseName);

    if (connection.type === 'mysql') {
      await withClient({ ...connection, database: undefined }, async (client) => {
        await client.query(`ALTER DATABASE ${currentQuoted} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
      });
      return res.status(400).json({ message: 'MySQL 涓嶆敮鎸佺洿鎺ラ噸鍛藉悕鏁版嵁搴擄紝璇锋柊寤哄悗杩佺Щ鏁版嵁' });
    }

    await withClient({ ...connection, database: 'postgres' }, async (client) => {
      await client.query(`ALTER DATABASE ${currentQuoted} RENAME TO ${nextQuoted}`);
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/connections/:id/databases/:database', async (req, res, next) => {
  try {
    const connection = getConnectionById(req.params.id);
    const quoted = quoteIdentifier(connection.type, req.params.database);

    if (connection.type === 'mysql') {
      await withClient({ ...connection, database: undefined }, async (client) => {
        await client.query(`DROP DATABASE ${quoted}`);
      });
    } else {
      await withClient({ ...connection, database: 'postgres' }, async (client) => {
        await client.query(`DROP DATABASE ${quoted}`);
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/connections/:id/tables/:table/columns', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.query.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const columns = await listColumns(connection, req.query.schema, req.params.table);
    res.json({ columns });
  } catch (error) {
    next(error);
  }
});

app.get('/api/connections/:id/tables/:table/details', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.query.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const details = await getTableDetails(connection, req.query.schema, req.params.table);
    res.json(details);
  } catch (error) {
    next(error);
  }
});

app.post('/api/connections/:id/tables/:table/columns', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const schema = req.body.schema;
    const tableName = buildQualifiedName(connection.type, schema, req.params.table);
    const definition = buildColumnDefinition(connection.type, req.body);

    await withClient(connection, async (client) => {
      if (req.body.isPrimaryKey) {
        const existingColumns = await listColumns(connection, schema, req.params.table);
        const hasPrimaryKey = existingColumns.some((column) => String(column.columnKey || '').toUpperCase() === 'PRI');
        if (hasPrimaryKey) {
          throw new Error('该表已存在主键，暂不支持在此页面新增第二个主键字段');
        }
      }
      await client.query(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
    });

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.put('/api/connections/:id/tables/:table/columns/:column', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const schema = req.body.schema;
    const tableName = buildQualifiedName(connection.type, schema, req.params.table);
    const definition = buildColumnDefinition(connection.type, req.body);

    await withClient(connection, async (client) => {
      const existingColumns = await listColumns(connection, schema, req.params.table);
      const currentColumn = existingColumns.find((column) => column.columnName === req.params.column);
      const wasPrimaryKey = !!currentColumn && String(currentColumn.columnKey || '').toUpperCase() === 'PRI';
      const willBePrimaryKey = !!req.body.isPrimaryKey;
      if (willBePrimaryKey) {
        const hasOtherPrimaryKey = existingColumns.some((column) =>
          String(column.columnKey || '').toUpperCase() === 'PRI' && column.columnName !== req.params.column
        );
        if (hasOtherPrimaryKey) {
          throw new Error('该表已存在其他主键字段，无法将当前字段设为主键');
        }
      }

      if (connection.type === 'mysql') {
        await client.query(`ALTER TABLE ${tableName} MODIFY COLUMN ${definition}`);
      } else {
        const originalName = quoteIdentifier(connection.type, req.params.column);
        const nextName = quoteIdentifier(connection.type, req.body.columnName);
        const nextPlainName = req.body.columnName;
        const pkConstraintName = `${req.params.table}_pkey`;
        if (req.params.column !== req.body.columnName) {
          await client.query(`ALTER TABLE ${tableName} RENAME COLUMN ${originalName} TO ${nextName}`);
        }
        await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${nextName} TYPE ${String(req.body.columnType).trim()}`);
        await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${nextName} ${req.body.allowNull ? 'DROP NOT NULL' : 'SET NOT NULL'}`);
        if (req.body.hasDefault) {
          await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${nextName} SET DEFAULT ${formatColumnDefault(req.body)}`);
        } else {
          await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${nextName} DROP DEFAULT`);
        }
        if (willBePrimaryKey && !wasPrimaryKey) {
          await client.query(`ALTER TABLE ${tableName} ADD CONSTRAINT ${quoteIdentifier(connection.type, pkConstraintName)} PRIMARY KEY (${nextName})`);
        } else if (!willBePrimaryKey && wasPrimaryKey) {
          await client.query(`ALTER TABLE ${tableName} DROP CONSTRAINT ${quoteIdentifier(connection.type, pkConstraintName)}`);
        }
        if (req.body.autoIncrement && willBePrimaryKey) {
          await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${quoteIdentifier(connection.type, nextPlainName)} ADD GENERATED BY DEFAULT AS IDENTITY`);
        } else if (!req.body.autoIncrement) {
          await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${quoteIdentifier(connection.type, nextPlainName)} DROP IDENTITY IF EXISTS`);
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/connections/:id/tables/:table/columns/:column', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const schema = req.body.schema;
    const tableName = buildQualifiedName(connection.type, schema, req.params.table);
    const columnName = quoteIdentifier(connection.type, req.params.column);

    await withClient(connection, async (client) => {
      await client.query(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/connections/:id/tables', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const schema = req.body.schema;
    const tableName = buildQualifiedName(connection.type, schema, req.body.tableName);
    const createSql = connection.type === 'postgres'
      ? `CREATE TABLE ${tableName} (id bigserial PRIMARY KEY)`
      : `CREATE TABLE ${tableName} (id bigint auto_increment PRIMARY KEY)`;
    await withClient(connection, async (client) => {
      await client.query(createSql);
    });
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.put('/api/connections/:id/tables/:table', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const schema = req.body.schema;
    const currentName = buildQualifiedName(connection.type, schema, req.params.table);
    const nextName = quoteIdentifier(connection.type, req.body.tableName);
    await withClient(connection, async (client) => {
      await client.query(`ALTER TABLE ${currentName} RENAME TO ${nextName}`);
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/connections/:id/tables/:table', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const schema = req.body.schema;
    const tableName = buildQualifiedName(connection.type, schema, req.params.table);
    await withClient(connection, async (client) => {
      if (req.body.dropTable) {
        await client.query(`DROP TABLE ${tableName}`);
      } else if (req.body.truncate) {
        await client.query(`TRUNCATE TABLE ${tableName}`);
      } else {
        await client.query(`DELETE FROM ${tableName}`);
      }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/connections/:id/query', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const sql = String(req.body.sql || '').trim();
    if (!sql) {
      return res.status(400).json({ message: 'SQL is required' });
    }
    const dangerWarnings = connection.type === 'mongodb' ? [] : analyzeDangerousSql(sql);
    if (dangerWarnings.length && req.body.confirmDangerous !== true) {
      return res.status(409).json({
        message: `危险 SQL 需要确认：${dangerWarnings.join('；')}`,
        dangerous: true,
        warnings: dangerWarnings
      });
    }

    let clientRef = null;
    let requestClosed = false;
    const handleClose = async () => {
      requestClosed = true;
      if (clientRef) {
        try {
          await clientRef.cancel();
        } catch (error) {
        }
      }
    };

    req.on('aborted', handleClose);

    const result = await withCancelableClient(connection, async (client) => {
      clientRef = client;
      const statements = splitSqlStatements(sql);
      if (!statements.length) {
        throw new Error('SQL is required');
      }

      let rows = [];
      let raw = null;
      const execution = [];

      if (client.type === 'mongodb') {
        let databaseName = String(connection.database || '').trim();
        if (!databaseName) {
          databaseName = 'admin';
        }
        let mongoRows = [];
        let action = 'script';
        try {
          const command = JSON.parse(sql);
          databaseName = String(command.database || databaseName || '').trim();
          if (!databaseName) {
            throw new Error('MongoDB command must include database (or set connection database)');
          }
          const db = client.db(databaseName);
          action = String(command.action || 'find').trim();
          if (action === 'createCollection') {
            const collectionName = String(command.collection || '').trim();
            if (!collectionName) {
              throw new Error('MongoDB command must include collection');
            }
            const result = await db.createCollection(collectionName, command.options || {});
            mongoRows = [{ ok: 1, collection: result.collectionName }];
          } else if (action === 'createIndex') {
            const collectionName = String(command.collection || '').trim();
            if (!collectionName) {
              throw new Error('MongoDB command must include collection');
            }
            if (!command.keys || typeof command.keys !== 'object' || Array.isArray(command.keys)) {
              throw new Error('MongoDB createIndex requires keys object');
            }
            const collection = db.collection(collectionName);
            const indexName = await collection.createIndex(command.keys, command.options || {});
            mongoRows = [{ ok: 1, collection: collectionName, indexName }];
          } else if (action === 'find') {
            const collectionName = String(command.collection || '').trim();
            if (!collectionName) {
              throw new Error('MongoDB command must include collection');
            }
            const collection = db.collection(collectionName);
            const cursor = collection.find(command.filter || {}, {
              projection: command.projection || undefined,
              sort: command.sort || undefined,
              limit: Number(command.limit) > 0 ? Number(command.limit) : undefined,
              skip: Number(command.skip) > 0 ? Number(command.skip) : undefined
            });
            mongoRows = await cursor.toArray();
          } else if (action === 'aggregate') {
            const collectionName = String(command.collection || '').trim();
            if (!collectionName) {
              throw new Error('MongoDB command must include collection');
            }
            const collection = db.collection(collectionName);
            mongoRows = await collection.aggregate(Array.isArray(command.pipeline) ? command.pipeline : []).toArray();
          } else if (action === 'insertOne') {
            const collectionName = String(command.collection || '').trim();
            if (!collectionName) {
              throw new Error('MongoDB command must include collection');
            }
            const collection = db.collection(collectionName);
            const result = await collection.insertOne(command.document || {});
            mongoRows = [{ acknowledged: result.acknowledged, insertedId: result.insertedId }];
          } else if (action === 'updateOne') {
            const collectionName = String(command.collection || '').trim();
            if (!collectionName) {
              throw new Error('MongoDB command must include collection');
            }
            const collection = db.collection(collectionName);
            const result = await collection.updateOne(command.filter || {}, command.update || {});
            mongoRows = [{ acknowledged: result.acknowledged, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
          } else if (action === 'deleteOne') {
            const collectionName = String(command.collection || '').trim();
            if (!collectionName) {
              throw new Error('MongoDB command must include collection');
            }
            const collection = db.collection(collectionName);
            const result = await collection.deleteOne(command.filter || {});
            mongoRows = [{ acknowledged: result.acknowledged, deletedCount: result.deletedCount }];
          } else {
            throw new Error('Unsupported MongoDB action');
          }
        } catch (jsonError) {
          if (jsonError && jsonError.name === 'SyntaxError') {
            const db = client.db(databaseName);
            mongoRows = await executeMongoShellScript(db, sql);
            action = 'script';
          } else {
            throw jsonError;
          }
        }
        const normalizedRows = toPlainRows(mongoRows);
        return {
          rows: normalizedRows,
          rowCount: normalizedRows.length,
          fields: normalizedRows.length ? Object.keys(normalizedRows[0]) : [],
          statementCount: 1,
          execution: [{ index: 1, sql: action, rowCount: normalizedRows.length }]
        };
      }

      for (let index = 0; index < statements.length; index += 1) {
        const statementSql = statements[index];
        const [statementRows, statementRaw] = await client.query(statementSql);
        rows = statementRows;
        raw = statementRaw;

        const normalizedStatementRows = toPlainRows(statementRows);
        const statementRowCount = statementRaw && statementRaw.rowCount !== undefined
          ? statementRaw.rowCount
          : statementRows && statementRows.affectedRows !== undefined
            ? statementRows.affectedRows
            : normalizedStatementRows.length;

        execution.push({
          index: index + 1,
          sql: statementSql,
          rowCount: statementRowCount
        });
      }

      const fields = client.type === 'mysql'
        ? (Array.isArray(raw) ? raw : []).map((field) => field.name)
        : ((raw && raw.fields) || []).map((field) => field.name);
      const normalizedRows = toPlainRows(rows);
      const rowCount = raw && raw.rowCount !== undefined
        ? raw.rowCount
        : rows && rows.affectedRows !== undefined
          ? rows.affectedRows
          : normalizedRows.length;
      return {
        rows: normalizedRows,
        rowCount,
        fields,
        statementCount: statements.length,
        execution
      };
    });

    req.off('aborted', handleClose);

    if (requestClosed || res.writableEnded) {
      return;
    }

    res.json(result);
  } catch (error) {
    if (req.aborted || res.writableEnded) {
      return;
    }
    next(error);
  }
});

app.get('/api/connections/:id/tables/:table/data', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize || req.query.limit) || 1000, 1), 5000);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * pageSize;
    const schema = req.query.schema;
    const database = req.query.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const tableName = connection.type === 'mongodb' ? req.params.table : buildQualifiedName(connection.type, schema, req.params.table);
    const filter = getFilterConfig(connection.type, {
      column: req.query.filterColumn,
      operator: req.query.filterOperator,
      value: req.query.filterValue
    });

    const result = await withClient(connection, async (client) => {
      if (client.type === 'mongodb') {
        const db = client.db(connection.database);
        const collection = db.collection(tableName);
        const total = await collection.countDocuments({});
        const rows = await collection.find({}).skip(offset).limit(pageSize).toArray();
        return { rows: toPlainRows(rows), total };
      }

      const whereClause = filter ? ` WHERE ${filter.clause}` : '';
      const baseParams = filter ? filter.params.slice() : [];
      const countSql = `SELECT COUNT(*) AS total FROM ${tableName}${whereClause}`;
      const [countRows] = await client.query(countSql, baseParams);
      const total = Number(countRows && countRows[0] ? countRows[0].total : 0) || 0;

      const limitPlaceholder = client.type === 'postgres' ? `$${baseParams.length + 1}` : '?';
      const offsetPlaceholder = client.type === 'postgres' ? `$${baseParams.length + 2}` : '?';
      const sql = `SELECT * FROM ${tableName}${whereClause} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
      const params = baseParams.concat([pageSize, offset]);
      const [rows] = await client.query(sql, params);
      return {
        rows: toPlainRows(rows),
        total
      };
    });

    res.json({
      rows: result.rows,
      total: result.total,
      page,
      pageSize
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/connections/:id/tables/:table/rows', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const schema = req.body.schema;
    const values = req.body.values || {};
    const columns = Object.keys(values);
    if (!columns.length) {
      return res.status(400).json({ message: 'No values provided' });
    }

    const tableName = buildQualifiedName(connection.type, schema, req.params.table);
    const quotedColumns = columns.map((column) => quoteIdentifier(connection.type, column));
    const params = columns.map((column) => normalizeValue(values[column]));
    const placeholders = connection.type === 'postgres'
      ? columns.map((_, index) => `$${index + 1}`)
      : columns.map(() => '?');

    await withClient(connection, async (client) => {
      await client.query(
        `INSERT INTO ${tableName} (${quotedColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
        params
      );
    });

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.put('/api/connections/:id/tables/:table/rows', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const schema = req.body.schema;
    const primaryKey = req.body.primaryKey;
    const keyValue = req.body.keyValue;
    const values = req.body.values || {};
    const columns = Object.keys(values);
    if (!primaryKey) {
      return res.status(400).json({ message: 'primaryKey is required' });
    }
    if (!columns.length) {
      return res.status(400).json({ message: 'No values provided' });
    }

    const tableName = buildQualifiedName(connection.type, schema, req.params.table);
    const assignments = columns.map((column, index) => {
      const placeholder = connection.type === 'postgres' ? `$${index + 1}` : '?';
      return `${quoteIdentifier(connection.type, column)} = ${placeholder}`;
    });

    const keyPlaceholder = connection.type === 'postgres' ? `$${columns.length + 1}` : '?';
    const params = columns.map((column) => normalizeValue(values[column])).concat([keyValue]);

    await withClient(connection, async (client) => {
      await client.query(
        `UPDATE ${tableName} SET ${assignments.join(', ')} WHERE ${quoteIdentifier(connection.type, primaryKey)} = ${keyPlaceholder}`,
        params
      );
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/connections/:id/tables/:table/rows', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const database = req.body.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const schema = req.body.schema;
    const primaryKey = req.body.primaryKey;
    const keyValue = req.body.keyValue;
    if (!primaryKey) {
      return res.status(400).json({ message: 'primaryKey is required' });
    }

    const tableName = buildQualifiedName(connection.type, schema, req.params.table);
    const placeholder = connection.type === 'postgres' ? '$1' : '?';
    await withClient(connection, async (client) => {
      await client.query(
        `DELETE FROM ${tableName} WHERE ${quoteIdentifier(connection.type, primaryKey)} = ${placeholder}`,
        [keyValue]
      );
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/connections/:id/tables/:table/export', async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const schema = req.query.schema;
    const database = req.query.database;
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const tableName = buildQualifiedName(connection.type, schema, req.params.table);
    const rows = await withClient(connection, async (client) => {
      const [items] = await client.query(`SELECT * FROM ${tableName}`);
      return items;
    });
    const format = String(req.query.format || 'csv').toLowerCase();
    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.table}.xlsx"`);
      return res.send(buffer);
    }

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.table}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

app.post('/api/connections/:id/tables/:table/import', upload.single('file'), async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const schema = req.body.schema;
    const database = req.body.database;
    const mode = String(req.body.mode || 'append').toLowerCase();
    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const content = fs.readFileSync(file.path, 'utf8');
    fs.unlinkSync(file.path);
    const { headers, rows } = parseCsv(content);
    if (!headers.length || !rows.length) {
      return res.status(400).json({ message: 'CSV is empty' });
    }

    const tableName = buildQualifiedName(connection.type, schema, req.params.table);
    const quotedColumns = headers.map((header) => quoteIdentifier(connection.type, header));

    await withClient(connection, async (client) => {
      if (mode === 'replace') {
        await client.query(`DELETE FROM ${tableName}`);
      }
      for (const row of rows) {
        const placeholders = headers.map((_, index) => connection.type === 'postgres' ? `$${index + 1}` : '?');
        await client.query(
          `INSERT INTO ${tableName} (${quotedColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
          row.map(normalizeValue)
        );
      }
    });

    res.json({ success: true, imported: rows.length, mode: mode === 'replace' ? 'replace' : 'append' });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

app.post('/api/connections/:id/tables/import-create', upload.single('file'), async (req, res, next) => {
  try {
    const baseConnection = getConnectionById(req.params.id);
    const schema = req.body.schema;
    const database = req.body.database;

    const connection = (baseConnection.type === 'mysql' || baseConnection.type === 'selectdb' || baseConnection.type === 'mongodb') && database
      ? { ...baseConnection, database }
      : baseConnection;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const content = fs.readFileSync(file.path, 'utf8');
    fs.unlinkSync(file.path);
    const { headers, rows } = parseCsv(content);
    const tableName = buildTableNameFromFilename(file.originalname);
    if (!headers.length || !rows.length) {
      return res.status(400).json({ message: 'CSV is empty' });
    }

    await createTableFromCsv(connection, schema, tableName, headers, rows);
    res.status(201).json({ success: true, imported: rows.length, tableName });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || 'Internal server error'
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});


