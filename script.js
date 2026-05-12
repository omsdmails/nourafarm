// -------------------- بيانات اللعبة --------------------
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

// قائمة المهام اليومية (ثابتة)
const DAILY_TASKS = [
    { id: "plant",   nameAr: "🌾 ازرع 3 محاصيل",      nameEn: "🌾 Plant 3 crops",      target: 3, reward: 10, type: "plantCount" },
    { id: "harvest", nameAr: "✂ احصد 5 محاصيل",      nameEn: "✂ Harvest 5 crops",    target: 5, reward: 15, type: "harvestCount" },
    { id: "egg",     nameAr: "🥚 اجمع بيض الدجاج",    nameEn: "🥚 Collect chicken eggs", target: 1, reward: 5,  type: "eggCollect" },
    { id: "sell",    nameAr: "🛒 بع 5 منتجات بالسوق", nameEn: "🛒 Sell 5 items",       target: 5, reward: 20, type: "sellCount" },
    { id: "ad",      nameAr: "📺 شاهد إعلاناً",        nameEn: "📺 Watch an ad",       target: 1, reward: 25, type: "adWatch" }
];

// حالة اللاعب
let player = {
    username: "مزارع",
    farmCoins: 50,
    score: 0,
    level: 1,
    fields: [null, null, null, null], // 4 حقول
    animals: [],
    inventory: {},
    totalHarvested: 0,
    language: "ar",
    tasks: {},
    lastTaskReset: Date.now(),
};

// -------------------- دوال مساعدة --------------------
function getCurrentLang() { return player.language; }
function t(key, ar, en) { return player.language === "ar" ? ar : en; }
function saveGame() { localStorage.setItem("farmGameSave", JSON.stringify(player)); }

function loadGame() {
    const saved = localStorage.getItem("farmGameSave");
    if (saved) {
        try {
            const data = JSON.parse(saved);
            player = { ...player, ...data };
            if (!player.fields) player.fields = [null, null, null, null];
            if (!player.tasks) player.tasks = {};
            if (!player.lastTaskReset) player.lastTaskReset = Date.now();
            checkResetDailyTasks();
            updateUI();
        } catch(e) { console.log(e); }
    }
    recalcLevel();
    updateUI();
}

// التحقق من تجديد المهام اليومية (كل 24 ساعة)
function checkResetDailyTasks() {
    const now = Date.now();
    const oneDay = 86400000;
    if (now - player.lastTaskReset >= oneDay) {
        player.tasks = {};
        DAILY_TASKS.forEach(task => {
            player.tasks[task.id] = { progress: 0, completed: false };
        });
        player.lastTaskReset = now;
        saveGame();
        showMessage(t("newTasks", "✨ تم تجديد المهام اليومية!", "✨ Daily tasks reset!"), "success");
    } else {
        DAILY_TASKS.forEach(task => {
            if (!player.tasks[task.id]) {
                player.tasks[task.id] = { progress: 0, completed: false };
            }
        });
    }
}

// إضافة تقدم لمهمة معينة
function addTaskProgress(taskId, increment = 1) {
    if (!player.tasks[taskId]) return;
    let task = player.tasks[taskId];
    if (task.completed) return;
    const originalTask = DAILY_TASKS.find(t => t.id === taskId);
    task.progress += increment;
    if (task.progress >= originalTask.target) {
        task.completed = true;
        player.farmCoins += originalTask.reward;
        player.score += 2;
        showMessage(t("taskComplete", `✅ أنجزت "${originalTask.nameAr}" وكسبت ${originalTask.reward} عملة!`, `✅ Completed "${originalTask.nameEn}" and earned ${originalTask.reward} coins!`), "success");
        recalcLevel();
    }
    saveGame();
    updateUI();
}

// دوال اللعبة الأساسية
function recalcLevel() { player.level = Math.max(1, Math.floor(player.score / 10) + 1); }
function addCoins(amount) { player.farmCoins += amount; updateUI(); saveGame(); }
function addScore(points) { player.score += points; recalcLevel(); updateUI(); saveGame(); }

function plantCrop(cropKey, fieldIndex) {
    const crop = CROPS[cropKey];
    if (!crop) return false;
    if (player.farmCoins < crop.buy) { showMessage(`لا تملك ${crop.buy} عملة`, "warning"); return false; }
    if (player.level < crop.levelReq) { showMessage(`يتطلب مستوى ${crop.levelReq}`, "warning"); return false; }
    player.farmCoins -= crop.buy;
    player.fields[fieldIndex] = { cropKey: cropKey, plantedAt: Date.now() };
    addTaskProgress("plant");
    saveGame();
    updateUI();
    showMessage(`زرعت ${getCurrentLang() === "ar" ? crop.nameAr : crop.nameEn}!`, "success");
    return true;
}

function harvestField(index) {
    const field = player.fields[index];
    if (!field) return;
    const crop = CROPS[field.cropKey];
    const elapsed = (Date.now() - field.plantedAt) / 1000;
    if (elapsed >= crop.growTime) {
        player.farmCoins += crop.sell;
        player.score += 1;
        player.inventory[field.cropKey] = (player.inventory[field.cropKey] || 0) + 1;
        player.totalHarvested++;
        player.fields[index] = null;
        addTaskProgress("harvest");
        recalcLevel();
        updateUI();
        showMessage(`حصّدت ${crop.nameAr} +${crop.sell} عملة`, "success");
        saveGame();
    } else {
        let remain = Math.ceil(crop.growTime - elapsed);
        showMessage(`ينمو بعد ${remain} ثانية`, "info");
    }
}

function harvestAll() {
    let harvested = 0;
    for (let i = 0; i < player.fields.length; i++) {
        const f = player.fields[i];
        if (f) {
            const crop = CROPS[f.cropKey];
            const elapsed = (Date.now() - f.plantedAt) / 1000;
            if (elapsed >= crop.growTime) {
                player.farmCoins += crop.sell;
                player.score += 1;
                player.inventory[f.cropKey] = (player.inventory[f.cropKey] || 0) + 1;
                player.totalHarvested++;
                player.fields[i] = null;
                harvested++;
                addTaskProgress("harvest");
            }
        }
    }
    if (harvested) {
        recalcLevel();
        updateUI();
        showMessage(`حصّدت ${harvested} محصول`, "success");
        saveGame();
    } else showMessage("لا محاصيل ناضجة", "info");
}

function buyAnimal(animalKey) {
    const animal = ANIMALS[animalKey];
    if (player.farmCoins < animal.price) { showMessage(`لا تملك ${animal.price} عملة`, "warning"); return; }
    player.farmCoins -= animal.price;
    player.animals.push({ type: animalKey, lastCollect: Date.now() - animal.interval });
    updateUI();
    showMessage(`اشتريت ${animal.nameAr}!`, "success");
    saveGame();
}

function collectAnimal(idx) {
    const anim = player.animals[idx];
    const animal = ANIMALS[anim.type];
    const now = Date.now();
    if (now - anim.lastCollect >= animal.interval) {
        const product = animal.product;
        player.inventory[product] = (player.inventory[product] || 0) + 1;
        player.farmCoins += animal.sellProduct;
        player.score += 1;
        anim.lastCollect = now;
        if (product === "Egg") addTaskProgress("egg");
        updateUI();
        showMessage(`جمعت ${animal.productEmoji} ${product} +${animal.sellProduct} عملة`, "success");
        saveGame();
    } else {
        let remain = Math.ceil((animal.interval - (now - anim.lastCollect)) / 1000);
        showMessage(`جاهز بعد ${remain} ثانية`, "info");
    }
}

function sellInventoryItem(itemKey) {
    let qty = player.inventory[itemKey] || 0;
    if (qty <= 0) return;
    let price = 0;
    if (CROPS[itemKey]) price = CROPS[itemKey].sell;
    else {
        for (let a of Object.values(ANIMALS)) if (a.product === itemKey) price = a.sellProduct;
    }
    if (price > 0) {
        player.inventory[itemKey]--;
        player.farmCoins += price;
        addTaskProgress("sell");
        updateUI();
        showMessage(`بعت ${itemKey} بـ ${price} عملة`, "success");
        saveGame();
    }
}

function watchAd() {
    const btn = document.getElementById("watchAdBtn");
    if (!btn) return;
    btn.disabled = true;
    btn.innerText = "⏳ جارٍ تشغيل الإعلان...";
    setTimeout(() => {
        const reward = 10;
        player.farmCoins += reward;
        addTaskProgress("ad");
        saveGame();
        updateUI();
        btn.disabled = false;
        btn.innerText = t("watchAd", "📺 شاهد إعلان واحصل على 10 عملات", "📺 Watch Ad & get 10 Coins");
        showMessage(`شكراً! +${reward} عملة 🎉`, "success");
    }, 1500);
}

function showMessage(msg, type) {
    const msgDiv = document.getElementById("adMessage");
    if (!msgDiv) return;
    msgDiv.innerText = msg;
    msgDiv.style.color = type === "error" ? "#ffaaaa" : (type === "success" ? "#c3ffb3" : "#ffe6a3");
    setTimeout(() => { if (msgDiv.innerText === msg) msgDiv.innerText = ""; }, 2500);
}

// -------------------- تحديث الواجهة --------------------
function updateUI() {
    document.getElementById("farmCoins").innerText = player.farmCoins;
    document.getElementById("level").innerText = player.level;
    document.getElementById("score").innerText = player.score;
    document.getElementById("coinName").innerText = player.language === "ar" ? "عملة المزرعة" : "FarmCoin";

    // حقول الزراعة
    const fieldsDiv = document.getElementById("fieldsGrid");
    if (fieldsDiv) {
        fieldsDiv.innerHTML = "";
        for (let i = 0; i < 4; i++) {
            const f = player.fields[i];
            let html = `<div class="field-slot empty" data-field-index="${i}">`;
            if (f) {
                const crop = CROPS[f.cropKey];
                const elapsed = (Date.now() - f.plantedAt) / 1000;
                const ready = elapsed >= crop.growTime;
                const cropName = player.language === "ar" ? crop.nameAr : crop.nameEn;
                if (ready) {
                    html = `<div class="field-slot ready" data-field-index="${i}">✅ ${crop.emoji} ${cropName}<br><small>جاهز!</small>`;
                } else {
                    let remain = Math.ceil(crop.growTime - elapsed);
                    html = `<div class="field-slot" data-field-index="${i}">🌱 ${crop.emoji} ${cropName}<br><small>${remain} ثانية</small>`;
                }
            } else {
                html = `<div class="field-slot empty" data-field-index="${i}">🌾 حقل فارغ<br><small>اضغط للزراعة</small>`;
            }
            html += `</div>`;
            fieldsDiv.innerHTML += html;
        }
        document.querySelectorAll(".field-slot").forEach(el => {
            const idx = parseInt(el.dataset.fieldIndex);
            el.addEventListener("click", (e) => {
                e.stopPropagation();
                if (player.fields[idx]) harvestField(idx);
                else showCropSelectionPopup(idx);
            });
        });
    }

    // قائمة المحاصيل
    const cropsContainer = document.getElementById("cropsList");
    if (cropsContainer) {
        cropsContainer.innerHTML = "";
        for (let [key, crop] of Object.entries(CROPS)) {
            if (player.level >= crop.levelReq) {
                let btn = document.createElement("button");
                btn.className = "crop-btn";
                let name = player.language === "ar" ? crop.nameAr : crop.nameEn;
                btn.innerText = `${crop.emoji} ${name} (${crop.buy} عملة)`;
                btn.addEventListener("click", () => {
                    let emptyIdx = player.fields.findIndex(f => f === null);
                    if (emptyIdx !== -1) plantCrop(key, emptyIdx);
                    else showMessage("لا حقول فارغة!", "warning");
                });
                cropsContainer.appendChild(btn);
            }
        }
    }

    // الحيوانات
    const animalsDiv = document.getElementById("animalsList");
    if (animalsDiv) {
        animalsDiv.innerHTML = "";
        player.animals.forEach((anim, idx) => {
            let animal = ANIMALS[anim.type];
            let now = Date.now();
            let ready = (now - anim.lastCollect) >= animal.interval;
            let status = ready ? "جاهز!" : `${Math.ceil((animal.interval - (now - anim.lastCollect))/1000)} ثانية`;
            let div = document.createElement("div");
            div.className = "animal-card";
            div.innerText = `${animal.emoji} ${player.language === "ar" ? animal.nameAr : animal.nameEn} - ${animal.productEmoji} ${animal.product} : ${status}`;
            if (ready) div.style.background = "#e9b35f";
            div.addEventListener("click", () => collectAnimal(idx));
            animalsDiv.appendChild(div);
        });
    }

    // مخزون السوق
    const invDiv = document.getElementById("inventoryList");
    if (invDiv) {
        invDiv.innerHTML = "";
        for (let [item, qty] of Object.entries(player.inventory)) {
            if (qty > 0) {
                let emoji = CROPS[item] ? CROPS[item].emoji : (Object.values(ANIMALS).find(a=>a.product===item)?.productEmoji || "📦");
                let price = CROPS[item] ? CROPS[item].sell : (Object.values(ANIMALS).find(a=>a.product===item)?.sellProduct || 0);
                let btn = document.createElement("button");
                btn.className = "sell-btn";
                btn.innerText = `${emoji} ${item} (${qty}) - بيع بـ ${price} عملة`;
                btn.addEventListener("click", () => sellInventoryItem(item));
                invDiv.appendChild(btn);
            }
        }
    }

    // الإحصائيات
    const statsDiv = document.getElementById("statsDetails");
    if (statsDiv) {
        statsDiv.innerHTML = `<p>👤 ${player.username}</p>
                              <p>🪙 ${player.farmCoins} ${player.language === "ar" ? "عملة" : "coins"}</p>
                              <p>⭐ ${player.score} ${player.language === "ar" ? "نقطة" : "points"}</p>
                              <p>🏆 ${player.language === "ar" ? "مستوى" : "Level"} ${player.level}</p>
                              <p>🌾 ${player.language === "ar" ? "حصاد" : "Harvested"}: ${player.totalHarvested}</p>
                              <p>🐔 ${player.language === "ar" ? "حيوانات" : "Animals"}: ${player.animals.length}</p>`;
    }

    // المهام اليومية
    renderDailyTasks();
}

function renderDailyTasks() {
    const tasksDiv = document.getElementById("dailyTasksList");
    if (!tasksDiv) return;
    tasksDiv.innerHTML = "";
    checkResetDailyTasks();
    DAILY_TASKS.forEach(task => {
        let taskData = player.tasks[task.id];
        if (!taskData) return;
        let progress = taskData.progress;
        let completed = taskData.completed;
        let percent = Math.min(100, (progress / task.target) * 100);
        let name = player.language === "ar" ? task.nameAr : task.nameEn;
        let rewardText = player.language === "ar" ? `مكافأة: ${task.reward} عملة` : `Reward: ${task.reward} coins`;
        let statusText = completed ? (player.language === "ar" ? "✅ مكتملة" : "✅ Completed") : `${progress}/${task.target}`;
        let card = document.createElement("div");
        card.className = "task-card";
        card.innerHTML = `
            <div class="task-title"><span>${name}</span><span>${rewardText}</span></div>
            <div class="task-progress"><div class="task-progress-fill" style="width:${percent}%;"></div></div>
            <div class="task-status">${statusText}</div>
        `;
        tasksDiv.appendChild(card);
    });
    const msgDiv = document.getElementById("tasksResetMessage");
    if (msgDiv) {
        let now = Date.now();
        let nextReset = player.lastTaskReset + 86400000;
        let hoursLeft = Math.ceil((nextReset - now) / 3600000);
        if (hoursLeft > 0 && hoursLeft < 24) {
            msgDiv.innerText = player.language === "ar" ? `⏳ تجديد المهام بعد ${hoursLeft} ساعة` : `⏳ Tasks reset in ${hoursLeft} hours`;
        } else msgDiv.innerText = "";
    }
}

// نافذة اختيار المحصول (باستخدام الكلاسات الجديدة)
function showCropSelectionPopup(fieldIdx) {
    const popup = document.createElement("div");
    popup.className = "popup-overlay";
    const inner = document.createElement("div");
    inner.className = "popup-inner";
    inner.innerHTML = `<h3>🌾 ${player.language === "ar" ? "اختر محصولاً" : "Choose a crop"}</h3>`;
    for (let [key, crop] of Object.entries(CROPS)) {
        if (player.level >= crop.levelReq) {
            let btn = document.createElement("button");
            btn.innerText = `${crop.emoji} ${player.language === "ar" ? crop.nameAr : crop.nameEn} (${crop.buy} ${player.language === "ar" ? "عملة" : "coins"})`;
            btn.className = "popup-crop-btn";
            btn.onclick = () => {
                plantCrop(key, fieldIdx);
                document.body.removeChild(popup);
            };
            inner.appendChild(btn);
        }
    }
    let closeBtn = document.createElement("button");
    closeBtn.innerText = player.language === "ar" ? "إغلاق" : "Close";
    closeBtn.className = "popup-crop-btn popup-close";
    closeBtn.onclick = () => document.body.removeChild(popup);
    inner.appendChild(closeBtn);
    popup.appendChild(inner);
    document.body.appendChild(popup);
}

// تحديث دوري (كل ثانية)
setInterval(() => { updateUI(); saveGame(); }, 1000);

// -------------------- أحداث الأزرار --------------------
document.addEventListener("DOMContentLoaded", () => {
    const watchAdBtn = document.getElementById("watchAdBtn");
    if (watchAdBtn) watchAdBtn.addEventListener("click", watchAd);
    const harvestAllBtn = document.getElementById("harvestAllBtn");
    if (harvestAllBtn) harvestAllBtn.addEventListener("click", harvestAll);
    const buyChicken = document.getElementById("buyChickenBtn");
    if (buyChicken) buyChicken.addEventListener("click", () => buyAnimal("Chicken"));
    const buyCow = document.getElementById("buyCowBtn");
    if (buyCow) buyCow.addEventListener("click", () => buyAnimal("Cow"));
    const buySheep = document.getElementById("buySheepBtn");
    if (buySheep) buySheep.addEventListener("click", () => buyAnimal("Sheep"));

    // التبويبات
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            let tabId = btn.dataset.tab;
            document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
            const activeTab = document.getElementById(`${tabId}Tab`);
            if (activeTab) activeTab.classList.add("active");
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if (tabId === "tasks") renderDailyTasks();
        });
    });

    // تبديل اللغة
    const langAr = document.getElementById("langAr");
    const langEn = document.getElementById("langEn");
    if (langAr) {
        langAr.addEventListener("click", () => {
            player.language = "ar";
            document.documentElement.lang = "ar";
            document.documentElement.dir = "rtl";
            langAr.classList.add("active");
            if (langEn) langEn.classList.remove("active");
            updateUI();
            saveGame();
        });
    }
    if (langEn) {
        langEn.addEventListener("click", () => {
            player.language = "en";
            document.documentElement.lang = "en";
            document.documentElement.dir = "ltr";
            langEn.classList.add("active");
            if (langAr) langAr.classList.remove("active");
            updateUI();
            saveGame();
        });
    }
});

// تهيئة اللعبة
loadGame();
updateUI();
