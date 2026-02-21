import { IframeConnection } from "iframe-connector";
import type { ApiMethods } from "iframe-connector";
import "./style.css";

// ---------------------------------------------------------------------------
// Child API type definitions
// ---------------------------------------------------------------------------

interface ChildAApi extends ApiMethods {
    generateRandomColor(): Promise<string>;
    setBackgroundColor(color: string): Promise<void>;
}

interface ChildBApi extends ApiMethods {
    greet(name: string): Promise<string>;
    setBackgroundColor(color: string): Promise<void>;
}

interface ChildCApi extends ApiMethods {
    increment(): Promise<number>;
    decrement(): Promise<number>;
    reset(): Promise<number>;
    getCount(): Promise<number>;
    setBackgroundColor(color: string): Promise<void>;
}

interface ChildDApi extends ApiMethods {
    notify(message: string): Promise<void>;
    clearNotifications(): Promise<void>;
    setBackgroundColor(color: string): Promise<void>;
}

interface ChildEApi extends ApiMethods {
    log(message: string, source: string): Promise<void>;
    clear(): Promise<void>;
    setBackgroundColor(color: string): Promise<void>;
}

interface ChildFApi extends ApiMethods {
    setStatus(childId: string, status: string): Promise<void>;
    clearAll(): Promise<void>;
    setBackgroundColor(color: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Child configuration
// ---------------------------------------------------------------------------

const CHILDREN = [
    { id: "child-a", name: "Color Generator", port: 5174 },
    { id: "child-b", name: "Greeter", port: 5175 },
    { id: "child-c", name: "Counter", port: 5176 },
    { id: "child-d", name: "Notifier", port: 5177 },
    { id: "child-e", name: "Logger", port: 5178 },
    { id: "child-f", name: "Status Board", port: 5179 },
] as const;

// ---------------------------------------------------------------------------
// UI Setup
// ---------------------------------------------------------------------------

const app = document.getElementById("app")!;

// Control panel
const panel = document.createElement("div");
panel.className = "control-panel";
panel.innerHTML = `
    <h1>iFrame Connector Demo</h1>
    <button id="btn-sync-colors">Sync Colors</button>
    <button id="btn-greet">Broadcast Greeting</button>
    <button id="btn-increment">Increment &amp; Broadcast</button>
    <button id="btn-reset">Reset All</button>
`;
app.appendChild(panel);

// Status bar
const statusBar = document.createElement("div");
statusBar.className = "status-bar";
statusBar.textContent = "Connecting to children...";
app.appendChild(statusBar);

// Iframe grid
const grid = document.createElement("div");
grid.className = "grid";
app.appendChild(grid);

// Create iframes
const iframes: Record<string, HTMLIFrameElement> = {};
for (const child of CHILDREN) {
    const iframe = document.createElement("iframe");
    iframe.src = `http://localhost:${child.port}`;
    iframe.title = child.name;
    grid.appendChild(iframe);
    iframes[child.id] = iframe;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function logStatus(message: string) {
    statusBar.innerHTML = `<span class="log">[${new Date().toLocaleTimeString()}]</span> ${message}`;
}

function setButtonsEnabled(enabled: boolean) {
    panel.querySelectorAll("button").forEach((btn) => {
        (btn as HTMLButtonElement).disabled = !enabled;
    });
}

// ---------------------------------------------------------------------------
// Connect to all children and set up orchestration
// ---------------------------------------------------------------------------

async function init() {
    setButtonsEnabled(false);

    try {
        const [connA, connB, connC, connD, connE, connF] = await Promise.all([
            IframeConnection.connect<ChildAApi>(iframes["child-a"], {
                targetOrigin: `http://localhost:${CHILDREN[0].port}`,
            }),
            IframeConnection.connect<ChildBApi>(iframes["child-b"], {
                targetOrigin: `http://localhost:${CHILDREN[1].port}`,
            }),
            IframeConnection.connect<ChildCApi>(iframes["child-c"], {
                targetOrigin: `http://localhost:${CHILDREN[2].port}`,
            }),
            IframeConnection.connect<ChildDApi>(iframes["child-d"], {
                targetOrigin: `http://localhost:${CHILDREN[3].port}`,
            }),
            IframeConnection.connect<ChildEApi>(iframes["child-e"], {
                targetOrigin: `http://localhost:${CHILDREN[4].port}`,
            }),
            IframeConnection.connect<ChildFApi>(iframes["child-f"], {
                targetOrigin: `http://localhost:${CHILDREN[5].port}`,
            }),
        ]);

        logStatus("All children connected. Ready.");
        setButtonsEnabled(true);

        // -- Scenario 1: Sync Colors --
        document.getElementById("btn-sync-colors")!.addEventListener("click", async () => {
            setButtonsEnabled(false);
            logStatus("Sync Colors: asking Child A for a random color...");

            const color = await connA.remote.generateRandomColor();
            logStatus(`Sync Colors: got ${color}, broadcasting to all children...`);

            await Promise.all([
                connB.remote.setBackgroundColor(color),
                connC.remote.setBackgroundColor(color),
                connD.remote.setBackgroundColor(color),
                connE.remote.log(`Color synced: ${color}`, "host"),
                connF.remote.setStatus("child-a", `Generated ${color}`),
            ]);

            logStatus(`Sync Colors: done! All children updated to ${color}`);
            setButtonsEnabled(true);
        });

        // -- Scenario 2: Broadcast Greeting --
        document.getElementById("btn-greet")!.addEventListener("click", async () => {
            setButtonsEnabled(false);
            logStatus("Broadcast Greeting: asking Child B to greet...");

            const greeting = await connB.remote.greet("Micro-frontends");
            logStatus(`Broadcast Greeting: got "${greeting}", propagating...`);

            await Promise.all([
                connD.remote.notify(greeting),
                connE.remote.log(`Greeting: ${greeting}`, "child-b"),
                connF.remote.setStatus("child-b", "Greeted"),
            ]);

            logStatus(`Broadcast Greeting: done! "${greeting}" sent to notifier and logger.`);
            setButtonsEnabled(true);
        });

        // -- Scenario 3: Increment & Broadcast --
        document.getElementById("btn-increment")!.addEventListener("click", async () => {
            setButtonsEnabled(false);
            logStatus("Increment: asking Child C to increment...");

            const count = await connC.remote.increment();
            logStatus(`Increment: counter is now ${count}, broadcasting...`);

            await Promise.all([
                connD.remote.notify(`Counter is now: ${count}`),
                connE.remote.log(`Counter incremented to ${count}`, "child-c"),
                connF.remote.setStatus("child-c", `Count: ${count}`),
            ]);

            logStatus(`Increment: done! Counter = ${count}`);
            setButtonsEnabled(true);
        });

        // -- Scenario 4: Reset All --
        document.getElementById("btn-reset")!.addEventListener("click", async () => {
            setButtonsEnabled(false);
            logStatus("Reset All: clearing all children...");

            await Promise.all([
                connA.remote.setBackgroundColor("#ffffff"),
                connB.remote.setBackgroundColor("#ffffff"),
                connC.remote.reset(),
                connD.remote.clearNotifications(),
                connE.remote.clear(),
                connF.remote.clearAll(),
            ]);

            logStatus("Reset All: done! Everything cleared.");
            setButtonsEnabled(true);
        });
    } catch (err) {
        logStatus(`Connection failed: ${err instanceof Error ? err.message : err}`);
    }
}

init();
