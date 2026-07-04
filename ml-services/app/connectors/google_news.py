"""Google News connector.

Google does not offer a free official "Google News API" — the paid/enterprise
News API requires approval and billing. However, Google News publishes public
RSS feeds that anyone can query for free, with no API key:

    https://news.google.com/rss/search?q=<query>&hl=en-US&gl=US&ceid=US:en

This connector uses that free RSS endpoint, following the same
fetch()/normalize() pattern as the other connectors (e.g. GDELTNewsConnector).
"""
import hashlib
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import quote
from xml.etree import ElementTree

import requests

from app.connectors.base import BaseConnector
from app.models.incident import Incident

GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"

DEFAULT_QUERY = (
    "earthquake OR flood OR wildfire OR cyclone OR hurricane OR volcano "
    "OR landslide OR tsunami OR drought"
)

CATEGORY_KEYWORDS = [
    ("earthquake", "Earthquake"),
    ("flood", "Flood"),
    ("wildfire", "Wildfire"),
    ("fire", "Wildfire"),
    ("cyclone", "Cyclone"),
    ("typhoon", "Cyclone"),
    ("hurricane", "Cyclone"),
    ("volcano", "Volcano"),
    ("landslide", "Landslide"),
    ("tsunami", "Tsunami"),
    ("drought", "Drought"),
]


class GoogleNewsConnector(BaseConnector):
    """Fetches disaster-related headlines from the free Google News RSS feed."""

    def __init__(self, query: str | None = None, language: str = "en-US", country: str = "US"):
        self.query = query or DEFAULT_QUERY
        self.language = language
        self.country = country

    def fetch(self):
        params = {
            "q": self.query,
            "hl": self.language,
            "gl": self.country,
            "ceid": f"{self.country}:{self.language.split('-')[0]}",
        }

        response = requests.get(
            GOOGLE_NEWS_RSS_URL,
            params=params,
            timeout=10,
            headers={"User-Agent": "VARUNA ML Services/1.0"},
        )
        response.raise_for_status()
        return response.text

    def normalize(self, raw_data):
        incidents = []

        if not raw_data:
            return incidents

        try:
            root = ElementTree.fromstring(raw_data)
        except ElementTree.ParseError:
            return incidents

        items = root.findall("./channel/item")

        for item in items:
            title = self._text(item, "title")
            link = self._text(item, "link")

            if not title or not link:
                continue

            description = self._text(item, "description") or title
            source_name = self._text(item, "source") or "Google News"
            pub_date = self._text(item, "pubDate")

            category = self._infer_category(title)
            timestamp = self._parse_timestamp(pub_date)

            incidents.append(
                Incident(
                    id=self._build_id(link),
                    source=f"Google News ({source_name})",
                    title=title,
                    description=description,
                    category=category,
                    latitude=None,
                    longitude=None,
                    timestamp=timestamp,
                    url=link,
                )
            )

        return incidents

    def _text(self, item, tag):
        el = item.find(tag)
        if el is None or el.text is None:
            return None
        return el.text.strip()

    def _infer_category(self, title):
        title_lower = title.lower()
        for keyword, category in CATEGORY_KEYWORDS:
            if keyword in title_lower:
                return category
        return "Disaster"

    def _build_id(self, url):
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
        return f"GOOGLENEWS_{digest}"

    def _parse_timestamp(self, pub_date):
        if not pub_date:
            return None
        try:
            return parsedate_to_datetime(pub_date)
        except Exception:
            return None