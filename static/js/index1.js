// Air Quality Dashboard JavaScript

// Fetch latest AQI data from server
function fetchLatestData() {
  $.ajax({
    url: "/", // Adjust this URL to match your Django URL pattern
    type: "GET",
    dataType: "json",
    success: function (data) {
      console.log("AJAX success:", data);
      if (data.latest_item) {
        updateDashboard(data.latest_item, data.highest_sub_index);
      } else {
        console.error("No data in response.");
      }
    },
    error: function (xhr, status, error) {
      console.error("AJAX error:", error);
    }
  });
}

// Update dashboard with latest AQI data
function updateDashboard(latestItem, highestSubIndex) {
  $('#received-at').text(latestItem.date || 'N/A');
  $('#aqi').text(highestSubIndex || 'N/A');

  const aqiValue = parseInt(highestSubIndex || 0, 10);
  const aqiStatusElement = $('.aqi-status');
  const aqiIconElement = $('.aqi-icon i');

  // Update AQI status and icon based on value
  if (aqiValue <= 50) {
    aqiStatusElement.text('AQI - GOOD');
    aqiIconElement.attr('class', 'fas fa-smile').css('color', '#10b981');
  } else if (aqiValue <= 100) {
    aqiStatusElement.text('AQI - MODERATE');
    aqiIconElement.attr('class', 'fas fa-meh').css('color', '#f59e0b');
  } else if (aqiValue <= 150) {
    aqiStatusElement.text('AQI - UNHEALTHY');
    aqiIconElement.attr('class', 'fas fa-frown').css('color', '#ef4444');
  } else {
    aqiStatusElement.text('AQI - HAZARDOUS');
    aqiIconElement.attr('class', 'fas fa-biohazard').css('color', '#7c2d12');
  }
}

// Create animated particles for hero section
function createParticles() {
  const particlesContainer = document.getElementById('particles');

  if (!particlesContainer) {
    return; // Exit if particles container doesn't exist
  }

  // Create 40 particles with random properties
  for (let i = 0; i < 40; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.width = Math.random() * 6 + 4 + 'px';
    particle.style.height = particle.style.width;
    particle.style.animationDelay = Math.random() * 8 + 's';
    particlesContainer.appendChild(particle);
  }
}

// Toggle mobile navigation menu
function toggleMenu() {
  const navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    navLinks.classList.toggle('active');
  }
}

// Smooth scrolling for anchor links
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });
}

// Initialize page functionality
function initializePage() {
  createParticles();
  fetchLatestData();
  initSmoothScrolling();
}

// Auto-refresh data every 5 seconds
function startAutoRefresh() {
  setInterval(fetchLatestData, 5000);
}

// Document ready handler
$(document).ready(function() {
  initializePage();
  startAutoRefresh();
});

// Window load handler
window.addEventListener('load', function() {
  initializePage();
});

// Handle window resize for responsive particles
window.addEventListener('resize', function() {
  const particlesContainer = document.getElementById('particles');
  if (particlesContainer) {
    // Clear existing particles
    particlesContainer.innerHTML = '';
    // Recreate particles with new dimensions
    createParticles();
  }
});

// Utility function to format date/time
function formatDateTime(dateString) {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

// Handle network errors gracefully
function handleNetworkError() {
  console.warn('Network error - using cached data if available');
  // You could implement local storage caching here
}

// Expose functions to global scope for onclick handlers
window.toggleMenu = toggleMenu;
window.fetchLatestData = fetchLatestData;