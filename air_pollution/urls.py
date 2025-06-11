from django.contrib import admin
from django.urls import path,include
from django.conf import settings
from django.conf.urls.static import static
from .import views  # Fixed spacing issue
import debug_toolbar

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'),

    # Weather and Forecast
    path('weather/', views.weather_map, name='weather'),
    path('weather_forecast/', views.weather_forecast, name='weather_forecast'),
  #  path('load_csv_data/', views.load_csv_data, name='load_csv_data'),
    path('map_view/', views.map_view, name='map_view'),
    path('AQI_forecast/', views.AQI_forecast, name='AQI_forecast'),

    # Health-related
    path('risk_assessment/', views.risk_assessment, name='risk_assessment'),
    path('health_questions/<str:username>/', views.health_questions, name='health_questions'),
    path('health_report/', views.health_report, name='health_report'),
    path('add_family_member/', views.add_family_member, name='add_family_member'),
    path('view_family_profile/<int:member_id>/', views.view_family_profile, name='view_family_profile'),
    path('download_family_pdf/<int:member_id>/', views.download_family_pdf, name='download_family_pdf'),

    # Auth & OTP
    path('login/', views.user_login, name='login'),
    path('signup/', views.signup, name='signup'),
    path('logout/', views.logout, name='logout'),
    path('send_otp/', views.send_otp, name='send_otp'),
    path('verify_otp/', views.verify_otp, name='verify_otp'),

    # Admin section
    path('admin_login/', views.admin_login, name='admin_login'),
    path('admin_dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin_view/', views.admin_view, name='admin_view'),

    # Forecasting & Data APIs
    #path('predict_api/', views.predict_api, name='predict_api'),
    path('fetch-store/', views.fetch_and_store, name='fetch_store'),
    #path('api/kriging/', views.kriging_api, name='perform_kriging'),
    path('api/forecast-data/', views.get_forecast_data, name='forecast_data'),
    path('get_forecast_by_date/', views.get_forecast_by_date, name='get_forecast_by_date'),

    # Dashboard and visualizations
    path('dashboard/', views.dashboard, name='dashboard'),
    path('sensor-comparison/', views.sensor_comparison_view, name='sensor_comparison'),
    path('forecast_dashboard/', views.forecast_dashboard, name='forecast_dashboard'),

    # Data viewing
   # path('index_test/', views.index_test, name='index_test'),
    path('all-data/', views.list_all_data, name='list_all_data'),
    path('device/<str:device_id>/', views.get_data_by_device, name='get_data_by_device'),
    path('display-data/', views.display_all_data, name='display_all_data'),

    # Optional (uncomment when ready)
    # path('air_quality_graph/', views.air_quality_graph, name='air_quality_graph'),
    # path('aqi_graphs/', views.aqi_graphs, name='aqi_graphs'),
    # path('map_view1/', views.map_view1, name='map_view1'),
    # path('kriging/', views.kriging_interpolation, name='kriging'),
    # path('forecast/<str:gas_type>/', views.forecast_detail, name='forecast_detail'),
    # path('api/refresh-forecasts/', views.refresh_forecasts, name='refresh_forecasts'),
    path('get_forecast_by_date/', views.get_forecast_by_date, name='get_forecast_by_date'),
    path('get_s3_files/', views.get_s3_files, name='get_s3_files'),
    path('download_s3_file/', views.download_s3_file, name='download_s3_file'),
    path('forecast_history',views.forecast_history,name='forecast_history'),
    path('admin_logout/',views.admin_logout,name='admin_logout'),
    path('api/latest-data/', views.risk_assessment, name='api_latest_data'),

]

# Static files serving (only for development)
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
    urlpatterns += [path('__debug__/', include(debug_toolbar.urls))]