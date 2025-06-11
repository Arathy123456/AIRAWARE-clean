document.addEventListener("DOMContentLoaded", () => {
    // Initialize the map
    var map = L.map('map').setView([10.15, 76.40], 10); // Centered at Kerala

    // Add a tile layer to the map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);


    // Define locations with their data
    var locations = [
        {
            name: "Kizhakkencheri II, Angamaly, Kerala, India",

            coords: [10.1976, 76.3863],
            aqi: 87,
            pm25: 29,
            pm10: 51,
            so2: 4,
            o3: 5,
            co: 600,
            no2: 6,
            weather: "28°C"
        },
        {
            name: "New Delhi, India",
            coords: [28.6139, 77.2090],
            aqi: 92,
            pm25: 35,
            pm10: 55,
            so2: 8,
            o3: 7,
            co: 620,
            no2: 12,
            weather: "30°C"
        },
        {
            name: "Ahmedabad, India",
            coords: [23.0225, 72.5714],
            aqi: 82,
            pm25: 27,
            pm10: 49,
            so2: 5,
            o3: 6,
            co: 610,
            no2: 10,
            weather: "32°C"
        }
        // Add more locations as needed
    ];
    // Function to update the AQI details panel
    function updateAQIDetails(location) {
        document.getElementById("location-name").textContent = location.name;
        document.getElementById("aqi-index").textContent = location.aqi;
        document.getElementById("aqi-status").textContent = location.aqi < 50 ? "Good" : location.aqi < 100 ? "Moderate" : location.aqi < 150 ? "Unhealthy for Sensitive Groups" : location.aqi < 200 ? "Unhealthy" : location.aqi < 300 ? "Very Unhealthy" : "Hazardous";
        document.getElementById("pm25").textContent = location.pm25;
        document.getElementById("pm10").textContent = location.pm10;
        document.getElementById("so2").textContent = location.so2;
        document.getElementById("o3").textContent = location.o3;
        document.getElementById("co").textContent = location.co;
        document.getElementById("no2").textContent = location.no2;
        document.getElementById("weather").textContent = location.weather;
    }

    // Add markers to the map
    locations.forEach(location => {
        var marker = L.marker(location.coords).addTo(map);
        marker.bindPopup(location.name);
        marker.on('click', () => updateAQIDetails(location));
    });
});
