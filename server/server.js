import express from "express";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "data.json");
const PORT = process.env.PORT || 3001;
const ADMIN_KEY = process.env.ADMIN_KEY || "dev-key-change-me";

function load() {
  return JSON.parse(readFileSync(DATA, "utf-8"));
}

function save(data) {
  writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");
}

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.use(express.json());

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_KEY}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.use("/api/admin", adminAuth);

function timeAgo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

app.get("/api/questions", (req, res) => {
  const data = load();
  const answered = data.questions.filter(q => q.answer);
  answered.sort((a, b) => new Date(a.answered_at) - new Date(b.answered_at));
  res.json(answered.map(q => {
    const { id, answered_at, ...rest } = q;
    return { ...rest, answered_at: timeAgo(answered_at) };
  }));
});

app.post("/api/questions", (req, res) => {
  const { question, username } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: "question is required" });
  }
  const data = load();
  const q = {
    id: data.next_id++,
    username: (username || "Anonymous").trim(),
    question: question.trim(),
    answer: null,
    answered_at: null,
  };
  data.questions.push(q);
  save(data);
  const { id: _id, ...rest } = q;
  res.status(201).json(rest);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/admin/pending", (req, res) => {
  const data = load();
  res.json(data.questions.filter(q => !q.answer).map(q => {
    const { answered_at, ...rest } = q;
    return rest;
  }));
});

app.post("/api/admin/answer", (req, res) => {
  const { question_id, answer } = req.body;
  if (!question_id || !answer || !answer.trim()) {
    return res.status(400).json({ error: "question_id and answer are required" });
  }
  const data = load();
  const q = data.questions.find(q => q.id === question_id);
  if (!q) {
    return res.status(404).json({ error: "question not found" });
  }
  q.answer = answer.trim();
  q.answered_at = new Date().toISOString();
  save(data);
  res.json(q);
});

app.listen(PORT, () => {
  console.log(`daygpt server running on http://localhost:${PORT}`);
});
