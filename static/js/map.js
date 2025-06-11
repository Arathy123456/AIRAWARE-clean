// Create a namespace for the AQI Map application with Real-time Updates and Individual AQI per Location
const AQIMap = {
    // Map and layers
    map: null,
    coverageCircles: {},
    markers: {},

    // User authentication state
    isOtpVerified: window.djangoData ? window.djangoData.isOtpVerified : false,

    // Location tracking properties
    userLocationMarker: null,
    userLocationCircle: null,
    isTrackingLocation: false,
    isCoverageVisible: false,
    maxDistanceForData: 1000, // 1km for IDW interpolation

    // UI state
    isPanelCollapsed: false,
    currentSelectedLocation: 'lora-v1', // Track which location is currently displayed

    // Real-time update properties
    updateCounter: 0,
    isOnline: navigator.onLine,
    lastSensorUpdate: null,

    // Data storage - now stores individual AQI for each location
    sensorLocations: {
        'lora-v1': { lat: 10.184732819803031, lng: 76.42155513804967, name: 'Adi Shankara Institute' },
        'loradev2': { lat: 10.182241040102275, lng: 76.42848375338185, name: 'Mattoor Junction-Pothiyakkara Road, Mattoor, Kalady' },
        'location2': { lat: 10.172, lng: 76.432, name: 'Location 2' },
        'location3': { lat: 10.175, lng: 76.435, name: 'Location 3' },
        'location4': { lat: 10.169, lng: 76.440, name: 'Location 4' }
    },
    sensorData: {},
    forecastData: null,
    currentParameter: 'pm25',

    // WHO limits for reference
    WHO_LIMITS: {
        "co": 4,
        "so2": 40,
        "pm25": 15,
        "pm10": 45,
        "no2": 28,
        "o3": 64,
        "nh3": 200
    },

    // Calculate individual AQI for each pollutant using Indian AQI standards
    calculateAQI: function(pollutant, concentration) {
        // AQI breakpoints for India
        const breakpoints = {
            pm25: [
                {low: 0, high: 30, aqiLow: 0, aqiHigh: 50},
                {low: 31, high: 60, aqiLow: 51, aqiHigh: 100},
                {low: 61, high: 90, aqiLow: 101, aqiHigh: 200},
                {low: 91, high: 120, aqiLow: 201, aqiHigh: 300},
                {low: 121, high: 250, aqiLow: 301, aqiHigh: 400}
            ],
            pm10: [
                {low: 0, high: 50, aqiLow: 0, aqiHigh: 50},
                {low: 51, high: 100, aqiLow: 51, aqiHigh: 100},
                {low: 101, high: 250, aqiLow: 101, aqiHigh: 200},
                {low: 251, high: 350, aqiLow: 201, aqiHigh: 300},
                {low: 351, high: 430, aqiLow: 301, aqiHigh: 400}
            ],
            so2: [
                {low: 0, high: 40, aqiLow: 0, aqiHigh: 50},
                {low: 41, high: 80, aqiLow: 51, aqiHigh: 100},
                {low: 81, high: 380, aqiLow: 101, aqiHigh: 200},
                {low: 381, high: 800, aqiLow: 201, aqiHigh: 300},
                {low: 801, high: 1600, aqiLow: 301, aqiHigh: 400}
            ],
            no2: [
                {low: 0, high: 40, aqiLow: 0, aqiHigh: 50},
                {low: 41, high: 80, aqiLow: 51, aqiHigh: 100},
                {low: 81, high: 180, aqiLow: 101, aqiHigh: 200},
                {low: 181, high: 280, aqiLow: 201, aqiHigh: 300},
                {low: 281, high: 400, aqiLow: 301, aqiHigh: 400}
            ],
            co: [
                {low: 0, high: 1, aqiLow: 0, aqiHigh: 50},
                {low: 1.1, high: 2, aqiLow: 51, aqiHigh: 100},
                {low: 2.1, high: 10, aqiLow: 101, aqiHigh: 200},
                {low: 10.1, high: 17, aqiLow: 201, aqiHigh: 300},
                {low: 17.1, high: 34, aqiLow: 301, aqiHigh: 400}
            ],
            o3: [
                {low: 0, high: 50, aqiLow: 0, aqiHigh: 50},
                {low: 51, high: 100, aqiLow: 51, aqiHigh: 100},
                {low: 101, high: 168, aqiLow: 101, aqiHigh: 200},
                {low: 169, high: 208, aqiLow: 201, aqiHigh: 300},
                {low: 209, high: 748, aqiLow: 301, aqiHigh: 400}
            ],
            nh3: [
                {low: 0, high: 200, aqiLow: 0, aqiHigh: 50},
                {low: 201, high: 400, aqiLow: 51, aqiHigh: 100},
                {low: 401, high: 800, aqiLow: 101, aqiHigh: 200},
                {low: 801, high: 1200, aqiLow: 201, aqiHigh: 300},
                {low: 1201, high: 1800, aqiLow: 301, aqiHigh: 400}
            ]
        };

        if (!breakpoints[pollutant] || concentration == null) {
            return null;
        }

        const ranges = breakpoints[pollutant];

        for (const range of ranges) {
            if (concentration >= range.low && concentration <= range.high) {
                // Linear interpolation
                const aqi = ((range.aqiHigh - range.aqiLow) / (range.high - range.low)) *
                           (concentration - range.low) + range.aqiLow;
                return Math.round(aqi);
            }
        }

        // If concentration is above the highest range, return max AQI
        return 400;
    },

    // Calculate overall AQI for a location (highest sub-index)
    calculateOverallAQI: function(pollutantData) {
        const subIndices = [];

        for (const [pollutant, concentration] of Object.entries(pollutantData)) {
            if (pollutant !== 'aqi' && concentration != null) {
                const aqi = this.calculateAQI(pollutant, concentration);
                if (aqi !== null) {
                    subIndices.push(aqi);
                }
            }
        }

        return subIndices.length > 0 ? Math.max(...subIndices) : 50; // Default to 50 if no data
    },

    // IDW Interpolation Implementation
    IDW: {
        // Calculate distance between two points using Haversine formula
        calculateDistance: function(lat1, lng1, lat2, lng2) {
            const R = 6371; // Earth's radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a =
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        },

        // Perform IDW interpolation for a single parameter
        interpolateParameter: function(targetLat, targetLng, sensorData, parameter, power = 2) {
            let weightedSum = 0;
            let weightSum = 0;
            let nearestDistance = Infinity;
            let exactMatch = null;

            // Collect all valid sensor points
            const validSensors = [];
            for (const [sensorId, location] of Object.entries(AQIMap.sensorLocations)) {
                if (sensorData[sensorId] && sensorData[sensorId][parameter] !== undefined) {
                    const distance = this.calculateDistance(targetLat, targetLng, location.lat, location.lng);

                    // Check for exact match (very close distance)
                    if (distance < 0.001) { // Less than 1 meter
                        exactMatch = sensorData[sensorId][parameter];
                        break;
                    }

                    validSensors.push({
                        id: sensorId,
                        value: sensorData[sensorId][parameter],
                        distance: distance,
                        location: location
                    });

                    nearestDistance = Math.min(nearestDistance, distance);
                }
            }

            // If exact match found, return it
            if (exactMatch !== null) {
                return {
                    value: exactMatch,
                    confidence: 1.0,
                    method: 'exact',
                    sensorsUsed: 1
                };
            }

            // Need at least 1 sensor for interpolation
            if (validSensors.length === 0) {
                return {
                    value: null,
                    confidence: 0,
                    method: 'no_data',
                    sensorsUsed: 0
                };
            }

            // If only one sensor, use distance-based confidence
            if (validSensors.length === 1) {
                const sensor = validSensors[0];
                const confidence = Math.max(0, 1 - (sensor.distance / 10)); // Confidence decreases over 10km
                return {
                    value: sensor.value,
                    confidence: confidence,
                    method: 'single_sensor',
                    sensorsUsed: 1,
                    nearestDistance: sensor.distance
                };
            }

            // Apply IDW interpolation
            for (const sensor of validSensors) {
                const weight = 1 / Math.pow(sensor.distance, power);
                weightedSum += sensor.value * weight;
                weightSum += weight;
            }

            const interpolatedValue = weightedSum / weightSum;

            // Calculate confidence based on sensor distribution and distances
            const avgDistance = validSensors.reduce((sum, s) => sum + s.distance, 0) / validSensors.length;
            const confidence = Math.max(0, Math.min(1, 1 - (avgDistance / 15))); // Confidence decreases over 15km

            return {
                value: Math.round(interpolatedValue * 100) / 100, // Round to 2 decimal places
                confidence: confidence,
                method: 'idw',
                sensorsUsed: validSensors.length,
                nearestDistance: nearestDistance,
                avgDistance: avgDistance
            };
        },

        // Interpolate all parameters for a location
        interpolateAllParameters: function(targetLat, targetLng, sensorData) {
            const parameters = ['pm25', 'pm10', 'so2', 'o3', 'co', 'no2', 'nh3'];
            const results = {};
            let totalConfidence = 0;
            let validParams = 0;

            for (const param of parameters) {
                const result = this.interpolateParameter(targetLat, targetLng, sensorData, param);
                results[param] = result;

                if (result.value !== null) {
                    totalConfidence += result.confidence;
                    validParams++;
                }
            }

            // Calculate interpolated AQI
            const interpolatedData = {};
            for (const [param, result] of Object.entries(results)) {
                if (result.value !== null) {
                    interpolatedData[param] = result.value;
                }
            }

            const calculatedAQI = AQIMap.calculateOverallAQI(interpolatedData);

            results.aqi = {
                value: calculatedAQI,
                confidence: validParams > 0 ? totalConfidence / validParams : 0,
                method: validParams > 1 ? 'idw' : (validParams === 1 ? 'single_sensor' : 'default'),
                sensorsUsed: Math.max(...Object.values(results).map(r => r.sensorsUsed || 0))
            };

            return results;
        }
    },

    // Initialize the application
    init: function() {
        // Create map if not already initialized
        if (!this.map) {
            this.map = L.map('map').setView([10.184732819803031, 76.42155513804967], 10);

            // Add base tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);

            // Initialize markers for all locations
            this.initializeMarkers();

            // Add map control event handlers
            this.addMapControls();

            // Initialize the forecast chart
            this.initForecastChart();

            // Initialize modal handlers
            this.initModalHandlers();

            // Initialize responsive UI handlers
            this.initResponsiveUI();
        }

        // Setup network monitoring
        this.setupNetworkMonitoring();

        // Fetch initial data
        this.fetchSensorData();

        // Set up interval for real-time data refresh (every 2 seconds)
        setInterval(() => this.fetchSensorData(), 2000);

        // Handle window resize
        window.addEventListener('resize', this.handleWindowResize.bind(this));

        // Initial layout adjustment
        this.handleWindowResize();

        console.log('🗺️ Real-time AQI Map initialized successfully with individual AQI per location');
    } catch (error) {
        console.error("Error initializing AQI Map:", error);
    }
});.log('🗺️ Map initialized with real-time updates every 2 seconds');
    },

    // Setup network monitoring
    setupNetworkMonitoring: function() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification("🌐 Connection restored - resuming real-time updates", "success");
            this.fetchSensorData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showNotification("📵 Connection lost - using cached data", "error");
        });
    },

    // Initialize responsive UI handlers
    initResponsiveUI: function() {
        // Toggle panel button
        document.getElementById('panel-toggle-btn').addEventListener('click', () => {
            this.toggleDetailsPanel();
        });

        // Expand panel button
        document.getElementById('expand-panel-btn').addEventListener('click', () => {
            this.toggleDetailsPanel();
        });

        // Set initial state
        const detailsPanel = document.getElementById('details-panel');
        const expandBtn = document.getElementById('expand-panel-btn');

        // On small screens, start with panel collapsed
        if (window.innerWidth < 768) {
            detailsPanel.classList.add('collapsed');
            expandBtn.style.display = 'block';
            this.isPanelCollapsed = true;

            // Update map size after panel collapse
            setTimeout(() => {
                this.map.invalidateSize();
            }, 300);
        }
    },

    // Handle window resize
    handleWindowResize: function() {
        const detailsPanel = document.getElementById('details-panel');
        const expandBtn = document.getElementById('expand-panel-btn');

        if (window.innerWidth < 768) {
            expandBtn.style.display = 'block';

            // If details panel is not already collapsed on narrow screens, collapse it
            if (!this.isPanelCollapsed) {
                detailsPanel.classList.add('collapsed');
                this.isPanelCollapsed = true;
            }
        } else {
            // On larger screens, always show the panel
            expandBtn.style.display = 'none';
            detailsPanel.classList.remove('collapsed');
            this.isPanelCollapsed = false;
        }

        // Update map size
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    },

    // Toggle details panel
    toggleDetailsPanel: function() {
        const detailsPanel = document.getElementById('details-panel');
        const expandBtn = document.getElementById('expand-panel-btn');

        if (this.isPanelCollapsed) {
            // Expand panel
            detailsPanel.classList.remove('collapsed');

            // Update icon direction based on screen size
            if (window.innerWidth >= 768) {
                expandBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            } else {
                expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
            }
        } else {
            // Collapse panel
            detailsPanel.classList.add('collapsed');

            // Update icon direction based on screen size
            if (window.innerWidth >= 768) {
                expandBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            } else {
                expandBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            }
        }

        this.isPanelCollapsed = !this.isPanelCollapsed;

        // Update map size after animation completes
        setTimeout(() => {
            this.map.invalidateSize();
        }, 300);
    },

    // Initialize markers for all sensor locations
    initializeMarkers: function() {
        // Create markers for all sensor locations
        for (const [id, location] of Object.entries(this.sensorLocations)) {
            const marker = L.marker([location.lat, location.lng]).addTo(this.map);

            // Customize popup content
            marker.bindPopup(`<strong>${location.name}</strong><br>Loading data...`);

            // Add click handler
            marker.on('click', () => {
                this.handleMarkerClick(id);
            });

            // Store marker reference
            this.markers[id] = marker;

            // Create a coverage circle but don't add to map yet
            const coverageCircle = L.circle([location.lat, location.lng], {
                radius: this.maxDistanceForData,
                color: '#4361ee',
                fillColor: '#4361ee',
                fillOpacity: 0.05,
                weight: 1.5,
                dashArray: '5, 5',
                className: 'coverage-circle'
            });

            this.coverageCircles[id] = coverageCircle;
        }
    },

    // Handle marker click - update dashboard with clicked marker's data
    handleMarkerClick: function(locationId) {
        // Center map on marker
        const location = this.sensorLocations[locationId];
        this.map.setView([location.lat, location.lng], 16);

        // If panel is collapsed, expand it
        if (this.isPanelCollapsed) {
            this.toggleDetailsPanel();
        }

        // Set this as the current selected location
        this.currentSelectedLocation = locationId;

        // Update UI with this location's data
        this.updateUIWithLocationData(locationId);

        // Update status bar with this location's AQI
        this.updateStatusBar(locationId);

        // Open popup with updated info
        this.updateMarkerPopup(locationId);
        this.markers[locationId].openPopup();

        // Show notification
        const locationName = this.sensorLocations[locationId].name;
        this.showNotification(`📍 Switched to ${locationName}`, "info");
    },

    // Update status bar with location-specific data
    updateStatusBar: function(locationId) {
        const locationData = this.sensorData[locationId];
        if (!locationData) return;

        const aqiValue = locationData.aqi;
        const status = this.getAQIStatus(aqiValue);

        // Update status bar AQI and text
        $('#status-aqi').text(aqiValue).css('color', status.color);
        $('#status-text').text(status.text);

        // Update status bar background
        $('.status-bar').css('background', `linear-gradient(90deg, ${status.color}22, ${status.color}11)`);
    },

    // Update marker popup with latest data
    updateMarkerPopup: function(locationId) {
        const locationData = this.sensorData[locationId];
        const location = this.sensorLocations[locationId];

        if (!locationData) {
            this.markers[locationId].setPopupContent(`<strong>${location.name}</strong><br>No data available`);
            return;
        }

        // Determine if this is a real sensor
        const isRealSensor = locationId === 'lora-v1' || locationId === 'loradev2';
        const sensorType = isRealSensor ? 'REAL-TIME SENSOR' : 'SIMULATED DATA';
        const sensorColor = isRealSensor ? '#10b981' : '#f59e0b';

        // Create popup content with sensor data
        let content = `
            <div style="min-width: 240px;">
                <h3 style="margin: 0 0 8px 0;">${location.name}</h3>
                <div style="background: ${sensorColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; margin-bottom: 8px; text-align: center;">
                    ${sensorType}
                </div>
                <div style="font-size: 22px; font-weight: bold; color: ${this.getAQIColor(locationData.aqi)};">
                    AQI: ${locationData.aqi}
                </div>
                <div style="font-size: 14px; margin-top: 5px;">
                    ${this.getAQIStatus(locationData.aqi).text}
                </div>
                <hr style="margin: 10px 0;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                    <div>💨 PM2.5: ${locationData.pm25}</div>
                    <div>🌫️ PM10: ${locationData.pm10}</div>
                    <div>🏭 SO₂: ${locationData.so2}</div>
                    <div>☁️ O₃: ${locationData.o3}</div>
                    <div>🚗 CO: ${locationData.co}</div>
                    <div>⚡ NO₂: ${locationData.no2}</div>
                    <div>🧪 NH₃: ${locationData.nh3}</div>
                </div>
                ${isRealSensor ? `<div style="font-size: 10px; color: #6b7280; margin-top: 8px; text-align: center;">🔄 Updates every 2s</div>` : ''}
                <hr style="margin: 10px 0;">
                <button
                    onclick="AQIMap.handleMarkerClick('${locationId}')"
                    style="padding: 5px 10px; background: #4361ee; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;"
                >
                    Show in Dashboard
                </button>
            </div>
        `;

        this.markers[locationId].setPopupContent(content);
    },

    // Fetch sensor data from the server (updated for real-time functionality)
    fetchSensorData: function() {
        if (!this.isOnline) {
            console.log("Offline - skipping data fetch");
            return;
        }

        // Make AJAX request to get sensor data
        $.ajax({
            url: window.location.pathname,  // Current URL (map_view)
            type: "GET",
            dataType: "json",
            headers: { "X-Requested-With": "XMLHttpRequest" },
            success: (data) => {
                // Update real-time sensor data with individual AQI calculations
                if (data.lora_v1 && data.lora_v1.latest_item) {
                    const pollutantData = {
                        pm25: parseFloat(data.lora_v1.latest_item.pm25 || 0),
                        pm10: parseFloat(data.lora_v1.latest_item.pm10 || 0),
                        so2: parseFloat(data.lora_v1.latest_item.so2 || 0),
                        o3: parseFloat(data.lora_v1.latest_item.o3 || 0),
                        co: parseFloat(data.lora_v1.latest_item.co || 0),
                        no2: parseFloat(data.lora_v1.latest_item.no2 || 0),
                        nh3: parseFloat(data.lora_v1.latest_item.nh3 || 0)
                    };

                    this.sensorData['lora-v1'] = {
                        ...pollutantData,
                        aqi: data.lora_v1.highest_sub_index || this.calculateOverallAQI(pollutantData)
                    };

                    // Update marker popup
                    this.updateMarkerPopup('lora-v1');
                }

                if (data.loradev2 && data.loradev2.latest_item) {
                    const pollutantData = {
                        pm25: parseFloat(data.loradev2.latest_item.pm25 || 0),
                        pm10: parseFloat(data.loradev2.latest_item.pm10 || 0),
                        so2: parseFloat(data.loradev2.latest_item.so2 || 0),
                        o3: parseFloat(data.loradev2.latest_item.o3 || 0),
                        co: parseFloat(data.loradev2.latest_item.co || 0),
                        no2: parseFloat(data.loradev2.latest_item.no2 || 0),
                        nh3: parseFloat(data.loradev2.latest_item.nh3 || 0)
                    };

                    this.sensorData['loradev2'] = {
                        ...pollutantData,
                        aqi: data.loradev2.highest_sub_index || this.calculateOverallAQI(pollutantData)
                    };

                    // Update marker popup
                    this.updateMarkerPopup('loradev2');
                }

                // Get forecast data if available
                if (data.forecast_data) {
                    this.forecastData = data.forecast_data;
                    this.updateForecastChart();
                    this.updateForecastVisuals();
                }

                // Generate simulated data for other locations with different AQI values
                this.generateSimulatedData();

                // Update user location data if tracking is active
                if (this.isTrackingLocation && this.userLocationMarker) {
                    this.updateUserLocationDataWithIDW();
                }

                // Update the dashboard with currently selected location data
                if (this.sensorData[this.currentSelectedLocation]) {
                    this.updateUIWithLocationData(this.currentSelectedLocation);
                    this.updateStatusBar(this.currentSelectedLocation);
                } else {
                    // Fallback to lora-v1 if current selection has no data
                    if (this.sensorData['lora-v1']) {
                        this.currentSelectedLocation = 'lora-v1';
                        this.updateUIWithLocationData('lora-v1');
                        this.updateStatusBar('lora-v1');
                    }
                }

                // Update counters and status
                this.updateCounter++;
                this.lastSensorUpdate = new Date();

                // Show subtle update indicator occasionally
                if (this.updateCounter % 15 === 0) { // Every 15th update (every 30 seconds)
                    this.showNotification(`📡 Real-time update #${this.updateCounter}`, "info");
                }

                console.log(`Real-time update #${this.updateCounter} completed`);
            },
            error: (xhr, status, error) => {
                console.error("AJAX error:", error);
                this.showNotification("⚠️ Connection issue - using cached data", "error");

                // Generate simulated data as fallback
                this.generateSimulatedData();
            }
        });
    },

    // Generate simulated data for locations without real sensors - each with different AQI
    generateSimulatedData: function() {
        // Use one of the real sensors as a baseline
        let baseData = null;

        if (this.sensorData['lora-v1']) {
            baseData = this.sensorData['lora-v1'];
        } else if (this.sensorData['loradev2']) {
            baseData = this.sensorData['loradev2'];
        }

        // Generate simulated data with variations - each location gets different AQI
        if (baseData) {
            // Location 2: 15% higher pollutant levels (higher AQI)
            this.sensorData['location2'] = this.generateSimulatedReading(baseData, 1.15);
            this.updateMarkerPopup('location2');

            // Location 3: 20% lower pollutant levels (lower AQI)
            this.sensorData['location3'] = this.generateDefaultReading(45); // Good
            this.updateMarkerPopup('location3');

            this.sensorData['location4'] = this.generateDefaultReading(95); // Moderate-high
            this.updateMarkerPopup('location4');

            // Also need placeholder data for real sensors
            this.sensorData['lora-v1'] = this.generateDefaultReading(60);
            this.updateMarkerPopup('lora-v1');

            this.sensorData['loradev2'] = this.generateDefaultReading(80);
            this.updateMarkerPopup('loradev2');
        }
    },

    // Generate a simulated reading based on a base reading with different AQI
    generateSimulatedReading: function(baseReading, factor) {
        const pollutantData = {};

        // Scale all pollutant parameters by the factor (not AQI directly)
        const pollutants = ['pm25', 'pm10', 'so2', 'o3', 'co', 'no2', 'nh3'];
        for (const param of pollutants) {
            if (typeof baseReading[param] === 'number') {
                pollutantData[param] = Math.round(baseReading[param] * factor * 10) / 10;
            }
        }

        // Calculate new AQI based on scaled pollutants
        const calculatedAQI = this.calculateOverallAQI(pollutantData);

        return {
            ...pollutantData,
            aqi: calculatedAQI
        };
    },

    // Generate a default reading with target AQI value
    generateDefaultReading: function(targetAQI) {
        // Create pollutant levels that would result in approximately the target AQI
        let scalingFactor = targetAQI / 100;

        // Adjust scaling to get closer to target AQI
        if (targetAQI <= 50) scalingFactor = 0.3;
        else if (targetAQI <= 100) scalingFactor = 0.7;
        else if (targetAQI <= 150) scalingFactor = 1.2;
        else scalingFactor = 1.8;

        const pollutantData = {
            pm25: Math.round(25 * scalingFactor * 10) / 10,
            pm10: Math.round(45 * scalingFactor * 10) / 10,
            so2: Math.round(12 * scalingFactor * 10) / 10,
            o3: Math.round(80 * scalingFactor * 10) / 10,
            co: Math.round(1.2 * scalingFactor * 10) / 10,
            no2: Math.round(25 * scalingFactor * 10) / 10,
            nh3: Math.round(35 * scalingFactor * 10) / 10
        };

        // Calculate actual AQI from these pollutant levels
        const calculatedAQI = this.calculateOverallAQI(pollutantData);

        return {
            ...pollutantData,
            aqi: calculatedAQI
        };
    },

    // Update UI with location data
    updateUIWithLocationData: function(locationId) {
        const locationData = this.sensorData[locationId];
        if (!locationData) return;

        // Get location name
        const locationName = this.sensorLocations[locationId] ? this.sensorLocations[locationId].name : 'Unknown';

        // Use location-specific AQI
        const displayAQI = locationData.aqi;

        // Update AQI value and status
        const status = this.getAQIStatus(displayAQI);

        $('#latest_aqi').text(displayAQI).css('color', status.color);
        $('#aqi-status').text(status.text + ' Air Quality');
        $('.current-aqi').css('background-color', status.color + '20');

        // Update pollutant values (these update in real-time)
        $('#latest_pm25').text(locationData.pm25);
        $('#latest_pm10').text(locationData.pm10);
        $('#latest_so2').text(locationData.so2);
        $('#latest_o3').text(locationData.o3);
        $('#latest_co').text(locationData.co);
        $('#latest_no2').text(locationData.no2);
        $('#latest_nh3').text(locationData.nh3);

        // Update timestamp with location name and real-time indicator
        const isRealSensor = locationId === 'lora-v1' || locationId === 'loradev2';
        const updateStatus = isRealSensor ? 'Real-time' : 'Simulated';
        $('#date').text(`${locationName} (${updateStatus}) - ${new Date().toLocaleString()}`);

        // Update health recommendations
        this.updateHealthRecommendations(displayAQI);
    },

    // Get AQI status and color
    getAQIStatus: function(value) {
        if (value <= 50) return { text: 'Good', color: '#00e400' };
        if (value <= 100) return { text: 'Moderate', color: '#ffb700' };
        if (value <= 150) return { text: 'Unhealthy', color: '#ff7e00' };
        if (value <= 200) return { text: 'Severe', color: '#ff0000' };
        if (value <= 300) return { text: 'Very Severe', color: '#8F3F97' };
        return { text: 'Hazardous', color: '#7E0023' };
    },

    // Get AQI color
    getAQIColor: function(value) {
        return this.getAQIStatus(value).color;
    },

    // Update health recommendations based on AQI
    updateHealthRecommendations: function(aqiValue) {
        const recommendations = $('.health-tips .tip-content');

        if (aqiValue <= 50) {
            $(recommendations[0]).text('Outdoor activities are safe for all individuals.');
            $(recommendations[1]).text('Air quality is good, no special precautions needed.');
            $(recommendations[2]).text('Enjoy outdoor activities and ventilate your home.');
        } else if (aqiValue <= 100) {
            $(recommendations[0]).text('Outdoor activities are safe for most individuals.');
            $(recommendations[1]).text('Unusually sensitive people should consider limiting prolonged outdoor exertion.');
            $(recommendations[2]).text('Open windows during cooler parts of the day for ventilation.');
        } else if (aqiValue <= 150) {
            $(recommendations[0]).text('Active children and adults should limit prolonged outdoor exertion.');
            $(recommendations[1]).text('People with respiratory issues should avoid outdoor activities.');
            $(recommendations[2]).text('Keep windows closed and use air purifiers if available.');
        } else if (aqiValue <= 200) {
            $(recommendations[0]).text('Everyone should avoid prolonged outdoor exertion.');
            $(recommendations[1]).text('People with respiratory issues should remain indoors.');
            $(recommendations[2]).text('Keep windows closed and use HEPA air purifiers indoors.');
        } else {
            $(recommendations[0]).text('Everyone should avoid all outdoor activities.');
            $(recommendations[1]).text('Stay indoors and reduce physical exertion.');
            $(recommendations[2]).text('Keep all windows closed and use air purifiers if available.');
        }
    },

    // Initialize forecast chart
    initForecastChart: function() {
        const ctx = document.getElementById('forecastChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Loading...',
                    data: [],
                    borderColor: '#4361ee',
                    backgroundColor: 'rgba(67, 97, 238, 0.2)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.raw + ' μg/m³';
                            }
                        },
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        padding: 10,
                        cornerRadius: 4
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'μg/m³'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 4,
                        hoverRadius: 6
                    },
                    line: {
                        borderWidth: 2
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });

        // Add parameter button click handlers
        document.querySelectorAll('.parameter-btn').forEach(button => {
            button.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.parameter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');

                // Update chart with new parameter
                this.currentParameter = button.getAttribute('data-param');
                this.updateForecastChart();
                this.updateForecastVisuals();
            });
        });
    },

    // Update forecast chart with latest data
    updateForecastChart: function() {
        if (!this.forecastData || !this.chart) return;

        const parameter = this.currentParameter;

        // Get parameter display name
        const paramNames = {
            'pm25': 'PM2.5',
            'pm10': 'PM10',
            'no2': 'NO₂',
            'o3': 'O₃',
            'so2': 'SO₂',
            'co': 'CO',
            'nh3': 'NH₃'
        };

        // Get parameter color
        const paramColors = {
            'pm25': 'rgba(247, 37, 133, 1)',
            'pm10': 'rgba(67, 97, 238, 1)',
            'no2': 'rgba(76, 201, 240, 1)',
            'o3': 'rgba(114, 9, 183, 1)',
            'so2': 'rgba(249, 65, 68, 1)',
            'co': 'rgba(67, 170, 139, 1)',
            'nh3': 'rgba(58, 12, 163, 1)'
        };

        // Extract dates and values
        const dates = this.forecastData.map(entry => entry.day);
        const values = this.forecastData.map(entry => entry[`${parameter}_max`]);

        // Add WHO limit reference line
        const whoLimit = this.WHO_LIMITS[parameter];
        const limits = Array(dates.length).fill(whoLimit);

        // Update chart data
        this.chart.data.labels = dates;
        this.chart.data.datasets = [
            {
                label: paramNames[parameter],
                data: values,
                backgroundColor: paramColors[parameter].replace('1', '0.2'),
                borderColor: paramColors[parameter],
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true
            },
            {
                label: 'WHO Limit',
                data: limits,
                borderColor: 'rgba(128, 128, 128, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            }
        ];

        // Update chart
        this.chart.update();
    },

    // Update visual forecast cards
    updateForecastVisuals: function() {
        if (!this.forecastData) return;

        const parameter = this.currentParameter;
        const forecastInfoContainer = document.getElementById('forecast-info');
        forecastInfoContainer.innerHTML = ''; // Clear current content

        // Get parameter display name and icon
        const paramNames = {
            'pm25': 'PM2.5',
            'pm10': 'PM10',
            'no2': 'NO₂',
            'o3': 'O₃',
            'so2': 'SO₂',
            'co': 'CO',
            'nh3': 'NH₃'
        };

        const paramIcons = {
            'pm25': 'fa-lungs',
            'pm10': 'fa-dust',
            'no2': 'fa-smog',
            'o3': 'fa-cloud',
            'so2': 'fa-industry',
            'co': 'fa-car',
            'nh3': 'fa-flask'
        };

        // Only show 5 days max
        const daysToShow = Math.min(this.forecastData.length, 5);

        // Create forecast cards
        for (let i = 0; i < daysToShow; i++) {
            const dayData = this.forecastData[i];
            const value = dayData[`${parameter}_max`];
            const dayName = new Date(dayData.day).toLocaleDateString('en-US', { weekday: 'short' });

            // Get color based on value and WHO limit
            const whoLimit = this.WHO_LIMITS[parameter];
            let colorClass = 'text-success';

            if (value > whoLimit * 1.5) {
                colorClass = 'text-danger';
            } else if (value > whoLimit) {
                colorClass = 'text-warning';
            }

            // Create forecast day card
            const dayCard = document.createElement('div');
            dayCard.className = 'forecast-day';
            dayCard.innerHTML = `
                <div class="forecast-date">${dayName}</div>
                <div class="forecast-icon">
                    <i class="fas ${paramIcons[parameter]}"></i>
                </div>
                <div class="forecast-value ${colorClass}">${value}</div>
                <div class="forecast-label">${paramNames[parameter]}</div>
            `;

            forecastInfoContainer.appendChild(dayCard);
        }
    },

    // User location tracking methods with IDW interpolation
    startLocationTracking: function() {
        // Check if OTP is verified
        if (!this.isOtpVerified) {
            this.showLoginModal();
            return;
        }

        // Check if geolocation is supported
        if (!navigator.geolocation) {
            this.showNotification("Geolocation is not supported by your browser", "error");
            return;
        }

        // Toggle tracking state
        this.isTrackingLocation = !this.isTrackingLocation;

        // Update tracking button appearance
        const trackingButton = document.getElementById('location-btn');
        if (trackingButton) {
            if (this.isTrackingLocation) {
                trackingButton.classList.add('active');
            } else {
                trackingButton.classList.remove('active');
            }
        }

        if (this.isTrackingLocation) {
            // Start tracking
            this.trackUserLocation();
        } else {
            // Stop tracking and remove markers
            if (this.userLocationMarker) {
                this.map.removeLayer(this.userLocationMarker);
                this.userLocationMarker = null;
            }
            if (this.userLocationCircle) {
                this.map.removeLayer(this.userLocationCircle);
                this.userLocationCircle = null;
            }
        }
    },

    trackUserLocation: function() {
        // Don't continue if tracking has been disabled
        if (!this.isTrackingLocation) return;

        const self = this;

        // Options for the geolocation API
        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };

        // Get current position
        navigator.geolocation.getCurrentPosition(
            // Success callback
            position => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy; // Accuracy in meters

                // Create a LatLng object for the user's location
                const userLatLng = L.latLng(lat, lng);

                // If we don't have a marker yet, create one
                if (!self.userLocationMarker) {
                    // Create a marker with a popup
                    self.userLocationMarker = L.marker(userLatLng, {
                        icon: L.divIcon({
                            className: 'user-location-marker',
                            html: '<div class="pulse"></div>',
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        })
                    }).addTo(self.map);

                    // Add popup to the marker
                    self.userLocationMarker.bindPopup('Your location');

                    // Create accuracy circle
                    self.userLocationCircle = L.circle(userLatLng, {
                        radius: accuracy / 2,
                        color: '#4361ee',
                        fillColor: '#4361ee',
                        fillOpacity: 0.15,
                        weight: 1
                    }).addTo(self.map);

                    // Center the map on the user's location
                    self.map.setView(userLatLng, 16);

                    // Update user location data using IDW
                    self.updateUserLocationDataWithIDW();
                } else {
                    // Update existing marker and circle positions
                    self.userLocationMarker.setLatLng(userLatLng);
                    self.userLocationCircle.setLatLng(userLatLng);
                    self.userLocationCircle.setRadius(accuracy / 2);

                    // Update user location data using IDW
                    self.updateUserLocationDataWithIDW();
                }

                // Schedule next update
                setTimeout(() => {
                    self.trackUserLocation();
                }, 10000); // Update every 10 seconds
            },
            // Error callback
            error => {
                console.error('Error getting location:', error.message);

                // Stop tracking if there's an error
                self.isTrackingLocation = false;

                // Update tracking button appearance
                const trackingButton = document.getElementById('location-btn');
                if (trackingButton) {
                    trackingButton.classList.remove('active');
                }

                // Notify user
                self.showNotification(`Error getting your location: ${error.message}`, "error");
            },
            options
        );
    },

    // Update user location data using IDW interpolation
    updateUserLocationDataWithIDW: function() {
        if (!this.userLocationMarker) return;

        const userLat = this.userLocationMarker.getLatLng().lat;
        const userLng = this.userLocationMarker.getLatLng().lng;

        // Perform IDW interpolation for all parameters
        const interpolationResults = this.IDW.interpolateAllParameters(userLat, userLng, this.sensorData);

        // Extract interpolated values
        const interpolatedData = {};
        let overallConfidence = 0;
        let validParameters = 0;
        let methodUsed = 'no_data';
        let sensorsUsed = 0;

        for (const [param, result] of Object.entries(interpolationResults)) {
            if (result.value !== null) {
                interpolatedData[param] = result.value;
                overallConfidence += result.confidence;
                validParameters++;
                methodUsed = result.method;
                sensorsUsed = Math.max(sensorsUsed, result.sensorsUsed);
            }
        }

        // Calculate average confidence
        const avgConfidence = validParameters > 0 ? overallConfidence / validParameters : 0;

        // Check if we have sufficient data
        if (validParameters === 0) {
            this.userLocationMarker.setPopupContent(`
                <div style="text-align: center; min-width: 200px;">
                    <strong>Your Location</strong>
                    <hr>
                    <div style="color: #e53e3e;">
                        <i class="fas fa-exclamation-circle"></i> No sensor data available
                    </div>
                    <div style="font-size: 12px; margin-top: 5px;">
                        Please move closer to a sensor location
                    </div>
                </div>
            `);
            return;
        }

        // Use interpolated AQI
        const displayAQI = interpolationResults.aqi.value;
        const status = this.getAQIStatus(displayAQI);

        // Create method description
        let methodDescription = '';
        switch (methodUsed) {
            case 'exact':
                methodDescription = 'Exact sensor reading';
                break;
            case 'single_sensor':
                methodDescription = `Nearest sensor data (${interpolationResults.aqi.sensorsUsed} sensor)`;
                break;
            case 'idw':
                methodDescription = `IDW interpolation (${sensorsUsed} sensors)`;
                break;
            default:
                methodDescription = 'Calculated';
        }

        // Create confidence indicator
        let confidenceClass = 'text-success';
        let confidenceText = 'High';
        if (avgConfidence < 0.3) {
            confidenceClass = 'text-danger';
            confidenceText = 'Low';
        } else if (avgConfidence < 0.7) {
            confidenceClass = 'text-warning';
            confidenceText = 'Medium';
        }

        // Update marker popup with interpolated data
        this.userLocationMarker.setPopupContent(`
            <div style="text-align: center; min-width: 240px;">
                <strong>Your Location</strong>
                <span class="idw-status" style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px;">IDW+REAL-TIME</span>
                <div style="font-size: 22px; font-weight: bold; color: ${status.color}; margin-top: 5px;">
                    AQI: ${displayAQI}
                </div>
                <div style="font-size: 14px; margin-top: 2px;">
                    ${status.text}
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 5px;">
                    ${methodDescription}
                </div>
                <div style="font-size: 10px; color: #666; margin-top: 2px;">
                    Confidence: <span class="${confidenceClass}">${confidenceText}</span> (${Math.round(avgConfidence * 100)}%)
                </div>
                <hr style="margin: 8px 0;">
                <div style="font-size: 12px; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <div>💨 PM2.5: ${interpolatedData.pm25}</div>
                    <div>🌫️ PM10: ${interpolatedData.pm10}</div>
                    <div>🏭 SO₂: ${interpolatedData.so2}</div>
                    <div>☁️ O₃: ${interpolatedData.o3}</div>
                    <div>🚗 CO: ${interpolatedData.co}</div>
                    <div>⚡ NO₂: ${interpolatedData.no2}</div>
                    <div>🧪 NH₃: ${interpolatedData.nh3}</div>
                </div>
                <div style="font-size: 10px; color: #10b981; margin-top: 5px; text-align: center;">🔄 Real-time updates every 2s</div>
                <button
                    onclick="AQIMap.updateUIWithUserLocationData()"
                    style="padding: 5px; margin-top: 8px; background: #4361ee; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;"
                >
                    Show in Dashboard
                </button>
            </div>
        `);

        // Store user location data with metadata
        this.userLocationData = {
            ...interpolatedData,
            aqi: displayAQI,
            name: "Your Location",
            method: methodUsed,
            confidence: avgConfidence,
            sensorsUsed: sensorsUsed
        };

        // Refresh the popup if it's open
        if (this.map.hasLayer(this.userLocationMarker._popup)) {
            this.userLocationMarker._popup.update();
        }
    },

    // Update dashboard with user location data
    updateUIWithUserLocationData: function() {
        if (!this.userLocationData) return;

        // Set user location as current selection
        this.currentSelectedLocation = 'user-location';

        // Use interpolated AQI for display
        const displayAQI = this.userLocationData.aqi;

        // Update AQI value and status
        const status = this.getAQIStatus(displayAQI);

        $('#latest_aqi').text(displayAQI).css('color', status.color);
        $('#aqi-status').text(status.text + ' Air Quality');
        $('#status-aqi').text(displayAQI);
        $('#status-text').text(status.text);
        $('.current-aqi').css('background-color', status.color + '20');
        $('#status-aqi').css('color', status.color);

        // Update status bar background
        $('.status-bar').css('background', `linear-gradient(90deg, ${status.color}22, ${status.color}11)`);

        // Update pollutant values (real-time interpolated)
        $('#latest_pm25').text(this.userLocationData.pm25);
        $('#latest_pm10').text(this.userLocationData.pm10);
        $('#latest_so2').text(this.userLocationData.so2);
        $('#latest_o3').text(this.userLocationData.o3);
        $('#latest_co').text(this.userLocationData.co);
        $('#latest_no2').text(this.userLocationData.no2);
        $('#latest_nh3').text(this.userLocationData.nh3);

        // Update timestamp with method information
        let methodText = '';
        if (this.userLocationData.method === 'idw') {
            methodText = ` (IDW+Real-time with ${this.userLocationData.sensorsUsed} sensors)`;
        } else if (this.userLocationData.method === 'single_sensor') {
            methodText = ' (Nearest sensor+Real-time)';
        }

        $('#date').text(`Your Location${methodText} - ${new Date().toLocaleString()}`);

        // Update health recommendations
        this.updateHealthRecommendations(displayAQI);

        // If panel is collapsed, expand it to show the data
        if (this.isPanelCollapsed) {
            this.toggleDetailsPanel();
        }

        // Show notification about interpolation method
        if (this.userLocationData.method === 'idw') {
            this.showNotification(`Real-time air quality from ${this.userLocationData.sensorsUsed} nearby sensors`, "info");
        }
    },

    // Toggle sensor coverage visibility
    toggleCoverage: function() {
        this.isCoverageVisible = !this.isCoverageVisible;

        // Update button appearance
        const coverageBtn = document.getElementById('coverage-btn');
        if (coverageBtn) {
            if (this.isCoverageVisible) {
                coverageBtn.classList.add('active');
            } else {
                coverageBtn.classList.remove('active');
            }
        }

        // Show or hide the coverage circles
        for (const [id, circle] of Object.entries(this.coverageCircles)) {
            if (this.isCoverageVisible) {
                circle.addTo(this.map);
            } else {
                circle.remove();
            }
        }
    },

    // Show phone login modal
    showLoginModal: function() {
        document.getElementById('login-modal').style.display = 'flex';
    },

    // Hide phone login modal
    hideLoginModal: function() {
        document.getElementById('login-modal').style.display = 'none';
    },

    // Show OTP verification modal
    showOtpModal: function() {
        document.getElementById('otp-modal').style.display = 'flex';
    },

    // Hide OTP verification modal
    hideOtpModal: function() {
        document.getElementById('otp-modal').style.display = 'none';
    },

    // Initialize modal handlers
    initModalHandlers: function() {
        // Login modal close button
        document.getElementById('close-login-modal-btn').addEventListener('click', () => {
            this.hideLoginModal();
        });

        // OTP modal close button
        document.getElementById('close-otp-modal-btn').addEventListener('click', () => {
            this.hideOtpModal();
        });

        // Check if we need to show OTP verification after phone submission
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('verify_otp') === 'true') {
            this.showOtpModal();
        }
    },

    // Show a notification (enhanced for real-time updates)
    showNotification: function(message, type = "info") {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notification-text');

        // Set message and type
        notificationText.textContent = message;
        notification.className = 'notification notification-' + type;

        // Show notification
        notification.classList.add('show');

        // Hide after 3 seconds for info notifications, 5 seconds for others
        const duration = type === 'info' ? 3000 : 5000;
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    },

    // Add map controls
    addMapControls: function() {
        // Zoom in button
        document.getElementById('zoom-in-btn').addEventListener('click', () => {
            this.map.zoomIn();
        });

        // Zoom out button
        document.getElementById('zoom-out-btn').addEventListener('click', () => {
            this.map.zoomOut();
        });

        // Location button
        const locationBtn = document.getElementById('location-btn');
        if (locationBtn) {
            locationBtn.addEventListener('click', () => {
                if (!this.isOtpVerified) {
                    this.showLoginModal();
                } else {
                    this.startLocationTracking();
                }
            });
        }

        // Coverage button
        const coverageBtn = document.getElementById('coverage-btn');
        if (coverageBtn) {
            coverageBtn.addEventListener('click', () => {
                this.toggleCoverage();
            });
        }
    }
}; // End of AQIMap object

// Initialize the application when the document is ready
$(document).ready(function() {
    try {
        AQIMap.init();
        console = this.generateSimulatedReading(baseData, 0.8);
            this.updateMarkerPopup('location3');

            // Location 4: 10% higher pollutant levels (slightly higher AQI)
            this.sensorData['location4'] = this.generateSimulatedReading(baseData, 1.1);
            this.updateMarkerPopup('location4');
        } else {
            // If no real data, use completely simulated values with different AQI levels
            this.sensorData['location2'] = this.generateDefaultReading(75); // Moderate
            this.updateMarkerPopup('location2');

            this.sensorData['location3']