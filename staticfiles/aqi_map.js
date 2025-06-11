document.addEventListener("DOMContentLoaded", function() {
    // Initialize the map centered on India
    var map = L.map('map').setView([10.15, 76.40],10);

    // Add the OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Function to update AQI details on the panel
    function updateAQIDetails(location) {
        document.getElementById('city').textContent = location.city;
        document.getElementById('aqi-index').textContent = location.aqi;
        document.getElementById('aqi-status').textContent = getAQIStatus(location.aqi);
        document.getElementById('pm25').textContent = location.pm25;
        document.getElementById('pm10').textContent = location.pm10;
        document.getElementById('so2').textContent = location.so2;
        document.getElementById('o3').textContent = location.o3;
        document.getElementById('co').textContent = location.co;
        document.getElementById('no2').textContent = location.no2;
        document.getElementById('weather').textContent = location.weather || "Data not available";
    }

    // Function to determine AQI status
    function getAQIStatus(aqi) {
        if (aqi <= 50) return 'Good';
        if (aqi <= 100) return 'Moderate';
        if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
        if (aqi <= 200) return 'Unhealthy';
        if (aqi <= 300) return 'Very Unhealthy';
        return 'Hazardous';
    }

    // Example locations array passed from the Django template
    var locations = JSON.parse(document.getElementById('location-data').textContent);

    // Add markers to the map
    locations.forEach(function(location) {
        var marker = L.marker([location.lat, location.lon]).addTo(map);
        marker.on('click', function() {
            updateAQIDetails(location);
        });
    });
});
