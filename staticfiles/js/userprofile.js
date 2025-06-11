// Enhanced Air Quality Dashboard with Fixed Issues
class AirQualityDashboard {
    constructor() {
        this.config = {
            // Fixed Kochi coordinates for accurate location
            DEFAULT_LOCATION: [10.1632, 76.6413], // Kochi city center
            SENSOR_LOCATIONS: {
                'lora-v1': {
                    lat: 10.184732819803031,
                    lng: 76.42155513804967,
                    name: 'Adi Shankara Institute',
                    type: 'primary'
                },
                'loradev2': {
                    lat: 10.17095090340159,
                    lng: 76.42962876824544,
                    name: 'Mattoor Station',
                    type: 'primary'
                },
                'temp-sensor-1': {
                    lat: 10.172,
                    lng: 76.432,
                    name: 'Marotichodu Community Hall',
                    type: 'supplementary'
                },
                'temp-sensor-2': {
                    lat: 10.175,
                    lng: 76.435,
                    name: 'Kaipatoor Residential',
                    type: 'supplementary'
                },
                'temp-sensor-3': {
                    lat: 10.169,
                    lng: 76.440,
                    name: 'Kalady Panchayat Office',
                    type: 'supplementary'
                }
            },
            REFRESH_INTERVAL: 5000, // 10 seconds for real-time updates
            AQI_THRESHOLDS: {
                GOOD: { max: 50, color: 'good', icon: 'fa-smile', message: 'Excellent air quality! Perfect for outdoor activities.' },
                MODERATE: { max: 100, color: 'moderate', icon: 'fa-meh', message: 'Moderate air quality. Sensitive individuals should limit prolonged outdoor exertion.' },
                UNHEALTHY: { max: 200, color: 'unhealthy', icon: 'fa-frown', message: 'Unhealthy air quality! Limit outdoor activities, especially for sensitive groups.' },
                HAZARDOUS: { max: 999, color: 'hazardous', icon: 'fa-skull', message: 'HAZARDOUS conditions! Avoid all outdoor activities. Stay indoors with air purification.' }
            }
        };

        this.state = {
            map: null,
            markers: {},
            userLocationMarker: null,
            forecastChart: null,
            healthChart: null,
            currentParameter: 'pm25', // Default to PM2.5
            forecastData: this.getInitialForecastData(),
            isLocationTracking: false,
            userCoordinates: null,
            updateCounter: 0,
            isOnline: navigator.onLine,
            dailyAQI: null,
            dailyAQIDate: null,
            lastRealTimeUpdate: null
        };

        this.init();
    }

    getInitialForecastData() {
        // Initialize with default forecast data
        const backendData = {{ forecast_data|safe }};
        if (backendData && Array.isArray(backendData) && backendData.length > 0) {
            return backendData;
        }

        return [
            { day: 'Today', pm25_max: 35, pm10_max: 45, no2_max: 25, o3_max: 40, so2_max: 12, co_max: 1.8, nh3_max: 12 },
            { day: 'Tomorrow', pm25_max: 32, pm10_max: 42, no2_max: 23, o3_max: 38, so2_max: 10, co_max: 1.6, nh3_max: 10 },
            { day: 'Day 3', pm25_max: 38, pm10_max: 48, no2_max: 28, o3_max: 42, so2_max: 14, co_max: 2.0, nh3_max: 14 },
            { day: 'Day 4', pm25_max: 30, pm10_max: 40, no2_max: 22, o3_max: 36, so2_max: 9, co_max: 1.5, nh3_max: 9 },
            { day: 'Day 5', pm25_max: 28, pm10_max: 38, no2_max: 20, o3_max: 34, so2_max: 8, co_max: 1.4, nh3_max: 8 }
        ];
    }

    async init() {
        try {
            // Initialize components
            this.initializeMap();
            this.initializeCharts();
            this.initializeEventHandlers();
            this.startLocationTracking();
            this.setupNetworkMonitoring();

            // Set default values first
            this.setDefaultValues();

            // Initialize daily AQI system
            this.initializeDailyAQI();

            // Load forecast data on initialization
            this.updateForecastChart();
            this.updateForecastTable();

            // Fetch real data
            await this.fetchLatestData();
            this.startPeriodicUpdates();

            this.showNotification("🎉 Dashboard initialized successfully!", "success");
        } catch (error) {
            console.error("Dashboard initialization error:", error);
            this.showNotification("⚠️ Dashboard loaded with default values", "warning");
        }
    }

    initializeDailyAQI() {
        const today = new Date().toDateString();
        const savedAQI = localStorage.getItem('dailyAQI');
        const savedDate = localStorage.getItem('dailyAQIDate');

        if (savedDate === today && savedAQI) {
            // Use saved AQI for today
            this.state.dailyAQI = parseInt(savedAQI);
            this.state.dailyAQIDate = savedDate;
            document.getElementById('main-aqi').textContent = this.state.dailyAQI;
            this.updateAQIStatus(this.state.dailyAQI);
            this.updateDynamicAlert(this.state.dailyAQI);
        } else {
            // Set new AQI for today
            const newAQI = parseInt(document.getElementById('main-aqi').textContent) || 50;
            this.setDailyAQI(newAQI);
        }
    }

    setDailyAQI(aqiValue) {
        const today = new Date().toDateString();
        this.state.dailyAQI = aqiValue;
        this.state.dailyAQIDate = today;

        // Save to localStorage
        localStorage.setItem('dailyAQI', aqiValue.toString());
        localStorage.setItem('dailyAQIDate', today);

        // Update UI
        document.getElementById('main-aqi').textContent = aqiValue;
        this.updateAQIStatus(aqiValue);
        this.updateDynamicAlert(aqiValue);
    }

    setDefaultValues() {
        const defaults = {
            aqi: 50,
            pm25: 25, pm10: 40, so2: 8, o3: 45, co: 1.2, no2: 20, nh3: 15,
            temp: 28, hum: 65, pre: 1013
        };

        // Update main AQI and alert only if not set by daily AQI system
        if (!this.state.dailyAQI) {
            if (!document.getElementById('main-aqi').textContent || document.getElementById('main-aqi').textContent === '--') {
                document.getElementById('main-aqi').textContent = defaults.aqi;
                document.getElementById('aqi-status-text').textContent = 'Good Air Quality';
                this.updateDynamicAlert(defaults.aqi);
            }
        }

        // Update metrics
        Object.keys(defaults).forEach(param => {
            if (param === 'aqi') return;

            const elementId = `${param}-value`;
            const element = document.getElementById(elementId);
            if (element && (!element.textContent || element.textContent === '--')) {
                let value = defaults[param];
                if (param === 'temp') value += '°C';
                else if (param === 'hum') value += '%';
                else if (param === 'pre') value += ' hPa';
                element.textContent = value;
            }
        });

        // Set default location
        const locationElement = document.getElementById('location-display');
        if (locationElement && locationElement.textContent.includes('Detecting')) {
            locationElement.textContent = '📍 Kochi, Kerala, India';
        }

        // Set default timestamp
        const timeElement = document.getElementById('last-update-time');
        if (timeElement && (!timeElement.textContent || timeElement.textContent === 'N/A')) {
            timeElement.textContent = new Date().toLocaleString();
        }
    }

    initializeMap() {
        // Create map with fixed Kochi coordinates
        this.state.map = L.map('map').setView(this.config.DEFAULT_LOCATION, 12);

        // Add tile layer with custom styling
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors | Kerala Govt Air Quality Network'
        }).addTo(this.state.map);

        // Add sensor markers
        this.addSensorMarkers();

        // Add click handler for map redirect
        this.state.map.on('click', () => {
            window.location.href = "{% url 'map_view' %}";
        });
    }

    addSensorMarkers() {
        Object.entries(this.config.SENSOR_LOCATIONS).forEach(([id, sensor]) => {
            const isPrimary = sensor.type === 'primary';
            const markerColor = isPrimary ? '#10b981' : '#f59e0b';
            const markerSize = isPrimary ? 16 : 14;

            const icon = L.divIcon({
                className: 'sensor-marker',
                html: `<div style="background-color:${markerColor};width:${markerSize}px;height:${markerSize}px;border-radius:50%;border:4px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.4);animation:float 3s ease-in-out infinite;"></div>`,
                iconSize: [markerSize + 8, markerSize + 8],
                iconAnchor: [(markerSize + 8) / 2, (markerSize + 8) / 2]
            });

            const marker = L.marker([sensor.lat, sensor.lng], { icon }).addTo(this.state.map);

            marker.bindPopup(`
                <div style="min-width: 240px; text-align: center;">
                    <h4 style="margin: 0 0 12px 0; color: #1f2937; font-size: 1.1rem;">${sensor.name}</h4>
                    <div style="background: ${markerColor}; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 12px; font-weight: 600;">
                        🏛️ ${sensor.type.toUpperCase()} SENSOR
                    </div>
                    <div id="sensor-data-${id}" style="font-size: 14px; color: #4b5563;">
                        📊 Loading real-time data...
                    </div>
                    <button onclick="window.location.href='/map/'"
                            style="margin-top: 12px; padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        🗺️ View Full Map
                    </button>
                </div>
            `);

            this.state.markers[id] = marker;
        });
    }

    initializeCharts() {
        this.initializeForecastChart();
        this.initializeHealthChart();
    }

    initializeForecastChart() {
        const ctx = document.getElementById('forecastChart').getContext('2d');

        // Create gradient for PM2.5 (default parameter)
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.05)');

        this.state.forecastChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'PM2.5 Forecast',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#4b5563',
                            font: { weight: 600 }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            color: '#6b7280',
                            font: { weight: 500 }
                        },
                        grid: { color: 'rgba(239, 68, 68, 0.1)' }
                    },
                    x: {
                        ticks: {
                            color: '#6b7280',
                            font: { weight: 500 }
                        },
                        grid: { color: 'rgba(239, 68, 68, 0.1)' }
                    }
                }
            }
        });
    }

    initializeHealthChart() {
        const healthScore = 75; // Default health score
        const ctx = document.getElementById('healthScoreChart').getContext('2d');

        // Create gradient for health chart
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 150);
        gradient.addColorStop(0, healthScore > 70 ? '#10b981' : healthScore > 50 ? '#f59e0b' : '#ef4444');
        gradient.addColorStop(1, healthScore > 70 ? '#047857' : healthScore > 50 ? '#d97706' : '#dc2626');

        this.state.healthChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Health Score', 'Risk Level'],
                datasets: [{
                    data: [healthScore, 100 - healthScore],
                    backgroundColor: [gradient, '#e5e7eb'],
                    borderWidth: 0,
                    cutout: '70%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#374151',
                            font: { weight: 600 }
                        }
                    }
                }
            }
        });
    }

    initializeEventHandlers() {
        // Parameter buttons
        document.querySelectorAll('.param-btn').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.param-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                this.state.currentParameter = button.getAttribute('data-param');
                this.updateForecastChart();
                this.updateForecastTable();
            });
        });

        // Window resize
        window.addEventListener('resize', () => {
            if (this.state.map) {
                setTimeout(() => this.state.map.invalidateSize(), 100);
            }
        });

        // Map container click
        document.querySelector('.map-container').addEventListener('click', () => {
            window.location.href = "/map/";
        });
    }

    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            this.showNotification("🌐 Connection restored - resuming real-time updates", "success");
            this.fetchLatestData();
        });

        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            this.showNotification("📵 Connection lost - using cached data", "warning");
        });
    }

    startLocationTracking() {
        if (!navigator.geolocation) {
            this.showNotification("🚫 Geolocation not supported by this browser", "warning");
            this.setDefaultLocation();
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000 // 1 minute cache
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude: lat, longitude: lng, accuracy } = position.coords;

                // Verify if location is within Kerala bounds (approximately)
                const keralaBounds = {
                    north: 12.8,
                    south: 8.3,
                    east: 77.4,
                    west: 74.9
                };

                if (lat >= keralaBounds.south && lat <= keralaBounds.north &&
                    lng >= keralaBounds.west && lng <= keralaBounds.east) {

                    this.state.userCoordinates = { lat, lng };

                    // Update map view to user location
                    this.state.map.setView([lat, lng], 14);

                    // Add user location marker
                    if (this.state.userLocationMarker) {
                        this.state.map.removeLayer(this.state.userLocationMarker);
                    }

                    this.state.userLocationMarker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'user-location-marker',
                            html: '<div class="location-pulse"></div>',
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    }).addTo(this.state.map);

                    // Create detailed popup
                    this.state.userLocationMarker.bindPopup(`
                        <div style="text-align: center; min-width: 220px;">
                            <h4 style="margin: 0 0 12px 0; color: #1f2937; font-size: 1.1rem;">📍 Your Location</h4>
                            <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 12px; font-weight: 600;">
                                🎯 ACCURATE LOCATION
                            </div>
                            <div style="font-size: 14px; color: #4b5563; margin-bottom: 8px;">
                                🌬️ Air quality estimated from nearby sensors
                            </div>
                            <div style="font-size: 12px; color: #6b7280;">
                                📡 Accuracy: ±${Math.round(accuracy)}m
                            </div>
                            <button onclick="window.location.href='/map/'"
                                    style="margin-top: 12px; padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                🗺️ Explore Full Map
                            </button>
                        </div>
                    `).openPopup();

                    // Get and update address
                    this.getAddressFromCoordinates(lat, lng);
                    this.state.isLocationTracking = true;

                    this.showNotification(`📍 Accurate location detected (±${Math.round(accuracy)}m)!`, "success");
                } else {
                    // Location is outside Kerala, use default
                    this.setDefaultLocation();
                    this.showNotification("📍 Location detected outside Kerala - using Kochi center", "info");
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                this.setDefaultLocation();

                let errorMessage = "🚫 Location detection failed. ";
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += "Please enable location permissions.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += "Location information unavailable.";
                        break;
                    case error.TIMEOUT:
                        errorMessage += "Location request timed out.";
                        break;
                    default:
                        errorMessage += "Unknown location error.";
                        break;
                }

                this.showNotification(errorMessage, "warning");
            },
            options
        );
    }

    setDefaultLocation() {
        // Set default location to Kochi center
        const [lat, lng] = this.config.DEFAULT_LOCATION;
        this.state.userCoordinates = { lat, lng };

        // Update map view
        this.state.map.setView([lat, lng], 12);

        // Add default location marker
        if (this.state.userLocationMarker) {
            this.state.map.removeLayer(this.state.userLocationMarker);
        }

        this.state.userLocationMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'user-location-marker',
                html: '<div class="location-pulse"></div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            })
        }).addTo(this.state.map);

        this.state.userLocationMarker.bindPopup(`
            <div style="text-align: center; min-width: 220px;">
                <h4 style="margin: 0 0 12px 0; color: #1f2937; font-size: 1.1rem;">📍 Default Location</h4>
                <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 12px; font-weight: 600;">
                    🏙️ KOCHI CENTER
                </div>
                <div style="font-size: 14px; color: #4b5563; margin-bottom: 8px;">
                    🌬️ Air quality from nearby sensors
                </div>
                <button onclick="window.location.href='/map/'"
                        style="margin-top: 12px; padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    🗺️ Explore Full Map
                </button>
            </div>
        `);

        // Set default location display
        const locationElement = document.getElementById('location-display');
        if (locationElement) {
            locationElement.textContent = '📍 Kochi, Kerala, India (Default)';
        }
    }

    async getAddressFromCoordinates(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`
            );
            const data = await response.json();

            const locationElement = document.getElementById('location-display');
            if (locationElement && data.address) {
                // Extract meaningful address parts for Kerala
                const city = data.address.city || data.address.town || data.address.village || 'Kochi';
                const district = data.address.state_district || data.address.county || '';
                const state = data.address.state || 'Kerala';

                const shortAddress = district ? `${city}, ${district}, ${state}` : `${city}, ${state}`;
                locationElement.textContent = `📍 ${shortAddress}`;
            }
        } catch (error) {
            console.error("Error fetching address:", error);
            const locationElement = document.getElementById('location-display');
            if (locationElement) {
                locationElement.textContent = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
        }
    }

    updateDynamicAlert(aqiValue) {
        const aqi = parseInt(aqiValue) || 0;
        const alertBanner = document.getElementById('alert-banner');
        const alertMessage = document.getElementById('alert-message');
        const alertIcon = alertBanner.querySelector('.alert-icon');

        let alertInfo = this.config.AQI_THRESHOLDS.GOOD;

        for (const [level, info] of Object.entries(this.config.AQI_THRESHOLDS)) {
            if (aqi <= info.max) {
                alertInfo = info;
                break;
            }
        }

        // Update alert banner
        alertBanner.className = `alert-banner ${alertInfo.color}`;
        alertIcon.className = `fas ${alertInfo.icon} alert-icon`;
        alertMessage.textContent = `AQI ${aqi} - ${alertInfo.message}`;
    }

    async fetchLatestData() {
        if (!this.state.isOnline) {
            this.showNotification("📵 Offline - using cached data", "warning");
            return;
        }

        try {
            const response = await fetch('/api/latest-data/', {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.updateUIWithData(data);
            this.updateSensorMarkers(data);

            if (data.forecast_data && data.forecast_data.length > 0) {
                this.state.forecastData = data.forecast_data;
                this.updateForecastChart();
                this.updateForecastTable();
            }

            // Update real-time status
            this.state.updateCounter++;
            this.updateRealtimeStatus();
            this.state.lastRealTimeUpdate = new Date();

        } catch (error) {
            console.error("Error fetching data:", error);
            this.showNotification("⚠️ Using cached data - connection issue detected", "warning");
        }
    }

    updateRealtimeStatus() {
        const statusElement = document.getElementById('realtime-status');
        const now = new Date();
        const timeString = now.toLocaleTimeString();

        if (statusElement) {
            statusElement.innerHTML = `🟢 LIVE • Last update: ${timeString} • Update #${this.state.updateCounter}`;
        }
    }

    updateUIWithData(data) {
        if (!data.latest_item) return;

        const latest = data.latest_item;

        // Update AQI only if it's a new day or first time setting
        if (data.highest_sub_index && !this.state.dailyAQI) {
            this.setDailyAQI(data.highest_sub_index);
        }

        // Update real-time parameters (not AQI)
        const metrics = ['nh3', 'o3', 'so2', 'co', 'no2', 'pm25', 'pm10'];
        metrics.forEach(metric => {
            const element = document.getElementById(`${metric}-value`);
            if (element && latest[metric] !== undefined && latest[metric] !== null) {
                // Handle conditional display
                if ((metric === 'so2' || metric === 'no2') && parseFloat(latest[metric]) > 200) {
                    element.innerHTML = '<span class="metric-unavailable">N/A</span>';
                } else {
                    element.textContent = latest[metric];
                }
            }
        });

        // Update weather
        const weatherData = [
            { metric: 'temp', suffix: '°C' },
            { metric: 'hum', suffix: '%' },
            { metric: 'pre', suffix: ' hPa' }
        ];

        weatherData.forEach(({ metric, suffix }) => {
            const element = document.getElementById(`${metric}-value`);
            if (element && latest[metric] !== undefined && latest[metric] !== null) {
                element.textContent = latest[metric] + suffix;
            }
        });

        // Update timestamps
        if (latest.date) {
            const now = new Date().toLocaleString();
            document.getElementById('last-update-time').textContent = now;
            document.getElementById('interpolation-timestamp').textContent = now;
        }
    }

    updateAQIStatus(aqiValue) {
        const aqi = parseInt(aqiValue);
        const statusElement = document.getElementById('aqi-status-text');

        if (aqi <= 50) {
            statusElement.textContent = '😊 Excellent Air Quality';
            statusElement.style.color = '#10b981';
        } else if (aqi <= 100) {
            statusElement.textContent = '😐 Moderate Air Quality';
            statusElement.style.color = '#f59e0b';
        } else if (aqi <= 200) {
            statusElement.textContent = '😷 Unhealthy Air Quality';
            statusElement.style.color = '#ef4444';
        } else {
            statusElement.textContent = '☠️ Hazardous Air Quality';
            statusElement.style.color = '#7c2d12';
        }
    }

    updateSensorMarkers(data) {
        // Update sensor popups with real data
        Object.keys(this.config.SENSOR_LOCATIONS).forEach(sensorId => {
            if (data[sensorId] && this.state.markers[sensorId]) {
                const sensorData = data[sensorId];
                const sensor = this.config.SENSOR_LOCATIONS[sensorId];
                const isPrimary = sensor.type === 'primary';
                const markerColor = isPrimary ? '#10b981' : '#f59e0b';

                const popupContent = `
                    <div style="min-width: 240px; text-align: center;">
                        <h4 style="margin: 0 0 12px 0; color: #1f2937; font-size: 1.1rem;">${sensor.name}</h4>
                        <div style="background: ${markerColor}; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 12px; font-weight: 600;">
                            🏛️ ${sensor.type.toUpperCase()} SENSOR
                        </div>
                        <div style="font-size: 20px; font-weight: bold; color: #4f46e5; margin-bottom: 12px;">
                            🌬️ AQI: ${sensorData.highest_sub_index || 'N/A'}
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; color: #4b5563; margin-bottom: 12px;">
                            <div>💨 PM2.5: ${sensorData.latest_item?.pm25 || 'N/A'}</div>
                            <div>🌫️ PM10: ${sensorData.latest_item?.pm10 || 'N/A'}</div>
                            <div>🏭 SO₂: ${sensorData.latest_item?.so2 || 'N/A'}</div>
                            <div>☁️ O₃: ${sensorData.latest_item?.o3 || 'N/A'}</div>
                            <div>🚗 CO: ${sensorData.latest_item?.co || 'N/A'}</div>
                            <div>⚡ NO₂: ${sensorData.latest_item?.no2 || 'N/A'}</div>
                        </div>
                        <button onclick="window.location.href='/map/'"
                                style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            🗺️ View Full Map
                        </button>
                    </div>
                `;

                this.state.markers[sensorId].setPopupContent(popupContent);
            }
        });
    }

    updateForecastChart() {
        if (!this.state.forecastChart || !this.state.forecastData) return;

        const parameter = this.state.currentParameter;
        const labels = this.state.forecastData.map(entry => entry.day);
        const values = this.state.forecastData.map(entry => entry[`${parameter}_max`] || 0);

        const colors = {
            pm25: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
            pm10: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' },
            no2: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' },
            o3: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },
            so2: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' },
            co: { border: '#f97316', bg: 'rgba(249, 115, 22, 0.2)' },
            nh3: { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)' }
        };

        const colorSet = colors[parameter] || colors.pm25;

        this.state.forecastChart.data.labels = labels;
        this.state.forecastChart.data.datasets[0] = {
            label: `${parameter.toUpperCase()} Forecast`,
            data: values,
            borderColor: colorSet.border,
            backgroundColor: colorSet.bg,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: colorSet.border,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
        };

        this.state.forecastChart.update();
    }

    updateForecastTable() {
        if (!this.state.forecastData) return;

        const tbody = document.querySelector('#forecastTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        const parameter = this.state.currentParameter;
        const recentDays = this.state.forecastData.slice(-4);

        recentDays.forEach(day => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight: 600; color: #4f46e5;">📅 ${day.day}</td>
                <td style="font-weight: 700; color: #1f2937;">📈 ${day[parameter + '_max'] || '--'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    startPeriodicUpdates() {
        // Initial fetch
        this.fetchLatestData();

        // Periodic updates every 10 seconds
        setInterval(() => {
            this.fetchLatestData();

            // Show subtle update indicator
            const updateIndicator = document.createElement('div');
            updateIndicator.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: rgba(16, 185, 129, 0.9); color: white; padding: 8px 16px;
                border-radius: 8px; font-size: 12px; font-weight: 600;
                z-index: 10000; opacity: 0; transition: opacity 0.3s ease;
            `;
            updateIndicator.textContent = `🔄 Real-time update #${this.state.updateCounter}`;
            document.body.appendChild(updateIndicator);

            setTimeout(() => updateIndicator.style.opacity = '1', 100);
            setTimeout(() => {
                updateIndicator.style.opacity = '0';
                setTimeout(() => {
                    if (document.body.contains(updateIndicator)) {
                        document.body.removeChild(updateIndicator);
                    }
                }, 300);
            }, 2000);

        }, this.config.REFRESH_INTERVAL);
    }

    showNotification(message, type = "info") {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notification-text');

        if (!notification || !notificationText) return;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        notificationText.textContent = `${icons[type] || icons.info} ${message}`;
        notification.className = `notification ${type}`;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AirQualityDashboard();
});

// Auto-hide alert banner after 15 seconds
setTimeout(() => {
    const alertBanner = document.querySelector('.alert-banner');
    if (alertBanner) {
        alertBanner.style.transition = 'all 0.5s ease';
        alertBanner.style.transform = 'translateY(-100%)';
        alertBanner.style.opacity = '0';
        setTimeout(() => alertBanner.style.display = 'none', 500);
    }
}, 15000);

// Add keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.altKey) {
        switch(event.key) {
            case 'm':
                event.preventDefault();
                window.location.href = "/map/";
                break;
            case 'r':
                event.preventDefault();
                if (window.dashboard) {
                    window.dashboard.fetchLatestData();
                    window.dashboard.showNotification('🔄 Manual refresh triggered', 'info');
                }
                break;
            case 'h':
                event.preventDefault();
                window.location.href = "/";
                break;
        }
    }
});

// Add smooth scrolling
document.documentElement.style.scrollBehavior = 'smooth';

// Performance monitoring
window.addEventListener('load', () => {
    const loadTime = performance.now();
    console.log(`🚀 Dashboard loaded in ${Math.round(loadTime)}ms`);
});