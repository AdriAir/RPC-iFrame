import { IframeExposed } from "rpc-iframe";
import "./style.css";

const app = document.getElementById("app")!;
app.innerHTML = `
    <div class="label">Child D</div>
    <div class="title">Notifier</div>
    <div class="notifications" id="notifications">
        <div class="empty">No notifications yet</div>
    </div>
`;

const container = document.getElementById("notifications")!;

const api = {
    async notify(message: string): Promise<void> {
        const empty = container.querySelector(".empty");
        if (empty) empty.remove();

        const el = document.createElement("div");
        el.className = "notification";
        el.textContent = message;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
    },

    async clearNotifications(): Promise<void> {
        container.innerHTML = '<div class="empty">No notifications yet</div>';
        document.body.style.backgroundColor = "#ffffff";
    },

    async setBackgroundColor(color: string): Promise<void> {
        document.body.style.backgroundColor = color;
    },
};

new IframeExposed(api, {
    allowedOrigin: "http://localhost:5173",
});
