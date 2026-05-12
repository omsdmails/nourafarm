function showCropSelectionPopup(fieldIdx) {
    const popup = document.createElement("div");
    popup.className = "popup-overlay";
    const inner = document.createElement("div");
    inner.className = "popup-inner";
    inner.innerHTML = `<h3>🌾 ${player.language === "ar" ? "اختر محصولاً" : "Choose a crop"}</h3>`;
    for (let [key, crop] of Object.entries(CROPS)) {
        if (player.level >= crop.levelReq) {
            const btn = document.createElement("button");
            btn.innerText = `${crop.emoji} ${player.language === "ar" ? crop.nameAr : crop.nameEn} (${crop.buy} ${player.language === "ar" ? "عملة" : "coins"})`;
            btn.className = "popup-crop-btn";
            btn.onclick = () => {
                plantCrop(key, fieldIdx);
                document.body.removeChild(popup);
            };
            inner.appendChild(btn);
        }
    }
    const closeBtn = document.createElement("button");
    closeBtn.innerText = player.language === "ar" ? "إغلاق" : "Close";
    closeBtn.className = "popup-crop-btn popup-close";
    closeBtn.onclick = () => document.body.removeChild(popup);
    inner.appendChild(closeBtn);
    popup.appendChild(inner);
    document.body.appendChild(popup);
}
