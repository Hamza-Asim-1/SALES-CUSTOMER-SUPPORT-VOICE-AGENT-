from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from supabase import Client
from app.core.config import settings
from jose import JWTError, jwt
from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_supabase() -> Client:
    from supabase import create_client
    
    # Temporary hardcoded values
    import os
    

# Access environment variables
  # Debugging purpose

    url = os.getenv("SUPABASE_URL") or settings.supabase_url
    key = (
        os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_KEY")
        or settings.supabase_key
    )
    # Python supabase client needs a JWT-style key (eyJ...), not sb_publishable_*
    if key and key.startswith("sb_"):
        key = os.getenv("SERVICE_ROLE") or settings.service_role or key

    if not url or not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase is not configured. Set SUPABASE_URL and a JWT anon key (eyJ...) in backend/.env",
        )

    return create_client(url, key)

# Updated current user dependency
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    supabase: Client = Depends(get_supabase)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Get user from Supabase auth
        user = supabase.auth.get_user(token)
        if not user:
            raise credentials_exception
        return user
    except Exception as e:
        raise credentials_exception