import requests
import random
import time
import uuid

BASE_URL = "http://localhost:3001"

REGISTER_URL = f"{BASE_URL}/api/auth/register"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
EMISSION_URL = f"{BASE_URL}/api/carbon/emission/calculate"

headers = {"Content-Type": "application/json"}

# --- Rate limit configuration ---
MIN_DELAY = 4
MAX_DELAY = 7
COOLDOWN_IF_LIMIT = 60


def rate_limit():
    """Centralized delay between requests"""
    delay = random.uniform(MIN_DELAY, MAX_DELAY)
    print(f"Waiting {delay:.2f}s...")
    time.sleep(delay)


states = [
    "Tamil Nadu","Karnataka","Kerala","Andhra Pradesh","Telangana",
    "Maharashtra","Gujarat","Rajasthan","Punjab","Haryana",
    "Uttar Pradesh","Bihar","West Bengal","Odisha","Madhya Pradesh"
]

tamil_nadu_districts = [
    "Chennai","Coimbatore","Madurai","Salem","Trichy",
    "Erode","Tirunelveli","Thoothukudi","Vellore","Kanchipuram"
]

random_districts = ["DistrictA","DistrictB","DistrictC","DistrictD"]

industries = ["cement","steel","chemical","textile","power"]
fuels = ["coal","diesel","natural_gas","biomass"]
years = [2020,2021,2022,2023,2024]


def safe_post(url, payload, headers):
    """Handles rate limit retry logic"""

    while True:
        response = requests.post(url, json=payload, headers=headers)

        if response.status_code == 429:
            print("Rate limit hit. Cooling down...")
            time.sleep(COOLDOWN_IF_LIMIT)
            continue

        return response


def register_user(state, district):

    email = f"user_{uuid.uuid4().hex[:6]}@example.com"

    payload = {
        "organisation_type": "Manufacturing",
        "organisation_name": f"{state} Industry {random.randint(1,999)}",
        "country": "India",
        "state": state,
        "district": district,
        "zone": str(random.randint(1,10)),
        "ward": str(random.randint(1,50)),
        "email": email,
        "password": "SecurePass@123",
        "role": "buyer"
    }

    r = safe_post(REGISTER_URL, payload, headers)
    rate_limit()

    if r.status_code in [200, 201]:
        print("Registered:", email)
        return email
    else:
        print(f"Registration failed for {email}: {r.text}")
        return None


def login_user(email):

    payload = {
        "email": email,
        "password": "SecurePass@123"
    }

    r = safe_post(LOGIN_URL, payload, headers)
    rate_limit()

    if r.status_code == 200:
        print("Login successful:", email)
        return r.json().get("token")

    print("Login failed:", r.text)
    return None


def generate_emission():

    return {
        "reporting_year": random.choice(years),

        "project_id": f"buyer-{int(time.time()*1000)}-{random.randint(100,999)}",

        "scope1": {
            "fuel_type": random.choice(fuels),
            "fuel_unit": "tonnes",
            "fuel_quantity": round(random.uniform(100,1200), 2),
            "number_of_factories": random.randint(1,5),
            "industry_type": random.choice(industries),
            "manufacturing_category": random.choice(["light","medium","heavy"])
        },

        "scope2": {
            "electricity_kwh": random.randint(50000,350000),
            "grid_emission_factor": round(random.uniform(0.7,0.9),2)
        },

        "scope3": {
            "transportation_co2e": round(random.uniform(20,250),2),
            "waste_co2e": round(random.uniform(10,90),2)
        },

        "forest_area_m2": random.randint(10000,2000000),
        "tree_count": random.randint(50,15000),
        "other_absorption_co2e": round(random.uniform(0,50),2)
    }


def submit_emission(token):

    payload = generate_emission()

    auth_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }

    r = safe_post(EMISSION_URL, payload, auth_headers)
    rate_limit()

    if r.status_code == 200:
        print("Emission submitted")
    else:
        print("Emission failed:", r.text)


# -------------------------
# DATA GENERATION
# -------------------------

print("Starting data generation...\n")

# Tamil Nadu (10 districts)
for district in tamil_nadu_districts:

    email = register_user("Tamil Nadu", district)

    if email:
        token = login_user(email)

        if token:
            submit_emission(token)

    time.sleep(random.uniform(6,10))


# Other states (2 users each)
for state in states:

    if state == "Tamil Nadu":
        continue

    for _ in range(2):

        district = random.choice(random_districts)

        email = register_user(state, district)

        if email:
            token = login_user(email)

            if token:
                submit_emission(token)

        time.sleep(random.uniform(6,10))

print("\nData generation complete.")