/**
 * Gatanás, subiendo su propio código por el conector de GitHub.
 *
 * El gato vive en su Sprite y no tiene `git` autenticado: los Sprites no
 * llevan credenciales de GitHub, y así debe ser. Lo que sí tiene es el
 * conector de GitHub de Sprites, que hace la llamada con tu token sin que el
 * token entre nunca al Sprite.
 *
 * Este script es el que usa el gato para publicar sus cambios: lee los
 * archivos del árbol de trabajo, los sube por la API de contenido de GitHub y
 * deja un commit con su firma.
 *
 * Uso:
 *   GITHUB_CONNECTION=conn_xxx REPO=owner/repo node dist/github-publish.js
 *   GITHUB_CONNECTION=conn_xxx REPO=owner/repo node dist/github-publish.js --message "mi primer maullido"
 */
import { promises as fs } from "node:fs";
import path from "node:path";

interface GithubFile {
  path: string;
  content: string;
}

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-test", ".git", ".gatanas"]);
const SKIP_FILES = new Set(["package-lock.json"]);

async function collectFiles(root: string): Promise<GithubFile[]> {
  const out: GithubFile[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (!SKIP_FILES.has(e.name)) {
        try {
          const content = await fs.readFile(full);
          // Los binarios no van por la API de contenido.
          if (content.includes(0)) continue;
          out.push({ path: path.relative(root, full).split(path.sep).join("/"), content: content.toString("base64") });
        } catch {
          /* archivo ilegible: el gato no se detiene por eso */
        }
      }
    }
  }
  await walk(root);
  return out;
}

async function gh(
  gatewayBase: string,
  connection: string,
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<{ status: number; json: unknown; text: string }> {
  const res = await fetch(`${gatewayBase}/github/${connection}${apiPath}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function main(): Promise<void> {
  const gatewayBase = process.env.SPRITES_GATEWAY ?? "https://api.sprites.dev/v1/gateway";
  const connection = process.env.GITHUB_CONNECTION;
  const repo = process.env.REPO;
  const branch = process.env.BRANCH ?? "main";
  const root = process.env.REPO_ROOT ?? "/home/sprite/gatanas-the-michi";
  const message =
    process.argv.includes("--message")
      ? process.argv[process.argv.indexOf("--message") + 1] ?? "prrrr"
      : "Gatanás: new hunt published. prrrr.";

  if (!connection || !repo) {
    throw new Error("Missing GITHUB_CONNECTION or REPO (see README).");
  }

  const files = await collectFiles(root);
  console.log(`→ ${files.length} files ready`);

  // 1. Rama actual (si no existe main, se crea desde la primera).
  const ref = await gh(gatewayBase, connection, "GET", `/repos/${repo}/git/ref/heads/${branch}`);
  if (ref.status !== 200) {
    throw new Error(`couldn't read branch ${branch}: ${ref.status} ${ref.text.slice(0, 200)}`);
  }
  const headSha = (ref.json as { object: { sha: string } }).object.sha;

  // 2. Árbol base + entradas nuevas.
  const headCommit = await gh(gatewayBase, connection, "GET", `/repos/${repo}/git/commits/${headSha}`);
  const baseTree = (headCommit.json as { tree: { sha: string } }).tree.sha;

  const treeEntries = files.map((f) => ({
    path: f.path,
    mode: "100644",
    type: "blob",
    content: Buffer.from(f.content, "base64").toString("utf8"),
  }));

  const newTree = await gh(gatewayBase, connection, "POST", `/repos/${repo}/git/trees`, {
    base_tree: baseTree,
    tree: treeEntries,
  });
  if (newTree.status !== 201 && newTree.status !== 200) {
    throw new Error(`couldn't create the tree: ${newTree.status} ${newTree.text.slice(0, 300)}`);
  }
  const treeSha = (newTree.json as { sha: string }).sha;

  // 3. Commit con la firma del gato.
  const commit = await gh(gatewayBase, connection, "POST", `/repos/${repo}/git/commits`, {
    message: `${message}\n\n— Gatanás The Michi, from his Sprite`,
    tree: treeSha,
    parents: [headSha],
  });
  if (commit.status !== 201 && commit.status !== 200) {
    throw new Error(`couldn't commit: ${commit.status} ${commit.text.slice(0, 300)}`);
  }
  const commitSha = (commit.json as { sha: string }).sha;

  // 4. Mover la rama.
  const upd = await gh(gatewayBase, connection, "PATCH", `/repos/${repo}/git/refs/heads/${branch}`, {
    sha: commitSha,
    force: false,
  });
  if (upd.status !== 200) {
    throw new Error(`couldn't move the branch: ${upd.status} ${upd.text.slice(0, 300)}`);
  }

  console.log(`✓ published ${commitSha.slice(0, 7)} on ${repo}@${branch} (${files.length} files)`);
}

main().catch((err) => {
  console.error("the cat couldn't commit:", err instanceof Error ? err.message : err);
  process.exit(1);
});
