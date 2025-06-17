#!/usr/bin/env python3
"""
AirSense AI - Professional Air Quality Intelligence Platform (v6.3.0 - Integrated AI Assistant)

Core Technologies:
- Data Source: World Air Quality Index (WAQI) Project API
- Geocoding & AI Engine: Google Gemini 1.5 Pro
- Data Storage: MongoDB Atlas
"""
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import os
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
import io
import re
import json

# --- Third-party Imports ---
try:
    import ttkbootstrap as Ttkb
    from dotenv import load_dotenv
    import google.generativeai as genai
    import pymongo
    from gridfs import GridFS
    import requests
    from PIL import Image, ImageTk
except ImportError as e:
    print(f"FATAL: A required package is missing. Error: {e}\nInstall with: pip install --upgrade ttkbootstrap google-generativeai pymongo Pillow python-dotenv requests")
    exit(1)

# --- Configuration Loader ---
load_dotenv(override=True)

class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    WAQI_API_TOKEN = os.getenv("WAQI_API_TOKEN")
    MONGODB_URI = os.getenv("MONGODB_URI")
    GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
    GEMINI_MODEL = "gemini-1.5-flash-latest"
    DB_NAME = "airsense_ai_production_v6"
    APP_THEME = "litera"
    WINDOW_WIDTH, WINDOW_HEIGHT = 1024, 768

    ### NEW ### - Configurable AI Assistant prompt buttons
    AI_ASSISTANT_PROMPTS = [
        ("Health Risks?", "Explain the primary health risks at the current AQI level."),
        ("Outdoor Activity?", "Is it safe for outdoor exercise? What precautions should I take?"),
        ("Improve Indoor Air?", "Suggest three simple ways to improve my indoor air quality right now."),
        ("About Dominant Pollutant?", "What is the dominant pollutant shown and why is it a concern?"),
        ("Sensitive Groups?", "How does this air quality affect sensitive groups like children, the elderly, or people with asthma?"),
        ("Should I Wear a Mask?", "Based on this data, should I wear a mask outside? If so, what kind?")
    ]

print("--- AirSense AI v6.3 Pre-flight Check ---")
print(f"[GOOGLE GEMINI API] Key Set:    {'YES' if Config.GEMINI_API_KEY else 'NO (CRITICAL: AI features will fail)'}")
print(f"[WAQI API] Token Set:            {'YES' if Config.WAQI_API_TOKEN else 'NO (CRITICAL: AQI data will fail)'}")
print(f"[MONGO DB ATLAS] URI Set:        {'YES' if Config.MONGODB_URI else 'NO (Storage disabled)'}")
print("-----------------------------------------\n")


# =============================================================================
# DATA MODELS (Unchanged from v6.2.1)
# =============================================================================
class AQIData:
    def __init__(self, waqi_json: Dict):
        try:
            data = waqi_json.get("data")
            if not data or waqi_json.get("status") != "ok": self.is_valid = False; return
            self.is_valid = True
            self.overall_aqi = int(data.get('aqi', 0))
            self.location_name = data.get('city', {}).get('name', 'N/A')
            self.city = self.location_name.split(',')[0]
            self.country = "N/A"
            geo = data.get('city', {}).get('geo', [None, None])
            self.latitude, self.longitude = geo[0], geo[1]
            self.distance_km = 0
            ts_str = data.get('time', {}).get('iso')
            self.timestamp = datetime.fromisoformat(ts_str) if ts_str else datetime.now(timezone.utc)
            self.pollutants: Dict[str, float] = {param: float(details['v']) for param, details in data.get('iaqi', {}).items() if 'v' in details}
            self.dominant_pollutant = data.get('dominentpol', 'N/A').upper()
            self.aqi_category_name, self.aqi_category_theme = "No Data", 'secondary'
            for name, (low, high, theme) in {'Good':(0,50,'success'), 'Moderate':(51,100,'warning'), 'Unhealthy for Sensitive':(101,150,'warning'), 'Unhealthy':(151,200,'danger'), 'Very Unhealthy':(201,300,'danger'), 'Hazardous':(301,5000,'danger')}.items():
                if low <= self.overall_aqi <= high: self.aqi_category_name, self.aqi_category_theme = name, theme; break
        except (KeyError, IndexError, TypeError) as e: print(f"Error parsing WAQI data: {e}"); self.is_valid = False

    def get_summary_string(self) -> str:
        local_ts = self.timestamp.astimezone(None)
        p_details = ' | '.join([f"{p.upper()}: {v:.1f}" for p, v in sorted(self.pollutants.items())])
        return f"Station: {self.location_name}\nUpdated: {local_ts.strftime('%Y-%m-%d %H:%M:%S %Z')}\nDominant: {self.dominant_pollutant or 'N/A'}\nReadings: {p_details}"

    def to_dict(self)->Dict: return { k: v for k, v in self.__dict__.items() if not k.startswith('_')}


# =============================================================================
# EXTERNAL SERVICES (Unchanged from v6.2.1)
# =============================================================================
class LocationService:
    @staticmethod
    def get_location_from_ip()->Optional[Dict]:
        try: r = requests.get("https://ipapi.co/json/", timeout=5); r.raise_for_status(); return r.json()
        except requests.RequestException: return None

class WAQIService:
    def __init__(self, token: Optional[str]): self.token, self.base_url = token, "https://api.waqi.info/feed"
    def get_latest_aqi_by_coords(self, lat: float, lon: float) -> Optional[Dict]:
        if not self.token: return {"status": "error", "data": "WAQI API token not provided"}
        try: r = requests.get(f"{self.base_url}/geo:{lat};{lon}/?token={self.token}", timeout=10); r.raise_for_status(); return r.json()
        except requests.RequestException as e: return {"status": "error", "data": str(e)}

class GeminiService:
    def __init__(self, api_key: Optional[str]):
        self.model = None
        if api_key:
            try: genai.configure(api_key=api_key); self.model = genai.GenerativeModel(Config.GEMINI_MODEL)
            except Exception as e: print(f"Error initializing Gemini: {e}")

    def get_ai_response(self, prompt_text: str, img_bytes:Optional[bytes]=None, ctype:Optional[str]=None) -> str:
        if self.model is None: return "AI Service is offline (check API key)."
        content = [prompt_text]
        if img_bytes and ctype: content.append({"mime_type": ctype, "data": img_bytes})
        try: return self.model.generate_content(content).text
        except Exception as e: return f"AI Error: {e}"

    def get_coordinates_from_text(self, query: str) -> Optional[Tuple[float, float, str]]:
        if self.model is None: return None
        prompt = f"""You are a geocoding API. Analyze: "{query}". Respond with a single JSON object with "latitude", "longitude", and "identified_name". If not found, return nulls."""
        try:
            gen_config = genai.types.GenerationConfig(response_mime_type="application/json")
            response = self.model.generate_content(prompt, generation_config=gen_config)
            r_json = json.loads(response.text)
            lat, lon, name = r_json.get("latitude"), r_json.get("longitude"), r_json.get("identified_name", query)
            if lat is not None and lon is not None: return float(lat), float(lon), str(name)
            return None
        except Exception: return None

class MongoDBService:
    def __init__(self, uri: Optional[str]):
        self.client, self.db = None, None
        if uri:
            try: self.client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=5000); self.client.admin.command('ping'); self.db = self.client[Config.DB_NAME]
            except Exception: self.client, self.db = None, None

    def save_record(self, img_path: str, ctype: str, aqi_data: AQIData, analysis: str):
        if self.db is None: return
        try:
            fs = GridFS(self.db)
            with open(img_path, "rb") as f: _id = fs.put(f, filename=os.path.basename(img_path))
            self.db["sky_records"].insert_one({"_id": _id, "upload_ts_utc": datetime.now(timezone.utc), "aqi_data": aqi_data.to_dict(), "gemini_analysis": analysis})
        except Exception as e: print(f"Failed to save record to MongoDB: {e}")

# =============================================================================
# MAIN APPLICATION
# =============================================================================
class AirSenseApp(Ttkb.Window):
    def __init__(self):
        super().__init__(themename=Config.APP_THEME)
        self.title("AirSense AI Professional"); self.geometry(f"{Config.WINDOW_WIDTH}x{Config.WINDOW_HEIGHT}")
        
        self.loc_svc, self.waqi_svc = LocationService(), WAQIService(Config.WAQI_API_TOKEN)
        self.gemini_svc, self.mongo_svc = GeminiService(Config.GEMINI_API_KEY), MongoDBService(Config.MONGODB_URI)
        
        self.aqi_data: Optional[AQIData] = None; self.img_path: Optional[str] = None
        self.prompt_buttons: List[ttk.Button] = []
        
        self._create_widgets()
        self.protocol("WM_DELETE_WINDOW", self.destroy)
        self.after(250, self._initial_fetch)

    def _initial_fetch(self):
        critical_keys_ok = Config.WAQI_API_TOKEN and Config.GEMINI_API_KEY
        if not critical_keys_ok:
            self._display_error_state("Config Error", "WAQI or Gemini API Key not set in .env file.")
            self._update_status("Critical configuration missing.", "danger")
        else:
            self.fetch_aqi_by_ip_address()
            
    def _create_widgets(self):
        # --- UI Structure ---
        pane = ttk.PanedWindow(self, orient=tk.HORIZONTAL); pane.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        l, r = ttk.Frame(pane, padding=10), ttk.Frame(pane, padding=10)
        pane.add(l, weight=2); pane.add(r, weight=3)

        # --- Left Pane ---
        l.rowconfigure(2, weight=1); l.columnconfigure(0, weight=1)

        # AQI Display Card
        aqi_c = Ttkb.Labelframe(l, text=" Current Air Quality ", padding=15); aqi_c.grid(row=0, column=0, sticky="nsew", pady=(0, 15))
        aqi_c.columnconfigure(1, weight=1)
        self.aqi_val = Ttkb.Label(aqi_c, text="--", font=("Helvetica", 64, "bold"), bootstyle="secondary"); self.aqi_val.grid(row=0, column=0, rowspan=2, padx=(0, 20), sticky='w')
        self.aqi_cat = Ttkb.Label(aqi_c, text="Awaiting Data...", font=("Helvetica", 18), bootstyle="secondary"); self.aqi_cat.grid(row=0, column=1, sticky="sw")
        self.aqi_sub = Ttkb.Label(aqi_c, text="US AQI", font=("Helvetica", 10), bootstyle="secondary"); self.aqi_sub.grid(row=1, column=1, sticky="nw")
        self.summary_txt = tk.Text(aqi_c, height=4, wrap=tk.WORD, state=tk.DISABLED, relief=tk.FLAT, bg=self.cget('bg'), font=("Segoe UI", 9)); self.summary_txt.grid(row=2, column=0, columnspan=2, sticky='nsew', pady=(15, 0))

        # Location Card
        loc_c = Ttkb.Labelframe(l, text=" Location ", padding=15); loc_c.grid(row=1, column=0, sticky="ew", pady=(0, 15))
        loc_c.columnconfigure(0, weight=1)
        self.loc_entry = Ttkb.Entry(loc_c, font=("Segoe UI", 10)); self.loc_entry.grid(row=0, column=0, sticky="ew", padx=(0, 10)); self.loc_entry.insert(0, "Enter any location or use IP detection")
        self.fetch_btn = Ttkb.Button(loc_c, text="Fetch", command=self.fetch_by_input, bootstyle="primary"); self.fetch_btn.grid(row=0, column=1, sticky="ew", padx=(0, 5))
        self.ip_btn = Ttkb.Button(loc_c, text="My Location", command=self.fetch_aqi_by_ip_address, bootstyle="info-outline"); self.ip_btn.grid(row=0, column=2, sticky="ew")

        ### NEW ### - AI Assistant Card
        ai_c = Ttkb.Labelframe(l, text=" AI Assistant ", padding=15)
        ai_c.grid(row=2, column=0, sticky="nsew", pady=(0, 10))
        ai_c.rowconfigure(0, weight=1); ai_c.columnconfigure(0, weight=1)
        
        # AI Response Area
        self.ai_response_text = scrolledtext.ScrolledText(ai_c, wrap=tk.WORD, state=tk.DISABLED, font=("Segoe UI", 10), relief=tk.FLAT, height=6)
        self.ai_response_text.grid(row=0, column=0, sticky="nsew", pady=(0, 10))
        self.ai_response_text.tag_configure("user", foreground="#0D47A1", font=("Segoe UI", 10, "bold")) # Dark Blue
        self.ai_response_text.tag_configure("ai", foreground="#202124") # Dark Gray
        self.ai_response_text.tag_configure("system", foreground="#5F6368", font=("Segoe UI", 9, "italic")) # Medium Gray
        
        # Separator and Prompt Buttons
        ttk.Separator(ai_c, orient=tk.HORIZONTAL).grid(row=1, column=0, sticky="ew", pady=(5, 10))
        
        prompt_button_frame = ttk.Frame(ai_c)
        prompt_button_frame.grid(row=2, column=0, sticky="ew")
        
        cols=2
        for i, (btn_text, prompt_text) in enumerate(Config.AI_ASSISTANT_PROMPTS):
            btn = Ttkb.Button(prompt_button_frame, text=btn_text, bootstyle="secondary-outline",
                              command=lambda p=prompt_text, b=btn_text: self.ask_ai_assistant(p, b))
            btn.grid(row=i//cols, column=i%cols, sticky="ew", padx=5, pady=3)
            prompt_button_frame.columnconfigure(i%cols, weight=1)
            self.prompt_buttons.append(btn)
        
        # Status Bar and Progress Bar
        self.status_lbl = Ttkb.Label(l, text="Initializing...", bootstyle="secondary", font=("Segoe UI", 9)); self.status_lbl.grid(row=3, column=0, sticky="ew", pady=(10, 0))
        self.p_bar = Ttkb.Progressbar(l, mode='indeterminate'); self.p_bar.grid(row=4, column=0, sticky="ew", pady=(5, 0))

        # --- Right Pane ---
        r.rowconfigure(0, weight=1); r.columnconfigure(0, weight=1)
        note = Ttkb.Notebook(r); note.grid(row=0, column=0, sticky="nsew")
        sky_tab = ttk.Frame(note, padding=15); note.add(sky_tab, text=" Sky Vision ")
        sky_tab.rowconfigure(1, weight=1); sky_tab.columnconfigure(0, weight=1, uniform="equal"); sky_tab.columnconfigure(1, weight=1, uniform="equal")
        self.up_btn = Ttkb.Button(sky_tab, text="Upload Sky Image", command=self.upload_img, bootstyle="success-outline"); self.up_btn.grid(row=0, column=0, sticky='ew', padx=(0, 5))
        self.an_btn = Ttkb.Button(sky_tab, text="Analyze with Gemini", command=self.analyze_img, state=tk.DISABLED); self.an_btn.grid(row=0, column=1, sticky='ew', padx=(5, 0))
        s_pane = ttk.PanedWindow(sky_tab, orient=tk.VERTICAL); s_pane.grid(row=1, column=0, columnspan=2, sticky='nsew', pady=(15, 0))
        img_f = Ttkb.Labelframe(s_pane, text="Image Preview", padding=10); self.img_lbl = Ttkb.Label(img_f, text="Upload image to preview", bootstyle="secondary", anchor=tk.CENTER); self.img_lbl.pack(fill=tk.BOTH, expand=True)
        s_pane.add(img_f, weight=1)
        analysis_f = Ttkb.Labelframe(s_pane, text="Gemini AI Analysis", padding=10)
        self.analysis_txt = scrolledtext.ScrolledText(analysis_f, wrap=tk.WORD, state=tk.DISABLED, font=("Segoe UI", 10), relief=tk.FLAT); self.analysis_txt.pack(fill=tk.BOTH, expand=True)
        s_pane.add(analysis_f, weight=1)

    def _set_ui_state(self, is_busy: bool):
        state = tk.DISABLED if is_busy else tk.NORMAL
        for btn in [self.fetch_btn, self.ip_btn, self.up_btn] + self.prompt_buttons: ### MODIFIED ###
            btn.config(state=state)
        # Specific state for analyze button
        analyze_state = tk.DISABLED if is_busy or not self.img_path else tk.NORMAL
        self.an_btn.config(state=analyze_state)
    
    # ... (Rest of UI helper methods are unchanged)

    def _update_status(self, text, style="secondary", progress=False):
        self.status_lbl.config(text=text, bootstyle=style)
        if progress: self.p_bar.start(10)
        else: self.p_bar.stop()

    def _update_text_widget(self, widget: tk.Text, content: str, tag:Optional[str]=None, append=False):
        widget.config(state=tk.NORMAL)
        if not append: widget.delete(1.0, tk.END)
        if tag: widget.insert(tk.END, content, tag)
        else: widget.insert(tk.END, content)
        widget.config(state=tk.DISABLED)
        widget.see(tk.END)
    
    # ... (Data Fetching Logic is unchanged)
    def fetch_aqi_by_ip_address(self): self._set_ui_state(True); self._update_status("Detecting location...", "info", True); threading.Thread(target=self._worker_fetch_by_ip, daemon=True).start()
    def _worker_fetch_by_ip(self):
        loc = self.loc_svc.get_location_from_ip()
        if loc: self.after(0, self.loc_entry.delete, 0, tk.END); self.after(0, self.loc_entry.insert, 0, f"{loc.get('city')}, {loc.get('country_code')}"); self._worker_fetch_aqi_data(loc['latitude'], loc['longitude'])
        else: self.after(0, self._update_status, "Could not get location via IP.", "warning"); self.after(0, self._set_ui_state, False)
    def fetch_by_input(self):
        query = self.loc_entry.get().strip()
        if not query: return
        self._set_ui_state(True)
        if re.match(r'^-?\d+\.?\d*,\s*-?\d+\.?\d*$', query): lat, lon = map(float, query.split(',')); threading.Thread(target=self._worker_fetch_aqi_data, args=(lat,lon), daemon=True).start()
        else: self._update_status(f"Finding '{query}'...", "info", True); threading.Thread(target=self._worker_geocode_with_gemini, args=(query,), daemon=True).start()
    def _worker_geocode_with_gemini(self, query: str):
        coords = self.gemini_svc.get_coordinates_from_text(query)
        if coords: lat, lon, name = coords; self.after(0, self.loc_entry.delete, 0, tk.END); self.after(0, self.loc_entry.insert, 0, name); self._worker_fetch_aqi_data(lat, lon)
        else: self.after(0, self._update_status, f"Could not find '{query}'.", "danger"); self.after(0, self._display_error_state, "Location Not Found", f"'{query}' could not be identified."); self.after(0, self._set_ui_state, False)
    def _worker_fetch_aqi_data(self, lat: float, lon: float):
        self.after(0, self._update_status, f"Fetching AQI near ({lat:.2f},{lon:.2f})...", "info", True)
        raw = self.waqi_svc.get_latest_aqi_by_coords(lat, lon)
        if raw and raw.get("status") == "ok": self.aqi_data = AQIData(raw); self.after(0, self._update_aqi_display) if self.aqi_data.is_valid else self.after(0, self._display_error_state, "Parse Error", "Could not process API data."); self.after(0, self._update_status, "Success!", 'success') if self.aqi_data.is_valid else self.after(0, self._update_status, "Data parse failed.", "warning")
        else: reason = raw.get('data', 'Unknown API error.'); self.after(0, self._display_error_state, "No Data Found", f"Could not get data.\nReason: {reason}"); self.after(0, self._update_status, "AQI data fetch failed.", "warning")
        self.after(0, self._set_ui_state, False)

    # --- UI Update Logic (unchanged except for adding an AI prompt) ---
    def _update_aqi_display(self):
        d = self.aqi_data
        self.aqi_val.config(text=f"{d.overall_aqi}",bootstyle=d.aqi_category_theme)
        self.aqi_cat.config(text=d.aqi_category_name,bootstyle=d.aqi_category_theme)
        self.aqi_sub.config(bootstyle=d.aqi_category_theme)
        self._update_text_widget(self.summary_txt, d.get_summary_string())
        if self.img_path: self.an_btn.config(state=tk.NORMAL)
        # NEW: Prompt the AI Assistant
        initial_ai_prompt = f"Air quality data updated for {d.city}. The AQI is {d.overall_aqi} ({d.aqi_category_name}).\nSelect a prompt below for advice."
        self._update_text_widget(self.ai_response_text, initial_ai_prompt, tag="system")

    def _display_error_state(self, title: str, details: str):
        self.aqi_data=None; self.aqi_val.config(text="!",bootstyle="secondary"); self.aqi_cat.config(text=title,bootstyle="secondary"); self.aqi_sub.config(bootstyle="secondary");
        self._update_text_widget(self.summary_txt, details); self.an_btn.config(state=tk.DISABLED)
        # NEW: Update AI Assistant on error
        self._update_text_widget(self.ai_response_text, f"Data Error: {title}. The AI assistant will provide general advice.", tag="system")


    ### NEW ### - AI Assistant Methods
    def ask_ai_assistant(self, question: str, button_text: str):
        """Handles click from one of the AI Assistant prompt buttons."""
        self._set_ui_state(True) # Disable all buttons
        
        # Display the user's question in the response box
        self.ai_response_text.config(state=tk.NORMAL)
        self.ai_response_text.delete(1.0, tk.END)
        self.ai_response_text.insert(tk.END, "You asked: ", "system")
        self.ai_response_text.insert(tk.END, f"{button_text}\n\n", "user")
        self.ai_response_text.insert(tk.END, "AI is thinking...", "system")
        self.ai_response_text.config(state=tk.DISABLED)

        threading.Thread(target=self._worker_ask_ai, args=(question,), daemon=True).start()

    def _worker_ask_ai(self, question: str):
        """Worker thread to get response from Gemini."""
        # Build the context string for the AI
        if self.aqi_data and self.aqi_data.is_valid:
            d = self.aqi_data
            context = f"You are a helpful environmental and health advisor. Current air quality data for {d.city} is: AQI {d.overall_aqi} ({d.aqi_category_name}) with {d.dominant_pollutant} as the dominant pollutant. The PM2.5 level is approximately {d.pollutants.get('pm25', 'N/A')} µg/m³."
        else:
            context = "You are a helpful environmental and health advisor. You do not have specific real-time air quality data, so provide general advice."

        # Construct the final prompt
        full_prompt = f"{context}\n\nBased on this, answer the user's question clearly and concisely:\n\nUser Question: \"{question}\""

        response = self.gemini_svc.get_ai_response(full_prompt)
        
        # Schedule UI update on the main thread
        self.after(0, self._update_ai_response, response)

    def _update_ai_response(self, response_text: str):
        """Updates the AI response text widget from the main thread."""
        self._update_text_widget(self.ai_response_text, f"{response_text}", tag="ai")
        self._set_ui_state(False) # Re-enable all buttons

    # --- Sky Vision Logic (Unchanged from v6.2.1) ---
    def upload_img(self):
        fp = filedialog.askopenfilename(filetypes=[("Image Files", "*.jpg *.jpeg *.png *.webp")]);
        if not fp: return
        self.img_path=fp; is_ready = self.aqi_data and self.aqi_data.is_valid; self.an_btn.config(state=tk.NORMAL if is_ready else tk.DISABLED)
        self._update_text_widget(self.analysis_txt, "Image loaded. " + ("Ready." if is_ready else "Fetch AQI data to analyze."))
        try: img = Image.open(fp); self.img_lbl.update_idletasks(); w,h = self.img_lbl.winfo_width(), self.img_lbl.winfo_height(); img.thumbnail((w-20, h-20), Image.Resampling.LANCZOS); self.img_tk=ImageTk.PhotoImage(img); self.img_lbl.config(image=self.img_tk, text="")
        except: self.img_lbl.config(text="Preview Error", image='')
    def analyze_img(self):
        if not self.img_path or not self.aqi_data or not self.aqi_data.is_valid: messagebox.showinfo("Analysis Blocked", "Upload image and fetch valid AQI data first."); return
        self._set_ui_state(True); self._update_status("Analyzing sky image...", "info", True); threading.Thread(target=self._worker_analyze_img, daemon=True).start()
    def _worker_analyze_img(self):
        try:
            with open(self.img_path, "rb") as f: img_bytes = f.read(); ctype = {'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','webp':'image/webp'}.get(os.path.splitext(self.img_path)[1].lower().strip('.'));
            if not ctype: raise ValueError("Unsupported image format")
            d=self.aqi_data; ctx = f"Image taken near {d.city}, where AQI is {d.overall_aqi} ({d.aqi_category_name}) with dominant pollutant {d.dominant_pollutant}."
            prompt = f"You are an environmental analyst. **Context:** {ctx}\n\n**Your Task:** Provide a concise, 3-part markdown analysis of the image:\n\n1.  **Visual Sky Assessment:** Describe sky color, visibility, and haze.\n2.  **Corroboration:** Compare visuals with the sensor data. Explain correlations.\n3.  **Advisory:** Provide a brief health advisory based on all available information."
            analysis = self.gemini_svc.get_ai_response(prompt, img_bytes, ctype)
            self.after(0, self._update_text_widget, self.analysis_txt, analysis)
            self.after(0, self._update_status, "Analysis complete.", "success")
            if self.mongo_svc.client is not None and self.aqi_data and self.aqi_data.is_valid: self.mongo_svc.save_record(self.img_path, ctype, self.aqi_data, analysis)
        except Exception as e: self.after(0, self._update_status, f"Image analysis failed: {e}", "danger"); self.after(0, self._update_text_widget, self.analysis_txt, f"Error: {e}")
        finally: self.after(0, self._set_ui_state, False)

    def destroy(self):
        if self.mongo_svc.client:
            self.mongo_svc.client.close()
        super().destroy()

if __name__ == "__main__":
    if not Config.GEMINI_API_KEY or not Config.WAQI_API_TOKEN:
        root = tk.Tk(); root.withdraw()
        messagebox.showerror("Critical Configuration Error", "GEMINI_API_KEY and/or WAQI_API_TOKEN are not set.\nThe application requires both to function and will now exit.")
        exit(1)
    app = AirSenseApp()
    app.mainloop()