import { IframeExposed } from "iframe-connector";
import "./style.css";

const app = document.getElementById("app")!;
app.innerHTML = `
    <div class="label">Child C</div>
    <div class="title">Counter</div>
    <div class="counter" id="counter">0</div>
`;

const counterEl = document.getElementById("counter")!;
let count = 0;

function updateDisplay() {
    counterEl.textContent = String(count);
}

const api = {
    async increment(): Promise<number> {
        count++;
        updateDisplay();
        return count;
    },

    async decrement(): Promise<number> {
        count--;
        updateDisplay();
        return count;
    },

    async reset(): Promise<number> {
        count = 0;
        updateDisplay();
        document.body.style.backgroundColor = "#ffffff";
        return count;
    },

    async getCount(): Promise<number> {
        return count;
    },

    async setBackgroundColor(color: string): Promise<void> {
        document.body.style.backgroundColor = color;
    },
};

new IframeExposed(api, {
    allowedOrigin: "http://localhost:5173",
});
