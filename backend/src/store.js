import initSqlJs from "sql.js";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { findPublic } from "./users.js";
const file = resolve(process.env.DB_FILE || "data/board.sqlite");
mkdirSync(dirname(file), { recursive: true });
const SQL = await initSqlJs();
const db = new SQL.Database(existsSync(file) ? readFileSync(file) : undefined);
db.run(
  "CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,content TEXT NOT NULL,author_id INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
);
function flush() {
  writeFileSync(file + ".tmp", db.export());
  renameSync(file + ".tmp", file);
}
function rows(sql, args = []) {
  const s = db.prepare(sql);
  try {
    s.bind(args);
    const out = [];
    while (s.step()) out.push(s.getAsObject());
    return out;
  } finally {
    s.free();
  }
}
function shape(p) {
  return p
    ? {
        id: p.id,
        title: p.title,
        content: p.content,
        authorId: p.author_id,
        authorName: findPublic(p.author_id)?.name ?? "Unknown",
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }
    : null;
}
export const store = {
  list: () => rows("SELECT * FROM posts ORDER BY id DESC").map(shape),
  get: (id) => shape(rows("SELECT * FROM posts WHERE id=?", [id])[0]),
  create(input, author) {
    const now = new Date().toISOString();
    db.run(
      "INSERT INTO posts(title,content,author_id,created_at,updated_at) VALUES (?,?,?,?,?)",
      [input.title, input.content, author, now, now],
    );
    const id = rows("SELECT last_insert_rowid() AS id")[0].id;
    flush();
    return this.get(id);
  },
  update(id, input) {
    db.run("UPDATE posts SET title=?,content=?,updated_at=? WHERE id=?", [
      input.title,
      input.content,
      new Date().toISOString(),
      id,
    ]);
    flush();
    return this.get(id);
  },
  remove(id) {
    db.run("DELETE FROM posts WHERE id=?", [id]);
    flush();
  },
};
flush();
