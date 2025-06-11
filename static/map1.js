document.addEventListener("DOMContentLoaded", () => {
    // Initialize the map
    var map = L.map('map').setView([10.15, 76.40], 10); // Centered at Kerala

    // Add a tile layer to the map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const apiKey = "9704c81cfc6cd5ecde09c50f958d6326";
    const apiUrl = "https://api.openweathermap.org/data/2.5/weather?units=metric$&q=";

   /* const searchbox = document.querySelector(".search input");
    const searchbtn = document.querySelector(".search button");*/

    async function checkweather(city){
      const response = await fetch(apiUrl +  city + `&appid=${apiKey}`);
      var data =await response.json();

      console.log(data);
      document.querySelector(".city").innerHTML = data.name;
    /*  document.querySelector(".temp").innerHTML =Math.round (data.main.temp) +"°C";
      document.querySelector(".humidity").innerHTML = data.main.humidity +"%";
      document.querySelector(".wind").innerHTML = data.wind.speed+ "Km/h";*/
  }
 locations.forEach(location => {
        var marker = L.marker(location.coords).addTo(map);
        marker.bindPopup(location.name);
        marker.on('click', () => updateAQIDetails(location));
    });
});