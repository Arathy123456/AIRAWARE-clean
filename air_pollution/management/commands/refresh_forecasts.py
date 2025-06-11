from django.core.management.base import BaseCommand
from django.conf import settings
from ...utils.s3_utils import get_latest_forecasts
from ...models import AirQualityForecast
import datetime


class Command(BaseCommand):
    help = 'Refresh forecasts from S3 into the database'

    def handle(self, *args, **options):
        self.stdout.write('Fetching latest forecasts from S3...')

        # Get the latest forecasts
        forecast_data = get_latest_forecasts()

        if not forecast_data:
            self.stdout.write(self.style.ERROR('Failed to fetch forecast data'))
            return

        # Update database
        forecasts_created = 0
        forecasts_updated = 0

        for gas, values in forecast_data['gases'].items():
            for i, date_str in enumerate(forecast_data['dates']):
                date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
                value = values[i]

                forecast, created = AirQualityForecast.objects.update_or_create(
                    date=date_obj,
                    gas_type=gas,
                    defaults={
                        'forecasted_value': value
                    }
                )

                if created:
                    forecasts_created += 1
                else:
                    forecasts_updated += 1

        self.stdout.write(self.style.SUCCESS(
            f'Successfully refreshed forecasts: {forecasts_created} created, {forecasts_updated} updated'
        ))