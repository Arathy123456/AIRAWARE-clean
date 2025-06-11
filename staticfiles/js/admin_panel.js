  fetchSensorData: function() {
        // Make AJAX request to get sensor data
        $.ajax({
            url: window.location.pathname,  // Current URL (map_view)
            type: "GET",
            dataType: "json",
            headers: { "X-Requested-With": "XMLHttpRequest" },
            success: (data) => {
                // Update data for real sensors
                if (data.lora_v1 && data.lora_v1.latest_item) {
                    this.sensorData['lora-v1'] = {
                        aqi: data.lora_v1.highest_sub_index,
                        pm25: parseFloat(data.lora_v1.latest_item.pm25 || 0),
                        pm10: parseFloat(data.lora_v1.latest_item.pm10 || 0),
                        so2: parseFloat(data.lora_v1.latest_item.so2 || 0),
                        o3: parseFloat(data.lora_v1.latest_item.o3 || 0),
                        co: parseFloat(data.lora_v1.latest_item.co || 0),
                        no2: parseFloat(data.lora_v1.latest_item.no2 || 0),
                        nh3: parseFloat(data.lora_v1.latest_item.nh3 || 0)
                    };

                    // Update marker popup
                    this.updateMarkerPopup('lora-v1');
                }

                if (data.loradev2 && data.loradev2.latest_item) {
                    this.sensorData['loradev2'] = {
                        aqi: data.loradev2.highest_sub_index,
                        pm25: parseFloat(data.loradev2.latest_item.pm25 || 0),
                        pm10: parseFloat(data.loradev2.latest_item.pm10 || 0),
                        so2: parseFloat(data.loradev2.latest_item.so2 || 0),
                        o3: parseFloat(data.loradev2.latest_item.o3 || 0),
                        co: parseFloat(data.loradev2.latest_item.co || 0),
                        no2: parseFloat(data.loradev2.latest_item.no2 || 0),
                        nh3: parseFloat(data.loradev2.latest_item.nh3 || 0)
                    };

        $(document).ready(function() {
            // Toggle sidebar
            $('#toggle-sidebar').on('click', function() {
                $('#sidebar').toggleClass('collapsed');
                $('#content-area').toggleClass('expanded');
            });

            // Toggle floating action menu
            $('#action-toggle').on('click', function() {
                $('#action-menu').slideToggle();
                $(this).find('i').toggleClass('fa-plus fa-times');
            });

            // Toggle dark/light mode (placeholder functionality)
            $('#mode-toggle').on('change', function() {
                $('body').toggleClass('light-mode');
            });

            // Function to fetch and update sensor data
            function updateSensorData() {
                // Simulate API call with setTimeout
                setTimeout(function() {
                    // Update would happen here with real API
                    console.log('Sensor data updated');

                    // Show notification
                    showNotification('Data refreshed successfully', 'success');
                }, 1000);
            }

            // Show notification function
            function showNotification(message, type = 'info') {
                const notificationHtml = `
                    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                        ${message}
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                `;
                $('#notification-container').html(notificationHtml);

                // Auto dismiss after 5 seconds
                setTimeout(function() {
                    $('#notification-container .alert').alert('close');
                }, 5000);
            }

            // Threshold slider functionality
            $('.threshold-slider').on('input', function() {
                $(this).parent().find('span:last-child').text(this.value + ' μg/m³');
            });

            // Initialize with a simulated data refresh
            updateSensorData();

            // Set up periodic refresh (every 5 minutes)
            setInterval(updateSensorData, 5 * 60 * 1000);
        });
    </script>