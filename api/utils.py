import re
from user_agents import parse as ua_parse

BOT_PATTERNS = re.compile(r'bot|crawl|spider|headless|lighthouse|prerender|slurp|bingpreview', re.I)

def is_bot(ua_string: str) -> bool:
    if not ua_string:
        return False
    return bool(BOT_PATTERNS.search(ua_string))

def get_device_type(ua_string: str) -> str:
    if not ua_string:
        return 'unknown'
    ua = ua_parse(ua_string)
    if ua.is_mobile:
        return 'mobile'
    if ua.is_tablet:
        return 'tablet'
    return 'desktop'
