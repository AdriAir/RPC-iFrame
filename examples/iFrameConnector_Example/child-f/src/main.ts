import { IframeExposed } from "rpc-iframe";
import "./style.css";

const app = document.getElementById("app")!;
app.innerHTML = `
    <div class="label">Child F</div>
    <div class="title">Status Board</div>
    <table>
        <thead>
            <tr><th>Child</th><th>Status</th></tr>
        </thead>
        <tbody id="tbody">
            <tr><td colspan="2" class="no-data">No status updates yet</td></tr>
        </tbody>
    </table>
`;

const tbody = document.getElementById("tbody")!;
const statuses = new Map<string, string>();

function render() {
    if (statuses.size === 0) {
        tbody.innerHTML =
            '<tr><td colspan="2" class="no-data">No status updates yet</td></tr>';
        return;
    }

    tbody.innerHTML = "";
    for (const [childId, status] of statuses) {
        const row = document.createElement("tr");
        row.innerHTML = `<td class="child-id">${childId}</td><td class="status">${status}</td>`;
        tbody.appendChild(row);
    }
}

const api = {
    async setStatus(childId: string, status: string): Promise<void> {
        statuses.set(childId, status);
        render();
    },

    async clearAll(): Promise<void> {
        statuses.clear();
        render();
        document.body.style.backgroundColor = "#ffffff";
    },

    async setBackgroundColor(color: string): Promise<void> {
        document.body.style.backgroundColor = color;
    },
};

new IframeExposed(api, {
    allowedOrigin: "http://localhost:5173",
});
