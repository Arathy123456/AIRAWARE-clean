# utils/s3_utils.py
import boto3
import json
import pandas as pd
from io import StringIO
from django.conf import settings


def get_s3_client():
    return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME
    )


def get_latest_forecasts():
    """
    Fetch the latest forecasts from S3
    """
    s3_client = get_s3_client()
    bucket_name = settings.AWS_S3_BUCKET_NAME
    file_key = 'forecast_results/latest_forecasts.json'

    try:
        response = s3_client.get_object(Bucket=bucket_name, Key=file_key)
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except Exception as e:
        print(f"Error fetching forecasts: {e}")
        return None


def get_forecast_status():
    """
    Get the status of the forecasting process
    """
    s3_client = get_s3_client()
    bucket_name = settings.AWS_S3_BUCKET_NAME
    file_key = 'forecast_results/forecast_status.json'

    try:
        response = s3_client.get_object(Bucket=bucket_name, Key=file_key)
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except Exception as e:
        print(f"Error fetching forecast status: {e}")
        return None