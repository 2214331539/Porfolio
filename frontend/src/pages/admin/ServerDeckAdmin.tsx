import { ExternalLink, Server } from "lucide-react";

export function ServerDeckAdmin() {
  return (
    <div className="server-deck-admin">
      <div className="admin-title server-deck-admin-title">
        <div>
          <p>OPERATIONS / SERVER DECK</p>
          <h1>服务器工作台</h1>
        </div>
        <a
          className="admin-button secondary"
          href="/server-deck/"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink aria-hidden="true" />
          独立打开
        </a>
      </div>
      <section className="server-deck-frame-shell" aria-label="服务器资源管理">
        <div className="server-deck-frame-loading" aria-hidden="true">
          <Server />
          <span>正在打开服务器工作台…</span>
        </div>
        <iframe
          className="server-deck-frame"
          src="/server-deck/"
          title="Server Deck 服务器工作台"
        />
      </section>
    </div>
  );
}
