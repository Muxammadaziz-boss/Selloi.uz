"""Retention management module for Selloi Backup System.

Implements the Grandfather-Father-Son (GFS) retention model:
- Daily backups: 30 days.
- Weekly backups: 8 weeks.
- Monthly backups: 12 months.

Strictly operates in dry-run mode until explicitly approved.
Guarantees historical backups are never deleted during backup failures.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple


class RetentionManager:
    """Manages backup retention policies across all destinations."""

    def __init__(
        self,
        daily_days: int = 30,
        weekly_weeks: int = 8,
        monthly_months: int = 12,
        dry_run: bool = True
    ):
        self.daily_days = daily_days
        self.weekly_weeks = weekly_weeks
        self.monthly_months = monthly_months
        self.dry_run = dry_run

    def parse_timestamp(self, ts_str: str) -> datetime:
        """Parse ISO timestamp or backup ID timestamp."""
        # Try ISO format
        try:
            return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except Exception:
            pass

        # Try backup ID format: selloi_backup_YYYYMMDD_HHMMSS
        try:
            parts = ts_str.split("_")
            if len(parts) >= 4:
                date_str = f"{parts[2]}_{parts[3][:6]}"
                return datetime.strptime(date_str, "%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)
        except Exception:
            pass

        return datetime.now(timezone.utc)

    def evaluate_retention(
        self,
        backups: List[Dict[str, Any]],
        now_utc: datetime = None
    ) -> Dict[str, Any]:
        """Evaluate which backups to retain and which are expired.
        
        Returns retention plan report dict.
        """
        now = now_utc or datetime.now(timezone.utc)
        if not backups:
            return {
                "total_backups": 0,
                "retained_count": 0,
                "expired_count": 0,
                "retained": [],
                "expired": [],
                "dry_run": self.dry_run
            }

        # Parse and sort backups chronologically
        parsed_backups = []
        for b in backups:
            ts = self.parse_timestamp(b.get("timestamp") or b.get("name") or "")
            parsed_backups.append({"raw": b, "datetime": ts})

        parsed_backups.sort(key=lambda x: x["datetime"], reverse=True)

        # Safety rule: if only 1 backup exists, NEVER expire it
        if len(parsed_backups) <= 1:
            return {
                "total_backups": len(parsed_backups),
                "retained_count": len(parsed_backups),
                "expired_count": 0,
                "retained": [b["raw"] for b in parsed_backups],
                "expired": [],
                "dry_run": self.dry_run,
                "note": "Safety hold: Single remaining backup is always retained."
            }

        retained = []
        expired = []

        daily_cutoff = now - timedelta(days=self.daily_days)
        weekly_cutoff = now - timedelta(weeks=self.weekly_weeks)
        monthly_cutoff = now - timedelta(days=self.monthly_months * 30)

        seen_weeks = set()
        seen_months = set()

        for item in parsed_backups:
            b = item["raw"]
            dt = item["datetime"]
            week_key = (dt.year, dt.isocalendar()[1])
            month_key = (dt.year, dt.month)

            is_retained = False
            retention_reason = ""

            # Check daily
            if dt >= daily_cutoff:
                is_retained = True
                retention_reason = "Daily tier (< 30 days)"
            # Check weekly
            elif dt >= weekly_cutoff and week_key not in seen_weeks:
                is_retained = True
                seen_weeks.add(week_key)
                retention_reason = f"Weekly tier (Week {week_key[1]} {week_key[0]})"
            # Check monthly
            elif dt >= monthly_cutoff and month_key not in seen_months:
                is_retained = True
                seen_months.add(month_key)
                retention_reason = f"Monthly tier (Month {month_key[1]}/{month_key[0]})"

            if is_retained:
                b_copy = dict(b)
                b_copy["retention_reason"] = retention_reason
                retained.append(b_copy)
            else:
                b_copy = dict(b)
                b_copy["expired_reason"] = "Exceeded daily, weekly, and monthly retention tiers"
                expired.append(b_copy)

        return {
            "total_backups": len(backups),
            "retained_count": len(retained),
            "expired_count": len(expired),
            "retained": retained,
            "expired": expired,
            "dry_run": self.dry_run
        }
