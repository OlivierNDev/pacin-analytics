import os
from fastapi import Header, HTTPException

ADMIN_TOKEN = os.getenv('PACIN_ADMIN_TOKEN', '')

def require_admin(x_admin_token: str = Header(...)):
    if not ADMIN_TOKEN or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail='Unauthorized')
    return True
