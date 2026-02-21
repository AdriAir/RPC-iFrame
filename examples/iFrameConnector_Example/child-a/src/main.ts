import { IframeExposed } from "rpc-iframe";
import "./style.css";

const app = document.getElementById("app")!;
app.innerHTML = `
    <div class="label">Child A</div>
    <div class="title">Color Generator</div>
    <div class="color-preview" id="preview"></div>
    <div class="color-value" id="value">---</div>
`;

const preview = document.getElementById("preview")!;
const value = document.getElementById("value")!;
let lastColor = "#ffffff";

function randomHexColor(): string {
    const hex = Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0");
    return `#${hex}`;
}

const api = {
    async generateRandomColor(): Promise<string> {
        lastColor = randomHexColor();
        preview.style.backgroundColor = lastColor;
        value.textContent = lastColor;
        return lastColor;
    },

    async setBackgroundColor(color: string): Promise<void> {
        document.body.style.backgroundColor = color;
    },
};

new IframeExposed(api, {
    allowedOrigin: "http://localhost:5173",
});
