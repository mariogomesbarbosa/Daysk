/* =========================================================================
   Namespace de armazenamento por aplicativo.

   localStorage e IndexedDB são compartilhados por ORIGEM, não por pasta.
   Como Zenny e Daysk vivem em mariogomesbarbosa.github.io, os dois enxergam
   exatamente o mesmo localStorage. Sem prefixo, uma chave como "config" ou
   "theme" de um app sobrescreve a do outro.

   Uso:
     import { storage } from './storage.js';
     storage.set('transacoes', lista);
     const lista = storage.get('transacoes', []);
   ========================================================================= */

const APP_ID = 'zenny'; // <-- em Daysk/storage.js troque para 'daysk'
const PREFIX = `${APP_ID}:`;

export const storage = {
  key(name) {
    return PREFIX + name;
  },

  get(name, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + name);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(name, value) {
    try {
      localStorage.setItem(PREFIX + name, JSON.stringify(value));
      return true;
    } catch {
      // cota estourada ou modo restrito
      return false;
    }
  },

  remove(name) {
    localStorage.removeItem(PREFIX + name);
  },

  // Lista as chaves deste app, já sem o prefixo.
  keys() {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => k.slice(PREFIX.length));
  },

  // Limpa só os dados deste app, preserva os do outro.
  clear() {
    this.keys().forEach((name) => this.remove(name));
  }
};

/* -------------------------------------------------------------------------
   Migração de chaves antigas (sem prefixo) para o namespace novo.
   Chame uma única vez na inicialização, passando os nomes que este app usava.
   Só move o que ainda não existe prefixado, então rodar duas vezes é seguro.

     migrarChaves(['transacoes', 'cartoes', 'config']);
   ------------------------------------------------------------------------- */
export function migrarChaves(nomes = []) {
  nomes.forEach((name) => {
    const antigo = localStorage.getItem(name);
    if (antigo === null) return;
    if (localStorage.getItem(PREFIX + name) !== null) return;
    localStorage.setItem(PREFIX + name, antigo);
    localStorage.removeItem(name);
  });
}
