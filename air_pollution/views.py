
from django.shortcuts import render
from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
#from .models import aqi_index
from django.contrib.auth import login
import pandas as pd
from django.template.loader import render_to_string
#from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
import json
import re
from dotenv import load_dotenv
from twilio.rest import Client
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth import authenticate, login as auth_login
from django.views.decorators.gzip import gzip_page
#from sklearn.neighbors import KNeighborsRegressor

from .models import User, login, HealthAssessment, AirQualityData, AdminUserlogin ,FamilyMembers
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password
from twilio.rest import Client
from django.contrib.auth.decorators import login_required
from django.conf import settings
#import  matplotlib
#import matplotlib.pyplot as plt
#import plotly.express as px
from django.shortcuts import render
from django.contrib.sessions.models import Session
from django.views.decorators.csrf import ensure_csrf_cookie
import csv
import os
import io
#import pyrebase
from decimal import Decimal
import boto3
import numpy as np
import pandas as pd

from django.utils.timezone import now
from django.utils.timezone import now
from .dynamodb import get_all_items, get_device_data, parse_payload, store_data_to_s3
from datetime import datetime
from django.views.decorators.cache import cache_page
from django.views.decorators.gzip import gzip_page
from datetime import timedelta

from django.core.paginator import Paginator
from .utils.s3_utils import get_latest_forecasts, get_forecast_status
import json
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET
from math import radians, sin, cos, sqrt, atan2

import pdfkit

# Create your views here.
def home(request,username=None):
    username = username or request.session.get('name')
    items = get_device_data("lora-v1")
    for item in items:
        parsed_payload = parse_payload(item['payload'])
        item.update({
            'co': parsed_payload.get('co'),
            'nh3': parsed_payload.get('nh3'),
            'no2': parsed_payload.get('no2'),
            'o3': parsed_payload.get('o3'),
            'pm25': parsed_payload.get('pm25'),
            'pm10': parsed_payload.get('pm10'),
            'so2': parsed_payload.get('so2'),
            'hum': parsed_payload.get('hum'),
            'date': parsed_payload.get('date'),
            'time' : parsed_payload.get('time'),
        })

    # Check if items are available
    if not items:
        return JsonResponse({'error': 'No data available'}, status=400)

    # Sort items by date
    items.sort(
        key=lambda x: datetime.strptime(
            truncate_nanoseconds(x['received_at']).strip(),
            '%Y-%m-%dT%H:%M:%S.%fZ'
        ),
        reverse=True
    )

    latest_24_items = items[:24]  # Get the latest 24 items
    # Initialize sum and count for averaging
    parameters = ['nh3', 'o3', 'pm25', 'pm10','co','so2','no2']
    sums = {param: 0 for param in parameters}
    counts = {param: 0 for param in parameters}

    # Compute sums and counts
    for item in latest_24_items:
        parsed_payload = parse_payload(item['payload'])
        for param in parameters:
            value = float(parsed_payload.get(param)) if parsed_payload.get(param) is not None else None

            if value is not None:
                sums[param] += value
                counts[param] += 1

    # Calculate averages
    averages = {
        param: (sums[param] / counts[param]) if counts[param] > 0 else None
        for param in parameters
    }
    print("averages", averages)

    # Calculate sub-indices
    sub_indices = calculate_subindices(averages)

    print("sub_indices", sub_indices)

    # Get the highest sub-index
    valid_indices = [index for index in sub_indices.values() if index is not None]
    highest_sub_index = round(max(valid_indices)) if valid_indices else None
    print(highest_sub_index)

    # Get the latest item for display
    latest_item = latest_24_items[0] if latest_24_items else None

    if latest_item:
        received_at = datetime.strptime(
            truncate_nanoseconds(latest_item['received_at']).strip(),
            '%Y-%m-%dT%H:%M:%S.%fZ'
        )
        latest_item['received_at'] = received_at.strftime('%Y-%m-%d %H:%M:%S')
        print("🔍 Latest Item Values:")
        for key, value in latest_item.items():
            print(f"{key}: {value}")

    # Return JSON for AJAX requests
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({
            'latest_item': latest_item,
            'averages': averages,
            'sub_indices': {k: round(v, 2) if v is not None else None for k, v in sub_indices.items()},
            'highest_sub_index': highest_sub_index,
        })


    return render(request, 'index1.html', {
            "latest_item": latest_item,
            "averages": averages,
            "sub_indices": {k: round(v, 2) if v is not None else None for k, v in sub_indices.items()},
            "highest_sub_index": highest_sub_index,
            "username": username
        })

def weather_map(request):
    return render(request, 'weather.html')
def weather_forecast(request):
    return render(request,'googlemap.html')


def calculate_subindices(averages):
    """Calculate sub-indices for all parameters from their average values"""

    def safe_float(value):
        """Safely convert value to float, handling Decimal types"""
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def calculate_pm25_subindex(value):
        value = safe_float(value)
        if value is None or value < 0:  # Ensure value is valid
            return None
        if value <= 30.0:
            return (value * 50.0) / 30.0
        elif value <= 60.0:
            return 50.0 + ((value - 30.0) * 50.0) / 30.0
        elif value <= 90.0:
            return 100.0 + ((value - 60.0) * 100.0) / 30.0
        elif value <= 120.0:
            return 200.0 + ((value - 90.0) * 100.0) / 30.0
        elif value <= 250.0:
            return 300.0 + ((value - 120.0) * 100.0) / 130.0
        else:
            return 400.0 + ((value - 250.0) * 100.0) / 130.0

    def calculate_pm10_subindex(value):
        value = safe_float(value)
        if value is None:
            return None
        if value <= 50.0:
            return value
        elif value <= 100.0:
            return value
        elif value <= 250.0:
            return 100.0 + ((value - 100.0) * 100.0) / 150.0
        elif value <= 350.0:
            return 200.0 + ((value - 250.0) * 100.0) / 100.0
        elif value <= 430.0:
            return 300.0 + ((value - 350.0) * 100.0) / 80.0
        else:
            return 400.0 + ((value - 430.0) * 100.0) / 80.0

    def calculate_so2_subindex(value):
        value = safe_float(value)
        if value is None:
            return None
        if value <= 40.0:
            return (value * 50.0) / 40.0
        elif value <= 80.0:
            return 50.0 + ((value - 40.0) * 50.0) / 40.0
        elif value <= 380.0:
            return 100.0 + ((value - 80.0) * 100.0) / 300.0
        elif value <= 800.0:
            return 200.0 + ((value - 380.0) * 100.0) / 420.0
        elif value <= 1600.0:
            return 300.0 + ((value - 800.0) * 100.0) / 800.0
        else:
            return 400.0 + ((value - 1600.0) * 100.0) / 800.0

    def calculate_no2_subindex(value):
        value = safe_float(value)
        if value is None:
            return None
        if value <= 40.0:
            return (value * 50.0) / 40.0
        elif value <= 80.0:
            return 50.0 + ((value - 40.0) * 50.0) / 40.0
        elif value <= 180.0:
            return 100.0 + ((value - 80.0) * 100.0) / 100.0
        elif value <= 280.0:
            return 200.0 + ((value - 180.0) * 100.0) / 100.0
        elif value <= 400.0:
            return 300.0 + ((value - 280.0) * 100.0) / 120.0
        else:
            return 400.0 + ((value - 400.0) * 100.0) / 120.0

    def calculate_co_subindex(value):
        value = safe_float(value)
        if value is None:
            return None
        ppm = value * 0.873  # Convert mg/m3 to ppm
        if ppm <= 1.0:
            return (ppm * 50.0) / 1.0
        elif ppm <= 2.0:
            return 50.0 + ((ppm - 1.0) * 50.0) / 1.0
        elif ppm <= 10.0:
            return 100.0 + ((ppm - 2.0) * 100.0) / 8.0
        elif ppm <= 17.0:
            return 200.0 + ((ppm - 10.0) * 100.0) / 7.0
        elif ppm <= 34.0:
            return 300.0 + ((ppm - 17.0) * 100.0) / 17.0
        else:
            return 400.0 + ((ppm - 34.0) * 100.0) / 17.0

    def calculate_o3_subindex(value):
        value = safe_float(value)
        if value is None:
            return None
        if value <= 50.0:
            return (value * 50.0) / 50.0
        elif value <= 100.0:
            return 50.0 + ((value - 50.0) * 50.0) / 50.0
        elif value <= 168.0:
            return 100.0 + ((value - 100.0) * 100.0) / 68.0
        elif value <= 208.0:
            return 200.0 + ((value - 168.0) * 100.0) / 40.0
        elif value <= 748.0:
            return 300.0 + ((value - 208.0) * 100.0) / 540.0
        else:
            return 400.0 + ((value - 748.0) * 100.0) / 540.0

    def calculate_nh3_subindex(value):
        value = safe_float(value)
        if value is None:
            return None
        if value <= 200.0:
            return (value * 50.0) / 200.0
        elif value <= 400.0:
            return 50.0 + ((value - 200.0) * 50.0) / 200.0
        elif value <= 800.0:
            return 100.0 + ((value - 400.0) * 100.0) / 400.0
        elif value <= 1200.0:
            return 200.0 + ((value - 800.0) * 100.0) / 400.0
        elif value <= 1800.0:
            return 300.0 + ((value - 1200.0) * 100.0) / 600.0
        else:
            return 400.0 + ((value - 1800.0) * 100.0) / 600.0

    # Convert all average values to float before calculation
    safe_averages = {k: safe_float(v) for k, v in averages.items()}
    # Calculate sub-indices for each parameter
    sub_indices = {
        'pm25': calculate_pm25_subindex(safe_averages.get('pm25')),
        'pm10': calculate_pm10_subindex(safe_averages.get('pm10')),
        'so2': calculate_so2_subindex(safe_averages.get('so2')),
        'no2': calculate_no2_subindex(safe_averages.get('no2')),
        'co': calculate_co_subindex(safe_averages.get('co')),
        'o3': calculate_o3_subindex(safe_averages.get('o3')),
        'nh3': calculate_nh3_subindex(safe_averages.get('nh3'))
    }


    return sub_indices

def get_aqi_status(aqi):
    """Returns AQI category based on value."""
    if aqi <= 50:
        return "Good"
    elif aqi <= 100:
        return "Moderate"
    elif aqi <= 150:
        return "Unhealthy"
    elif aqi <= 200:
        return "Severe"
    elif aqi <= 300:
        return "Very Severe"
    return "Hazardous"


def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    lat1, lon1 = radians(float(lat1)) if lat1 else 0, radians(float(lon1)) if lon1 else 0
    lat2, lon2 = radians(float(lat2)) if lat2 else 0, radians(float(lon2)) if lon2 else 0

    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return 6371 * c  # Earth's radius in kilometers


def determine_nearest_station(user_lat, user_lon):
    """Determine which station is closest to the user's location"""
    if not user_lat or not user_lon:
        return "lora-v1"  # Default to first station if no location

    # Define station locations (replace with your actual station coordinates)
    stations = {
        "lora-v1": {"lat": 10.1784807896795, "lon": 76.43041508111203},  # Replace with actual coordinates
        "loradev2": {"lat": 10.17095090340159, "lon": 76.42962876824544}  # Replace with actual coordinates
    }

    # Calculate distances to each station
    distances = {station_id: calculate_distance(user_lat, user_lon, location["lat"], location["lon"])
                 for station_id, location in stations.items()}

    # Return ID of the closest station
    return min(distances, key=distances.get)


def should_use_interpolation(user_lat, user_lon):
    """Determine if interpolation should be used based on user location"""
    if not user_lat or not user_lon:
        return False

    # Define station locations
    stations = {
        "lora-v1": {"lat": 10.1784807896795, "lon": 76.43041508111203},  # Replace with actual coordinates
        "loradev2": {"lat": 10.17095090340159, "lon": 76.42962876824544}  # Replace with actual coordinates
    }

    # Calculate distances to each station
    distance_v1 = calculate_distance(user_lat, user_lon, stations["lora-v1"]["lat"], stations["lora-v1"]["lon"])
    distance_v2 = calculate_distance(user_lat, user_lon, stations["loradev2"]["lat"], stations["loradev2"]["lon"])

    # If user is roughly between stations, use interpolation
    distance_ratio = min(distance_v1, distance_v2) / max(distance_v1, distance_v2)
    return distance_ratio >= 0.6  # Adjust threshold as needed


def interpolate_station_data(items_v1, items_v2, user_lat, user_lon):
    """Interpolate data between two stations based on user's position"""
    if not user_lat or not user_lon or not items_v1 or not items_v2:
        return items_v1 or items_v2 or []

    # Define station locations
    stations = {
        "lora-v1": {"lat": 10.1784807896795, "lon": 76.43041508111203},  # Replace with actual coordinates
        "loradev2": {"lat": 10.17095090340159, "lon": 76.42962876824544}  # Replace with actual coordinates
    }

    # Calculate distances and weights
    distance_v1 = calculate_distance(user_lat, user_lon, stations["lora-v1"]["lat"], stations["lora-v1"]["lon"])
    distance_v2 = calculate_distance(user_lat, user_lon, stations["loradev2"]["lat"], stations["loradev2"]["lon"])

    # Calculate weights (inverse distance weighting)
    total_distance = distance_v1 + distance_v2
    weight_v1 = (1 - (distance_v1 / total_distance)) / (
                (1 - (distance_v1 / total_distance)) + (1 - (distance_v2 / total_distance)))
    weight_v2 = 1 - weight_v1

    # Sort items by timestamp
    items_v1.sort(key=lambda x: x.get('received_at', ''))
    items_v2.sort(key=lambda x: x.get('received_at', ''))

    # Create lookup for v2 items
    v2_by_timestamp = {item.get('received_at', ''): item for item in items_v2}

    # Create interpolated items
    interpolated_items = []

    for item_v1 in items_v1:
        timestamp = item_v1.get('received_at', '')
        item_v2 = v2_by_timestamp.get(timestamp)

        if not item_v2:
            interpolated_items.append(item_v1.copy())
            continue

        # Get parsed payloads for both items
        payload_v1 = parse_payload(item_v1.get('payload', ''))
        payload_v2 = parse_payload(item_v2.get('payload', ''))

        # Interpolate each parameter
        interpolated_payload = {}

        for param in ['co', 'nh3', 'no2', 'o3', 'pm25', 'pm10', 'so2', 'hum', 'pre', 'temp']:
            value_v1 = payload_v1.get(param)
            value_v2 = payload_v2.get(param)

            if value_v1 is not None and value_v2 is not None:
                interpolated_payload[param] = (value_v1 * weight_v1) + (value_v2 * weight_v2)
            elif value_v1 is not None:
                interpolated_payload[param] = value_v1
            elif value_v2 is not None:
                interpolated_payload[param] = value_v2

        interpolated_payload['date'] = payload_v1.get('date') or payload_v2.get('date')

        interpolated_items.append({
            'received_at': timestamp,
            'payload': json.dumps(interpolated_payload)
        })

    return interpolated_items
def risk_assessment(request, username=None):
    username = username or request.session.get('name')

    if not username:
        return redirect('signup')

    try:
        health_assessment = HealthAssessment.objects.get(username=username)

        # Get user's location coordinates
        lora_v1_items = get_device_data("lora-v1")
        loradev2_items = get_device_data("loradev2")

        # Helper function to process data
        def process_items(items):
            if not items:
                return None, {}, {}, None

            # Parse payloads
            for item in items:
                parsed_payload = parse_payload(item['payload'])
                item.update({
                    'co': parsed_payload.get('co'),
                    'nh3': parsed_payload.get('nh3'),
                    'no2': parsed_payload.get('no2'),
                    'o3': parsed_payload.get('o3'),
                    'pm25': parsed_payload.get('pm25'),
                    'pm10': parsed_payload.get('pm10'),
                    'so2': parsed_payload.get('so2'),
                    'hum': parsed_payload.get('hum'),
                    'date': parsed_payload.get('date'),
                    'time': parsed_payload.get('time'),
                })

            # Sort items by received time (descending)
            items.sort(
                key=lambda x: datetime.strptime(
                    truncate_nanoseconds(x['received_at']).strip(),
                    '%Y-%m-%dT%H:%M:%S.%fZ'
                ),
                reverse=True
            )

            latest_24_items = items[:24]  # Get the latest 24 items

            # Compute averages
            parameters = ['nh3', 'o3', 'pm25', 'pm10', 'co', 'so2', 'no2']
            sums = {param: 0 for param in parameters}
            counts = {param: 0 for param in parameters}

            for item in latest_24_items:
                parsed_payload = parse_payload(item['payload'])
                for param in parameters:
                    value = parsed_payload.get(param)
                    if value is not None:
                        sums[param] += value
                        counts[param] += 1

            # Calculate averages
            averages = {
                param: (sums[param] / counts[param]) if counts[param] > 0 else None
                for param in parameters
            }

            # Calculate sub-indices
            sub_indices = calculate_subindices(averages)

            # Get the highest sub-index
            valid_indices = [index for index in sub_indices.values() if index is not None]
            highest_sub_index = round(max(valid_indices)) if valid_indices else None

            # Get the latest item
            latest_item = latest_24_items[0] if latest_24_items else None
            if latest_item:
                received_at = datetime.strptime(
                    truncate_nanoseconds(latest_item['received_at']).strip(),
                    '%Y-%m-%dT%H:%M:%S.%fZ'
                )
                latest_item['received_at'] = received_at.strftime('%Y-%m-%d %H:%M:%S')

            return latest_item, averages, sub_indices, highest_sub_index

        # Process both datasets
        latest_lora_v1, avg_lora_v1, subindices_lora_v1, high_index_lora_v1 = process_items(lora_v1_items)
        latest_loradev2, avg_loradev2, subindices_loradev2, high_index_loradev2 = process_items(loradev2_items)

        # Fetch S3 Forecast Data
        try:
            # Initialize S3 client
            s3 = boto3.client('s3')

            # Get forecast file
            response = s3.get_object(Bucket='ai-model-bucket-output', Key='data/air_quality/latest_forecast.json')
            s3_forecast_data = json.loads(response['Body'].read().decode('utf-8'))

            # Transform forecast data
            forecast_data = []
            for i, date in enumerate(s3_forecast_data['dates']):
                entry = {"day": date}
                for gas, data in s3_forecast_data['gases'].items():
                    param_name = gas.lower().replace(".", "")
                    entry[f"{param_name}_max"] = round(data['values'][i], 2)
                forecast_data.append(entry)

            forecast_updated_at = s3_forecast_data.get('updated_at')
        except Exception as e:
            print(f"Error fetching S3 forecast data: {e}")
            forecast_data = []
            forecast_updated_at = None

        aqi_parameters = ['nh3', 'no2', 'o3', 'pm25', 'pm10', 'so2', 'co']

        # Return data as JSON if it's an AJAX request
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'lora_v1': {
                    'latest_item': latest_lora_v1,
                    'averages': avg_lora_v1,
                    'sub_indices': {k: round(v, 2) if v is not None else None for k, v in subindices_lora_v1.items()},
                    'highest_sub_index': high_index_lora_v1
                },
                'loradev2': {
                    'latest_item': latest_loradev2,
                    'averages': avg_loradev2,
                    'sub_indices': {k: round(v, 2) if v is not None else None for k, v in subindices_loradev2.items()},
                    'highest_sub_index': high_index_loradev2
                },
                'forecast_data': forecast_data,
                'forecast_updated_at': forecast_updated_at
            })

        # Otherwise render the template
        return render(request, 'Userprofile.html', {
            "username": username,
            "health_assessment": health_assessment,
            "health_score": health_assessment.health_score,
            "aqi_parameters": aqi_parameters,
            'lora_v1': latest_lora_v1,
            'loradev2': latest_loradev2,
            'high_index_lora_v1': high_index_lora_v1,
            'high_index_loradev2': high_index_loradev2,
            'forecast_data': forecast_data,
            'forecast_updated_at': forecast_updated_at
        })
    except HealthAssessment.DoesNotExist:
        return redirect('signup')
    except Exception as e:
        print(f"Error: {e}")
        return JsonResponse({'error': str(e)}, status=500)


# URL pattern you should add to your urls.py:
#

def health_questions(request, username):


    # Check if the user already has a health assessment entry
    try:
        assessments = HealthAssessment.objects.filter(username=username)

        if assessments.count() > 1:
            # Handle multiple assessments, e.g., take the latest one or merge them
            existing_assessment = assessments.latest('id')  # This assumes there's a field 'id' that increments
        elif assessments.count() == 1:
            existing_assessment = assessments.first()
        else:
            existing_assessment = None

        # If the method is POST, handle the form submission
        if request.method == 'POST':
            # If there's an existing assessment, update it
            if existing_assessment:
                age_group = request.POST.get('age_group', None)
                gender = request.POST.get('gender', None)
                respiratory_conditions = request.POST.getlist('respiratory_conditions')
                smoking_history = request.POST.getlist('smoking_history')
                living_environment = request.POST.getlist('living_environment')
                common_symptoms = request.POST.getlist('common_symptoms')
                occupational_exposure = request.POST.get('occupational_exposure', '')
                medical_history = request.POST.getlist('medical_history')

                # Update the existing assessment
                existing_assessment.age_group = age_group
                existing_assessment.gender = gender
                existing_assessment.respiratory_conditions = respiratory_conditions
                existing_assessment.smoking_history = smoking_history
                existing_assessment.living_environment = living_environment
                existing_assessment.common_symptoms = common_symptoms
                existing_assessment.occupational_exposure = occupational_exposure
                existing_assessment.medical_history = medical_history
                existing_assessment.save()

                # Recalculate the score and save
                score = calculate_health_score(request)
                existing_assessment.health_score = score
                existing_assessment.save()

                return render(request, 'health_questions.html', {
                    "username": username,
                    "health_score": score,
                    "existing_assessment": existing_assessment
                })

            else:
                # If no existing assessment, create a new one
                age_group = request.POST.get('age_group', None)
                gender = request.POST.get('gender', None)
                respiratory_conditions = request.POST.getlist('respiratory_conditions')
                smoking_history = request.POST.getlist('smoking_history')
                living_environment = request.POST.getlist('living_environment')
                common_symptoms = request.POST.getlist('common_symptoms')
                occupational_exposure = request.POST.get('occupational_exposure', '')
                medical_history = request.POST.getlist('medical_history')

                # Create new health assessment entry
                HealthAssessment.objects.create(
                    username=username,
                    age_group=age_group,
                    gender=gender,
                    respiratory_conditions=respiratory_conditions,
                    smoking_history=smoking_history,
                    living_environment=living_environment,
                    common_symptoms=common_symptoms,
                    occupational_exposure=occupational_exposure,
                    medical_history=medical_history,
                    health_score=calculate_health_score(request)
                )

                # Recalculate the score
                score = calculate_health_score(request)
                return render(request, 'health_questions.html', {
                    "username": username,
                    "health_score": score
                })

        # If the method is GET, render the page with existing data if present
        if existing_assessment:
            return render(request, 'health_questions.html', {
                "username": username,
                "health_score": existing_assessment.health_score,
                "existing_assessment": existing_assessment
            })
        else:
            # If there's no existing assessment, render the empty form
            return render(request, 'health_questions.html', {
                "username": username,
                "health_score": 0  # Start with 0 if no health assessment is available
            })

    except Exception as e:
        return HttpResponse(f"Error: {str(e)}", status=500)

def calculate_health_score(request):
    score = 0

    # 1. Age Group
    age_group = request.POST.get('age_group')
    if age_group == "0-12 years":
        score += 5
    elif age_group == "13-18 years":
        score += 8
    elif age_group == "19-40 years":
        score += 10
    elif age_group == "41-60 years":
        score += 15
    elif age_group == "61 years and above":
        score += 20

    # 2. Gender
    gender = request.POST.get('gender')
    score += 2 if gender == "Male" else 1

    # 3. Respiratory Conditions
    respiratory_conditions = request.POST.getlist('respiratory_conditions')
    if "None" not in respiratory_conditions:
        score += len(respiratory_conditions) * 3

    # 4. Smoking History
    smoking = request.POST.get('smoking_history')
    smoking_scores = {
        "Never smoked": 0,
        "Former smoker": 10,
        "Current smoker": 25,
        "Exposed to secondhand smoke": 8
    }
    score += smoking_scores.get(smoking, 0)

    # 5. Living Environment
    living_env = request.POST.getlist('living_environment')
    environment_scores = {
        "Urban area": 10,
        "Industrial zone": 15,
        "Rural area": 3,
        "Coastal area": 2
    }
    for env in living_env:
        score += environment_scores.get(env, 0)

    # 6. Common Symptoms
    symptoms = request.POST.getlist('common_symptoms')
    symptom_scores = {
        "Frequent coughing": 8,
        "Shortness of breath": 10,
        "Wheezing": 8,
        "Chest tightness": 9
    }
    for symptom in symptoms:
        score += symptom_scores.get(symptom, 0)

    # 7. Occupational Exposure
    occupation = request.POST.get('occupational_exposure')
    occupation_scores = {
        "Construction/Mining": 15,
        "Chemical Industry": 15,
        "Healthcare": 8,
        "Agriculture": 10,
        "Office Environment": 3,
        "Other": 5
    }
    score += occupation_scores.get(occupation, 0)

    # 8. Medical History
    medical_history = request.POST.getlist('medical_history')
    condition_scores = {
        "Hypertension": 8,
        "Diabetes": 8,
        "Heart Disease": 10,
        "Allergies": 5,
        "Immunocompromised": 12
    }
    for condition in medical_history:
        score += condition_scores.get(condition, 0)

    return score

def calculate_health_score_from_existing(existing_assessment):
    # Logic to calculate score from existing health assessment
    score = 0
    # You would use the fields of `existing_assessment` to calculate the score as you did in `calculate_health_score`.
    return score
@csrf_exempt  # Only use this if absolutely necessary, or else remove it.
def signup(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        phone_number = request.POST.get('phone_number')
        # Phone number validation
        phone_pattern = re.compile(r'^\+\d{1,3}\d{9,14}$')  # Example: +123456789012
        if not phone_pattern.match(phone_number):
            return HttpResponse('Invalid phone number format. Use format: +CountryCodeNumber', status=400)

        # Check if the phone number is already in use
        if User.objects.filter(phone_number=phone_number).exists():
            return HttpResponse('Phone number already registered', status=400)

        # Create and save the new user
        user = User.objects.create(name=name, phone_number=phone_number)
        user.save()

        # Redirect to login page after successful signup
        return redirect('login')  # Ensure 'login' matches the name of your login URL

    # If the request is GET, render the signup form
    return render(request, 'signup.html')


def user_login(request):  # Rename the function to avoid conflict
    if request.method == 'POST':
        phone_number = request.POST.get('phone_number')
        user = authenticate(request, phone_number=phone_number)

        # Create record in your login model
        user1 = login.objects.create(phone_number=phone_number)
        user1.save()

        if user is not None:
            auth_login(request, user)  # Use the renamed import
            messages.success(request, 'Logged in Successfully!')
            return redirect('home')  # Use string name instead of function reference
        else:
            messages.error(request, 'Invalid Credentials!')
            return redirect('user_login')  # Use the view's name in URL pattern

    return render(request, 'login.html')


load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
VERIFY_SERVICE_SID = os.getenv('VERIFY_SERVICE_SID')
DEFAULT_OTP = os.getenv('DEFAULT_OTP', '123456')  # fallback

client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


@csrf_exempt
def send_otp(request):
    if request.method == 'POST':
        phone_number = request.POST.get('phone_number')

        # Check if the phone number exists in the User model
        if User.objects.filter(phone_number=phone_number).exists():
            # Store the phone number in the session
            request.session['phone_number'] = phone_number

            # Try to send OTP via Twilio first
            twilio_success = False
            try:
                # Attempt to send a real OTP via Twilio
                verification = client.verify \
                    .services(VERIFY_SERVICE_SID) \
                    .verifications \
                    .create(to=phone_number, channel='sms')
                twilio_success = True
            except Exception as e:
                # If Twilio fails, log the error but continue
                print(f"Twilio OTP sending failed: {str(e)}")
                twilio_success = False

            # Store in login model
            try:
                otp_record, created = login.objects.get_or_create(phone_number=phone_number)
                otp_record.otp_code = DEFAULT_OTP  # Always store default OTP as backup
                otp_record.otp_verified = False
                otp_record.save()
            except Exception as e:
                print(f"Error updating login record: {str(e)}")

            # Redirect to verification page regardless of Twilio success
            return redirect('verify_otp')
        else:
            # Phone number not found in the User model
            return HttpResponse('Phone number not registered.', status=400)

    return render(request, 'login.html')


@csrf_exempt
def verify_otp(request):
    if request.method == 'POST':
        otp_code = request.POST.get('otp_code')
        phone_number = request.session.get('phone_number')

        if not otp_code:
            return HttpResponse('OTP code is missing.', status=400)

        # Verification succeeds if either:
        # 1. The code matches our default OTP
        # 2. The code is verified by Twilio
        verified = False

        # Check against default OTP first
        if otp_code == DEFAULT_OTP:
            verified = True
        else:
            # If not default OTP, try Twilio verification
            try:
                verification_check = client.verify \
                    .services(VERIFY_SERVICE_SID) \
                    .verification_checks \
                    .create(to=phone_number, code=otp_code)

                verified = verification_check.status == "approved"
            except Exception as e:
                # If Twilio check fails, user can still use DEFAULT_OTP
                print(f"Twilio verification failed: {str(e)}")
                verified = False

        if verified:
            # OTP is verified (either default or Twilio)
            request.session['otp_verified'] = True

            try:
                user = User.objects.get(phone_number=phone_number)
                request.session['name'] = user.name

                # Update login model
                try:
                    otp_record = login.objects.get(phone_number=phone_number)
                    otp_record.otp_verified = True
                    otp_record.save()
                except Exception as e:
                    print(f"Error updating login verification status: {str(e)}")

                # Check if user completed health assessment
                if not HealthAssessment.objects.filter(username=user).exists():
                    return redirect('health_questions', username=user.name)
                else:
                    return redirect('risk_assessment')
            except User.DoesNotExist:
                return HttpResponse('User with this phone number does not exist', status=400)
        else:
            # Both default OTP and Twilio verification failed
            return HttpResponse('OTP verification failed', status=400)

    # Handle GET request - render the OTP verification page
    return render(request, 'otp_verification.html')


def logout(request):
    # Clear the session on logout
    request.session.flush()  # Removes all session data
    return redirect('home')


def admin_logout(request):
    # Clear the session on logout
    request.session.flush()  # Removes all session data
    return redirect('admin_login')




# Redirect to the login page after logging


def AQI_forecast(request):
    items = get_device_data("lora-v1")
    for item in items:
        parsed_payload = parse_payload(item['payload'])
        item['aqi'] = parsed_payload.get('aqi', None)
        item['pm25'] = parsed_payload.get('pm25', None)
        item['pm10'] = parsed_payload.get('pm10', None)
        item['no2'] = parsed_payload.get('no2', None)
        item['co'] = parsed_payload.get('co', None)
        item['o3'] = parsed_payload.get('o3', None)

    items.sort(key=lambda x: datetime.strptime(truncate_nanoseconds(x['received_at']).strip(), '%Y-%m-%dT%H:%M:%S.%fZ'),
               reverse=True)
    latest_item = items[0] if items else None

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'latest_item': latest_item})

    return render(request, 'AQI_forecast.html', {'latest_item': latest_item})



"""def user_login(request):
    if request.user.is_authenticated:
                 # Check if health questionnaire is completed
            if not user.is_health_questionnaire_completed:  # Assuming this is a boolean field in the User model
                # If not completed, redirect to the health questionnaire page
                return redirect('health_questionnaire')
            else:
                # If completed, redirect to the home page (dashboard)
                return redirect('home')
    else:
            # If login fails, show an error message
            messages.error(request, "Invalid phone number or password")"""



    # Render the login page for GET request or after an invalid login attempt

"""

config={
    "apiKey": "AIzaSyC6S6gIlQCPtPs0QQDT_EHYGekLX_BPTAg",
    "authDomain": "lora-5c160.firebaseapp.com",
    "databaseURL": "https://lora-5c160-default-rtdb.asia-southeast1.firebasedatabase.app",
    "projectId": "lora-5c160",
    "storageBucket": "lora-5c160.appspot.com",
    "messagingSenderId": "691553667840",
    "appId": "1:691553667840:web:2babf8f9f020434fb401e5"
}
firebase =pyrebase.initialize_app(config)
authe =firebase.auth()
database=firebase.database()
"""

def admin_view(request):
    # Existing logic to get the latest sensor data
    items = get_device_data("lora-v1")
    for item in items:
        parsed_payload = parse_payload(item['payload'])
        item.update({
            'co': parsed_payload.get('co'),
            'nh3': parsed_payload.get('nh3'),
            'no2': parsed_payload.get('no2'),
            'o3': parsed_payload.get('o3'),
            'pm25': parsed_payload.get('pm25'),
            'pm10': parsed_payload.get('pm10'),
            'so2': parsed_payload.get('so2'),
            'hum': parsed_payload.get('hum'),
            'temp':parsed_payload.get('temp'),
            'pre':parsed_payload.get('pre'),
            'date': parsed_payload.get('date'),
            'time': parsed_payload.get('time'),
        })

    # Check if items are available
    if not items:
        return JsonResponse({'error': 'No data available'}, status=400)

    # Sort items by date
    items.sort(
        key=lambda x: datetime.strptime(
            truncate_nanoseconds(x['received_at']).strip(),
            '%Y-%m-%dT%H:%M:%S.%fZ'
        ),
        reverse=True
    )

    latest_24_items = items[:24]  # Get the latest 24 items

    # Initialize sum and count for averaging
    parameters = ['nh3', 'no2', 'o3', 'pm25', 'pm10', 'so2', 'co']
    sums = {param: 0 for param in parameters}
    counts = {param: 0 for param in parameters}

    # Compute sums and counts
    for item in latest_24_items:
        parsed_payload = parse_payload(item['payload'])
        for param in parameters:
            value = parsed_payload.get(param)
            if value is not None:
                sums[param] += value
                counts[param] += 1

    # Calculate averages
    averages = {
        param: (sums[param] / counts[param]) if counts[param] > 0 else None
        for param in parameters
    }
    print("averages", averages)

    # Calculate sub-indices
    sub_indices = calculate_subindices(averages)

    print("sub_indices", sub_indices)

    # Get the highest sub-index
    valid_indices = [index for index in sub_indices.values() if index is not None]
    highest_sub_index = round(max(valid_indices)) if valid_indices else None
    print(highest_sub_index)

    # Get the latest item for display
    latest_item = latest_24_items[0] if latest_24_items else None

    if latest_item:
        received_at = datetime.strptime(
            truncate_nanoseconds(latest_item['received_at']).strip(),
            '%Y-%m-%dT%H:%M:%S.%fZ'
        )
        latest_item['received_at'] = received_at.strftime('%Y-%m-%d %H:%M:%S')

    # Return JSON for AJAX requests
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({
            'latest_item': latest_item,
            'averages': averages,
            'sub_indices': {k: round(v, 2) if v is not None else None for k, v in sub_indices.items()},
            'highest_sub_index': highest_sub_index
        })

    return render(request, 'admin.html', {
        "latest_item": latest_item,
        "averages": averages,
        "sub_indices": {k: round(v, 2) if v is not None else None for k, v in sub_indices.items()},
        "highest_sub_index": highest_sub_index
    })


@cache_page(60 * 5)  # Cache for 5 minutes
@gzip_page
@ensure_csrf_cookie
@ensure_csrf_cookie
def map_view(request):
    # Fetch data for both devices
    lora_v1_items = get_device_data("lora-v1")
    loradev2_items = get_device_data("loradev2")

    # Helper function to process data
    def process_items(items):
        if not items:
            return None, {}, {}, None

        # Parse payloads
        for item in items:
            parsed_payload = parse_payload(item['payload'])
            item.update({
                'co': parsed_payload.get('co'),
                'nh3': parsed_payload.get('nh3'),
                'no2': parsed_payload.get('no2'),
                'o3': parsed_payload.get('o3'),
                'pm25': parsed_payload.get('pm25'),
                'pm10': parsed_payload.get('pm10'),
                'so2': parsed_payload.get('so2'),
                'hum': parsed_payload.get('hum'),
                'date': parsed_payload.get('date'),
                'time': parsed_payload.get('time'),
            })

        # Sort items by received time (descending)
        items.sort(
            key=lambda x: datetime.strptime(
                truncate_nanoseconds(x['received_at']).strip(),
                '%Y-%m-%dT%H:%M:%S.%fZ'
            ),
            reverse=True
        )

        latest_24_items = items[:24]  # Get the latest 24 items

        # Compute averages
        parameters = ['nh3', 'o3', 'pm25', 'pm10', 'co','so2','no2']
        parameters = ['nh3', 'o3', 'pm25', 'pm10', 'co','so2','no2']
        sums = {param: 0 for param in parameters}
        counts = {param: 0 for param in parameters}

        for item in latest_24_items:
            parsed_payload = parse_payload(item['payload'])
            for param in parameters:
                value = parsed_payload.get(param)
                if value is not None:
                    sums[param] += value
                    counts[param] += 1

        # Calculate averages
        averages = {
            param: (sums[param] / counts[param]) if counts[param] > 0 else None
            for param in parameters
        }

        # Calculate sub-indices
        sub_indices = calculate_subindices(averages)

        # Get the highest sub-index
        valid_indices = [index for index in sub_indices.values() if index is not None]
        highest_sub_index = round(max(valid_indices)) if valid_indices else None

        # Get the latest item
        latest_item = latest_24_items[0] if latest_24_items else None
        if latest_item:
            received_at = datetime.strptime(
                truncate_nanoseconds(latest_item['received_at']).strip(),
                '%Y-%m-%dT%H:%M:%S.%fZ'
            )
            latest_item['received_at'] = received_at.strftime('%Y-%m-%d %H:%M:%S')

        return latest_item, averages, sub_indices, highest_sub_index

    # Process both datasets
    latest_lora_v1, avg_lora_v1, subindices_lora_v1, high_index_lora_v1 = process_items(lora_v1_items)
    latest_loradev2, avg_loradev2, subindices_loradev2, high_index_loradev2 = process_items(loradev2_items)

    # Fetch forecast data from S3
    forecast_data = []
    forecast_updated_at = None
    try:
        # Initialize S3 client
        s3 = boto3.client('s3')

        # Get forecast file
        response = s3.get_object(Bucket='ai-model-bucket-output', Key='data/air_quality/latest_forecast.json')
        s3_forecast_data = json.loads(response['Body'].read().decode('utf-8'))

        # Transform forecast data
        forecast_data = []
        for i, date in enumerate(s3_forecast_data['dates']):
            entry = {"day": date}
            for gas, data in s3_forecast_data['gases'].items():
                param_name = gas.lower().replace(".", "")
                entry[f"{param_name}_max"] = round(data['values'][i], 2)
            forecast_data.append(entry)

        forecast_updated_at = s3_forecast_data.get('updated_at')
    except Exception as e:
        print(f"Error fetching S3 forecast data: {e}")
        forecast_data = []
        forecast_updated_at = None

    # Return JSON for AJAX requests
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({
            'lora_v1': {
                'latest_item': latest_lora_v1,
                'averages': avg_lora_v1,
                'sub_indices': {k: round(v, 2) if v is not None else None for k, v in subindices_lora_v1.items()},
                'highest_sub_index': high_index_lora_v1
            },
            'loradev2': {
                'latest_item': latest_loradev2,
                'averages': avg_loradev2,
                'sub_indices': {k: round(v, 2) if v is not None else None for k, v in subindices_loradev2.items()},
                'highest_sub_index': high_index_loradev2
            },
            'forecast_data': forecast_data,
            'forecast_updated_at': forecast_updated_at
        })

    # Render the map page with all datasets
    return render(request, 'map.html', {
        'lora_v1': latest_lora_v1,
        'loradev2': latest_loradev2,
        'high_index_lora_v1': high_index_lora_v1,
        'high_index_loradev2': high_index_loradev2,
        'forecast_data': forecast_data,
        'forecast_updated_at': forecast_updated_at
    })

#def map_view(request):
 #   csv_data = load_csv_data()
  #  return render(request, 'map.html', {'locations': csv_data})


def list_all_data(request):
    """View to list all items in the DynamoDB table."""
    items = get_all_items()

    # Parse payload for better readability
    for item in items:
        item['payload'] = parse_payload(item['payload'])

    # Sort the items by 'received_at' to get the latest data
    items.sort(key=lambda x: datetime.strptime(truncate_nanoseconds(x['received_at']).strip(), '%Y-%m-%dT%H:%M:%S.%fZ'),
               reverse=True)

    # Get only the latest item
    latest_item = items[0] if items else None

    return JsonResponse({'data': latest_item})


def truncate_nanoseconds(timestamp):
    """Truncate nanoseconds to microseconds for correct parsing."""
    # Split at the dot and keep the first 6 digits of microseconds
    parts = timestamp.split('T')
    date_part = parts[0]
    time_part = parts[1]
    time_parts = time_part.split('Z')[0]  # Remove 'Z'

    # Truncate nanoseconds to 6 digits (microseconds)
    if '.' in time_parts:
        time_parts = time_parts[:time_parts.index('.') + 7]  # Keep first 6 digits of microseconds

    return f'{date_part}T{time_parts}Z'

def get_data_by_device(request, device_id):
    """View to get data by device ID."""
    items = get_device_data(device_id)
    for item in items:
        item['payload'] = parse_payload(item['payload'])
    return JsonResponse({'data': items})

def decimal_default(obj):
    """Convert Decimal to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {obj} not serializable")

def display_all_data(request):
    # Retrieve all items
    items = get_all_items()

    for item in items:
        parsed_payload = parse_payload(item['payload'])
        item['aqi'] = parsed_payload.get('aqi', None)
        item['co'] = parsed_payload.get('co', None)
        item['nh3'] = parsed_payload.get('nh3', None)
        item['no2'] = parsed_payload.get('no2', None)
        item['o3'] = parsed_payload.get('o3', None)
        item['pm25'] = parsed_payload.get('pm25', None)

    items.sort(key=lambda x: datetime.strptime(truncate_nanoseconds(x['received_at']).strip(), '%Y-%m-%dT%H:%M:%S.%fZ'), reverse=True)
    latest_item = items[0] if items else None

    # Return JSON for AJAX requests
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'latest_item': latest_item})

    # Render the page for non-AJAX requests
    return render(request, 'test.html', {'latest_item': latest_item})


def health_report(request):
    try:
        username = request.session.get('name')
        if not username and not request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return redirect('home')

        # Retrieve latest health assessment (not needed for AJAX responses)
        if not request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            latest_assessment = HealthAssessment.objects.filter(username=username).latest('id')

        # Fetch AQI data
        items = get_device_data("lora-v1")
        if not items:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'error': 'No real-time air quality data available.'
                })
            return render(request, 'Health_report.html', {
                "username": username,
                "alert_message": "No real-time air quality data available.",
            })

        # Process items (similar to map_view.txt)
        for item in items:
            parsed_payload = parse_payload(item['payload'])
            item.update(parsed_payload)

        # Fix datetime parsing to match map_view.txt pattern
        def truncate_nanoseconds(timestamp):
            # If the timestamp has more than 6 digits after the decimal point, truncate it
            if '.' in timestamp:
                parts = timestamp.split('.')
                if len(parts) > 1 and len(parts[1]) > 6:
                    return parts[0] + '.' + parts[1][:6] + 'Z'
            return timestamp

        # Sort items properly
        items.sort(
            key=lambda x: datetime.strptime(
                truncate_nanoseconds(x['received_at']).strip(),
                '%Y-%m-%dT%H:%M:%S.%fZ'
            ),
            reverse=True
        )

        latest_item = items[0] if items else None

        if not latest_item:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'error': 'No recent AQI data available.'
                })
            return render(request, 'Health_report.html',
                          {"username": username, "alert_message": "No recent AQI data available."})

        # Extract AQI data
        co_level, nh3_level, no2_level, o3_level = latest_item['co'], latest_item['nh3'], latest_item['no2'], \
        latest_item['o3']
        pm25_level, pm10_level, so2_level = latest_item['pm25'], latest_item['pm10'], latest_item['so2']

        aqi_data = {
            "co_level": co_level,
            "nh3_level": nh3_level,
            "no2_level": no2_level,
            "o3_level": o3_level,
            "pm25_level": pm25_level,
            "pm10_level": pm10_level,
            "so2_level": so2_level
        }

        # Return JSON for AJAX requests
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            # Get forecast data for AJAX response
            try:
                s3 = boto3.client('s3')
                response = s3.get_object(Bucket='ai-model-bucket-output', Key='data/air_quality/latest_forecast.json')
                s3_forecast_data = json.loads(response['Body'].read().decode('utf-8'))

                forecast_data = []
                for i, date in enumerate(s3_forecast_data['dates']):
                    entry = {"day": date}
                    for gas, data in s3_forecast_data['gases'].items():
                        param_name = gas.lower().replace(".", "")
                        entry[f"{param_name}_max"] = round(data['values'][i], 2)
                    forecast_data.append(entry)
            except Exception as e:
                print(f"Error fetching S3 forecast data: {e}")
                forecast_data = []

            return JsonResponse({
                'aqi_data': aqi_data,
                'forecast_data': forecast_data,
                'last_updated': datetime.now().strftime('%H:%M:%S')
            })

        # Rest of the code for non-AJAX requests remains the same
        WHO_LIMITS = {"co": 4, "so2": 40, "pm25": 15, "pm10": 45, "no2": 28, "o3": 64, "nh3": 200}
        alerts = []

        respiratory_conditions = latest_assessment.respiratory_conditions
        living_environment = latest_assessment.living_environment
        medical_history = latest_assessment.medical_history
        smoking_history = latest_assessment.smoking_history

        is_smoker = "Current smoker" in smoking_history
        is_industrial_area = "Industrial zone" in living_environment
        has_copd = "COPD" in respiratory_conditions
        has_asthma = "Asthma" in respiratory_conditions

        exceeded_gases = {gas: level for gas, level in {
            "co": co_level, "so2": so2_level, "pm25": pm25_level,
            "pm10": pm10_level, "no2": no2_level, "o3": o3_level, "nh3": nh3_level
        }.items() if level > WHO_LIMITS[gas]}

        def exceeds_limit(pollutant, level):
            threshold = WHO_LIMITS[pollutant]
            if has_copd or has_asthma:
                threshold *= 0.7
            if is_smoker:
                threshold *= 0.8
            if is_industrial_area:
                threshold *= 1.2
            return level > threshold

        if exceeded_gases:
            if has_copd:
                if exceeds_limit("co", co_level):
                    alerts.append(
                        "⚠️ High CO levels detected in your location. COPD patients should stay indoors and use air purifiers.")
                if exceeds_limit("pm25", pm25_level):
                    alerts.append(
                        "⚠️ High PM2.5 levels detected in your location. Wear an N95 mask or avoid outdoor exposure.")
                if exceeds_limit("so2", so2_level):
                    alerts.append("⚠️ Elevated SO₂ levels in your area. Avoid outdoor activities.")

            if has_asthma:
                if exceeds_limit("no2", no2_level):
                    alerts.append("⚠️ Elevated NO₂ levels detected in your location. Avoid high-traffic areas.")
                if exceeds_limit("o3", o3_level):
                    alerts.append("⚠️ High O₃ levels in your area. Stay indoors during peak sunlight hours.")

            if "Urban area" in living_environment and exceeds_limit("co", co_level):
                alerts.append("⚠️ Urban exposure detected. High CO levels in your location may affect lung health.")

            if is_smoker and exceeds_limit("co", co_level):
                alerts.append("⚠️ CO levels in your area are hazardous for smokers. Reduce outdoor exposure.")

            if latest_assessment.occupational_exposure and exceeds_limit("so2", so2_level):
                alerts.append("⚠️ Occupational hazard: Elevated SO₂ levels in your location. Follow safety protocols.")

            if exceeds_limit("pm10", pm10_level):
                alerts.append(
                    "⚠️ High PM10 levels detected in your location. Reduce outdoor activities and wear a mask.")
            if exceeds_limit("nh3", nh3_level):
                alerts.append("⚠️ High NH₃ levels detected in your area. Ensure good indoor ventilation.")

        # 🔽 Added Section: Fetch and process forecast data from S3
        try:
            s3 = boto3.client('s3')
            response = s3.get_object(Bucket='ai-model-bucket-output', Key='data/air_quality/latest_forecast.json')
            s3_forecast_data = json.loads(response['Body'].read().decode('utf-8'))

            forecast_data = []
            for i, date in enumerate(s3_forecast_data['dates']):
                entry = {"day": date}
                for gas, data in s3_forecast_data['gases'].items():
                    param_name = gas.lower().replace(".", "")
                    entry[f"{param_name}_max"] = round(data['values'][i], 2)
                forecast_data.append(entry)

            forecast_updated_at = s3_forecast_data.get('updated_at')
        except Exception as e:
            print(f"Error fetching S3 forecast data: {e}")
            forecast_data = []
            forecast_updated_at = None

        aqi_parameters = ['nh3', 'no2', 'o3', 'pm25', 'pm10', 'so2', 'co']

        radar_data = {
            "Respiratory": {
                "value": len(latest_assessment.respiratory_conditions.split(',')),
                "details": latest_assessment.respiratory_conditions.split(',')
            },
            "Lifestyle": {
                "value": len(latest_assessment.smoking_history.split(',')),
                "details": latest_assessment.smoking_history.split(',')
            },
            "Environmental": {
                "value": len(latest_assessment.living_environment.split(',')),
                "details": latest_assessment.living_environment.split(',')
            },
            "Medical": {
                "value": len(latest_assessment.medical_history.split(',')),
                "details": latest_assessment.medical_history.split(',')
            },
            "Occupational": {
                "value": 1 if latest_assessment.occupational_exposure else 0,
                "details": [latest_assessment.occupational_exposure] if latest_assessment.occupational_exposure else []
            },
            "Age Group": {
                "value": len(latest_assessment.age_group.split(',')) if latest_assessment.age_group else 0,
                "details": latest_assessment.age_group.split(',') if latest_assessment.age_group else []
            },
            "Gender": {
                "value": 1 if latest_assessment.gender else 0,
                "details": [latest_assessment.gender] if latest_assessment.gender else []
            },
            "Symptoms": {
                "value": len(latest_assessment.common_symptoms.split(',')) if latest_assessment.common_symptoms else 0,
                "details": latest_assessment.common_symptoms.split(',') if latest_assessment.common_symptoms else []
            },
        }

        return render(request, 'Health_report.html', {
            "health_score": latest_assessment.health_score,
            "username": username,
            "assessment": latest_assessment,
            "radar_labels": list(radar_data.keys()),
            "radar_values": [item["value"] for item in radar_data.values()],
            "radar_details": {key: item["details"] for key, item in radar_data.items()},
            "alert_message": " | ".join(alerts) if alerts else "✅ No critical alerts detected.",
            "aqi_data": {"co_level": co_level, "nh3_level": nh3_level, "no2_level": no2_level, "o3_level": o3_level, "pm25_level": pm25_level, "pm10_level": pm10_level, "so2_level": so2_level},
            "forecast_data": forecast_data,
            "forecast_updated_at": forecast_updated_at,
            "aqi_parameters": aqi_parameters,
        })


    except HealthAssessment.DoesNotExist:

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'error': 'Health assessment not found'}, status=404)

        return redirect('home')

    except Exception as e:

        print(f"Error: {e}")

        return JsonResponse({'error': str(e)}, status=500)


def fetch_and_store(request):
        """Fetch DynamoDB data and store it in S3"""
        try:
            # Fetch all items from DynamoDB
            data = get_all_items()

            # Store data in S3
            s3_filename = store_data_to_s3(data)

            if s3_filename:
                return JsonResponse({"message": "Data successfully stored in S3", "file": s3_filename})
            else:
                return JsonResponse({"error": "Failed to store data in S3"}, status=500)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


# views.py - Add this to your existing views.py file


def dashboard(request, username=None):
    # Get username from URL or session
    username = username or request.session.get('name')
    if not username:
        return redirect('signup')

    # Fetch forecast data from S3
    try:
        s3 = boto3.client('s3')
        response = s3.get_object(Bucket='ai-model-bucket-output', Key='data/air_quality/latest_forecast.json')
        s3_forecast_data = json.loads(response['Body'].read().decode('utf-8'))

        forecast_data = []
        for i, date in enumerate(s3_forecast_data['dates']):
            entry = {"day": date}
            for gas, data in s3_forecast_data['gases'].items():
                param_name = gas.lower().replace(".", "")
                entry[f"{param_name}_max"] = round(data['values'][i], 2)
            forecast_data.append(entry)

        forecast_updated_at = s3_forecast_data.get('updated_at')
    except Exception as e:
        print(f"Error fetching S3 forecast data: {e}")
        forecast_data = []
        forecast_updated_at = None

    # Render dashboard.html and pass data
    return render(request, 'dashboard.html', {
        "username": username,
        "forecast_data": forecast_data,
        "forecast_updated_at": forecast_updated_at
    })




def get_forecast_data(request):
    """API endpoint to serve the forecast data as JSON."""
    try:
        # Path to the JSON file
        json_file_path = os.path.join(settings.BASE_DIR, 'static', 'data', 'all_forecasts.json')

        # Read the JSON file
        with open(json_file_path, 'r') as file:
            forecast_data = json.load(file)

        return JsonResponse(forecast_data)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)



def api_forecasts(request):
    forecast_data = get_latest_forecasts()
    if not forecast_data:
        return JsonResponse({'error': 'Unable to fetch forecast data'}, status=500)

    return JsonResponse(forecast_data)


@csrf_exempt
@require_GET
def sensor_comparison_view(request):
    """
    View to compare sensor stations and analyze data
    """
    try:
        # Fetch data for both devices
        lora_v1_items = get_device_data("lora-v1")
        loradev2_items = get_device_data("loradev2")

        def process_items(items):
            if not items:
                return {}

            for item in items:
                parsed_payload = parse_payload(item['payload'])
                item.update({
                    'co': parsed_payload.get('co'),
                    'nh3': parsed_payload.get('nh3'),
                    'no2': parsed_payload.get('no2'),
                    'o3': parsed_payload.get('o3'),
                    'pm25': parsed_payload.get('pm25'),
                    'pm10': parsed_payload.get('pm10'),
                    'so2': parsed_payload.get('so2'),
                    'hum': parsed_payload.get('hum'),
                })

            items.sort(
                key=lambda x: datetime.strptime(
                    truncate_nanoseconds(x['received_at']).strip(),
                    '%Y-%m-%dT%H:%M:%S.%fZ'
                ),
                reverse=True
            )

            latest_item = items[0] if items else {}
            return {
                'co': latest_item.get('co'),
                'nh3': latest_item.get('nh3'),
                'no2': latest_item.get('no2'),
                'o3': latest_item.get('o3'),
                'pm25': latest_item.get('pm25'),
                'pm10': latest_item.get('pm10'),
                'so2': latest_item.get('so2'),
                'humidity': latest_item.get('hum'),
                'timestamp': latest_item.get('received_at')
            }

        lora_v1_data = process_items(lora_v1_items)
        loradev2_data = process_items(loradev2_items)

        thresholds = {
            'pm25': {'warning_max': 35, 'critical_max': 55},
            'pm10': {'warning_max': 50, 'critical_max': 100},
            'so2': {'warning_max': 20, 'critical_max': 40},
            'o3': {'warning_max': 100, 'critical_max': 150},
            'co': {'warning_max': 4.0, 'critical_max': 6.0},
            'no2': {'warning_max': 40, 'critical_max': 80},
            'nh3': {'warning_max': 50, 'critical_max': 100}
        }

        comparison_results = {
            'stations': {
                'lora-v1': lora_v1_data,
                'loradev2': loradev2_data
            },
            'threshold_violations': [],
            'overall_status': 'NORMAL'
        }

        for param, threshold in thresholds.items():
            stations_to_compare = [
                ('lora-v1', lora_v1_data.get(param)),
                ('loradev2', loradev2_data.get(param))
            ]

            for station_name, value in stations_to_compare:
                if value is None:
                    continue

                violation = None
                if value > threshold['critical_max']:
                    violation = {
                        'station': station_name,
                        'parameter': param,
                        'value': value,
                        'status': 'CRITICAL',
                        'threshold': threshold['critical_max']
                    }
                    comparison_results['overall_status'] = 'CRITICAL'
                elif value > threshold['warning_max']:
                    violation = {
                        'station': station_name,
                        'parameter': param,
                        'value': value,
                        'status': 'WARNING',
                        'threshold': threshold['warning_max']
                    }
                    if comparison_results['overall_status'] != 'CRITICAL':
                        comparison_results['overall_status'] = 'WARNING'

                if violation:
                    comparison_results['threshold_violations'].append(violation)

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse(comparison_results)

        return render(request, 'admin_panel.html', {
            'sensor_comparison': comparison_results,
            'lora_v1_data': lora_v1_data,
            'loradev2_data': loradev2_data
        })

    except Exception as e:
        return JsonResponse({'error': str(e), 'status': 'error'}, status=500)


def admin_login(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        try:
            user = AdminUserlogin.objects.get(username=username, password=password)
            request.session['admin_user'] = user.username  # Store session
            return redirect('admin_dashboard')
        except AdminUserlogin.DoesNotExist:
            messages.error(request, 'Invalid username or password.')

    return render(request, 'admin_log.html')

@ensure_csrf_cookie
def admin_dashboard(request):
    if 'admin_user' not in request.session:
        return redirect('admin_login')

    # Fetch data for both devices
    lora_v1_items = get_device_data("lora-v1")
    loradev2_items = get_device_data("loradev2")

    # Process both datasets
    latest_lora_v1, avg_lora_v1, subindices_lora_v1, high_index_lora_v1 = process_items(lora_v1_items)
    latest_loradev2, avg_loradev2, subindices_loradev2, high_index_loradev2 = process_items(loradev2_items)
    print(latest_loradev2)

    # Import your custom User model directly from your app
   # Replace "your_app_name" with your actual app name
    users = User.objects.all()
    health_assessments = HealthAssessment.objects.all()

    # Debug information
    print(f"Number of users found: {users.count()}")
    for user in users:
        print(f"User: {user.name}, Phone: {user.phone_number}")

    # Create context with admin username and all the data
    context = {
        'username': request.session['admin_user'],
        'lora_v1': latest_lora_v1,
        'loradev2': latest_loradev2,
        'high_index_lora_v1': high_index_lora_v1,
        'high_index_loradev2': high_index_loradev2,
        'averages_lora_v1': avg_lora_v1,
        'averages_loradev2': avg_loradev2,
        'subindices_lora_v1': subindices_lora_v1,
        'subindices_loradev2': subindices_loradev2,
        'users': users,
        'health_assessments': health_assessments
    }

    # Check if this is an AJAX request
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({
            'lora_v1': latest_lora_v1,
            'loradev2': latest_loradev2,
        })

    return render(request, 'admin_dashboard1.html', context)

# The process_items function from map_view
def process_items(items):
    if not items:
        return [], {}, {}, None

    # Parse payloads
    for item in items:
        parsed_payload = parse_payload(item['payload'])
        item.update({
            'co': parsed_payload.get('co'),
            'nh3': parsed_payload.get('nh3'),
            'no2': parsed_payload.get('no2'),
            'o3': parsed_payload.get('o3'),
            'pm25': parsed_payload.get('pm25'),
            'pm10': parsed_payload.get('pm10'),
            'so2': parsed_payload.get('so2'),
            'hum': parsed_payload.get('hum'),
            'date': parsed_payload.get('date'),
            'time': parsed_payload.get('time'),
        })

    # Sort items by received time (descending)
    items.sort(
        key=lambda x: datetime.strptime(
            truncate_nanoseconds(x['received_at']).strip(),
            '%Y-%m-%dT%H:%M:%S.%fZ'
        ),
        reverse=True
    )
    latest_24_items = items[:24]  # Get the latest 24 items

    # Compute averages
    parameters = ['nh3', 'o3', 'pm25', 'pm10', 'so2', 'co']
    sums = {param: 0 for param in parameters}
    counts = {param: 0 for param in parameters}

    for item in latest_24_items:
        parsed_payload = parse_payload(item['payload'])
        for param in parameters:
            value = parsed_payload.get(param)
            if value is not None:
                sums[param] += value
                counts[param] += 1

    # Calculate averages
    averages = {
        param: (sums[param] / counts[param]) if counts[param] > 0 else None
        for param in parameters
    }

    # Calculate sub-indices
    sub_indices = calculate_subindices(averages)

    # Get the highest sub-index
    valid_indices = [index for index in sub_indices.values() if index is not None]
    highest_sub_index = round(max(valid_indices)) if valid_indices else None

    # Get the latest item
    latest_item = latest_24_items[0] if latest_24_items else None
    if latest_item:
        received_at = datetime.strptime(
            truncate_nanoseconds(latest_item['received_at']).strip(),
            '%Y-%m-%dT%H:%M:%S.%fZ'
        )
        latest_item['received_at'] = received_at.strftime('%Y-%m-%d %H:%M:%S')

    return latest_item, averages, sub_indices, highest_sub_index



def add_family_member(request, username=None):
    """
    View function to add a family member to the logged-in user's profile.
    Also displays all family members in a table format.
    """
    # Get the logged-in user's username from the session or URL
    username = username or request.session.get('name')
    if not username:
        return redirect('login')

    # Fetch the User instance using the username
    parent_user = get_object_or_404(User, name=username)
    # Handle form submission
    if request.method == 'POST':
        name = request.POST.get('name')
        age = request.POST.get('age')
        relationship = request.POST.get('relationship')

        if not name or not age or not relationship:
            messages.error(request, "All fields are required.")
        else:
            try:
                # Convert age to integer to ensure it's valid
                age = int(age)

                # Create the new family member record
                FamilyMembers.objects.create(
                    parent_user=parent_user,
                    name=name,
                    age=age,
                    relationship=relationship
                )
                messages.success(request, "Family member added successfully.")

                # Redirect to the same page to see the updated table
                return redirect('add_family_member')
            except ValueError:
                messages.error(request, "Please enter a valid age.")
            except Exception as e:
                messages.error(request, f"An error occurred: {str(e)}")

    # Fetch family members for this user
    family_members = parent_user.family_members.all().order_by('name')
    family_members_count = family_members.count()

    return render(request, 'add_family_member.html', {
        'username': username,
        'family_members': family_members,
        'family_members_count': family_members_count
    })

def view_family_profile(request, member_id,username=None):
    username = request.session.get('name')

    if not username:
        return render(request, 'error.html', {'message': 'User not found in session.'})

    # Get the family member using the ID
    family_member = get_object_or_404(FamilyMembers, id=member_id)

    # Get the parent user using the username
    parent_user = get_object_or_404(User, name=username)

    # Get health data for this family member
    health_data = HealthAssessment.objects.filter(username=family_member.name).first()

    # Get all family members for the parent user
    family_members = parent_user.family_members.all().order_by('name')
    family_members_count = family_members.count()

    context = {
        'family_member': family_member,
        'health_data': health_data,
        'username': username,
        'family_members': family_members,
        'family_members_count': family_members_count
    }
    return render(request, 'family_profile.html', context)


def download_family_pdf(request, member_id):
    family_member = get_object_or_404(FamilyMembers, id=member_id)
    health_data = HealthAssessment.objects.filter(username=family_member.name).first()

    html = render_to_string('family_profile.html', {
        'family_member': family_member,
        'health_data': health_data
    })

    path_wkhtmltopdf = r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe'  # Set your actual path here
    config = pdfkit.configuration(wkhtmltopdf=path_wkhtmltopdf)

    pdf = pdfkit.from_string(html, False, configuration=config)

    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Health_Profile_{family_member.name}.pdf"'
    return response


def forecast_dashboard(request):
    try:
        username = request.session.get('name')
        if not username:
            return redirect('home')

        # 🔽 Fetch forecast data from S3
        try:
            s3 = boto3.client('s3')
            response = s3.get_object(Bucket='ai-model-bucket-output', Key='data/air_quality/latest_forecast.json')
            s3_forecast_data = json.loads(response['Body'].read().decode('utf-8'))

            forecast_data = []
            for i, date in enumerate(s3_forecast_data['dates']):
                entry = {"day": date}
                for gas, data in s3_forecast_data['gases'].items():
                    param_name = gas.lower().replace(".", "")
                    entry[f"{param_name}_max"] = round(data['values'][i], 2)
                forecast_data.append(entry)

            forecast_updated_at = s3_forecast_data.get('updated_at')
        except Exception as e:
            print(f"Error fetching S3 forecast data: {e}")
            forecast_data = []
            forecast_updated_at = None

        aqi_parameters = ['nh3', 'no2', 'o3', 'pm25', 'pm10', 'so2', 'co']

        # Add CSRF token for AJAX requests
        from django.middleware.csrf import get_token
        csrf_token = get_token(request)

        return render(request, 'Forecast_dashboard.html', {
            "username": username,
            "forecast_data": forecast_data,
            "forecast_updated_at": forecast_updated_at,
            "aqi_parameters": aqi_parameters,
            "csrf_token": csrf_token,
        })

    except Exception as e:
        print(f"Error: {e}")
        return JsonResponse({'error': str(e)}, status=500)



# Add or update these functions in your views.py file
    # Add or update these functions in your views.py file

def get_s3_files(request):
        """Fetch list of historical forecast files from S3"""
        try:
            s3 = boto3.client('s3')
            bucket = 'ai-model-bucket-output'
            prefix = 'data/air_quality/forecast_history/'

            response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)

            # Extract filenames from S3 response
            files = []
            for obj in response.get('Contents', []):
                key = obj['Key']
                if key.endswith('.csv'):
                    # Get just the filename without path
                    filename = key.split('/')[-1]
                    files.append(filename)

            return JsonResponse(files, safe=False)
        except Exception as e:
            print(f"Error fetching S3 files: {e}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def get_forecast_by_date(request):
        """Get forecast data for a specific date"""
        if request.method == "POST":
            selected_date = request.POST.get('date')  # Format: YYYY-MM-DD

            if not selected_date:
                return JsonResponse({'status': 'error', 'message': 'Date parameter is required'}, status=400)

            try:
                # Convert date format if needed (YYYY-MM-DD to YYYYMMDD)
                date_parts = selected_date.split('-')
                if len(date_parts) == 3:
                    formatted_date = ''.join(date_parts)
                else:
                    formatted_date = selected_date

                # Search for files matching this date pattern
                s3 = boto3.client('s3')
                bucket_name = 'ai-model-bucket-output'
                prefix = f'data/air_quality/forecast_history/forecast_{formatted_date}'

                # List objects with this prefix to find matching files
                list_response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)

                if 'Contents' not in list_response or not list_response['Contents']:
                    # Try direct file access with .csv extension
                    try:
                        direct_key = f"data/air_quality/forecast_history/{selected_date}.csv"
                        file_response = s3.get_object(Bucket=bucket_name, Key=direct_key)
                        content = file_response['Body'].read().decode('utf-8').splitlines()
                        reader = csv.DictReader(content)
                        forecast_list = [row for row in reader]
                        return JsonResponse({'status': 'success', 'data': forecast_list})
                    except Exception as direct_error:
                        print(f"Direct file access failed: {direct_error}")
                        return JsonResponse(
                            {'status': 'error', 'message': f'No forecast data found for {selected_date}'}, status=404)

                # Get the most recent file for this date (if multiple exist)
                sorted_contents = sorted(list_response['Contents'], key=lambda x: x['LastModified'], reverse=True)
                latest_file = sorted_contents[0]['Key']

                # Get file content
                file_response = s3.get_object(Bucket=bucket_name, Key=latest_file)
                content = file_response['Body'].read().decode('utf-8').splitlines()
                reader = csv.DictReader(content)

                forecast_list = [row for row in reader]
                return JsonResponse({'status': 'success', 'data': forecast_list})

            except Exception as e:
                print(f"Error retrieving forecast data: {e}")
                return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

def download_s3_file(request):
        """Download a specific file from S3"""
        filename = request.GET.get('filename')

        if not filename:
            return HttpResponse("Filename is required", status=400)

        try:
            # Initialize S3 client
            s3 = boto3.client('s3')
            bucket_name = 'ai-model-bucket-output'
            file_key = f'data/air_quality/forecast_history/{filename}'

            # Get file from S3
            response = s3.get_object(Bucket=bucket_name, Key=file_key)
            content = response['Body'].read().decode('utf-8')

            # Create HTTP response with CSV content
            http_response = HttpResponse(content, content_type='text/csv')
            http_response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return http_response

        except Exception as e:
            return HttpResponse(f"Error: {str(e)}", status=500)


def forecast_history(request):

    return render(request,'Historical_data.html')










