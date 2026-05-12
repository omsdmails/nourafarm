// ==================== بيانات اللعبة ====================
const CROPS = {
    "Wheat": { nameAr: "قمح", nameEn: "Wheat", emoji: "🌾", buy: 2, sell: 5, growTime: 5, levelReq: 1 },
    "Tomato": { nameAr: "طماطم", nameEn: "Tomato", emoji: "🍅", buy: 3, sell: 8, growTime: 7, levelReq: 2 },
    "Carrot": { nameAr: "جزر", nameEn: "Carrot", emoji: "🥕", buy: 1, sell: 4, growTime: 4, levelReq: 1 },
    "Potato": { nameAr: "بطاطا", nameEn: "Potato", emoji: "🥔", buy: 2, sell: 6, growTime: 6, levelReq: 1 },
    "Corn": { nameAr: "ذرة", nameEn: "Corn", emoji: "🌽", buy: 3, sell: 7, growTime: 8, levelReq: 2 },
};

const ANIMALS = {
    "Chicken": { nameAr: "دجاجة", nameEn: "Chicken", emoji: "🐔", product: "Egg", productEmoji: "🥚", price: 20, interval: 10000, sellProduct: 3 },
    "Cow": { nameAr: "بقرة", nameEn: "Cow", emoji: "🐄", product: "Milk", productEmoji: "🥛", price: 50, interval: 20000, sellProduct: 8 },
    "Sheep": { nameAr: "خروف", nameEn: "Sheep", emoji: "🐑", product: "Wool", productEmoji: "🧶", price: 40, interval: 15000, sellProduct: 6 },
};

// حالة اللاعب
let player = {
    username: "مزارع",
    farmCoins: 50,
    score: 0,
    level: 1,
    fields: [],        // { cropKey, plantedAt }
    animals: [],       // { type, lastCollect }
    inventory: {},     // { Wheat: 0, Egg: 0 ... }
    totalHarvested: 0,
    language: "ar",
};

// التواريخ والوقت للحيوانات
let lastUpdateTime = Date.now();

// ==================== دوال مساعدة ====================
function getCurrentLang() {
    return player.language;
}

function t(key, defaultAr, defaultEn) {
    return getCurrentLang() === "ar" ? defaultAr : defaultEn;
}

function saveGame() {
    localStorage.setItem("farmGameSave", JSON.stringify({
        ...player,
        lastSaveTime: Date.now(),
    }));
}

function loadGame() {
    const saved = localStorage.getItem("farmGameSave");
    if (saved) {
        try {
            const data = JSON.parse(saved);
            player = { ...player, ...data };
            // إعادة ضبط المؤقتات النسبية
            lastUpdateTime = Date.now();
        } catch(e) {}
    }
    recalcLevel();
    updateUI();
}

function recalcLevel() {
    let newLevel = Math.floor(player.score / 10) + 1;
    if (newLevel < 1) newLevel = 1;
    player.level = newLevel;
}

function addCoins(amount) {
    player.farmCoins += amount;
    updateUI();
}

function addScore(points) {
    player.score += points;
    recalcLevel();
    updateUI();
}

// زراعة محصول في أول حقل فارغ
function plantCrop(cropKey) {
    if (player.fields.length >= 4) {
        showMessage("ليس لديك حقول فارغة!", "warning");
        return false;
    }
    const crop = CROPS[cropKey];
    if (!crop) return false;
    if (player.farmCoins < crop.buy) {
        showMessage(`لا تملك ${crop.buy} عملة لزراعة ${getCurrentLang() === "ar" ? crop.nameAr : crop.nameEn}`, "warning");
        return false;
    }
    if (player.level < crop.levelReq) {
        showMessage(`هذا المحصول يتطلب مستوى ${crop.levelReq}`, "warning");
        return false;
    }
    player.farmCoins -= crop.buy;
    player.fields.push({
        cropKey: cropKey,
        plantedAt: Date.now(),
    });
    updateUI();
    showMessage(`تمت زراعة ${getCurrentLang() === "ar" ? crop.nameAr : crop.nameEn}! 🌱`, "success");
    saveGame();
    return true;
}

// حصاد محصول في موقع معين
function harvestField(index) {
    if (index >= player.fields.length) return;
    const field = player.fields[index];
    const crop = CROPS[field.cropKey];
    const now = Date.now();
    const elapsed = (now - field.plantedAt) / 1000;
    if (elapsed >= crop.growTime) {
        // ناضجة
        player.farmCoins += crop.sell;
        player.score += 1;
        player.inventory[field.cropKey] = (player.inventory[field.cropKey] || 0) + 1;
        player.totalHarvested++;
        player.fields.splice(index, 1);
        recalcLevel();
        updateUI();
        showMessage(`حصاد ${getCurrentLang() === "ar" ? crop.nameAr : crop.nameEn}! +${crop.sell} عملة`, "success");
        saveGame();
    } else {
        const remaining = Math.ceil(crop.growTime - elapsed);
        showMessage(`ينمو بعد ${remaining} ثانية`, "info");
    }
}

function harvestAll() {
    let harvested = 0;
    for (let i = player.fields.length-1; i >= 0; i--) {
        const field = player.fields[i];
        const crop = CROPS[field.cropKey];
        const elapsed = (Date.now() - field.plantedAt) / 1000;
        if (elapsed >= crop.growTime) {
            player.farmCoins += crop.sell;
            player.score += 1;
            player.inventory[field.cropKey] = (player.inventory[field.cropKey] || 0) + 1;
            player.totalHarvested++;
            player.fields.splice(i,1);
            harvested++;
        }
    }
    if (harvested > 0) {
        recalcLevel();
        updateUI();
        showMessage(`حصاد ${harvested} محصول!`, "success");
        saveGame();
    } else {
        showMessage("لا توجد محاصيل ناضجة", "info");
    }
}

// شراء حيوان
function buyAnimal(animalKey) {
    const animal = ANIMALS[animalKey];
    if (!animal) return;
    if (player.farmCoins < animal.price) {
        showMessage(`لا تملك ${animal.price} عملة لشراء ${getCurrentLang() === "ar" ? animal.nameAr : animal.nameEn}`, "warning");
        return;
    }
    player.farmCoins -= animal.price;
    player.animals.push({
        type: animalKey,
        lastCollect: Date.now() - animal.interval,
    });
    updateUI();
    showMessage(`تم شراء ${getCurrentLang() === "ar" ? animal.nameAr : animal.nameEn}! 🐾`, "success");
    saveGame();
}

// جمع منتج من الحيوان
function collectAnimal(idx) {
    const animalData = player.animals[idx];
    const animal = ANIMALS[animalData.type];
    const now = Date.now();
    if (now - animalData.lastCollect >= animal.interval) {
        const product = animal.product;
        player.inventory[product] = (player.inventory[product] || 0) + 1;
        player.farmCoins += animal.sellProduct;
        player.score += 1;
        animalData.lastCollect = now;
        recalcLevel();
        updateUI();
        showMessage(`جمعت ${animal.productEmoji} ${animal.product}! +${animal.sellProduct} عملة`, "success");
        saveGame();
    } else {
        const remaining = Math.ceil((animal.interval - (now - animalData.lastCollect)) / 1000);
        showMessage(`جاهز بعد ${remaining} ثانية`, "info");
    }
}

// بيع عنصر من المخزون
function sellInventoryItem(itemKey) {
    const qty = player.inventory[itemKey] || 0;
    if (qty <= 0) return;
    let price = 0;
    if (CROPS[itemKey]) price = CROPS[itemKey].sell;
    else {
        // منتج حيواني
        for (let a of Object.values(ANIMALS)) {
            if (a.product === itemKey) price = a.sellProduct;
        }
    }
    if (price > 0) {
        player.inventory[itemKey]--;
        player.farmCoins += price;
        updateUI();
        showMessage(`بعت ${itemKey} بـ ${price} عملة`, "success");
        saveGame();
    }
}

// مشاهدة إعلان (محاكاة) – ستعوض لاحقاً بـ AdMob
function watchAd() {
    // محاكاة الإعلان لمدة ثانيتين
    const btn = document.getElementById("watchAdBtn");
    btn.disabled = true;
    btn.innerText = "⏳ جارٍ تشغيل الإعلان...";
    setTimeout(() => {
        const reward = 10;
        addCoins(reward);
        btn.disabled = false;
        btn.innerText = getCurrentLang() === "ar" ? "📺 شاهد إعلان واحصل على 10 عملات" : "📺 Watch Ad & get 10 Coins";
        showMessage(`شكراً لك! حصلت على ${reward} عملة إضافية 🎉`, "success");
        saveGame();
    }, 2000);
}

function showMessage(msg, type) {
    const msgDiv = document.getElementById("adMessage");
    msgDiv.innerText = msg;
    msgDiv.style.color = type === "error" ? "#ffaaaa" : (type === "success" ? "#c3ffb3" : "#ffe6a3");
    setTimeout(() => {
        if (msgDiv.innerText === msg) msgDiv.innerText = "";
    }, 2500);
}

// ==================== تحديث واجهة المستخدم ====================
function updateUI() {
    // العملة والمستوى
    document.getElementById("farmCoins").innerText = player.farmCoins;
    document.getElementById("level").innerText = player.level;
    document.getElementById("score").innerText = player.score;
    const coinSpan = document.getElementById("coinName");
    if (getCurrentLang() === "ar") coinSpan.innerText = "عملة المزرعة";
    else coinSpan.innerText = "FarmCoin";

    // تحديث الحقول
    const fieldsDiv = document.getElementById("fieldsGrid");
    fieldsDiv.innerHTML = "";
    for (let i = 0; i < 4; i++) {
        const field = player.fields[i];
        let html = `<div class="field-slot empty" data-field-index="${i}">`;
        if (field) {
            const crop = CROPS[field.cropKey];
            const elapsed = (Date.now() - field.plantedAt) / 1000;
            const ready = elapsed >= crop.growTime;
            const cropName = getCurrentLang() === "ar" ? crop.nameAr : crop.nameEn;
            if (ready) {
                html = `<div class="field-slot ready" data-field-index="${i}">✅ ${crop.emoji} ${cropName}<br><small>جاهز!</small>`;
            } else {
                const remain = Math.ceil(crop.growTime - elapsed);
                html = `<div class="field-slot" data-field-index="${i}">🌱 ${crop.emoji} ${cropName}<br><small>${remain} ثانية</small>`;
            }
        } else {
            html = `<div class="field-slot empty" data-field-index="${i}">🌾 حقل فارغ<br><small>اضغط للزراعة</small>`;
        }
        html += `</div>`;
        fieldsDiv.innerHTML += html;
    }
    // ربط أحداث الحقول
    document.querySelectorAll(".field-slot").forEach(el => {
        const idx = parseInt(el.dataset.fieldIndex);
        el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (player.fields[idx]) {
                harvestField(idx);
            } else {
                // فتح قائمة المحاصيل للزراعة في هذا الحقل
                showCropSelectionPopup(idx);
            }
        });
    });

    // تحديث قائمة المحاصيل المتاحة (أزرار الزراعة)
    const cropsContainer = document.getElementById("cropsList");
    cropsContainer.innerHTML = "";
    for (let [key, crop] of Object.entries(CROPS)) {
        if (player.level >= crop.levelReq) {
            const btn = document.createElement("button");
            btn.className = "crop-btn";
            const name = getCurrentLang() === "ar" ? crop.nameAr : crop.nameEn;
            btn.innerText = `${crop.emoji} ${name} (${crop.buy} عملة)`;
            btn.addEventListener("click", () => plantCrop(key));
            cropsContainer.appendChild(btn);
        }
    }

    // تحديث الحيوانات
    const animalsDiv = document.getElementById("animalsList");
    animalsDiv.innerHTML = "";
    player.animals.forEach((anim, idx) => {
        const animal = ANIMALS[anim.type];
        const now = Date.now();
        const ready = (now - anim.lastCollect) >= animal.interval;
        const status = ready ? "جاهز للإنتاج" : `${Math.ceil((animal.interval - (now - anim.lastCollect))/1000)} ثانية`;
        const div = document.createElement("div");
        div.className = "animal-card";
        div.innerText = `${animal.emoji} ${getCurrentLang() === "ar" ? animal.nameAr : animal.nameEn} - ${animal.productEmoji} ${animal.product} : ${status}`;
        if (ready) div.style.background = "#e9b35f";
        div.addEventListener("click", () => collectAnimal(idx));
        animalsDiv.appendChild(div);
    });

    // تحديث المخزون للسوق
    const invDiv = document.getElementById("inventoryList");
    invDiv.innerHTML = "";
    for (let [item, qty] of Object.entries(player.inventory)) {
        if (qty > 0) {
            let displayName = item;
            let emoji = "";
            if (CROPS[item]) emoji = CROPS[item].emoji;
            else {
                for (let a of Object.values(ANIMALS)) {
                    if (a.product === item) emoji = a.productEmoji;
                }
            }
            const btn = document.createElement("button");
            btn.className = "sell-btn";
            btn.innerText = `${emoji} ${item} (${qty}) - بيع بـ ${CROPS[item] ? CROPS[item].sell : (Object.values(ANIMALS).find(a=>a.product===item)?.sellProduct || 0)} عملة`;
            btn.addEventListener("click", () => sellInventoryItem(item));
            invDiv.appendChild(btn);
        }
    }

    // إحصائيات
    const statsDiv = document.getElementById("statsDetails");
    statsDiv.innerHTML = `
        <p>👤 ${getCurrentLang() === "ar" ? "الاسم" : "Name"}: ${player.username}</p>
        <p>🪙 ${getCurrentLang() === "ar" ? "عملات المزرعة" : "FarmCoins"}: ${player.farmCoins}</p>
        <p>⭐ ${getCurrentLang() === "ar" ? "النقاط" : "Score"}: ${player.score}</p>
        <p>🏆 ${getCurrentLang() === "ar" ? "المستوى" : "Level"}: ${player.level}</p>
        <p>🌾 ${getCurrentLang() === "ar" ? "إجمالي المحصول" : "Total Harvest"}: ${player.totalHarvested}</p>
        <p>🐔 ${getCurrentLang() === "ar" ? "الحيوانات المملوكة" : "Animals Owned"}: ${player.animals.length}</p>
    `;
}

function showCropSelectionPopup(fieldIdx) {
    const popupDiv = document.createElement("div");
    popupDiv.className = "popup-overlay";
    popupDiv.style.position = "fixed";
    popupDiv.style.top = "0";
    popupDiv.style.left = "0";
    popupDiv.style.width = "100%";
    popupDiv.style.height = "100%";
    popupDiv.style.backgroundColor = "rgba(0,0,0,0.7)";
    popupDiv.style.display = "flex";
    popupDiv.style.justifyContent = "center";
    popupDiv.style.alignItems = "center";
    popupDiv.style.zIndex = "1000";
    const inner = document.createElement("div");
    inner.style.background = "#3b5e2b";
    inner.style.padding = "20px";
    inner.style.borderRadius = "30px";
    inner.style.width = "80%";
    inner.style.maxWidth = "300px";
    inner.style.textAlign = "center";
    inner.innerHTML = "<h3>🌾 اختر محصولاً للزراعة</h3>";
    for (let [key, crop] of Object.entries(CROPS)) {
        if (player.level >= crop.levelReq) {
            const btn = document.createElement("button");
            btn.innerText = `${crop.emoji} ${getCurrentLang() === "ar" ? crop.nameAr : crop.nameEn} (${crop.buy} عملة)`;
            btn.style.display = "block";
            btn.style.margin = "8px auto";
            btn.style.padding = "8px";
            btn.style.borderRadius = "40px";
            btn.style.backgroundColor = "#ffcf4a";
            btn.style.border = "none";
            btn.onclick = () => {
                if (player.farmCoins >= crop.buy) {
                    player.farmCoins -= crop.buy;
                    player.fields[fieldIdx] = {
                        cropKey: key,
                        plantedAt: Date.now(),
                    };
                    saveGame();
                    updateUI();
                    document.body.removeChild(popupDiv);
                    showMessage(`زرعت ${getCurrentLang() === "ar" ? crop.nameAr : crop.nameEn}!`, "success");
                } else {
                    showMessage(`لا تملك ${crop.buy} عملة`, "error");
                }
            };
            inner.appendChild(btn);
        }
    }
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "إغلاق";
    closeBtn.style.marginTop = "15px";
    closeBtn.onclick = () => document.body.removeChild(popupDiv);
    inner.appendChild(closeBtn);
    popupDiv.appendChild(inner);
    document.body.appendChild(popupDiv);
}

// مؤقت نمو المحاصيل وإنتاج الحيوانات
setInterval(() => {
    updateUI(); // تحديث العدادات كل ثانية
    saveGame();
}, 1000);

// محاكاة الإعلان
document.getElementById("watchAdBtn").addEventListener("click", watchAd);
document.getElementById("harvestAllBtn").addEventListener("click", harvestAll);
document.getElementById("buyChickenBtn").addEventListener("click", () => buyAnimal("Chicken"));
document.getElementById("buyCowBtn").addEventListener("click", () => buyAnimal("Cow"));
document.getElementById("buySheepBtn").addEventListener("click", () => buyAnimal("Sheep"));

// تبديل التبويبات
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
        document.getElementById(`${tabId}Tab`).classList.add("active");
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    });
});

// تبديل اللغة
document.getElementById("langAr").addEventListener("click", () => {
    player.language = "ar";
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.getElementById("langAr").classList.add("active");
    document.getElementById("langEn").classList.remove("active");
    updateUI();
});
document.getElementById("langEn").addEventListener("click", () => {
    player.language = "en";
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    document.getElementById("langEn").classList.add("active");
    document.getElementById("langAr").classList.remove("active");
    updateUI();
});

// تحميل الحفظ وبدء اللعبة
loadGame();
updateUI();