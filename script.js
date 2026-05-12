// إعداد Supabase (استبدل بقيم مشروعك)
const SUPABASE_URL = 'https://kzheikbpxicoeohapfjb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aVm9aZ6W5vYTVvTxo3hucw__uZ06aId';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// بيانات اللعبة الأساسية
const CROPS = {
    "Wheat": { nameAr: "قمح", emoji: "🌾", buy: 2, sell: 5, growTime: 5, levelReq: 1 },
    "Tomato": { nameAr: "طماطم", emoji: "🍅", buy: 3, sell: 8, growTime: 7, levelReq: 2 },
    "Carrot": { nameAr: "جزر", emoji: "🥕", buy: 1, sell: 4, growTime: 4, levelReq: 1 },
};
const ANIMALS = {
    "Chicken": { nameAr: "دجاجة", emoji: "🐔", product: "Egg", productEmoji: "🥚", price: 20, interval: 10000, sellProduct: 3 },
};
const RECIPES = {
    "Pizza": { nameAr: "بيتزا", emoji: "🍕", ingredients: { "Wheat": 2, "Tomato": 1 }, sell: 15, cookTime: 5 },
};

let currentUser = null;
let playerData = null;
let currentGameType = 'farm';

// ******* إضافة دالة showMessage (هذا كان مفقوداً) *******
function showMessage(msg, type) {
    let msgDiv = document.getElementById('loginMsg'); // نستخدم عنصر عام
    if (!msgDiv) {
        // إذا لم يوجد ننشئ واحداً مؤقتاً
        msgDiv = document.createElement('div');
        msgDiv.id = 'tempMsg';
        document.body.appendChild(msgDiv);
    }
    msgDiv.innerText = msg;
    msgDiv.style.color = type === 'error' ? '#ffaaaa' : (type === 'success' ? '#c3ffb3' : '#ffe6a3');
    setTimeout(() => { if (msgDiv.innerText === msg) msgDiv.innerText = ''; }, 2500);
}
// *****************************************************

async function loadUserData() {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (error && error.code !== 'PGRST116') { console.error(error); return; }
    if (data) {
        playerData = data;
        currentGameType = data.game_type;
    } else {
        const newProfile = {
            id: currentUser.id,
            username: currentUser.email.split('@')[0],
            game_type: 'farm',
            gold: 100,
            score: 0,
            inventory: {},
            game_data: { fields: [null,null,null,null], animals: [] }
        };
        const { error: insertErr } = await supabase.from('profiles').insert(newProfile);
        if (insertErr) { alert('خطأ في إنشاء الملف'); return; }
        playerData = newProfile;
        currentGameType = 'farm';
    }
    if (!playerData.game_data) playerData.game_data = {};
    if (currentGameType === 'farm' && !playerData.game_data.fields) playerData.game_data.fields = [null,null,null,null];
    if (currentGameType === 'farm' && !playerData.game_data.animals) playerData.game_data.animals = [];
    if (currentGameType === 'restaurant' && !playerData.game_data.ovens) playerData.game_data.ovens = [null,null];
    renderGameUI();
}

async function savePlayerData(update) {
    if (!currentUser) return;
    const { error } = await supabase.from('profiles').update(update).eq('id', currentUser.id);
    if (error) console.error(error);
    else { if (update.gold !== undefined) playerData.gold = update.gold; }
}

function plantCrop(cropKey, fieldIdx) {
    const crop = CROPS[cropKey];
    if (!crop) return;
    if (playerData.gold < crop.buy) { showMessage('لا عملات كافية', 'error'); return; }
    playerData.gold -= crop.buy;
    playerData.game_data.fields[fieldIdx] = { cropKey, plantedAt: Date.now() };
    savePlayerData({ gold: playerData.gold, game_data: playerData.game_data });
    renderGameUI();
    showMessage(`زرعت ${crop.nameAr}`, 'success');
}

function harvestField(idx) {
    const field = playerData.game_data.fields[idx];
    if (!field) return;
    const crop = CROPS[field.cropKey];
    const elapsed = (Date.now() - field.plantedAt) / 1000;
    if (elapsed >= crop.growTime) {
        playerData.gold += crop.sell;
        if (!playerData.inventory[field.cropKey]) playerData.inventory[field.cropKey] = 0;
        playerData.inventory[field.cropKey]++;
        playerData.game_data.fields[idx] = null;
        savePlayerData({ gold: playerData.gold, inventory: playerData.inventory, game_data: playerData.game_data });
        renderGameUI();
        showMessage(`حصّدت ${crop.nameAr} +${crop.sell}`, 'success');
    } else showMessage('لم ينضج بعد', 'info');
}

function harvestAll() {
    for(let i=0;i<4;i++) harvestField(i);
}

function buyAnimal() {
    const animal = ANIMALS.Chicken;
    if (playerData.gold < animal.price) { showMessage('لا عملات كافية', 'error'); return; }
    playerData.gold -= animal.price;
    if (!playerData.game_data.animals) playerData.game_data.animals = [];
    playerData.game_data.animals.push({ type: 'Chicken', lastCollect: Date.now() - animal.interval });
    savePlayerData({ gold: playerData.gold, game_data: playerData.game_data });
    renderGameUI();
    showMessage('اشتريت دجاجة', 'success');
}

function collectAnimal(idx) {
    const animal = playerData.game_data.animals[idx];
    const data = ANIMALS.Chicken;
    const now = Date.now();
    if (now - animal.lastCollect >= data.interval) {
        playerData.inventory['Egg'] = (playerData.inventory['Egg'] || 0) + 1;
        playerData.gold += data.sellProduct;
        animal.lastCollect = now;
        savePlayerData({ gold: playerData.gold, inventory: playerData.inventory, game_data: playerData.game_data });
        renderGameUI();
        showMessage(`جمعت بيضة +${data.sellProduct}`, 'success');
    } else showMessage('انتظر', 'info');
}

function cookRecipe(recipeKey) {
    const recipe = RECIPES[recipeKey];
    for (let [ing, qty] of Object.entries(recipe.ingredients)) {
        if ((playerData.inventory[ing] || 0) < qty) { showMessage(`ناقص ${ing}`, 'error'); return; }
    }
    for (let [ing, qty] of Object.entries(recipe.ingredients)) playerData.inventory[ing] -= qty;
    playerData.gold += recipe.sell;
    savePlayerData({ gold: playerData.gold, inventory: playerData.inventory });
    renderGameUI();
    showMessage(`صنعت ${recipe.nameAr} +${recipe.sell}`, 'success');
}

async function loadMarketListings() {
    const { data, error } = await supabase.from('market_listings').select('*, seller:profiles(username)').eq('status', 'active');
    if (error) { console.error(error); return []; }
    return data;
}

async function createListing(item, qty, price) {
    if (!playerData.inventory[item] || playerData.inventory[item] < qty) { showMessage('لا تملك الكمية', 'error'); return; }
    const { error } = await supabase.from('market_listings').insert({
        seller_id: currentUser.id,
        item_name: item,
        quantity: qty,
        price_per_unit: price
    });
    if (error) { showMessage('خطأ في الإعلان', 'error'); return; }
    playerData.inventory[item] -= qty;
    await savePlayerData({ inventory: playerData.inventory });
    renderGameUI();
    showMessage(`تم وضع ${qty} ${item} للبيع`, 'success');
}

async function buyListing(listing) {
    if (playerData.gold < listing.price_per_unit * listing.quantity) { showMessage('لا عملات كافية', 'error'); return; }
    showMessage('تم الشراء (نموذج) – سيكتمل لاحقاً', 'success');
}

function renderGameUI() {
    const container = document.getElementById('app');
    if (!container) return;
    let html = `
        <div class="screen active" id="gameScreen">
            <div class="stats-bar" style="display:flex; justify-content:space-between; background:#1f3b1a; padding:10px;">
                <span>💰 ${playerData.gold} ذهب</span>
                <span>⭐ ${playerData.score || 0}</span>
                <span>👤 ${playerData.username}</span>
                <button id="logoutBtn" style="width:auto; padding:5px 10px;">🚪 خروج</button>
            </div>
            <div class="tabs" id="gameTabs"></div>
            <div id="tabContent"></div>
        </div>
    `;
    container.innerHTML = html;
    const tabsContainer = document.getElementById('gameTabs');
    const tabContentDiv = document.getElementById('tabContent');
    const tabs = (currentGameType === 'farm') ? 
        [{ id: 'farm', name: '🌾 المزرعة' }, { id: 'animals', name: '🐔 الحيوانات' }, { id: 'market', name: '🛒 السوق المشترك' }] :
        [{ id: 'kitchen', name: '🍳 المطبخ' }, { id: 'market', name: '🛒 السوق المشترك' }];
    let activeTab = tabs[0].id;
    function switchTab(tabId) { activeTab = tabId; renderTabContent(); }
    function renderTabContent() {
        if (!tabContentDiv) return;
        if (activeTab === 'farm') {
            let fieldsHtml = '<div class="fields-grid">';
            for (let i=0; i<4; i++) {
                let f = playerData.game_data.fields[i];
                if (f) {
                    let crop = CROPS[f.cropKey];
                    let ready = (Date.now() - f.plantedAt)/1000 >= crop.growTime;
                    fieldsHtml += `<div class="field-slot ${ready ? 'ready' : ''}" onclick="window.harvestField(${i})">${crop.emoji} ${crop.nameAr}<br>${ready ? 'جاهز' : 'ينمو'}</div>`;
                } else {
                    let cropBtns = '';
                    for (let [k,c] of Object.entries(CROPS)) cropBtns += `<button class="crop-btn" onclick="window.plantCrop('${k}',${i})">${c.emoji} ${c.nameAr} (${c.buy})</button>`;
                    fieldsHtml += `<div class="field-slot">🌾 حقل فارغ<br>${cropBtns}</div>`;
                }
            }
            fieldsHtml += '</div><button class="harvest-btn" onclick="window.harvestAll()">حصاد الكل</button>';
            tabContentDiv.innerHTML = fieldsHtml;
        } else if (activeTab === 'animals') {
            let animalsHtml = '<div class="animals-list">';
            playerData.game_data.animals.forEach((a,idx) => {
                let ready = (Date.now() - a.lastCollect) >= ANIMALS.Chicken.interval;
                animalsHtml += `<div class="animal-card" onclick="window.collectAnimal(${idx})">🐔 دجاجة - ${ready ? 'جاهزة' : 'تنتظر'} 🥚</div>`;
            });
            animalsHtml += `<button class="buy-animal-btn" onclick="window.buyAnimal()">🐔 شراء دجاجة (20)</button></div>`;
            tabContentDiv.innerHTML = animalsHtml;
        } else if (activeTab === 'kitchen') {
            let recipesHtml = '<div class="crops-list">';
            for (let [k,r] of Object.entries(RECIPES)) {
                recipesHtml += `<button class="crop-btn" onclick="window.cookRecipe('${k}')">${r.emoji} ${r.nameAr} (بيع ${r.sell})</button>`;
            }
            recipesHtml += '</div>';
            tabContentDiv.innerHTML = recipesHtml;
        } else if (activeTab === 'market') {
            (async () => {
                const listings = await loadMarketListings();
                let marketHtml = '<div class="market-listings"><h3>📢 إعلانات السوق</h3>';
                for (let l of listings) {
                    marketHtml += `
                        <div class="listing-card">
                            <span>${l.item_name} x${l.quantity}</span>
                            <span>💰 ${l.price_per_unit} لكل وحدة</span>
                            <span>👤 ${l.seller?.username || 'بائع'}</span>
                            <button onclick="window.buyListing(${JSON.stringify(l).replace(/"/g, '&quot;')})">شراء</button>
                        </div>`;
                }
                marketHtml += `<hr><h4>🔨 أضف إعلانك</h4>
                    <select id="sellItemSelect">${Object.keys(playerData.inventory).map(i => `<option value="${i}">${i}</option>`)}</select>
                    <input type="number" id="sellQty" placeholder="الكمية">
                    <input type="number" id="sellPrice" placeholder="السعر لكل وحدة">
                    <button onclick="window.createListing(document.getElementById('sellItemSelect').value, parseInt(document.getElementById('sellQty').value), parseInt(document.getElementById('sellPrice').value))">نشر إعلان</button>
                `;
                tabContentDiv.innerHTML = marketHtml;
            })();
        }
    }
    tabs.forEach(t => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${activeTab === t.id ? 'active' : ''}`;
        btn.innerText = t.name;
        btn.onclick = () => { switchTab(t.id); };
        tabsContainer.appendChild(btn);
    });
    renderTabContent();
    document.getElementById('logoutBtn').onclick = () => { supabase.auth.signOut(); location.reload(); };
}

async function renderLoginScreen() {
    const container = document.getElementById('app');
    container.innerHTML = `
        <div class="screen active" id="loginScreen">
            <div class="card">
                <h2>🌾 منصة الألعاب المشتركة</h2>
                <input type="email" id="email" placeholder="البريد الإلكتروني">
                <input type="password" id="password" placeholder="كلمة المرور">
                <button id="loginBtn">دخول</button>
                <button id="signupBtn">تسجيل جديد</button>
                <div id="loginMsg"></div>
            </div>
        </div>
    `;
    document.getElementById('loginBtn').onclick = async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) document.getElementById('loginMsg').innerText = error.message;
        else checkUser();
    };
    document.getElementById('signupBtn').onclick = async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const { error } = await supabase.auth.signUp({ email, password: pass });
        if (error) document.getElementById('loginMsg').innerText = error.message;
        else document.getElementById('loginMsg').innerText = 'تم التسجيل، سجل الدخول الآن';
    };
}

async function renderChooseGameScreen() {
    const container = document.getElementById('app');
    container.innerHTML = `
        <div class="screen active" id="chooseScreen">
            <div class="card">
                <h2>اختر نوع لعبتك</h2>
                <button id="chooseFarm">🌾 مزرعة</button>
                <button id="chooseRestaurant">🍽️ مطعم</button>
                <div id="chooseMsg"></div>
            </div>
        </div>
    `;
    document.getElementById('chooseFarm').onclick = async () => {
        await supabase.from('profiles').update({ game_type: 'farm' }).eq('id', currentUser.id);
        currentGameType = 'farm';
        await loadUserData();
        renderGameUI();
    };
    document.getElementById('chooseRestaurant').onclick = async () => {
        await supabase.from('profiles').update({ game_type: 'restaurant' }).eq('id', currentUser.id);
        currentGameType = 'restaurant';
        await loadUserData();
        renderGameUI();
    };
}

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        const { data: profile } = await supabase.from('profiles').select('game_type').eq('id', user.id).single();
        if (profile && profile.game_type) {
            currentGameType = profile.game_type;
            await loadUserData();
            renderGameUI();
        } else {
            renderChooseGameScreen();
        }
    } else {
        renderLoginScreen();
    }
}

window.plantCrop = plantCrop;
window.harvestField = harvestField;
window.harvestAll = harvestAll;
window.buyAnimal = buyAnimal;
window.collectAnimal = collectAnimal;
window.cookRecipe = cookRecipe;
window.createListing = createListing;
window.buyListing = buyListing;

checkUser();
