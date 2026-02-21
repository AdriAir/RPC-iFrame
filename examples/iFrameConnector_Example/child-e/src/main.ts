import { IframeExposed } from "iframe-connector";
import "./style.css";

const app = document.getElementById("app")!;
app.innerHTML = `
    <div class="label">Child E</div>
    <div class="title">Logger</div>
    <div class="logs" id="logs">
        <div class="empty">No logs yet</div>
    </div>
`;

const container = document.getElementById("logs")!;

const api = {
    async log(message: string, source: string): Promise<void> {
        const empty = container.querySelector(".empty");
        if (empty) empty.remove();

        const time = new Date().toLocaleTimeString();
        const el = document.createElement("div");
        el.className = "log-entry";
        el.innerHTML = `<span class="time">${time}</span> <span class="source">[${source}]</span> <span class="msg">${message}</span>`;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
    },

    async clear(): Promise<void> {
        container.innerHTML = '<div class="empty">No logs yet</div>';
        document.body.style.backgroundColor = "#1a1a2e";
    },

    async setBackgroundColor(color: string): Promise<void> {
        document.body.style.backgroundColor = color;
    },
};

new IframeExposed(api, {
    allowedOrigin: "http://localhost:5173",
});
