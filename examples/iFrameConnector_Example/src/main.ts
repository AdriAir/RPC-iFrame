import "./style.css";

const app = document.getElementById("app");

if (app) {
    // URLs de ejemplo, cámbialas por las que necesites
    const urls = [
        "https://example.com",
        "https://example.org",
        "https://example.net",
        "https://example.com/1",
        "https://example.org/1",
        "https://example.net/1",
    ];

    const grid = document.createElement("div");
    grid.classList.add("grid");

    urls.forEach((url) => {
        const iframe = document.createElement("iframe");
        iframe.src = url;
        grid.appendChild(iframe);
    });

    app.appendChild(grid);
}
