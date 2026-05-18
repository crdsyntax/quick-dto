export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
        parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) +
        " " +
        sizes[i]
    );
}

export function formatResponseData(data) {
    if (typeof data === "object" && data !== null) {
        try {
            return JSON.stringify(data, null, 2);
        } catch (e) {
            return String(data);
        }
    }
    return String(data);
}

export const uiUtils = {
    loadingDiv: document.getElementById("loading-overlay"),
    responseContainer: document.getElementById("response-container"),
    responseHeader: document.getElementById("response-header"),
    responseData: document.getElementById("response-data"),

    startLoading() {
        this.loadingDiv.classList.add("active");
        this.responseContainer.style.display = "none";
    },

    stopLoading() {
        this.loadingDiv.classList.remove("active");
    },

    showError(message) {
        this.responseContainer.style.display = "block";
        this.responseHeader.innerHTML = `<span class="status-4xx">Error</span>`;
        this.responseData.textContent = message;
    },

    displayResponse(response) {
        this.responseContainer.style.display = "block";
        const statusClass =
            response.status >= 200 && response.status < 300
                ? "status-2xx"
                : response.status >= 300 && response.status < 400
                ? "status-3xx"
                : "status-4xx";

        this.responseHeader.innerHTML = `
            <span class="${statusClass}">${response.status} ${response.statusText}</span>
            <span>Time: ${response.time}ms | Size: ${formatBytes(response.size)}</span>
        `;
        this.responseData.textContent = formatResponseData(response.data);
    }
};
