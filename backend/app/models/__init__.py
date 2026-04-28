"""All SQLAlchemy models, imported here so Alembic can discover them."""

from app.models.farmer import Farmer  # noqa: F401
from app.models.crop import Crop  # noqa: F401
from app.models.admin import Admin  # noqa: F401
from app.models.disease import Disease  # noqa: F401
from app.models.farm_plot import FarmPlot  # noqa: F401
from app.models.market_price import MarketPrice  # noqa: F401
from app.models.weather_cache import WeatherCache  # noqa: F401
from app.models.diagnosis import Diagnosis  # noqa: F401
from app.models.expert_review import ExpertReview  # noqa: F401
from app.models.sms_interaction import SMSInteraction  # noqa: F401