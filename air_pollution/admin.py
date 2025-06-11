from django.contrib import admin
from .models import User,login,HealthQuestionnaire,HealthAssessment,AirQualityData,FamilyMembers
from .models import AdminUserlogin



admin.site.register(User)
admin.site.register(login)
admin.site.register(HealthQuestionnaire)
admin.site.register(HealthAssessment)
admin.site.register(AirQualityData)
admin.site.register(AdminUserlogin)
admin.site.register(FamilyMembers)
# Register your models here.


# Register your models here.
