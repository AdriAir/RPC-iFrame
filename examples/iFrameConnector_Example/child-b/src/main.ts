import { IframeExposed } from "iframe-connector";
import "./style.css";

const app = document.getElementById("app")!;
app.innerHTML = `
    <div class="label">Child B</div>
    <div class="title">Greeter</div>
    <div class="greeting" id="greeting">Waiting...</div>
`;

const greetingEl = document.getElementById("greeting")!;

const api = {
    async greet(name: string): Promise<string> {
        const message = `Hello, ${name}!`;
        greetingEl.textContent = message;
        return message;
    },

    async setBackgroundColor(color: string): Promise<void> {
        document.body.style.backgroundColor = color;
    },
};

new IframeExposed(api, {
    allowedOrigin: "http://localhost:5173",
});
