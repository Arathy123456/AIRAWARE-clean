from django.db import models
from django.contrib.auth.models import User
from django.contrib import admin
import os
from django.db import models

class User(models.Model):
    name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=15, unique=True)
    otp = models.CharField(max_length=6, blank=True, null=True)


    def __str__(self):
        return self.name


class login(models.Model):
    phone_number = models.CharField(max_length=15, unique=True)
    otp_code = models.CharField(max_length=6, null=True, blank=True)
    otp_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.phone_number

class HealthQuestionnaire(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)  # Assuming you have a User model
    question1 = models.CharField(max_length=100)  # Adjust field types as necessary
    question2 = models.CharField(max_length=100)
    # Add additional questions as needed

    def __str__(self):
        return f"Health Questionnaire for {self.user.name}"

class HealthAssessment(models.Model):
    username = models.CharField(max_length=100)
    age_group = models.CharField(max_length=20)
    gender = models.CharField(max_length=20)
    respiratory_conditions = models.TextField()  # Stores JSON or comma-separated list
    smoking_history = models.TextField()
    living_environment = models.TextField()  # Stores JSON or comma-separated list
    common_symptoms = models.TextField()  # Stores JSON or comma-separated list
    occupational_exposure = models.CharField(max_length=50)
    medical_history = models.TextField()  #
    health_score = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.username} - Health Assessment"

class AirQualityData(models.Model):
        co = models.FloatField(null=True)
        nh3 = models.FloatField(null=True)
        no2 = models.FloatField(null=True)
        o3 = models.FloatField(null=True)
        pm25 = models.FloatField(null=True)
        pm10 = models.FloatField(null=True)
        so2 = models.FloatField(null=True)
        hum = models.FloatField(null=True)
        temp = models.FloatField(null=True)
        pre = models.FloatField(null=True)
        date = models.DateField(null=True)
        time = models.TimeField(null=True)
        received_at = models.DateTimeField(auto_now_add=True)
        aqi = models.FloatField(null=True)

        class Meta:
            ordering = ['-received_at']





class AirQualityForecast(models.Model):
    date = models.DateField()
    gas_type = models.CharField(max_length=20)  # SO2, PM2.5, etc.
    forecasted_value = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('date', 'gas_type')
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['gas_type']),
        ]

    def __str__(self):
        return f"{self.gas_type} forecast for {self.date}"

class AdminUserlogin(models.Model):
    username = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=100)  # Store hashed in real projects!

    def __str__(self):
        return self.username



class FamilyMembers(models.Model):
    parent_user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='family_members')
    name = models.CharField(max_length=100)
    age = models.IntegerField()
    relationship = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.name} ({self.relationship})"
