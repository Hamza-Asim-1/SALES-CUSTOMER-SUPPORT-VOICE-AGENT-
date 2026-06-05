"""
Seed a demo company/user with fake CRM and calling data for end-to-end testing.

Usage (from repo root):
  python backend/scripts/seed_demo_data.py

Requires backend/.env with SUPABASE_URL and SERVICE_ROLE.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography.fernet import Fernet
from dotenv import load_dotenv
from supabase import create_client

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_ROLE = os.getenv("SERVICE_ROLE")
ENCRYPTION_KEY = os.getenv("encryption_key")
PSQL_URL = os.getenv("PSQL_URL")

DEMO_EMAIL = "demo@techcare.ai"
DEMO_PASSWORD = "Demo123!@#"
DEMO_USERNAME = "demo_admin"
DEMO_BUSINESS = "TechCare AI Solutions"
PRODUCT = "TechCare AI Sales Automation Platform"

LEADS = [
    ("Sarah Mitchell", "+1-415-555-0101", "sarah.mitchell@northwind.io", "Northwind Logistics", "San Francisco, CA", "Lead", "pending", None),
    ("James Chen", "+1-212-555-0102", "j.chen@apexretail.com", "Apex Retail Group", "New York, NY", "Lead", "pending", None),
    ("Emily Rodriguez", "+1-305-555-0103", "emily.r@sunrisehealth.org", "Sunrise Health Clinics", "Miami, FL", "Prospect", "success", "Agent: Hi Emily, this is Alex from TechCare AI. We help clinics automate outbound follow-ups.\nEmily: We are evaluating tools this quarter.\nAgent: Perfect timing — our platform cuts manual dialing by 60%. Can I send a one-pager?\nEmily: Yes, send it to my email."),
    ("Michael O'Brien", "+1-617-555-0104", "mobrien@harborfinance.com", "Harbor Finance", "Boston, MA", "Prospect", "success", "Agent: Michael, quick call about AI-assisted sales workflows.\nMichael: We tried a dialer last year — poor results.\nAgent: Our agents handle objections and log CRM notes automatically.\nMichael: Book a demo for next Tuesday."),
    ("Priya Sharma", "+1-408-555-0105", "priya@cloudstack.dev", "CloudStack Dev", "San Jose, CA", "Customer", "success", "Agent: Following up on your trial — how did the voice agent perform?\nPriya: Team loved it. We want 3 seats.\nAgent: I'll send the contract today.\nPriya: Approved internally."),
    ("David Kim", "+1-206-555-0106", "david.kim@pacificfoods.co", "Pacific Foods Co", "Seattle, WA", "Lead", "failure", None),
    ("Lisa Thompson", "+1-512-555-0107", "lisa.t@lonestarsolar.com", "Lone Star Solar", "Austin, TX", "Lead", "pending", None),
    ("Robert Garcia", "+1-713-555-0108", "rgarcia@gulfenergy.net", "Gulf Energy Partners", "Houston, TX", "Prospect", "processing", None),
    ("Anna Kowalski", "+1-312-555-0109", "anna.k@midwestmfg.com", "Midwest Manufacturing", "Chicago, IL", "Lead", "stopped", None),
    ("Tom Hughes", "+1-404-555-0110", "tom.hughes@southernmedia.tv", "Southern Media TV", "Atlanta, GA", "Prospect", "success", "Agent: Tom, saw you downloaded our case study.\nTom: Yes — curious about VAPI integration.\nAgent: We ship with VAPI and ElevenLabs out of the box.\nTom: Send pricing for 10 agents."),
    ("Nina Patel", "+1-480-555-0111", "nina@deserttech.io", "Desert Tech", "Phoenix, AZ", "Customer", "success", "Agent: Nina, renewal is next month — any questions?\nNina: All good. Increase to 5 concurrent agents.\nAgent: Noted, updating your plan."),
    ("Chris Walker", "+1-215-555-0112", "cwalker@libertyins.com", "Liberty Insurance", "Philadelphia, PA", "Lead", "pending", None),
    ("Maria Santos", "+1-303-555-0113", "maria@rockymountain.edu", "Rocky Mountain Edu", "Denver, CO", "Lead", "failure", None),
    ("Kevin Brooks", "+1-503-555-0114", "k.brooks@cascadetech.com", "Cascade Tech", "Portland, OR", "Prospect", "success", "Agent: Kevin, we automate lead qualification calls.\nKevin: Our SDRs spend hours on voicemail.\nAgent: Our AI leaves smart callbacks and updates CRM status.\nKevin: Demo Friday works."),
    ("Jennifer Lee", "+1-702-555-0115", "jlee@vegas hospitality.com", "Vegas Hospitality Group", "Las Vegas, NV", "Lead", "pending", None),
    ("Ahmed Hassan", "+1-571-555-0116", "ahassan@capitalconsult.com", "Capital Consult", "Washington, DC", "Customer", "success", "Agent: Ahmed, how is onboarding going?\nAhmed: Smooth. Dashboard metrics are helpful.\nAgent: Great — I'll check in after your first campaign."),
    ("Sophie Martin", "+1-514-555-0117", "s.martin@quebecbio.ca", "Quebec Bio Labs", "Montreal, QC", "Prospect", "stopped", None),
    ("Daniel Wright", "+1-615-555-0118", "dwright@musiccity.auto", "Music City Auto", "Nashville, TN", "Lead", "pending", None),
    ("Olivia Brown", "+1-919-555-0119", "olivia@trianglepharma.com", "Triangle Pharma", "Raleigh, NC", "Prospect", "success", "Agent: Olivia, pharma compliance is built into our call logs.\nOlivia: That's our main concern.\nAgent: All transcripts are encrypted and exportable.\nOlivia: Send SOC-2 docs."),
    ("Marcus Johnson", "+1-313-555-0120", "marcus@motorparts.us", "Motor Parts US", "Detroit, MI", "Lead", "failure", None),
    ("Rachel Green", "+1-801-555-0121", "rachel@wasatchoutdoors.com", "Wasatch Outdoors", "Salt Lake City, UT", "Customer", "success", "Agent: Rachel, your campaign hit 42% connect rate.\nRachel: Better than our old dialer.\nAgent: Want to scale to 200 leads/week?\nRachel: Yes, let's do it."),
    ("Ben Foster", "+1-612-555-0122", "ben@twin cities.ag", "Twin Cities Ag", "Minneapolis, MN", "Lead", "pending", None),
    ("Grace Liu", "+1-858-555-0123", "grace.liu@biotechsd.com", "BioTech SD", "San Diego, CA", "Prospect", "processing", None),
    ("Henry Adams", "+1-901-555-0124", "hadams@mid south.log", "Mid-South Logistics", "Memphis, TN", "Lead", "pending", None),
    ("Isabella Rossi", "+1-786-555-0125", "irossi@latamtrade.co", "LatAm Trade Co", "Miami, FL", "Prospect", "success", "Agent: Isabella, we support bilingual voice agents.\nIsabella: English and Spanish?\nAgent: Yes — same CRM pipeline.\nIsabella: Schedule a pilot."),
]


def encrypt_business_name(value: str) -> str:
    if not ENCRYPTION_KEY:
        return value
    fernet = Fernet(ENCRYPTION_KEY.encode())
    return fernet.encrypt(value.encode()).decode()


def ensure_dashboard_columns(cur) -> None:
    cur.execute(
        """
        ALTER TABLE public."Mapped_Dataset"
        ADD COLUMN IF NOT EXISTS "Organization" TEXT,
        ADD COLUMN IF NOT EXISTS "Status" TEXT;
        """
    )


def try_add_dashboard_columns() -> bool:
    if not PSQL_URL:
        return False
    try:
        import psycopg2

        conn = psycopg2.connect(PSQL_URL, connect_timeout=8)
        cur = conn.cursor()
        ensure_dashboard_columns(cur)
        conn.commit()
        cur.close()
        conn.close()
        print("Ensured Organization + Status columns on Mapped_Dataset")
        return True
    except Exception as exc:
        print(f"Skipping direct SQL column migration ({exc}). Using core columns only.")
        return False


def build_row(user_id: str, lead: tuple, index: int, include_dashboard_cols: bool) -> dict:
    name, contact, email, org, location, crm_status, proc_status, conversation = lead
    created = datetime.now(timezone.utc) - timedelta(days=25 - index)
    row = {
        "User_id": user_id,
        "File_Name": "techcare_demo_leads.csv",
        "Name": name,
        "Contact": contact,
        "Email": email,
        "Info": f"[{crm_status}] Interested in {PRODUCT}. Company: {org}. Source: demo seed.",
        "Location": f"{org} — {location}",
        "_Product_to_pitch": PRODUCT,
        "status": proc_status,
        "Conversation": conversation,
        "created_at": created.isoformat(),
    }
    if include_dashboard_cols:
        row["Organization"] = org
        row["Status"] = crm_status
    if proc_status == "success":
        row["processing_end_time"] = (created + timedelta(minutes=7)).isoformat()
        row["processing_start_time"] = (created + timedelta(minutes=2)).isoformat()
    elif proc_status in ("processing", "stopped", "failure"):
        row["processing_start_time"] = (created + timedelta(minutes=1)).isoformat()
    return row


def users_data_row(mapped_row: dict) -> dict:
    return {
        "User_id": mapped_row["User_id"],
        "Name": mapped_row["Name"],
        "Contact": mapped_row["Contact"],
        "Email": mapped_row["Email"],
        "Info": mapped_row["Info"],
        "Location": mapped_row["Location"],
        "_Product_to_pitch": mapped_row["_Product_to_pitch"],
        "status": mapped_row["status"],
        "Conversation": mapped_row["Conversation"],
        "processing_start_time": mapped_row.get("processing_start_time"),
        "processing_end_time": mapped_row.get("processing_end_time"),
        "created_at": mapped_row["created_at"],
    }


def get_or_create_user(supabase):
    existing = supabase.table("users").select("id, email").eq("email", DEMO_EMAIL).execute()
    if existing.data:
        user_id = existing.data[0]["id"]
        print(f"Reusing existing demo user: {user_id}")
        return user_id

    created = supabase.auth.admin.create_user(
        {
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD,
            "email_confirm": True,
            "user_metadata": {
                "username": DEMO_USERNAME,
                "business_name": DEMO_BUSINESS,
            },
        }
    )
    user_id = created.user.id
    print(f"Created demo user: {user_id}")

    supabase.table("users").upsert(
        {
            "id": user_id,
            "username": DEMO_USERNAME,
            "email": DEMO_EMAIL,
            "business_name": encrypt_business_name(DEMO_BUSINESS),
        }
    ).execute()

    return user_id


def clear_user_data(supabase, user_id: str) -> None:
    supabase.table("Mapped_Dataset").delete().eq("User_id", user_id).execute()
    supabase.table("users_data").delete().eq("User_id", user_id).execute()
    print(f"Cleared previous demo rows for user {user_id}")


def seed_rows(supabase, user_id: str) -> None:
    include_dashboard_cols = try_add_dashboard_columns()
    mapped_rows = [build_row(user_id, lead, i, include_dashboard_cols) for i, lead in enumerate(LEADS)]
    users_rows = [users_data_row(row) for row in mapped_rows]

    try:
        supabase.table("Mapped_Dataset").insert(mapped_rows).execute()
    except Exception as exc:
        if include_dashboard_cols:
            print(f"Insert with dashboard columns failed ({exc}). Retrying without Organization/Status.")
            mapped_rows = [build_row(user_id, lead, i, False) for i, lead in enumerate(LEADS)]
            users_rows = [users_data_row(row) for row in mapped_rows]
            supabase.table("Mapped_Dataset").insert(mapped_rows).execute()
        else:
            raise

    supabase.table("users_data").insert(users_rows).execute()
    print(f"Inserted {len(mapped_rows)} leads into Mapped_Dataset and users_data")


def print_summary(user_id: str) -> None:
    print("\n" + "=" * 60)
    print("DEMO ACCOUNT READY")
    print("=" * 60)
    print(f"  Company : {DEMO_BUSINESS}")
    print(f"  Email   : {DEMO_EMAIL}")
    print(f"  Password: {DEMO_PASSWORD}")
    print(f"  User ID : {user_id}")
    print(f"  Leads   : {len(LEADS)} (mixed Lead/Prospect/Customer + call statuses)")
    print("\nLog in at http://localhost:3000/login then open Dashboard / Sales Agent.")
    print("=" * 60 + "\n")


def main() -> int:
    if not SUPABASE_URL or not SERVICE_ROLE:
        print("Missing SUPABASE_URL or SERVICE_ROLE in backend/.env", file=sys.stderr)
        return 1

    supabase = create_client(SUPABASE_URL, SERVICE_ROLE)
    user_id = get_or_create_user(supabase)
    clear_user_data(supabase, user_id)
    seed_rows(supabase, user_id)
    print_summary(user_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
