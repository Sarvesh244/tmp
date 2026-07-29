import streamlit as st
import time
import pandas as pd
import numpy as np
import google.generativeai as genai

# --- 1. SETUP GEMINI API ---
# Replace 'YOUR_API_KEY' with your actual Gemini API Key
# Pull the key securely from Streamlit's environment
GEMINI_API_KEY = st.secrets["GEMINI_API_KEY"]
genai.configure(api_key=GEMINI_API_KEY)
# Using the specific model version you requested
model = genai.GenerativeModel('gemini-flash-lite-3.6') 

# --- 2. PAGE CONFIGURATION ---
st.set_page_config(
    page_title="LuxeStay | Smart Booking",
    page_icon="🏨",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- 3. ADVANCED CSS (Gradient, Navbar, and Floating Popover Chat) ---
st.markdown("""
    <style>
        /* Hide default Streamlit elements */
        header {visibility: hidden;}
        footer {visibility: hidden;}
        .stDeployButton {display:none;}
        
        /* Apply a luxury gradient background */
        .stApp {
            background: linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%);
        }
        
        /* Remove top padding */
        .block-container {
            padding-top: 1rem;
            padding-bottom: 0rem;
        }
        
        /* Style the tabs to look like a modern navigation bar */
        .stTabs [data-baseweb="tab-list"] {
            gap: 20px;
            padding-top: 10px;
            padding-bottom: 10px;
            border-bottom: 2px solid rgba(0,0,0,0.1);
        }
        .stTabs [data-baseweb="tab"] {
            height: 50px;
            border-radius: 8px;
            padding: 0 25px;
            background-color: transparent;
            font-weight: 700;
            color: #4a4a4a;
            transition: all 0.3s ease;
        }
        .stTabs [aria-selected="true"] {
            background-color: #2c3e50 !important;
            color: #ffffff !important;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        /* Price tags */
        .price-tag {
            font-size: 1.6rem;
            font-weight: 800;
            color: #d35400;
            margin-bottom: 15px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.05);
        }
        
        /* 🚨 MAGIC CSS: Target Streamlit's native popover and make it float! */
        div[data-testid="stPopover"] {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
        }
        /* Style the button that opens the popover */
        div[data-testid="stPopover"] > button {
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            color: white;
            border-radius: 50px;
            padding: 15px 25px;
            border: none;
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
            font-weight: bold;
            font-size: 16px;
            transition: transform 0.3s ease;
        }
        div[data-testid="stPopover"] > button:hover {
            transform: translateY(-5px);
            color: white;
            border-color: transparent;
        }
    </style>
    """, unsafe_allow_html=True)

# --- 4. PSEUDO-NAVBAR / BRANDING ---
col1, col2 = st.columns([1, 5])
with col1:
    st.markdown("<h2 style='color: #2c3e50; font-weight: 900; margin: 0;'>🏨 LuxeStay</h2>", unsafe_allow_html=True)
with col2:
    st.markdown("<p style='text-align: right; padding-top: 15px; font-weight: 600; color: #555;'>👤 Admin Portal | Power BI Workspace | Settings</p>", unsafe_allow_html=True)

# --- 5. NAVIGATION TABS (Removed Chat Tab as it's now a button) ---
tab_feed, tab_ml, tab_bi = st.tabs([
    "🔍 Explore Properties", 
    "📈 Price Predictor (ML)", 
    "📊 Power BI Analytics"
])

# --- TAB 1: HOTEL FEED ---
with tab_feed:
    st.markdown("<h3 style='color: #2c3e50;'>Curated Premium Stays</h3>", unsafe_allow_html=True)
    st.write("Discover our top-rated properties with AI-optimized dynamic pricing.")
    st.markdown("<br>", unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns(3)
    with col1:
        with st.container(border=True):
            st.image("https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80", use_column_width=True)
            st.subheader("The Azure Resort")
            st.markdown("<div class='price-tag'>$450 / night</div>", unsafe_allow_html=True)
            st.button("View Analytics", key="btn1", use_container_width=True)
    with col2:
        with st.container(border=True):
            st.image("https://images.unsplash.com/photo-1551882547-ff40eb0d1b73?auto=format&fit=crop&w=800&q=80", use_column_width=True)
            st.subheader("JW Marriott")
            st.markdown("<div class='price-tag'>$185 / night</div>", unsafe_allow_html=True)
            st.button("View Analytics", key="btn2", use_container_width=True)
    with col3:
        with st.container(border=True):
            st.image("https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80", use_column_width=True)
            st.subheader("Alpine Lodge")
            st.markdown("<div class='price-tag'>$290 / night</div>", unsafe_allow_html=True)
            st.button("View Analytics", key="btn3", use_container_width=True)

# --- TAB 2 & 3: ML AND BI (Keeping standard structure for brevity) ---
with tab_ml:
    st.markdown("<h3 style='color: #2c3e50;'>Dynamic Pricing Engine</h3>", unsafe_allow_html=True)
    st.info("Input ML parameters here.")
with tab_bi:
    st.markdown("<h3 style='color: #2c3e50;'>Power BI Dashboard</h3>", unsafe_allow_html=True)
    st.info("Embed Power BI iframe here.")


# --- 6. FLOATING GEMINI AI CHATBOT (Using st.popover) ---
if "chat_history" not in st.session_state:
    st.session_state.chat_history = [
        {"role": "assistant", "content": "Hi! I am the LuxeStay AI. How can I assist you with pricing or bookings today?"}
    ]

# The popover creates a button that opens a mini-window when clicked.
# Because of our CSS above, this button is pinned to the bottom right!
with st.popover("💬 Chat with AI"):
    st.markdown("### 🤖 GenAI Concierge")
    
    # Scrollable container for chat history
    chat_container = st.container(height=350)
    with chat_container:
        for message in st.session_state.chat_history:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])
                
    # Input form (Streamlit doesn't allow st.chat_input inside popovers, so we use a form)
    with st.form("chat_form", clear_on_submit=True):
        col1, col2 = st.columns([4, 1])
        with col1:
            user_input = st.text_input("Ask a question...", label_visibility="collapsed", placeholder="Ask a question...")
        with col2:
            submitted = st.form_submit_button("Send", type="primary", use_container_width=True)
            
    if submitted and user_input:
        # 1. Append user message to UI
        st.session_state.chat_history.append({"role": "user", "content": user_input})
        
        # 2. Call Gemini API
        try:
            # We pass the prompt directly to Gemini
            response = model.generate_content(user_input)
            bot_reply = response.text
        except Exception as e:
            bot_reply = f"API Error: Please check your API key or model name. Details: {e}"
            
        # 3. Append bot response to UI
        st.session_state.chat_history.append({"role": "assistant", "content": bot_reply})
        
        # 4. Rerun app to instantly show new messages
        st.rerun()
