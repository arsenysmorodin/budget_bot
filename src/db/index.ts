import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbPath = path.resolve("data.db");
const db = new Database(dbPath);

// создаём таблицы из schema.sql
const schemaPath = path.resolve("src/db/schema.sql");
const schemaSQL = fs.readFileSync(schemaPath, "utf-8");
db.exec(schemaSQL);

console.log("✅ База данных инициализирована");

export default db;
