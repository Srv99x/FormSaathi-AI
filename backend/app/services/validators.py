import re
from datetime import date

from pydantic import EmailStr, TypeAdapter, ValidationError

EMAIL = TypeAdapter(EmailStr)
MONTHS = {name.lower(): index for index, name in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August",
     "September", "October", "November", "December"], start=1)}
MONTHS.update({name[:3]: index for name, index in list(MONTHS.items())})


def check_date(value: str, today: date, manual: bool) -> tuple:
    parsed = None
    try:
        if re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
            parsed = date.fromisoformat(value)
        elif match := re.fullmatch(r"([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})", value):
            first, second, year = map(int, match.groups())
            options = set()
            for day, month in [(first, second), (second, first)]:
                try:
                    options.add(date(year, month, day))
                except ValueError:
                    pass
            if not options:
                raise ValueError
            if len(options) > 1:
                return value, "needs_review", "Ambiguous date. Enter an explicit day, month and year (YYYY-MM-DD)."
            parsed = options.pop()
        elif match := re.fullmatch(r"([0-9]{1,2}) ([A-Za-z]+) ([0-9]{4})", value):
            day, month, year = match.groups()
            parsed = date(int(year), MONTHS[month.lower()], int(day))
    except (ValueError, KeyError):
        pass
    if parsed is None:
        return value, "invalid", "Enter a real date as YYYY-MM-DD or 3 April 2006."
    if parsed > today:
        return value, "invalid", "Date of birth cannot be in the future."
    age = today.year - parsed.year - ((today.month, today.day) < (parsed.month, parsed.day))
    if not 12 <= age <= 100:
        # Slash input is never an explicit acknowledgement of an outlier.
        if not manual or "/" in value:
            return parsed.isoformat(), "needs_review", "Age is outside 12–100. Please explicitly check and enter the date."
        return parsed.isoformat(), "valid", "Date explicitly checked; age is outside the typical student range."
    return parsed.isoformat(), "valid", "Valid date of birth."


def check_field(field_id: str, value, spec: dict, required: bool,
                today: date, manual: bool = False) -> tuple:
    if isinstance(value, str):
        value = value.strip()
    if value is None or (isinstance(value, str) and value.casefold() in {"", "unknown"}):
        return None, "empty", "Needed to continue." if required else "Optional; not provided."
    if spec["type"] == "integer":
        if type(value) is not int or not spec["minimum"] <= value <= spec["maximum"]:
            return value, "invalid", "Choose a whole-number study year from 1 to 5."
        return value, "valid", "Valid study year."
    if not isinstance(value, str):
        return value, "invalid", "Enter a text value for this field."
    if field_id in {"full_name", "guardian_name"}:
        value = " ".join(value.split())
    if field_id == "mobile":
        value = re.sub(r"[\s-]", "", value)
        if value.startswith("+91"):
            value = value[3:]
        if not re.fullmatch(r"[6-9][0-9]{9}", value):
            return value, "invalid", "Enter a valid 10-digit Indian mobile number beginning with 6–9."
    if field_id == "date_of_birth":
        return check_date(value, today, manual)
    if not spec.get("minLength", 0) <= len(value) <= spec.get("maxLength", float("inf")):
        return value, "invalid", f"Enter {spec.get('minLength', 0)}–{spec['maxLength']} characters."
    if "enum" in spec:
        match = next((item for item in spec["enum"]
                      if isinstance(item, str) and item.casefold() == value.casefold()), None)
        if match is None:
            return value, "invalid", "Choose one of the listed options."
        value = match
    if field_id == "email":
        try:
            value = str(EMAIL.validate_python(value))
        except ValidationError:
            return value, "invalid", "Check the email address."
    return value, "valid", "Valid value."
