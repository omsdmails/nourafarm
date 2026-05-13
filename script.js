// -------------------- إعداد Supabase --------------------
const SUPABASE_URL = 'https://kzheikbpxicoeohapfjb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aVm9aZ6W5vYTVvTxo3hucw__uZ06aId';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;

// -------------------- دوال مساعدة --------------------
function showMessage(msg, type) {
    const msgDiv = document.getElementById('globalMsg');
    if (msgDiv) {
        msgDiv.innerText = msg;
        msgDiv.className = type === 'error' ? 'error' : 'success';
        setTimeout(() => { if (msgDiv.innerText === msg) msgDiv.innerText = ''; }, 3000);
    }
}

// -------------------- إنشاء ملف اللاعب --------------------
async function ensureProfile() {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (data) return data;
    
    const newProfile = {
        id: currentUser.id,
        username: currentUser.email.split('@')[0],
        gold: 100,
        score: 0,
        inventory: { Wheat: 3, Tomato: 1 },
        game_data: { field: null }
    };
    const { error: insertErr } = await supabase.from('profiles').insert(newProfile);
    if (insertErr) throw insertErr;
    return newProfile;
}

// -------------------- زراعة وحصاد --------------------
async function plantWheat() {
    if (currentProfile.game_data.field !== null) {
        showMessage('الحقل مشغول! احصد أولاً', 'error');
        return;
    }
    if (currentProfile.gold < 2) {
        showMessage('تحتاج 2 ذهب لزراعة القمح', 'error');
        return;
    }
    currentProfile.gold -= 2;
    currentProfile.game_data.field = { crop: 'Wheat', plantedAt: Date.now() };
    await supabase.from('profiles').update({ gold: currentProfile.gold, game_data: currentProfile.game_data }).eq('id', currentUser.id);
    showMessage('🌾 زرعت قمحاً! انتظر 5 ثوانٍ', 'success');
    renderGame();
}

async function harvestField() {
    if (!currentProfile.game_data.field) {
        showMessage('لا يوجد محصول في الحقل', 'error');
        return;
    }
    const elapsed = (Date.now() - currentProfile.game_data.field.plantedAt) / 1000;
    if (elapsed < 5) {
        showMessage('القمح لم ينضج بعد', 'error');
        return;
    }
    currentProfile.gold += 5;
    currentProfile.inventory.Wheat = (currentProfile.inventory.Wheat || 0) + 1;
    currentProfile.game_data.field = null;
    await supabase.from('profiles').update({ gold: currentProfile.gold, inventory: currentProfile.inventory, game_data: currentProfile.game_data }).eq('id', currentUser.id);
    showMessage('🌾 حصدت قمحاً! +5 ذهب', 'success');
    renderGame();
}

// -------------------- السوق المشترك --------------------
async function loadMarketListings() {
    const { data, error } = await supabase
        .from('market_listings')
        .select('*, seller:profiles(username)')
        .eq('status', 'active')
        .order('listed_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
}

async function sellDirect(item) {
    const price = { Wheat: 5, Tomato: 8, Carrot: 4 }[item] || 5;
    if (!currentProfile.inventory[item] || currentProfile.inventory[item] <= 0) {
        showMessage('لا تملك هذا المنتج', 'error');
        return;
    }
    currentProfile.inventory[item]--;
    currentProfile.gold += price;
    await supabase.from('profiles').update({ gold: currentProfile.gold, inventory: currentProfile.inventory }).eq('id', currentUser.id);
    showMessage(`بعت ${item} بـ ${price} ذهب`, 'success');
    renderGame();
}

async function buyListing(listingId, pricePerUnit, quantity, itemName) {
    const total = pricePerUnit * quantity;
    if (currentProfile.gold < total) {
        showMessage('لا تملك ذهباً كافياً', 'error');
        return;
    }
    
    // جلب بيانات الإعلان كاملة
    const { data: listing, error: listingErr } = await supabase
        .from('market_listings')
        .select('seller_id')
        .eq('id', listingId)
        .single();
    if (listingErr || !listing) return;
    
    // تحديث المشتري
    currentProfile.gold -= total;
    currentProfile.inventory[itemName] = (currentProfile.inventory[itemName] || 0) + quantity;
    await supabase.from('profiles').update({ gold: currentProfile.gold, inventory: currentProfile.inventory }).eq('id', currentUser.id);
    
    // تحديث البائع
    const { data: seller } = await supabase.from('profiles').select('gold').eq('id', listing.seller_id).single();
    if (seller) {
        await supabase.from('profiles').update({ gold: seller.gold + total }).eq('id', listing.seller_id);
    }
    
    // حذف الإعلان (تحديث الحالة)
    await supabase.from('market_listings').update({ status: 'sold' }).eq('id', listingId);
    
    showMessage(`اشتريت ${quantity} ${itemName} بـ ${total} ذهب`, 'success');
    renderGame();
}

async function createListing(item, qty, price) {
    if (!currentProfile.inventory[item] || currentProfile.inventory[item] < qty) {
        showMessage('لا تملك الكمية الكافية', 'error');
        return;
    }
    currentProfile.inventory[item] -= qty;
    await supabase.from('profiles').update({ inventory: currentProfile.inventory }).eq('id', currentUser.id);
    
    const { error } = await supabase.from('market_listings').insert({
        seller_id: currentUser.id,
        item_name: item,
        quantity: qty,
        price_per_unit: price
    });
    if (error) { showMessage(error.message, 'error'); return; }
    
    showMessage(`تم نشر ${qty} ${item} للبيع`, 'success');
    renderGame();
}

// -------------------- عرض الواجهة الرئيسية --------------------
async function renderGame() {
    const listings = await loadMarketListings();
    const fieldReady = currentProfile.game_data.field ? 
        (Date.now() - currentProfile.game_data.field.plantedAt) / 1000 >= 5 : false;
    
    const fieldHtml = currentProfile.game_data.field ? 
        `<div class="field ${fieldReady ? 'ready' : ''}" onclick="window.harvestField()">
            🌾 قمح ${fieldReady ? '✅ جاهز' : '🌱 ينمو'}
         </div>` :
        `<div class="field" onclick="window.plantWheat()">🌾 حقل فارغ (زراعة قمح بـ 2 ذهب)</div>`;
    
    let invHtml = '<div class="flex">';
    for (let [item, qty] of Object.entries(currentProfile.inventory)) {
        if (qty > 0) {
            const price = { Wheat: 5, Tomato: 8, Carrot: 4 }[item] || 5;
            invHtml += `<span>${item}: ${qty}</span>
                        <button class="sellDirect" data-item="${item}" style="width:auto;">بيع 1 بـ ${price}</button><br>`;
        }
    }
    invHtml += '</div>';
    if (Object.keys(currentProfile.inventory).filter(k => currentProfile.inventory[k] > 0).length === 0) {
        invHtml = '<p>مخزن فارغ</p>';
    }
    
    let marketHtml = '';
    for (let l of listings) {
        marketHtml += `
            <div class="listing">
                <div class="flex">
                    <span>${l.item_name} x${l.quantity}</span>
                    <span>💰 ${l.price_per_unit} لكل وحدة</span>
                    <span>👤 ${l.seller?.username || 'بائع'}</span>
                    <button class="buyBtn" data-id="${l.id}" data-price="${l.price_per_unit}" data-qty="${l.quantity}" data-item="${l.item_name}" style="width:auto;">شراء</button>
                </div>
            </div>
        `;
    }
    if (listings.length === 0) marketHtml = '<p>لا توجد إعلانات حالياً</p>';
    
    let itemOptions = '';
    for (let item of Object.keys(currentProfile.inventory)) {
        if (currentProfile.inventory[item] > 0) {
            itemOptions += `<option value="${item}">${item} (${currentProfile.inventory[item]})</option>`;
        }
    }
    
    document.getElementById('app').innerHTML = `
        <div class="screen">
            <div class="flex" style="background:#1f3b1a; padding:12px; border-radius:40px;">
                <span>💰 ${currentProfile.gold} ذهب</span>
                <span>⭐ ${currentProfile.score || 0}</span>
                <span>👤 ${currentProfile.username}</span>
                <button id="logoutBtn" style="width:auto; background:#8b5a2b;">🚪 خروج</button>
            </div>
            <div class="card">
                <h3>🌾 مزرعتي</h3>
                ${fieldHtml}
            </div>
            <div class="card">
                <h3>📦 مخزني</h3>
                ${invHtml}
            </div>
            <div class="card">
                <h3>🛒 السوق المشترك</h3>
                ${marketHtml}
            </div>
            <div class="card">
                <h4>➕ نشر إعلان جديد</h4>
                <select id="itemSelect">${itemOptions}</select>
                <input type="number" id="qtyInput" placeholder="الكمية" min="1">
                <input type="number" id="priceInput" placeholder="السعر لكل وحدة" min="1">
                <button id="publishBtn">📢 نشر الإعلان</button>
            </div>
            <div id="globalMsg"></div>
        </div>
    `;
    
    // ربط الأحداث
    document.querySelectorAll('.sellDirect').forEach(btn => {
        btn.onclick = () => sellDirect(btn.dataset.item);
    });
    document.querySelectorAll('.buyBtn').forEach(btn => {
        btn.onclick = () => buyListing(
            btn.dataset.id,
            parseInt(btn.dataset.price),
            parseInt(btn.dataset.qty),
            btn.dataset.item
        );
    });
    document.getElementById('publishBtn').onclick = () => {
        const item = document.getElementById('itemSelect').value;
        const qty = parseInt(document.getElementById('qtyInput').value);
        const price = parseInt(document.getElementById('priceInput').value);
        if (!qty || !price) { showMessage('املأ الكمية والسعر', 'error'); return; }
        createListing(item, qty, price);
    };
    document.getElementById('logoutBtn').onclick = () => { supabase.auth.signOut(); location.reload(); };
}

// -------------------- شاشات الدخول --------------------
async function renderLogin() {
    document.getElementById('app').innerHTML = `
        <div class="screen">
            <div class="card">
                <h2>🌾 منصة المزارعين</h2>
                <input type="email" id="email" placeholder="البريد الإلكتروني">
                <input type="password" id="password" placeholder="كلمة المرور">
                <button id="loginBtn">دخول</button>
                <button id="signupBtn">حساب جديد</button>
                <div id="loginMsg"></div>
            </div>
        </div>
    `;
    
    document.getElementById('loginBtn').onclick = async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) {
            document.getElementById('loginMsg').innerHTML = `<div class="error">${error.message}</div>`;
        } else {
            start();
        }
    };
    
    document.getElementById('signupBtn').onclick = async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const { error } = await supabase.auth.signUp({ email, password: pass });
        if (error) {
            document.getElementById('loginMsg').innerHTML = `<div class="error">${error.message}</div>`;
        } else {
            document.getElementById('loginMsg').innerHTML = '<div class="success">✅ تم التسجيل! سجل الدخول الآن.</div>';
        }
    };
}

// -------------------- بدء التطبيق --------------------
async function start() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            renderLogin();
            return;
        }
        currentUser = user;
        currentProfile = await ensureProfile();
        renderGame();
    } catch (err) {
        document.getElementById('app').innerHTML = `<div class="screen"><div class="error">⚠️ خطأ: ${err.message}</div></div>`;
    }
}

// ربط الدوال للنافذة
window.plantWheat = plantWheat;
window.harvestField = harvestField;

start();