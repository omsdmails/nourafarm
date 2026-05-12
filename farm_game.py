"""
Village Farm Game - Fixed & Upgraded
- Fixed forest tree growth logic
- Smart robot (plants any crop, harvests automatically)
- Levels system (unlock crops)
- Statistics screen
- Kivy version, works on PC and Android
"""

from kivy.app import App
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.popup import Popup
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.uix.scrollview import ScrollView
import json
import os
import time
import random

# ===================== DATA =====================

CROPS = {
    "Wheat":      {"color": (0.9, 0.8, 0.1, 1), "grow_time": 5,  "sell": 5,  "buy": 2,  "emoji": "🌾", "level_required": 1},
    "Tomato":     {"color": (0.9, 0.1, 0.1, 1), "grow_time": 7,  "sell": 8,  "buy": 3,  "emoji": "🍅", "level_required": 2},
    "Corn":       {"color": (1.0, 0.9, 0.0, 1), "grow_time": 8,  "sell": 7,  "buy": 3,  "emoji": "🌽", "level_required": 2},
    "Carrot":     {"color": (1.0, 0.5, 0.0, 1), "grow_time": 4,  "sell": 4,  "buy": 1,  "emoji": "🥕", "level_required": 1},
    "Potato":     {"color": (0.6, 0.4, 0.2, 1), "grow_time": 6,  "sell": 6,  "buy": 2,  "emoji": "🥔", "level_required": 1},
    "Sunflower":  {"color": (1.0, 0.8, 0.0, 1), "grow_time": 10, "sell": 12, "buy": 5,  "emoji": "🌻", "level_required": 3},
    "Pepper":     {"color": (0.8, 0.1, 0.0, 1), "grow_time": 9,  "sell": 10, "buy": 4,  "emoji": "🌶️", "level_required": 3},
    "Spinach":    {"color": (0.1, 0.7, 0.2, 1), "grow_time": 3,  "sell": 3,  "buy": 1,  "emoji": "🥬", "level_required": 1},
    "Grapes":     {"color": (0.5, 0.0, 0.5, 1), "grow_time": 12, "sell": 15, "buy": 6,  "emoji": "🍇", "level_required": 4},
    "Olives":     {"color": (0.4, 0.5, 0.1, 1), "grow_time": 15, "sell": 18, "buy": 7,  "emoji": "🫒", "level_required": 5},
}

PROFESSIONS = {
    "Farmer": {"desc": "Start with 2 fields\nand basic seeds", "color": (0.2, 0.6, 0.2, 1), "gold": 50, "inventory": {"Wheat": 3, "Carrot": 2}},
    "Chef": {"desc": "Start with a kitchen\nand 3 recipes", "color": (0.8, 0.4, 0.1, 1), "gold": 40, "inventory": {"Tomato": 5, "Potato": 3}},
    "Fisher": {"desc": "Start with a boat\nand fishing net", "color": (0.1, 0.4, 0.8, 1), "gold": 45, "inventory": {}},
    "Shepherd": {"desc": "Start with sheep\nand wool production", "color": (0.7, 0.7, 0.7, 1), "gold": 55, "inventory": {}},
    "Merchant": {"desc": "Start with a market\nand trading bonuses", "color": (0.8, 0.6, 0.1, 1), "gold": 100, "inventory": {}},
}

ANIMALS = {
    "Chicken": {"product": "Egg", "interval": 10, "sell": 3, "color": (1, 0.9, 0.5, 1)},
    "Cow":     {"product": "Milk", "interval": 20, "sell": 8, "color": (0.9, 0.9, 0.9, 1)},
    "Sheep":   {"product": "Wool", "interval": 15, "sell": 6, "color": (0.95, 0.95, 0.95, 1)},
}

# Forest settings
TREE_GROW_SEED_TO_SMALL = 6      # seconds
TREE_GROW_SMALL_TO_MATURE = 9    # total 15 seconds
TREE_REGROW_AFTER_CHOP = 8       # seconds to respawn as seed

SAVE_FILE = "village_save.json"

# ===================== SAVE/LOAD =====================

def save_game(player):
    with open(SAVE_FILE, "w") as f:
        json.dump(player, f)

def load_game(username):
    if os.path.exists(SAVE_FILE):
        with open(SAVE_FILE) as f:
            data = json.load(f)
        if data.get("username") == username:
            return data
    return None

def new_player(username, profession):
    prof = PROFESSIONS[profession]
    return {
        "username": username,
        "profession": profession,
        "gold": prof["gold"],
        "inventory": dict(prof["inventory"]),
        "fields": [],           # each: {crop, planted_time, pos_index}
        "animals": [],
        "market_listings": [],
        "score": 0,
        "forest_trees": [],     # each: {stage, planted_time}
        "robot_owned": False,
        "robot_active": False,
    }

# ===================== SCREENS =====================

class LoginScreen(Screen):
    def __init__(self, **kw):
        super().__init__(**kw)
        layout = BoxLayout(orientation="vertical", padding=40, spacing=20)
        layout.add_widget(Label(text="[b]🌾 Village Farm 🌾[/b]", markup=True, font_size=36, color=(0.9, 0.8, 0.1, 1), size_hint_y=0.2))
        layout.add_widget(Label(text='"In our village, no one is dumb.\nJust minds waiting for the right soil."', font_size=14, color=(0.8, 0.9, 0.8, 1), halign="center", size_hint_y=0.15))
        layout.add_widget(Label(text="Enter your username:", font_size=18, size_hint_y=0.1))
        self.username_input = TextInput(hint_text="Your name...", multiline=False, font_size=20, size_hint_y=0.12)
        layout.add_widget(self.username_input)
        self.msg_label = Label(text="", color=(1, 0.3, 0.3, 1), size_hint_y=0.08)
        layout.add_widget(self.msg_label)
        btn = Button(text="Enter Village", font_size=20, background_color=(0.2, 0.7, 0.2, 1), size_hint_y=0.15)
        btn.bind(on_press=self.on_enter)
        layout.add_widget(btn)
        self.add_widget(layout)

    def on_enter_screen(self, *a):
        self.msg_label.text = ""
        self.username_input.text = ""

    def on_enter(self, *a):
        username = self.username_input.text.strip()
        if not username:
            self.msg_label.text = "Please enter a username!"
            return
        app = App.get_running_app()
        saved = load_game(username)
        if saved:
            app.player = saved
            self.manager.transition = SlideTransition(direction="left")
            self.manager.current = "farm"
        else:
            app.pending_username = username
            self.manager.transition = SlideTransition(direction="left")
            self.manager.current = "profession"


class ProfessionScreen(Screen):
    def __init__(self, **kw):
        super().__init__(**kw)
        layout = BoxLayout(orientation="vertical", padding=20, spacing=15)
        layout.add_widget(Label(text="[b]Choose Your Profession[/b]", markup=True, font_size=28, color=(0.9, 0.8, 0.1, 1), size_hint_y=0.12))
        grid = GridLayout(cols=2, spacing=10, size_hint_y=0.88)
        for prof, data in PROFESSIONS.items():
            box = BoxLayout(orientation="vertical", spacing=5)
            btn = Button(text=f"{prof}\n{data['desc']}", font_size=14, background_color=data["color"], halign="center")
            btn.bind(on_press=lambda x, p=prof: self.choose(p))
            box.add_widget(btn)
            grid.add_widget(box)
        layout.add_widget(grid)
        self.add_widget(layout)

    def choose(self, profession):
        app = App.get_running_app()
        app.player = new_player(app.pending_username, profession)
        save_game(app.player)
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "farm"


# ===================== STATISTICS SCREEN =====================

class StatsScreen(Screen):
    def __init__(self, **kw):
        super().__init__(**kw)
        layout = BoxLayout(orientation="vertical", padding=10, spacing=8)
        layout.add_widget(Label(text="[b]📊 Statistics[/b]", markup=True, font_size=26, color=(0.3, 0.9, 0.9, 1), size_hint_y=0.08))

        # Tabs
        tabs = BoxLayout(size_hint_y=0.08, spacing=2)
        for name, screen in [("🌾 Farm", "farm"), ("🍽 Restaurant", "restaurant"), ("🛒 Market", "market"), ("🌲 Forest", "forest")]:
            b = Button(text=name, font_size=12)
            b.bind(on_press=lambda x, s=screen: self.go_to(s))
            tabs.add_widget(b)
        layout.add_widget(tabs)

        self.stats_label = Label(text="Loading...", font_size=14, color=(1,1,1,1), size_hint_y=0.8, halign="left", valign="top")
        self.stats_label.bind(size=self.stats_label.setter('text_size'))
        layout.add_widget(self.stats_label)

        self.add_widget(layout)

    def go_to(self, screen):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = screen

    def on_pre_enter(self):
        self.refresh_stats()

    def refresh_stats(self):
        app = App.get_running_app()
        p = app.player
        total_crops_harvested = p.get("total_harvested", sum(p["inventory"].values()) if p["inventory"] else 0)
        total_trees_cut = p.get("trees_cut", 0)
        level = max(1, p["score"] // 10 + 1)
        next_level = level + 1
        score_needed = (next_level - 1) * 10 - p["score"]

        stats_text = (f"[b]👤 Player:[/b] {p['username']}\n"
                      f"[b]🎭 Profession:[/b] {p['profession']}\n"
                      f"[b]💰 Gold:[/b] {p['gold']} G\n"
                      f"[b]⭐ Score:[/b] {p['score']}\n"
                      f"[b]🏆 Level:[/b] {level}\n"
                      f"[b]📈 Next level:[/b] {score_needed} more points\n\n"
                      f"[b]🌾 Total harvested:[/b] {total_crops_harvested}\n"
                      f"[b]🐔 Animals owned:[/b] {len(p['animals'])}\n"
                      f"[b]🌲 Trees cut:[/b] {total_trees_cut}\n"
                      f"[b]🤖 Robot owned:[/b] {'Yes' if p.get('robot_owned') else 'No'}\n"
                      f"[b]🧺 Inventory size:[/b] {sum(p['inventory'].values())} items\n\n"
                      f"[b]📦 Top products:[/b]\n")
        # show top 3 inventory items
        inv_sorted = sorted(p["inventory"].items(), key=lambda x: x[1], reverse=True)[:3]
        for item, qty in inv_sorted:
            stats_text += f"   {item}: {qty}\n"
        if not inv_sorted:
            stats_text += "   (empty)\n"

        self.stats_label.text = stats_text


# ===================== FOREST SCREEN (FIXED) =====================

class ForestScreen(Screen):
    def __init__(self, **kw):
        super().__init__(**kw)
        layout = BoxLayout(orientation="vertical", padding=10, spacing=8)
        layout.add_widget(Label(text="[b]🌲 Ancient Forest[/b]", markup=True, font_size=26, size_hint_y=0.08, color=(0.2, 0.8, 0.1, 1)))
        tabs = BoxLayout(size_hint_y=0.08, spacing=2)
        for name, screen in [("🌾 Farm", "farm"), ("🍽 Restaurant", "restaurant"), ("🛒 Market", "market"), ("📊 Stats", "stats")]:
            b = Button(text=name, font_size=12)
            b.bind(on_press=lambda x, s=screen: self.go_to(s))
            tabs.add_widget(b)
        layout.add_widget(tabs)

        self.lbl_gold = Label(text="Gold: 0", font_size=14, size_hint_y=0.06, color=(1, 0.85, 0, 1))
        layout.add_widget(self.lbl_gold)

        self.tree_grid = GridLayout(cols=2, spacing=10, padding=10, size_hint_y=0.7)
        scroll = ScrollView()
        scroll.add_widget(self.tree_grid)
        layout.add_widget(scroll)

        btn_buy_seed = Button(text="Buy Tree Seed (10G)", size_hint_y=0.08, background_color=(0.4, 0.3, 0.1, 1))
        btn_buy_seed.bind(on_press=self.buy_tree_seed)
        layout.add_widget(btn_buy_seed)

        self.msg = Label(text="", size_hint_y=0.06, color=(0.3, 1, 0.5, 1), font_size=13)
        layout.add_widget(self.msg)
        self.add_widget(layout)

        Clock.schedule_interval(self.update_forest, 1)

    def go_to(self, screen):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = screen

    def on_pre_enter(self):
        self.refresh_forest()

    def refresh_forest(self):
        app = App.get_running_app()
        p = app.player
        self.lbl_gold.text = f"💰 {p['gold']}G  ⭐ {p['score']}"
        self.tree_grid.clear_widgets()
        now = time.time()
        for idx, tree in enumerate(p["forest_trees"]):
            stage = tree["stage"]
            planted = tree["planted_time"]
            elapsed = now - planted

            # Determine stage based on elapsed time
            if elapsed < TREE_GROW_SEED_TO_SMALL:
                remaining_seed = int(TREE_GROW_SEED_TO_SMALL - elapsed)
                text = f"🌱 Seed\n{remaining_seed}s to sprout"
                color = (0.5, 0.4, 0.1, 1)
            elif elapsed < (TREE_GROW_SEED_TO_SMALL + TREE_GROW_SMALL_TO_MATURE):
                remaining_small = int((TREE_GROW_SEED_TO_SMALL + TREE_GROW_SMALL_TO_MATURE) - elapsed)
                text = f"🌿 Young Tree\n{remaining_small}s to mature"
                color = (0.3, 0.6, 0.1, 1)
            else:
                text = f"🌲 Mature Tree\nChop +5💰"
                color = (0.2, 0.8, 0.2, 1)
                # update stage to mature if not already
                if stage != "mature":
                    tree["stage"] = "mature"
                    tree["planted_time"] = now
                    save_game(p)

            btn = Button(text=text, font_size=12, background_color=color)
            btn.bind(on_press=lambda x, i=idx: self.chop_tree(i))
            self.tree_grid.add_widget(btn)

    def update_forest(self, dt):
        if self.manager.current == "forest":
            self.refresh_forest()

    def buy_tree_seed(self, *a):
        app = App.get_running_app()
        p = app.player
        if p["gold"] >= 10:
            p["gold"] -= 10
            p["forest_trees"].append({"stage": "seed", "planted_time": time.time()})
            save_game(p)
            self.refresh_forest()
            self.msg.text = "🌱 You planted a new tree seed!"
        else:
            self.msg.text = "Not enough gold! Need 10G."

    def chop_tree(self, idx):
        app = App.get_running_app()
        p = app.player
        tree = p["forest_trees"][idx]
        # Only chop if mature
        now = time.time()
        elapsed = now - tree["planted_time"]
        if elapsed >= (TREE_GROW_SEED_TO_SMALL + TREE_GROW_SMALL_TO_MATURE):
            p["gold"] += 5
            p["score"] += 1
            # increase counter for stats
            p["trees_cut"] = p.get("trees_cut", 0) + 1
            # reset tree as seed (regrows)
            tree["stage"] = "seed"
            tree["planted_time"] = now   # start growing again from zero
            save_game(p)
            self.refresh_forest()
            self.msg.text = "🪵 You chopped a tree! +5G"
        else:
            self.msg.text = "Tree not ready to chop yet."


# ===================== FARM SCREEN with SMART ROBOT =====================

class FarmScreen(Screen):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.build_ui()
        Clock.schedule_interval(self.update, 1)
        self.robot_plant_timer = 0
        self.robot_harvest_timer = 0

    def build_ui(self):
        self.clear_widgets()
        layout = BoxLayout(orientation="vertical")

        # Top bar
        self.top_bar = BoxLayout(size_hint_y=0.08, padding=5, spacing=10)
        self.lbl_name = Label(text="Player", font_size=14)
        self.lbl_gold = Label(text="Gold: 0", font_size=14, color=(1, 0.85, 0, 1))
        self.lbl_score = Label(text="Score: 0", font_size=14, color=(0.5, 1, 0.5, 1))
        self.top_bar.add_widget(self.lbl_name)
        self.top_bar.add_widget(self.lbl_gold)
        self.top_bar.add_widget(self.lbl_score)
        layout.add_widget(self.top_bar)

        # Tab buttons
        tabs = BoxLayout(size_hint_y=0.08, spacing=2)
        for name, screen in [("🌾 Farm", "farm"), ("🍽 Restaurant", "restaurant"), ("🛒 Market", "market"), ("🌲 Forest", "forest"), ("📊 Stats", "stats")]:
            b = Button(text=name, font_size=13, background_color=(0.2, 0.5, 0.2, 1))
            b.bind(on_press=lambda x, s=screen: self.go_to(s))
            tabs.add_widget(b)
        layout.add_widget(tabs)

        # Fields area (4 slots)
        self.fields_layout = BoxLayout(orientation="vertical", size_hint_y=0.35)
        self.fields_grid = GridLayout(cols=2, spacing=10, padding=10)
        self.fields_layout.add_widget(self.fields_grid)
        layout.add_widget(self.fields_layout)

        # Animals area
        self.animals_bar = BoxLayout(size_hint_y=0.1, spacing=5, padding=5)
        layout.add_widget(self.animals_bar)

        # Crop buttons (filter by level)
        layout.add_widget(Label(text="Plant a crop:", size_hint_y=0.05, font_size=13))
        self.crop_grid_container = ScrollView(size_hint_y=0.15)
        self.crop_grid = GridLayout(cols=5, spacing=3, padding=3, size_hint_y=None, height=80)
        self.crop_grid_container.add_widget(self.crop_grid)
        layout.add_widget(self.crop_grid_container)

        # Harvest + Buy animal + Robot
        bottom = BoxLayout(size_hint_y=0.12, spacing=5, padding=5)
        harvest_btn = Button(text="✂ Harvest All", background_color=(0.2, 0.8, 0.2, 1), font_size=13)
        harvest_btn.bind(on_press=self.harvest_all)
        bottom.add_widget(harvest_btn)

        for animal in ANIMALS:
            ab = Button(text=f"Buy {animal}\n10G", font_size=11, background_color=(0.6, 0.4, 0.2, 1))
            ab.bind(on_press=lambda x, a=animal: self.buy_animal(a))
            bottom.add_widget(ab)

        self.btn_robot_buy = Button(text="Buy Robot (50G)", font_size=11, background_color=(0.8, 0.5, 0.2, 1))
        self.btn_robot_buy.bind(on_press=self.buy_robot)
        bottom.add_widget(self.btn_robot_buy)

        self.btn_robot_toggle = Button(text="Robot OFF", font_size=11, background_color=(0.5, 0.5, 0.5, 1))
        self.btn_robot_toggle.bind(on_press=self.toggle_robot)
        bottom.add_widget(self.btn_robot_toggle)

        layout.add_widget(bottom)

        self.robot_status_label = Label(text="", size_hint_y=0.04, font_size=12, color=(0.3, 1, 0.5, 1))
        layout.add_widget(self.robot_status_label)

        self.msg_label = Label(text="", size_hint_y=0.04, font_size=12, color=(0.3, 1, 0.5, 1))
        layout.add_widget(self.msg_label)

        self.add_widget(layout)

    def go_to(self, screen):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = screen

    def on_pre_enter(self):
        self.refresh()
        app = App.get_running_app()
        if app.player.get("robot_owned", False):
            self.btn_robot_buy.disabled = True
            self.btn_robot_toggle.disabled = False
        else:
            self.btn_robot_buy.disabled = False
            self.btn_robot_toggle.disabled = True

    def refresh(self):
        app = App.get_running_app()
        p = app.player
        self.lbl_name.text = f"👤 {p['username']} ({p['profession']})"
        self.lbl_gold.text = f"💰 {p['gold']}G"
        self.lbl_score.text = f"⭐ {p['score']}"
        self.refresh_fields()
        self.refresh_animals()
        self.refresh_crop_buttons()
        robot_owned = p.get("robot_owned", False)
        robot_active = p.get("robot_active", False)
        if robot_owned:
            self.btn_robot_buy.disabled = True
            self.btn_robot_toggle.disabled = False
            if robot_active:
                self.btn_robot_toggle.text = "🤖 Robot ON"
                self.robot_status_label.text = "Robot active: auto-plant & harvest"
            else:
                self.btn_robot_toggle.text = "⏹️ Robot OFF"
                self.robot_status_label.text = "Robot inactive. Press ON to start."
        else:
            self.btn_robot_buy.disabled = False
            self.btn_robot_toggle.disabled = True
            self.btn_robot_toggle.text = "Robot OFF"
            self.robot_status_label.text = "Buy robot to automate farming."

        # Update total harvested count for stats
        if "total_harvested" not in p:
            p["total_harvested"] = sum(p["inventory"].values())
            save_game(p)

    def refresh_crop_buttons(self):
        app = App.get_running_app()
        p = app.player
        level = max(1, p["score"] // 10 + 1)
        self.crop_grid.clear_widgets()
        for crop, data in CROPS.items():
            if data["level_required"] <= level:
                b = Button(text=f"{data['emoji']}\n{crop}\nBuy:{data['buy']}G", font_size=10, background_color=data["color"])
                b.bind(on_press=lambda x, c=crop: self.plant(c))
                self.crop_grid.add_widget(b)

    def refresh_fields(self):
        app = App.get_running_app()
        self.fields_grid.clear_widgets()
        p = app.player
        fields = p["fields"]
        # assign pos_index if missing
        for i, f in enumerate(fields):
            if "pos_index" not in f:
                f["pos_index"] = i % 4
        field_map = {f["pos_index"]: f for f in fields}
        for pos in range(4):
            field = field_map.get(pos)
            if field is None:
                btn = Button(text="Empty\nTap to plant", font_size=12, background_color=(0.3, 0.3, 0.2, 1))
                btn.bind(on_press=lambda x, p=pos: self.plant_on_slot(p))
                self.fields_grid.add_widget(btn)
            else:
                crop = field["crop"]
                data = CROPS[crop]
                elapsed = time.time() - field["planted_time"]
                grown = elapsed >= data["grow_time"]
                status = "✅ Ready!" if grown else f"⏳ {int(data['grow_time'] - elapsed)}s"
                color = data["color"] if grown else (0.4, 0.3, 0.1, 1)
                btn = Button(text=f"{data['emoji']} {crop}\n{status}", font_size=11, background_color=color)
                btn.bind(on_press=lambda x, idx=pos: self.harvest_slot(idx))
                self.fields_grid.add_widget(btn)

    def refresh_animals(self):
        app = App.get_running_app()
        self.animals_bar.clear_widgets()
        now = time.time()
        for animal in app.player["animals"]:
            atype = animal["type"]
            data = ANIMALS[atype]
            elapsed = now - animal["last_collected"]
            ready = elapsed >= data["interval"]
            color = (0.2, 0.8, 0.2, 1) if ready else (0.5, 0.5, 0.5, 1)
            label = "Collect!" if ready else f"{int(data['interval'] - elapsed)}s"
            btn = Button(text=f"{atype}\n{data['product']}\n{label}", font_size=10, background_color=color)
            btn.bind(on_press=lambda x, a=animal: self.collect_animal(a))
            self.animals_bar.add_widget(btn)

    def plant_on_slot(self, pos_index):
        app = App.get_running_app()
        p = app.player
        level = max(1, p["score"] // 10 + 1)
        # show popup with available crops
        popup = Popup(title="Select Crop", size_hint=(0.8, 0.8))
        grid = GridLayout(cols=2, spacing=5, size_hint_y=None)
        grid.bind(minimum_height=grid.setter('height'))
        for crop, data in CROPS.items():
            if data["level_required"] <= level:
                b = Button(text=f"{data['emoji']} {crop}\n{data['buy']}G", background_color=data["color"])
                b.bind(on_press=lambda x, c=crop, pos=pos_index, pop=popup: self.do_plant(c, pos, pop))
                grid.add_widget(b)
        scroll = ScrollView()
        scroll.add_widget(grid)
        popup.add_widget(scroll)
        popup.open()

    def do_plant(self, crop, pos_index, popup=None):
        app = App.get_running_app()
        p = app.player
        # check if slot taken
        if any(f.get("pos_index") == pos_index for f in p["fields"]):
            self.msg_label.text = "Slot already occupied!"
            if popup:
                popup.dismiss()
            return
        cost = CROPS[crop]["buy"]
        if p["gold"] < cost:
            self.msg_label.text = f"Not enough gold! Need {cost}G"
            if popup:
                popup.dismiss()
            return
        p["gold"] -= cost
        p["fields"].append({"crop": crop, "planted_time": time.time(), "pos_index": pos_index})
        save_game(p)
        self.refresh()
        self.msg_label.text = f"Planted {crop} on slot {pos_index+1}! 🌱"
        if popup:
            popup.dismiss()

    def plant(self, crop):
        # plant in first empty slot
        app = App.get_running_app()
        p = app.player
        occupied = [f["pos_index"] for f in p["fields"] if "pos_index" in f]
        for pos in range(4):
            if pos not in occupied:
                self.do_plant(crop, pos)
                return
        self.msg_label.text = "No empty slots! Harvest first."

    def harvest_slot(self, pos_index):
        app = App.get_running_app()
        p = app.player
        field = None
        for f in p["fields"]:
            if f.get("pos_index") == pos_index:
                field = f
                break
        if not field:
            return
        crop = field["crop"]
        elapsed = time.time() - field["planted_time"]
        if elapsed >= CROPS[crop]["grow_time"]:
            sell = CROPS[crop]["sell"]
            p["gold"] += sell
            p["score"] += 1
            p["inventory"][crop] = p["inventory"].get(crop, 0) + 1
            p["total_harvested"] = p.get("total_harvested", 0) + 1
            p["fields"].remove(field)
            save_game(p)
            self.refresh()
            self.msg_label.text = f"Harvested {crop}! +{sell}G"
        else:
            self.msg_label.text = f"{crop} not ready yet."

    def harvest_all(self, *a):
        app = App.get_running_app()
        p = app.player
        harvested = 0
        earned = 0
        remaining = []
        for field in p["fields"]:
            crop = field["crop"]
            elapsed = time.time() - field["planted_time"]
            if elapsed >= CROPS[crop]["grow_time"]:
                p["gold"] += CROPS[crop]["sell"]
                p["score"] += 1
                p["inventory"][crop] = p["inventory"].get(crop, 0) + 1
                p["total_harvested"] = p.get("total_harvested", 0) + 1
                harvested += 1
                earned += CROPS[crop]["sell"]
            else:
                remaining.append(field)
        p["fields"] = remaining
        save_game(p)
        self.refresh()
        if harvested:
            self.msg_label.text = f"Harvested {harvested} crops! +{earned}G"
        else:
            self.msg_label.text = "No crops ready!"

    def buy_animal(self, animal):
        app = App.get_running_app()
        p = app.player
        if p["gold"] < 10:
            self.msg_label.text = "Need 10G to buy animal!"
            return
        p["gold"] -= 10
        p["animals"].append({"type": animal, "last_collected": time.time() - ANIMALS[animal]["interval"]})
        save_game(p)
        self.refresh()
        self.msg_label.text = f"Bought a {animal}! 🐾"

    def collect_animal(self, animal):
        app = App.get_running_app()
        p = app.player
        atype = animal["type"]
        data = ANIMALS[atype]
        now = time.time()
        if now - animal["last_collected"] >= data["interval"]:
            product = data["product"]
            p["inventory"][product] = p["inventory"].get(product, 0) + 1
            p["gold"] += data["sell"]
            p["score"] += 1
            animal["last_collected"] = now
            save_game(p)
            self.refresh()
            self.msg_label.text = f"Collected {product}! +{data['sell']}G"

    def buy_robot(self, *a):
        app = App.get_running_app()
        p = app.player
        if p.get("robot_owned", False):
            self.msg_label.text = "Robot already owned!"
            return
        if p["gold"] >= 50:
            p["gold"] -= 50
            p["robot_owned"] = True
            p["robot_active"] = True
            save_game(p)
            self.refresh()
            self.msg_label.text = "Robot purchased! It will auto-plant and harvest."
        else:
            self.msg_label.text = "Need 50G to buy robot!"

    def toggle_robot(self, *a):
        app = App.get_running_app()
        p = app.player
        if not p.get("robot_owned", False):
            return
        p["robot_active"] = not p.get("robot_active", False)
        save_game(p)
        self.refresh()

    def update(self, dt):
        if self.manager.current != "farm":
            return
        self.refresh()
        app = App.get_running_app()
        p = app.player
        if p.get("robot_owned", False) and p.get("robot_active", False):
            # auto plant every 7 seconds
            self.robot_plant_timer += dt
            if self.robot_plant_timer >= 7:
                self.robot_plant_timer = 0
                # find empty slot
                occupied = [f["pos_index"] for f in p["fields"] if "pos_index" in f]
                # choose a crop that player can afford and unlocked
                level = max(1, p["score"] // 10 + 1)
                available_crops = [c for c, data in CROPS.items() if data["level_required"] <= level]
                if available_crops:
                    # pick the cheapest one
                    crop = min(available_crops, key=lambda c: CROPS[c]["buy"])
                    cost = CROPS[crop]["buy"]
                    for pos in range(4):
                        if pos not in occupied:
                            if p["gold"] >= cost:
                                p["gold"] -= cost
                                p["fields"].append({"crop": crop, "planted_time": time.time(), "pos_index": pos})
                                save_game(p)
                                self.msg_label.text = f"🤖 Robot planted {crop}!"
                                break
                            else:
                                self.msg_label.text = "Robot: not enough gold for seeds."
                                break

            # auto harvest every 5 seconds
            self.robot_harvest_timer += dt
            if self.robot_harvest_timer >= 5:
                self.robot_harvest_timer = 0
                harvested = False
                for field in p["fields"][:]:
                    crop = field["crop"]
                    elapsed = time.time() - field["planted_time"]
                    if elapsed >= CROPS[crop]["grow_time"]:
                        p["gold"] += CROPS[crop]["sell"]
                        p["score"] += 1
                        p["inventory"][crop] = p["inventory"].get(crop, 0) + 1
                        p["total_harvested"] = p.get("total_harvested", 0) + 1
                        p["fields"].remove(field)
                        harvested = True
                if harvested:
                    save_game(p)
                    self.msg_label.text = "🤖 Robot harvested ready crops!"
                    self.refresh()


# ===================== RESTAURANT SCREEN =====================

RECIPES = {
    "Tomato Soup":   {"ingredients": {"Tomato": 2}, "sell": 20, "emoji": "🍲"},
    "Corn Salad":    {"ingredients": {"Corn": 2, "Carrot": 1}, "sell": 18, "emoji": "🥗"},
    "Potato Mash":   {"ingredients": {"Potato": 3}, "sell": 22, "emoji": "🥔"},
    "Pepper Stew":   {"ingredients": {"Pepper": 2, "Tomato": 1}, "sell": 30, "emoji": "🍛"},
    "Wheat Bread":   {"ingredients": {"Wheat": 3}, "sell": 15, "emoji": "🍞"},
    "Grape Juice":   {"ingredients": {"Grapes": 4}, "sell": 25, "emoji": "🍷"},
}

class RestaurantScreen(Screen):
    def __init__(self, **kw):
        super().__init__(**kw)
        layout = BoxLayout(orientation="vertical", padding=10, spacing=8)
        layout.add_widget(Label(text="[b]🍽 Restaurant[/b]", markup=True, font_size=26, size_hint_y=0.1, color=(0.9, 0.6, 0.1, 1)))
        tabs = BoxLayout(size_hint_y=0.08, spacing=2)
        for name, screen in [("🌾 Farm", "farm"), ("🛒 Market", "market"), ("🌲 Forest", "forest"), ("📊 Stats", "stats")]:
            b = Button(text=name, font_size=12)
            b.bind(on_press=lambda x, s=screen: self.go_to(s))
            tabs.add_widget(b)
        layout.add_widget(tabs)
        self.inv_label = Label(text="Inventory: loading...", font_size=12, size_hint_y=0.1, color=(0.7, 1, 0.7, 1))
        layout.add_widget(self.inv_label)
        layout.add_widget(Label(text="Cook a recipe:", font_size=14, size_hint_y=0.06))
        recipe_scroll = ScrollView(size_hint_y=0.55)
        recipe_grid = GridLayout(cols=2, spacing=8, padding=5, size_hint_y=None)
        recipe_grid.bind(minimum_height=recipe_grid.setter("height"))
        for recipe, data in RECIPES.items():
            ing_text = ", ".join(f"{v}x {k}" for k, v in data["ingredients"].items())
            btn = Button(text=f"{data['emoji']} {recipe}\nNeeds: {ing_text}\nSell: {data['sell']}G", font_size=11, background_color=(0.6, 0.3, 0.1, 1), size_hint_y=None, height=80)
            btn.bind(on_press=lambda x, r=recipe: self.cook(r))
            recipe_grid.add_widget(btn)
        recipe_scroll.add_widget(recipe_grid)
        layout.add_widget(recipe_scroll)
        self.msg = Label(text="", size_hint_y=0.08, color=(0.3, 1, 0.5, 1), font_size=13)
        layout.add_widget(self.msg)
        self.lbl_gold = Label(text="Gold: 0", font_size=14, size_hint_y=0.06, color=(1, 0.85, 0, 1))
        layout.add_widget(self.lbl_gold)
        self.add_widget(layout)

    def go_to(self, screen):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = screen

    def on_pre_enter(self):
        self.refresh()

    def refresh(self):
        app = App.get_running_app()
        p = app.player
        self.lbl_gold.text = f"💰 {p['gold']}G"
        inv = p["inventory"]
        inv_text = "  ".join(f"{k}:{v}" for k, v in inv.items()) if inv else "Empty"
        self.inv_label.text = f"Inventory: {inv_text}"

    def cook(self, recipe):
        app = App.get_running_app()
        p = app.player
        data = RECIPES[recipe]
        inv = p["inventory"]
        for item, qty in data["ingredients"].items():
            if inv.get(item, 0) < qty:
                self.msg.text = f"Missing {item}! Go farm it first."
                return
        for item, qty in data["ingredients"].items():
            inv[item] -= qty
        p["gold"] += data["sell"]
        p["score"] += 2
        save_game(p)
        self.refresh()
        self.msg.text = f"Cooked {recipe}! +{data['sell']}G 🍳"


# ===================== MARKET SCREEN =====================

class MarketScreen(Screen):
    def __init__(self, **kw):
        super().__init__(**kw)
        layout = BoxLayout(orientation="vertical", padding=10, spacing=8)
        layout.add_widget(Label(text="[b]🛒 Village Market[/b]", markup=True, font_size=26, size_hint_y=0.08, color=(0.9, 0.8, 0.1, 1)))
        tabs = BoxLayout(size_hint_y=0.08, spacing=2)
        for name, screen in [("🌾 Farm", "farm"), ("🍽 Restaurant", "restaurant"), ("🌲 Forest", "forest"), ("📊 Stats", "stats")]:
            b = Button(text=name, font_size=12)
            b.bind(on_press=lambda x, s=screen: self.go_to(s))
            tabs.add_widget(b)
        layout.add_widget(tabs)
        self.lbl_gold = Label(text="Gold: 0", font_size=14, size_hint_y=0.06, color=(1, 0.85, 0, 1))
        layout.add_widget(self.lbl_gold)
        self.inv_label = Label(text="Inventory:", font_size=12, size_hint_y=0.08, color=(0.7, 1, 0.7, 1))
        layout.add_widget(self.inv_label)
        layout.add_widget(Label(text="Sell your items:", font_size=14, size_hint_y=0.05))
        self.sell_scroll = ScrollView(size_hint_y=0.5)
        self.sell_grid = GridLayout(cols=3, spacing=5, padding=5, size_hint_y=None)
        self.sell_grid.bind(minimum_height=self.sell_grid.setter("height"))
        self.sell_scroll.add_widget(self.sell_grid)
        layout.add_widget(self.sell_scroll)
        self.msg = Label(text="", size_hint_y=0.07, color=(0.3, 1, 0.5, 1), font_size=13)
        layout.add_widget(self.msg)
        self.add_widget(layout)

    def go_to(self, screen):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = screen

    def on_pre_enter(self):
        self.refresh()

    def refresh(self):
        app = App.get_running_app()
        p = app.player
        self.lbl_gold.text = f"💰 {p['gold']}G  ⭐ {p['score']}"
        inv = p["inventory"]
        inv_text = "  ".join(f"{k}:{v}" for k, v in inv.items()) if inv else "Nothing yet"
        self.inv_label.text = f"Inventory: {inv_text}"
        self.sell_grid.clear_widgets()
        for crop, data in CROPS.items():
            qty = p["inventory"].get(crop, 0)
            if qty > 0:
                btn = Button(text=f"{data['emoji']} {crop}\nQty: {qty}\nSell 1: +{data['sell']}G", font_size=10, background_color=(0.2, 0.6, 0.2, 1), size_hint_y=None, height=70)
                btn.bind(on_press=lambda x, c=crop, s=data["sell"]: self.sell(c, s))
                self.sell_grid.add_widget(btn)
        for animal, data in ANIMALS.items():
            product = data["product"]
            qty = p["inventory"].get(product, 0)
            if qty > 0:
                btn = Button(text=f"🥚 {product}\nQty: {qty}\nSell 1: +{data['sell']}G", font_size=10, background_color=(0.6, 0.4, 0.1, 1), size_hint_y=None, height=70)
                btn.bind(on_press=lambda x, prod=product, s=data["sell"]: self.sell(prod, s))
                self.sell_grid.add_widget(btn)

    def sell(self, item, price):
        app = App.get_running_app()
        p = app.player
        if p["inventory"].get(item, 0) < 1:
            self.msg.text = f"No {item} to sell!"
            return
        p["inventory"][item] -= 1
        p["gold"] += price
        p["score"] += 1
        save_game(p)
        self.refresh()
        self.msg.text = f"Sold {item} for {price}G! 💰"


# ===================== APP =====================

class VillageFarmApp(App):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.player = None
        self.pending_username = ""

    def build(self):
        Window.clearcolor = (0.1, 0.15, 0.1, 1)
        sm = ScreenManager()
        sm.add_widget(LoginScreen(name="login"))
        sm.add_widget(ProfessionScreen(name="profession"))
        sm.add_widget(FarmScreen(name="farm"))
        sm.add_widget(RestaurantScreen(name="restaurant"))
        sm.add_widget(MarketScreen(name="market"))
        sm.add_widget(ForestScreen(name="forest"))
        sm.add_widget(StatsScreen(name="stats"))
        sm.current = "login"
        return sm


if __name__ == "__main__":
    VillageFarmApp().run()
