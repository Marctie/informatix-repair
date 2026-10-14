// Pubblicazione della Vetrina Usati sul sito: due implementazioni dietro la stessa interfaccia.
//   publisher.publish({ jsonPath, jsonText, files:[{path, base64}], deletes:[path] })
//     -> { published: true, changed, commits } | { published: false, draft: true, message }
//   - github: scrive nel repository con la Contents API (Cloudflare Pages poi ripubblica il sito).
//   - bozza : senza GITHUB_TOKEN non scrive da nessuna parte; resta tutto nel database.
// Configurazione (Worker): segreto GITHUB_TOKEN, variabili GITHUB_REPO (es. "Marctie/informatix-repair") e GITHUB_BRANCH.
export const DRAFT_MESSAGE = 'Pubblicazione sul sito non ancora attiva: l’articolo è salvato come bozza nel gestionale.';

/** Utilità: base64 <-> byte, valida sia su Node sia sui Workers. */
export const bytesToB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const utf8B64 = (text) => bytesToB64(new TextEncoder().encode(text));

export function draftPublisher() {
  return { mode: 'draft', enabled: false, publish: async () => ({ published: false, draft: true, message: DRAFT_MESSAGE }) };
}

export function githubPublisher({ token, repo, branch = 'main', fetcher = globalThis.fetch, author }) {
  const api = `https://api.github.com/repos/${repo}/contents`;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'informatix-officina', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' };
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const call = async (method, path, body) => {
    const res = await fetcher(`${api}/${enc(path)}${method === 'GET' ? `?ref=${encodeURIComponent(branch)}` : ''}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 404 && method === 'GET') return null;
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch { /* corpo non JSON */ }
      throw new Error(`GitHub ${method} ${path}: ${res.status}${detail ? ` ${detail}` : ''}`);
    }
    return res.json();
  };
  const committer = author ? { committer: author } : {};
  const put = async (path, base64, message, sha) => call('PUT', path, { message, content: base64, branch, ...(sha ? { sha } : {}), ...committer });

  return {
    mode: 'github', enabled: true, repo, branch,
    async publish({ jsonPath, jsonText, files = [], deletes = [], message = 'Vetrina usati: aggiornamento dal gestionale' }) {
      let commits = 0;
      // 1) prima le foto (un file nuovo non rompe il sito), poi il JSON che le usa, poi le cancellazioni
      for (const f of files) {
        const cur = await call('GET', f.path);
        if (cur?.sha && !f.overwrite) continue; // già presente
        await put(f.path, f.base64, `${message} (foto)`, cur?.sha);
        commits++;
      }
      const cur = await call('GET', jsonPath);
      const same = cur?.content && atobUtf8(cur.content.replace(/\s/g, '')) === jsonText;
      if (!same) { await put(jsonPath, utf8B64(jsonText), message, cur?.sha); commits++; }
      for (const path of deletes) {
        const old = await call('GET', path);
        if (!old?.sha) continue;
        await call('DELETE', path, { message: `${message} (rimozione)`, sha: old.sha, branch, ...committer });
        commits++;
      }
      return { published: true, changed: commits > 0, commits };
    },
  };
}

const atobUtf8 = (b64) => new TextDecoder().decode(b64ToBytes(b64));

/** Sceglie l'implementazione in base alla configurazione. env = variabili/segreti del Worker. */
export function createPublisher(env = {}, fetcher) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return draftPublisher();
  return githubPublisher({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || 'main', fetcher });
}
